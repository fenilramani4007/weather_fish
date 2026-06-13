import React from 'react';
import { DailyEntry } from '../types/weather';
import { useWeather } from '../contexts/WeatherContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getWeatherEmoji } from '../utils/weatherHelpers';

interface WeeklyForecastProps { week: 1 | 2; }

const WeeklyForecast: React.FC<WeeklyForecastProps> = ({ week }) => {
  const { weatherData, isLoading } = useWeather();
  const { language } = useLanguage();
  const de = language === 'de';
  const locale = de ? 'de-DE' : 'en-GB';

  if (isLoading) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon wf-pulse">⏳</div>
        <div className="wf-empty-label">{de ? 'Lade Vorhersage…' : 'Loading forecast…'}</div>
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
          {de
            ? `Keine Daten für ${week === 1 ? 'Woche 1' : 'Woche 2'}`
            : `No data for ${week === 1 ? 'Week 1' : 'Week 2'}`}
        </div>
        <div className="wf-empty-sub">
          {de ? 'OpenWeather Free Tier: max. 5 Tage' : 'OpenWeather Free Tier: max 5 days'}
        </div>
      </div>
    );
  }

  return (
    <div className="wf-week-grid">
      {Object.entries(forecastData).map(([date, entry]) => {
        const emoji = getWeatherEmoji(entry.overcast, entry.precipitation);
        const label = new Date(date).toLocaleDateString(locale, {
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
              {de ? 'Böen' : 'Gusts'} {entry.maxwindgusts}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WeeklyForecast;
