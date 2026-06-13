import React from 'react';
import { DailyEntry } from '../types/weather';
import { useWeather } from '../contexts/WeatherContext';
import { getWeatherEmoji } from '../utils/weatherHelpers';

interface WeeklyForecastProps { week: 1 | 2; }

const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ week }) => {
  const { weatherData, isLoading } = useWeather();

  if (isLoading) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon wf-pulse">⏳</div>
        <div className="wf-empty-label">Lade Vorhersage…</div>
      </div>
    );
  }

  const forecastData: Record<string, DailyEntry> | undefined =
    weatherData
      ? (week === 1 ? weatherData.daily_weekone : weatherData.daily_weektwo)
      : undefined;

  if (!forecastData || !Object.keys(forecastData).length) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon">📅</div>
        <div className="wf-empty-label">
          Keine Daten für {week === 1 ? 'Woche 1' : 'Woche 2'}
        </div>
        <div className="wf-empty-sub">OpenWeather Free Tier: max. 5 Tage</div>
      </div>
    );
  }

  return (
    <div className="wf-week-grid">
      {Object.entries(forecastData).map(([date, entry]) => {
        const emoji = getWeatherEmoji(entry.overcast, entry.precipitation);
        const label = new Date(date).toLocaleDateString('de-DE', {
          weekday: 'short', day: '2-digit', month: '2-digit',
        });
        return (
          <div key={date} className="wf-day-card">
            <div className="wf-day-label">{label}</div>
            <span className="wf-day-emoji">{emoji}</span>
            <div className="wf-day-temps">
              {entry.maxtemp}° / <span className="wf-day-min">{entry.mintemp}°</span>
            </div>
            <div className="wf-day-wind">
              🌬 {entry.maxwindspeed} km/h<br />
              Böen {entry.maxwindgusts}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WeeklyForecast;
