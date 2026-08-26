/**
 * Writers Room OS — модель данных.
 *
 * Пять слоёв методологии занимают непересекающиеся поля:
 *   1. Труби   → GenreBeat            (ЧТО обязано случиться)
 *   2. Хармон  → StructureNode.circle (ГДЕ это случается)
 *   3. Уайлэнд → Character + CharacterArcState (КТО меняется)
 *   4. Моури   → StructureNode.whatIsGained/costPaid + Scene (КАК устроен поворот)
 *   5. Финчер  → стилевой промпт в src/ai/prompts.ts (КАК написано на странице)
 */

export type ID = string;

/* ─────────────────────────────  Project  ───────────────────────────── */

export type ProjectType = 'series' | 'feature' | 'vertical';

export type Genre =
  | 'horror'
  | 'action'
  | 'myth'
  | 'memoir'
  | 'coming_of_age'
  | 'sci_fi'
  | 'crime'
  | 'comedy'
  | 'western'
  | 'gangster'
  | 'fantasy'
  | 'thriller'
  | 'detective'
  | 'love_story';

export const GENRE_LABELS: Record<Genre, string> = {
  detective: 'Детектив',
  thriller: 'Триллер',
  crime: 'Криминал',
  horror: 'Хоррор',
  myth: 'Миф',
  action: 'Экшн',
  love_story: 'История любви',
  coming_of_age: 'Взросление',
  sci_fi: 'Научная фантастика',
  comedy: 'Комедия',
  western: 'Вестерн',
  gangster: 'Гангстерский',
  fantasy: 'Фэнтези',
  memoir: 'Мемуар',
};

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  series: 'Сериал',
  feature: 'Полный метр',
  vertical: 'Вертикаль (микро-драма)',
};

