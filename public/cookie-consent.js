(function () {
  const consentKey = "pgconsent";
  const consent = localStorage.getItem(consentKey);
  const banner = document.createElement("div");
  banner.className =
    "fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 p-4 flex flex-col sm:flex-row items-center justify-between text-sm text-slate-200 z-50";
  banner.innerHTML = `
    <div class="mb-2 sm:mb-0">
      We use cookies for analytics and ads (Google AdSense). Do you accept?
    </div>
    <div class="flex gap-2">
      <button id="acceptCookies" class="bg-sky-500 text-slate-900 px-3 py-1 rounded">Accept</button>
      <button id="declineCookies" class="bg-slate-700 px-3 py-1 rounded">Decline</button>
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

  banner.querySelector("#acceptCookies").onclick = () => {
    localStorage.setItem(consentKey, "true");
    enableAds();
    banner.remove();
  };
  banner.querySelector("#declineCookies").onclick = () => {
    localStorage.setItem(consentKey, "false");
    banner.remove();
  };
})();
