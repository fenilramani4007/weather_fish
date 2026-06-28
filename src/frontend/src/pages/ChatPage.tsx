import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWeather } from '../contexts/WeatherContext';
import { getWeatherEmoji } from '../utils/weatherHelpers';

// ── Types ────────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'model';
  text: string;
  ts: number;
  showChart?: boolean;
}

// ── Quick questions ───────────────────────────────────────────────────────────────
const QUICK_QUESTIONS = {
  de: [
    'Soll ich dieses Wochenende ein Picknick planen?',
    'Brauche ich heute einen Regenschirm?',
    'Analysiere das Wetter der nächsten Woche',
    'Was soll ich heute anziehen?',
    'Ist heute gut zum Radfahren?',
  ],
  en: [
    'Should I plan a picnic this weekend?',
    'Do I need an umbrella today?',
    'Analyse next week weather forecast',
    'What should I wear today?',
    'Is today good for cycling?',
  ],
};

// Keywords that trigger an inline forecast chart alongside the reply
const CHART_TRIGGERS = [
  'chart', 'graph', 'analyse', 'analysis', 'prognose', 'forecast',
  'next week', 'nächste woche', 'woche', 'week', '7 day', '7-day',
  'vorhersage', 'trend', 'verlauf', 'prediction',
];
const wantsChart = (text: string) =>
  CHART_TRIGGERS.some(k => text.toLowerCase().includes(k));

// ── Link-aware text renderer ──────────────────────────────────────────────────────
const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/\S+)/g;

  const parseLine = (line: string, key: number) => {
    const nodes: React.ReactNode[] = [];
    let last = 0;
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(line)) !== null) {
      if (m.index > last) nodes.push(line.slice(last, m.index));
      const href  = m[2] ?? m[3];
      const label = m[1] ?? m[3];
      nodes.push(
        <a key={m.index} href={href} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--gold)', textDecoration: 'underline' }}>
          {label}
        </a>
      );
      last = m.index + m[0].length;
    }
    if (last < line.length) nodes.push(line.slice(last));
    return <React.Fragment key={key}>{nodes}</React.Fragment>;
  };

  return (
    <>
      {text.split('\n').map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {parseLine(line, i)}
        </React.Fragment>
      ))}
    </>
  );
};

