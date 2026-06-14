import { useCallback, useEffect, useState } from "react";
import {
  getAudioSettings,
  initAudioOnGesture,
  playClick,
  setAudioSettings,
  type AudioSettings
} from "../ui/audio";

// Owns the persisted audio settings plus the autoplay-unlock side effect:
// unlock the audio context on the first user gesture (browser autoplay policy)
// and play a soft click on every button press.
export function useAudioSettings(): {
  audioSettings: AudioSettings;
  updateAudio: (partial: Partial<AudioSettings>) => void;
} {
  const [audioSettings, setAudioSettingsState] = useState<AudioSettings>(() => getAudioSettings());

  useEffect(() => {
    const onFirstGesture = () => initAudioOnGesture();
    const onPointerDown = (event: PointerEvent) => {
      initAudioOnGesture();
      const target = event.target as HTMLElement | null;
      if (target?.closest("button")) {
        playClick();
      }
    };
    window.addEventListener("keydown", onFirstGesture);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onFirstGesture);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const updateAudio = useCallback((partial: Partial<AudioSettings>) => {
    setAudioSettingsState(setAudioSettings(partial));
  }, []);

  return { audioSettings, updateAudio };
}
