import { useState } from "react";
import { Beer, FolderPlus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { EmptyState, Field, Modal, PageHeader } from "../components/ui";
import { useDataStore } from "../store/DataStore";
import { uid } from "../lib/id";
import { parseYuanToCents, formatCents } from "../lib/money";
import type { Category, Drink } from "../types";

export function DrinkPage() {
  const { data, upsertDrink, deleteDrink, upsertCategory, deleteCategory } = useDataStore();
  if (!data) return null;
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{ drink: Drink; isNew: boolean } | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const filtered = data.drinks
    .filter((drink) => (activeCategory === "all" ? true : drink.categoryId === activeCategory))
    .filter((drink) => drink.name.toLowerCase().includes(search.trim().toLowerCase()));

  const nextSort = () => Math.max(0, ...data.drinks.map((item) => item.sort)) + 1;

  return (
    <div className="page">
      <PageHeader
        title="酒水管理"
        subtitle={`${data.drinks.length} 款酒水 · ${data.categories.length} 个分类`}
        actions={
          <>
            <button className="button ghost" type="button" onClick={() => setCategoryManagerOpen(true)}>
              <FolderPlus size={18} />
              分类
            </button>
            <button
              className="button primary"
              type="button"
              onClick={() =>
                setEditor({
                  drink: {
                    id: uid("drink"),
                    categoryId: activeCategory !== "all" ? activeCategory : (data.categories[0]?.id ?? ""),
                    name: "",
                    shortName: "",
                    priceCents: 0,
                    enabled: true,
                    sort: nextSort()
                  },
                  isNew: true
                })
              }
            >
              <Plus size={19} />
              添加酒水
            </button>
          </>
        }
      />

      <div className="toolbar-row">
        <div className="category-chips">
          <button
            type="button"
            className={`chip ${activeCategory === "all" ? "active" : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            全部
          </button>
          {data.categories.map((category) => (
            <button
              type="button"
              className={`chip ${activeCategory === category.id ? "active" : ""}`}
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索酒水名称"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Beer size={36} />} title="还没有酒水" detail="添加第一杯酒水后即可点单" />
      ) : (
        <div className="drink-grid">
          {filtered.map((drink) => (
            <article className="drink-card" key={drink.id}>
              <div className={`drink-avatar ${drink.enabled ? "" : "disabled"}`}>
                <Beer size={26} />
              </div>
              <div className="drink-main">
                <strong>{drink.name}</strong>
                <span>
                  {data.categories.find((category) => category.id === drink.categoryId)?.name ?? "未分类"}
                </span>
              </div>
              <div className="drink-price">{formatCents(drink.priceCents)}</div>
              <div className="card-actions">
                <button
                  className="icon-button"
                  type="button"
                  title={drink.enabled ? "停用" : "启用"}
                  aria-label={drink.enabled ? "停用" : "启用"}
                  onClick={() =>
                    upsertDrink({
                      ...drink,
                      enabled: !drink.enabled,
                      sort: drink.sort
                    })
                  }
                >
                  <span className={`status-dot ${drink.enabled ? "on" : "off"}`} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  title="编辑"
                  aria-label="编辑酒水"
                  onClick={() => setEditor({ drink, isNew: false })}
                >
                  <Pencil size={18} />
                </button>
                <button
                  className="icon-button danger"
                  type="button"
                  title="删除"
                  aria-label="删除酒水"
                  onClick={() => {
                    if (window.confirm(`确定删除“${drink.name}”吗？历史订单仍会保留记录。`)) {
                      deleteDrink(drink.id);
                    }
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <DrinkEditor
        key={editor?.drink.id ?? "new"}
        editor={editor}
        categories={data.categories}
        onSave={(drink) => {
          upsertDrink(drink);
          setEditor(null);
        }}
        onClose={() => setEditor(null)}
      />

      <CategoryManager
        open={categoryManagerOpen}
        categories={data.categories}
        onClose={() => setCategoryManagerOpen(false)}
        onSave={upsertCategory}
        onDelete={(categoryId) => {
          const category = data.categories.find((item) => item.id === categoryId);
          if (!category) return;
          const usedCount = data.drinks.filter((drink) => drink.categoryId === categoryId).length;
          if (
            window.confirm(
              usedCount
                ? `删除分类会将其中 ${usedCount} 款酒水移入“未分类”，是否继续？`
                : `确定删除分类“${category.name}”吗？`,
            )
          ) {
            deleteCategory(categoryId);
          }
        }}
      />
    </div>
  );
}

function DrinkEditor({
  editor,
  categories,
  onSave,
  onClose
}: {
  editor: { drink: Drink; isNew: boolean } | null;
  categories: Category[];
  onSave: (drink: Drink) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editor?.drink.name ?? "");
  const [shortName, setShortName] = useState(editor?.drink.shortName ?? "");
  const [categoryId, setCategoryId] = useState(editor?.drink.categoryId ?? categories[0]?.id ?? "");
  const [priceText, setPriceText] = useState(
    editor && editor.drink.priceCents ? (editor.drink.priceCents / 100).toFixed(2) : ""
  );
  const [enabled, setEnabled] = useState(editor?.drink.enabled ?? true);

  if (!editor) return null;
  const priceCents = parseYuanToCents(priceText);

  return (
    <Modal open={Boolean(editor)} title={editor.isNew ? "添加酒水" : "编辑酒水"} onClose={onClose}>
      <div className="form-grid two-col">
        <Field label="酒水名称">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="如：精酿生啤" />
        </Field>
        <Field label="小票短名" hint="过长名称可在小票上缩短">
          <input value={shortName} onChange={(event) => setShortName(event.target.value)} placeholder="如：生啤" />
        </Field>
        <Field label="分类">
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="售价（元）">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={priceText}
            onChange={(event) => setPriceText(event.target.value)}
            placeholder="0.00"
          />
        </Field>
      </div>
      <label className="inline-check">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        上架（停用后不会出现在点单区）
      </label>
      <div className="modal-actions">
        <button className="button ghost" type="button" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          type="button"
          disabled={!name.trim() || !categoryId || priceCents < 0}
          onClick={() =>
            onSave({
              ...editor.drink,
              name: name.trim(),
              shortName: shortName.trim() || name.trim(),
              categoryId,
              priceCents,
              enabled
            })
          }
        >
          保存
        </button>
      </div>
    </Modal>
  );
}

function CategoryManager({
  open,
  categories,
  onClose,
  onSave,
  onDelete
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onSave: (category: Category) => void;
  onDelete: (categoryId: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <Modal open={open} title="酒水分类" onClose={onClose}>
      <div className="category-manager">
        {categories.map((category) => (
          <div className="category-row" key={category.id}>
            <span>{category.name}</span>
            <button
              className="icon-button danger"
              type="button"
              disabled={Boolean(category.isSystem)}
              title={category.isSystem ? "系统分类不可删除" : "删除"}
              aria-label="删除分类"
              onClick={() => onDelete(category.id)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <div className="inline-form">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && draft.trim()) {
              onSave({ id: uid("cat"), name: draft.trim(), sort: Math.max(0, ...categories.map((item) => item.sort)) + 1 });
              setDraft("");
            }
          }}
          placeholder="新分类名称"
        />
        <button
          className="button primary"
          type="button"
          disabled={!draft.trim()}
          onClick={() => {
            onSave({ id: uid("cat"), name: draft.trim(), sort: Math.max(0, ...categories.map((item) => item.sort)) + 1 });
            setDraft("");
          }}
        >
          添加
        </button>
      </div>
    </Modal>
  );
}
