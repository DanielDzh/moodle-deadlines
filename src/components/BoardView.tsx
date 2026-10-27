import { useCallback, useEffect, useMemo, useState } from 'react';
import { BURN_DAYS, KEYS, REMINDER_TEXTS } from '../config';
import { useStoredState } from '../hooks/useStoredState';
import { useMinute } from '../hooks/useMinute';
import { buildBoard } from '../lib/board';
import { fmtDateTime, fmtDayLong } from '../lib/dates';
import type { Course, RemindersApi, Snapshot, Theme } from '../types';
import { BandSection } from './BandSection';
import { DonateLink } from './DonateLink';
import { Filters } from './Filters';
import { RemindersDialog } from './RemindersDialog';
import { Summary } from './Summary';

const THEME_LABEL: Record<Theme, string> = {
  auto: 'Тема: як у системі',
  light: 'Тема: світла',
  dark: 'Тема: темна',
};

interface Props {
  snapshot: Snapshot;
  error: string;
  theme: Theme;
  onNextTheme: () => void;
  onLogout: () => void;
  reminders: RemindersApi;
}

/** The "burning" threshold can be changed temporarily in the URL: ?burnDays=7 — handy to preview the effect. */
function burnDaysFromUrl(): number {
  try {
    const raw = new URLSearchParams(window.location.search).get('burnDays');
    const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 31) return n;
  } catch {
    /* no access to the address */
  }
  return BURN_DAYS;
}

export function BoardView({ snapshot, error, theme, onNextTheme, onLogout, reminders }: Props) {
  const minute = useMinute();
  const [done, setDone] = useStoredState<Record<string, boolean>>(KEYS.done, {});
  const [hideDone, setHideDone] = useStoredState(KEYS.hideDone, false);
  const [hideSubmitted, setHideSubmitted] = useStoredState(KEYS.hideSubmitted, true);
  const [chipsOpen, setChipsOpen] = useStoredState(KEYS.chipsOpen, false);
  const [filter, setFilter] = useStoredState<number[]>(KEYS.filter, []);
  const burnDays = useMemo(burnDaysFromUrl, []);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const openReminders = () => setRemindersOpen(true);
  const closeReminders = () => setRemindersOpen(false);

  // Push the tasks to the reminders service after every refresh and every tick change (debounced inside the hook).
  const { syncSoon, state: remindersState } = reminders;
  useEffect(() => {
    syncSoon(snapshot, done);
  }, [syncSoon, remindersState, snapshot, done]);

  const board = useMemo(
    () => buildBoard(snapshot, { done, filter, hideDone, hideSubmitted, burnDays }),
    // minute is a dependency so that time left and days recompute on their own
    [snapshot, done, filter, hideDone, hideSubmitted, burnDays, minute],
  );
  const courses = useMemo(() => new Map<number, Course>(snapshot.courses.map((c) => [c.id, c])), [snapshot]);

  const toggleDone = useCallback(
    (key: string, value: boolean) =>
      setDone((prev) => {
        const next = { ...prev };
        if (value) next[key] = true;
        else delete next[key];
        return next;
      }),
    [setDone],
  );

  const toggleCourse = useCallback(
    (id: number | 'all') =>
      setFilter((prev) => {
        if (id === 'all') return [];
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }),
    [setFilter],
  );

  const emptyText = board.all.length
    ? 'Тут порожньо. Виберіть інший курс або вимкніть «Приховати подані» чи «Приховати виконані».'
    : 'У поточних курсах не знайшлося завдань, форумів чи тестів.';

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1 className="brand">Дедлайни</h1>
          <p className="who">{snapshot.user}</p>
        </div>
        <div className="actions">
          <DonateLink variant="icon" />
          <button type="button" className="btn ghost" onClick={openReminders}>
            🔔 {remindersState === 'active' ? REMINDER_TEXTS.buttonActive : REMINDER_TEXTS.button}
          </button>
          <button type="button" className="btn ghost" onClick={onNextTheme}>
            {THEME_LABEL[theme]}
          </button>
          <button type="button" className="btn ghost" onClick={onLogout}>
            Вийти
          </button>
        </div>
      </header>

      {error && (
        <div className="error banner" role="alert">
          Не вдалося оновити: {error} Показано дані з попереднього завантаження.
        </div>
      )}

      <Summary board={board} courses={courses} />

      <Filters
        board={board}
        courses={snapshot.courses}
        open={chipsOpen}
        onToggleOpen={() => setChipsOpen((v) => !v)}
        onToggleCourse={toggleCourse}
        hideSubmitted={hideSubmitted}
        onHideSubmitted={setHideSubmitted}
        hideDone={hideDone}
        onHideDone={setHideDone}
      />

      {board.bands.length ? (
        board.bands.map((b) => (
          <BandSection key={b.id} band={b} board={board} courses={courses} done={done} onToggleDone={toggleDone} />
        ))
      ) : (
        <div className="empty">{emptyText}</div>
      )}

      <footer>
        <p>
          Дані зібрано {fmtDateTime(snapshot.collectedAt)} і оновлюються щоразу, коли ви відкриваєте чи
          перезавантажуєте сторінку. Дні до здачі рахуються від сьогоднішньої дати.
        </p>
        <p>
          Показано лише поточні курси. Кінець семестру: {fmtDayLong(board.semEnd)}. Позначки «виконано» зберігаються
          лише в цьому браузері.
        </p>
      </footer>
      {remindersOpen && <RemindersDialog api={reminders} onClose={closeReminders} />}
    </div>
  );
}
