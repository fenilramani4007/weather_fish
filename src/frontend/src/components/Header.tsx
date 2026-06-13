import React from 'react';
import { useLocation } from '../contexts/LocationContext';
import { useLanguage } from '../contexts/LanguageContext';

const Header: React.FC = () => {
  const { currentLocation } = useLocation();
  const { language } = useLanguage();

  const dateStr = new Date().toLocaleDateString(language === 'en' ? 'en-GB' : 'de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <header className="wf-header">
      <div className="wf-logo">
        <div className="wf-logo-dot" />
        🐟 WEATHER-FISH
      </div>

      <div className="wf-header-center">
        <div>{dateStr}</div>
        {currentLocation && (
          <div style={{ color: 'var(--gold)', fontSize: '11px', marginTop: '1px', letterSpacing: '0.06em' }}>
            {currentLocation.name}
          </div>
        )}
      </div>

      <div className="wf-header-badge">KI-WETTER · {language.toUpperCase()}</div>
    </header>
  );
};

export default Header;
