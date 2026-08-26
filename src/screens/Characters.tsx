import { useState } from 'react';
import { useProjectBundle } from './ProjectLayout';
import { AIPanel } from '../components/AIPanel';
import { addCharacter, deleteCharacter, updateCharacter } from '../db/repo';
import { arcDefects, orderNodesForArcMatrix } from '../lib/validate';
import {
  ARC_TYPE_HINTS,
  ARC_TYPE_LABELS,
  type ArcType,
  type Character,
  type ID,
} from '../types';
import { Button, Chip, Empty, Field, SectionTitle, Select, StringList, TextArea, TextInput } from '../components/ui';

export function CharactersScreen() {
  const bundle = useProjectBundle();
  const [selectedId, setSelectedId] = useState<ID | null>(bundle.characters[0]?.id ?? null);
  const selected = bundle.characters.find((c) => c.id === selectedId) ?? bundle.characters[0] ?? null;

  return (
    <div className="h-full grid grid-cols-[240px_1fr_360px] min-h-0">
      <aside className="border-r border-ink-700 overflow-y-auto p-3">
        <SectionTitle
          right={
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => setSelectedId(await addCharacter(bundle.project.id))}
            >
              + персонаж
            </Button>
          }
        >
          Персонажи
        </SectionTitle>
        {!bundle.characters.length ? (
          <Empty>Пусто</Empty>
        ) : (
          <ul className="space-y-0.5">
            {bundle.characters.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                    selected?.id === c.id ? 'bg-ink-700 text-paper' : 'text-muted hover:bg-ink-800 hover:text-paper'
                  }`}
                >
                  <div className="truncate">{c.name}</div>
                  <div className="text-[10px] text-muted truncate">
                    {c.role || 'роль не задана'} · {ARC_TYPE_LABELS[c.arcType]}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="overflow-y-auto p-5 min-w-0">
        {selected ? (
          <CharacterCard character={selected} bundle={bundle} onDeleted={() => setSelectedId(null)} />
        ) : (
          <Empty>Заведите персонажа</Empty>
        )}
      </main>

      <aside className="border-l border-ink-700 p-3 min-h-0">
        <AIPanel
          bundle={bundle}
          mode="arc_audit"
          scope={{ characterId: selected?.id ?? null }}
          scopeType="character"
          title="Аудит арки"
        />
      </aside>
    </div>
  );
}

function CharacterCard({
  character,
  bundle,
  onDeleted,
}: {
  character: Character;
  bundle: ReturnType<typeof useProjectBundle>;
  onDeleted: () => void;
}) {
  const defects = arcDefects(
    character,
    orderNodesForArcMatrix(bundle.nodes),
    bundle.arcStates.filter((s) => s.characterId === character.id),
  );
  const others = bundle.characters.filter((c) => c.id !== character.id);

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <TextInput
            value={character.name}
            onCommit={(v) => void updateCharacter(character.id, { name: v })}
            className="text-base font-semibold"
          />
          <TextInput
            value={character.role}
            placeholder="Роль в истории: протагонист / оппонент / наставник / союзник-оппонент"
            onCommit={(v) => void updateCharacter(character.id, { role: v })}
          />
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (confirm(`Удалить персонажа «${character.name}»?`)) {
              void deleteCharacter(character.id).then(onDeleted);
            }
          }}
        >
          Удалить
        </Button>
      </div>

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

      <section className="card p-4 space-y-3">
        <SectionTitle>Ядро арки (Уайлэнд)</SectionTitle>
        <Field label="Ложь — во что персонаж верит">
          <TextArea rows={2} value={character.lie} onCommit={(v) => void updateCharacter(character.id, { lie: v })} />
        </Field>
        <Field label="Призрак — рана прошлого, объясняющая Ложь">
          <TextArea rows={2} value={character.ghost} onCommit={(v) => void updateCharacter(character.id, { ghost: v })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Хочет — внешняя цель, воплощающая Ложь">
            <TextArea rows={2} value={character.want} onCommit={(v) => void updateCharacter(character.id, { want: v })} />
          </Field>
          <Field label="Нужно / Истина">
            <TextArea rows={2} value={character.need} onCommit={(v) => void updateCharacter(character.id, { need: v })} />
          </Field>
        </div>
        <Field label="Тип арки" hint={ARC_TYPE_HINTS[character.arcType]}>
          <Select
            value={character.arcType}
            onChange={(v: ArcType) => void updateCharacter(character.id, { arcType: v })}
            options={(Object.keys(ARC_TYPE_LABELS) as ArcType[]).map((t) => ({
              value: t,
              label: ARC_TYPE_LABELS[t],
            }))}
          />
        </Field>
      </section>

      <section className="card p-4 space-y-3">
        <SectionTitle>Мотор (Моури)</SectionTitle>
        <Field label="Убеждения" hint="Убеждения мотивируют потребность, потребность мотивирует желание.">
          <StringList
            values={character.beliefs}
            onChange={(v) => void updateCharacter(character.id, { beliefs: v })}
            placeholder="Во что персонаж верит о том, как устроена жизнь"
            addLabel="убеждение"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ставки внешние">
            <TextArea
              rows={2}
              value={character.stakesExternal}
              onCommit={(v) => void updateCharacter(character.id, { stakesExternal: v })}
            />
          </Field>
          <Field label="Ставки философские">
            <TextArea
              rows={2}
              value={character.stakesPhilosophical}
              onCommit={(v) => void updateCharacter(character.id, { stakesPhilosophical: v })}
            />
          </Field>
        </div>
        <Field
          label={`Позиция на философском спектре: ${character.philosophicalPosition}`}
          hint="−100 — полюс тезиса, +100 — полюс антитезиса. Наставник и антагонист держат полюса, протагонист посередине."
        >
          <input
            type="range"
            min={-100}
            max={100}
            step={5}
            value={character.philosophicalPosition}
            onChange={(e) =>
              void updateCharacter(character.id, { philosophicalPosition: Number(e.target.value) })
            }
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span className="truncate max-w-[45%]">{bundle.project.philosophicalThesis || 'тезис'}</span>
            <span className="truncate max-w-[45%] text-right">
              {bundle.project.philosophicalAntithesis || 'антитезис'}
            </span>
          </div>
        </Field>
        <Field label="Профиль голоса" hint="Лексика, длина реплик, что персонаж не говорит никогда.">
          <TextArea
            rows={2}
            value={character.voiceProfile}
            onCommit={(v) => void updateCharacter(character.id, { voiceProfile: v })}
          />
        </Field>
      </section>

      <section className="card p-4">
        <SectionTitle
          right={
            others.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void updateCharacter(character.id, {
                    relationships: [
                      ...character.relationships,
                      { charId: others[0].id, type: '', conflictOfBeliefs: '' },
                    ],
                  })
                }
              >
                + связь
              </Button>
            )
          }
        >
          Паутина персонажей
        </SectionTitle>
        {!character.relationships.length ? (
          <Empty>Связей нет</Empty>
        ) : (
          <div className="space-y-2">
            {character.relationships.map((rel, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-start">
                <Select
                  value={rel.charId}
                  onChange={(v) =>
                    void updateCharacter(character.id, {
                      relationships: character.relationships.map((r, j) =>
                        j === i ? { ...r, charId: v } : r,
                      ),
                    })
                  }
                  options={others.map((o) => ({ value: o.id, label: o.name }))}
                />
                <TextInput
                  value={rel.type}
                  placeholder="тип связи"
                  onCommit={(v) =>
                    void updateCharacter(character.id, {
                      relationships: character.relationships.map((r, j) =>
                        j === i ? { ...r, type: v } : r,
                      ),
                    })
                  }
                />
                <TextInput
                  value={rel.conflictOfBeliefs}
                  placeholder="конфликт убеждений"
                  onCommit={(v) =>
                    void updateCharacter(character.id, {
                      relationships: character.relationships.map((r, j) =>
                        j === i ? { ...r, conflictOfBeliefs: v } : r,
                      ),
                    })
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void updateCharacter(character.id, {
                      relationships: character.relationships.filter((_, j) => j !== i),
                    })
                  }
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-2 text-[11px] text-muted">
        <Chip tone="accent">{ARC_TYPE_LABELS[character.arcType]}</Chip>
        <span className="self-center">{ARC_TYPE_HINTS[character.arcType]}</span>
      </div>
    </div>
  );
}
