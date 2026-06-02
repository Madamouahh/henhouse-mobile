export type PrestigeData = {
  title: string;
  subtitle: string;
  accent: string;
  glow: string;
  badge: string;
  hype: string;
};

type Params = {
  wins?: number;
  losses?: number;
  mmr?: number;
  winStreak?: number;
  koStreak?: number;
  undefeatedWins?: number;
};

export function getPrestigeFromStats(params: Params): PrestigeData {
  const wins = Number(params.wins || 0);
  const losses = Number(params.losses || 0);
  const mmr = Number(params.mmr || 1000);
  const winStreak = Number(params.winStreak || 0);
  const koStreak = Number(params.koStreak || 0);

  const undefeatedWins =
    params.undefeatedWins !== undefined
      ? Number(params.undefeatedWins || 0)
      : losses === 0
        ? wins
        : 0;

  if (undefeatedWins >= 15) {
    return {
      title: "LÉGENDE",
      subtitle: "15 victoires sans défaite",
      accent: "#A855F7",
      glow: "#2E1065",
      badge: "👑",
      hype: "Ton nom dépasse le Hall.",
    };
  }

  if (koStreak >= 5) {
    return {
      title: "BOUCHER",
      subtitle: "5 KO d'affilée",
      accent: "#FF7A00",
      glow: "#4A1E00",
      badge: "🩸",
      hype: "Tu fais tomber les corps, pas les points.",
    };
  }

  if (winStreak >= 8) {
    return {
      title: "CHAMPION",
      subtitle: "8 victoires de suite",
      accent: "#FFD700",
      glow: "#5B4300",
      badge: "🏆",
      hype: "Ta série change l’affiche.",
    };
  }

  if (wins >= 10) {
    return {
      title: "GLADIATEUR",
      subtitle: "10 victoires validées",
      accent: "#FF2A2A",
      glow: "#4B0F20",
      badge: "⚔️",
      hype: "Tu as survécu assez longtemps pour faire peur.",
    };
  }

  return {
    title: "CHALLENGER",
    subtitle: "Encore en montée",
    accent: "#38BDF8",
    glow: "#0E2E45",
    badge: "🔥",
    hype: "Tu frappes à la porte du Hall.",
  };
}

export function getWinStreakEstimate(params: {
  wins?: number;
  losses?: number;
  mmr?: number;
  explicitWinStreak?: number;
}) {
  if (params.explicitWinStreak !== undefined) return Number(params.explicitWinStreak || 0);

  const wins = Number(params.wins || 0);
  const losses = Number(params.losses || 0);
  const mmr = Number(params.mmr || 1000);

  if (wins === 0) return 0;
  if (losses === 0) return Math.min(wins, mmr >= 1600 ? 8 : 6);
  if (mmr >= 1800) return Math.min(7, Math.max(3, Math.floor(wins / 3)));
  if (mmr >= 1500) return Math.min(6, Math.max(2, Math.floor(wins / 4)));
  return Math.min(4, Math.max(1, Math.floor(wins / 5)));
}

export function getStreakLabel(streak: number) {
  if (streak >= 8) return "SÉRIE CHAMPION";
  if (streak >= 5) return "EN DOMINATION";
  if (streak >= 3) return "EN FEU";
  if (streak >= 1) return "EN MONTÉE";
  return "AUCUNE SÉRIE";
}
