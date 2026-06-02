export function formatParisDateTime(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "DATE N/A";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      ...options,
    });
  } catch {
    return "DATE N/A";
  }
}
export function formatParisTime(value?: string | null): string {
  if (!value) return "--:--";
  try {
    return new Date(value).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
  } catch { return "--:--"; }
}
export function formatParisDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return "DATE N/A";
  try {
    return new Date(value).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "2-digit", month: "long", ...options });
  } catch { return "DATE N/A"; }
}
