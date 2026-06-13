import React from 'react';
import Header from './Header';
import WeatherSidebar from './WeatherSidebar';
import SavedLocations from './SavedLocations';
import CurrentWeather from './CurrentWeather';
import TextReport from './TextReport';
import WeatherVisuals from './WeatherVisuals';

const Layout: React.FC = () => (
  <div className="wf-app">
    <Header />
    <div className="wf-body">
      <aside className="wf-sidebar">
        <WeatherSidebar />
        <SavedLocations />
      </aside>
      <main className="wf-main">
        <div className="wf-hero-row">
          <CurrentWeather />
          <div className="wf-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <TextReport />
          </div>
        </div>
        <WeatherVisuals />
      </main>
    </div>
  </div>
);

export default Layout;
