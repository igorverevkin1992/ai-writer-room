import { db, uid } from './db';
import { GENRE_BEAT_LIBRARY } from './seed/genreBeats';
import { invalidateCorpusIndex } from '../lib/corpus/search';
import type { RawChunk } from '../lib/corpus/chunk';
import type {
  AIConversation,
  AIMessage,
  AIMode,
  Character,
  CharacterArcState,
  CircleSlot,
  Concept,
  Genre,
  GenreBeat,
  ID,
  LieState,
  Project,
  ProjectType,
  Scene,
  ScopeType,
  SourceAuthor,
  SourceDoc,
  SourceKind,
  StructureLevel,
  StructureNode,
} from '../types';

/* ────────────────────────────  helpers  ──────────────────────────── */

export function emptyCircle(): CircleSlot[] {
  return Array.from({ length: 8 }, (_, i) => ({ step: i + 1, title: '', summary: '' }));
}

/** Гарантирует ровно 8 слотов по возрастанию шага (данные из старого экспорта). */
export function normalizeCircle(circle: CircleSlot[] | undefined): CircleSlot[] {
  const base = emptyCircle();
  for (const slot of circle ?? []) {
    if (slot && slot.step >= 1 && slot.step <= 8) {
      base[slot.step - 1] = { step: slot.step, title: slot.title ?? '', summary: slot.summary ?? '' };
    }
  }
  return base;
}

async function nextOrder(parentId: ID | null, projectId: ID): Promise<number> {
  const siblings = await db.nodes.where({ projectId }).toArray();
  const same = siblings.filter((n) => n.parentId === parentId);
  return same.length ? Math.max(...same.map((n) => n.order)) + 1 : 0;
}

/* ────────────────────────────  Project  ──────────────────────────── */

export interface NewProjectInput {
  title: string;
  type: ProjectType;
  logline: string;
  genrePrimary: Genre;
  genresSupporting: Genre[];
  philosophicalThesis?: string;
  philosophicalAntithesis?: string;
  theme?: string;
  seasonsCount?: number;
  episodesPerSeason?: number;
}

export async function createProject(input: NewProjectInput): Promise<ID> {
  const now = Date.now();
  const id = uid();
  const project: Project = {
    id,
    title: input.title,
    type: input.type,
    logline: input.logline,
    genrePrimary: input.genrePrimary,
    genresSupporting: input.genresSupporting,
    philosophicalThesis: input.philosophicalThesis ?? '',
    philosophicalAntithesis: input.philosophicalAntithesis ?? '',
    theme: input.theme ?? '',
    transcendenceStrategy: '',
    seasonsCount: input.seasonsCount ?? (input.type === 'series' ? 1 : 0),
    episodesPerSeason: input.episodesPerSeason ?? (input.type === 'series' ? 8 : 0),
    status: 'разработка',
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.projects, db.bibles, db.beats, db.nodes, async () => {
    await db.projects.add(project);
    await db.bibles.add({
      id: uid(),
      projectId: id,
      worldDescription: '',
      rules: [],
      backstory: '',
      timing: {
        episodeDurationSec: input.type === 'vertical' ? 90 : 50 * 60,
        episodesCount: (input.seasonsCount ?? 1) * (input.episodesPerSeason ?? 8),
      },
    });
    await db.beats.bulkAdd(buildBeatsForProject(id, project.genrePrimary, project.genresSupporting));
    await db.nodes.add({
      id: uid(),
      projectId: id,
      level: 'work',
      parentId: null,
      order: 0,
      circleStep: null,
      title: input.title,
      summary: input.logline,
      circle: emptyCircle(),
      whatIsGained: '',
      costPaid: '',
      pointOfNoReturn: 'none',
      weilandBeat: 'none',
      targetPercent: null,
      oppositionPressure: '',
      continuityAck: false,
    });
  });

  return id;
}

export function buildBeatsForProject(
  projectId: ID,
  primary: Genre,
  supporting: Genre[],
): GenreBeat[] {
  const genres: { genre: Genre; isPrimary: boolean }[] = [
    { genre: primary, isPrimary: true },
    ...supporting.filter((g) => g !== primary).map((g) => ({ genre: g, isPrimary: false })),
  ];
  const out: GenreBeat[] = [];
  for (const { genre, isPrimary } of genres) {
    GENRE_BEAT_LIBRARY[genre].forEach((seed, i) => {
      out.push({
        id: uid(),
        projectId,
        genre,
        beatIndex: i + 1,
        beatName: seed.name,
        beatDescription: seed.description,
        status: 'unplaced',
        assignedNodeId: null,
        twistNote: '',
        isEdited: false,
        isPrimary,
      });
    });
  }
  return out;
}

