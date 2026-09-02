import {
  Beer,
  GlassWater,
  LayoutGrid,
  ReceiptText,
  Settings,
  Users
} from "lucide-react";
import type { PageKey } from "../types";

const primaryItems: Array<{ key: PageKey; label: string; icon: typeof LayoutGrid }> = [
  { key: "tables", label: "桌台", icon: LayoutGrid },
  { key: "members", label: "会员", icon: Users },
  { key: "drinks", label: "酒水", icon: Beer }
];

export function Sidebar({
  page,
  onPage,
  shopName
}: {
  page: PageKey;
  onPage: (page: PageKey) => void;
  shopName: string;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="brand-mark">
          <GlassWater size={26} />
        </span>
        <div className="brand-text">
          <strong>{shopName || "吧台收银"}</strong>
          <small>iPad POS</small>
        </div>
      </div>

      <div className="sidebar-group">
        <span className="sidebar-group-label">经营</span>
        {primaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.key}
              className={`nav-item ${page === item.key ? "active" : ""}`}
              onClick={() => onPage(item.key)}
            >
              <Icon size={22} strokeWidth={page === item.key ? 2.5 : 1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-group">
        <span className="sidebar-group-label">记录</span>
        <button
          type="button"
          className={`nav-item ${page === "history" ? "active" : ""}`}
          onClick={() => onPage("history")}
        >
          <ReceiptText size={22} />
          <span>账单</span>
        </button>
      </div>

      <div className="sidebar-spacer" />
      <button
        type="button"
        className={`nav-item ${page === "settings" ? "active" : ""}`}
        onClick={() => onPage("settings")}
      >
        <Settings size={22} />
        <span>设置</span>
      </button>
    </aside>
  );
}
