export type MotionKey =
  | "boot"
  | "selectionWave"
  | "idleWave"
  | "pointerParallax"
  | "dragMomentum"
  | "selectionTransition"
  | "detailTransition"
  | "modelDecryption"
  | "documentReveal"
  | "rollingText"
  | "rollingNumbers"
  | "surfaceTransitions"
  | "viewerNavigation"
  | "viewerModelTransition";

export type MotionPreferences = Record<MotionKey, boolean>;
export type MotionPreset = "full" | "reduced" | "custom";

export type StoredMotion = Partial<MotionPreferences> & {
  preset?: MotionPreset;
};

export const MOTION_LABELS: Record<
  MotionKey,
  { title: string; description: string; group: string }
> = {
  boot: {
    title: "BOOT SEQUENCE",
    description: "Boot logo, scan and welcome screen",
    group: "Intro",
  },
  selectionWave: {
    title: "SELECTION WAVE",
    description: "Wave that ripples through the array on selection",
    group: "Array",
  },
  idleWave: {
    title: "IDLE MOTION",
    description: "Gentle array motion while idle",
    group: "Array",
  },
  pointerParallax: {
    title: "POINTER PARALLAX",
    description: "Slight camera drift following the pointer",
    group: "Array",
  },
  dragMomentum: {
    title: "DRAG MOMENTUM",
    description: "Keep gliding at release speed after a drag",
    group: "Array",
  },
  selectionTransition: {
    title: "SELECTION TRANSITION",
    description: "Camera travel when switching works or columns",
    group: "Array",
  },
  detailTransition: {
    title: "DETAIL TRANSITION",
    description: "Lift, turn, return and detail camera",
    group: "Details",
  },
  modelDecryption: {
    title: "MODEL DECRYPTION",
    description: "Decrypt lines and frosted reveal",
    group: "Details",
  },
  documentReveal: {
    title: "DOCUMENT REVEAL",
    description: "Masked reveal of body text",
    group: "Details",
  },
  rollingText: {
    title: "ROLLING TEXT",
    description: "Rolling titles, categories and status labels",
    group: "Interface",
  },
  rollingNumbers: {
    title: "ROLLING NUMBERS",
    description: "Rolling numbers and work IDs",
    group: "Interface",
  },
  surfaceTransitions: {
    title: "SURFACE TRANSITIONS",
    description: "Transitions for details, search, saved and settings",
    group: "Interface",
  },
  viewerNavigation: {
    title: "VIEWER NAVIGATION",
    description: "360° rotate, pan, zoom and reset easing",
    group: "360° Viewer",
  },
  viewerModelTransition: {
    title: "VIEWER MODEL TRANSITION",
    description: "Explode, reassemble and clarity changes",
    group: "360° Viewer",
  },
};

const FULL: MotionPreferences = {
  boot: true,
  selectionWave: true,
  idleWave: true,
  pointerParallax: true,
  dragMomentum: true,
  selectionTransition: true,
  detailTransition: true,
  modelDecryption: true,
  documentReveal: true,
  rollingText: true,
  rollingNumbers: true,
  surfaceTransitions: true,
  viewerNavigation: true,
  viewerModelTransition: true,
};

const REDUCED: MotionPreferences = {
  boot: false,
  selectionWave: false,
  idleWave: false,
  pointerParallax: false,
  dragMomentum: false,
  selectionTransition: false,
  detailTransition: false,
  modelDecryption: false,
  documentReveal: false,
  rollingText: false,
  rollingNumbers: false,
  surfaceTransitions: false,
  viewerNavigation: false,
  viewerModelTransition: false,
};

export function fullMotion(): MotionPreferences {
  return { ...FULL };
}

export function reducedMotion(): MotionPreferences {
  return { ...REDUCED };
}

export function motionPresetFor(motion: MotionPreferences): MotionPreset {
  if (Object.values(motion).every(Boolean)) return "full";
  if (Object.values(motion).every((value) => !value)) return "reduced";
  return "custom";
}

export function createMotionPreferences(
  stored: StoredMotion | undefined,
  legacyReduced: boolean | undefined,
): MotionPreferences {
  const base =
    stored?.preset === "full"
      ? FULL
      : stored?.preset === "reduced"
        ? REDUCED
        : legacyReduced === true
          ? REDUCED
          : FULL;
  const result = { ...base };
  if (stored) {
    for (const key of Object.keys(FULL) as MotionKey[]) {
      if (typeof stored[key] === "boolean")
        result[key] = stored[key] as boolean;
    }
  }
  return result;
}

export function motionEnabled(motion: MotionPreferences, key: MotionKey) {
  return motion[key];
}

export function motionSummary(motion: MotionPreferences) {
  const enabled = Object.values(motion).filter(Boolean).length;
  if (enabled === Object.keys(motion).length) return "Using full motion.";
  if (enabled === 0) return "Motion is reduced.";
  const highlights: string[] = [];
  if (!motion.boot) highlights.push("intro skipped");
  if (!motion.selectionWave && !motion.idleWave)
    highlights.push("array waves off");
  if (!motion.rollingText && !motion.rollingNumbers)
    highlights.push("rolling text off");
  return `Using custom motion (${highlights.slice(0, 2).join(", ") || `${enabled} enabled`}).`;
}

export function motionSettingsMarkup(
  motion: MotionPreferences,
  preset?: MotionPreset,
) {
  const groups = [
    ...new Set(Object.values(MOTION_LABELS).map((entry) => entry.group)),
  ].filter((group) => group !== "360° Viewer");
  const selected = preset ?? motionPresetFor(motion);
  const presetButton = (value: "full" | "reduced" | "custom", label: string) =>
    `<button type="button" data-action="motion-preset" data-preset="${value}" aria-pressed="${selected === value}"${value === "custom" ? " disabled" : ""}>${label}</button>`;
  return `<section id="motion-settings" class="motion-settings" aria-label="Motion settings"><div class="motion-settings-head"><div><strong>ANIMATION CONTROLS</strong><span>Full, reduced, or customize each item; disabled animations settle immediately (intro changes apply on the next replay)</span></div>${presetButton("full", "Full")}${presetButton("reduced", "Reduced")}${presetButton("custom", "Custom")}</div><details class="motion-advanced"><summary>Advanced <span>Intro / Array / Details / Interface</span></summary><div class="motion-groups">${groups
    .map(
      (group) =>
        `<fieldset><legend>${group}</legend>${(
          Object.keys(MOTION_LABELS) as MotionKey[]
        )
          .filter((key) => MOTION_LABELS[key].group === group)
          .map((key) => {
            const item = MOTION_LABELS[key];
            return `<label class="motion-setting"><div><strong>${item.title}</strong><span>${item.description}</span></div><input type="checkbox" data-motion="${key}" ${motion[key] ? "checked" : ""}/><i class="toggle"></i></label>`;
          })
          .join("")}</fieldset>`,
    )
    .join("")}</div></details></section>`;
}
