import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Mascot from '../components/Mascot';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWeather } from '../contexts/WeatherContext';
import { useAuth } from '../contexts/AuthContext';

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

type LangKey = 'de' | 'en';
type BilingualReports = Record<LangKey, Record<Presenter, string>>;

const EMPTY_REPORTS: Record<Presenter, string> = { Fisch: '', Merkel: '', Haftbefehl: '' };

const ReportsPage: React.FC = () => {
  const { savedLocations, currentLocation, triggerRefresh } = useLocation();
  const { language } = useLanguage();
  const { weatherData } = useWeather();
  const { token } = useAuth();
  const navigate = useNavigate();
  const de = language === 'de';

  const [presenter, setPresenter]     = useState<Presenter>('Fisch');
  // Separate report text for each language
  const [reports, setReports]         = useState<BilingualReports>({ de: { ...EMPTY_REPORTS }, en: { ...EMPTY_REPORTS } });
  // Which language is shown in the Reports page (independent of global UI lang)
  const [reportLang, setReportLang]   = useState<LangKey>(language as LangKey);
  const [generating, setGenerating]   = useState(false);
  const [genStatus, setGenStatus]     = useState('');
  const [autoPlay, setAutoPlay]       = useState(true);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [hobbies, setHobbies]         = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HOBBIES_KEY) ?? '[]'); } catch { return []; }
  });
  const [showHobbies, setShowHobbies] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const suggestions = buildSuggestions(weatherData, language);

  // Load reports for both languages whenever location changes
  const loadAllReports = async () => {
    const PRESENTERS: Presenter[] = ['Fisch', 'Merkel', 'Haftbefehl'];
    const [deEntries, enEntries] = await Promise.all(
      (['de', 'en'] as LangKey[]).map(lang =>
        Promise.all(
          PRESENTERS.map(p =>
            fetch(`/api/report/${p}?lang=${lang}`)
              .then(r => r.ok ? r.json() : null)
              .then(doc => [p, doc?.text ?? ''] as const)
              .catch(() => [p, ''] as const)
          )
        )
      )
    );
    setReports({
      de: Object.fromEntries(deEntries) as Record<Presenter, string>,
      en: Object.fromEntries(enEntries) as Record<Presenter, string>,
    });
  };

  useEffect(() => {
    if (currentLocation) loadAllReports();
  }, [currentLocation?.id]);

  // Sync report language when global language changes
  useEffect(() => { setReportLang(language as LangKey); }, [language]);

  const playAudio = (p: Presenter) => {
    if (!audioRef.current) return;
    audioRef.current.src = `/speech/${p}_${reportLang}.mp3?t=${Date.now()}`;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(e => { console.warn('[Audio]', e); setIsPlaying(false); });
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setIsPlaying(false);
  };

  const handleGenerate = () => {
    if (!currentLocation || generating) return;
    stopAudio();
    setGenerating(true);
    setGenStatus(de ? 'Generiert KI-Berichte (DE + EN)…' : 'Generating AI reports (DE + EN)…');

    // Only the selected/active city — not all saved locations
    const city    = currentLocation.name.split('–')[1]?.trim() || currentLocation.name;
    const zipcode = currentLocation.id;
    const activeHobbies = hobbies.length > 0 ? hobbies : ['Gaming', 'Tennis', 'Radfahren'];

    fetch('/generate-documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        cities: [city], zipcodes: [zipcode],
        languages: ['de', 'en'],   // generate both
        hobbies: activeHobbies,
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.status === 'error') {
          setGenStatus(`Fehler: ${d.message}`);
          setGenerating(false);
          return;
        }
        // Poll until a fresh report appears for the current presenter + lang
        let polls = 0;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          polls++;
          triggerRefresh();
          try {
            const res = await fetch(`/api/report/${presenter}?lang=${reportLang}`);
            const doc = await res.json();
            if (doc?.text) {
              await loadAllReports();
              clearInterval(pollRef.current!);
              setGenerating(false);
              setGenStatus(de ? '✅ Berichte aktualisiert (DE + EN)!' : '✅ Reports updated (DE + EN)!');
              if (autoPlay) playAudio(presenter);
              setTimeout(() => setGenStatus(''), 5000);
            }
          } catch { /* keep polling */ }
          if (polls > 40) {
            clearInterval(pollRef.current!);
            setGenerating(false);
            setGenStatus(de ? 'Zeitüberschreitung — bitte erneut versuchen.' : 'Timeout — please try again.');
          }
        }, 2000);
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
        {/* Language toggle — DE / EN */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
          {(['de', 'en'] as LangKey[]).map(l => (
            <button
              key={l}
              onClick={() => { stopAudio(); setReportLang(l); }}
              style={{
                padding: '4px 14px',
                fontFamily: 'var(--font-head)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                border: `1px solid ${reportLang === l ? 'var(--gold)' : 'var(--border)'}`,
                background: reportLang === l ? 'rgba(200,168,75,0.12)' : 'transparent',
                color: reportLang === l ? 'var(--gold)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {l === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center' }}>
            {currentLocation?.name.split('–')[1]?.trim() || currentLocation?.name}
          </span>
        </div>

        <div className="wf-report-text-full">
          {reports[reportLang][presenter]
            ? reports[reportLang][presenter]
            : (de ? 'Noch kein Bericht — bitte "Generieren & Abspielen" klicken.' : 'No report yet — click "Generate & Play" above.')}
        </div>

        {/* Audio controls */}
        <div className="wf-report-audio">
          <button
            className={`wf-play-full ${isPlaying ? 'stop' : ''}`}
            onClick={() => isPlaying ? stopAudio() : playAudio(presenter)}
            disabled={!reports[reportLang][presenter]}
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
