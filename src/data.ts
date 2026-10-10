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
}

export const records: ArchiveRecord[] = content.records;
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
