import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { addSourceDoc, deleteSourceDoc, setChunkConcepts, updateSourceDoc } from '../db/repo';
import { approxTokens, chunkText } from '../lib/corpus/chunk';
import { SUPPORTED_EXTENSIONS, fileToText } from '../lib/corpus/import';
import { searchCorpus, type CorpusExcerpt } from '../lib/corpus/search';
import { autoTagConcepts } from '../lib/corpus/concepts';
import { citationOf } from '../ai/context';
import { DEFAULT_MODEL, modelInfo } from '../ai/models';
import { getModel } from '../lib/settings';
import {
  CONCEPT_LABELS,
  SOURCE_AUTHOR_LABELS,
  SOURCE_KIND_LABELS,
  type Concept,
  type ID,
  type SourceAuthor,
  type SourceKind,
} from '../types';
import { Button, Chip, Empty, Field, Modal, SectionTitle, Select, TextArea, TextInput } from '../components/ui';
import { plural, usd } from '../lib/format';

/** Кириллица ≈3.3 символа на токен. Тысячи сокращаем, сотни — нет. */
function tokenLabel(chars: number): string {
  const tokens = Math.ceil(chars / 3.3);
  return tokens >= 1000
    ? `${Math.round(tokens / 1000).toLocaleString('ru')}k ток.`
    : `${tokens.toLocaleString('ru')} ток.`;
}

const AUTHORS = Object.keys(SOURCE_AUTHOR_LABELS) as SourceAuthor[];
const KINDS = Object.keys(SOURCE_KIND_LABELS) as SourceKind[];
const CONCEPTS = Object.keys(CONCEPT_LABELS) as Concept[];

