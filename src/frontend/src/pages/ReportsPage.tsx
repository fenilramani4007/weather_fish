import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Mascot from '../components/Mascot';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWeather } from '../contexts/WeatherContext';

type Presenter = 'Fisch' | 'Merkel' | 'Haftbefehl';
type MascotKey = 'mascotfish' | 'mascotmerkel' | 'mascothaftbefehl';

const PRESENTER_MAP: Record<Presenter, MascotKey> = {
  Fisch:       'mascotfish',
  Merkel:      'mascotmerkel',
  Haftbefehl:  'mascothaftbefehl',
};

const PRESENTER_DESC: Record<Presenter, { de: string; en: string }> = {
  Fisch:      { de: 'Fröhlicher Fisch-Maskottchen — charmant und witzig', en: 'Cheerful fish mascot — charming and witty' },
  Merkel:     { de: 'Sachlich & präzise — im Stil von Angela Merkel', en: 'Measured & precise — in the style of Angela Merkel' },
  Haftbefehl: { de: 'Street-smart Rapper aus Offenbach — Swagger & Stil', en: 'Street-smart rapper from Offenbach — swagger & style' },
};

const ALL_HOBBIES = ['Radfahren','Tennis','Wandern','Schwimmen','Joggen','Gaming','Lesen','Kochen','Gärtnern','Fotografie'];
const HOBBIES_KEY = 'wf_hobbies';

// Smart weather-based suggestions
function buildSuggestions(weatherData: ReturnType<typeof useWeather>['weatherData'], language: 'de' | 'en'): string[] {
  if (!weatherData) return [];
  const de = language === 'de';
  const c = weatherData.current;
  const tips: string[] = [];

  const temp = c.temperature;
  if (temp >= 28) tips.push(de ? '☀️ Sehr warm — leichte Kleidung & Sonnenschutz.' : '☀️ Very hot — light clothes & sun protection.');
  else if (temp >= 20) tips.push(de ? '🌤 Angenehm warm — T-Shirt genügt.' : '🌤 Pleasantly warm — a T-shirt is fine.');
  else if (temp >= 12) tips.push(de ? '🧥 Kühl — leichte Jacke empfehlenswert.' : '🧥 Cool — a light jacket is advisable.');
  else tips.push(de ? '🧣 Kalt — warm anziehen!' : '🧣 Cold — dress warmly!');

  const rainHours = Object.entries(weatherData.hourly)
    .filter(([, e]) => typeof e === 'object' && (e as { 'precipitation probability': number })['precipitation probability'] >= 60)
    .map(([h]) => parseInt(h)).sort((a, b) => a - b);

  if (rainHours.length > 0) {
    tips.push(de ? `☂️ Regen ab ca. ${rainHours[0]}:00 — Regenschirm mitnehmen!` : `☂️ Rain from ~${rainHours[0]}:00 — take an umbrella!`);
  } else {
    tips.push(de ? '✅ Kein Regen — kein Schirm nötig.' : '✅ No rain — no umbrella needed.');
  }

  const days = Object.entries(weatherData.daily_weekone);
  if (days.length >= 2) {
    const [, tomorrow] = days[1];
    tips.push(de ? `📅 Morgen: ${tomorrow.mintemp}–${tomorrow.maxtemp}°C, ${tomorrow.overcast}.` : `📅 Tomorrow: ${tomorrow.mintemp}–${tomorrow.maxtemp}°C, ${tomorrow.overcast}.`);
  }

  return tips;
}

