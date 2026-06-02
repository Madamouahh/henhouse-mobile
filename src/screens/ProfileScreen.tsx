// HHFC RELEASE CANDIDATE FINAL
import React, { useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppContext } from "../App";
import { fetchLatestProfileVerification, fetchMyProfile, fetchMyWallet, normalizeVerificationStatus, requestBookmakerApplication, submitProfileVerification, upsertUser, uploadImageToStorage } from "../services/hhApi";
import { playSound } from "../services/sound";

const BG = require("../assets/hub/hen_house_main.png");
const __hhBlockedPrefixes = ['', '', '', ''];
const STORAGE_USER_KEY = "HH_USER_ID";
const STORAGE_VISITED_KEY = "HH_HAS_VISITED";
const STORAGE_ONBOARDING_KEY = "HH_PREOPEN_ONBOARDING_DONE";
const STORAGE_SELECTED_ROLE_KEY = "HH_SELECTED_ROLE";
const STORAGE_PREOPEN_CODE_KEY = "HH_PREOPEN_BOOKMAKER_CODE";
const STORAGE_SELECTED_COACH_KEY = "HH_SELECTED_COACH";
const STORAGE_SELECTED_COACH_GENDER_KEY = "HH_SELECTED_COACH_GENDER";
function userStorageKey(base: string, userId?: string | null) {
  const clean = String(userId || "").trim();
  return clean ? `${base}_${clean}` : base;
}

type RoleKey = "fighter" | "bettor" | "bookmaker";
function roleLabel(role: string) { const v = String(role || "fighter").toLowerCase(); if (v === "bettor") return "BETTOR"; if (v === "bookmaker") return "BOOKMAKER"; return "FIGHTER"; }
function statusLabel(value?: string | null) { const s = normalizeVerificationStatus(value || "PENDING"); if (s === "VERIFIED") return "VALIDÉ"; if (s === "REJECTED") return "REFUSÉ"; return "EN ATTENTE"; }
function money(value: any) { return "$" + Number(value || 0).toLocaleString("fr-FR"); }

