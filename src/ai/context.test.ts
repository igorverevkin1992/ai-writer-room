import { describe, expect, it } from 'vitest';
import {
  buildCachedSystem,
  buildDynamicContext,
  buildUserMessage,
  defaultToggles,
  type ContextBundle,
} from './context';
import { MODE_SYSTEM_PROMPTS } from './prompts';
import { splitFincherAnswer } from '../lib/fincher';
import { emptyCircle } from '../db/repo';
import { estimateCost } from './models';
import type { AIMode } from '../types';

const bundle: ContextBundle = {
  project: {
    id: 'p',
    title: 'Слепая зона',
    type: 'series',
    logline: 'Следователь ищет убийцу и находит себя',
    genrePrimary: 'detective',
    genresSupporting: ['crime', 'thriller'],
    philosophicalThesis: 'Истина стоит любой цены',
    philosophicalAntithesis: 'Ложь удерживает людей вместе',
    theme: 'Цена истины',
    transcendenceStrategy: '',
    seasonsCount: 1,
    episodesPerSeason: 8,
    status: 'разработка',
    createdAt: 0,
    updatedAt: 0,
  },
  bible: {
    id: 'b',
    projectId: 'p',
    worldDescription: 'Город, где протокол важнее человека',
    rules: ['Свидетелей не защищают'],
    backstory: '',
    timing: { episodeDurationSec: 3000, episodesCount: 8 },
  },
  beats: [
    {
      id: 'beat1',
      projectId: 'p',
      genre: 'detective',
      beatIndex: 4,
      beatName: 'Призрак детектива',
      beatDescription: 'Рана прошлого',
      status: 'unplaced',
      assignedNodeId: null,
      twistNote: '',
      isEdited: false,
      isPrimary: true,
    },
  ],
  nodes: [
    {
      id: 'n1',
      projectId: 'p',
      level: 'act',
      parentId: null,
      order: 0,
      circleStep: null,
      title: 'Акт 2',
      summary: 'Кротов вскрывает архив',
      circle: emptyCircle().map((s) => (s.step === 5 ? { ...s, title: 'Находит записи' } : s)),
      whatIsGained: 'доступ к делу',
      costPaid: '',
      pointOfNoReturn: 'external',
      weilandBeat: 'midpoint',
      targetPercent: 50,
      oppositionPressure: '',
      continuityAck: false,
    },
  ],
  characters: [
    {
      id: 'c1',
      projectId: 'p',
      name: 'Кротов',
      role: 'протагонист',
      beliefs: ['Протокол защищает виновных'],
      lie: 'Закон бессилен',
      ghost: 'Напарник погиб по протоколу',
      want: 'найти убийцу',
      need: 'признать свою вину',
      arcType: 'positive',
      stakesExternal: 'карьера',
      stakesPhilosophical: 'право судить',
      philosophicalPosition: -20,
      voiceProfile: 'короткие фразы, без метафор',
      relationships: [],
      order: 0,
    },
  ],
  arcStates: [
    {
      id: 'a1',
      projectId: 'p',
      characterId: 'c1',
      structureNodeId: 'n1',
      lieState: 'glimpsing_truth',
      note: 'впервые видит свою роль',
    },
  ],
  scenes: [
    {
      id: 's1',
      projectId: 'p',
      parentNodeId: 'n1',
      order: 0,
      heading: 'ИНТ. АРХИВ — НОЧЬ',
      summary: 'Кротов вскрывает шкаф',
      sceneObjective: 'получить папку',
      superObjectiveNote: '',
      obstacle: 'архивариус не отдаёт',
      tactics: ['давит удостоверением'],
      turn: 'папка пуста',
      valueShiftFrom: '+',
      valueShiftTo: '−',
      audiencePosition: 'ahead',
      mamet: { whoWantsWhatFromWhom: 'Кротов от архивариуса', stakesIfDenied: '', whyNow: '' },
      characterIds: ['c1'],
      content: 'КРОТОВ вскрывает шкаф.',
      contentFincherPass: '',
      fincherCutList: '',
    },
  ],
};

