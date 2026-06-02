import React from "react";
import { Image, StyleSheet, View } from "react-native";

export type PrestigeKey =
  | "boucher"
  | "gladiator"
  | "champion"
  | "legende"
  | undefined;

type Props = {
  prestige?: PrestigeKey;
  size?: number;
};

const prestigeImages = {
  boucher: require("../assets/prestige/prestige_boucher.png"),
  gladiator: require("../assets/prestige/prestige_gladiator.png"),
  champion: require("../assets/prestige/prestige_champion.png"),
  legende: require("../assets/prestige/prestige_legende.png"),
};

const prestigeGlow: Record<Exclude<PrestigeKey, undefined>, string> = {
  boucher: "#FF7A00",
  gladiator: "#FF2A2A",
  champion: "#FFD700",
  legende: "#A855F7",
};

export default function PrestigeBadge({ prestige, size = 40 }: Props) {
  if (!prestige || !prestigeImages[prestige]) return null;

  const glow = prestigeGlow[prestige];
  const shellSize = size + 12;
  const innerSize = size + 2;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: shellSize,
          height: shellSize,
          borderRadius: shellSize / 2,
          borderColor: `${glow}88`,
          shadowColor: glow,
        },
      ]}
    >
      <View
        style={[
          styles.innerGlow,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: `${glow}12`,
          },
        ]}
      />

      <Image
        source={prestigeImages[prestige]}
        style={{
          width: size,
          height: size,
          resizeMode: "contain",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7,8,12,0.78)",
    borderWidth: 1.5,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  innerGlow: {
    position: "absolute",
  },
});
