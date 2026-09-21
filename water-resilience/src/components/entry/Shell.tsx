'use client';

import React from 'react';
import Link from 'next/link';
import { Droplets } from 'lucide-react';

/* ════════════════════════════════════════════════════════════
   ENTRY SHELL — shared chrome for the entry experience
   (Home → CAD Import → Digital Twin).

   Purely additive. The locked application screens are untouched.
   These screens own a fixed scroll container because the root
   layout keeps `body { overflow: hidden }`, and they reuse the
   design tokens defined in globals.css (surfaces, borders,
   brand cyan — no new colors are introduced).
   ════════════════════════════════════════════════════════════ */

const ENTRY_CSS = `
  .entry-scroll {
    position: fixed; inset: 0; overflow-y: auto; overflow-x: hidden;
    background: var(--surface-0); color: var(--text-primary);
    font-family: var(--font-mono);
  }
  .entry-layer {
    position: relative; z-index: 1; min-height: 100%;
    display: flex; flex-direction: column;
  }

  /* ── Blueprint backdrop (decorative) ── */
  .entry-bg {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(56,189,248,0.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56,189,248,0.055) 1px, transparent 1px);
    background-size: 44px 44px;
    -webkit-mask-image: radial-gradient(ellipse 110% 80% at 50% 0%, #000 8%, transparent 76%);
    mask-image: radial-gradient(ellipse 110% 80% at 50% 0%, #000 8%, transparent 76%);
  }
  .entry-glow {
    position: fixed; top: -260px; left: 50%; transform: translateX(-50%);
    width: 1000px; height: 560px; z-index: 0; pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(56,189,248,0.09), transparent 62%);
  }

  /* ── Nav ── */
  .entry-nav {
    position: sticky; top: 0; z-index: 40;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    height: 58px; padding: 0 28px;
    background: rgba(8, 13, 24, 0.86);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--border-subtle);
  }
  .entry-brand { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; }
  .entry-brand-mark {
    width: 26px; height: 26px; border-radius: 6px;
    display: grid; place-items: center;
    background: rgba(56, 189, 248, 0.10);
    border: 1px solid rgba(56, 189, 248, 0.35);
    color: var(--brand);
  }
  .entry-brand-name {
    font-size: 13px; font-weight: 600; letter-spacing: 2.2px;
    color: var(--text-primary);
  }
  .entry-brand-tag {
    font-size: 9px; letter-spacing: 1px; color: var(--text-muted);
    border: 1px solid var(--border-default); border-radius: 3px;
    padding: 2px 5px;
  }
  .entry-nav-links { display: flex; gap: 24px; align-items: center; }
  .entry-nav-links a, .entry-nav-links button {
    background: none; border: none; padding: 0;
    color: var(--text-tertiary); font-family: var(--font-mono);
    font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase;
    text-decoration: none; cursor: pointer;
  }
  .entry-nav-links a:hover, .entry-nav-links button:hover { color: var(--brand); filter: none; }
  .entry-nav-links a:focus-visible, .entry-nav-links button:focus-visible {
    outline: 2px solid var(--brand); outline-offset: 3px; border-radius: 2px;
  }
  .entry-nav-cta {
    font-size: 11px; font-weight: 600; letter-spacing: 1.4px;
    color: var(--brand); text-decoration: none;
    background: rgba(56, 189, 248, 0.10);
    border: 1px solid rgba(56, 189, 248, 0.35);
    border-radius: 5px; padding: 8px 14px;
    transition: all 0.15s ease;
  }
  .entry-nav-cta:hover { background: rgba(56, 189, 248, 0.18); }
  .entry-nav-cta:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

  /* ── Buttons ── */
  .entry-btn-primary {
    display: inline-flex; align-items: center; gap: 9px;
    background: linear-gradient(180deg, #38bdf8, #0ea5e9);
    color: #06121f; font-family: var(--font-mono); text-decoration: none;
    font-size: 12px; font-weight: 700; letter-spacing: 1.4px;
    padding: 13px 24px; border-radius: 6px;
    border: 1px solid rgba(56, 189, 248, 0.6);
    box-shadow: 0 0 24px rgba(56, 189, 248, 0.16);
    transition: all 0.18s ease;
  }
  .entry-btn-primary:hover {
    filter: brightness(1.12);
    box-shadow: 0 0 30px rgba(56, 189, 248, 0.26);
  }
  .entry-btn-primary:focus-visible { outline: 2px solid #7dd3fc; outline-offset: 3px; }
  .entry-btn-ghost {
    display: inline-flex; align-items: center; gap: 9px;
    background: rgba(56, 189, 248, 0.06); color: var(--brand);
    font-family: var(--font-mono); text-decoration: none;
    font-size: 12px; font-weight: 600; letter-spacing: 1.4px;
    padding: 13px 22px; border-radius: 6px;
    border: 1px solid rgba(56, 189, 248, 0.26);
    transition: all 0.18s ease;
  }
  .entry-btn-ghost:hover { background: rgba(56, 189, 248, 0.13); border-color: rgba(56, 189, 248, 0.45); }
  .entry-btn-ghost:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }

  /* ── Footer ── */
  .entry-footer {
    margin-top: auto; border-top: 1px solid var(--border-subtle);
    padding: 28px 28px 34px;
    display: flex; flex-direction: column; gap: 7px; align-items: center; text-align: center;
  }
  .entry-footer-brand {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 600; letter-spacing: 2px; color: var(--text-secondary);
  }
  .entry-footer-meta { font-size: 11px; color: var(--text-muted); letter-spacing: 0.4px; }
  .entry-footer-note { font-size: 10px; color: var(--text-muted); opacity: 0.75; }

  /* ── Shared motion ── */
  @keyframes entrySpin { to { transform: rotate(360deg); } }
  @keyframes entryBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
  .entry-spin { animation: entrySpin 1.1s linear infinite; }
  .entry-blink { animation: entryBlink 1.05s step-end infinite; }

  @media (max-width: 820px) {
    .entry-nav { padding: 0 16px; }
    .entry-nav-links { display: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .entry-spin, .entry-blink { animation: none !important; }
  }
`;

