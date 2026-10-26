import type { CSSProperties } from 'react';
import type { Board } from '../lib/board';
import type { Course } from '../types';

interface Props {
  board: Board;
  courses: Course[];
  open: boolean;
  onToggleOpen: () => void;
  onToggleCourse: (id: number | 'all') => void;
  hideSubmitted: boolean;
  onHideSubmitted: (v: boolean) => void;
  hideDone: boolean;
  onHideDone: (v: boolean) => void;
}

export function Filters(p: Props) {
  const picked = p.board.filter;
  const pickedNames = p.courses.filter((c) => picked.has(c.id)).map((c) => c.name).join('\n');

  return (
    <div className="filters">
      <div className="filter-bar">
        <button
          type="button"
          className={`chips-toggle ${picked.size ? 'active' : ''}`}
          aria-expanded={p.open}
          aria-controls="courseChips"
          title={pickedNames || undefined}
          onClick={p.onToggleOpen}
        >
          <span>{picked.size ? `Предмети: вибрано ${picked.size}` : 'Предмети: усі'}</span>
          <span className="caret" aria-hidden="true">
            ▾
          </span>
        </button>
        {picked.size > 0 && !p.open && (
          <button type="button" className="btn ghost small" onClick={() => p.onToggleCourse('all')}>
            Скинути
          </button>
        )}
        <div className="toggles">
          <label className="switch">
            <input type="checkbox" checked={p.hideSubmitted} onChange={(e) => p.onHideSubmitted(e.target.checked)} />
            <span>Приховати подані</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={p.hideDone} onChange={(e) => p.onHideDone(e.target.checked)} />
            <span>Приховати виконані</span>
          </label>
        </div>
      </div>

      {p.open && (
        <div className="chips" id="courseChips" role="group" aria-label="Фільтр за курсами">
          <button
            type="button"
            className={`chip all ${picked.size === 0 ? 'on' : ''}`}
            aria-pressed={picked.size === 0}
            onClick={() => p.onToggleCourse('all')}
          >
            <span className="nm">Усі курси</span>
            <b>{p.board.shownTotal}</b>
          </button>
          {p.courses
            .filter((c) => p.board.counts.get(c.id))
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${picked.has(c.id) ? 'on' : ''}`}
                style={{ '--c': c.color } as CSSProperties}
                aria-pressed={picked.has(c.id)}
                title={c.name}
                onClick={() => p.onToggleCourse(c.id)}
              >
                <i aria-hidden="true" />
                <span className="nm">{c.name}</span>
                <b>{p.board.counts.get(c.id)}</b>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
