"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "40px", fontFamily: "sans-serif", textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "12px" }}>Algo deu errado.</h2>
          <p style={{ color: "#666", marginBottom: "24px" }}>O erro foi registrado automaticamente. Tente novamente.</p>
          <button onClick={reset} style={{ padding: "10px 20px", background: "#3D2E8F", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
