import React, { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppContext } from "../App";
import { formatRP } from "../utils/money";
import { fetchRingFights, ringForfeitAbsentFighter, ringForfeitBothAbsent, ringSettleFight, ringStartFight } from "../services/hhApi";

function upper(v: any) { return String(v || "").toUpperCase(); }
function usd(v: any) { return formatRP(Number(v || 0)); }
function when(value?: string | null) { try { return value ? new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "TBA"; } catch { return "TBA"; } }
function statusLabel(v?: string | null) { const s = upper(v); if (s === "SCHEDULED") return "PROGRAMMÉ"; if (s === "LIVE" || s === "STARTED") return "LIVE"; if (s === "FINISHED") return "TERMINÉ"; return s || "—"; }
function tone(v?: string | null) { const s = upper(v); if (s === "FINISHED") return "#7CFFB2"; if (s === "LIVE" || s === "STARTED") return "#FFD35A"; return "#D4AF37"; }

export default function RingDashboardScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const session = state?.staffSession || null;
const __hhBlockedPrefixes = ['', '', '', ''];
  const hasStaffSession = !!session?.token;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fights, setFights] = useState<any[]>([]);
  const [selectedFightId, setSelectedFightId] = useState<string | null>(null);
  const [method, setMethod] = useState<"DECISION" | "KO">("DECISION");
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [koRound, setKoRound] = useState<number>(1);

  async function load() {
    if (!hasStaffSession) { setLoading(false); return; }
    try {
      setLoading(true);
      const rows = await fetchRingFights();
      const safe = Array.isArray(rows) ? rows : [];
      setFights(safe);
      setState((prev: any) => ({ ...prev, ringFights: safe }));
      if (!selectedFightId && safe[0]?.id) setSelectedFightId(String(safe[0].id));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de charger le ring.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [hasStaffSession]);
  const selectedFight = useMemo(() => fights.find((f: any) => String(f?.id) === String(selectedFightId)) || fights[0] || null, [fights, selectedFightId]);
  useEffect(() => { if (selectedFight) setWinnerId(String(selectedFight?.fighter_a_id || selectedFight?.fighter_a || "")); }, [selectedFight?.id]);

  async function handleStartFight() {
    if (!selectedFight?.id) return;
    try {
      setBusy(true);
      await ringStartFight({ token: session?.token, fightId: selectedFight.id });
      await load();
      Alert.alert("Combat lancé", "Le combat est passé en LIVE.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de lancer le combat.");
    } finally { setBusy(false); }
  }

  async function handleAbsent(absentId: string, label: string) {
    if (!selectedFight?.id) return;
    Alert.alert("Forfait", `Confirmer l'absence de ${label} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Valider",
        onPress: async () => {
          try {
            setBusy(true);
            await ringForfeitAbsentFighter({ token: session?.token, fightId: selectedFight.id, absentUserId: absentId });
            await load();
            Alert.alert("Forfait validé", "Le combat a été réglé par forfait.");
          } catch (e: any) {
            Alert.alert("Erreur", e?.message || "Impossible d'appliquer le forfait.");
          } finally { setBusy(false); }
        }
      }
    ]);
  }

  async function handleBothAbsent() {
    if (!selectedFight?.id) return;
    Alert.alert("Double absence", "Confirmer la double absence et annuler sportivement le combat ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Valider",
        onPress: async () => {
          try {
            setBusy(true);
            await ringForfeitBothAbsent({ token: session?.token, fightId: selectedFight.id });
            await load();
            Alert.alert("Double absence validée", "Combat clôturé sans vainqueur.");
          } catch (e: any) {
            Alert.alert("Erreur", e?.message || "Impossible de traiter la double absence.");
          } finally { setBusy(false); }
        }
      }
    ]);
  }

  async function handleSettle() {
    if (!selectedFight?.id || !winnerId) return Alert.alert("Donnée manquante", "Choisis un vainqueur.");
    try {
      setBusy(true);
      await ringSettleFight({
        token: session?.token,
        fightId: selectedFight.id,
        winnerId,
        method,
        koRound: method === "KO" ? koRound : null,
        round1Winner: method === "DECISION" ? winnerId : null,
        round2Winner: method === "DECISION" ? winnerId : null,
        round3Winner: method === "DECISION" ? winnerId : null,
      });
      await load();
      Alert.alert("Résultat validé", "Combat, bets et wallet ont été réglés.");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de valider le résultat.");
    } finally { setBusy(false); }
  }

  if (!hasStaffSession) return <View style={styles.lockWrap}><Text style={styles.lockTitle}>RING SESSION REQUIRED</Text><Text style={styles.lockText}>Connecte-toi côté staff pour accéder au ring dashboard.</Text><Pressable style={styles.lockBtn} onPress={() => navigation.replace("StaffLogin")}><Text style={styles.lockBtnText}>ALLER AU LOGIN</Text></Pressable></View>;
  if (loading) return <View style={styles.Wrap}><ActivityIndicator size="large" color="#D4AF37" /><Text style={styles.Text}>Chargement ring...</Text></View>;

  return (
    <LinearGradient colors={["#05050A", "#090A12", "#040408"]} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}><Text style={styles.heroEyebrow}>HHFC RING</Text><Text style={styles.heroTitle}>CONTROL DASHBOARD</Text><Text style={styles.heroSubtitle}>Start fight, absent fighter, double absence, puis validation du résultat.</Text><Text style={styles.ruleText}>Règle produit : 1 absent = victoire par forfait. 2 absents = combat clôturé sans vainqueur.</Text></View>
        <View style={styles.sectionCard}><Text style={styles.sectionTitle}>COMBATS DISPONIBLES</Text>{fights.length === 0 ? <Text style={styles.emptyText}>Aucun combat programmé ou live.</Text> : fights.map((fight) => <Pressable key={fight.id} style={[styles.fightCard, selectedFightId === fight.id && styles.fightCardActive]} onPress={() => setSelectedFightId(fight.id)}><View style={styles.fightTopRow}><Text style={styles.fightTitle}>{fight.fighter_a_name} VS {fight.fighter_b_name}</Text><Text style={[styles.fightStatus, { color: tone(fight.status) }]}>{statusLabel(fight.status)}</Text></View><Text style={styles.fightMeta}>{when(fight.scheduled_at)}</Text><Text style={styles.fightMeta}>Stake {usd(fight.stake || fight.stake_cents || 0)} • Prize {usd(fight.winner_payout_cents || fight.winner_payout || fight.prize_pool || 0)}</Text>{upper(fight.fight_type) === "TITLE" ? <Text style={styles.titleFightBadge}>TITLE FIGHT</Text> : null}</Pressable>)}</View>
        {selectedFight ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>COMBAT SÉLECTIONNÉ</Text><View style={styles.selectedCard}><Text style={styles.selectedTitle}>{selectedFight.fighter_a_name} VS {selectedFight.fighter_b_name}</Text><Text style={styles.selectedMeta}>Statut : {statusLabel(selectedFight.status)}</Text><Text style={styles.selectedMeta}>Horaire : {when(selectedFight.scheduled_at)}</Text><Text style={styles.selectedMeta}>Type : {upper(selectedFight.fight_type || "STANDARD")}</Text><Text style={styles.selectedMeta}>Stake {usd(selectedFight.stake || selectedFight.stake_cents || 0)} • Prize {usd(selectedFight.winner_payout_cents || selectedFight.winner_payout || selectedFight.prize_pool || 0)}</Text></View><View style={styles.buttonRowWrap}><Pressable style={[styles.actionBtn, busy && styles.disabledBtn]} onPress={handleStartFight} disabled={busy || ["LIVE","STARTED","FINISHED"].includes(upper(selectedFight.status))}><Text style={styles.actionBtnText}>START FIGHT</Text></Pressable><Pressable style={[styles.warnBtn, busy && styles.disabledBtn]} onPress={() => handleAbsent(selectedFight.fighter_a_id, selectedFight.fighter_a_name)} disabled={busy || upper(selectedFight.status) === "FINISHED"}><Text style={styles.actionBtnText}>A ABSENT</Text></Pressable><Pressable style={[styles.warnBtn, busy && styles.disabledBtn]} onPress={() => handleAbsent(selectedFight.fighter_b_id, selectedFight.fighter_b_name)} disabled={busy || upper(selectedFight.status) === "FINISHED"}><Text style={styles.actionBtnText}>B ABSENT</Text></Pressable><Pressable style={[styles.dangerBtn, busy && styles.disabledBtn]} onPress={handleBothAbsent} disabled={busy || upper(selectedFight.status) === "FINISHED"}><Text style={styles.actionBtnText}>BOTH ABSENT</Text></Pressable></View></View> : null}
        {selectedFight ? <View style={styles.sectionCard}><Text style={styles.sectionTitle}>VALIDATION DU RÉSULTAT</Text><View style={styles.methodRow}><Pressable style={[styles.methodBtn, method === "DECISION" && styles.methodBtnActive]} onPress={() => setMethod("DECISION")}><Text style={styles.methodBtnText}>DECISION</Text></Pressable><Pressable style={[styles.methodBtn, method === "KO" && styles.methodBtnActive]} onPress={() => setMethod("KO")}><Text style={styles.methodBtnText}>KO</Text></Pressable></View><Text style={styles.blockLabel}>GAGNANT</Text><View style={styles.methodRow}><Pressable style={[styles.pickBtn, winnerId === selectedFight.fighter_a_id && styles.pickBtnActive]} onPress={() => setWinnerId(selectedFight.fighter_a_id)}><Text style={styles.pickBtnText}>{selectedFight.fighter_a_name}</Text></Pressable><Pressable style={[styles.pickBtn, winnerId === selectedFight.fighter_b_id && styles.pickBtnActive]} onPress={() => setWinnerId(selectedFight.fighter_b_id)}><Text style={styles.pickBtnText}>{selectedFight.fighter_b_name}</Text></Pressable></View>{method === "KO" ? <View style={styles.koWrap}><Text style={styles.blockLabel}>ROUND DU KO</Text><View style={styles.methodRow}>{[1,2,3].map((round) => <Pressable key={round} style={[styles.pickBtnSmall, koRound === round && styles.pickBtnActive]} onPress={() => setKoRound(round)}><Text style={styles.pickBtnText}>R{round}</Text></Pressable>)}</View></View> : null}<Pressable style={[styles.validateBtn, busy && styles.disabledBtn]} onPress={handleSettle} disabled={busy || upper(selectedFight.status) === "FINISHED"}><Text style={styles.validateBtnText}>{busy ? "VALIDATION..." : "VALIDER LE RÉSULTAT"}</Text></Pressable></View> : null}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 20, gap: 14, paddingBottom: 40 }, Wrap: { flex: 1, backgroundColor: "#08111B", justifyContent: "center", alignItems: "center", gap: 10 }, Text: { color: "#BFD0E0" }, lockWrap: { flex: 1, backgroundColor: "#08111B", justifyContent: "center", padding: 20, gap: 12 }, lockTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" }, lockText: { color: "#BFD0E0", lineHeight: 20 }, lockBtn: { backgroundColor: "#ec4900", borderRadius: 8, paddingVertical: 14, alignItems: "center" }, lockBtnText: { color: "#FFFFFF", fontWeight: "900" }, heroCard: { backgroundColor: "rgba(255,122,0,0.08)", borderWidth: 1, borderColor: "rgba(255,122,0,0.22)", borderRadius: 10, padding: 18, gap: 10 }, heroEyebrow: { color: "#FF7A00", fontWeight: "900", fontSize: 12, letterSpacing: 1.5 }, heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" }, heroSubtitle: { color: "#D7E2EC", lineHeight: 20 }, ruleText: { color: "#FFCF9C", lineHeight: 20, fontSize: 13 }, sectionCard: { backgroundColor: "#12202E", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#23384D", gap: 10 }, sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }, emptyText: { color: "#8DA5BE" }, fightCard: { backgroundColor: "#0D1824", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#24394F", gap: 6 }, fightCardActive: { borderColor: "#FF7A00", backgroundColor: "#1A1210" }, fightTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 }, fightTitle: { flex: 1, color: "#FFFFFF", fontSize: 15, fontWeight: "900" }, fightStatus: { fontWeight: "900", fontSize: 12 }, fightMeta: { color: "#AFC4D8", fontSize: 13 }, titleFightBadge: { color: "#FFD35A", fontWeight: "900", fontSize: 12, marginTop: 2 }, selectedCard: { backgroundColor: "#0D1824", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#24394F", gap: 4 }, selectedTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" }, selectedMeta: { color: "#AFC4D8", fontSize: 13 }, buttonRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, actionBtn: { minWidth: 120, backgroundColor: "#345A7A", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" }, warnBtn: { minWidth: 110, backgroundColor: "#8A5B1B", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" }, dangerBtn: { minWidth: 120, backgroundColor: "#7A1E1E", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" }, actionBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 }, disabledBtn: { opacity: 0.55 }, methodRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" }, methodBtn: { flex: 1, backgroundColor: "#162434", borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#27415A" }, methodBtnActive: { backgroundColor: "#ec4900", borderColor: "#ec4900" }, methodBtnText: { color: "#FFFFFF", fontWeight: "800" }, blockLabel: { color: "#AFC4D8", fontWeight: "800", fontSize: 13 }, pickBtn: { flex: 1, minWidth: 130, backgroundColor: "#162434", borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#27415A" }, pickBtnSmall: { minWidth: 70, backgroundColor: "#162434", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: "#27415A" }, pickBtnActive: { backgroundColor: "#ec4900", borderColor: "#ec4900" }, pickBtnText: { color: "#FFFFFF", fontWeight: "800" }, koWrap: { gap: 10 }, validateBtn: { backgroundColor: "#1E6A39", borderRadius: 8, paddingVertical: 15, alignItems: "center", marginTop: 4 }, validateBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
});