// HHFC RELEASE CANDIDATE FINAL

import { CoachMessage, CoachRole, MissionCard, StartCoachStep } from "./coachTypes";

type CoachContext = {
  role: CoachRole;
  hasProfile: boolean;
  wallet: number;
  verificationStatus?: string | null;
  bookmakerApproved?: boolean;
  wins?: number;
  activeMissionText?: string | null;
  viewedArena?: boolean;
  viewedFight?: boolean;
  viewedWallet?: boolean;
  openedBookmaker?: boolean;
  bookmakerApplied?: boolean;
  placedBetCount?: number;
  bookedFightCount?: number;
  boughtTicketCount?: number;
};

function upper(value: any) {
  return String(value || "").trim().toUpperCase();
}

function ratio(progress: number, target: number) {
  if (!Number.isFinite(progress) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress / target) * 100)));
}

function coachKey(name?: string) {
  const v = upper(name);
  if (["KLYDE", "NYX", "MILO", "MARIA", "RAZOR", "SCAR"].includes(v)) return v;
  return null;
}

function shortVoice(step: StartCoachStep, role: CoachRole, coachName?: string) {
  const key = coachKey(coachName);

  switch (key) {
    case "KLYDE":
      switch (step) {
        case "welcome": return "Tu veux entrer ?\nOublie le confort.\nIci, personne ne te protège.";
        case "world": return "Les portes vont s'ouvrir.\n100 combattants.\n10 bookmakers.";
        case "choose_universe": return "Tu viens pour Fight ?\nAlors viens pour cogner.\nPas pour exister à moitié.";
        case "choose_coach": return "Je ne tiens pas la main.\nJe regarde si t'as du cran.\nLe reste m'ennuie.";
        case "identity": return "Ton nom doit frapper.\nÉcris-le proprement.\nEt assume-le.";
        case "rule": return "Ici, chaque erreur marque.\nTu tiens debout,\nou tu sors.";
        case "wallet": return "Va au Hen House.\nCharge ton wallet.\nAprès ça, plus d'excuses.";
        default: return null;
      }

    case "NYX":
      switch (step) {
        case "welcome": return "Tu peux hésiter maintenant.\nAprès,\nle ring ne pardonne plus.";
        case "world": return "Ce lieu ne rassure personne.\nIl révèle juste\nqui casse les autres.";
        case "choose_universe": return "Tu choisis Fight ?\nPrends ta place.\nNe la demande pas.";
        case "choose_coach": return "Je ne vais pas te rassurer.\nJe vais te rendre\nplus dangereuse.";
        case "identity": return "Ton nom doit claquer.\nFais en sorte\nqu'il reste en tête.";
        case "rule": return "Le doute coûte cher.\nFrappe juste.\nOu laisse ta place.";
        case "wallet": return "Passe au Hen House.\nL'entrée commence là.\nPas dans les mots.";
        default: return null;
      }

    case "MILO":
      switch (step) {
        case "welcome": return "Tu veux gagner ?\nAlors observe.\nL'argent aime les patients.";
        case "world": return "Ici, certains saignent.\nD'autres encaissent.\nLes malins lisent tout.";
        case "choose_universe": return "Parier, ce n'est pas rêver.\nC'est voir tomber l'autre\navant la foule.";
        case "choose_coach": return "J'ai vu tomber des joueurs.\nSi tu m'écoutes,\ntu tomberas moins bêtement.";
        case "identity": return "Ton nom doit circuler.\nPas sentir l'amateur.\nPose-le bien.";
        case "rule": return "Une mauvaise lecture\ncoûte plus cher\nqu'un mauvais ticket.";
        case "wallet": return "Charge ton wallet.\nSans bankroll,\ntu restes spectateur.";
        default: return null;
      }

    case "MARIA":
      switch (step) {
        case "welcome": return "Ici, l'argent ne tombe pas.\nIl glisse vers celles\nqui sentent le moment.";
        case "world": return "Le Hen House fait tomber\nles impulsifs.\nLes lucides encaissent.";
        case "choose_universe": return "Tu choisis Bet ?\nLis le vice avant les autres.\nC'est là que ça paye.";
        case "choose_coach": return "Je ne promets pas d'être douce.\nJe promets\nde t'apprendre à lire juste.";
        case "identity": return "Ton nom doit respirer\nle contrôle.\nPas l'improvisation.";
        case "rule": return "Un pari trop vite posé,\nc'est une porte ouverte\nsur la perte.";
        case "wallet": return "Passe au Hen House.\nL'argent réel commence\ntoujours par un mouvement.";
        default: return null;
      }

    case "RAZOR":
      switch (step) {
        case "welcome": return "Le pouvoir ici\nne vient pas de la chance.\nIl vient du contrôle.";
        case "world": return "100 combattants.\n10 bookmakers.\nLe réseau prend la valeur.";
        case "choose_universe": return "Le réseau n'est pas un rôle.\nC'est une machine.\nBien lancée, elle imprime.";
        case "choose_coach": return "Je ne parle pas de chance.\nJe parle volume,\ninfluence et emprise.";
        case "identity": return "Ton nom doit signer.\nPropre.\nNet. Rentable.";
        case "rule": return "Un réseau mal tenu\nte ruine plus vite\nqu'il ne t'enrichit.";
        case "wallet": return "Commence au Hen House.\nUn empire solide\npart toujours d'une base.";
        default: return null;
      }

    case "SCAR":
      switch (step) {
        case "welcome": return "L'influence ne se demande pas.\nElle se prend.\nPuis elle se construit.";
        case "world": return "Le Hen House donne la lumière.\nLes plus intelligentes\nen font un empire.";
        case "choose_universe": return "Tu veux le réseau ?\nConstruis du volume.\nPas une posture.";
        case "choose_coach": return "Je ne suis pas là pour décorer.\nJe suis là pour te faire\nmonter plus haut.";
        case "identity": return "Ton nom doit déjà sonner\ncomme une marque.\nEntre proprement.";
        case "rule": return "Une mauvaise décision\nbrûle un réseau entier.\nIci, on avance précis.";
        case "wallet": return "Passe au Hen House.\nChaque empire commence\npar un ancrage.";
        default: return null;
      }

    default:
      break;
  }

  switch (step) {
    case "welcome":
      return role === "fight"
        ? "Tu veux te battre ?\nAlors oublie tout.\nIci, personne ne te protège."
        : role === "bet"
          ? "Tu veux gagner ?\nObserve d'abord.\nL'argent bouge vite."
          : "Tu veux contrôler ?\nAlors retiens ça.\nLe pouvoir, c'est les autres.";
    case "world":
      return "Les portes vont s'ouvrir.\n100 combattants.\n10 bookmakers.";
    case "choose_universe":
      return role === "fight"
        ? "Le ring t'appelle.\nMonte si tu veux\nque ton nom pèse."
        : role === "bet"
          ? "Ici, l'argent aime\nceux qui lisent juste\navant les autres."
          : "Le réseau est une machine.\nSi tu l'actives bien,\nil rapporte.";
    case "choose_coach":
      return "Choisis bien.\nLa voix qui te guide\nchange ton entrée.";
    case "identity":
      return "Ton nom circule ici.\nFais en sorte\nqu'il mérite de rester.";
    case "rule":
      return role === "fight"
        ? "Chaque erreur laisse une trace.\nTu tiens,\nou tu sors."
        : role === "bet"
          ? "Une lecture ratée\nte coûte plus\nqu'un ticket."
          : "Un réseau mal géré\nte brûle plus vite\nqu'il ne t'enrichit.";
    case "wallet":
      return "Va au Hen House.\nC'est là\nque tout commence.";
    default:
      return null;
  }
}

