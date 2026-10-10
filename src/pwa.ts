import { assetUrl } from "./asset-url";
import { isWallpaper } from "./wallpaper";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let installPrompt: InstallPrompt | undefined;
let registration: ServiceWorkerRegistration | undefined;
let ready = false, failed = false, reloading = false, started = false;
let tell: (message: string) => void = () => {};
const installed = () => matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
  refresh();
});
window.addEventListener("appinstalled", () => { installPrompt = undefined; refresh(); });
matchMedia("(display-mode: standalone)").addEventListener("change", refresh);

export function pwaSettingsMarkup() {
  if (isWallpaper) return "";
  const status = !import.meta.env.PROD ? "Development previews are not saved for offline use."
    : !window.isSecureContext ? "An offline copy can be saved when served over HTTPS."
    : !("serviceWorker" in navigator) ? "This browser supports online use."
    : failed ? "The offline copy could not be saved. Retry when online."
    : ready ? "Core pages saved; loaded fonts, models and music work offline, anything else needs a connection."
    : "Saving core pages; other resources are cached as you use them.";
  const guidance = installed() ? "Opened from the home screen."
    : ios() ? "In Safari, tap Share → Add to Home Screen, then open it from the home screen icon."
    : installPrompt ? "Install to open the portfolio in its own window."
    : "Install or add to the home screen from your browser menu.";
  return `<section id="pwa-settings" class="pwa-settings" aria-label="Home screen and offline use"><h3>APP / HOME SCREEN & OFFLINE</h3><p>${guidance}</p><p class="pwa-status" role="status">${status}</p><div class="pwa-actions">${installPrompt && !installed() ? '<button data-pwa-action="install">Install on device ↗</button>' : ""}${registration?.waiting ? '<span>New version ready</span><button data-pwa-action="update">Update and restart ↻</button>' : ""}${failed ? '<button data-pwa-action="retry">Retry offline save ↻</button>' : ""}</div></section>`;
}
function refresh() {
  const current = document.querySelector("#pwa-settings");
  if (current) current.outerHTML = pwaSettingsMarkup();
  document.documentElement.dataset.offlineReady = String(ready);
  const notice = document.querySelector<HTMLElement>("#pwa-update-notice");
  const waiting = Boolean(registration?.waiting);
  if (notice) notice.hidden = !waiting;
  const stage = document.querySelector<HTMLElement>("#stage");
  if (stage) stage.dataset.pwaUpdate = String(waiting);
}

export async function initPwa(notify: (message: string) => void) {
  if (isWallpaper) return;
  tell = notify;
  if (started || !import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) return;
  started = true;
  try {
    registration = await navigator.serviceWorker.register(assetUrl("sw.js"), {
      scope: import.meta.env.BASE_URL, updateViaCache: "none",
    });
    const watch = () => {
      const worker = registration?.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
          failed = false;
          refresh();
        } else if (worker.state === "redundant" && !registration?.active) {
          failed = true; refresh();
        }
      });
    };
    registration.addEventListener("updatefound", watch);
    watch();
    refresh();
    void navigator.serviceWorker.ready.then(() => { ready = true; failed = false; refresh(); });
    let lastCheck = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - lastCheck > 3_600_000) {
        lastCheck = Date.now(); void registration?.update().catch(() => {});
      }
    });
  } catch { failed = true; }
  refresh();
}

if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("controllerchange", () => {
  if (reloading) location.reload();
  else {
    refresh();
    navigator.serviceWorker.controller?.postMessage({ type: "RHINE_CACHE_USED", urls: [...new Set(performance.getEntriesByType("resource").map(entry => entry.name))] });
  }
});
document.addEventListener("click", async event => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-pwa-action]");
  if (!button) return;
  if (button.dataset.pwaAction === "install" && installPrompt) {
    const prompt = installPrompt; installPrompt = undefined;
    try { await prompt.prompt(); await prompt.userChoice; } catch { tell("Use the browser menu to add to the home screen"); }
    refresh();
  }
  if (button.dataset.pwaAction === "update" && registration?.waiting) {
    reloading = true;
    button.disabled = true;
    registration.waiting.postMessage({ type: "RHINE_APPLY_UPDATE" });
  }
  if (button.dataset.pwaAction === "retry") {
    failed = false;
    refresh();
    if (registration) {
      try { await registration.update(); } catch { failed = true; refresh(); }
    } else { started = false; void initPwa(tell); }
  }
});
