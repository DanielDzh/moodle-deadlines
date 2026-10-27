import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

/** A styled checkbox. The real input stays in the DOM (keyboard, forms, screen readers); only its look is custom. */
export const Checkbox = ({ label, ...input }: Props) => (
  <label className="cbx">
    <input type="checkbox" {...input} />
    <span className="cbx-box" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="M3.5 8.5l3 3 6-7" />
      </svg>
    </span>
    <span>{label}</span>
  </label>
);
