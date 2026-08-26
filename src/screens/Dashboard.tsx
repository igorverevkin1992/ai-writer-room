import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../lib/hooks';
import { createProject, deleteProject } from '../db/repo';
import { importProject } from '../db/backup';
import { beatCount } from '../db/seed/genreBeats';
import {
  GENRE_LABELS,
  PROJECT_TYPE_LABELS,
  type Genre,
  type ProjectType,
} from '../types';
import { Button, Chip, Empty, Field, Modal, Select } from '../components/ui';

const ALL_GENRES = Object.keys(GENRE_LABELS) as Genre[];

export function Dashboard() {
  const projects = useProjects();
  const [creating, setCreating] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function onImport(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      const result = await importProject(raw, 'replace');
      setImportMsg(
        `Импортировано: ${result.replaced ? 'проект перезаписан' : 'новый проект'} · ` +
          Object.entries(result.counts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', '),
      );
      navigate(`/p/${result.projectId}`);
    } catch (e) {
      setImportMsg(`Ошибка импорта: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-ink-700 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Writers Room OS</h1>
          <p className="text-xs text-muted">
            Труби → Хармон → Уайлэнд → Моури → Финчер
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Импорт JSON
          </Button>
          <Link to="/settings">
            <Button variant="ghost">Настройки</Button>
          </Link>
          <Button variant="primary" onClick={() => setCreating(true)}>
            Новый проект
          </Button>
        </div>
      </header>

      <main className="px-8 py-6">
        {importMsg && (
          <div className="mb-4 text-xs border border-ink-600 rounded p-3 text-muted">{importMsg}</div>
        )}
        {!projects?.length ? (
          <Empty>Проектов пока нет. Создайте первый — жанровые биты подтянутся автоматически.</Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div key={p.id} className="card p-4 hover:border-ink-500 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/p/${p.id}`} className="font-semibold hover:text-accent">
                    {p.title}
                  </Link>
                  <Chip tone="neutral">{PROJECT_TYPE_LABELS[p.type]}</Chip>
                </div>
                <p className="text-xs text-muted mt-2 line-clamp-3 leading-relaxed">
                  {p.logline || 'Логлайн не заполнен'}
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  <Chip tone="accent">{GENRE_LABELS[p.genrePrimary]}</Chip>
                  {p.genresSupporting.map((g) => (
                    <Chip key={g}>{GENRE_LABELS[g]}</Chip>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[11px] text-muted">
                    {new Date(p.updatedAt).toLocaleDateString('ru')}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Удалить проект «${p.title}» со всеми данными?`)) {
                        void deleteProject(p.id);
                      }
                    }}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {creating && <CreateProjectModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProjectType>('series');
  const [logline, setLogline] = useState('');
  const [primary, setPrimary] = useState<Genre>('detective');
  const [supporting, setSupporting] = useState<Genre[]>(['crime', 'thriller']);
  const [thesis, setThesis] = useState('');
  const [antithesis, setAntithesis] = useState('');
  const [seasons, setSeasons] = useState(1);
  const [episodes, setEpisodes] = useState(8);

  const totalBeats =
    beatCount(primary) + supporting.filter((g) => g !== primary).reduce((s, g) => s + beatCount(g), 0);
  const supportingValid = supporting.length >= 2 && supporting.length <= 3;

  function toggleSupporting(g: Genre) {
    setSupporting((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].slice(0, 3)));
  }

  return (
    <Modal title="Новый проект" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Название">
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </Field>
          <Field label="Тип">
            <Select
              value={type}
              onChange={setType}
              options={(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((t) => ({
                value: t,
                label: PROJECT_TYPE_LABELS[t],
              }))}
            />
          </Field>
        </div>

        <Field label="Логлайн">
          <textarea
            className="field resize-y"
            rows={2}
            value={logline}
            onChange={(e) => setLogline(e.target.value)}
          />
        </Field>

        {type === 'series' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Сезонов">
              <input
                type="number"
                min={1}
                className="field"
                value={seasons}
                onChange={(e) => setSeasons(Number(e.target.value))}
              />
            </Field>
            <Field label="Серий в сезоне">
              <input
                type="number"
                min={1}
                className="field"
                value={episodes}
                onChange={(e) => setEpisodes(Number(e.target.value))}
              />
            </Field>
          </div>
        )}

        <Field label="Ведущий жанр" hint="Правило Труби: один ведущий + 2–3 в поддержке.">
          <Select
            value={primary}
            onChange={(g) => {
              setPrimary(g);
              setSupporting((prev) => prev.filter((x) => x !== g));
            }}
            options={ALL_GENRES.map((g) => ({
              value: g,
              label: `${GENRE_LABELS[g]} — ${beatCount(g)} битов`,
            }))}
          />
        </Field>

        <Field
          label={`Поддерживающие жанры (${supporting.length})`}
          hint={supportingValid ? undefined : 'Нужно выбрать 2 или 3 жанра.'}
        >
          <div className="flex flex-wrap gap-1.5">
            {ALL_GENRES.filter((g) => g !== primary).map((g) => {
              const on = supporting.includes(g);
              return (
                <button
                  key={g}
                  onClick={() => toggleSupporting(g)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    on
                      ? 'border-accent/60 bg-accent/15 text-accent'
                      : 'border-ink-600 text-muted hover:text-paper'
                  }`}
                >
                  {GENRE_LABELS[g]} · {beatCount(g)}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Философский тезис">
            <textarea
              className="field resize-y"
              rows={2}
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
            />
          </Field>
          <Field label="Антитезис">
            <textarea
              className="field resize-y"
              rows={2}
              value={antithesis}
              onChange={(e) => setAntithesis(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-ink-700 pt-4">
          <p className="text-xs text-muted">
            Будет создано <span className="text-paper font-medium">{totalBeats}</span> жанровых битов.
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <Button
              variant="primary"
              disabled={!title.trim() || !supportingValid}
              onClick={async () => {
                const id = await createProject({
                  title: title.trim(),
                  type,
                  logline,
                  genrePrimary: primary,
                  genresSupporting: supporting,
                  philosophicalThesis: thesis,
                  philosophicalAntithesis: antithesis,
                  seasonsCount: type === 'series' ? seasons : 0,
                  episodesPerSeason: type === 'series' ? episodes : 0,
                });
                onClose();
                navigate(`/p/${id}`);
              }}
            >
              Создать
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
