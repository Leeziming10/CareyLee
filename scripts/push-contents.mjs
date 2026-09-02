import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  throw new Error("Missing GITHUB_TOKEN");
}

const owner = process.env.GITHUB_OWNER || "Leeziming10";
const repo = process.env.GITHUB_REPO || "CareyLee";
const branch = "main";
const apiHost = "api.github.com";
const apiIp = "140.82.112.5";

function runCurl(args) {
  const output = execFileSync(
    "curl.exe",
    [
      "-sS",
      "--http1.1",
      "--resolve",
      `${apiHost}:443:${apiIp}`,
      "-H",
      `Authorization: Bearer ${token}`,
      "-H",
      "Accept: application/vnd.github+json",
      ...args
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return output ? JSON.parse(output) : {};
}

function request(method, urlPath, body) {
  const args = ["-X", method, `https://${apiHost}${urlPath}`];
  let payloadPath;
  try {
    if (body) {
      payloadPath = path.join(os.tmpdir(), `barpos-contents-${process.pid}.json`);
      fs.writeFileSync(payloadPath, JSON.stringify(body), "utf8");
      args.push("-H", "Content-Type: application/json", "--data-binary", `@${payloadPath}`);
    }
    return runCurl(args);
  } finally {
    if (payloadPath) fs.rmSync(payloadPath, { force: true });
  }
}

function listFiles() {
  const raw = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", "-z", "HEAD"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return raw.split("\0").filter(Boolean);
}

function encodePath(file) {
  return file.split("/").map(encodeURIComponent).join("/");
}

function putFile(file, message) {
  const content = fs.readFileSync(path.resolve(file)).toString("base64");
  const response = request(
    "PUT",
    `/repos/${owner}/${repo}/contents/${encodePath(file)}`,
    {
      message,
      content,
      branch
    },
  );
  if (response.status && response.status >= 400) {
    const alreadyExists = response.status === 422 && /sha|already exists|must match/i.test(response.message || "");
    if (!alreadyExists) {
      throw new Error(`${file}: ${response.message || response.status}`);
    }
    return false;
  }
  return true;
}

const files = listFiles();
const workflowFile = ".github/workflows/build-ios.yml";
const ordinary = files.filter((file) => file !== workflowFile);
const workflow = files.filter((file) => file === workflowFile);
const readme = files.filter((file) => file === "README.md");

for (const file of ordinary) {
  putFile(file, `feat: ${file}`);
}
for (const file of workflow) {
  putFile(file, "ci: add iOS unsigned build");
}
for (const file of readme) {
  putFile(file, "docs: trigger first iOS build");
}

console.log(`Uploaded ${files.length} files to ${branch}`);
