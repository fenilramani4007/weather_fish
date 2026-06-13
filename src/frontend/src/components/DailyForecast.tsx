import React from 'react';
import { HourlyEntry } from '../types/weather';
import { useWeather } from '../contexts/WeatherContext';
import { getWeatherEmoji } from '../utils/weatherHelpers';

interface PeriodSummary {
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipPercent: number;
  overcast: string;
}

const DailyForecast: React.FC = () => {
  const { weatherData, isLoading } = useWeather();

  if (isLoading) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon wf-pulse">⏳</div>
        <div className="wf-empty-label">Lade Wetterdaten…</div>
      </div>
    );
  }

  if (!weatherData) {
    return (
      <div className="wf-empty">
        <div className="wf-empty-icon">📊</div>
        <div className="wf-empty-label">Keine Daten verfügbar</div>
      </div>
    );
  }

  const avg = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

  const mostCommon = (arr: string[]) =>
    arr.sort((a, b) =>
      arr.filter(v => v === b).length - arr.filter(v => v === a).length
    )[0] ?? 'clear';

  const getPeriod = (start: number, end: number): PeriodSummary | null => {
    const entries = Object.entries(weatherData.hourly)
      .map(([h, e]) => ({ hour: parseInt(h), ...e } as HourlyEntry & { hour: number }))
      .filter(e =>
        start <= end
          ? e.hour >= start && e.hour < end
          : e.hour >= start || e.hour < end
      );
    if (!entries.length) return null;
    return {
      temperature:   avg(entries.map(e => e.temperature)),
      feelsLike:     avg(entries.map(e => e['feels like'])),
      humidity:      Math.max(...entries.map(e => e.humidity)),
      precipPercent: avg(entries.map(e => e['precipitation probability'])),
      overcast:      mostCommon(entries.map(e => e.overcast)),
    };
  };

  const periods = [
    { label: 'Morgens', time: '06–12', data: getPeriod(6, 12) },
    { label: 'Mittags', time: '12–18', data: getPeriod(12, 18) },
    { label: 'Abends',  time: '18–22', data: getPeriod(18, 22) },
    { label: 'Nachts',  time: '22–06', data: getPeriod(22, 6) },
  ];

  return (
    <div className="wf-period-grid">
      {periods.map(({ label, time, data }) => {
        if (!data) {
          return (
            <div key={label} className="wf-period-card">
              <div className="wf-period-label">{label}</div>
              <div className="wf-period-time">{time} Uhr</div>
              <span className="wf-period-emoji">—</span>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Keine Daten</div>
            </div>
          );
        }
        const precip = data.precipPercent >= 50 ? 'rain' : '';
        const emoji = getWeatherEmoji(data.overcast, precip);
        return (
          <div key={label} className="wf-period-card">
            <div className="wf-period-label">{label}</div>
            <div className="wf-period-time">{time} Uhr</div>
            <span className="wf-period-emoji">{emoji}</span>
            <div className="wf-period-temp">{data.temperature}°</div>
            <div className="wf-period-feels">Gefühlt {data.feelsLike}°</div>
            <div className="wf-period-meta">
              <span>💧{data.humidity}%</span>
              <span>☔{data.precipPercent}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DailyForecast;
