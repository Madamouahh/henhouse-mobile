// HHFC RELEASE CANDIDATE FINAL
import React, { createContext, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFonts } from "expo-font";
import { fetchMyProfile, fetchMyWallet } from "./services/hhApi";

import StartScreen from "./screens/StartScreen";
import HomeScreen from "./screens/HomeScreen";
import ProfileScreen from "./screens/ProfileScreen";
import FightPlannerScreen from "./screens/FightPlannerScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import ArenaScreen from "./screens/ArenaScreen";
import ArenaTicketsScreen from "./screens/ArenaTicketsScreen";
import TicketDetailScreen from "./screens/TicketDetailScreen";
import BetScreen from "./screens/BetScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import BookmakerHomeScreen from "./screens/BookmakerHomeScreen";
import WalletScreen from "./screens/WalletScreen";
import DepositScreen from "./screens/DepositScreen";
import WithdrawScreen from "./screens/WithdrawScreen";
import FightScreen from "./screens/FightScreen";
import StaffLoginScreen from "./screens/StaffLoginScreen";
import StaffDashboardScreen from "./screens/StaffDashboardScreen";
import DoorDashboardScreen from "./screens/DoorDashboardScreen";
import RingDashboardScreen from "./screens/RingDashboardScreen";
import FinanceDashboardScreen from "./screens/FinanceDashboardScreen";
import FinanceDayScreen from "./screens/FinanceDayScreen";
import FinanceJournalScreen from "./screens/FinanceJournalScreen";
import FinanceCloseScreen from "./screens/FinanceCloseScreen";
import FinanceExportScreen from "./screens/FinanceExportScreen";
import AdminScheduleScreen from "./screens/AdminScheduleScreen";

export const AppContext = createContext<any>(null);
const __hhBlockedPrefixes = ['', '', '', ''];
const Stack = createNativeStackNavigator();

const STORAGE_USER_KEY = "HH_USER_ID";
const STORAGE_VISITED_KEY = "HH_HAS_VISITED";
const STORAGE_ONBOARDING_KEY = "HH_PREOPEN_ONBOARDING_DONE";
const STORAGE_PREOPEN_CODE_KEY = "HH_PREOPEN_BOOKMAKER_CODE";
const STORAGE_SELECTED_COACH_KEY = "HH_SELECTED_COACH"; // isolated per-user
const STORAGE_SELECTED_ROLE_KEY = "HH_SELECTED_ROLE"; // isolated per-user
const STORAGE_SELECTED_COACH_GENDER_KEY = "HH_SELECTED_COACH_GENDER"; // isolated per-user

function userStorageKey(base: string, userId?: string | null) {
  const clean = String(userId || "").trim();
  return clean ? `${base}_${clean}` : base;
}

const PREOPEN_ENABLED = true;
const PREOPEN_OPENING_AT = "2026-05-19T19:00:00+02:00";
const PREOPEN_LOCATION = "HEN HOUSE / PALLOMA";

type RoleKey = "fighter" | "bettor" | "bookmaker";
type CoachGender = "male" | "female";

function normalizeRole(value: any): RoleKey {
  const role = String(value || "fighter").toLowerCase();
  if (role === "bettor") return "bettor";
  if (role === "bookmaker") return "bookmaker";
  return "fighter";
}

function coachBelongsToRole(role: RoleKey, coachName: string) {
  const name = String(coachName || '').trim().toUpperCase();
  if (role === "fighter") return ["KLYDE", "NYX"].includes(name);
  if (role === "bettor") return ["MILO", "MARIA"].includes(name);
  return ["RAZOR", "SCAR"].includes(name);
}

function defaultCoachForRole(role: RoleKey, gender: CoachGender) {
  if (role === "fighter") return gender === "female" ? "NYX" : "KLYDE";
  if (role === "bettor") return gender === "female" ? "MARIA" : "MILO";
  return gender === "female" ? "SCAR" : "RAZOR";
}

