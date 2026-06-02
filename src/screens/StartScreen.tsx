import React, { useContext, useMemo, useRef, useState } from "react";
import { Alert, Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppContext } from "../App";
import { fetchMyProfile, fetchMyWallet, findUserByRpName, loginWithProfileCode } from "../services/hhApi";
import { playSound } from "../services/sound";

const HUB_BG = require("../assets/hub/hen_house_main.png");
const __hhBlockedPrefixes = ['', '', '', ''];
const INTRO_VIDEO = require("../assets/video/hh_intro.mp4");
const STORAGE_USER_KEY = "HH_USER_ID";
const STORAGE_VISITED_KEY = "HH_HAS_VISITED";
const STORAGE_ONBOARDING_KEY = "HH_PREOPEN_ONBOARDING_DONE";
const STORAGE_SELECTED_COACH_KEY = "HH_SELECTED_COACH";
const STORAGE_SELECTED_ROLE_KEY = "HH_SELECTED_ROLE";
const STORAGE_SELECTED_COACH_GENDER_KEY = "HH_SELECTED_COACH_GENDER";

type RoleKey = "fighter" | "bettor" | "bookmaker";
type CoachStyleKey = "style_a" | "style_b";

const ROLES: Record<RoleKey, { title: string; accent: string; image: any; line: string; action: string }> = {
  fighter: { title: "BAGARREUR", accent: "#FF5D4A", image: require("../assets/univers/fight.png"), line: "Tu veux parler avec tes poings.", action: "ENTRER DANS LA CAGE" },
  bettor: { title: "PARIEUR", accent: "#D8B24A", image: require("../assets/univers/bet.png"), line: "Tu vois ce que les autres ratent.", action: "DEVENIR PARIEUR" },
  bookmaker: { title: "BOOKMAKER", accent: "#8D71FF", image: require("../assets/univers/bookmaker.png"), line: "Tu contrôles le flux.", action: "CRÉER TON RÉSEAU" },
};

const COACHES: Record<RoleKey, Record<CoachStyleKey, { name: string; gender: "male" | "female"; image: any; line: string }>> = {
  fighter: {
    style_a: { name: "KLYDE", gender: "male", image: require("../assets/characters/fight_bg_male.png"), line: "Ici tu montes pour tenir. Pas pour parler." },
    style_b: { name: "NYX", gender: "female", image: require("../assets/characters/fight_bg_female.png"), line: "Quand tu entres, plus personne ne te protège." },
  },
  bettor: {
    style_a: { name: "MILO", gender: "male", image: require("../assets/characters/bet_bg_male.png"), line: "Lis la card. Prends seulement ce qui paie." },
    style_b: { name: "MARIA", gender: "female", image: require("../assets/characters/bet_bg_female.png"), line: "L'argent suit les yeux patients." },
  },
  bookmaker: {
    style_a: { name: "RAZOR", gender: "male", image: require("../assets/characters/bookmaker_bg_male.png"), line: "Un réseau ne pardonne jamais le flou." },
    style_b: { name: "SCAR", gender: "female", image: require("../assets/characters/bookmaker_bg_female.png"), line: "Le vrai pouvoir tient dans le volume." },
  },
};

function defaultCoachForRole(role: RoleKey) {
  return COACHES[role]?.style_a || COACHES.fighter.style_a;
}

