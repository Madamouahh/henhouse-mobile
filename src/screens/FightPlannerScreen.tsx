// HHFC RELEASE CANDIDATE FINAL
import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppContext } from '../App';
import {
  cancelFightBooking,
  createFightBooking,
  fetchFightPlannerSlotLoads,
  fetchFightSlots,
  fetchMyFightPlannerRequests,
  fetchMyProfile,
  fetchMyWallet,
  normalizeVerificationStatus,
} from '../services/hhApi';
import { playSound } from '../services/sound';
import { supabase } from '../services/supabase';
import { canAccessRoleScreen, resolveActiveRole } from '../utils/access';

const BG = require('../assets/fight/fight_room.png');
const STAKE = 100000;

const WINDOWS = [
  { key: '20-21', label: '20H · 21H', start: 20, end: 21 },
  { key: '21-22', label: '21H · 22H', start: 21, end: 22 },
  { key: '22-23', label: '22H · 23H', start: 22, end: 23 },
  { key: '23-24', label: '23H · 00H', start: 23, end: 24 },
] as const;

function upper(v: any) {
  return String(v || '').trim().toUpperCase();
}

function money(v: any) {
  return Number(v || 0).toLocaleString('fr-FR') + ' $';
}

function dayKey(v?: string | null) {
  return String(v || '').slice(0, 10);
}

function dateLabel(v?: string | null) {
  try {
    return new Date(String(v).slice(0, 10) ).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }).toUpperCase();
  } catch {
    return String(v || '').toUpperCase();
  }
}

function parisHour(v?: string | null) {
  const d = v ? new Date(v) : null;
  return !d || Number.isNaN(d.getTime()) ? -1 : (d.getUTCHours() + 2) % 24;
}

function translateStatus(v?: string | null) {
  switch (upper(v)) {
    case 'PENDING':
      return 'EN ATTENTE';
    case 'MATCHED':
      return 'ADVERSAIRE TROUVÉ';
        case 'CANCELLED':
      return 'ANNULÉ';
    default:
      return upper(v || 'PENDING');
  }
}

function mapError(message?: string) {
  const code = upper(message || '');
  if (code === 'KYC_REQUIRED') return 'Ton profil doit être validé.';
  if (code === 'ROLE_NOT_ALLOWED') return 'Ce module est réservé aux fighters.';
  if (code === 'INSUFFICIENT_WALLET_BALANCE') return 'Wallet insuffisant pour entrer dans la ligue.';
  if (code === 'FIGHT_WEEK_LIMIT_REACHED') return 'Tu as déjà 5 créneaux sur cette semaine.';
  if (code === 'FIGHT_DAY_ALREADY_BOOKED') return 'Un seul créneau par jour est autorisé.';
  return message || 'Action impossible.';
}

