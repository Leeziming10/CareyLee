export type ID = string;

export type TableStatus = "idle" | "occupied" | "checkout";
export type OrderStatus = "open" | "settled" | "voided";
export type QrPaymentMethod = "wechat" | "alipay";
export type CutMode = "gs-v66" | "esc-i";

export interface Category {
  id: ID;
  name: string;
  sort: number;
  isSystem?: boolean;
}

export interface Drink {
  id: ID;
  categoryId: ID;
  name: string;
  shortName: string;
  priceCents: number;
  enabled: boolean;
  sort: number;
}

export interface Table {
  id: ID;
  name: string;
  seats: number;
  status: TableStatus;
  openAt?: number;
  currentOrderId?: ID;
  sort: number;
}

export interface OrderItem {
  id: ID;
  drinkId: ID;
  name: string;
  shortName: string;
  unitPriceCents: number;
  qty: number;
}

export interface OrderTotals {
  subtotalCents: number;
  memberDiscountCents: number;
  manualDiscountCents: number;
  payableCents: number;
}

export interface Order {
  id: ID;
  tableId: ID;
  status: OrderStatus;
  items: OrderItem[];
  memberId?: ID;
  memberName?: string;
  startedAt: number;
  settledAt?: number;
  totals: OrderTotals;
  balanceUsedCents: number;
  qrPayCents: number;
  paymentMethod?: QrPaymentMethod | "balance" | "none";
  receiptNo: string;
  discountPercent: number;
  manualDiscountNote: string;
  voidedAt?: number;
}

export interface Member {
  id: ID;
  name: string;
  phone: string;
  note: string;
  balanceCents: number;
  defaultDiscountPercent: number;
  defaultRechargeBonusPercent: number;
  createdAt: number;
  updatedAt: number;
}

export interface RechargeRecord {
  id: ID;
  memberId: ID;
  memberName: string;
  payCents: number;
  creditedCents: number;
  giftCents: number;
  note: string;
  createdAt: number;
}

export interface BalanceAdjustmentRecord {
  id: ID;
  memberId: ID;
  memberName: string;
  deltaCents: number;
  note: string;
  createdAt: number;
}

export interface PaymentRecord {
  id: ID;
  orderId: ID;
  receiptNo: string;
  tableName: string;
  memberId?: ID;
  memberName?: string;
  subtotalCents: number;
  discountCents: number;
  payableCents: number;
  balanceUsedCents: number;
  qrPayCents: number;
  paymentMethod?: QrPaymentMethod | "balance" | "none";
  paidAt: number;
}

export interface AppSettings {
  shopName: string;
  shopPhone: string;
  receiptFooter: string;
  printerEnabled: boolean;
  printerHost: string;
  printerPort: number;
  printOnOrder: boolean;
  printOnCheckout: boolean;
  cutMode: CutMode;
  wechatQrDataUrl?: string;
  alipayQrDataUrl?: string;
  autoShowQr: boolean;
}

export interface AppData {
  schemaVersion: 1;
  categories: Category[];
  drinks: Drink[];
  tables: Table[];
  members: Member[];
  orders: Order[];
  rechargeRecords: RechargeRecord[];
  balanceAdjustmentRecords: BalanceAdjustmentRecord[];
  paymentRecords: PaymentRecord[];
  settings: AppSettings;
}

export type PageKey = "tables" | "members" | "drinks" | "history" | "settings";
