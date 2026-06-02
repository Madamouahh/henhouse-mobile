import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppContext } from '../App';
import { fetchMyTickets } from '../services/hhApi';
import { playSound } from '../services/sound';

const BG = require('../assets/backgrounds/hh_intro_bg.jpg');
function upper(v: any) { return String(v || '').trim().toUpperCase(); }
function money(v: any) { return '$' + Number(v || 0).toLocaleString('en-US'); }
function fmtDate(v?: string | null) {
  if (!v) return 'DATE À CONFIRMER';
  try { return new Date(v).toLocaleString('fr-FR'); }
  catch { return 'DATE À CONFIRMER'; }
}
function normalize(ticket: any) {
  if (!ticket) return null;
  return {
    ...ticket,
    ticket_type: upper(ticket?.ticket_type || 'STANDARD'),
    price_cents: Number(ticket?.price_cents ?? 0),
    checked_in_at: ticket?.checked_in_at || null,
    status: upper(ticket?.status || (ticket?.checked_in_at ? 'USED' : 'PAID')),
    event_date: ticket?.event_date || ticket?.starts_at || ticket?.night_date || null,
    title: ticket?.title || ticket?.event_title || 'ARENA ACCESS',
  };
}

export default function TicketDetailScreen({ navigation, route }: any) {
  const { state, setState } = useContext(AppContext);
  const userId = state?.supaUserId || state?.profile?.id || null;
  const ticketId = String(route?.params?.ticketId || route?.params?.ticket?.id || '');
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<any>(normalize(route?.params?.ticket || null));

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (!userId) { if (mounted) setLoading(false); return; }
        setLoading(true);
        const data = await fetchMyTickets(userId);
        const safe = Array.isArray(data) ? data : [];
        const found = safe.find((row: any) => String(row?.id) === ticketId) || route?.params?.ticket || null;
        if (!mounted) return;
        setTicket(normalize(found));
        setState((prev: any) => ({ ...prev, tickets: safe }));
      } catch (e: any) {
        Alert.alert('Erreur', e?.message || 'Impossible de charger le billet.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [userId, ticketId]);

  const used = useMemo(() => !!ticket?.checked_in_at || upper(ticket?.status) === 'USED', [ticket]);
  const stateLabel = used ? 'BILLET UTILISÉ' : upper(ticket?.status || 'PAID') === 'PAID' ? 'BILLET ACTIF' : upper(ticket?.status || 'PAID');

  return (
    <ImageBackground source={BG} style={styles.container} imageStyle={styles.bgImage}>
      <View style={styles.overlay} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#7b61ff" />
            <Text style={styles.Text}>Chargement du billet...</Text>
          </View>
        ) : !ticket ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>BILLET INTROUVABLE</Text>
            <Text style={styles.emptyText}>Le billet demandé n’a pas été retrouvé.</Text>
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.kicker}>{stateLabel}</Text>
              <Text style={styles.title}>{String(ticket?.title || 'ARENA ACCESS').toUpperCase()}</Text>
              <Text style={styles.sub}>{used ? 'Ce billet a déjà été scanné à l’entrée.' : 'Conserve ce billet jusqu’au contrôle d’accès.'}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaBox}><Text style={styles.metaLabel}>TYPE</Text><Text style={styles.metaValue}>{upper(ticket?.ticket_type || 'STANDARD')}</Text></View>
                <View style={styles.metaBox}><Text style={styles.metaLabel}>PRIX</Text><Text style={styles.metaValue}>{money(ticket?.price_cents || 0)}</Text></View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>DÉTAILS</Text>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Date</Text><Text style={styles.infoValue}>{fmtDate(ticket?.event_date)}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Statut</Text><Text style={styles.infoValue}>{stateLabel}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Scan</Text><Text style={styles.infoValue}>{ticket?.checked_in_at ? fmtDate(ticket?.checked_in_at) : 'NON SCANNÉ'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Référence</Text><Text style={styles.infoValue}>{String(ticket?.id || '—').slice(0, 8).toUpperCase()}</Text></View>
            </View>

            <Pressable style={styles.primaryBtn} onPress={() => { playSound('tap'); navigation.navigate('ArenaTickets'); }}>
              <Text style={styles.primaryBtnText}>RETOUR BILLETTERIE</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060a' },
  bgImage: { opacity: 0.3 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,4,8,0.78)' },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  centerWrap: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 10 },
  Text: { color: '#fff', fontFamily: 'Inter', fontWeight: '700' },
  hero: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(123,97,255,0.22)', backgroundColor: 'rgba(11,13,20,0.94)', gap: 12 },
  kicker: { color: '#7b61ff', fontFamily: 'Inter', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  title: { color: '#fff', fontFamily: 'Bebas', fontSize: 34 },
  sub: { color: '#d9e1f2', fontFamily: 'Inter', fontSize: 14, lineHeight: 21 },
  metaRow: { flexDirection: 'row', gap: 10 },
  metaBox: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12 },
  metaLabel: { color: '#95a0b6', fontFamily: 'Inter', fontSize: 11, letterSpacing: 1 },
  metaValue: { color: '#fff', fontFamily: 'Bebas', fontSize: 24, marginTop: 4 },
  card: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(11,13,20,0.92)', gap: 12 },
  sectionTitle: { color: '#fff', fontFamily: 'Bebas', fontSize: 28, letterSpacing: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingVertical: 10 },
  infoLabel: { color: '#aab4c3', fontFamily: 'Inter', fontSize: 13 },
  infoValue: { flex: 1, textAlign: 'right', color: '#f5f7ff', fontFamily: 'Inter', fontWeight: '800', fontSize: 13 },
  emptyText: { color: '#c7ced8', fontFamily: 'Inter', fontSize: 14, lineHeight: 22 },
  primaryBtn: { minHeight: 54, borderRadius: 16, backgroundColor: '#ec4900', justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontFamily: 'Inter', fontWeight: '900', fontSize: 12, letterSpacing: 0.8 },
});
