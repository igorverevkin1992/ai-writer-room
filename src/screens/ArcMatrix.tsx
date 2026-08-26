import { useMemo, useState } from 'react';
import { useProjectBundle } from './ProjectLayout';
import { AIPanel } from '../components/AIPanel';
import { clearArcState, setArcState } from '../db/repo';
import { arcDefects, orderNodesForArcMatrix } from '../lib/validate';
import {
  ARC_TYPE_LABELS,
  LEVEL_LABELS,
  LIE_STATE_LABELS,
  WEILAND_BEATS,
  type ID,
  type LieState,
  type StructureLevel,
} from '../types';
import { Button, Chip, Empty, SectionTitle, Select, TextArea } from '../components/ui';

const STATE_TONE: Record<LieState, string> = {
  believes: 'bg-bad/20 text-bad',
  doubting: 'bg-warn/20 text-warn',
  glimpsing_truth: 'bg-accent/20 text-accent',
  rejecting_truth: 'bg-bad/30 text-bad',
  embracing_truth: 'bg-ok/20 text-ok',
};

const STATE_SHORT: Record<LieState, string> = {
  believes: 'верит',
  doubting: 'сомн.',
  glimpsing_truth: 'проблеск',
  rejecting_truth: 'отверг.',
  embracing_truth: 'принял',
};

