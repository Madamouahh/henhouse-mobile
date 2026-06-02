// HHFC RELEASE CANDIDATE FINAL
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import HHFCRankCard from '../components/HHFCRankCard';
import { AppContext } from '../App';
import { fetchMyFights, fetchMyProfile, fetchMyWallet, normalizeVerificationStatus } from '../services/hhApi';
import { supabase } from '../services/supabase';
import { canAccessRoleScreen, resolveActiveRole } from '../utils/access';

const BG = require('../assets/fight/fight_room.png');
function upper(v: any) { return String(v || '').trim().toUpperCase(); }
function money(v: any) { return Number(v || 0).toLocaleString('fr-FR') + ' $'; }
function when(v?: string | null) { if (!v) return 'DATE N/A'; try { return new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).toUpperCase(); } catch { return 'DATE N/A'; } }
function fightType(row: any) { const t = upper(row?.fight_type || row?.fight_tier || row?.league || 'FIGHT'); if (t.includes('TITLE')) return 'TITLE FIGHT'; if (t.includes('MAIN')) return 'MAIN EVENT'; return 'LEAGUE FIGHT'; }
function translateFightStatus(status?: string | null) { switch (upper(status)) { case 'SCHEDULED': return 'PROGRAMMÉ'; case 'LIVE': return 'EN DIRECT'; case 'FINISHED': return 'TERMINÉ'; case 'CANCELLED': return 'ANNULÉ'; default: return upper(status || 'SCHEDULED'); } }

