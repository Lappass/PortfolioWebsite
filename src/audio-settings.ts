import type { AudioPreferences } from "./audio";

export function audioSettingsMarkup(prefs: AudioPreferences) {
  return `<div class="audio-settings">${(
    [
      ["sound", "soundVolume", "INTERFACE SOUND", "操作与启动音效"],
      ["music", "musicVolume", "BACKGROUND MUSIC", "背景音乐 · 可切换曲目"],
    ] as const
  )
    .map(
      ([toggle, volume, title, description]) => `<div class="audio-setting">
    <label class="audio-toggle"><div><strong>${title}</strong><span>${description}</span></div><input type="checkbox" data-pref="${toggle}" ${prefs[toggle] ? "checked" : ""}/><i class="toggle"></i></label>
    <label class="audio-volume"><span>${toggle === "sound" ? "音效" : "音乐"}音量</span><input aria-label="${toggle === "sound" ? "音效" : "音乐"}音量" data-volume="${volume}" type="range" min="0" max="100" step="1" value="${Math.round(prefs[volume] * 100)}"/><output>${Math.round(prefs[volume] * 100)}%</output></label>
    ${toggle === "music" ? `<label class="audio-track"><span>音乐曲目</span><select aria-label="音乐曲目" data-pref="musicTrack"><option value="observatory" ${prefs.musicTrack !== "menu" ? "selected" : ""}>观测室 · 电子氛围</option><option value="menu" ${prefs.musicTrack === "menu" ? "selected" : ""}>待机乐园 · 轻快主机菜单</option></select></label>` : ""}
  </div>`,
    )
    .join("")}</div>`;
}
