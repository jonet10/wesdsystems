export function toIsoDateOnly(date: Date) {
  return date.toISOString().split("T")[0];
}

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