export async function updateProject(id: ID, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: Date.now() });
}

/**
 * Синхронизирует библиотеку битов с текущим набором жанров:
 * добавляет биты новых жанров, удаляет биты жанров, которых больше нет.
 * Возвращает, сколько добавлено и удалено.
 */
export async function syncProjectBeats(projectId: ID): Promise<{ added: number; removed: number }> {
  const project = await db.projects.get(projectId);
  if (!project) return { added: 0, removed: 0 };
  const wanted = new Set<Genre>([project.genrePrimary, ...project.genresSupporting]);
  const existing = await db.beats.where({ projectId }).toArray();
  const present = new Set(existing.map((b) => b.genre));

  const toRemove = existing.filter((b) => !wanted.has(b.genre));
  const missing = [...wanted].filter((g) => !present.has(g));

  const toAdd: GenreBeat[] = [];
  for (const genre of missing) {
    GENRE_BEAT_LIBRARY[genre].forEach((seed, i) => {
      toAdd.push({
        id: uid(),
        projectId,
        genre,
        beatIndex: i + 1,
        beatName: seed.name,
        beatDescription: seed.description,
        status: 'unplaced',
        assignedNodeId: null,
        twistNote: '',
        isEdited: false,
        isPrimary: genre === project.genrePrimary,
      });
    });
  }

  await db.transaction('rw', db.beats, async () => {
    if (toRemove.length) await db.beats.bulkDelete(toRemove.map((b) => b.id));
    if (toAdd.length) await db.beats.bulkAdd(toAdd);
    // Ведущий жанр мог смениться — переставим флаг.
    const after = await db.beats.where({ projectId }).toArray();
    await Promise.all(
      after
        .filter((b) => b.isPrimary !== (b.genre === project.genrePrimary))
        .map((b) => db.beats.update(b.id, { isPrimary: b.genre === project.genrePrimary })),
    );
  });

  return { added: toAdd.length, removed: toRemove.length };
}

export async function deleteProject(id: ID): Promise<void> {
  await db.transaction(
    'rw',
    [db.projects, db.bibles, db.beats, db.nodes, db.characters, db.arcStates, db.scenes, db.conversations],
    async () => {
      await db.projects.delete(id);
      await db.bibles.where({ projectId: id }).delete();
      await db.beats.where({ projectId: id }).delete();
      await db.nodes.where({ projectId: id }).delete();
      await db.characters.where({ projectId: id }).delete();
      await db.arcStates.where({ projectId: id }).delete();
      await db.scenes.where({ projectId: id }).delete();
      await db.conversations.where({ projectId: id }).delete();
    },
  );
}

/* ────────────────────────────  Structure  ──────────────────────────── */

export const CHILD_LEVEL: Record<StructureLevel, StructureLevel | null> = {
  work: 'season',
  season: 'episode',
  episode: 'act',
  act: null,
};

/** Какие уровни допустимы для ребёнка узла с учётом типа проекта. */
export function allowedChildLevels(parent: StructureLevel, type: ProjectType): StructureLevel[] {
  if (parent === 'act') return [];
  if (parent === 'work') return type === 'series' ? ['season', 'episode', 'act'] : ['episode', 'act'];
  if (parent === 'season') return ['episode', 'act'];
  return ['act'];
}

export async function addNode(
  projectId: ID,
  parentId: ID | null,
  level: StructureLevel,
  patch: Partial<StructureNode> = {},
): Promise<ID> {
  const id = uid();
  const node: StructureNode = {
    id,
    projectId,
    level,
    parentId,
    order: await nextOrder(parentId, projectId),
    circleStep: null,
    title: '',
    summary: '',
    circle: emptyCircle(),
    whatIsGained: '',
    costPaid: '',
    pointOfNoReturn: 'none',
    weilandBeat: 'none',
    targetPercent: null,
    oppositionPressure: '',
    continuityAck: false,
    ...patch,
  };
  await db.nodes.add(node);
  return id;
}

export async function updateNode(id: ID, patch: Partial<StructureNode>): Promise<void> {
  await db.nodes.update(id, patch);
}

export async function updateCircleSlot(
  node: StructureNode,
  step: number,
  patch: Partial<CircleSlot>,
): Promise<void> {
  const circle = normalizeCircle(node.circle).map((s) => (s.step === step ? { ...s, ...patch } : s));
  await db.nodes.update(node.id, { circle });
}

async function collectSubtree(rootId: ID): Promise<ID[]> {
  const all = await db.nodes.where({ parentId: rootId }).toArray();
  const ids = [rootId];
  for (const child of all) ids.push(...(await collectSubtree(child.id)));
  return ids;
}

