import React, { useContext, useEffect, useMemo, useState } from "react";
import { Image, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppContext } from "../App";
import { fetchAllNotifications, fetchMissionFlags, fetchTop50, normalizeVerificationStatus, syncMissionFlags } from "../services/hhApi";
import { getHomeMissionBundle } from "../systems/missions/missionEngine";
import { playSound } from "../services/sound";
import { blockedRoleMessage, resolveActiveRole } from "../utils/access";
import HHFCRankCard from "../components/HHFCRankCard";

const BG = require("../assets/hub/hen_house_main.png");
const ROLE_ART = {
  fighter: require("../assets/univers/fight.png"),
  bettor: require("../assets/univers/bet.png"),
  bookmaker: require("../assets/univers/bookmaker.png"),
} as const;

type RoleKey = "fighter" | "bettor" | "bookmaker";
type CoachGender = "male" | "female";

function upper(value: any) { return String(value || "").trim().toUpperCase(); }
function money(value: any) { return "$" + Number(value || 0).toLocaleString("fr-FR"); }
function roleLabel(role: RoleKey) { return role === "bettor" ? "BETTOR" : role === "bookmaker" ? "BOOKMAKER" : "FIGHTER"; }
function roleAccent(role: RoleKey) { return role === "bettor" ? "#D7B348" : role === "bookmaker" ? "#8D71FF" : "#FF5D4A"; }
function fallbackCoachName(role: RoleKey, gender: CoachGender) {
  if (role === "fighter") return gender === "female" ? "NYX" : "KLYDE";
  if (role === "bettor") return gender === "female" ? "MARIA" : "MILO";
  return gender === "female" ? "SCAR" : "RAZOR";
}
function coachBelongsToRole(role: RoleKey, coachName: any) {
  const name = upper(coachName);
  if (role === "fighter") return ["KLYDE", "NYX"].includes(name);
  if (role === "bettor") return ["MILO", "MARIA"].includes(name);
  return ["RAZOR", "SCAR"].includes(name);
}
function gateFor(screen: string, role: RoleKey, verification: string, walletBalance: number, walletBonusBalance: number) {
  const spendable = walletBalance + walletBonusBalance;
  const roleBlock = blockedRoleMessage(role, screen);
  if (roleBlock) return { blocked: true, title: "PORTE VERROUILLÉE", body: roleBlock, cta: "RETOUR", target: "Home" };
  if (screen === "Fight" && verification !== "VERIFIED") return { blocked: true, title: "ACCÈS BLOQUÉ", body: "Validation requise. Termine ton dossier avant d'entrer dans la cage.", cta: "OUVRIR PROFILE", target: "Profile" };
  if (screen === "Bet" && spendable <= 0) return { blocked: true, title: "BANKROLL NULLE", body: "Active ton wallet avant de poser un ticket.", cta: "OUVRIR WALLET", target: "Wallet" };
  return { blocked: false };
}

