import { describe, expect, it } from 'vitest';
import { stem, tokenize } from './tokenize';
import { approxTokens, chunkText } from './chunk';
import { autoTagConcepts, MODE_CONCEPTS } from './concepts';
import { buildIndex, search } from './search';
import type { SourceChunk } from '../../types';

describe('нормализация слов', () => {
  it('сводит русские формы к одной основе', () => {
    expect(stem('мидпоинта')).toBe(stem('мидпоинт'));
    expect(stem('персонажами')).toBe(stem('персонажа'));
    expect(stem('структуры')).toBe(stem('структуре'));
  });

  it('не режет короткие слова до неузнаваемости', () => {
    expect(stem('ложь')).toBe('ложь');
    expect(stem('beat')).toBe('beat');
  });

  it('выбрасывает стоп-слова', () => {
    expect(tokenize('это и есть та самая сцена')).toContain(stem('сцена'));
    expect(tokenize('это и есть')).toEqual([]);
  });
});

describe('чанкинг', () => {
  const book = [
    '# Глава 4. Детектив',
    'Детективная история начинается задолго до появления героя. '.repeat(20),
    'План оппонента уже исполнен, и герой входит в чужой сюжет. '.repeat(20),
    '# Глава 5. Криминал',
    'Криминальная история смотрит на мир глазами преступника. '.repeat(20),
  ].join('\n\n');

  it('режет по размеру и не рвёт абзацы', () => {
    const chunks = chunkText(book, { targetTokens: 200 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(approxTokens(c.text)).toBeLessThan(700);
  });

  it('якорем становится ближайший заголовок', () => {
    const chunks = chunkText(book, { targetTokens: 200 });
    expect(chunks[0].anchor).toBe('Глава 4. Детектив');
    expect(chunks.some((c) => c.anchor === 'Глава 5. Криминал')).toBe(true);
  });

  it('держит тайм-коды транскрипта как якоря', () => {
    const transcript = ['[00:04:12] Мидпоинт — это шаги пять и шесть.', '[00:09:40] Теперь про цену.'].join('\n\n');
    const chunks = chunkText(transcript, { targetTokens: 20 });
    expect(chunks[0].anchor).toMatch(/00:04:12/);
  });

  it('нумерует фрагменты подряд', () => {
    const chunks = chunkText(book, { targetTokens: 150 });
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i + 1));
  });
});

describe('авторазметка концептов', () => {
  it('узнаёт главу про Ложь и Призрак', () => {
    const concepts = autoTagConcepts(
      'Ложь — это заблуждение, в которое персонаж верит. Призрак объясняет, откуда взялась эта ложь: рана прошлого.',
    );
    expect(concepts).toContain('lie_ghost');
  });

  it('узнаёт главу про сцену', () => {
    expect(
      autoTagConcepts('Задача сцены — это то, чего персонаж хочет здесь и сейчас. Сцена обязана повернуть историю.'),
    ).toContain('scene_craft');
  });

  it('молчит на постороннем тексте', () => {
    expect(autoTagConcepts('Рецепт борща: свёкла, капуста, картофель и немного терпения.')).toEqual([]);
  });

  it('каждому режиму сопоставлены концепты', () => {
    for (const [mode, concepts] of Object.entries(MODE_CONCEPTS)) {
      expect(concepts.length, `режим ${mode}`).toBeGreaterThan(0);
    }
  });
});

describe('поиск BM25', () => {
  const chunk = (id: string, text: string, concepts: SourceChunk['concepts'] = []): SourceChunk => ({
    id,
    docId: 'd1',
    index: Number(id.slice(1)),
    anchor: `фрагмент ${id}`,
    text,
    concepts,
  });

  const index = buildIndex([
    chunk('c1', 'Мидпоинт — середина истории, где персонаж впервые видит истину и платит цену.', ['midpoint']),
    chunk('c2', 'Пинч-поинт показывает давление оппозиции и напоминает о силе противника.', ['pinch_points']),
    chunk('c3', 'Задача сцены отличается от суперзадачи персонажа во всей истории.', ['scene_craft']),
    chunk('c4', 'Рецепт борща и немного терпения на кухне.', []),
  ]);

  it('находит по смыслу запроса, а не по точной форме слова', () => {
    const hits = search(index, 'что такое мидпоинты');
    expect(hits[0].chunk.id).toBe('c1');
  });

  it('не тянет посторонний фрагмент', () => {
    expect(search(index, 'мидпоинт').map((h) => h.chunk.id)).not.toContain('c4');
  });

  it('концепт режима поднимает нужный фрагмент', () => {
    const neutral = search(index, 'давление истории');
    const boosted = search(index, 'давление истории', { concepts: ['pinch_points'], conceptBoost: 3 });
    expect(boosted[0].chunk.id).toBe('c2');
    expect(boosted[0].score).toBeGreaterThan(neutral.find((h) => h.chunk.id === 'c2')!.score);
  });

  it('уважает лимит и пустой запрос', () => {
    expect(search(index, 'персонаж истории сцены', { limit: 2 })).toHaveLength(2);
    expect(search(index, '   ')).toEqual([]);
  });

  it('фильтрует по документам', () => {
    expect(search(index, 'мидпоинт', { docIds: ['другой'] })).toEqual([]);
  });
});
