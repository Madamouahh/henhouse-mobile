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
import { fetchFinanceJournal } from "../services/hhApi";

function usd(v: any) { return formatRP(Number(v || 0)); };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeNum(v: any) {
  return Number(v || 0);
}

function upper(v: any) {
  return String(v || "").toUpperCase();
}

function formatDateTime(value?: string | null) {
  if (!value) return "DATE N/A";
  try {
    return new Date(value).toLocaleString("fr-FR");
  } catch {
    return "DATE N/A";
  }
}

const DIRECTION_OPTIONS = ["ALL", "IN", "OUT"];
const STATUS_OPTIONS = ["ALL", "OPEN", "REVIEW", "CLOSED", "VALID", "PAID", "CANCELLED", "SETTLED"];

export default function FinanceJournalScreen() {
  const { state, setState } = useContext(AppContext);
  const token = state?.staffSession?.token || "";

  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [category, setCategory] = useState("");
  const [direction, setDirection] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await fetchFinanceJournal({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: category.trim() ? category.trim() : undefined,
        direction: direction !== "ALL" ? (direction as "IN" | "OUT") : undefined,
        status: status !== "ALL" ? status : undefined,
        limit: 300,
      });

      const safeRows = Array.isArray(data) ? data : [];
      setRows(safeRows);
      setState((prev: any) => ({
        ...prev,
        financeJournal: {
          filters: { dateFrom, dateTo, category, direction, status },
          rows: safeRows,
        },
      }));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de charger le journal financier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalIn = useMemo(() => rows.filter((row: any) => upper(row?.direction) === "IN").reduce((sum: number, row: any) => sum + safeNum(row?.amount_cents), 0), [rows]);
  const totalOut = useMemo(() => rows.filter((row: any) => upper(row?.direction) === "OUT").reduce((sum: number, row: any) => sum + safeNum(row?.amount_cents), 0), [rows]);
  const depositsCount = useMemo(() => rows.filter((row: any) => upper(row?.simple_kind) === "DÉPÔT").length, [rows]);
  const withdrawsCount = useMemo(() => rows.filter((row: any) => upper(row?.simple_kind) === "RETRAIT").length, [rows]);

  if (!token) {
    return (
      <View style={styles.Wrap}>
        <Text style={styles.emptyText}>Reconnecte-toi côté staff pour accéder au journal.</Text>
      </View>
    );
  }

  if () {
    return (
      <View style={styles.Wrap}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.Text}>Chargement du journal financier...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>JOURNAL COMPTA</Text>
      <Text style={styles.subtitle}>Version simple pour sortir la compta du soir rapidement.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>FILTRES RDES</Text>
        <TextInput
          value={dateFrom}
          onChangeText={setDateFrom}
  placeholder="YYYY-MM-DD"
          TextColor="#667385"
          style={styles.input}
        />
        <TextInput
          value={dateTo}
          onChangeText={setDateTo}
  placeholder="YYYY-MM-DD"
          TextColor="#667385"
          style={styles.input}
        />
        <TextInput
          value={category}
          onChangeText={setCategory}
  placeholder="deposit / withdraw / ticket / bet / fight"
          TextColor="#667385"
          style={styles.input}
        />

        <View style={styles.optionRow}>
          {DIRECTION_OPTIONS.map((option) => {
            const active = direction === option;
            return (
              <Pressable key={option} style={[styles.optionBtn, active && styles.optionBtnActive]} onPress={() => setDirection(option)}>
                <Text style={[styles.optionBtnText, active && styles.optionBtnTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.optionRowWrap}>
          {STATUS_OPTIONS.map((option) => {
            const active = status === option;
            return (
              <Pressable key={option} style={[styles.optionBtnSmall, active && styles.optionBtnActive]} onPress={() => setStatus(option)}>
                <Text style={[styles.optionBtnText, active && styles.optionBtnTextActive]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.primaryBtn} onPress={load}>
          <Text style={styles.primaryBtnText}>RECHARGER</Text>
        </Pressable>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{rows.length}</Text>
          <Text style={styles.kpiLabel}>LIGNES</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, styles.positive]}>{usd(totalIn)}</Text>
          <Text style={styles.kpiLabel}>ENTRÉES</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={[styles.kpiValue, styles.negative]}>{usd(totalOut)}</Text>
          <Text style={styles.kpiLabel}>SORTIES</Text>
        </View>
      </View>

      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{depositsCount}</Text>
          <Text style={styles.kpiLabel}>DÉPÔTS</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{withdrawsCount}</Text>
          <Text style={styles.kpiLabel}>RETRAITS</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>LIGNES COMPTABLES SIMPLES</Text>
        {rows.length === 0 ? (
          <Text style={styles.emptyText}>Aucune ligne trouvée.</Text>
        ) : (
          rows.map((row: any) => (
            <View key={String(row?.id)} style={styles.entryCard}>
              <View style={styles.entryTopRow}>
                <Text style={[styles.kind, upper(row?.direction) === "IN" ? styles.positive : styles.negative]}>
                  {row?.simple_kind || "MOUVEMENT"}
                </Text>
                <Text style={styles.amount}>{usd(row?.amount_cents || 0)}</Text>
              </View>
              <Text style={styles.mainLine}>
                {row?.client_name || "CLIENT INCONNU"} • {row?.simple_label || upper(row?.category || "ENTRY")}
              </Text>
              <Text style={styles.metaLine}>
                {row?.client_phone ? `${row.client_phone} • ` : ""}{formatDateTime(row?.created_at)}
              </Text>
              {row?.note ? <Text style={styles.noteLine}>{String(row.note)}</Text> : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#08111B" },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  Wrap: { flex: 1, backgroundColor: "#08111B", alignItems: "center", justifyContent: "center", gap: 12, padding: 20 },
  Text: { color: "#BFD0E0", fontSize: 15 },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#8DA5BE", marginTop: -4 },
  card: { backgroundColor: "#12202E", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#23384D", gap: 10 },
  cardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  input: { backgroundColor: "#0D1824", borderWidth: 1, borderColor: "#24394F", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: "#FFFFFF", fontWeight: "700" },
  optionRow: { flexDirection: "row", gap: 10 },
  optionRowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  optionBtn: { flex: 1, backgroundColor: "#142433", borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#24394F" },
  optionBtnSmall: { backgroundColor: "#142433", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#24394F" },
  optionBtnActive: { backgroundColor: "#ec4900", borderColor: "#ec4900" },
  optionBtnText: { color: "#D7E2EC", fontWeight: "800", fontSize: 12 },
  optionBtnTextActive: { color: "#FFFFFF" },
  primaryBtn: { backgroundColor: "#ec4900", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  kpiRow: { flexDirection: "row", gap: 10 },
  kpiCard: { flex: 1, backgroundColor: "#12202E", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#23384D" },
  kpiValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  kpiLabel: { color: "#8DA5BE", fontSize: 12, marginTop: 6, fontWeight: "700" },
  positive: { color: "#7CFFB2" },
  negative: { color: "#FF8B8B" },
  entryCard: { backgroundColor: "#0D1824", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#24394F", gap: 4 },
  entryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kind: { fontWeight: "900", fontSize: 12 },
  amount: { color: "#FFFFFF", fontWeight: "900" },
  mainLine: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  metaLine: { color: "#AFC4D8", fontSize: 13 },
  noteLine: { color: "#D7E2EC", fontSize: 13, marginTop: 2 },
  emptyText: { color: "#8DA5BE" },
});