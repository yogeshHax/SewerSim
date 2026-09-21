'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity, AlertTriangle, Droplets, Gauge, Layers, Target,
} from 'lucide-react';
import { EntryShell, EntryNav, EntryFooter } from '../components/entry/Shell';

/* ════════════════════════════════════════════════════════════
   SEWERSIM — HOME
   Entry point of the entry experience. Clicking the CTA moves
   to /import (CAD analysis), which then leads to the existing,
   untouched infrastructure at /simulate.
   Reuses globals.css tokens only — no new colors.
   ════════════════════════════════════════════════════════════ */

const HOME_CSS = `
  .home-section { max-width: 1200px; width: 100%; margin: 0 auto; padding: 96px 28px 0; }

  .home-kicker {
    color: var(--brand); font-size: 10px; font-weight: 600;
    letter-spacing: 2.4px; text-transform: uppercase; margin-bottom: 10px;
  }
  .home-h2 { font-size: 22px; font-weight: 700; letter-spacing: 0.4px; color: var(--text-primary); }

  /* ── Hero ── */
  .home-hero { text-align: center; padding-top: 108px !important; }
  .home-badge {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1px solid rgba(56, 189, 248, 0.28); border-radius: 999px;
    background: rgba(56, 189, 248, 0.07); color: var(--brand);
    font-size: 10px; letter-spacing: 1.8px; padding: 6px 14px; margin-bottom: 26px;
  }
  .home-title {
    font-size: clamp(40px, 7vw, 68px); font-weight: 700;
    letter-spacing: 6px; line-height: 1.04; margin-bottom: 16px;
    color: var(--text-primary);
    text-shadow: 0 0 40px rgba(56, 189, 248, 0.18);
  }
  .home-subtitle {
    font-family: var(--font-sans); font-size: clamp(16px, 2.4vw, 21px);
    font-weight: 500; color: var(--text-secondary); margin-bottom: 20px; letter-spacing: 0.3px;
  }
  .home-subtitle em { color: var(--brand); font-style: normal; }
  .home-lede {
    font-family: var(--font-sans); font-size: 14.5px; line-height: 1.75;
    color: var(--text-tertiary); max-width: 640px; margin: 0 auto 34px;
  }
  .home-ctas { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

  /* ── Status ribbon ── */
  .home-ribbon {
    margin-top: 46px; display: inline-flex; align-items: center; gap: 10px;
    border: 1px solid var(--border-default); border-radius: 5px;
    background: var(--surface-100); padding: 9px 18px;
    font-size: 10.5px; letter-spacing: 1.2px; color: var(--text-secondary);
  }
  .home-ribbon i {
    width: 7px; height: 7px; border-radius: 50%; background: var(--success);
    animation: homePulse 2s ease-in-out infinite;
  }
  @keyframes homePulse { 0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--success); } 50% { opacity: 0.35; box-shadow: none; } }

  /* ── Schematic ── */
  .home-schematic {
    margin: 54px auto 0; max-width: 620px;
    border: 1px solid var(--border-subtle); border-radius: 8px;
    background: rgba(12, 18, 34, 0.72); padding: 14px 16px 10px;
  }
  .home-schematic svg { width: 100%; height: auto; display: block; }
  .home-schematic figcaption {
    margin-top: 8px; text-align: center; font-size: 9.5px;
    letter-spacing: 1.6px; color: var(--text-muted);
  }
  .sch-pipe { stroke: #22304c; stroke-width: 3; fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .sch-flow { stroke: var(--brand); stroke-width: 1.6; fill: none; stroke-dasharray: 5 9; opacity: 0.85; animation: schDash 1.6s linear infinite; }
  .sch-flow-b { stroke: var(--brand); stroke-width: 1.4; fill: none; stroke-dasharray: 4 10; opacity: 0.5; animation: schDash 2.4s linear infinite reverse; }
  @keyframes schDash { to { stroke-dashoffset: -14; } }
  .sch-node { fill: #0c1222; stroke: #475569; stroke-width: 1.5; }
  .sch-label { font-family: var(--font-mono); font-size: 7.5px; fill: #64748b; letter-spacing: 0.6px; }
  .sch-warn { animation: schWarn 1.8s ease-in-out infinite; }
  @keyframes schWarn { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }

  /* ── Stats ── */
  .home-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 26px; }
  .home-stat {
    border: 1px solid var(--border-subtle); border-radius: 8px;
    background: var(--surface-100); padding: 18px 12px; text-align: center;
  }
  .home-stat b { display: block; font-size: 26px; font-weight: 700; color: var(--brand); letter-spacing: -0.5px; }
  .home-stat span { display: block; margin-top: 5px; font-size: 9.5px; letter-spacing: 1.6px; text-transform: uppercase; color: var(--text-tertiary); }

  /* ── Pipeline steps ── */
  .home-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 34px; }
  .home-step { position: relative; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface-100); padding: 20px 18px; }
  .home-step i {
    font-style: normal; font-size: 10px; font-weight: 700; letter-spacing: 1px;
    color: var(--brand); display: block; margin-bottom: 10px;
  }
  .home-step b { display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 7px; letter-spacing: 0.4px; }
  .home-step p { font-family: var(--font-sans); font-size: 12px; line-height: 1.6; color: var(--text-tertiary); }
  .home-step::after {
    content: ''; position: absolute; top: 50%; right: -15px; width: 15px; height: 1px;
    background: linear-gradient(90deg, rgba(56, 189, 248, 0.4), rgba(56, 189, 248, 0.1));
  }
  .home-step:last-child::after { display: none; }

  /* ── Capability cards ── */
  .home-caps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 34px; }
  .home-cap { border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface-100); padding: 22px 20px; transition: border-color 0.18s ease; }
  .home-cap:hover { border-color: rgba(56, 189, 248, 0.3); }
  .home-cap svg { color: var(--brand); margin-bottom: 12px; }
  .home-cap b { display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 7px; letter-spacing: 0.3px; }
  .home-cap p { font-family: var(--font-sans); font-size: 12.5px; line-height: 1.65; color: var(--text-tertiary); }

  /* ── Technology table ── */
  .home-tech { max-width: 760px; margin: 34px auto 0; display: grid; gap: 8px; }
  .home-tech-row {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    border: 1px solid var(--border-subtle); border-radius: 6px;
    background: var(--surface-100); padding: 12px 18px;
  }
  .home-tech-row span { font-family: var(--font-sans); font-size: 12px; color: var(--text-tertiary); }
  .home-tech-row code { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-primary); }

  /* ── Closing CTA ── */
  .home-close { text-align: center; padding-bottom: 0 !important; }
  .home-close-box {
    border: 1px solid rgba(56, 189, 248, 0.18); border-radius: 10px;
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.05), rgba(12, 18, 34, 0.4));
    padding: 44px 28px;
  }

  @media (max-width: 960px) {
    .home-caps { grid-template-columns: 1fr 1fr; }
    .home-steps { grid-template-columns: 1fr 1fr; }
    .home-step:nth-child(2)::after { display: none; }
  }
  @media (max-width: 620px) {
    .home-section { padding-top: 64px; }
    .home-caps, .home-steps, .home-stats { grid-template-columns: 1fr; }
    .home-step::after { display: none !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    .sch-flow, .sch-flow-b, .home-ribbon i, .sch-warn { animation: none !important; }
  }
`;

