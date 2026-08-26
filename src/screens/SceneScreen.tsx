import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProjectBundle } from './ProjectLayout';
import { AIPanel } from '../components/AIPanel';
import { deleteScene, updateScene } from '../db/repo';
import { sceneDefects } from '../lib/validate';
import { splitFincherAnswer } from '../lib/fincher';
import {
  AUDIENCE_POSITION_LABELS,
  LEVEL_LABELS,
  type AIMode,
  type AudiencePosition,
  type Charge,
} from '../types';
import { Button, Chip, Empty, Field, SectionTitle, Select, StringList, TextArea, TextInput, Toggle } from '../components/ui';

export function SceneScreen() {
  const bundle = useProjectBundle();
  const { sceneId } = useParams();
  const navigate = useNavigate();
  const scene = bundle.scenes.find((s) => s.id === sceneId);
  const [tab, setTab] = useState<'draft' | 'fincher'>('draft');
  const [aiMode, setAiMode] = useState<AIMode>('scene_doctor');
  const [presetQuery, setPresetQuery] = useState<string | undefined>(undefined);

  if (!scene) {
    return (
      <div className="p-8 text-sm text-muted">
        Сцена не найдена.{' '}
        <Link to={`/p/${bundle.project.id}/structure`} className="underline">
          К структуре
        </Link>
      </div>
    );
  }

  const parent = bundle.nodes.find((n) => n.id === scene.parentNodeId);
  const defects = sceneDefects(scene);

  return (
    <div className="h-full grid grid-cols-[1fr_380px] min-h-0">
      <main className="overflow-y-auto p-5 min-w-0">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5 text-[11px] text-muted">
              <Link to={`/p/${bundle.project.id}/structure`} className="hover:text-paper">
                ← структура
              </Link>
              {parent && (
                <span>
                  · {LEVEL_LABELS[parent.level]} «{parent.title || 'без названия'}»
                </span>
              )}
            </div>
            <TextInput
              value={scene.heading}
              onCommit={(v) => void updateScene(scene.id, { heading: v })}
              className="font-mono uppercase"
            />
          </div>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm('Удалить сцену?')) {
                void deleteScene(scene.id).then(() => navigate(`/p/${bundle.project.id}/structure`));
              }
            }}
          >
            Удалить
          </Button>
        </div>

        {defects.length > 0 && (
          <div className="space-y-1 mb-4">
            {defects.map((d, i) => (
              <p
                key={i}
                className={`text-[11px] border-l-2 pl-2 ${d.severity === 'error' ? 'border-bad text-bad' : 'border-warn text-warn'}`}
              >
                {d.message}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-5 max-w-3xl">
          <section className="card p-4 space-y-3">
            <SectionTitle>Карточка сцены (Моури)</SectionTitle>
            <Field label="Саммари">
              <TextArea rows={2} value={scene.summary} onCommit={(v) => void updateScene(scene.id, { summary: v })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Задача сцены — цель здесь и сейчас">
                <TextArea
                  rows={2}
                  value={scene.sceneObjective}
                  onCommit={(v) => void updateScene(scene.id, { sceneObjective: v })}
                />
              </Field>
              <Field label="Суперзадача — цель во всей истории">
                <TextArea
                  rows={2}
                  value={scene.superObjectiveNote}
                  onCommit={(v) => void updateScene(scene.id, { superObjectiveNote: v })}
                />
              </Field>
            </div>
            <Field label="Препятствие" hint="Конфликт не впрыскивается — он растёт из разных задач персонажей.">
              <TextArea rows={2} value={scene.obstacle} onCommit={(v) => void updateScene(scene.id, { obstacle: v })} />
            </Field>
            <Field label="Тактики">
              <StringList
                values={scene.tactics}
                onChange={(v) => void updateScene(scene.id, { tactics: v })}
                placeholder="Чем персонаж добивается своего"
                addLabel="тактику"
              />
            </Field>
            <Field label="Поворот" hint="Новая информация, осознание, действие или выбор.">
              <TextArea rows={2} value={scene.turn} onCommit={(v) => void updateScene(scene.id, { turn: v })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Заряд: из">
                <Select
                  value={scene.valueShiftFrom}
                  onChange={(v: Charge) => void updateScene(scene.id, { valueShiftFrom: v })}
                  options={[
                    { value: '+', label: '+' },
                    { value: '−', label: '−' },
                  ]}
                />
              </Field>
              <Field label="Заряд: в">
                <Select
                  value={scene.valueShiftTo}
                  onChange={(v: Charge) => void updateScene(scene.id, { valueShiftTo: v })}
                  options={[
                    { value: '+', label: '+' },
                    { value: '−', label: '−' },
                  ]}
                />
              </Field>
              <Field label="Позиция зрителя" hint="Финчер: дозировка информации.">
                <Select
                  value={scene.audiencePosition}
                  onChange={(v: AudiencePosition) => void updateScene(scene.id, { audiencePosition: v })}
                  options={(Object.keys(AUDIENCE_POSITION_LABELS) as AudiencePosition[]).map((p) => ({
                    value: p,
                    label: AUDIENCE_POSITION_LABELS[p],
                  }))}
                />
              </Field>
            </div>
          </section>

          <section className="card p-4 space-y-3">
            <SectionTitle>Три вопроса Мэмета</SectionTitle>
            <Field label="Кто чего хочет от кого">
              <TextArea
                rows={2}
                value={scene.mamet.whoWantsWhatFromWhom}
                onCommit={(v) =>
                  void updateScene(scene.id, { mamet: { ...scene.mamet, whoWantsWhatFromWhom: v } })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Что будет, если не получит">
                <TextArea
                  rows={2}
                  value={scene.mamet.stakesIfDenied}
                  onCommit={(v) => void updateScene(scene.id, { mamet: { ...scene.mamet, stakesIfDenied: v } })}
                />
              </Field>
              <Field label="Почему именно сейчас">
                <TextArea
                  rows={2}
                  value={scene.mamet.whyNow}
                  onCommit={(v) => void updateScene(scene.id, { mamet: { ...scene.mamet, whyNow: v } })}
                />
              </Field>
            </div>
          </section>

          <section className="card p-4">
            <SectionTitle>Участники</SectionTitle>
            {!bundle.characters.length ? (
              <Empty>Персонажи не заведены</Empty>
            ) : (
              <div className="space-y-1.5">
                {bundle.characters.map((c) => (
                  <Toggle
                    key={c.id}
                    checked={scene.characterIds.includes(c.id)}
                    onChange={(on) =>
                      void updateScene(scene.id, {
                        characterIds: on
                          ? [...scene.characterIds, c.id]
                          : scene.characterIds.filter((x) => x !== c.id),
                      })
                    }
                    label={
                      <span>
                        {c.name}
                        {c.want ? <span className="text-muted/70"> — хочет: {c.want}</span> : null}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="flex items-center gap-1 px-4 pt-3">
              <button
                className={`px-3 py-1.5 text-xs rounded-t ${tab === 'draft' ? 'bg-ink-800 text-paper' : 'text-muted hover:text-paper'}`}
                onClick={() => setTab('draft')}
              >
                Черновик
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded-t ${tab === 'fincher' ? 'bg-ink-800 text-paper' : 'text-muted hover:text-paper'}`}
                onClick={() => setTab('fincher')}
              >
                Финчеровский проход
              </button>
              <div className="ml-auto flex gap-2 pb-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAiMode('scene_doctor');
                    setPresetQuery('Почему эта сцена мёртвая?');
                  }}
                >
                  Почему сцена мёртвая
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setAiMode('fincher_pass');
                    setPresetQuery('Перепиши сцену по профилю.');
                    setTab('fincher');
                  }}
                >
                  Переписать по профилю
                </Button>
              </div>
            </div>
            <div className="p-4 pt-2">
              {tab === 'draft' ? (
                <TextArea
                  mono
                  rows={20}
                  value={scene.content}
                  placeholder="Текст сцены"
                  onCommit={(v) => void updateScene(scene.id, { content: v })}
                />
              ) : (
                <div className="space-y-3">
                  <TextArea
                    mono
                    rows={16}
                    value={scene.contentFincherPass}
                    placeholder="Здесь появится переписанная версия — или впишите свою"
                    onCommit={(v) => void updateScene(scene.id, { contentFincherPass: v })}
                  />
                  <Field label="Что вырезано и почему">
                    <TextArea
                      rows={6}
                      value={scene.fincherCutList}
                      onCommit={(v) => void updateScene(scene.id, { fincherCutList: v })}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void updateScene(scene.id, { content: scene.contentFincherPass })
                      }
                      disabled={!scene.contentFincherPass.trim()}
                    >
                      Сделать основной версией
                    </Button>
                    <Chip>{scene.contentFincherPass.split(/\n/).length} строк</Chip>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <aside className="border-l border-ink-700 p-3 min-h-0">
        <AIPanel
          bundle={bundle}
          mode={aiMode}
          onModeChange={(m) => {
            setAiMode(m);
            setPresetQuery('');
          }}
          modes={['scene_doctor', 'fincher_pass', 'circle_check', 'arc_audit']}
          scope={{ sceneId: scene.id, nodeId: scene.parentNodeId }}
          scopeType="scene"
          presetQuery={presetQuery}
          title="Доктор сцены"
          onResult={(text) => {
            if (aiMode !== 'fincher_pass') return;
            const { rewritten, cuts } = splitFincherAnswer(text);
            void updateScene(scene.id, {
              contentFincherPass: rewritten || text,
              fincherCutList: cuts,
            });
          }}
        />
      </aside>
    </div>
  );
}
