import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppContext } from '../App';
import { fetchMyBets, fetchMyProfile, fetchMyWallet, fetchUpcomingFights, normalizeVerificationStatus, walletSpendForBet } from '../services/hhApi';
import { playSound } from '../services/sound';
import { canAccessRoleScreen, resolveActiveRole } from '../utils/access';

const BG = require('../assets/bet/bet_room.png');
const BET_TYPES = ['SIMPLE', 'MULTIPLE'] as const;
const STAKES = [5000, 10000, 25000, 50000, 100000];
type BetType = (typeof BET_TYPES)[number];

function upper(v: any) { return String(v || '').trim().toUpperCase(); }
function money(v: any) { return '$' + Number(v || 0).toLocaleString('en-US'); }
function when(v?: string | null) {
  if (!v) return 'DATE N/A';
  try { return new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return 'DATE N/A'; }
}
function fightLabel(row: any) { return `${String(row?.fighter_a_name || 'FIGHTER A').toUpperCase()} VS ${String(row?.fighter_b_name || 'FIGHTER B').toUpperCase()}`; }
function marketState(row: any) {
  const status = upper(row?.status || 'SCHEDULED');
  if (status === 'SCHEDULED') return 'OPEN';
  if (status === 'LIVE' || status === 'STARTED') return 'LIVE';
  if (status === 'FINISHED') return 'SETTLED';
  if (status === 'CANCELLED') return 'CANCELLED';
  return status;
}
function oddValue(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const cleaned = String(value).replace(',', '.').trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed) && parsed > 1) return parsed;
  }
  return null;
}
function oddsForFight(row: any) {
  const a = oddValue(
    row?.fighter_a_odds,
    row?.odds_a,
    row?.odds_current_a,
    row?.odds_open_a,
    row?.fighterAOdds,
    row?.market_odds_a,
    row?.raw?.odds_current_a,
    row?.raw?.odds_open_a,
  );
  const b = oddValue(
    row?.fighter_b_odds,
    row?.odds_b,
    row?.odds_current_b,
    row?.odds_open_b,
    row?.fighterBOdds,
    row?.market_odds_b,
    row?.raw?.odds_current_b,
    row?.raw?.odds_open_b,
  );
  if (!(a && b)) return null;
  return { a, b };
}

