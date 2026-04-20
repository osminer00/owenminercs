(function () {
  var root = document.getElementById("garage-sale-list");
  var err = document.getElementById("garage-sale-error");
  var ebayRoot = document.getElementById("garage-sale-ebay-listings");
  var ebayErr = document.getElementById("garage-sale-ebay-error");
  if (!root && !ebayRoot) return;

  var script = document.currentScript;
  var rel = (script && script.getAttribute("data-links")) || "garage-sale-links.json";
  var ebayRel = (script && script.getAttribute("data-ebay-listings")) || "ebay-listings.json";
  var jsonUrl = new URL(rel, window.location.href).href;
  var ebayUrl = new URL(ebayRel, window.location.href).href;

  function showError(node, msg) {
    if (node) {
      node.hidden = false;
      node.textContent = msg;
    }
  }

  function getJson(url, name) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + name);
      return r.json();
    });
  }

  function renderMarketplaceCards(items) {
    if (!root) return;
    if (!items || !items.length) {
      root.innerHTML = "<p class=\"garage-sale-empty\">No marketplaces yet. Add entries to <code>Garage Sale/garage-sale-links.json</code>.</p>";
      return;
    }
    var frag = document.createDocumentFragment();
    items.forEach(function (m) {
      var card = document.createElement("article");
      card.className = "garage-sale-card";
      var h = document.createElement("h2");
      h.textContent = m.name || "Marketplace";
      card.appendChild(h);
      if (m.description) {
        var p = document.createElement("p");
        p.className = "garage-sale-card-desc";
        p.textContent = m.description;
        card.appendChild(p);
      }
      var url = (m.url || "").trim();
      if (url) {
        var a = document.createElement("a");
        a.className = "modeButton garage-sale-card-link";
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Open " + (m.name || "store");
        card.appendChild(a);
      } else {
        var hint = document.createElement("p");
        hint.className = "garage-sale-card-pending";
        hint.innerHTML = "Set <code>url</code> for this row in <code>garage-sale-links.json</code>.";
        card.appendChild(hint);
      }
      frag.appendChild(card);
    });
    root.appendChild(frag);
  }

  function renderEbayCards(items) {
    if (!ebayRoot) return;
    if (!items || !items.length) {
      ebayRoot.innerHTML = "<p class=\"garage-sale-empty\">No synced eBay items yet. Run <code>node scripts/sync-ebay-listings.mjs --user owenm00</code>.</p>";
      return;
    }
    var frag = document.createDocumentFragment();
    items.forEach(function (item) {
      var card = document.createElement("article");
      card.className = "garage-sale-card garage-sale-ebay-card";

      if (item.image) {
        var imgWrap = document.createElement("a");
        imgWrap.href = item.url || "#";
        imgWrap.className = "garage-sale-ebay-image-link";
        imgWrap.target = "_blank";
        imgWrap.rel = "noopener noreferrer";

        var img = document.createElement("img");
        img.className = "garage-sale-ebay-image";
        img.src = item.image;
        img.alt = item.title || "eBay listing image";
        img.loading = "lazy";
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);
      }

      var h = document.createElement("h3");
      h.className = "garage-sale-ebay-title";
      h.textContent = item.title || "Untitled listing";
      card.appendChild(h);

      if (item.price) {
        var listedPrice = document.createElement("p");
        listedPrice.className = "garage-sale-ebay-price";
        listedPrice.textContent = "Listed: " + item.price;
        card.appendChild(listedPrice);
      }

      if (!item.price) {
        var unavailable = document.createElement("p");
        unavailable.className = "garage-sale-ebay-spread-note";
        unavailable.textContent = "Price unavailable right now.";
        card.appendChild(unavailable);
      }

      var cta = document.createElement("a");
      cta.className = "modeButton garage-sale-card-link";
      cta.href = item.url || "#";
      cta.target = "_blank";
      cta.rel = "noopener noreferrer";
      cta.textContent = "View on eBay";
      card.appendChild(cta);

      frag.appendChild(card);
    });
    ebayRoot.appendChild(frag);
  }

  getJson(jsonUrl, rel)
    .then(function (data) {
      renderMarketplaceCards(data.marketplaces);
    })
    .catch(function () {
      showError(err, "Could not load the marketplace list. Check that garage-sale-links.json is next to this page.");
    });

  getJson(ebayUrl, ebayRel)
    .then(function (data) {
      renderEbayCards(data.items || []);
    })
    .catch(function () {
      showError(ebayErr, "Could not load synced eBay items. Run the sync script to refresh ebay-listings.json.");
    });
})();
