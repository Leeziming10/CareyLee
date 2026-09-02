import type { AppSettings, Order } from "../types";
import { formatCents, formatDiscountPercent } from "./money";

export type ReceiptLine = {
  text?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  doubleSize?: boolean;
  spacer?: boolean;
  separator?: boolean;
};

export interface PrintRequest {
  host: string;
  port: number;
  copies?: number;
  lines: ReceiptLine[];
  cut?: boolean;
  cutMode?: "gs-v66" | "esc-i";
}

export interface PrintResult {
  ok: boolean;
  sentBytes?: number;
  message?: string;
}

export interface DiscoveredPrinter {
  host: string;
  name?: string;
}

export interface EscposPrinterPlugin {
  print(options: PrintRequest): Promise<PrintResult>;
  testPrint(options: { host: string; port: number; cutMode?: string }): Promise<PrintResult>;
  discover(options?: { timeoutMs?: number }): Promise<{ printers: DiscoveredPrinter[] }>;
}

function separator(): ReceiptLine {
  return { text: "--------------------------------", align: "left" };
}

function space(): ReceiptLine {
  return { spacer: true };
}

function header(order: Order, settings: AppSettings, title: string, tableName?: string): ReceiptLine[] {
  const date = new Date(order.settledAt ?? order.startedAt);
  const pad = (value: number) => String(value).padStart(2, "0");
  const dateText = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const table = tableName
    ? `桌号 ${tableName}  ${dateText}`
    : dateText;
  return [
    { text: settings.shopName, align: "center", bold: true, doubleSize: true },
    ...(settings.shopPhone ? [{ text: settings.shopPhone, align: "center" } as ReceiptLine] : []),
    { text: title, align: "center", bold: true },
    { text: table, align: "left" },
    separator()
  ];
}

export function buildOrderTicketLines(
  order: Order,
  settings: AppSettings,
  tableName?: string,
): ReceiptLine[] {
  const lines: ReceiptLine[] = header(order, settings, "出酒单", tableName);
  order.items.forEach((item) => {
    lines.push({ text: `${item.shortName || item.name}  x${item.qty}`, align: "left", bold: true });
    lines.push({ text: formatCents(item.qty * item.unitPriceCents), align: "right" });
  });
  const subtotal = order.items.reduce((sum, item) => sum + item.unitPriceCents * item.qty, 0);
  lines.push(separator(), { text: `合计 ${formatCents(subtotal)}`, align: "right", bold: true });
  return finish(lines, settings);
}

export function buildSettlementReceiptLines(
  order: Order,
  settings: AppSettings,
  tableName?: string,
): ReceiptLine[] {
  const date = new Date(order.settledAt ?? Date.now());
  const pad = (value: number) => String(value).padStart(2, "0");
  const lines: ReceiptLine[] = [
    { text: settings.shopName, align: "center", bold: true, doubleSize: true },
    ...(settings.shopPhone ? [{ text: settings.shopPhone, align: "center" } as ReceiptLine] : []),
    { text: "结账单", align: "center", bold: true },
    { text: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`, align: "left" },
    { text: `单号 ${order.receiptNo}`, align: "left" },
    { text: `桌台 ${tableName || "散台"}`, align: "left" },
    ...(order.memberName ? [{ text: `会员 ${order.memberName}`, align: "left" } as ReceiptLine] : []),
    separator()
  ];

  order.items.forEach((item) => {
    lines.push({ text: `${item.shortName || item.name}  x${item.qty}  ${formatCents(item.unitPriceCents)}`, align: "left" });
    lines.push({ text: formatCents(item.qty * item.unitPriceCents), align: "right" });
  });

  lines.push(separator());
  lines.push({ text: `合计 ${formatCents(order.totals.subtotalCents)}`, align: "right", bold: true });
  if (order.memberName && order.discountPercent < 100) {
    lines.push({
      text: `${order.memberName} 折扣（${formatDiscountPercent(order.discountPercent)}）-${formatCents(order.totals.memberDiscountCents)}`,
      align: "right"
    });
  }
  if (order.totals.manualDiscountCents > 0) {
    lines.push({ text: `手动优惠 -${formatCents(order.totals.manualDiscountCents)}`, align: "right" });
  }
  lines.push({ text: `应付 ${formatCents(order.totals.payableCents)}`, align: "right", bold: true });
  if (order.balanceUsedCents > 0) {
    lines.push({ text: `储值 -${formatCents(order.balanceUsedCents)}`, align: "right" });
  }
  if (order.qrPayCents > 0) {
    const method = order.paymentMethod === "alipay" ? "支付宝" : "微信";
    lines.push({ text: `${method} ${formatCents(order.qrPayCents)}`, align: "right" });
  }
  return finish(lines, settings);
}

function finish(lines: ReceiptLine[], settings: AppSettings): ReceiptLine[] {
  lines.push(space());
  if (settings.receiptFooter.trim()) {
    lines.push({ text: settings.receiptFooter.trim(), align: "center" });
  }
  lines.push(space());
  return lines;
}
