// HHFC RELEASE CANDIDATE FINAL
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppContext } from '../App';
import { fetchBookmakerOverview, fetchMyProfile, requestBookmakerApplication } from '../services/hhApi';
import { playSound } from '../services/sound';
import { canAccessRoleScreen, resolveActiveRole } from '../utils/access';

const BG = require('../assets/bookmaker/book_room.png');
const __hhBlockedPrefixes = ['', '', '', ''];
function upper(v: any) { return String(v || '').trim().toUpperCase(); }
function money(v: any) { return '$' + Number(v || 0).toLocaleString('en-US'); }
function shortDate(v?: string | null) {
  try { return v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }).toUpperCase() : 'DATE'; }
  catch { return 'DATE'; }
}

export default function BookmakerHomeScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const profile = state?.profile || null;
  const userId = state?.supaUserId || profile?.id || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [freshProfile, setFreshProfile] = useState<any>(profile || null);

  async function load(silent = false) {
    if (!userId) { setLoading(false); return; }
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const [overviewRow, profileRow] = await Promise.all([
        fetchBookmakerOverview(userId).catch(() => null),
        fetchMyProfile(userId).catch(() => profile),
      ]);
      const safeOverview = overviewRow || null;
      const kpis = safeOverview?.kpis || {};
      setOverview(safeOverview);
      setFreshProfile(profileRow || null);
      setState((prev: any) => ({
        ...prev,
        profile: profileRow || prev?.profile || null,
        bookmakerOverview: safeOverview,
        missionFlags: {
          ...(prev?.missionFlags || {}),
          openedBookmaker: true,
          affiliateVolumeCount: Math.max(0, Number(kpis?.approved_deposit_requests || 0)),
          affiliateActiveCount: Math.max(0, Number(kpis?.referred_users || 0)),
        },
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [userId]);

  const activeRole = resolveActiveRole(state, freshProfile?.role || profile?.role);
  const status = upper(overview?.status || freshProfile?.bookmaker_status || 'NONE');
  const approved = status === 'APPROVED';
  const pending = status === 'PENDING';
  const code = String(overview?.referral_code || freshProfile?.bookmaker_code || state?.preopen?.bookmakerCode || '').trim().toUpperCase();
  const kpis = overview?.kpis || {};
  const referredUsers = Array.isArray(overview?.referred_users) ? overview.referred_users : [];
  const commissions = Array.isArray(overview?.commissions) ? overview.commissions : [];

  useEffect(() => {
    if (!canAccessRoleScreen(activeRole, 'BookmakerHome')) navigation.replace('Home');
  }, [activeRole]);

  async function handleApply() {
    if (!userId) return navigation.navigate('Profile');
    try {
      setLoading(true);
      await requestBookmakerApplication({ userId, bookmakerCode: code || undefined });
      setState((prev: any) => ({ ...prev, missionFlags: { ...(prev?.missionFlags || {}), bookmakerApplied: true, openedBookmaker: true } }));
      await load();
      Alert.alert('Candidature envoyée', 'Le staff doit valider ton accès bookmaker.');
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d’envoyer la candidature.');
    } finally {
      setLoading(false);
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
          <Text style={styles.kicker}>RÉSEAU</Text>
          <Text style={styles.title}>BOOKMAKER</Text>
          <Text style={styles.sub}>{approved ? 'Ton code tourne. Ton réseau doit vivre.' : 'Dépose ton dossier. Fais valider ton accès. Ensuite seulement, ton code travaille.'}</Text>
        </View>

        <View style={styles.hudRow}>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>STATUT</Text><Text style={styles.hudValue}>{status}</Text></View>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>CODE</Text><Text style={styles.hudValue}>{code || '—'}</Text></View>
        </View>

        {!approved ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{pending ? 'DOSSIER EN ATTENTE' : 'DEVIENS BOOKMAKER'}</Text>
            <Text style={styles.noticeText}>{pending ? 'Le staff doit maintenant trancher ton accès. Sans validation, ton réseau reste fermé.' : 'Ton code, tes affiliés et tes commissions ne vivent qu’après validation.'}</Text>
            <Pressable style={[styles.primaryBtn, pending && styles.disabledBtn]} disabled={pending} onPress={handleApply}>
              <Text style={styles.primaryBtnText}>{pending ? 'ATTENTE VALIDATION' : 'ENVOYER MA CANDIDATURE'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>TES CHIFFRES</Text>
          {loading ? (
            <View style={styles.Wrap}><ActivityIndicator size="large" color="#7b61ff" /><Text style={styles.Text}>Chargement du réseau...</Text></View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statBox}><Text style={styles.statLabel}>ACTIFS</Text><Text style={styles.statValue}>{String(kpis?.referred_users || 0)}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>DÉPÔTS</Text><Text style={styles.statValue}>{String(kpis?.approved_deposit_requests || 0)}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>TOTAL</Text><Text style={styles.statValue}>{money(kpis?.commission_total_cents || 0)}</Text></View>
              <View style={styles.statBox}><Text style={styles.statLabel}>PAYÉ</Text><Text style={styles.statValue}>{money(kpis?.commission_paid_cents || 0)}</Text></View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>RÉSEAU</Text>
          {referredUsers.length <= 0 ? <Text style={styles.emptyText}>Aucun joueur actif pour le moment.</Text> : referredUsers.slice(0, 6).map((row: any) => (
            <View key={String(row?.id || row?.rp_name)} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{String(row?.rp_name || 'JOUEUR').toUpperCase()}</Text>
                <Text style={styles.listSub}>{upper(row?.role || 'PLAYER')} · {shortDate(row?.created_at)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>COMMISSIONS</Text>
          {commissions.length <= 0 ? <Text style={styles.emptyText}>Aucune commission visible.</Text> : commissions.slice(0, 6).map((row: any) => (
            <View key={String(row?.id)} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{upper(row?.source_type || 'COMMISSION')}</Text>
                <Text style={styles.listSub}>{shortDate(row?.created_at)} · {upper(row?.status || 'PENDING')}</Text>
              </View>
              <Text style={styles.amount}>{money(row?.amount_cents || 0)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.inlineButtons}>
          <Pressable style={styles.secondaryBtn} onPress={() => { playSound?.('tap'); navigation.navigate('Profile'); }}>
            <Text style={styles.secondaryBtnText}>MON PROFIL</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => { playSound?.('tap'); navigation.navigate('Wallet'); }}>
            <Text style={styles.primaryBtnText}>{approved ? 'OUVRIR MON WALLET' : 'VOIR MON DOSSIER'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06070d' },
  bgImage: { resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,8,12,0.78)' },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  hero: { borderRadius: 24, padding: 18, backgroundColor: 'rgba(13,10,22,0.92)', borderWidth: 1, borderColor: 'rgba(123,97,255,0.25)' },
  kicker: { color: '#b6abff', fontFamily: 'Inter', fontWeight: '900', fontSize: 11, letterSpacing: 1.7 },
  title: { color: '#fff', fontFamily: 'Bebas', fontSize: 38 },
  sub: { color: '#dadff0', fontFamily: 'Inter', fontSize: 14, lineHeight: 21 },
  hudRow: { flexDirection: 'row', gap: 10 },
  hudBox: { flex: 1, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  hudLabel: { color: '#a7b0c7', fontFamily: 'Inter', fontSize: 11, fontWeight: '700' },
  hudValue: { color: '#fff', fontFamily: 'Bebas', fontSize: 24, marginTop: 4 },
  notice: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(123,97,255,0.22)', backgroundColor: 'rgba(18,12,32,0.88)', gap: 8 },
  noticeTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28 },
  noticeText: { color: '#dadff0', fontFamily: 'Inter', lineHeight: 20 },
  card: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(10,12,18,0.92)', gap: 12 },
  sectionTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 1 },
  Wrap: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  Text: { color: '#dadff0', fontFamily: 'Inter' },
  statsGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statBox: { width: '48%', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  statLabel: { color: '#a7b0c7', fontFamily: 'Inter', fontSize: 10, fontWeight: '700' },
  statValue: { color: '#fff', fontFamily: 'Bebas', fontSize: 24, marginTop: 4 },
  listRow: { flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingVertical: 10 },
  listTitle: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 13 },
  listSub: { color: '#a7b0c7', fontFamily: 'Inter', fontSize: 12, marginTop: 4 },
  amount: { color: '#fff', fontFamily: 'Bebas', fontSize: 24 },
  emptyText: { color: '#a7b0c7', fontFamily: 'Inter', fontSize: 13, lineHeight: 20 },
  inlineButtons: { flexDirection: 'row', gap: 10 },
  primaryBtn: { flex: 1, minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#7b61ff', paddingHorizontal: 14 },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8, textAlign: 'center' },
  secondaryBtn: { flex: 1, minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14 },
  secondaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
  disabledBtn: { opacity: 0.45 },
});

// HHFC FINAL BOOKMAKER LOCKS
// - dashboard accessible only if bookmaker_status === 'APPROVED'
// - bettors/fighters blocked from bookmaker routes
// - bookmaker code immutable after approval
