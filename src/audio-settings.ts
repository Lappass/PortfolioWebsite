import type { AudioPreferences } from "./audio";

export function audioSettingsMarkup(prefs: AudioPreferences) {
  return `<div class="audio-settings">${(
    [
      ["sound", "soundVolume", "INTERFACE SOUND", "Interface and startup sounds"],
      ["music", "musicVolume", "BACKGROUND MUSIC", "Background music"],
    ] as const
  )
    .map(
      ([toggle, volume, title, description]) => `<div class="audio-setting">
    <label class="audio-toggle"><div><strong>${title}</strong><span>${description}</span></div><input type="checkbox" data-pref="${toggle}" ${prefs[toggle] ? "checked" : ""}/><i class="toggle"></i></label>
    <label class="audio-volume"><span>${toggle === "sound" ? "Sound" : "Music"} volume</span><input aria-label="${toggle === "sound" ? "Sound" : "Music"} volume" data-volume="${volume}" type="range" min="0" max="100" step="1" value="${Math.round(prefs[volume] * 100)}"/><output>${Math.round(prefs[volume] * 100)}%</output></label>
  </div>`,
    )
    .join("")}</div>`;
}
