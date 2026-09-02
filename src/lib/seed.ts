import type { AppData } from "../types";

export const DATA_VERSION = 1 as const;

const now = Date.now();

export function createSeedData(): AppData {
  return {
    schemaVersion: DATA_VERSION,
    categories: [
      { id: "cat_beer", name: "精酿", sort: 1 },
      { id: "cat_spirits", name: "洋酒", sort: 2 },
      { id: "cat_cocktail", name: "鸡尾酒", sort: 3 },
      { id: "cat_soft", name: "软饮", sort: 4 },
      { id: "cat_other", name: "未分类", sort: 99, isSystem: true }
    ],
    drinks: [
      { id: "drink_beer", categoryId: "cat_beer", name: "精酿生啤", shortName: "生啤", priceCents: 2800, enabled: true, sort: 1 },
      { id: "drink_whisky", categoryId: "cat_spirits", name: "威士忌", shortName: "威士忌", priceCents: 4500, enabled: true, sort: 1 },
      { id: "drink_gin", categoryId: "cat_cocktail", name: "金汤力", shortName: "金汤力", priceCents: 3800, enabled: true, sort: 1 },
      { id: "drink_cola", categoryId: "cat_soft", name: "可乐", shortName: "可乐", priceCents: 1200, enabled: true, sort: 1 },
      { id: "drink_soda", categoryId: "cat_soft", name: "苏打水", shortName: "苏打水", priceCents: 1000, enabled: true, sort: 2 }
    ],
    tables: Array.from({ length: 6 }, (_, index) => ({
      id: `table_${index + 1}`,
      name: `${index + 1}号桌`,
      seats: 2 + (index % 3) * 2,
      status: "idle" as const,
      sort: index + 1
    })),
    members: [],
    orders: [],
    rechargeRecords: [],
    balanceAdjustmentRecords: [],
    paymentRecords: [],
    settings: {
      shopName: "我的酒吧",
      shopPhone: "",
      receiptFooter: "感谢惠顾，欢迎再次光临",
      printerEnabled: true,
      printerHost: "192.168.1.100",
      printerPort: 9100,
      printOnOrder: true,
      printOnCheckout: true,
      cutMode: "gs-v66",
      autoShowQr: true
    }
  };
}

export function seedStartedAt(): number {
  return now;
}