/* ── Decorative blueprint schematic (the signature element) ── */
function NetworkSchematic() {
  return (
    <figure className="home-schematic">
      <svg viewBox="0 0 560 300" role="img" aria-label="Sewer network topology schematic">
        <defs>
          <pattern id="schGrid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="rgba(56,189,248,0.07)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="560" height="300" fill="url(#schGrid)" />

        {/* pipes */}
        <polyline className="sch-pipe" points="40,220 120,220 120,140 300,140" />
        <polyline className="sch-pipe" points="300,140 300,80 440,80" />
        <polyline className="sch-pipe" points="300,140 380,140 380,220 500,220 500,80 440,80" />
        <polyline className="sch-pipe" points="120,220 120,260 180,260" />

        {/* flow overlays */}
        <polyline className="sch-flow" points="40,220 120,220 120,140 300,140 300,80 440,80" />
        <polyline className="sch-flow-b" points="300,140 380,140 380,220 500,220 500,80 440,80" />

        {/* blockage marker */}
        <g className="sch-warn">
          <line x1="333" y1="133" x2="347" y2="147" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
          <line x1="347" y1="133" x2="333" y2="147" stroke="#f87171" strokeWidth="2" strokeLinecap="round" />
          <text className="sch-label" x="352" y="134" fill="#f87171">BLK-04</text>
        </g>

        {/* nodes */}
        <circle className="sch-node" cx="120" cy="220" r="5" />
        <circle className="sch-node" cx="120" cy="140" r="5" />
        <circle className="sch-node" cx="300" cy="80" r="5" />
        <circle className="sch-node" cx="380" cy="140" r="5" />
        <circle className="sch-node" cx="380" cy="220" r="5" />
        <circle className="sch-node" cx="500" cy="220" r="5" />
        <circle className="sch-node" cx="500" cy="80" r="5" />
        <circle className="sch-node" cx="120" cy="260" r="5" />

        {/* source (cyan, halo) */}
        <circle cx="40" cy="220" r="10" fill="none" stroke="rgba(56,189,248,0.35)" strokeWidth="1.5" />
        <circle cx="40" cy="220" r="5" fill="#0c1222" stroke="#38bdf8" strokeWidth="2" />

        {/* warning node (amber pulse) */}
        <circle className="sch-warn" cx="300" cy="140" r="9" fill="none" stroke="rgba(251,191,36,0.5)" strokeWidth="1.5" />
        <circle className="sch-node" cx="300" cy="140" r="5" stroke="#fbbf24" />

        {/* dead-end (amber) */}
        <circle className="sch-node" cx="180" cy="260" r="5" stroke="#fbbf24" />

        {/* destination */}
        <circle className="sch-node" cx="440" cy="80" r="5" stroke="#4ade80" />

        {/* labels */}
        <text className="sch-label" x="24" y="242">SRC-01 · OUTFALL</text>
        <text className="sch-label" x="106" y="126">MH-12</text>
        <text className="sch-label" x="284" y="64">MH-27</text>
        <text className="sch-label" x="418" y="66">OUT-02</text>
        <text className="sch-label" x="160" y="252">DEAD-END · MH-31</text>
        <text className="sch-label" x="464" y="238">MH-44</text>

        {/* corner registration ticks */}
        <g stroke="rgba(56,189,248,0.35)" strokeWidth="1">
          <line x1="10" y1="10" x2="22" y2="10" /><line x1="10" y1="10" x2="10" y2="22" />
          <line x1="550" y1="10" x2="538" y2="10" /><line x1="550" y1="10" x2="550" y2="22" />
          <line x1="10" y1="290" x2="22" y2="290" /><line x1="10" y1="290" x2="10" y2="278" />
          <line x1="550" y1="290" x2="538" y2="290" /><line x1="550" y1="290" x2="550" y2="278" />
        </g>
      </svg>
      <figcaption>FIG. 01 — LIVE NETWORK TOPOLOGY · BFS-VALIDATED GRAPH · SIMPLIFIED VIEW</figcaption>
    </figure>
  );
}

