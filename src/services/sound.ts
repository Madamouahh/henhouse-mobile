import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

const SOUND_FILES = {
  tap: require("../assets/sfx/tap.wav"),
  confirm: require("../assets/sfx/confirm.wav"),
  notify: require("../assets/sfx/notify.wav"),
} as const;

export type UiSoundKey = keyof typeof SOUND_FILES;

let prepared = false;
let enabled = true;

export async function initUiSound() {
  if (prepared) return;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    });
    prepared = true;
  } catch (error) {
    console.log("initUiSound error", error);
  }
}

export function setUiSoundEnabled(value: boolean) {
  enabled = !!value;
}

export async function playSound(kind: UiSoundKey = "tap") {
  if (!enabled) return;

  try {
    await initUiSound();

    const sound = new Audio.Sound();
    await sound.loadAsync(SOUND_FILES[kind], {
      shouldPlay: true,
      volume: kind === "tap" ? 0.46 : 0.72,
      progressUpdateIntervalMillis: 80,
    });

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        sound.unloadAsync().catch(() => null);
      }
    });
  } catch (error) {
    console.log("playSound error", kind, error);
  }
}
