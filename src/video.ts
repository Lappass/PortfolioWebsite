/** Video links shared by the project page and the game covers. */

export const isWeb = (value: string) => /^https?:\/\//i.test(value);
export const isFile = (value: string) => /\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(value);

/** The 11-character id of a YouTube link (youtu.be, watch?v=, embed, shorts, live), or null. */
export const youtubeId = (src: string) =>
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/i.exec(src)?.[1] ?? null;

/** YouTube links become the privacy-enhanced embed player; other links are used as given. */
export function embedUrl(src: string, options: { start?: number; autoplay?: boolean } = {}) {
  const id = youtubeId(src);
  if (!id) return src;
  const { start = 0, autoplay = start > 0 } = options;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${start ? `&start=${start}` : ""}${autoplay ? "&autoplay=1" : ""}`;
}

/** "1:02:03" or "3:20" in seconds. */
export const seconds = (at: string) => at.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
