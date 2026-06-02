import React, { useContext, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppContext } from "../App";
import { fetchDoorTickets, staffValidateArenaTicket } from "../services/hhApi";

function upper(v: any) { return String(v || "").toUpperCase(); }
function formatDate(value?: string | null) { try { return value ? new Date(value).toLocaleString("fr-FR") : "NON SCANNÉ"; } catch { return "NON SCANNÉ"; } }
function normalizeTicket(row: any) {
  const checkedInAt = row?.checked_in_at || null;
  const rawStatus = upper(row?.status || "");
  let uiStatus = "OPEN";

  if (checkedInAt) uiStatus = "USED";
  else if (rawStatus === "PAID") uiStatus = "OPEN";
  else if (rawStatus) uiStatus = rawStatus;

  const title = row?.title || row?.event_title || "ARENA ACCESS";
  return {
    ...row,
    id: row?.id,
    title,
    event_title: title,
    checked_in_at: checkedInAt,
    buyer_user_id: row?.buyer_user_id || null,
    ticket_type: upper(row?.ticket_type || "STANDARD"),
    ui_status: uiStatus,
  };
}
function statusColor(status: string) { if (status === "USED") return "#7CFFB2"; if (status === "OPEN") return "#D4AF37"; if (status === "REJECTED" || status === "CANCELLED") return "#FF8B8B"; return "#C7CED8"; }

