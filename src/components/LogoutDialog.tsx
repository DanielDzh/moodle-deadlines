import { useEffect, useRef, type MouseEvent } from 'react';
import { REMINDER_TEXTS } from '../config';

interface Props {
  /** Telegram reminders are on or being linked: logging out also turns them off. */
  remindersOn: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Logout confirmation. Esc and a click outside the dialog only close it. */
export function LogoutDialog({ remindersOn, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Callbacks via ref: the dialog opens once even if the page re-renders during a data refresh.
  const actions = useRef({ onConfirm, onClose });
  actions.current = { onConfirm, onClose };

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
      dlg.querySelector<HTMLButtonElement>('[data-act=cancel]')?.focus();
    } else if (window.confirm('Вийти з акаунта? Токен і збережені завдання буде видалено з цього браузера.')) {
      actions.current.onConfirm();
    } else {
      actions.current.onClose();
    }
    return () => {
      if (dlg.open) dlg.close();
    };
  }, []);

  function onBackdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target !== ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) onClose();
  }

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="logoutTitle"
      onClick={onBackdropClick}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2 id="logoutTitle">Вийти з акаунта?</h2>
      <p>
        Токен доступу і збережені завдання буде видалено з цього браузера. Щоб знову побачити завдання, доведеться
        ввести логін і пароль.
      </p>
      <p>Позначки «виконано» лишаться.</p>
      {remindersOn && <p className="warn-note">{REMINDER_TEXTS.logoutNote}</p>}
      <div className="row">
        <button type="button" className="btn" data-act="cancel" onClick={onClose}>
          Скасувати
        </button>
        <button type="button" className="btn danger" onClick={onConfirm}>
          Вийти
        </button>
      </div>
    </dialog>
  );
}
