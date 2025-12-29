export interface Character {
  id: string;
  name: string;
  traits: string[];
  arcStatus: string;
  description: string;
}

export interface Location {
  id: string;
  name: string;
  description: string;
}

export interface Bible {
  characters: Character[];
  locations: Location[];
  summary: string;
}

export interface Scene {
  id: string;
  title: string;
  beatSheet: string; // The Plan
  content: string;   // The Draft
  imageUrl?: string; // The Visualization
  version: number;
  lastAgent: 'planner' | 'writer' | 'editor' | 'visualizer' | null;
}

export interface ContinuityError {
  severity: 'critical' | 'warning';
  message: string;
  quote?: string;
}

export type AgentType = 'planner' | 'writer' | 'continuity' | 'editor' | 'visualizer';

export interface AgentStatus {
  isWorking: boolean;
  currentTask?: string;
  agentName?: string;
  modelName?: string;
}