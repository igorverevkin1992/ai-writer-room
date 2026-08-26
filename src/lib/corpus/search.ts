import { db } from '../../db/db';
import { tokenize } from './tokenize';
import type { Concept, SourceAuthor, SourceChunk, SourceDoc } from '../../types';

/* ────────────────────────────  индекс BM25  ──────────────────────────── */

export interface CorpusIndex {
  chunks: SourceChunk[];
  /** основа слова → [позиция куска, частота] */
  postings: Map<string, [number, number][]>;
  lengths: number[];
  avgLength: number;
}

export function buildIndex(chunks: SourceChunk[]): CorpusIndex {
  const postings = new Map<string, [number, number][]>();
  const lengths: number[] = [];
  chunks.forEach((chunk, i) => {
    const terms = tokenize(chunk.text);
    lengths.push(terms.length);
    const counts = new Map<string, number>();
    for (const t of terms) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [term, count] of counts) {
      const list = postings.get(term);
      if (list) list.push([i, count]);
      else postings.set(term, [[i, count]]);
    }
  });
  const total = lengths.reduce((a, b) => a + b, 0);
  return { chunks, postings, lengths, avgLength: lengths.length ? total / lengths.length : 0 };
}

export interface SearchOptions {
  concepts?: Concept[];
  authors?: SourceAuthor[];
  docIds?: string[];
  limit?: number;
  /** Насколько поднимать куски с нужным концептом. 0 — не поднимать. */
  conceptBoost?: number;
}

export interface Hit {
  chunk: SourceChunk;
  score: number;
}

const K1 = 1.5;
const B = 0.75;

export function search(index: CorpusIndex, query: string, options: SearchOptions = {}): Hit[] {
  const { concepts = [], authors, docIds, limit = 8, conceptBoost = 0.35 } = options;
  if (!index.chunks.length) return [];

  const allowedDocs = docIds ? new Set(docIds) : null;
  const terms = tokenize(query);
  if (!terms.length) return [];

  const scores = new Map<number, number>();
  const N = index.chunks.length;

  for (const term of new Set(terms)) {
    const list = index.postings.get(term);
    if (!list) continue;
    const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
    for (const [i, freq] of list) {
      const norm = 1 - B + (B * index.lengths[i]) / (index.avgLength || 1);
      const tf = (freq * (K1 + 1)) / (freq + K1 * norm);
      scores.set(i, (scores.get(i) ?? 0) + idf * tf);
    }
  }

  const conceptSet = new Set(concepts);
  const authorSet = authors ? new Set(authors) : null;
  const hits: Hit[] = [];
  for (const [i, base] of scores) {
    const chunk = index.chunks[i];
    if (allowedDocs && !allowedDocs.has(chunk.docId)) continue;
    let score = base;
    if (conceptSet.size && chunk.concepts.some((c) => conceptSet.has(c))) {
      score *= 1 + conceptBoost;
    }
    if (authorSet) {
      const author = DOC_AUTHORS.get(chunk.docId);
      if (author && authorSet.has(author)) score *= 1.25;
    }
    hits.push({ chunk, score });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/* ────────────────────  кэш индекса поверх Dexie  ──────────────────── */

const DOC_AUTHORS = new Map<string, SourceAuthor>();
let cached: { version: number; index: CorpusIndex } | null = null;
let version = 0;

/** Вызывается после любой записи в корпус. */
export function invalidateCorpusIndex(): void {
  version += 1;
  cached = null;
}

export async function getCorpusIndex(): Promise<CorpusIndex> {
  if (cached && cached.version === version) return cached.index;
  const [chunks, docs] = await Promise.all([db.sourceChunks.toArray(), db.sourceDocs.toArray()]);
  DOC_AUTHORS.clear();
  for (const doc of docs) DOC_AUTHORS.set(doc.id, doc.author);
  const index = buildIndex(chunks.sort((a, b) => a.index - b.index));
  cached = { version, index };
  return index;
}

export interface CorpusExcerpt {
  doc: SourceDoc;
  chunk: SourceChunk;
  score: number;
}

/** Поиск с подтягиванием документов — то, что уходит в промпт. */
export async function searchCorpus(query: string, options: SearchOptions = {}): Promise<CorpusExcerpt[]> {
  const index = await getCorpusIndex();
  const hits = search(index, query, options);
  if (!hits.length) return [];
  const docs = new Map((await db.sourceDocs.toArray()).map((d) => [d.id, d]));
  return hits
    .map((h) => {
      const doc = docs.get(h.chunk.docId);
      return doc ? { doc, chunk: h.chunk, score: h.score } : null;
    })
    .filter((x): x is CorpusExcerpt => x !== null);
}

/** Документы, закреплённые целиком в кэшируемом префиксе. */
export async function pinnedDocuments(): Promise<{ doc: SourceDoc; chunks: SourceChunk[] }[]> {
  const docs = (await db.sourceDocs.toArray()).filter((d) => d.pinned);
  if (!docs.length) return [];
  const out: { doc: SourceDoc; chunks: SourceChunk[] }[] = [];
  for (const doc of docs) {
    const chunks = (await db.sourceChunks.where({ docId: doc.id }).toArray()).sort(
      (a, b) => a.index - b.index,
    );
    out.push({ doc, chunks });
  }
  return out;
}
