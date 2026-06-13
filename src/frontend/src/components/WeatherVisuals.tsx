import React, { useState } from 'react';
import DailyForecast from './DailyForecast';
import WeeklyForecast from './WeeklyForecast';
import { useLocation } from '../contexts/LocationContext';

type ForecastView = 'today' | 'week1' | 'week2';

const TAB_LABELS: Record<ForecastView, string> = {
  today: 'Heute',
  week1: '1. Woche',
  week2: '2. Woche',
};

const WeatherVisuals: React.FC = () => {
  const { currentLocation } = useLocation();
  const [view, setView] = useState<ForecastView>('today');

  if (!currentLocation) {
    return (
      <div className="wf-card">
        <div className="wf-card-title">Vorhersage</div>
        <div className="wf-empty">
          <div className="wf-empty-icon">📊</div>
          <div className="wf-empty-label">Kein Standort ausgewählt</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wf-card">
      <div className="wf-card-title">
        Vorhersage
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

      {/* DailyForecast and WeeklyForecast now use WeatherContext — no plz prop needed */}
      {view === 'today' && <DailyForecast />}
      {view === 'week1' && <WeeklyForecast week={1} />}
      {view === 'week2' && <WeeklyForecast week={2} />}
    </div>
  );
};

export default WeatherVisuals;
