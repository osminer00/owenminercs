(function () {
  'use strict';

  var listRoot = document.getElementById('donators-list');
  var summaryRoot = document.getElementById('donators-summary');
  var followersRoot = document.getElementById('donators-followers-list');
  var activityListRoot = document.getElementById('donators-activity-list');
  var activityStatusEl = document.getElementById('donators-activity-status');
  var activityRefreshBtn = document.getElementById('donators-activity-refresh');
  var errEl = document.getElementById('donators-error');
  if (!listRoot || !summaryRoot) return;

  var script = document.currentScript;
  var rel = (script && script.getAttribute('data-source')) || 'donators.json';
  var jsonUrl = new URL(rel, window.location.href).href;
  var cachedData = null;
  var ACTIVE_PLATFORMS = { kofi: true, streamelements: true };

  var PLATFORM_LABELS = {
    kofi: 'Ko-fi',
    twitch: 'Twitch',
    youtube: 'YouTube',
    streamelements: 'StreamElements',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    other: 'Other'
  };

  var FOLLOWER_PLATFORMS = ['twitch', 'youtube', 'facebook', 'instagram', 'tiktok'];

  function normalizePlatform(value) {
    var v = String(value || '').trim().toLowerCase();
    return PLATFORM_LABELS[v] ? v : 'other';
  }

  function platformIsActive(platform) {
    return Boolean(ACTIVE_PLATFORMS[normalizePlatform(platform)]);
  }

  function normalizeKind(value) {
    var v = String(value || '').trim().toLowerCase();
    if (v === 'subscription' || v === 'sub' || v === 'membership') return 'subscription';
    if (v === 'donation' || v === 'tip') return 'donation';
    if (v === 'bits' || v === 'cheer') return 'bits';
    return 'other';
  }

  function safeDate(value, withTime) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    var parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    if (withTime) {
      return parsed.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function amountNumber(item) {
    var amount = String(item.amount || '').trim();
    if (!amount) return 0;
    var clean = amount.replace(/[^0-9.-]/g, '');
    var n = Number.parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
  }

  function asNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function currencyText(num) {
    if (!Number.isFinite(num) || num <= 0) return '$0.00';
    return '$' + num.toFixed(2);
  }

  function intText(num) {
    return Math.max(0, Math.floor(asNumber(num))).toLocaleString();
  }

  function buildSupportEvents(items, twitchFeed) {
    var out = [];

    items.forEach(function (item) {
      if (!platformIsActive(item.platform)) return;
      var kind = normalizeKind(item.kind);
      var evt = {
        id: String(item.id || ''),
        name: String(item.name || 'Anonymous').trim() || 'Anonymous',
        platform: normalizePlatform(item.platform),
        kind: kind,
        donations: 0,
        bits: 0,
        subscribers: 0,
        date: String(item.date || '').trim(),
        message: String(item.message || '').trim()
      };
      if (kind === 'donation') {
        evt.donations = amountNumber(item);
      } else if (kind === 'bits') {
        evt.bits = Math.max(0, asNumber(item.bits || item.amount || 0));
      } else if (kind === 'subscription') {
        evt.subscribers = Math.max(1, asNumber(item.subscribers || item.subs || 1));
      } else if (amountNumber(item) > 0) {
        evt.kind = 'donation';
        evt.donations = amountNumber(item);
      }
      if (evt.donations > 0 || evt.bits > 0 || evt.subscribers > 0) out.push(evt);
    });

    if (twitchFeed && Array.isArray(twitchFeed.events)) {
      twitchFeed.events.forEach(function (ev) {
        var kind = '';
        var subs = 0;
        var bits = 0;
        if (ev.type === 'bits') {
          kind = 'bits';
          bits = Math.max(0, asNumber(ev.bits || 0));
        } else if (ev.type === 'subscribe') {
          kind = 'subscription';
          subs = 1;
        } else if (ev.type === 'gift_sub') {
          kind = 'subscription';
          subs = Math.max(1, asNumber(ev.total || 1));
        } else {
          return;
        }

        out.push({
          id: String(ev.id || ''),
          name: String(ev.userName || 'Anonymous').trim() || 'Anonymous',
          platform: 'twitch',
          kind: kind,
          donations: 0,
          bits: bits,
          subscribers: subs,
          date: String(ev.createdAt || '').trim(),
          message: ''
        });
      });
    }

    return out.sort(function (a, b) {
      var da = Date.parse(a.date || '');
      var db = Date.parse(b.date || '');
      var va = Number.isFinite(da);
      var vb = Number.isFinite(db);
      if (va && vb) return db - da;
      if (va) return -1;
      if (vb) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function renderSummary(events, updatedAt, twitchFeed) {
    var counts = { kofi: 0, twitch: 0, youtube: 0, streamelements: 0, facebook: 0, instagram: 0, tiktok: 0, other: 0 };
    events.forEach(function (evt) {
      counts[normalizePlatform(evt.platform)] += 1;
    });
    summaryRoot.innerHTML = '';
    var card = document.createElement('section');
    card.className = 'donators-summary-card';

    var title = document.createElement('h2');
    title.textContent = 'Supporter totals';
    card.appendChild(title);

    var stats = document.createElement('div');
    stats.className = 'donators-summary-stats';
    ['kofi', 'streamelements'].forEach(function (key) {
      var pill = document.createElement('span');
      pill.className = 'donators-pill';
      pill.textContent = PLATFORM_LABELS[key] + ': ' + counts[key];
      stats.appendChild(pill);
    });
    card.appendChild(stats);

    if (updatedAt) {
      var p = document.createElement('p');
      p.className = 'donators-updated';
      p.textContent = 'Last updated: ' + safeDate(updatedAt);
      card.appendChild(p);
    }

    summaryRoot.appendChild(card);
  }

  function kindLabel(kind, evt) {
    if (kind === 'donation') return 'Donation';
    if (kind === 'bits') return 'Bits';
    if (kind === 'subscription') {
      if (evt.platform === 'twitch' && asNumber(evt.subscribers) > 1) return 'Gifted subs';
      return 'Subscription';
    }
    return 'Support';
  }

  function renderSupporterCard(evt) {
    var article = document.createElement('article');
    article.className = 'donators-card';
    article.setAttribute('data-platform', normalizePlatform(evt.platform));

    var name = document.createElement('h3');
    name.textContent = String(evt.name || 'Anonymous');
    article.appendChild(name);

    var stats = document.createElement('div');
    stats.className = 'donators-card-stats';
    if (evt.kind === 'donation') {
      var amount = document.createElement('p');
      amount.className = 'donators-card-amount';

      var amountPrefix = document.createElement('span');
      amountPrefix.className = 'donators-card-amount-prefix';
      amountPrefix.textContent = 'Donation:';
      amount.appendChild(amountPrefix);

      var amountValue = document.createElement('span');
      amountValue.className = 'donators-card-amount-value';
      amountValue.textContent = currencyText(evt.donations);
      amount.appendChild(amountValue);

      stats.appendChild(amount);
    } else if (evt.kind === 'bits') {
      stats.innerHTML = '<p><strong>Bits:</strong> ' + intText(evt.bits) + '</p>';
    } else if (evt.kind === 'subscription') {
      stats.innerHTML = '<p><strong>Subscribers:</strong> ' + intText(evt.subscribers) + '</p>';
    } else {
      stats.innerHTML = '<p><strong>Support:</strong> Activity recorded</p>';
    }
    article.appendChild(stats);

    var meta = document.createElement('p');
    meta.className = 'donators-card-meta';
    var parts = [PLATFORM_LABELS[normalizePlatform(evt.platform)] || 'Other', kindLabel(evt.kind, evt)];
    if (evt.date) parts.push(safeDate(evt.date, true));
    meta.textContent = parts.join(' - ');
    article.appendChild(meta);

    if (evt.message) {
      var time = document.createElement('p');
      time.className = 'donators-card-message';
      time.textContent = evt.message;
      article.appendChild(time);
    }

    return article;
  }

  function renderFollowers(followerData, twitchFeed) {
    if (!followersRoot) return;
    followersRoot.innerHTML = '';

    var twitchFeedCount = twitchFeed && twitchFeed.totals ? asNumber(twitchFeed.totals.follows_total) : 0;
    var values = followerData || {};

    var frag = document.createDocumentFragment();
    FOLLOWER_PLATFORMS.forEach(function (platform) {
      var card = document.createElement('article');
      card.className = 'donators-followers-card';
      card.setAttribute('data-platform', platform);

      var h3 = document.createElement('h3');
      h3.textContent = PLATFORM_LABELS[platform];
      card.appendChild(h3);

      var n = document.createElement('p');
      n.className = 'donators-followers-count';
      var rawValue = values[platform];
      if (platform === 'twitch' && (rawValue === undefined || rawValue === null || rawValue === '')) {
        rawValue = twitchFeedCount || '';
      }
      if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
        n.textContent = 'Not set';
        card.appendChild(n);
        frag.appendChild(card);
        return;
      }
      var num = Number(rawValue);
      n.textContent = Number.isFinite(num) && num >= 0 ? num.toLocaleString() : 'Not set';
      card.appendChild(n);

      frag.appendChild(card);
    });

    followersRoot.appendChild(frag);
  }

  function setActivityStatus(text, isError) {
    if (!activityStatusEl) return;
    activityStatusEl.textContent = text;
    activityStatusEl.dataset.state = isError ? 'error' : 'ok';
  }

  function renderActivity(twitchFeed) {
    if (!activityListRoot) return;
    activityListRoot.innerHTML = '';

    setActivityStatus('Twitch activity is paused for now.', false);
    var paused = document.createElement('article');
    paused.className = 'donators-activity-item donators-activity-item--empty';
    paused.innerHTML = '<h3>Paused</h3><p>Showing Ko-fi and StreamElements supporters only for now.</p>';
    activityListRoot.appendChild(paused);
  }

  function fetchTwitchFeed() {
    return Promise.resolve(null);
  }

  function renderSupporterCards(events) {
    listRoot.innerHTML = '';
    if (!events.length) {
      var empty = document.createElement('p');
      empty.className = 'donators-empty';
      empty.textContent = 'No supporter activity yet. Add entries in Donators/donators.json or connect Twitch EventSub.';
      listRoot.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    events.forEach(function (evt) {
      frag.appendChild(renderSupporterCard(evt));
    });
    listRoot.appendChild(frag);
  }

  function applyRender(data, twitchFeed) {
    var supporters = Array.isArray(data.supporters) ? data.supporters : [];
    var events = buildSupportEvents(supporters, twitchFeed);

    renderSummary(events, data.updatedAt, twitchFeed);
    renderSupporterCards(events);
    renderFollowers(data.followers || {}, twitchFeed);
    renderActivity(twitchFeed);
  }

  Promise.all([
    fetch(jsonUrl).then(function (r) {
      if (!r.ok) throw new Error('missing');
      return r.json();
    }),
    fetchTwitchFeed()
  ]).then(function (results) {
    cachedData = results[0] || {};
    applyRender(cachedData, results[1]);
  }).catch(function () {
    if (errEl) errEl.hidden = false;
  });
})();