export async function deleteNode(id: ID): Promise<void> {
  const ids = await collectSubtree(id);
  await db.transaction('rw', db.nodes, db.scenes, db.arcStates, db.beats, async () => {
    await db.nodes.bulkDelete(ids);
    for (const nodeId of ids) {
      await db.scenes.where({ parentNodeId: nodeId }).delete();
      await db.arcStates.where({ structureNodeId: nodeId }).delete();
      const beats = await db.beats.where({ assignedNodeId: nodeId }).toArray();
      await Promise.all(
        beats.map((b) =>
          db.beats.update(b.id, {
            assignedNodeId: null,
            status: b.status === 'twisted' ? 'twisted' : 'unplaced',
          }),
        ),
      );
    }
  });
}

export async function moveNode(id: ID, direction: -1 | 1): Promise<void> {
  const node = await db.nodes.get(id);
  if (!node) return;
  const siblings = (await db.nodes.where({ projectId: node.projectId }).toArray())
    .filter((n) => n.parentId === node.parentId)
    .sort((a, b) => a.order - b.order);
  const idx = siblings.findIndex((n) => n.id === id);
  const swapWith = siblings[idx + direction];
  if (!swapWith) return;
  await db.transaction('rw', db.nodes, async () => {
    await db.nodes.update(node.id, { order: swapWith.order });
    await db.nodes.update(swapWith.id, { order: node.order });
  });
}

/* ────────────────────────────  Beats  ──────────────────────────── */

export async function assignBeat(beatId: ID, nodeId: ID | null): Promise<void> {
  const beat = await db.beats.get(beatId);
  if (!beat) return;
  const status = nodeId ? (beat.status === 'twisted' ? 'twisted' : 'placed') : 'unplaced';
  await db.beats.update(beatId, { assignedNodeId: nodeId, status });
}

export async function setBeatTwist(beatId: ID, twisted: boolean, note: string): Promise<void> {
  const beat = await db.beats.get(beatId);
  if (!beat) return;
  await db.beats.update(beatId, {
    twistNote: note,
    status: twisted ? 'twisted' : beat.assignedNodeId ? 'placed' : 'unplaced',
  });
}

export async function updateBeat(id: ID, patch: Partial<GenreBeat>): Promise<void> {
  await db.beats.update(id, patch);
}

export async function addCustomBeat(projectId: ID, genre: Genre): Promise<ID> {
  const existing = await db.beats.where({ projectId }).toArray();
  const sameGenre = existing.filter((b) => b.genre === genre);
  const id = uid();
  await db.beats.add({
    id,
    projectId,
    genre,
    beatIndex: sameGenre.length ? Math.max(...sameGenre.map((b) => b.beatIndex)) + 1 : 1,
    beatName: 'Новый бит',
    beatDescription: '',
    status: 'unplaced',
    assignedNodeId: null,
    twistNote: '',
    isEdited: true,
    isPrimary: sameGenre[0]?.isPrimary ?? false,
  });
  return id;
}

export async function deleteBeat(id: ID): Promise<void> {
  await db.beats.delete(id);
}

/* ────────────────────────────  Characters  ──────────────────────────── */

export async function addCharacter(projectId: ID, name = 'Новый персонаж'): Promise<ID> {
  const existing = await db.characters.where({ projectId }).toArray();
  const id = uid();
  const character: Character = {
    id,
    projectId,
    name,
    role: '',
    beliefs: [],
    lie: '',
    ghost: '',
    want: '',
    need: '',
    arcType: 'positive',
    stakesExternal: '',
    stakesPhilosophical: '',
    philosophicalPosition: 0,
    voiceProfile: '',
    relationships: [],
    order: existing.length ? Math.max(...existing.map((c) => c.order)) + 1 : 0,
  };
  await db.characters.add(character);
  return id;
}

export async function updateCharacter(id: ID, patch: Partial<Character>): Promise<void> {
  await db.characters.update(id, patch);
}

export async function deleteCharacter(id: ID): Promise<void> {
  await db.transaction('rw', db.characters, db.arcStates, db.scenes, async () => {
    await db.characters.delete(id);
    await db.arcStates.where({ characterId: id }).delete();
    const scenes = await db.scenes.toArray();
    await Promise.all(
      scenes
        .filter((s) => s.characterIds.includes(id))
        .map((s) =>
          db.scenes.update(s.id, { characterIds: s.characterIds.filter((c) => c !== id) }),
        ),
    );
  });
}

