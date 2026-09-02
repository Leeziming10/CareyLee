import { useRef, useState, type ChangeEvent } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import {
  AlignLeft,
  ImagePlus,
  Printer,
  Radio,
  Save,
  ScanLine,
  Trash2
} from "lucide-react";
import { Field, PageHeader, ToggleRow } from "../components/ui";
import { useDataStore } from "../store/DataStore";
import { EscposPrinter } from "../native/escpos";
import type { DiscoveredPrinter } from "../lib/receipt";

type QrKind = "wechatQrDataUrl" | "alipayQrDataUrl";

export function SettingsPage() {
  const { data, updateSettings } = useDataStore();
  const [saved, setSaved] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredPrinter[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingQrKind = useRef<QrKind | null>(null);
  if (!data) return null;

  const settings = data.settings;

  const pickQrImage = async (kind: QrKind) => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          quality: 95,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos
        });
        updateSettings({ [kind]: photo.dataUrl });
      } catch {
        // 用户在系统选择器中取消或未授权。
      }
    } else {
      pendingQrKind.current = kind;
      fileRef.current?.click();
    }
  };

  const readFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !pendingQrKind.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        updateSettings({ [pendingQrKind.current!]: result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const saveNotice = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const testPrint = async () => {
    const result = await EscposPrinter.testPrint({
      host: settings.printerHost.trim() || "0.0.0.0",
      port: settings.printerPort,
      cutMode: settings.cutMode
    });
    setPrintNotice({ ok: result.ok, text: result.message || (result.ok ? "打印成功" : "打印失败") });
  };

  const discover = async () => {
    setDiscovering(true);
    setPrintNotice(null);
    try {
      const result = await EscposPrinter.discover({ timeoutMs: 2500 });
      setDiscovered(result.printers);
      setPrintNotice({
        ok: result.printers.length > 0,
        text: result.printers.length ? `发现 ${result.printers.length} 台打印机` : "未发现打印机，请手动填写 IP"
      });
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="page settings-page">
      <PageHeader
        title="设置"
        subtitle="小票抬头、打印机与收款码"
        actions={
          <button className="button primary" type="button" onClick={saveNotice}>
            <Save size={18} />
            {saved ? "已保存" : "保存"}
          </button>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={readFile}
      />

      <section className="settings-section">
        <div className="settings-title">
          <AlignLeft size={19} />
          <h2>门店与小票</h2>
        </div>
        <div className="settings-grid">
          <Field label="店名">
            <input
              value={settings.shopName}
              onChange={(event) => updateSettings({ shopName: event.target.value })}
            />
          </Field>
          <Field label="联系电话">
            <input
              value={settings.shopPhone}
              onChange={(event) => updateSettings({ shopPhone: event.target.value })}
            />
          </Field>
          <Field label="小票尾注">
            <input
              value={settings.receiptFooter}
              onChange={(event) => updateSettings({ receiptFooter: event.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-title">
          <Printer size={19} />
          <h2>商鹏云 58mm 局域网打印机</h2>
        </div>
        <div className="settings-grid">
          <Field label="打印机 IP">
            <input
              inputMode="decimal"
              value={settings.printerHost}
              onChange={(event) => updateSettings({ printerHost: event.target.value })}
            />
          </Field>
          <Field label="端口">
            <input
              type="number"
              min="1"
              max="65535"
              value={settings.printerPort}
              onChange={(event) => updateSettings({ printerPort: Math.max(1, Number(event.target.value) || 9100) })}
            />
          </Field>
          <Field label="切纸指令" hint="多数 58mm 打印机用默认指令">
            <select
              value={settings.cutMode}
              onChange={(event) =>
                updateSettings({ cutMode: event.target.value as typeof settings.cutMode })
              }
            >
              <option value="gs-v66">GS V 66 0</option>
              <option value="esc-i">ESC i</option>
            </select>
          </Field>
        </div>
        <div className="setting-toggles">
          <ToggleRow
            checked={settings.printerEnabled}
            onChange={(checked) => updateSettings({ printerEnabled: checked })}
            label="启用局域网打印"
          />
          <ToggleRow
            checked={settings.printOnOrder}
            onChange={(checked) => updateSettings({ printOnOrder: checked })}
            label="点单完成后打印出酒单"
          />
          <ToggleRow
            checked={settings.printOnCheckout}
            onChange={(checked) => updateSettings({ printOnCheckout: checked })}
            label="结账后打印结账单"
          />
        </div>
        <div className="button-row">
          <button className="button" type="button" onClick={() => void testPrint()}>
            <Printer size={18} />
            测试打印
          </button>
          <button className="button ghost" type="button" disabled={discovering} onClick={() => void discover()}>
            <Radio size={18} className={discovering ? "spin" : ""} />
            搜索本网打印机
          </button>
        </div>
        {printNotice ? (
          <div className={`inline-notice ${printNotice.ok ? "ok" : "error"}`}>{printNotice.text}</div>
        ) : null}
        {discovered.length ? (
          <div className="discovered-list">
            {discovered.map((printer, index) => (
              <button
                type="button"
                key={`${printer.host}-${index}`}
                onClick={() => updateSettings({ printerHost: printer.host })}
              >
                {printer.name || printer.host}
                <strong>{printer.host}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="settings-section">
        <div className="settings-title">
          <ScanLine size={19} />
          <h2>静态收款码</h2>
        </div>
        <div className="qr-setting-grid">
          <QrImageSlot
            label="微信收款码"
            image={settings.wechatQrDataUrl}
            onPick={() => void pickQrImage("wechatQrDataUrl")}
            onRemove={() => updateSettings({ wechatQrDataUrl: undefined })}
          />
          <QrImageSlot
            label="支付宝收款码"
            image={settings.alipayQrDataUrl}
            onPick={() => void pickQrImage("alipayQrDataUrl")}
            onRemove={() => updateSettings({ alipayQrDataUrl: undefined })}
          />
        </div>
      </section>
    </div>
  );
}

function QrImageSlot({
  label,
  image,
  onPick,
  onRemove
}: {
  label: string;
  image?: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="qr-image-slot">
      <div>
        <strong>{label}</strong>
        <small>从相册或文件选择收款码图片</small>
      </div>
      {image ? (
        <div className="qr-preview-wrap">
          <img src={image} alt={label} />
          <button type="button" onClick={onRemove} aria-label="移除图片">
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <button type="button" className="qr-pick-placeholder" onClick={onPick}>
          <ImagePlus size={28} />
          选择图片
        </button>
      )}
    </div>
  );
}
