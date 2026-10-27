import { useId, useState, type ReactNode } from 'react';

interface Props {
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A "show more" block that opens and closes smoothly. The hidden content is inert,
 * so its fields cannot be focused while collapsed, but they stay in the DOM and in form data.
 */
export const Disclosure = ({ summary, defaultOpen = false, children }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const toggle = () => setOpen((value) => !value);

  return (
    <div className={open ? 'disclosure open' : 'disclosure'}>
      <button type="button" className="disclosure-toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
        <span className="chev" aria-hidden="true" />
        {summary}
      </button>
      <div id={bodyId} className="disclosure-body" inert={!open}>
        <div className="disclosure-inner">{children}</div>
      </div>
    </div>
  );
};
