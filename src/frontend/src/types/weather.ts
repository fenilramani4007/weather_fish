// Matches the structured JSON produced by database/io.py → write_structured_json()

export interface CurrentWeatherData {
  temperature: number;
  'feels like': number;
  humidity: number;
  current_precipitation: string; // "" | "rain"
  overcast: string;              // "clear" | "partly cloudy" | "cloudy"
  'wind speed'?: number;
}

export interface HourlyEntry {
  temperature: number;
  'feels like': number;
  humidity: number;
  'precipitation probability': number; // 0–100
  overcast: string;
}

export interface DailyEntry {
  maxtemp: number;
  mintemp: number;
  maxwindgusts: number;
  maxwindspeed: number;
  overcast: string;
  precipitation: string; // "" | "rain"
}

export interface StructuredWeatherData {
  current: CurrentWeatherData;
  hourly: Record<string, HourlyEntry>;       // key = hour as string ("0"–"23")
  daily_weekone: Record<string, DailyEntry>; // key = "YYYY-MM-DD"
  daily_weektwo: Record<string, DailyEntry>;
}
