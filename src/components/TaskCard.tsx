import type { CSSProperties } from 'react';
import { KIND_LABEL } from '../config';
import { fmtDateTime, fmtDayLong, fmtTime } from '../lib/dates';
import { shortText } from '../lib/text';
import type { Course, DecoratedTask } from '../types';

interface Props {
  task: DecoratedTask;
  course?: Course;
  done: boolean;
  burning: boolean;
  onToggleDone: (key: string, done: boolean) => void;
}

function StatusBadges({ task, burning }: { task: DecoratedTask; burning: boolean }) {
  const badges: { text: string; tone?: 'ok' | 'warn' | 'bad' | 'fire' }[] = [];
  if (burning) badges.push({ text: '🔥 Горить', tone: 'fire' });
  if (KIND_LABEL[task.kind]) badges.push({ text: KIND_LABEL[task.kind] });
  else if (task.kind !== 'assign') badges.push({ text: 'Активність' });

  if (task.kind === 'assign') {
    switch (task.status) {
      case 'graded':
        badges.push({ text: task.grade ? `Оцінено: ${task.grade}` : 'Оцінено', tone: 'ok' });
        break;
      case 'submitted':
        badges.push({ text: 'Подано', tone: 'ok' });
        break;
      case 'draft':
        badges.push({ text: 'Чернетка', tone: 'warn' });
        break;
      case 'reopened':
        badges.push({ text: 'Повторна спроба', tone: 'warn' });
        break;
      case 'new':
      case '':
        badges.push({ text: 'Не подано', tone: task.overdue ? 'bad' : undefined });
        break;
      default:
        badges.push({ text: 'Статус невідомий' });
    }
  }
  if (!badges.length) return null;
  return (
    <span className="badges">
      {badges.map((b) => (
        <span key={b.text} className={`badge ${b.tone ?? ''}`}>
          {b.text}
        </span>
      ))}
    </span>
  );
}

export function TaskCard({ task, course, done, burning, onToggleDone }: Props) {
  const now = new Date();
  const intro = task.intro || '';
  const desc = intro ? shortText(intro) : '';
  const isLong = intro.replace(/\s+/g, ' ').length > desc.length;
  const notYetOpen = task.open > now.getTime() / 1000;
  const hasCutoff = task.cutoff > (task.due || 0);
  const classes = ['card', done && 'is-done', burning && 'is-burning'].filter(Boolean).join(' ');

  return (
    <article className={classes} style={{ '--c': course?.color ?? '#8A93A3' } as CSSProperties}>
      <div className="card-top">
        <span className="course">
          <i aria-hidden="true" />
          {course?.name ?? 'Курс'}
        </span>
        <StatusBadges task={task} burning={burning} />
      </div>
      <h3>
        <a href={task.url} target="_blank" rel="noopener noreferrer">
          {task.name}
        </a>
      </h3>
      {desc && <p className="desc">{desc}</p>}
      {isLong && (
        <details className="full">
          <summary>Повний опис</summary>
          <p>{intro}</p>
        </details>
      )}
      <div className="card-foot">
        <div className="meta">
          {task.due > 0 && (
            <span>
              Здати до {fmtTime(task.due)}, {fmtDayLong(task.due, now)}
            </span>
          )}
          {notYetOpen && <span className="opens">Відкриється {fmtDateTime(task.open, now)}</span>}
          {hasCutoff && <span className="soft">Остаточний термін: {fmtDateTime(task.cutoff, now)}</span>}
        </div>
        <label className="check">
          <input type="checkbox" checked={done} onChange={(e) => onToggleDone(task.key, e.target.checked)} />
          <span>Виконано</span>
        </label>
      </div>
    </article>
  );
}
