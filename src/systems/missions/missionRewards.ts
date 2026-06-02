// HHFC RELEASE CANDIDATE FINAL
import { MissionReward } from "./missionTypes";

export function formatMissionReward(reward: MissionReward) {
  if (reward.kind === "cash") return `+$${Number(reward.value || 0).toLocaleString("fr-FR")}`;
  if (reward.kind === "xp") return `+${Number(reward.value || 0)} XP`;
  if (reward.kind === "prestige") return `+${Number(reward.value || 0)} PRESTIGE`;
  if (reward.kind === "commission") return `+${Number(reward.value || 0)} COMMISSION`;
  return String(reward.label || reward.value || "").toUpperCase();
}

export function summarizeRewards(rewards: MissionReward[] | undefined) {
  if (!Array.isArray(rewards) || rewards.length === 0) return null;
  return rewards.map(formatMissionReward).join(" • ");
}

// HHFC FINAL RULES
// - rewards aligned with wallet system
