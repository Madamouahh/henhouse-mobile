import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppContext } from "../App";
import { formatRP } from "../utils/money";
import {
  fetchFinanceDay,
  fetchFinanceDashboardDeposits,
  fetchFinanceDashboardWithdraws,
  staffApproveWalletDeposit,
  staffRejectWalletDeposit,
  staffMarkWithdrawProcessing,
  staffMarkWithdrawPaid,
  staffRejectWithdraw,
} from "../services/hhApi";

function usd(v: any) {
  return formatRP(Number(v || 0));
}

function upper(value: any) {
  return String(value || "").toUpperCase();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function safeNum(v: any) {
  return Number(v || 0);
}

function getAmountCents(row: any) {
  return safeNum(row?.amount_cents);
}

export default function FinanceDashboardScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const staffSession = state?.staffSession || null;
  const staffId = staffSession?.staffId || staffSession?.id || null;
  const staffToken = staffSession?.token || null;

  const [tab, setTab] = useState<"OVERVIEW" | "DEPOSITS" | "WITHDRAWS">("OVERVIEW");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const [dayReport, setDayReport] = useState<any>(null);
  const [dayEntries, setDayEntries] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [withdraws, setWithdraws] = useState<any[]>([]);

  async function load() {
    try {
      setLoading(true);

      const [financeDay, depositsRows, withdrawRows] = await Promise.all([
        fetchFinanceDay(todayISO()),
        fetchFinanceDashboardDeposits(),
        fetchFinanceDashboardWithdraws(),
      ]);

      const nextReport = financeDay?.report || null;
      const nextEntries = Array.isArray(financeDay?.entries) ? financeDay.entries : [];
      const nextDeposits = Array.isArray(depositsRows) ? depositsRows : [];
      const nextWithdraws = Array.isArray(withdrawRows) ? withdrawRows : [];

      setDayReport(nextReport);
      setDayEntries(nextEntries);
      setDeposits(nextDeposits);
      setWithdraws(nextWithdraws);

      setState((prev: any) => ({
        ...prev,
        financeDay: {
          business_date: todayISO(),
          report: nextReport,
          entries: nextEntries,
        },
      }));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de charger le dashboard finance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (staffId && staffToken) {
      load();
    } else {
      setLoading(false);
    }
  }, [staffId, staffToken]);

  async function runAction(itemId: string, action: () => Promise<void>, successMessage: string) {
    if (!staffId || !staffToken) {
      Alert.alert("Session error", "Reconnecte la session staff avant de continuer.");
      return;
    }

    try {
      setActingId(itemId);
      await action();
      await load();

      setState((prev: any) => ({
        ...prev,
        lastFinanceSync: Date.now(),
      }));

      Alert.alert("Succès", successMessage);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Action impossible.");
    } finally {
      setActingId(null);
    }
  }

  function confirm(title: string, message: string, onConfirm: () => void, destructive = false) {
    Alert.alert(title, message, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer",
        style: destructive ? "destructive" : "default",
        onPress: onConfirm,
      },
    ]);
  }

  const totalIn = safeNum(dayReport?.total_in_cents);
  const totalOut = safeNum(dayReport?.total_out_cents);
  const net = safeNum(dayReport?.net_cents ?? totalIn - totalOut);
  const txCount = safeNum(dayReport?.transaction_count ?? dayEntries.length);

  const pendingDeposits = useMemo(() => {
    return deposits.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((d: any) => {
      const s = upper(d?.status || "OPEN");
      return s === "OPEN" || s === "PENDING";
    });
  }, [deposits]);

  const pendingWithdraws = useMemo(() => {
    return withdraws.filter((item)=> item?.rp_name && !['TEST_','SPAR_','QA_','DEMO_'].some(p=>item.rp_name.startsWith(p))).filter((w: any) => {
      const s = upper(w?.status || "OPEN");
      return s === "LOCKED" || s === "OPEN" || s === "PENDING" || s === "PROCESSING";
    });
  }, [withdraws]);

  const depositVolume = useMemo(() => {
    return pendingDeposits.reduce((sum: number, row: any) => sum + getAmountCents(row), 0);
  }, [pendingDeposits]);

  const withdrawVolume = useMemo(() => {
    return pendingWithdraws.reduce((sum: number, row: any) => sum + getAmountCents(row), 0);
  }, [pendingWithdraws]);

  const recentFinanceEntries = useMemo(() => {
    return dayEntries.slice(0, 8);
  }, [dayEntries]);

  if (!staffId || !staffToken) {
    return (
      <View style={styles.Wrap}>
        <Text style={styles.Text}>Session staff invalide</Text>
      </View>
    );
  }

  if () {
    return (
      <View style={styles.Wrap}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.Text}>Chargement finance...</Text>
      </View>
    );
  }

  return (
    <LinearGradient colors={["#07111B", "#0A1623", "#060D16"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>HHFC FINANCE</Text>
          <Text style={styles.heroTitle}>CONTROL HUB</Text>
          <Text style={styles.heroSubtitle}>
            Supervision des flux, demandes wallet et accès rapide au journal comptable.
          </Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{usd(totalIn)}</Text>
              <Text style={styles.heroStatLabel}>IN TODAY</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{usd(totalOut)}</Text>
              <Text style={styles.heroStatLabel}>OUT TODAY</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, net >= 0 ? styles.positive : styles.negative]}>{usd(net)}</Text>
              <Text style={styles.heroStatLabel}>NET</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={() => navigation.navigate("FinanceDay")}>
            <Text style={styles.quickValue}>{txCount}</Text>
            <Text style={styles.quickLabel}>TX DU JOUR</Text>
          </Pressable>

          <Pressable style={styles.quickCard} onPress={() => navigation.navigate("FinanceJournal")}>
            <Text style={styles.quickValue}>{pendingDeposits.length + pendingWithdraws.length}</Text>
            <Text style={styles.quickLabel}>EN ATTENTE</Text>
          </Pressable>

          <Pressable style={styles.quickCard} onPress={load}>
            <Text style={styles.quickValue}></Text>
            <Text style={styles.quickLabel}>REFRESH</Text>
          </Pressable>
        </View>

        <View style={styles.tabRow}>
          <Pressable style={[styles.tabBtn, tab === "OVERVIEW" && styles.tabBtnActive]} onPress={() => setTab("OVERVIEW")}>
            <Text style={[styles.tabBtnText, tab === "OVERVIEW" && styles.tabBtnTextActive]}>OVERVIEW</Text>
          </Pressable>

          <Pressable style={[styles.tabBtn, tab === "DEPOSITS" && styles.tabBtnActive]} onPress={() => setTab("DEPOSITS")}>
            <Text style={[styles.tabBtnText, tab === "DEPOSITS" && styles.tabBtnTextActive]}>DÉPÔTS</Text>
          </Pressable>

          <Pressable style={[styles.tabBtn, tab === "WITHDRAWS" && styles.tabBtnActive]} onPress={() => setTab("WITHDRAWS")}>
            <Text style={[styles.tabBtnText, tab === "WITHDRAWS" && styles.tabBtnTextActive]}>RETRAITS</Text>
          </Pressable>
        </View>

        {tab === "OVERVIEW" ? (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>RACCOURCIS FINANCE</Text>

              <Pressable style={styles.moduleCard} onPress={() => navigation.navigate("FinanceDay")}>
                <View style={styles.moduleTextWrap}>
                  <Text style={styles.moduleTitle}>FINANCE DAY</Text>
                  <Text style={styles.moduleSubtitle}>Résumé quotidien et ventilation</Text>
                </View>
                <Text style={styles.moduleArrow}>›</Text>
              </Pressable>

              <Pressable style={styles.moduleCard} onPress={() => navigation.navigate("FinanceJournal")}>
                <View style={styles.moduleTextWrap}>
                  <Text style={styles.moduleTitle}>FINANCE JOURNAL</Text>
                  <Text style={styles.moduleSubtitle}>Journal détaillé des écritures</Text>
                </View>
                <Text style={styles.moduleArrow}>›</Text>
              </Pressable>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>WALLET REQUESTS</Text>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Dépôts à traiter</Text>
                <Text style={styles.breakdownValue}>{pendingDeposits.length} • {usd(depositVolume)}</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Retraits à traiter</Text>
                <Text style={styles.breakdownValue}>{pendingWithdraws.length} • {usd(withdrawVolume)}</Text>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>ÉCRITURES RÉCENTES</Text>

              {recentFinanceEntries.length === 0 ? (
                <Text style={styles.emptyText}>Aucune écriture pour aujourd’hui.</Text>
              ) : (
                recentFinanceEntries.map((row: any) => {
                  const direction = upper(row?.direction || "—");
                  const amount = safeNum(row?.amount_cents);
                  const category = upper(row?.category || "UNCATEGORIZED");
                  const color = direction === "IN" ? "#7CFFB2" : direction === "OUT" ? "#FF8B8B" : "#C7CED8";

                  return (
                    <View key={String(row?.id)} style={styles.entryCard}>
                      <View style={styles.entryTopRow}>
                        <Text style={[styles.entryDirection, { color }]}>{direction}</Text>
                        <Text style={styles.entryAmount}>{usd(amount)}</Text>
                      </View>
                      <Text style={styles.entryCategory}>{category}</Text>
                      {row?.created_at ? (
                        <Text style={styles.entryMeta}>{new Date(row.created_at).toLocaleString("fr-FR")}</Text>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}

        {tab === "DEPOSITS" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>DEMANDES DE DÉPÔT</Text>

            {deposits.length === 0 ? (
              <Text style={styles.emptyText}>Aucune demande de dépôt.</Text>
            ) : (
              deposits.map((d: any) => {
                const busy = actingId === d.id;
                const status = upper(d?.status || "UNKNOWN");
                const canAct = status === "OPEN" || status === "PENDING";

                return (
                  <View key={d.id} style={styles.actionCard}>
                    <Text style={styles.actionTitle}>{upper(d?.user?.rp_name || "UNKNOWN USER")}</Text>
                    <Text style={styles.actionAmount}>{usd(getAmountCents(d))}</Text>
                    <Text style={styles.actionMeta}>STATUS: {status}</Text>
                    {d?.created_at ? <Text style={styles.actionMeta}>CRÉÉ: {new Date(d.created_at).toLocaleString("fr-FR")}</Text> : null}

                    {canAct ? (
                      <View style={styles.buttonRow}>
                        <Pressable
                          style={[styles.okBtn, busy && styles.disabledBtn]}
                          disabled={busy || !!actingId}
                          onPress={() =>
                            confirm("Valider le dépôt", "Confirmer le crédit wallet ?", () =>
                              runAction(
                                d.id,
                                () => staffApproveWalletDeposit({ staffId, depositRequestId: d.id }),
                                "Dépôt approuvé."
                              )
                            )
                          }
                        >
                          <Text style={styles.btnText}>{busy ? "..." : "APPROUVER"}</Text>
                        </Pressable>

                        <Pressable
                          style={[styles.noBtn, busy && styles.disabledBtn]}
                          disabled={busy || !!actingId}
                          onPress={() =>
                            confirm(
                              "Refuser le dépôt",
                              "Refuser cette demande ?",
                              () =>
                                runAction(
                                  d.id,
                                  () => staffRejectWalletDeposit({ staffId, depositRequestId: d.id }),
                                  "Dépôt refusé."
                                ),
                              true
                            )
                          }
                        >
                          <Text style={styles.btnText}>{busy ? "..." : "REFUSER"}</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {tab === "WITHDRAWS" ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>DEMANDES DE RETRAIT</Text>

            {withdraws.length === 0 ? (
              <Text style={styles.emptyText}>Aucune demande de retrait.</Text>
            ) : (
              withdraws.map((w: any) => {
                const busy = actingId === w.id;
                const status = upper(w?.status || "UNKNOWN");
                const isLocked = status === "LOCKED" || status === "OPEN" || status === "PENDING";
                const isProcessing = status === "PROCESSING";

                return (
                  <View key={w.id} style={styles.actionCard}>
                    <Text style={styles.actionTitle}>{upper(w?.user?.rp_name || "UNKNOWN USER")}</Text>
                    <Text style={styles.actionAmount}>{usd(getAmountCents(w))}</Text>
                    <Text style={styles.actionMeta}>STATUS: {status}</Text>
                    {w?.created_at ? <Text style={styles.actionMeta}>CRÉÉ: {new Date(w.created_at).toLocaleString("fr-FR")}</Text> : null}

                    <View style={styles.buttonRowWrap}>
                      {isLocked ? (
                        <Pressable
                          style={[styles.processingBtn, busy && styles.disabledBtn]}
                          disabled={busy || !!actingId}
                          onPress={() =>
                            confirm("Passer en traitement", "Marquer ce retrait comme en cours ?", () =>
                              runAction(
                                w.id,
                                () => staffMarkWithdrawProcessing({ staffId, withdrawRequestId: w.id }),
                                "Retrait passé en traitement."
                              )
                            )
                          }
                        >
                          <Text style={styles.btnText}>{busy ? "..." : "PROCESSING"}</Text>
                        </Pressable>
                      ) : null}

                      {isProcessing ? (
                        <Pressable
                          style={[styles.okBtn, busy && styles.disabledBtn]}
                          disabled={busy || !!actingId}
                          onPress={() =>
                            confirm("Marquer comme payé", "Confirmer que le retrait a été payé ?", () =>
                              runAction(
                                w.id,
                                () => staffMarkWithdrawPaid({ staffId, withdrawRequestId: w.id }),
                                "Retrait marqué comme payé."
                              )
                            )
                          }
                        >
                          <Text style={styles.btnText}>{busy ? "..." : "PAID"}</Text>
                        </Pressable>
                      ) : null}

                      {isLocked || isProcessing ? (
                        <Pressable
                          style={[styles.noBtn, busy && styles.disabledBtn]}
                          disabled={busy || !!actingId}
                          onPress={() =>
                            confirm("Refuser le retrait", "Refuser cette demande ?", () =>
                              runAction(
                                w.id,
                                () => staffRejectWithdraw({ staffId, withdrawRequestId: w.id }),
                                "Retrait refusé."
                              ),
                              true
                            )
                          }
                        >
                          <Text style={styles.btnText}>{busy ? "..." : "REJECT"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  Wrap: {
    flex: 1,
    backgroundColor: "#08111B",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  Text: { color: "#BFD0E0" },
  heroCard: {
    backgroundColor: "rgba(212,175,55,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.22)",
    borderRadius: 10,
    padding: 18,
    gap: 10,
  },
  heroEyebrow: { color: "#D4AF37", fontWeight: "900", fontSize: 12, letterSpacing: 1.5 },
  heroTitle: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  heroSubtitle: { color: "#D7E2EC", lineHeight: 20 },
  heroStatsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  heroStat: { flex: 1, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 8, padding: 12 },
  heroStatValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  heroStatLabel: { color: "#9EB2C6", fontSize: 11, marginTop: 4, fontWeight: "800" },
  positive: { color: "#7CFFB2" },
  negative: { color: "#FF8B8B" },
  quickRow: { flexDirection: "row", gap: 10 },
  quickCard: { flex: 1, backgroundColor: "#12202E", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#23384D" },
  quickValue: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  quickLabel: { color: "#8DA5BE", fontSize: 11, marginTop: 4, fontWeight: "800" },
  tabRow: { flexDirection: "row", gap: 10 },
  tabBtn: { flex: 1, backgroundColor: "#12202E", borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#23384D" },
  tabBtnActive: { backgroundColor: "#ec4900", borderColor: "#ec4900" },
  tabBtnText: { color: "#D7E2EC", fontWeight: "800", fontSize: 12 },
  tabBtnTextActive: { color: "#FFFFFF" },
  sectionCard: { backgroundColor: "#12202E", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#23384D", gap: 10 },
  sectionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "900" },
  moduleCard: { backgroundColor: "#0D1824", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#24394F", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  moduleTextWrap: { flex: 1, paddingRight: 10 },
  moduleTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  moduleSubtitle: { color: "#AFC4D8", fontSize: 13, marginTop: 4 },
  moduleArrow: { color: "#D4AF37", fontSize: 28, fontWeight: "900" },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0D1824", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#24394F" },
  breakdownLabel: { color: "#D7E2EC", fontWeight: "800" },
  breakdownValue: { color: "#FFFFFF", fontWeight: "900" },
  entryCard: { backgroundColor: "#0D1824", borderRadius: 8, padding: 12, borderWidth: 1, borderColor: "#24394F", gap: 4 },
  entryTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryDirection: { fontWeight: "900", fontSize: 12 },
  entryAmount: { color: "#FFFFFF", fontWeight: "900" },
  entryCategory: { color: "#D7E2EC", fontWeight: "800" },
  entryMeta: { color: "#8DA5BE", fontSize: 12 },
  emptyText: { color: "#8DA5BE" },
  actionCard: { backgroundColor: "#0D1824", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#24394F", gap: 6 },
  actionTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  actionAmount: { color: "#D4AF37", fontWeight: "900", fontSize: 18 },
  actionMeta: { color: "#AFC4D8", fontSize: 12 },
  buttonRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  buttonRowWrap: { flexDirection: "row", gap: 10, marginTop: 6, flexWrap: "wrap" },
  okBtn: { backgroundColor: "#1F7A45", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  noBtn: { backgroundColor: "#7A1F1F", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  processingBtn: { backgroundColor: "#345A7A", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 14, alignItems: "center" },
  btnText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  disabledBtn: { opacity: 0.55 },
});
