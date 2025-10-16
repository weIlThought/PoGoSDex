document.addEventListener("DOMContentLoaded", function () {
  const tabBtns = Array.from(document.querySelectorAll("[data-pgsharp-tab]"));
  const tabContents = Array.from(
    document.querySelectorAll("[data-pgsharp-content]")
  );
  let active = "faq";
  function activate(tab) {
    tabBtns.forEach((btn) => {
      btn.classList.toggle("bg-emerald-400", btn.dataset.pgsharpTab === tab);
      btn.classList.toggle("text-slate-900", btn.dataset.pgsharpTab === tab);
      btn.setAttribute(
        "aria-selected",
        btn.dataset.pgsharpTab === tab ? "true" : "false"
      );
    });
    tabContents.forEach((content) => {
      if (content.dataset.pgsharpContent === tab) {
        content.classList.add("active");
        content.classList.remove("fade");
      } else {
        content.classList.remove("active");
        content.classList.add("fade");
      }
    });
    active = tab;
  }
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.pgsharpTab));
  });
  // Initial
  activate(active);
});
