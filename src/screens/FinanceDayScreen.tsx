import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { AppContext } from "../App";
import { formatRP } from "../utils/money";
import { fetchFinanceDay, financeGenerateDailyReport } from "../services/hhApi";

function usd(v: any) { return formatRP(Number(v || 0));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value?: string | null) {
  if (!value) return "DATE N/A";
  try {
    return new Date(value).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).toUpperCase();
  } catch {
    return String(value || "DATE N/A");
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "DATE N/A";
  try {
    return new Date(value).toLocaleString("fr-FR");
  } catch {
    return "DATE N/A";
  }
}

function safeNum(v: any) {
  return Number(v || 0);
}

function upper(v: any) {
  return String(v || "").toUpperCase();
}

export default function FinanceDayScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const token = state?.staffSession?.token || "";
  const staffRole = upper(state?.staffSession?.role);

  const [dateValue, setDateValue] = useState(state?.financeDay?.business_date || todayISO());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);

  async function load() {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchFinanceDay(dateValue);
      const nextReport = data?.report || null;
      const nextEntries = Array.isArray(data?.entries) ? data.entries : [];

      setReport(nextReport);
      setEntries(nextEntries);

      setState((prev: any) => ({
        ...prev,
        financeDay: {
          business_date: nextReport?.business_date || dateValue,
          report: nextReport,
          entries: nextEntries,
        },
      }));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de charger la journée comptable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dateValue, token]);

  async function handleGenerate() {
    if (!token) {
      Alert.alert("Session invalide", "Reconnecte-toi côté staff.");
      return;
    }

    try {
      setGenerating(true);
      await financeGenerateDailyReport({ token, businessDate: dateValue });
      await load();
      Alert.alert("Report généré", `Le report du ${dateValue} a été recalculé.`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de générer le report quotidien.");
    } finally {
      setGenerating(false);
    }
  }

  const totalIn = safeNum(report?.total_in_cents);
  const totalOut = safeNum(report?.total_out_cents);
  const net = safeNum(report?.net_cents ?? totalIn - totalOut);
  const txCount = safeNum(report?.transaction_count ?? entries.length);
  const status = upper(report?.status || "OPEN");
  const recentEntries = useMemo(() => entries.slice(0, 12), [entries]);

  const categories = useMemo(() => {
    return [
      { label: "TICKETS", value: safeNum(report?.tickets_total_cents) },
      { label: "BETS", value: safeNum(report?.bets_total_cents) },
      { label: "WALLET DEPOSITS", value: safeNum(report?.wallet_deposits_total_cents) },
      { label: "WALLET WITHDRAWS", value: safeNum(report?.wallet_withdraws_total_cents) },
      { label: "FIGHT STAKES", value: safeNum(report?.fight_stakes_total_cents) },
      { label: "BET PAYOUTS", value: safeNum(report?.bet_payouts_total_cents) },
      { label: "FIGHT PAYOUTS", value: safeNum(report?.fight_payouts_total_cents) },
      { label: "AFFILIATES", value: safeNum(report?.affiliate_commissions_total_cents) },
      { label: "REFUNDS", value: safeNum(report?.ticket_refunds_total_cents) },
      { label: "ADJUSTMENTS", value: safeNum(report?.adjustments_total_cents) },
    ];
  }, [report]);

  if (!token) {
    return (
      <View style={styles.Wrap}>
        <Text style={styles.Text}>Reconnecte-toi côté staff pour accéder à la journée finance.</Text>
      </View>
    );
  }

  if () {
    return (
      <View style={styles.Wrap}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.Text}>Chargement de la journée comptable...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>FINANCE DAY</Text>
      <Text style={styles.subtitle}>Vue quotidienne des flux comptables HHFC.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>DATE DE TRAVAIL</Text>
        <TextInput
          value={dateValue}
          onChangeText={setDateValue}
  placeholder="YYYY-MM-DD"
          TextColor="#667385"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.btnRow}>
          <Pressable style={[styles.primaryBtn, generating && styles.disabledBtn]} onPress={handleGenerate} disabled={generating}>
            <Text style={styles.primaryBtnText}>{generating ? "GÉNÉRATION..." : "GÉNÉRER / RECALCULER"}</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("FinanceJournal")}>
            <Text style={styles.secondaryBtnText}>OUVRIR LE JOURNAL</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <Text style={styles.infoValue}>{formatDate(dateValue)}</Text>
          <Text style={styles.infoLabel}>BUSINESS DATE</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoValue}>{staffRole || "STAFF"}</Text>
          <Text style={styles.infoLabel}>ROLE</Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{usd(totalIn)}</Text>
          <Text style={styles.kpiLabel}>TOTAL IN</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{usd(totalOut)}</Text>
          <Text style={styles.kpiLabel}>TOTAL OUT</Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, net >= 0 ? styles.positive : styles.negative]}>{usd(net)}</Text>
          <Text style={styles.kpiLabel}>NET</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{txCount}</Text>
          <Text style={styles.kpiLabel}>TRANSACTIONS</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>STATUT DU REPORT</Text>
        <Text style={styles.statusText}>{status}</Text>
        {report?.closed_at ? <Text style={styles.metaText}>Clôturé le : {formatDateTime(report.closed_at)}</Text> : null}
        {report?.created_at ? <Text style={styles.metaText}>Créé le : {formatDateTime(report.created_at)}</Text> : null}
        <View style={styles.btnRow}>
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("FinanceExport", { businessDate: dateValue })}>
            <Text style={styles.secondaryBtnText}>EXPORT DU JOUR</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("FinanceClose", { businessDate: dateValue })}>
            <Text style={styles.secondaryBtnText}>CLOTURE</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>VENTILATION PAR ACTIVITÉ</Text>
        {categories.map((row) => (
          <View key={row.label} style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{row.label}</Text>
            <Text style={styles.breakdownValue}>{usd(row.value)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>DERNIÈRES ÉCRITURES</Text>
        {recentEntries.length === 0 ? (
          <Text style={styles.emptyText}>Aucune écriture pour cette journée.</Text>
        ) : (
          recentEntries.map((row: any) => {
            const direction = upper(row?.direction || "—");
            const amount = safeNum(row?.amount_cents);
            const category = upper(row?.category || "UNCATEGORIZED");
            const subcategory = upper(row?.subcategory || "");
            const color = direction === "IN" ? "#7CFFB2" : direction === "OUT" ? "#FF8B8B" : "#C7CED8";

            return (
              <View key={String(row?.id)} style={styles.entryCard}>
                <View style={styles.entryTopRow}>
                  <Text style={[styles.entryDirection, { color }]}>{direction}</Text>
                  <Text style={styles.entryAmount}>{usd(amount)}</Text>
                </View>
                <Text style={styles.entryLabel}>{category}{subcategory ? ` / ${subcategory}` : ""}</Text>
                <Text style={styles.entryMeta}>{upper(row?.status || "OPEN")} • {formatDateTime(row?.created_at)}</Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { padding: 18, paddingBottom: 40, gap: 14 },
  Wrap: { flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  Text: { color: "#D7E2EC", textAlign: "center" },
  title: { color: "#FFF", fontFamily: "Bebas", fontSize: 30, textAlign: "center" },
  subtitle: { color: "#B9C0CD", textAlign: "center", marginBottom: 4 },
  card: { backgroundColor: "#111823", borderRadius: 10, borderWidth: 1, borderColor: "#23384D", padding: 16, gap: 10 },
  cardTitle: { color: "#FFF", fontWeight: "900", fontSize: 17 },
  input: { backgroundColor: "#0D141D", borderRadius: 8, borderWidth: 1, borderColor: "#243A4F", color: "#FFF", paddingHorizontal: 14, paddingVertical: 12 },
  btnRow: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 },
  primaryBtn: { flexGrow: 1, backgroundColor: "#ec4900", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontWeight: "900" },
  secondaryBtn: { flexGrow: 1, backgroundColor: "#162434", borderRadius: 8, paddingVertical: 14, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: "#27415A" },
  secondaryBtnText: { color: "#FFF", fontWeight: "800" },
  disabledBtn: { opacity: 0.6 },
  infoRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  infoCard: { flex: 1, minWidth: 150, backgroundColor: "#111823", borderRadius: 10, borderWidth: 1, borderColor: "#23384D", padding: 16 },
  infoValue: { color: "#FFF", fontWeight: "900", fontSize: 16 },
  infoLabel: { color: "#8FA3B8", marginTop: 6, fontSize: 12 },
  kpiRow: { flexDirection: "row", gap: 12 },
  kpiCard: { flex: 1, backgroundColor: "#111823", borderRadius: 10, borderWidth: 1, borderColor: "#23384D", padding: 18, alignItems: "center" },
  kpiValue: { color: "#FFF", fontWeight: "900", fontSize: 20 },
  kpiLabel: { color: "#8FA3B8", marginTop: 6, fontSize: 12 },
  positive: { color: "#7CFFB2" },
  negative: { color: "#FF8B8B" },
  statusText: { color: "#D4AF37", fontWeight: "900", fontSize: 18 },
  metaText: { color: "#A1B1C3", fontSize: 12 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1A2837" },
  breakdownLabel: { color: "#D7E2EC", flex: 1, paddingRight: 8 },
  breakdownValue: { color: "#FFF", fontWeight: "800" },
  emptyText: { color: "#A1B1C3" },
  entryCard: { backgroundColor: "#0D141D", borderRadius: 8, borderWidth: 1, borderColor: "#22384C", padding: 14, marginTop: 8 },
  entryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryDirection: { fontWeight: "900" },
  entryAmount: { color: "#FFF", fontWeight: "900" },
  entryLabel: { color: "#D7E2EC", marginTop: 8 },
  entryMeta: { color: "#91A3B6", marginTop: 6, fontSize: 12 },
});