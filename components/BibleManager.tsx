
import React, { useState } from 'react';
import { Bible, Character, Location } from '../types';
import { Button } from './Button';

interface BibleManagerProps {
  bible: Bible;
  onUpdate: (bible: Bible) => void;
  onReset?: () => void;
  hasApiKey: boolean;
}

export const BibleManager: React.FC<BibleManagerProps> = ({ bible, onUpdate, onReset, hasApiKey }) => {
  const [activeTab, setActiveTab] = useState<'characters' | 'locations' | 'summary' | 'settings'>('summary');

  const handleUpdateSummary = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ ...bible, summary: e.target.value });
  };

  const addCharacter = () => {
    const newChar: Character = {
      id: crypto.randomUUID(),
      name: "New Character",
      traits: [],
      arcStatus: "Alive",
      description: "Description..."
    };
    onUpdate({ ...bible, characters: [...(bible.characters || []), newChar] });
  };

  const deleteCharacter = (id: string) => {
    if (confirm('Delete this character?')) {
      onUpdate({ ...bible, characters: (bible.characters || []).filter(c => c.id !== id) });
    }
  };

  const updateCharacter = (id: string, field: keyof Character, value: any) => {
    const updatedChars = (bible.characters || []).map(c => {
      if (c.id === id) {
        if (field === 'traits' && typeof value === 'string') {
             return { ...c, traits: value.split(',').map(s => s.trim()) };
        }
        return { ...c, [field]: value };
      }
      return c;
    });
    onUpdate({ ...bible, characters: updatedChars });
  };

  const addLocation = () => {
    const newLoc: Location = {
      id: crypto.randomUUID(),
      name: "New Location",
      description: "Description..."
    };
    onUpdate({ ...bible, locations: [...(bible.locations || []), newLoc] });
  };

  const deleteLocation = (id: string) => {
     if (confirm('Delete this location?')) {
      onUpdate({ ...bible, locations: (bible.locations || []).filter(l => l.id !== id) });
    }
  };

  const updateLocation = (id: string, field: keyof Location, value: string) => {
    const updatedLocs = (bible.locations || []).map(l => {
      if (l.id === id) {
        return { ...l, [field]: value };
      }
      return l;
    });
    onUpdate({ ...bible, locations: updatedLocs });
  };

  return (
    <div className="h-full flex flex-col bg-gray-850 border-r border-gray-700 w-96 overflow-hidden shrink-0">
      <div className="p-4 border-b border-gray-700 bg-gray-900">
        <h2 className="text-xl font-serif text-white mb-2">Project Bible</h2>
        <div className="flex flex-wrap gap-2">
          {['summary', 'characters', 'locations', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded transition-all ${
                activeTab === tab 
                ? 'bg-indigo-600 text-white' 
                : 'text-gray-500 hover:text-gray-300 bg-gray-800/50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {activeTab === 'summary' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase font-bold">Story Summary</label>
            <textarea
              className="w-full h-96 bg-gray-900 border border-gray-700 rounded p-3 text-gray-300 focus:border-indigo-500 focus:outline-none resize-none font-serif leading-relaxed"
              value={bible.summary || ''}
              onChange={handleUpdateSummary}
              placeholder="Enter the main premise of your story here..."
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
             <div className="p-4 bg-gray-900 rounded border border-gray-700">
                <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-tighter">System Status</h3>
                <div className="flex items-center gap-2 mb-4">
                   <div className={`w-3 h-3 rounded-full ${hasApiKey ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`}></div>
                   <span className="text-xs font-mono uppercase">
                      {hasApiKey ? 'AI ENGINE READY' : 'AI ENGINE DISCONNECTED'}
                   </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                   The application uses Gemini models for story planning, prose generation, and continuity checking.
                </p>
             </div>

             <div className="p-4 border border-red-900/30 rounded bg-red-950/10">
                <h3 className="text-xs font-bold text-red-400 mb-2">DANGER ZONE</h3>
                <Button variant="danger" onClick={onReset} className="w-full text-[10px] py-1">
                   RESET ALL DATA
                </Button>
             </div>
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase font-bold">Characters ({(bible.characters || []).length})</span>
              <button onClick={addCharacter} className="text-indigo-400 hover:text-white text-xs font-bold">+ ADD NEW</button>
            </div>
            {(bible.characters || []).map(char => (
              <div key={char.id} className="bg-gray-900 p-3 rounded border border-gray-700 space-y-3 relative group">
                <button onClick={() => deleteCharacter(char.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                <input
                  type="text"
                  value={char.name || ''}
                  onChange={(e) => updateCharacter(char.id, 'name', e.target.value)}
                  className="w-full bg-transparent border-b border-gray-800 pb-1 text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                  placeholder="Name"
                />
                <textarea
                  value={char.description || ''}
                  onChange={(e) => updateCharacter(char.id, 'description', e.target.value)}
                  className="w-full bg-gray-800 rounded p-2 text-xs text-gray-300 focus:outline-none h-16 resize-none"
                  placeholder="Description..."
                />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400 uppercase font-bold">Locations ({(bible.locations || []).length})</span>
              <button onClick={addLocation} className="text-indigo-400 hover:text-white text-xs font-bold">+ ADD NEW</button>
            </div>
            {(bible.locations || []).map(loc => (
              <div key={loc.id} className="bg-gray-900 p-3 rounded border border-gray-700 space-y-3 relative group">
                <button onClick={() => deleteLocation(loc.id)} className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                <input
                  type="text"
                  value={loc.name || ''}
                  onChange={(e) => updateLocation(loc.id, 'name', e.target.value)}
                  className="w-full bg-transparent border-b border-gray-800 pb-1 text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                  placeholder="Location Name"
                />
                <textarea
                  value={loc.description || ''}
                  onChange={(e) => updateLocation(loc.id, 'description', e.target.value)}
                  className="w-full bg-gray-800 rounded p-2 text-xs text-gray-300 focus:outline-none h-16 resize-none"
                  placeholder="Atmosphere..."
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
