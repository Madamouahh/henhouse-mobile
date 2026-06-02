import React, { useContext, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppContext } from "../App";
import { ownerGenerateSlotsForDate, ownerUpdateScheduleRule, fetchScheduleRules } from "../services/hhApi";

const DAYS = [
  { key: 1, label: "LUNDI" },
  { key: 2, label: "MARDI" },
  { key: 3, label: "MERCREDI" },
  { key: 4, label: "JEUDI" },
  { key: 5, label: "VENDREDI" },
  { key: 6, label: "SAMEDI" },
  { key: 0, label: "DIMANCHE" },
];
const ADMIN_ROLES = ["OWNER", "ADMIN", "DIRECTION"];
const LEAGUE_DAYS = [2, 3, 4, 5, 6];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function upper(v: any) { return String(v || "").toUpperCase(); }
function normalizeClock(value: any, fallback: string) {
  const raw = String(value || fallback).trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return fallback;
}
function isValidISODate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }
function defaultRule(weekday: number) {
  if (LEAGUE_DAYS.includes(weekday)) return { weekday, is_open: true, is_24h: false, window_start: "20:00:00", window_end: "02:00:00", interval_minutes: 20 };
  if (weekday === 0) return { weekday, is_open: true, is_24h: false, window_start: "20:00:00", window_end: "01:00:00", interval_minutes: 30 };
  return { weekday, is_open: false, is_24h: false, window_start: "00:00:00", window_end: "00:00:00", interval_minutes: 20 };
}

