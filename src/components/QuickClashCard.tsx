import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from './ui';

type Props = {
  onlineCount?: number;
  searchingCount?: number;
  onLaunch: () => void;
  onWatch?: () => void;
  disabled?: boolean;
};

export default function QuickClashCard({
  onlineCount = 0,
  searchingCount = 0,
  onLaunch,
  onWatch,
  disabled = false,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.glow} />

      <View style={styles.topRow}>
        <Text style={styles.kicker}>LIVE ARCADE MODE</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>5000 VS 5000</Text>
        </View>
      </View>

      <Text style={styles.title}>⚡ QUICK CLASH</Text>
      <Text style={styles.sub}>
        Duel instantané entre joueurs. Tête 45 • Corps 30 • Jambes 20. Bonne défense = 0 dégât.
      </Text>

      <View style={styles.rulesRow}>
        <View style={styles.ruleBox}>
          <Text style={styles.ruleLabel}>DURÉE</Text>
          <Text style={styles.ruleValue}>20 SEC</Text>
        </View>
        <View style={styles.ruleBox}>
          <Text style={styles.ruleLabel}>HP</Text>
          <Text style={styles.ruleValue}>100</Text>
        </View>
        <View style={styles.ruleBox}>
          <Text style={styles.ruleLabel}>GAIN</Text>
          <Text style={styles.ruleValue}>9000</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>En ligne : {onlineCount}</Text>
        <Text style={styles.metaText}>En recherche : {searchingCount}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onLaunch}
          disabled={disabled}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, disabled && styles.disabledBtn]}
        >
          <Text style={styles.primaryBtnText}>{disabled ? 'INDISPONIBLE' : 'LANCER QUICK CLASH'}</Text>
        </Pressable>

        {onWatch ? (
          <Pressable onPress={onWatch} style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}>
            <Text style={styles.secondaryBtnText}>REGARDER LE LIVE</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.24)',
    gap: 12,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,229,255,0.08)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  kicker: {
    color: COLORS.cyan,
    fontFamily: 'GameBoy',
    fontSize: 10,
    letterSpacing: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,122,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.36)',
  },
  badgeText: {
    color: COLORS.orange,
    fontFamily: 'GameBoy',
    fontSize: 9,
  },
  title: {
    color: COLORS.text,
    fontFamily: 'StreetFight',
    fontSize: 28,
    letterSpacing: 0.8,
  },
  sub: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  rulesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ruleBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  ruleLabel: {
    color: COLORS.muted,
    fontFamily: 'GameBoy',
    fontSize: 9,
  },
  ruleValue: {
    color: COLORS.text,
    fontFamily: 'StreetFight',
    fontSize: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    color: COLORS.text,
    fontFamily: 'GameBoy',
    fontSize: 10,
  },
  actionRow: {
    gap: 10,
  },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: COLORS.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  primaryBtnText: {
    color: '#061017',
    fontFamily: 'StreetFight',
    fontSize: 16,
    letterSpacing: 0.6,
  },
  secondaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryBtnText: {
    color: COLORS.text,
    fontFamily: 'GameBoy',
    fontSize: 11,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  disabledBtn: {
    opacity: 0.45,
  },
});