export function buildMissionStack(context: CoachContext): MissionCard[] {
  const missions: MissionCard[] = [];
  const verification = upper(context.verificationStatus || "PENDING");
  const wallet = Number(context.wallet || 0);
  const wins = Number(context.wins || 0);
  const placedBetCount = Number(context.placedBetCount || 0);
  const bookedFightCount = Number(context.bookedFightCount || 0);
  const boughtTicketCount = Number(context.boughtTicketCount || 0);

  if (!context.hasProfile || verification !== "VERIFIED") {
    missions.push({
      id: "identity_required",
      universe: "global",
      cadence: "progression",
      category: "movement",
      code: "MISSION 01",
      title: "FINALISE TON IDENTITÉ",
      description: "Nom RP, numéro RP et pièce RP. Sans ça, personne ne te laisse entrer dans le jeu.",
      progress: verification === "VERIFIED" ? 1 : 0,
      target: 1,
      reward: { prestige: 1 },
    });
    return missions;
  }

  if (wallet <= 0) {
    missions.push({
      id: "wallet_required",
      universe: "global",
      cadence: "progression",
      category: "movement",
      code: "MISSION 02",
      title: "PASSE AU HEN HOUSE",
      description: "Va au wallet, parle à la vieille et charge ton compte pour débloquer le jeu.",
      progress: 0,
      target: 1,
      reward: { money: 5000 },
    });
  }

  if (context.role === "fight") {
    missions.push({
      id: "fight_daily_watch",
      universe: "fight",
      cadence: "daily",
      category: "movement",
      code: "DAILY FIGHT",
      title: "VA VOIR LES FIGHTS",
      description: "Passe dans l'arène et regarde le programme avant de monter.",
      progress: context.viewedFight || context.viewedArena ? 1 : 0,
      target: 1,
      reward: { money: 10000 },
    });
    missions.push({
      id: "fight_weekly_prestige",
      universe: "fight",
      cadence: "weekly",
      category: "prestige",
      code: "WEEK FIGHT",
      title: wins >= 5 ? "DEVIENS BOUCHER" : "ENCHAÎNE 5 VICTOIRES",
      description: wins >= 5 ? "Ton titre Boucher t'attend. Continue de faire tomber les autres." : "Passe une vraie série et impose ton nom dans le Hen House.",
      progress: wins,
      target: 5,
      reward: { prestige: 10, title: "BOUCHER" },
    });
  }

  if (context.role === "bet") {
    missions.push({
      id: "bet_daily_ticket",
      universe: "bet",
      cadence: "daily",
      category: "action",
      code: "DAILY BET",
      title: "PLACE TON PREMIER TICKET",
      description: "Lis la carte des combats et verrouille un vrai ticket aujourd'hui.",
      progress: Math.min(placedBetCount, 1),
      target: 1,
      reward: { money: 7500 },
    });
    missions.push({
      id: "bet_weekly_multiple",
      universe: "bet",
      cadence: "weekly",
      category: "prestige",
      code: "WEEK BET",
      title: "POSE 3 TICKETS CETTE SEMAINE",
      description: "Un joueur régulier lit la card, revient et multiplie les tickets propres.",
      progress: Math.min(placedBetCount, 3),
      target: 3,
      reward: { prestige: 8 },
    });
  }

  if (context.role === "bookmaker") {
    missions.push({
      id: "bookmaker_daily_move",
      universe: "bookmaker",
      cadence: "daily",
      category: "movement",
      code: "DAILY RÉSEAU",
      title: context.bookmakerApplied ? "DOSSIER ENVOYÉ" : "FAIS TA DEMANDE BOOKMAKER",
      description: context.bookmakerApplied ? "Ton dossier est parti. Surveille la validation staff." : "Active ton accès réseau pour pouvoir faire entrer du volume.",
      progress: context.bookmakerApplied ? 1 : 0,
      target: 1,
      reward: { money: 10000 },
    });
    missions.push({
      id: "bookmaker_weekly_volume",
      universe: "bookmaker",
      cadence: "weekly",
      category: "prestige",
      code: "WEEK RÉSEAU",
      title: context.bookmakerApproved ? "OUVRE TON RÉSEAU" : "OBTIENS TON ACCÈS RÉSEAU",
      description: context.bookmakerApproved ? "Ton accès est validé. Fais entrer tes premiers joueurs et installe le volume." : "Le staff doit valider ton accès avant que ton réseau rapporte.",
      progress: context.bookmakerApproved ? Math.max(1, Number(context.openedBookmaker || 0)) : 0,
      target: 1,
      reward: { prestige: 12 },
    });
  }

  return missions;
}

