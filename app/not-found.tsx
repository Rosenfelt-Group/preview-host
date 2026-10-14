import type { CSSProperties } from "react";

export const metadata = { title: "Rosably", robots: { index: false, follow: false } };

const main: CSSProperties = {
  maxWidth: 560, margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", lineHeight: 1.6, color: "#1f2933",
};
const button: CSSProperties = {
  display: "inline-block", marginTop: "1rem", padding: "0.75rem 1.5rem", borderRadius: 8,
  background: "#1f2933", color: "#ffffff", textDecoration: "none", fontWeight: 600,
};

export default function NotFound() {
  return (
    <main style={main}>
      <h1 style={{ lineHeight: 1.25 }}>This page isn&apos;t available here</h1>
      <p>
        This address only displays prototypes that were shared with you from a Rosably project room.
        If you were sent a link, please open it from your email or from the room you were invited to.
      </p>
      <a href="https://rosably.com" rel="noopener" style={button}>Go to the Rosably home page</a>
    </main>
  );
}