export async function setArcState(
  projectId: ID,
  characterId: ID,
  structureNodeId: ID,
  patch: Partial<Pick<CharacterArcState, 'lieState' | 'note'>>,
): Promise<void> {
  const existing = await db.arcStates
    .where('[characterId+structureNodeId]')
    .equals([characterId, structureNodeId])
    .first();
  if (existing) {
    await db.arcStates.update(existing.id, patch);
    return;
  }
  await db.arcStates.add({
    id: uid(),
    projectId,
    characterId,
    structureNodeId,
    lieState: (patch.lieState ?? 'believes') as LieState,
    note: patch.note ?? '',
  });
}

export async function clearArcState(characterId: ID, structureNodeId: ID): Promise<void> {
  await db.arcStates
    .where('[characterId+structureNodeId]')
    .equals([characterId, structureNodeId])
    .delete();
}

/* ────────────────────────────  Scenes  ──────────────────────────── */

export async function addScene(projectId: ID, parentNodeId: ID): Promise<ID> {
  const existing = await db.scenes.where({ parentNodeId }).toArray();
  const id = uid();
  const scene: Scene = {
    id,
    projectId,
    parentNodeId,
    order: existing.length ? Math.max(...existing.map((s) => s.order)) + 1 : 0,
    heading: 'ИНТ. — ДЕНЬ',
    summary: '',
    sceneObjective: '',
    superObjectiveNote: '',
    obstacle: '',
    tactics: [],
    turn: '',
    valueShiftFrom: '+',
    valueShiftTo: '−',
    audiencePosition: 'level',
    mamet: { whoWantsWhatFromWhom: '', stakesIfDenied: '', whyNow: '' },
    characterIds: [],
    content: '',
    contentFincherPass: '',
    fincherCutList: '',
  };
  await db.scenes.add(scene);
  return id;
}

export async function updateScene(id: ID, patch: Partial<Scene>): Promise<void> {
  await db.scenes.update(id, patch);
}

export async function deleteScene(id: ID): Promise<void> {
  await db.scenes.delete(id);
}

/* ────────────────────────────  AI conversations  ──────────────────────────── */

export async function appendConversation(params: {
  projectId: ID;
  mode: AIMode;
  scopeType: ScopeType;
  scopeId: ID | null;
  messages: AIMessage[];
  conversationId?: ID;
}): Promise<ID> {
  const now = Date.now();
  if (params.conversationId) {
    const existing = await db.conversations.get(params.conversationId);
    if (existing) {
      await db.conversations.update(existing.id, {
        messages: [...existing.messages, ...params.messages],
        updatedAt: now,
      });
      return existing.id;
    }
  }
  const id = uid();
  const conversation: AIConversation = {
    id,
    projectId: params.projectId,
    mode: params.mode,
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    messages: params.messages,
    createdAt: now,
    updatedAt: now,
  };
  await db.conversations.add(conversation);
  return id;
}

export async function deleteConversation(id: ID): Promise<void> {
  await db.conversations.delete(id);
}

/* ────────────────────────  Корпус первоисточников  ──────────────────────── */

export async function addSourceDoc(params: {
  title: string;
  author: SourceAuthor;
  kind: SourceKind;
  citation: string;
  note?: string;
  chunks: RawChunk[];
  charCount: number;
}): Promise<ID> {
  const id = uid();
  const doc: SourceDoc = {
    id,
    title: params.title,
    author: params.author,
    kind: params.kind,
    citation: params.citation,
    pinned: false,
    charCount: params.charCount,
    chunkCount: params.chunks.length,
    createdAt: Date.now(),
    note: params.note ?? '',
  };
  await db.transaction('rw', [db.sourceDocs, db.sourceChunks], async () => {
    await db.sourceDocs.add(doc);
    await db.sourceChunks.bulkAdd(
      params.chunks.map((c) => ({
        id: uid(),
        docId: id,
        index: c.index,
        anchor: c.anchor,
        text: c.text,
        concepts: c.concepts,
      })),
    );
  });
  invalidateCorpusIndex();
  return id;
}

export async function updateSourceDoc(id: ID, patch: Partial<SourceDoc>): Promise<void> {
  await db.sourceDocs.update(id, patch);
  invalidateCorpusIndex();
}

export async function deleteSourceDoc(id: ID): Promise<void> {
  await db.transaction('rw', [db.sourceDocs, db.sourceChunks], async () => {
    await db.sourceDocs.delete(id);
    await db.sourceChunks.where({ docId: id }).delete();
  });
  invalidateCorpusIndex();
}

export async function setChunkConcepts(chunkId: ID, concepts: Concept[]): Promise<void> {
  await db.sourceChunks.update(chunkId, { concepts });
  invalidateCorpusIndex();
}
