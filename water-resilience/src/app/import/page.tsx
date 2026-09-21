'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, FolderOpen, UploadCloud } from 'lucide-react';
import { EntryShell, EntryNav, EntryFooter } from '../../components/entry/Shell';

/* ════════════════════════════════════════════════════════════
   IMPORT INFRASTRUCTURE — CAD upload + simulated analysis.

   Prototype interaction: the selected file is read only for its
   name; nothing is parsed, stored, or sent anywhere. The staged
   analysis is a demonstration sequence that always ends at the
   existing digital twin (/simulate) — which is untouched.
   ════════════════════════════════════════════════════════════ */

type Phase = 'idle' | 'running' | 'done';

const ACCEPT = '.dwg,.dxf,.dgn,.ifc,.svg';

const STAGES: { label: string; detail: string; end: number }[] = [
  { label: 'Uploading infrastructure data', detail: 'Streaming geometry buffers', end: 22 },
  { label: 'Analyzing CAD structure', detail: 'Parsing layers · entities · blocks', end: 40 },
  { label: 'Detecting pipes', detail: 'Extracting conduit centerlines & profiles', end: 58 },
  { label: 'Detecting junctions and manholes', detail: 'Classifying nodes · chambers · access points', end: 74 },
  { label: 'Building network topology', detail: 'Validating graph connectivity (BFS)', end: 88 },
  { label: 'Generating digital twin', detail: 'Compiling hydraulic model · 3D environment', end: 100 },
];

