/**
 * Реестр моделей. Цены — за 1M токенов, ставки Claude API (сверено 2026-08).
 * Запись кэша ≈ 1.25× input, чтение кэша ≈ 0.1× input.
 */
export interface ModelInfo {
  id: string;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
  contextTokens: number;
  /** Поддерживает output_config.effort. */
  supportsEffort: boolean;
  note: string;
}

export const MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    inputPerMTok: 5,
    outputPerMTok: 25,
    contextTokens: 1_000_000,
    supportsEffort: true,
    note: 'По умолчанию. Адаптивное мышление включено на стороне модели.',
  },
  {
    id: 'claude-opus-4-8',
    label: 'Claude Opus 4.8',
    inputPerMTok: 5,
    outputPerMTok: 25,
    contextTokens: 1_000_000,
    supportsEffort: true,
    note: 'Предыдущее поколение Opus.',
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    inputPerMTok: 2,
    outputPerMTok: 10,
    contextTokens: 1_000_000,
    supportsEffort: true,
    note: 'Дешевле, для черновых прогонов аудита.',
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    inputPerMTok: 1,
    outputPerMTok: 5,
    contextTokens: 200_000,
    supportsEffort: false,
    note: 'Самая дешёвая. Контекст 200K — полная библия может не поместиться.',
  },
];

export const DEFAULT_MODEL = 'claude-opus-5';

export function modelInfo(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function estimateCost(modelId: string, usage: UsageLike): number {
  const m = modelInfo(modelId);
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return (
    (input * m.inputPerMTok +
      cacheWrite * m.inputPerMTok * 1.25 +
      cacheRead * m.inputPerMTok * 0.1 +
      output * m.outputPerMTok) /
    1_000_000
  );
}

/** Грубая оценка объёма промпта до отправки: кириллица ≈ 3 символа на токен. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

/** Минимальный кэшируемый префикс Claude API. */
export const MIN_CACHEABLE_TOKENS = 1024;
