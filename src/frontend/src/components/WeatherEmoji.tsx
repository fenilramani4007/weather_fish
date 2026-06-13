import React from 'react';

interface WeatherEmojiProps {
  condition: string;
  className?: string;
}

const WeatherEmoji: React.FC<WeatherEmojiProps> = ({ condition, className = '' }) => {
  const getEmoji = () => {
    if (condition.includes('Regnerisch') || condition.includes('regen')) {
      return '🌧️';
    } else if (condition.includes('bewölkt') || condition.includes('Bewölkt')) {
      return '☁️';
    } else if (condition.includes('Schnee')) {
      return '❄️';
    } else if (condition.includes('Gewitter')) {
      return '⛈️';
    } else if (condition.includes('Nebelig')) {
      return '🌫️';
    } else if (condition.includes('Windig')) {
      return '💨';
    } else if (condition.includes('Sonnig')) {
      return '☀️';
    } else {
      return '🌤️';
    }
  };

  return (
    <div className={`weather-emoji ${className}`} style={{ fontSize: '4rem' }}>
      {getEmoji()}
    </div>
  );
};

export default WeatherEmoji;