export default function BetScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const profile = state?.profile || null;
  const userId = state?.supaUserId || profile?.id || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fights, setFights] = useState<any[]>([]);
  const [bets, setBets] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(state?.wallet || null);
  const [freshProfile, setFreshProfile] = useState<any>(profile || null);
  const [selectedType, setSelectedType] = useState<BetType>('SIMPLE');
  const [selectedStake, setSelectedStake] = useState<number>(10000);
  const [selectedMap, setSelectedMap] = useState<Record<string, string>>({});

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const [fightRows, slipRows, walletRow, profileRow] = await Promise.all([
        fetchUpcomingFights().catch(() => []),
        userId ? fetchMyBets(userId).catch(() => []) : Promise.resolve([]),
        userId ? fetchMyWallet(userId).catch(() => wallet) : Promise.resolve(wallet),
        userId ? fetchMyProfile(userId).catch(() => profile) : Promise.resolve(profile),
      ]);
      const safeFights = Array.isArray(fightRows) ? fightRows : [];
      const safeBets = Array.isArray(slipRows) ? slipRows : [];
      const wonBetCount = safeBets.filter((row: any) => ['WON', 'PAID'].includes(upper(row?.status))).length;
      setFights(safeFights);
      setBets(safeBets);
      setWallet(walletRow || null);
      setFreshProfile(profileRow || null);
      setState((prev: any) => ({
        ...prev,
        upcomingFights: safeFights,
        myBets: safeBets,
        wallet: walletRow || prev?.wallet || null,
        profile: profileRow || prev?.profile || null,
        missionFlags: { ...(prev?.missionFlags || {}), viewedBet: true, wonBetCount },
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [userId]);

  const role = resolveActiveRole(state, freshProfile?.role || profile?.role);
  const isTestSuperuser = !!(freshProfile?.is_test_superuser || profile?.is_test_superuser || state?.profile?.is_test_superuser);
  useEffect(() => { if (!isTestSuperuser && !canAccessRoleScreen(role, 'Bet')) navigation.replace('Home'); }, [role, isTestSuperuser]);

  const verification = normalizeVerificationStatus(freshProfile?.verification_status || profile?.verification_status || 'PENDING');
  const totalWallet = Number(wallet?.wallet_balance || 0) + Number(wallet?.wallet_bonus_balance || 0);
  const canBet = verification === 'VERIFIED' && totalWallet > 0;
  const marketFights = useMemo(() => fights.filter((row: any) => upper(row?.status) === 'SCHEDULED'), [fights]);
  const selectedEntries = useMemo(() => Object.entries(selectedMap).filter(([, fighterId]) => !!fighterId), [selectedMap]);

  const totalDebit = useMemo(() => selectedType === 'MULTIPLE' ? selectedStake * selectedEntries.length : selectedStake, [selectedType, selectedStake, selectedEntries.length]);
  const potentialPayout = useMemo(() => {
    if (selectedEntries.length <= 0) return 0;
    if (selectedType === 'MULTIPLE') {
      return selectedEntries.reduce((sum, [fightId, fighterId]) => {
        const fight = fights.find((x: any) => String(x?.id) === String(fightId));
        const odds = oddsForFight(fight);
        if (!fight || !odds) return sum;
        const picked = String(fighterId) === String(fight?.fighter_a_id || fight?.fighter_a) ? odds.a : odds.b;
        return sum + Math.round(selectedStake * picked);
      }, 0);
    }
    return Math.round(selectedEntries.reduce((acc, [fightId, fighterId]) => {
      const fight = fights.find((x: any) => String(x?.id) === String(fightId));
      const odds = oddsForFight(fight);
      if (!fight || !odds) return acc;
      const picked = String(fighterId) === String(fight?.fighter_a_id || fight?.fighter_a) ? odds.a : odds.b;
      return acc * picked;
    }, selectedStake));
  }, [selectedEntries, selectedType, selectedStake, fights]);

  function selectType(type: BetType) {
    playSound?.('tap');
    setSelectedType(type);
    if (type === 'SIMPLE' && selectedEntries.length > 1) {
      const [fightId, fighterId] = selectedEntries[0];
      setSelectedMap({ [fightId]: fighterId });
    }
  }

  function toggleSelection(fight: any, fighterId: string) {
    const fightId = String(fight?.id);
    playSound?.('tap');
    setSelectedMap((prev) => selectedType === 'SIMPLE' ? { [fightId]: fighterId } : { ...prev, [fightId]: prev[fightId] === fighterId ? '' : fighterId });
  }

  async function submitSlip() {
    if (!userId) return navigation.navigate('Profile');
    if (!canBet) return Alert.alert('Accès bloqué', 'Ton compte doit être validé et ton wallet chargé.');
    if (selectedType === 'SIMPLE' && selectedEntries.length !== 1) return Alert.alert('Sélection incomplète', 'Choisis un seul combat.');
    if ((selectedType === 'MULTIPLE') && selectedEntries.length < 2) return Alert.alert('Sélection incomplète', 'Choisis au moins deux combats.');
    try {
      setSubmitting(true);
      const selections = selectedEntries.map(([fightId, fighterId]) => {
        const fight = fights.find((x: any) => String(x?.id) === String(fightId));
        const odds = oddsForFight(fight);
        if (!fight || !odds) throw new Error('ODDS_NOT_READY');
        if (upper(fight?.status || 'SCHEDULED') !== 'SCHEDULED') throw new Error('FIGHT_MARKET_CLOSED');
        const pickedOdds = String(fighterId) === String(fight?.fighter_a_id || fight?.fighter_a) ? odds.a : odds.b;
        return { fightId, selectedFighterId: fighterId, odds: pickedOdds };
      });
      for (const selection of selections) {
        await walletSpendForBet({
          fightId: selection.fightId,
          bettorId: userId,
          betOn: selection.selectedFighterId,
          amount: selectedStake,
        });
      }
      setState((prev: any) => ({
        ...prev,
        missionFlags: { ...(prev?.missionFlags || {}), viewedBet: true, placedBetCount: Number(prev?.missionFlags?.placedBetCount || 0) + 1 },
      }));
      setSelectedMap({});
      playSound?.('confirm');
      await load(true);
      Alert.alert('Pari validé', selectedType === 'MULTIPLE' ? 'Tes paris simples ont été placés sur la sélection.' : 'Ton pari est enregistré.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message === 'ODDS_NOT_READY' ? 'Les cotes ne sont pas prêtes.' : e?.message === 'FIGHT_MARKET_CLOSED' ? 'Ce combat n’accepte plus de pari.' : (e?.message || 'Action impossible.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ImageBackground source={BG} style={styles.container} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>OUVERTURE 19 MAI</Text>
          <Text style={styles.title}>FIGHT CARD</Text>
          <Text style={styles.sub}></Text>
        </View>

        <View style={styles.hudRow}>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>KYC</Text><Text style={styles.hudValue}>{verification}</Text></View>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>WALLET</Text><Text style={styles.hudValue}>{money(totalWallet)}</Text></View>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>PARIS</Text><Text style={styles.hudValue}>{String(bets.length)}</Text></View>
        </View>

        {!canBet ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>ACCÈS BLOQUÉ</Text>
            <Text style={styles.noticeText}>Validation profil et wallet actif requis.</Text>
            <View style={styles.inlineButtons}>
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Profile')}><Text style={styles.secondaryBtnText}>PROFIL</Text></Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Wallet')}><Text style={styles.primaryBtnText}>WALLET</Text></Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>TES PARIS</Text>
          <View style={styles.typeRow}>
            {BET_TYPES.map((type) => (
              <Pressable key={type} style={[styles.typeBtn, selectedType === type && styles.typeBtnActive]} onPress={() => selectType(type)}>
                <Text style={[styles.typeText, selectedType === type && styles.typeTextActive]}>{type === 'SIMPLE' ? 'SIMPLE' : 'MULTI SIMPLE'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.stakeRow}>
            {STAKES.map((stake) => (
              <Pressable key={stake} style={[styles.stakeBtn, selectedStake === stake && styles.stakeBtnActive]} onPress={() => setSelectedStake(stake)}>
                <Text style={[styles.stakeText, selectedStake === stake && styles.stakeTextActive]}>{money(stake)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}><Text style={styles.summaryLabel}>SÉLECTIONS</Text><Text style={styles.summaryValue}>{selectedEntries.length}</Text></View>
            <View style={styles.summaryBox}><Text style={styles.summaryLabel}>MISE TOTALE</Text><Text style={styles.summaryValue}>{money(totalDebit)}</Text></View>
            <View style={styles.summaryBox}><Text style={styles.summaryLabel}>GAIN POTENTIEL</Text><Text style={styles.summaryValue}>{money(potentialPayout)}</Text></View>
          </View>
          <Pressable style={[styles.primaryBtn, (submitting || !canBet || selectedEntries.length <= 0) && styles.disabledBtn]} disabled={submitting || !canBet || selectedEntries.length <= 0} onPress={submitSlip}>
            <Text style={styles.primaryBtnText}>{submitting ? 'VALIDATION...' : 'PLACER LE PARI'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>FIGHT CARD</Text>
          {loading ? (
            <View style={styles.Wrap}><ActivityIndicator size="large" color="#d4af37" /><Text style={styles.Text}>Chargement des marchés...</Text></View>
          ) : marketFights.length <= 0 ? (
            <Text style={styles.emptyText}>Aucun combat exploitable pour l’instant.</Text>
          ) : marketFights.slice(0, 8).map((fight: any, index: number) => {
            const odds = oddsForFight(fight);
            const current = selectedMap[String(fight?.id)];
            const stateLabel = marketState(fight);
            const bettable = stateLabel === 'OPEN' && !!odds;
            return (
              <View key={String(fight?.id)} style={styles.fightCard}>
                <View style={styles.fightHead}>
                  <Text style={styles.fightBadge}>{index === 0 ? 'HOT CARD' : stateLabel === 'OPEN' ? 'OUVERT' : stateLabel}</Text>
                  <Text style={styles.fightTime}>{when(fight?.scheduled_at)}</Text>
                </View>
                <Text style={styles.fightTitle}>{fightLabel(fight)}</Text>
                <View style={styles.pickRow}>
                  <Pressable style={[styles.pickBtn, current === String(fight?.fighter_a_id || fight?.fighter_a) && styles.pickBtnActive, !bettable && styles.pickBtnDisabled]} disabled={!bettable} onPress={() => toggleSelection(fight, String(fight?.fighter_a_id || fight?.fighter_a))}>
                    <Text style={styles.pickName}>{String(fight?.fighter_a_name || 'FIGHTER A').toUpperCase()}</Text>
                    <Text style={styles.pickOdds}>{odds ? odds.a.toFixed(2) : 'N/A'}</Text>
                  </Pressable>
                  <Pressable style={[styles.pickBtn, current === String(fight?.fighter_b_id || fight?.fighter_b) && styles.pickBtnActive, !bettable && styles.pickBtnDisabled]} disabled={!bettable} onPress={() => toggleSelection(fight, String(fight?.fighter_b_id || fight?.fighter_b))}>
                    <Text style={styles.pickName}>{String(fight?.fighter_b_name || 'FIGHTER B').toUpperCase()}</Text>
                    <Text style={styles.pickOdds}>{odds ? odds.b.toFixed(2) : 'N/A'}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07080d' },
  bgImage: { resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,8,13,0.78)' },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  hero: { borderRadius: 24, padding: 18, backgroundColor: 'rgba(10,12,18,0.9)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.22)' },
  kicker: { color: '#d4af37', fontFamily: 'Inter', fontWeight: '900', fontSize: 11, letterSpacing: 1.7 },
  title: { color: '#fff', fontFamily: 'Bebas', fontSize: 38, letterSpacing: 1 },
  sub: { color: '#d8dee8', fontFamily: 'Inter', fontSize: 14, lineHeight: 21 },
  hudRow: { flexDirection: 'row', gap: 10 },
  hudBox: { flex: 1, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  hudLabel: { color: '#9ba6b7', fontFamily: 'Inter', fontSize: 11, fontWeight: '700' },
  hudValue: { color: '#fff', fontFamily: 'Bebas', fontSize: 24, marginTop: 4 },
  notice: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,59,48,0.24)', backgroundColor: 'rgba(60,14,6,0.45)', gap: 8 },
  noticeTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28 },
  noticeText: { color: '#d8dee8', fontFamily: 'Inter', lineHeight: 20 },
  inlineButtons: { flexDirection: 'row', gap: 10 },
  card: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(10,12,18,0.92)', gap: 12 },
  sectionTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 1 },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeBtn: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  typeBtnActive: { borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(212,175,55,0.12)' },
  typeText: { color: '#cfd6e4', fontFamily: 'Inter', fontWeight: '800', fontSize: 12 },
  typeTextActive: { color: '#fff' },
  stakeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stakeBtn: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  stakeBtnActive: { borderColor: 'rgba(236,73,0,0.4)', backgroundColor: 'rgba(236,73,0,0.12)' },
  stakeText: { color: '#cfd6e4', fontFamily: 'Inter', fontWeight: '800', fontSize: 12 },
  stakeTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryBox: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  summaryLabel: { color: '#9ba6b7', fontFamily: 'Inter', fontSize: 10, fontWeight: '700' },
  summaryValue: { color: '#fff', fontFamily: 'Bebas', fontSize: 24, marginTop: 4 },
  primaryBtn: { minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ec4900', paddingHorizontal: 14 },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8, textAlign: 'center' },
  secondaryBtn: { minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14 },
  secondaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  disabledBtn: { opacity: 0.45 },
  Wrap: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  Text: { color: '#cdd5e2', fontFamily: 'Inter' },
  emptyText: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 13, lineHeight: 20 },
  fightCard: { borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.03)', gap: 10 },
  fightHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  fightBadge: { color: '#d4af37', fontFamily: 'Inter', fontWeight: '900', fontSize: 11, letterSpacing: 1.1 },
  fightTime: { color: '#9ba6b7', fontFamily: 'Inter', fontSize: 12 },
  fightTitle: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 14 },
  pickRow: { flexDirection: 'row', gap: 10 },
  pickBtn: { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', gap: 6 },
  pickBtnActive: { borderColor: 'rgba(236,73,0,0.45)', backgroundColor: 'rgba(236,73,0,0.12)' },
  pickBtnDisabled: { opacity: 0.45 },
  pickName: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12 },
  pickOdds: { color: '#ffb58f', fontFamily: 'Bebas', fontSize: 28 },
});
