import React, { createContext, useContext, useState, useEffect } from 'react';
import { Location } from '../types/location';

interface LocationContextType {
  currentLocation: Location | null;
  currentLocationIndex: number;
  savedLocations: Location[];
  refreshTick: number;
  setCurrentLocation: (location: Location) => void;
  setCurrentLocationIndex: (index: number) => void;
  addLocation: (location: Location) => void;
  removeLocation: (locationId: string) => void;
  triggerRefresh: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const SAVED_LOCATIONS_KEY = 'savedLocations';
const CURRENT_LOCATION_KEY = 'currentLocation';
const CURRENT_LOCATION_INDEX_KEY = 'currentLocationIndex';

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [currentLocationIndex, setCurrentLocationIndex] = useState<number>(0);
  const [savedLocations, setSavedLocations] = useState<Location[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const savedLocationsJson = localStorage.getItem(SAVED_LOCATIONS_KEY);
    const currentLocationJson = localStorage.getItem(CURRENT_LOCATION_KEY);
    const currentIndex = localStorage.getItem(CURRENT_LOCATION_INDEX_KEY);

    if (savedLocationsJson) {
      try {
        const parsed = JSON.parse(savedLocationsJson);
        setSavedLocations(parsed);
      } catch (e) {
        console.error('Failed to parse saved locations', e);
      }
    }

    if (currentLocationJson) {
      try {
        const parsed = JSON.parse(currentLocationJson);
        setCurrentLocation(parsed);
      } catch (e) {
        console.error('Failed to parse current location', e);
      }
    }

    if (currentIndex !== null) {
      setCurrentLocationIndex(parseInt(currentIndex, 10));
    }
  }, []);

  useEffect(() => {
    if (savedLocations.length > 0) {
      localStorage.setItem(SAVED_LOCATIONS_KEY, JSON.stringify(savedLocations));
    }
  }, [savedLocations]);

  useEffect(() => {
    if (currentLocation) {
      localStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(currentLocation));
    }
  }, [currentLocation]);

  useEffect(() => {
    localStorage.setItem(CURRENT_LOCATION_INDEX_KEY, currentLocationIndex.toString());
  }, [currentLocationIndex]);

  const handleSetCurrentLocation = (location: Location) => {
    setCurrentLocation(location);
  };

  const handleSetCurrentLocationIndex = (index: number) => {
    setCurrentLocationIndex(index);
    const location = savedLocations[index];
    if (location) {
      setCurrentLocation(location);
    }
  };

  const handleAddLocation = (location: Location) => {
    if (!savedLocations.some(loc => loc.id === location.id)) {
      const newSavedLocations = [...savedLocations, location];
      setSavedLocations(newSavedLocations);

      if (!currentLocation) {
        setCurrentLocation(location);
        setCurrentLocationIndex(0);
      }
    }
  };

  const handleRemoveLocation = (locationId: string) => {
    const indexToRemove = savedLocations.findIndex(loc => loc.id === locationId);
    const newSavedLocations = savedLocations.filter(loc => loc.id !== locationId);
    setSavedLocations(newSavedLocations);

    if (currentLocation && currentLocation.id === locationId) {
      if (newSavedLocations.length > 0) {
        setCurrentLocation(newSavedLocations[0]);
        setCurrentLocationIndex(0);
      } else {
        setCurrentLocation(null);
        setCurrentLocationIndex(0);
      }
    } else if (indexToRemove < currentLocationIndex) {
      setCurrentLocationIndex(prev => Math.max(prev - 1, 0));
    }
  };

  const value: LocationContextType = {
    currentLocation,
    currentLocationIndex,
    savedLocations,
    refreshTick,
    setCurrentLocation: handleSetCurrentLocation,
    setCurrentLocationIndex: handleSetCurrentLocationIndex,
    addLocation: handleAddLocation,
    removeLocation: handleRemoveLocation,
    triggerRefresh: () => setRefreshTick(t => t + 1),
  };

  return (
      <LocationContext.Provider value={value}>
        {children}
      </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