describe('блок A (кэшируемый префикс)', () => {
  it('содержит ядро проекта и не содержит динамику', () => {
    const system = buildCachedSystem(bundle, defaultToggles('arc_audit'));
    expect(system).toContain('Слепая зона');
    expect(system).toContain('Ложь: Закон бессилен');
    expect(system).not.toContain('ИНТ. АРХИВ');
  });

  it('стабилен между вызовами — иначе кэш не сработает', () => {
    const toggles = defaultToggles('scene_doctor');
    expect(buildCachedSystem(bundle, toggles)).toBe(buildCachedSystem(bundle, toggles));
  });
});

describe('блок B (после брейкпоинта)', () => {
  it('каждый режим получает свой контекст', () => {
    const cases: Record<AIMode, string> = {
      genre_audit: 'ЖАНРОВЫЕ БИТЫ',
      beat_transcendence: 'РАЗБИРАЕМЫЙ БИТ',
      circle_check: 'КРУГ ХАРМОНА НА ЭТОМ УЗЛЕ',
      arc_audit: 'СОСТОЯНИЕ ЛЖИ ПО БИТАМ',
      scene_doctor: 'Задача сцены',
      fincher_pass: 'ИСХОДНЫЙ ТЕКСТ СЦЕНЫ',
    };
    for (const [mode, marker] of Object.entries(cases) as [AIMode, string][]) {
      const text = buildDynamicContext(bundle, defaultToggles(mode), {
        nodeId: 'n1',
        beatId: mode === 'beat_transcendence' ? 'beat1' : null,
        characterId: 'c1',
        sceneId: 's1',
      });
      expect(text, `режим ${mode}`).toContain(marker);
    }
  });

  it('финчеровский проход получает позицию зрителя', () => {
    const message = buildUserMessage({
      mode: 'fincher_pass',
      bundle,
      toggles: defaultToggles('fincher_pass'),
      scope: { sceneId: 's1' },
      query: '',
    });
    expect(message).toContain('зритель впереди героя');
    expect(message).toContain('КРОТОВ вскрывает шкаф');
  });

  it('подрежим Мэмета добавляется только по запросу', () => {
    const without = buildUserMessage({
      mode: 'scene_doctor',
      bundle,
      toggles: defaultToggles('scene_doctor'),
      scope: { sceneId: 's1' },
      query: '',
    });
    const with_ = buildUserMessage({
      mode: 'scene_doctor',
      bundle,
      toggles: defaultToggles('scene_doctor'),
      scope: { sceneId: 's1', mametSubmode: true },
      query: '',
    });
    expect(without).not.toContain('три вопроса Мэмета');
    expect(with_).toContain('три вопроса Мэмета');
  });
});

describe('системные промпты режимов', () => {
  it('заданы для всех шести режимов', () => {
    expect(Object.keys(MODE_SYSTEM_PROMPTS)).toHaveLength(6);
    for (const prompt of Object.values(MODE_SYSTEM_PROMPTS)) {
      expect(prompt.length).toBeGreaterThan(200);
    }
  });
});

describe('splitFincherAnswer', () => {
  it('делит ответ на сцену и список вырезанного', () => {
    const { rewritten, cuts } = splitFincherAnswer(
      '### ПЕРЕПИСАННАЯ СЦЕНА\nКРОТОВ вскрывает шкаф.\n\n### ВЫРЕЗАНО\n— «мы видим» — режиссура на странице.',
    );
    expect(rewritten).toBe('КРОТОВ вскрывает шкаф.');
    expect(cuts).toContain('режиссура на странице');
  });

  it('возвращает весь текст, если заголовка нет', () => {
    expect(splitFincherAnswer('просто текст').rewritten).toBe('просто текст');
    expect(splitFincherAnswer('просто текст').cuts).toBe('');
  });
});

describe('estimateCost', () => {
  it('считает чтение кэша дешевле обычного input', () => {
    const cold = estimateCost('claude-opus-5', { input_tokens: 10_000, output_tokens: 1000 });
    const warm = estimateCost('claude-opus-5', {
      input_tokens: 0,
      cache_read_input_tokens: 10_000,
      output_tokens: 1000,
    });
    expect(warm).toBeLessThan(cold);
    expect(warm).toBeCloseTo((10_000 * 5 * 0.1 + 1000 * 25) / 1_000_000, 8);
  });
});
