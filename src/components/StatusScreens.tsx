import { DONATE_HREF, LOAD_STEPS } from '../config';
import type { LoadProgress } from '../types';
import { DonateLink } from './DonateLink';

type StepState = 'done' | 'now' | 'todo';

const stepState = (index: number, progress: LoadProgress | null): StepState => {
  if (progress?.stage === 'done') return 'done';
  const current = Math.max(0, LOAD_STEPS.findIndex((s) => s.id === progress?.stage));
  if (index < current) return 'done';
  return index === current ? 'now' : 'todo';
};

const stepCounter = (id: string, progress: LoadProgress | null) =>
  id === 'statuses' && progress?.stage === 'statuses' && progress.total ? `${progress.done} з ${progress.total}` : '';

export const LoadingScreen = ({ progress, leaving = false }: { progress: LoadProgress | null; leaving?: boolean }) => (
  <main className={leaving ? 'loading leaving' : 'loading'}>
    <div>
      <h1 className="loading-title">Оновлюю дані</h1>
      <p className="hint">Зазвичай це кілька секунд</p>
    </div>
    <ol className="steps" role="status" aria-live="polite">
      {LOAD_STEPS.map((step, i) => {
        const state = stepState(i, progress);
        return (
          <li key={step.id} className={`step ${state}`}>
            <span className="mark" aria-hidden="true">
              {state === 'done' ? '✓' : ''}
            </span>
            {step.label}
            {state === 'now' && stepCounter(step.id, progress) && (
              <span className="count">{stepCounter(step.id, progress)}</span>
            )}
          </li>
        );
      })}
    </ol>
    {DONATE_HREF && (
      <p className="loading-support">
        <DonateLink variant="pill" />
      </p>
    )}
  </main>
);

export function ErrorScreen({ error, onRetry, onLogout }: { error: string; onRetry: () => void; onLogout: () => void }) {
  return (
    <main className="login">
      <h1 className="brand">Дедлайни</h1>
      <div className="panel">
        <div className="error" role="alert">
          {error}
        </div>
        <button className="btn primary" type="button" onClick={onRetry}>
          Спробувати ще раз
        </button>
        <button className="btn ghost" type="button" onClick={onLogout}>
          Вийти
        </button>
      </div>
    </main>
  );
}
