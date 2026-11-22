"use client";

// Deliberately minimal and self-contained: this replaces the ENTIRE root
// layout (including ClerkProvider/NextIntlClientProvider) when a render
// error happens above the (localized) segment, so it cannot depend on any
// context those providers set up — they may be exactly what crashed.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            fontFamily: "sans-serif",
          }}
        >
          <p style={{ color: "#666" }}>Something went wrong. Please try again.</p>
          <button
            onClick={reset}
            style={{
              borderRadius: "0.375rem",
              backgroundColor: "#111",
              color: "#fff",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
