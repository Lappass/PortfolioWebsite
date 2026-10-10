import "./theme.css";
const palette = {
  ink: ["#080a08", "#f2ece4"], muted: ["#77756d", "#a9a39b"], line: ["#aaa59a", "#4a4640"],
  paper: ["#eae5e1", "#0b0d12"], panel: ["#edebe4", "#161820"], field: ["#e7e3d9", "#1d1f27"],
  accent: ["#9b7247", "#e0b878"],
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
  return `<div class="theme-settings"><div><strong>COLOR THEME</strong><span>Game cases and background transition one by one</span></div><div class="theme-choices" role="group" aria-label="Color theme"><button data-color-theme="light" aria-pressed="${!dark}">Light</button><button data-color-theme="dark" aria-pressed="${dark}">Dark</button></div></div>`;
}
