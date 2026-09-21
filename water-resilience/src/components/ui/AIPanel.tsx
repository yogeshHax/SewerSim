'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { analyzeQuestion, generateRecommendations } from '../../lib/ai/engineer';
import { Bot, Send, Target, AlertTriangle, ChevronRight, Zap } from 'lucide-react';

interface Message {
  role: 'user' | 'ai';
  text: string;
  focusPosition?: { x: number; y: number; z: number };
  action?: string;
}

const QUICK_QUESTIONS = [
  'Where is the most vulnerable point?',
  'Show me top risk locations',
  'What happens if I block a pipe by 50%?',
  'Why is pressure increasing?',
  'Show me network status',
  'What are your recommendations?',
];

export default function AIPanel() {
  const { aiPanelOpen, toggleAIPanel, network, currentSnapshot, selectedAssetId, focusCamera, setViewMode, applyBlockage, baselineSnapshot, sidebarOpen } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (question?: string) => {
    const q = question || input.trim();
    if (!q) return;

    const userMsg: Message = { role: 'user', text: q };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Small delay for realism
    setTimeout(() => {
      const response = analyzeQuestion(q, network, currentSnapshot, selectedAssetId, baselineSnapshot);
      const aiMsg: Message = {
        role: 'ai',
        text: response.answer,
        focusPosition: response.focusPosition,
        action: response.action,
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 300);
  };

  const handleAction = (action: string, focusPos?: { x: number; y: number; z: number }) => {
    if (action?.startsWith('apply_blockage_')) {
      const parts = action.split('_');
      const pipeId = parts[2];
      const severity = parseInt(parts[3]);
      if (pipeId && severity) {
        applyBlockage(pipeId, severity);
      }
    }
    if (focusPos) {
      focusCamera(focusPos);
    }
  };

  const renderMarkdown = (raw: string) => {
    const text = escapeHtml(raw);
    // Simple markdown rendering (input is HTML-escaped above)
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e2e8f0">$1</strong>')
      .replace(/\n/g, '<br/>')
      .replace(/\|(.*)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.length === 0) return match;
        return '<div style="display:flex;gap:12px;font-size:10px;padding:2px 0;color:#94a3b8">' +
          cells.map(c => `<span style="flex:1">${c.trim()}</span>`).join('') + '</div>';
      });
  };

  if (!aiPanelOpen) return null;

  // Escape HTML before markdown-style substitutions — AI text can embed
  // network labels, so never let raw content reach innerHTML unescaped.
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return (
    <div style={{
      position: 'absolute',
      left: sidebarOpen ? 230 : 54, top: 40, bottom: 90,
      width: 360,
      background: 'rgba(15, 23, 42, 0.92)',
      border: '1px solid rgba(51, 65, 85, 0.5)',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 20,
      fontFamily: '"JetBrains Mono", "SF Mono", monospace',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(51, 65, 85, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} color="#60a5fa" />
          <div>
            <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600 }}>WATER INTELLIGENCE ENGINE</div>
            <div style={{ fontSize: 9, color: '#22c55e', letterSpacing: 0.5 }}>● ONLINE</div>
          </div>
        </div>
        <button onClick={toggleAIPanel} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          ✕
        </button>
      </div>

      {/* Anomaly Cards */}
      {currentSnapshot.systemMetrics.anomalies.length > 0 && messages.length === 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
          <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>AI DETECTED</div>
          {currentSnapshot.systemMetrics.anomalies.slice(0, 3).map(anomaly => (
            <div
              key={anomaly.id}
              onClick={() => handleAction('', anomaly.position)}
              style={{
                padding: '8px 10px', marginBottom: 4,
                background: anomaly.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' :
                  anomaly.severity === 'high' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(234, 179, 8, 0.1)',
                border: `1px solid ${
                  anomaly.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' :
                  anomaly.severity === 'high' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(234, 179, 8, 0.2)'
                }`,
                borderRadius: 4, cursor: 'pointer', fontSize: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{anomaly.title}</span>
                <span style={{ color: '#64748b', fontSize: 8 }}>{anomaly.confidence}%</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: 9 }}>{anomaly.description.slice(0, 80)}...</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <span style={{ color: '#60a5fa', fontSize: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Investigate <ChevronRight size={10} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Questions */}
      {messages.length === 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
          <div style={{ fontSize: 9, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>QUICK ANALYSIS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {QUICK_QUESTIONS.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q)}
                style={{
                  padding: '5px 8px', background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(51, 65, 85, 0.3)', borderRadius: 3,
                  color: '#94a3b8', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
            }}>
              {msg.role === 'ai' ? (
                <Bot size={12} color="#60a5fa" />
              ) : (
                <div style={{ width: 12, height: 12, borderRadius: 6, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff' }}>U</div>
              )}
              <span style={{ fontSize: 9, color: msg.role === 'ai' ? '#60a5fa' : '#94a3b8', letterSpacing: 0.5 }}>
                {msg.role === 'ai' ? 'AI ENGINEER' : 'YOU'}
              </span>
            </div>
            <div
              style={{
                fontSize: 11, color: '#cbd5e1', lineHeight: 1.5,
                padding: '8px 10px',
                background: msg.role === 'ai' ? 'rgba(30, 41, 59, 0.6)' : 'rgba(59, 130, 246, 0.1)',
                borderRadius: 4,
              }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
            />
            {msg.role === 'ai' && msg.focusPosition && (
              <button
                onClick={() => handleAction(msg.action || '', msg.focusPosition)}
                style={{
                  marginTop: 4, padding: '4px 10px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 3,
                  color: '#60a5fa', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Target size={10} />
                Focus Location
              </button>
            )}
            {msg.role === 'ai' && msg.action?.startsWith('apply_blockage') && (
              <button
                onClick={() => handleAction(msg.action!, msg.focusPosition)}
                style={{
                  marginTop: 4, padding: '4px 10px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: 3,
                  color: '#a855f7', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Zap size={10} />
                Apply Blockage
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(51, 65, 85, 0.3)',
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Ask about the network..."
          style={{
            flex: 1, padding: '7px 10px',
            background: 'rgba(30, 41, 59, 0.8)',
            border: '1px solid rgba(51, 65, 85, 0.3)',
            borderRadius: 4, color: '#e2e8f0', fontSize: 11,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={() => handleSend()}
          style={{
            padding: '7px 10px',
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: 4, color: '#60a5fa', cursor: 'pointer',
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
