import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { Capacitor } from "@capacitor/core";
import type {
  AppData,
  AppSettings,
  BalanceAdjustmentRecord,
  Category,
  Drink,
  Member,
  Order,
  OrderItem,
  PaymentRecord,
  QrPaymentMethod,
  RechargeRecord,
  Table
} from "../types";
import { calcBalanceUse, calcOrderTotals, calcRechargeCredit } from "../lib/billing";
import { uid, receiptNo } from "../lib/id";
import { loadAppData, persistAppData } from "../lib/storage";

interface DataStoreValue {
  data: AppData | null;
  loading: boolean;
  isNative: boolean;
  upsertCategory: (category: Category) => void;
  deleteCategory: (categoryId: string) => void;
  upsertDrink: (drink: Drink) => void;
  deleteDrink: (drinkId: string) => void;
  upsertTable: (table: Table) => void;
  deleteTable: (tableId: string) => boolean;
  openOrderForTable: (tableId: string) => Order | null;
  voidOpenOrder: (orderId: string) => void;
  addDrinkToOrder: (orderId: string, drink: Drink) => void;
  changeOrderItemQty: (orderId: string, itemId: string, delta: number) => void;
  removeOrderItem: (orderId: string, itemId: string) => void;
  setOrderMember: (orderId: string, member: Member | null) => void;
  setTableStatus: (tableId: string, status: Table["status"]) => void;
  settleOrder: (options: {
    orderId: string;
    memberId?: string;
    manualDiscountCents: number;
    manualDiscountNote: string;
    useBalance: boolean;
    paymentMethod: QrPaymentMethod | "balance" | "none";
  }) => Order | null;
  updateSettings: (patch: Partial<AppSettings>) => void;
  upsertMember: (member: Member) => void;
  deleteMember: (memberId: string) => void;
  rechargeMember: (memberId: string, payCents: number, creditedCents?: number, note?: string) => void;
  adjustMemberBalance: (memberId: string, deltaCents: number, note: string) => void;
}

