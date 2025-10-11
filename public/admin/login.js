document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("discordLoginBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const params = new URLSearchParams(window.location.search);
    const lang =
      params.get("lang") ||
      localStorage.getItem("lang") ||
      (navigator.language || "en").slice(0, 2);
    window.location.href = `/api/auth/discord?lang=${encodeURIComponent(lang)}`;
  });
});
