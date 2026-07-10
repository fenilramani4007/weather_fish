import { StructuredWeatherData } from '../types/weather';

/**
 * Load the pre-generated structured weather JSON for a given postal code.
 * Files are written by the backend to public/structured_data/{plz}_structured.json
 * and served statically by Vite.
 */
export async function fetchWeatherData(plz: string): Promise<StructuredWeatherData> {
  const res = await fetch(`/structured_data/${plz}_structured.json`);
  if (!res.ok) throw new Error(`No weather data found for ${plz}`);
  return res.json();
}
