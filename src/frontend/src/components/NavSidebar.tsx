import React, { useEffect, useState } from 'react';
import { NavLink, useLocation as useRouterLocation } from 'react-router-dom';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useWeather } from '../contexts/WeatherContext';
import { getWeatherEmoji } from '../utils/weatherHelpers';

const NAV_ITEMS = [
  { path: '/',          icon: '🏠', labelDE: 'Dashboard',  labelEN: 'Dashboard'  },
  { path: '/reports',   icon: '📻', labelDE: 'Berichte',   labelEN: 'Reports'    },
  { path: '/forecast',  icon: '📊', labelDE: 'Vorhersage', labelEN: 'Forecast'   },
  { path: '/chat',      icon: '💬', labelDE: 'KI-Chat',    labelEN: 'AI Chat'    },
  { path: '/settings',  icon: '⚙️', labelDE: 'Einstellungen', labelEN: 'Settings' },
];

interface NavSidebarProps { isOpen: boolean; onClose: () => void; }

const NavSidebar: React.FC<NavSidebarProps> = ({ isOpen, onClose }) => {
  const { currentLocation, savedLocations } = useLocation();
  const { language } = useLanguage();
  const { weatherData } = useWeather();
  const routerLoc = useRouterLocation();
  const de = language === 'de';

  const [schedStatus, setSchedStatus] = useState<string>('');

  useEffect(() => {
    fetch('/api/schedule/status')
      .then(r => r.json())
      .then(d => {
        if (d.next_run) {
          const next = new Date(d.next_run);
          setSchedStatus(
            de
              ? `Nächste Auto-Gen: ${next.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
              : `Next auto-gen: ${next.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
          );
        }
      })
      .catch(() => {});
  }, [routerLoc.pathname]);

  const cur = weatherData?.current;
  const emoji = cur ? getWeatherEmoji(cur.overcast, cur.current_precipitation) : '';

  return (
    <nav className={`wf-nav${isOpen ? ' wf-nav--open' : ''}`}>
      {/* Navigation links */}
      <div className="wf-nav-links">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `wf-nav-link${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <span className="wf-nav-icon">{item.icon}</span>
            <span className="wf-nav-label">{de ? item.labelDE : item.labelEN}</span>
          </NavLink>
        ))}
      </div>

      {/* Divider */}
      <div className="wf-nav-divider" />

      {/* Current location mini card */}
      {currentLocation && cur ? (
        <div className="wf-nav-mini">
          <div className="wf-nav-mini-header">
            <span className="wf-nav-mini-emoji">{emoji}</span>
            <div>
              <div className="wf-nav-mini-city">{currentLocation.name.split('–')[1]?.trim() || currentLocation.name}</div>
              <div className="wf-nav-mini-temp">{cur.temperature}°C</div>
            </div>
          </div>
          <div className="wf-nav-mini-stats">
            <span>💧{cur.humidity}%</span>
            <span>🌬{cur['wind speed'] ?? '–'}</span>
            <span>{cur.current_precipitation === 'rain' ? '☔' : '✓'}</span>
          </div>
        </div>
      ) : (
        <div className="wf-nav-mini-empty">
          <span style={{ opacity: 0.35, fontSize: '20px' }}>🌍</span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {de ? 'Kein Standort' : 'No location'}
          </span>
        </div>
      )}

      {/* Location count */}
      {savedLocations.length > 0 && (
        <div className="wf-nav-locs">
          {savedLocations.map(loc => (
            <div key={loc.id} className={`wf-nav-loc-dot ${currentLocation?.id === loc.id ? 'active' : ''}`}
              title={loc.name} />
          ))}
        </div>
      )}

      {/* Scheduler status */}
      {schedStatus && (
        <div className="wf-nav-sched">{schedStatus}</div>
      )}

      {/* System tag */}
      <div className="wf-nav-sys">
        <div>KI · Gemini 2.0</div>
        <div>TTS · Edge Neural</div>
        <div>v2.0 · OTH AW</div>
      </div>
    </nav>
  );
};

export default NavSidebar;
