import { LEVEL_LABELS, WEILAND_BEATS, type ID, type StructureNode } from '../types';
import { normalizeCircle } from '../db/repo';

interface Props {
  nodes: StructureNode[];
  selectedId: ID | null;
  onSelect: (id: ID) => void;
  parentId?: ID | null;
  depth?: number;
  /** Подсветка узла как цели drag-and-drop. */
  dropTargetId?: ID | null;
  beatCounts?: Map<ID, number>;
  /** Обёртка строки — нужна, чтобы навесить droppable-рефы dnd-kit. */
  wrapRow?: (node: StructureNode, row: React.ReactNode) => React.ReactNode;
}

function filledSteps(node: StructureNode): number {
  return normalizeCircle(node.circle).filter((s) => s.title.trim() || s.summary.trim()).length;
}

export function StructureTree({
  nodes,
  selectedId,
  onSelect,
  parentId = null,
  depth = 0,
  dropTargetId,
  beatCounts,
  wrapRow,
}: Props) {
  const children = nodes.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order);
  if (!children.length) return null;

  return (
    <ul className={depth === 0 ? '' : 'ml-3 border-l border-ink-700 pl-2'}>
      {children.map((node) => {
        const steps = filledSteps(node);
        const beat = WEILAND_BEATS.find((b) => b.key === node.weilandBeat);
        const count = beatCounts?.get(node.id) ?? 0;
        const row = (
          <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect(node.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(node.id)}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                selectedId === node.id
                  ? 'bg-ink-700 text-paper'
                  : dropTargetId === node.id
                    ? 'bg-accent/20 ring-1 ring-accent'
                    : 'text-muted hover:bg-ink-800 hover:text-paper'
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider text-muted/70 w-14 shrink-0">
                {LEVEL_LABELS[node.level]}
              </span>
              <span className="truncate flex-1">{node.title || '(без названия)'}</span>
              {count > 0 && (
                <span className="text-[10px] text-accent shrink-0" title="назначено жанровых битов">
                  {count}б
                </span>
              )}
              {node.weilandBeat !== 'none' && (
                <span className="text-[10px] text-muted shrink-0" title={beat?.label}>
                  {beat?.label.slice(0, 12)}
                </span>
              )}
              <span
                className={`text-[10px] font-mono shrink-0 ${steps === 8 ? 'text-ok' : steps === 0 ? 'text-muted/50' : 'text-warn'}`}
                title="заполнено шагов круга"
              >
                {steps}/8
              </span>
            </div>
        );
        return (
          <li key={node.id}>
            {wrapRow ? wrapRow(node, row) : row}
            <StructureTree
              nodes={nodes}
              selectedId={selectedId}
              onSelect={onSelect}
              parentId={node.id}
              depth={depth + 1}
              dropTargetId={dropTargetId}
              beatCounts={beatCounts}
              wrapRow={wrapRow}
            />
          </li>
        );
      })}
    </ul>
  );
}
