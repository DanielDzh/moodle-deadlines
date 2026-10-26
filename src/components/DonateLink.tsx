import { DONATE_HREF, DONATE_LABEL } from '../config';

/**
 * Посилання на підтримку проєкту із серцем, що б'ється. Без адреси в конфігу нічого не показує.
 * icon — лише серце (для шапки), pill — серце з підписом (для екрана завантаження).
 */
export const DonateLink = ({ variant }: { variant: 'icon' | 'pill' }) => {
  if (!DONATE_HREF) return null;
  const icon = variant === 'icon';
  return (
    <a
      className={icon ? 'donate icon' : 'donate'}
      href={DONATE_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={icon ? DONATE_LABEL : undefined}
      title={DONATE_LABEL}
    >
      <span className="beat" aria-hidden="true">
        ♥
      </span>
      {icon ? <span className="label">{DONATE_LABEL}</span> : DONATE_LABEL}
    </a>
  );
};
