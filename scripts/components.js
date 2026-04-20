// Determine the base path to the root of the site by looking at this script's URL
const scriptUrl = document.querySelector('script[src*="components.js"]').src;
const siteRoot = scriptUrl.replace('scripts/components.js', '');

const THEME_STORAGE_KEY = 'owenminercs-theme';
const TEXT_ENTRY_SELECTOR =
  'textarea, input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"], input[type="tel"], input[type="number"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="time"], input[type="file"]';

/** Light mode uses a processed asset without the dark stippled outer fringe (see images/owenminercs-logo-light.png). */
function brandLogoFilename(theme) {
  return theme === 'light' ? 'owenminercs-logo-light.png' : 'owenminercs-logo.png';
}

function syncBrandLogosForTheme(theme) {
  const url = `${siteRoot}images/${brandLogoFilename(theme)}`;
  document.querySelectorAll('img.site-logo').forEach((img) => {
    img.src = url;
  });
}

function applyStoredTheme() {
  const root = document.documentElement;
  delete root.dataset.theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
  } catch (_) {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', '#050505');
  }
  syncBrandLogosForTheme('dark');
}

applyStoredTheme();

// Detect if running locally (Live Server, file://, etc.)
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';

function getLink(path) {
  if (path === "") return siteRoot;
  return siteRoot + path + (isLocal ? ".html" : "");
}

const DISCORD_INVITE_URL = 'https://discord.gg/fA9GbxmAge';

/* Brand mark paths from Simple Icons (CC0 1.0) — https://simpleicons.org/ — for compact header/footer nav only. */
const SOCIAL_ICON_PATHS = {
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  reddit: 'M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z',
  youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  instagram: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  tiktok: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  discord: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z'
};

function socialIconSvg(pathD) {
  return `<svg class="site-social-nav__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path fill="currentColor" d="${pathD}"/></svg>`;
}

function socialNavMarkup(extraClass) {
  const p = SOCIAL_ICON_PATHS;
  const cls = extraClass ? `site-social-nav ${extraClass}` : 'site-social-nav';
  return `
    <div class="${cls}" role="navigation" aria-label="External social profiles">
      <a class="site-social-nav__link" target="_blank" rel="noopener noreferrer" href="https://x.com/OwenMinerCS" title="X: @OwenMinerCS" aria-label="X (Twitter)">${socialIconSvg(p.x)}</a>
      <a class="site-social-nav__link" target="_blank" rel="noopener noreferrer" href="https://www.reddit.com/user/OwenMCS" title="Reddit: OwenMCS" aria-label="Reddit">${socialIconSvg(p.reddit)}</a>
      <a class="site-social-nav__link" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/@OwenMinerCS" title="YouTube: Owen Miner" aria-label="YouTube">${socialIconSvg(p.youtube)}</a>
      <a class="site-social-nav__link" target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/owenminercs/" title="Instagram: owenminercs" aria-label="Instagram">${socialIconSvg(p.instagram)}</a>
      <a class="site-social-nav__link" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/profile.php?id=100095719715453" title="Facebook: Owen Miner" aria-label="Facebook">${socialIconSvg(p.facebook)}</a>
      <a class="site-social-nav__link" target="_blank" rel="noopener noreferrer" href="https://www.tiktok.com/@owenminercs" title="TikTok: @owenminercs" aria-label="TikTok">${socialIconSvg(p.tiktok)}</a>
      <a class="site-social-nav__link" target="_blank" rel="noopener noreferrer" href="${DISCORD_INVITE_URL}" title="Discord: Owen M community" aria-label="Discord">${socialIconSvg(p.discord)}</a>
    </div>`;
}

