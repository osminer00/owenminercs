(function () {
  const bar = document.getElementById("read-progress");
  function onScroll() {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const max = doc.scrollHeight - doc.clientHeight;
    const p = max > 0 ? (scrollTop / max) * 100 : 0;
    bar.style.width = p + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const floatWrap = document.getElementById("floating-toc");
  const btn = document.getElementById("toc-toggle");
  const panel = document.getElementById("toc-panel");
  floatWrap.hidden = false;
  btn.addEventListener("click", () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  });

  document.getElementById("invert-btn").addEventListener("click", () => {
    document.body.classList.toggle("invert");
  });
})();
