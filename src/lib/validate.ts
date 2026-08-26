/**
 * Формальные проверки методологии. Ничего не «додумывает» — только то,
 * что можно проверить по данным. Всё остальное отдаётся AI-аудиту.
 */
import { normalizeCircle } from '../db/repo';
import {
  CIRCLE_STEPS,
  LIE_STATE_RANK,
  type Character,
  type CharacterArcState,
  type GenreBeat,
  type ID,
  type Scene,
  type StructureNode,
} from '../types';

/* ────────────────────────────  текст  ──────────────────────────── */

const STOPWORDS = new Set([
  'и','в','во','не','что','он','на','я','с','со','как','а','то','все','она','так','его','но','да',
  'ты','к','у','же','вы','за','бы','по','только','ее','мне','было','вот','от','меня','еще','нет',
  'о','из','ему','теперь','когда','даже','ну','вдруг','ли','если','уже','или','ни','быть','был',
  'него','до','вас','нибудь','опять','уж','вам','ведь','там','потом','себя','ничего','ей','они',
  'тут','где','есть','надо','ней','для','мы','тебя','их','чем','была','сам','чтоб','без','будто',
  'этот','того','потому','этого','какой','совсем','ним','здесь','этом','один','почти','мой','тем',
  'чтобы','нее','были','куда','зачем','всех','никогда','можно','при','наконец','два','об','другой',
  'хоть','после','над','больше','тот','через','эти','нас','про','всего','них','какая','много',
  'разве','сказал','три','эту','моя','впрочем','свою','этой','перед','иногда','лучше','чуть','том',
  'нельзя','такой','им','более','всегда','конечно','всю','между',
]);

