import { useEffect, useMemo, useState } from 'react';
import {
  CONTEXT_ITEMS,
  buildCachedSystem,
  buildDynamicContext,
  buildUserMessage,
  defaultToggles,
  type ContextBundle,
  type ContextToggles,
  type Scope,
} from '../ai/context';
import { MODE_SYSTEM_PROMPTS } from '../ai/prompts';
import { AIError, runAI } from '../ai/client';
import { DEFAULT_MODEL, MIN_CACHEABLE_TOKENS, estimateTokens, modelInfo } from '../ai/models';
import { getApiKey, getEffort, getModel } from '../lib/settings';
import { appendConversation } from '../db/repo';
import { useConversations } from '../lib/hooks';
import { AI_MODE_LABELS, type AIMode, type AIUsage, type ScopeType } from '../types';
import { Button, Chip, Empty, Select, Toggle } from './ui';

interface Props {
  bundle: ContextBundle;
  mode: AIMode;
  onModeChange?: (mode: AIMode) => void;
  modes?: AIMode[];
  scope: Scope;
  scopeType: ScopeType;
  /** Подставляется в поле запроса при открытии режима. */
  presetQuery?: string;
  /** Куда положить результат помимо панели (например, в поле сцены). */
  onResult?: (text: string) => void;
  title?: string;
}

