// HHFC RELEASE CANDIDATE FINAL
import { summarizeRewards } from "./missionRewards";
import { HomeMissionBundle, MissionDefinition, MissionEngineInput, MissionFlags, MissionProgress, MissionRole, MissionViewModel } from "./missionTypes";
import { MISSION_WEEK } from "./missionCatalog";

function upper(value: any) {
  return String(value || "").trim().toUpperCase();
}

function roleFromAny(value: any): MissionRole {
  const role = String(value || "fighter").toLowerCase();
  if (role === "bettor" || role === "bookmaker") return role;
  return "fighter";
}

export function touchMissionFlag(flags: MissionFlags | undefined, key: keyof MissionFlags, increment = false, delta = 1) {
  const next = { ...(flags || {}) } as MissionFlags;
  if (increment) {
    const current = Number(next[key] || 0);
    (next as any)[key] = Math.max(0, current + delta);
  } else {
    (next as any)[key] = true;
  }
  return next;
}

function progressForMission(mission: MissionDefinition, input: MissionEngineInput): MissionProgress {
  const flags = input.missionFlags || {};
  const wins = Number(input.wins || 0);
  const losses = Number(input.losses || 0);
  const fightCount = wins + losses;
  const leaderboardRank = Number(input.leaderboardRank || 999);
  const placedBetCount = Number(flags.placedBetCount || 0);
  const wonBetCount = Number(flags.wonBetCount || 0);
  const bookedFightCount = Number(flags.bookedFightCount || 0);
  const affiliateVolumeCount = Number(flags.affiliateVolumeCount || 0);
  const affiliateActiveCount = Number(flags.affiliateActiveCount || 0);

  switch (mission.id) {
    case "fighter_day_1": return { progress: flags.viewedFight ? 1 : 0, completed: !!flags.viewedFight };
    case "fighter_day_2": return { progress: Math.min(bookedFightCount, 1), completed: bookedFightCount >= 1 };
    case "fighter_day_3": return { progress: flags.viewedArena ? 1 : 0, completed: !!flags.viewedArena };
    case "fighter_day_4": return { progress: flags.viewedWallet ? 1 : 0, completed: !!flags.viewedWallet };
    case "fighter_day_5": return { progress: Math.min(fightCount, 1), completed: fightCount >= 1 };
    case "fighter_day_6": return { progress: Math.min(wins, 1), completed: wins >= 1 };
    case "fighter_day_7": return { progress: leaderboardRank <= 20 ? 1 : 0, completed: leaderboardRank <= 20 };

    case "bettor_day_1": return { progress: flags.viewedBet ? 1 : 0, completed: !!flags.viewedBet };
    case "bettor_day_2": return { progress: Math.min(placedBetCount, 1), completed: placedBetCount >= 1 };
    case "bettor_day_3": return { progress: flags.viewedBet ? 1 : 0, completed: !!flags.viewedBet };
    case "bettor_day_4": return { progress: Math.min(placedBetCount, 2), completed: placedBetCount >= 2 };
    case "bettor_day_5": return { progress: Math.min(wonBetCount, 1), completed: wonBetCount >= 1 };
    case "bettor_day_6": return { progress: Math.min(placedBetCount, 3), completed: placedBetCount >= 3 };
    case "bettor_day_7": return { progress: Math.min(placedBetCount, 3), completed: placedBetCount >= 3 };

    case "bookmaker_day_1": return { progress: flags.openedBookmaker ? 1 : 0, completed: !!flags.openedBookmaker };
    case "bookmaker_day_2": return { progress: flags.bookmakerApplied ? 1 : 0, completed: !!flags.bookmakerApplied };
    case "bookmaker_day_3": return { progress: flags.openedBookmaker ? 1 : 0, completed: !!flags.openedBookmaker };
    case "bookmaker_day_4": return { progress: flags.openedBookmaker ? 1 : 0, completed: !!flags.openedBookmaker };
    case "bookmaker_day_5": return { progress: Math.min(affiliateVolumeCount, 1), completed: affiliateVolumeCount >= 1 };
    case "bookmaker_day_6": return { progress: Math.min(affiliateActiveCount, 1), completed: affiliateActiveCount >= 1 };
    case "bookmaker_day_7": return { progress: Math.min(affiliateActiveCount, 3), completed: affiliateActiveCount >= 3 };
    default: return { progress: 0, completed: false };
  }
}

