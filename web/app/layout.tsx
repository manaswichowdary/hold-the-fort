import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Sep from "@/components/Sep";

export const metadata: Metadata = {
  title: "Hold the Fort",
  description: "Go on vacation. We'll hold the fort. Your personal away agent.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Pick the saved or system theme before paint, so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("fort-theme");if(t!=="dark"){t="light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`,
          }}
        />
      </head>
      <body>
        <Nav />
        <main>{children}</main>
        <footer className="footer">
          <div className="footer-top">
            <div className="footer-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-light.png" alt="Hold the Fort" className="footer-logo only-light" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-dark.png" alt="Hold the Fort" className="footer-logo only-dark" />
              <p>Your personal away agent.</p>
            </div>
            <div className="footer-col">
              <h4>Explore</h4>
              <a href="/#about">About</a>
              <a href="/#features">Features</a>
              <a href="/#how">How it works</a>
              <a href="/#privacy">Privacy</a>
            </div>
            <div className="footer-col">
              <h4>Try it</h4>
              <a href="/start">Choose your view</a>
              <a href="/board">Team board</a>
              <a href="https://github.com/manaswichowdary/hold-the-fort">Source code</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 Hold the Fort <Sep /> Built at SunHacks 2026 by Manaswi Chowdary Makkena</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
