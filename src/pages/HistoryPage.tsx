import { useMemo, useState } from "react";
import { CalendarDays, Printer, ReceiptText } from "lucide-react";
import { EmptyState, Modal, PageHeader } from "../components/ui";
import { useDataStore } from "../store/DataStore";
import { formatCents } from "../lib/money";
import { printSettlementReceipt } from "../lib/print";
import type { Order, PaymentRecord } from "../types";

export function HistoryPage() {
  const { data } = useDataStore();
  const [onlyToday, setOnlyToday] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const records = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const source = onlyToday
      ? (data?.paymentRecords ?? []).filter((record) => record.paidAt >= startOfDay)
      : data?.paymentRecords ?? [];
    return [...source].sort((a, b) => b.paidAt - a.paidAt);
  }, [data?.paymentRecords, onlyToday]);

  if (!data) return null;

  const selectedRecord = data.paymentRecords.find((record) => record.id === selectedId) ?? null;
  const selectedOrder = selectedRecord
    ? (data.orders.find((order) => order.id === selectedRecord.orderId) ?? null)
    : null;
  const totalPayable = records.reduce((sum, record) => sum + record.payableCents, 0);
  const totalQr = records.reduce((sum, record) => sum + record.qrPayCents, 0);

  return (
    <div className="page">
      <PageHeader
        title="营业账单"
        subtitle={`${records.length} 笔记录 · 实收 ${formatCents(totalPayable)}`}
        actions={
          <button className={`button ${onlyToday ? "primary" : "ghost"}`} type="button" onClick={() => setOnlyToday(!onlyToday)}>
            <CalendarDays size={18} />
            {onlyToday ? "只看今天" : "显示全部"}
          </button>
        }
      />
      <div className="metric-strip history-metrics">
        <div>
          <span>账单数</span>
          <strong>{records.length}</strong>
        </div>
        <div>
          <span>应付合计</span>
          <strong>{formatCents(totalPayable)}</strong>
        </div>
        <div>
          <span>储值抵扣</span>
          <strong>{formatCents(records.reduce((sum, record) => sum + record.balanceUsedCents, 0))}</strong>
        </div>
        <div>
          <span>扫码收款</span>
          <strong>{formatCents(totalQr)}</strong>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyState icon={<ReceiptText size={36} />} title="暂无账单" detail="完成一笔结账后这里会显示记录" />
      ) : (
        <div className="history-list">
          {records.map((record) => (
            <button type="button" className="history-row" key={record.id} onClick={() => setSelectedId(record.id)}>
              <span className="history-main">
                <strong>{record.tableName || "散台"}</strong>
                <small>{new Date(record.paidAt).toLocaleString("zh-CN", { hour12: false })}</small>
              </span>
              <span className="history-number">
                <small>{record.receiptNo}</small>
                {record.memberName ? <strong>{record.memberName}</strong> : null}
              </span>
              <span className="history-pay">
                {record.balanceUsedCents > 0 ? <small>储值 {formatCents(record.balanceUsedCents)}</small> : null}
                <strong>{formatCents(record.payableCents)}</strong>
              </span>
            </button>
          ))}
        </div>
      )}

      <PaymentDetail
        record={selectedRecord}
        order={selectedOrder}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function PaymentDetail({
  record,
  order,
  onClose
}: {
  record: PaymentRecord | null;
  order: Order | null;
  onClose: () => void;
}) {
  const { data, isNative } = useDataStore();
  if (!record || !order || !data) return null;
  const print = async () => {
    const result = await printSettlementReceipt(data.settings, order);
    window.alert(result.ok ? "已发送打印" : `打印失败：${result.message || "打印机未响应"}`);
  };
  return (
    <Modal open title={`账单 ${record.receiptNo}`} onClose={onClose} wide>
      <div className="history-detail">
        <div>
          <strong>{record.tableName || "散台"}</strong>
          <span>{new Date(record.paidAt).toLocaleString("zh-CN", { hour12: false })}</span>
        </div>
        {record.memberName ? <p>会员：{record.memberName}</p> : null}
        <div className="receipt-lines">
          {order.items.map((item) => (
            <div key={item.id}>
              <span>
                {item.shortName || item.name} ×{item.qty}
              </span>
              <strong>{formatCents(item.unitPriceCents * item.qty)}</strong>
            </div>
          ))}
        </div>
        <dl className="history-totals">
          <div><dt>小计</dt><dd>{formatCents(record.subtotalCents)}</dd></div>
          <div><dt>优惠</dt><dd>-{formatCents(record.discountCents)}</dd></div>
          <div><dt>应付</dt><dd>{formatCents(record.payableCents)}</dd></div>
          {record.balanceUsedCents ? <div><dt>储值</dt><dd>-{formatCents(record.balanceUsedCents)}</dd></div> : null}
          {record.qrPayCents ? <div><dt>{record.paymentMethod === "alipay" ? "支付宝" : "微信"}</dt><dd>{formatCents(record.qrPayCents)}</dd></div> : null}
        </dl>
        {isNative ? (
          <button className="button primary" type="button" onClick={() => void print()}>
            <Printer size={18} />
            重新打印
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
