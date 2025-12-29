import React, { useState } from 'react';
import { AgentStatus, ContinuityError, AgentType } from '../types/types';

interface AgentSidebarProps {
  status: AgentStatus;
  continuityErrors: ContinuityError[];
  onAction: (type: AgentType, input?: string) => void;
  plan: string;
  setPlan: (plan: string) => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ 
  status, 
  continuityErrors, 
  onAction,
  plan,
  setPlan
}) => {
  const [activeTab, setActiveTab] = useState<AgentType>('planner');
  const [plannerInput, setPlannerInput] = useState('');
  const [editorInput, setEditorInput] = useState('');

  const tabs: {id: AgentType, label: string}[] = [
    { id: 'planner', label: 'PLANN' },
    { id: 'writer', label: 'WRITE' },
    { id: 'continuity', label: 'CONTI' },
    { id: 'editor', label: 'EDITO' },
    { id: 'visualizer', label: 'VISUA' },
  ];

  // Единый стиль для всех текстовых полей
  const textAreaStyle = "w-full p-3 bg-gray-800 text-gray-100 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none placeholder-gray-500 text-sm leading-relaxed";
  
  // Единый стиль для областей чтения (например, просмотр плана)
  const readOnlyStyle = "w-full h-64 p-3 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg overflow-y-auto text-sm whitespace-pre-wrap font-mono";

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col h-full shadow-2xl z-10">
      {/* Tabs Header */}
      <div className="flex border-b border-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-bold tracking-wider transition-colors ${
              activeTab === tab.id 
                ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-500' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {/* Agent Status Box */}
        <div className="mb-6 p-4 rounded-lg bg-gray-800/50 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">
              Active Agent: <span className="text-blue-400">{activeTab}</span>
            </h3>
            {status.isWorking && status.agentName === activeTab.toUpperCase() && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {activeTab === 'planner' && "Goal: Generate Beat Sheet from rough idea."}
            {activeTab === 'writer' && "Goal: Draft prose based on Beat Sheet."}
            {activeTab === 'continuity' && "Goal: Check consistency with Project Bible."}
            {activeTab === 'editor' && "Goal: Refine style and prose."}
            {activeTab === 'visualizer' && "Goal: Create concept art."}
          </p>
        </div>

        {/* --- PLANNER TAB --- */}
        {activeTab === 'planner' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Scene Idea / Prompt</label>
              <textarea
                className={`${textAreaStyle} h-32`}
                placeholder="e.g. The hero enters the bar and finds the artifact..."
                value={plannerInput}
                onChange={(e) => setPlannerInput(e.target.value)}
              />
            </div>
            
            <button
              onClick={() => onAction('planner', plannerInput)}
              disabled={status.isWorking}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
            >
              {status.isWorking ? 'Thinking...' : 'Generate Beat Sheet'}
            </button>

            {plan && (
              <div className="mt-6 pt-6 border-t border-gray-800">
                <label className="block text-xs font-bold text-blue-400 uppercase mb-2">Generated Plan</label>
                <textarea
                    className={`${textAreaStyle} h-64 font-mono text-xs`}
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* --- WRITER TAB --- */}
        {activeTab === 'writer' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Current Beat Sheet</label>
              {/* Исправлено: заменен белый фон на темный (readOnlyStyle) */}
              <div className={readOnlyStyle}>
                {plan || <span className="text-gray-600 italic">No beat sheet generated yet. Go to Planner first.</span>}
              </div>
            </div>
            <button
              onClick={() => onAction('writer')}
              disabled={status.isWorking || !plan}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all disabled:opacity-50"
            >
              {status.isWorking ? 'Writing...' : 'Write Scene Draft'}
            </button>
          </div>
        )}

        {/* --- CONTINUITY TAB --- */}
        {/* --- CONTINUITY TAB --- */}
        {activeTab === 'continuity' && (
          <div className="space-y-4 animate-fade-in">
            <button
              onClick={() => onAction('continuity')}
              disabled={status.isWorking}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 shadow-lg shadow-purple-900/20"
            >
              {status.isWorking ? 'Checking...' : 'Check Consistency'}
            </button>

            {continuityErrors.length > 0 ? (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs uppercase font-bold text-gray-400 mb-2">
                  <span>Found Issues</span>
                  <span className="bg-red-600 text-white px-2 py-0.5 rounded-full">{continuityErrors.length}</span>
                </div>
                
                {continuityErrors.map((err, i) => (
                  <div key={i} className="p-4 bg-red-950/50 border border-red-500/30 rounded-lg text-sm shadow-sm backdrop-blur-sm">
                    <div className="flex gap-3">
                      <span className="text-red-500 text-lg">⚠️</span>
                      <div className="flex-1">
                        <strong className="block text-red-300 text-xs font-bold uppercase tracking-wider mb-1">
                          {err.type || "Potential Issue"}
                        </strong>
                        <p className="text-gray-100 leading-relaxed">
                          {err.description || "No description provided by AI."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg">
                <span className="text-4xl block mb-3">✅</span>
                <p className="text-gray-400 text-sm font-medium">No consistency errors found.</p>
                <p className="text-gray-600 text-xs mt-1">Your story matches the Project Bible.</p>
              </div>
            )}
          </div>
        )}

        {/* --- EDITOR TAB --- */}
        {activeTab === 'editor' && (
          <div className="space-y-4 animate-fade-in">
             <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Edit Instructions</label>
              {/* Исправлено: добавлен темный стиль (textAreaStyle) */}
              <textarea
                className={`${textAreaStyle} h-32`}
                placeholder="e.g. Make the dialogue snappier, describe the rain in more detail..."
                value={editorInput}
                onChange={(e) => setEditorInput(e.target.value)}
              />
            </div>
            <button
              onClick={() => onAction('editor', editorInput)}
              disabled={status.isWorking}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all disabled:opacity-50"
            >
              {status.isWorking ? 'Editing...' : 'Apply Edits'}
            </button>
          </div>
        )}

        {/* --- VISUALIZER TAB --- */}
        {activeTab === 'visualizer' && (
           <div className="space-y-4 animate-fade-in">
            <p className="text-sm text-gray-400 mb-4">
              Generates a visual representation of the current scene using Gemini Image generation.
            </p>
            <button
              onClick={() => onAction('visualizer')}
              disabled={status.isWorking}
              className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-lg transition-all disabled:opacity-50"
            >
              {status.isWorking ? 'Painting...' : 'Generate Concept Art'}
            </button>
           </div>
        )}

      </div>
    </div>
  );
};