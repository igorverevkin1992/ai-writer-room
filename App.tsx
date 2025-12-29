
import React, { useState, useEffect } from 'react';
import { BibleManager } from './components/BibleManager';
import { AgentSidebar } from './components/AgentSidebar';
import { WriterEditor } from './components/WriterEditor';
import { Bible, Scene, AgentStatus, ContinuityError, AgentType } from './types';
import { runPlannerAgent, runWriterAgent, runContinuityAgent, runEditorAgent, runVisualizerAgent } from './services/geminiService';

const INITIAL_BIBLE: Bible = {
  summary: "A cyberpunk noir set in Neo-Tokyo 2099. Detective Kaito investigates a series of android malfunctions that point to a rogue AI god.",
  characters: [
    { id: "1", name: "Kaito", traits: ["Cynical"], arcStatus: "Alive", description: "A detective with a cybernetic eye." },
    { id: "2", name: "Aria", traits: ["Mysterious"], arcStatus: "Alive", description: "An android who claims to dream." }
  ],
  locations: [
    { id: "1", name: "The Neon Bazaar", description: "A crowded, rain-slicked market." }
  ]
};

const INITIAL_SCENE: Scene = {
  id: "scene-1",
  title: "Chapter 1: The Glitch",
  beatSheet: "",
  content: "",
  version: 1,
  lastAgent: null
};

const Toast = ({ message, type, onClose }: { message: string, type: 'error' | 'success', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-12 right-8 px-6 py-4 rounded-lg shadow-lg text-white font-medium z-50 flex items-center gap-3 animate-slide-up ${
      type === 'error' ? 'bg-red-600' : 'bg-green-600'
    }`}>
      <span>{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 font-bold text-lg">×</button>
    </div>
  );
};

const App: React.FC = () => {
  const [bible, setBible] = useState<Bible>(INITIAL_BIBLE);
  const [scenes, setScenes] = useState<Scene[]>([INITIAL_SCENE]);
  const [activeSceneId, setActiveSceneId] = useState<string>(INITIAL_SCENE.id);
  const [isLoaded, setIsLoaded] = useState(false);
  // The API key is managed externally.
  const [hasApiKey, setHasApiKey] = useState(true);
  
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ isWorking: false });
  const [continuityErrors, setContinuityErrors] = useState<ContinuityError[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'error'|'success'} | null>(null);

  useEffect(() => {
    // API key check moved to boolean literal as it's a hard requirement handled externally.
    const key = process.env.API_KEY;
    setHasApiKey(!!key && key.length > 0);
  }, []);

  useEffect(() => {
    const savedBible = localStorage.getItem('vwr_bible');
    const savedScenes = localStorage.getItem('vwr_scenes');
    if (savedBible) setBible(JSON.parse(savedBible));
    if (savedScenes) {
      const parsed = JSON.parse(savedScenes);
      if (parsed.length > 0) setScenes(parsed);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('vwr_bible', JSON.stringify(bible));
      localStorage.setItem('vwr_scenes', JSON.stringify(scenes));
    }
  }, [bible, scenes, isLoaded]);

  const activeScene = scenes.find(s => s.id === activeSceneId) || scenes[0];

  const updateActiveScene = (updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, ...updates } : s));
  };

  const handleAddScene = () => {
    const newScene: Scene = { id: crypto.randomUUID(), title: `Scene ${scenes.length + 1}`, beatSheet: "", content: "", version: 1, lastAgent: null };
    setScenes(prev => [...prev, newScene]);
    setActiveSceneId(newScene.id);
  };

  const handleAgentAction = async (type: AgentType, input?: string) => {
    if (!hasApiKey) {
       setToast({ message: "API Service is unavailable.", type: 'error' });
       return;
    }
    setAgentStatus({ isWorking: true, currentTask: type, agentName: type.toUpperCase() });
    try {
      if (type === 'planner') {
        const plan = await runPlannerAgent(bible, input || "");
        updateActiveScene({ beatSheet: plan, lastAgent: 'planner' });
      } else if (type === 'writer') {
        const draft = await runWriterAgent(bible, activeScene.beatSheet, activeScene.content);
        updateActiveScene({ content: draft, lastAgent: 'writer' });
      } else if (type === 'continuity') {
        const errors = await runContinuityAgent(bible, activeScene.content);
        setContinuityErrors(errors);
      } else if (type === 'editor') {
        const edited = await runEditorAgent(activeScene.content, input || "");
        updateActiveScene({ content: edited, lastAgent: 'editor' });
      } else if (type === 'visualizer') {
        const imageUrl = await runVisualizerAgent(bible, activeScene.title, activeScene.content || activeScene.beatSheet);
        if (imageUrl) updateActiveScene({ imageUrl, lastAgent: 'visualizer' });
      }
    } catch (error: any) {
      setToast({ message: "AI Action failed. See console for details.", type: 'error' });
    } finally {
      setAgentStatus({ isWorking: false });
    }
  };

  if (!isLoaded) return <div className="h-screen w-screen bg-gray-950 flex items-center justify-center text-gray-500 font-mono tracking-tighter">INITIALIZING...</div>;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950 text-gray-100 font-sans relative">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <BibleManager 
        bible={bible} 
        onUpdate={setBible} 
        onReset={() => { if(confirm('Erase all story data?')) { localStorage.clear(); window.location.reload(); } }} 
        hasApiKey={hasApiKey}
      />

      <div className="flex-1 flex flex-col min-w-0 border-l border-gray-800">
        <WriterEditor 
          content={activeScene.content} 
          onChange={(val) => updateActiveScene({ content: val })}
          title={activeScene.title}
          onTitleChange={(val) => updateActiveScene({ title: val })}
          imageUrl={activeScene.imageUrl}
          scenes={scenes}
          activeSceneId={activeSceneId}
          onSelectScene={setActiveSceneId}
          onAddScene={handleAddScene}
          onDeleteScene={(id, e) => { e.stopPropagation(); if (scenes.length > 1) setScenes(scenes.filter(s => s.id !== id)); }}
          hasApiKey={hasApiKey}
          onOpenKeyDialog={() => {}} 
        />
      </div>

      <AgentSidebar 
        status={agentStatus}
        continuityErrors={continuityErrors}
        onAction={handleAgentAction}
        plan={activeScene.beatSheet}
        setPlan={(val) => updateActiveScene({ beatSheet: val })}
      />
    </div>
  );
};

export default App;
