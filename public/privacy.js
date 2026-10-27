// The "do not count me" switch on the privacy page. The site reads the same localStorage flag before it sends anything.
(() => {
  const KEY = 'md.noStats';
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) === true;
    } catch {
      return false;
    }
  };
  const write = (off) => {
    try {
      if (off) localStorage.setItem(KEY, 'true');
      else localStorage.removeItem(KEY);
    } catch {
      /* storage unavailable: nothing is stored, so nothing is counted either way */
    }
  };

  const button = document.getElementById('stats-toggle');
  const status = document.getElementById('stats-status');
  if (!button || !status) return;
  const browserOptOut = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;

  const render = () => {
    const off = read();
    status.textContent = browserOptOut ? 'Ваш браузер просить не відстежувати, тож вас не рахують.' : off ? 'Зараз вас не рахують.' : 'Зараз вас рахують знеособлено.';
    button.textContent = off ? 'Знову рахувати мене' : 'Не рахувати мене';
    button.hidden = browserOptOut;
  };
  button.addEventListener('click', () => {
    write(!read());
    render();
  });
  render();
})();
