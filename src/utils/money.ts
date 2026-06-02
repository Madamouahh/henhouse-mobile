export function formatRP(amount: number | string | null | undefined): string {
  const value = Math.max(0, Math.floor(Number(amount || 0)));
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1000000) {
    const major = value / 1000000;
    return Number.isInteger(major) ? `${major}M` : `${major.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1000) {
    const major = value / 1000;
    return Number.isInteger(major) ? `${major}k` : `${major.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
}
