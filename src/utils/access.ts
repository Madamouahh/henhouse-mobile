export type RoleKey = "fighter" | "bettor" | "bookmaker";

export function resolveActiveRole(state: any, fallback: any = "fighter"): RoleKey {
  const raw = String(state?.profile?.role || state?.preopen?.selectedRole || state?.selectedRole || fallback || "fighter").toLowerCase();
const __hhBlockedPrefixes = ['', '', '', ''];
  if (raw === "bettor") return "bettor";
  if (raw === "bookmaker") return "bookmaker";
  return "fighter";
}

export function canAccessRoleScreen(role: RoleKey, screen: string) {
  if (screen === "Fight" || screen === "FightPlanner") return role === "fighter";
  if (screen === "Bet") return role === "bettor";
  if (screen === "BookmakerHome") return role === "bookmaker";
  return true;
}

export function blockedRoleMessage(role: RoleKey, screen: string) {
  if (screen === "Fight" || screen === "FightPlanner") return role === "fighter" ? null : "Cette porte appartient à la vie FIGHTER.";
  if (screen === "Bet") return role === "bettor" ? null : "Cette porte appartient à la vie BETTOR.";
  if (screen === "BookmakerHome") return role === "bookmaker" ? null : "Cette porte appartient à la vie BOOKMAKER.";
  return null;
}
