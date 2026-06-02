import React from "react";
import { View, Text, StyleSheet } from "react-native";

export type LeagueKey = "argent" | "diamond" | "star";

type Props = {
  league: LeagueKey;
  size?: number;
  compact?: boolean;
};

const leagueColors: Record<LeagueKey, string> = {
  argent: "#C0C0C0",
  diamond: "#00E5FF",
  star: "#A855F7",
};

const leagueLabels: Record<LeagueKey, string> = {
  argent: "ARGENT",
  diamond: "DIAMOND",
  star: "STAR",
};

export default function LeagueBadge({
  league,
  size = 22,
  compact = false,
}: Props) {
  const color = leagueColors[league];
  const label = leagueLabels[league];

  const horizontalPadding = compact ? size * 0.42 : size * 0.62;
  const verticalPadding = compact ? size * 0.16 : size * 0.26;
  const radius = compact ? size * 0.42 : size * 0.54;
  const fontSize = compact ? size * 0.42 : size * 0.52;

  return (
    <View
      style={[
        styles.badge,
        compact && styles.compactBadge,
        {
          borderColor: `${color}AA`,
          backgroundColor: "rgba(8,10,16,0.56)",
          paddingHorizontal: horizontalPadding,
          paddingVertical: verticalPadding,
          borderRadius: radius,
          shadowColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.innerGlow,
          {
            backgroundColor: `${color}12`,
            borderRadius: radius,
          },
        ]}
      />

      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={[
          styles.text,
          {
            color,
            fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 22,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },

  compactBadge: {
    borderWidth: 1.2,
    minHeight: 18,
  },

  innerGlow: {
    ...StyleSheet.absoluteFillObject,
  },

  text: {
    fontFamily: "GameBoy",
    letterSpacing: 0.9,
    textAlign: "center",
    textTransform: "uppercase",
    includeFontPadding: false,
  },
});
