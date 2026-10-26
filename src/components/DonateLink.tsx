import { DONATE_HREF, DONATE_LABEL } from '../config';

/**
 * Support link with a beating heart. Renders nothing when the config has no URL.
 * icon — heart only (header), pill — heart with a label (loading screen).
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