const IMPORT_CSS = `
  .imp-main { flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 48px 24px 72px; }

  .imp-kicker { color: var(--brand); font-size: 10px; font-weight: 600;
    letter-spacing: 2.6px; text-transform: uppercase; margin-bottom: 10px; }
  .imp-title { font-size: 26px; font-weight: 700; letter-spacing: 3px;
    color: var(--text-primary); margin-bottom: 12px; }
  .imp-lede { font-family: var(--font-sans); font-size: 13.5px; color: var(--text-tertiary);
    max-width: 460px; text-align: center; line-height: 1.7; margin-bottom: 34px; }

  /* ── Upload zone ── */
  .imp-drop {
    width: 100%; max-width: 560px; position: relative; cursor: pointer;
    border: 1.5px dashed rgba(56, 189, 248, 0.28); border-radius: 10px;
    background: var(--surface-100); padding: 46px 32px;
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }
  .imp-drop:hover, .imp-drop.over {
    border-color: rgba(56, 189, 248, 0.6);
    background: rgba(56, 189, 248, 0.05);
    box-shadow: 0 0 34px rgba(56, 189, 248, 0.08) inset;
  }
  .imp-drop:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
  .imp-drop-icon { width: 52px; height: 52px; border-radius: 10px; display: grid; place-items: center;
    background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25);
    color: var(--brand); margin-bottom: 12px; }
  .imp-drop b { font-size: 14px; font-weight: 600; color: var(--text-primary); letter-spacing: 1.2px; }
  .imp-drop small { font-family: var(--font-sans); font-size: 12px; color: var(--text-tertiary); }
  .imp-exts { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; justify-content: center; }
  .imp-exts span { font-size: 10px; letter-spacing: 1px; color: var(--text-secondary);
    border: 1px solid var(--border-default); border-radius: 4px;
    background: var(--surface-200); padding: 3px 9px; }
  .imp-choose { margin-top: 20px; display: inline-flex; align-items: center; gap: 8px;
    background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.35);
    color: var(--brand); font-family: var(--font-mono); font-size: 11px; font-weight: 600;
    letter-spacing: 1.4px; padding: 10px 18px; border-radius: 6px; }
  .imp-hint { margin-top: 16px; font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.5px; text-align: center; }

  /* ── Console (during / after processing) ── */
  .imp-console { width: 100%; max-width: 560px; border: 1px solid var(--border-default);
    border-radius: 8px; background: var(--surface-100); overflow: hidden;
    animation: impIn 0.3s ease; }
  @keyframes impIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .imp-console-head { display: flex; align-items: center; justify-content: space-between;
    padding: 11px 16px; border-bottom: 1px solid var(--border-subtle); background: var(--surface-200); }
  .imp-console-head b { font-size: 11px; font-weight: 600; letter-spacing: 1.4px; color: var(--text-primary); }
  .imp-console-head span { font-size: 10px; color: var(--text-tertiary); letter-spacing: 1px; }
  .imp-console-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

  .imp-stage { display: flex; flex-direction: column; gap: 4px; }
  .imp-stage-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .imp-stage-name { display: flex; align-items: center; gap: 9px; font-size: 11.5px; letter-spacing: 0.6px; color: var(--text-primary); }
  .imp-stage-name small { display: block; font-family: var(--font-sans); font-size: 10.5px; color: var(--text-muted); letter-spacing: 0.2px; }
  .imp-mark { flex: none; width: 15px; height: 15px; display: grid; place-items: center; font-size: 11px; }
  .imp-mark.pending { color: var(--text-muted); }
  .imp-mark.active { color: var(--brand); }
  .imp-mark.done { color: var(--success); }
  .imp-bar { height: 4px; border-radius: 2px; background: var(--surface-300); overflow: hidden; }
  .imp-bar i { display: block; height: 100%; border-radius: 2px;
    background: linear-gradient(90deg, #0ea5e9, #38bdf8);
    transition: width 0.25s ease; }
  .imp-pct { font-size: 10.5px; color: var(--brand); min-width: 44px; text-align: right; }
  .imp-log { border-top: 1px solid var(--border-subtle); padding: 12px 16px;
    font-size: 10.5px; line-height: 1.9; color: var(--text-tertiary);
    background: var(--surface-0); min-height: 88px; }
  .imp-log em { font-style: normal; color: var(--success); }
  .imp-log i { font-style: normal; animation: entryBlink 1.05s step-end infinite; }

  /* ── Ready state ── */
  .imp-ready { text-align: center; padding: 34px 24px 30px;
    animation: impIn 0.4s ease; }
  .imp-ready-badge { width: 46px; height: 46px; margin: 0 auto 16px; border-radius: 50%;
    display: grid; place-items: center; color: var(--success);
    border: 1px solid rgba(74, 222, 128, 0.4); background: rgba(74, 222, 128, 0.08);
    box-shadow: 0 0 22px rgba(74, 222, 128, 0.15); }
  .imp-ready h3 { font-size: 17px; font-weight: 700; letter-spacing: 2.4px; color: var(--text-primary); margin-bottom: 8px; }
  .imp-ready p { font-family: var(--font-sans); font-size: 12.5px; color: var(--text-tertiary); margin-bottom: 24px; }
  .imp-ready-stats { display: flex; justify-content: center; gap: 10px; margin-bottom: 26px; flex-wrap: wrap; }
  .imp-ready-stats span { font-size: 10px; letter-spacing: 1.2px; color: var(--text-secondary);
    border: 1px solid var(--border-default); border-radius: 4px; background: var(--surface-200); padding: 4px 10px; }
`;

