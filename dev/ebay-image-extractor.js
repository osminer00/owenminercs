// STEP 1 - Run this first to diagnose the DOM structure.
// Paste into console on https://www.ebay.com/sh/lst/active
// It will print the first 10 links and first 5 image srcs so we can build the right selectors.

(function () {
  const allLinks = [...document.querySelectorAll("a[href]")]
    .map(a => a.href)
    .filter(h => h.includes("ebay.com"))
    .slice(0, 20);

  console.log("=== LINKS ===");
  allLinks.forEach(h => console.log(h));

  const allImgs = [...document.querySelectorAll("img[src]")]
    .map(i => i.src)
    .filter(s => s.startsWith("http"))
    .slice(0, 10);

  console.log("=== IMAGES ===");
  allImgs.forEach(s => console.log(s));
})();
