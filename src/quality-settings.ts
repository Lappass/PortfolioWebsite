import {
  matchingPreset,
  presetLabels,
  type QualityPreset,
  type RenderQuality,
} from "./render-quality";
import { isWallpaper } from "./wallpaper";
import { escapeHtml } from "./html";

function choiceControl(attributes: string, label: string, value: string | number, choices: (readonly [string | number, string])[]) {
  if (isWallpaper) {
    const text = choices.find(([key]) => key === value)?.[1] ?? "Custom";
    return `<button type="button" ${attributes} class="quality-cycle" aria-label="${label}" title="Click to change ${label}" value="${value}" data-quality-choices="${escapeHtml(JSON.stringify(choices))}"><span data-quality-label>${text}</span><span aria-hidden="true">↻</span></button>`;
  }
  return `<select ${attributes} aria-label="${label}">${choices.map(([key, text]) => `<option value="${key}" ${key === value ? "selected" : ""}>${text}</option>`).join("")}${value === "custom" ? '<option value="custom" disabled selected>Custom</option>' : ""}</select>`;
}

if (isWallpaper) document.addEventListener("click", event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-quality-choices]");
  if (!button || button.disabled) return;
  const choices = JSON.parse(button.dataset.qualityChoices!) as [string | number, string][];
  const index = choices.findIndex(([value]) => String(value) === button.value);
  const [value, label] = choices[(index + 1) % choices.length];
  button.value = String(value);
  button.querySelector("[data-quality-label]")!.textContent = label;
  button.dispatchEvent(new Event("change", { bubbles: true }));
});

function select(
  quality: RenderQuality,
  key: keyof RenderQuality,
  label: string,
  hint: string,
  choices: (readonly [string | number, string])[],
) {
  return `<label class="quality-control"><span>${label}<small>${hint}</small></span>${choiceControl(`data-quality="${key}"`, label, quality[key], choices)}</label>`;
}
function range(
  quality: RenderQuality,
  key: "scale" | "depthOfField",
  label: string,
  hint: string,
  min: number,
  max: number,
) {
  return `<label class="quality-control quality-range"><span>${label}<small>${hint}</small></span><div><input type="range" data-quality="${key}" aria-label="${label}" min="${min}" max="${max}" step="5" value="${quality[key]}"/><output data-quality-output="${key}">${quality[key]}%</output></div></label>`;
}
export function qualityMarkup(quality: RenderQuality) {
  const preset = matchingPreset(quality);
  return `<section class="quality-settings" aria-label="Quality settings">
    <div class="quality-heading"><h3>RENDER QUALITY</h3>${choiceControl('id="quality-preset"', "Quality preset", preset, (Object.keys(presetLabels) as QualityPreset[]).map(key => [key, presetLabels[key]]))}</div>
    <p class="quality-summary" id="quality-summary" aria-live="polite"></p>
    <details class="quality-advanced"><summary>Advanced <span>Sharpness / Materials / Shadows</span></summary><div class="quality-grid">
    ${range(quality, "scale", "Render scale", "Relative to screen pixels, capped by the density limit; higher values sharpen fine lines", 50, 200)}
    ${select(
      quality,
      "pixelRatio",
      "Pixel density limit",
      "Native pixel ratio cap for high-density screens",
      [1, 1.5, 2, 3].map((v) => [v, `${v}×`]),
    )}
    ${select(quality, "antialias", "Antialiasing", "SMAA smooths model edges and post-processing", [
      ["off", "Native"],
      ["smaa", "SMAA"],
    ])}
    ${select(
      quality,
      "anisotropy",
      "Texture filtering",
      "Improves label detail at oblique angles",
      [1, 2, 4, 8, 16].map((v) => [v, `${v}×`]),
    )}
    ${select(
      quality,
      "transmission",
      "Transparent material resolution",
      "Sharpness of the refraction through cover panels",
      [0.25, 0.5, 0.75, 1].map((v) => [v, `${v * 100}%`]),
    )}
    ${select(
      quality,
      "shadows",
      "Shadow resolution · Array",
      "Higher resolution keeps finer shadow edges",
      [
        [0, "Off"],
        [1024, "1024"],
        [2048, "2048"],
        [4096, "4096"],
      ],
    )}
    ${select(
      quality,
      "aoSamples",
      "Ambient occlusion · Array",
      "More samples give finer shading in seams",
      [
        [0, "Off"],
        [16, "16 samples"],
        [32, "32 samples"],
        [64, "64 samples"],
      ],
    )}
    ${select(
      quality,
      "aoResolution",
      "Occlusion resolution · Array",
      "Lower values reduce ambient occlusion cost",
      [0.5, 0.75, 1].map((v) => [v, `${v * 100}%`]),
    )}
    ${range(quality, "depthOfField", "Depth of field · Array", "0% off; 100% keeps the original lens blur", 0, 150)}
    </div></details><p class="quality-note">${isWallpaper ? "Applies instantly for this session only; set long-term values in Wallpaper Engine. " : "Applies instantly and saves automatically. "}High render scales suit still viewing; the buffer is capped at 8.29 MP and scales down automatically on hardware limits.</p>
  </section>`;
}

export function syncQualityUI(quality: RenderQuality) {
  const preset = document.querySelector<HTMLSelectElement | HTMLButtonElement>("#quality-preset");
  if (!preset) return;
  const value = matchingPreset(quality);
  if (preset instanceof HTMLSelectElement) {
    let custom = preset.querySelector<HTMLOptionElement>('option[value="custom"]');
    if (value === "custom" && !custom) {
      custom = new Option("Custom", "custom");
      custom.disabled = true;
      preset.add(custom);
    } else if (value !== "custom") {
      custom?.remove();
    }
  }
  preset.value = value;
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("[data-quality]")
    .forEach((control) => {
      const key = control.dataset.quality as keyof RenderQuality;
      control.value = String(quality[key]);
      control.disabled = key === "aoResolution" && quality.aoSamples === 0;
    });
  document.querySelectorAll<HTMLButtonElement>("[data-quality-choices]").forEach(button => {
    const choices = JSON.parse(button.dataset.qualityChoices!) as [string | number, string][];
    button.querySelector("[data-quality-label]")!.textContent = choices.find(([value]) => String(value) === button.value)?.[1] ?? "Custom";
  });
  document
    .querySelectorAll<HTMLOutputElement>("[data-quality-output]")
    .forEach((output) => {
      output.value = `${quality[output.dataset.qualityOutput as keyof RenderQuality]}%`;
    });
}
