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
      <head>
        {/* The only way to follow the dark theme here: no stylesheet is loaded,
            and inline style attributes cannot contain a media query. */}
        <style>{`
          :root { color-scheme: light dark; --bg: #ffffff; --fg: #222222; --body: #3f3f3f; --muted: #6a6a6a; }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #121212; --fg: #f2f2f2; --body: #d4d4d4; --muted: #a3a3a3; }
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "system-ui, sans-serif",
          background: "var(--bg)",
          color: "var(--fg)",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.25, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 16, color: "var(--body)", marginTop: 12 }}>
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
              background: "#e00b41",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: 16, fontSize: 12, color: "var(--muted)", fontFamily: "monospace" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
