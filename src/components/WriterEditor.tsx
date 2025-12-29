import React, { useState } from 'react';
import { Scene } from '../types/types';

interface WriterEditorProps {
  content: string;
  onChange: (val: string) => void;
  title: string;
  onTitleChange: (val: string) => void;
  imageUrl?: string;
  scenes: Scene[];
  activeSceneId: string;
  onSelectScene: (id: string) => void;
  onAddScene: () => void;
  onDeleteScene: (id: string, e: React.MouseEvent) => void;
  hasApiKey: boolean;
  onOpenKeyDialog: () => void;
}

export const WriterEditor: React.FC<WriterEditorProps> = ({
  content,
  onChange,
  title,
  onTitleChange,
  imageUrl,
  scenes,
  activeSceneId,
  onSelectScene,
  onAddScene,
  onDeleteScene,
  hasApiKey
}) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Top Bar: Scene Tabs */}
      <div className="flex items-center bg-gray-900 border-b border-gray-800 overflow-x-auto no-scrollbar">
        {scenes.map(scene => (
          <div
            key={scene.id}
            onClick={() => onSelectScene(scene.id)}
            className={`group flex items-center px-4 py-3 text-sm cursor-pointer border-r border-gray-800 min-w-[120px] max-w-[200px] ${
              scene.id === activeSceneId 
                ? 'bg-gray-800 text-white border-t-2 border-t-blue-500' 
                : 'text-gray-500 hover:bg-gray-800/50 hover:text-gray-300'
            }`}
          >
            <span className="truncate mr-2">{scene.title}</span>
            <button
              onClick={(e) => onDeleteScene(scene.id, e)}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={onAddScene}
          className="px-4 py-3 text-gray-500 hover:text-white hover:bg-gray-800 transition-colors font-bold text-lg"
        >
          +
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Column */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          
          {/* Title Input */}
          <div className="p-6 pb-2">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full bg-transparent text-3xl font-bold text-white placeholder-gray-600 focus:outline-none"
              placeholder="Scene Title"
            />
          </div>

          {/* Text Area Container */}
          <div className="flex-1 relative">
            
            {/* 🔥 COPY BUTTON (Floating top-right) */}
            <button
              onClick={handleCopy}
              className="absolute top-4 right-6 z-10 p-2 bg-gray-800/80 hover:bg-blue-600 text-gray-400 hover:text-white rounded-md backdrop-blur-sm transition-all shadow-lg border border-gray-700"
              title="Copy to clipboard"
            >
              {isCopied ? (
                // Checkmark Icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                // Copy Icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            <textarea
              className="w-full h-full p-8 pt-6 bg-gray-950 text-gray-100 text-lg leading-relaxed focus:outline-none resize-none font-serif custom-scrollbar"
              placeholder="Start writing your scene here..."
              value={content}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Visualizer Image Column (Right) */}
        {imageUrl && (
          <div className="w-80 border-l border-gray-800 bg-gray-900 p-4 flex flex-col gap-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase">Visual Reference</h3>
            <div className="rounded-lg overflow-hidden border border-gray-700 shadow-lg">
              <img src={imageUrl} alt="Concept Art" className="w-full h-auto object-cover" />
            </div>
            <button 
              onClick={() => {}} // Placeholder for future download
              className="text-xs text-blue-400 hover:underline text-center"
            >
              Download Image
            </button>
          </div>
        )}
      </div>
    </div>
  );
};