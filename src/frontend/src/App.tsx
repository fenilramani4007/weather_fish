import { BrowserRouter as Router } from 'react-router-dom';
import { LocationProvider } from './contexts/LocationContext';
import { WeatherProvider } from './contexts/WeatherContext';
import Layout from './components/Layout';
import './App.css';

function App() {
  return (
    <Router>
      <LocationProvider>
        <WeatherProvider>
          <Layout />
        </WeatherProvider>
      </LocationProvider>
    </Router>
  );
}

export default App;
