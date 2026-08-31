import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { SessionProvider } from "./auth/session-context.jsx";
import { registerServiceWorker } from "./pwa/register-service-worker.js";
import "./index.css";

registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
