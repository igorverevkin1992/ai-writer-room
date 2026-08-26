/** BYOK-настройки. Ключ живёт в localStorage — с явным предупреждением в UI. */

const KEY_API = 'wros.apiKey';
const KEY_MODEL = 'wros.model';
const KEY_EFFORT = 'wros.effort';

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_API) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(value: string): void {
  try {
    if (value) localStorage.setItem(KEY_API, value);
    else localStorage.removeItem(KEY_API);
  } catch {
    /* приватный режим браузера — просто не сохраняем */
  }
}

export function getModel(fallback: string): string {
  try {
    return localStorage.getItem(KEY_MODEL) || fallback;
  } catch {
    return fallback;
  }
}

export function setModel(value: string): void {
  try {
    localStorage.setItem(KEY_MODEL, value);
  } catch {
    /* noop */
  }
}

export function getEffort(): Effort {
  try {
    return (localStorage.getItem(KEY_EFFORT) as Effort) || 'high';
  } catch {
    return 'high';
  }
}

export function setEffort(value: Effort): void {
  try {
    localStorage.setItem(KEY_EFFORT, value);
  } catch {
    /* noop */
  }
}
