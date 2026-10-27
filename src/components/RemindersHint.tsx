import { REMINDERS_HINT } from '../config';

/** One-time "thought bubble" for new users. Placed inside the button's anchor, so it hangs under the button. */
export const RemindersHint = ({ onDismiss }: { onDismiss: () => void }) => (
  <aside className="rem-hint" role="note">
    <p>{REMINDERS_HINT.text}</p>
    <button type="button" className="rem-hint-close" onClick={onDismiss} aria-label={REMINDERS_HINT.dismiss} title={REMINDERS_HINT.dismiss}>
      ×
    </button>
  </aside>
);
