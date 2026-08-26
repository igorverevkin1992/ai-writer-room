import { normalizeCircle } from '../db/repo';
import { continuityLinks, orderNodesForArcMatrix } from '../lib/validate';
import {
  ARC_TYPE_LABELS,
  AUDIENCE_POSITION_LABELS,
  BEAT_STATUS_LABELS,
  CIRCLE_STEPS,
  GENRE_LABELS,
  LEVEL_LABELS,
  LIE_STATE_LABELS,
  PONR_LABELS,
  PROJECT_TYPE_LABELS,
  WEILAND_BEATS,
  type AIMode,
  type Character,
  type CharacterArcState,
  type GenreBeat,
  type ID,
  type Project,
  type Scene,
  type StoryBible,
  type StructureNode,
} from '../types';
import { MAMET_SUBMODE_PROMPT } from './prompts';

export interface ContextBundle {
  project: Project;
  bible: StoryBible | undefined;
  beats: GenreBeat[];
  nodes: StructureNode[];
  characters: Character[];
  arcStates: CharacterArcState[];
  scenes: Scene[];
}

export interface Scope {
  nodeId?: ID | null;
  beatId?: ID | null;
  characterId?: ID | null;
  sceneId?: ID | null;
  mametSubmode?: boolean;
}

export type ContextKey =
  | 'project_core'
  | 'world'
  | 'characters'
  | 'beats'
  | 'structure'
  | 'node'
  | 'siblings'
  | 'arc_row'
  | 'arc_matrix'
  | 'scene'
  | 'scene_text';

export interface ContextItem {
  key: ContextKey;
  label: string;
  /** A — внутри кэшируемого префикса, B — после брейкпоинта. */
  block: 'A' | 'B';
}

export const CONTEXT_ITEMS: ContextItem[] = [
  { key: 'project_core', label: 'Логлайн, жанры, философский конфликт, тема', block: 'A' },
  { key: 'world', label: 'Мир и правила (библия)', block: 'A' },
  { key: 'characters', label: 'Библия персонажей (Ложь/Призрак/Хочет/Нужно/голос)', block: 'A' },
  { key: 'beats', label: 'Жанровые биты со статусами', block: 'B' },
  { key: 'structure', label: 'Дерево структуры (заголовки и саммари)', block: 'B' },
  { key: 'node', label: 'Выбранный узел: круг, цена, бит Уайлэнд', block: 'B' },
  { key: 'siblings', label: 'Соседние узлы того же уровня (стыковка CHANGE→YOU)', block: 'B' },
  { key: 'arc_row', label: 'Строка матрицы арок выбранного персонажа', block: 'B' },
  { key: 'arc_matrix', label: 'Полная матрица арок', block: 'B' },
  { key: 'scene', label: 'Карточка сцены (поля Моури)', block: 'B' },
  { key: 'scene_text', label: 'Текст сцены', block: 'B' },
];

export type ContextToggles = Record<ContextKey, boolean>;

const NONE: ContextToggles = {
  project_core: true,
  world: false,
  characters: false,
  beats: false,
  structure: false,
  node: false,
  siblings: false,
  arc_row: false,
  arc_matrix: false,
  scene: false,
  scene_text: false,
};

export function defaultToggles(mode: AIMode): ContextToggles {
  switch (mode) {
    case 'genre_audit':
      return { ...NONE, beats: true, structure: true };
    case 'beat_transcendence':
      return { ...NONE, beats: true };
    case 'circle_check':
      return { ...NONE, node: true, siblings: true, structure: true };
    case 'arc_audit':
      return { ...NONE, characters: true, arc_row: true, structure: true };
    case 'scene_doctor':
      return { ...NONE, characters: true, scene: true, node: true, scene_text: true };
    case 'fincher_pass':
      return { ...NONE, characters: true, scene: true, scene_text: true };
    default:
      return { ...NONE };
  }
}

/* ────────────────────────────  рендер кусков  ──────────────────────────── */

const dash = (s: string | null | undefined) => (s && s.trim() ? s.trim() : '—');

export function renderProjectCore(p: Project): string {
  const supporting = p.genresSupporting.map((g) => GENRE_LABELS[g]).join(', ') || '—';
  return `ПРОЕКТ «${p.title}» (${PROJECT_TYPE_LABELS[p.type]})
Логлайн: ${dash(p.logline)}
Ведущий жанр: ${GENRE_LABELS[p.genrePrimary]}. Поддерживающие: ${supporting}
Тема: ${dash(p.theme)}
Философский конфликт:
  ТЕЗИС: ${dash(p.philosophicalThesis)}
  АНТИТЕЗИС: ${dash(p.philosophicalAntithesis)}
Стратегия трансценденции жанра: ${dash(p.transcendenceStrategy)}`;
}

