import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent, type SyntheticEvent } from 'react';
import { REMINDER_TEXTS as T } from '../config';
import type { RemindersApi } from '../types';
import { Checkbox } from './Checkbox';
import { Disclosure } from './Disclosure';

interface Props {
  api: RemindersApi;
  onClose: () => void;
}

/** Telegram reminders: consent and link, waiting for Start, active state, re-link. Esc and an outside click close it. */
export const RemindersDialog = ({ api, onClose }: Props) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [agreed, setAgreed] = useState(false);
  const [needConsent, setNeedConsent] = useState(false);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    return () => {
      if (dlg.open) dlg.close();
    };
  }, []);

  const handleBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target !== ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose();
  };

  const handleCancel = (e: SyntheticEvent<HTMLDialogElement>) => {
    e.preventDefault();
    onClose();
  };

  const handleAgreeChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAgreed(e.target.checked);
    if (e.target.checked) setNeedConsent(false);
  };

  const handleConnect = () => {
    if (!agreed) {
      setNeedConsent(true);
      return;
    }
    void api.start();
  };

  const handleDisable = () => void api.disable();

  const handleCancelLink = async () => {
    await api.disable();
    onClose();
  };

  const { state } = api;
  const showConnect = state === 'none' || state === 'paused' || state === 'unknown' || state === 'unavailable';

  return (
    <dialog ref={ref} className="confirm reminders" aria-labelledby="remindersTitle" onClick={handleBackdropClick} onCancel={handleCancel}>
      <h2 id="remindersTitle">{state === 'active' ? T.activeTitle : state === 'pending' ? T.pendingTitle : state === 'paused' ? T.pausedTitle : T.title}</h2>

      {state === 'active' && <p>{T.activeText}</p>}

      {state === 'paused' && <p>{T.pausedText}</p>}

      {state === 'pending' && (
        <>
          <p>{T.pendingText}</p>
          <a className="btn primary open-bot" href={api.botUrl} target="_blank" rel="noopener noreferrer">
            {T.openBot}
          </a>
          <p className="waiting">
            <span className="spinner small" aria-hidden="true" /> {T.waiting}
          </p>
        </>
      )}

      {showConnect && (
        <>
          <p>{T.intro}</p>
          <p>{T.consentShort}</p>
          <Disclosure summary={T.moreInfo}>
            <p className="more-info-text">{T.consentDetails}</p>
          </Disclosure>
          <Checkbox label={T.consentCheck} checked={agreed} onChange={handleAgreeChange} />
          {needConsent && (
            <p className="error" role="alert">
              {T.consentRequired}
            </p>
          )}
        </>
      )}

      {api.error && (
        <p className="error" role="alert">
          {api.error}
        </p>
      )}

      <div className="row">
        {state === 'pending' && (
          <button type="button" className="btn" onClick={handleCancelLink} disabled={api.busy}>
            {T.cancel}
          </button>
        )}
        {state === 'active' && (
          <button type="button" className="btn danger" onClick={handleDisable} disabled={api.busy}>
            {api.busy ? T.disabling : T.disable}
          </button>
        )}
        {showConnect && (
          <button type="button" className="btn primary" onClick={handleConnect} disabled={api.busy}>
            {api.busy ? T.connecting : T.connect}
          </button>
        )}
        {state !== 'pending' && (
          <button type="button" className="btn" onClick={onClose}>
            {T.close}
          </button>
        )}
      </div>
    </dialog>
  );
};
