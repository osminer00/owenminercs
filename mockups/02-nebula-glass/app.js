(function () {
  const glow = document.getElementById("cursor-glow");
  window.addEventListener("mousemove", (e) => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
  });

  const quotes = [
    "This website was made to hopefully inspire some fellow computer nerds and build a community around the things I love.",
    "I love all things computers, tearing apart my first one at 12 years old, and building my first gaming pc at 13.",
    "While at DMACC I learned how to write software using Java, C++, C#, Python, HTML/CSS/Javascript, SQL, PL/SQL and more.",
    "Also a huge fan of the game Counter-Strike, loved it for nearly 10 years!",
    "Feel free to message me on any social media platform if you have any questions or comments!",
    "Thanks For Stopping By!",
  ];
  const el = document.getElementById("rotating-quote");
  let i = 0;
  function show() {
    el.textContent = "“" + quotes[i] + "”";
  }
  show();
  document.getElementById("spin-quote").addEventListener("click", () => {
    i = (i + 1) % quotes.length;
    show();
  });

  const focusBtn = document.getElementById("focus-toggle");
  focusBtn.addEventListener("click", () => {
    const on = !document.body.classList.contains("focus-mode");
    document.body.classList.toggle("focus-mode", on);
    focusBtn.setAttribute("aria-pressed", String(on));
  });

  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const rx = (y / r.height - 0.5) * -6;
      const ry = (x / r.width - 0.5) * 8;
      card.style.transform = "perspective(900px) rotateX(" + rx + "deg) rotateY(" + ry + "deg)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
})();
