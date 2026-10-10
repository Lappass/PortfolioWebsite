import { MARK_PATH, logo } from "./brand";

/** The leaf and fish respond in staggered beats, then settle to the exact mark. */
export function attachLogoHover(host: HTMLElement, enabled: () => boolean) {
  const parts = MARK_PATH.split(/(?=M )/).filter(Boolean);
  let running = false;
  const play = () => {
    if (running || !enabled() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    running = true;
    host.innerHTML = `<svg viewBox="0 0 840 1320" aria-hidden="true"><path class="logo-leaf" fill="currentColor" d="${parts[0]}"/><path class="logo-tail" fill="currentColor" d="${parts[3]}"/><path class="logo-fish" fill="currentColor" d="${parts[1]}"/><path class="logo-eye" fill="currentColor" d="${parts[2]}"/></svg>`;
    const animate = (selector: string, origin: string, transforms: string[], delay: number) => {
      const node = host.querySelector<SVGElement>(selector)!;
      node.style.transformOrigin = origin;
      return node.animate(transforms.map(transform => ({ transform })), {
        duration: 1100, delay, easing: "cubic-bezier(.4,0,.2,1)", fill: "backwards"
      });
    };
    animate(".logo-leaf", "100px 990px", [
      "rotate(0deg) skewX(0deg)", "rotate(-9deg) skewX(4deg)",
      "rotate(5deg) skewX(-2deg)", "rotate(-2deg)", "rotate(0deg)"
    ], 0);
    animate(".logo-tail", "430px 900px", [
      "rotate(0deg)", "rotate(12deg) translate(-12px,16px)",
      "rotate(-7deg) translate(10px,-10px)", "rotate(3deg)", "rotate(0deg)"
    ], 90);
    animate(".logo-fish", "590px 630px", [
      "translate(0,0) rotate(0deg)", "translate(28px,-18px) rotate(-7deg)",
      "translate(-14px,9px) rotate(4deg)", "translate(5px,-3px)", "translate(0,0)"
    ], 140);
    const eye = animate(".logo-eye", "666px 612px", [
      "translate(0,0) scaleY(1)", "translate(28px,-18px) scaleY(.12)",
      "translate(-14px,9px) scaleY(1)", "translate(5px,-3px)", "translate(0,0)"
    ], 140);
    eye.onfinish = eye.oncancel = () => { host.innerHTML = logo; running = false; };
  };
  host.addEventListener("pointerenter", play);
  host.addEventListener("focus", play);
}