// ── Mini 7-day SVG bar chart (no external library) ────────────────────────────────
const MiniWeekChart: React.FC<{
  data: Record<string, { mintemp: number; maxtemp: number; overcast: string }>;
  lang: string;
}> = ({ data, lang }) => {
  const days = Object.entries(data).slice(0, 7);
  if (days.length === 0) return null;

  const W = 280, H = 100, PAD_T = 22, PAD_B = 18, PAD_S = 8;
  const drawW = W - PAD_S * 2;
  const drawH = H - PAD_T - PAD_B;
  const step  = drawW / days.length;
  const barW  = Math.floor(step * 0.55);

  const allT  = days.flatMap(([, d]) => [d.mintemp ?? 0, d.maxtemp ?? 0]);
  const minT  = Math.min(...allT) - 2;
  const maxT  = Math.max(...allT) + 2;
  const span  = maxT - minT || 1;
  const toY   = (t: number) => PAD_T + drawH * (1 - (t - minT) / span);

  const dayLabel = (date: string) =>
    new Date(date + 'T12:00:00').toLocaleDateString(
      lang === 'de' ? 'de-DE' : 'en-GB',
      { weekday: 'short' }
    );

  return (
    <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>
        {lang === 'de' ? '7-TAGE-PROGNOSE' : '7-DAY FORECAST'}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: `${W}px`, display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="wcg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c9a227" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#c9a227" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {days.map(([date, d], i) => {
          const cx = PAD_S + i * step + step / 2;
          const x  = cx - barW / 2;
          const y1 = toY(d.maxtemp ?? maxT);
          const y2 = toY(d.mintemp ?? minT);
          return (
            <g key={date}>
              <rect x={x} y={y1} width={barW} height={Math.max(y2 - y1, 3)} fill="url(#wcg)" rx="2" />
              <text x={cx} y={y1 - 4} textAnchor="middle" fontSize="8.5" fill="#c9a227" fontWeight="600">
                {d.maxtemp}°
              </text>
              <text x={cx} y={Math.min(y2 + 11, H - PAD_B - 2)} textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.4)">
                {d.mintemp}°
              </text>
              <text x={cx} y={H - 2} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)">
                {dayLabel(date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────────
const ChatPage: React.FC = () => {
  const { currentLocation }             = useLocation();
  const { language }                    = useLanguage();
  const { weatherData }                 = useWeather();
  const de = language === 'de';

  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut]   = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Voice input (Web Speech API) ─────────────────────────────────────────────
  const hasMic = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang           = de ? 'de-DE' : 'en-GB';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      send(transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  // ── Voice output (Web Speech Synthesis) ──────────────────────────────────────
  const speak = (text: string) => {
    if (!voiceOut || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u  = new SpeechSynthesisUtterance(text);
    u.lang   = de ? 'de-DE' : 'en-GB';
    u.rate   = 0.92;
    window.speechSynthesis.speak(u);
  };

  const toggleVoiceOut = () => {
    window.speechSynthesis?.cancel();
    setVoiceOut(v => !v);
  };

  // ── Send ─────────────────────────────────────────────────────────────────────
  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');

    const showChart = wantsChart(msg);
    const userMsg: Message = { role: 'user', text: msg, ts: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:  msg,
          zipcode:  currentLocation?.id ?? '',
          history:  messages.slice(-10).map(m => ({ role: m.role, text: m.text })),
          language,
        }),
      });
      const data  = await res.json();
      const reply = data.reply ?? '...';
      setMessages([...updated, { role: 'model', text: reply, ts: Date.now(), showChart }]);
      speak(reply);
    } catch {
      setMessages([...updated, {
        role: 'model',
        text: de ? 'Verbindungsfehler. Bitte später erneut versuchen.' : 'Connection error. Please try again later.',
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const cur   = weatherData?.current;
  const emoji = cur ? getWeatherEmoji(cur.overcast, cur.current_precipitation) : '';

  return (
    <div className="wf-page wf-chat-page">
      <div className="wf-chat-layout">

        {/* ── Left: context panel ── */}
        <aside className="wf-chat-context">
          <div className="wf-section">{de ? 'Wetter-Kontext' : 'Weather Context'}</div>

          {currentLocation && cur ? (
            <>
              <div className="wf-chat-ctx-card">
                <div style={{ fontSize: '36px', textAlign: 'center', margin: '8px 0' }}>{emoji}</div>
                <div className="wf-chat-ctx-city">
                  {currentLocation.name.split('–')[1]?.trim() || currentLocation.name}
                </div>
                <div className="wf-chat-ctx-temp">{cur.temperature}°C</div>
                <div className="wf-chat-ctx-rows">
                  <div><span>{de ? 'Gefühlt' : 'Feels like'}</span><span>{cur['feels like']}°C</span></div>
                  <div><span>{de ? 'Feuchte' : 'Humidity'}</span><span>{cur.humidity}%</span></div>
                  <div><span>{de ? 'Wind' : 'Wind'}</span><span>{cur['wind speed'] ?? '–'} km/h</span></div>
                  <div><span>{de ? 'Niederschlag' : 'Rain'}</span>
                    <span>{cur.current_precipitation === 'rain' ? (de ? 'Ja' : 'Yes') : (de ? 'Nein' : 'No')}</span>
                  </div>
                </div>
              </div>

              {weatherData && (() => {
                const days = Object.entries(weatherData.daily_weekone);
                if (days.length < 2) return null;
                const [, data] = days[1];
                return (
                  <div className="wf-chat-ctx-tomorrow">
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
                      {de ? 'MORGEN' : 'TOMORROW'}
                    </div>
                    <div style={{ color: 'var(--gold)', fontSize: '13px', marginTop: '4px' }}>
                      {data.mintemp}–{data.maxtemp}°C
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-sec)' }}>{data.overcast}</div>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="wf-empty" style={{ padding: '20px 0' }}>
              <span style={{ fontSize: '24px', opacity: 0.3 }}>🌍</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {de ? 'Kein Standort' : 'No location'}
              </span>
            </div>
          )}

          <div className="wf-section mt">{de ? 'Schnellfragen' : 'Quick questions'}</div>
          <div className="wf-chat-quick">
            {(de ? QUICK_QUESTIONS.de : QUICK_QUESTIONS.en).map((q, i) => (
              <button key={i} className="wf-chat-quick-btn" onClick={() => send(q)} disabled={loading}>
                {q}
              </button>
            ))}
          </div>

          {messages.length > 0 && (
            <button
              className="wf-btn-secondary"
              style={{ marginTop: '12px', width: '100%', fontSize: '10px' }}
              onClick={() => { setMessages([]); window.speechSynthesis?.cancel(); }}
            >
              {de ? '🗑 Verlauf löschen' : '🗑 Clear history'}
            </button>
          )}
        </aside>

        {/* ── Right: chat panel ── */}
        <div className="wf-chat-main">
          <div className="wf-chat-messages">
            {/* Welcome bubble */}
            <div className="wf-chat-bubble model">
              <div className="wf-chat-bubble-icon">🐟</div>
              <div className="wf-chat-bubble-text">
                {de
                  ? `Hallo! Ich bin dein WEATHER-FISH Assistent. Frag mich alles über das Wetter${currentLocation ? ` in ${currentLocation.name.split('–')[1]?.trim() || currentLocation.name}` : ''}!`
                  : `Hi! I'm your WEATHER-FISH Assistant. Ask me anything about the weather${currentLocation ? ` in ${currentLocation.name.split('–')[1]?.trim() || currentLocation.name}` : ''}!`}
              </div>
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`wf-chat-bubble ${m.role}`}>
                {m.role === 'model' && <div className="wf-chat-bubble-icon">🐟</div>}
                <div className="wf-chat-bubble-text">
                  <MessageContent text={m.text} />
                  {m.role === 'model' && m.showChart && weatherData?.daily_weekone && (
                    <MiniWeekChart data={weatherData.daily_weekone} lang={language} />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="wf-chat-bubble model">
                <div className="wf-chat-bubble-icon">🐟</div>
                <div className="wf-chat-typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── Input area ── */}
          <div className="wf-chat-input-area">

            {/* Voice controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <button
                onClick={toggleVoiceOut}
                title={de ? 'Sprachausgabe umschalten' : 'Toggle voice output'}
                style={{
                  background: voiceOut ? 'var(--gold)' : 'rgba(255,255,255,0.07)',
                  border: 'none', borderRadius: '7px', padding: '5px 10px',
                  cursor: 'pointer', fontSize: '14px',
                  color: voiceOut ? '#0a0a14' : 'rgba(255,255,255,0.45)',
                  transition: 'background 0.15s',
                }}
              >
                {voiceOut ? '🔊' : '🔇'}
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', flex: 1 }}>
                {voiceOut
                  ? (de ? 'Sprachausgabe aktiv' : 'Voice output on')
                  : (de ? 'Sprachausgabe aus' : 'Voice output off')}
              </span>
              {listening && (
                <span style={{ fontSize: '10px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#f87171', animation: 'wf-pulse 1s infinite' }} />
                  {de ? 'Höre zu…' : 'Listening…'}
                </span>
              )}
            </div>

            {/* Textarea + mic + send */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                className="wf-chat-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={de ? 'Frage zum Wetter… (Enter zum Senden)' : 'Ask about the weather… (Enter to send)'}
                rows={2}
                disabled={loading}
                style={{ flex: 1 }}
              />

              {hasMic && (
                <button
                  onClick={toggleMic}
                  disabled={loading}
                  title={de ? (listening ? 'Stoppen' : 'Spracheingabe') : (listening ? 'Stop' : 'Voice input')}
                  style={{
                    background: listening ? '#ef4444' : 'rgba(255,255,255,0.07)',
                    border: 'none', borderRadius: '8px',
                    padding: '0 13px', cursor: 'pointer',
                    color: listening ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: '16px', transition: 'background 0.15s',
                    alignSelf: 'stretch', display: 'flex', alignItems: 'center',
                  }}
                >
                  🎤
                </button>
              )}

              <button
                className="wf-chat-send"
                onClick={() => send()}
                disabled={loading || !input.trim()}
              >
                {de ? 'Senden' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
