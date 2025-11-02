(() => {
  const qs = (s, r = document) => r.querySelector(s);
  const $err = () => qs('#loginError');

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
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
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      try {
        await postJson('/admin/login', payload);
        location.href = '/admin.html';
      } catch (e) {
        if (err) {
          err.hidden = false;
          err.textContent = 'Login fehlgeschlagen';
        }
      }
    });
  });
})();
