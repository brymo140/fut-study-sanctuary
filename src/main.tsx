import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Sentry — crash monitoring (no browserTracingIntegration to avoid WebView crash)
import * as Sentry from "@sentry/react";
Sentry.init({
  dsn: "https://ce5903899682757fc8564c7d57428cb0@o4511489450573824.ingest.us.sentry.io/4511489455030272",
  environment: "production",
  // DO NOT add browserTracingIntegration — crashes Android WebView
  integrations: [],
  tracesSampleRate: 0,
  beforeSend(event) {
    // Don't send events for network errors (too noisy)
    if (event.exception?.values?.[0]?.type === 'TypeError' &&
        event.exception?.values?.[0]?.value?.includes('fetch')) {
      return null;
    }
    return event;
  },
});

createRoot(document.getElementById("root")!).render(<App />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
