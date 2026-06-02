import React from "react";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export const COLORS = {
  bg: "#05060A",
  bgSoft: "#0B0F17",
  bgPanel: "#10151F",
  surface: "rgba(14,18,28,0.94)",
  surfaceSoft: "rgba(255,255,255,0.04)",
  line: "rgba(255,255,255,0.08)",
  lineStrong: "rgba(255,255,255,0.14)",
  text: "#F5F7FF",
  muted: "#9CA3AF",
  orange: "#ec4900",
  orangeSoft: "rgba(236,73,0,0.16)",
  gold: "#D4AF37",
  goldSoft: "rgba(212,175,55,0.16)",
  cyan: "#5BE7FF",
  red: "#FF3B30",
  green: "#39FF14",
};

export function formatCasinoAmount(value: number | string) {
  const amount = Number(value || 0);
  return "$" + amount.toLocaleString("en-US");
}

export function formatHHFCStack(value: number | string) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";
  if (Math.abs(amount) >= 1000) return `${Math.round(amount / 1000)}K`;
  return String(Math.round(amount));
}

export function Screen({
  children,
  padded = true,
}: {
  children: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, !padded && { paddingHorizontal: 0, paddingTop: 0 }]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function PremiumCard({
  children,
  accent = COLORS.orange,
  style,
}: {
  children: React.ReactNode;
  accent?: string;
  style?: any;
}) {
  return (
    <View style={[styles.card, { borderColor: `${accent}33`, shadowColor: accent }, style]}>
      {children}
    </View>
  );
}

export function Kicker({
  children,
  color = COLORS.cyan,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return <Text style={[styles.kicker, { color }]}>{children}</Text>;
}

export function Title({
  children,
  size = 34,
  color = COLORS.text,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
}) {
  return <Text style={[styles.title, { fontSize: size, color }]}>{children}</Text>;
}

export function Body({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

export function StatBox({
  label,
  value,
  accent = COLORS.orange,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={[styles.statBox, { borderColor: `${accent}33` }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  color = COLORS.orange,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryBtn, { backgroundColor: color }, disabled && styles.disabled]}>
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  color = COLORS.text,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.secondaryBtn, { borderColor: `${color}33` }, disabled && styles.disabled]}>
      <Text style={[styles.secondaryBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function PremiumInput(props: any) {
  return <TextInput TextColor={COLORS.muted} {...props} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 34 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  kicker: {
    fontFamily: "Inter",
    fontSize: 12,
    letterSpacing: 1.6,
  },
  title: {
    fontFamily: "BebasNeue",
    letterSpacing: 0.8,
  },
  body: {
    color: COLORS.muted,
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 21,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statLabel: {
    color: COLORS.muted,
    fontFamily: "Inter",
    fontSize: 11,
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: "BebasNeue",
    fontSize: 26,
    marginTop: 6,
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: "BebasNeue",
    fontSize: 22,
    letterSpacing: 0.8,
  },
  secondaryBtn: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontFamily: "BebasNeue",
    fontSize: 20,
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.lineStrong,
    backgroundColor: COLORS.surfaceSoft,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontFamily: "Inter",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.56,
  },
});
