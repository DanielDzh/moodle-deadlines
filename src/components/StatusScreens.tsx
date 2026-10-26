export function LoadingScreen({ progress }: { progress: string }) {
  return (
    <main className="loading">
      <div className="spinner" aria-hidden="true" />
      <p role="status">{progress || 'Готую дані…'}</p>
    </main>
  );
}

export function ErrorScreen({ error, onRetry, onLogout }: { error: string; onRetry: () => void; onLogout: () => void }) {
  return (
    <main className="login">
      <h1 className="brand">Дедлайни</h1>
      <div className="panel">
        <div className="error" role="alert">
          {error}
        </div>
        <button className="btn primary" type="button" onClick={onRetry}>
          Спробувати ще раз
        </button>
        <button className="btn ghost" type="button" onClick={onLogout}>
          Вийти
        </button>
      </div>
    </main>
  );
}
