"use client";

/**
 * Last-resort error boundary, for an error thrown by the root layout itself.
 *
 * `error.tsx` cannot catch that case: it renders INSIDE the root layout, so if
 * the layout is what failed there is nothing left to render it in. This file
 * replaces the whole document, which is why it has its own <html> and <body>
 * and uses inline styles - the stylesheet is loaded by the layout that just
 * failed, so no class names can be relied on here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#222222",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.25, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 16, color: "#3f3f3f", marginTop: 12 }}>
            The page could not be shown. Trying again usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              height: 48,
              padding: "0 24px",
              borderRadius: 8,
              border: 0,
              background: "#ff385c",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 12, color: "#6a6a6a", fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
