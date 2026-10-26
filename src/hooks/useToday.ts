import { useEffect, useState } from 'react';

/** Повертає ключ сьогоднішнього дня й оновлюється опівночі, щоб лічильники днів перерахувалися самі. */
export function useToday(): string {
  const [today, setToday] = useState(() => new Date().toDateString());
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date().toDateString();
      setToday((prev) => (prev === d ? prev : d));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}
