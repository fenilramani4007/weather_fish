import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getWeatherEmoji, getConditionLabel } from '../utils/weatherHelpers';
import { CurrentWeatherData } from '../types/weather';
import WorkflowGuide from '../components/WorkflowGuide';

interface LocationWeather {
  id: string;
  name: string;
  current: CurrentWeatherData | null;
  fetched_at?: string;
}

const DashboardPage: React.FC = () => {
  const { savedLocations, currentLocation, setCurrentLocation } = useLocation();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const de = language === 'de';

  const [locationData, setLocationData] = useState<LocationWeather[]>([]);
  const [loading, setLoading]           = useState(false);
  const [hasReport, setHasReport]       = useState(false);

  // Check if any AI report exists (step 2 of the workflow guide)
  useEffect(() => {
    fetch('/api/report/Fisch?lang=de')
      .then(r => r.ok ? r.json() : null)
      .then(doc => setHasReport(!!doc?.text))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!savedLocations.length) { setLocationData([]); return; }
    setLoading(true);
    Promise.all(
      savedLocations.map(loc =>
        fetch(`/api/weather/${loc.id}`)
          .then(r => r.ok ? r.json() : null)
          .then(doc => ({ id: loc.id, name: loc.name, current: doc?.current ?? null, fetched_at: doc?.fetched_at }))
          .catch(() => ({ id: loc.id, name: loc.name, current: null }))
      )
    ).then(data => { setLocationData(data); setLoading(false); });
  }, [savedLocations]);

  const now = new Date().toLocaleDateString(de ? 'de-DE' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="wf-page">
      {/* Page header */}
      <div className="wf-page-header">
        <div>
          <h1 className="wf-page-title">{de ? 'Dashboard' : 'Dashboard'}</h1>
          <p className="wf-page-sub">{now}</p>
        </div>
        <button className="wf-btn-primary" onClick={() => navigate('/reports')}>
          {de ? '📻 Berichte erstellen' : '📻 Generate Reports'}
        </button>
      </div>

      {/* Onboarding workflow guide — shows until all 4 steps complete */}
      <WorkflowGuide hasReport={hasReport} />

      {savedLocations.length === 0 ? (
        <div className="wf-empty" style={{ marginTop: '40px' }}>
          <div className="wf-empty-icon" style={{ opacity: 1, fontSize: '48px' }}>🌍</div>
          <div className="wf-empty-label">{de ? 'Noch keine Standorte' : 'No locations yet'}</div>
          <div className="wf-empty-sub">
            {de ? 'Beginne mit Schritt 1 oben — füge eine PLZ hinzu.' : 'Start with Step 1 above — add a postal code.'}
          </div>
        </div>
      ) : (
        <>
          {/* Location weather grid */}
          <div className="wf-dash-grid">
            {locationData.map(loc => {
              const c = loc.current;
              const isActive = currentLocation?.id === loc.id;
              const emoji = c ? getWeatherEmoji(c.overcast, c.current_precipitation) : '⏳';
              const condition = c ? getConditionLabel(c.overcast, c.current_precipitation) : '';

              return (
                <div
                  key={loc.id}
                  className={`wf-dash-card ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    const found = savedLocations.find(l => l.id === loc.id);
                    if (found) setCurrentLocation(found);
                  }}
                >
                  {isActive && <div className="wf-dash-active-badge">{de ? 'AKTIV' : 'ACTIVE'}</div>}
                  <div className="wf-dash-emoji">{emoji}</div>
                  <div className="wf-dash-city">{loc.name.split('–')[1]?.trim() || loc.name}</div>
                  <div className="wf-dash-plz">{loc.id}</div>

                  {c ? (
                    <>
                      <div className="wf-dash-temp">{c.temperature}<span>°C</span></div>
                      <div className="wf-dash-condition">{condition.toUpperCase()}</div>
                      <div className="wf-dash-stats">
                        <div>
                          <div className="wf-dash-stat-label">{de ? 'Gefühlt' : 'Feels'}</div>
                          <div className="wf-dash-stat-val">{c['feels like']}°</div>
                        </div>
                        <div>
                          <div className="wf-dash-stat-label">{de ? 'Feuchte' : 'Humidity'}</div>
                          <div className="wf-dash-stat-val">{c.humidity}%</div>
                        </div>
                        <div>
                          <div className="wf-dash-stat-label">{de ? 'Wind' : 'Wind'}</div>
                          <div className="wf-dash-stat-val">{c['wind speed'] ?? '–'}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="wf-dash-no-data">
                      {loading ? (de ? 'Lädt…' : 'Loading…') : (de ? 'Keine Daten — bitte generieren' : 'No data — please generate')}
                    </div>
                  )}

                  {loc.fetched_at && (
                    <div className="wf-dash-time">
                      {de ? 'Stand' : 'Updated'}: {new Date(loc.fetched_at).toLocaleTimeString(de ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="wf-dash-actions">
            <button className="wf-btn-secondary" onClick={() => navigate('/reports')}>
              📻 {de ? 'KI-Berichte & Audio' : 'AI Reports & Audio'}
            </button>
            <button className="wf-btn-secondary" onClick={() => navigate('/forecast')}>
              📊 {de ? 'Detaillierte Vorhersage' : 'Detailed Forecast'}
            </button>
            <button className="wf-btn-secondary" onClick={() => navigate('/chat')}>
              💬 {de ? 'Wetter-Assistent' : 'Weather Assistant'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