const ReportsPage: React.FC = () => {
  const { savedLocations, currentLocation, triggerRefresh } = useLocation();
  const { language } = useLanguage();
  const { weatherData } = useWeather();
  const navigate = useNavigate();
  const de = language === 'de';

  const [presenter, setPresenter]   = useState<Presenter>('Fisch');
  const [reports, setReports]       = useState<Record<Presenter, string>>({ Fisch: '', Merkel: '', Haftbefehl: '' });
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus]   = useState('');
  const [autoPlay, setAutoPlay]     = useState(true);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [hobbies, setHobbies]       = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HOBBIES_KEY) ?? '[]'); } catch { return []; }
  });
  const [showHobbies, setShowHobbies] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const suggestions = buildSuggestions(weatherData, language);

  // Load all 3 presenter reports on mount / refresh
  useEffect(() => {
    if (!savedLocations.length) return;
    const load = async () => {
      const entries = await Promise.all(
        (['Fisch', 'Merkel', 'Haftbefehl'] as Presenter[]).map(p =>
          fetch(`/api/report/${p}`)
            .then(r => r.ok ? r.json() : null)
            .then(doc => [p, doc?.text ?? ''] as const)
            .catch(() => [p, ''] as const)
        )
      );
      setReports(Object.fromEntries(entries) as Record<Presenter, string>);
    };
    load();
  }, [savedLocations.length, language]);

  const playAudio = (p: Presenter) => {
    if (!audioRef.current) return;
    audioRef.current.src = `/speech/${p}.mp3?t=${Date.now()}`;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(e => { console.warn('[Audio]', e); setIsPlaying(false); });
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setIsPlaying(false);
  };

  const handleGenerate = () => {
    if (!savedLocations.length || generating) return;
    stopAudio();
    setGenerating(true);
    setGenStatus(de ? 'Generiert KI-Berichte…' : 'Generating AI reports…');

    const cities   = savedLocations.map(l => l.name.split('–')[1]?.trim() || l.name);
    const zipcodes = savedLocations.map(l => l.id);
    const activeHobbies = hobbies.length > 0 ? hobbies : ['Gaming', 'Tennis', 'Radfahren'];

    fetch('/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities, zipcodes, language, hobbies: activeHobbies }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.status === 'error') {
          setGenStatus(`Fehler: ${d.message}`);
          setGenerating(false);
          return;
        }
        // Poll every 4s until new report text appears
        let polls = 0;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          polls++;
          triggerRefresh();
          try {
            const res = await fetch(`/api/report/${presenter}`);
            const doc = await res.json();
            if (doc?.text) {
              setReports(prev => ({ ...prev, [presenter]: doc.text }));
              // Also reload all
              const all = await Promise.all(
                (['Fisch','Merkel','Haftbefehl'] as Presenter[]).map(p =>
                  fetch(`/api/report/${p}`).then(r => r.json()).then(d => [p, d?.text ?? ''] as const).catch(() => [p, ''] as const)
                )
              );
              setReports(Object.fromEntries(all) as Record<Presenter, string>);
              clearInterval(pollRef.current!);
              setGenerating(false);
              setGenStatus(de ? '✅ Berichte aktualisiert!' : '✅ Reports updated!');
              if (autoPlay) playAudio(presenter);
              setTimeout(() => setGenStatus(''), 4000);
            }
          } catch { /* keep polling */ }
          if (polls > 30) {
            clearInterval(pollRef.current!);
            setGenerating(false);
            setGenStatus(de ? 'Zeitüberschreitung — bitte erneut versuchen.' : 'Timeout — please try again.');
          }
        }, 4000);
      })
      .catch(() => {
        setGenerating(false);
        setGenStatus(de ? 'Verbindungsfehler.' : 'Connection error.');
      });
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const hasLocs = savedLocations.length > 0;

  if (!hasLocs) {
    return (
      <div className="wf-page">
        <div className="wf-page-header">
          <h1 className="wf-page-title">{de ? 'KI-Wetterberichte' : 'AI Weather Reports'}</h1>
        </div>
        <div className="wf-empty" style={{ marginTop: '60px' }}>
          <div className="wf-empty-icon" style={{ opacity: 1, fontSize: '48px' }}>📻</div>
          <div className="wf-empty-label">{de ? 'Noch keine Standorte' : 'No locations yet'}</div>
          <button className="wf-btn-primary" style={{ marginTop: '16px' }} onClick={() => navigate('/settings')}>
            {de ? '⚙️ Standorte hinzufügen' : '⚙️ Add Locations'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <div>
          <h1 className="wf-page-title">{de ? 'KI-Wetterberichte' : 'AI Weather Reports'}</h1>
          <p className="wf-page-sub">
            {currentLocation ? currentLocation.name : (de ? 'Kein Standort' : 'No location')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-sec)', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoPlay} onChange={e => setAutoPlay(e.target.checked)}
              style={{ accentColor: 'var(--gold)' }} />
            {de ? 'Auto-Wiedergabe' : 'Auto-play'}
          </label>
          <button
            className="wf-btn-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={{ minWidth: '160px' }}
          >
            {generating ? `⏳ ${genStatus}` : (de ? '⚡ Generieren & Abspielen' : '⚡ Generate & Play')}
          </button>
        </div>
      </div>

      {genStatus && !generating && (
        <div style={{ padding: '10px 14px', background: genStatus.startsWith('✅') ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.1)',
          border: `1px solid ${genStatus.startsWith('✅') ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.3)'}`,
          color: genStatus.startsWith('✅') ? '#4ade80' : 'var(--red-bright)',
          fontSize: '11px', marginBottom: '12px' }}>
          {genStatus}
        </div>
      )}

      {/* Presenter selector */}
      <div className="wf-report-presenter-bar">
        {(['Fisch', 'Merkel', 'Haftbefehl'] as Presenter[]).map(p => (
          <button
            key={p}
            className={`wf-report-presenter-btn ${presenter === p ? 'active' : ''}`}
            onClick={() => { stopAudio(); setPresenter(p); }}
          >
            <div className="wf-report-presenter-mascot">
              <Mascot activeMascot={PRESENTER_MAP[p]} />
            </div>
            <div className="wf-report-presenter-name">{p}</div>
            <div className="wf-report-presenter-desc">
              {de ? PRESENTER_DESC[p].de : PRESENTER_DESC[p].en}
            </div>
          </button>
        ))}
      </div>

      {/* Report content */}
      <div className="wf-report-content">
        <div className="wf-report-text-full">
          {reports[presenter]
            ? reports[presenter]
            : (de ? 'Noch kein Bericht — bitte "Generieren & Abspielen" klicken.' : 'No report yet — click "Generate & Play" above.')}
        </div>

        {/* Audio controls */}
        <div className="wf-report-audio">
          <button
            className={`wf-play-full ${isPlaying ? 'stop' : ''}`}
            onClick={() => isPlaying ? stopAudio() : playAudio(presenter)}
            disabled={!reports[presenter]}
          >
            {isPlaying ? (de ? '⏹ STOPP' : '⏹ STOP') : (de ? '▶ VORLESEN' : '▶ READ ALOUD')}
          </button>
          {isPlaying && (
            <div className="wf-audio-wave">
              {[...Array(5)].map((_, i) => <div key={i} className="wf-audio-bar" style={{ animationDelay: `${i * 0.1}s` }} />)}
            </div>
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="wf-suggestions">
            <div className="wf-suggestions-title">
              {de ? 'EMPFEHLUNGEN & TIPPS' : 'RECOMMENDATIONS & TIPS'}
            </div>
            <div className="wf-suggestions-grid">
              {suggestions.map((s, i) => (
                <div key={i} className="wf-suggestion-item">{s}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hobbies configuration */}
      <div className="wf-report-hobbies">
        <div
          className="wf-section"
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => setShowHobbies(p => !p)}
        >
          <span>{de ? 'Interessen für Personalisierung' : 'Interests for personalisation'}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {hobbies.length > 0 ? `${hobbies.length} ${de ? 'gewählt' : 'selected'}` : (de ? 'Standard' : 'Default')} {showHobbies ? '▲' : '▼'}
          </span>
        </div>
        {showHobbies && (
          <div className="wf-hobby-grid" style={{ marginTop: '8px' }}>
            {ALL_HOBBIES.map(h => (
              <button
                key={h}
                className={`wf-hobby-chip ${hobbies.includes(h) ? 'on' : ''}`}
                onClick={() => {
                  const next = hobbies.includes(h) ? hobbies.filter(x => x !== h) : [...hobbies, h];
                  setHobbies(next);
                  localStorage.setItem(HOBBIES_KEY, JSON.stringify(next));
                }}
              >{h}</button>
            ))}
            {hobbies.length > 0 && (
              <button className="wf-hobby-chip clear" onClick={() => { setHobbies([]); localStorage.setItem(HOBBIES_KEY, '[]'); }}>
                {de ? 'Alle löschen' : 'Clear all'}
              </button>
            )}
          </div>
        )}
      </div>

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} hidden />
    </div>
  );
};

export default ReportsPage;
