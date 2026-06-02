import React, { useContext, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppContext } from "../App";
import { financeCloseDay } from "../services/hhApi";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceCloseScreen() {
  const { state, setState } = useContext(AppContext);
  const [, set] = useState(false);
  const businessDate = state?.financeDay?.business_date || todayKey();
  const staffId = state?.staffSession?.staffId || state?.staffSession?.id || null;

  async function handleClose() {
    try {
      setLoading(true);
      const row = await financeCloseDay({ staffId, businessDate });
      setState((prev: any) => ({
        ...prev,
        financeDay: {
          ...(prev?.financeDay || {}),
          business_date: businessDate,
          report: row,
        },
      }));
      Alert.alert("Clôture effectuée", `Journée ${businessDate} clôturée.`);
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de clôturer la journée.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>CLÔTURE FINANCE</Text>
      <Text style={styles.sub}>Date : {businessDate}</Text>
      <Pressable style={[styles.btn,  && styles.btnDisabled]} onPress={handleClose} disabled={}>
        <Text style={styles.btnText}>{ ? "CLÔTURE..." : "CLÔTURER LA JOURNÉE"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0B0B0F", padding: 20, justifyContent: "center", gap: 14 },
  title: { color: "#FFF", fontFamily: "Bebas", fontSize: 30, textAlign: "center" },
  sub: { color: "#B9C0CD", textAlign: "center" },
  btn: { backgroundColor: "#ec4900", borderRadius: 8, paddingVertical: 16, alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#FFF", fontWeight: "900" },
});