export function normalizeWords(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Жаккар по значимым словам. 1 — тексты о том же, 0 — общих слов нет. */
export function textSimilarity(a: string, b: string): number {
  const A = new Set(normalizeWords(a));
  const B = new Set(normalizeWords(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export const isBlank = (s: string | null | undefined): boolean => !s || !s.trim();

/* ────────────────────────────  Труби: покрытие  ──────────────────────────── */

export interface Coverage {
  total: number;
  placed: number;
  twisted: number;
  unplacedIds: ID[];
  primaryTotal: number;
  primaryPlaced: number;
}

export function coverage(beats: GenreBeat[]): Coverage {
  const placed = beats.filter((b) => b.assignedNodeId !== null);
  const primary = beats.filter((b) => b.isPrimary);
  return {
    total: beats.length,
    placed: placed.length,
    twisted: beats.filter((b) => b.status === 'twisted').length,
    unplacedIds: beats.filter((b) => b.assignedNodeId === null).map((b) => b.id),
    primaryTotal: primary.length,
    primaryPlaced: primary.filter((b) => b.assignedNodeId !== null).length,
  };
}

/* ────────────────────────────  Хармон: круг  ──────────────────────────── */

export type Severity = 'error' | 'warn';

export interface Defect {
  code: string;
  severity: Severity;
  message: string;
  nodeId?: ID;
  characterId?: ID;
  sceneId?: ID;
  beatId?: ID;
}

/** Порог, ниже которого CHANGE и YOU считаются несостыкованными. */
export const CONTINUITY_THRESHOLD = 0.25;
/** Порог, выше которого FIND и TAKE считаются одним и тем же событием. */
export const FIND_TAKE_IDENTITY_THRESHOLD = 0.6;

export function circleDefects(node: StructureNode): Defect[] {
  const circle = normalizeCircle(node.circle);
  const out: Defect[] = [];
  const filled = (step: number) => {
    const slot = circle[step - 1];
    return !isBlank(slot.title) || !isBlank(slot.summary);
  };
  const text = (step: number) => `${circle[step - 1].title} ${circle[step - 1].summary}`;

  const empty = CIRCLE_STEPS.filter((s) => !filled(s.index));
  if (empty.length && empty.length < 8) {
    out.push({
      code: 'circle_empty_steps',
      severity: 'error',
      nodeId: node.id,
      message: `Пустые шаги круга: ${empty.map((s) => `${s.index}. ${s.label}`).join(', ')}`,
    });
  }
  if (empty.length === 8) {
    out.push({
      code: 'circle_untouched',
      severity: 'warn',
      nodeId: node.id,
      message: 'Круг Хармона не заполнен ни на одном шаге',
    });
  }
  if (filled(5) && filled(6)) {
    const sim = textSimilarity(text(5), text(6));
    if (sim >= FIND_TAKE_IDENTITY_THRESHOLD) {
      out.push({
        code: 'find_take_identical',
        severity: 'error',
        nodeId: node.id,
        message: `FIND и TAKE описывают одно событие (совпадение ${Math.round(sim * 100)}%). Получение желаемого и уплата цены — разные события.`,
      });
    }
  }
  if (filled(5) && !filled(6)) {
    out.push({
      code: 'take_missing',
      severity: 'error',
      nodeId: node.id,
      message: 'FIND заполнен, TAKE пуст: герой получил желаемое и ничего не заплатил',
    });
  }
  return out;
}

/** Моури: «получает / цена» + давление оппозиции на пинч-поинтах. */
export function nodeDefects(node: StructureNode): Defect[] {
  const out: Defect[] = [];
  if (node.level === 'act') {
    if (isBlank(node.whatIsGained)) {
      out.push({
        code: 'gain_missing',
        severity: 'warn',
        nodeId: node.id,
        message: 'Не заполнено «что персонаж получает»',
      });
    }
    if (isBlank(node.costPaid)) {
      out.push({
        code: 'cost_missing',
        severity: 'error',
        nodeId: node.id,
        message: 'Не заполнена цена — двигатель «хочет и цена» не собран',
      });
    }
  }
  if ((node.weilandBeat === 'pinch_1' || node.weilandBeat === 'pinch_2') && isBlank(node.oppositionPressure)) {
    out.push({
      code: 'pinch_pressure_missing',
      severity: 'error',
      nodeId: node.id,
      message: 'Пинч-поинт без поля «чем давит оппозиция»',
    });
  }
  return out;
}

export interface ContinuityLink {
  fromId: ID;
  toId: ID;
  fromText: string;
  toText: string;
  similarity: number;
  ok: boolean;
  acknowledged: boolean;
}

/** CHANGE узла N должен становиться YOU узла N+1 того же уровня. */
export function continuityLinks(siblings: StructureNode[]): ContinuityLink[] {
  const ordered = [...siblings].sort((a, b) => a.order - b.order);
  const out: ContinuityLink[] = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const from = ordered[i];
    const to = ordered[i + 1];
    const change = normalizeCircle(from.circle)[7];
    const you = normalizeCircle(to.circle)[0];
    const fromText = `${change.title} ${change.summary}`.trim();
    const toText = `${you.title} ${you.summary}`.trim();
    const similarity = textSimilarity(fromText, toText);
    out.push({
      fromId: from.id,
      toId: to.id,
      fromText,
      toText,
      similarity,
      ok: Boolean(fromText) && Boolean(toText) && similarity >= CONTINUITY_THRESHOLD,
      acknowledged: from.continuityAck,
    });
  }
  return out;
}

export function continuityDefects(nodes: StructureNode[]): Defect[] {
  const byParent = new Map<string, StructureNode[]>();
  for (const n of nodes) {
    const key = `${n.parentId ?? 'root'}:${n.level}`;
    byParent.set(key, [...(byParent.get(key) ?? []), n]);
  }
  const out: Defect[] = [];
  for (const group of byParent.values()) {
    if (group.length < 2) continue;
    for (const link of continuityLinks(group)) {
      if (link.ok || link.acknowledged) continue;
      const from = nodes.find((n) => n.id === link.fromId)!;
      const to = nodes.find((n) => n.id === link.toId)!;
      out.push({
        code: 'continuity_gap',
        severity: 'warn',
        nodeId: link.fromId,
        message:
          !link.fromText || !link.toText
            ? `Стыковка «${from.title || 'без названия'}» → «${to.title || 'без названия'}»: один из шагов (CHANGE / YOU) пуст`
            : `CHANGE «${from.title || 'без названия'}» не переходит в YOU «${to.title || 'без названия'}» (совпадение ${Math.round(link.similarity * 100)}%)`,
      });
    }
  }
  return out;
}

/* ────────────────────────────  Уайлэнд: арки  ──────────────────────────── */

export interface ArcCell {
  node: StructureNode;
  state: CharacterArcState | undefined;
}

/**
 * Подозрительные переходы состояния Лжи.
 * Для позитивной арки откат назад после мидпоинта — дефект;
 * для плоской арки уход от Истины — дефект;
 * для негативных проверяется, что в финале Ложь не «принята как Истина» случайно.
 */
export function arcDefects(
  character: Character,
  orderedNodes: StructureNode[],
  states: CharacterArcState[],
): Defect[] {
  const byNode = new Map(states.map((s) => [s.structureNodeId, s]));
  const cells: ArcCell[] = orderedNodes.map((node) => ({ node, state: byNode.get(node.id) }));
  const filled = cells.filter((c) => c.state);
  const out: Defect[] = [];

  const midpointIndex = orderedNodes.findIndex((n) => n.weilandBeat === 'midpoint');

  for (let i = 1; i < filled.length; i += 1) {
    const prev = filled[i - 1];
    const cur = filled[i];
    const prevRank = LIE_STATE_RANK[prev.state!.lieState];
    const curRank = LIE_STATE_RANK[cur.state!.lieState];
    const curIndex = orderedNodes.findIndex((n) => n.id === cur.node.id);
    const afterMidpoint = midpointIndex >= 0 && curIndex >= midpointIndex;

    if (character.arcType === 'positive' && curRank < prevRank && afterMidpoint) {
      out.push({
        code: 'arc_regression',
        severity: 'warn',
        characterId: character.id,
        nodeId: cur.node.id,
        message: `Позитивная арка откатывается после мидпоинта: «${prev.node.title || prev.node.id}» → «${cur.node.title || cur.node.id}». Если это осознанный рецидив — опишите его в заметке.`,
      });
    }
    if (character.arcType === 'flat' && cur.state!.lieState === 'believes') {
      out.push({
        code: 'flat_arc_belief',
        severity: 'warn',
        characterId: character.id,
        nodeId: cur.node.id,
        message: 'Плоская арка: персонаж уже владеет Истиной, состояние «верит в Ложь» требует объяснения',
      });
    }
  }

  if (character.arcType === 'positive' && midpointIndex >= 0) {
    const midState = byNode.get(orderedNodes[midpointIndex].id);
    if (!midState || LIE_STATE_RANK[midState.lieState] < LIE_STATE_RANK.glimpsing_truth) {
      out.push({
        code: 'no_moment_of_truth',
        severity: 'error',
        characterId: character.id,
        nodeId: orderedNodes[midpointIndex].id,
        message: 'На мидпоинте нет Момента истины: персонаж должен впервые увидеть Истину',
      });
    }
  }

  if (isBlank(character.lie)) {
    out.push({ code: 'lie_missing', severity: 'error', characterId: character.id, message: 'Не сформулирована Ложь' });
  }
  if (isBlank(character.ghost) && !isBlank(character.lie)) {
    out.push({
      code: 'ghost_missing',
      severity: 'warn',
      characterId: character.id,
      message: 'Ложь висит без опоры: не описан Призрак',
    });
  }
  if (isBlank(character.need)) {
    out.push({ code: 'need_missing', severity: 'error', characterId: character.id, message: 'Не сформулировано Нужно/Истина' });
  }
  if (isBlank(character.want)) {
    out.push({ code: 'want_missing', severity: 'error', characterId: character.id, message: 'Не сформулировано Хочет' });
  }
  return out;
}

/* ────────────────────────────  Моури: сцена  ──────────────────────────── */

export function sceneDefects(scene: Scene): Defect[] {
  const out: Defect[] = [];
  if (isBlank(scene.sceneObjective)) {
    out.push({ code: 'scene_objective_missing', severity: 'error', sceneId: scene.id, message: 'Нет задачи сцены' });
  }
  if (isBlank(scene.obstacle)) {
    out.push({ code: 'obstacle_missing', severity: 'error', sceneId: scene.id, message: 'Нет препятствия — конфликт неоткуда взять' });
  }
  if (isBlank(scene.turn)) {
    out.push({ code: 'turn_missing', severity: 'error', sceneId: scene.id, message: 'Сцена не поворачивает историю' });
  }
  if (scene.valueShiftFrom === scene.valueShiftTo) {
    out.push({
      code: 'no_value_shift',
      severity: 'error',
      sceneId: scene.id,
      message: 'Заряд не меняется: сцена умирает на странице',
    });
  }
  if (!scene.tactics.filter((t) => !isBlank(t)).length) {
    out.push({ code: 'tactics_missing', severity: 'warn', sceneId: scene.id, message: 'Не выписаны тактики персонажей' });
  }
  if (isBlank(scene.mamet.whoWantsWhatFromWhom)) {
    out.push({ code: 'mamet_missing', severity: 'warn', sceneId: scene.id, message: 'Не отвечен первый вопрос Мэмета' });
  }
  return out;
}

/* ────────────────────────────  сводка проекта  ──────────────────────────── */

export interface ProjectDiagnostics {
  coverage: Coverage;
  defects: Defect[];
  errors: number;
  warnings: number;
}

export function projectDiagnostics(input: {
  beats: GenreBeat[];
  nodes: StructureNode[];
  characters: Character[];
  arcStates: CharacterArcState[];
  scenes: Scene[];
}): ProjectDiagnostics {
  const defects: Defect[] = [];
  for (const node of input.nodes) {
    defects.push(...circleDefects(node), ...nodeDefects(node));
  }
  defects.push(...continuityDefects(input.nodes));

  const ordered = orderNodesForArcMatrix(input.nodes);
  for (const character of input.characters) {
    defects.push(
      ...arcDefects(
        character,
        ordered,
        input.arcStates.filter((s) => s.characterId === character.id),
      ),
    );
  }
  for (const scene of input.scenes) defects.push(...sceneDefects(scene));

  return {
    coverage: coverage(input.beats),
    defects,
    errors: defects.filter((d) => d.severity === 'error').length,
    warnings: defects.filter((d) => d.severity === 'warn').length,
  };
}

/** Плоский обход дерева в сюжетном порядке — колонки матрицы арок. */
export function orderNodesForArcMatrix(nodes: StructureNode[], rootId: ID | null = null): StructureNode[] {
  const children = nodes
    .filter((n) => n.parentId === rootId)
    .sort((a, b) => a.order - b.order);
  const out: StructureNode[] = [];
  for (const child of children) {
    out.push(child);
    out.push(...orderNodesForArcMatrix(nodes, child.id));
  }
  return out;
}