const CAPABILITIES = [
  { icon: Layers, title: '3D Digital Twin', desc: 'A full underground city — conduits, manholes, chambers and terrain — rendered as an explorable, inspectable model.' },
  { icon: Droplets, title: 'Real-Time Hydraulics', desc: 'Demand-driven flow allocation with pressure propagation across loops, branches and dead-ends of the network graph.' },
  { icon: Gauge, title: 'Interactive Control Room', desc: 'Drive source pressure, inflow and per-pipe restrictions manually — every gauge and asset responds instantly.' },
  { icon: AlertTriangle, title: 'Failure Detection', desc: 'Blockages, leaks and overflows surface as alerts, mapped to the exact pipe and downstream consequence.' },
  { icon: Activity, title: 'Live Telemetry', desc: 'Pressure, flow, velocity and utilization stream through every panel — timeline, dashboard and inspector stay in sync.' },
  { icon: Target, title: 'AI Engineer', desc: 'Ask the network questions in plain language and get ranked vulnerabilities with the evidence behind them.' },
] as const;

const TECH = [
  { label: 'Rendering', value: 'Three.js · React Three Fiber' },
  { label: 'State', value: 'Zustand' },
  { label: 'Hydraulics', value: 'Demand-driven flow · pressure propagation' },
  { label: 'Topology', value: 'Graph-first · BFS connectivity validation' },
  { label: 'UI', value: 'React 19 · TypeScript' },
  { label: 'Framework', value: 'Next.js (App Router)' },
] as const;