export function ArcMatrixScreen() {
  const bundle = useProjectBundle();
  const [levelFilter, setLevelFilter] = useState<StructureLevel | 'all'>('all');
  const [beatsOnly, setBeatsOnly] = useState(false);
  const [cell, setCell] = useState<{ characterId: ID; nodeId: ID } | null>(null);

  const columns = useMemo(() => {
    let list = orderNodesForArcMatrix(bundle.nodes);
    if (levelFilter !== 'all') list = list.filter((n) => n.level === levelFilter);
    if (beatsOnly) list = list.filter((n) => n.weilandBeat !== 'none');
    return list;
  }, [bundle.nodes, levelFilter, beatsOnly]);

  const stateAt = (characterId: ID, nodeId: ID) =>
    bundle.arcStates.find((s) => s.characterId === characterId && s.structureNodeId === nodeId);

  const suspicious = useMemo(() => {
    const set = new Set<string>();
    const ordered = orderNodesForArcMatrix(bundle.nodes);
    for (const c of bundle.characters) {
      for (const d of arcDefects(
        c,
        ordered,
        bundle.arcStates.filter((s) => s.characterId === c.id),
      )) {
        if (d.nodeId) set.add(`${c.id}:${d.nodeId}`);
      }
    }
    return set;
  }, [bundle.characters, bundle.nodes, bundle.arcStates]);

  const selectedCharacter = cell ? bundle.characters.find((c) => c.id === cell.characterId) : null;
  const selectedState = cell ? stateAt(cell.characterId, cell.nodeId) : undefined;

  return (
    <div className="h-full grid grid-cols-[1fr_360px] min-h-0">
      <main className="overflow-auto p-5 min-w-0">
        <div className="flex items-center gap-3 mb-4">
          <SectionTitle>Матрица арок: персонаж × структурный бит</SectionTitle>
          <Select
            className="w-44 ml-auto"
            value={levelFilter}
            onChange={(v) => setLevelFilter(v as StructureLevel | 'all')}
            options={[
              { value: 'all', label: 'все уровни' },
              ...(Object.keys(LEVEL_LABELS) as StructureLevel[]).map((l) => ({
                value: l,
                label: LEVEL_LABELS[l],
              })),
            ]}
          />
          <Button size="sm" variant={beatsOnly ? 'primary' : 'ghost'} onClick={() => setBeatsOnly((v) => !v)}>
            только биты Уайлэнд
          </Button>
        </div>

        {!bundle.characters.length || !columns.length ? (
          <Empty>Нужны персонажи и узлы структуры</Empty>
        ) : (
          <div className="overflow-x-auto border border-ink-700 rounded">
            <table className="text-xs border-collapse min-w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-ink-850 border-b border-r border-ink-700 px-3 py-2 text-left font-medium text-muted w-44">
                    персонаж
                  </th>
                  {columns.map((n) => {
                    const beat = WEILAND_BEATS.find((b) => b.key === n.weilandBeat);
                    return (
                      <th
                        key={n.id}
                        className="border-b border-ink-700 px-2 py-2 text-left font-normal align-bottom min-w-[110px]"
                      >
                        <div className="text-[10px] text-muted uppercase tracking-wider">
                          {LEVEL_LABELS[n.level]}
                        </div>
                        <div className="text-paper truncate max-w-[120px]" title={n.title}>
                          {n.title || '(без названия)'}
                        </div>
                        {n.weilandBeat !== 'none' && (
                          <div className="text-[10px] text-accent truncate max-w-[120px]">
                            {beat?.label}
                            {n.targetPercent !== null ? ` ~${n.targetPercent}%` : ''}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {bundle.characters.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-800/40">
                    <td className="sticky left-0 z-10 bg-ink-850 border-r border-b border-ink-700 px-3 py-2 align-top">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[10px] text-muted">{ARC_TYPE_LABELS[c.arcType]}</div>
                    </td>
                    {columns.map((n) => {
                      const st = stateAt(c.id, n.id);
                      const flagged = suspicious.has(`${c.id}:${n.id}`);
                      const active = cell?.characterId === c.id && cell?.nodeId === n.id;
                      return (
                        <td
                          key={n.id}
                          className={`border-b border-ink-700 px-1.5 py-1.5 align-top cursor-pointer ${
                            active ? 'ring-1 ring-accent' : ''
                          } ${flagged ? 'bg-warn/10' : ''}`}
                          onClick={() => setCell({ characterId: c.id, nodeId: n.id })}
                        >
                          {st ? (
                            <span className={`chip ${STATE_TONE[st.lieState]}`}>
                              {STATE_SHORT[st.lieState]}
                            </span>
                          ) : (
                            <span className="text-muted/40">—</span>
                          )}
                          {st?.note && (
                            <div className="text-[10px] text-muted mt-0.5 line-clamp-2">{st.note}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cell && selectedCharacter && (
          <div className="card p-4 mt-4 max-w-2xl">
            <SectionTitle
              right={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void clearArcState(cell.characterId, cell.nodeId);
                    setCell(null);
                  }}
                >
                  Очистить ячейку
                </Button>
              }
            >
              {selectedCharacter.name} · {bundle.nodes.find((n) => n.id === cell.nodeId)?.title || 'узел'}
            </SectionTitle>
            <div className="grid grid-cols-[200px_1fr] gap-3">
              <Select
                value={selectedState?.lieState ?? 'believes'}
                onChange={(v: LieState) =>
                  void setArcState(bundle.project.id, cell.characterId, cell.nodeId, { lieState: v })
                }
                options={(Object.keys(LIE_STATE_LABELS) as LieState[]).map((s) => ({
                  value: s,
                  label: LIE_STATE_LABELS[s],
                }))}
              />
              <TextArea
                rows={2}
                placeholder="Чем подготовлен переход"
                value={selectedState?.note ?? ''}
                onCommit={(v) =>
                  void setArcState(bundle.project.id, cell.characterId, cell.nodeId, {
                    lieState: selectedState?.lieState ?? 'believes',
                    note: v,
                  })
                }
              />
            </div>
            <p className="text-[11px] text-muted mt-2">
              Событие узла: {bundle.nodes.find((n) => n.id === cell.nodeId)?.summary || '—'}
            </p>
          </div>
        )}

        <div className="flex gap-2 mt-4 flex-wrap">
          {(Object.keys(LIE_STATE_LABELS) as LieState[]).map((s) => (
            <span key={s} className={`chip ${STATE_TONE[s]}`}>
              {LIE_STATE_LABELS[s]}
            </span>
          ))}
          <Chip tone="warn">жёлтая ячейка — подозрительный переход</Chip>
        </div>
      </main>

      <aside className="border-l border-ink-700 p-3 min-h-0">
        <AIPanel
          bundle={bundle}
          mode="arc_audit"
          scope={{ characterId: cell?.characterId ?? bundle.characters[0]?.id ?? null, nodeId: cell?.nodeId ?? null }}
          scopeType="character"
          title="Аудит арки"
        />
      </aside>
    </div>
  );
}