export default function HomeScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const profile = state?.profile || {};
  const wallet = state?.wallet || {};
  const userId = state?.supaUserId || profile?.id || null;
  const [refreshing, setRefreshing] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState<any[]>(Array.isArray(state?.leaderboard) ? state.leaderboard : []);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lockInfo, setLockInfo] = useState<any>(null);
  const [missionCompleteVisible, setMissionCompleteVisible] = useState(false);
  const [fighterCardOpen, setFighterCardOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchMissionFlags(userId).then((flags) => setState((prev: any) => ({ ...prev, missionFlags: { ...(prev?.missionFlags || {}), ...(flags || {}) } }))).catch(() => null);
  }, [userId, setState]);

  useEffect(() => {
    if (!userId || !state?.missionFlags) return;
    syncMissionFlags(userId, state.missionFlags).catch(() => null);
  }, [userId, state?.missionFlags]);

  async function refreshHome() {
    if (!userId) return;
    try {
      setRefreshing(true);
      const [rows, topRows] = await Promise.all([fetchAllNotifications(userId, 30).catch(() => []), fetchTop50().catch(() => [])]);
      const safeRows = Array.isArray(rows) ? rows : [];
      const safeTop = Array.isArray(topRows) ? topRows : [];
      setUnreadCount(safeRows.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((row: any) => !row?.is_read).length);
      setLeaderboardRows(safeTop);
      setState((prev: any) => ({ ...prev, notifications: safeRows, leaderboard: safeTop }));
    } finally { setRefreshing(false); }
  }
  useEffect(() => { refreshHome(); }, [userId]);

  const role = resolveActiveRole(state, profile?.role) as RoleKey;
  const verification = normalizeVerificationStatus(profile?.verification_status || "PENDING");
  const walletBalance = Number(wallet?.wallet_balance ?? profile?.wallet_balance ?? 0);
  const walletBonusBalance = Number(wallet?.wallet_bonus_balance ?? profile?.wallet_bonus_balance ?? 0);
  const walletLockedBalance = Number(wallet?.wallet_locked_balance ?? profile?.wallet_locked_balance ?? 0);

  const leaderboardRank = useMemo(() => {
    const name = upper(profile?.rp_name);
    const match = leaderboardRows.find((row: any) => upper(row?.rp_name || row?.display_name || row?.name) === name);
    return match?.rank || null;
  }, [leaderboardRows, profile?.rp_name]);

  const leaderboardSelf = useMemo(() => {
    const name = upper(profile?.rp_name);
    return leaderboardRows.find((row: any) => upper(row?.rp_name || row?.display_name || row?.name) === name) || null;
  }, [leaderboardRows, profile?.rp_name]);

  const missionBundle = getHomeMissionBundle({ role: role as any, verificationStatus: verification, walletBalance, walletBonusBalance, walletLockedBalance, wins: Number(profile?.wins || 0), losses: Number(profile?.losses || 0), leaderboardRank, missionFlags: state?.missionFlags || {} });
  const mission = missionBundle.primary;
  const accent = roleAccent(role);
  const coachGender = ((state?.preopen?.selectedCoachGender || "male") === "female" ? "female" : "male") as CoachGender;
  const rawCoachName = String(state?.preopen?.selectedCoachName || state?.selectedCoachName || "").trim().toUpperCase();
  const coachName = coachBelongsToRole(role, rawCoachName) ? rawCoachName : fallbackCoachName(role, coachGender);
  const bookmakerOwnCode = upper(profile?.bookmaker_code);
  const affiliateCode = upper(profile?.referred_by_bookmaker_code || state?.preopen?.bookmakerCode);
  const coachMessage = missionBundle.coachLine || "Reste mobile. Termine ta mission puis reviens au hub.";
  const roleArt = ROLE_ART[role];
  const streak = Number(state?.missionFlags?.loginStreak || profile?.login_streak || 1);
  const wins = Number(profile?.wins || 0);
  const losses = Number(profile?.losses || 0);
  const missionAckKey = `ack_${mission.id}`;
  const missionAlreadyAcked = !!state?.missionFlags?.[missionAckKey];

  useEffect(() => { if (mission.completed && !missionAlreadyAcked) setMissionCompleteVisible(true); }, [mission.completed, missionAlreadyAcked, mission.id]);

  const shortcuts = [
    { label: "FIGHT", sub: "entrer dans la cage", screen: "Fight", accent: "#FF5D4A" },
    { label: "BET", sub: "parier sur les combats", screen: "Bet", accent: "#D7B348" },
    { label: "BOOKMAKER", sub: "construire ton réseau", screen: "BookmakerHome", accent: "#8D71FF" },
    { label: "ARENA", sub: "soirées et billets", screen: "Arena", accent: "#90c8ff" },
    ...(role === "fighter" ? [{ label: "PLANNER", sub: "poser un créneau", screen: "FightPlanner", accent: "#FF8A4A" }] : []),
  ];

  function go(screen: string) {
    const gate = gateFor(screen, role, verification, walletBalance, walletBonusBalance);
    if (gate.blocked) { setLockInfo(gate); playSound?.("tap"); return; }
    const nextFlags = { ...(state?.missionFlags || {}) } as any;
    if (screen === "BookmakerHome") nextFlags.openedBookmaker = true;
    if (screen === "Bet") nextFlags.viewedBet = true;
    if (screen === "Fight") nextFlags.viewedFight = true;
    if (screen === "Arena") nextFlags.viewedArena = true;
    if (screen === "Wallet") nextFlags.viewedWallet = true;
    setState((prev: any) => ({ ...prev, missionFlags: nextFlags }));
    playSound?.("confirm");
    navigation.navigate(screen);
  }

  function acknowledgeMission() {
    setMissionCompleteVisible(false);
    setState((prev: any) => ({ ...prev, missionFlags: { ...(prev?.missionFlags || {}), [missionAckKey]: true } }));
  }

  return (
    <ImageBackground source={BG} style={styles.container} imageStyle={styles.bgImage}>
      <View style={styles.backdrop} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshHome} tintColor="#fff" />}>
        <View style={styles.topBar}>
          <View><Text style={styles.brand}>HEN HOUSE</Text><Text style={styles.brandSub}>DIAMOND FIGHT CLUB</Text></View>
          <View style={styles.topActions}>
            <Pressable style={styles.topCounter} onPress={() => go("Notifications")}><Text style={styles.topCounterValue}>{unreadCount > 0 ? unreadCount : 0}</Text><Text style={styles.topCounterLabel}>alertes</Text></Pressable>
            <Pressable style={styles.profileBtn} onPress={() => navigation.navigate("Profile")}><Text style={styles.profileBtnText}>PROFILE</Text></Pressable>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Image source={roleArt} style={styles.heroArt} resizeMode="cover" />
          <View style={styles.heroShade} />
          <View style={styles.heroContent}>
            <View style={styles.heroTopRow}>
              <View style={[styles.rolePill, { borderColor: accent }]}><Text style={[styles.rolePillText, { color: accent }]}>{roleLabel(role)}</Text></View>
              <Pressable style={styles.walletMini} onPress={() => go("Wallet")}><Text style={styles.walletMiniLabel}>WALLET</Text><Text style={styles.walletMiniValue}>{money(walletBalance)}</Text></Pressable>
            </View>
            <View style={styles.heroMainRow}>
              <View style={styles.heroIdentity}>
                <Text style={styles.playerName}>{upper(profile?.rp_name || "JOUEUR")}</Text>
                <Text style={styles.heroMeta}>{verification} • {leaderboardRank ? `RANG #${leaderboardRank}` : "NON CLASSÉ"}</Text>
              </View>
              {role === "fighter" ? (
                <Pressable style={styles.heroMiniCardWrap} onPress={() => setFighterCardOpen(true)}>
                  <HHFCRankCard
                    variant="homeMini"
                    name={profile?.rp_name || "FIGHTER"}
                    mmr={Number(leaderboardSelf?.mmr || profile?.mmr || 1000)}
                    wins={Number(leaderboardSelf?.wins || profile?.wins || 0)}
                    losses={Number(leaderboardSelf?.losses || profile?.losses || 0)}
                    koWins={Number(leaderboardSelf?.ko_wins || profile?.ko_wins || 0)}
                    rank={leaderboardRank}
                    avatarUrl={profile?.public_avatar_url || null}
                  />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatBox}><Text style={styles.heroStatLabel}>WINS</Text><Text style={styles.heroStatValue}>{wins}</Text></View>
              <View style={styles.heroStatBox}><Text style={styles.heroStatLabel}>LOSSES</Text><Text style={styles.heroStatValue}>{losses}</Text></View>
              <View style={styles.heroStatBox}><Text style={styles.heroStatLabel}>STREAK</Text><Text style={styles.heroStatValue}>{streak}</Text></View>
              <View style={styles.heroStatBox}><Text style={styles.heroStatLabel}>LOCK</Text><Text style={styles.heroStatValue}>{money(walletLockedBalance)}</Text></View>
            </View>
          </View>
        </View>

        {(bookmakerOwnCode || affiliateCode || role === "bettor" || role === "bookmaker") ? (
          <View style={styles.bookmakerCodeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookmakerCodeKicker}>{role === "bookmaker" ? "TON CODE BOOKMAKER" : "AFFILIATION BOOKMAKER"}</Text>
              <Text style={styles.bookmakerCodeValue}>{role === "bookmaker" ? (bookmakerOwnCode || "CODE EN ATTENTE") : (affiliateCode || "AUCUN CODE")}</Text>
              <Text style={styles.bookmakerCodeSub}>{role === "bookmaker" ? "C’est le code à donner aux joueurs que tu recrutes." : "Entre ou vérifie le code affilié depuis ton profil avant de déposer ou parier."}</Text>
            </View>
            <Pressable style={styles.bookmakerCodeBtn} onPress={() => navigation.navigate(role === "bookmaker" ? "BookmakerHome" : "Profile")}>
              <Text style={styles.bookmakerCodeBtnText}>{role === "bookmaker" ? "RÉSEAU" : "MODIFIER"}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.missionCard}>
          <View style={styles.missionHead}><Text style={styles.missionKicker}>MISSION ACTIVE</Text><Text style={styles.missionReward}>{upper(mission.rewardSummary || "RÉCOMPENSE EN ATTENTE")}</Text></View>
          <Text style={styles.missionTitle}>{upper(mission.title)}</Text>
          <Text style={styles.missionDesc}>{mission.description}</Text>
          <View style={styles.coachInlineCard}><Text style={styles.coachInlineLabel}>{coachName}</Text><Text style={styles.coachInlineText}>{coachMessage}</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { backgroundColor: accent, width: `${Math.max(8, Math.min(100, (mission.progress / Math.max(1, mission.progressTarget)) * 100))}%` }]} /></View>
          <Text style={styles.progressText}>{mission.progress}/{mission.progressTarget}</Text>
          <Pressable style={[styles.ctaBtn, { backgroundColor: accent }]} onPress={() => go(mission.targetScreen)}><Text style={styles.ctaBtnText}>{upper(mission.cta)}</Text></Pressable>
        </View>

        <View style={styles.sectionHead}><Text style={styles.sectionTitle}>PORTES DU JEU</Text>{!!missionBundle.weeklyLabel ? <Text style={styles.sectionMeta}>{missionBundle.weeklyLabel}</Text> : null}</View>
        <View style={styles.shortcutColumn}>
          {shortcuts.map((item) => {
            const gate = gateFor(item.screen, role, verification, walletBalance, walletBonusBalance);
            return (
              <Pressable key={item.label} style={styles.shortcutCard} onPress={() => go(item.screen)}>
                <View style={[styles.shortcutBar, { backgroundColor: item.accent }]} />
                <View style={{ flex: 1 }}><Text style={styles.shortcutTitle}>{item.label}</Text><Text style={styles.shortcutSub}>{upper(item.sub)}</Text></View>
                <Text style={[styles.shortcutArrow, gate.blocked && styles.shortcutLocked]}>{gate.blocked ? "BLOQUÉ" : "ENTRER"}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.identityCard}>
          <View style={styles.identityHeader}><Text style={styles.identityTitle}>IDENTITÉ ARENA</Text><Pressable onPress={() => navigation.navigate("Leaderboard")}><Text style={styles.identityLink}>VOIR LE TOP 20</Text></Pressable></View>
          <View style={styles.identityGrid}>
            <View style={styles.identityTile}><Text style={styles.identityLabel}>STATUT</Text><Text style={styles.identityValue}>{verification}</Text></View>
            <View style={styles.identityTile}><Text style={styles.identityLabel}>RANG</Text><Text style={styles.identityValue}>{leaderboardRank ? `#${leaderboardRank}` : "—"}</Text></View>
            <View style={styles.identityTile}><Text style={styles.identityLabel}>COACH</Text><Text style={styles.identityValue}>{coachName}</Text></View>
            <View style={styles.identityTile}><Text style={styles.identityLabel}>BONUS</Text><Text style={styles.identityValue}>{money(walletBonusBalance)}</Text></View>
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!lockInfo} transparent animationType="fade" onRequestClose={() => setLockInfo(null)}>
        <View style={styles.modalWrap}><View style={styles.modalCard}><Text style={styles.modalTitle}>{lockInfo?.title}</Text><Text style={styles.modalBody}>{lockInfo?.body}</Text><View style={styles.modalButtons}><Pressable style={styles.modalGhost} onPress={() => setLockInfo(null)}><Text style={styles.modalGhostText}>FERMER</Text></Pressable><Pressable style={styles.modalPrimary} onPress={() => { const target = lockInfo?.target; setLockInfo(null); if (target && target !== "Home") navigation.navigate(target); }}><Text style={styles.modalPrimaryText}>{lockInfo?.cta || "OK"}</Text></Pressable></View></View></View>
      </Modal>

      <Modal visible={fighterCardOpen} transparent animationType="fade" onRequestClose={() => setFighterCardOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.bigCardModal}>
            <HHFCRankCard
              variant="home"
              name={profile?.rp_name || "FIGHTER"}
              mmr={Number(leaderboardSelf?.mmr || profile?.mmr || 1000)}
              wins={Number(leaderboardSelf?.wins || profile?.wins || 0)}
              losses={Number(leaderboardSelf?.losses || profile?.losses || 0)}
              koWins={Number(leaderboardSelf?.ko_wins || profile?.ko_wins || 0)}
              rank={leaderboardRank}
              avatarUrl={profile?.public_avatar_url || null}
              footerNote="SUIVI FIGHTER"
            />
            <Pressable style={styles.modalGhost} onPress={() => setFighterCardOpen(false)}><Text style={styles.modalGhostText}>FERMER</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={missionCompleteVisible} transparent animationType="fade" onRequestClose={acknowledgeMission}>
        <View style={styles.modalWrap}><View style={styles.rewardCard}><Text style={styles.rewardKicker}>MISSION VALIDÉE</Text><Text style={styles.rewardTitle}>{upper(mission.title)}</Text><Text style={styles.rewardBody}>{upper(mission.rewardSummary || "RÉCOMPENSE DÉBLOQUÉE")}</Text><Text style={styles.rewardCoach}>{coachName} · Bien. Tu avances. La suite t'attend.</Text><Pressable style={styles.rewardBtn} onPress={acknowledgeMission}><Text style={styles.rewardBtnText}>CONTINUER</Text></Pressable></View></View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020306" }, bgImage: { resizeMode: "cover" }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(6,8,13,0.76)" }, content: { padding: 16, paddingTop: 16, paddingBottom: 28, gap: 14 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, brand: { color: "#FFF", fontFamily: "Bebas", fontSize: 34, letterSpacing: 2 }, brandSub: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.2, marginTop: -4 }, topActions: { flexDirection: "row", gap: 8, alignItems: "center" }, topCounter: { minWidth: 62, minHeight: 52, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, topCounterValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 24 }, topCounterLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "700", fontSize: 10 }, profileBtn: { minHeight: 52, borderRadius: 14, paddingHorizontal: 16, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }, profileBtnText: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },
  heroCard: { borderRadius: 26, overflow: "hidden", minHeight: 270, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "#0b0d13" }, heroArt: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" }, heroContent: { flex: 1, justifyContent: "space-between", padding: 18 }, heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }, heroMainRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 }, heroIdentity: { flex: 1, minWidth: 0 }, heroMiniCardWrap: { width: 112, alignSelf: "center" }, bigCardModal: { width: "100%", maxWidth: 390, gap: 14 }, rolePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(0,0,0,0.35)" }, rolePillText: { fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.1 }, walletMini: { minWidth: 98, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(8,10,15,0.68)", alignItems: "flex-end" }, walletMiniLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "700", fontSize: 10 }, walletMiniValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 24, marginTop: 4 }, playerName: { color: "#FFF", fontFamily: "Bebas", fontSize: 38, letterSpacing: 1.4 }, heroMeta: { color: "#E2E8F2", fontFamily: "Inter", fontWeight: "800", fontSize: 12, letterSpacing: 0.6 }, heroStatsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" }, heroStatBox: { minWidth: "22%", borderRadius: 16, padding: 10, backgroundColor: "rgba(7,10,14,0.68)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, heroStatLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "700", fontSize: 10 }, heroStatValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 24, marginTop: 4 },
  missionCard: { borderRadius: 24, padding: 16, backgroundColor: "rgba(10,12,18,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 10 }, missionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, missionKicker: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.6 }, missionReward: { color: "#E6EBF5", fontFamily: "Inter", fontWeight: "800", fontSize: 10, flexShrink: 1, textAlign: "right" }, missionTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 30 }, missionDesc: { color: "#D7DFEB", fontFamily: "Inter", fontSize: 14, lineHeight: 20 }, coachInlineCard: { borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, coachInlineLabel: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.1 }, coachInlineText: { color: "#C9D3E1", fontFamily: "Inter", fontSize: 13, lineHeight: 19, marginTop: 6 }, progressTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }, progressFill: { height: 10, borderRadius: 999 }, progressText: { color: "#C9D3E1", fontFamily: "Inter", fontWeight: "800", fontSize: 12, textAlign: "right" }, ctaBtn: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" }, ctaBtnText: { color: "#111", fontFamily: "Inter", fontWeight: "900", fontSize: 13, letterSpacing: 0.9 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, sectionTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 28 }, sectionMeta: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "800", fontSize: 11 }, shortcutColumn: { gap: 10 }, shortcutCard: { minHeight: 78, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "rgba(10,12,18,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, shortcutBar: { width: 4, alignSelf: "stretch", borderRadius: 999 }, shortcutTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 28 }, shortcutSub: { color: "#B8C1CE", fontFamily: "Inter", fontWeight: "700", fontSize: 11, letterSpacing: 0.5 }, shortcutArrow: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 0.8 }, shortcutLocked: { color: "#A7AFBE" },
  identityCard: { borderRadius: 24, padding: 16, backgroundColor: "rgba(10,12,18,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", gap: 12 }, identityHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, identityTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 28 }, identityLink: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 0.8 }, identityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, identityTile: { width: "48%", borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, identityLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "700", fontSize: 10 }, identityValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 24, marginTop: 4 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 22 }, modalCard: { width: "100%", maxWidth: 380, borderRadius: 24, padding: 18, gap: 12, backgroundColor: "rgba(10,12,18,0.98)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, modalTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 30 }, modalBody: { color: "#D7DFEB", fontFamily: "Inter", fontSize: 14, lineHeight: 21 }, modalButtons: { flexDirection: "row", gap: 10 }, modalGhost: { flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" }, modalGhostText: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 12 }, modalPrimary: { flex: 1, minHeight: 52, borderRadius: 16, backgroundColor: "#D4AF37", alignItems: "center", justifyContent: "center" }, modalPrimaryText: { color: "#111", fontFamily: "Inter", fontWeight: "900", fontSize: 12 }, rewardCard: { width: "100%", maxWidth: 380, borderRadius: 26, padding: 20, gap: 12, backgroundColor: "rgba(13,12,19,0.98)", borderWidth: 1, borderColor: "rgba(212,175,55,0.35)" }, rewardKicker: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.7 }, rewardTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 34 }, rewardBody: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 14, lineHeight: 20 }, rewardCoach: { color: "#C9D3E1", fontFamily: "Inter", fontSize: 13, lineHeight: 19 }, rewardBtn: { minHeight: 54, borderRadius: 16, backgroundColor: "#D4AF37", alignItems: "center", justifyContent: "center", marginTop: 4 }, rewardBtnText: { color: "#111", fontFamily: "Inter", fontWeight: "900", fontSize: 13, letterSpacing: 0.8 },
});