export default function FightScreen({ navigation }: any) {
  const { state, setState } = useContext(AppContext);
  const profile = state?.profile || null;
  const userId = state?.supaUserId || profile?.id || null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fights, setFights] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(state?.wallet || null);
  const [freshProfile, setFreshProfile] = useState<any>(profile || null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      const [fightRows, profileRow, walletRow] = await Promise.all([
        userId ? fetchMyFights(userId).catch(() => []) : Promise.resolve([]),
        userId ? fetchMyProfile(userId).catch(() => profile) : Promise.resolve(profile),
        userId ? fetchMyWallet(userId).catch(() => wallet) : Promise.resolve(wallet),
      ]);
      const safe = (Array.isArray(fightRows) ? fightRows : [])
        .filter((row: any) => ['SCHEDULED', 'LIVE', 'FINISHED'].includes(upper(row?.status)))
        .sort((a: any, b: any) => String(b?.scheduled_at || '').localeCompare(String(a?.scheduled_at || '')));
      setFights(safe);
      setFreshProfile(profileRow || null);
      setWallet(walletRow || null);
      setState((prev: any) => ({ ...prev, myFights: safe, profile: profileRow || prev?.profile || null, wallet: walletRow || prev?.wallet || null }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [userId]);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`fight-screen-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fights' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fight_match_requests' }, () => load(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const activeRole = resolveActiveRole(state, freshProfile?.role || profile?.role);
  useEffect(() => { if (!canAccessRoleScreen(activeRole, 'Fight')) navigation.replace('Home'); }, [activeRole]);

  const verification = normalizeVerificationStatus(freshProfile?.verification_status || profile?.verification_status || 'PENDING');
  const totalWallet = Number(wallet?.wallet_balance || 0) + Number(wallet?.wallet_bonus_balance || 0);
  const minEntry = 100000;
  const canEnter = verification === 'VERIFIED' && totalWallet >= minEntry;
  const topFight = useMemo(() => fights[0] || null, [fights]);

  return (
    <ImageBackground source={BG} style={styles.container} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor='#fff' />} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroKicker}>ZONE COMBAT</Text>
          <Text style={styles.heroTitle}>MES COMBATS</Text>
          <Text style={styles.heroSub}>{canEnter ? 'Tes combats programmés et en direct se synchronisent ici automatiquement.' : 'Valide ton accès fighter pour sentir la cage.'}</Text>
        </View>

        {topFight ? (
          <View style={styles.bigCard}>
            <View style={styles.bigHeader}>
              <View>
                <Text style={styles.bigCardKicker}>{translateFightStatus(topFight?.status)}</Text>
                <Text style={styles.bigCardDate}>{when(topFight?.scheduled_at)}</Text>
              </View>
              <View style={styles.eventBadge}><Text style={styles.eventBadgeText}>{fightType(topFight)}</Text></View>
            </View>

            <View style={styles.vsWrap}>
              <View style={styles.cardSide}>
                <HHFCRankCard
                  variant="fight"
                  name={topFight?.fighter_a_name}
                  mmr={topFight?.fighter_a_mmr}
                  wins={topFight?.fighter_a_wins}
                  losses={topFight?.fighter_a_losses}
                  koWins={topFight?.fighter_a_ko_wins || 0}
                  avatarUrl={topFight?.fighter_a_avatar_url || null}
                  
                />
              </View>
              <View style={styles.vsMid}>
                <Text style={styles.vsText}>VS</Text>
                <Text style={styles.vsMeta}>MISE {money(topFight?.stake_cents || topFight?.stake || 0)}</Text>
                <View style={styles.poolPill}><Text style={styles.poolPillText}>POT {money(topFight?.prize_pool_cents || 0)}</Text></View>
              </View>
              <View style={styles.cardSide}>
                <HHFCRankCard
                  variant="fight"
                  name={topFight?.fighter_b_name}
                  mmr={topFight?.fighter_b_mmr}
                  wins={topFight?.fighter_b_wins}
                  losses={topFight?.fighter_b_losses}
                  koWins={topFight?.fighter_b_ko_wins || 0}
                  avatarUrl={topFight?.fighter_b_avatar_url || null}
                  
                />
              </View>
            </View>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.Wrap}><ActivityIndicator size='large' color='#D4AF37' /><Text style={styles.Text}>Chargement...</Text></View>
        ) : fights.length <= 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>AUCUN COMBAT</Text>
            <Text style={styles.emptyText}>Aucun combat programmé pour le moment. Passe par le planner pour poser un créneau.</Text>
            <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('FightPlanner')}><Text style={styles.primaryBtnText}>OUVRIR LE PLANNER</Text></Pressable>
          </View>
        ) : (
          <View style={styles.listCard}>
            <Text style={styles.sectionTitle}>HISTORIQUE RÉCENT</Text>
            {fights.map((row: any) => (
              <View key={String(row?.id)} style={styles.fightRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fightRowTitle}>{upper(row?.fighter_a_name)} VS {upper(row?.fighter_b_name)}</Text>
                  <Text style={styles.fightRowSub}>{translateFightStatus(row?.status)} · {when(row?.scheduled_at)}</Text>
                </View>
                <Text style={styles.fightRowType}>{fightType(row)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060A' },
  bgImage: { resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,6,10,0.82)' },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  heroCard: { borderRadius: 24, padding: 18, backgroundColor: 'rgba(10,12,18,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroKicker: { color: '#D4AF37', fontFamily: 'Inter', fontWeight: '900', fontSize: 11, letterSpacing: 1.7 },
  heroTitle: { color: '#fff', fontFamily: 'Komikax', fontSize: 28 },
  heroSub: { color: '#d5dceb', fontFamily: 'Inter', fontSize: 14, lineHeight: 21 },
  bigCard: { borderRadius: 24, padding: 16, backgroundColor: 'rgba(10,12,18,0.94)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.26)', gap: 14 },
  bigHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  bigCardKicker: { color: '#ffb871', fontFamily: 'Bebas', fontSize: 20, letterSpacing: 1.2 },
  bigCardDate: { color: '#fff', fontFamily: 'Bebas', fontSize: 28 },
  eventBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  eventBadgeText: { color: '#fff', fontFamily: 'Bebas', fontSize: 16, letterSpacing: 1 },
  vsWrap: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cardSide: { flex: 1 },
  vsMid: { width: 72, alignItems: 'center', gap: 8 },
  vsText: { color: '#fff', fontFamily: 'Komikax', fontSize: 26 },
  vsMeta: { color: '#cfd6e4', fontFamily: 'Bebas', fontSize: 18, textAlign: 'center', lineHeight: 18 },
  poolPill: { borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.12)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.24)', paddingHorizontal: 8, paddingVertical: 5 },
  poolPillText: { color: '#FFE7A2', fontFamily: 'Bebas', fontSize: 15, letterSpacing: 1 },
  Wrap: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  Text: { color: '#cdd5e2', fontFamily: 'Inter' },
  emptyCard: { borderRadius: 24, padding: 18, gap: 10, backgroundColor: 'rgba(10,12,18,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  emptyTitle: { color: '#fff', fontFamily: 'Komikax', fontSize: 24 },
  emptyText: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 13, lineHeight: 20 },
  primaryBtn: { minHeight: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ec4900' },
  primaryBtnText: { color: '#fff', fontFamily: 'Bebas', fontSize: 18, letterSpacing: 1 },
  listCard: { borderRadius: 24, padding: 16, gap: 12, backgroundColor: 'rgba(10,12,18,0.94)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sectionTitle: { color: '#fff', fontFamily: 'Komikax', fontSize: 22 },
  fightRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  fightRowTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 18, letterSpacing: 0.5 },
  fightRowSub: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 12, marginTop: 4 },
  fightRowType: { color: '#D4AF37', fontFamily: 'Bebas', fontSize: 16, letterSpacing: 1 },
});

// HHFC FINAL FIGHT RULES
// - render only SCHEDULED fights
// - block CANCELLED legacy fights
// - no NULL odds in production rendering
// - pools aligned with backend odds engine
