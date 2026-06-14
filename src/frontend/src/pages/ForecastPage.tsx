import React, { useState } from 'react';
import DailyForecast from '../components/DailyForecast';
import WeeklyForecast from '../components/WeeklyForecast';
import HistoryChart from '../components/HistoryChart';
import CurrentWeather from '../components/CurrentWeather';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';

type Tab = 'today' | 'week1' | 'week2' | 'history';

const ForecastPage: React.FC = () => {
  const { currentLocation } = useLocation();
  const { language } = useLanguage();
  const de = language === 'de';
  const [tab, setTab] = useState<Tab>('today');

  const TABS: { key: Tab; de: string; en: string }[] = [
    { key: 'today',   de: 'Heute',    en: 'Today'   },
    { key: 'week1',   de: '7 Tage',   en: '7 Days'  },
    { key: 'week2',   de: '2. Woche', en: 'Week 2'  },
    { key: 'history', de: 'Verlauf',  en: 'History' },
  ];

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <div>
          <h1 className="wf-page-title">{de ? 'Vorhersage & Analyse' : 'Forecast & Analysis'}</h1>
          <p className="wf-page-sub">
            {currentLocation ? currentLocation.name : (de ? 'Kein Standort ausgewählt' : 'No location selected')}
          </p>
        </div>
      </div>

      {/* Current conditions + tab content */}
      <div className="wf-forecast-layout">
        {/* Left: Current conditions card */}
        <div className="wf-forecast-current">
          <CurrentWeather />
        </div>

        {/* Right: tabbed forecast */}
        <div className="wf-forecast-main">
          <div className="wf-tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`wf-tab ${tab === t.key ? 'on' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {de ? t.de : t.en}
              </button>
            ))}
          </div>

          {tab === 'today'   && <DailyForecast />}
          {tab === 'week1'   && <WeeklyForecast week={1} />}
          {tab === 'week2'   && <WeeklyForecast week={2} />}
          {tab === 'history' && <HistoryChart />}
        </div>
      </div>
    </div>
  );
};

export default ForecastPage;
