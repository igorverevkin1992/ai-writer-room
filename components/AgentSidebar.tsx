import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AgentType, AgentStatus, ContinuityError } from '../types';
import { Button } from './Button';

interface AgentSidebarProps {
  status: AgentStatus;
  continuityErrors: ContinuityError[];
  onAction: (action: AgentType, input?: string) => void;
  plan: string;
  setPlan: (plan: string) => void;
  onClearErrors?: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ 
  status, 
  continuityErrors, 
  onAction,
  plan,
  setPlan,
  onClearErrors
}) => {
  const [activeAgent, setActiveAgent] = useState<AgentType>('planner');
  const [promptInput, setPromptInput] = useState('');
  
  // Clear input when agent changes
  useEffect(() => {
    setPromptInput('');
  }, [activeAgent]);

  // Use a callback ref to auto-resize any textarea that mounts
  const textAreaRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (node) {
      node.style.height = 'auto';
      node.style.height = node.scrollHeight + 'px';
    }
  }, [promptInput, plan]); // Re-run when content changes

  const handleRun = () => {
    onAction(activeAgent, promptInput);
  };

  const isThinking = status.modelName?.toLowerCase().includes("thinking");

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-700 flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-mono font-bold text-white flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status.isWorking ? 'animate-pulse' : ''} ${status.isWorking ? (isThinking ? 'bg-purple-400' : 'bg-green-500') : 'bg-gray-600'}`}></span>
          AI AGENTS
        </h2>
        {status.isWorking && (
          <div className="flex flex-col items-end">
            <span className={`text-xs font-mono font-bold animate-pulse ${isThinking ? 'text-purple-400' : 'text-green-500'}`}>
              {isThinking ? 'THINKING...' : 'GENERATING...'}
            </span>
            <span className="text-[10px] text-gray-500 font-mono">
              {status.modelName}
            </span>
          </div>
        )}
      </div>

      {/* Agent Selector */}
      <div className="flex flex-wrap border-b border-gray-700">
        {(['planner', 'writer', 'continuity', 'editor', 'visualizer'] as AgentType[]).map(agent => (
          <button
            key={agent}
            onClick={() => setActiveAgent(agent)}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeAgent === agent 
                ? 'border-indigo-500 text-white bg-gray-800' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {agent.slice(0, 5)}
          </button>
        ))}
      </div>

      {/* Workspace */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Context Info */}
        <div className="bg-gray-800 p-3 rounded text-xs text-gray-400 border border-gray-700">
          <div className="font-bold text-gray-300 mb-1 uppercase">Active Agent: {activeAgent}</div>
          {activeAgent === 'planner' && "Goal: Generate Beat Sheet from rough idea."}
          {activeAgent === 'writer' && "Goal: Draft prose based on Beat Sheet."}
          {activeAgent === 'continuity' && "Goal: Check consistency against Bible."}
          {activeAgent === 'editor' && "Goal: Refine style and prose."}
          {activeAgent === 'visualizer' && "Goal: Create concept art/mood board."}
        </div>

        {/* Inputs based on Agent */}
        {activeAgent === 'planner' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500">SCENE IDEA / PROMPT</label>
              <textarea
                ref={textAreaRef}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                className="w-full bg-gray-850 border border-gray-700 rounded p-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
                placeholder="e.g. The hero enters the bar and finds the artifact..."
              />
              <Button onClick={handleRun} isLoading={status.isWorking} className="w-full">
                Generate Beat Sheet
              </Button>
            </div>
            {/* Show result if available */}
            {plan && (
              <div className="space-y-2 pt-4 border-t border-gray-800">
                <label className="text-xs font-bold text-indigo-400">GENERATED PLAN</label>
                <div className="bg-gray-850 p-3 rounded text-xs text-gray-300 font-mono border border-gray-700 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono">{plan}</pre>
                </div>
                <button 
                  onClick={() => setActiveAgent('writer')} 
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                >
                  Go to Writer Agent &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {activeAgent === 'writer' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500">CURRENT BEAT SHEET</label>
            <textarea
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full bg-gray-850 border border-gray-700 rounded p-3 text-sm font-mono text-green-400 focus:outline-none focus:border-indigo-500 h-64"
              placeholder="No plan generated yet... Use the Planner first."
            />
             <Button onClick={handleRun} isLoading={status.isWorking} className="w-full">
              Write Scene Draft
            </Button>
          </div>
        )}

        {activeAgent === 'continuity' && (
          <div className="space-y-4">
            <Button onClick={handleRun} isLoading={status.isWorking} className="w-full" variant="secondary">
              Check Current Scene
            </Button>
            
            {continuityErrors.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-red-400">Issues Found ({continuityErrors.length})</h3>
                  {onClearErrors && (
                    <button onClick={onClearErrors} className="text-xs text-gray-500 hover:text-white underline">
                      Clear
                    </button>
                  )}
                </div>
                {continuityErrors.map((err, idx) => (
                  <div key={idx} className={`p-3 rounded border text-sm ${
                    err.severity === 'critical' ? 'bg-red-900/20 border-red-800 text-red-200' : 'bg-yellow-900/20 border-yellow-800 text-yellow-200'
                  }`}>
                    <div className="font-bold mb-1 uppercase text-xs opacity-75">{err.severity}</div>
                    <div>{err.message}</div>
                    {err.quote && <div className="mt-2 text-xs opacity-50 italic">"{err.quote}"</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-600 text-sm mt-4">
                No issues found (or run check to update).
              </div>
            )}
          </div>
        )}

        {activeAgent === 'editor' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500">EDIT INSTRUCTIONS</label>
            <textarea
              ref={textAreaRef}
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="w-full bg-gray-850 border border-gray-700 rounded p-3 text-sm text-white focus:outline-none focus:border-indigo-500 min-h-[100px] resize-none"
              placeholder="e.g. Make the dialogue snappier, change tone to noir..."
            />
            <Button onClick={handleRun} isLoading={status.isWorking} className="w-full">
              Apply Edits
            </Button>
          </div>
        )}

        {activeAgent === 'visualizer' && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-850 rounded border border-gray-700 text-center">
              <span className="text-4xl mb-2 block">🎨</span>
              <p className="text-sm text-gray-400 mb-4">
                Generate a concept illustration based on your scene content and Project Bible style.
              </p>
              <Button onClick={handleRun} isLoading={status.isWorking} className="w-full" variant="secondary">
                Generate Scene Art
              </Button>
            </div>
            <p className="text-xs text-gray-600 text-center">
              Generates a 1024x1024 image using Gemini 2.5 Flash Image.
            </p>
          </div>
        )}

      </div>
    </div>
  );
};