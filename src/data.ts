import content from "../content/archives.json" with { type: "json" };

export interface ArchiveRecord {
  id: string;
  title: string;
  en: string;
  department: string;
  category: string;
  date: string;
  lead: string;
  clearance: string;
  abstract: string;
  findings: string[];
  source: string;
  tags?: string[];
  cover?: string;
  /** Optional spine strip (148×1700) and disc label (square) art for the game case. */
  spine?: string;
  disc?: string;
  /** Optional back-cover art, same size as the cover. */
  back?: string;
  /** Optional monitor loading screen while the disc is read (src/game-loaders.ts). */
  loader?: string;
  hero?: string;
  gallery?: { src: string; caption?: string; note?: string }[];
  video?: string;
  unity?: string;
  links?: { label: string; url: string }[];
  /** The game's own cover for its page (src/game-covers.ts); without it the page opens on the key art. */
  menu?: "lastmile" | "trail" | "lockdown" | "sniff";
  /** Trailer video; falls back to `video`. */
  trailer?: string;
  /** A full run of the game, with optional chapter marks ("m:ss"). */
  playthrough?: { src: string; chapters?: { at: string; label: string }[] };
  download?: { url: string; label?: string; size?: string };
  /** The case study the page is built from (content/README.md). */
  study?: CaseStudy;
}

export interface CaseStudyMedia { src: string; caption?: string }
export interface CaseStudySection {
  heading: string;
  /** The paragraph shown beside the pictures; `body` and `points` make up the full write-up. */
  summary?: string;
  body: string[];
  points?: string[];
  /** The first picture is shown large, the second small. */
  media?: CaseStudyMedia[];
}
export interface CaseStudy {
  pitch: string;
  facts: { label: string; value: string }[];
  sections: CaseStudySection[];
}

// JSON types `menu` as a plain string; scripts/archive-content.mjs checks it is one of the themes.
export const records = content.records as ArchiveRecord[];
export const featuredFiles = content.featured.map(id => records.findIndex(record => record.id === id));
export const experimentFiles = records.map((_, index) => index).filter(index => !featuredFiles.includes(index));
export const categories = ["All", ...content.categories];
/** Four featured works share one line; the other records stay in Experiments. */
export const archiveColumns = ["Selected Works"];
// The line runs down the centre lane of the original five, so the opening stays framed.
export const LINE_LANE = 2;

export function columnFiles(_lane: number) {
  return featuredFiles;
}
export function fileLocation(index: number) {
  const row = 12 + Math.max(0, featuredFiles.indexOf(index));
  return { lane: LINE_LANE, row, slot: LINE_LANE * 32 + row };
}
export function fileAtSlot(slot: number) {
  const n = featuredFiles.length;
  return featuredFiles[((((slot % 32) - 12) % n) + n) % n];
}
