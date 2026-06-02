import React, { useContext, useMemo, useState } from "react";
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppContext } from "../App";
import { walletRequestWithdraw } from "../services/hhApi";
import { playSound } from "../services/sound";

const BG = require("../assets/hub/hen_house_main.png");
const CASHIER = require("../assets/wallet/western_cashier.png");
const PRESETS = [50000, 100000, 250000, 500000];
const GRAIN = require("../assets/fx/grain.png");
const OVERLAY = require("../assets/fx/overlay_dark.png");

function money(v: any) {
  return "$" + Number(v || 0).toLocaleString("fr-FR");
}

function parseAmount(value: string) {
  const raw = String(value || "").replace(/\s+/g, "").replace(/,/g, "").trim();
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num);
}

export default function WithdrawScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const userId = state?.supaUserId || state?.profile?.id || null;
  const wallet = state?.wallet || {};

  const [amount, setAmount] = useState("");
  const [, set] = useState(false);

  const amountCents = useMemo(() => parseAmount(amount), [amount]);
  const cashAvailable = Math.max(Number(wallet?.wallet_balance || 0) - Number(wallet?.wallet_locked_balance || 0), 0);

  async function submit() {
    if (!userId) return navigation.navigate("Profile");
    if (amountCents < 50000) {
      return Alert.alert("Montant invalide", "Le retrait minimum est de 50 000.");
    }
    if (amountCents > cashAvailable) {
      return Alert.alert("Montant trop élevé", "Le retrait ne peut pas dépasser ton cash disponible.");
    }

    try {
      playSound("confirm");
      setLoading(true);

      await walletRequestWithdraw({
        userId,
        amountCents,
        payoutMethod: "HEN_HOUSE_RP_VALIDATION",
        note: "Demande de retrait créée depuis l'application mobile",
      });

      setState((prev: any) => ({
        ...prev,
        wallet: {
          ...(prev?.wallet || {}),
          pending_withdraw: Number(prev?.wallet?.pending_withdraw || 0) + amountCents,
        },
        lastFinanceSync: Date.now(),
      }));

      Alert.alert(
        "Demande envoyée",
        "Ton retrait a été enregistré. Passe au Hen House pour récupérer ton cash avec le staff."
      );
      navigation.navigate("Wallet");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Impossible de créer la demande de retrait.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ImageBackground source={BG} style={styles.bg} imageStyle={styles.bgImage}>
        <Image source={OVERLAY} style={styles.overlayArt} resizeMode="cover" />
        <Image source={GRAIN} style={styles.grain} resizeMode="cover" />

        <Image source={CASHIER} style={styles.character} resizeMode="contain" />

        <View style={styles.topShade} />
        <View style={styles.bottomShade} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.kicker}>CAISSE • RETRAIT</Text>
            <Text style={styles.title}>SORTIR DU CASH</Text>
            <Text style={styles.sub}>
              Tu demandes ici. Tu viens le récupérer au Hen House quand le staff te valide.
            </Text>
          </View>

          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              “Tu retires déjà ? Fais ça proprement. J’ai pas toute la nuit.”
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>MONTANT</Text>
            <Text style={styles.available}>DISPONIBLE {money(cashAvailable)}</Text>

            <View style={styles.presetRow}>
              {PRESETS.map((value) => (
                <Pressable
                  key={value}
                  style={[styles.preset, amountCents === value && styles.presetActive]}
                  onPress={() => {
                    playSound("tap");
                    setAmount(String(value));
                  }}
                >
                  <Text style={[styles.presetText, amountCents === value && styles.presetTextActive]}>
                    {money(value)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={amount}
              onChangeText={setAmount}
  placeholder="Entrer un montant"
              TextColor="#9AA4B2"
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>PROCESSUS</Text>
            <Text style={styles.step}>1. Tu envoies la demande sur l'app</Text>
            <Text style={styles.step}>2. Le staff prépare le retrait</Text>
            <Text style={styles.step}>3. Tu récupères le cash au Hen House</Text>
          </View>

          <Pressable style={[styles.primaryBtn,  && styles.disabled]} onPress={submit} disabled={}>
            <Text style={styles.primaryBtnText}>{ ? "ENVOI..." : "ENVOYER LA DEMANDE"}</Text>
          </Pressable>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05060A" },
  bg: { flex: 1 },
  bgImage: { opacity: 1 },
  overlayArt: { ...StyleSheet.absoluteFillObject, opacity: 0.28 },
  grain: { ...StyleSheet.absoluteFillObject, opacity: 0.16 },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "26%",
    backgroundColor: "rgba(4,5,9,0.32)",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "38%",
    backgroundColor: "rgba(4,5,9,0.42)",
  },
  character: {
    position: "absolute",
    left: -18,
    bottom: -8,
    width: "72%",
    height: "88%",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 34,
    gap: 14,
  },
  hero: {
    width: "66%",
    gap: 8,
  },
  kicker: {
    color: "#D4AF37",
    fontFamily: "SourceSans3",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Komikax",
    fontSize: 30,
  },
  sub: {
    color: "#E7EAF0",
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 20,
  },
  bubble: {
    alignSelf: "flex-end",
    width: "70%",
    marginTop: 6,
    backgroundColor: "rgba(8,10,16,0.58)",
    borderColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  bubbleText: {
    color: "#FFFFFF",
    fontFamily: "SourceSans3",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  card: {
    alignSelf: "flex-end",
    width: "68%",
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(8,10,16,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    gap: 12,
  },
  section: {
    color: "#FFFFFF",
    fontFamily: "Bebas",
    fontSize: 24,
    letterSpacing: 1,
  },
  available: {
    color: "#F7D97C",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "700",
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  preset: {
    minWidth: "46%",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  presetActive: {
    backgroundColor: "rgba(212,175,55,0.16)",
    borderColor: "rgba(212,175,55,0.42)",
  },
  presetText: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  presetTextActive: {
    color: "#F7D97C",
  },
  input: {
    minHeight: 56,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  step: {
    color: "#F3F5F8",
    fontFamily: "Inter",
    fontSize: 15,
    lineHeight: 22,
  },
  primaryBtn: {
    alignSelf: "flex-end",
    width: "68%",
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  disabled: { opacity: 0.55 },
  primaryBtnText: {
    color: "#0B0F17",
    fontFamily: "Bebas",
    fontSize: 21,
    letterSpacing: 1,
  },
});