export default function FightPlannerScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const profile = state?.profile || null;
  const userId = state?.supaUserId || profile?.id || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loads, setLoads] = useState<Record<string, number>>({});
  const [wallet, setWallet] = useState<any>(state?.wallet || null);
  const [freshProfile, setFreshProfile] = useState<any>(profile || null);
  const [selectedDay, setSelectedDay] = useState('');
  const [overlayRequest, setOverlayRequest] = useState<any>(null);

  async function load(silent = false) {
    try {
      if (!silent) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const [slotRows, requestRows, walletRow, profileRow] = await Promise.all([
        fetchFightSlots({ onlyOpen: true }).catch(() => []),
        userId ? fetchMyFightPlannerRequests(userId).catch(() => []) : Promise.resolve([]),
        userId ? fetchMyWallet(userId).catch(() => wallet) : Promise.resolve(wallet),
        userId ? fetchMyProfile(userId).catch(() => profile) : Promise.resolve(profile),
      ]);

      const safeSlots = Array.isArray(slotRows) ? slotRows : [];
      const safeRequests = Array.isArray(requestRows) ? requestRows : [];
      const nextLoads = await fetchFightPlannerSlotLoads(
        safeSlots.map((x: any) => String(x?.id || ''))
      ).catch(() => ({}));

      setSlots(safeSlots);
      setRequests(safeRequests);
      setLoads(nextLoads || {});
      setWallet(walletRow || null);
      setFreshProfile(profileRow || null);

      const latestMatched = safeRequests.find(
        (x: any) => upper(x?.status) === 'MATCHED' && x?.matched_fight_id
      );

      if (latestMatched?.matched_fight_id && state?.lastMatchedFightId !== latestMatched.matched_fight_id) {
        setOverlayRequest(latestMatched);
        setState((prev: any) => ({
          ...prev,
          lastMatchedFightId: latestMatched.matched_fight_id,
        }));
      }

      setState((prev: any) => ({
        ...prev,
        wallet: walletRow || prev?.wallet || null,
        profile: profileRow || prev?.profile || null,
        fightPlannerRequests: safeRequests,
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`fight-planner-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fight_match_requests' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fights' }, () => load(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const role = resolveActiveRole(state, freshProfile?.role || profile?.role);
  const verification = normalizeVerificationStatus(
    freshProfile?.verification_status || profile?.verification_status || 'PENDING'
  );

  useEffect(() => {
    if (!canAccessRoleScreen(role, 'FightPlanner')) {
      navigation.replace('Home');
    }
  }, [role, navigation]);

  const activeRequests = useMemo(
    () =>
      requests.filter((x: any) =>
        ['PENDING', 'MATCHED'].includes(upper(x?.status))
      ),
    [requests]
  );

  const matchedRequests = useMemo(
    () => activeRequests.filter((x: any) => upper(x?.status) === 'MATCHED'),
    [activeRequests]
  );

  const availableWallet =
    Number(wallet?.wallet_balance || 0) + Number(wallet?.wallet_bonus_balance || 0);

  const days = useMemo(() => {
    return Array.from(
      new Set(
        slots
          .filter((x: any) => upper(x?.status) === 'OPEN')
          .filter((x: any) => Number(x?.stake_cents ?? x?.stake_amount ?? 0) === STAKE)
          .map((x: any) => dayKey(x?.fight_date || x?.scheduled_at))
          .filter(Boolean)
      )
    ).slice(0, 5);
  }, [slots]);

  useEffect(() => {
    if (days.length > 0 && !days.includes(selectedDay)) {
      setSelectedDay(days[0]);
    }
  }, [days, selectedDay]);

  const windows = useMemo(() => {
    const daySlots = slots
      .filter((x: any) => upper(x?.status) === 'OPEN')
      .filter((x: any) => Number(x?.stake_cents ?? x?.stake_amount ?? 0) === STAKE)
      .filter((x: any) => dayKey(x?.fight_date || x?.scheduled_at) === selectedDay)
      .sort((a: any, b: any) =>
        String(a?.scheduled_at).localeCompare(String(b?.scheduled_at))
      );

    return WINDOWS.map((windowDef) => {
      const rows = daySlots.filter((slot: any) => {
        const hour = parisHour(slot?.scheduled_at);
        return hour >= windowDef.start && hour < windowDef.end;
      });

      const best =
        [...rows].sort((a: any, b: any) => {
          const la = Number(loads[String(a?.id)] || 0);
          const lb = Number(loads[String(b?.id)] || 0);
          if (la !== lb) return la - lb;
          return String(a?.scheduled_at).localeCompare(String(b?.scheduled_at));
        })[0] || null;

      const totalLoad = rows.reduce(
        (sum: number, row: any) => sum + Number(loads[String(row?.id)] || 0),
        0
      );
      const totalCap = rows.reduce(
        (sum: number, row: any) => sum + Math.max(1, Number(row?.max_fighters || 2)),
        0
      );

      return {
        ...windowDef,
        best,
        totalLoad,
        totalCap,
        remaining: Math.max(0, totalCap - totalLoad),
      };
    });
  }, [slots, selectedDay, loads]);

  const blockedReason =
    verification !== 'VERIFIED'
      ? 'Valide ton profil pour entrer dans la ligue.'
      : !canAccessRoleScreen(role as any, 'FightPlanner')
      ? 'Ce module est réservé aux fighters.'
      : availableWallet < STAKE
      ? `Minimum requis : ${money(STAKE)}. Ton solde actuel : ${money(availableWallet)}.`
      : '';

  async function handleBook(windowDef: any) {
    if (!userId) {
      return navigation.navigate('Profile');
    }

    if (blockedReason) {
      return Alert.alert('PORTE VERROUILLÉE', blockedReason);
    }

    if (!windowDef?.best?.id) {
      return Alert.alert('Aucun créneau', 'Aucune place libre sur cette fenêtre.');
    }

    try {
      setActing('book_' + windowDef.key);
      playSound?.('confirm');

      await createFightBooking({
        userId,
        slotId: String(windowDef.best.id),
        stake: STAKE,
      });

      await load(true);

      Alert.alert('CRÉNEAU VALIDÉ', 'Ta demande a été envoyée dans cette fenêtre.');
    } catch (e: any) {
      Alert.alert('Erreur', mapError(e?.message));
    } finally {
      setActing(null);
    }
  }

  async function handleCancel(requestId: string) {
    try {
      setActing('cancel_' + requestId);
      await cancelFightBooking(requestId);
      await load(true);
      Alert.alert('CRÉNEAU RETIRÉ', 'Ta disponibilité a été supprimée.');
    } catch (e: any) {
      Alert.alert('Erreur', mapError(e?.message));
    } finally {
      setActing(null);
    }
  }

  return (
    <ImageBackground source={BG} style={styles.container} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />

      <Modal
        visible={!!overlayRequest}
        transparent
        animationType="fade"
        onRequestClose={() => setOverlayRequest(null)}
      >
        <View style={styles.matchOverlayWrap}>
          <View style={styles.matchOverlayCard}>
            <Text style={styles.matchOverlayKicker}>HHFC</Text>
            <Text style={styles.matchOverlayTitle}>COMBAT TROUVÉ</Text>
            <Text style={styles.matchOverlaySub}>
              Un adversaire a été trouvé pour ton créneau.
            </Text>
            <Text style={styles.matchOverlayDate}>
              {overlayRequest?.slot?.scheduled_at
                ? new Date(overlayRequest.slot.scheduled_at).toLocaleString('fr-FR')
                : overlayRequest?.requested_fight_date}
            </Text>

            <View style={styles.matchOverlayRow}>
              <Pressable style={styles.overlayGhost} onPress={() => setOverlayRequest(null)}>
                <Text style={styles.overlayGhostText}>PLUS TARD</Text>
              </Pressable>

              <Pressable
                style={styles.overlayPrimary}
                onPress={() => {
                  setOverlayRequest(null);
                  navigation.navigate('Fight');
                }}
              >
                <Text style={styles.overlayPrimaryText}>VOIR LE COMBAT</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#fff"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>OUVERTURE 28 AVRIL</Text>
          <Text style={styles.title}>PLANIFICATEUR DE COMBAT</Text>
          <Text style={styles.sub}>
            Choisis ton jour puis ta tranche horaire. La prise de créneau passe avant le reste.
          </Text>
        </View>

        <View style={styles.hudRow}>
          <View style={styles.hudBox}>
            <Text style={styles.hudLabel}>KYC</Text>
            <Text style={styles.hudValue}>{verification}</Text>
          </View>

          <View style={styles.hudBox}>
            <Text style={styles.hudLabel}>SOLDE</Text>
            <Text style={styles.hudValue}>{money(availableWallet)}</Text>
          </View>

          <View style={styles.hudBox}>
            <Text style={styles.hudLabel}>MISE</Text>
            <Text style={styles.hudValue}>{money(STAKE)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>JOURS OUVERTS</Text>

          {loading ? (
            <View style={styles.Wrap}>
              <ActivityIndicator size="large" color="#ec4900" />
              <Text style={styles.Text}>Chargement...</Text>
            </View>
          ) : days.length <= 0 ? (
            <Text style={styles.emptyText}>Aucun jour ouvert pour l’instant.</Text>
          ) : (
            <View style={styles.dayRow}>
              {days.map((day) => (
                <Pressable
                  key={day}
                  style={[styles.dayPill, selectedDay === day && styles.dayPillActive]}
                  onPress={() => setSelectedDay(day)}
                >
                  <Text
                    style={[
                      styles.dayPillText,
                      selectedDay === day && styles.dayPillTextActive,
                    ]}
                  >
                    {dateLabel(day)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>TRANCHES HORAIRES</Text>

          {windows.map((windowDef) => (
            <View key={windowDef.key} style={styles.windowCard}>
              <View style={styles.windowTop}>
                <Text style={styles.windowLabel}>{windowDef.label}</Text>
                <Text style={styles.windowMeta}>
                  {windowDef.remaining > 0 ? `${windowDef.remaining} places` : 'PLEIN'}
                </Text>
              </View>

              <Text style={styles.windowSub}>
                Charge {windowDef.totalLoad}/{windowDef.totalCap || 0}
              </Text>

              <Pressable
                style={[
                  styles.primaryBtn,
                  (!windowDef.best || !!blockedReason || acting === 'book_' + windowDef.key) &&
                    styles.disabledBtn,
                ]}
                disabled={!windowDef.best || !!blockedReason || acting === 'book_' + windowDef.key}
                onPress={() => handleBook(windowDef)}
              >
                <Text style={styles.primaryBtnText}>
                  {acting === 'book_' + windowDef.key
                    ? 'ENVOI...'
                    : windowDef.best
                    ? 'ENTRER DANS CETTE FENÊTRE'
                    : 'INDISPONIBLE'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {matchedRequests.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>COMBATS TROUVÉS</Text>

            {matchedRequests.map((request: any) => (
              <Pressable
                key={String(request?.id)}
                style={[styles.requestRow, styles.requestRowMatched]}
                onPress={() => navigation.navigate('Fight')}
              >
                <View style={styles.requestBody}>
                  <Text style={styles.requestTitle}>{translateStatus(request?.status)}</Text>
                  <Text style={styles.requestSub}>
                    {request?.slot?.scheduled_at
                      ? new Date(request.slot.scheduled_at).toLocaleString('fr-FR')
                      : request?.requested_fight_date}
                  </Text>
                </View>
                <Text style={styles.smallBtnText}>VOIR</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {activeRequests.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>MES DEMANDES</Text>

            {activeRequests.map((request: any) => (
              <View key={String(request?.id)} style={styles.requestRow}>
                <View style={styles.requestBody}>
                  <Text style={styles.requestTitle}>{translateStatus(request?.status)}</Text>
                  <Text style={styles.requestSub}>
                    {request?.slot?.scheduled_at
                      ? new Date(request.slot.scheduled_at).toLocaleString('fr-FR')
                      : request?.requested_fight_date}
                  </Text>
                </View>

                {upper(request?.status) === 'PENDING' ? (
                  <Pressable
                    style={styles.smallBtn}
                    disabled={acting === 'cancel_' + request.id}
                    onPress={() => handleCancel(String(request.id))}
                  >
                    <Text style={styles.smallBtnText}>
                      {acting === 'cancel_' + request.id ? '...' : 'ANNULER'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bgImage: {
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,6,10,0.88)',
  },
  content: {
    padding: 18,
    paddingTop: 86,
    paddingBottom: 40,
    gap: 16,
  },
  hero: {
    borderWidth: 1,
    borderColor: 'rgba(236,73,0,0.28)',
    borderRadius: 22,
    backgroundColor: 'rgba(12,16,24,0.82)',
    padding: 20,
  },
  kicker: {
    color: '#ff9b6a',
    fontSize: 13,
    letterSpacing: 1.5,
    fontFamily: 'BebasNeue',
    marginBottom: 8,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontFamily: 'Komikax',
    marginBottom: 10,
  },
  sub: {
    color: '#d7dce3',
    fontSize: 16,
    lineHeight: 23,
    fontFamily: 'System',
  },
  hudRow: {
    flexDirection: 'row',
    gap: 10,
  },
  hudBox: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: 'rgba(18,22,32,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  hudLabel: {
    color: '#8f98a8',
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: 'BebasNeue',
    marginBottom: 6,
  },
  hudValue: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'BebasNeue',
  },
  card: {
    borderRadius: 22,
    backgroundColor: 'rgba(10,14,22,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 18,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Komikax',
    marginBottom: 14,
  },
  Wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
  },
  Text: {
    color: '#d7dce3',
    marginTop: 10,
  },
  emptyText: {
    color: '#b6bfcd',
    fontSize: 15,
    lineHeight: 21,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayPill: {
    minWidth: 98,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(22,26,36,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  dayPillActive: {
    backgroundColor: 'rgba(236,73,0,0.18)',
    borderColor: 'rgba(236,73,0,0.55)',
  },
  dayPillText: {
    color: '#d6dbe5',
    fontFamily: 'BebasNeue',
    fontSize: 16,
  },
  dayPillTextActive: {
    color: '#fff',
  },
  windowCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(20,24,34,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    marginBottom: 12,
  },
  windowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windowLabel: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Komikax',
  },
  windowMeta: {
    color: '#ffb08a',
    fontSize: 16,
    fontFamily: 'BebasNeue',
  },
  windowSub: {
    color: '#aeb7c5',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 14,
  },
  primaryBtn: {
    borderRadius: 18,
    backgroundColor: '#ec4900',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'BebasNeue',
    letterSpacing: 1,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(17,21,30,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    marginBottom: 10,
  },
  requestRowMatched: {
    borderColor: 'rgba(236,73,0,0.4)',
  },
  requestBody: {
    flex: 1,
  },
  requestTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'BebasNeue',
    marginBottom: 4,
  },
  requestSub: {
    color: '#aeb7c5',
    fontSize: 14,
  },
  smallBtn: {
    borderRadius: 14,
    backgroundColor: 'rgba(236,73,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(236,73,0,0.38)',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  smallBtnText: {
    color: '#fff',
    fontFamily: 'BebasNeue',
    fontSize: 16,
    letterSpacing: 0.8,
  },
  matchOverlayWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  matchOverlayCard: {
    borderRadius: 24,
    backgroundColor: '#0f131c',
    borderWidth: 1,
    borderColor: 'rgba(236,73,0,0.45)',
    padding: 22,
  },
  matchOverlayKicker: {
    color: '#ff9b6a',
    fontFamily: 'BebasNeue',
    fontSize: 16,
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  matchOverlayTitle: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 30,
    fontFamily: 'Komikax',
    marginBottom: 10,
  },
  matchOverlaySub: {
    color: '#d7dce3',
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 10,
  },
  matchOverlayDate: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'BebasNeue',
    marginBottom: 18,
  },
  matchOverlayRow: {
    flexDirection: 'row',
    gap: 12,
  },
  overlayGhost: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  overlayGhostText: {
    color: '#fff',
    fontFamily: 'BebasNeue',
    fontSize: 18,
  },
  overlayPrimary: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#ec4900',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
  },
  overlayPrimaryText: {
    color: '#fff',
    fontFamily: 'BebasNeue',
    fontSize: 18,
  },
});

// HHFC FINAL RULES
// - OPEN slots only
// - SCHEDULED fights only
// - production launch calendar only
