import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const ChatWidget: React.FC = () => {
  const { currentLocation } = useLocation();
  const { language } = useLanguage();

  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  const isDE = language === 'de';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');

    const updated: Message[] = [...messages, { role: 'user', text: msg }];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          zipcode: currentLocation?.id ?? '',
          history: messages.slice(-10).map(m => ({ role: m.role, text: m.text })),
          language,
        }),
      });
      const data = await res.json();
      setMessages([...updated, { role: 'model', text: data.reply ?? '...' }]);
    } catch {
      setMessages([...updated, {
        role: 'model',
        text: isDE ? 'Verbindungsfehler.' : 'Connection error.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const welcome = isDE
    ? 'Hallo! Ich bin dein WEATHER-FISH Assistent 🐟 Frag mich alles über das Wetter!'
    : 'Hi! I\'m your WEATHER-FISH Assistant 🐟 Ask me anything about the weather!';

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        onClick={() => setOpen(p => !p)}
        title={isDE ? 'Wetter-Assistent' : 'Weather Assistant'}
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          width: '52px', height: '52px', borderRadius: '50%',
          background: open ? '#444' : 'var(--gold, #c9a227)',
          border: 'none', cursor: 'pointer', fontSize: '22px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
      >
        {open ? '✕' : '🐟'}
      </button>

      {/* ── Chat Panel ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '88px', right: '24px', zIndex: 999,
          width: '320px', height: '440px',
          background: '#12122a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '11px 16px',
            background: 'var(--gold, #c9a227)',
            color: '#000', fontWeight: 700, fontSize: '12px',
            letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            🐟 {isDE ? 'WETTER-ASSISTENT' : 'WEATHER ASSISTANT'}
            {currentLocation && (
              <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '11px', opacity: 0.75 }}>
                {currentLocation.name}
              </span>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            {/* Welcome bubble */}
            <Bubble role="model" text={welcome} />

            {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}

            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '8px 12px', fontSize: '18px', color: 'rgba(255,255,255,0.4)' }}>
                ···
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: '8px 10px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: '6px',
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={isDE ? 'Frage zum Wetter…' : 'Ask about the weather…'}
              disabled={loading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', padding: '7px 10px',
                fontSize: '12px', color: '#eee', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                background: input.trim() ? 'var(--gold, #c9a227)' : 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '8px',
                padding: '7px 12px', cursor: 'pointer',
                color: input.trim() ? '#000' : '#888',
                fontSize: '12px', fontWeight: 700, transition: 'background 0.15s',
              }}
            >
              {isDE ? 'Senden' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

const Bubble: React.FC<{ role: 'user' | 'model'; text: string }> = ({ role, text }) => (
  <div style={{
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? 'var(--gold, #c9a227)' : 'rgba(255,255,255,0.07)',
    color: role === 'user' ? '#000' : '#ddd',
    borderRadius: role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
    padding: '8px 12px', fontSize: '12px', maxWidth: '85%',
    lineHeight: '1.5', whiteSpace: 'pre-wrap',
  }}>
    {text}
  </div>
);

export default ChatWidget;
