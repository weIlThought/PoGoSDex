(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const $err = () => qs('#loginError');

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { error: text || 'Request failed' };
    }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || 'Login fehlgeschlagen';
      const code = data && data.code;
      const err = new Error(msg);
      err.code = code;
      throw err;
    }
    return data || {};
  }

  window.addEventListener('DOMContentLoaded', () => {
    const form = qs('#loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $err();
      if (err) {
        err.hidden = true;
        err.textContent = '';
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn && ((submitBtn.disabled = true), (submitBtn.textContent = 'Einloggen…'));
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      try {
        await postJson('/admin/login', payload);
        location.href = '/admin.html';
      } catch (e) {
        if (err) {
          err.hidden = false;
          if (e.code === 'USER_NOT_FOUND') err.textContent = 'Benutzername existiert nicht.';
          else if (e.code === 'INVALID_PASSWORD') err.textContent = 'Passwort ist falsch.';
          else if (e.code === 'DB_UNAVAILABLE')
            err.textContent =
              'Login derzeit nicht möglich (Datenbank). Bitte später erneut versuchen.';
          else if (e.code === 'PASSWORD_HASH_INVALID')
            err.textContent = 'Login-Konfiguration fehlerhaft. Bitte den Betreiber kontaktieren.';
          else err.textContent = 'Login fehlgeschlagen. Bitte später erneut versuchen.';
        }
      } finally {
        submitBtn && ((submitBtn.disabled = false), (submitBtn.textContent = 'Einloggen'));
      }
    });

    // Passwort anzeigen Umschalter
    const pwd = form.querySelector('input[name="password"]');
    const toggle = qs('#togglePassword');
    if (pwd && toggle) {
      toggle.addEventListener('change', () => {
        pwd.type = toggle.checked ? 'text' : 'password';
      });
    }
  });
})();
