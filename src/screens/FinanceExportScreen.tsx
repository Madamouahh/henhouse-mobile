import React, { useContext, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppContext } from "../App";
import { financeBuildExport } from "../services/hhApi";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function upper(v: any) {
  return String(v || "").toUpperCase();
}

// ✅ FIX ICI
function countLines(csv: string) {
  const lines = String(csv || "")
    .split("\n") // ← CORRECTION
    .map((x) => x.trim())
    .filter(Boolean);
  return Math.max(0, lines.length - 1);
}

export default function FinanceExportScreen({ route, navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const [, set] = useState(false);
  const [csv, setCsv] = useState("");

  const initialDate =
    route?.params?.businessDate ||
    state?.financeDay?.business_date ||
    todayKey();

  const [dateFrom, setDateFrom] = useState(initialDate);
  const [dateTo, setDateTo] = useState(initialDate);

  const lineCount = useMemo(() => countLines(csv), [csv]);
  const financeStatus = upper(state?.financeDay?.report?.status || "OPEN");

  async function handleBuild() {
    try {
      setLoading(true);
      const result = await financeBuildExport({
        dateFrom,
        dateTo,
        limit: 1000,
      });

      const nextCsv = String(result?.csv || "");
      setCsv(nextCsv);

      setState((prev: any) => ({
        ...prev,
        financeExport: {
          dateFrom,
          dateTo,
          csv: nextCsv,
          rowCount: countLines(nextCsv),
          At: new Date().toISOString(),
        },
      }));
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de générer l’export.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>EXPORT FINANCE</Text>
      <Text style={styles.sub}>
        Période : {dateFrom} → {dateTo}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Date de début</Text>
        <TextInput
          value={dateFrom}
          onChangeText={setDateFrom}
  placeholder="YYYY-MM-DD"
          TextColor="#73849A"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Date de fin</Text>
        <TextInput
          value={dateTo}
          onChangeText={setDateTo}
  placeholder="YYYY-MM-DD"
          TextColor="#73849A"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{financeStatus}</Text>
            <Text style={styles.kpiLabel}>STATUT JOUR</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{lineCount}</Text>
            <Text style={styles.kpiLabel}>LIGNES CSV</Text>
          </View>
        </View>

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.btn,  && styles.btnDisabled]}
            onPress={handleBuild}
            disabled={}
          >
            <Text style={styles.btnText}>
              { ? "GÉNÉRATION..." : "GÉNÉRER CSV"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() =>
              navigation.navigate("FinanceDay", {
                businessDate: dateFrom,
              })
            }
          >
            <Text style={styles.secondaryBtnText}>
              RETOUR FINANCE DAY
            </Text>
          </Pressable>
        </View>
      </View>

      {!!csv && (
        <ScrollView style={styles.box} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.csv}>{csv}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#0B0B0F",
    padding: 20,
    gap: 14,
  },
  title: {
    color: "#FFF",
    fontFamily: "Bebas",
    fontSize: 30,
    textAlign: "center",
  },
  sub: {
    color: "#B9C0CD",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#111823",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#23384D",
    padding: 16,
    gap: 10,
  },
  label: {
    color: "#8EA2B8",
    fontSize: 12,
  },
  input: {
    backgroundColor: "#0D141D",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#243A4F",
    color: "#FFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#0D141D",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#22384C",
    padding: 14,
    alignItems: "center",
  },
  kpiValue: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 18,
  },
  kpiLabel: {
    color: "#8EA2B8",
    marginTop: 6,
    fontSize: 11,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 6,
  },
  btn: {
    flexGrow: 1,
    backgroundColor: "#ec4900",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: "#FFF",
    fontWeight: "900",
  },
  secondaryBtn: {
    flexGrow: 1,
    backgroundColor: "#162434",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#27415A",
  },
  secondaryBtnText: {
    color: "#FFF",
    fontWeight: "800",
  },
  box: {
    flex: 1,
    backgroundColor: "#111823",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#23384D",
  },
  csv: {
    color: "#D7E2EC",
    fontSize: 12,
    lineHeight: 18,
  },
});