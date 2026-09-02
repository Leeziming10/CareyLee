import type { AppSettings, Order, Table } from "../types";
import { EscposPrinter } from "../native/escpos";
import {
  buildOrderTicketLines,
  buildSettlementReceiptLines,
  type PrintResult,
  type ReceiptLine
} from "./receipt";

function canPrint(settings: AppSettings): boolean {
  return settings.printerEnabled && settings.printerHost.trim().length > 0 && settings.printerPort > 0;
}

export async function sendReceiptLines(
  settings: AppSettings,
  lines: ReceiptLine[],
): Promise<PrintResult> {
  if (!canPrint(settings)) {
    return { ok: false, message: "请先在设置中启用并配置打印机" };
  }
  try {
    return await EscposPrinter.print({
      host: settings.printerHost.trim(),
      port: settings.printerPort,
      copies: 1,
      lines,
      cut: true,
      cutMode: settings.cutMode
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "打印插件不可用" };
  }
}

export async function printOrderTicket(
  settings: AppSettings,
  order: Order,
  table?: Table,
): Promise<PrintResult> {
  const lines = buildOrderTicketLines(order, settings, table?.name);
  return sendReceiptLines(settings, lines);
}

export async function printSettlementReceipt(
  settings: AppSettings,
  order: Order,
  table?: Table,
): Promise<PrintResult> {
  const lines = buildSettlementReceiptLines(order, settings, table?.name);
  return sendReceiptLines(settings, lines);
}
