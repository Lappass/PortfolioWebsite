// One shared mark for the interface and the printed archive label: a terminal window with a "> _" prompt.
const paths = `<path d="M295 73V43C295 27 283 15 267 15H43C27 15 15 27 15 43V100C15 116 27 128 43 128H267C283 128 295 116 295 100Z" fill="none" stroke="currentColor" stroke-width="26"/><path d="M64 53L81 70L64 87M214 95h46" fill="none" stroke="currentColor" stroke-width="15"/>`;
export const labelMarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 145" color="#171713">${paths}</svg>`;
export const logo = `<svg viewBox="0 0 310 185" aria-label="Lappas" role="img">${paths}<text x="165" y="174" text-anchor="middle" font-family="MiSans,sans-serif" font-size="16" font-weight="700" letter-spacing="22">LAPPAS</text></svg>`;
// The same contour, continuous for the opening's moving draw/erase ends.
export const bootMarkContour =
  "M295 73V43C295 27 283 15 267 15H43C27 15 15 27 15 43V100C15 116 27 128 43 128H267C283 128 295 116 295 100Z";
// Authored pointing down around (69, 70); the opening's -90° turn makes it ">".
export const bootPromptPath = "M52 62L69 79L86 62";
export const bootCursorOffsetY = 25;

export const brandHeading = `<h1>LAPPAS</h1><div>SHUHANG CHEN · GAME DEVELOPER</div>`;