export function renderWorld(bible: StoryBible | undefined): string {
  if (!bible) return '';
  const rules = bible.rules.filter(Boolean);
  return `МИР
${dash(bible.worldDescription)}
Правила мира:
${rules.length ? rules.map((r, i) => `  ${i + 1}. ${r}`).join('\n') : '  —'}
Предыстория: ${dash(bible.backstory)}`;
}

export function renderCharacters(characters: Character[]): string {
  if (!characters.length) return 'ПЕРСОНАЖИ: не заведены';
  return `БИБЛИЯ ПЕРСОНАЖЕЙ
${characters
  .map(
    (c) => `— ${c.name}${c.role ? ` (${c.role})` : ''}, тип арки: ${ARC_TYPE_LABELS[c.arcType]}
  Убеждения: ${c.beliefs.filter(Boolean).join(' · ') || '—'}
  Ложь: ${dash(c.lie)}
  Призрак: ${dash(c.ghost)}
  Хочет: ${dash(c.want)}
  Нужно/Истина: ${dash(c.need)}
  Ставки внешние: ${dash(c.stakesExternal)} · Ставки философские: ${dash(c.stakesPhilosophical)}
  Позиция на спектре тезис(−100)↔антитезис(+100): ${c.philosophicalPosition}
  Голос: ${dash(c.voiceProfile)}
  Связи: ${
    c.relationships.length
      ? c.relationships
          .map((r) => {
            const other = characters.find((x) => x.id === r.charId);
            return `${other?.name ?? '?'} — ${r.type || 'связь'}${r.conflictOfBeliefs ? `, конфликт убеждений: ${r.conflictOfBeliefs}` : ''}`;
          })
          .join('; ')
      : '—'
  }`,
  )
  .join('\n')}`;
}

