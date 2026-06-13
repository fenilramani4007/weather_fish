 import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from '../contexts/LocationContext';
import { Location } from '../types/location';
import { Search, MapPin, Plus } from 'lucide-react';

const LocationSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const { addLocation, savedLocations } = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Mock search function - in a real app, this would call a weather API
  const searchLocations = (searchQuery: string) => {
    // Mock data - in a real app, this would come from the API
    const mockResults: Location[] = [
      { id: 'munich', name: 'München', lat: 48.137154, lon: 11.576124 },
      { id: 'amberg', name: 'Amberg', lat: 49.447220, lon: 11.862778 },
      { id: 'regensburg', name: 'Regensburg', lat: 49.01513, lon: 12.10161 },
      { id: 'nuremberg', name: 'Nürnberg', lat: 49.45203, lon: 11.07675 }
    ];
    
    return mockResults.filter(location => 
      location.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const handleSearch = () => {
    if (query.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    // Simulate API delay
    setTimeout(() => {
      const results = searchLocations(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 500);
  };
  
  const handleAddLocation = (location: Location) => {
    addLocation(location);
    setQuery('');
    setSearchResults([]);
  };
  
  const isLocationSaved = (locationId: string) => {
    return savedLocations.some(loc => loc.id === locationId);
  };
  
  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  return (
    <div className="relative" ref={searchRef}>
      <div className="flex items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Suche nach Ort oder PLZ"
            className="w-full p-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
        </div>
        <button
          onClick={handleSearch}
          className="ml-2 bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition"
        >
          Suchen
        </button>
      </div>
      
      {isSearching && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg">
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        </div>
      )}
      
      {searchResults.length > 0 && !isSearching && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg">
          <ul className="py-1">
            {searchResults.map((location) => (
              <li 
                key={location.id}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <MapPin size={18} className="text-gray-500 mr-2" />
                    <span>{location.name}</span>
                  </div>
                  
                  {!isLocationSaved(location.id) && (
                    <button
                      onClick={() => handleAddLocation(location)}
                      className="text-blue-500 hover:text-blue-700"
                      title="Standort hinzufügen"
                    >
                      <Plus size={18} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LocationSearch;