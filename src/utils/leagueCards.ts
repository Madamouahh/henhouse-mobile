export type LeagueTier = 'STREET' | 'BRAWLER' | 'CONTENDER' | 'CHALLENGER' | 'ELITE' | 'LEGEND' | 'KING';

export function getLeagueTier(mmr: number, leaderboardRank?: number | null): LeagueTier {
  if (Number(leaderboardRank) === 1) return 'KING';
  const safe = Number(mmr || 0);
  if (safe >= 1550) return 'LEGEND';
  if (safe >= 1350) return 'ELITE';
  if (safe >= 1200) return 'CHALLENGER';
  if (safe >= 1100) return 'CONTENDER';
  if (safe >= 1000) return 'BRAWLER';
  return 'STREET';
}

export function getLeagueLabelFr(mmr: number, leaderboardRank?: number | null): string {
  switch (getLeagueTier(mmr, leaderboardRank)) {
    case 'KING': return 'KING';
    case 'LEGEND': return 'LÉGENDE';
    case 'ELITE': return 'ÉLITE';
    case 'CHALLENGER': return 'CHALLENGER';
    case 'CONTENDER': return 'CONTENDER';
    case 'BRAWLER': return 'BRAWLER';
    default: return 'STREET';
  }
}

export function getLeagueAccent(mmr: number, leaderboardRank?: number | null): string {
  switch (getLeagueTier(mmr, leaderboardRank)) {
    case 'KING': return '#D6B04A';
    case 'LEGEND': return '#8D71FF';
    case 'ELITE': return '#EC4900';
    case 'CHALLENGER': return '#A65A38';
    case 'CONTENDER': return '#69707A';
    case 'BRAWLER': return '#9A302A';
    default: return '#4D535C';
  }
}

export function getLeagueTint(mmr: number, leaderboardRank?: number | null): string {
  switch (getLeagueTier(mmr, leaderboardRank)) {
    case 'KING': return 'rgba(214,176,74,0.18)';
    case 'LEGEND': return 'rgba(141,113,255,0.16)';
    case 'ELITE': return 'rgba(236,73,0,0.15)';
    case 'CHALLENGER': return 'rgba(166,90,56,0.14)';
    case 'CONTENDER': return 'rgba(105,112,122,0.14)';
    case 'BRAWLER': return 'rgba(154,48,42,0.16)';
    default: return 'rgba(77,83,92,0.14)';
  }
}

// Compatibilité avec les anciens imports. Ne plus utiliser pour les cartes sobres.
export function getLeagueCardSource() {
  return null;
}
