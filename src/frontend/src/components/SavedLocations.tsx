import React, { useEffect, useState } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { CurrentWeatherData } from '../types/weather';
import { getWeatherEmoji } from '../utils/weatherHelpers';

const SavedLocations: React.FC = () => {
  const { savedLocations, refreshTick } = useLocation();
  const [weatherMap, setWeatherMap] = useState<Record<string, CurrentWeatherData | null>>({});

  useEffect(() => {
    if (!savedLocations.length) { setWeatherMap({}); return; }
    Promise.all(
      savedLocations.map(loc =>
        fetch(`/api/weather/${loc.id}`)
          .then(r => r.json())
          .then(doc => [loc.id, doc.current as CurrentWeatherData] as const)
          .catch(() => [loc.id, null] as const)
      )
    ).then(entries => setWeatherMap(Object.fromEntries(entries)));
  }, [savedLocations, refreshTick]);

  if (!savedLocations.length) return null;

  const withData = savedLocations.filter(loc => weatherMap[loc.id]);
  if (!withData.length) return null;

  return (
    <>
      <div className="wf-section mt">Übersicht</div>
      {withData.map(loc => {
        const c = weatherMap[loc.id]!;
        const emoji = getWeatherEmoji(c.overcast, c.current_precipitation);
        return (
          <div key={loc.id} className="wf-overview-row">
            <span className="wf-ov-temp">{c.temperature}°</span>
            <span className="wf-ov-emoji">{emoji}</span>
            <span className="wf-ov-name">{loc.name}</span>
          </div>
        );
      })}
    </>
  );
};

export default SavedLocations;