export default function DoorDashboardScreen({ navigation }: any) {
  const { state } = useContext(AppContext);
  const staffSession = state?.staffSession || null;
  const staffId = staffSession?.staffId || staffSession?.id || null;
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "USED">("OPEN");

  async function loadTickets() {
    try {
      setLoading(true);
      const data = await fetchDoorTickets(100);
      setTickets(Array.isArray(data) ? data.map(normalizeTicket) : []);
    } catch (err: any) { Alert.alert("Erreur", err?.message || "Impossible de charger les tickets."); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (!staffId) { setLoading(false); return; } loadTickets(); }, [staffId]);

  async function validateTicket(ticket: any) {
    if (!staffId) return Alert.alert("Session requise", "Reconnecte-toi côté staff.");
    if (ticket?.checked_in_at) return Alert.alert("Déjà scanné", "Ce billet a déjà été utilisé.");
    try {
      setActingId(String(ticket.id));
      await staffValidateArenaTicket({ ticketId: ticket.id, staffId });
      await loadTickets();
      Alert.alert("Ticket validé", "Le billet a été scanné et marqué comme utilisé.");
    } catch (err: any) {
      Alert.alert("Erreur validation", err?.message === "ARENA_TICKET_ALREADY_USED" ? "Ce billet a déjà été utilisé." : err?.message || "Impossible de valider ce ticket.");
    } finally { setActingId(null); }
  }

  const visibleTickets = useMemo(() => filter === "OPEN" ? tickets.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((r) => !r?.checked_in_at) : filter === "USED" ? tickets.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((r) => !!r?.checked_in_at) : tickets, [tickets, filter]);
  const totalOpen = useMemo(() => tickets.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((r) => !r?.checked_in_at).length, [tickets]);
  const totalUsed = useMemo(() => tickets.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((r) => !!r?.checked_in_at).length, [tickets]);

  function renderTicket({ item }: any) {
    const status = upper(item?.ui_status || "OPEN");
    const busy = actingId === String(item?.id);
    const canValidate = status === "OPEN" && !item?.checked_in_at;
    return <View style={styles.ticketCard}><View style={styles.ticketTopRow}><Text style={styles.ticketId}>{String(item?.buyer?.rp_name || "UNKNOWN")}</Text><Text style={[styles.ticketStatus, { color: statusColor(status) }]}>{status}</Text></View><Text style={styles.ticketInfo}>{String(item?.title || item?.event_title || "ARENA ACCESS")}</Text><Text style={styles.ticketInfo}>ACCÈS : {String(item?.ticket_type || "STANDARD")}</Text><Text style={styles.ticketInfo}>SCAN : {formatDate(item?.checked_in_at)}</Text>{canValidate ? <Pressable style={[styles.validateBtn, busy && styles.disabledBtn]} disabled={busy} onPress={() => Alert.alert("Valider ce billet", "Confirmer le scan et marquer ce ticket comme utilisé ?", [{ text: "Annuler", style: "cancel" }, { text: "Valider", onPress: () => validateTicket(item) }])}>{busy ? <ActivityIndicator color="#08111B" /> : <Text style={styles.validateBtnText}>VALIDER</Text>}</Pressable> : <View style={styles.usedBadge}><Text style={styles.usedBadgeText}>DÉJÀ UTILISÉ</Text></View>}</View>;
  }

  if (!staffId) return <LinearGradient colors={["#07111B", "#0A1623", "#060D16"]} style={styles.container}><View style={styles.Wrap}><Text style={styles.Text}>Session staff requise pour le contrôle porte.</Text><Pressable style={styles.filterBtnActive} onPress={() => navigation?.replace?.("StaffLogin")}><Text style={styles.filterBtnTextActive}>ALLER AU LOGIN</Text></Pressable></View></LinearGradient>;
  if (loading) return <LinearGradient colors={["#07111B", "#0A1623", "#060D16"]} style={styles.container}><View style={styles.Wrap}><ActivityIndicator size="large" color="#D4AF37" /><Text style={styles.Text}>Chargement du contrôle porte...</Text></View></LinearGradient>;

  return (
    <LinearGradient colors={["#07111B", "#0A1623", "#060D16"]} style={styles.container}>
      <View style={styles.header}><Text style={styles.kicker}>HHFC ACCESS CONTROL</Text><Text style={styles.title}>DOOR DASHBOARD</Text><Text style={styles.subtitle}>Écran terrain simple : vérifier le billet, valider, passer au suivant.</Text></View>
      <View style={styles.kpiRow}><View style={styles.kpiCard}><Text style={styles.kpiValue}>{tickets.length}</Text><Text style={styles.kpiLabel}>TOTAL</Text></View><View style={styles.kpiCard}><Text style={styles.kpiValue}>{totalOpen}</Text><Text style={styles.kpiLabel}>OPEN</Text></View><View style={styles.kpiCard}><Text style={styles.kpiValue}>{totalUsed}</Text><Text style={styles.kpiLabel}>USED</Text></View></View>
      <View style={styles.filterRow}>{(["OPEN","USED","ALL"] as const).map((item) => { const active = filter === item; return <Pressable key={item} style={[styles.filterBtn, active && styles.filterBtnActive]} onPress={() => setFilter(item)}><Text style={[styles.filterBtnText, active && styles.filterBtnTextActive]}>{item}</Text></Pressable>; })}</View>
      <FlatList data={visibleTickets} keyExtractor={(item) => String(item?.id)} renderItem={renderTicket} contentContainerStyle={styles.listContent} ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyTitle}>AUCUN TICKET</Text><Text style={styles.emptyText}>Aucun billet trouvé pour ce filtre.</Text></View>} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, Wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }, Text: { color: "#D8E7F3", fontFamily: "Inter", fontSize: 10 }, header: { paddingTop: 68, paddingHorizontal: 18, paddingBottom: 14, gap: 8 }, kicker: { color: "#D4AF37", fontFamily: "Inter", fontSize: 9, letterSpacing: 1.2 }, title: { color: "#FFFFFF", fontFamily: "Bebas", fontSize: 32, textTransform: "uppercase" }, subtitle: { color: "#C6D6E5", fontSize: 14, lineHeight: 21 }, kpiRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 12 }, kpiCard: { flex: 1, borderRadius: 8, paddingVertical: 14, paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center" }, kpiValue: { color: "#FFFFFF", fontFamily: "Bebas", fontSize: 22 }, kpiLabel: { color: "#9DB3C8", fontFamily: "Inter", fontSize: 8, marginTop: 6 }, filterRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 12 }, filterBtn: { minHeight: 40, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#12202E", borderWidth: 1, borderColor: "#294055", alignItems: "center", justifyContent: "center" }, filterBtnActive: { backgroundColor: "#ec4900", borderColor: "#ec4900" }, filterBtnText: { color: "#D9E6F2", fontFamily: "Inter", fontSize: 8 }, filterBtnTextActive: { color: "#FFFFFF" }, listContent: { paddingHorizontal: 18, paddingBottom: 36, gap: 12 }, ticketCard: { borderRadius: 10, padding: 14, backgroundColor: "rgba(11,18,28,0.94)", borderWidth: 1, borderColor: "rgba(212,175,55,0.12)", gap: 8 }, ticketTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "center" }, ticketId: { color: "#FFFFFF", fontFamily: "Bebas", fontSize: 18 }, ticketStatus: { fontFamily: "Inter", fontSize: 8 }, ticketInfo: { color: "#C8D6E4", fontSize: 13 }, validateBtn: { minHeight: 50, borderRadius: 8, backgroundColor: "#D4AF37", alignItems: "center", justifyContent: "center", marginTop: 4 }, validateBtnText: { color: "#07111B", fontFamily: "Bebas", fontSize: 18 }, usedBadge: { minHeight: 40, borderRadius: 8, backgroundColor: "rgba(124,255,178,0.12)", borderWidth: 1, borderColor: "rgba(124,255,178,0.24)", alignItems: "center", justifyContent: "center", marginTop: 4 }, usedBadgeText: { color: "#7CFFB2", fontFamily: "Inter", fontSize: 8 }, emptyCard: { borderRadius: 10, padding: 16, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginTop: 6 }, emptyTitle: { color: "#FFFFFF", fontFamily: "Bebas", fontSize: 24 }, emptyText: { color: "#C4D0DC", fontSize: 13, marginTop: 6 }, disabledBtn: { opacity: 0.55 },
});