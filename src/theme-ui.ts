import "./theme.css";
const palette = {
  ink: ["#080a08", "#eef3ff"], muted: ["#77756d", "#9fb2d4"], line: ["#aaa59a", "#3c5488"],
  paper: ["#eae5e1", "#08142e"], panel: ["#edebe4", "#12234d"], field: ["#e7e3d9", "#1a2f60"],
  accent: ["#9b7247", "#6fa8ff"],
} as const;
let previous = -1;
export let themeAmount = 0;
function rgb(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
export function paintTheme(amount: number) {
  if (Math.abs(amount - previous) < .0001) return;
  previous = themeAmount = amount;
  const root = document.documentElement;
  root.dataset.darkSurface = String(amount > .0001);
  for (const [name, values] of Object.entries(palette)) {
    const from = rgb(values[0]), to = rgb(values[1]);
    const value = from.map((v, i) => Math.round(v + (to[i] - v) * amount)).join(", ");
    root.style.setProperty(`--theme-${name}`, `rgb(${value})`);
    root.style.setProperty(`--theme-${name}-rgb`, value);
  }
}
export function themeSettingsMarkup(dark: boolean) {
  return `<div class="theme-settings"><div><strong>界面配色</strong><span>玻璃阵列随配色逐张过渡</span></div><div class="theme-choices" role="group" aria-label="界面配色"><button data-color-theme="light" aria-pressed="${!dark}">亮色</button><button data-color-theme="dark" aria-pressed="${dark}">暗色</button></div></div>`;
}
