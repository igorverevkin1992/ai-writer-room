import { describe, expect, it } from 'vitest';
import {
  CONTINUITY_THRESHOLD,
  arcDefects,
  circleDefects,
  continuityLinks,
  coverage,
  nodeDefects,
  orderNodesForArcMatrix,
  sceneDefects,
  textSimilarity,
} from './validate';
import { emptyCircle } from '../db/repo';
import type {
  Character,
  CharacterArcState,
  GenreBeat,
  Scene,
  StructureNode,
} from '../types';

function node(patch: Partial<StructureNode> = {}): StructureNode {
  return {
    id: patch.id ?? 'n1',
    projectId: 'p',
    level: 'act',
    parentId: null,
    order: 0,
    circleStep: null,
    title: 'Узел',
    summary: '',
    circle: emptyCircle(),
    whatIsGained: 'что-то',
    costPaid: 'цена',
    pointOfNoReturn: 'none',
    weilandBeat: 'none',
    targetPercent: null,
    oppositionPressure: '',
    continuityAck: false,
    ...patch,
  };
}

function withCircle(n: StructureNode, values: Partial<Record<number, string>>): StructureNode {
  return {
    ...n,
    circle: emptyCircle().map((s) => (values[s.step] ? { ...s, summary: values[s.step]! } : s)),
  };
}

describe('textSimilarity', () => {
  it('видит общую тему в разных формулировках', () => {
    const sim = textSimilarity(
      'детектив уходит из полиции, поверив, что закон бессилен',
      'детектив живёт вне полиции и считает закон бессильным',
    );
    expect(sim).toBeGreaterThan(CONTINUITY_THRESHOLD);
  });

  it('даёт ноль для несвязанных текстов', () => {
    expect(textSimilarity('поезд уходит на север', 'кухня, разбитая чашка')).toBe(0);
  });

  it('даёт ноль, если один текст пуст', () => {
    expect(textSimilarity('', 'что угодно')).toBe(0);
  });
});

describe('coverage', () => {
  const beat = (patch: Partial<GenreBeat>): GenreBeat => ({
    id: Math.random().toString(),
    projectId: 'p',
    genre: 'detective',
    beatIndex: 1,
    beatName: 'бит',
    beatDescription: '',
    status: 'unplaced',
    assignedNodeId: null,
    twistNote: '',
    isEdited: false,
    isPrimary: true,
    ...patch,
  });

  it('считает размещённые, вывернутые и биты ведущего жанра', () => {
    const result = coverage([
      beat({ assignedNodeId: 'n1', status: 'placed' }),
      beat({ assignedNodeId: 'n1', status: 'twisted' }),
      beat({}),
      beat({ isPrimary: false, genre: 'crime' }),
    ]);
    expect(result.total).toBe(4);
    expect(result.placed).toBe(2);
    expect(result.twisted).toBe(1);
    expect(result.primaryTotal).toBe(3);
    expect(result.primaryPlaced).toBe(2);
    expect(result.unplacedIds).toHaveLength(2);
  });
});

describe('circleDefects', () => {
  it('находит пустые шаги', () => {
    const n = withCircle(node(), { 1: 'герой на месте', 2: 'ему надо' });
    const codes = circleDefects(n).map((d) => d.code);
    expect(codes).toContain('circle_empty_steps');
  });

  it('ловит FIND и TAKE как одно событие', () => {
    const n = withCircle(node(), {
      1: 'а',
      2: 'б',
      3: 'в',
      4: 'г',
      5: 'детектив находит записи убийцы в архиве больницы',
      6: 'детектив находит записи убийцы в архиве больницы',
      7: 'д',
      8: 'е',
    });
    expect(circleDefects(n).map((d) => d.code)).toContain('find_take_identical');
  });

  it('не считает разные события одинаковыми', () => {
    const n = withCircle(node(), {
      1: 'а',
      2: 'б',
      3: 'в',
      4: 'г',
      5: 'детектив получает признание свидетеля',
      6: 'жену свидетеля убивают той же ночью',
      7: 'д',
      8: 'е',
    });
    const codes = circleDefects(n).map((d) => d.code);
    expect(codes).not.toContain('find_take_identical');
    expect(codes).not.toContain('circle_empty_steps');
  });

  it('требует TAKE, если FIND заполнен', () => {
    const n = withCircle(node(), { 5: 'получил желаемое' });
    expect(circleDefects(n).map((d) => d.code)).toContain('take_missing');
  });
});

