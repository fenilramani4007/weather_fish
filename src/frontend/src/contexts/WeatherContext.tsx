import React, { createContext, useContext, useState, useEffect } from 'react';
import { StructuredWeatherData } from '../types/weather';
import { useLocation } from './LocationContext';

interface WeatherContextType {
  weatherData: StructuredWeatherData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [weatherData, setWeatherData] = useState<StructuredWeatherData | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [tick, setTick]               = useState(0);

  const { currentLocation, refreshTick } = useLocation();

  const refetch = () => setTick(t => t + 1);

  useEffect(() => {
    if (!currentLocation) {
      setWeatherData(null);
      setError(null);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/weather/${currentLocation.id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `HTTP ${res.status}`);
        }
        const doc = await res.json();
        // Strip MongoDB metadata — only keep the four weather keys
        const data: StructuredWeatherData = {
          current:       doc.current,
          hourly:        doc.hourly,
          daily_weekone: doc.daily_weekone,
          daily_weektwo: doc.daily_weektwo,
        };
        setWeatherData(data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setWeatherData(null);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [currentLocation?.id, tick, refreshTick]);

  return (
    <WeatherContext.Provider value={{ weatherData, isLoading, error, refetch }}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = () => {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather must be used within a WeatherProvider');
  return ctx;
};
