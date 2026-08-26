import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { addCharacter, addNode, addScene, assignBeat, createProject, setArcState } from './repo';
import { exportProject, importProject } from './backup';
import { coverage } from '../lib/validate';

async function seedProject() {
  const projectId = await createProject({
    title: 'Слепая зона',
    type: 'series',
    logline: 'Следователь ищет убийцу и находит себя',
    genrePrimary: 'detective',
    genresSupporting: ['crime', 'thriller'],
    seasonsCount: 1,
    episodesPerSeason: 8,
  });
  const root = (await db.nodes.where({ projectId }).toArray())[0];
  const episodeId = await addNode(projectId, root.id, 'episode', { title: 'Серия 1' });
  const actId = await addNode(projectId, episodeId, 'act', { title: 'Акт 1', weilandBeat: 'midpoint' });
  const characterId = await addCharacter(projectId, 'Кротов');
  await setArcState(projectId, characterId, actId, { lieState: 'glimpsing_truth', note: 'видит проблеск' });
  await addScene(projectId, actId);
  return { projectId, actId, characterId };
}

describe('создание проекта', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('подтягивает сид-библиотеку битов ведущего и поддерживающих жанров', async () => {
    const { projectId } = await seedProject();
    const beats = await db.beats.where({ projectId }).toArray();
    const cov = coverage(beats);
    expect(cov.total).toBe(20 + 14 + 18); // детектив + криминал + триллер
    expect(cov.primaryTotal).toBe(20);
    expect(cov.placed).toBe(0);
    expect(new Set(beats.map((b) => b.genre))).toEqual(new Set(['detective', 'crime', 'thriller']));
  });

  it('создаёт корневой узел с восемью слотами круга', async () => {
    const { projectId } = await seedProject();
    const nodes = await db.nodes.where({ projectId }).toArray();
    const root = nodes.find((n) => n.parentId === null)!;
    expect(root.circle).toHaveLength(8);
    expect(root.circle.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('назначение бита на узел меняет статус и счётчик покрытия', async () => {
    const { projectId, actId } = await seedProject();
    const beat = (await db.beats.where({ projectId }).toArray())[0];
    await assignBeat(beat.id, actId);
    const after = await db.beats.get(beat.id);
    expect(after?.status).toBe('placed');
    expect(coverage(await db.beats.where({ projectId }).toArray()).placed).toBe(1);
  });
});

describe('экспорт и импорт', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('переживает круговой рейс без потерь', async () => {
    const { projectId, actId } = await seedProject();
    const beat = (await db.beats.where({ projectId }).toArray())[0];
    await assignBeat(beat.id, actId);

    const dump = JSON.parse(JSON.stringify(await exportProject(projectId)));
    await db.delete();
    await db.open();
    expect(await db.projects.count()).toBe(0);

    const result = await importProject(dump, 'replace');
    expect(result.projectId).toBe(projectId);
    expect(result.counts.beats).toBe(52);
    expect(result.counts.nodes).toBe(3);
    expect(result.counts.characters).toBe(1);
    expect(result.counts.arcStates).toBe(1);
    expect(result.counts.scenes).toBe(1);

    const restoredBeat = await db.beats.get(beat.id);
    expect(restoredBeat?.assignedNodeId).toBe(actId);
    const restoredState = await db.arcStates.where({ projectId }).first();
    expect(restoredState?.lieState).toBe('glimpsing_truth');
  });

  it('копия получает новые идентификаторы, но сохраняет связи', async () => {
    const { projectId, actId } = await seedProject();
    const beat = (await db.beats.where({ projectId }).toArray())[0];
    await assignBeat(beat.id, actId);
    const dump = JSON.parse(JSON.stringify(await exportProject(projectId)));

    const copy = await importProject(dump, 'copy');
    expect(copy.projectId).not.toBe(projectId);

    const copiedBeats = await db.beats.where({ projectId: copy.projectId }).toArray();
    const copiedPlaced = copiedBeats.find((b) => b.assignedNodeId !== null)!;
    const copiedNodes = await db.nodes.where({ projectId: copy.projectId }).toArray();
    expect(copiedNodes.map((n) => n.id)).toContain(copiedPlaced.assignedNodeId);
    expect(copiedNodes.map((n) => n.id)).not.toContain(actId);

    const copiedScene = await db.scenes.where({ projectId: copy.projectId }).first();
    expect(copiedNodes.map((n) => n.id)).toContain(copiedScene?.parentNodeId);
  });

  it('отвергает чужой файл', async () => {
    await expect(importProject({ format: 'something-else' })).rejects.toThrow(/Writers Room OS/);
  });
});
