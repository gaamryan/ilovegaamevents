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

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
