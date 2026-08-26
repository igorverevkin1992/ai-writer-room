import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useProjectBundle } from './ProjectLayout';
import { StructureTree } from '../components/StructureTree';
import { AIPanel } from '../components/AIPanel';
import { addCustomBeat, assignBeat, deleteBeat, setBeatTwist, updateBeat } from '../db/repo';
import { coverage } from '../lib/validate';
import { GENRE_LABELS, type AIMode, type GenreBeat, type ID } from '../types';
import { Button, Chip, Empty, SectionTitle, Select, TextArea, TextInput, Toggle } from '../components/ui';

export function GenreCoverage() {
  const bundle = useProjectBundle();
  const { beats, nodes, project } = bundle;
  const [onlyUnplaced, setOnlyUnplaced] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AIMode>('genre_audit');
  const [aiBeatId, setAiBeatId] = useState<ID | null>(null);
  const [dragging, setDragging] = useState<GenreBeat | null>(null);
  const [dropTarget, setDropTarget] = useState<ID | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const cov = useMemo(() => coverage(beats), [beats]);

  const primaryBeats = beats.filter((b) => b.isPrimary);
  const supportingByGenre = useMemo(() => {
    const map = new Map<string, GenreBeat[]>();
    for (const b of beats.filter((x) => !x.isPrimary)) {
      map.set(b.genre, [...(map.get(b.genre) ?? []), b]);
    }
    return map;
  }, [beats]);

  const beatCounts = useMemo(() => {
    const map = new Map<ID, number>();
    for (const b of beats) {
      if (b.assignedNodeId) map.set(b.assignedNodeId, (map.get(b.assignedNodeId) ?? 0) + 1);
    }
    return map;
  }, [beats]);

  const visible = (list: GenreBeat[]) =>
    onlyUnplaced ? list.filter((b) => b.assignedNodeId === null) : list;

  function onDragStart(e: DragStartEvent) {
    setDragging(beats.find((b) => b.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    setDropTarget(null);
    const beatId = String(e.active.id);
    const nodeId = e.over ? String(e.over.id) : null;
    if (nodeId) void assignBeat(beatId, nodeId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => setDropTarget(e.over ? String(e.over.id) : null)}
      onDragCancel={() => {
        setDragging(null);
        setDropTarget(null);
      }}
    >
      <div className={`h-full grid ${aiOpen ? 'grid-cols-[260px_1fr_360px]' : 'grid-cols-[260px_1fr]'} min-h-0`}>
        <aside className="border-r border-ink-700 overflow-y-auto p-3">
          <SectionTitle>Куда назначать</SectionTitle>
          <p className="text-[11px] text-muted mb-3 leading-snug">
            Перетащите бит на узел структуры — или выберите узел в селекте бита.
          </p>
          {!nodes.length ? (
            <Empty>Структуры нет</Empty>
          ) : (
            <StructureTree
              nodes={nodes}
              selectedId={null}
              onSelect={() => {}}
              dropTargetId={dropTarget}
              beatCounts={beatCounts}
              wrapRow={(node, row) => (
                <DropRow key={node.id} nodeId={node.id}>
                  {row}
                </DropRow>
              )}
            />
          )}
        </aside>

        <main className="overflow-y-auto p-5 min-w-0">
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-2xl font-semibold font-mono">
                  {cov.placed}
                  <span className="text-muted text-base"> / {cov.total}</span>
                </div>
                <p className="text-[11px] text-muted">
                  ведущий жанр {cov.primaryPlaced}/{cov.primaryTotal} · вывернуто {cov.twisted}
                </p>
              </div>
              <div className="w-48 h-1.5 bg-ink-700 rounded overflow-hidden">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${cov.total ? (cov.placed / cov.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Toggle checked={onlyUnplaced} onChange={setOnlyUnplaced} label="только неразмещённые" />
              <Button
                variant={aiOpen ? 'subtle' : 'primary'}
                onClick={() => {
                  setAiMode('genre_audit');
                  setAiBeatId(null);
                  setAiOpen((v) => !v);
                }}
              >
                {aiOpen ? 'Скрыть AI' : 'Аудит от AI'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
            <section>
              <SectionTitle>
                Ведущий жанр — {GENRE_LABELS[project.genrePrimary]}
              </SectionTitle>
              <div className="space-y-2">
                {visible(primaryBeats).map((b) => (
                  <BeatCard
                    key={b.id}
                    beat={b}
                    bundle={bundle}
                    onTranscend={() => {
                      setAiMode('beat_transcendence');
                      setAiBeatId(b.id);
                      setAiOpen(true);
                    }}
                  />
                ))}
                {!visible(primaryBeats).length && <Empty>Все биты размещены</Empty>}
                <Button size="sm" variant="ghost" onClick={() => void addCustomBeat(project.id, project.genrePrimary)}>
                  + свой бит
                </Button>
              </div>
            </section>

            <section className="space-y-6">
              {[...supportingByGenre.entries()].map(([genre, list]) => (
                <div key={genre}>
                  <SectionTitle>Поддерживающий — {GENRE_LABELS[genre as never]}</SectionTitle>
                  <div className="space-y-2">
                    {visible(list).map((b) => (
                      <BeatCard
                        key={b.id}
                        beat={b}
                        bundle={bundle}
                        onTranscend={() => {
                          setAiMode('beat_transcendence');
                          setAiBeatId(b.id);
                          setAiOpen(true);
                        }}
                      />
                    ))}
                    {!visible(list).length && <Empty>Все биты размещены</Empty>}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void addCustomBeat(project.id, genre as never)}
                    >
                      + свой бит
                    </Button>
                  </div>
                </div>
              ))}
              {!supportingByGenre.size && <Empty>Поддерживающие жанры не выбраны</Empty>}
            </section>
          </div>
        </main>

        {aiOpen && (
          <aside className="border-l border-ink-700 p-3 min-h-0">
            <AIPanel
              bundle={bundle}
              mode={aiMode}
              onModeChange={setAiMode}
              modes={['genre_audit', 'beat_transcendence']}
              scope={{ beatId: aiBeatId }}
              scopeType={aiBeatId ? 'beat' : 'project'}
              title="Жанровый аудит"
            />
          </aside>
        )}
      </div>

      <DragOverlay>
        {dragging && (
          <div className="card px-3 py-2 text-xs shadow-lg border-accent/60">
            {dragging.beatIndex}. {dragging.beatName}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Строка дерева как цель перетаскивания бита. */
function DropRow({ nodeId, children }: { nodeId: ID; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: nodeId });
  return (
    <div ref={setNodeRef} className={isOver ? 'rounded ring-1 ring-accent bg-accent/10' : ''}>
      {children}
    </div>
  );
}

function BeatCard({
  beat,
  bundle,
  onTranscend,
}: {
  beat: GenreBeat;
  bundle: ReturnType<typeof useProjectBundle>;
  onTranscend: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: beat.id });
  const node = beat.assignedNodeId ? bundle.nodes.find((n) => n.id === beat.assignedNodeId) : null;

  const tone = beat.status === 'twisted' ? 'warn' : beat.status === 'placed' ? 'ok' : 'bad';

  return (
    <div
      className={`card p-3 ${isDragging ? 'opacity-40' : ''} ${
        beat.status === 'unplaced' ? 'border-bad/30' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted hover:text-paper text-xs mt-0.5 shrink-0"
          title="Перетащить на узел структуры"
        >
          ⠿
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <span className="font-mono text-[11px] text-muted mt-0.5">{beat.beatIndex}.</span>
            <button className="text-sm text-left flex-1 hover:text-accent" onClick={() => setOpen((v) => !v)}>
              {beat.beatName}
              {beat.isEdited && <span className="text-[10px] text-muted ml-1">(правлено)</span>}
            </button>
            <Chip tone={tone}>
              {beat.status === 'twisted' ? 'вывернут' : beat.status === 'placed' ? 'размещён' : 'не размещён'}
            </Chip>
          </div>
          {!open && beat.beatDescription && (
            <p className="text-[11px] text-muted mt-1 line-clamp-2 leading-snug pl-6">{beat.beatDescription}</p>
          )}
          <div className="flex items-center gap-2 mt-2 pl-6">
            <Select
              className="text-xs flex-1"
              value={beat.assignedNodeId ?? ''}
              onChange={(v) => void assignBeat(beat.id, v || null)}
              options={[
                { value: '', label: '— не размещён —' },
                ...bundle.nodes
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((n) => ({
                    value: n.id,
                    label: `${n.title || '(без названия)'}`,
                  })),
              ]}
            />
            {node && <span className="text-[10px] text-muted truncate max-w-[8rem]">{node.summary}</span>}
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-3 pl-6 space-y-2">
          <TextInput
            value={beat.beatName}
            onCommit={(v) => void updateBeat(beat.id, { beatName: v, isEdited: true })}
          />
          <TextArea
            rows={2}
            value={beat.beatDescription}
            onCommit={(v) => void updateBeat(beat.id, { beatDescription: v, isEdited: true })}
          />
          <Toggle
            checked={beat.status === 'twisted'}
            onChange={(v) => void setBeatTwist(beat.id, v, beat.twistNote)}
            label="Бит вывернут (трансценденция жанра)"
          />
          {beat.status === 'twisted' && (
            <TextArea
              rows={2}
              value={beat.twistNote}
              placeholder="Как именно: перестановка / инверсия / замена носителя"
              onCommit={(v) => void setBeatTwist(beat.id, true, v)}
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onTranscend}>
              Как вывернуть? (AI)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Удалить бит «${beat.beatName}» из библиотеки проекта?`)) void deleteBeat(beat.id);
              }}
            >
              Удалить бит
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
