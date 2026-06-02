// HHFC RELEASE CANDIDATE FINAL
export type MissionRole = "fighter" | "bettor" | "bookmaker";
export type MissionRewardKind = "cash" | "xp" | "prestige" | "unlock" | "ticket" | "priority" | "commission";

export type MissionReward = {
  kind: MissionRewardKind;
  value: number | string;
  label: string;
};

export type MissionDefinition = {
  id: string;
  role: MissionRole;
  weekDay: number;
  code: string;
  title: string;
  description: string;
  cta: string;
  targetScreen: string;
  progressTarget: number;
  rewards: MissionReward[];
  visibleOnHome: boolean;
};

export type MissionFlags = {
  viewedFight?: boolean;
  viewedArena?: boolean;
  viewedWallet?: boolean;
  viewedBet?: boolean;
  openedBookmaker?: boolean;
  bookmakerApplied?: boolean;
  placedBetCount?: number;
  wonBetCount?: number;
  bookedFightCount?: number;
  boughtTicketCount?: number;
  affiliateVolumeCount?: number;
  affiliateActiveCount?: number;
};

export type MissionEngineInput = {
  role: MissionRole;
  verificationStatus?: string | null;
  walletBalance?: number;
  walletBonusBalance?: number;
  walletLockedBalance?: number;
  wins?: number;
  losses?: number;
  leaderboardRank?: number | null;
  missionFlags?: MissionFlags;
};

export type MissionProgress = {
  progress: number;
  completed: boolean;
};

export type MissionViewModel = MissionDefinition & MissionProgress & {
  rewardSummary: string;
};

export type HomeMissionBundle = {
  primary: MissionViewModel;
  weeklyLabel: string | null;
  coachLine: string | null;
};

// HHFC FINAL RULES
// - production mission typing enabled
