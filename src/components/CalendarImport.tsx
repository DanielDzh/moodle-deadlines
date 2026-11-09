import { useState, type ChangeEvent, type DragEvent } from 'react';
import { CALENDAR, CALENDAR_TEXTS as T } from '../config';
import { useCalendarFile } from '../hooks/useCalendarFile';
import type { CalendarImportProps } from '../types';
import { Checkbox } from './Checkbox';

/** The "through the calendar" way in: instructions and a file picker with drag-and-drop. */
export const CalendarImport = ({ remember: rememberInitial, onLoaded }: CalendarImportProps) => {
  const [remember, setRemember] = useState(rememberInitial);
  const [dragging, setDragging] = useState(false);
  const { error, busy, load } = useCalendarFile(remember, onLoaded);

  const handleRemember = (e: ChangeEvent<HTMLInputElement>) => setRemember(e.target.checked);
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // The same file can be chosen again after a mistake.
    e.target.value = '';
    if (file) void load(file);
  };
  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !busy) void load(file);
  };

  return (
    <div className="panel" role="tabpanel">
      <p className="hint">{T.intro}</p>
      <ol className="cal-steps">
        {T.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <label
        className={dragging ? 'dropzone is-over' : 'dropzone'}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="btn primary">{busy ? T.reading : T.pick}</span>
        <span className="drop-or">{T.drop}</span>
        <input type="file" accept={CALENDAR.accept} onChange={handleChange} disabled={busy} />
      </label>
      <Checkbox checked={remember} onChange={handleRemember} label={T.remember} />
      <p className="hint">{T.privacy}</p>
      <p className="hint">{T.limits}</p>
      <div className="error" role="alert">
        {error}
      </div>
    </div>
  );
};
