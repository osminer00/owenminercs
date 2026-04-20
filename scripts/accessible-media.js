(function (global) {
  'use strict';

  function cleanText(value) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .replace(/\u2014/g, '-')
      .trim();
  }

  function clipText(value, maxLen) {
    var text = cleanText(value);
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 1).replace(/[,\s-]+$/, '') + '.';
  }

  function pathToWords(src) {
    var normalized = cleanText(src).split('?')[0];
    if (!normalized) return '';
    var part = normalized.split('/').pop() || '';
    part = part.replace(/\.[a-z0-9]+$/i, '');
    part = part.replace(/[_-]+/g, ' ');
    part = part.replace(/\b(img|image|photo|dsc|pxl)\b/gi, '');
    return cleanText(part);
  }

  function isWeakAlt(alt) {
    var t = cleanText(alt).toLowerCase();
    if (!t) return true;
    if (t.length < 8) return true;
    return /^(image|photo|picture|untitled|img|setup)$/i.test(t);
  }

  function closestHeadingText(el) {
    if (!el || !el.closest) return '';
    var block = el.closest('.keep-card, .gamingMonitor, .ultrawide, .intro, section, article, div');
    if (!block || !block.querySelector) return '';
    var heading = block.querySelector('.keep-card__label, h1, h2, h3, h4');
    return heading ? cleanText(heading.textContent) : '';
  }

  function buildAltText(opts) {
    var existingAlt = cleanText(opts.existingAlt);
    if (!isWeakAlt(existingAlt)) {
      return clipText(existingAlt, 160);
    }

    var title = cleanText(opts.title);
    var context = cleanText(opts.context);
    var fromPath = pathToWords(opts.src);
    var subject = title || context || fromPath || 'setup photo';

    if (title && context && context.toLowerCase().indexOf(title.toLowerCase()) === -1) {
      subject = title + ' in ' + context;
    } else if (!title && context) {
      subject = context;
    }

    return clipText(subject, 160);
  }

  function buildCaption(opts) {
    var explicit = cleanText(opts.caption);
    if (explicit) return clipText(explicit, 92);

    var title = cleanText(opts.title);
    var alt = cleanText(opts.alt);
    var base = title || alt || 'Setup photo';
    return clipText(base, 92);
  }

  function ensureCaptionElement(img, caption) {
    if (!img || !caption || !img.parentNode) return;

    var next = img.nextElementSibling;
    if (next && next.classList && next.classList.contains('auto-media-caption')) {
      if (!cleanText(next.textContent)) next.textContent = caption;
      return;
    }

    var captionEl = document.createElement('p');
    captionEl.className = 'auto-media-caption';
    captionEl.textContent = caption;
    captionEl.style.margin = '0.45rem 0 0';
    captionEl.style.fontSize = '0.9rem';
    captionEl.style.color = 'var(--text-muted, #b5b5b5)';
    captionEl.style.textAlign = 'left';
    captionEl.style.lineHeight = '1.35';
    img.insertAdjacentElement('afterend', captionEl);
  }

  function applySetupCards(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var cards = scope.querySelectorAll('.keep-card');
    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      var labelEl = card.querySelector('.keep-card__label');
      var label = labelEl ? cleanText(labelEl.textContent) : '';

      var img = card.querySelector('img.keep-card__thumb');
      if (img) {
        var alt = buildAltText({
          existingAlt: img.getAttribute('alt'),
          title: label,
          context: 'Owen Miner setup',
          src: img.getAttribute('src')
        });
        img.setAttribute('alt', alt);

        var cardCaption = buildCaption({ title: label, alt: alt });
        if (!cleanText(card.getAttribute('aria-label'))) {
          card.setAttribute('aria-label', 'Open ' + cardCaption);
        }
      }

      var emptyThumb = card.querySelector('.keep-card__thumb--empty[role="img"]');
      if (emptyThumb) {
        var placeholderLabel = label ? label + ' photo coming soon' : 'Product photo coming soon';
        emptyThumb.setAttribute('aria-label', placeholderLabel);
      }
    }
  }

  function applyLegacySetupImages(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var images = scope.querySelectorAll('.setup-panorama img, .bd4 img, .column img, .column2 img');
    for (var i = 0; i < images.length; i += 1) {
      var img = images[i];
      var heading = closestHeadingText(img);
      var alt = buildAltText({
        existingAlt: img.getAttribute('alt'),
        title: '',
        context: heading || 'Owen Miner desk setup',
        src: img.getAttribute('src')
      });
      img.setAttribute('alt', alt);

      if (!img.closest('.keep-card') && !img.closest('.photography-tile')) {
        var caption = buildCaption({ title: heading, alt: alt });
        ensureCaptionElement(img, caption);
      }
    }
  }

  function describePhoto(photo, year) {
    var safePhoto = photo || {};
    return buildAltText({
      existingAlt: safePhoto.alt,
      title: safePhoto.title,
      context: year ? 'Owen Miner photo from ' + year : 'Owen Miner photo',
      src: safePhoto.full || safePhoto.thumb
    });
  }

  function captionPhoto(photo) {
    var safePhoto = photo || {};
    return buildCaption({
      caption: safePhoto.caption,
      title: safePhoto.title,
      alt: safePhoto.alt
    });
  }

  function init() {
    applySetupCards(document);
    applyLegacySetupImages(document);
  }

  var api = {
    buildAltText: buildAltText,
    buildCaption: buildCaption,
    applySetupCards: applySetupCards,
    applyLegacySetupImages: applyLegacySetupImages,
    describePhoto: describePhoto,
    captionPhoto: captionPhoto,
    init: init
  };

  global.AccessibleMedia = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
