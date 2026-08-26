import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectBundle } from './ProjectLayout';
import { StructureTree } from '../components/StructureTree';
import { AIPanel } from '../components/AIPanel';
import {
  addNode,
  addScene,
  allowedChildLevels,
  deleteNode,
  moveNode,
  normalizeCircle,
  updateCircleSlot,
  updateNode,
} from '../db/repo';
import { circleDefects, continuityLinks, nodeDefects } from '../lib/validate';
import {
  CIRCLE_STEPS,
  LEVEL_LABELS,
  PONR_LABELS,
  WEILAND_BEATS,
  type ID,
  type PointOfNoReturn,
  type StructureLevel,
  type StructureNode,
  type WeilandBeat,
} from '../types';
import { Button, Chip, Empty, Field, SectionTitle, Select, TextArea, TextInput } from '../components/ui';

export function StructureScreen() {
  const bundle = useProjectBundle();
  const { nodes, project } = bundle;
  const root = nodes.find((n) => n.parentId === null);
  const [selectedId, setSelectedId] = useState<ID | null>(root?.id ?? null);
  const selected = nodes.find((n) => n.id === selectedId) ?? root ?? null;

  const beatCounts = useMemo(() => {
    const map = new Map<ID, number>();
    for (const b of bundle.beats) {
      if (b.assignedNodeId) map.set(b.assignedNodeId, (map.get(b.assignedNodeId) ?? 0) + 1);
    }
    return map;
  }, [bundle.beats]);

  return (
    <div className="h-full grid grid-cols-[280px_1fr_360px] gap-0 min-h-0">
      <aside className="border-r border-ink-700 overflow-y-auto p-3">
        <SectionTitle
          right={
            root && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void addNode(project.id, root.id, allowedChildLevels(root.level, project.type)[0])}
              >
                + узел
              </Button>
            )
          }
        >
          Дерево
        </SectionTitle>
        {!nodes.length ? (
          <Empty>Структуры нет</Empty>
        ) : (
          <StructureTree
            nodes={nodes}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            beatCounts={beatCounts}
          />
        )}
      </aside>

      <main className="overflow-y-auto p-5 min-w-0">
        {selected ? (
          <NodeEditor
            node={selected}
            bundle={bundle}
            onSelect={setSelectedId}
          />
        ) : (
          <Empty>Выберите узел</Empty>
        )}
      </main>

      <aside className="border-l border-ink-700 p-3 min-h-0">
        <AIPanel
          bundle={bundle}
          mode="circle_check"
          scope={{ nodeId: selected?.id ?? null }}
          scopeType="node"
          title="Проверка круга"
        />
      </aside>
    </div>
  );
}

