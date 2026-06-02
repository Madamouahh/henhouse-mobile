import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppContext } from '../App';
import { fetchMyProfile, fetchMyTickets, fetchMyWallet, normalizeVerificationStatus } from '../services/hhApi';

const BG = require('../assets/backgrounds/hh_intro_bg.jpg');
function money(v: any) { return '$' + Number(v || 0).toLocaleString('en-US'); }
function upper(v: any) { return String(v || '').trim().toUpperCase(); }
function dateText(v?: string | null) {
  if (!v) return 'DATE À CONFIRMER';
  try { return new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).toUpperCase(); }
  catch { return 'DATE À CONFIRMER'; }
}

export default function ArenaTicketsScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const userId = state?.supaUserId || state?.profile?.id || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(state?.wallet || null);
  const [profile, setProfile] = useState<any>(state?.profile || null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const [mine, walletRow, profileRow] = await Promise.all([
        userId ? fetchMyTickets(userId).catch(() => []) : Promise.resolve([]),
        userId ? fetchMyWallet(userId).catch(() => wallet) : Promise.resolve(wallet),
        userId ? fetchMyProfile(userId).catch(() => profile) : Promise.resolve(profile),
      ]);
      const safeTickets = Array.isArray(mine) ? mine : [];
      setTickets(safeTickets);
      setWallet(walletRow || null);
      setProfile(profileRow || null);
      setState((prev: any) => ({
        ...prev,
        tickets: safeTickets,
        wallet: walletRow || prev?.wallet || null,
        profile: profileRow || prev?.profile || null,
        missionFlags: { ...(prev?.missionFlags || {}), viewedArena: true },
      }));
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible de charger tes billets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [userId]);

  const verification = normalizeVerificationStatus(profile?.verification_status || 'PENDING');
  const totalWallet = Number(wallet?.wallet_balance || 0) + Number(wallet?.wallet_bonus_balance || 0);

  return (
    <ImageBackground source={BG} style={styles.container} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.kicker}>TICKETS</Text>
          <Text style={styles.title}>MES BILLETS</Text>
          <Text style={styles.sub}>Tes places simples et VIP. Rien d’autre.</Text>
        </View>

        <View style={styles.hudRow}>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>KYC</Text><Text style={styles.hudValue}>{verification}</Text></View>
          <View style={styles.hudBox}><Text style={styles.hudLabel}>WALLET</Text><Text style={styles.hudValue}>{money(totalWallet)}</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>BILLETS ACTIFS</Text>
          {loading ? (
            <View style={styles.Wrap}><ActivityIndicator size="large" color="#d4af37" /><Text style={styles.Text}>Chargement...</Text></View>
          ) : tickets.length <= 0 ? (
            <Text style={styles.emptyText}>Aucun billet sur ce compte.</Text>
          ) : tickets.map((ticket: any) => {
            const used = !!ticket?.checked_in_at || upper(ticket?.status) === 'USED';
            return (
              <Pressable key={String(ticket?.id)} style={styles.ticketRow} onPress={() => navigation.navigate('TicketDetail', { ticketId: String(ticket?.id), ticket })}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.ticketType}>{upper(ticket?.ticket_type || 'STANDARD')}</Text>
                  <Text style={styles.ticketMeta}>{String(ticket?.title || 'ARENA ACCESS').toUpperCase()}</Text>
                  <Text style={styles.ticketMeta}>{dateText(ticket?.event_date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.ticketPrice}>{money(ticket?.price_cents || 0)}</Text>
                  <Text style={[styles.ticketStatus, used && styles.ticketUsed]}>{used ? 'UTILISÉ' : 'ACTIF'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Arena')}>
          <Text style={styles.secondaryBtnText}>RETOUR BILLETTERIE</Text>
        </Pressable>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060a' },
  bgImage: { opacity: 0.28 },
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
  card: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(11,13,20,0.92)', gap: 12 },
  sectionTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 1 },
  Wrap: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  Text: { color: '#aab4c3', fontFamily: 'Inter' },
  emptyText: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 13, lineHeight: 20 },
  ticketRow: { flexDirection: 'row', gap: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 18 },
  ticketType: { color: '#fff', fontFamily: 'Bebas', fontSize: 24 },
  ticketMeta: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 12 },
  ticketPrice: { color: '#fff', fontFamily: 'Bebas', fontSize: 24 },
  ticketStatus: { color: '#8cf2b8', fontFamily: 'Inter', fontWeight: '900', fontSize: 11 },
  ticketUsed: { color: '#ffd166' },
  secondaryBtn: { minHeight: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  secondaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
});
