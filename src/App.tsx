import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { DataProvider, useDataStore } from "./store/DataStore";
import { DrinkPage } from "./pages/DrinkPage";
import { HistoryPage } from "./pages/HistoryPage";
import { MemberPage } from "./pages/MemberPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TablePage } from "./pages/table/TablePage";
import type { PageKey } from "./types";

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

function AppContent() {
  const { data, loading } = useDataStore();
  const [page, setPage] = useState<PageKey>("tables");

  if (loading || !data) {
    return (
      <div className="loading-screen">
        <div className="loading-mark">B</div>
        <strong>正在载入收银数据</strong>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onPage={setPage} shopName={data.settings.shopName} />
      <main className="main-area">
        {page === "tables" ? <TablePage /> : null}
        {page === "members" ? <MemberPage /> : null}
        {page === "drinks" ? <DrinkPage /> : null}
        {page === "history" ? <HistoryPage /> : null}
        {page === "settings" ? <SettingsPage /> : null}
      </main>
    </div>
  );
}
