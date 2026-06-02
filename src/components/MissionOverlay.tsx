import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  title: string;
  rewardLine?: string | null;
  unlockLine?: string | null;
  coachLine?: string | null;
  accent?: string;
  onContinue: () => void;
};

function upper(value: any) {
  return String(value || "").trim().toUpperCase();
}

export default function MissionOverlay({
  visible,
  title,
  rewardLine,
  unlockLine,
  coachLine,
  accent = "#D4AF37",
  onContinue,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  const glow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      scale.setValue(0.92);
      glow.setValue(0.4);
      return;
    }

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 72, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.45, duration: 900, useNativeDriver: true }),
        ])
      ),
    ]).start();
  }, [visible, fade, scale, glow]);

  const rewardBlocks = useMemo(() => {
    const blocks = [rewardLine, unlockLine].filter(Boolean).map((line) => upper(line));
    return blocks.slice(0, 3);
  }, [rewardLine, unlockLine]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onContinue}>
      <View style={styles.wrap}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fade,
              transform: [{ scale }],
              borderColor: accent,
              shadowOpacity: glow,
            },
          ]}
        >
          <Text style={[styles.kicker, { color: accent }]}>MISSION VALIDÉE</Text>
          <Text style={styles.title}>{upper(title)}</Text>

          <View style={styles.rewardsRow}>
            {rewardBlocks.length > 0 ? rewardBlocks.map((block, index) => (
              <View key={`${block}_${index}`} style={styles.rewardChip}>
                <Text style={styles.rewardChipText}>{block}</Text>
              </View>
            )) : (
              <View style={styles.rewardChip}><Text style={styles.rewardChipText}>RÉCOMPENSE DÉBLOQUÉE</Text></View>
            )}
          </View>

          {coachLine ? <Text style={styles.coachLine}>{coachLine}</Text> : null}

          <Pressable style={[styles.button, { backgroundColor: accent }]} onPress={onContinue}>
            <Text style={styles.buttonText}>CONTINUER</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2,4,8,0.84)",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    borderRadius: 28,
    padding: 22,
    gap: 14,
    backgroundColor: "rgba(9,11,18,0.98)",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  kicker: {
    fontFamily: "Inter",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 2,
  },
  title: {
    color: "#FFF",
    fontFamily: "Bebas",
    fontSize: 38,
    letterSpacing: 1.2,
  },
  rewardsRow: {
    gap: 10,
  },
  rewardChip: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rewardChipText: {
    color: "#F5F7FF",
    fontFamily: "Inter",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  coachLine: {
    color: "#C9D3E1",
    fontFamily: "Inter",
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonText: {
    color: "#121317",
    fontFamily: "Inter",
    fontWeight: "900",
    fontSize: 13,
    letterSpacing: 1,
  },
});
