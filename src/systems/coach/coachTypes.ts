// HHFC RELEASE CANDIDATE FINAL
export type CoachRole = "fight" | "bet" | "bookmaker";
export type CoachGender = "male" | "female";
export type CoachMode = "portrait" | "scene";
export type CoachScene = "wallet" | "leaderboard" | "fight" | "bet" | "bookmaker" | "identity" | "default";
export type CoachMessageType = "intro" | "mission" | "warning" | "reward" | "hype";

export type MissionReward = {
  money?: number;
  prestige?: number;
  title?: string;
};

export type MissionCard = {
  id: string;
  universe: "global" | "fight" | "bet" | "bookmaker";
  cadence: "daily" | "weekly" | "progression";
  category: "movement" | "action" | "prestige";
  code: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward?: MissionReward;
  completed?: boolean;
};

export type CoachMessage = {
  id: string;
  role: CoachRole;
  type: CoachMessageType;
  mode: CoachMode;
  scene: CoachScene;
  text: string;
  cta?: string;
  target?: string;
  priority?: number;
};

export type StartCoachStep = "welcome" | "world" | "choose_universe" | "choose_coach" | "identity" | "rule" | "wallet";

// HHFC FINAL RULES
// - production coach types only
