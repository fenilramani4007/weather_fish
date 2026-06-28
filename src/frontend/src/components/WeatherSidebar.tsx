import { useState, useEffect, useRef } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

interface PostalCodeEntry {
  plz: string;
  city: string;
}

const ALL_HOBBIES = [
  'Radfahren', 'Tennis', 'Wandern', 'Schwimmen', 'Joggen',
  'Gaming', 'Lesen', 'Kochen', 'Gärtnern', 'Fotografie',
];
const HOBBIES_KEY   = 'wf_hobbies';
const POLL_INTERVAL = 5000;

export default function WeatherSidebar() {
  const {
    currentLocation,
    savedLocations,
    setCurrentLocation,
    addLocation,
    removeLocation,
    triggerRefresh,
  } = useLocation();
  const { language, setLanguage } = useLanguage();
  const { user, updateProfile } = useAuth();

  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<PostalCodeEntry[]>([]);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [searchError, setSearchError]     = useState('');
  const [postalCodes, setPostalCodes]     = useState<PostalCodeEntry[]>([]);
  const [refreshing, setRefreshing]       = useState(false);
  const [status, setStatus]               = useState('');
  const [hobbies, setHobbies]             = useState<string[]>(() => {
    if (user?.hobbies?.length) return user.hobbies;
    try { return JSON.parse(localStorage.getItem(HOBBIES_KEY) ?? '[]'); }
    catch { return []; }
  });
  const [showHobbies, setShowHobbies] = useState(false);

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/postal_codes/postal_codes.json')
      .then(r => r.json())
      .then(setPostalCodes)
      .catch(console.error);
  }, []);

  // Sync hobbies from profile whenever the user logs in or their profile changes
  useEffect(() => {
    if (user?.hobbies) setHobbies(user.hobbies);
  }, [user?.id]);

  // Only persist to localStorage for guest (unauthenticated) users
  useEffect(() => {
    if (!user) localStorage.setItem(HOBBIES_KEY, JSON.stringify(hobbies));
  }, [hobbies, user]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchError('');
    if (value.trim().length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const q = value.trim().toLowerCase();
    const isDigits = /^\d+$/.test(q);
    const results = postalCodes
      .filter(e => isDigits ? e.plz.startsWith(q) : e.city.toLowerCase().includes(q))
      .slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  };

  const toggleHobby = (h: string) => {
    const next = hobbies.includes(h) ? hobbies.filter(x => x !== h) : [...hobbies, h];
    setHobbies(next);
    if (user) updateProfile({ hobbies: next }).catch(() => {});
  };

  const activeHobbies = hobbies.length > 0 ? hobbies : ['gaming', 'tennis', 'fahrrad fahren'];

  const _startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => triggerRefresh(), POLL_INTERVAL);
  };

  const _runGeneration = (cities: string[], zipcodes: string[]) => {
    fetch('/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities, zipcodes, language, hobbies: activeHobbies }),
    })
      .then(r => r.json())
      .then(d => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setRefreshing(false);
        setStatus(d.status === 'error' ? `Fehler: ${d.message}` : '');
        triggerRefresh();
      })
      .catch(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setRefreshing(false);
        setStatus('Verbindungsfehler.');
      });
  };

  const handleSelect = (entry: PostalCodeEntry) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setSearchError('');
    if (savedLocations.length >= 4) { setSearchError('Maximal 4 Standorte.'); return; }
    if (savedLocations.some(l => l.id === entry.plz)) {
      setSearchError(`${entry.city} bereits hinzugefügt.`); return;
    }
    addLocation({ id: entry.plz, name: `${entry.plz} – ${entry.city}`, lat: 0, lon: 0 });
    setRefreshing(true); setStatus('Generiert…');
    _startPolling();
    _runGeneration([entry.city], [entry.plz]);
  };

  const handleRefreshAll = () => {
    if (!savedLocations.length || refreshing) return;
    setRefreshing(true); setStatus('Generiert…');
    _startPolling();
    _runGeneration(
      savedLocations.map(l => l.name.slice(l.id.length + 3)),
      savedLocations.map(l => l.id),
    );
  };

  return (
    <>
      {/* ── Locations ── */}
      <div className="wf-section" style={{ marginTop: 0 }}>Standorte</div>

      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <div className="wf-form-row">
          <input
            className="wf-input"
            style={{ flex: 1 }}
            placeholder="PLZ oder Stadt…"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            disabled={refreshing}
          />
        </div>

        {showDropdown && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: 'var(--card-bg, #1a1a2e)', border: '1px solid var(--border)',
            borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            maxHeight: '200px', overflowY: 'auto',
          }}>
            {searchResults.map(e => (
              <div
                key={e.plz}
                onClick={() => handleSelect(e)}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between',
                }}
                onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: 'var(--text-main, #eee)' }}>{e.city}</span>
                <span style={{ color: 'var(--text-muted, #888)', marginLeft: '8px' }}>{e.plz}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {searchError && (
        <div style={{ fontSize: '10px', color: 'var(--red-de)', marginTop: '4px' }}>
          {searchError}
        </div>
      )}

      {Array.from({ length: 4 }).map((_, i) => {
        const loc = savedLocations[i];
        const isOn = loc ? currentLocation?.id === loc.id : false;
        return (
          <div key={i} className="wf-slot" onClick={() => loc && setCurrentLocation(loc)}
            style={{ cursor: loc ? 'pointer' : 'default' }}>
            <div className={`wf-slot-dot ${isOn ? 'on' : ''}`} />
            <span className={`wf-slot-name ${isOn ? 'on' : ''} ${!loc ? 'empty' : ''}`}>
              {loc ? loc.name : '— leer —'}
            </span>
            {loc && (
              <button className="wf-btn-x" onClick={e => {
                e.stopPropagation();
                removeLocation(loc.id);
              }} title={language === 'de' ? 'Standort entfernen' : 'Remove location'}>×</button>
            )}
          </div>
        );
      })}

      {/* ── Language ── */}
      <div className="wf-section mt">Sprache</div>
      <div className="wf-form-row" style={{ gap: '6px' }}>
        {(['de', 'en'] as const).map(lang => (
          <button
            key={lang}
            className={`wf-hobby-chip ${language === lang ? 'on' : ''}`}
            style={{ flex: 1, textTransform: 'uppercase', letterSpacing: '0.08em' }}
            onClick={() => setLanguage(lang)}
          >
            {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
          </button>
        ))}
      </div>

      {/* ── Interests ── */}
      <div
        className="wf-section mt"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setShowHobbies(p => !p)}
      >
        <span>Interessen</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {hobbies.length > 0 ? `${hobbies.length} gewählt` : 'Standard'} {showHobbies ? '▲' : '▼'}
        </span>
      </div>

      {showHobbies && (
        <div className="wf-hobby-grid">
          {ALL_HOBBIES.map(h => (
            <button
              key={h}
              className={`wf-hobby-chip ${hobbies.includes(h) ? 'on' : ''}`}
              onClick={() => toggleHobby(h)}
            >
              {h}
            </button>
          ))}
          {hobbies.length > 0 && (
            <button className="wf-hobby-chip clear" onClick={() => setHobbies([])}>
              Alle löschen
            </button>
          )}
        </div>
      )}

      {/* ── Refresh ── */}
      {savedLocations.length > 0 && (
        <>
          <button className="wf-btn-refresh" onClick={handleRefreshAll} disabled={refreshing}
            title="Wetterdaten für alle Standorte neu abrufen">
            {refreshing ? `⏳ ${status || 'Generiert…'}` : '↻ Alle aktualisieren'}
          </button>
          {status && !refreshing && (
            <div style={{ fontSize: '10px', color: status.startsWith('Fehler') ? 'var(--red-de)' : 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
              {status}
            </div>
          )}
        </>
      )}

      {/* ── System ── */}
      <div className="wf-sys-block">
        <div className="wf-section" style={{ marginBottom: '8px' }}>System</div>
        <div className="wf-sys-line">API &nbsp;· OpenWeather</div>
        <div className="wf-sys-line">KI &nbsp;· Gemini 2.0 Flash</div>
        <div className="wf-sys-line">TTS · Edge TTS Neural</div>
        <div className="wf-sys-line" style={{ marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
          v2.0 · OTH Amberg-Weiden
        </div>
      </div>
    </>
  );
}