export interface Project {
  id: ID;
  title: string;
  type: ProjectType;
  logline: string;
  genrePrimary: Genre;
  /** 2–3 поддерживающих жанра (правило Труби: 3–4 жанра всего). */
  genresSupporting: Genre[];
  philosophicalThesis: string;
  philosophicalAntithesis: string;
  theme: string;
  transcendenceStrategy: string;
  seasonsCount: number;
  episodesPerSeason: number;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface StoryBible {
  id: ID;
  projectId: ID;
  worldDescription: string;
  rules: string[];
  backstory: string;
  timing: { episodeDurationSec: number; episodesCount: number };
}

/* ──────────────────────────  Труби: жанровые биты  ────────────────────────── */

export type BeatStatus = 'unplaced' | 'placed' | 'twisted';

export const BEAT_STATUS_LABELS: Record<BeatStatus, string> = {
  unplaced: 'не размещён',
  placed: 'размещён',
  twisted: 'вывернут',
};

export interface GenreBeat {
  id: ID;
  projectId: ID;
  genre: Genre;
  /** Позиция бита в каноническом списке жанра, 1-based. */
  beatIndex: number;
  beatName: string;
  beatDescription: string;
  status: BeatStatus;
  /** Узел структуры, на который назначен бит. null → не размещён. */
  assignedNodeId: ID | null;
  /** Как именно бит вывернут (перестановка / инверсия / замена носителя). */
  twistNote: string;
  /** Формулировка отредактирована автором относительно сид-библиотеки. */
  isEdited: boolean;
  /** Бит ведущего жанра — обязателен строже поддерживающих. */
  isPrimary: boolean;
}

/* ──────────────────────  Хармон + Уайлэнд + Моури: структура  ────────────────────── */

export type StructureLevel = 'work' | 'season' | 'episode' | 'act';

export const LEVEL_LABELS: Record<StructureLevel, string> = {
  work: 'Произведение',
  season: 'Сезон',
  episode: 'Серия',
  act: 'Акт',
};

export type CircleStepKey =
  | 'you'
  | 'need'
  | 'go'
  | 'search'
  | 'find'
  | 'take'
  | 'return'
  | 'change';

export const CIRCLE_STEPS: { index: number; key: CircleStepKey; label: string; hint: string }[] = [
  { index: 1, key: 'you', label: 'YOU', hint: 'Герой в зоне комфорта' },
  { index: 2, key: 'need', label: 'NEED', hint: 'Он чего-то хочет' },
  { index: 3, key: 'go', label: 'GO', hint: 'Входит в незнакомую ситуацию' },
  { index: 4, key: 'search', label: 'SEARCH', hint: 'Адаптируется' },
  { index: 5, key: 'find', label: 'FIND', hint: 'Получает желаемое' },
  { index: 6, key: 'take', label: 'TAKE', hint: 'Платит высокую цену' },
  { index: 7, key: 'return', label: 'RETURN', hint: 'Возвращается' },
  { index: 8, key: 'change', label: 'CHANGE', hint: 'Изменившись' },
];

export interface CircleSlot {
  step: number; // 1..8
  title: string;
  summary: string;
}

export type WeilandBeat =
  | 'hook'
  | 'inciting'
  | 'plot_point_1'
  | 'pinch_1'
  | 'midpoint'
  | 'pinch_2'
  | 'plot_point_3'
  | 'climax'
  | 'resolution'
  | 'none';

export const WEILAND_BEATS: { key: WeilandBeat; label: string; percent: number | null }[] = [
  { key: 'hook', label: 'Крючок', percent: 1 },
  { key: 'inciting', label: 'Инцидент', percent: 12 },
  { key: 'plot_point_1', label: 'Первая поворотная точка', percent: 25 },
  { key: 'pinch_1', label: 'Первый пинч-поинт', percent: 37 },
  { key: 'midpoint', label: 'Мидпоинт / Момент истины', percent: 50 },
  { key: 'pinch_2', label: 'Второй пинч-поинт', percent: 62 },
  { key: 'plot_point_3', label: 'Третья поворотная точка', percent: 75 },
  { key: 'climax', label: 'Кульминация', percent: 88 },
  { key: 'resolution', label: 'Развязка', percent: 98 },
  { key: 'none', label: '— не привязан —', percent: null },
];

export type PointOfNoReturn = 'external' | 'philosophical' | 'none';

export const PONR_LABELS: Record<PointOfNoReturn, string> = {
  external: 'внешняя',
  philosophical: 'философская',
  none: 'нет',
};

export interface StructureNode {
  id: ID;
  projectId: ID;
  level: StructureLevel;
  parentId: ID | null;
  /** Позиция среди сиблингов — задаёт последовательность для проверки CHANGE→YOU. */
  order: number;
  /** Какой шаг круга родителя реализует этот узел (1..8), null — не привязан. */
  circleStep: number | null;
  title: string;
  summary: string;
  /** Собственный круг Хармона узла: ровно 8 слотов. */
  circle: CircleSlot[];
  /** Моури: что персонаж получает. */
  whatIsGained: string;
  /** Моури: какую цену платит. Пустая цена — дефект структуры. */
  costPaid: string;
  pointOfNoReturn: PointOfNoReturn;
  weilandBeat: WeilandBeat;
  targetPercent: number | null;
  /** Обязательно для пинч-поинтов: чем давит оппозиция. */
  oppositionPressure: string;
  /** Автор вручную подтвердил стыковку CHANGE→YOU со следующим узлом. */
  continuityAck: boolean;
}

/* ──────────────────────  Уайлэнд + Моури: персонажи  ────────────────────── */

export type ArcType =
  | 'positive'
  | 'flat'
  | 'negative_disillusionment'
  | 'negative_fall'
  | 'negative_corruption'
  | 'open_ended';

export const ARC_TYPE_LABELS: Record<ArcType, string> = {
  positive: 'Позитивная',
  flat: 'Плоская (Flat)',
  negative_disillusionment: 'Негативная: Разочарование',
  negative_fall: 'Негативная: Падение',
  negative_corruption: 'Негативная: Развращение',
  open_ended: 'Открытая',
};

export const ARC_TYPE_HINTS: Record<ArcType, string> = {
  positive: 'Верит в Ложь → сталкивается с Истиной → принимает Истину',
  flat: 'Уже владеет Истиной → её испытывают → удерживает и меняет мир вокруг',
  negative_disillusionment: 'Принимает новую истину, но она трагична',
  negative_fall: 'Цепляется за Ложь, отвергает истину, приходит к худшей лжи',
  negative_corruption: 'Видит Истину, отвергает её, выбирает Ложь',
  open_ended: 'Трактуется двояко — как «Одержимость»: падение и плоская вокруг одного тезиса',
};

export interface Relationship {
  charId: ID;
  type: string;
  conflictOfBeliefs: string;
}

export interface Character {
  id: ID;
  projectId: ID;
  name: string;
  role: string;
  /** Моури: Убеждения → Нужно → Хочет. */
  beliefs: string[];
  lie: string;
  ghost: string;
  want: string;
  need: string;
  arcType: ArcType;
  stakesExternal: string;
  stakesPhilosophical: string;
  /** −100 = полюс тезиса, +100 = полюс антитезиса. */
  philosophicalPosition: number;
  voiceProfile: string;
  relationships: Relationship[];
  order: number;
}

export type LieState =
  | 'believes'
  | 'doubting'
  | 'glimpsing_truth'
  | 'rejecting_truth'
  | 'embracing_truth';

export const LIE_STATE_LABELS: Record<LieState, string> = {
  believes: 'верит',
  doubting: 'сомневается',
  glimpsing_truth: 'видит проблеск',
  rejecting_truth: 'отвергает',
  embracing_truth: 'принимает',
};

/** Порядок «глубины» принятия Истины — для детекции откатов в позитивной арке. */
export const LIE_STATE_RANK: Record<LieState, number> = {
  believes: 0,
  doubting: 1,
  glimpsing_truth: 2,
  rejecting_truth: 1,
  embracing_truth: 3,
};

export interface CharacterArcState {
  id: ID;
  projectId: ID;
  characterId: ID;
  structureNodeId: ID;
  lieState: LieState;
  note: string;
}

/* ──────────────────────────  Моури: сцена  ────────────────────────── */

export type Charge = '+' | '−';
export type AudiencePosition = 'ahead' | 'level' | 'behind';

export const AUDIENCE_POSITION_LABELS: Record<AudiencePosition, string> = {
  ahead: 'зритель впереди героя',
  level: 'зритель вровень с героем',
  behind: 'зритель позади героя',
};

export interface Scene {
  id: ID;
  projectId: ID;
  parentNodeId: ID;
  order: number;
  heading: string;
  summary: string;
  sceneObjective: string;
  superObjectiveNote: string;
  obstacle: string;
  tactics: string[];
  turn: string;
  valueShiftFrom: Charge;
  valueShiftTo: Charge;
  audiencePosition: AudiencePosition;
  mamet: { whoWantsWhatFromWhom: string; stakesIfDenied: string; whyNow: string };
  characterIds: ID[];
  content: string;
  contentFincherPass: string;
  fincherCutList: string;
}

/* ────────────────────────────  AI  ──────────────────────────── */

export type AIMode =
  | 'genre_audit'
  | 'beat_transcendence'
  | 'circle_check'
  | 'arc_audit'
  | 'scene_doctor'
  | 'fincher_pass'
  | 'canon_check';

export const AI_MODE_LABELS: Record<AIMode, string> = {
  genre_audit: '1 · Аудит жанра (Труби)',
  beat_transcendence: '2 · Трансценденция бита (Труби)',
  circle_check: '3 · Проверка круга (Хармон)',
  arc_audit: '4 · Аудит арки (Уайлэнд)',
  scene_doctor: '5 · Доктор сцены (Моури)',
  fincher_pass: '6 · Финчеровский проход (Финчер)',
  canon_check: '7 · Сверка с первоисточником',
};

export type ScopeType = 'project' | 'beat' | 'node' | 'character' | 'scene' | 'corpus';

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  model: string;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  usage?: AIUsage;
}

