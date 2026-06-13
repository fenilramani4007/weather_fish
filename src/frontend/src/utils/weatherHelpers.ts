// Map overcast string (from backend) to a German label
export const getConditionLabel = (overcast: string, precipitation?: string): string => {
  if (precipitation === 'rain') return 'Regnerisch';
  switch (overcast?.toLowerCase()) {
    case 'clear':         return 'Klar';
    case 'partly cloudy': return 'Teilweise bewölkt';
    case 'cloudy':        return 'Bewölkt';
    default:              return 'Unbekannt';
  }
};

// Emoji icon — works everywhere, no file dependencies
export const getWeatherEmoji = (overcast: string, precipitation?: string): string => {
  if (precipitation === 'rain') return '🌧️';
  switch (overcast?.toLowerCase()) {
    case 'clear':         return '☀️';
    case 'partly cloudy': return '⛅';
    case 'cloudy':        return '☁️';
    default:              return '🌤️';
  }
};

// Legacy helper kept for backward compatibility with WeeklyForecast / DailyForecast
export const mapOvercastToCondition = (overcast: string): string => getConditionLabel(overcast);

// Accepts a German condition string (legacy callers) and returns an emoji
export const getWeatherIcon = (condition: string): string => {
  const c = condition.toLowerCase();
  if (c.includes('reg') || c.includes('rain'))                          return '🌧️';
  if (c.includes('schnee') || c.includes('snow'))                       return '❄️';
  if (c.includes('gewitter') || c.includes('storm'))                    return '⛈️';
  if (c.includes('nebel') || c.includes('fog'))                         return '🌫️';
  if (c.includes('bewölkt') || c.includes('bewolkt') || c.includes('cloud')) return '☁️';
  if (c.includes('teilweise') || c.includes('partly'))                  return '⛅';
  if (c.includes('sonnig') || c.includes('klar') || c.includes('clear') || c.includes('sunny')) return '☀️';
  return '🌤️';
};

export const getWeatherEmoji2 = getWeatherIcon; // alias
