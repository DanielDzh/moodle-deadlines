import { fmtDayLong, fmtTime, taskWord, whenText } from '../lib/dates';
import type { Board } from '../lib/board';
import type { Course } from '../types';

export function Summary({ board, courses }: { board: Board; courses: Map<number, Course> }) {
  const { next, in7, in31, overdue, total } = board.summary;
  const burning = !!next && board.isBurning(next);

  return (
    <section className={`hero ${burning ? 'burning' : ''}`} aria-label="Зведення">
      <p className="hero-label">Найближчий дедлайн</p>
      {next && next.days !== null ? (
        <>
          <h2 className="hero-title">
            <a href={next.url} target="_blank" rel="noopener noreferrer">
              {next.name}
            </a>
          </h2>
          <p className={`hero-when ${next.urg}`}>
            {courses.get(next.courseid)?.name}: <strong style={{ color: 'var(--u)' }}>{whenText(next.due, next.days, board.now)}</strong>,{' '}
            {fmtDayLong(next.due)} о {fmtTime(next.due)}
          </p>
        </>
      ) : (
        <h2 className="hero-title">Невиконаних завдань із термінами попереду немає</h2>
      )}
      <dl className="stats">
        <div>
          <dt>за 7 днів</dt>
          <dd>{in7}</dd>
        </div>
        <div>
          <dt>за 31 день</dt>
          <dd>{in31}</dd>
        </div>
        <div>
          <dt>{taskWord(total)} усього</dt>
          <dd>{total}</dd>
        </div>
        {overdue > 0 && (
          <div className="bad">
            <dt>прострочено й не подано</dt>
            <dd>{overdue}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
