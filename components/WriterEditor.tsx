
import React, { useState, useRef, useEffect } from 'react';
import { Scene } from '../types';
import { generateSceneAudio, decodeBase64, decodeAudioData } from '../services/geminiService';
import { Button } from './Button';

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
  content, onChange, title, onTitleChange, imageUrl,
  scenes, activeSceneId, onSelectScene, onAddScene, onDeleteScene,
  hasApiKey, onOpenKeyDialog
}) => {
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const safeContent = content || "";

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [safeContent, activeSceneId]);

  const handleReadAloud = async () => {
    if (isPlaying) {
      currentSourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }
    if (!safeContent.trim()) return;
    
    setIsGeneratingAudio(true);
    const base64Audio = await generateSceneAudio(safeContent);
    setIsGeneratingAudio(false);

    if (base64Audio) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      currentSourceRef.current = source;
      setIsPlaying(true);
      source.start(0);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] relative min-w-0">
      {/* Top Tabs */}
      <div className="h-10 bg-[#161616] flex items-center border-b border-gray-800 overflow-x-auto no-scrollbar shrink-0">
        {scenes.map(scene => (
          <div 
            key={scene.id}
            onClick={() => onSelectScene(scene.id)}
            className={`group flex items-center px-4 h-full text-xs font-medium cursor-pointer border-r border-gray-800 select-none min-w-[120px] max-w-[200px] transition-colors relative ${
              scene.id === activeSceneId ? 'bg-[#1e1e1e] text-indigo-400 border-t-2 border-t-indigo-500' : 'text-gray-500 border-t-2 border-t-transparent hover:bg-[#252525]'
            }`}
          >
            <span className="truncate w-full">{scene.title}</span>
            {scenes.length > 1 && <button onClick={(e) => onDeleteScene(scene.id, e)} className="opacity-0 group-hover:opacity-100 ml-2 hover:text-red-400 font-bold">×</button>}
          </div>
        ))}
        <button onClick={onAddScene} className="px-3 h-full text-gray-500 hover:text-indigo-400 hover:bg-[#252525] border-r border-gray-800 font-bold text-lg">+</button>
      </div>

      {/* Editor Header */}
      <div className="p-8 pb-4 shrink-0 flex justify-between items-start gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="bg-transparent text-4xl font-serif font-bold text-gray-200 focus:outline-none placeholder-gray-700 w-full"
            placeholder="Untitled Scene..."
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            variant={isPlaying ? "danger" : "secondary"}
            onClick={handleReadAloud} 
            isLoading={isGeneratingAudio}
          >
            {isPlaying ? 'Stop' : 'Read'}
          </Button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {imageUrl && (
          <div className="w-full h-48 relative mb-8">
            <img src={imageUrl} alt="Visual" className="w-full h-full object-cover opacity-80" onError={(e) => (e.currentTarget.style.display = 'none')} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e1e] to-transparent" />
          </div>
        )}
        <div className="px-8 pb-32 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            value={safeContent}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent text-gray-300 font-serif text-lg leading-relaxed focus:outline-none resize-none placeholder-gray-800 min-h-[50vh]"
            placeholder="Once upon a time..."
            spellCheck={false}
          />
        </div>
      </div>
      
      {/* Bottom Status Bar */}
      <div className="h-8 bg-[#161616] border-t border-gray-800 flex items-center px-4 text-[10px] text-gray-500 justify-between shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-red-500'}`} />
            {hasApiKey ? 'ENGINE ONLINE' : 'ENGINE OFFLINE'}
          </span>
        </div>
        <div className="flex gap-4">
          <span>{safeContent.split(/\s+/).filter(w => w.length > 0).length} words</span>
          <span>{scenes.length} scene(s)</span>
        </div>
      </div>
    </div>
  );
};
