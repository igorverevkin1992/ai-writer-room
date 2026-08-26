import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { ContextBundle } from '../ai/context';
import type { ID } from '../types';

export function useProjects() {
  return useLiveQuery(async () => (await db.projects.toArray()).sort((a, b) => b.updatedAt - a.updatedAt), [], undefined);
}

export function useProject(projectId: ID | undefined) {
  return useLiveQuery(() => (projectId ? db.projects.get(projectId) : undefined), [projectId]);
}

export function useBundle(projectId: ID | undefined): ContextBundle | undefined {
  return useLiveQuery(async () => {
    if (!projectId) return undefined;
    const project = await db.projects.get(projectId);
    if (!project) return undefined;
    const [bible, beats, nodes, characters, arcStates, scenes] = await Promise.all([
      db.bibles.where({ projectId }).first(),
      db.beats.where({ projectId }).toArray(),
      db.nodes.where({ projectId }).toArray(),
      db.characters.where({ projectId }).toArray(),
      db.arcStates.where({ projectId }).toArray(),
      db.scenes.where({ projectId }).toArray(),
    ]);
    return {
      project,
      bible,
      beats: beats.sort((a, b) => a.beatIndex - b.beatIndex),
      nodes: nodes.sort((a, b) => a.order - b.order),
      characters: characters.sort((a, b) => a.order - b.order),
      arcStates,
      scenes: scenes.sort((a, b) => a.order - b.order),
    } satisfies ContextBundle;
  }, [projectId]);
}

export function useConversations(projectId: ID | undefined, mode: string | undefined) {
  return useLiveQuery(async () => {
    if (!projectId || !mode) return [];
    return (await db.conversations.where({ projectId }).toArray())
      .filter((c) => c.mode === mode)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projectId, mode]);
}
