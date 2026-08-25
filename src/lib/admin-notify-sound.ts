/** Short chime for new admin booking notifications. */

const SRC = "/sounds/notify.mp3";

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SRC);
    audio.preload = "auto";
    audio.volume = 0.75;
  }
  return audio;
}

/** Call once after a user gesture so autoplay policies allow later plays. */
export function unlockNotifySound(): void {
  if (unlocked || typeof window === "undefined") return;
  const a = getAudio();
  a.muted = true;
  void a
    .play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
      unlocked = true;
    })
    .catch(() => {
      a.muted = false;
    });
}

export function playNotifySound(): void {
  if (typeof window === "undefined") return;
  try {
    const a = getAudio();
    a.currentTime = 0;
    void a.play().catch(() => {
      /* autoplay blocked until unlock */
    });
  } catch {
    /* ignore */
  }
}