export function getPrimaryMission(context: CoachContext): MissionCard {
  const missions = buildMissionStack(context);
  return missions[0] || {
    id: "default",
    universe: "global",
    cadence: "progression",
    category: "action",
    code: "MISSION",
    title: "BOUGE",
    description: "Le Hen House ne récompense pas les spectateurs.",
    progress: 0,
    target: 1,
  };
}

export function getCoachMessage(context: CoachContext | null | undefined): CoachMessage | null {
  if (!context) return null;
  const verification = upper(context.verificationStatus || "PENDING");
  const wallet = Number(context.wallet || 0);

  if (!context.hasProfile || verification !== "VERIFIED") {
    return {
      id: "identity_required",
      role: context.role,
      type: "warning",
      mode: "scene",
      scene: "identity",
      text:
        context.role === "fight"
          ? "Sans identité validée,\nl'arène reste fermée."
          : context.role === "bet"
            ? "Sans identité validée,\naucune table ne t'ouvre."
            : "Sans identité validée,\nton réseau ne vaut rien.",
      cta: "OUVRIR MON DOSSIER",
      target: "Profile",
      priority: 100,
    };
  }

  if (wallet <= 0) {
    return {
      id: "wallet_required",
      role: context.role,
      type: "mission",
      mode: "scene",
      scene: "wallet",
      text:
        context.role === "fight"
          ? "Passe voir la vieille.\nSans cash,\nle ring ne te voit pas."
          : context.role === "bet"
            ? "Pas de bankroll.\nPas de ticket.\nVa charger ton compte."
            : "Active ton wallet.\nSans cash,\nton réseau dort.",
      cta: "OUVRIR LE WALLET",
      target: "Wallet",
      priority: 90,
    };
  }

  if (context.role === "bookmaker" && !context.bookmakerApproved) {
    return {
      id: "bookmaker_pending",
      role: context.role,
      type: "warning",
      mode: "scene",
      scene: "bookmaker",
      text: "Ton accès réseau attend.\nFais ta demande.\nPuis reviens.",
      cta: "OUVRIR RÉSEAU",
      target: "BookmakerHome",
      priority: 80,
    };
  }

  if (context.activeMissionText) {
    return {
      id: "active_mission",
      role: context.role,
      type: "mission",
      mode: "portrait",
      scene: "default",
      text: String(context.activeMissionText),
      priority: 60,
    };
  }

  return {
    id: "default_hype",
    role: context.role,
    type: "hype",
    mode: "portrait",
    scene: "default",
    text:
      context.role === "fight"
        ? "Le ring t'attend.\nEnchaîne les victoires.\nPrends ton rang."
        : context.role === "bet"
          ? "Lis juste.\nJoue froid.\nEncaisse lourd."
          : "Chaque joueur compte.\nChaque entrée rapporte.\nFais vivre ton réseau.",
    priority: 10,
  };
}

export function getMissionProgressText(mission: MissionCard) {
  return `${ratio(mission.progress, mission.target)}%`;
}

export function getStartCoachMessage(step: StartCoachStep, role: CoachRole, coachName?: string): CoachMessage | null {
  const text = shortVoice(step, role, coachName);
  if (!text) return null;

  let type: CoachMessage["type"] = "intro";
  if (step === "world" || step === "rule") type = "warning";
  if (step === "identity" || step === "wallet") type = "mission";

  return {
    id: `start_${step}_${upper(coachName || role)}`,
    role,
    type,
    mode: "portrait",
    scene: "default",
    text,
    priority: 100,
  };
}

// HHFC FINAL COACH ENGINE RULES
// - per-user coach state isolation
// - no global runtime coach cache
// - deterministic coach responses
// - production-safe overlay flow
