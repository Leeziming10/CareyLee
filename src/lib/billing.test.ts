import { describe, expect, it } from "vitest";
import { calcBalanceUse, calcOrderTotals, calcRechargeCredit } from "./billing";
import { parseYuanToCents } from "./money";
import type { Member, OrderItem } from "../types";

function item(cents: number, qty: number): OrderItem {
  return {
    id: "i1",
    drinkId: "d1",
    name: "生啤",
    shortName: "生啤",
    unitPriceCents: cents,
    qty
  };
}

const baseMember: Member = {
  id: "m1",
  name: "客人",
  phone: "",
  note: "",
  balanceCents: 0,
  defaultDiscountPercent: 100,
  defaultRechargeBonusPercent: 0,
  createdAt: 1,
  updatedAt: 1
};

describe("billing math", () => {
  it("converts yuan input into integer cents", () => {
    expect(parseYuanToCents("28.50")).toBe(2850);
    expect(parseYuanToCents("¥100.55")).toBe(10055);
  });

  it("calculates subtotal and member discount in cents", () => {
    const totals = calcOrderTotals([item(2850, 2), item(1200, 1)], {
      ...baseMember,
      defaultDiscountPercent: 90
    });
    expect(totals.subtotalCents).toBe(6900);
    expect(totals.memberDiscountCents).toBe(690);
    expect(totals.payableCents).toBe(6210);
  });

  it("caps manual discount without making bill negative", () => {
    const totals = calcOrderTotals([item(5000, 1)], null, 9000);
    expect(totals.manualDiscountCents).toBe(5000);
    expect(totals.payableCents).toBe(0);
  });

  it("deducts balance only up to payable amount", () => {
    expect(calcBalanceUse(3000, 5000, true)).toEqual({ balanceUsedCents: 3000, qrPayCents: 2000 });
    expect(calcBalanceUse(8000, 5000, true)).toEqual({ balanceUsedCents: 5000, qrPayCents: 0 });
    expect(calcBalanceUse(8000, 5000, false)).toEqual({ balanceUsedCents: 0, qrPayCents: 5000 });
  });

  it("computes recharge gift credit from per-member bonus percent", () => {
    expect(calcRechargeCredit(10000, 10)).toEqual({ creditedCents: 11000, giftCents: 1000 });
    expect(calcRechargeCredit(10000, 0)).toEqual({ creditedCents: 10000, giftCents: 0 });
  });
});