const STEPS = [
  { n: '01', title: 'Import CAD', desc: 'Drop a DWG / DXF drawing — the system reads conduit geometry and access structures.' },
  { n: '02', title: 'AI Analysis', desc: 'Pipes, junctions and manholes are detected, classified and compiled into a validated graph.' },
  { n: '03', title: 'Digital Twin', desc: 'The network comes alive as a 3D environment with live pressure, flow and water-level fields.' },
  { n: '04', title: 'Failure Detection', desc: 'Scenario engine flags blockages, leaks and overload before they become real-world failures.' },
] as const;

export default function HomePage() {
  return (
    <EntryShell>
      <style>{HOME_CSS}</style>
      <EntryNav variant="home" />

      <main>
        {/* ── HERO ─────────────────────────────────────────── */}
        <section className="home-section home-hero">
          <div className="home-badge">
            <Activity size={11} strokeWidth={2.4} />
            UNDERGROUND INFRASTRUCTURE · DIGITAL TWIN PLATFORM
          </div>

          <h1 className="home-title">SEWERSIM</h1>
          <p className="home-subtitle">
            Sewer Network Simulation &amp; <em>Failure Detection</em>
          </p>
          <p className="home-lede">
            Transform your infrastructure data into an intelligent digital twin.
            Analyze, simulate, and identify vulnerabilities before they become
            real-world failures.
          </p>

          <div className="home-ctas">
            <Link href="/import" className="entry-btn-primary">
              ENTER SEWERSIM <span aria-hidden="true">&#9656;</span>
            </Link>
            <a
              href="#pipeline"
              className="entry-btn-ghost"
              onClick={e => {
                e.preventDefault();
                document.getElementById('pipeline')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              EXPLORE THE PIPELINE
            </a>
          </div>

          <div className="home-ribbon">
            <i aria-hidden="true" />
            SYSTEM ONLINE — 52 NODES &#183; 68 PIPES &#183; 127 ASSETS MONITORED
          </div>

          <NetworkSchematic />
        </section>

        {/* ── STATS ────────────────────────────────────────── */}
        <section className="home-section" aria-label="Platform statistics">
          <div className="home-stats">
            <div className="home-stat"><b>52</b><span>Network Nodes</span></div>
            <div className="home-stat"><b>68</b><span>Pipe Segments</span></div>
            <div className="home-stat"><b>127</b><span>Total Assets</span></div>
            <div className="home-stat"><b>6</b><span>Analysis Modes</span></div>
          </div>
        </section>

        {/* ── PIPELINE ─────────────────────────────────────── */}
        <section className="home-section" id="pipeline">
          <div style={{ marginBottom: 8 }}>
            <div className="home-kicker">Workflow</div>
            <h2 className="home-h2">FROM CAD DRAWING TO LIVING NETWORK</h2>
          </div>
          <div className="home-steps">
            {STEPS.map(s => (
              <div className="home-step" key={s.n}>
                <i>{s.n}</i>
                <b>{s.title}</b>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CAPABILITIES ─────────────────────────────────── */}
        <section className="home-section" id="capabilities">
          <div style={{ marginBottom: 8 }}>
            <div className="home-kicker">Capabilities</div>
            <h2 className="home-h2">BUILT FOR ENGINEERING CLARITY</h2>
          </div>
          <div className="home-caps">
            {CAPABILITIES.map(c => (
              <div className="home-cap" key={c.title}>
                <c.icon size={18} strokeWidth={1.9} />
                <b>{c.title}</b>
                <p>{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── TECHNOLOGY ───────────────────────────────────── */}
        <section className="home-section" id="technology">
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div className="home-kicker">Technology</div>
            <h2 className="home-h2">UNDER THE HOOD</h2>
          </div>
          <div className="home-tech">
            {TECH.map(t => (
              <div className="home-tech-row" key={t.label}>
                <span>{t.label}</span>
                <code>{t.value}</code>
              </div>
            ))}
          </div>
        </section>

        {/* ── CLOSING CTA ──────────────────────────────────── */}
        <section className="home-section home-close">
          <div className="home-close-box">
            <h2 className="home-h2" style={{ marginBottom: 10 }}>READY TO SEE THE NETWORK?</h2>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>
              Import a CAD drawing or explore the built-in network dataset.
            </p>
            <Link href="/import" className="entry-btn-primary" style={{ margin: '0 auto' }}>
              START ANALYSIS <span aria-hidden="true">&#9656;</span>
            </Link>
          </div>
        </section>
      </main>

      <EntryFooter />
    </EntryShell>
  );
}
