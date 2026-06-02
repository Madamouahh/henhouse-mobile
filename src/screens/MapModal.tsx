import React from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

const MAP = require("../assets/map/hen_house_map.png");
const GRAIN = require("../assets/fx/grain.png");

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
};

export default function MapModal({
  visible,
  onClose,
  title = "RENDEZ-VOUS HEN HOUSE",
  subtitle = "Passe au Hen House pour finaliser l'action.",
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <Image source={GRAIN} style={styles.grain} resizeMode="cover" />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.mapWrap}>
            <Image source={MAP} style={styles.map} resizeMode="cover" />
            <View style={styles.pinHalo} />
            <View style={styles.pin} />
          </View>

          <Pressable style={styles.primaryBtn} onPress={onClose}>
            <Text style={styles.primaryBtnText}>FERMER</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(3,4,8,0.78)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(8,10,16,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    gap: 10,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Komikax",
    fontSize: 24,
  },
  subtitle: {
    color: "#E7EAF0",
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 20,
  },
  mapWrap: {
    marginTop: 6,
    height: 300,
    borderRadius: 18,
    overflow: "hidden",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  pinHalo: {
    position: "absolute",
    top: "48%",
    left: "52%",
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: -22,
    marginTop: -22,
    backgroundColor: "rgba(236,73,0,0.20)",
  },
  pin: {
    position: "absolute",
    top: "48%",
    left: "52%",
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    marginTop: -8,
    backgroundColor: "#EC4900",
    borderWidth: 2,
    borderColor: "#FFD7C7",
  },
  primaryBtn: {
    marginTop: 8,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#EC4900",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: "Bebas",
    fontSize: 20,
    letterSpacing: 1,
  },
});
