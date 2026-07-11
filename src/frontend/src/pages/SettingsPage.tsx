import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface PostalCodeEntry { plz: string; city: string; }
interface CityResult { name: string; country: string; state: string; lat: number; lon: number; id: string; }

const ALL_HOBBIES = ['Radfahren','Tennis','Wandern','Schwimmen','Joggen','Gaming','Lesen','Kochen','Gärtnern','Fotografie'];
const HOBBIES_KEY = 'wf_hobbies';

const SettingsPage: React.FC = () => {
  const { savedLocations, currentLocation, setCurrentLocation, addLocation, removeLocation } = useLocation();
  const { language, setLanguage } = useLanguage();
  const { user, updateProfile } = useAuth();
  const de = language === 'de';

  const [postalCodes, setPostalCodes] = useState<PostalCodeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [plzResults, setPlzResults] = useState<PostalCodeEntry[]>([]);
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [generating, setGenerating]   = useState(false);
  const [genStatus, setGenStatus]     = useState('');
  const [schedInfo, setSchedInfo]     = useState<{ next_run: string; last_status: string; last_run?: string } | null>(null);
  const [schedRunning, setSchedRunning] = useState(false);
  const [schedMsg, setSchedMsg]         = useState('');
  const triggerTimeRef                  = React.useRef<string | null>(null);
  const [hobbies, setHobbies] = useState<string[]>(() => {
    if (user?.hobbies?.length) return user.hobbies;
    try { return JSON.parse(localStorage.getItem(HOBBIES_KEY) ?? '[]'); } catch { return []; }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/postal_codes/postal_codes.json').then(r => r.json()).then(setPostalCodes).catch(console.error);
    fetch('/api/schedule/status').then(r => r.json()).then(setSchedInfo).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.hobbies) setHobbies(user.hobbies);
  }, [user?.hobbies]);

  useEffect(() => {
    if (!user) localStorage.setItem(HOBBIES_KEY, JSON.stringify(hobbies));
  }, [hobbies, user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    setSearchError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setPlzResults([]);
      setCityResults([]);
      setShowDropdown(false);
      return;
    }

    const q = val.trim().toLowerCase();

    // Pure digits → German PLZ lookup (local, instant)
    if (/^\d+$/.test(q)) {
      setCityResults([]);
      const results = postalCodes.filter(e => e.plz.startsWith(q)).slice(0, 8);
      setPlzResults(results);
      setShowDropdown(results.length > 0);
      return;
    }

    // City name → worldwide search via backend geocoding
    setPlzResults([]);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res  = await fetch(`/api/geocode?q=${encodeURIComponent(val.trim())}`);
        const data: CityResult[] = await res.json();
        setCityResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setCityResults([]);
        setShowDropdown(false);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const handleAdd = (entry: PostalCodeEntry) => {
    setSearchQuery('');
    setPlzResults([]);
    setShowDropdown(false);
    setSearchError('');
    if (savedLocations.length >= 4) { setSearchError(de ? 'Maximal 4 Standorte.' : 'Maximum 4 locations.'); return; }
    if (savedLocations.some(l => l.id === entry.plz)) {
      setSearchError(de ? `${entry.city} bereits hinzugefügt.` : `${entry.city} already added.`); return;
    }

    const loc = { id: entry.plz, name: `${entry.plz} – ${entry.city}`, lat: 0, lon: 0 };
    addLocation(loc);
    if (!currentLocation) setCurrentLocation(loc);

    // Trigger generation for new location
    setGenerating(true);
    setGenStatus(de ? 'Generiert Wetterdaten…' : 'Generating weather data…');
    fetch('/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities: [entry.city], zipcodes: [entry.plz], language, hobbies }),
    })
      .then(r => r.json())
      .then(d => {
        setGenerating(false);
        setGenStatus(d.status === 'error' ? `Fehler: ${d.message}` : (de ? '✅ Daten geladen' : '✅ Data loaded'));
        setTimeout(() => setGenStatus(''), 4000);
      })
      .catch(() => { setGenerating(false); setGenStatus(de ? 'Verbindungsfehler' : 'Connection error'); });
  };

  const handleAddCity = (result: CityResult) => {
    setSearchQuery('');
    setCityResults([]);
    setShowDropdown(false);
    setSearchError('');
    if (savedLocations.length >= 4) { setSearchError(de ? 'Maximal 4 Standorte.' : 'Maximum 4 locations.'); return; }
    if (savedLocations.some(l => l.id === result.id)) {
      setSearchError(de ? `${result.name} bereits hinzugefügt.` : `${result.name} already added.`); return;
    }

    const displayName = result.state
      ? `${result.name}, ${result.state}, ${result.country}`
      : `${result.name}, ${result.country}`;
    const loc = { id: result.id, name: displayName, lat: result.lat, lon: result.lon };
    addLocation(loc);
    if (!currentLocation) setCurrentLocation(loc);

    setGenerating(true);
    setGenStatus(de ? 'Generiert Wetterdaten…' : 'Generating weather data…');
    fetch('/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities: [result.name], zipcodes: [result.id], language, hobbies }),
    })
      .then(r => r.json())
      .then(d => {
        setGenerating(false);
        setGenStatus(d.status === 'error' ? `Fehler: ${d.message}` : (de ? '✅ Daten geladen' : '✅ Data loaded'));
        setTimeout(() => setGenStatus(''), 4000);
      })
      .catch(() => { setGenerating(false); setGenStatus(de ? 'Verbindungsfehler' : 'Connection error'); });
  };

  const handleRunNow = async () => {
    if (schedRunning) return;
    setSchedRunning(true);
    setSchedMsg(de ? '⏳ Generierung läuft…' : '⏳ Running generation…');
    triggerTimeRef.current = new Date().toISOString();

    try {
      await fetch('/api/schedule/run', { method: 'POST' });
    } catch {
      setSchedRunning(false);
      setSchedMsg(de ? '❌ Verbindungsfehler' : '❌ Connection error');
      return;
    }

    // Poll until last_run timestamp changes (generation completed)
    let polls = 0;
    const poll = setInterval(async () => {
      polls++;
      try {
        const res  = await fetch('/api/schedule/status');
        const data = await res.json();
        setSchedInfo(data);

        const newRun = data.last_run ?? '';
        const triggered = triggerTimeRef.current ?? '';
        const isNewer = newRun > triggered;        // ISO string compare

        if (isNewer && data.last_status) {
          clearInterval(poll);
          setSchedRunning(false);
          setSchedMsg(data.last_status.startsWith('ok')
            ? `✅ ${data.last_status}`
            : `❌ ${data.last_status}`);
          setTimeout(() => setSchedMsg(''), 6000);
        }
      } catch {
        setSchedInfo(null);
      }

      if (polls > 60) {          // 3 min timeout
        clearInterval(poll);
        setSchedRunning(false);
        setSchedMsg(de ? '⏱ Zeitüberschreitung' : '⏱ Timed out');
      }
    }, 3000);
  };

  const handleRemove = (id: string) => {
    removeLocation(id);
  };

  const handleRefreshAll = () => {
    if (!savedLocations.length || generating) return;
    setGenerating(true);
    setGenStatus(de ? 'Generiert alle Standorte…' : 'Generating all locations…');
    const cities   = savedLocations.map(l =>
      // Old German format: "90403 – Nürnberg" → "Nürnberg"
      l.name.includes(' – ') ? l.name.split(' – ')[1].trim() :
      // New international format: "Rajkot, Gujarat, IN" → "Rajkot"
      l.name.split(',')[0].trim()
    );
    const zipcodes = savedLocations.map(l => l.id);
    fetch('/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities, zipcodes, language, hobbies }),
    })
      .then(r => r.json())
      .then(d => {
        setGenerating(false);
        setGenStatus(d.status === 'error' ? `Fehler: ${d.message}` : (de ? '✅ Alle aktualisiert' : '✅ All updated'));
        setTimeout(() => setGenStatus(''), 4000);
      })
      .catch(() => { setGenerating(false); setGenStatus(de ? 'Verbindungsfehler' : 'Connection error'); });
  };

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <h1 className="wf-page-title">{de ? 'Einstellungen' : 'Settings'}</h1>
      </div>

      <div className="wf-settings-grid">
        {/* ── Locations ── */}
        <section className="wf-settings-section">
          <div className="wf-section">{de ? 'Standorte verwalten' : 'Manage Locations'}</div>

          <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '12px' }}>
            <div className="wf-form-row" style={{ position: 'relative' }}>
              <input
                className="wf-input" style={{ flex: 1, paddingRight: isSearching ? '28px' : undefined }}
                placeholder={de ? 'PLZ oder Stadtname (weltweit)…' : 'ZIP or city name (worldwide)…'}
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => (plzResults.length > 0 || cityResults.length > 0) && setShowDropdown(true)}
                disabled={generating || savedLocations.length >= 4}
              />
              {isSearching && (
                <span style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '12px', color: 'var(--text-muted)',
                }}>⏳</span>
              )}
            </div>
            {showDropdown && (
              <div className="wf-dropdown">
                {plzResults.map(e => (
                  <div key={e.plz} className="wf-dropdown-item" onClick={() => handleAdd(e)}>
                    <span>{e.city}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{e.plz}</span>
                  </div>
                ))}
                {cityResults.map(r => (
                  <div key={r.id} className="wf-dropdown-item" onClick={() => handleAddCity(r)}>
                    <span>{r.name}{r.state ? `, ${r.state}` : ''}</span>
                    <span style={{ color: 'var(--gold, #d4b45a)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em' }}>{r.country}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {searchError && <div style={{ fontSize: '11px', color: 'var(--red-de)', marginBottom: '8px' }}>{searchError}</div>}
          {genStatus  && <div style={{ fontSize: '11px', color: genStatus.startsWith('✅') ? '#4ade80' : 'var(--gold)', marginBottom: '8px' }}>{genStatus}</div>}

          {savedLocations.length === 0 ? (
            <div className="wf-empty" style={{ padding: '24px 0' }}>
              <span style={{ opacity: 0.3 }}>📍</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {de ? 'Noch keine Standorte — Stadt oder PLZ eingeben' : 'No locations yet — enter a city or ZIP code'}
              </span>
            </div>
          ) : (
            <div className="wf-settings-locations">
              {savedLocations.map(loc => {
                const isActive = currentLocation?.id === loc.id;
                return (
                  <div key={loc.id} className={`wf-settings-loc ${isActive ? 'active' : ''}`}>
                    <div className="wf-settings-loc-dot" />
                    <div className="wf-settings-loc-name" onClick={() => setCurrentLocation(loc)}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: isActive ? 'var(--gold)' : 'var(--text)' }}>
                        {loc.name}
                      </div>
                      {isActive && <div style={{ fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.1em' }}>
                        {de ? 'AKTIV' : 'ACTIVE'}
                      </div>}
                    </div>
                    <button className="wf-btn-x" onClick={() => handleRemove(loc.id)}>×</button>
                  </div>
                );
              })}
            </div>
          )}

          {savedLocations.length > 0 && (
            <button className="wf-btn-refresh" onClick={handleRefreshAll} disabled={generating} style={{ marginTop: '12px' }}>
              {generating ? `⏳ ${genStatus}` : (de ? '↻ Alle Standorte aktualisieren' : '↻ Refresh all locations')}
            </button>
          )}
        </section>

        {/* ── Language ── */}
        <section className="wf-settings-section">
          <div className="wf-section">{de ? 'Sprache' : 'Language'}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['de', 'en'] as const).map(lang => (
              <button
                key={lang}
                className={`wf-hobby-chip ${language === lang ? 'on' : ''}`}
                style={{ flex: 1, padding: '10px', fontSize: '13px' }}
                onClick={() => setLanguage(lang)}
              >
                {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {de ? 'Wechselt Sprache für Berichte, Chat und Benutzeroberfläche.' : 'Changes language for reports, chat, and UI.'}
          </p>
        </section>

        {/* ── Hobbies ── */}
        <section className="wf-settings-section">
          <div className="wf-section">{de ? 'Interessen (für KI-Personalisierung)' : 'Interests (for AI personalisation)'}</div>
          <div className="wf-hobby-grid">
            {ALL_HOBBIES.map(h => (
              <button
                key={h}
                className={`wf-hobby-chip ${hobbies.includes(h) ? 'on' : ''}`}
                onClick={() => {
                  const next = hobbies.includes(h) ? hobbies.filter(x => x !== h) : [...hobbies, h];
                  setHobbies(next);
                  if (user) updateProfile({ hobbies: next }).catch(() => {});
                }}
              >{h}</button>
            ))}
            {hobbies.length > 0 && (
              <button className="wf-hobby-chip clear" onClick={() => {
                setHobbies([]);
                if (user) updateProfile({ hobbies: [] }).catch(() => {});
              }}>
                {de ? 'Alle löschen' : 'Clear all'}
              </button>
            )}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {de ? `${hobbies.length > 0 ? hobbies.join(', ') : 'Standard: Gaming, Tennis, Radfahren'} werden in KI-Berichte eingebettet.` :
              `${hobbies.length > 0 ? hobbies.join(', ') : 'Default: Gaming, Tennis, Cycling'} are woven into AI reports.`}
          </p>
        </section>

        {/* ── Scheduler ── */}
        <section className="wf-settings-section">
          <div className="wf-section">{de ? 'Auto-Generierung' : 'Auto-generation'}</div>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '14px', fontSize: '11px', lineHeight: '2' }}>
            <div style={{ color: 'var(--text-sec)' }}>
              {de ? 'Status' : 'Status'}: <span style={{ color: '#4ade80' }}>● {de ? 'Aktiv' : 'Active'}</span>
            </div>
            {schedInfo?.next_run && (
              <div style={{ color: 'var(--text-sec)' }}>
                {de ? 'Nächste Ausführung' : 'Next run'}:{' '}
                <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>
                  {new Date(schedInfo.next_run).toLocaleTimeString(de ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
            {schedInfo?.last_status && (
              <div style={{ color: 'var(--text-sec)' }}>
                {de ? 'Letzter Status' : 'Last status'}: <span style={{ color: 'var(--text)' }}>{schedInfo.last_status}</span>
              </div>
            )}
          </div>
          <button
            className="wf-btn-secondary"
            style={{ marginTop: '8px', width: '100%', opacity: schedRunning ? 0.7 : 1 }}
            onClick={handleRunNow}
            disabled={schedRunning}
          >
            {schedRunning
              ? (de ? '⏳ Läuft… bitte warten' : '⏳ Running… please wait')
              : (de ? '▶ Jetzt ausführen' : '▶ Run now')}
          </button>
          {schedMsg && (
            <div style={{
              marginTop: '8px', padding: '8px 12px', fontSize: '11px',
              background: schedMsg.startsWith('✅') ? 'rgba(74,222,128,0.08)' : schedMsg.startsWith('❌') ? 'rgba(185,28,28,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${schedMsg.startsWith('✅') ? 'rgba(74,222,128,0.3)' : schedMsg.startsWith('❌') ? 'rgba(185,28,28,0.4)' : 'var(--border)'}`,
              color: schedMsg.startsWith('✅') ? '#4ade80' : schedMsg.startsWith('❌') ? 'var(--red-bright)' : 'var(--gold)',
              fontFamily: 'var(--font-mono)',
            }}>
              {schedMsg}
            </div>
          )}
        </section>

        {/* ── System info ── */}
        <section className="wf-settings-section">
          <div className="wf-section">{de ? 'System' : 'System'}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', lineHeight: '2.2' }}>
            <div>API · OpenWeatherMap 3.0</div>
            <div>KI &nbsp;· Google Gemini 2.0 Flash</div>
            <div>TTS · Microsoft Edge Neural</div>
            <div>DB &nbsp;· MongoDB Atlas M0</div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              v2.0 · OTH Amberg-Weiden · PMAE 2025/26
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
