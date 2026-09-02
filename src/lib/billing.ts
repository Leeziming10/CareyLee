import type { Member, OrderItem, OrderTotals } from "../types";
import { centsFromRatio } from "./money";

export function calcOrderSubtotal(items: OrderItem[]): number {
  return items.reduce((total, item) => total + item.unitPriceCents * Math.max(1, item.qty), 0);
}

export function calcOrderTotals(
  items: OrderItem[],
  member?: Member | null,
  manualDiscountCents = 0,
): OrderTotals {
  const subtotalCents = calcOrderSubtotal(items);
  const discountPercent = member ? Math.max(0, Math.min(100, member.defaultDiscountPercent)) : 100;
  const memberDiscountedCents = centsFromRatio(subtotalCents, discountPercent);
  const memberDiscountCents = subtotalCents - memberDiscountedCents;
  const cappedManualDiscountCents = Math.min(
    Math.max(0, Math.round(manualDiscountCents)),
    memberDiscountedCents,
  );
  const payableCents = Math.max(0, memberDiscountedCents - cappedManualDiscountCents);
  return {
    subtotalCents,
    memberDiscountCents,
    manualDiscountCents: cappedManualDiscountCents,
    payableCents,
  };
}

export function calcBalanceUse(
  balanceCents: number,
  payableCents: number,
  useBalance: boolean,
): { balanceUsedCents: number; qrPayCents: number } {
  if (!useBalance) return { balanceUsedCents: 0, qrPayCents: payableCents };
  const balanceUsedCents = Math.max(0, Math.min(balanceCents, payableCents));
  return { balanceUsedCents, qrPayCents: payableCents - balanceUsedCents };
}

export function calcRechargeCredit(payCents: number, bonusPercent: number): {
  creditedCents: number;
  giftCents: number;
} {
  const safe = Math.max(0, Math.min(1000, bonusPercent || 0));
  const giftCents = Math.round((Math.max(0, payCents) * safe) / 100);
  return { creditedCents: Math.max(0, payCents) + giftCents, giftCents };
}
