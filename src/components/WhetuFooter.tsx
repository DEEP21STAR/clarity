/**
 * © 2026 Whetū Digital Ltd. All rights reserved.
 * Licensed dashboard — not for redistribution or resale.
 * Contact: hello@whetudigital.co.nz
 *
 * 2026-09-23 round 4 — "there's also no Whetū Digital footer on there" (Deep). Every Whetū
 * Digital product must carry this (see the /whetu skill's brand-standard footer). It lived on
 * PinGate.tsx only — never on the real dashboard itself, which is the actual product Mimi
 * uses day to day. Mounted once in App.tsx's AppContent, below the tab content, so every tab
 * carries it without duplicating it per-tab.
 */
export function WhetuFooter() {
  return (
    <div className="wfd-footer">
      <div className="wfd-logo">WHETŪ DIGITAL</div>
      <div className="wfd-tagline">Digital Tools for Modern Living — Aotearoa New Zealand</div>
      <div className="wfd-copy">
        © 2026 Whetū Digital Ltd. &nbsp;·&nbsp; <a href="mailto:hello@whetudigital.co.nz">hello@whetudigital.co.nz</a>
      </div>
      <span className="wfd-ded">
        Built with care for Mimi <span className="wfd-heart">♥</span>
      </span>
      <br />
      <span className="wfd-badge">Licensed Dashboard — Whetū Digital 2026</span>
    </div>
  )
}
