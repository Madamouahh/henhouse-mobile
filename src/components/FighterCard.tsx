import React, { useMemo } from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";
import PrestigeBadge, { PrestigeKey } from "./PrestigeBadge";
import LeagueBadge from "./LeagueBadge";

export type LeagueKey = "argent" | "diamond" | "star";

type Props = {
  name: string;
  avatar?: string | null;
  wins?: number;
  losses?: number;
  league: LeagueKey | string;
  prestige?: PrestigeKey;
  titleText?: string;
  width?: number;
  height?: number;
  showLeague?: boolean;
  showStats?: boolean;
  mmr?: number;
  showMmr?: boolean;
  championMode?: boolean;
};

const frames = {
  argent: require("../assets/cards/card_argent.png"),
  diamond: require("../assets/cards/card_diamond.png"),
  star: require("../assets/cards/card_champion.png"),
};

const leagueColors: Record<LeagueKey, string> = {
  argent: "#C0C0C0",
  diamond: "#00E5FF",
  star: "#A855F7",
};

function normalizeLeague(raw?: string): LeagueKey {
  const value = String(raw || "").toLowerCase().trim();

  if (value === "star" || value === "champion") return "star";
  if (value === "diamond") return "diamond";

  return "argent";
}

function getInitials(name: string) {
  const clean = String(name || "").trim();
  if (!clean) return "PL";
  const parts = clean.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function getPrestigeLabel(prestige?: PrestigeKey) {
  if (prestige === "boucher") return "BOUCHER";
  if (prestige === "gladiator") return "GLADIATEUR";
  if (prestige === "champion") return "CHAMPION";
  if (prestige === "legende") return "LEGENDE";
  return "";
}

function getResponsiveAvatarSize(width: number, height: number) {
  const base = Math.min(width * 0.56, height * 0.44);
  return Math.max(78, Math.min(base, 124));
}

export default function FighterCard({
  name,
  avatar,
  wins = 0,
  losses = 0,
  league,
  prestige,
  titleText,
  width = 170,
  height = 255,
  showLeague = true,
  showStats = true,
  mmr,
  showMmr = false,
  championMode = false,
}: Props) {
  const safeLeague = useMemo(() => normalizeLeague(league), [league]);
  const initials = useMemo(() => getInitials(name), [name]);

  const prestigeLabel = useMemo(() => {
    return titleText || getPrestigeLabel(prestige);
  }, [titleText, prestige]);

  const leagueColor = leagueColors[safeLeague];
  const frameSource = frames[safeLeague];

  const avatarSize = getResponsiveAvatarSize(width, height);
  const avatarHeight = Math.round(avatarSize * 1.12);

  const cardBorderRadius = Math.max(18, Math.round(width * 0.11));
  const internalPadding = Math.max(10, Math.round(width * 0.07));
  const nameFontSize = Math.max(15, Math.min(19, Math.round(width * 0.112)));
  const prestigeFontSize = Math.max(11, Math.min(14, Math.round(width * 0.082)));
  const statsFontSize = Math.max(8, Math.min(9, Math.round(width * 0.052)));

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          shadowColor: leagueColor,
          borderRadius: cardBorderRadius,
        },
        championMode && styles.championContainer,
      ]}
    >
      <ImageBackground
        source={frameSource}
        style={[styles.frame, { borderRadius: cardBorderRadius }]}
        imageStyle={[styles.frameImage, { borderRadius: cardBorderRadius }]}
        resizeMode="cover"
      >
        <View
          style={[
            styles.darkOverlay,
            {
              borderRadius: cardBorderRadius,
            },
          ]}
        />

        <View
          style={[
            styles.topArea,
            {
              paddingTop: internalPadding,
              paddingHorizontal: internalPadding,
              minHeight: Math.max(52, Math.round(height * 0.2)),
            },
          ]}
        >
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            style={[styles.name, { fontSize: nameFontSize }]}
          >
            {String(name || "JOUEUR").toUpperCase()}
          </Text>

          {showLeague ? (
            <View style={styles.leagueBadgeWrap}>
              <LeagueBadge league={safeLeague} size={18} />
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.middleArea,
            {
              paddingHorizontal: internalPadding,
            },
          ]}
        >
          <View
            style={[
              styles.avatarShell,
              {
                width: avatarSize,
                height: avatarHeight,
                borderColor: `${leagueColor}66`,
                shadowColor: leagueColor,
                borderRadius: Math.max(14, Math.round(width * 0.09)),
              },
            ]}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>{initials}</Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={[
            styles.bottomArea,
            {
              paddingBottom: Math.max(12, Math.round(height * 0.055)),
              paddingHorizontal: internalPadding,
              minHeight: Math.max(72, Math.round(height * 0.24)),
            },
          ]}
        >
          {!!prestigeLabel && (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
              style={[styles.prestige, { fontSize: prestigeFontSize }]}
            >
              {prestigeLabel}
            </Text>
          )}

          {showStats ? (
            <View style={styles.statsBox}>
              <Text style={[styles.stats, { fontSize: statsFontSize }]}>V {wins}</Text>
              <Text style={styles.statsDivider}>•</Text>
              <Text style={[styles.stats, { fontSize: statsFontSize }]}>D {losses}</Text>
              {showMmr && typeof mmr === "number" ? (
                <>
                  <Text style={styles.statsDivider}>•</Text>
                  <Text style={[styles.stats, { fontSize: statsFontSize }]}>MMR {mmr}</Text>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </ImageBackground>

      {!!prestige && (
        <View style={styles.badgeWrap}>
          <PrestigeBadge prestige={prestige} size={44} />
        </View>
      )}

      {championMode ? (
        <View style={styles.crownWrap}>
          <Text style={styles.crownText}>#1</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "visible",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 7,
  },

  championContainer: {
    transform: [{ scale: 1.02 }],
  },

  frame: {
    flex: 1,
    overflow: "hidden",
    justifyContent: "space-between",
    backgroundColor: "#121319",
  },

  frameImage: {},

  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8,10,16,0.18)",
  },

  topArea: {
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },

  name: {
    color: "#FFFFFF",
    fontFamily: "StreetFight",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  leagueBadgeWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  middleArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarShell: {
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },

  avatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  avatarFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  avatarFallbackText: {
    color: "#FFFFFF",
    fontFamily: "StreetFight",
    fontSize: 28,
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  bottomArea: {
    alignItems: "center",
    justifyContent: "flex-end",
  },

  prestige: {
    color: "#FFFFFF",
    fontFamily: "StreetFight",
    letterSpacing: 0.7,
    textAlign: "center",
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.82)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    marginBottom: 8,
  },

  statsBox: {
    minHeight: 26,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(8,10,16,0.52)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  stats: {
    color: "#F5F7FF",
    fontFamily: "GameBoy",
    letterSpacing: 0.8,
    textAlign: "center",
    textTransform: "uppercase",
  },

  statsDivider: {
    color: "rgba(255,255,255,0.42)",
    fontFamily: "GameBoy",
    fontSize: 8,
  },

  badgeWrap: {
    position: "absolute",
    right: -8,
    bottom: 18,
  },

  crownWrap: {
    position: "absolute",
    top: -8,
    left: -6,
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#A855F7",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#A855F7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },

  crownText: {
    color: "#FFFFFF",
    fontFamily: "StreetFight",
    fontSize: 12,
    letterSpacing: 0.6,
  },
});
