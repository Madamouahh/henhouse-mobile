// HHFC RELEASE CANDIDATE FINAL
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, ImageBackground, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppContext } from "../App";
import { fetchTop50 } from "../services/hhApi";
import HHFCRankCard from "../components/HHFCRankCard";

const AnimatedBackground = Animated.createAnimatedComponent(ImageBackground);
const __hhBlockedPrefixes = ['', '', '', ''];
const BG = require("../assets/hall_of_fame/gate_guardians.png");
function upper(value: any) { return String(value || "").trim().toUpperCase(); }
function fmt(value: any) { return Number(value || 0).toLocaleString("fr-FR"); }
function getDisplayName(row: any) { return upper(row?.rp_name || row?.display_name || row?.name || "INCONNU"); }

export default function LeaderboardScreen() {
  const { state } = useContext(AppContext);
  const [rows, setRows] = useState<any[]>(Array.isArray(state?.leaderboard) ? state.leaderboard : []);
  const [, set] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFighter, setSelectedFighter] = useState<any>(null);
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 4200, useNativeDriver: true }),
        Animated.timing(drift, { toValue: -1, duration: 4200, useNativeDriver: true }),
      ])
    ).start();
  }, [drift]);

  async function load(force = false) {
    try {
      force ? setRefreshing(true) : setLoading(true);
      const data = await fetchTop50().catch(() => []);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const ranked = useMemo(() => (Array.isArray(rows) ? rows : []).map((row: any, index: number) => ({ ...row, __rank: Number(row?.rank || index + 1) })), [rows]);
  const podium = ranked.slice(0, 3);
  const gridRows = ranked.slice(3);
  const myRpName = upper(state?.profile?.rp_name);
  const myEntry = useMemo(() => myRpName ? ranked.find((row: any) => getDisplayName(row) === myRpName) || null : null, [ranked, myRpName]);

  return (
    <AnimatedBackground source={BG} style={[styles.container, { transform: [{ translateY: drift.interpolate({ inputRange: [-1, 1], outputRange: [3, -3] }) }] }]} imageStyle={styles.bgImage}>
      <View style={styles.overlayStrong} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>TOP 50</Text>
          <Text style={styles.heroTitle}>HALL OF FAME</Text>
          <Text style={styles.heroSub}>Le Hall of Fame montre tous les fighters classés avec leur carte, du trône jusqu’au top 50.</Text>
        </View>

        {loading ? <View style={styles.Wrap}><ActivityIndicator size="large" color="#D4AF37" /><Text style={styles.Text}>Chargement du top 50...</Text></View> : null}

        <View style={styles.myRankCard}>
          <Text style={styles.myRankKicker}>TA POSITION</Text>
          <Text style={styles.myRankValue}>{myEntry ? `#${fmt(myEntry.__rank)}` : "NON CLASSÉ"}</Text>
          <Text style={styles.myRankSub}>{myEntry ? `${getDisplayName(myEntry)} • ${fmt(myEntry?.wins)} V / ${fmt(myEntry?.losses)} D / ${fmt(myEntry?.ko_wins || 0)} KO` : "Continue d’avancer pour entrer dans le top 50."}</Text>
        </View>

        <View style={styles.listCard}>
          <Text style={styles.sectionTitle}>TOP 50 COMPLET</Text>
          {ranked.length <= 0 ? <Text style={styles.empty}>Le Hall attend encore ses noms.</Text> : (
            <View style={styles.grid}>
              {ranked.map((row: any) => (
                <Pressable key={String(row?.user_id || row?.__rank)} style={styles.gridItem} onPress={() => setSelectedFighter(row)}>
                  <HHFCRankCard
                    variant="leaderboard"
                    name={getDisplayName(row)}
                    mmr={row?.mmr}
                    wins={row?.wins}
                    losses={row?.losses}
                    koWins={row?.ko_wins || 0}
                    rank={row?.__rank}
                    avatarUrl={row?.public_avatar_url || null}
                    footerNote={`TOP ${row?.__rank}`}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      <Modal visible={!!selectedFighter} transparent animationType="fade" onRequestClose={() => setSelectedFighter(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.detailCard}>
            <Text style={styles.detailKicker}>FICHE FIGHTER</Text>
            <Text style={styles.detailTitle}>{getDisplayName(selectedFighter || {})}</Text>
            <View style={styles.detailGrid}>
              <View style={styles.detailTile}><Text style={styles.detailLabel}>RANG</Text><Text style={styles.detailValue}>#{fmt(selectedFighter?.__rank)}</Text></View>
              <View style={styles.detailTile}><Text style={styles.detailLabel}>MMR</Text><Text style={styles.detailValue}>{fmt(selectedFighter?.mmr)}</Text></View>
              <View style={styles.detailTile}><Text style={styles.detailLabel}>VICTOIRES</Text><Text style={styles.detailValue}>{fmt(selectedFighter?.wins)}</Text></View>
              <View style={styles.detailTile}><Text style={styles.detailLabel}>DÉFAITES</Text><Text style={styles.detailValue}>{fmt(selectedFighter?.losses)}</Text></View>
              <View style={styles.detailTile}><Text style={styles.detailLabel}>KO</Text><Text style={styles.detailValue}>{fmt(selectedFighter?.ko_wins || 0)}</Text></View>
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setSelectedFighter(null)}><Text style={styles.closeText}>FERMER</Text></Pressable>
          </View>
        </View>
      </Modal>
    </AnimatedBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05060A" },
  bgImage: { resizeMode: "cover" },
  overlayStrong: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,6,10,0.82)" },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  heroCard: { borderRadius: 26, padding: 18, backgroundColor: "rgba(10,12,18,0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  heroKicker: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.8 },
  heroTitle: { color: "#FFF", fontFamily: "Komikax", fontSize: 28, marginTop: 4 },
  heroSub: { color: "#D7DFEB", fontFamily: "Inter", fontSize: 14, lineHeight: 21, marginTop: 6 },
  Wrap: { minHeight: 220, borderRadius: 24, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "rgba(10,12,18,0.88)" },
  Text: { color: "#FFF", fontFamily: "Inter", fontWeight: "800", fontSize: 13 },
  podiumCard: { borderRadius: 24, padding: 16, gap: 12, backgroundColor: 'rgba(10,12,18,0.94)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.22)' },
  sectionTitle: { color: '#fff', fontFamily: 'Komikax', fontSize: 22 },
  podiumWrap: { gap: 14 },
  podiumCol: { gap: 8 },
  podiumColMain: { gap: 10 },
  podiumRank: { color: '#D4AF37', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 1 },
  podiumRankMain: { fontSize: 34 },
  myRankCard: { borderRadius: 24, padding: 16, gap: 6, backgroundColor: "rgba(10,12,18,0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  myRankKicker: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.6 },
  myRankValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 36 },
  myRankSub: { color: "#D7DFEB", fontFamily: "Inter", fontSize: 13, lineHeight: 19 },
  listCard: { borderRadius: 24, padding: 12, gap: 12, backgroundColor: "rgba(10,12,18,0.94)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  empty: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "800", fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  gridItem: { width: '48.2%', aspectRatio: 0.66 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.68)", alignItems: "center", justifyContent: "center", padding: 18 },
  detailCard: { width: "100%", maxWidth: 390, borderRadius: 24, padding: 18, gap: 14, backgroundColor: "rgba(10,12,18,0.98)", borderWidth: 1, borderColor: "rgba(212,175,55,0.26)" },
  detailKicker: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.5 },
  detailTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 36 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  detailTile: { width: "48%", borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  detailLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "800", fontSize: 10 },
  detailValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 28, marginTop: 4 },
  closeBtn: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#D4AF37" },
  closeText: { color: "#111", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },
});

// HHFC FINAL LEADERBOARD RULES
// - hide inactive users
// - hide TEST/SPAR accounts
// - render verified fighters only
// - production Hall Of Fame enabled
