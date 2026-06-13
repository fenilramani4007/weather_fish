import React from 'react';
import { useWeather } from '../contexts/WeatherContext';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getWeatherEmoji, getConditionLabel } from '../utils/weatherHelpers';

const CurrentWeather: React.FC = () => {
  const { weatherData, isLoading } = useWeather();
  const { currentLocation } = useLocation();
  const { language } = useLanguage();

  const de = language === 'de';

  if (!currentLocation) {
    return (
      <div className="wf-weather-card">
        <div className="wf-empty">
          <div className="wf-empty-icon">🌍</div>
          <div className="wf-empty-label">{de ? 'Kein Standort' : 'No location'}</div>
          <div className="wf-empty-sub">{de ? 'PLZ oder Stadt eingeben' : 'Enter ZIP or city'}</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="wf-weather-card wf-pulse">
        <div className="wf-w-label">{de ? 'Aktuelles Wetter' : 'Current Weather'}</div>
        <div className="wf-w-city">{currentLocation.name}</div>
        <div className="wf-w-temp">
          ––<span className="wf-w-unit">°C</span>
        </div>
        <div className="wf-w-condition">{de ? 'LÄDT…' : 'LOADING…'}</div>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="wf-weather-card">
        <div className="wf-w-label">{de ? 'Aktuelles Wetter' : 'Current Weather'}</div>
        <div className="wf-w-city">{currentLocation.name}</div>
        <div className="wf-empty" style={{ padding: '20px 0 0' }}>
          <div className="wf-empty-icon wf-pulse">⏳</div>
          <div className="wf-empty-label">{de ? 'Wird generiert' : 'Generating'}</div>
          <div className="wf-empty-sub">{de ? 'Bitte warten…' : 'Please wait…'}</div>
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
      <div className="wf-w-label">{de ? 'Aktuelles Wetter' : 'Current Weather'}</div>
      <div className="wf-w-city">{currentLocation.name}</div>
      <div className="wf-w-temp">
        {c.temperature}<span className="wf-w-unit">°C</span>
      </div>
      <div className="wf-w-condition">{condition.toUpperCase()}</div>

      <div className="wf-w-stats">
        <div className="wf-w-stat">
          <div className="wf-w-stat-label">{de ? 'Gefühlt' : 'Feels like'}</div>
          <div className="wf-w-stat-val">{c['feels like']}°</div>
        </div>
        <div className="wf-w-stat">
          <div className="wf-w-stat-label">{de ? 'Feuchte' : 'Humidity'}</div>
          <div className="wf-w-stat-val">{c.humidity}%</div>
        </div>
        <div className="wf-w-stat">
          <div className="wf-w-stat-label">{de ? 'Niederschlag' : 'Precip.'}</div>
          <div className="wf-w-stat-val" style={{ fontSize: '11px' }}>
            {c.current_precipitation === 'rain'
              ? (de ? 'REGEN' : 'RAIN')
              : (de ? 'KEIN' : 'NONE')}
          </div>
        </div>
        <div className="wf-w-stat">
          <div className="wf-w-stat-label">{de ? 'Wind' : 'Wind'}</div>
          <div className="wf-w-stat-val" style={{ fontSize: '11px' }}>
            {c['wind speed'] ?? '–'} km/h
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrentWeather;
