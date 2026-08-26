import { CONCEPT_LABELS, type AIMode, type Concept } from '../../types';
import { stem } from './tokenize';

/**
 * Ключевые слова концептов. Используются двояко: авторазметка кусков при
 * импорте и расширение поискового запроса от режима AI.
 */
const CONCEPT_KEYWORDS: Record<Concept, string[]> = {
  genre_beats: ['жанр', 'бит', 'обязательный', 'детектив', 'триллер', 'криминал', 'хоррор', 'миф', 'экшн', 'genre', 'beat'],
  genre_transcendence: ['трансценд', 'вывернуть', 'инверсия', 'выделиться', 'превзойти', 'transcend', 'twist'],
  story_circle: ['круг', 'восемь шагов', 'story circle', 'зона комфорта', 'порог', 'возвращается'],
  find_take: ['цена', 'заплатить', 'получает желаемое', 'find', 'take', 'страдание'],
  continuity: ['стыковка', 'сериал', 'следующая серия', 'непрерывность', 'сквозн'],
  lie_ghost: ['ложь', 'призрак', 'рана', 'заблуждение', 'lie', 'ghost', 'wound'],
  want_need: ['хочет', 'нужно', 'потребность', 'желание', 'want', 'need'],
  arc_types: ['арка', 'позитивная', 'плоская', 'негативная', 'падение', 'развращение', 'разочарование', 'arc'],
  midpoint: ['мидпоинт', 'середина', 'момент истины', 'midpoint'],
  pinch_points: ['пинч', 'оппозиция', 'давление', 'pinch', 'antagonist'],
  philosophical_conflict: ['тезис', 'антитезис', 'философ', 'моральный аргумент', 'паутина', 'наставник', 'мировоззрен'],
  scene_craft: ['сцена', 'задача сцены', 'суперзадача', 'поворот', 'заряд', 'препятствие', 'тактик', 'scene'],
  dialogue: ['диалог', 'реплика', 'мэмет', 'mamet', 'подтекст', 'говорит'],
  page_style: ['ремарка', 'блок действия', 'страниц', 'формат', 'наречие', 'дозировка информации', 'зритель знает'],
};

const CONCEPT_STEMS: Record<Concept, Set<string>> = Object.fromEntries(
  (Object.keys(CONCEPT_KEYWORDS) as Concept[]).map((c) => [
    c,
    new Set(CONCEPT_KEYWORDS[c].flatMap((k) => k.split(/\s+/).map(stem))),
  ]),
) as Record<Concept, Set<string>>;

/** Какие концепты тянет каждый режим AI. */
export const MODE_CONCEPTS: Record<AIMode, Concept[]> = {
  genre_audit: ['genre_beats'],
  beat_transcendence: ['genre_transcendence', 'genre_beats'],
  circle_check: ['story_circle', 'find_take', 'continuity'],
  arc_audit: ['lie_ghost', 'want_need', 'arc_types', 'midpoint'],
  scene_doctor: ['scene_craft', 'dialogue', 'want_need'],
  fincher_pass: ['page_style', 'dialogue'],
  canon_check: ['genre_beats', 'genre_transcendence'],
};

/** Проставляет концепты куску текста по совпадению основ слов. */
export function autoTagConcepts(text: string, minHits = 2): Concept[] {
  const words = new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(stem),
  );
  const out: Concept[] = [];
  for (const concept of Object.keys(CONCEPT_STEMS) as Concept[]) {
    let hits = 0;
    for (const s of CONCEPT_STEMS[concept]) if (words.has(s)) hits += 1;
    if (hits >= minHits) out.push(concept);
  }
  return out;
}

export function conceptQueryTerms(concepts: Concept[]): string {
  return concepts.flatMap((c) => [CONCEPT_LABELS[c], ...CONCEPT_KEYWORDS[c]]).join(' ');
}
