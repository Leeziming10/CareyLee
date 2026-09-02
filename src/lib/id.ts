export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function receiptNo(date = new Date()): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const random = Math.random().toString().slice(2, 6);
  return `B${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${random}`;
}