const DataContext = createContext<DataStoreValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const isNative = Capacitor.isNativePlatform();

  ReactLoad(dataRef, setData);

  const commit = useCallback((recipe: (current: AppData) => AppData) => {
    const current = dataRef.current;
    if (!current) return;
    const next = recipe(current);
    dataRef.current = next;
    setData(next);
    void persistAppData(next);
  }, []);

  const upsertCategory = useCallback(
    (category: Category) =>
      commit((current) => {
        const exists = current.categories.some((item) => item.id === category.id);
        return {
          ...current,
          categories: exists
            ? current.categories.map((item) => (item.id === category.id ? category : item))
            : [...current.categories, category].sort((a, b) => a.sort - b.sort)
        };
      }),
    [commit]
  );

  const deleteCategory = useCallback(
    (categoryId: string) =>
      commit((current) => {
        const target = current.categories.find((item) => item.id === categoryId);
        if (!target || target.isSystem) return current;
        const fallback =
          current.categories.find((item) => item.id === "cat_other") ??
          current.categories.find((item) => item.id !== categoryId) ??
          { id: "", name: "未分类", sort: 99 };
        return {
          ...current,
          categories: current.categories.filter((item) => item.id !== categoryId),
          drinks: current.drinks.map((drink) =>
            drink.categoryId === categoryId ? { ...drink, categoryId: fallback.id } : drink,
          )
        };
      }),
    [commit]
  );

  const upsertDrink = useCallback(
    (drink: Drink) =>
      commit((current) => {
        const exists = current.drinks.some((item) => item.id === drink.id);
        return {
          ...current,
          drinks: exists
            ? current.drinks.map((item) => (item.id === drink.id ? drink : item))
            : [...current.drinks, drink]
        };
      }),
    [commit]
  );

  const deleteDrink = useCallback(
    (drinkId: string) =>
      commit((current) => ({
        ...current,
        drinks: current.drinks.filter((item) => item.id !== drinkId)
      })),
    [commit]
  );

  const upsertTable = useCallback(
    (table: Table) =>
      commit((current) => {
        const exists = current.tables.some((item) => item.id === table.id);
        return {
          ...current,
          tables: exists
            ? current.tables.map((item) => (item.id === table.id ? table : item))
            : [...current.tables, table].sort((a, b) => a.sort - b.sort)
        };
      }),
    [commit]
  );

  const deleteTable = useCallback(
    (tableId: string): boolean => {
      const table = dataRef.current?.tables.find((item) => item.id === tableId);
      if (!table || table.status !== "idle") return false;
      commit((current) => ({
        ...current,
        tables: current.tables.filter((item) => item.id !== tableId)
      }));
      return true;
    },
    [commit]
  );

  const openOrderForTable = useCallback(
    (tableId: string): Order | null => {
      const current = dataRef.current;
      if (!current) return null;
      const table = current.tables.find((item) => item.id === tableId);
      if (!table) return null;
      if (table.currentOrderId) {
        return current.orders.find((order) => order.id === table.currentOrderId) ?? null;
      }
      const order: Order = {
        id: uid("order"),
        tableId,
        status: "open",
        items: [],
        startedAt: Date.now(),
        totals: { subtotalCents: 0, memberDiscountCents: 0, manualDiscountCents: 0, payableCents: 0 },
        balanceUsedCents: 0,
        qrPayCents: 0,
        receiptNo: receiptNo(),
        discountPercent: 100,
        manualDiscountNote: ""
      };
      commit((app) => ({
        ...app,
        orders: [...app.orders, order],
        tables: app.tables.map((item) =>
          item.id === tableId
            ? { ...item, status: "occupied", openAt: order.startedAt, currentOrderId: order.id }
            : item,
        )
      }));
      return order;
    },
    [commit]
  );

  const voidOpenOrder = useCallback(
    (orderId: string) =>
      commit((current) => {
        const order = current.orders.find((item) => item.id === orderId);
        if (!order || order.status !== "open") return current;
        return {
          ...current,
          orders: current.orders.map((item) =>
            item.id === orderId ? { ...item, status: "voided" as const, voidedAt: Date.now() } : item,
          ),
          tables: current.tables.map((table) =>
            table.id === order.tableId
              ? { ...table, status: "idle", openAt: undefined, currentOrderId: undefined }
              : table,
          )
        };
      }),
    [commit]
  );

  const addDrinkToOrder = useCallback(
    (orderId: string, drink: Drink) =>
      commit((current) => {
        const order = current.orders.find((item) => item.id === orderId);
        if (!order || order.status !== "open") return current;
        const existing = order.items.find((item) => item.drinkId === drink.id);
        let items: OrderItem[];
        if (existing) {
          items = order.items.map((item) =>
            item.drinkId === drink.id ? { ...item, qty: item.qty + 1 } : item,
          );
        } else {
          items = [
            ...order.items,
            {
              id: uid("item"),
              drinkId: drink.id,
              name: drink.name,
              shortName: drink.shortName || drink.name,
              unitPriceCents: drink.priceCents,
              qty: 1
            }
          ];
        }
        return {
          ...current,
          orders: current.orders.map((item) =>
            item.id === orderId ? { ...item, items } : item,
          )
        };
      }),
    [commit]
  );

  const changeOrderItemQty = useCallback(
    (orderId: string, itemId: string, delta: number) =>
      commit((current) => ({
        ...current,
        orders: current.orders.map((order) => {
          if (order.id !== orderId) return order;
          const items = order.items
            .map((item) => (item.id === itemId ? { ...item, qty: item.qty + delta } : item))
            .filter((item) => item.qty > 0);
          return { ...order, items };
        })
      })),
    [commit]
  );

  const removeOrderItem = useCallback(
    (orderId: string, itemId: string) =>
      commit((current) => ({
        ...current,
        orders: current.orders.map((order) =>
          order.id === orderId
            ? { ...order, items: order.items.filter((item) => item.id !== itemId) }
            : order,
        )
      })),
    [commit]
  );

  const setOrderMember = useCallback(
    (orderId: string, member: Member | null) =>
      commit((current) => ({
        ...current,
        orders: current.orders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                memberId: member?.id,
                memberName: member?.name,
                discountPercent: member?.defaultDiscountPercent ?? 100
              }
            : order,
        )
      })),
    [commit]
  );

  const setTableStatus = useCallback(
    (tableId: string, status: Table["status"]) =>
      commit((current) => ({
        ...current,
        tables: current.tables.map((table) => (table.id === tableId ? { ...table, status } : table))
      })),
    [commit]
  );

  const settleOrder = useCallback(
    (options: {
      orderId: string;
      memberId?: string;
      manualDiscountCents: number;
      manualDiscountNote: string;
      useBalance: boolean;
      paymentMethod: QrPaymentMethod | "balance" | "none";
    }): Order | null => {
      const current = dataRef.current;
      if (!current) return null;
      const order = current.orders.find((item) => item.id === options.orderId);
      if (!order || order.status !== "open") return null;
      const table = current.tables.find((item) => item.id === order.tableId);
      const memberId = options.memberId ?? order.memberId;
      const member = memberId
        ? current.members.find((item) => item.id === memberId)
        : undefined;
      const totals = calcOrderTotals(order.items, member, options.manualDiscountCents);
      const balance = calcBalanceUse(member?.balanceCents ?? 0, totals.payableCents, options.useBalance);
      const paymentMethod = balance.qrPayCents > 0 ? options.paymentMethod : balance.balanceUsedCents > 0 ? "balance" : "none";
      const now = Date.now();
      const settledOrder: Order = {
        ...order,
        status: "settled",
        settledAt: now,
        totals,
        balanceUsedCents: balance.balanceUsedCents,
        qrPayCents: balance.qrPayCents,
        paymentMethod,
        discountPercent: member?.defaultDiscountPercent ?? 100,
        manualDiscountNote: options.manualDiscountNote
      };
      const paymentRecord: PaymentRecord = {
        id: uid("pay"),
        orderId: order.id,
        receiptNo: order.receiptNo,
        tableName: table?.name ?? "",
        memberId: member?.id,
        memberName: member?.name,
        subtotalCents: totals.subtotalCents,
        discountCents: totals.memberDiscountCents + totals.manualDiscountCents,
        payableCents: totals.payableCents,
        balanceUsedCents: balance.balanceUsedCents,
        qrPayCents: balance.qrPayCents,
        paymentMethod,
        paidAt: now
      };
      commit((app) => ({
        ...app,
        orders: app.orders.map((item) => (item.id === order.id ? settledOrder : item)),
        tables: app.tables.map((item) =>
          item.id === order.tableId
            ? { ...item, status: "idle", openAt: undefined, currentOrderId: undefined }
            : item,
        ),
        paymentRecords: [paymentRecord, ...app.paymentRecords],
        members: member
          ? app.members.map((item) =>
              item.id === member.id
                ? {
                    ...item,
                    balanceCents: item.balanceCents - balance.balanceUsedCents,
                    updatedAt: now
                  }
                : item,
            )
          : app.members
      }));
      return settledOrder;
    },
    [commit]
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) =>
      commit((current) => ({ ...current, settings: { ...current.settings, ...patch } })),
    [commit]
  );

  const upsertMember = useCallback(
    (member: Member) =>
      commit((current) => {
        const exists = current.members.some((item) => item.id === member.id);
        return {
          ...current,
          members: exists
            ? current.members.map((item) => (item.id === member.id ? member : item))
            : [...current.members, member]
        };
      }),
    [commit]
  );

  const deleteMember = useCallback(
    (memberId: string) =>
      commit((current) => ({
        ...current,
        members: current.members.filter((item) => item.id !== memberId)
      })),
    [commit]
  );

  const rechargeMember = useCallback(
    (memberId: string, payCents: number, creditedCentsOverride?: number, note = "") => {
      const member = dataRef.current?.members.find((item) => item.id === memberId);
      if (!member) return;
      const auto = calcRechargeCredit(payCents, member.defaultRechargeBonusPercent);
      const creditedCents = creditedCentsOverride ?? auto.creditedCents;
      const giftCents = Math.max(0, creditedCents - payCents);
      const record: RechargeRecord = {
        id: uid("recharge"),
        memberId,
        memberName: member.name,
        payCents,
        creditedCents,
        giftCents,
        note,
        createdAt: Date.now()
      };
      commit((current) => ({
        ...current,
        rechargeRecords: [record, ...current.rechargeRecords],
        members: current.members.map((item) =>
          item.id === memberId
            ? { ...item, balanceCents: item.balanceCents + creditedCents, updatedAt: Date.now() }
            : item,
        )
      }));
    },
    [commit]
  );

  const adjustMemberBalance = useCallback(
    (memberId: string, deltaCents: number, note: string) => {
      const member = dataRef.current?.members.find((item) => item.id === memberId);
      if (!member || deltaCents === 0) return;
      const record: BalanceAdjustmentRecord = {
        id: uid("adjust"),
        memberId,
        memberName: member.name,
        deltaCents,
        note,
        createdAt: Date.now()
      };
      commit((current) => ({
        ...current,
        balanceAdjustmentRecords: [record, ...current.balanceAdjustmentRecords],
        members: current.members.map((item) =>
          item.id === memberId
            ? {
                ...item,
                balanceCents: Math.max(0, item.balanceCents + deltaCents),
                updatedAt: Date.now()
              }
            : item,
        )
      }));
    },
    [commit]
  );

  const value = useMemo<DataStoreValue>(
    () => ({
      data,
      loading: !data,
      isNative,
      upsertCategory,
      deleteCategory,
      upsertDrink,
      deleteDrink,
      upsertTable,
      deleteTable,
      openOrderForTable,
      voidOpenOrder,
      addDrinkToOrder,
      changeOrderItemQty,
      removeOrderItem,
      setOrderMember,
      setTableStatus,
      settleOrder,
      updateSettings,
      upsertMember,
      deleteMember,
      rechargeMember,
      adjustMemberBalance
    }),
    [
      data,
      isNative,
      upsertCategory,
      deleteCategory,
      upsertDrink,
      deleteDrink,
      upsertTable,
      deleteTable,
      openOrderForTable,
      voidOpenOrder,
      addDrinkToOrder,
      changeOrderItemQty,
      removeOrderItem,
      setOrderMember,
      setTableStatus,
      settleOrder,
      updateSettings,
      upsertMember,
      deleteMember,
      rechargeMember,
      adjustMemberBalance
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function ReactLoad(
  dataRef: { current: AppData | null },
  setData: (data: AppData) => void,
) {
  useEffect(() => {
    let active = true;
    void loadAppData().then((value) => {
      if (!active) return;
      dataRef.current = value;
      setData(value);
    });
    return () => {
      active = false;
    };
  }, [dataRef, setData]);
}

export function useDataStore(): DataStoreValue {
  const value = useContext(DataContext);
  if (!value) throw new Error("useDataStore must be used inside DataProvider");
  return value;
}
