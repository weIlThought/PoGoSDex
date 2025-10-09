(function () {
  const consentKey = "pgconsent";
  const langKey = "lang";
  const storedLang =
    localStorage.getItem(langKey) || (navigator.language || "en").slice(0, 2);
  const consent = localStorage.getItem(consentKey);

  async function getI18n(lang) {
    try {
      const res = await fetch(`/lang/${lang}.json`);
      if (!res.ok) throw new Error("lang not found");
      return await res.json();
    } catch (e) {
      return {};
    }
  }

  function t(i18n, key, fallback) {
    return (i18n && i18n[key]) || fallback || key;
  }

  (async () => {
    const i18n = await getI18n(storedLang);
    const banner = document.createElement("div");
    banner.className =
      "fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 p-4 flex flex-col sm:flex-row items-center justify-between text-sm text-slate-200 z-50";
    banner.innerHTML = `
      <div class="mb-2 sm:mb-0">${t(
        i18n,
        "cookie_question",
        "We use cookies for analytics and ads. Do you accept?"
      )}</div>
      <div class="flex gap-2">
        <button id="acceptCookies" class="bg-sky-500 text-slate-900 px-3 py-1 rounded">${t(
          i18n,
          "cookie_accept",
          "Accept"
        )}</button>
        <button id="declineCookies" class="bg-slate-700 px-3 py-1 rounded">${t(
          i18n,
          "cookie_decline",
          "Decline"
        )}</button>
      </div>`;
    if (!consent) document.body.appendChild(banner);

    function enableAds() {
      const adScript = document.createElement("script");
      adScript.async = true;
      adScript.src =
        "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX";
      adScript.crossOrigin = "anonymous";
      document.head.appendChild(adScript);
      document.querySelectorAll(".ad-placeholder").forEach((div) => {
        const ad = document.createElement("ins");
        ad.className = "adsbygoogle block";
        ad.style.display = "block";
        ad.setAttribute("data-ad-client", "ca-pub-XXXX");
        ad.setAttribute("data-ad-slot", div.dataset.slot || "0000000000");
        ad.setAttribute("data-ad-format", "auto");
        ad.setAttribute("data-full-width-responsive", "true");
        div.appendChild(ad);
        (adsbygoogle = window.adsbygoogle || []).push({});
      });
    }

    if (consent === "true") enableAds();

    banner.querySelector("#acceptCookies")?.addEventListener("click", () => {
      localStorage.setItem(consentKey, "true");
      enableAds();
      banner.remove();
    });
    banner.querySelector("#declineCookies")?.addEventListener("click", () => {
      localStorage.setItem(consentKey, "false");
      banner.remove();
    });
  })();
})();
