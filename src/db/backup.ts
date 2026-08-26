import { db } from './db';
import { normalizeCircle } from './repo';
import type { ID, Project } from '../types';

export const BACKUP_FORMAT = 'writers-room-os/project-export';
export const BACKUP_VERSION = 1;

export interface ProjectExport {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  project: Project;
  bible: unknown;
  beats: unknown[];
  nodes: unknown[];
  characters: unknown[];
  arcStates: unknown[];
  scenes: unknown[];
  conversations: unknown[];
}

export async function exportProject(projectId: ID): Promise<ProjectExport> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Проект не найден');
  const [bible, beats, nodes, characters, arcStates, scenes, conversations] = await Promise.all([
    db.bibles.where({ projectId }).first(),
    db.beats.where({ projectId }).toArray(),
    db.nodes.where({ projectId }).toArray(),
    db.characters.where({ projectId }).toArray(),
    db.arcStates.where({ projectId }).toArray(),
    db.scenes.where({ projectId }).toArray(),
    db.conversations.where({ projectId }).toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    project,
    bible: bible ?? null,
    beats,
    nodes,
    characters,
    arcStates,
    scenes,
    conversations,
  };
}

export function downloadProjectExport(data: ProjectExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = data.project.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase() || 'project';
  a.href = url;
  a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  projectId: ID;
  replaced: boolean;
  counts: Record<string, number>;
}

/**
 * Импорт проекта из JSON. `mode: 'replace'` перезаписывает проект с тем же id,
 * `mode: 'copy'` — создаёт независимую копию с новыми идентификаторами.
 */
export async function importProject(
  raw: unknown,
  mode: 'replace' | 'copy' = 'replace',
): Promise<ImportResult> {
  const data = raw as ProjectExport;
  if (!data || data.format !== BACKUP_FORMAT) {
    throw new Error('Файл не похож на экспорт Writers Room OS');
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error(`Версия формата ${String(data.version)} новее, чем понимает это приложение`);
  }

  const idMap = new Map<string, string>();
  const remap = (id: string | null | undefined): string | null => {
    if (id === null || id === undefined) return null;
    if (mode === 'replace') return id;
    if (!idMap.has(id)) idMap.set(id, crypto.randomUUID());
    return idMap.get(id)!;
  };

  const projectId = remap(data.project.id)!;
  const project: Project = {
    ...data.project,
    id: projectId,
    title: mode === 'copy' ? `${data.project.title} (копия)` : data.project.title,
    updatedAt: Date.now(),
  };

  const nodes = (data.nodes as Record<string, unknown>[]).map((n) => ({
    ...n,
    id: remap(n.id as string)!,
    projectId,
    parentId: remap(n.parentId as string | null),
    circle: normalizeCircle(n.circle as never),
    continuityAck: Boolean(n.continuityAck),
  }));

  const beats = (data.beats as Record<string, unknown>[]).map((b) => ({
    ...b,
    id: remap(b.id as string)!,
    projectId,
    assignedNodeId: remap(b.assignedNodeId as string | null),
  }));

  const characters = (data.characters as Record<string, unknown>[]).map((c) => ({
    ...c,
    id: remap(c.id as string)!,
    projectId,
    relationships: ((c.relationships as { charId: string }[]) ?? []).map((r) => ({
      ...r,
      charId: remap(r.charId)!,
    })),
  }));

  const arcStates = (data.arcStates as Record<string, unknown>[]).map((a) => ({
    ...a,
    id: remap(a.id as string)!,
    projectId,
    characterId: remap(a.characterId as string)!,
    structureNodeId: remap(a.structureNodeId as string)!,
  }));

  const scenes = (data.scenes as Record<string, unknown>[]).map((s) => ({
    ...s,
    id: remap(s.id as string)!,
    projectId,
    parentNodeId: remap(s.parentNodeId as string)!,
    characterIds: ((s.characterIds as string[]) ?? []).map((c) => remap(c)!),
  }));

  const conversations = (data.conversations as Record<string, unknown>[]).map((c) => ({
    ...c,
    id: remap(c.id as string)!,
    projectId,
    scopeId: remap(c.scopeId as string | null),
  }));

  const bible = data.bible
    ? {
        ...(data.bible as Record<string, unknown>),
        id: remap((data.bible as Record<string, string>).id)!,
        projectId,
      }
    : null;

  const replaced = mode === 'replace' && Boolean(await db.projects.get(projectId));

  await db.transaction(
    'rw',
    [db.projects, db.bibles, db.beats, db.nodes, db.characters, db.arcStates, db.scenes, db.conversations],
    async () => {
      if (replaced) {
        await db.bibles.where({ projectId }).delete();
        await db.beats.where({ projectId }).delete();
        await db.nodes.where({ projectId }).delete();
        await db.characters.where({ projectId }).delete();
        await db.arcStates.where({ projectId }).delete();
        await db.scenes.where({ projectId }).delete();
        await db.conversations.where({ projectId }).delete();
      }
      await db.projects.put(project);
      if (bible) await db.bibles.put(bible as never);
      await db.beats.bulkPut(beats as never);
      await db.nodes.bulkPut(nodes as never);
      await db.characters.bulkPut(characters as never);
      await db.arcStates.bulkPut(arcStates as never);
      await db.scenes.bulkPut(scenes as never);
      await db.conversations.bulkPut(conversations as never);
    },
  );

  return {
    projectId,
    replaced,
    counts: {
      beats: beats.length,
      nodes: nodes.length,
      characters: characters.length,
      arcStates: arcStates.length,
      scenes: scenes.length,
      conversations: conversations.length,
    },
  };
}
