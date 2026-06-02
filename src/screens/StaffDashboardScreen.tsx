// HHFC RELEASE CANDIDATE FINAL
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppContext } from "../App";
import {
  fetchPendingBookmakerApplications,
  fetchStaffFinanceNotifications,
  staffApproveBookmakerApplication,
  staffApproveProfileVerification,
  staffListPendingProfileVerifications,
  staffRejectBookmakerApplication,
  staffRejectProfileVerification,
} from "../services/hhApi";

const COLORS = {
  bg: "#0A0A0F",
  panel: "#111827",
  card: "#0F172A",
  border: "#1F2937",
  text: "#FFFFFF",
  muted: "#9CA3AF",
  subtle: "#6B7280",
  accent: "#D4AF37",
  success: "#39FF14",
  danger: "#FF4D4D",
  warning: "#FFD166",
};

function upper(v: any) { return String(v || "").toUpperCase(); }
function roleColor(role?: string) { const r = upper(role); if (r.includes("OWNER")) return COLORS.warning; if (r.includes("DIRECTION")) return COLORS.success; if (r.includes("FINANCE")) return COLORS.accent; if (r.includes("RING")) return COLORS.danger; return COLORS.text; }
function proofUrl(row: any) { return String(row?.proof_image_url || row?.user?.id_card_image_url || "").trim(); }
function canAccess(role: string, target: string) { const r = upper(role); if (["OWNER","ADMIN","DIRECTION"].includes(r)) return true; if (r === "FINANCE") return ["FinanceDashboard","FinanceDay","FinanceJournal"].includes(target); if (r === "DOOR") return ["DoorDashboard"].includes(target); if (r === "RING") return ["RingDashboard"].includes(target); return target === "StaffDashboard"; }

