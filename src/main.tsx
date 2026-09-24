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
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
