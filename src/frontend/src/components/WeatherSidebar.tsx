import { useState, useEffect, useRef } from 'react';
import { useLocation } from '../contexts/LocationContext';

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

  const [newZip, setNewZip]         = useState('');
  const [newCity, setNewCity]       = useState('');
  const [postalCodes, setPostalCodes] = useState<PostalCodeEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus]         = useState('');
  const [hobbies, setHobbies]       = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HOBBIES_KEY) ?? '[]'); }
    catch { return []; }
  });
  const [showHobbies, setShowHobbies] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/postal_codes/postal_codes.json')
      .then(r => r.json())
      .then(setPostalCodes)
      .catch(console.error);
  }, []);

  // Persist hobby selection
  useEffect(() => {
    localStorage.setItem(HOBBIES_KEY, JSON.stringify(hobbies));
  }, [hobbies]);

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const toggleHobby = (h: string) =>
    setHobbies(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h]);

  const activeHobbies = hobbies.length > 0 ? hobbies : ['gaming', 'tennis', 'fahrrad fahren'];

  const _startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => triggerRefresh(), POLL_INTERVAL);
  };

  const _runGeneration = (cities: string[], zipcodes: string[]) => {
    fetch('/generate-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities, zipcodes, language: 'de', hobbies: activeHobbies }),
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

  const handleAdd = () => {
    const z = newZip.trim(), c = newCity.trim();
    if (!z || !c) return;
    if (savedLocations.length >= 4) { alert('Maximal 4 Standorte erlaubt.'); return; }
    const match = postalCodes.find(e => e.plz === z && e.city.toLowerCase() === c.toLowerCase());
    if (!match) { alert('Ungültige PLZ/Ort Kombination.'); return; }
    addLocation({ id: match.plz, name: `${match.plz} – ${match.city}`, lat: 0, lon: 0 });
    setNewZip(''); setNewCity('');
    setRefreshing(true); setStatus('Generiert…');
    _startPolling();
    _runGeneration([match.city], [match.plz]);
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

      <div className="wf-form-row">
        <input
          className="wf-input" style={{ width: '72px', flexShrink: 0 }}
          placeholder="PLZ" value={newZip} maxLength={5}
          onChange={e => { if (/^\d{0,5}$/.test(e.target.value)) setNewZip(e.target.value); }}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          className="wf-input" style={{ flex: 1 }}
          placeholder="Ort" value={newCity}
          onChange={e => setNewCity(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button className="wf-btn-add" onClick={handleAdd} disabled={!newZip || !newCity || refreshing}>
          +
        </button>
      </div>

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
                if (confirm('Standort entfernen?')) removeLocation(loc.id);
              }}>×</button>
            )}
          </div>
        );
      })}

      {/* ── User Preferences ── */}
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

      {/* ── System info ── */}
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
