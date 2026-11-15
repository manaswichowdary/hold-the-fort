"use client";
// "Scan to ask Sage": a QR code for the live ask page, made from this site's own address,
// so it works on localhost, the Amplify URL and holdthefort.club without changes.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { OWNER } from "@/lib/api";
import Icon from "./Icon";

export default function QrCard() {
  const [svg, setSvg] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/ask/${OWNER}`;
    setLink(url.replace(/^https?:\/\//, ""));
    // Dark modules on a light square in both themes: phone cameras need strong contrast
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2e1b14", light: "#fffaf2" } })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, []);

  return (
    <div className="qr-card">
      <div className="qr-code" aria-label="QR code to ask Sage" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-text">
        <span className="qr-kicker"><Icon name="phone" size={18} /> Try it on your phone</span>
        <b>Scan to ask Sage as a coworker</b>
        <span className="qr-hint">Type your name, ask anything, or claim an emergency and see if Sage lets it through.</span>
        {link && <span className="qr-link">{link}</span>}
      </div>
    </div>
  );
}
