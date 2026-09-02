import { registerPlugin } from "@capacitor/core";
import type {
  DiscoveredPrinter,
  EscposPrinterPlugin,
  PrintRequest,
  PrintResult
} from "../lib/receipt";

class WebEscposPrinter implements EscposPrinterPlugin {
  async print(_options: PrintRequest): Promise<PrintResult> {
    return { ok: false, message: "网页预览模式：请在 iPad App 内连接局域网打印机" };
  }

  async testPrint(): Promise<PrintResult> {
    return { ok: false, message: "网页预览模式：请在 iPad App 内连接局域网打印机" };
  }

  async discover(): Promise<{ printers: DiscoveredPrinter[] }> {
    return { printers: [] };
  }
}

export const EscposPrinter = registerPlugin<EscposPrinterPlugin>("EscposPrinter", {
  web: () => new WebEscposPrinter()
});
