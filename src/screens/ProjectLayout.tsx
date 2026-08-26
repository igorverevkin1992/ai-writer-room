import { NavLink, Outlet, useOutletContext, useParams, Link } from 'react-router-dom';
import { useBundle } from '../lib/hooks';
import { projectDiagnostics } from '../lib/validate';
import type { ContextBundle } from '../ai/context';
import { Chip } from '../components/ui';

const TABS = [
  { to: '.', label: 'Обзор', end: true },
  { to: 'genre', label: 'Покрытие жанра', end: false },
  { to: 'structure', label: 'Структура', end: false },
  { to: 'characters', label: 'Персонажи', end: false },
  { to: 'matrix', label: 'Матрица арок', end: false },
];

export function useProjectBundle(): ContextBundle {
  return useOutletContext<ContextBundle>();
}

export function ProjectLayout() {
  const { projectId } = useParams();
  const bundle = useBundle(projectId);

  if (!bundle) {
    return (
      <div className="p-8 text-sm text-muted">
        Загрузка проекта… Если это надолго — проект не найден.{' '}
        <Link to="/" className="underline">
          К списку проектов
        </Link>
      </div>
    );
  }

  const diag = projectDiagnostics(bundle);

  return (
    <div className="h-full flex flex-col">
      <header className="border-b border-ink-700 px-6 py-2.5 flex items-center gap-6 shrink-0">
        <Link to="/" className="text-muted hover:text-paper text-sm" title="К списку проектов">
          ←
        </Link>
        <div className="min-w-0">
          <h1 className="font-semibold truncate leading-tight">{bundle.project.title}</h1>
          <p className="text-[11px] text-muted truncate">{bundle.project.logline || 'логлайн не заполнен'}</p>
        </div>
        <nav className="flex gap-1 ml-4">
          {TABS.map((t) => (
            <NavLink
              key={t.label}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded text-sm transition-colors ${
                  isActive ? 'bg-ink-700 text-paper' : 'text-muted hover:text-paper hover:bg-ink-800'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Chip tone={diag.coverage.placed === diag.coverage.total ? 'ok' : 'warn'}>
            биты {diag.coverage.placed}/{diag.coverage.total}
          </Chip>
          {diag.errors > 0 && <Chip tone="bad">дефектов {diag.errors}</Chip>}
          {diag.warnings > 0 && <Chip tone="warn">замечаний {diag.warnings}</Chip>}
          <Link to="/settings" className="text-muted hover:text-paper text-xs">
            Настройки
          </Link>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet context={bundle} />
      </div>
    </div>
  );
}