export default function StaffDashboardScreen({ navigation }: any) {
  const { state } = useContext(AppContext);
  const session = state?.staffSession || null;
  const staffName = session?.staffName || session?.name || "STAFF";
  const staffRole = session?.role || "OPERATOR";
  const hasToken = !!session?.token;
  const staffId = session?.staffId || session?.id || null;
  const [kycRows, setKycRows] = useState<any[]>([]);
  const [kyc, setKyc] = useState(false);
  const [actingKycId, setActingKycId] = useState<string | null>(null);
  const [financeAlerts, setFinanceAlerts] = useState<any[]>([]);
  const [finance, setFinance] = useState(false);
  const [bookmakerRows, setBookmakerRows] = useState<any[]>([]);
  const [bookmaker, setBookmaker] = useState(false);
  const [actingBookmakerId, setActingBookmakerId] = useState<string | null>(null);

  const modules = useMemo(() => [
    { title: "DOOR DASHBOARD", subtitle: "Contrôle billets et accès", target: "DoorDashboard" },
    { title: "RING DASHBOARD", subtitle: "Combats, absences, validation", target: "RingDashboard" },
    { title: "FINANCE DASHBOARD", subtitle: "Dépôts, retraits, alertes", target: "FinanceDashboard" },
    { title: "FINANCE DAY", subtitle: "Vue du jour et clôture", target: "FinanceDay" },
    { title: "FINANCE JOURNAL", subtitle: "Écritures et contrôle", target: "FinanceJournal" },
    { title: "ADMIN SCHEDULE", subtitle: "Règles et génération des slots", target: "AdminSchedule" },
  ].filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((m) => canAccess(staffRole, m.target)), [staffRole]);

  async function loadKycQueue() {
    try { setKyc(true); const rows = await staffListPendingProfileVerifications(); setKycRows(Array.isArray(rows) ? rows.slice(0, 6) : []); }
    catch (e: any) { Alert.alert("Erreur", e?.message || "Impossible de charger la file KYC."); }
    finally { setKyc(false); }
  }
  async function loadBookmakerQueue() {
    try { setBookmaker(true); const rows = await fetchPendingBookmakerApplications(); setBookmakerRows(Array.isArray(rows) ? rows.slice(0, 6) : []); }
    catch (e: any) { Alert.alert("Erreur", e?.message || "Impossible de charger les candidatures bookmaker."); }
    finally { setBookmaker(false); }
  }
  async function loadFinanceAlerts() {
    try { setFinance(true); const rows = await fetchStaffFinanceNotifications(5); setFinanceAlerts(Array.isArray(rows) ? rows.slice(0, 5) : []); }
    catch { setFinanceAlerts([]); }
    finally { setFinance(false); }
  }

  useEffect(() => {
    if (!hasToken) return;
    if (canAccess(staffRole, "DoorDashboard") || canAccess(staffRole, "RingDashboard") || canAccess(staffRole, "AdminSchedule")) { loadKycQueue(); loadBookmakerQueue(); }
    if (canAccess(staffRole, "FinanceDashboard")) loadFinanceAlerts();
  }, [hasToken, staffRole]);

  async function approveKyc(row: any) {
    try { setActingKycId(String(row?.id)); await staffApproveProfileVerification({ verificationId: String(row?.id), staffId }); await loadKycQueue(); Alert.alert("KYC validé", "Le joueur est maintenant VERIFIED."); }
    catch (e: any) { Alert.alert("Erreur", e?.message || "Impossible de valider ce dossier."); }
    finally { setActingKycId(null); }
  }
  async function rejectKyc(row: any) {
    try { setActingKycId(String(row?.id)); await staffRejectProfileVerification({ verificationId: String(row?.id), staffId }); await loadKycQueue(); Alert.alert("KYC rejeté", "Le dossier a été rejeté."); }
    catch (e: any) { Alert.alert("Erreur", e?.message || "Impossible de rejeter ce dossier."); }
    finally { setActingKycId(null); }
  }
  async function approveBookmaker(row: any) {
    try { setActingBookmakerId(String(row?.id)); await staffApproveBookmakerApplication({ staffId, userId: String(row?.id) }); await loadBookmakerQueue(); Alert.alert("Bookmaker validé", "Le rôle bookmaker a été activé."); }
    catch (e: any) { Alert.alert("Erreur", e?.message || "Impossible de valider cette candidature bookmaker."); }
    finally { setActingBookmakerId(null); }
  }
  async function rejectBookmaker(row: any) {
    try { setActingBookmakerId(String(row?.id)); await staffRejectBookmakerApplication({ staffId, userId: String(row?.id) }); await loadBookmakerQueue(); Alert.alert("Bookmaker rejeté", "La candidature bookmaker a été rejetée."); }
    catch (e: any) { Alert.alert("Erreur", e?.message || "Impossible de rejeter cette candidature bookmaker."); }
    finally { setActingBookmakerId(null); }
  }

  if (!hasToken) {
    return <View style={styles.centerWrap}><Text style={styles.emptyTitle}>STAFF SESSION REQUIRED</Text><Pressable style={styles.primaryBtn} onPress={() => navigation.replace("StaffLogin")}><Text style={styles.primaryBtnText}>GO LOGIN</Text></Pressable></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>HHFC / OPERATIONS</Text>
          <Text style={styles.heroTitle}>CONTROL ROOM</Text>
          <Text style={styles.heroSub}>{String(staffName).toUpperCase()} • <Text style={{ color: roleColor(staffRole) }}>{String(staffRole).toUpperCase()}</Text></Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>MODULES</Text>
          <View style={styles.moduleGrid}>
            {modules.map((m) => (
              <Pressable key={m.target} style={styles.moduleCard} onPress={() => navigation.navigate(m.target)}>
                <Text style={styles.moduleTitle}>{m.title}</Text>
                <Text style={styles.moduleSub}>{m.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>KYC QUEUE</Text>
          {kyc ? <ActivityIndicator color={COLORS.accent} /> : kycRows.length <= 0 ? <Text style={styles.emptyText}>Aucun dossier KYC en attente.</Text> : kycRows.map((row: any) => {
            const busy = actingKycId === String(row?.id);
            return (
              <View key={String(row?.id)} style={styles.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{String(row?.user?.rp_name || "UNKNOWN").toUpperCase()}</Text>
                  <Text style={styles.rowMeta}>{String(row?.user?.role || "PLAYER").toUpperCase()} • {proofUrl(row) ? "PROOF OK" : "NO PROOF"}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable style={[styles.smallBtn, styles.approveBtn]} disabled={busy} onPress={() => approveKyc(row)}><Text style={styles.smallBtnText}>APPROVE</Text></Pressable>
                  <Pressable style={[styles.smallBtn, styles.rejectBtn]} disabled={busy} onPress={() => rejectKyc(row)}><Text style={styles.smallBtnText}>REJECT</Text></Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>BOOKMAKER QUEUE</Text>
          {bookmaker ? <ActivityIndicator color={COLORS.accent} /> : bookmakerRows.length <= 0 ? <Text style={styles.emptyText}>Aucune candidature bookmaker en attente.</Text> : bookmakerRows.map((row: any) => {
            const busy = actingBookmakerId === String(row?.id);
            return (
              <View key={String(row?.id)} style={styles.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{String(row?.rp_name || row?.user?.rp_name || "UNKNOWN").toUpperCase()}</Text>
                  <Text style={styles.rowMeta}>{String(row?.city || "CITY N/A")} • {String(row?.network_size || row?.networkSize || "RÉSEAU N/A")}</Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable style={[styles.smallBtn, styles.approveBtn]} disabled={busy} onPress={() => approveBookmaker(row)}><Text style={styles.smallBtnText}>APPROVE</Text></Pressable>
                  <Pressable style={[styles.smallBtn, styles.rejectBtn]} disabled={busy} onPress={() => rejectBookmaker(row)}><Text style={styles.smallBtnText}>REJECT</Text></Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>FINANCE ALERTS</Text>
          {finance ? <ActivityIndicator color={COLORS.accent} /> : financeAlerts.length <= 0 ? <Text style={styles.emptyText}>Aucune alerte finance récente.</Text> : financeAlerts.map((row: any, index: number) => (
            <View key={String(row?.id || index)} style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{String(row?.title || row?.label || "ALERTE").toUpperCase()}</Text>
                <Text style={styles.rowMeta}>{String(row?.message || row?.note || "Sans détail supplémentaire.")}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, gap: 16, paddingBottom: 28 },
  centerWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: COLORS.text, fontFamily: "Bebas", fontSize: 34 },
  emptyText: { color: COLORS.muted, fontFamily: "Inter", fontSize: 14 },
  heroCard: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 18, gap: 10 },
  heroEyebrow: { color: COLORS.accent, fontFamily: "Inter", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  heroTitle: { color: COLORS.text, fontFamily: "Bebas", fontSize: 40, letterSpacing: 1 },
  heroSub: { color: COLORS.muted, fontFamily: "Inter", fontSize: 14 },
  sectionCard: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 16, gap: 10 },
  sectionTitle: { color: COLORS.text, fontFamily: "Bebas", fontSize: 28, letterSpacing: 0.8 },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  moduleCard: { width: "48.5%", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, minHeight: 96, justifyContent: "space-between" },
  moduleTitle: { color: COLORS.text, fontFamily: "Inter", fontSize: 13, fontWeight: "800" },
  moduleSub: { color: COLORS.muted, fontFamily: "Inter", fontSize: 12, lineHeight: 18 },
  rowCard: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  rowTitle: { color: COLORS.text, fontFamily: "Inter", fontSize: 14, fontWeight: "800" },
  rowMeta: { color: COLORS.muted, fontFamily: "Inter", fontSize: 12, marginTop: 4, lineHeight: 18 },
  rowActions: { gap: 8 },
  smallBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center" },
  approveBtn: { backgroundColor: "rgba(57,255,20,0.12)", borderWidth: 1, borderColor: "rgba(57,255,20,0.25)" },
  rejectBtn: { backgroundColor: "rgba(255,77,77,0.12)", borderWidth: 1, borderColor: "rgba(255,77,77,0.25)" },
  smallBtnText: { color: COLORS.text, fontFamily: "Inter", fontSize: 11, fontWeight: "800" },
  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 14 },
  primaryBtnText: { color: COLORS.bg, fontFamily: "Bebas", fontSize: 20 },
});

// HHFC FINAL STAFF RULES
// - removed legacy legacy_staff_sessions_removed dependencies
// - OWNER / FINANCE / RING / DOOR only
// - no plaintext PIN rendering
// - production staff routes only
