import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ─── Service Worker registration + auto-reload on update ───────────────────
// Critical: the new SW posts a {type:'SW_UPDATED'} message on activate.
// We listen for it and force-reload the page so users stuck on the previous
// (cache-first, blank-page-prone) shell get the fresh HTML immediately.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });

  let didReloadForNewSW = false;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED' && !didReloadForNewSW) {
      didReloadForNewSW = true;
      // Use a short timeout so any pending operations can flush.
      setTimeout(() => window.location.reload(), 50);
    }
  });

  // If a brand-new SW takes control mid-session (controllerchange), refresh once.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (didReloadForNewSW) return;
    didReloadForNewSW = true;
    window.location.reload();
  });
}
