import type { ChangeEvent } from 'react';
import { CALENDAR } from '../config';

interface Props {
  label: string;
  busy: boolean;
  onFile: (file: File) => void;
}

/** A button-looking file picker: the real input stays in the DOM (keyboard, screen readers) and is only hidden. */
export const CalendarFileButton = ({ label, busy, onFile }: Props) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };
  return (
    <label className={busy ? 'btn ghost file-btn is-busy' : 'btn ghost file-btn'}>
      {label}
      <input type="file" accept={CALENDAR.accept} onChange={handleChange} disabled={busy} />
    </label>
  );
};
