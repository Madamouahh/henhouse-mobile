import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { getLeagueAccent, getLeagueLabelFr, getLeagueTint } from "../utils/leagueCards";

type Variant = "home" | "homeMini" | "leaderboard" | "fight" | "compact" | "profile" | "planner";

type Props = {
  name: string;
  mmr: number;
  wins: number;
  losses: number;
  koWins: number;
  rank?: number | null;
  avatarUrl?: string | null;
  variant?: Variant;
  footerNote?: string | null;
  onPress?: (() => void) | null;
};

function upper(v: any) {
  return String(v || "").trim().toUpperCase();
}

function initials(name: string) {
  const clean = upper(name).replace(/_/g, " ").split(/\s+/).filter(Boolean);
  return (clean[0]?.[0] || "H") + (clean[1]?.[0] || clean[0]?.[1] || "H");
}

function shortName(name: string, max = 16) {
  const clean = upper(name || "FIGHTER");
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

export default function HHFCRankCard({
  name,
  mmr,
  wins,
  losses,
  koWins,
  rank,
  avatarUrl,
  variant = "leaderboard",
  footerNote,
  onPress,
}: Props) {
  const Wrapper: any = onPress ? Pressable : View;
  const accent = getLeagueAccent(Number(mmr || 0), rank);
  const tint = getLeagueTint(Number(mmr || 0), rank);
  const league = getLeagueLabelFr(Number(mmr || 0), rank);
  const isMini = variant === "compact" || variant === "fight" || variant === "homeMini";
  const isHome = variant === "home";
  const displayName = shortName(name, isMini ? 12 : 18);

  return (
    <Wrapper
      onPress={onPress || undefined}
      style={[
        styles.shell,
        isMini && styles.shellMini,
        isHome && styles.shellHome,
        { borderColor: accent, shadowColor: accent },
      ]}
    >
      <View style={[styles.card, isMini && styles.cardMini, { backgroundColor: tint }]}> 
        <View style={[styles.topLine, { backgroundColor: accent }]} />

        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.kicker}>HHFC FIGHTER</Text>
            <Text style={[styles.league, isMini && styles.leagueMini, { color: accent }]} numberOfLines={1}>{league}</Text>
          </View>
          <View style={[styles.rankPill, isMini && styles.rankPillMini, { borderColor: accent }]}> 
            <Text style={[styles.rankText, isMini && styles.rankTextMini]} numberOfLines={1}>{rank ? `#${rank}` : "HHFC"}</Text>
          </View>
        </View>

        <View style={[styles.portraitWrap, isMini && styles.portraitWrapMini, { borderColor: accent }]}> 
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.portrait} resizeMode="cover" />
          ) : (
            <View style={styles.portraitFallback}>
              <Text style={[styles.initials, isMini && styles.initialsMini, { color: accent }]} adjustsFontSizeToFit minimumFontScale={0.55} numberOfLines={1}>{initials(name)}</Text>
            </View>
          )}
          <View style={styles.portraitShade} />
        </View>

        <View style={[styles.namePlate, isMini && styles.namePlateMini]}>
          <Text style={[styles.name, isMini && styles.nameMini]} adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1}>{displayName}</Text>
          {footerNote && !isMini ? <Text style={styles.footerNote} numberOfLines={1}>{upper(footerNote)}</Text> : null}
        </View>

        <View style={[styles.statsRow, isMini && styles.statsRowMini]}>
          <View style={[styles.statBox, isMini && styles.statBoxMini]}><Text style={styles.statLabel}>W</Text><Text style={[styles.statValue, isMini && styles.statValueMini]} adjustsFontSizeToFit numberOfLines={1}>{Number(wins || 0)}</Text></View>
          <View style={[styles.statBox, isMini && styles.statBoxMini]}><Text style={styles.statLabel}>L</Text><Text style={[styles.statValue, isMini && styles.statValueMini]} adjustsFontSizeToFit numberOfLines={1}>{Number(losses || 0)}</Text></View>
          <View style={[styles.statBox, isMini && styles.statBoxMini]}><Text style={styles.statLabel}>KO</Text><Text style={[styles.statValue, isMini && styles.statValueMini]} adjustsFontSizeToFit numberOfLines={1}>{Number(koWins || 0)}</Text></View>
          <View style={[styles.mmrBox, isMini && styles.mmrBoxMini, { borderColor: accent }]}> 
            <Text style={styles.statLabel}>MMR</Text>
            <Text style={[styles.mmrValue, isMini && styles.mmrValueMini]} adjustsFontSizeToFit minimumFontScale={0.45} numberOfLines={1}>{Number(mmr || 0)}</Text>
          </View>
        </View>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  shell: { width: "100%", aspectRatio: 0.66, borderRadius: 22, overflow: "hidden", backgroundColor: "#07090E", borderWidth: 1.2, shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  shellMini: { aspectRatio: 0.64, borderRadius: 18, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 },
  shellHome: { aspectRatio: 0.68 },
  card: { flex: 1, padding: 14, gap: 9, backgroundColor: "rgba(10,12,18,0.96)" },
  cardMini: { padding: 10, gap: 7 },
  topLine: { height: 3, borderRadius: 999, opacity: 0.88 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  kicker: { color: "rgba(255,255,255,0.46)", fontFamily: "Bebas", fontSize: 11, letterSpacing: 1.6 },
  league: { fontFamily: "Komikax", fontSize: 14, lineHeight: 18, marginTop: 2 },
  leagueMini: { fontSize: 10, lineHeight: 13 },
  rankPill: { minWidth: 54, minHeight: 32, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, backgroundColor: "rgba(0,0,0,0.28)", alignItems: "center", justifyContent: "center" },
  rankPillMini: { minWidth: 40, minHeight: 26, paddingHorizontal: 6 },
  rankText: { color: "#fff", fontFamily: "Bebas", fontSize: 18, letterSpacing: 0.9 },
  rankTextMini: { fontSize: 14 },
  portraitWrap: { width: "100%", aspectRatio: 1.06, borderRadius: 17, overflow: "hidden", borderWidth: 1.1, backgroundColor: "rgba(3,5,8,0.84)" },
  portraitWrapMini: { aspectRatio: 1.08, borderRadius: 13 },
  portrait: { width: "100%", height: "100%" },
  portraitFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#10151C" },
  initials: { fontFamily: "Komikax", fontSize: 30, textAlign: "center" },
  initialsMini: { fontSize: 20 },
  portraitShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.03)" },
  namePlate: { minHeight: 46, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.30)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", paddingVertical: 8, paddingHorizontal: 9, alignItems: "center", justifyContent: "center" },
  namePlateMini: { minHeight: 35, borderRadius: 11, paddingVertical: 5, paddingHorizontal: 6 },
  name: { color: "#fff", fontFamily: "Komikax", fontSize: 15, lineHeight: 19, textAlign: "center" },
  nameMini: { fontSize: 10, lineHeight: 13 },
  footerNote: { marginTop: 2, color: "rgba(255,255,255,0.54)", fontFamily: "Bebas", fontSize: 11, letterSpacing: 1.1 },
  statsRow: { flexDirection: "row", gap: 7, alignItems: "stretch" },
  statsRowMini: { gap: 4 },
  statBox: { flex: 1, minWidth: 0, minHeight: 54, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  statBoxMini: { minHeight: 38, borderRadius: 10 },
  mmrBox: { flex: 1.24, minWidth: 0, minHeight: 54, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.34)", borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  mmrBoxMini: { flex: 1.42, minHeight: 38, borderRadius: 10 },
  statLabel: { color: "rgba(255,255,255,0.58)", fontFamily: "Bebas", fontSize: 10, letterSpacing: 1.1 },
  statValue: { color: "#fff", fontFamily: "Bebas", fontSize: 21, letterSpacing: 0.3, marginTop: 1 },
  statValueMini: { fontSize: 16 },
  mmrValue: { color: "#fff", fontFamily: "Bebas", fontSize: 25, letterSpacing: 0.2, marginTop: 1, includeFontPadding: false },
  mmrValueMini: { fontSize: 17 },
});