export function AIPanel({
  bundle,
  mode,
  onModeChange,
  modes,
  scope,
  scopeType,
  presetQuery,
  onResult,
  title = 'Панель AI',
}: Props) {
  const [toggles, setToggles] = useState<ContextToggles>(() => defaultToggles(mode));
  const [query, setQuery] = useState(presetQuery ?? '');
  const [answer, setAnswer] = useState('');
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [error, setError] = useState<AIError | null>(null);
  const [busy, setBusy] = useState(false);
  const [mamet, setMamet] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const history = useConversations(bundle.project.id, mode);
  const model = getModel(DEFAULT_MODEL);
  const info = modelInfo(model);

  useEffect(() => {
    setToggles(defaultToggles(mode));
    setAnswer('');
    setUsage(null);
    setError(null);
  }, [mode]);

  useEffect(() => {
    if (presetQuery !== undefined) setQuery(presetQuery);
  }, [presetQuery]);

  const fullScope: Scope = { ...scope, mametSubmode: mamet };

  const cachedSystem = useMemo(
    () => buildCachedSystem(bundle, toggles),
    [bundle, toggles],
  );
  const dynamicContext = useMemo(
    () => buildDynamicContext(bundle, toggles, fullScope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, toggles, scope.nodeId, scope.beatId, scope.characterId, scope.sceneId, mamet],
  );

  const cachedTokens = estimateTokens(cachedSystem);
  const dynamicTokens = estimateTokens(dynamicContext + MODE_SYSTEM_PROMPTS[mode] + query);

  async function run() {
    setBusy(true);
    setError(null);
    setAnswer('');
    setUsage(null);
    const userMessage = buildUserMessage({ mode, bundle, toggles, scope: fullScope, query });
    try {
      const result = await runAI({
        apiKey: getApiKey(),
        model,
        effort: getEffort(),
        cachedSystem,
        modeSystem: MODE_SYSTEM_PROMPTS[mode],
        userMessage,
        onText: (chunk) => setAnswer((prev) => prev + chunk),
      });
      setAnswer(result.text);
      setUsage(result.usage);
      onResult?.(result.text);
      await appendConversation({
        projectId: bundle.project.id,
        mode,
        scopeType,
        scopeId: scope.nodeId ?? scope.sceneId ?? scope.characterId ?? scope.beatId ?? null,
        messages: [
          { role: 'user', content: userMessage, createdAt: Date.now() },
          { role: 'assistant', content: result.text, createdAt: Date.now(), usage: result.usage },
        ],
      });
    } catch (e) {
      setError(e instanceof AIError ? e : new AIError(String(e), 'unknown'));
    } finally {
      setBusy(false);
    }
  }

  const blockA = CONTEXT_ITEMS.filter((i) => i.block === 'A');
  const blockB = CONTEXT_ITEMS.filter((i) => i.block === 'B');

  return (
    <div className="card flex flex-col h-full min-h-0">
      <div className="px-4 py-2.5 border-b border-ink-700 flex items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.15em] text-muted">{title}</h2>
        <Chip tone="neutral" title={info.note}>
          {info.label}
        </Chip>
      </div>

      <div className="p-4 space-y-3 overflow-y-auto min-h-0 flex-1">
        {onModeChange && (
          <Select
            value={mode}
            onChange={onModeChange}
            options={(modes ?? (Object.keys(AI_MODE_LABELS) as AIMode[])).map((m) => ({
              value: m,
              label: AI_MODE_LABELS[m],
            }))}
          />
        )}

        <details className="text-xs" open>
          <summary className="cursor-pointer text-muted hover:text-paper select-none">
            Что подгружено в контекст
          </summary>
          <div className="mt-2 space-y-2 pl-1">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-accent/70 mb-1">
                Блок A · кэшируется ({cachedTokens.toLocaleString('ru')} ток.)
              </p>
              <div className="space-y-1">
                {blockA.map((item) => (
                  <Toggle
                    key={item.key}
                    checked={toggles[item.key]}
                    onChange={(v) => setToggles({ ...toggles, [item.key]: v })}
                    label={item.label}
                    hint="Изменение блока A сбрасывает кэш префикса"
                  />
                ))}
              </div>
              {cachedTokens < MIN_CACHEABLE_TOKENS && (
                <p className="text-[10px] text-warn mt-1">
                  Префикс короче {MIN_CACHEABLE_TOKENS} токенов — кэш не сработает.
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
                Блок B · после брейкпоинта ({dynamicTokens.toLocaleString('ru')} ток.)
              </p>
              <div className="space-y-1">
                {blockB.map((item) => (
                  <Toggle
                    key={item.key}
                    checked={toggles[item.key]}
                    onChange={(v) => setToggles({ ...toggles, [item.key]: v })}
                    label={item.label}
                  />
                ))}
              </div>
            </div>
            {mode === 'scene_doctor' && (
              <Toggle
                checked={mamet}
                onChange={setMamet}
                label="Подрежим: три вопроса Мэмета по диалогу"
              />
            )}
            <button
              className="text-[11px] text-muted underline hover:text-paper"
              onClick={() => setShowPrompt((v) => !v)}
            >
              {showPrompt ? 'Скрыть' : 'Показать'} собранный промпт
            </button>
            {showPrompt && (
              <pre className="text-[10px] leading-relaxed bg-ink-900 border border-ink-700 rounded p-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                {`=== БЛОК A (кэш) ===\n${cachedSystem}\n\n=== РЕЖИМ ===\n${MODE_SYSTEM_PROMPTS[mode]}\n\n=== БЛОК B ===\n${dynamicContext}`}
              </pre>
            )}
          </div>
        </details>

        <textarea
          className="field resize-y"
          rows={3}
          placeholder="Запрос (можно оставить пустым — режим отработает свою задачу)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) void run();
          }}
        />

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => void run()} disabled={busy}>
            {busy ? 'Работает…' : 'Запустить'}
          </Button>
          <span className="text-[11px] text-muted">⌘/Ctrl+Enter</span>
        </div>

        {error && (
          <div className="border border-bad/40 bg-bad/10 rounded p-3 text-xs">
            <p className="text-bad font-medium">{error.message}</p>
            {error.hint && <p className="text-muted mt-1 leading-snug">{error.hint}</p>}
          </div>
        )}

        {answer && (
          <div className="border border-ink-700 rounded bg-ink-900">
            <div className="px-3 py-2 border-b border-ink-700 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted">Ответ</span>
              <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(answer)}>
                Копировать
              </Button>
            </div>
            <div className="p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{answer}</div>
          </div>
        )}

        {usage && (
          <div className="text-[11px] text-muted space-y-0.5 font-mono">
            <div>
              input {usage.inputTokens} · output {usage.outputTokens}
            </div>
            <div>
              cache write {usage.cacheCreationTokens} ·{' '}
              <span className={usage.cacheReadTokens > 0 ? 'text-ok' : 'text-warn'}>
                cache read {usage.cacheReadTokens}
              </span>
            </div>
            <div>≈ ${usage.costUsd.toFixed(4)}</div>
          </div>
        )}

        {history && history.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted hover:text-paper select-none">
              История режима ({history.length})
            </summary>
            <div className="mt-2 space-y-2">
              {history.slice(0, 8).map((c) => {
                const last = c.messages[c.messages.length - 1];
                return (
                  <button
                    key={c.id}
                    className="block w-full text-left border border-ink-700 rounded p-2 hover:border-ink-500"
                    onClick={() => setAnswer(last?.content ?? '')}
                  >
                    <div className="text-[10px] text-muted">
                      {new Date(c.updatedAt).toLocaleString('ru')}
                    </div>
                    <div className="line-clamp-2 text-muted">{last?.content.slice(0, 160)}</div>
                  </button>
                );
              })}
            </div>
          </details>
        )}

        {!answer && !error && !busy && <Empty>Результат появится здесь</Empty>}
      </div>
    </div>
  );
}
