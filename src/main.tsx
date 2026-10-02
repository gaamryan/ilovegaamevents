import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./index.css";

// After a new deploy, the service worker / browser cache can leave an old
// tab holding chunk hashes that no longer exist on the server. When that
// tab then lazy-loads a route (React.lazy in App.tsx) and the chunk 404s,
// Vite emits this event rather than leaving the app half-mounted — reload
// once to pick up the current build instead of showing a blank page.
// Guarded so a genuinely broken deploy can't reload-loop forever.
window.addEventListener("vite:preloadError", () => {
  const key = "vite-preload-error-reloaded";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

// Deeper version of the same problem: the service worker's navigation
// route serves its OWN cached index.html on every load, so a tab can load
// that stale shell — referencing JS that no longer exists on the server —
// before the browser's background check installs the current service
// worker. skipWaiting()/clientsClaim() (baked into vite-plugin-pwa's
// autoUpdate mode) make that new worker take over immediately once it's
// ready; reload right when that handoff happens instead of leaving the
// tab running on the mismatched assets until something breaks.
if ("serviceWorker" in navigator) {
  let reloadedForNewController = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForNewController) return;
    reloadedForNewController = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    // updateViaCache: "none" stops the browser from checking for a new
    // service worker using its own HTTP-cached copy of sw.js — without
    // it, a host that caches JS aggressively can make a returning visitor's
    // browser believe nothing changed for up to 24h, so the reload-on-update
    // logic above never even gets a chance to fire.
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      // Covers a tab left open across a deploy: browsers normally only
      // recheck for updates on navigation, so a long-lived tab that never
      // reloads could otherwise sit on a stale version indefinitely.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update();
      });
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
