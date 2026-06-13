import React from 'react';
import { useWeather } from '../contexts/WeatherContext';
import { useLocation } from '../contexts/LocationContext';
import { getWeatherEmoji, getConditionLabel } from '../utils/weatherHelpers';

const CurrentWeather: React.FC = () => {
  const { weatherData, isLoading } = useWeather();
  const { currentLocation } = useLocation();

  if (!currentLocation) {
    return (
      <div className="wf-weather-card">
        <div className="wf-empty">
          <div className="wf-empty-icon">🌍</div>
          <div className="wf-empty-label">Kein Standort</div>
          <div className="wf-empty-sub">PLZ und Ort eingeben</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="wf-weather-card wf-pulse">
        <div className="wf-w-label">Aktuelles Wetter</div>
        <div className="wf-w-city">{currentLocation.name}</div>
        <div className="wf-w-temp">
          ––<span className="wf-w-unit">°C</span>
        </div>
        <div className="wf-w-condition">LÄDT…</div>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="wf-weather-card">
        <div className="wf-w-label">Aktuelles Wetter</div>
        <div className="wf-w-city">{currentLocation.name}</div>
        <div className="wf-empty" style={{ padding: '20px 0 0' }}>
          <div className="wf-empty-icon wf-pulse">⏳</div>
          <div className="wf-empty-label">Wird generiert</div>
          <div className="wf-empty-sub">Bitte warten…</div>
        </div>
      </div>
    );
  }

  const c = weatherData.current;
  const emoji = getWeatherEmoji(c.overcast, c.current_precipitation);
  const condition = getConditionLabel(c.overcast, c.current_precipitation);

  return (
    <div className="wf-weather-card">
      <div className="wf-w-emoji">{emoji}</div>
      <div className="wf-w-label">Aktuelles Wetter</div>
      <div className="wf-w-city">{currentLocation.name}</div>
      <div className="wf-w-temp">
        {c.temperature}<span className="wf-w-unit">°C</span>
      </div>
      <div className="wf-w-condition">{condition.toUpperCase()}</div>

      <div className="wf-w-stats">
        <div className="wf-w-stat">
          <div className="wf-w-stat-label">Gefühlt</div>
          <div className="wf-w-stat-val">{c['feels like']}°</div>
        </div>
        <div className="wf-w-stat">
          <div className="wf-w-stat-label">Feuchte</div>
          <div className="wf-w-stat-val">{c.humidity}%</div>
        </div>
        <div className="wf-w-stat">
          <div className="wf-w-stat-label">Niederschlag</div>
          <div className="wf-w-stat-val" style={{ fontSize: '11px' }}>
            {c.current_precipitation === 'rain' ? 'REGEN' : 'KEIN'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrentWeather;