function NodeEditor({
  node,
  bundle,
  onSelect,
}: {
  node: StructureNode;
  bundle: ReturnType<typeof useProjectBundle>;
  onSelect: (id: ID) => void;
}) {
  const navigate = useNavigate();
  const { nodes, project } = bundle;
  const circle = normalizeCircle(node.circle);
  const defects = [...circleDefects(node), ...nodeDefects(node)];
  const childLevels = allowedChildLevels(node.level, project.type);
  const scenes = bundle.scenes.filter((s) => s.parentNodeId === node.id);
  const assignedBeats = bundle.beats.filter((b) => b.assignedNodeId === node.id);

  const siblings = nodes
    .filter((n) => n.parentId === node.parentId && n.level === node.level)
    .sort((a, b) => a.order - b.order);
  const links = continuityLinks(siblings);
  const outgoing = links.find((l) => l.fromId === node.id);
  const incoming = links.find((l) => l.toId === node.id);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Chip tone="accent">{LEVEL_LABELS[node.level]}</Chip>
            {node.circleStep && <Chip>шаг {node.circleStep} круга родителя</Chip>}
            {assignedBeats.length > 0 && <Chip tone="ok">{assignedBeats.length} жанровых битов</Chip>}
          </div>
          <TextInput
            value={node.title}
            placeholder="Название узла"
            onCommit={(v) => void updateNode(node.id, { title: v })}
            className="text-base font-semibold"
          />
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => void moveNode(node.id, -1)} title="Выше">
            ↑
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void moveNode(node.id, 1)} title="Ниже">
            ↓
          </Button>
          {node.parentId && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (confirm('Удалить узел вместе с потомками и сценами?')) {
                  void deleteNode(node.id).then(() => onSelect(node.parentId!));
                }
              }}
            >
              Удалить
            </Button>
          )}
        </div>
      </div>

      <Field label="Саммари узла">
        <TextArea rows={2} value={node.summary} onCommit={(v) => void updateNode(node.id, { summary: v })} />
      </Field>

      {defects.length > 0 && (
        <div className="space-y-1">
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

      <section className="card p-4">
        <SectionTitle>Круг Хармона</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {CIRCLE_STEPS.map((step) => {
            const slot = circle[step.index - 1];
            const highlight =
              step.index === 5 || step.index === 6
                ? 'border-accent/40'
                : step.index === 1 || step.index === 8
                  ? 'border-ink-500'
                  : 'border-ink-700';
            return (
              <div key={step.key} className={`border rounded p-2.5 ${highlight} bg-ink-900`}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-mono text-accent">
                    {step.index}. {step.label}
                  </span>
                  <span className="text-[10px] text-muted">{step.hint}</span>
                </div>
                <TextInput
                  value={slot.title}
                  placeholder="Событие"
                  onCommit={(v) => void updateCircleSlot(node, step.index, { title: v })}
                  className="mb-1.5"
                />
                <TextArea
                  rows={2}
                  value={slot.summary}
                  placeholder="Что здесь происходит"
                  onCommit={(v) => void updateCircleSlot(node, step.index, { summary: v })}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-3 leading-relaxed">
          Моури: мидпоинт — это буквально шаги 5 и 6. Получил желаемое (FIND) и заплатил большую цену
          (TAKE). Это два разных события.
        </p>
      </section>

      <section className="card p-4">
        <SectionTitle>Двигатель «хочет и цена» (Моури)</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Что персонаж получает">
            <TextArea rows={2} value={node.whatIsGained} onCommit={(v) => void updateNode(node.id, { whatIsGained: v })} />
          </Field>
          <Field label="Какую цену платит" hint="Незаполненная цена — дефект структуры.">
            <TextArea rows={2} value={node.costPaid} onCommit={(v) => void updateNode(node.id, { costPaid: v })} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <Field label="Точка невозврата">
            <Select
              value={node.pointOfNoReturn}
              onChange={(v: PointOfNoReturn) => void updateNode(node.id, { pointOfNoReturn: v })}
              options={(Object.keys(PONR_LABELS) as PointOfNoReturn[]).map((p) => ({
                value: p,
                label: PONR_LABELS[p],
              }))}
            />
          </Field>
          <Field label="Бит Уайлэнд">
            <Select
              value={node.weilandBeat}
              onChange={(v: WeilandBeat) => {
                const preset = WEILAND_BEATS.find((b) => b.key === v);
                void updateNode(node.id, {
                  weilandBeat: v,
                  targetPercent: node.targetPercent ?? preset?.percent ?? null,
                });
              }}
              options={WEILAND_BEATS.map((b) => ({ value: b.key, label: b.label }))}
            />
          </Field>
          <Field label="Целевой процент" hint="Ориентир Уайлэнд; для 8 серий и вертикали пересчитывается.">
            <TextInput
              value={node.targetPercent === null ? '' : String(node.targetPercent)}
              placeholder="—"
              onCommit={(v) =>
                void updateNode(node.id, { targetPercent: v.trim() === '' ? null : Number(v) })
              }
            />
          </Field>
        </div>
        {(node.weilandBeat === 'pinch_1' || node.weilandBeat === 'pinch_2') && (
          <Field
            label="Чем давит оппозиция"
            className="mt-3"
            hint="Обязательное поле для пинч-поинта."
          >
            <TextArea
              rows={2}
              value={node.oppositionPressure}
              onCommit={(v) => void updateNode(node.id, { oppositionPressure: v })}
            />
          </Field>
        )}
      </section>

      <section className="card p-4">
        <SectionTitle>Стыковка CHANGE → YOU</SectionTitle>
        {!incoming && !outgoing ? (
          <p className="text-xs text-muted">У узла нет соседей того же уровня.</p>
        ) : (
          <div className="space-y-3 text-xs">
            {incoming && (
              <LinkRow
                label={`← из «${nodes.find((n) => n.id === incoming.fromId)?.title || '?'}»`}
                link={incoming}
              />
            )}
            {outgoing && (
              <LinkRow
                label={`→ в «${nodes.find((n) => n.id === outgoing.toId)?.title || '?'}»`}
                link={outgoing}
                onAck={() => void updateNode(node.id, { continuityAck: !node.continuityAck })}
                acked={node.continuityAck}
              />
            )}
          </div>
        )}
      </section>

      <section className="card p-4">
        <SectionTitle
          right={
            childLevels.length > 0 && (
              <div className="flex gap-1.5">
                {childLevels.map((lvl: StructureLevel) => (
                  <Button
                    key={lvl}
                    size="sm"
                    variant="ghost"
                    onClick={() => void addNode(project.id, node.id, lvl)}
                  >
                    + {LEVEL_LABELS[lvl].toLowerCase()}
                  </Button>
                ))}
              </div>
            )
          }
        >
          Дочерние узлы и их место в круге
        </SectionTitle>
        {(() => {
          const children = nodes.filter((n) => n.parentId === node.id).sort((a, b) => a.order - b.order);
          if (!children.length) return <Empty>Дочерних узлов нет</Empty>;
          return (
            <div className="space-y-1.5">
              {children.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <button
                    className="flex-1 text-left text-sm text-muted hover:text-paper truncate"
                    onClick={() => onSelect(c.id)}
                  >
                    <span className="text-[10px] uppercase tracking-wider mr-2 text-muted/70">
                      {LEVEL_LABELS[c.level]}
                    </span>
                    {c.title || '(без названия)'}
                  </button>
                  <Select
                    className="w-44 text-xs"
                    value={String(c.circleStep ?? 0)}
                    onChange={(v) => void updateNode(c.id, { circleStep: Number(v) || null })}
                    options={[
                      { value: '0', label: 'шаг круга не задан' },
                      ...CIRCLE_STEPS.map((s) => ({ value: String(s.index), label: `${s.index}. ${s.label}` })),
                    ]}
                  />
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      <section className="card p-4">
        <SectionTitle
          right={
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const id = await addScene(project.id, node.id);
                navigate(`/p/${project.id}/scene/${id}`);
              }}
            >
              + сцена
            </Button>
          }
        >
          Сцены узла
        </SectionTitle>
        {!scenes.length ? (
          <Empty>Сцен нет</Empty>
        ) : (
          <div className="space-y-1">
            {scenes.map((s) => (
              <button
                key={s.id}
                className="block w-full text-left text-sm text-muted hover:text-paper truncate py-1"
                onClick={() => navigate(`/p/${project.id}/scene/${s.id}`)}
              >
                <span className="font-mono text-[11px] mr-2 text-accent">
                  {s.valueShiftFrom}
                  {s.valueShiftTo}
                </span>
                {s.heading}
                {s.summary ? ` — ${s.summary}` : ''}
              </button>
            ))}
          </div>
        )}
      </section>

      {assignedBeats.length > 0 && (
        <section className="card p-4">
          <SectionTitle>Назначенные жанровые биты</SectionTitle>
          <ul className="space-y-1 text-xs text-muted">
            {assignedBeats.map((b) => (
              <li key={b.id}>
                <span className="text-accent">{b.beatIndex}.</span> {b.beatName}
                {b.status === 'twisted' && <span className="text-warn"> · вывернут</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LinkRow({
  label,
  link,
  onAck,
  acked,
}: {
  label: string;
  link: { fromText: string; toText: string; similarity: number; ok: boolean };
  onAck?: () => void;
  acked?: boolean;
}) {
  const good = link.ok || acked;
  return (
    <div className={`border-l-2 pl-3 ${good ? 'border-ok' : 'border-warn'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted">{label}</span>
        <Chip tone={good ? 'ok' : 'warn'}>
          {link.ok ? 'состыковано' : acked ? 'подтверждено вручную' : 'разрыв'} ·{' '}
          {Math.round(link.similarity * 100)}%
        </Chip>
        {onAck && (
          <button className="text-[11px] underline text-muted hover:text-paper" onClick={onAck}>
            {acked ? 'снять подтверждение' : 'подтвердить вручную'}
          </button>
        )}
      </div>
      <p className="text-muted">CHANGE: {link.fromText || '— пусто —'}</p>
      <p className="text-muted">YOU: {link.toText || '— пусто —'}</p>
    </div>
  );
}
