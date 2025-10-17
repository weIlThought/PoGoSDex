document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("contact-form");
  const containerSelector = "#turnstile-container";

  const container = document.querySelector(containerSelector);
  const siteKey = container?.dataset?.sitekey || null;
  if (!siteKey) {
    console.error("Turnstile: Kein siteKey in data-sitekey gefunden.");
    return;
  }

  function attachToken(token) {
    let input = form.querySelector('input[name="cf_turnstile_response"]');
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = "cf_turnstile_response";
      form.appendChild(input);
    }
    input.value = token;
  }

  function renderWidget() {
    if (typeof turnstile === "undefined") return;
    turnstile.render(containerSelector, {
      sitekey: siteKey,
      callback: attachToken,
      "error-callback": () => console.warn("Turnstile error"),
    });
  }

  if (window.turnstile) {
    renderWidget();
  } else {
    window.addEventListener("load", renderWidget);
  }

  // Optional: Absenden verhindern, wenn kein Token vorhanden
  form.addEventListener("submit", function (e) {
    const token = form.querySelector(
      'input[name="cf_turnstile_response"]'
    )?.value;
    if (!token) {
      e.preventDefault();
      alert("Bitte die Challenge lösen!");
    }
  });
});
