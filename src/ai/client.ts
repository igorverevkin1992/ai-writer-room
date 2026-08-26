import Anthropic from '@anthropic-ai/sdk';
import { estimateCost, modelInfo } from './models';
import type { AIUsage } from '../types';
import type { Effort } from '../lib/settings';

/**
 * Прямой вызов Claude API из браузера (BYOK, local-first, без бэкенда).
 * SDK сам ставит `anthropic-dangerous-direct-browser-access: true` при
 * dangerouslyAllowBrowser — дублируем заголовок явно, чтобы это было видно в коде.
 */
export function createClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    maxRetries: 4, // 429 и 5xx — экспоненциальный backoff внутри SDK
    defaultHeaders: {
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'context' | 'rate_limit' | 'request' | 'network' | 'unknown',
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export function toAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new AIError('Ключ отклонён API', 'auth', 'Проверьте ключ в настройках: он должен начинаться с sk-ant- и быть активным.');
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new AIError('Доступ к модели запрещён', 'auth', 'Ключ не имеет доступа к выбранной модели — смените модель в настройках.');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AIError('Лимит запросов исчерпан', 'rate_limit', 'SDK уже повторил запрос с экспоненциальной задержкой. Подождите минуту и повторите.');
  }
  if (error instanceof Anthropic.BadRequestError) {
    const text = String(error.message || '');
    if (/prompt is too long|context|max_tokens/i.test(text)) {
      return new AIError('Контекст не помещается в окно модели', 'context', 'Снимите чекбоксы контекста в панели AI (матрица арок и полный текст сцены — самые тяжёлые) или выберите модель с большим окном.');
    }
    return new AIError(`Запрос отклонён: ${text}`, 'request');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AIError('Нет связи с api.anthropic.com', 'network', 'Проверьте сеть. Данные проекта в безопасности — они лежат локально в IndexedDB.');
  }
  if (error instanceof Anthropic.APIError) {
    return new AIError(`Ошибка API ${String(error.status)}: ${error.message}`, 'unknown');
  }
  return new AIError(error instanceof Error ? error.message : String(error), 'unknown');
}

export interface CachedBlock {
  text: string;
  /** '1h' для корпуса первоисточников: он не меняется весь сеанс работы. */
  ttl?: '5m' | '1h';
}

export interface RunParams {
  apiKey: string;
  model: string;
  effort: Effort;
  /**
   * Блок A — статичные части промпта, каждая со своим брейкпоинтом кэша.
   * Порядок от самого стабильного к самому изменчивому: кэш сопоставляется
   * по префиксу, и любая правка сбрасывает всё, что стоит после неё.
   */
  cachedBlocks: CachedBlock[];
  /** Блок B — системная рамка режима (после брейкпоинта). */
  modeSystem: string;
  /** Пользовательское сообщение: конкретный узел/сцена + запрос. */
  userMessage: string;
  /** История переписки внутри одного режима. */
  history?: { role: 'user' | 'assistant'; content: string }[];
  onText?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface RunResult {
  text: string;
  usage: AIUsage;
}

export async function runAI(params: RunParams): Promise<RunResult> {
  if (!params.apiKey.trim()) {
    throw new AIError('API-ключ не задан', 'auth', 'Откройте «Настройки» и вставьте ключ Claude API.');
  }
  const client = createClient(params.apiKey);
  const info = modelInfo(params.model);

  const body: Anthropic.MessageStreamParams = {
    model: params.model,
    max_tokens: 16000,
    system: [
      // Брейкпоинт кэша стоит на конце каждой статичной части.
      ...params.cachedBlocks
        .filter((b) => b.text.trim())
        .map((b) => ({
          type: 'text' as const,
          text: b.text,
          cache_control: { type: 'ephemeral' as const, ttl: b.ttl ?? '5m' },
        })),
      { type: 'text', text: params.modeSystem },
    ],
    messages: [
      ...(params.history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: params.userMessage },
    ],
  };
  if (info.supportsEffort) {
    body.output_config = { effort: params.effort };
  }

  try {
    const stream = client.messages.stream(body, { signal: params.signal });
    if (params.onText) stream.on('text', params.onText);
    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new AIError(
        'Модель отказалась отвечать на этот запрос',
        'request',
        message.stop_details && 'explanation' in message.stop_details
          ? String(message.stop_details.explanation ?? '')
          : undefined,
      );
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return {
      text,
      usage: {
        inputTokens: message.usage.input_tokens ?? 0,
        outputTokens: message.usage.output_tokens ?? 0,
        cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        costUsd: estimateCost(params.model, message.usage),
        model: params.model,
      },
    };
  } catch (error) {
    throw toAIError(error);
  }
}
