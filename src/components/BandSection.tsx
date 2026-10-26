import { BAND_TITLE } from '../config';
import { dayWord, fmtDay, railTime, taskWord } from '../lib/dates';
import type { BandView, Board, DayGroup } from '../lib/board';
import type { Course } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  band: BandView;
  board: Board;
  courses: Map<number, Course>;
  done: Record<string, boolean>;
  onToggleDone: (key: string, done: boolean) => void;
}

function bandRange(band: BandView, semEnd: number): string {
  switch (band.id) {
    case 'overdue':
      return 'термін уже минув';
    case 'week':
      return 'до 7 днів';
    case 'month':
      return 'від 8 до 31 дня';
    case 'semester':
      return `до ${fmtDay(semEnd)}`;
    case 'later':
      return `після ${fmtDay(semEnd)}`;
    case 'none':
      return 'дату здачі не вказано';
  }
}

/** Велике число днів до здачі зліва від карток одного дня. */
function DayRail({ group, board }: { group: DayGroup; board: Board }) {
  const first = group.items[0];
  if (!first.due || first.days === null) {
    return (
      <div className="rail u-none">
        <span className="big">—</span>
        <span className="cap">без терміну</span>
      </div>
    );
  }
  const urgency = group.items.every(board.isFinished) ? 'u-done' : first.urg;
  const burning = group.items.some(board.isBurning);
  let big: string | number;
  let cap: string;
  let word = false;
  const precise = first.overdue || first.days < 0 ? null : railTime(first.due, first.days, board.now);
  if (precise) {
    ({ big, cap, word } = precise);
  } else if (first.days === 0) {
    big = 'Сьогодні';
    word = true;
    cap = first.overdue ? 'термін уже минув' : 'останній день';
  } else if (first.days > 0) {
    big = first.days;
    cap = `${dayWord(first.days)} до здачі`;
  } else {
    big = -first.days;
    cap = `${dayWord(-first.days)} тому`;
  }
  return (
    <div className={`rail ${urgency} ${burning ? 'burning' : ''}`}>
      <span className={`big ${word ? 'word' : ''}`}>{big}</span>
      <span className="cap">{cap}</span>
      <span className="date">{fmtDay(first.due)}</span>
    </div>
  );
}

export function BandSection({ band, board, courses, done, onToggleDone }: Props) {
  return (
    <section className={`band band-${band.id}`}>
      <header className="band-head">
        <h2>{BAND_TITLE[band.id]}</h2>
        <span className="cnt">
          {band.items.length} {taskWord(band.items.length)}
        </span>
        <span className="rng">{bandRange(band, board.semEnd)}</span>
      </header>
      {band.groups.map((g) => (
        <div className="day" key={g.key}>
          <DayRail group={g} board={board} />
          <div className="cards">
            {g.items.map((t) => (
              <TaskCard
                key={t.key}
                task={t}
                course={courses.get(t.courseid)}
                done={!!done[t.key]}
                burning={board.isBurning(t)}
                onToggleDone={onToggleDone}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