export function CorpusScreen() {
  const docs = useLiveQuery(async () => (await db.sourceDocs.toArray()).sort((a, b) => b.createdAt - a.createdAt), []);
  const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState<ID | null>(null);
  const selected = docs?.find((d) => d.id === selectedId) ?? null;

  const pinnedTokens = useMemo(
    () => (docs ?? []).filter((d) => d.pinned).reduce((sum, d) => sum + Math.ceil(d.charCount / 3.3), 0),
    [docs],
  );
  const info = modelInfo(getModel(DEFAULT_MODEL));
  const cacheReadCost = (pinnedTokens * info.inputPerMTok * 0.1) / 1_000_000;
  const cacheWriteCost = (pinnedTokens * info.inputPerMTok * 2) / 1_000_000;

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-ink-700 px-6 py-3 flex items-center gap-4 shrink-0">
        <Link to="/" className="text-muted hover:text-paper text-sm">
          ←
        </Link>
        <div>
          <h1 className="font-semibold leading-tight">Корпус первоисточников</h1>
          <p className="text-[11px] text-muted">
            Оригиналы Труби, Хармона, Уайлэнд, транскрипты Моури, сценарии. Всё хранится локально.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {pinnedTokens > 0 && (
            <Chip tone="accent" title="Закреплённые документы уходят в кэшируемый префикс каждого запроса">
              закреплено ≈{pinnedTokens.toLocaleString('ru')} ток. · {usd(cacheReadCost)}/запрос
            </Chip>
          )}
          <Button variant="primary" onClick={() => setImporting(true)}>
            Добавить источник
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr]">
        <aside className="border-r border-ink-700 overflow-y-auto p-3">
          <SectionTitle>Документы</SectionTitle>
          {!docs?.length ? (
            <Empty>Корпус пуст</Empty>
          ) : (
            <ul className="space-y-1">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    onClick={() => setSelectedId(doc.id)}
                    className={`w-full text-left px-2 py-2 rounded transition-colors ${
                      selectedId === doc.id ? 'bg-ink-700' : 'hover:bg-ink-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {doc.pinned && <span className="text-accent text-[10px]">◆</span>}
                      <span className="text-sm truncate flex-1">{doc.title}</span>
                    </div>
                    <div className="text-[10px] text-muted">
                      {SOURCE_AUTHOR_LABELS[doc.author].split(' — ')[0]} · {SOURCE_KIND_LABELS[doc.kind]} ·{' '}
                      {doc.chunkCount} фрагм. · ≈{tokenLabel(doc.charCount)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pinnedTokens > 0 && (
            <p className="text-[10px] text-muted mt-3 leading-snug border-t border-ink-700 pt-3">
              Закреплённое пишется в кэш раз в час (≈{usd(cacheWriteCost)}), дальше читается
              по {usd(cacheReadCost)} за запрос. Незакреплённое ищется выдержками и почти
              ничего не стоит.
            </p>
          )}
        </aside>

        <main className="overflow-y-auto p-5 min-w-0">
          {selected ? (
            <DocDetail key={selected.id} docId={selected.id} onDeleted={() => setSelectedId(null)} />
          ) : (
            <SearchPlayground />
          )}
        </main>
      </div>

      {importing && <ImportModal onClose={() => setImporting(false)} onDone={setSelectedId} />}
    </div>
  );
}

/* ────────────────────────────  импорт  ──────────────────────────── */

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: (id: ID) => void }) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState<SourceAuthor>('truby');
  const [kind, setKind] = useState<SourceKind>('book');
  const [citation, setCitation] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const chunks = useMemo(() => (text.trim() ? chunkText(text) : []), [text]);
  const tokens = useMemo(() => approxTokens(text), [text]);

  async function onFiles(files: FileList) {
    setBusy(true);
    try {
      const parts: string[] = [];
      const notes: string[] = [];
      for (const file of Array.from(files)) {
        const result = await fileToText(file);
        parts.push(result.text);
        notes.push(`${file.name}: ${result.note}`);
        if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
        if (!citation) setCitation(file.name);
      }
      setText(parts.join('\n\n'));
      setNote(notes.join('\n'));
    } catch (e) {
      setNote(`Не удалось прочитать: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Добавить источник" onClose={onClose} wide>
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={SUPPORTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex items-center gap-3">
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Читаю…' : 'Выбрать файлы'}
          </Button>
          <span className="text-[11px] text-muted">
            txt · md · pdf · epub · srt · vtt · html · fountain — или вставьте текст ниже
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Название">
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Ссылка на издание или видео">
            <input className="field" value={citation} onChange={(e) => setCitation(e.target.value)} />
          </Field>
          <Field label="Автор / слой">
            <Select
              value={author}
              onChange={setAuthor}
              options={AUTHORS.map((a) => ({ value: a, label: SOURCE_AUTHOR_LABELS[a] }))}
            />
          </Field>
          <Field label="Тип">
            <Select
              value={kind}
              onChange={setKind}
              options={KINDS.map((k) => ({ value: k, label: SOURCE_KIND_LABELS[k] }))}
            />
          </Field>
        </div>

        <Field label="Текст">
          <textarea
            className="field font-mono text-[12px] resize-y"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Вставьте текст или выберите файлы"
          />
        </Field>

        {note && <p className="text-[11px] text-muted whitespace-pre-wrap">{note}</p>}

        <div className="flex items-center justify-between border-t border-ink-700 pt-4">
          <p className="text-xs text-muted">
            {chunks.length
              ? `${chunks.length} ${plural(chunks.length, 'фрагмент', 'фрагмента', 'фрагментов')} · ≈${tokens.toLocaleString('ru')} ${plural(tokens, 'токен', 'токена', 'токенов')}`
              : 'Текста пока нет'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim() || !chunks.length || busy}
              onClick={async () => {
                const id = await addSourceDoc({
                  title: title.trim(),
                  author,
                  kind,
                  citation,
                  note,
                  chunks,
                  charCount: text.length,
                });
                onDone(id);
                onClose();
              }}
            >
              Добавить в корпус
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ────────────────────────────  документ  ──────────────────────────── */

function DocDetail({ docId, onDeleted }: { docId: ID; onDeleted: () => void }) {
  const doc = useLiveQuery(() => db.sourceDocs.get(docId), [docId]);
  const chunks = useLiveQuery(
    async () => (await db.sourceChunks.where({ docId }).toArray()).sort((a, b) => a.index - b.index),
    [docId],
  );
  const [filter, setFilter] = useState<Concept | 'all'>('all');
  if (!doc || !chunks) return <Empty>Загрузка…</Empty>;

  const visible = filter === 'all' ? chunks : chunks.filter((c) => c.concepts.includes(filter));

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <TextInput
            value={doc.title}
            onCommit={(v) => void updateSourceDoc(doc.id, { title: v })}
            className="text-base font-semibold"
          />
          <div className="grid grid-cols-3 gap-2">
            <Select
              value={doc.author}
              onChange={(v: SourceAuthor) => void updateSourceDoc(doc.id, { author: v })}
              options={AUTHORS.map((a) => ({ value: a, label: SOURCE_AUTHOR_LABELS[a] }))}
            />
            <Select
              value={doc.kind}
              onChange={(v: SourceKind) => void updateSourceDoc(doc.id, { kind: v })}
              options={KINDS.map((k) => ({ value: k, label: SOURCE_KIND_LABELS[k] }))}
            />
            <TextInput
              value={doc.citation}
              placeholder="издание / ссылка"
              onCommit={(v) => void updateSourceDoc(doc.id, { citation: v })}
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (confirm(`Удалить «${doc.title}» из корпуса?`)) void deleteSourceDoc(doc.id).then(onDeleted);
          }}
        >
          Удалить
        </Button>
      </div>

      <div className="card p-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={doc.pinned}
            onChange={(e) => void updateSourceDoc(doc.id, { pinned: e.target.checked })}
            className="mt-1 accent-accent"
          />
          <span className="text-sm">
            Закрепить целиком в кэшируемом префиксе
            <span className="block text-[11px] text-muted leading-snug mt-0.5">
              Документ уйдёт в каждый запрос полностью (≈{tokenLabel(doc.charCount)}) и будет читаться из кэша. Так модель видит книгу целиком, а не куски — но
              каждый запрос дорожает. Незакреплённые документы участвуют выдержками и стоят копейки.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <SectionTitle>
          Фрагменты: {visible.length} {plural(visible.length, 'штука', 'штуки', 'штук')}
        </SectionTitle>
        <Select
          className="w-64 ml-auto"
          value={filter}
          onChange={(v) => setFilter(v as Concept | 'all')}
          options={[
            { value: 'all', label: 'все концепты' },
            ...CONCEPTS.map((c) => ({ value: c, label: CONCEPT_LABELS[c] })),
          ]}
        />
      </div>

      <div className="space-y-2">
        {visible.slice(0, 100).map((chunk) => (
          <details key={chunk.id} className="card p-3">
            <summary className="cursor-pointer text-sm flex items-center gap-2">
              <span className="font-mono text-[11px] text-accent shrink-0">{chunk.anchor}</span>
              <span className="text-muted truncate">{chunk.text.slice(0, 90)}…</span>
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{chunk.text}</p>
              <div className="flex flex-wrap gap-1">
                {CONCEPTS.map((c) => {
                  const on = chunk.concepts.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() =>
                        void setChunkConcepts(
                          chunk.id,
                          on ? chunk.concepts.filter((x) => x !== c) : [...chunk.concepts, c],
                        )
                      }
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        on ? 'border-accent/60 bg-accent/15 text-accent' : 'border-ink-600 text-muted hover:text-paper'
                      }`}
                    >
                      {CONCEPT_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>
          </details>
        ))}
        {visible.length > 100 && (
          <p className="text-xs text-muted">Показаны первые 100 фрагментов из {visible.length}.</p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────  проверка поиска  ──────────────────────────── */

function SearchPlayground() {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CorpusExcerpt[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      void searchCorpus(query, { limit: 10 }).then((h) => alive && setHits(h));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="max-w-3xl space-y-4">
      <SectionTitle>Проверка поиска</SectionTitle>
      <p className="text-xs text-muted leading-relaxed">
        Здесь видно ровно то, что будет уходить в запрос выдержками. Если по важному вопросу
        находится не то — проставьте концепты нужным фрагментам в карточке документа: они
        поднимают фрагмент в выдаче того режима, которому этот концепт принадлежит.
      </p>
      <TextArea
        rows={2}
        value={query}
        onCommit={setQuery}
        placeholder="например: чем мидпоинт отличается от второй поворотной точки"
      />
      {!hits.length ? (
        <Empty>{query ? 'Ничего не найдено' : 'Введите запрос'}</Empty>
      ) : (
        <div className="space-y-2">
          {hits.map((hit) => (
            <div key={hit.chunk.id} className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <Chip tone="accent">{citationOf(hit)}</Chip>
                <span className="text-[10px] text-muted font-mono">{hit.score.toFixed(2)}</span>
                {hit.chunk.concepts.map((c) => (
                  <Chip key={c}>{CONCEPT_LABELS[c]}</Chip>
                ))}
              </div>
              <p className="text-[13px] leading-relaxed text-muted">{hit.chunk.text.slice(0, 500)}…</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted">
        Авторазметка концептов при импорте — по ключевым словам ({CONCEPTS.length} концептов,
        функция <code className="font-mono">autoTagConcepts</code>). Пример разметки этого запроса:{' '}
        {autoTagConcepts(query, 1).map((c) => CONCEPT_LABELS[c]).join(', ') || '—'}
      </p>
    </div>
  );
}