export function EntryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="entry-scroll">
      <div className="entry-bg" aria-hidden="true" />
      <div className="entry-glow" aria-hidden="true" />
      <div className="entry-layer">
        {children}
      </div>
      <style>{ENTRY_CSS}</style>
    </div>
  );
}

export function EntryNav({ variant = 'home' }: { variant?: 'home' | 'import' }) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="entry-nav">
      <Link href="/" className="entry-brand" aria-label="SewerSim — home">
        <span className="entry-brand-mark"><Droplets size={14} strokeWidth={2.2} /></span>
        <span className="entry-brand-name">SEWERSIM</span>
        <span className="entry-brand-tag">v1.0</span>
      </Link>

      {variant === 'home' ? (
        <div className="entry-nav-links">
          <button type="button" onClick={() => scrollTo('pipeline')}>Pipeline</button>
          <button type="button" onClick={() => scrollTo('capabilities')}>Capabilities</button>
          <button type="button" onClick={() => scrollTo('technology')}>Technology</button>
        </div>
      ) : (
        <div className="entry-nav-links">
          <Link href="/">&#8592; Home</Link>
        </div>
      )}

      <Link href="/import" className="entry-nav-cta">ENTER SEWERSIM</Link>
    </nav>
  );
}

export function EntryFooter() {
  return (
    <footer className="entry-footer">
      <div className="entry-footer-brand">
        <span className="entry-brand-mark" style={{ width: 20, height: 20, borderRadius: 5 }}>
          <Droplets size={11} strokeWidth={2.2} />
        </span>
        SEWERSIM
      </div>
      <div className="entry-footer-meta">
        Sewer Network Simulation &amp; Failure Detection &#183; Digital twin for underground infrastructure &#183; v1.0
      </div>
      <div className="entry-footer-note">
        Prototype &#8212; CAD import is a simulated processing sequence; the digital twin loads the built-in 52-node network topology.
      </div>
    </footer>
  );
}
