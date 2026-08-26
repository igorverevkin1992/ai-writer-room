import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_MODEL, MODELS } from '../ai/models';
import {
  getApiKey,
  getEffort,
  getModel,
  setApiKey,
  setEffort,
  setModel,
  type Effort,
} from '../lib/settings';
import { createClient, toAIError } from '../ai/client';
import { Button, Chip, Field, Select } from '../components/ui';

const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export function SettingsScreen() {
  const [key, setKey] = useState(getApiKey());
  const [model, setModelState] = useState(getModel(DEFAULT_MODEL));
  const [effort, setEffortState] = useState<Effort>(getEffort());
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    setStatus(null);
    try {
      const client = createClient(key);
      const response = await client.messages.create({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
      });
      setStatus({ ok: true, text: `Ключ рабочий. Ответ модели ${response.model}.` });
    } catch (e) {
      const err = toAIError(e);
      setStatus({ ok: false, text: `${err.message}${err.hint ? ` — ${err.hint}` : ''}` });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Настройки</h1>
        <Link to="/">
          <Button variant="ghost">← К проектам</Button>
        </Link>
      </div>

      <div className="card p-5 space-y-4">
        <Field
          label="Ключ Claude API (BYOK)"
          hint="Ключ хранится в localStorage этого браузера и уходит только на api.anthropic.com. На общем компьютере не сохраняйте его."
        >
          <input
            type="password"
            className="field font-mono"
            value={key}
            placeholder="sk-ant-..."
            onChange={(e) => {
              setKey(e.target.value);
              setApiKey(e.target.value);
            }}
          />
        </Field>

        <Field label="Модель">
          <Select
            value={model}
            onChange={(v) => {
              setModelState(v);
              setModel(v);
            }}
            options={MODELS.map((m) => ({
              value: m.id,
              label: `${m.label} — $${m.inputPerMTok}/$${m.outputPerMTok} за 1M`,
            }))}
          />
          <p className="text-[11px] text-muted mt-1">{MODELS.find((m) => m.id === model)?.note}</p>
        </Field>

        <Field
          label="Усилие (effort)"
          hint="Влияет на глубину рассуждения и стоимость. Для аудита структуры хватает high."
        >
          <Select
            value={effort}
            onChange={(v) => {
              setEffortState(v);
              setEffort(v);
            }}
            options={EFFORTS.map((e) => ({ value: e, label: e }))}
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={() => void check()} disabled={!key || checking}>
            {checking ? 'Проверяю…' : 'Проверить ключ'}
          </Button>
          {status && <Chip tone={status.ok ? 'ok' : 'bad'}>{status.text}</Chip>}
        </div>
      </div>

      <div className="card p-5 text-xs text-muted space-y-2 leading-relaxed">
        <p className="text-paper font-medium">Как это работает</p>
        <p>
          Приложение local-first: все данные лежат в IndexedDB этого браузера, бэкенда нет.
          Единственный бэкап — экспорт проекта в JSON на экране «Обзор проекта». Чистка данных
          сайта удалит проекты безвозвратно.
        </p>
        <p>
          Запросы к Claude идут прямо из браузера с заголовком{' '}
          <code className="font-mono text-paper">anthropic-dangerous-direct-browser-access: true</code>.
          Статичная часть промпта (библия проекта) кэшируется: при повторных запросах в счётчике
          панели AI должно расти <code className="font-mono text-paper">cache read</code>.
        </p>
        <p>
          Цены моделей и идентификаторы меняются — сверяйтесь с platform.claude.com перед долгими
          прогонами.
        </p>
      </div>
    </div>
  );
}