export default function ImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const runAnalysis = useCallback((name: string, size: string) => {
    setPhase('running');
    setProgress(0);
    setLogs([]);
    setFileName(name);
    setFileSize(size);
    timers.current = [];

    const stages = STAGES;
    const totalDuration = 7200; // ms of staged theatre
    const t0 = Date.now();

    // Smooth progress toward 100 over totalDuration
    const tick = () => {
      const elapsed = Date.now() - t0;
      const p = Math.min(100, Math.round((elapsed / totalDuration) * 100));
      setProgress(p);
      if (p < 100) timers.current.push(setTimeout(tick, 80));
    };
    tick();

    // Stage log lines at their stage boundaries
    stages.forEach((s, idx) => {
      timers.current.push(setTimeout(() => {
        setLogs(prev => [...prev, `[${String(idx + 1).padStart(2, '0')}/06] ${s.label} — ${s.detail}`]);
      }, (s.end / 100) * totalDuration));
    });

    // Completion
    timers.current.push(setTimeout(() => {
      setLogs(prev => [...prev, '✔ Analysis complete — digital twin generated']);
      setPhase('done');
    }, totalDuration + 250));
  }, []);

  const acceptFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const size = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
    runAnalysis(file.name, size);
  }, [runAnalysis]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (phase === 'idle') acceptFile(e.dataTransfer.files?.[0]);
  }, [acceptFile, phase]);

  const formatName = fileName || 'SewerNetwork_Main.dwg';

  return (
    <EntryShell>
      <style>{IMPORT_CSS}</style>
      <EntryNav variant="import" />

      <main className="imp-main">
        <div className="imp-kicker">Import Infrastructure</div>
        <h1 className="imp-title">CAD IMPORT &amp; ANALYSIS</h1>
        <p className="imp-lede">
          Upload your CAD/network file to generate the infrastructure digital twin.
        </p>

        {phase === 'idle' && (
          <>
            <div
              className="imp-drop"
              role="button"
              tabIndex={0}
              aria-label="Upload CAD file"
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
              onDragOver={e => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                style={{ display: 'none' }}
                onChange={e => {
                  acceptFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div className="imp-drop-icon"><UploadCloud size={24} strokeWidth={1.8} /></div>
              <b>DROP CAD FILE HERE</b>
              <small>or choose a file from your workstation</small>
              <div className="imp-exts">
                {['.DWG', '.DXF', '.DGN', '.IFC', '.SVG'].map(x => <span key={x}>{x}</span>)}
              </div>
              <span className="imp-choose"><FolderOpen size={13} /> CHOOSE FILE</span>
            </div>
            <p className="imp-hint">
              Prototype — files are processed locally in your browser; nothing is uploaded to a server.
            </p>
          </>
        )}

        {phase === 'running' && (
          <div className="imp-console" aria-live="polite">
            <div className="imp-console-head">
              <b>FILE RECEIVED</b>
              <span>{fileSize || '—'}</span>
            </div>
            <div className="imp-console-body">
              <div className="imp-stage">
                <div className="imp-stage-row">
                  <div className="imp-stage-name">
                    <span className="imp-mark active"><span className="entry-spin">◐</span></span>
                    <div>
                      Analyzing — {progress < 22 ? STAGES[0].label :
                        STAGES.slice().reverse().find(s => progress >= s.end)?.label ?? STAGES[STAGES.length - 1].label}
                      <small>{formatName}</small>
                    </div>
                  </div>
                  <span className="imp-pct">{progress}%</span>
                </div>
                <div className="imp-bar"><i style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
            <div className="imp-log">
              {logs.map((l, i) => (
                <div key={i}>{l.startsWith('✔') ? <em>{l}</em> : l}</div>
              ))}
              <div><i className="entry-blink">▍</i></div>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="imp-ready" aria-live="polite">
            <div className="imp-ready-badge"><Check size={22} strokeWidth={2.4} /></div>
            <h3>DIGITAL TWIN READY</h3>
            <p>Infrastructure successfully processed — the network is live and monitored.</p>
            <div className="imp-ready-stats">
              <span>52 NODES</span>
              <span>68 PIPES</span>
              <span>127 ASSETS</span>
              <span>GRAPH VALIDATED</span>
            </div>
            <button
              type="button"
              className="entry-btn-primary"
              onClick={() => router.push('/simulate')}
              style={{ border: 'none', cursor: 'pointer' }}
            >
              ENTER DIGITAL TWIN <span aria-hidden="true">&#9656;</span>
            </button>
          </div>
        )}
      </main>

      <EntryFooter />
    </EntryShell>
  );
}
