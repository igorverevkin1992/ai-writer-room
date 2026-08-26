import Dexie, { type Table } from 'dexie';
import type {
  AIConversation,
  Character,
  CharacterArcState,
  GenreBeat,
  Project,
  Scene,
  StoryBible,
  StructureNode,
} from '../types';

export class WritersRoomDB extends Dexie {
  projects!: Table<Project, string>;
  bibles!: Table<StoryBible, string>;
  beats!: Table<GenreBeat, string>;
  nodes!: Table<StructureNode, string>;
  characters!: Table<Character, string>;
  arcStates!: Table<CharacterArcState, string>;
  scenes!: Table<Scene, string>;
  conversations!: Table<AIConversation, string>;

  constructor(name = 'writers-room-os') {
    super(name);
    this.version(1).stores({
      projects: 'id, title, updatedAt',
      bibles: 'id, projectId',
      beats: 'id, projectId, [projectId+genre], assignedNodeId, status',
      nodes: 'id, projectId, parentId, [projectId+level], [parentId+order]',
      characters: 'id, projectId, [projectId+order]',
      arcStates: 'id, projectId, characterId, structureNodeId, [characterId+structureNodeId]',
      scenes: 'id, projectId, parentNodeId, [parentNodeId+order]',
      conversations: 'id, projectId, [projectId+mode], updatedAt',
    });
  }
}

export const db = new WritersRoomDB();

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
