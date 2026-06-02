export type PrestigeData = {
  title: string;
  subtitle: string;
  accent: string;
  glow: string;
  badge: string;
  hype: string;
};

export function getPrestigeFromStats(params: {
  wins?: number;
  losses?: number;
  mmr?: number;
}) : PrestigeData {
  const wins = Number(params.wins || 0);
  const losses = Number(params.losses || 0);
  const mmr = Number(params.mmr || 1000);

  const ratio = wins + losses > 0 ? wins / (wins + losses) : 0;

  if (mmr >= 1800 || wins >= 20) {
    return {
      title: "LÉGENDE",
      subtitle: "Le nom que tout le monde connaît",
      accent: "#FFD166",
      glow: "#5B4300",
      badge: "👑",
      hype: "Tu règnes sur l’arène.",
    };
  }

  if (mmr >= 1600 || wins >= 12) {
    return {
      title: "CHAMPION",
      subtitle: "Tu fais partie de l’élite",
      accent: "#FF8C42",
      glow: "#4E2400",
      badge: "🏆",
      hype: "Ta présence change l’affiche.",
    };
  }

  if (mmr >= 1400 || wins >= 8) {
    return {
      title: "GLADIATEUR",
      subtitle: "Combattant confirmé et dangereux",
      accent: "#FF4D6D",
      glow: "#4B0F20",
      badge: "⚔️",
      hype: "Tu commences à faire peur.",
    };
  }

  if (mmr >= 1200 || wins >= 5) {
    return {
      title: "BOUCHER",
      subtitle: "Tu imposes ton rythme",
      accent: "#EF4444",
      glow: "#4A1111",
      badge: "🩸",
      hype: "Les autres commencent à douter.",
    };
  }

  if (mmr >= 1050 || wins >= 3 || ratio >= 0.6) {
    return {
      title: "PROSPECT",
      subtitle: "La montée commence",
      accent: "#22C55E",
      glow: "#0F3A20",
      badge: "🔥",
      hype: "Ton nom commence à circuler.",
    };
  }

  return {
    title: "ROOKIE",
    subtitle: "Nouveau dans la ligue",
    accent: "#38BDF8",
    glow: "#0E2E45",
    badge: "🎮",
    hype: "Tout reste à écrire.",
  };
}

export function getWinStreakEstimate(params: {
  wins?: number;
  losses?: number;
  mmr?: number;
}) {
  const wins = Number(params.wins || 0);
  const losses = Number(params.losses || 0);
  const mmr = Number(params.mmr || 1000);

  if (wins === 0) return 0;
  if (mmr >= 1800) return Math.min(9, Math.max(4, Math.floor(wins / 3)));
  if (mmr >= 1600) return Math.min(7, Math.max(3, Math.floor(wins / 3)));
  if (mmr >= 1400) return Math.min(6, Math.max(2, Math.floor(wins / 4)));
  if (mmr >= 1200) return Math.min(5, Math.max(1, Math.floor(wins / 4)));
  if (losses === 0 && wins > 0) return Math.min(3, wins);

  return 0;
}

export function getStreakLabel(streak: number) {
  if (streak >= 7) return "INTOUCHABLE";
  if (streak >= 5) return "SÉRIE BRÛLANTE";
  if (streak >= 3) return "EN FEU";
  if (streak >= 1) return "MONTÉE EN PUISSANCE";
  return "AUCUNE SÉRIE";
}