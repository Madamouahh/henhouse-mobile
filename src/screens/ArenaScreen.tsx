import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppContext } from '../App';
import { buyArenaTicket, fetchArenaTicketCatalog, fetchMyProfile, fetchMyWallet, normalizeVerificationStatus } from '../services/hhApi';
import { playSound } from '../services/sound';

const BG = require('../assets/backgrounds/hh_intro_bg.jpg');
function money(v: any) { return '$' + Number(v || 0).toLocaleString('en-US'); }
function upper(v: any) { return String(v || '').trim().toUpperCase(); }
function dateText(v?: string | null) {
  if (!v) return 'DATE À CONFIRMER';
  try { return new Date(v).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).toUpperCase(); }
  catch { return 'DATE À CONFIRMER'; }
}

export default function ArenaScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const profile = state?.profile || null;
  const userId = state?.supaUserId || profile?.id || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(state?.wallet || null);
  const [freshProfile, setFreshProfile] = useState<any>(profile || null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const [catalogRows, walletRow, profileRow] = await Promise.all([
        fetchArenaTicketCatalog().catch(() => []),
        userId ? fetchMyWallet(userId).catch(() => wallet) : Promise.resolve(wallet),
        userId ? fetchMyProfile(userId).catch(() => profile) : Promise.resolve(profile),
      ]);
      const safeCatalog = Array.isArray(catalogRows) ? catalogRows : [];
      setCatalog(safeCatalog);
      setWallet(walletRow || null);
      setFreshProfile(profileRow || null);
      setState((prev: any) => ({
        ...prev,
        arenaEvents: safeCatalog,
        wallet: walletRow || prev?.wallet || null,
        profile: profileRow || prev?.profile || null,
        missionFlags: { ...(prev?.missionFlags || {}), viewedArena: true },
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [userId]);

  const verification = normalizeVerificationStatus(freshProfile?.verification_status || profile?.verification_status || 'PENDING');
  const totalWallet = Number(wallet?.wallet_balance || 0) + Number(wallet?.wallet_bonus_balance || 0);

  async function handleBuy(night: any, ticketType: 'STANDARD' | 'VIP') {
    if (!userId) return navigation.navigate('Profile');
    try {
      const key = `${String(night?.id)}_${ticketType}`;
      setBuyingKey(key);
      await buyArenaTicket({ userId, arenaNightId: String(night?.id), ticketType });
      playSound?.('confirm');
      setState((prev: any) => ({
        ...prev,
        missionFlags: { ...(prev?.missionFlags || {}), boughtTicketCount: Number(prev?.missionFlags?.boughtTicketCount || 0) + 1, viewedArena: true },
      }));
      await load(true);
      Alert.alert('Billet acheté', `Billet ${ticketType === 'VIP' ? 'VIP' : 'simple'} ajouté à ton compte.`);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message === 'KYC_REQUIRED' ? 'Ton profil doit être validé.' : e?.message === 'INSUFFICIENT_WALLET_BALANCE' ? 'Wallet insuffisant. Ouvre ton wallet pour charger ton compte.' : (e?.message || 'Action impossible.'));
    } finally {
      setBuyingKey(null);
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
          <Text style={styles.title}>BILLETTERIE</Text>
          <Text style={styles.sub}>LES PORTES OUVRENT LE 19 MAI.</Text>
        </View>

        <View style={styles.hudRow}>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>KYC</Text><Text style={styles.hudValue}>{verification}</Text></View>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>WALLET</Text><Text style={styles.hudValue}>{money(totalWallet)}</Text></View>
        </View>

        {(verification !== 'VERIFIED') ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>VALIDATION REQUISE</Text>
            <Text style={styles.noticeText}>Ton dossier doit être validé avant l’achat d’un billet.</Text>
            <View style={styles.noticeActions}>
              <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Profile')}><Text style={styles.primaryBtnText}>OUVRIR MON PROFIL</Text></Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Wallet')}><Text style={styles.secondaryBtnText}>OUVRIR WALLET</Text></Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.walletQuickBtn} onPress={() => navigation.navigate('Wallet')}><Text style={styles.walletQuickBtnText}>OUVRIR WALLET</Text></Pressable>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>SOIRÉES DU LANCEMENT</Text>
          {loading ? (
            <View style={styles.Wrap}><ActivityIndicator size="large" color="#d4af37" /><Text style={styles.Text}>Chargement...</Text></View>
          ) : catalog.length <= 0 ? (
            <Text style={styles.emptyText}>Aucune soirée ouverte autour du 19 mai pour l’instant.</Text>
          ) : catalog.map((night: any) => {
            const standardPrice = Number(night?.standard_price || 0);
            const vipPrice = Number(night?.vip_price || 0);
            const standardKey = `${String(night?.id)}_STANDARD`;
            const vipKey = `${String(night?.id)}_VIP`;
            return (
              <View key={String(night?.id)} style={styles.nightCard}>
                <View style={styles.nightTop}>
                  <Text style={styles.nightType}>{String(night?.ui_type_label || 'LEAGUE NIGHT').toUpperCase()}</Text>
                  <Text style={styles.nightDate}>{dateText(night?.event_date)}</Text>
                </View>
                <Text style={styles.nightTitle}>{String(night?.title || 'ARENA NIGHT').toUpperCase()}</Text>
                <View style={styles.priceRow}>
                  <Pressable style={[styles.buyBtn, buyingKey === standardKey && styles.disabledBtn]} disabled={!!buyingKey || verification !== 'VERIFIED'} onPress={() => handleBuy(night, 'STANDARD')}>
                    <Text style={styles.buyType}>PLACE SIMPLE</Text>
                    <Text style={styles.buyPrice}>{money(standardPrice)}</Text>
                  </Pressable>
                  <Pressable style={[styles.buyBtn, styles.vipBtn, buyingKey === vipKey && styles.disabledBtn]} disabled={!!buyingKey || verification !== 'VERIFIED'} onPress={() => handleBuy(night, 'VIP')}>
                    <Text style={styles.buyType}>PLACE VIP</Text>
                    <Text style={styles.buyPrice}>{money(vipPrice)}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <Pressable style={styles.secondaryBtn} onPress={() => { playSound?.('tap'); navigation.navigate('ArenaTickets'); }}>
          <Text style={styles.secondaryBtnText}>VOIR MES BILLETS</Text>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060a' },
  bgImage: { opacity: 0.3 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,5,9,0.82)' },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  hero: { borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.22)', backgroundColor: 'rgba(11,13,20,0.94)' },
  kicker: { color: '#d4af37', fontFamily: 'Inter', fontWeight: '900', fontSize: 11, letterSpacing: 1.7 },
  title: { color: '#fff', fontFamily: 'Bebas', fontSize: 38 },
  sub: { color: '#c7ced8', fontFamily: 'Inter', fontSize: 14, lineHeight: 21 },
  hudRow: { flexDirection: 'row', gap: 10 },
  hudBox: { flex: 1, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  hudLabel: { color: '#8e9aaf', fontFamily: 'Inter', fontSize: 11, fontWeight: '700' },
  hudValue: { color: '#fff', fontFamily: 'Bebas', fontSize: 24, marginTop: 4 },
  notice: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(236,73,0,0.24)', backgroundColor: 'rgba(60,14,6,0.45)', gap: 8 },
  noticeTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28 },
  noticeText: { color: '#c7ced8', fontFamily: 'Inter', lineHeight: 20 },
  noticeActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  card: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(11,13,20,0.92)', gap: 12 },
  sectionTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 1 },
  Wrap: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  Text: { color: '#aab4c3', fontFamily: 'Inter' },
  emptyText: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 13, lineHeight: 20 },
  nightCard: { borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.03)', gap: 10 },
  nightTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  nightType: { color: '#d4af37', fontFamily: 'Inter', fontWeight: '900', fontSize: 11, letterSpacing: 1.1 },
  nightDate: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 12 },
  nightTitle: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 16 },
  priceRow: { flexDirection: 'row', gap: 10 },
  buyBtn: { flex: 1, minHeight: 74, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  vipBtn: { borderColor: 'rgba(212,175,55,0.22)' },
  buyType: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  buyPrice: { color: '#fff', fontFamily: 'Bebas', fontSize: 28 },
  primaryBtn: { minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ec4900', paddingHorizontal: 14 },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  secondaryBtn: { minHeight: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14 },
  secondaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  walletQuickBtn: { minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(236,73,0,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  walletQuickBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  disabledBtn: { opacity: 0.45 },
});
