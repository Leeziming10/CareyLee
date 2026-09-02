const TWO_PLACES = 100;

export function parseYuanToCents(input: string | number): number {
  if (typeof input === "number") {
    return Math.round(input * TWO_PLACES);
  }
  const normalized = input.trim().replace(/[¥￥,\s]/g, "");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * TWO_PLACES);
}

export function formatCents(cents: number, withSymbol = true): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(Math.round(cents));
  const yuan = Math.floor(absolute / TWO_PLACES);
  const fen = absolute % TWO_PLACES;
  const symbol = withSymbol ? "¥" : "";
  return `${sign}${symbol}${yuan}.${String(fen).padStart(2, "0")}`;
}

export function centsToYuanInput(cents: number): string {
  return (cents / TWO_PLACES).toFixed(2).replace(/\.?0+$/, "");
}

export function centsFromRatio(cents: number, percent: number): number {
  const safe = Math.max(0, Math.min(100, percent || 0));
  return Math.round((cents * safe) / 100);
}

export function formatDiscountPercent(percent: number): string {
  if (percent >= 100) return "无折扣";
  return `${(percent / 10).toFixed(percent % 10 === 0 ? 0 : 1)}折`;
}

export function clampCents(value: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
