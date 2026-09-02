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
const apiHost = "api.github.com";
const apiIp = "140.82.112.5";

function runCurl(args, parse = true) {
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
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return parse && output ? JSON.parse(output) : output;
}

function api(method, endpoint, body) {
  const args = ["-X", method, `https://${apiHost}${endpoint}`];
  let payloadPath;
  if (body) {
    payloadPath = path.join(os.tmpdir(), `barpos-github-${process.pid}.json`);
    fs.writeFileSync(payloadPath, JSON.stringify(body), "utf8");
    args.push("-H", "Content-Type: application/json", "--data-binary", `@${payloadPath}`);
  }
  try {
    return runCurl(args);
  } finally {
    if (payloadPath) {
      fs.rmSync(payloadPath, { force: true });
    }
  }
}

function refUrl(branch) {
  return `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
}

function listLocalFiles() {
  const raw = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", "-z", "HEAD"],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  return raw.split("\0").filter(Boolean);
}

function insertPath(root, segments, sha) {
  let children = root.entries;
  for (let index = 0; index < segments.length - 1; index += 1) {
    let node = children.find((item) => item.name === segments[index]);
    if (!node) {
      node = { name: segments[index], type: "tree", entries: [] };
      children.push(node);
    }
    children = node.entries;
  }
  children.push({ name: segments[segments.length - 1], type: "blob", sha });
}

async function createTrees(root) {
  async function writeTree(node) {
    if (node.type === "blob") {
      return { name: node.name, mode: "100644", type: "blob", sha: node.sha };
    }
    const children = [];
    for (const child of node.entries) {
      children.push(await writeTree(child));
    }
    const response = api("POST", `/repos/${owner}/${repo}/git/trees`, {
      tree: children.map(({ name, mode, type, sha }) => ({ path: name, mode, type, sha })),
    });
    return { name: node.name, mode: "040000", type: "tree", sha: response.sha };
  }
  return writeTree(root);
}

const repoInfo = api("GET", `/repos/${owner}/${repo}`);
const branch = repoInfo.default_branch || "main";
let remoteSha;
try {
  const ref = api("GET", refUrl(branch));
  remoteSha = ref.object.sha;
} catch {
  remoteSha = null;
}

const localFiles = listLocalFiles();
const localSet = new Set(localFiles);
const root = { name: "", type: "tree", entries: [] };

for (const file of localFiles) {
  const content = fs.readFileSync(path.resolve(file));
  const blob = api("POST", `/repos/${owner}/${repo}/git/blobs`, {
    content: content.toString("base64"),
    encoding: "base64",
  });
  insertPath(root, file.split(/[\\/]/), blob.sha);
}

let parents = [];
if (remoteSha) {
  const commit = api("GET", `/repos/${owner}/${repo}/git/commits/${remoteSha}`);
  const tree = api("GET", `/repos/${owner}/${repo}/git/trees/${commit.tree.sha}?recursive=1`);
  for (const item of tree.tree) {
    if (item.type === "blob" && !localSet.has(item.path)) {
      insertPath(root, item.path.split("/"), item.sha);
    }
  }
  parents = [remoteSha];
}

const rootTree = await createTrees(root);
const commit = api("POST", `/repos/${owner}/${repo}/git/commits`, {
  message: "feat: iPad bar POS with local ESC/POS printing",
  tree: rootTree.sha,
  parents,
});

if (remoteSha) {
  api("PATCH", refUrl(branch), { sha: commit.sha, force: true });
} else {
  api("POST", `/repos/${owner}/${repo}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: commit.sha,
  });
}

console.log(`Pushed commit ${commit.sha} to ${branch} (${localFiles.length} files)`);