function buildMissionView(mission: MissionDefinition, input: MissionEngineInput): MissionViewModel {
  const progress = progressForMission(mission, input);
  return {
    ...mission,
    ...progress,
    rewardSummary: summarizeRewards(mission.rewards) || "",
  };
}

function dayIndexParis(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(date);
  const mapping: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return mapping[weekday] || 1;
}

function onboardingMission(input: MissionEngineInput): MissionViewModel | null {
  const verification = upper(input.verificationStatus || "PENDING");
  const wallet = Number(input.walletBalance || 0) + Number(input.walletBonusBalance || 0);

  if (verification !== "VERIFIED") {
    return {
      id: "access_gate",
      role: roleFromAny(input.role),
      weekDay: 0,
      code: "ACCÈS",
      title: "VALIDE TON ACCÈS",
      description: "Ton profil doit être VERIFIED pour débloquer le jeu.",
      cta: "OUVRIR PROFILE",
      targetScreen: "Profile",
      progressTarget: 1,
      rewards: [{ kind: "unlock", value: "MODULES JOUEUR", label: "MODULES JOUEUR" }],
      visibleOnHome: true,
      progress: 0,
      completed: false,
      rewardSummary: "MODULES JOUEUR",
    };
  }

  if (wallet <= 0) {
    return {
      id: "wallet_gate",
      role: roleFromAny(input.role),
      weekDay: 0,
      code: "WALLET",
      title: "ACTIVE TON WALLET",
      description: "Un wallet vide coupe la progression. Recharge et reviens.",
      cta: "OUVRIR WALLET",
      targetScreen: "Wallet",
      progressTarget: 1,
      rewards: [{ kind: "unlock", value: "BOUCLE QUOTIDIENNE", label: "BOUCLE QUOTIDIENNE" }],
      visibleOnHome: true,
      progress: 0,
      completed: false,
      rewardSummary: "BOUCLE QUOTIDIENNE",
    };
  }

  return null;
}

function coachLineFor(role: MissionRole, mission: MissionViewModel) {
  if (role === "fighter") return `Mission du jour : ${mission.title.toLowerCase()}. Tu bouges, tu prends le gain, puis tu reviens.`;
  if (role === "bettor") return `Lis la card, verrouille ton ticket et prends seulement ce qui paie.`;
  return `Ton panel doit produire du vrai volume et des affiliés actifs, pas juste un écran ouvert.`;
}

export function getHomeMissionBundle(input: MissionEngineInput): HomeMissionBundle {
  const role = roleFromAny(input.role);
  const blocker = onboardingMission(input);
  if (blocker) return { primary: blocker, weeklyLabel: null, coachLine: coachLineFor(role, blocker) };

  const catalog = MISSION_WEEK[role] || MISSION_WEEK.fighter;
  const today = dayIndexParis();
  const ordered = [...catalog].sort((a, b) => a.weekDay - b.weekDay);
  const fromToday = ordered.filter((mission) => mission.weekDay >= today);
  const beforeToday = ordered.filter((mission) => mission.weekDay < today);
  const rotation = [...fromToday, ...beforeToday];
  const nextMission = rotation.find((mission) => !progressForMission(mission, input).completed) || null;
  const primary = nextMission
    ? buildMissionView(nextMission, input)
    : {
        id: `${role}_standby`,
        role,
        weekDay: 99,
        code: 'STANDBY',
        title: 'AUCUN OBJECTIF ACTIF',
        description: 'Toutes les missions disponibles sont validées. Attends le prochain contrat.',
        cta: 'VOIR LE HUB',
        targetScreen: 'Home',
        progressTarget: 1,
        rewards: [],
        visibleOnHome: true,
        progress: 1,
        completed: false,
        rewardSummary: 'PROCHAIN CONTRAT BIENTÔT',
      } as MissionViewModel;

  const weeklyCompleted = ordered.reduce((acc, mission) => acc + (progressForMission(mission, input).completed ? 1 : 0), 0);
  const weeklyLabel = `${weeklyCompleted}/7 CETTE SEMAINE`;

  return {
    primary,
    weeklyLabel,
    coachLine: coachLineFor(role, primary),
  };
}

// HHFC FINAL RULES
// - production mission engine locked
// - no duplicate mission rewards
