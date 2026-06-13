import React, { useState, useEffect, useRef } from 'react';
import Mascot from './Mascot';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWeather } from '../contexts/WeatherContext';

type MascotKey = 'mascotfish' | 'mascotmerkel' | 'mascothaftbefehl';

const MASCOT_LABELS: Record<MascotKey, string> = {
  mascotfish:       'Fisch',
  mascotmerkel:     'Merkel',
  mascothaftbefehl: 'Haftbefehl',
};

// ── Smart suggestions derived from live weather data ──────────────────────────
function buildSuggestions(
  weatherData: ReturnType<typeof useWeather>['weatherData'],
  language: 'de' | 'en',
): string[] {
  if (!weatherData) return [];
  const de = language === 'de';
  const c = weatherData.current;
  const suggestions: string[] = [];

  // Temperature → clothing tip
  const temp = c.temperature;
  if (temp >= 28) {
    suggestions.push(de ? '☀️ Sehr warm — leichte Kleidung, Sonnenschutz empfohlen.' : '☀️ Very warm — wear light clothes, apply sun protection.');
  } else if (temp >= 20) {
    suggestions.push(de ? '🌤 Angenehm warm — T-Shirt und leichte Hose genügen.' : '🌤 Pleasantly warm — T-shirt and light trousers are fine.');
  } else if (temp >= 12) {
    suggestions.push(de ? '🧥 Kühl — eine leichte Jacke ist ratsam.' : '🧥 Cool — a light jacket is advisable.');
  } else {
    suggestions.push(de ? '🧣 Kalt — warme Kleidung und Schal empfohlen.' : '🧣 Cold — warm clothes and scarf recommended.');
  }

  // Rain check from hourly
  const hourly = weatherData.hourly;
  const rainHours = Object.entries(hourly)
    .filter(([, e]) => typeof e === 'object' && (e as { 'precipitation probability': number })['precipitation probability'] >= 60)
    .map(([h]) => parseInt(h))
    .sort((a, b) => a - b);

  if (rainHours.length > 0) {
    const first = rainHours[0];
    suggestions.push(
      de
        ? `☂️ Regen wahrscheinlich ab ca. ${first}:00 Uhr — Regenschirm mitnehmen!`
        : `☂️ Rain likely from around ${first}:00 — bring an umbrella!`
    );
  } else {
    suggestions.push(de ? '✅ Kein Regen erwartet — kein Schirm nötig.' : '✅ No rain expected — no umbrella needed.');
  }

  // Wind advisory
  const wind = c['wind speed'];
  if (wind !== undefined && wind >= 50) {
    suggestions.push(de ? `💨 Starker Wind (${wind} km/h) — Vorsicht im Freien.` : `💨 Strong wind (${wind} km/h) — be careful outdoors.`);
  }

  // UV / outdoor tip for sunny weather
  if (c.overcast === 'clear' && temp >= 20) {
    suggestions.push(de ? '🌅 Ideales Wetter für Outdoor-Aktivitäten — früh raus gehen!' : '🌅 Ideal weather for outdoor activities — head out early!');
  }

  // Tomorrow preview
  const weekone = weatherData.daily_weekone;
  const days = Object.entries(weekone);
  if (days.length >= 2) {
    const [, tomorrow] = days[1];
    if (tomorrow.mintemp !== undefined && tomorrow.maxtemp !== undefined) {
      suggestions.push(
        de
          ? `📅 Morgen: ${tomorrow.mintemp}–${tomorrow.maxtemp}°C, ${tomorrow.overcast}.`
          : `📅 Tomorrow: ${tomorrow.mintemp}–${tomorrow.maxtemp}°C, ${tomorrow.overcast}.`
      );
    }
  }

  return suggestions;
}

const TextReport: React.FC = () => {
  const { savedLocations, refreshTick } = useLocation();
  const { language } = useLanguage();
  const { weatherData } = useWeather();
  const de = language === 'de';

  const [activeMascot, setActiveMascot] = useState<MascotKey>('mascotfish');
  const [reportText, setReportText]     = useState<string>('');
  const [isPlaying, setIsPlaying]       = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const suggestions = buildSuggestions(weatherData, language);

  // Fetch text report when mascot, language or data changes
  useEffect(() => {
    if (!savedLocations.length) { setReportText(''); return; }
    const presenter = MASCOT_LABELS[activeMascot];
    fetch(`/api/report/${presenter}`)
      .then(r => {
        if (!r.ok) throw new Error('not found');
        return r.json();
      })
      .then((doc: { text: string }) => setReportText(doc.text))
      .catch(() =>
        setReportText(
          de
            ? 'Bericht noch nicht verfügbar. Bitte Standort generieren.'
            : 'Report not yet available. Please generate a location first.'
        )
      );
  }, [activeMascot, savedLocations.length, refreshTick, language]);

  // Stop audio when all locations removed
  useEffect(() => {
    if (!savedLocations.length && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsPlaying(false);
    }
  }, [savedLocations.length]);

  const handlePlay = () => {
    if (!savedLocations.length || !audioRef.current) return;
    if (!audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    const name = MASCOT_LABELS[activeMascot];
    audioRef.current.src = `/speech/${name}.mp3`;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const hasLocs = savedLocations.length > 0;

  return (
    <>
      <div className="wf-card-title">
        {de ? 'Wetterbericht' : 'Weather Report'}
        <span>{MASCOT_LABELS[activeMascot]}</span>
      </div>

      <div className="wf-mascot-bar">
        {(Object.keys(MASCOT_LABELS) as MascotKey[]).map(k => (
          <button
            key={k}
            className={`wf-mascot-btn ${activeMascot === k ? 'on' : ''}`}
            onClick={() => setActiveMascot(k)}
          >
            {MASCOT_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="wf-report-body">
        <div className="wf-mascot-wrap">
          <div className="wf-mascot-inner">
            <Mascot activeMascot={activeMascot} />
          </div>
        </div>
        <div className="wf-report-text">
          {hasLocs
            ? (reportText || (de ? 'Wird geladen…' : 'Loading…'))
            : (de ? 'Standort hinzufügen, um einen Bericht zu erhalten.' : 'Add a location to get a report.')}
        </div>
      </div>

      {/* Smart suggestions panel */}
      {hasLocs && suggestions.length > 0 && (
        <div style={{
          margin: '8px 0',
          padding: '10px 14px',
          background: 'rgba(201,162,39,0.08)',
          borderLeft: '3px solid var(--gold, #c9a227)',
          borderRadius: '0 6px 6px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.08em', color: 'var(--gold, #c9a227)', fontWeight: 700, marginBottom: '3px' }}>
            {de ? 'TIPPS & EMPFEHLUNGEN' : 'TIPS & SUGGESTIONS'}
          </div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ fontSize: '11px', color: 'var(--text-main, #ddd)', lineHeight: '1.4' }}>
              {s}
            </div>
          ))}
        </div>
      )}

      <div className="wf-report-footer">
        <button
          className={`wf-play ${isPlaying ? 'stop' : ''}`}
          onClick={handlePlay}
          disabled={!hasLocs}
        >
          {isPlaying
            ? (de ? '⏹ STOPP' : '⏹ STOP')
            : (de ? '▶ VORLESEN' : '▶ READ ALOUD')}
        </button>
      </div>

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} hidden />
    </>
  );
};

export default TextReport;
