import React, { useState } from 'react';
import DailyForecast from './DailyForecast';
import WeeklyForecast from './WeeklyForecast';
import HistoryChart from './HistoryChart';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';

type ForecastView = 'today' | 'week1' | 'week2' | 'history';

const WeatherVisuals: React.FC = () => {
  const { currentLocation } = useLocation();
  const { language } = useLanguage();
  const de = language === 'de';
  const [view, setView] = useState<ForecastView>('today');

  const TAB_LABELS: Record<ForecastView, string> = {
    today:   de ? 'Heute'    : 'Today',
    week1:   de ? '1. Woche' : 'Week 1',
    week2:   de ? '2. Woche' : 'Week 2',
    history: de ? 'Verlauf'  : 'History',
  };

  if (!currentLocation) {
    return (
      <div className="wf-card">
        <div className="wf-card-title">{de ? 'Vorhersage' : 'Forecast'}</div>
        <div className="wf-empty">
          <div className="wf-empty-icon">📊</div>
          <div className="wf-empty-label">
            {de ? 'Kein Standort ausgewählt' : 'No location selected'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wf-card">
      <div className="wf-card-title">
        {de ? 'Vorhersage & Verlauf' : 'Forecast & History'}
        <span>{currentLocation.name}</span>
      </div>

      <div className="wf-tabs">
        {(Object.keys(TAB_LABELS) as ForecastView[]).map(tab => (
          <button
            key={tab}
            className={`wf-tab ${view === tab ? 'on' : ''}`}
            onClick={() => setView(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {view === 'today'   && <DailyForecast />}
      {view === 'week1'   && <WeeklyForecast week={1} />}
      {view === 'week2'   && <WeeklyForecast week={2} />}
      {view === 'history' && <HistoryChart />}
    </div>
  );
};

export default WeatherVisuals;
