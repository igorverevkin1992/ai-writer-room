import { autoTagConcepts } from './concepts';
import type { Concept } from '../../types';

export interface RawChunk {
  index: number;
  anchor: string;
  text: string;
  concepts: Concept[];
}

/** Кириллица плотнее в токенах: ~3 символа на токен, латиница ~4. */
export function approxTokens(text: string): number {
  const cyr = (text.match(/[Ѐ-ӿ]/g) ?? []).length;
  return Math.ceil(cyr / 3 + (text.length - cyr) / 4);
}

const HEADING = /^(#{1,6}\s+.+|[A-ZА-ЯЁ][^\n]{0,70}|\d+[.)]\s+[^\n]{0,70}|ГЛАВА[^\n]{0,60}|CHAPTER[^\n]{0,60})$/;
const TIMECODE = /^(?:\[)?(\d{1,2}:\d{2}(?::\d{2})?)/;

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  if (/^#{1,6}\s/.test(t)) return true;
  if (/[.!?]$/.test(t)) return false;
  return HEADING.test(t) && t === t.replace(/\s+$/, '');
}

/**
 * Режет текст на куски ~`targetTokens` по границам абзацев, не разрывая абзац.
 * Якорем куска становится ближайший вышестоящий заголовок или тайм-код —
 * по нему потом строится ссылка в ответе AI.
 */
/**
 * Абзац длиннее целевого размера режется по границам предложений. Без этого
 * pdf- и epub-извлечения, где глава приходит одним куском без пустых строк,
 * дают фрагменты в тысячи токенов и ломают выдачу.
 */
function splitLongParagraph(paragraph: string, targetTokens: number): string[] {
  if (approxTokens(paragraph) <= targetTokens) return [paragraph];
  const sentences = paragraph.match(/[^.!?…]+(?:[.!?…]+["»)]*|$)/g) ?? [paragraph];
  const out: string[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if (buffer && approxTokens(buffer + sentence) > targetTokens) {
      out.push(buffer.trim());
      buffer = '';
    }
    buffer += sentence;
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

export function chunkText(
  raw: string,
  { targetTokens = 700, overlapParagraphs = 1 }: { targetTokens?: number; overlapParagraphs?: number } = {},
): RawChunk[] {
  const paragraphs = raw
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .flatMap((p) => splitLongParagraph(p, targetTokens));

  const chunks: RawChunk[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;
  let anchor = '';
  let pendingAnchor = '';

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.join('\n\n');
    chunks.push({
      index: chunks.length + 1,
      anchor: anchor || `фрагмент ${chunks.length + 1}`,
      text,
      concepts: autoTagConcepts(text),
    });
    buffer = overlapParagraphs > 0 ? buffer.slice(-overlapParagraphs) : [];
    bufferTokens = buffer.reduce((sum, p) => sum + approxTokens(p), 0);
    if (pendingAnchor) {
      anchor = pendingAnchor;
      pendingAnchor = '';
    }
  };

  for (const paragraph of paragraphs) {
    const firstLine = paragraph.split('\n')[0];
    const time = TIMECODE.exec(firstLine);
    if (time) {
      if (!anchor) anchor = time[1];
      else pendingAnchor = time[1];
    } else if (looksLikeHeading(paragraph)) {
      const clean = paragraph.replace(/^#{1,6}\s+/, '').trim();
      if (buffer.length) pendingAnchor = clean;
      else anchor = clean;
    }

    const tokens = approxTokens(paragraph);
    if (bufferTokens + tokens > targetTokens && buffer.length) flush();
    buffer.push(paragraph);
    bufferTokens += tokens;
  }
  flush();

  // Последний flush оставляет хвост перекрытия — он уже вошёл в предыдущий кусок.
  return chunks.filter((c, i) => i === 0 || c.text.trim() !== chunks[i - 1].text.trim());
}