export function renderBeats(beats: GenreBeat[], nodes: StructureNode[]): string {
  if (!beats.length) return 'ЖАНРОВЫЕ БИТЫ: библиотека пуста';
  const nodeTitle = (id: ID | null) =>
    id ? nodes.find((n) => n.id === id)?.title || '(узел без названия)' : 'НЕ РАЗМЕЩЁН';
  const groups = new Map<string, GenreBeat[]>();
  for (const b of beats) {
    const key = `${b.isPrimary ? 'ВЕДУЩИЙ' : 'поддерживающий'} — ${GENRE_LABELS[b.genre]}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return `ЖАНРОВЫЕ БИТЫ (Труби)
${[...groups.entries()]
  .map(
    ([title, list]) => `[${title}]
${list
  .sort((a, b) => a.beatIndex - b.beatIndex)
  .map(
    (b) =>
      `  ${b.beatIndex}. ${b.beatName} — ${BEAT_STATUS_LABELS[b.status]} → ${nodeTitle(b.assignedNodeId)}${b.twistNote ? `\n     вывернут: ${b.twistNote}` : ''}`,
  )
  .join('\n')}`,
  )
  .join('\n')}`;
}

function nodeLine(node: StructureNode, depth: number): string {
  const pad = '  '.repeat(depth);
  const beat = WEILAND_BEATS.find((b) => b.key === node.weilandBeat);
  const marks = [
    node.weilandBeat !== 'none' ? beat?.label : null,
    node.targetPercent !== null ? `~${node.targetPercent}%` : null,
  ]
    .filter(Boolean)
    .join(', ');
  return `${pad}[${LEVEL_LABELS[node.level]}] ${node.title || '(без названия)'}${marks ? ` (${marks})` : ''}${
    node.summary ? `\n${pad}    ${node.summary}` : ''
  }`;
}

export function renderTree(nodes: StructureNode[], parentId: ID | null = null, depth = 0): string {
  return nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map((n) => [nodeLine(n, depth), renderTree(nodes, n.id, depth + 1)].filter(Boolean).join('\n'))
    .join('\n');
}

export function renderNode(node: StructureNode, nodes: StructureNode[]): string {
  const circle = normalizeCircle(node.circle);
  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : undefined;
  const beat = WEILAND_BEATS.find((b) => b.key === node.weilandBeat);
  return `УЗЕЛ СТРУКТУРЫ «${node.title || '(без названия)'}» — уровень: ${LEVEL_LABELS[node.level]}
Родитель: ${parent ? parent.title || '(без названия)' : 'нет (корень)'}${
    node.circleStep ? `, реализует шаг ${node.circleStep} круга родителя` : ''
  }
Саммари: ${dash(node.summary)}
Бит Уайлэнд: ${beat?.label ?? '—'}${node.targetPercent !== null ? `, целевой тайминг ~${node.targetPercent}%` : ''}
Что персонаж получает: ${dash(node.whatIsGained)}
Какую цену платит: ${dash(node.costPaid)}
Точка невозврата: ${PONR_LABELS[node.pointOfNoReturn]}
Чем давит оппозиция: ${dash(node.oppositionPressure)}

КРУГ ХАРМОНА НА ЭТОМ УЗЛЕ:
${CIRCLE_STEPS.map((s) => {
  const slot = circle[s.index - 1];
  return `  ${s.index}. ${s.label} (${s.hint}): ${slot.title ? `${slot.title} — ` : ''}${slot.summary || (slot.title ? '' : 'ПУСТО')}`;
}).join('\n')}`;
}

export function renderSiblings(node: StructureNode, nodes: StructureNode[]): string {
  const siblings = nodes
    .filter((n) => n.parentId === node.parentId && n.level === node.level)
    .sort((a, b) => a.order - b.order);
  if (siblings.length < 2) return 'СОСЕДНИЕ УЗЛЫ: их нет';
  const links = continuityLinks(siblings);
  return `СОСЕДНИЕ УЗЛЫ ТОГО ЖЕ УРОВНЯ И СТЫКОВКА CHANGE→YOU
${siblings
  .map((s, i) => `  ${i + 1}. ${s.title || '(без названия)'}${s.id === node.id ? '  ← выбранный' : ''}`)
  .join('\n')}
${links
  .map((l) => {
    const from = siblings.find((s) => s.id === l.fromId)!;
    const to = siblings.find((s) => s.id === l.toId)!;
    return `  «${from.title || '?'}» CHANGE: ${l.fromText || 'ПУСТО'}
  → «${to.title || '?'}» YOU: ${l.toText || 'ПУСТО'}
  формальное совпадение слов: ${Math.round(l.similarity * 100)}%${l.acknowledged ? ' (автор подтвердил стыковку вручную)' : ''}`;
  })
  .join('\n')}`;
}

export function renderArcRow(
  character: Character,
  nodes: StructureNode[],
  states: CharacterArcState[],
): string {
  const ordered = orderNodesForArcMatrix(nodes);
  const byNode = new Map(states.map((s) => [s.structureNodeId, s]));
  const rows = ordered
    .map((n) => {
      const st = byNode.get(n.id);
      if (!st) return null;
      const beat = WEILAND_BEATS.find((b) => b.key === n.weilandBeat);
      return `  ${n.title || '(без названия)'} (${beat && n.weilandBeat !== 'none' ? beat.label : LEVEL_LABELS[n.level]}${
        n.targetPercent !== null ? `, ~${n.targetPercent}%` : ''
      }) — состояние Лжи: ${LIE_STATE_LABELS[st.lieState]}${st.note ? ` · ${st.note}` : ''}
     событие узла: ${dash(n.summary)}`;
    })
    .filter(Boolean);
  return `СОСТОЯНИЕ ЛЖИ ПО БИТАМ — ${character.name}
${rows.length ? rows.join('\n') : '  (строка матрицы пуста)'}`;
}

export function renderArcMatrix(
  characters: Character[],
  nodes: StructureNode[],
  states: CharacterArcState[],
): string {
  return `МАТРИЦА АРОК
${characters
  .map((c) =>
    renderArcRow(
      c,
      nodes,
      states.filter((s) => s.characterId === c.id),
    ),
  )
  .join('\n\n')}`;
}

export function renderScene(scene: Scene, characters: Character[], nodes: StructureNode[]): string {
  const parent = nodes.find((n) => n.id === scene.parentNodeId);
  const people = scene.characterIds
    .map((id) => characters.find((c) => c.id === id))
    .filter(Boolean) as Character[];
  return `СЦЕНА «${scene.heading}»
Узел: ${parent ? `${LEVEL_LABELS[parent.level]} «${parent.title || '(без названия)'}»` : '—'}
Саммари: ${dash(scene.summary)}
Задача сцены (здесь и сейчас): ${dash(scene.sceneObjective)}
Суперзадача (заметка автора): ${dash(scene.superObjectiveNote)}
Препятствие: ${dash(scene.obstacle)}
Тактики: ${scene.tactics.filter(Boolean).join(' · ') || '—'}
Поворот сцены: ${dash(scene.turn)}
Сдвиг заряда: ${scene.valueShiftFrom} → ${scene.valueShiftTo}
Позиция зрителя: ${AUDIENCE_POSITION_LABELS[scene.audiencePosition]}
Вопросы Мэмета:
  Кто чего хочет от кого: ${dash(scene.mamet.whoWantsWhatFromWhom)}
  Что будет, если не получит: ${dash(scene.mamet.stakesIfDenied)}
  Почему именно сейчас: ${dash(scene.mamet.whyNow)}
Участники и их суперзадачи:
${
  people.length
    ? people
        .map((c) => `  — ${c.name}: Хочет — ${dash(c.want)}; Нужно — ${dash(c.need)}; голос — ${dash(c.voiceProfile)}`)
        .join('\n')
    : '  —'
}`;
}

/* ────────────────────────────  сборка  ──────────────────────────── */

export function buildCachedSystem(bundle: ContextBundle, toggles: ContextToggles): string {
  const parts = [
    `Ты работаешь внутри инструмента разработки сериалов Writers Room OS.
Методологическое ядро жёстко задано и не обсуждается:
Труби (жанр как обязательные биты) → Хармон (круг структуры) → Уайлэнд (арка через Ложь)
→ Моури (поворот, цена, сцена) → Финчер (текст на странице).
Ты не пишешь за автора. Ты аудируешь структуру по формальным критериям методологии
и переписываешь текст только тогда, когда это прямо задача режима.`,
  ];
  if (toggles.project_core) parts.push(renderProjectCore(bundle.project));
  if (toggles.world) parts.push(renderWorld(bundle.bible));
  if (toggles.characters) parts.push(renderCharacters(bundle.characters));
  return parts.filter(Boolean).join('\n\n');
}

export function buildDynamicContext(
  bundle: ContextBundle,
  toggles: ContextToggles,
  scope: Scope,
): string {
  const parts: string[] = [];
  const node = scope.nodeId ? bundle.nodes.find((n) => n.id === scope.nodeId) : undefined;
  const character = scope.characterId
    ? bundle.characters.find((c) => c.id === scope.characterId)
    : undefined;
  const scene = scope.sceneId ? bundle.scenes.find((s) => s.id === scope.sceneId) : undefined;
  const beat = scope.beatId ? bundle.beats.find((b) => b.id === scope.beatId) : undefined;

  if (toggles.beats) {
    if (beat) {
      parts.push(
        `РАЗБИРАЕМЫЙ БИТ: ${GENRE_LABELS[beat.genre]}${beat.isPrimary ? ' (ведущий жанр)' : ''}, №${beat.beatIndex}
Название: ${beat.beatName}
Описание: ${dash(beat.beatDescription)}
Статус: ${BEAT_STATUS_LABELS[beat.status]}${beat.twistNote ? `\nТекущая заметка о вывертывании: ${beat.twistNote}` : ''}`,
      );
    } else {
      parts.push(renderBeats(bundle.beats, bundle.nodes));
    }
  }
  if (toggles.structure) parts.push(`ДЕРЕВО СТРУКТУРЫ\n${renderTree(bundle.nodes) || '  (пусто)'}`);
  if (toggles.node && node) parts.push(renderNode(node, bundle.nodes));
  if (toggles.siblings && node) parts.push(renderSiblings(node, bundle.nodes));
  if (toggles.arc_row && character) {
    parts.push(
      renderArcRow(
        character,
        bundle.nodes,
        bundle.arcStates.filter((s) => s.characterId === character.id),
      ),
    );
  }
  if (toggles.arc_matrix) parts.push(renderArcMatrix(bundle.characters, bundle.nodes, bundle.arcStates));
  if (toggles.scene && scene) parts.push(renderScene(scene, bundle.characters, bundle.nodes));
  if (toggles.scene_text && scene) {
    parts.push(`ИСХОДНЫЙ ТЕКСТ СЦЕНЫ:\n${scene.content.trim() || '(пусто)'}`);
    if (scene.contentFincherPass.trim()) {
      parts.push(`ТЕКУЩАЯ ВЕРСИЯ ПОСЛЕ ФИНЧЕРОВСКОГО ПРОХОДА:\n${scene.contentFincherPass.trim()}`);
    }
  }
  return parts.join('\n\n');
}

export function buildUserMessage(params: {
  mode: AIMode;
  bundle: ContextBundle;
  toggles: ContextToggles;
  scope: Scope;
  query: string;
}): string {
  const dynamic = buildDynamicContext(params.bundle, params.toggles, params.scope);
  const scene = params.scope.sceneId
    ? params.bundle.scenes.find((s) => s.id === params.scope.sceneId)
    : undefined;

  const extra: string[] = [];
  if (params.mode === 'fincher_pass' && scene) {
    extra.push(
      `ДОЗИРОВКА ИНФОРМАЦИИ: в этой сцене зритель должен быть «${AUDIENCE_POSITION_LABELS[scene.audiencePosition]}».
Соблюдай это: не выдавай раньше и не прячь дольше.`,
    );
  }
  if (params.mode === 'scene_doctor' && params.scope.mametSubmode) {
    extra.push(MAMET_SUBMODE_PROMPT);
  }

  return [dynamic, ...extra, `ЗАПРОС АВТОРА:\n${params.query.trim() || '(выполни задачу режима)'}`]
    .filter(Boolean)
    .join('\n\n');
}
