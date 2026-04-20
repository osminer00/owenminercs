/**
 * One-off generator: dedupe URLs and emit items.json skeleton.
 * Run: node generate-items.mjs
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const RAW = `
https://us.govee.com/products/led-edison-bulb
https://us.govee.com/products/goveelife-door-and-window-sensor
https://us.govee.com/products/refurbished-goveelife-smart-mini-double-button-switch?currency=USD&variant=44675158409401
https://us.govee.com/products/goveelife-wireless-mini-smart-6-button-sensor
https://www.amazon.com/dp/B0GL8TH2R7
https://www.bestbuy.com/product/elgato-stream-deck-studio-controller-with-customizable-touch-strip-and-dials-black/J39QHT7G34
https://www.bestbuy.com/product/saramonic-blink-500-b2-2-person-wireless-mic-system-w-device-mount-receiver-3-5mm-usb-c-lightning-outs-black/CZTWYLH59S
https://www.bestbuy.com/product/logitech-c920s-pro-1080-video-conferencing-streaming-and-gaming-webcam-with-privacy-shutter-black/J7H7ZYXLLL
https://www.aliexpress.com/item/3256809870472845.html
https://www.aliexpress.com/item/3256810279210396.html
https://www.aliexpress.com/item/3256810143112504.html
https://www.aliexpress.com/item/3256805701075747.html
https://www.aliexpress.com/item/3256806844906425.html
https://www.aliexpress.com/item/3256806164525757.html
https://www.aliexpress.com/item/3256804721241649.html
https://www.aliexpress.com/item/3256811400884070.html
https://www.aliexpress.com/store/1103222039
https://www.aliexpress.com/item/3256807407263384.html
https://www.aliexpress.com/item/3256806749351548.html
https://www.aliexpress.com/item/3256808874149632.html
https://www.aliexpress.com/item/3256807142546249.html
https://www.aliexpress.com/item/3256810219680306.html
https://www.aliexpress.com/item/3256808077683445.html
https://www.aliexpress.com/item/3256806094500665.html
https://www.aliexpress.com/item/3256808754280356.html
https://www.aliexpress.com/item/3256804319675681.html
https://www.aliexpress.com/item/3256810157103603.html
https://www.aliexpress.com/item/3256807597275944.html
https://www.aliexpress.com/item/3256808329383637.html
https://www.aliexpress.com/item/3256809165669115.html
https://www.aliexpress.com/item/3256808768843321.html
https://www.aliexpress.com/item/3256808137109209.html
https://www.aliexpress.com/item/3256807637600657.html
https://www.aliexpress.com/item/3256805863239532.html
https://www.aliexpress.com/item/3256807801377850.html
https://www.aliexpress.com/item/3256809198069962.html
https://www.aliexpress.com/item/3256807843850234.html
https://www.aliexpress.com/item/3256806990755550.html
https://www.aliexpress.com/item/3256805930993857.html
https://www.aliexpress.com/item/3256807801307230.html
https://www.aliexpress.com/item/3256807838268274.html
https://www.aliexpress.com/item/3256805058104938.html
https://www.aliexpress.com/item/3256807159255537.html
https://www.aliexpress.com/item/3256807900301183.html
https://www.aliexpress.com/item/3256806486947881.html
https://www.aliexpress.com/item/3256805726692665.html
https://www.aliexpress.com/item/3256807896450245.html
https://www.aliexpress.com/item/3256806908280445.html
https://www.aliexpress.com/item/3256808052181733.html
https://www.aliexpress.com/item/3256808061725240.html
https://www.aliexpress.com/item/3256802197139244.html
https://www.aliexpress.com/item/3256805263205755.html
https://www.aliexpress.com/item/3256806001183883.html
https://www.aliexpress.com/item/3256805024307547.html
https://www.aliexpress.com/item/3256802545620076.html
https://www.aliexpress.com/item/3256805158305721.html
https://www.aliexpress.com/item/3256807990558417.html
https://www.aliexpress.com/item/3256807963434396.html
https://www.aliexpress.com/item/3256807964717233.html
https://www.aliexpress.com/item/3256807965127361.html
https://www.aliexpress.com/item/3256807292024821.html
https://www.aliexpress.com/item/3256807990423592.html
https://www.newegg.com/asus-pg27aqdp-27-qhd-480-hz-rog-swift-oled-black/p/N82E16824281326
https://www.newegg.com/p/1W7-00BS-00058?Item=9SIAFSTGW68383
`;

const AMAZON_ASINS = [
  "B0GL8TH2R7", "B0G8ZYKW62", "B081W8MDZP", "B0CXPFXF5Z", "B079C4B8V8", "B07919W2C4", "B086D7SX8K",
  "B0GCLLTPSG", "B0F5BRFLSF", "B011CBJGZK", "B0DJQRNFN4", "B0C89LS7N2", "B0CT2Z6H2Z", "B0GCMZ85Y3",
  "B089MGNQXF", "B0CN427VBX", "B09M3NGXL6", "B087T4T8D5", "B0F7RDJ7XW", "B0F7R91VX3", "B0FJD3TBQS",
  "B0G2L14HX9", "B0F4W99J46", "B09FB2BVB3", "B0FN3VQCL2", "B0FTXG8837", "B08ZHLBLR3", "B08FBFD7R1",
  "B0FBWWX4T1", "B0BFD4MMW8", "B08ZCB666K", "B08P3JZT9Z", "B075NYWF5P", "B0FNR8KM58", "B0DPHLH3G5",
  "B013JWPW0S", "B0DYCN3G9W", "B0CYM62YNZ", "B0F59BSK6K", "B0F65PQRFW", "B0CG8ZTJ4V", "B076XDRNWH",
  "B0DXQTDYFC", "B0DFSHLGJX", "B07H8WGW3M", "B0CRNSH6TB", "B0BG63SC5G", "B08VFY8THD", "B0C5RW8L4N",
  "B00028AX6G", "B08LDFR7RP", "B00FQKI3W6", "B09M5PXJ86", "B09V4L21G6", "B07N14TBT6", "B0C5RT7SYQ",
  "B0B5VHRX7F", "B07XKBJWKH", "B07H3S3PTN", "B0BD766R7P", "B082SVFWCS", "B07S2T6D71", "B07VVJZJ2P",
  "B08F24RR3G", "B01N1UX8RW",
];

function cleanUrl(u) {
  try {
    const url = new URL(u.trim());
    if (url.hostname.includes("amazon.com")) {
      const m = url.pathname.match(/\/dp\/([A-Z0-9]{10})/i);
      if (m) return `https://www.amazon.com/dp/${m[1].toUpperCase()}`;
    }
    if (url.hostname.includes("aliexpress.com")) {
      if (url.pathname.includes("/item/")) {
        const im = url.pathname.match(/\/item\/(\d+)\.html/i);
        if (im) return `https://www.aliexpress.com/item/${im[1]}.html`;
      }
      return url.origin + url.pathname;
    }
    if (url.hostname.includes("govee.com")) {
      return url.origin + url.pathname;
    }
    return url.href.split("?")[0];
  } catch {
    return u.trim();
  }
}

function amazonAffiliate(asin, tag) {
  return `https://www.amazon.com/dp/${asin}?tag=${tag}`;
}

function slugId(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

const seen = new Set();
const items = [];
let n = 0;

function addItem(partial) {
  const key = partial.dedupeKey || partial.id;
  if (seen.has(key)) return;
  seen.add(key);
  items.push({
    id: partial.id,
    category: partial.category || "misc",
    title: partial.title,
    brand: partial.brand || null,
    specs: partial.specs || [],
    notesPlaceholder: partial.notesPlaceholder || "",
    sourceUrls: partial.sourceUrls || [],
    affiliateHints: partial.affiliateHints || {},
    media: partial.media || { type: "none" },
    relatedIds: partial.relatedIds || [],
  });
}

// Named products (no URL)
addItem({
  id: "rode-streamer-x",
  dedupeKey: "rode-streamer-x",
  category: "audio",
  title: "RØDE Streamer X",
  brand: "RØDE",
  specs: ["Audio interface + video capture", "XLR & line inputs", "USB-C"],
  notesPlaceholder: "Your review / use case…",
  sourceUrls: [],
  affiliateHints: { amazonSearch: "https://www.amazon.com/s?k=Rode+StreamerX&tag=owenminercs-20" },
});
addItem({
  id: "logitech-pro-x-superlight-red",
  dedupeKey: "logitech-pro-x-superlight-red",
  category: "peripherals",
  title: "Logitech PRO X SUPERLIGHT (Red)",
  brand: "Logitech",
  specs: ["HERO 25K sensor", "Wireless", "Ultra-light"],
  notesPlaceholder: "",
  sourceUrls: [],
  affiliateHints: { amazonSearch: "https://www.amazon.com/s?k=Logitech+PRO+X+SUPERLIGHT+red&tag=owenminercs-20" },
});
addItem({
  id: "corsair-xtm70",
  dedupeKey: "corsair-xtm70",
  category: "pc",
  title: "CORSAIR XTM70 Thermal Paste",
  brand: "CORSAIR",
  specs: ["High-performance paste", "Typ. retail ~3 g syringe (verify listing)"],
  notesPlaceholder: "",
  sourceUrls: [],
  affiliateHints: { amazonSearch: "https://www.amazon.com/s?k=CORSAIR+XTM70+thermal+paste&tag=owenminercs-20" },
});
addItem({
  id: "insignia-dp-hdmi-adapter",
  dedupeKey: "insignia-dp-hdmi-adapter",
  category: "cables",
  title: "Insignia DisplayPort to HDMI Adapter",
  brand: "Insignia",
  specs: ["Passive/Active per SKU — verify on Best Buy", "4K support varies by model"],
  notesPlaceholder: "Cord length / max resolution once you confirm SKU…",
  sourceUrls: [],
  affiliateHints: { bestbuySearch: "https://www.bestbuy.com/site/searchpage.jsp?st=insignia+displayport+hdmi+adapter" },
});

// Needs link
const needsLink = [
  { id: "csgo-knife-plush-charm", title: "CSGO Knife Plush Backpack Charm (Perfect World eSports)", brand: "Perfect World eSports", specs: ["Plush / charm — find current listing"], notesPlaceholder: "User pasted wrong retailer link for Xbox adapter; this item needs a fresh URL." },
  { id: "govee-e12-6pack-h600b", title: "Govee E12 6-Pack Smart LED Bulbs (H600B)", brand: "Govee", specs: ["E12 base", "Alexa & Google compatible (per product line)"], notesPlaceholder: "" },
  { id: "elgato-key-light-pair-no-stands", title: "Elgato Key Light (pair, no stands, used)", brand: "Elgato", specs: ["Used / no stands — not a standard retail SKU"], notesPlaceholder: "" },
  { id: "elgato-cam-link-4k-used", title: "Elgato Cam Link 4K (20GAM9901, used, no box)", brand: "Elgato", specs: ["USB 3.0", "Up to 4K30 capture (spec per Elgato)"], notesPlaceholder: "" },
  { id: "fitbit-inspire-3-used", title: "Fitbit Inspire 3 (FB424BK, used)", brand: "Fitbit", specs: ["Activity tracker"], notesPlaceholder: "" },
  { id: "cs2-shanghai-major-pin-box", title: "CS2 Perfect World Shanghai Major Weapon Pin Box (8-pack)", brand: "Valve / Perfect World", specs: ["Collectible pins — verify seller"], notesPlaceholder: "" },
  { id: "xbox-wireless-adapter-windows", title: "Microsoft Xbox Wireless Adapter for Windows 10 (Series X|S / One)", brand: "Microsoft", specs: ["USB-A dongle", "Low-latency wireless for Xbox controllers"], notesPlaceholder: "Your list pointed at a Govee URL by mistake — use Microsoft store or Amazon search." },
];
for (const nl of needsLink) {
  addItem({
    ...nl,
    dedupeKey: nl.id,
    category: "needs-link",
    sourceUrls: [],
    affiliateHints: {
      amazonSearch: "https://www.amazon.com/s?k=" + encodeURIComponent(nl.title) + "&tag=owenminercs-20",
    },
  });
}

// Old PC parts
const oldParts = [
  { id: "old-nzxt-phantom-white", title: "NZXT Phantom PHAN-001WT Full Tower", brand: "NZXT", specs: ["ATX full tower", "Steel/plastic", "Legacy build"] },
  { id: "old-liteon-dvd-sata", title: "LITE-ON iHAS124-04 DVD Burner (SATA)", brand: "LITE-ON", specs: ["SATA", "5.25\" ODD"] },
  { id: "old-wd-blue-1tb-m2", title: "WD Blue 3D NAND 1TB M.2 2280 SATA (WDS100T2B0B)", brand: "Western Digital", specs: ["1 TB", "SATA III", "M.2 2280"] },
  { id: "old-omni-gear-dp-hdmi-6ft", title: "Omni Gear DP-6-HDMI 6 ft DisplayPort to HDMI", brand: "Omni Gear", specs: ["6 ft", "Male-male", "DP to HDMI"] },
  { id: "old-corsair-vengeance-rgb-16gb", title: "CORSAIR Vengeance RGB Pro 16GB (2×8) DDR4-3200", brand: "CORSAIR", specs: ["DDR4-3200", "CL16", "CMW16GX4M2C3200C16"] },
  { id: "old-asus-b550f-wifi", title: "ASUS ROG Strix B550-F Gaming WiFi", brand: "ASUS", specs: ["AM4", "PCIe 4.0", "WiFi 6", "2.5Gb LAN"] },
  { id: "old-ryzen-3800x", title: "AMD Ryzen 7 3800X", brand: "AMD", specs: ["8C/16T", "Zen 2", "AM4", "105W"] },
  { id: "old-gigabyte-rtx2070s", title: "GIGABYTE GeForce RTX 2070 SUPER Gaming OC 8G", brand: "GIGABYTE", specs: ["8 GB GDDR6", "Triple fan", "GV-N207SGAMING OC-8GD"] },
];
for (const p of oldParts) {
  addItem({
    ...p,
    dedupeKey: p.id,
    category: "legacy-pc",
    notesPlaceholder: "E-waste / spare / sold?",
    sourceUrls: [],
    affiliateHints: { amazonSearch: "https://www.amazon.com/s?k=" + encodeURIComponent(p.title) + "&tag=owenminercs-20" },
  });
}

// Govee (manual titles from product pages where fetched)
const goveeMeta = {
  "led-edison-bulb": {
    title: "Govee E26 Smart Edison Light Bulb 500lm",
    brand: "Govee",
    specs: ["Model H14C0", "500 lm", "CCT 2700–6500K", "Matter, Alexa, Google, SmartThings"],
  },
  "goveelife-door-and-window-sensor": {
    title: "GoveeLife Door and Window Sensor",
    brand: "GoveeLife",
    specs: ["Contact sensor", "App alerts", "Works with Govee ecosystem"],
  },
  "refurbished-goveelife-smart-mini-double-button-switch": {
    title: "GoveeLife Smart Mini Double Button Switch (refurbished)",
    brand: "GoveeLife",
    specs: ["Smart button / switch", "Refurb SKU — verify variant"],
  },
  "goveelife-wireless-mini-smart-6-button-sensor": {
    title: "GoveeLife Wireless Mini Smart 6-Button Sensor",
    brand: "GoveeLife",
    specs: ["Six programmable actions", "Wireless"],
  },
};

for (const line of RAW.split("\n")) {
  const t = line.trim();
  if (!t || !t.startsWith("http")) continue;
  const cleaned = cleanUrl(t);
  if (seen.has(cleaned)) continue;
  if (t.includes("amazon.com")) continue;

  if (t.includes("govee.com")) {
    const slug = new URL(t).pathname.replace(/^\/?products\//, "").split("?")[0];
    const meta = goveeMeta[slug] || {
      title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      brand: "Govee",
      specs: [],
    };
    addItem({
      id: "govee-" + slugId(slug.split("?")[0]),
      dedupeKey: cleaned,
      category: "smart-home",
      title: meta.title,
      brand: meta.brand,
      specs: meta.specs,
      sourceUrls: [cleaned],
      affiliateHints: { govee: cleaned, note: "Add Govee ambassador / referral if enrolled." },
    });
    continue;
  }

  if (t.includes("bestbuy.com")) {
    const sku = (t.match(/\/([A-Z0-9]{10,12})(?:\.|$)/i) || [])[1] || slugId(cleaned);
    const bbKnown = {
      J39QHT7G34: {
        title: "Elgato Stream Deck Studio",
        brand: "Elgato",
        specs: ["Customizable touch strip & dials", "USB — verify power requirements on listing"],
      },
      CZTWYLH59S: {
        title: "Saramonic Blink 500 B2 (2-person wireless)",
        brand: "Saramonic",
        specs: ["2.4 GHz dual TX", "3.5 mm / USB-C / Lightning outs (per kit)"],
      },
      J7H7ZYXLLL: {
        title: "Logitech C920s Pro HD Webcam",
        brand: "Logitech",
        specs: ["1080p30", "Stereo mics", "Privacy shutter"],
      },
    };
    const meta = bbKnown[sku] || {
      title: "Best Buy product " + sku,
      brand: null,
      specs: ["Open listing for full specs"],
    };
    addItem({
      id: "bestbuy-" + slugId(sku),
      dedupeKey: cleaned,
      category: "retail",
      title: meta.title,
      brand: meta.brand,
      specs: meta.specs,
      sourceUrls: [cleaned],
      affiliateHints: {
        bestbuy: cleaned,
        note: "Best Buy uses Impact/partner links — replace with your affiliate URL when approved.",
      },
    });
    continue;
  }

  if (t.includes("newegg.com")) {
    addItem({
      id: "newegg-" + slugId(cleaned),
      dedupeKey: cleaned,
      category: "pc",
      title: cleaned.includes("24281326") ? "ASUS ROG Swift OLED PG27AQDP" : "Newegg item",
      brand: cleaned.includes("24281326") ? "ASUS" : null,
      specs: cleaned.includes("24281326")
        ? ["27\"", "2560×1440", "480 Hz OLED", "0.03 ms (typ.)"]
        : ["Verify on Newegg"],
      sourceUrls: [cleaned],
      affiliateHints: {
        newegg: cleaned,
        note: "Newegg affiliate via Rakuten/commission — add tracked link from dashboard.",
      },
    });
    continue;
  }

  if (t.includes("aliexpress.com")) {
    const itemId = (cleaned.match(/item\/(\d+)/) || [])[1] || slugId(cleaned);
    const isStore = cleaned.includes("/store/");
    addItem({
      id: isStore ? "aliexpress-store-" + itemId : "aliexpress-" + itemId,
      dedupeKey: cleaned,
      category: isStore ? "aliexpress-store" : "aliexpress",
      title: isStore ? "AliExpress store " + itemId : "AliExpress item " + itemId,
      brand: null,
      specs: ["Open listing for title/specs — AliExpress pages change often"],
      sourceUrls: [cleaned],
      affiliateHints: {
        aliexpress: cleaned,
        note: "Convert via AliExpress Portals (s.click.aliexpress.com/...) with your PID.",
      },
    });
  }
}

for (const asin of AMAZON_ASINS) {
  const url = `https://www.amazon.com/dp/${asin}`;
  if (seen.has(url)) continue;
  seen.add(url);
  addItem({
    id: "amazon-" + asin.toLowerCase(),
    dedupeKey: url,
    category: "amazon",
    title: "Amazon " + asin,
    brand: null,
    specs: ["Open Amazon for title/specs — verify ASIN matches your purchase"],
    sourceUrls: [url],
    affiliateHints: { amazon: amazonAffiliate(asin, "owenminercs-20") },
  });
}

// Bundle: two AliExpress items that go together
const bundle = items.find((i) => i.id === "aliexpress-3256806486947881");
const bundleB = items.find((i) => i.id === "aliexpress-3256805726692665");
if (bundle && bundleB) {
  bundle.relatedIds = ["aliexpress-3256805726692665"];
  bundleB.relatedIds = ["aliexpress-3256806486947881"];
  bundle.title = "AliExpress bundle (6486947881 + 5726692665)";
  bundle.notesPlaceholder = "User noted these two listings go together.";
}

const out = {
  config: {
    amazonAssociatesTag: "owenminercs-20",
    disclosure:
      "DEV ONLY — not published. Affiliate placeholders: Amazon uses your Associates tag; AliExpress/Best Buy/Newegg need program-specific links.",
  },
  items,
};

writeFileSync(join(__dirname, "items.json"), JSON.stringify(out, null, 2), "utf8");
console.log("Wrote", items.length, "items");
