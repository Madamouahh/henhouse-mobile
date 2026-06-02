// HHFC RELEASE CANDIDATE FINAL
import React from "react";
import { Animated, Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CoachGender, CoachRole } from "./coachTypes";

type Props = {
  role: CoachRole;
  gender: CoachGender;
  message: string | null;
  label?: string | null;
  ctaLabel?: string | null;
  onAdvance?: (() => void) | null;
  onDismiss?: (() => void) | null;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");
export const COACH_SAFE_AREA = 116;

function getCoachImage(role: CoachRole, gender: CoachGender) {
  if (role === "fight" && gender === "female") return require("../../assets/characters/fight_bg_female_d.png");
  if (role === "fight" && gender === "male") return require("../../assets/characters/fight_bg_male_d.png");
  if (role === "bet" && gender === "female") return require("../../assets/characters/bet_bg_female_d.png");
  if (role === "bet" && gender === "male") return require("../../assets/characters/bet_bg_male_d.png");
  if (role === "bookmaker" && gender === "female") return require("../../assets/characters/bookmaker_bg_female_d.png");
  return require("../../assets/characters/bookmaker_bg_male_d.png");
}

export default function CoachSystem({ role, gender, message, label = null, ctaLabel = null, onAdvance = null, onDismiss = null }: Props) {
  const [typedText, setTypedText] = React.useState("");
  const [finished, setFinished] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(22)).current;

  React.useEffect(() => {
    if (!message) {
      setTypedText("");
      setFinished(false);
      setVisible(false);
      opacity.setValue(0);
      translateY.setValue(22);
      return;
    }

    setVisible(true);
    setFinished(false);
    setTypedText("");
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 70, friction: 8, useNativeDriver: true }),
    ]).start();

    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setTypedText(message.slice(0, i));
      if (i >= message.length) {
        clearInterval(timer);
        setFinished(true);
      }
    }, 9);

    const autoDismiss = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 22, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setVisible(false);
        onDismiss?.();
      });
    }, 3200);

    return () => {
      clearInterval(timer);
      clearTimeout(autoDismiss);
    };
  }, [message, opacity, translateY, onDismiss]);

  const handleTap = React.useCallback(() => {
    if (!message) return;

    if (!finished) {
      setTypedText(message);
      setFinished(true);
      return;
    }

    if (onAdvance) {
      onAdvance();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 22, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      onDismiss?.();
    });
  }, [finished, message, onAdvance, onDismiss, opacity, translateY]);

  if (!message || !visible) return null;

  const portrait = getCoachImage(role, gender);
  const coachWidth = Math.min(SCREEN_WIDTH * 0.22, 92);
  const coachHeight = coachWidth * (1920 / 1080);

  return (
    <Animated.View style={[styles.shell, { opacity, transform: [{ translateY }] }]} pointerEvents="box-none">
      <Pressable style={styles.tapArea} onPress={handleTap}>
        <View style={styles.row}>
          <View style={[styles.portraitWrap, { width: coachWidth, height: coachHeight }]}>
            <Image source={portrait} resizeMode="contain" style={styles.assetImage} />
          </View>
          <View style={styles.bubbleCard}>
            <Text style={styles.label}>{String(label || "COACH").toUpperCase()}</Text>
            <Text style={styles.text}>{typedText}</Text>
            <Text style={styles.hint}>{finished ? String(ctaLabel || "TOUCHE POUR FERMER").toUpperCase() : "..."}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    minHeight: COACH_SAFE_AREA,
    justifyContent: "flex-end",
    zIndex: 60,
  },
  tapArea: {
    minHeight: COACH_SAFE_AREA,
    justifyContent: "flex-end",
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  bubbleCard: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(4,6,10,0.92)",
    borderWidth: 1,
    borderColor: "rgba(245,247,255,0.18)",
    zIndex: 3,
  },
  portraitWrap: {
    justifyContent: "flex-end",
    alignItems: "center",
  },
  assetImage: {
    width: "100%",
    height: "100%",
  },
  label: {
    color: "#FF4A3D",
    fontFamily: "Bebas",
    fontSize: 18,
    letterSpacing: 1.4,
  },
  text: {
    color: "#F5F7FF",
    fontFamily: "Inter",
    fontWeight: "800",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  hint: {
    marginTop: 8,
    color: "rgba(245,247,255,0.62)",
    fontFamily: "Bebas",
    fontSize: 11,
    letterSpacing: 1.1,
  },
});

// HHFC FINAL COACH RULES
// - coach isolated per user account
// - no cross-account coach bleed
// - bubble anchored to character
// - safe-area protected
// - production immersive overlay enabled
