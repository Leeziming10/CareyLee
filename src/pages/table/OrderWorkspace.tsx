import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeDollarSign,
  Beer,
  Minus,
  Plus,
  Printer,
  ShoppingBag,
  Trash2
} from "lucide-react";
import type { Order, Table } from "../../types";
import { useDataStore } from "../../store/DataStore";
import { calcOrderSubtotal } from "../../lib/billing";
import { formatCents } from "../../lib/money";
import { printOrderTicket } from "../../lib/print";
import { CheckoutPanel } from "./CheckoutPanel";

export function OrderWorkspace({
  table,
  order,
  onBack,
  onTableGone
}: {
  table: Table;
  order: Order;
  onBack: () => void;
  onTableGone: () => void;
}) {
  const {
    data,
    addDrinkToOrder,
    changeOrderItemQty,
    removeOrderItem,
    voidOpenOrder,
    settleOrder
  } = useDataStore();
  const [categoryId, setCategoryId] = useState<string>("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const drinks = useMemo(() => {
    const sorted = [...(data?.drinks ?? [])].sort((a, b) => a.sort - b.sort);
    if (categoryId === "all") return sorted.filter((drink) => drink.enabled);
    return sorted.filter((drink) => drink.enabled && drink.categoryId === categoryId);
  }, [data, categoryId]);

  if (!data) return null;

  const subtotal = calcOrderSubtotal(order.items);

  if (checkoutOpen) {
    return (
      <CheckoutPanel
        order={order}
        table={table}
        onCancel={() => setCheckoutOpen(false)}
        onSettled={(settledOrder) => {
          void settledOrder;
          onBack();
        }}
      />
    );
  }

  return (
    <div className="order-workspace">
      <div className="order-header">
        <button className="button ghost icon-text" type="button" onClick={onBack}>
          <ArrowLeft size={19} />
          返回桌台
        </button>
        <div className="order-title">
          <h1>{table.name}</h1>
          <span>{order.items.length} 种酒水 · 共 {order.items.reduce((sum, item) => sum + item.qty, 0)} 杯</span>
        </div>
        <div className="order-header-actions">
          {notice ? (
            <span className={`inline-notice ${notice.tone}`}>{notice.text}</span>
          ) : null}
          <button
            className="button ghost"
            type="button"
            disabled={order.items.length === 0}
            onClick={() => {
              void (async () => {
                const result = await printOrderTicket(data.settings, order, table);
                setNotice({
                  tone: result.ok ? "ok" : "error",
                  text: result.ok ? "已发送打印" : result.message || "打印失败"
                });
              })();
            }}
          >
            <Printer size={18} />
            打印出酒单
          </button>
          <button
            className="button ghost danger-text"
            type="button"
            onClick={() => {
              if (window.confirm(`确定清空并取消 ${table.name} 的当前订单吗？`)) {
                voidOpenOrder(order.id);
                onTableGone();
              }
            }}
          >
            <Trash2 size={18} />
            清台
          </button>
          <button
            className="button primary"
            type="button"
            disabled={order.items.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            <BadgeDollarSign size={19} />
            结账
          </button>
        </div>
      </div>

      <div className="split-workspace">
        <section className="current-order-column">
          <div className="panel-title">
            <ShoppingBag size={20} />
            <strong>当前订单</strong>
            <span>{formatCents(subtotal)}</span>
          </div>
          <div className="order-items-list">
            {order.items.length === 0 ? (
              <div className="empty-inline tall">
                从右侧选择酒水加入订单
              </div>
            ) : (
              order.items.map((item) => (
                <div className="order-item-row" key={item.id}>
                  <div className="order-item-name">
                    <strong>{item.name}</strong>
                    <span>{formatCents(item.unitPriceCents)} / 杯</span>
                  </div>
                  <div className="qty-stepper">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="减少数量"
                      onClick={() => changeOrderItemQty(order.id, item.id, -1)}
                    >
                      <Minus size={17} />
                    </button>
                    <span>{item.qty}</span>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="增加数量"
                      onClick={() => changeOrderItemQty(order.id, item.id, 1)}
                    >
                      <Plus size={17} />
                    </button>
                  </div>
                  <strong className="item-total">{formatCents(item.unitPriceCents * item.qty)}</strong>
                  <button
                    className="icon-button danger"
                    type="button"
                    title="移除"
                    aria-label="移除"
                    onClick={() => removeOrderItem(order.id, item.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="order-total-strip">
            <span>订单合计</span>
            <strong>{formatCents(subtotal)}</strong>
          </div>
        </section>

        <section className="drink-menu-column">
          <div className="panel-title">
            <Beer size={20} />
            <strong>选择酒水</strong>
          </div>
          <div className="menu-category-tabs">
            <button
              type="button"
              className={`chip ${categoryId === "all" ? "active" : ""}`}
              onClick={() => setCategoryId("all")}
            >
              全部
            </button>
            {data.categories.map((category) => (
              <button
                type="button"
                className={`chip ${categoryId === category.id ? "active" : ""}`}
                key={category.id}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="menu-drink-grid">
            {drinks.length === 0 ? (
              <div className="empty-inline tall">该分类暂无上架酒水</div>
            ) : (
              drinks.map((drink) => (
                <button
                  type="button"
                  className="menu-drink"
                  key={drink.id}
                  onClick={() => addDrinkToOrder(order.id, drink)}
                >
                  <span className="menu-drink-mark">
                    <Beer size={20} />
                  </span>
                  <span className="menu-drink-main">
                    <strong>{drink.shortName || drink.name}</strong>
                    <small>{drink.name}</small>
                  </span>
                  <span className="menu-drink-price">{formatCents(drink.priceCents)}</span>
                  <span className="menu-drink-add">
                    <Plus size={18} />
                  </span>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
