import { useState } from "react";
import {
  Armchair,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "../../components/ui";
import { useDataStore } from "../../store/DataStore";
import { uid } from "../../lib/id";
import { formatCents } from "../../lib/money";
import type { Table } from "../../types";
import { OrderWorkspace } from "./OrderWorkspace";

export function TablePage() {
  const { data, upsertTable, deleteTable, openOrderForTable } = useDataStore();
  const [editor, setEditor] = useState<{ table: Table; isNew: boolean } | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [busyFilter, setBusyFilter] = useState(false);
  if (!data) return null;

  const activeTable = data.tables.find((table) => table.id === activeTableId) ?? null;
  const activeOrder = activeTable?.currentOrderId
    ? data.orders.find((order) => order.id === activeTable.currentOrderId)
    : null;

  if (activeTable && activeOrder) {
    return (
      <OrderWorkspace
        key={activeOrder.id}
        table={activeTable}
        order={activeOrder}
        onBack={() => setActiveTableId(null)}
        onTableGone={() => setActiveTableId(null)}
      />
    );
  }

  const visibleTables = busyFilter ? data.tables.filter((table) => table.status !== "idle") : data.tables;
  const occupiedCount = data.tables.filter((table) => table.status !== "idle").length;

  return (
    <div className="page">
      <PageHeader
        title="桌台"
        subtitle={`${data.tables.length} 张桌台 · ${occupiedCount} 桌使用中`}
        actions={
          <button
            className="button primary"
            type="button"
            onClick={() =>
              setEditor({
                table: {
                  id: uid("table"),
                  name: `${data.tables.length + 1}号桌`,
                  seats: 4,
                  status: "idle",
                  sort: Math.max(0, ...data.tables.map((table) => table.sort)) + 1
                },
                isNew: true
              })
            }
          >
            <Plus size={19} />
            添加桌台
          </button>
        }
      />

      <div className="toolbar-row">
        <button className={`chip ${busyFilter ? "active" : ""}`} type="button" onClick={() => setBusyFilter(!busyFilter)}>
          只看使用中
        </button>
        <span className="toolbar-stat">使用中 {occupiedCount} 桌</span>
      </div>

      {visibleTables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={38} />}
          title={busyFilter ? "当前没有使用中的桌台" : "还没有桌台"}
          detail="添加桌台后即可开台点单"
        />
      ) : (
        <div className="table-grid compact">
          {visibleTables.map((table) => {
            const order = table.currentOrderId
              ? data.orders.find((item) => item.id === table.currentOrderId)
              : undefined;
            const itemCount = order?.items.reduce((sum, item) => sum + item.qty, 0) ?? 0;
            const currentTotal = order?.items.reduce(
              (sum, item) => sum + item.unitPriceCents * item.qty,
              0,
            ) ?? 0;
            const idle = table.status === "idle";
            return (
              <div className={`table-tile ${idle ? "idle" : "busy"}`} key={table.id}>
                <div className="table-tile-tools">
                  <button
                    className="icon-button tiny"
                    type="button"
                    title="编辑桌台"
                    aria-label="编辑桌台"
                    onClick={() => setEditor({ table, isNew: false })}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="icon-button tiny danger"
                    type="button"
                    title="删除桌台"
                    aria-label="删除桌台"
                    onClick={() => {
                      if (table.status !== "idle") {
                        window.alert("占用中的桌台不能删除，请先结账或清台。");
                        return;
                      }
                      if (window.confirm(`确定删除桌台“${table.name}”吗？`)) {
                        deleteTable(table.id);
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <button
                  className="table-tile-main"
                  type="button"
                  onClick={() => {
                    if (idle) {
                      const order = openOrderForTable(table.id);
                      if (order) setActiveTableId(table.id);
                    } else {
                      setActiveTableId(table.id);
                    }
                  }}
                >
                  <span className={`table-tile-icon ${idle ? "" : "active"}`}>
                    <Armchair size={22} />
                  </span>
                  <strong>{table.name}</strong>
                  {idle ? (
                    <span className="table-tile-status idle">
                      <i />
                      空闲
                    </span>
                  ) : (
                    <span className="table-tile-status busy">
                      <i />
                      {itemCount > 0 ? `${itemCount} 项` : "使用中"}
                      <b>{formatCents(currentTotal)}</b>
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <TableEditor
        key={editor?.table.id ?? "new"}
        editor={editor}
        onClose={() => setEditor(null)}
        onSave={(table) => {
          upsertTable(table);
          setEditor(null);
        }}
      />
    </div>
  );
}

function TableEditor({
  editor,
  onClose,
  onSave
}: {
  editor: { table: Table; isNew: boolean } | null;
  onClose: () => void;
  onSave: (table: Table) => void;
}) {
  const table = editor?.table;
  const [name, setName] = useState(table?.name ?? "");
  const [seats, setSeats] = useState(String(table?.seats ?? 4));
  if (!editor || !table) return null;
  const seatsNumber = Math.max(1, Math.min(99, Number(seats) || 1));
  return (
    <Modal open={Boolean(editor)} title={editor.isNew ? "添加桌台" : "编辑桌台"} onClose={onClose}>
      <div className="form-grid">
        <Field label="桌台名称">
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="座位数">
          <input type="number" min="1" max="99" value={seats} onChange={(event) => setSeats(event.target.value)} />
        </Field>
      </div>
      <div className="modal-actions">
        <button className="button ghost" type="button" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          type="button"
          disabled={!name.trim()}
          onClick={() => onSave({ ...table, name: name.trim(), seats: seatsNumber })}
        >
          保存
        </button>
      </div>
    </Modal>
  );
}

function elapsedText(startedAt: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}
