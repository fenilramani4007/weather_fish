import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWeather } from '../contexts/WeatherContext';
import { getWeatherEmoji } from '../utils/weatherHelpers';

interface Message { role: 'user' | 'model'; text: string; ts: number; }

const QUICK_QUESTIONS = {
  de: [
    'Brauche ich heute einen Regenschirm?',
    'Wie wird das Wetter morgen?',
    'Was soll ich heute anziehen?',
    'Wann ist es heute am wärmsten?',
    'Ist heute gut zum Radfahren?',
  ],
  en: [
    'Do I need an umbrella today?',
    "What's the weather like tomorrow?",
    'What should I wear today?',
    'When is it warmest today?',
    'Is today good for cycling?',
  ],
};

const ChatPage: React.FC = () => {
  const { currentLocation } = useLocation();
  const { language } = useLanguage();
  const { weatherData } = useWeather();
  const de = language === 'de';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);
  const inputRef                = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', text: msg, ts: Date.now() };
    const updated = [...messages, userMsg];
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
      setMessages([...updated, { role: 'model', text: data.reply ?? '...', ts: Date.now() }]);
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

  const cur = weatherData?.current;
  const emoji = cur ? getWeatherEmoji(cur.overcast, cur.current_precipitation) : '';

  return (
    <div className="wf-page wf-chat-page">
      <div className="wf-chat-layout">
        {/* Left: context panel */}
        <aside className="wf-chat-context">
          <div className="wf-section">{de ? 'Wetter-Kontext' : 'Weather Context'}</div>

          {currentLocation && cur ? (
            <>
              <div className="wf-chat-ctx-card">
                <div style={{ fontSize: '36px', textAlign: 'center', margin: '8px 0' }}>{emoji}</div>
                <div className="wf-chat-ctx-city">{currentLocation.name.split('–')[1]?.trim() || currentLocation.name}</div>
                <div className="wf-chat-ctx-temp">{cur.temperature}°C</div>
                <div className="wf-chat-ctx-rows">
                  <div><span>{de ? 'Gefühlt' : 'Feels like'}</span><span>{cur['feels like']}°C</span></div>
                  <div><span>{de ? 'Feuchte' : 'Humidity'}</span><span>{cur.humidity}%</span></div>
                  <div><span>{de ? 'Wind' : 'Wind'}</span><span>{cur['wind speed'] ?? '–'} km/h</span></div>
                  <div><span>{de ? 'Niederschlag' : 'Rain'}</span><span>{cur.current_precipitation === 'rain' ? (de ? 'Ja' : 'Yes') : (de ? 'Nein' : 'No')}</span></div>
                </div>
              </div>

              {weatherData && (() => {
                const days = Object.entries(weatherData.daily_weekone);
                if (days.length < 2) return null;
                const [d, data] = days[1];
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
              onClick={() => setMessages([])}
            >
              {de ? '🗑 Verlauf löschen' : '🗑 Clear history'}
            </button>
          )}
        </aside>

        {/* Right: chat panel */}
        <div className="wf-chat-main">
          {/* Messages */}
          <div className="wf-chat-messages">
            {/* Welcome */}
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
                <div className="wf-chat-bubble-text">{m.text}</div>
              </div>
            ))}

            {loading && (
              <div className="wf-chat-bubble model">
                <div className="wf-chat-bubble-icon">🐟</div>
                <div className="wf-chat-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="wf-chat-input-area">
            <textarea
              ref={inputRef}
              className="wf-chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={de ? 'Frage zum Wetter… (Enter zum Senden)' : 'Ask about the weather… (Enter to send)'}
              rows={2}
              disabled={loading}
            />
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
  );
};

export default ChatPage;
