import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  QrCode,
  Scale,
  WalletCards
} from "lucide-react";
import type { Order, QrPaymentMethod, Table } from "../../types";
import { useDataStore } from "../../store/DataStore";
import { calcBalanceUse, calcOrderTotals } from "../../lib/billing";
import { parseYuanToCents, formatCents, formatDiscountPercent } from "../../lib/money";
import { printSettlementReceipt } from "../../lib/print";

export function CheckoutPanel({
  order,
  table,
  onCancel,
  onSettled
}: {
  order: Order;
  table: Table;
  onCancel: () => void;
  onSettled: (settledOrder: Order) => void;
}) {
  const { data, settleOrder, isNative } = useDataStore();
  const [memberId, setMemberId] = useState<string | undefined>(order.memberId);
  const [manualText, setManualText] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [useBalance, setUseBalance] = useState(Boolean(order.memberId));
  const [paymentMethod, setPaymentMethod] = useState<QrPaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const member = data?.members.find((item) => item.id === memberId) ?? null;
  const manualDiscountCents = parseYuanToCents(manualText);
  const totals = useMemo(
    () => calcOrderTotals(order.items, member, manualDiscountCents),
    [order.items, member, manualDiscountCents],
  );
  const deduction = calcBalanceUse(member?.balanceCents ?? 0, totals.payableCents, useBalance && Boolean(member));
  const qrImage =
    paymentMethod === "alipay"
      ? data?.settings.alipayQrDataUrl
      : paymentMethod === "wechat"
        ? data?.settings.wechatQrDataUrl
        : undefined;
  if (!data) return null;
  const settings = data.settings;

  const confirmSettlement = async () => {
    if (busy) return;
    setBusy(true);
    const settled = settleOrder({
      orderId: order.id,
      memberId: member?.id,
      manualDiscountCents: totals.manualDiscountCents,
      manualDiscountNote: manualNote.trim(),
      useBalance: Boolean(member) && useBalance,
      paymentMethod: paymentMethod ?? "none"
    });
    if (!settled) {
      setBusy(false);
      setNotice("订单状态已变化，请刷新后重试");
      return;
    }
    if (settings.printOnCheckout && isNative) {
      const result = await printSettlementReceipt(settings, settled, table);
      if (!result.ok) {
        window.alert(`结账已保存，但小票打印失败：${result.message || "打印机未响应"}`);
      }
    }
    onSettled(settled);
  };

  return (
    <div className="checkout-panel">
      <div className="checkout-header">
        <button className="button ghost icon-text" type="button" onClick={onCancel} disabled={busy}>
          <ArrowLeft size={19} />
          返回点单
        </button>
        <div className="order-title">
          <h1>{table.name} · 结账</h1>
          <span>单号 {order.receiptNo}</span>
        </div>
        {notice ? <div className="inline-notice error">{notice}</div> : null}
      </div>

      <div className="split-workspace checkout-split">
        <section className="current-order-column">
          <div className="panel-title">
            <BadgeDollarSign size={20} />
            <strong>已点酒水</strong>
            <span>{formatCents(totals.subtotalCents)}</span>
          </div>
          <div className="checkout-items">
            {order.items.map((item) => (
              <div className="checkout-item" key={item.id}>
                <span className="checkout-item-name">
                  <strong>{item.shortName || item.name}</strong>
                  <small>单价 {formatCents(item.unitPriceCents)}</small>
                </span>
                <span className="checkout-item-qty">×{item.qty}</span>
                <strong>{formatCents(item.unitPriceCents * item.qty)}</strong>
              </div>
            ))}
          </div>
          <div className="checkout-calc">
            <div>
              <span>小计</span>
              <strong>{formatCents(totals.subtotalCents)}</strong>
            </div>
            {member && totals.memberDiscountCents > 0 ? (
              <div className="discount-line">
                <span>
                  {member.name} {formatDiscountPercent(member.defaultDiscountPercent)}
                </span>
                <strong>-{formatCents(totals.memberDiscountCents)}</strong>
              </div>
            ) : null}
            {totals.manualDiscountCents > 0 ? (
              <div className="discount-line">
                <span>{manualNote.trim() || "手动优惠"}</span>
                <strong>-{formatCents(totals.manualDiscountCents)}</strong>
              </div>
            ) : null}
            <div className="payable-line">
              <span>应付金额</span>
              <strong>{formatCents(totals.payableCents)}</strong>
            </div>
          </div>
        </section>

        <section className="payment-column">
          <div className="member-pick block">
            <label className="field-label">结账会员（可选）</label>
            <select
              value={memberId ?? ""}
              onChange={(event) => {
                const nextId = event.target.value || undefined;
                setMemberId(nextId);
                setUseBalance(Boolean(nextId));
                setPaymentMethod(null);
                setManualText("");
                setManualNote("");
              }}
            >
              <option value="">散客 / 不绑定会员</option>
              {data.members.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · 余额 {formatCents(item.balanceCents)}
                </option>
              ))}
            </select>
          </div>

          {member ? (
            <div className="member-discount-block">
              <div>
                <span>会员折扣</span>
                <strong>{formatDiscountPercent(member.defaultDiscountPercent)}</strong>
              </div>
              <label className="toggle-row compact">
                <span>
                  <strong>使用储值抵扣</strong>
                  <small>
                    余额 {formatCents(member.balanceCents)}，本次抵扣 {formatCents(deduction.balanceUsedCents)}
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={useBalance}
                  onChange={(event) => {
                    setUseBalance(event.target.checked);
                    setPaymentMethod(null);
                  }}
                />
                <i className="toggle" aria-hidden="true" />
              </label>
            </div>
          ) : (
            <div className="manual-discount block">
              <label className="field-label">手动优惠</label>
              <div className="dual-input">
                <input
                  inputMode="decimal"
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  placeholder="减多少元"
                />
                <input
                  value={manualNote}
                  onChange={(event) => setManualNote(event.target.value)}
                  placeholder="优惠说明（可选）"
                />
              </div>
            </div>
          )}

          <div className="payment-methods">
            <button
              type="button"
              className={`pay-method wechat ${paymentMethod === "wechat" ? "active" : ""}`}
              disabled={deduction.qrPayCents <= 0}
              onClick={() => setPaymentMethod("wechat")}
            >
              <span className="pay-mark">微</span>
              <span>
                <strong>微信支付</strong>
                <small>{formatCents(deduction.qrPayCents)}</small>
              </span>
            </button>
            <button
              type="button"
              className={`pay-method alipay ${paymentMethod === "alipay" ? "active" : ""}`}
              disabled={deduction.qrPayCents <= 0}
              onClick={() => setPaymentMethod("alipay")}
            >
              <span className="pay-mark">支</span>
              <span>
                <strong>支付宝</strong>
                <small>{formatCents(deduction.qrPayCents)}</small>
              </span>
            </button>
          </div>

          <div className="qr-stage">
            {deduction.qrPayCents > 0 ? (
              paymentMethod ? (
                <>
                  <QrCode size={72} className="qr-icon" />
                  {qrImage ? (
                    <img src={qrImage} alt={`${paymentMethod}收款码`} className="payment-qr" />
                  ) : (
                    <div className="qr-missing">
                      尚未设置{paymentMethod === "wechat" ? "微信" : "支付宝"}收款码图片
                      <br />
                      请在“设置”中录入后重试
                    </div>
                  )}
                  <strong>{formatCents(deduction.qrPayCents)}</strong>
                </>
              ) : (
                <div className="qr-placeholder">
                  <QrCode size={52} />
                  <span>选择右侧收款方式</span>
                </div>
              )
            ) : (
              <div className="qr-placeholder done">
                <CheckCircle2 size={52} />
                <span>{member ? `已从储值扣除 ${formatCents(deduction.balanceUsedCents)}` : "应付金额为 0"}</span>
              </div>
            )}
          </div>

          <button
            className="button primary confirm-pay"
            type="button"
            disabled={
              busy ||
              (deduction.qrPayCents > 0 && (!paymentMethod || !qrImage))
            }
            onClick={() => void confirmSettlement()}
          >
            <CheckCircle2 size={20} />
            {busy ? "处理中..." : "确认收款并结账"}
          </button>
        </section>
      </div>
    </div>
  );
}
