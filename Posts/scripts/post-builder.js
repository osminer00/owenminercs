(function () {
  'use strict';

  var posts = [];
  var imagesListEl = document.getElementById('pb-images');
  var statusEl = document.getElementById('pb-status');
  var form = document.getElementById('pb-form');
  var aiPromptEl = document.getElementById('pb-ai-prompt');
  var aiToneEl = document.getElementById('pb-ai-tone');
  var aiKeywordsEl = document.getElementById('pb-ai-keywords');
  var aiIntroEl = document.getElementById('pb-ai-intro');
  var aiSeoTitleEl = document.getElementById('pb-ai-seo-title');
  var aiSeoDescEl = document.getElementById('pb-ai-seo-description');
  var aiSocialEl = document.getElementById('pb-ai-social');
  var aiStatusEl = document.getElementById('pb-ai-status');

  function slugify(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function uniqueId(base) {
    var id = base || 'post';
    var used = {};
    posts.forEach(function (p) {
      if (p.id) used[p.id] = true;
    });
    if (!used[id]) return id;
    var n = 2;
    while (used[id + '-' + n]) n += 1;
    return id + '-' + n;
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function setAiStatus(msg) {
    if (aiStatusEl) aiStatusEl.textContent = msg;
  }

  function cleanText(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function capitalizeWords(s) {
    return cleanText(s).replace(/\w\S*/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  function truncateText(s, maxLen) {
    var text = cleanText(s);
    if (text.length <= maxLen) return text;
    return text.slice(0, Math.max(0, maxLen - 1)).trim() + '…';
  }

  function topicFromPrompt(prompt) {
    var p = cleanText(prompt);
    if (!p) return 'new post update';
    var firstSentence = p.split(/[.!?]/)[0] || p;
    var words = firstSentence.split(' ').filter(Boolean);
    if (!words.length) return 'new post update';
    return words.slice(0, 8).join(' ');
  }

  function parseKeywords(raw) {
    return String(raw || '')
      .split(',')
      .map(function (k) {
        return cleanText(k);
      })
      .filter(Boolean)
      .slice(0, 4);
  }

  function buildHashtags(topic, keywords) {
    var base = [topic].concat(keywords || []);
    var seen = {};
    var tags = [];
    base.forEach(function (entry) {
      var compact = String(entry || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ');
      var tag = compact
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .join('');
      if (!tag || seen[tag]) return;
      seen[tag] = true;
      tags.push('#' + tag);
    });
    if (!seen.owenminercs) tags.push('#owenminercs');
    return tags.slice(0, 5);
  }

  function generateCopyDraft(prompt, tone, keywords) {
    var normalized = cleanText(prompt);
    var topic = topicFromPrompt(normalized);
    var topicTitle = capitalizeWords(topic);
    var keyList = parseKeywords(keywords);
    var introsByTone = {
      balanced: 'New post: ' + normalized + '. Sharing a quick look at what changed and why it matters.',
      casual: 'Quick update: ' + normalized + '. Dropping a short breakdown and fresh shots in this post.',
      hype: normalized + ' just dropped. New post is up with the full breakdown, details, and photos.'
    };
    var intro = introsByTone[tone] || introsByTone.balanced;
    var seoTitleBase = topicTitle + ' | Owen Miner';
    var seoTitle = truncateText(seoTitleBase, 58);
    var seoDescBits = [
      'Read the latest update from Owen Miner:',
      normalized + '.',
      keyList.length ? 'Includes ' + keyList.join(', ') + '.' : 'Includes photos and a quick summary.'
    ];
    var seoDescription = truncateText(seoDescBits.join(' '), 155);
    var socialSnippet =
      'New post: ' +
      topicTitle +
      '\n' +
      intro +
      '\n\nRead it on owenminercs.com.' +
      '\n' +
      buildHashtags(topic, keyList).join(' ');
    return {
      topicTitle: topicTitle,
      intro: intro,
      seoTitle: seoTitle,
      seoDescription: seoDescription,
      socialSnippet: socialSnippet
    };
  }

  function copyTextToClipboard(text, onDone, onFail) {
    if (!text) {
      if (onFail) onFail();
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(function () {
        copyWithSelection(text, onDone, onFail);
      });
      return;
    }
    copyWithSelection(text, onDone, onFail);
  }

  function copyWithSelection(text, onDone, onFail) {
    try {
      var helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', 'readonly');
      helper.style.position = 'fixed';
      helper.style.left = '-9999px';
      document.body.appendChild(helper);
      helper.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(helper);
      if (ok && onDone) onDone();
      else if (!ok && onFail) onFail();
    } catch (err) {
      if (onFail) onFail();
    }
  }

  function addImageRow(src, alt) {
    var row = document.createElement('div');
    row.className = 'pb-image-row';

    var srcLab = document.createElement('label');
    srcLab.className = 'pb-field';
    srcLab.innerHTML =
      'Image path <span class="pb-hint">(from this folder, e.g. images/shot.webp)</span><input type="text" class="pb-src" value="' +
      escapeAttr(src || '') +
      '" placeholder="images/my-photo.webp" autocomplete="off">';
    row.appendChild(srcLab);

    var altLab = document.createElement('label');
    altLab.className = 'pb-field';
    altLab.innerHTML =
      'Alt text <input type="text" class="pb-alt" value="' +
      escapeAttr(alt || '') +
      '" placeholder="Describe the photo" autocomplete="off">';
    row.appendChild(altLab);

    var rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'modeButton pb-remove-img';
    rm.textContent = 'Remove';
    rm.addEventListener('click', function () {
      if (imagesListEl.querySelectorAll('.pb-image-row').length <= 1) {
        row.querySelector('.pb-src').value = '';
        row.querySelector('.pb-alt').value = '';
        return;
      }
      row.remove();
    });
    row.appendChild(rm);

    imagesListEl.appendChild(row);
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function collectImages() {
    var out = [];
    imagesListEl.querySelectorAll('.pb-image-row').forEach(function (row) {
      var src = (row.querySelector('.pb-src') && row.querySelector('.pb-src').value) || '';
      var alt = (row.querySelector('.pb-alt') && row.querySelector('.pb-alt').value) || '';
      src = src.trim();
      if (!src) return;
      out.push({ src: src, alt: alt.trim() });
    });
    return out;
  }

  function resetForm() {
    form.querySelector('#pb-title').value = '';
    form.querySelector('#pb-description').value = '';
    form.querySelector('#pb-date').value = defaultDate();
    form.querySelector('#pb-layout').value = 'stack';
    imagesListEl.innerHTML = '';
    addImageRow('', '');
  }

  function defaultDate() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  document.getElementById('pb-add-image').addEventListener('click', function () {
    addImageRow('', '');
  });

  document.getElementById('pb-load').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        posts = Array.isArray(data.posts) ? data.posts.slice() : [];
        posts.sort(function (a, b) {
          return String(b.date || '').localeCompare(String(a.date || ''));
        });
        setStatus('Loaded ' + posts.length + ' post(s). Add more, then download.');
      } catch (err) {
        setStatus('Could not parse JSON.');
      }
    };
    reader.readAsText(f);
    e.target.value = '';
  });

  document.getElementById('pb-add-post').addEventListener('click', function () {
    var title = (form.querySelector('#pb-title').value || '').trim();
    if (!title) {
      setStatus('Add a title first.');
      return;
    }
    var description = form.querySelector('#pb-description').value || '';
    var date = (form.querySelector('#pb-date').value || '').trim() || defaultDate();
    var imageLayout = form.querySelector('#pb-layout').value || 'stack';
    var images = collectImages();

    var idBase = slugify(date + '-' + title) || 'post';
    var post = {
      id: uniqueId(idBase),
      title: title,
      date: date,
      description: description,
      imageLayout: imageLayout,
      images: images
    };
    posts.push(post);
    posts.sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    setStatus('Saved draft in memory: "' + title + '" — ' + posts.length + ' post(s) total. Download JSON to update the site.');
    updatePreview(post);
    resetForm();
  });

  document.getElementById('pb-download').addEventListener('click', function () {
    if (!posts.length) {
      setStatus('No posts to download. Load posts.json or add a post.');
      return;
    }
    var sorted = posts.slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    var json = JSON.stringify({ posts: sorted }, null, 2);
    var blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'posts.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Downloaded posts.json — replace the file in Posts/ and commit.');
  });

  document.getElementById('pb-clear-memory').addEventListener('click', function () {
    posts = [];
    setStatus('Cleared in-memory posts. Load a file or add new posts.');
    var prev = document.getElementById('pb-preview');
    if (prev) prev.innerHTML = '';
  });

  function updatePreview(post) {
    var prev = document.getElementById('pb-preview');
    if (!prev) return;
    var layout = post.imageLayout === 'grid' || post.imageLayout === 'gallery' ? post.imageLayout : 'stack';
    var imgs = (post.images || [])
      .map(function (im) {
        return (
          '<div class="site-post-preview-imgwrap"><img src="' +
          escapeAttr(im.src) +
          '" alt="' +
          escapeAttr(im.alt) +
          '" loading="lazy"></div>'
        );
      })
      .join('');
    var desc = (post.description || '')
      .split(/\n\s*\n/)
      .map(function (b) {
        return b.trim() ? '<p>' + escapeHtml(b.trim()) + '</p>' : '';
      })
      .join('');
    prev.innerHTML =
      '<article class="site-post site-post--preview"><header class="site-post-header"><h2 class="site-post-title">' +
      escapeHtml(post.title) +
      '</h2><time class="site-post-date">' +
      escapeHtml(post.date) +
      '</time></header><div class="site-post-body">' +
      desc +
      '</div><div class="site-post-images site-post-images--' +
      layout +
      ' pb-preview-media">' +
      imgs +
      '</div></article>';
  }

  if (aiPromptEl && aiIntroEl && aiSeoTitleEl && aiSeoDescEl && aiSocialEl) {
    document.getElementById('pb-ai-generate').addEventListener('click', function () {
      var prompt = cleanText(aiPromptEl.value);
      if (!prompt) {
        setAiStatus('Add a short prompt first, then click Generate draft copy.');
        return;
      }
      var draft = generateCopyDraft(prompt, (aiToneEl && aiToneEl.value) || 'balanced', aiKeywordsEl && aiKeywordsEl.value);
      aiIntroEl.value = draft.intro;
      aiSeoTitleEl.value = draft.seoTitle;
      aiSeoDescEl.value = draft.seoDescription;
      aiSocialEl.value = draft.socialSnippet;
      if (!form.querySelector('#pb-title').value.trim()) {
        form.querySelector('#pb-title').value = draft.topicTitle;
      }
      setAiStatus('Draft copy generated. Edit anything, then add your post as usual.');
    });

    document.getElementById('pb-ai-fill-intro').addEventListener('click', function () {
      var intro = cleanText(aiIntroEl.value);
      if (!intro) {
        setAiStatus('Generate or write an intro first.');
        return;
      }
      var descEl = form.querySelector('#pb-description');
      var existing = (descEl.value || '').trim();
      descEl.value = existing ? intro + '\n\n' + existing : intro;
      setAiStatus('Intro copied into Description.');
    });

    document.getElementById('pb-ai-copy-all').addEventListener('click', function () {
      var intro = cleanText(aiIntroEl.value);
      var seoTitle = cleanText(aiSeoTitleEl.value);
      var seoDescription = cleanText(aiSeoDescEl.value);
      var social = cleanText(aiSocialEl.value);
      var payload =
        'Intro:\n' +
        intro +
        '\n\nSEO title:\n' +
        seoTitle +
        '\n\nSEO description:\n' +
        seoDescription +
        '\n\nSocial snippet:\n' +
        social;
      if (!intro && !seoTitle && !seoDescription && !social) {
        setAiStatus('Nothing to copy yet. Generate draft copy first.');
        return;
      }
      copyTextToClipboard(
        payload,
        function () {
          setAiStatus('Copied generated text to clipboard.');
        },
        function () {
          setAiStatus('Could not copy automatically. Select and copy the fields manually.');
        }
      );
    });
  }

  resetForm();
  setStatus('Load your current posts.json (optional), fill the form, click Add post, then Download posts.json.');
  setAiStatus('Add a short prompt, generate draft copy, then tweak the results.');
})();
