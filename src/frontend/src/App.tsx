import { BrowserRouter as Router } from 'react-router-dom';
import { LocationProvider } from './contexts/LocationContext';
import { WeatherProvider } from './contexts/WeatherContext';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import './App.css';

function App() {
  return (
    <Router>
      <LanguageProvider>
        <LocationProvider>
          <WeatherProvider>
            <Layout />
          </WeatherProvider>
        </LocationProvider>
      </LanguageProvider>
    </Router>
  );
}

export default App;
