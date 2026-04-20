// Determine the base path to the root of the site by looking at this script's URL
const scriptUrl = document.querySelector('script[src*="components.js"]').src;
const siteRoot = scriptUrl.replace('scripts/components.js', '');

// Detect if running locally (Live Server, file://, etc.)
const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';

function getLink(path) {
  if (path === "") return siteRoot;
  return siteRoot + path + (isLocal ? ".html" : "");
}

class SharedHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header>
        <div>
          <p class="text3d" style="border-radius: 25px; background: black; padding: 5px; padding-bottom: 10px;"> OwenMinerCS.com</p>
          <nav>
            <ul>
              <li><a href="${siteRoot}" data-nav="index.html">About</a></li>
              <li><a href="${getLink('Desk%20Setup/setup')}" data-nav="Desk Setup">Desk Setup</a></li>
              <li><a href="${getLink('PC/pc')}" data-nav="PC">PC</a></li>
              <li><a href="${getLink('Keyboard/60he')}" data-nav="Keyboard">Keyboard</a></li>
              <li><a href="${getLink('Counter-Strike/CS')}" data-nav="Counter-Strike" title="CS2 & Counter-Strike content">Counter-Strike</a></li>
              <li><a href="${getLink('Photography/photography')}" data-nav="Photography">Photography</a></li>
              <li><a href="${getLink('Posts/posts')}" data-nav="Posts">Posts</a></li>
              <li><a href="${getLink('Garage%20Sale/garage-sale')}" data-nav="Garage Sale">Garage Sale</a></li>
              <li><a href="${getLink('Socials/socials')}" data-nav="Socials">Socials</a></li>
            </ul>
          </nav>
          <hr style="border: thin ridge black; margin:0; padding: 0; min-width: 100%;">
          <div class="socials">
            <a target="_blank" rel="noopener noreferrer" href="https://x.com/OwenMinerCS" title="X: OwenMinerCS">
              <img src="${siteRoot}Socials/SocialButtons/xLink.webp" alt="Link to X">
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.reddit.com/user/OwenMCS" title="Reddit: OwenMCS">
              <img src="${siteRoot}Socials/SocialButtons/redditLink.webp" alt="Link to Reddit">
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/@OwenMinerCS" title="YouTube: Owen Miner">
              <img src="${siteRoot}Socials/SocialButtons/youtubeLink.webp" alt="Link to Youtube">
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.instagram.com/owenminercs/" title="Instagram: owenminercs">
              <img src="${siteRoot}Socials/SocialButtons/instagramLink.webp" alt="Link to Instagram">
            </a>
            <a target="_blank" rel="noopener noreferrer" href="https://www.tiktok.com/@owenminercs" title="TikTok: OwenMCS">
              <img src="${siteRoot}Socials/SocialButtons/tiktokLink.webp" alt="Link to TikTok">
            </a>
          </div>
        </div>
        <hr style="border: thin ridge black; margin:0; padding: 0; min-width: 100%;">
      </header>
    `;

    // Highlight the active navigation link based on the current URI path
    const currentPath = window.location.pathname;
    
    // Default styles for all links
    const links = this.querySelectorAll('nav a');
    links.forEach(link => {
      link.style.color = "rgb(120,120,120)";
      link.style.textDecoration = "none";
    });

    // Determine active link
    let activeLink = null;
    if (currentPath.endsWith("/") || currentPath.endsWith("index.html")) {
      activeLink = this.querySelector('a[data-nav="index.html"]');
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
        // Fallback for special pages like /Counter-Strike/nosmoking
        if (currentPath.includes("nosmoking")) {
             activeLink = this.querySelector('a[data-nav="Counter-Strike"]');
        }
    }

    if (activeLink) {
      activeLink.style.color = "white";
      activeLink.style.textDecoration = "underline";
    }
  }
}

class SharedFooter extends HTMLElement {
  connectedCallback() {
	// For disclosures, some pages have custom text (like Desk Setup specifying affiliate links).
	const customDisclosure = this.getAttribute('disclosure') || 
		"<i>This page has optional tip links (Ko-fi, StreamElements) and no paid shopping links. The Desk Setup, Keyboard, and PC pages include Amazon links where Owen Miner participates in the Amazon Associates Program. As an Amazon Associate I earn from qualifying purchases through eligible links on those pages.</i>";

    this.innerHTML = `
      <footer>
        <hr style="border: thin ridge black; margin:20px 0; padding: 0;">
        <h4><a href="#top" style="text-align: center;">Back To Top</a></h4>
        <hr style="border: thin ridge black; margin:20px 0; padding: 0;">
        
        <div>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="${siteRoot}" style="color: rgb(120,120,120);" data-nav="index.html">About</a></li>
              <li><a href="${getLink('Desk%20Setup/setup')}" style="color: rgb(120,120,120);" data-nav="Desk Setup">Desk Setup</a></li>
              <li><a href="${getLink('PC/pc')}" style="color: rgb(120,120,120);" data-nav="PC">PC</a></li>
              <li><a href="${getLink('Keyboard/60he')}" style="color: rgb(120,120,120);" data-nav="Keyboard">Keyboard</a></li>
              <li><a href="${getLink('Counter-Strike/CS')}" style="color: rgb(120,120,120);" data-nav="Counter-Strike">Counter-Strike</a></li>
              <li><a href="${getLink('Photography/photography')}" style="color: rgb(120,120,120);" data-nav="Photography">Photography</a></li>
              <li><a href="${getLink('Posts/posts')}" style="color: rgb(120,120,120);" data-nav="Posts">Posts</a></li>
              <li><a href="${getLink('Garage%20Sale/garage-sale')}" style="color: rgb(120,120,120);" data-nav="Garage Sale">Garage Sale</a></li>
              <li><a href="${getLink('Socials/socials')}" style="color: rgb(120,120,120);" data-nav="Socials">Socials</a></li>
            </ul>
          </nav>
        </div>
        
        <hr style="border: thin ridge black; margin:20px 0; padding: 0;">
        <div>
          <h4 id="Disclosure" style="padding: 0; margin: 10px;"><span style="font-weight: bold;">Disclosure:</span> ${customDisclosure}</h4>
          <h4 style="text-transform: capitalize;">This website was created by Owen Miner</h4>
          <h4>Feel free to use any photos on this page, with credit to <a href="https://OwenMinerCS.com">OwenMinerCS.com</a></h4>
          <p style="padding-left: 10px;"><b>OwenMinerCS.com</b></p>
        </div>  
        <hr style="border: thin ridge black; padding: 0;">
      </footer>
    `;
    
    // Highlight active link in footer
    const currentPath = window.location.pathname;
    const links = this.querySelectorAll('nav a');
    let activeLink = null;
    
    if (currentPath.endsWith("/") || currentPath.endsWith("index.html")) {
      activeLink = links[0]; // About
    } else {
      for (const link of links) {
        const dataNav = link.getAttribute('data-nav');
        if (dataNav !== "index.html" && decodeURIComponent(window.location.pathname).includes(dataNav)) {
          activeLink = link;
          break;
        }
      }
      if (!activeLink && currentPath.includes("nosmoking")) activeLink = this.querySelector('a[data-nav="Counter-Strike"]');
    }
    
    if (activeLink) {
        activeLink.style.color = "white";
        activeLink.style.textDecoration = "underline";
    }
  }
}

customElements.define('shared-header', SharedHeader);
customElements.define('shared-footer', SharedFooter);