function screenTitle(name: string) {
  switch (name) {
    case "Profile": return "PLAYER ID";
    case "FightPlanner": return "MES COMBATS";
    case "Leaderboard": return "CLASSEMENT";
    case "Arena": return "ARENA";
    case "ArenaTickets": return "TICKETS";
    case "TicketDetail": return "TICKET";
    case "Bet": return "BET";
    case "Notifications": return "ALERTES";
    case "BookmakerHome": return "BOOKMAKER";
    case "Wallet": return "SOLDE";
    case "Deposit": return "DÉPÔT";
    case "Withdraw": return "RETRAIT";
    case "Fight": return "COMBATS";
    case "StaffLogin": return "STAFF";
    case "StaffDashboard": return "STAFF";
    case "DoorDashboard": return "DOOR";
    case "RingDashboard": return "RING";
    case "FinanceDashboard": return "FINANCE";
    case "FinanceDay": return "DAY";
    case "FinanceJournal": return "JOURNAL";
    case "FinanceClose": return "CLOSE";
    case "FinanceExport": return "EXPORT";
    case "AdminSchedule": return "SCHEDULE";
    case "Home": return "HEN HOUSE";
    default: return "HHFC";
  }
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Komikax: require("./assets/fonts/KOMIKAX_.ttf"),
    SourceSans3: require("./assets/fonts/SourceSans3-VariableFont_wght.ttf"),
    Bebas: require("./assets/fonts/BebasNeue-Regular.ttf"),
    Inter: require("./assets/fonts/Inter-VariableFont_slnt,wght.ttf"),
    StreetFight: require("./assets/fonts/KOMIKAX_.ttf"),
    GameBoy: require("./assets/fonts/KOMIKAX_.ttf"),
    RajdhaniSemiBold: require("./assets/fonts/SourceSans3-VariableFont_wght.ttf"),
    Title: require("./assets/fonts/BebasNeue-Regular.ttf"),
    Body: require("./assets/fonts/Inter-VariableFont_slnt,wght.ttf"),
    Accent: require("./assets/fonts/SourceSans3-VariableFont_wght.ttf"),
  });

  const [booting, setBooting] = useState(true);
  const [state, setState] = useState<any>({
    supaUserId: null,
    profile: null,
    staffSession: null,
    wallet: null,
    notifications: [],
    fightPlannerRequests: [],
    financeDay: null,
    financeJournal: null,
    financeExport: null,
    tickets: [],
    arenaEvents: [],
    myBets: [],
    myFights: [],
    leaderboard: [],
    hasVisited: false,
    missionFlags: {},
    preopen: {
      enabled: PREOPEN_ENABLED,
      openingAt: PREOPEN_OPENING_AT,
      locationLabel: PREOPEN_LOCATION,
      onboardingDone: false,
      bookmakerCode: "",
    },
  });

  useEffect(() => {
    let mounted = true;
    async function boot() {
      try {
        const storedUserId = await AsyncStorage.getItem(STORAGE_USER_KEY);
        const [visitedFlag, onboardingFlag, bookmakerCode, selectedCoachName, selectedRole, selectedCoachGender] = await Promise.all([
          AsyncStorage.getItem(STORAGE_VISITED_KEY),
          AsyncStorage.getItem(STORAGE_ONBOARDING_KEY),
          AsyncStorage.getItem(STORAGE_PREOPEN_CODE_KEY),
          AsyncStorage.getItem(userStorageKey(STORAGE_SELECTED_COACH_KEY, storedUserId)),
          AsyncStorage.getItem(userStorageKey(STORAGE_SELECTED_ROLE_KEY, storedUserId)),
          AsyncStorage.getItem(userStorageKey(STORAGE_SELECTED_COACH_GENDER_KEY, storedUserId)),
        ]);

        let profile = null;
        let wallet = null;

        if (storedUserId) {
          try {
            const [profileRow, walletRow] = await Promise.all([
              fetchMyProfile(storedUserId),
              fetchMyWallet(storedUserId),
            ]);
            profile = profileRow || null;
            wallet = walletRow || null;
          } catch {
            profile = null;
            wallet = null;
          }
        }

        const role = normalizeRole(profile?.role || selectedRole || "fighter");
        const gender = String(selectedCoachGender || "male") === "female" ? "female" : "male";
        const storedCoachName = String(selectedCoachName || "").trim();
        const coachName = coachBelongsToRole(role, storedCoachName) ? storedCoachName : defaultCoachForRole(role, gender);

        if (!mounted) return;
        setState((prev: any) => ({
          ...prev,
          supaUserId: storedUserId || null,
          profile,
          wallet,
          hasVisited: visitedFlag === "1",
          selectedCoachName: coachName,
          selectedRole: role,
          selectedCoachGender: gender,
          preopen: {
            ...prev.preopen,
            onboardingDone: onboardingFlag === "1",
            bookmakerCode: String(bookmakerCode || profile?.referred_by_bookmaker_code || ""),
            selectedRole: role,
            selectedCoachName: coachName,
            selectedCoachGender: gender,
          },
        }));
      } finally {
        if (mounted) setBooting(false);
      }
    }
    boot();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (booting) return;
    const role = normalizeRole(state?.profile?.role || state?.preopen?.selectedRole || state?.selectedRole || "fighter");
    const gender = String(state?.preopen?.selectedCoachGender || state?.selectedCoachGender || "male") === "female" ? "female" : "male";
    const rawCoach = String(state?.preopen?.selectedCoachName || state?.selectedCoachName || "").trim();
    const nextCoach = coachBelongsToRole(role, rawCoach) ? rawCoach.toUpperCase() : defaultCoachForRole(role, gender);
    if (state?.selectedRole !== role || state?.selectedCoachName !== nextCoach || state?.preopen?.selectedCoachName !== nextCoach) {
      setState((prev: any) => ({
        ...prev,
        selectedRole: role,
        selectedCoachName: nextCoach,
        selectedCoachGender: gender,
        preopen: {
          ...(prev?.preopen || {}),
          selectedRole: role,
          selectedCoachName: nextCoach,
          selectedCoachGender: gender,
          bookmakerCode: String(prev?.profile?.referred_by_bookmaker_code || prev?.preopen?.bookmakerCode || ""),
        },
      }));
    }
  }, [booting, state?.supaUserId, state?.profile?.role, state?.preopen?.selectedRole, state?.preopen?.selectedCoachName, state?.preopen?.selectedCoachGender]);

  useEffect(() => {
    if (booting) return;
    const tasks: [string, string][] = [];
    if (state?.supaUserId) tasks.push([STORAGE_USER_KEY, String(state.supaUserId)]);
    if (state?.hasVisited) tasks.push([STORAGE_VISITED_KEY, "1"]);
    if (state?.preopen?.onboardingDone) tasks.push([STORAGE_ONBOARDING_KEY, "1"]);
    if (state?.preopen?.bookmakerCode) tasks.push([STORAGE_PREOPEN_CODE_KEY, String(state.preopen.bookmakerCode)]);
    const userIdForStorage = state?.supaUserId ? String(state.supaUserId) : null;
    if (state?.preopen?.selectedCoachName) tasks.push([userStorageKey(STORAGE_SELECTED_COACH_KEY, userIdForStorage), String(state.preopen.selectedCoachName)]);
    if (state?.preopen?.selectedRole) tasks.push([userStorageKey(STORAGE_SELECTED_ROLE_KEY, userIdForStorage), String(state.preopen.selectedRole)]);
    if (state?.preopen?.selectedCoachGender) tasks.push([userStorageKey(STORAGE_SELECTED_COACH_GENDER_KEY, userIdForStorage), String(state.preopen.selectedCoachGender)]);
    if (tasks.length > 0) AsyncStorage.multiSet(tasks).catch(() => null);
  }, [booting, state?.supaUserId, state?.hasVisited, state?.preopen?.onboardingDone, state?.preopen?.bookmakerCode, state?.preopen?.selectedCoachName, state?.preopen?.selectedRole, state?.preopen?.selectedCoachGender]);

  if (!fontsLoaded || booting) {
    return (
      <View style={styles.bootWrap}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={styles.bootText}>HHFC</Text>
      </View>
    );
  }

  return (
    <AppContext.Provider value={{ state, setState }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Start"
          screenOptions={{
            headerStyle: { backgroundColor: "#07080C" },
            headerTintColor: "#F5F7FF",
            headerTitleStyle: { fontFamily: "Bebas", fontSize: 24, letterSpacing: 1 },
            contentStyle: { backgroundColor: "#05060A" },
          }}
        >
          <Stack.Screen name="Start" component={StartScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: screenTitle("Home"), headerBackVisible: false }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: screenTitle("Profile") }} />
          <Stack.Screen name="FightPlanner" component={FightPlannerScreen} options={{ title: screenTitle("FightPlanner") }} />
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: screenTitle("Leaderboard") }} />
          <Stack.Screen name="Arena" component={ArenaScreen} options={{ title: screenTitle("Arena") }} />
          <Stack.Screen name="ArenaTickets" component={ArenaTicketsScreen} options={{ title: screenTitle("ArenaTickets") }} />
          <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: screenTitle("TicketDetail") }} />
          <Stack.Screen name="Bet" component={BetScreen} options={{ title: screenTitle("Bet") }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: screenTitle("Notifications") }} />
          <Stack.Screen name="BookmakerHome" component={BookmakerHomeScreen} options={{ title: screenTitle("BookmakerHome") }} />
          <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: screenTitle("Wallet") }} />
          <Stack.Screen name="Deposit" component={DepositScreen} options={{ title: screenTitle("Deposit") }} />
          <Stack.Screen name="Withdraw" component={WithdrawScreen} options={{ title: screenTitle("Withdraw") }} />
          <Stack.Screen name="Fight" component={FightScreen} options={{ title: screenTitle("Fight") }} />
          <Stack.Screen name="StaffLogin" component={StaffLoginScreen} options={{ title: screenTitle("StaffLogin") }} />
          <Stack.Screen name="StaffDashboard" component={StaffDashboardScreen} options={{ title: screenTitle("StaffDashboard") }} />
          <Stack.Screen name="DoorDashboard" component={DoorDashboardScreen} options={{ title: screenTitle("DoorDashboard") }} />
          <Stack.Screen name="RingDashboard" component={RingDashboardScreen} options={{ title: screenTitle("RingDashboard") }} />
          <Stack.Screen name="FinanceDashboard" component={FinanceDashboardScreen} options={{ title: screenTitle("FinanceDashboard") }} />
          <Stack.Screen name="FinanceDay" component={FinanceDayScreen} options={{ title: screenTitle("FinanceDay") }} />
          <Stack.Screen name="FinanceJournal" component={FinanceJournalScreen} options={{ title: screenTitle("FinanceJournal") }} />
          <Stack.Screen name="FinanceClose" component={FinanceCloseScreen} options={{ title: screenTitle("FinanceClose") }} />
          <Stack.Screen name="FinanceExport" component={FinanceExportScreen} options={{ title: screenTitle("FinanceExport") }} />
          <Stack.Screen name="AdminSchedule" component={AdminScheduleScreen} options={{ title: screenTitle("AdminSchedule") }} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  bootWrap: { flex: 1, backgroundColor: "#05060A", alignItems: "center", justifyContent: "center", gap: 12 },
  bootText: { color: "#F5F7FF", fontFamily: "Bebas", fontSize: 28, letterSpacing: 2 },
});
