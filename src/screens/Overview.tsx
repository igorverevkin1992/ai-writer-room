import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectBundle } from './ProjectLayout';
import { db } from '../db/db';
import { syncProjectBeats, updateProject } from '../db/repo';
import { downloadProjectExport, exportProject, importProject } from '../db/backup';
import { projectDiagnostics } from '../lib/validate';
import {
  GENRE_LABELS,
  PROJECT_TYPE_LABELS,
  type Genre,
  type ProjectType,
} from '../types';
import { beatCount } from '../db/seed/genreBeats';
import { Button, Chip, Field, SectionTitle, Select, StringList, TextArea, TextInput } from '../components/ui';

const ALL_GENRES = Object.keys(GENRE_LABELS) as Genre[];

export function Overview() {
  const bundle = useProjectBundle();
  const { project, bible } = bundle;
  const diag = projectDiagnostics(bundle);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const nodeTitle = (id: string | undefined) =>
    bundle.nodes.find((n) => n.id === id)?.title || '(узел без названия)';

  async function changeGenres(patch: { genrePrimary?: Genre; genresSupporting?: Genre[] }) {
    await updateProject(project.id, patch);
    const res = await syncProjectBeats(project.id);
    setMsg(`Библиотека битов обновлена: +${res.added}, −${res.removed}`);
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 max-w-[1600px]">
        <div className="xl:col-span-2 space-y-5">
          <section className="card p-5">
            <SectionTitle>Проект</SectionTitle>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Название">
                  <TextInput value={project.title} onCommit={(v) => void updateProject(project.id, { title: v })} />
                </Field>
                <Field label="Тип">
                  <Select
                    value={project.type}
                    onChange={(v: ProjectType) => void updateProject(project.id, { type: v })}
                    options={(Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((t) => ({
                      value: t,
                      label: PROJECT_TYPE_LABELS[t],
                    }))}
                  />
                </Field>
              </div>
              <Field label="Логлайн">
                <TextArea value={project.logline} onCommit={(v) => void updateProject(project.id, { logline: v })} />
              </Field>
              <Field label="Тема">
                <TextArea
                  rows={2}
                  value={project.theme}
                  onCommit={(v) => void updateProject(project.id, { theme: v })}
                />
              </Field>
              <Field
                label="Стратегия трансценденции жанра"
                hint="Труби, правило 3: чтобы выделиться, ведущий жанр нужно вывернуть."
              >
                <TextArea
                  rows={2}
                  value={project.transcendenceStrategy}
                  onCommit={(v) => void updateProject(project.id, { transcendenceStrategy: v })}
                />
              </Field>
            </div>
          </section>

          <section className="card p-5">
            <SectionTitle>Философский конфликт</SectionTitle>
            <p className="text-[11px] text-muted mb-3 leading-relaxed">
              Моури: сначала тезис против антитезиса — два взгляда на то, как жить. Потом на полюса
              и середину спектра навешиваются персонажи.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Тезис (−100 на спектре)">
                <TextArea
                  rows={3}
                  value={project.philosophicalThesis}
                  onCommit={(v) => void updateProject(project.id, { philosophicalThesis: v })}
                />
              </Field>
              <Field label="Антитезис (+100 на спектре)">
                <TextArea
                  rows={3}
                  value={project.philosophicalAntithesis}
                  onCommit={(v) => void updateProject(project.id, { philosophicalAntithesis: v })}
                />
              </Field>
            </div>
            <div className="mt-4">
              <p className="label">Персонажи на спектре</p>
              <Spectrum bundle={bundle} />
            </div>
          </section>

          <section className="card p-5">
            <SectionTitle>Жанры</SectionTitle>
            <div className="space-y-3">
              <Field label="Ведущий">
                <Select
                  value={project.genrePrimary}
                  onChange={(g) =>
                    void changeGenres({
                      genrePrimary: g,
                      genresSupporting: project.genresSupporting.filter((x) => x !== g),
                    })
                  }
                  options={ALL_GENRES.map((g) => ({ value: g, label: `${GENRE_LABELS[g]} — ${beatCount(g)} битов` }))}
                />
              </Field>
              <Field
                label={`Поддерживающие (${project.genresSupporting.length})`}
                hint="Смена жанра пересобирает библиотеку битов: биты убранного жанра удаляются вместе с назначениями."
              >
                <div className="flex flex-wrap gap-1.5">
                  {ALL_GENRES.filter((g) => g !== project.genrePrimary).map((g) => {
                    const on = project.genresSupporting.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() =>
                          void changeGenres({
                            genresSupporting: on
                              ? project.genresSupporting.filter((x) => x !== g)
                              : [...project.genresSupporting, g].slice(0, 3),
                          })
                        }
                        className={`text-xs px-2 py-1 rounded border transition-colors ${
                          on ? 'border-accent/60 bg-accent/15 text-accent' : 'border-ink-600 text-muted hover:text-paper'
                        }`}
                      >
                        {GENRE_LABELS[g]} · {beatCount(g)}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {msg && <p className="text-xs text-ok">{msg}</p>}
            </div>
          </section>

          <section className="card p-5">
            <SectionTitle>Мир и правила</SectionTitle>
            {bible && (
              <div className="space-y-3">
                <Field label="Описание мира">
                  <TextArea
                    rows={3}
                    value={bible.worldDescription}
                    onCommit={(v) => void db.bibles.update(bible.id, { worldDescription: v })}
                  />
                </Field>
                <Field label="Правила мира">
                  <StringList
                    values={bible.rules}
                    onChange={(v) => void db.bibles.update(bible.id, { rules: v })}
                    placeholder="Правило, которое нельзя нарушить"
                    addLabel="правило"
                  />
                </Field>
                <Field label="Предыстория">
                  <TextArea
                    rows={3}
                    value={bible.backstory}
                    onCommit={(v) => void db.bibles.update(bible.id, { backstory: v })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Хронометраж серии, сек">
                    <TextInput
                      value={String(bible.timing.episodeDurationSec)}
                      onCommit={(v) =>
                        void db.bibles.update(bible.id, {
                          timing: { ...bible.timing, episodeDurationSec: Number(v) || 0 },
                        })
                      }
                    />
                  </Field>
                  <Field label="Серий всего">
                    <TextInput
                      value={String(bible.timing.episodesCount)}
                      onCommit={(v) =>
                        void db.bibles.update(bible.id, {
                          timing: { ...bible.timing, episodesCount: Number(v) || 0 },
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <SectionTitle>Сводка</SectionTitle>
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-muted text-xs">Покрытие жанровых битов</span>
                  <span className="font-mono">
                    {diag.coverage.placed} / {diag.coverage.total}
                  </span>
                </div>
                <div className="h-1.5 bg-ink-700 rounded mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{
                      width: `${diag.coverage.total ? (diag.coverage.placed / diag.coverage.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-muted mt-1">
                  Ведущий жанр: {diag.coverage.primaryPlaced}/{diag.coverage.primaryTotal} · вывернуто{' '}
                  {diag.coverage.twisted}
                </p>
              </div>

              <div className="flex gap-2">
                <Chip tone="bad">дефектов {diag.errors}</Chip>
                <Chip tone="warn">замечаний {diag.warnings}</Chip>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
                {diag.defects.length === 0 ? (
                  <p className="text-xs text-ok">Формальных дефектов нет.</p>
                ) : (
                  diag.defects.slice(0, 60).map((d, i) => (
                    <div
                      key={i}
                      className={`text-[11px] leading-snug border-l-2 pl-2 ${
                        d.severity === 'error' ? 'border-bad text-paper' : 'border-warn text-muted'
                      }`}
                    >
                      {d.nodeId && <span className="text-accent">{nodeTitle(d.nodeId)}: </span>}
                      {d.characterId && (
                        <span className="text-accent">
                          {bundle.characters.find((c) => c.id === d.characterId)?.name}:{' '}
                        </span>
                      )}
                      {d.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <SectionTitle>Быстрые переходы</SectionTitle>
            <div className="flex flex-col gap-2 text-sm">
              <Link to="genre" className="text-muted hover:text-accent">
                → Разложить биты по структуре
              </Link>
              <Link to="structure" className="text-muted hover:text-accent">
                → Круг Хармона и цена
              </Link>
              <Link to="matrix" className="text-muted hover:text-accent">
                → Состояние Лжи по битам
              </Link>
            </div>
          </section>

          <section className="card p-5">
            <SectionTitle>Резервная копия</SectionTitle>
            <p className="text-[11px] text-muted mb-3 leading-relaxed">
              Данные живут только в этом браузере. Экспорт в JSON — единственный бэкап.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={async () => {
                  downloadProjectExport(await exportProject(project.id));
                  setMsg('Экспорт скачан');
                }}
              >
                Экспорт проекта в JSON
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    const res = await importProject(JSON.parse(await f.text()), 'replace');
                    setMsg(
                      `Импорт выполнен (${res.replaced ? 'проект перезаписан' : 'создан новый'}): ` +
                        Object.entries(res.counts)
                          .map(([k, v]) => `${k} ${v}`)
                          .join(', '),
                    );
                  } catch (err) {
                    setMsg(`Ошибка импорта: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }}
              />
              <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                Импорт (перезапишет этот проект)
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Spectrum({ bundle }: { bundle: ReturnType<typeof useProjectBundle> }) {
  if (!bundle.characters.length) {
    return <p className="text-xs text-muted italic">Персонажи не заведены</p>;
  }
  return (
    <div className="relative h-16 border border-ink-600 rounded bg-ink-900">
      <div className="absolute inset-y-0 left-1/2 w-px bg-ink-600" />
      <span className="absolute left-2 top-1 text-[10px] text-muted">тезис</span>
      <span className="absolute right-2 top-1 text-[10px] text-muted">антитезис</span>
      {bundle.characters.map((c, i) => (
        <div
          key={c.id}
          className="absolute -translate-x-1/2 text-[10px] whitespace-nowrap"
          style={{
            left: `${((c.philosophicalPosition + 100) / 200) * 100}%`,
            top: `${28 + (i % 3) * 12}px`,
          }}
          title={`${c.name}: ${c.philosophicalPosition}`}
        >
          <span className="px-1 rounded bg-accent/20 text-accent">{c.name}</span>
        </div>
      ))}
    </div>
  );
}
