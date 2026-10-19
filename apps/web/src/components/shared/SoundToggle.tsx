import { useEffect, useSyncExternalStore } from "react";
import {
  getSoundStatus,
  primeAudio,
  setMuted,
  subscribeSound,
} from "../../lib/sound";

interface SoundToggleProps {
  size?: 'sm' | 'md';
}

export default function SoundToggle({ size = 'md' }: SoundToggleProps) {
  const status = useSyncExternalStore(subscribeSound, getSoundStatus);

  // Start audio right away if the browser already allows it (e.g. we got here via a click)
  useEffect(() => {
    primeAudio();
  }, []);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  const label =
    status === "muted"
      ? "🔇 Muted"
      : status === "locked"
        ? "🔈 Tap for sound"
        : "🔊 Sound on";

  return (
    <button
      type="button"
      // Any tap unlocks audio, so the locked state only needs a click to clear
      onClick={() => setMuted(status === "on")}
      className={`${sizeClasses[size]} rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors`}
      title={status === "muted" ? "Unmute sound effects" : "Mute sound effects"}
    >
      {label}
    </button>
  );
}