export default function StartScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const [showIntro, setShowIntro] = useState(true);
  const [mode, setMode] = useState<"hub" | "login" | "recovery" | "role" | "coach" | "bookmakerApply">("hub");
  const [rpName, setRpName] = useState("");
  const [code, setCode] = useState("");
  const [codeConfirm, setCodeConfirm] = useState("");
  const [, set] = useState(false);
  const [loginStage, setLoginStage] = useState<"lookup" | "enter" | "create">("lookup");
  const [matchedProfile, setMatchedProfile] = useState<any>(null);
  const [recoveryText, setRecoveryText] = useState("");
  const [bookmakerNetwork, setBookmakerNetwork] = useState("");
  const [bookmakerMotivation, setBookmakerMotivation] = useState("");
  const hiddenTapCount = useRef(0);

  const initialRole = String(state?.profile?.role || state?.preopen?.selectedRole || "fighter").toLowerCase();
  const [selectedRole, setSelectedRole] = useState<RoleKey>(initialRole === "bettor" ? "bettor" : initialRole === "bookmaker" ? "bookmaker" : "fighter");
  const [selectedStyle, setSelectedStyle] = useState<CoachStyleKey>("style_a");
  const coach = COACHES[selectedRole][selectedStyle];
  const savedName = String(state?.profile?.rp_name || "").toUpperCase();

  function openHiddenStaffAccess() {
    hiddenTapCount.current += 1;
    if (hiddenTapCount.current >= 5) {
      hiddenTapCount.current = 0;
      navigation.navigate("StaffLogin");
    }
  }

  const entryLabel = useMemo(() => {
    if (state?.profile?.id) return savedName || "TON IDENTITÉ";
    return "ACCÈS HEN HOUSE";
  }, [savedName, state?.profile?.id]);

  async function handleLogin() {
    try {
      const cleanRpName = rpName.trim().toUpperCase();
      if (!cleanRpName) {
        Alert.alert("ACCÈS", "Entre ton nom de profil.");
        return;
      }

      setLoading(true);
      const existing = await findUserByRpName(cleanRpName);
      setMatchedProfile(existing || null);

      if (!existing?.id) {
        setLoginStage("lookup");
        Alert.alert("ACCÈS", "Profil introuvable. Crée ton profil d'abord.");
        return;
      }

      if (!existing?.access_code_hash) {
        setLoginStage("create");
        if (!code.trim() || !codeConfirm.trim()) {
          Alert.alert("CRÉER TON CODE", "Ce profil existe, mais aucun code n'est encore défini. Saisis et confirme un code, puis fais valider la création côté support/staff.");
          return;
        }
        if (code.trim() !== codeConfirm.trim()) {
          Alert.alert("CRÉER TON CODE", "Les deux codes ne correspondent pas.");
          return;
        }
        Alert.alert("CRÉER TON CODE", "Le profil existe bien, mais la création du code doit encore être branchée proprement côté backend. Pour continuer immédiatement, fais initialiser le code via le support/staff.");
        return;
      }

      setLoginStage("enter");
      if (!code.trim()) {
        Alert.alert("ACCÈS", "Entre ton code personnel.");
        return;
      }

      const baseUser = await loginWithProfileCode(cleanRpName, code.trim());
      const [profile, wallet] = await Promise.all([
        fetchMyProfile(String(baseUser.id)),
        fetchMyWallet(String(baseUser.id)).catch(() => null),
      ]);
      const rawRole = String(profile?.role || selectedRole || "fighter").toLowerCase();
      const role = (rawRole === "bettor" ? "bettor" : rawRole === "bookmaker" ? "bookmaker" : "fighter") as RoleKey;
      const roleCoach = defaultCoachForRole(role);
      await AsyncStorage.multiSet([
        [STORAGE_USER_KEY, String(baseUser.id)],
        [STORAGE_VISITED_KEY, "1"],
        [STORAGE_ONBOARDING_KEY, "1"],
        [STORAGE_SELECTED_ROLE_KEY, role],
        [STORAGE_SELECTED_COACH_KEY, roleCoach.name],
        [STORAGE_SELECTED_COACH_GENDER_KEY, roleCoach.gender],
      ]);
      setState((prev: any) => ({
        ...prev,
        supaUserId: String(baseUser.id),
        hasVisited: true,
        profile,
        wallet,
        selectedRole: role,
        selectedCoachName: roleCoach.name,
        selectedCoachGender: roleCoach.gender,
        preopen: {
          ...(prev?.preopen || {}),
          onboardingDone: true,
          selectedRole: role,
          selectedCoachName: roleCoach.name,
          selectedCoachGender: roleCoach.gender,
          bookmakerCode: profile?.referred_by_bookmaker_code || "",
        },
      }));
      playSound?.("confirm");
      setMode("hub");
    } catch (e: any) {
      Alert.alert("ACCÈS", e?.message || "Nom ou code incorrect.");
    } finally {
      setLoading(false);
    }
  }

  async function continueWithSelection() {
    try {
      setLoading(true);
      await AsyncStorage.multiSet([
        [STORAGE_VISITED_KEY, "1"],
        [STORAGE_ONBOARDING_KEY, "1"],
        [STORAGE_SELECTED_COACH_KEY, coach.name],
        [STORAGE_SELECTED_ROLE_KEY, selectedRole],
        [STORAGE_SELECTED_COACH_GENDER_KEY, coach.gender],
      ]);
      setState((prev: any) => ({
        ...prev,
        hasVisited: true,
        selectedCoachName: coach.name,
        selectedCoachGender: coach.gender,
        preopen: {
          ...(prev?.preopen || {}),
          onboardingDone: true,
          selectedRole,
          selectedCoachName: coach.name,
          selectedCoachGender: coach.gender,
          entryMissionStarted: true,
        },
      }));
      playSound?.("confirm");
      navigation.navigate("Profile");
    } finally {
      setLoading(false);
    }
  }

  if (showIntro) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <Video source={INTRO_VIDEO} style={StyleSheet.absoluteFillObject} shouldPlay resizeMode={ResizeMode.COVER} isLooping={false} />
        <Pressable style={styles.skipVideoBtn} onPress={() => setShowIntro(false)}><Text style={styles.skipVideoText}>PASSER LA VIDÉO</Text></Pressable>
        <View style={styles.videoShade} />
        <View style={styles.videoFooter}>
          <Text style={styles.videoTitle}>HEN HOUSE</Text>
          <Text style={styles.videoSub}>DIAMOND FIGHT CLUB</Text>
          <Pressable style={styles.enterButton} onPress={() => setShowIntro(false)}>
            <Text style={styles.enterButtonText}>ENTRER</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ImageBackground source={HUB_BG} style={styles.bg} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />
      <Pressable style={styles.hiddenStaffHotspot} onLongPress={() => navigation.navigate("StaffLogin")} delayLongPress={700} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onLongPress={() => navigation.navigate("StaffLogin")} onPress={openHiddenStaffAccess} delayLongPress={700}><Text style={styles.brand}>HEN HOUSE</Text></Pressable>
        <Text style={styles.subtitle}>DIAMOND FIGHT CLUB</Text>

        {mode === "hub" && (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>PORTAIL</Text>
            <Text style={styles.panelTitle}>{entryLabel}</Text>
            <Text style={styles.panelBody}>
              {state?.profile?.id
                ? "Ton identité est reconnue. Traverse le sas et entre proprement dans ton monde."
                : "Choisis comment tu entres : reprendre ton compte ou créer ta vie."}
            </Text>

            {state?.profile?.id ? (
              <Pressable style={styles.mainCta} onPress={() => navigation.replace("Home")}>
                <Text style={styles.mainCtaText}>ENTRER DANS LE JEU</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.secondaryCta} onPress={() => setMode("login")}>
              <Text style={styles.secondaryCtaText}>REPRENDRE MON COMPTE</Text>
            </Pressable>
            <Pressable style={styles.ghostCta} onPress={() => setMode("recovery")}>
              <Text style={styles.ghostCtaText}>J’AI PERDU MON CODE</Text>
            </Pressable>
            {!state?.profile?.id ? (
              <Pressable style={styles.ghostCta} onPress={() => setMode("role")}>
                <Text style={styles.ghostCtaText}>CRÉER MON PROFIL</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {mode === "recovery" && (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>SUPPORT HEN HOUSE</Text>
            <Text style={styles.panelTitle}>RÉCUPÉRER MON COMPTE</Text>
            <Text style={styles.panelBody}>
              Si tu as perdu ton code, envoie une demande au Hen House. Le staff vérifiera ton identité avant de réactiver l’accès.
            </Text>
            <TextInput value={rpName} onChangeText={setRpName} autoCapitalize="characters" ="NOM DE PROFIL" TextColor="#7B7F8A" style={styles.input} />
            <TextInput value={recoveryText} onChangeText={setRecoveryText} multiline ="MESSAGE AU HEN HOUSE : téléphone, preuve, détails..." TextColor="#7B7F8A" style={[styles.input, styles.textArea]} />
            <Pressable
              style={styles.mainCta}
              onPress={() => {
                Alert.alert("DEMANDE ENVOYÉE", "Ta demande est prête pour le staff Hen House. Présente-toi avec une preuve d’identité pour récupérer ton accès.");
                setMode("hub");
              }}
            >
              <Text style={styles.mainCtaText}>ENVOYER LA DEMANDE</Text>
            </Pressable>
            <Pressable style={styles.backLink} onPress={() => setMode("hub")}>
              <Text style={styles.backLinkText}>RETOUR</Text>
            </Pressable>
          </View>
        )}

        {mode === "login" && (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>REPRISE</Text>
            <Text style={styles.panelTitle}>{loginStage === "create" ? "CRÉER TON CODE" : "NOM + CODE"}</Text>
            <Text style={styles.panelBody}>
              {loginStage === "create"
                ? "Le profil existe déjà, mais aucun code n'est encore défini. Saisis et confirme un code pour préparer l'accès."
                : "Entre ton nom de profil. Si un code existe déjà, tu pourras entrer directement."}
            </Text>
            <TextInput value={rpName} onChangeText={(v) => { setRpName(v); setMatchedProfile(null); setLoginStage("lookup"); }} autoCapitalize="characters" ="NOM DE PROFIL" TextColor="#7B7F8A" style={styles.input} />
            <TextInput value={code} onChangeText={setCode} secureTextEntry ={loginStage === "create" ? "NOUVEAU CODE" : "CODE PERSONNEL"} TextColor="#7B7F8A" style={styles.input} />
            {loginStage === "create" ? (
              <TextInput value={codeConfirm} onChangeText={setCodeConfirm} secureTextEntry ="CONFIRMER LE CODE" TextColor="#7B7F8A" style={styles.input} />
            ) : null}
            {matchedProfile?.id ? (
              <Text style={styles.helperText}>
                Profil trouvé : {String(matchedProfile?.rp_name || "").toUpperCase()} • {matchedProfile?.access_code_hash ? "CODE EXISTANT" : "CODE À CRÉER"}
              </Text>
            ) : null}
            <Pressable style={styles.mainCta} onPress={handleLogin} disabled={}>
              <Text style={styles.mainCtaText}>{ ? "ENTRÉE..." : loginStage === "create" ? "PRÉPARER LE CODE" : "ENTRER"}</Text>
            </Pressable>
            <Pressable style={styles.backLink} onPress={() => setMode("hub")}>
              <Text style={styles.backLinkText}>RETOUR</Text>
            </Pressable>
          </View>
        )}

        {mode === "role" && (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>CHOIX DE VIE</Text>
            <Text style={styles.panelTitle}>{ROLES[selectedRole].title}</Text>
            <Text style={styles.panelBody}>{ROLES[selectedRole].line}</Text>
            {(["fighter", "bettor", "bookmaker"] as RoleKey[]).map((role) => {
              const meta = ROLES[role];
              const active = selectedRole === role;
              return (
                <Pressable key={role} style={[styles.roleCard, active && { borderColor: meta.accent }]} onPress={() => setSelectedRole(role)}>
                  <View style={[styles.roleImageBox, { backgroundColor: `${meta.accent}22` }]}>
                    <Image source={meta.image} style={styles.roleImage} resizeMode="contain" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleTitle, { color: meta.accent }]}>{meta.title}</Text>
                    <Text style={styles.roleLine}>{role === "bookmaker" ? "Poste sur candidature. Réseau requis." : meta.line}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable style={styles.mainCta} onPress={() => selectedRole === "bookmaker" ? setMode("bookmakerApply") : setMode("coach")}>
              <Text style={styles.mainCtaText}>{selectedRole === "bookmaker" ? "POSTULER BOOKMAKER" : ROLES[selectedRole].action}</Text>
            </Pressable>
            <Pressable style={styles.backLink} onPress={() => setMode("hub")}>
              <Text style={styles.backLinkText}>RETOUR</Text>
            </Pressable>
          </View>
        )}

        {mode === "bookmakerApply" && (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>CANDIDATURE</Text>
            <Text style={styles.panelTitle}>BOOKMAKER</Text>
            <Text style={styles.panelBody}>
              Bookmaker est un poste validé par le Hen House. Explique ton réseau, combien de personnes tu peux ramener et pourquoi tu peux générer du volume.
            </Text>
            <TextInput value={bookmakerNetwork} onChangeText={setBookmakerNetwork} ="TAILLE DU RÉSEAU / PERSONNES MOBILISABLES" TextColor="#7B7F8A" style={styles.input} />
            <TextInput value={bookmakerMotivation} onChangeText={setBookmakerMotivation} multiline ="MOTIVATIONS, PLAN, CONTACTS, BUSINESS..." TextColor="#7B7F8A" style={[styles.input, styles.textArea]} />
            <Pressable
              style={styles.mainCta}
              onPress={async () => {
                const draft = { network: bookmakerNetwork, motivation: bookmakerMotivation };
                await AsyncStorage.multiSet([
                  [STORAGE_VISITED_KEY, "1"],
                  [STORAGE_ONBOARDING_KEY, "1"],
                  [STORAGE_SELECTED_ROLE_KEY, "bettor"],
                  [STORAGE_SELECTED_COACH_KEY, COACHES.bettor.style_a.name],
                  [STORAGE_SELECTED_COACH_GENDER_KEY, COACHES.bettor.style_a.gender],
                ]);
                setState((prev: any) => ({
                  ...prev,
                  hasVisited: true,
                  selectedRole: "bettor",
                  selectedCoachName: COACHES.bettor.style_a.name,
                  selectedCoachGender: COACHES.bettor.style_a.gender,
                  preopen: {
                    ...(prev?.preopen || {}),
                    onboardingDone: true,
                    selectedRole: "bettor",
                    requestedUniverse: "bookmaker",
                    selectedCoachName: COACHES.bettor.style_a.name,
                    selectedCoachGender: COACHES.bettor.style_a.gender,
                    bookmakerApplicationDraft: draft,
                  },
                }));
                Alert.alert("CANDIDATURE", "Crée ton identité joueur. Le dossier bookmaker partira au staff après l’enregistrement du profil.");
                navigation.navigate("Profile");
              }}
            >
              <Text style={styles.mainCtaText}>ENVOYER MA CANDIDATURE</Text>
            </Pressable>
            <Pressable style={styles.backLink} onPress={() => setMode("role")}>
              <Text style={styles.backLinkText}>RETOUR</Text>
            </Pressable>
          </View>
        )}

        {mode === "coach" && (
          <View style={styles.panel}>
            <Text style={styles.panelKicker}>TON COACH</Text>
            <Text style={styles.panelTitle}>{coach.name}</Text>
            <Image source={coach.image} style={styles.coachImage} />
            <Text style={styles.panelBody}>{coach.line}</Text>
            <View style={styles.switchRow}>
              <Pressable style={[styles.switchChip, selectedStyle === "style_a" && styles.switchChipActive]} onPress={() => setSelectedStyle("style_a")}>
                <Text style={styles.switchChipText}>{COACHES[selectedRole].style_a.name}</Text>
              </Pressable>
              <Pressable style={[styles.switchChip, selectedStyle === "style_b" && styles.switchChipActive]} onPress={() => setSelectedStyle("style_b")}>
                <Text style={styles.switchChipText}>{COACHES[selectedRole].style_b.name}</Text>
              </Pressable>
            </View>
            <Pressable style={styles.mainCta} onPress={continueWithSelection} disabled={}>
              <Text style={styles.mainCtaText}>{ ? "OUVERTURE..." : "CRÉER MON PROFIL"}</Text>
            </Pressable>
            <Pressable style={styles.backLink} onPress={() => setMode("role")}>
              <Text style={styles.backLinkText}>RETOUR</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#020306" },
  bgImage: { resizeMode: "cover" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,6,10,0.24)" },
  hiddenStaffHotspot: { position: "absolute", top: 0, right: 0, width: 70, height: 70, zIndex: 5 },
  videoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" },
  content: { flexGrow: 1, justifyContent: "flex-end", padding: 18, paddingTop: 110, paddingBottom: 30, gap: 16 },
  brand: { color: "#FFF", fontFamily: "Bebas", fontSize: 42, letterSpacing: 2 },
  subtitle: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "800", letterSpacing: 1.2, fontSize: 12, marginTop: -6 },
  panel: { borderRadius: 26, padding: 18, gap: 12, backgroundColor: "rgba(10,12,18,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  panelKicker: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 1.7 },
  panelTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 34 },
  panelBody: { color: "#D5DCEA", fontFamily: "Inter", fontSize: 14, lineHeight: 21 },
  mainCta: { minHeight: 56, borderRadius: 16, backgroundColor: "#D4AF37", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  mainCtaText: { color: "#111", fontFamily: "Inter", fontWeight: "900", fontSize: 13, letterSpacing: 0.9 },
  secondaryCta: { minHeight: 54, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  secondaryCtaText: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 0.9 },
  ghostCta: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ghostCtaText: { color: "#C7CEDA", fontFamily: "Inter", fontWeight: "800", fontSize: 12, letterSpacing: 0.8 },
  input: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)", color: "#FFF", paddingHorizontal: 14, fontFamily: "Inter", fontWeight: "700" }, textArea: { minHeight: 118, paddingTop: 14, textAlignVertical: "top" },
  backLink: { paddingVertical: 8, alignItems: "center" },
  backLinkText: { color: "#C5CEDB", fontFamily: "Inter", fontWeight: "800", fontSize: 12, letterSpacing: 0.8 },
  roleCard: { minHeight: 86, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.03)", padding: 12, gap: 12, flexDirection: "row", alignItems: "center" },
  roleImageBox: { width: 76, height: 76, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center" }, roleImage: { width: 76, height: 76 },
  roleTitle: { fontFamily: "Bebas", fontSize: 26 },
  roleLine: { color: "#D5DCEA", fontFamily: "Inter", fontSize: 13, lineHeight: 19 },
  coachImage: { width: "100%", height: 240, borderRadius: 20, resizeMode: "cover" },
  switchRow: { flexDirection: "row", gap: 10 },
  switchChip: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.04)" },
  switchChipActive: { borderColor: "#D4AF37", backgroundColor: "rgba(212,175,55,0.14)" },
  switchChipText: { color: "#FFF", fontFamily: "Inter", fontWeight: "900", fontSize: 12 },
  skipVideoBtn: { position: "absolute", top: 48, right: 18, zIndex: 10, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(0,0,0,0.58)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  skipVideoText: { color: "#fff", fontFamily: "Inter", fontWeight: "900", fontSize: 11, letterSpacing: 0.8 },
  videoFooter: { position: "absolute", left: 18, right: 18, bottom: 34, alignItems: "center", gap: 8 },
  videoTitle: { color: "#FFF", fontFamily: "Bebas", fontSize: 44, letterSpacing: 2 },
  videoSub: { color: "#D4AF37", fontFamily: "Inter", fontWeight: "900", fontSize: 12, letterSpacing: 1.4 },
  enterButton: { minWidth: 220, minHeight: 58, borderRadius: 16, backgroundColor: "rgba(212,175,55,0.96)", alignItems: "center", justifyContent: "center", marginTop: 10 },
  enterButtonText: { color: "#101114", fontFamily: "Bebas", fontSize: 24, letterSpacing: 1 },
});
