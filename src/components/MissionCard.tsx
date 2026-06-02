import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  code: string;
  title: string;
  text: string;
  cta: string;
  accent: string;
  onPress: () => void;
  progress?: number;
  progressTarget?: number;
  reward?: string;
  weeklyLabel?: string;
};

export default function MissionCard({ code, title, text, cta, accent, onPress, progress = 0, progressTarget = 1, reward, weeklyLabel }: Props) {
  const safeTarget = Math.max(1, Number(progressTarget || 1));
  const safeProgress = Math.max(0, Number(progress || 0));
  const pct = Math.max(6, Math.min(100, Math.round((safeProgress / safeTarget) * 100)));

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.code, { color: accent }]}>{code}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        {weeklyLabel ? <Text style={styles.weekly}>{weeklyLabel}</Text> : null}
      </View>

      <Text style={styles.text}>{text}</Text>

      {reward ? (
        <View style={[styles.rewardBox, { borderColor: `${accent}66`, backgroundColor: `${accent}18` }]}>
          <Text style={styles.rewardLabel}>RÉCOMPENSE</Text>
          <Text style={styles.rewardValue}>{reward}</Text>
        </View>
      ) : null}

      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>PROGRESSION</Text>
        <Text style={styles.progressValue}>{safeProgress}/{safeTarget}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accent }]} />
      </View>

      <Pressable style={[styles.btn, { backgroundColor: accent }]} onPress={onPress}>
        <Text style={styles.btnText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 26, padding: 18, backgroundColor: "rgba(8,10,16,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  code: { fontFamily: "SourceSans3", fontWeight: "900", fontSize: 11, letterSpacing: 1.8 },
  title: { color: "#FFFFFF", fontFamily: "Komikax", fontSize: 24, marginTop: 8 },
  weekly: { color: "#B3BDD0", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  text: { color: "#D3D9E4", fontFamily: "SourceSans3", fontWeight: "700", fontSize: 15, lineHeight: 22, marginTop: 8 },
  rewardBox: { marginTop: 14, borderRadius: 16, padding: 12, borderWidth: 1 },
  rewardLabel: { color: "#98A4B7", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  rewardValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 22, marginTop: 4 },
  progressHeader: { marginTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { color: "#9CA8BA", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  progressValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 18 },
  progressTrack: { height: 12, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", marginTop: 8 },
  progressFill: { height: "100%", borderRadius: 999 },
  btn: { minHeight: 56, marginTop: 16, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#05060A", fontFamily: "Komikax", fontSize: 15, textAlign: "center" },
});