export default function AdminScheduleScreen({ navigation }: any) {
  const { state } = useContext(AppContext);
  const session = state?.staffSession || null;
  const token = session?.token || "";
  const hasAdminAccess = ADMIN_ROLES.includes(upper(session?.role));

  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dateValue, setDateValue] = useState(todayISO());

  async function refresh() {
    try {
      setLoading(true);
      const data = await fetchScheduleRules();
      setRules(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de charger le planning.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (!token) { setLoading(false); return; } refresh(); }, [token]);

  function patchRule(weekday: number, patch: any) {
    setRules((prev) => {
      const exists = prev.some((r: any) => Number(r?.weekday) === weekday);
      if (!exists) return [...prev, { ...defaultRule(weekday), ...patch }];
      return prev.map((r: any) => Number(r?.weekday) === weekday ? { ...r, ...patch } : r);
    });
  }

  async function saveRule(rule: any) {
    if (!token || !hasAdminAccess) return Alert.alert("Accès refusé", "Action réservée à l'admin / direction.");
    try {
      setBusy(true);
      await ownerUpdateScheduleRule(token, Number(rule?.weekday), !!rule?.is_open, !!rule?.is_24h, normalizeClock(rule?.window_start, "20:00:00"), normalizeClock(rule?.window_end, "00:00:00"), Math.max(10, Number(rule?.interval_minutes || 20)));
      Alert.alert("OK", `Règle sauvegardée pour ${DAYS.find((d) => d.key === Number(rule?.weekday))?.label || "LE JOUR"}.`);
      await refresh();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Sauvegarde impossible.");
    } finally { setBusy(false); }
  }

  async function generateSlots() {
    if (!token || !hasAdminAccess) return Alert.alert("Accès refusé", "Action réservée à l'admin / direction.");
    if (!isValidISODate(dateValue)) return Alert.alert("Date invalide", "Utilise le format YYYY-MM-DD.");
    try {
      setBusy(true);
      const created = await ownerGenerateSlotsForDate(token, dateValue);
      const count = Array.isArray(created) ? created.length : Number(created || 0);
      Alert.alert("Créneaux générés", `${count} slot(s) créés pour ${dateValue}.`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Génération impossible.");
    } finally { setBusy(false); }
  }

  const orderedRules = useMemo(() => DAYS.map((day) => {
    const found = rules.find((r: any) => Number(r?.weekday) === day.key);
    const merged = found ? { ...defaultRule(day.key), ...found } : defaultRule(day.key);
    return { ...merged, window_start: normalizeClock(merged?.window_start, "20:00:00"), window_end: normalizeClock(merged?.window_end, "00:00:00") };
  }), [rules]);

  if (!token) return <View style={styles.lockWrap}><Text style={styles.lockTitle}>ADMIN SESSION REQUIRED</Text><Text style={styles.lockText}>Connecte-toi côté staff pour gérer le planning.</Text></View>;
  if (!hasAdminAccess) return <View style={styles.lockWrap}><Text style={styles.lockTitle}>ACCÈS LIMITÉ</Text><Text style={styles.lockText}>Le planning hebdomadaire est réservé aux rôles OWNER / ADMIN / DIRECTION.</Text><Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("StaffDashboard")}><Text style={styles.secondaryBtnText}>RETOUR STAFF DASHBOARD</Text></Pressable></View>;
  if (loading) return <View style={styles.Wrap}><ActivityIndicator size="large" color="#D4AF37" /><Text style={styles.Text}>Chargement du planning...</Text></View>;

  return (
    <LinearGradient colors={["#07111B", "#0A1623", "#060D16"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>HHFC SCHEDULE</Text>
          <Text style={styles.heroTitle}>ADMIN PLANNER</Text>
          <Text style={styles.heroSubtitle}>Mardi à samedi = league nights. Dimanche = main event. Le planning admin ne doit servir qu'à alimenter cette logique.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>RAPPEL PRODUIT</Text>
          <Text style={styles.helperText}>• Semaine combattants : mardi à samedi</Text>
          <Text style={styles.helperText}>• 1 combat max par jour / 5 max semaine</Text>
          <Text style={styles.helperText}>• Sunday Main Event séparé du flux standard</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>GÉNÉRER LES SLOTS</Text>
          <Text style={styles.helperText}>Utilise une date réelle HHFC. La génération saute les créneaux déjà existants.</Text>
          <Text style={styles.inputLabel}>Date</Text>
          <TextInput value={dateValue} onChangeText={setDateValue} ="YYYY-MM-DD" TextColor="#667385" style={styles.input} autoCapitalize="none" autoCorrect={false} />
          <View style={styles.btnRow}>
            <Pressable style={[styles.primaryBtn, busy && styles.disabledBtn]} onPress={generateSlots} disabled={busy}><Text style={styles.primaryBtnText}>{busy ? "GÉNÉRATION..." : "GENERATE SLOTS"}</Text></Pressable>
            <Pressable style={styles.secondaryBtn} onPress={refresh} disabled={busy}><Text style={styles.secondaryBtnText}>RELOAD RULES</Text></Pressable>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>RÈGLES HEBDOMADAIRES</Text>
          {orderedRules.map((rule: any) => {
            const day = DAYS.find((d) => d.key === Number(rule?.weekday));
            return (
              <View key={String(rule?.weekday)} style={styles.ruleCard}>
                <View style={styles.ruleTopRow}>
                  <Text style={styles.ruleTitle}>{day?.label || `DAY ${rule?.weekday}`}</Text>
                  <Pressable style={[styles.toggleBtn, rule?.is_open ? styles.toggleOn : styles.toggleOff]} onPress={() => patchRule(Number(rule?.weekday), { is_open: !rule?.is_open })}>
                    <Text style={styles.toggleText}>{rule?.is_open ? "OPEN" : "CLOSED"}</Text>
                  </Pressable>
                </View>
                <Text style={styles.inputLabel}>Heure début</Text>
                <TextInput value={String(rule?.window_start || "20:00:00")} onChangeText={(v) => patchRule(Number(rule?.weekday), { window_start: v })} ="20:00:00" TextColor="#667385" style={styles.input} autoCapitalize="none" autoCorrect={false} />
                <Text style={styles.inputLabel}>Heure fin</Text>
                <TextInput value={String(rule?.window_end || "00:00:00")} onChangeText={(v) => patchRule(Number(rule?.weekday), { window_end: v })} ="02:00:00" TextColor="#667385" style={styles.input} autoCapitalize="none" autoCorrect={false} />
                <Text style={styles.inputLabel}>Intervalle (minutes)</Text>
                <TextInput value={String(rule?.interval_minutes || 20)} onChangeText={(v) => patchRule(Number(rule?.weekday), { interval_minutes: v })} ="20" TextColor="#667385" style={styles.input} keyboardType="numeric" />
                <Pressable style={[styles.primaryBtn, busy && styles.disabledBtn]} onPress={() => saveRule(rule)} disabled={busy}><Text style={styles.primaryBtnText}>{busy ? "SAUVEGARDE..." : "SAVE RULE"}</Text></Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 18, paddingBottom: 40, gap: 16 }, Wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#060D16", gap: 12 }, Text: { color: "#D7E2EC", fontSize: 13 }, lockWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#060D16" }, lockTitle: { color: "#FFF", fontSize: 24, fontFamily: "Bebas", textAlign: "center" }, lockText: { color: "#C7CED8", textAlign: "center", lineHeight: 22 },
  heroCard: { backgroundColor: "#0E1722", borderRadius: 12, borderWidth: 1, borderColor: "#1D3145", padding: 20, gap: 10 }, heroEyebrow: { color: "#D4AF37", fontSize: 11, letterSpacing: 2, fontWeight: "800" }, heroTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 30 }, heroSubtitle: { color: "#C7CED8", lineHeight: 21 }, sectionCard: { backgroundColor: "#0E1722", borderRadius: 10, borderWidth: 1, borderColor: "#1D3145", padding: 18, gap: 10 }, sectionTitle: { color: "#FFF", fontWeight: "900", fontSize: 18 }, helperText: { color: "#A8B6C6", lineHeight: 20 }, inputLabel: { color: "#8EA2B8", fontSize: 12, marginTop: 4 }, input: { backgroundColor: "#08111A", borderRadius: 8, borderWidth: 1, borderColor: "#1F3347", color: "#FFF", paddingHorizontal: 14, paddingVertical: 12 }, btnRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 6 }, primaryBtn: { backgroundColor: "#ec4900", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 8 }, primaryBtnText: { color: "#FFF", fontWeight: "900" }, secondaryBtn: { backgroundColor: "#162434", borderRadius: 8, paddingVertical: 14, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: "#27415A" }, secondaryBtnText: { color: "#FFF", fontWeight: "800" }, disabledBtn: { opacity: 0.65 }, ruleCard: { backgroundColor: "#09131D", borderRadius: 10, borderWidth: 1, borderColor: "#1B2F43", padding: 14, marginTop: 10 }, ruleTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, ruleTitle: { color: "#FFF", fontWeight: "900", fontSize: 16 }, toggleBtn: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 }, toggleOn: { backgroundColor: "#123D2B", borderColor: "#2F8F63" }, toggleOff: { backgroundColor: "#311518", borderColor: "#7E3038" }, toggleText: { color: "#FFF", fontWeight: "900", fontSize: 12 },
});