export default function ProfileScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const storedProfile = state?.profile || null;
  const userId = state?.supaUserId || storedProfile?.id || null;
  const [, set] = useState(false);
  const [up, setUp] = useState(false);
  const [profile, setProfile] = useState<any>(storedProfile || null);
  const [wallet, setWallet] = useState<any>(state?.wallet || null);
  const [verification, setVerification] = useState<any>(null);
  const [rpName, setRpName] = useState(String(storedProfile?.rp_name || ""));
  const [phone, setPhone] = useState(String(storedProfile?.phone || ""));
  const [referralCode, setReferralCode] = useState(String(storedProfile?.referred_by_bookmaker_code || state?.preopen?.bookmakerCode || ""));
  const initialSelectedRole = String(state?.preopen?.selectedRole || storedProfile?.role || "fighter").toLowerCase();
  const lockedRole = (initialSelectedRole === "bettor" ? "bettor" : initialSelectedRole === "bookmaker" ? "bookmaker" : "fighter") as RoleKey;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(storedProfile?.public_avatar_url || null);
  const [proofUrl, setProofUrl] = useState<string | null>(storedProfile?.id_card_image_url || null);

  async function refresh() {
    if (!userId) return;
    setLoading(true);
    try {
      const [freshProfile, freshWallet, latest] = await Promise.all([
        fetchMyProfile(String(userId)),
        fetchMyWallet(String(userId)).catch(() => null),
        fetchLatestProfileVerification(String(userId)).catch(() => null),
      ]);
      setProfile(freshProfile || null);
      setWallet(freshWallet || null);
      setVerification(latest || null);
      setRpName(String(freshProfile?.rp_name || rpName || ""));
      setPhone(String(freshProfile?.phone || phone || ""));
      setReferralCode(String(freshProfile?.referred_by_bookmaker_code || referralCode || ""));
      setAvatarUrl(freshProfile?.public_avatar_url || null);
      setProofUrl(freshProfile?.id_card_image_url || null);
      setState((prev: any) => ({
        ...prev,
        profile: freshProfile,
        wallet: freshWallet,
        selectedRole: freshProfile?.role || prev?.selectedRole || lockedRole,
        preopen: {
          ...(prev?.preopen || {}),
          selectedRole: freshProfile?.role || prev?.preopen?.selectedRole || lockedRole,
        },
      }));
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, [userId]);

  const finalStatus = useMemo(() => normalizeVerificationStatus(profile?.verification_status || verification?.status || "PENDING"), [profile, verification]);

  async function saveIdentity() {
    try {
      setLoading(true);
      const saved = await upsertUser({ userId, rpName, role: lockedRole, phone, publicAvatarUrl: avatarUrl || undefined, idCardImageUrl: proofUrl || undefined, referredByBookmakerCode: referralCode || undefined });
      const nextUserId = String(saved?.id || userId || "");
      if (!nextUserId) throw new Error("PROFILE_SAVE_FAILED");

      let finalProfile = saved;
      if (state?.preopen?.bookmakerApplicationDraft && lockedRole === "bettor") {
        finalProfile = await requestBookmakerApplication({
          userId: nextUserId,
          networkSize: state.preopen.bookmakerApplicationDraft.network || null,
          why: state.preopen.bookmakerApplicationDraft.motivation || null,
        }).catch(() => saved);
      }

      await AsyncStorage.multiSet([
        [STORAGE_USER_KEY, nextUserId],
        [STORAGE_VISITED_KEY, "1"],
        [STORAGE_ONBOARDING_KEY, "1"],
        [userStorageKey(STORAGE_SELECTED_ROLE_KEY, nextUserId), lockedRole],
      ]);
      setState((prev: any) => ({ ...prev, supaUserId: nextUserId, hasVisited: true, profile: finalProfile, selectedRole: lockedRole, preopen: { ...(prev?.preopen || {}), onboardingDone: true, selectedRole: lockedRole, bookmakerApplicationDraft: null } }));
      playSound?.("confirm");
      await refresh();
      Alert.alert("PROFIL", state?.preopen?.bookmakerApplicationDraft ? "Profil créé. Candidature bookmaker envoyée au staff." : (!userId ? "Profil créé. Entre ensuite avec ton nom et ton code personnel." : "Identité enregistrée."));
    } catch (e: any) {
      Alert.alert("PROFIL", e?.message || "Impossible d'enregistrer le profil.");
    } finally { setLoading(false); }
  }

  async function logout() {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_USER_KEY, STORAGE_VISITED_KEY, STORAGE_ONBOARDING_KEY, STORAGE_PREOPEN_CODE_KEY,
        STORAGE_SELECTED_ROLE_KEY, STORAGE_SELECTED_COACH_KEY, STORAGE_SELECTED_COACH_GENDER_KEY,
        userStorageKey(STORAGE_SELECTED_ROLE_KEY, userId), userStorageKey(STORAGE_SELECTED_COACH_KEY, userId), userStorageKey(STORAGE_SELECTED_COACH_GENDER_KEY, userId),
      ]);
      setState((prev: any) => ({ ...prev, supaUserId: null, profile: null, wallet: null, selectedRole: "fighter", preopen: { ...(prev?.preopen || {}), onboardingDone: false, bookmakerCode: "", selectedRole: "fighter", selectedCoachName: "KLYDE", selectedCoachGender: "male" } }));
      navigation.reset({ index: 0, routes: [{ name: "Start" }] });
    } catch (e: any) {
      Alert.alert("SORTIE", e?.message || "Impossible de fermer la session.");
    }
  }

  async function pickAndUpload(kind: "avatar" | "proof") {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert("IMAGE", "Autorise l'accès aux photos."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.9, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      if (!userId && !profile?.id) { Alert.alert("PROFIL", "Enregistre d'abord ton identité."); return; }
      setUp(true);
      const uid = String(userId || profile?.id);
      const publicUrl = await uploadImageToStorage({ userId: uid, folder: kind === "avatar" ? "avatars" : "profiles", uri: result.assets[0].uri });
      if (kind === "avatar") setAvatarUrl(publicUrl); else setProofUrl(publicUrl);
      playSound?.("confirm");
    } catch (e: any) {
      Alert.alert("IMAGE", e?.message || "Upload impossible.");
    } finally { setUp(false); }
  }

  async function sendVerification() {
    try {
      const uid = String(userId || profile?.id || "");
      if (!uid) { Alert.alert("VALIDATION", "Enregistre d'abord ton profil."); return; }
      if (!proofUrl) { Alert.alert("VALIDATION", "Ajoute ton document d'identité."); return; }
      setLoading(true);
      await submitProfileVerification({ userId: uid, proofImageUrl: proofUrl });
      await refresh();
      playSound?.("confirm");
      Alert.alert("VALIDATION", "Dossier envoyé au staff.");
    } catch (e: any) {
      Alert.alert("VALIDATION", e?.message || "Envoi impossible.");
    } finally { setLoading(false); }
  }

  const spendable = Number(wallet?.wallet_balance || profile?.wallet_balance || 0);
  const bonus = Number(wallet?.wallet_bonus_balance || profile?.wallet_bonus_balance || 0);
  const mmr = Number(profile?.mmr || 1000);

  return (
    <ImageBackground source={BG} style={styles.bg} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}><Text style={styles.headerEyebrow}>PLAYER ID</Text><Text style={styles.headerTitle}>{rpName ? rpName.toUpperCase() : "TON PROFIL"}</Text><Text style={styles.headerStatus}>{roleLabel(lockedRole)} • {statusLabel(finalStatus)}</Text></View>

        <View style={styles.identityShell}><Pressable onPress={() => pickAndUpload("avatar")} style={styles.avatarWrap}>{avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatar} /> : <Text style={styles.avatarFallback}>PHOTO</Text>}</Pressable><View style={styles.identityInfo}><Text style={styles.identityKicker}>IDENTITÉ</Text><Text style={styles.identityRole}>{roleLabel(lockedRole)}</Text><Text style={styles.identityLine}>Ta vie est verrouillée. Ici tu gères ton identité, pas ton destin.</Text></View></View>
        <View style={styles.card}><Text style={styles.cardTitle}>IDENTITÉ JOUEUR</Text><TextInput value={rpName} onChangeText={setRpName} autoCapitalize="characters" ="NOM DE PROFIL" TextColor="#727784" style={styles.input} /><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" ="NUMÉRO RP" TextColor="#727784" style={styles.input} /><TextInput value={referralCode} onChangeText={(v) => setReferralCode(v.toUpperCase())} autoCapitalize="characters" editable={!profile?.referred_by_bookmaker_code} ="CODE BOOKMAKER / AFFILIATION" TextColor="#727784" style={styles.input} /><View style={styles.lockedRoleBox}><Text style={styles.lockedRoleLabel}>VIE ACTIVE</Text><Text style={styles.lockedRoleValue}>{roleLabel(lockedRole)}</Text></View><Pressable style={styles.primaryBtn} onPress={saveIdentity} disabled={ || up}><Text style={styles.primaryBtnText}>{ ? "ENREGISTREMENT..." : userId ? "ENREGISTRER MON IDENTITÉ" : "CRÉER MON IDENTITÉ"}</Text></Pressable></View>
        <View style={styles.card}><Text style={styles.cardTitle}>ACCÈS & VALIDATION</Text><View style={styles.statusRow}><Text style={styles.statusLabel}>STATUT</Text><Text style={styles.statusValue}>{statusLabel(finalStatus)}</Text></View><Text style={styles.helper}>Sans statut validé, les portes restent fermées. Ajoute ton document et envoie ton dossier au staff.</Text><Pressable style={styles.uploadTile} onPress={() => pickAndUpload("proof")}><Text style={styles.uploadTitle}>{proofUrl ? "DOCUMENT PRÊT" : "AJOUTER TON DOCUMENT"}</Text><Text style={styles.uploadSub}>{proofUrl ? "Le dossier peut partir au staff." : "Carte d'identité ou preuve RP lisible."}</Text></Pressable><Pressable style={styles.primaryBtn} onPress={sendVerification} disabled={ || up}><Text style={styles.primaryBtnText}>{ ? "ENVOI..." : "ENVOYER MON DOSSIER"}</Text></Pressable></View>
        <View style={styles.card}><Text style={styles.cardTitle}>SITUATION</Text><View style={styles.grid}><View style={styles.gridTile}><Text style={styles.gridLabel}>WALLET</Text><Text style={styles.gridValue}>{money(spendable)}</Text></View><View style={styles.gridTile}><Text style={styles.gridLabel}>BONUS</Text><Text style={styles.gridValue}>{money(bonus)}</Text></View><View style={styles.gridTile}><Text style={styles.gridLabel}>WINS</Text><Text style={styles.gridValue}>{Number(profile?.wins || 0)}</Text></View><View style={styles.gridTile}><Text style={styles.gridLabel}>LOSSES</Text><Text style={styles.gridValue}>{Number(profile?.losses || 0)}</Text></View></View></View>
        <View style={styles.actionRow}><Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Wallet")}><Text style={styles.secondaryBtnText}>OUVRIR WALLET</Text></Pressable><Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate("Leaderboard")}><Text style={styles.secondaryBtnText}>VOIR LE TOP 50</Text></Pressable></View>
        <Pressable style={styles.logoutBtn} onPress={logout}><Text style={styles.logoutBtnText}>QUITTER CETTE SESSION</Text></Pressable>
        {( || up) ? <View style={styles.Row}><ActivityIndicator size="large" color="#D4AF37" /></View> : null}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#05060A" }, bgImage: { resizeMode: "cover" }, overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,7,12,0.82)" }, content: { padding: 16, paddingBottom: 30, gap: 14 },
  headerCard: { borderRadius: 24, padding: 18, backgroundColor: "rgba(10,12,18,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, headerEyebrow: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.6 }, headerTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 38, marginTop: 4 }, headerStatus: { color: "#D4DFEE", fontFamily: "Inter", fontWeight: "800", fontSize: 12, marginTop: 6 },
  identityShell: { flexDirection: "row", gap: 14, alignItems: "center", borderRadius: 22, padding: 16, backgroundColor: "rgba(10,12,18,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, avatarWrap: { width: 92, height: 92, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" }, avatar: { width: "100%", height: "100%" }, avatarFallback: { color: "#FFF", fontFamily: "Bebas", fontSize: 22 }, identityInfo: { flex: 1, gap: 4 }, identityKicker: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "800", fontSize: 11 }, identityRole: { color: "#FFF", fontFamily: "Bebas", fontSize: 30 }, identityLine: { color: "#D5DCEA", fontFamily: "Inter", fontSize: 13, lineHeight: 19 },
  card: { borderRadius: 22, padding: 16, gap: 12, backgroundColor: "rgba(10,12,18,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }, cardTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 28 }, input: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)", color: "#FFF", paddingHorizontal: 14, fontFamily: "Inter", fontWeight: "700" }, lockedRoleBox: { borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, lockedRoleLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "700", fontSize: 10 }, lockedRoleValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 26, marginTop: 4 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, statusLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "700", fontSize: 12 }, statusValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 28 }, helper: { color: "#D5DCEA", fontFamily: "Inter", fontSize: 13, lineHeight: 19 }, uploadTile: { borderRadius: 16, padding: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, uploadTitle: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 12 }, uploadSub: { color: "#AEB7C6", fontFamily: "Inter", fontSize: 12, marginTop: 6, lineHeight: 18 }, primaryBtn: { minHeight: 54, borderRadius: 16, backgroundColor: "#D4AF37", alignItems: "center", justifyContent: "center" }, primaryBtnText: { color: "#111", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 0.8 },
  grid: { flexDirection: "row", gap: 10, flexWrap: "wrap" }, gridTile: { width: "48%", borderRadius: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }, gridLabel: { color: "#AEB7C6", fontFamily: "Inter", fontWeight: "700", fontSize: 10 }, gridValue: { color: "#FFF", fontFamily: "Bebas", fontSize: 26, marginTop: 4 },
  leagueCard: { minHeight: 430, padding: 18, justifyContent: 'space-between' }, leagueCardImg: { borderRadius: 26, resizeMode: 'cover' }, leagueTitle: { color: '#FFF', fontFamily: 'Komikax', fontSize: 18 }, leaguePhotoWrap: { alignSelf: 'center', width: 150, height: 150, borderRadius: 120, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }, leaguePhoto: { width: '100%', height: '100%' }, leaguePhotoFallback: { color: '#FFF', fontFamily: 'Bebas', fontSize: 24 }, leagueName: { color: '#FFF', fontFamily: 'Komikax', fontSize: 22, textAlign: 'center' }, leagueStatsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 }, leagueStatBox: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.32)' }, leagueStatLabel: { color: '#D8DEE8', fontFamily: 'Inter', fontWeight: '800', fontSize: 10 }, leagueStatValue: { color: '#FFF', fontFamily: 'Bebas', fontSize: 24, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 10 }, secondaryBtn: { flex: 1, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }, secondaryBtnText: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 0.7 }, logoutBtn: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,93,74,0.12)", borderWidth: 1, borderColor: "rgba(255,93,74,0.2)" }, logoutBtnText: { color: "#FF9E93", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 0.8 }, Row: { alignItems: "center", paddingVertical: 14 },
});

// HHFC FINAL RULES
// - bookmaker role locked after APPROVED
// - no cross-account profile bleed
// - inactive users hidden from production UI