describe('nodeDefects', () => {
  it('требует цену на уровне акта', () => {
    expect(nodeDefects(node({ costPaid: '' })).map((d) => d.code)).toContain('cost_missing');
  });

  it('требует давление оппозиции на пинч-поинте', () => {
    const n = node({ weilandBeat: 'pinch_1', oppositionPressure: '' });
    expect(nodeDefects(n).map((d) => d.code)).toContain('pinch_pressure_missing');
  });

  it('молчит на заполненном узле', () => {
    const n = node({ weilandBeat: 'pinch_2', oppositionPressure: 'оппонент забирает свидетеля' });
    expect(nodeDefects(n)).toHaveLength(0);
  });
});

describe('continuityLinks', () => {
  it('видит стыковку CHANGE → YOU', () => {
    const a = withCircle(node({ id: 'a', order: 0 }), { 8: 'детектив принимает вину за смерть напарника' });
    const b = withCircle(node({ id: 'b', order: 1 }), { 1: 'детектив живёт с виной за смерть напарника' });
    const [link] = continuityLinks([b, a]);
    expect(link.fromId).toBe('a');
    expect(link.ok).toBe(true);
  });

  it('видит разрыв', () => {
    const a = withCircle(node({ id: 'a', order: 0 }), { 8: 'детектив принимает вину' });
    const b = withCircle(node({ id: 'b', order: 1 }), { 1: 'мэр открывает новый мост' });
    expect(continuityLinks([a, b])[0].ok).toBe(false);
  });
});

describe('arcDefects', () => {
  const character: Character = {
    id: 'c1',
    projectId: 'p',
    name: 'Герой',
    role: '',
    beliefs: [],
    lie: 'закон бессилен',
    ghost: 'напарник погиб по протоколу',
    want: 'найти убийцу',
    need: 'признать свою вину',
    arcType: 'positive',
    stakesExternal: '',
    stakesPhilosophical: '',
    philosophicalPosition: 0,
    voiceProfile: '',
    relationships: [],
    order: 0,
  };
  const state = (nodeId: string, lieState: CharacterArcState['lieState']): CharacterArcState => ({
    id: nodeId,
    projectId: 'p',
    characterId: 'c1',
    structureNodeId: nodeId,
    lieState,
    note: '',
  });

  it('требует Момент истины на мидпоинте позитивной арки', () => {
    const nodes = [node({ id: 'n1', order: 0 }), node({ id: 'n2', order: 1, weilandBeat: 'midpoint' })];
    const codes = arcDefects(character, nodes, [state('n1', 'believes'), state('n2', 'doubting')]).map(
      (d) => d.code,
    );
    expect(codes).toContain('no_moment_of_truth');
  });

  it('ловит откат позитивной арки после мидпоинта', () => {
    const nodes = [
      node({ id: 'n1', order: 0, weilandBeat: 'midpoint' }),
      node({ id: 'n2', order: 1 }),
    ];
    const codes = arcDefects(character, nodes, [
      state('n1', 'glimpsing_truth'),
      state('n2', 'believes'),
    ]).map((d) => d.code);
    expect(codes).toContain('arc_regression');
  });

  it('требует Ложь и Нужно', () => {
    const codes = arcDefects({ ...character, lie: '', need: '' }, [], []).map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['lie_missing', 'need_missing']));
  });
});

describe('sceneDefects', () => {
  const scene: Scene = {
    id: 's1',
    projectId: 'p',
    parentNodeId: 'n1',
    order: 0,
    heading: 'ИНТ. АРХИВ — НОЧЬ',
    summary: '',
    sceneObjective: 'получить папку',
    superObjectiveNote: '',
    obstacle: 'архивариус не отдаёт',
    tactics: ['давит удостоверением'],
    turn: 'папка оказывается пустой',
    valueShiftFrom: '+',
    valueShiftTo: '−',
    audiencePosition: 'level',
    mamet: { whoWantsWhatFromWhom: 'детектив от архивариуса', stakesIfDenied: '', whyNow: '' },
    characterIds: [],
    content: '',
    contentFincherPass: '',
    fincherCutList: '',
  };

  it('молчит на собранной сцене', () => {
    expect(sceneDefects(scene)).toHaveLength(0);
  });

  it('ловит отсутствие сдвига заряда и поворота', () => {
    const codes = sceneDefects({ ...scene, valueShiftTo: '+', turn: '' }).map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(['no_value_shift', 'turn_missing']));
  });
});

describe('orderNodesForArcMatrix', () => {
  it('обходит дерево в сюжетном порядке', () => {
    const nodes = [
      node({ id: 'root', level: 'work', parentId: null, order: 0 }),
      node({ id: 'e2', level: 'episode', parentId: 'root', order: 1 }),
      node({ id: 'e1', level: 'episode', parentId: 'root', order: 0 }),
      node({ id: 'a1', level: 'act', parentId: 'e1', order: 0 }),
    ];
    expect(orderNodesForArcMatrix(nodes).map((n) => n.id)).toEqual(['root', 'e1', 'a1', 'e2']);
  });
});