export interface AIConversation {
  id: ID;
  projectId: ID;
  mode: AIMode;
  scopeType: ScopeType;
  scopeId: ID | null;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

/* ────────────────────────  Корпус первоисточников  ──────────────────────── */

export type SourceKind = 'book' | 'transcript' | 'script' | 'article' | 'notes';

export const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  book: 'Книга',
  transcript: 'Транскрипт',
  script: 'Сценарий',
  article: 'Статья',
  notes: 'Заметки',
};

/** Автор методологии — он же слой ядра. `other` для всего постороннего. */
export type SourceAuthor = 'truby' | 'harmon' | 'weiland' | 'mowry' | 'fincher' | 'other';

export const SOURCE_AUTHOR_LABELS: Record<SourceAuthor, string> = {
  truby: 'Труби — жанр',
  harmon: 'Хармон — структура',
  weiland: 'Уайлэнд — персонаж',
  mowry: 'Моури — тактика',
  fincher: 'Финчер — текст',
  other: 'Другое',
};

/**
 * Концепты методологии — словарь, по которому куски корпуса привязываются
 * к режимам AI. Точнее, чем семантическая близость: запрос «аудит арки»
 * должен тянуть главы про Ложь и мидпоинт, а не всё похожее по словам.
 */
export type Concept =
  | 'genre_beats'
  | 'genre_transcendence'
  | 'story_circle'
  | 'find_take'
  | 'continuity'
  | 'lie_ghost'
  | 'want_need'
  | 'arc_types'
  | 'midpoint'
  | 'pinch_points'
  | 'philosophical_conflict'
  | 'scene_craft'
  | 'dialogue'
  | 'page_style';

export const CONCEPT_LABELS: Record<Concept, string> = {
  genre_beats: 'Обязательные биты жанра',
  genre_transcendence: 'Трансценденция жанра',
  story_circle: 'Круг: восемь шагов',
  find_take: 'FIND и TAKE, цена',
  continuity: 'Стыковка кругов, сериальность',
  lie_ghost: 'Ложь и Призрак',
  want_need: 'Хочет и Нужно',
  arc_types: 'Типы арок',
  midpoint: 'Мидпоинт, Момент истины',
  pinch_points: 'Пинч-поинты, давление оппозиции',
  philosophical_conflict: 'Философский конфликт, паутина персонажей',
  scene_craft: 'Устройство сцены, поворот, заряд',
  dialogue: 'Диалог, вопросы Мэмета',
  page_style: 'Текст на странице, дозировка информации',
};

export interface SourceDoc {
  id: ID;
  title: string;
  author: SourceAuthor;
  kind: SourceKind;
  /** Откуда взят текст: имя файла, ссылка на видео, издание. */
  citation: string;
  /** Закреплён в кэшируемом префиксе целиком, а не выдержками. */
  pinned: boolean;
  charCount: number;
  chunkCount: number;
  createdAt: number;
  note: string;
}

export interface SourceChunk {
  id: ID;
  docId: ID;
  /** Порядковый номер в документе, 1-based — работает как «страница». */
  index: number;
  /** Ближайший вышестоящий заголовок или тайм-код — для ссылки. */
  anchor: string;
  text: string;
  concepts: Concept[];
}
