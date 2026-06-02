import React, { useContext } from "react";
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppContext } from "../App";
import { playSound } from "../services/sound";

const BG = require("../assets/backgrounds/hh_intro_bg.jpg");
const GRAIN = require("../assets/fx/grain.png");
const OVERLAY = require("../assets/fx/overlay_dark.png");

function launchLabel(value?: string) {
  if (!value) return "MARDI 28 AVRIL • 19H00";
  try {
    return new Date(value).toLocaleString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).toUpperCase().replace(',', ' •');
  } catch {
    return "MARDI 28 AVRIL • 19H00";
  }
}

export default function PrelaunchScreen({ navigation }: any) {
  const { state } = useContext(AppContext);
  const openingAt = state?.preopen?.openingAt;
  const onboardingDone = !!state?.preopen?.onboardingDone;

  return (
    <ImageBackground source={BG} style={styles.container} imageStyle={styles.bgImage}>
      <Image source={OVERLAY} style={styles.overlayArt} resizeMode="cover" />
      <Image source={GRAIN} style={styles.grain} resizeMode="cover" />
      <View style={styles.shade} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>HHFC PRE-LAUNCH</Text>
        <Text style={styles.title}>LIGUE OUVERTE MARDI</Text>
        <Text style={styles.date}>{launchLabel(openingAt)}</Text>
        <Text style={styles.sub}>Cette semaine tu poses ton identité, ton wallet, tes fights, tes tickets et tes paris. Mardi 28 avril à 19H, le ring s’ouvre.</Text>

        <View style={styles.grid}>
          <View style={styles.card}><Text style={styles.cardTitle}>FIGHT</Text><Text style={styles.cardText}>Réserve ton créneau pour mardi</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>BET</Text><Text style={styles.cardText}>Pose tes tickets avant le show</Text></View>
          <View style={styles.card}><Text style={styles.cardTitle}>BOOKMAKER</Text><Text style={styles.cardText}>Dépose ton dossier réseau</Text></View>
        </View>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            playSound?.("confirm");
            navigation.replace(onboardingDone ? "Profile" : "Start");
          }}
        >
          <Text style={styles.primaryBtnText}>{onboardingDone ? "CONTINUER MA PRÉPA" : "ENTRER"}</Text>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05060A" },
  bgImage: { resizeMode: "cover" },
  overlayArt: { ...StyleSheet.absoluteFillObject, opacity: 0.22 },
  grain: { ...StyleSheet.absoluteFillObject, opacity: 0.12 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3,4,8,0.60)" },
  content: { flexGrow: 1, justifyContent: "center", padding: 22, gap: 14 },
  kicker: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", letterSpacing: 2, fontSize: 11 },
  title: { color: "#FFF", fontFamily: "Komikax", fontSize: 28 },
  date: { color: "#FFF", fontFamily: "Bebas", fontSize: 28, letterSpacing: 0.8 },
  sub: { color: "#E7EAF0", fontFamily: "Inter", fontSize: 15, lineHeight: 22 },
  grid: { gap: 10, marginTop: 8 },
  card: { borderRadius: 18, padding: 16, backgroundColor: "rgba(8,10,16,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  cardTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 24 },
  cardText: { color: "#C7D0DD", marginTop: 4, fontFamily: "Inter", fontSize: 14 },
  primaryBtn: { marginTop: 10, minHeight: 58, borderRadius: 18, backgroundColor: "#ec4900", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { color: "#FFF", fontFamily: "Komikax", fontSize: 14 },
});
