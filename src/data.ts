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
  hero?: string;
  gallery?: { src: string; caption?: string; note?: string }[];
  video?: string;
  unity?: string;
  links?: { label: string; url: string }[];
}

export const records: ArchiveRecord[] = content.records;
export const categories = ["全部档案", ...content.categories];
/** All works stand in one wave line; categories remain for search filters. */
export const archiveColumns = ["全部作品"];
// The line runs down the centre lane of the original five, so the opening stays framed.
export const LINE_LANE = 2;

export function columnFiles(_lane: number) {
  return records.map((_, index) => index);
}
export function fileLocation(index: number) {
  const row = 12 + index;
  return { lane: LINE_LANE, row, slot: LINE_LANE * 32 + row };
}
export function fileAtSlot(slot: number) {
  const n = records.length;
  return ((((slot % 32) - 12) % n) + n) % n;
}