function resolveActiveNavLink(scope) {
  const currentPath = window.location.pathname;
  const links = scope.querySelectorAll('nav a[data-nav]');
  let activeLink = null;
  if (currentPath.endsWith("/") || currentPath.endsWith("index.html")) {
    activeLink = scope.querySelector('a[data-nav="index.html"]');
  } else {
    for (const link of links) {
      const dataNav = link.getAttribute('data-nav');
      if (dataNav !== "index.html" && decodeURIComponent(window.location.pathname).includes(dataNav)) {
        activeLink = link;
        break;
      }
    }
  }
  if (!activeLink) {
    if (currentPath.includes("nosmoking") || currentPath.includes("/Counter-Strike/")) {
      activeLink = scope.querySelector('a[data-nav="Gaming"]');
    }
    if (!activeLink && (currentPath.includes("The%20Setup") || currentPath.includes("The Setup"))) {
      activeLink = scope.querySelector('a[data-nav="The Setup"]');
    }
    if (!activeLink && currentPath.includes("/Keyboard/") && currentPath.includes("60he")) {
      activeLink = scope.querySelector('a[data-nav="The Setup"]');
    }
    if (!activeLink && currentPath.includes("/PC/")) {
      activeLink = scope.querySelector('a[data-nav="The Setup"]');
    }
  }
  return activeLink;
}

function applyNavHighlight(scope) {
  const links = scope.querySelectorAll('nav a[data-nav]');
  links.forEach((link) => {
    link.classList.add('site-nav-link');
    link.classList.remove('site-nav-link--active');
  });
  const activeLink = resolveActiveNavLink(scope);
  if (activeLink) {
    activeLink.classList.add('site-nav-link--active');
  }
}

const LIVE_FALLBACK_URL = 'https://x.com/OwenMinerCS';
const LIVE_FALLBACK_LABEL = 'Follow for stream updates';
const LIVE_FALLBACK_TITLE = 'Follow @OwenMinerCS on X for stream updates';
const LIVE_NOW_LABEL = 'LIVE NOW';

function getLiveStatusEndpoint() {
  if (isLocal) return [];
  return [`${siteRoot}api/live-status`];
}

function applyLiveBadgeState(link, status) {
  if (!link) return;

  const isLive = Boolean(status && status.live);
  const targetUrl = typeof status?.url === 'string' && status.url.trim() ? status.url.trim() : LIVE_FALLBACK_URL;
  const labelText = isLive ? LIVE_NOW_LABEL : LIVE_FALLBACK_LABEL;
  const titleText = isLive
    ? `Owen Miner is live on ${status?.platform || 'stream'}`
    : LIVE_FALLBACK_TITLE;

  link.href = targetUrl;
  link.setAttribute('title', titleText);
  link.setAttribute('aria-label', titleText);
  link.classList.toggle('site-live-badge--live', isLive);
  link.classList.toggle('site-live-badge--offline', !isLive);
  link.querySelector('[data-live-label]').textContent = labelText;
  link.querySelector('[data-live-platform]').textContent = isLive ? (status?.platform || '') : '';
}

async function hydrateLiveBadge(root) {
  const badge = root.querySelector('[data-live-status-badge]');
  if (!badge) return;

  applyLiveBadgeState(badge, {
    live: false,
    platform: '',
    url: LIVE_FALLBACK_URL
  });

  try {
    const endpoints = getLiveStatusEndpoint();
    if (!endpoints.length) return;
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        headers: {
          Accept: 'application/json'
        }
      });
      if (!response.ok) continue;

      const payload = await response.json();
      if (!payload || typeof payload !== 'object') continue;

      applyLiveBadgeState(badge, {
        live: payload.live,
        platform: payload.platform,
        url: payload.url
      });
      return;
    }
  } catch (_) {
    // Keep fallback state if live endpoint is unavailable.
  }
}

class SharedHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="site-shared-header">
        <div class="header-plant-growth" aria-hidden="true">
          <div class="header-plant-growth__texture"></div>
          <div class="header-plant-growth__sprouts"></div>
        </div>
        <div class="site-shared-header__content">
          <div class="site-header-brand-row">
            <a href="${LIVE_FALLBACK_URL}" target="_blank" rel="noopener noreferrer" class="site-live-badge site-live-badge--offline" data-live-status-badge title="${LIVE_FALLBACK_TITLE}" aria-label="${LIVE_FALLBACK_TITLE}">
              <span class="site-live-badge__dot" aria-hidden="true"></span>
              <span class="site-live-badge__text" data-live-label>${LIVE_FALLBACK_LABEL}</span>
              <span class="site-live-badge__platform" data-live-platform></span>
            </a>
            <a href="${siteRoot}" class="site-logo-link site-logo-link--header site-logo-link--alive" title="owenminercs.com" aria-label="Home">
              <span class="site-logo-alive">
                <img class="site-logo site-logo--base" src="${siteRoot}images/${brandLogoFilename('dark')}" alt="owenminercs">
                <span class="site-logo-alive__parallax" aria-hidden="true">
                  <img class="site-logo site-logo--floater site-logo--floater-o" src="${siteRoot}images/${brandLogoFilename('dark')}" alt="">
                  <img class="site-logo site-logo--floater site-logo--floater-cs" src="${siteRoot}images/${brandLogoFilename('dark')}" alt="">
                </span>
                <div class="logo-rain-fx" aria-hidden="true"></div>
              </span>
            </a>
          </div>
          <nav>
            <ul>
              <li><a href="${siteRoot}" class="site-nav-link" data-nav="index.html">About</a></li>
              <li><a href="${getLink('The%20Setup/the-setup')}" class="site-nav-link" data-nav="The Setup">The Setup</a></li>
              <li><a href="${getLink('Gaming/gaming')}" class="site-nav-link" data-nav="Gaming" title="Gaming (Counter-Strike for now)">Gaming</a></li>
              <li><a href="${getLink('Services/services')}" class="site-nav-link" data-nav="Services">Services</a></li>
              <li><a href="${getLink('Photography/photography')}" class="site-nav-link" data-nav="Photography">Photography</a></li>
              <li><a href="${getLink('Upgrades/upgrades')}" class="site-nav-link" data-nav="Upgrades">Upgrades</a></li>
              <li><a href="${getLink('Donators/donators')}" class="site-nav-link" data-nav="Donators">Donators</a></li>
              <li><a href="${getLink('Garage%20Sale/garage-sale')}" class="site-nav-link" data-nav="Garage Sale">Garage Sale</a></li>
              <li><a href="${getLink('Help%20Wanted/help-wanted')}" class="site-nav-link" data-nav="Help Wanted">Help Wanted</a></li>
              <li><a href="${getLink('Socials/socials')}" class="site-nav-link" data-nav="Socials">Socials</a></li>
            </ul>
          </nav>
          <hr class="site-rule site-rule--flush">
          ${socialNavMarkup('site-social-nav--header')}
        </div>
        <hr class="site-rule site-rule--flush">
      </header>
    `;

    applyNavHighlight(this);
    hydrateLiveBadge(this);
  }
}

class SharedFooter extends HTMLElement {
  connectedCallback() {
	// For disclosures, some pages have custom text (like the apartment tour page specifying affiliate links).
	const customDisclosure = this.getAttribute('disclosure') || 
		"<i>This page has optional tip links (Ko-fi, StreamElements) and no paid shopping links. The Apartment tour, Keyboard, and PC pages include Amazon links where Owen Miner participates in the Amazon Associates Program. As an Amazon Associate I earn from qualifying purchases through eligible links on those pages.</i>";

    this.innerHTML = `
      <footer>
        <hr class="site-rule site-rule--spaced">
        <h4><a href="#top" class="site-footer-back-top">Back To Top</a></h4>
        <hr class="site-rule site-rule--spaced">
        
        <div>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="${siteRoot}" class="site-nav-link" data-nav="index.html">About</a></li>
              <li><a href="${getLink('The%20Setup/the-setup')}" class="site-nav-link" data-nav="The Setup">The Setup</a></li>
              <li><a href="${getLink('Gaming/gaming')}" class="site-nav-link" data-nav="Gaming">Gaming</a></li>
              <li><a href="${getLink('Services/services')}" class="site-nav-link" data-nav="Services">Services</a></li>
              <li><a href="${getLink('Photography/photography')}" class="site-nav-link" data-nav="Photography">Photography</a></li>
              <li><a href="${getLink('Upgrades/upgrades')}" class="site-nav-link" data-nav="Upgrades">Upgrades</a></li>
              <li><a href="${getLink('Donators/donators')}" class="site-nav-link" data-nav="Donators">Donators</a></li>
              <li><a href="${getLink('Garage%20Sale/garage-sale')}" class="site-nav-link" data-nav="Garage Sale">Garage Sale</a></li>
              <li><a href="${getLink('Help%20Wanted/help-wanted')}" class="site-nav-link" data-nav="Help Wanted">Help Wanted</a></li>
              <li><a href="${getLink('Socials/socials')}" class="site-nav-link" data-nav="Socials">Socials</a></li>
            </ul>
          </nav>
        </div>
        ${socialNavMarkup('site-social-nav--footer')}
        <p class="site-footer-bug-report">If you run into any problems on this website, report bugs in the <a href="${DISCORD_INVITE_URL}" target="_blank" rel="noopener noreferrer">Discord</a>.</p>
        <hr class="site-rule site-rule--spaced">
        <div>
          <h4 id="Disclosure" style="padding: 0; margin: 10px;"><span style="font-weight: bold;">Disclosure:</span> ${customDisclosure}</h4>
          <h4 style="text-transform: capitalize;">This website was created by Owen Miner</h4>
          <h4 style="font-weight: normal;">Feel free to use any photos on this page, with credit to <a href="${siteRoot}" class="site-logo-link site-logo-link--inline" title="owenminercs.com" aria-label="Home"><img class="site-logo site-logo--credit" src="${siteRoot}images/${brandLogoFilename('dark')}" alt="owenminercs"></a></h4>
          <p class="site-footer-logo"><a href="${siteRoot}" class="site-logo-link site-logo-link--footer" title="owenminercs.com" aria-label="Home"><img class="site-logo site-logo--footer" src="${siteRoot}images/${brandLogoFilename('dark')}" alt="owenminercs"></a></p>
        </div>  
        <hr class="site-rule site-rule--footer-end">
      </footer>
    `;

    applyNavHighlight(this);
  }
}

customElements.define('shared-header', SharedHeader);
customElements.define('shared-footer', SharedFooter);

function disableTextInputControls(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  root.querySelectorAll(TEXT_ENTRY_SELECTOR).forEach((el) => {
    if (el.dataset && el.dataset.inputDisabledForNow === '1') return;
    el.disabled = true;
    if ('readOnly' in el) el.readOnly = true;
    if (typeof el.placeholder === 'string') {
      el.placeholder = 'Temporarily disabled';
    }
    el.setAttribute('aria-disabled', 'true');
    if (el.dataset) el.dataset.inputDisabledForNow = '1';
  });

  root.querySelectorAll('[contenteditable=""], [contenteditable="true"]').forEach((el) => {
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('aria-disabled', 'true');
  });
}

function initTemporaryInputLockdown() {
  disableTextInputControls(document);
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      if (!(record.target instanceof Element)) return;
      disableTextInputControls(record.target);
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) disableTextInputControls(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

const WORD_GLOW_SKIP =
  'script, style, noscript, template, pre, code, textarea, kbd, samp, svg, math, [data-no-word-glow], .no-word-glow';

function collectWordGlowTextNodes(root) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !/\S/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      /* Header/footer nav pills use their own border + outer glow — no per-word highlight */
      if (p.closest('.site-nav-link')) return NodeFilter.FILTER_REJECT;
      if (p.closest(WORD_GLOW_SKIP)) return NodeFilter.FILTER_REJECT;
      if (p.classList?.contains('text-word-glow')) return NodeFilter.FILTER_REJECT;
      if (p.closest('.text-word-glow--line')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) out.push(n);
  return out;
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function isShortFormIframeSrc(rawSrc, iframeEl) {
  if (!rawSrc) return false;
  const markerText = `${iframeEl?.className || ''} ${iframeEl?.title || ''}`.toLowerCase();
  const hasShortMarker =
    iframeEl?.dataset?.shortForm === '1' ||
    markerText.includes('short') ||
    markerText.includes('reel') ||
    markerText.includes('tiktok');
  const attrWidth = Number.parseInt(String(iframeEl?.getAttribute?.('width') || ''), 10);
  const attrHeight = Number.parseInt(String(iframeEl?.getAttribute?.('height') || ''), 10);
  const looksPortrait = Number.isFinite(attrWidth) && Number.isFinite(attrHeight) && attrWidth > 0 && attrHeight > attrWidth;
  try {
    const parsed = new URL(rawSrc, window.location.origin);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const shortsFlag = parsed.searchParams.get('shorts');
    if (host.includes('tiktok.com')) return true;
    if (host.includes('instagram.com') && (path.includes('/reel/') || path.includes('/reels/'))) return true;
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return path.includes('/shorts/') || shortsFlag === '1' || (path.includes('/embed/') && (hasShortMarker || looksPortrait));
    }
  } catch (_) {
    const fallback = String(rawSrc).toLowerCase();
    if (fallback.includes('tiktok.com')) return true;
    if (fallback.includes('instagram.com/reel') || fallback.includes('instagram.com/reels')) return true;
    if (fallback.includes('youtube.com/shorts/') || fallback.includes('shorts=1')) return true;
    if (fallback.includes('youtube.com/embed/') && (hasShortMarker || looksPortrait)) return true;
  }
  return false;
}

function getYouTubeEmbedId(rawSrc) {
  if (!rawSrc) return '';
  try {
    const parsed = new URL(rawSrc, window.location.origin);
    const path = parsed.pathname;
    if (path.includes('/embed/')) {
      return (path.split('/embed/')[1] || '').split('/')[0].trim();
    }
    if (path.includes('/shorts/')) {
      return (path.split('/shorts/')[1] || '').split('/')[0].trim();
    }
    if (parsed.searchParams.get('v')) {
      return parsed.searchParams.get('v').trim();
    }
  } catch (_) {
    const idMatch = String(rawSrc).match(/(?:\/embed\/|\/shorts\/|[?&]v=)([A-Za-z0-9_-]{8,})/i);
    if (idMatch && idMatch[1]) return idMatch[1].trim();
  }
  return '';
}

function buildShortFormLoopSrc(rawSrc) {
  if (!rawSrc) return '';
  try {
    const parsed = new URL(rawSrc, window.location.origin);
    parsed.searchParams.set('loop', '1');
    parsed.searchParams.set('playsinline', '1');
    const host = parsed.hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      const videoId = getYouTubeEmbedId(parsed.toString());
      if (videoId) {
        parsed.searchParams.set('playlist', videoId);
      }
    }
    return parsed.toString();
  } catch (_) {
    const hasQuery = rawSrc.includes('?');
    return `${rawSrc}${hasQuery ? '&' : '?'}loop=1&playsinline=1`;
  }
}

function shouldLoopVideoElement(video) {
  if (!video) return false;
  if (video.dataset.noLoop === '1') return false;
  if (video.dataset.shortForm === '1') return true;
  const src = (video.currentSrc || video.src || '').toLowerCase();
  if (src.includes('tiktok') || src.includes('instagram') || src.includes('/shorts/')) return true;
  if (video.classList && (
    video.classList.contains('short') ||
    video.classList.contains('short-form') ||
    video.classList.contains('reel')
  )) return true;
  return video.closest('[data-short-form="1"], .short, .short-form, .reel') !== null;
}

function enforceShortFormLooping(scope) {
  const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;

  root.querySelectorAll('video').forEach((video) => {
    if (!shouldLoopVideoElement(video)) return;
    if (!video.loop) video.loop = true;
    if (video.dataset.shortLoopBound === '1') return;
    video.dataset.shortLoopBound = '1';
    video.addEventListener('ended', () => {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    });
  });

  root.querySelectorAll('iframe[src]').forEach((iframe) => {
    if (iframe.dataset.noLoop === '1') return;
    const currentSrc = iframe.getAttribute('src') || '';
    if (!isShortFormIframeSrc(currentSrc, iframe)) return;
    const nextSrc = buildShortFormLoopSrc(currentSrc);
    if (nextSrc && nextSrc !== currentSrc) {
      iframe.setAttribute('src', nextSrc);
    }
    iframe.dataset.shortLoopApplied = '1';
  });
}

function initShortFormLooping() {
  enforceShortFormLooping(document);
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches && (node.matches('video') || node.matches('iframe[src]'))) {
          enforceShortFormLooping(node.parentElement || document);
          return;
        }
        enforceShortFormLooping(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

/** Clipped title + duplicate chunk for seamless horizontal marquee on hover when text overflows the card. */
function buildKeepCardLabelMarquee(el) {
  if (el.querySelector(':scope > .keep-card__label-clip')) return;
  const text = el.textContent.trim();
  if (!text) return;

  el.replaceChildren();

  const clip = document.createElement('span');
  clip.className = 'keep-card__label-clip';

  const line = document.createElement('span');
  line.className = 'text-word-glow text-word-glow--line keep-card__label-line';

  const scroll = document.createElement('span');
  scroll.className = 'keep-card__label-scroll';

  const c1 = document.createElement('span');
  c1.className = 'keep-card__label-chunk';
  c1.textContent = text;

  const c2 = document.createElement('span');
  c2.className = 'keep-card__label-chunk';
  c2.setAttribute('aria-hidden', 'true');
  c2.textContent = text;

  scroll.appendChild(c1);
  scroll.appendChild(c2);
  line.appendChild(scroll);
  clip.appendChild(line);
  el.appendChild(clip);
}

function updateKeepCardLabelMarqueeFlags() {
  document.querySelectorAll('.keep-card__label').forEach((label) => {
    const clip = label.querySelector('.keep-card__label-clip');
    const scroll = label.querySelector('.keep-card__label-scroll');
    if (!clip || !scroll) return;
    const overflow = scroll.scrollWidth > clip.clientWidth + 1;
    label.classList.toggle('keep-card__label--overflow', overflow);
    if (overflow) {
      const durationSec = Math.max(6, Math.min(36, scroll.scrollWidth / 24));
      scroll.style.setProperty('--keep-card-marquee-duration', `${durationSec}s`);
    } else {
      scroll.style.removeProperty('--keep-card-marquee-duration');
    }
  });
}

function scheduleKeepCardLabelMarqueeReflow() {
  requestAnimationFrame(() => {
    requestAnimationFrame(updateKeepCardLabelMarqueeFlags);
  });
}

/** One green highlight for the whole line: card titles, affiliate links, “Full review →”. */
function prepareKeepCardLineGlows() {
  document.querySelectorAll('.keep-card__label').forEach((el) => {
    buildKeepCardLabelMarquee(el);
  });
  document.querySelectorAll('.keep-card__affiliate a').forEach((a) => {
    a.classList.add('text-word-glow', 'text-word-glow--line');
  });
  document.querySelectorAll('.keep-card__cta').forEach((cta) => {
    cta.classList.add('text-word-glow', 'text-word-glow--line');
  });
}

function wrapWordsInTextNode(textNode) {
  const text = textNode.nodeValue;
  const parts = text.split(/(\s+)/);
  const frag = document.createDocumentFragment();
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      frag.appendChild(document.createTextNode(part));
    } else {
      const span = document.createElement('span');
      span.className = 'text-word-glow';
      span.textContent = part;
      frag.appendChild(span);
    }
  }
  textNode.parentNode.replaceChild(frag, textNode);
}

/** Per-word glow in prose; keep-card titles / affiliate lines / CTA are single-line glows via prepareKeepCardLineGlows. */
function initWordBackgroundGlow() {
  prepareKeepCardLineGlows();
  scheduleKeepCardLabelMarqueeReflow();
  const textNodes = collectWordGlowTextNodes(document.body);
  for (const tn of textNodes) {
    wrapWordsInTextNode(tn);
  }
  scheduleKeepCardLabelMarqueeReflow();
  initWordGlowBookmark();
}

const WORD_GLOW_BOOKMARK_SKIP =
  'button, input, select, textarea, label, summary, [contenteditable="true"], [role="button"], [role="tab"]';

/**
 * Click a word (or keep-card line glow) to pin the green highlight as a reading bookmark.
 * Click the same glow again to clear. Words inside links: hold Alt while clicking to bookmark
 * so normal clicks still follow the URL.
 */
function initWordGlowBookmark() {
  if (document.documentElement.dataset.wordGlowBookmarkBound === '1') return;
  document.documentElement.dataset.wordGlowBookmarkBound = '1';

  let pinned = null;

  document.addEventListener('click', (e) => {
    if (e.button !== 0) return;
    const t = e.target;
    if (!(t instanceof Element)) return;

    const w = t.closest('.text-word-glow');
    if (!w) return;

    if (w.closest('.site-nav-link')) return;
    if (w.closest(WORD_GLOW_BOOKMARK_SKIP)) return;

    const inLink = w.closest('a[href]');
    if (inLink && !e.altKey) return;

    if (inLink && e.altKey) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (pinned === w) {
      w.classList.remove('text-word-glow--bookmark');
      pinned = null;
      return;
    }

    if (pinned) pinned.classList.remove('text-word-glow--bookmark');
    w.classList.add('text-word-glow--bookmark');
    pinned = w;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWordBackgroundGlow);
  document.addEventListener('DOMContentLoaded', initTemporaryInputLockdown);
  document.addEventListener('DOMContentLoaded', initShortFormLooping);
} else {
  initWordBackgroundGlow();
  initTemporaryInputLockdown();
  initShortFormLooping();
}

(function initKeepCardLabelMarqueeListeners() {
  const reflow = () => scheduleKeepCardLabelMarqueeReflow();
  window.addEventListener('load', reflow);
  window.addEventListener('resize', debounce(reflow, 120));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reflow);
  }
})();

(function loadLogoRainScript() {
  if (document.querySelector('script[data-logo-rain]')) return;
  const el = document.createElement('script');
  el.src = `${siteRoot}scripts/logo-rain.js`;
  el.defer = true;
  el.dataset.logoRain = '1';
  document.head.appendChild(el);
})();

(function loadKofiOverlayWidget() {
  if (document.querySelector('script[data-kofi-overlay]')) return;
  const el = document.createElement('script');
  el.src = 'https://storage.ko-fi.com/cdn/scripts/overlay-widget.js';
  el.dataset.kofiOverlay = '1';
  el.onload = function () {
    if (typeof kofiWidgetOverlay === 'undefined') return;
    kofiWidgetOverlay.draw('owenminer', {
      type: 'floating-chat',
      'floating-chat.donateButton.text': 'Donate',
      'floating-chat.donateButton.background-color': '#323842',
      'floating-chat.donateButton.text-color': '#fff',
    });
  };
  document.body.appendChild(el);
})();
