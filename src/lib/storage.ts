import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import type { AppData } from "../types";
import { createSeedData } from "./seed";

const WEB_KEY = "bar-pos-data-v1";
const NATIVE_PATH = "bar-pos-data.json";
const NATIVE_BACKUP_PATH = "bar-pos-data.bak.json";

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function sanitize(value: unknown): AppData {
  const data = value as Partial<AppData> | null;
  if (!data || data.schemaVersion !== 1 || !data.settings || !Array.isArray(data.drinks)) {
    return createSeedData();
  }
  const seed = createSeedData();
  return {
    ...seed,
    ...data,
    settings: { ...seed.settings, ...(data.settings || {}) },
    categories: data.categories || [],
    drinks: data.drinks || [],
    tables: data.tables || [],
    members: data.members || [],
    orders: data.orders || [],
    rechargeRecords: data.rechargeRecords || [],
    balanceAdjustmentRecords: data.balanceAdjustmentRecords || [],
    paymentRecords: data.paymentRecords || []
  };
}

export async function loadAppData(): Promise<AppData> {
  if (!isNative()) {
    try {
      const raw = window.localStorage.getItem(WEB_KEY);
      return raw ? sanitize(JSON.parse(raw)) : createSeedData();
    } catch {
      return createSeedData();
    }
  }

  try {
    const result = await Filesystem.readFile({
      path: NATIVE_PATH,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });
    return sanitize(JSON.parse(result.data as string));
  } catch {
    return createSeedData();
  }
}

let writeQueue: Promise<void> = Promise.resolve();

export function persistAppData(data: AppData): Promise<void> {
  const payload = JSON.stringify(data);
  if (!isNative()) {
    try {
      window.localStorage.setItem(WEB_KEY, payload);
    } catch {
      // Storage quota or private mode: keep the in-memory session running.
    }
    return Promise.resolve();
  }

  writeQueue = writeQueue.then(async () => {
    try {
      await Filesystem.copy({
        from: NATIVE_PATH,
        to: NATIVE_BACKUP_PATH,
        directory: Directory.Documents
      });
    } catch {
      // First save has no backup file yet.
    }
    await Filesystem.writeFile({
      path: NATIVE_PATH,
      data: payload,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: false
    });
  });
  return writeQueue;
}
