import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import LocationSearch from './LocationSearch';

const AddLocationButton: React.FC = () => {
  const [showSearch, setShowSearch] = useState(false);
  
  return (
    <div className="mb-4">
      {showSearch ? (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-medium mb-2">Standort hinzufügen</h3>
          <LocationSearch />
          <div className="mt-2 text-right">
            <button 
              onClick={() => setShowSearch(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowSearch(true)}
          className="w-full bg-white hover:bg-gray-50 rounded-lg shadow-md p-3 flex items-center justify-center gap-2 text-blue-600 transition-colors"
        >
          <Plus size={20} />
          <span>Standort hinzufügen</span>
        </button>
      )}
    </div>
  );
};

export default AddLocationButton;