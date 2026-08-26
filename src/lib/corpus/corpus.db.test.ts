import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { addSourceDoc, deleteSourceDoc, updateSourceDoc } from '../../db/repo';
import { chunkText } from './chunk';
import { pinnedDocuments, searchCorpus } from './search';
import { buildPinnedBlock } from '../../ai/context';

const TRUBY = [
  '# Глава 4. Детектив',
  'Детективная история начинается до появления героя: оппонент составляет план убийства и исполняет его. Детектив входит в уже написанный сюжет и должен восстановить его заново.',
  'Ложный след — главное оружие оппозиции. Она атакует не тело детектива, а его картину мира.',
  '# Глава 9. Миф',
  'Мифическая история строится на путешествии через порог в мир с другими законами.',
].join('\n\n');

async function importTruby(pinned = false) {
  const id = await addSourceDoc({
    title: 'Анатомия жанров',
    author: 'truby',
    kind: 'book',
    citation: 'изд. 2022',
    chunks: chunkText(TRUBY, { targetTokens: 120 }),
    charCount: TRUBY.length,
  });
  if (pinned) await updateSourceDoc(id, { pinned: true });
  return id;
}

describe('корпус в базе', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('импортированный документ находится поиском со ссылкой', async () => {
    await importTruby();
    const hits = await searchCorpus('чем оппозиция атакует детектива', { limit: 3 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.text).toContain('картину мира');
    expect(hits[0].doc.title).toBe('Анатомия жанров');
    expect(hits[0].chunk.anchor).toContain('Глава 4');
  });

  it('индекс переживает удаление документа', async () => {
    const id = await importTruby();
    expect((await searchCorpus('детектив', { limit: 5 })).length).toBeGreaterThan(0);
    await deleteSourceDoc(id);
    expect(await searchCorpus('детектив', { limit: 5 })).toEqual([]);
    expect(await db.sourceChunks.count()).toBe(0);
  });

  it('закреплённый документ уходит в кэшируемый блок целиком', async () => {
    await importTruby(true);
    const pinned = await pinnedDocuments();
    expect(pinned).toHaveLength(1);

    const block = await buildPinnedBlock();
    expect(block).toContain('Анатомия жанров');
    expect(block).toContain('изд. 2022');
    // Все фрагменты документа, а не только найденные поиском.
    expect(block).toContain('картину мира');
    expect(block).toContain('путешествии через порог');
  });

  it('незакреплённый документ в кэшируемый блок не попадает', async () => {
    await importTruby(false);
    expect(await buildPinnedBlock()).toBe('');
  });

  it('фильтр по концепту сужает выдачу', async () => {
    await importTruby();
    const hits = await searchCorpus('детектив оппонент план', { concepts: ['genre_beats'], limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
  });
});
