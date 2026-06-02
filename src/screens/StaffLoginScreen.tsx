import React, { useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppContext } from "../App";
import { staffLogin } from "../services/hhApi";

function getTargetScreenByRole(role?: string) {
  const r = String(role || "").toUpperCase();
  if (r === "DOOR") return "DoorDashboard";
  if (r === "RING") return "RingDashboard";
  if (r === "FINANCE") return "FinanceDashboard";
  return "StaffDashboard";
}

const C = {
  card: "#111827",
  border: "#1F2937",
  text: "#FFF",
  muted: "#9CA3AF",
  cyan: "#5BE7FF",
  orange: "#ec4900",
};

export default function StaffLoginScreen({ navigation }: any) {
  const app = useContext(AppContext) || {};
  const setState = (app as any)?.setState;

  const [staffName, setStaffName] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [, set] = useState(false);

  const normalizedStaffName = useMemo(
    () => String(staffName || "").trim().toUpperCase(),
    [staffName]
  );

  async function login() {
    try {
      setMsg("");

      if (!normalizedStaffName) {
        setMsg("Entre ton identifiant staff.");
        return;
      }

      if (!pin || String(pin).trim().length < 2) {
        setMsg("Entre ton PIN.");
        return;
      }

      setLoading(true);

      const session = await staffLogin({
        staffName: normalizedStaffName,
        pin: String(pin).trim(),
        deviceLabel: "MOBILE_APP",
      });

      const safeRole = String(session?.role || "STAFF").toUpperCase();
      const safeToken =
        String(session?.token || "").trim() ||
        `LOCAL_SESSION_${normalizedStaffName}_${Date.now()}`;
      const safeStaffId =
        String(session?.staffId || session?.id || normalizedStaffName).trim() ||
        normalizedStaffName;

      if (typeof setState === "function") {
        setState((prev: any) => ({
          ...prev,
          staffSession: {
            token: safeToken,
            staffId: safeStaffId,
            id: safeStaffId,
            role: safeRole,
            staffName: session?.staffName || normalizedStaffName,
            startedAt: session?.startedAt || new Date().toISOString(),
            expiresAt: session?.expiresAt || null,
            deviceLabel: session?.deviceLabel || "MOBILE_APP",
          },
        }));
      }

      navigation.replace(getTargetScreenByRole(safeRole));
    } catch (e: any) {
      const errorMessage = e?.message || "Accès refusé.";
      setMsg(errorMessage);
      Alert.alert("Accès staff refusé", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={["#07080C", "#0A0A0F", "#10131B"]}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>HHFC OPS</Text>
          <Text style={styles.title}>STAFF ACCESS</Text>
          <Text style={styles.sub}>
            Connexion réservée aux équipes terrain, finance et direction.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>IDENTIFIANT</Text>
          <TextInput
            value={staffName}
            onChangeText={setStaffName}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="OWNER / DOOR / RING / FINANCE"
            TextColor="#6B7280"
            style={styles.input}
          />

          <Text style={styles.label}>PIN</Text>
          <TextInput
            value={pin}
            onChangeText={setPin}
            secureTextEntry
            keyboardType="number-pad"
           placeholder="PIN"
            TextColor="#6B7280"
            style={styles.input}
          />

          {msg ? <Text style={styles.error}>{msg}</Text> : null}

          <Pressable
            style={[styles.btn, loading && styles.disabled]}
            onPress={login}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0A0A0F" />
            ) : (
              <Text style={styles.btnText}>ENTER OPS</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.backBtn}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={styles.backBtnText}>RETOUR</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, justifyContent: "center", flexGrow: 1 },
  hero: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 20,
  },
  kicker: {
    color: C.cyan,
    fontFamily: "Inter",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  title: {
    color: C.text,
    fontFamily: "Bebas",
    fontSize: 40,
    letterSpacing: 0.8,
  },
  sub: {
    color: C.muted,
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  card: {
    marginTop: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 22,
    padding: 18,
  },
  label: {
    color: C.muted,
    fontFamily: "Inter",
    fontSize: 12,
    marginBottom: 8,
    letterSpacing: 1.1,
  },
  input: {
    backgroundColor: "#0D131D",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    color: C.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: "Inter",
    marginBottom: 12,
  },
  error: {
    color: "#FF7A7A",
    fontFamily: "Inter",
    fontSize: 13,
    marginBottom: 10,
  },
  btn: {
    marginTop: 8,
    backgroundColor: C.orange,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: {
    color: "#FFFFFF",
    fontFamily: "Bebas",
    fontSize: 22,
    letterSpacing: 0.8,
  },
  disabled: { opacity: 0.6 },
  backBtn: { marginTop: 12, alignItems: "center" },
  backBtnText: {
    color: C.cyan,
    fontFamily: "Inter",
    fontSize: 13,
    letterSpacing: 1.1,
  },
});
