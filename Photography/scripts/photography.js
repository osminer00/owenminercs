(function () {
  'use strict';

  var galleryEl = document.getElementById('photography-gallery');
  var emptyEl = document.getElementById('photography-empty');
  var errEl = document.getElementById('photography-error');
  var dialog = document.getElementById('photo-dialog');
  if (!galleryEl || !dialog) return;

  var dlgImg = document.getElementById('photo-dialog-img');
  var dlgTitle = document.getElementById('photo-dialog-title');
  var dlgDate = document.getElementById('photo-dialog-date');
  var dlgLicense = document.getElementById('photo-dialog-license');
  var dlgDownload = document.getElementById('photo-dialog-download');
  var dlgPrint = document.getElementById('photo-dialog-print');
  var dlgClose = document.getElementById('photo-dialog-close');

  var config = { signedPrintDefaultUrl: '', freeUseNote: '' };
  var lastFocus = null;

  function formatDateTaken(iso) {
    if (!iso || typeof iso !== 'string') return 'Date unknown';
    var d = new Date(iso.trim());
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function downloadBasename(photo) {
    if (photo.downloadFilename && String(photo.downloadFilename).trim()) {
      return String(photo.downloadFilename).trim();
    }
    var base = (photo.title || 'photo').replace(/[^\w\-]+/g, '-').replace(/^-|-$/g, '') || 'photo';
    var full = photo.full || '';
    var m = /\.([a-z0-9]+)$/i.exec(full.split('?')[0]);
    var ext = m ? m[1].toLowerCase() : 'jpg';
    return base + '.' + ext;
  }

  function openDialog(photo) {
    lastFocus = document.activeElement;
    dlgImg.src = photo.full || photo.thumb || '';
    dlgImg.alt = photo.alt || photo.title || '';
    dlgTitle.textContent = photo.title || 'Untitled';
    dlgDate.textContent = 'Taken: ' + formatDateTaken(photo.dateTaken);
    dlgLicense.textContent = config.freeUseNote || '';

    dlgDownload.href = photo.full || photo.thumb || '#';
    dlgDownload.setAttribute('download', downloadBasename(photo));

    var printUrl;
    if (Object.prototype.hasOwnProperty.call(photo, 'signedPrintUrl') && photo.signedPrintUrl != null) {
      printUrl = String(photo.signedPrintUrl).trim();
    } else {
      printUrl = (config.signedPrintDefaultUrl || '').trim();
    }
    if (printUrl) {
      dlgPrint.href = printUrl;
      dlgPrint.hidden = false;
    } else {
      dlgPrint.hidden = true;
    }

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
    dlgClose.focus();
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') {
      dialog.close();
    }
    dlgImg.removeAttribute('src');
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  dlgClose.addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', function (e) {
    e.preventDefault();
    closeDialog();
  });
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) closeDialog();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) closeDialog();
  });

  function renderYearSection(year, photos) {
    var section = document.createElement('section');
    section.className = 'photography-year';
    var h2 = document.createElement('h2');
    h2.textContent = String(year);
    section.appendChild(h2);

    var grid = document.createElement('div');
    grid.className = 'photography-grid';

    photos.forEach(function (photo) {
      var generatedAlt = window.AccessibleMedia && typeof window.AccessibleMedia.describePhoto === 'function'
        ? window.AccessibleMedia.describePhoto(photo, year)
        : (photo.alt || photo.title || '');
      var generatedCaption = window.AccessibleMedia && typeof window.AccessibleMedia.captionPhoto === 'function'
        ? window.AccessibleMedia.captionPhoto({ title: photo.title, alt: generatedAlt, caption: photo.caption })
        : (photo.title || '');

      if (!photo.alt || !String(photo.alt).trim()) {
        photo.alt = generatedAlt;
      }
      if (!photo.title || !String(photo.title).trim()) {
        photo.title = generatedCaption;
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photography-tile';
      btn.setAttribute('aria-label', 'Open: ' + (generatedCaption || photo.title || 'photo'));

      var img = document.createElement('img');
      img.src = photo.thumb || photo.full || '';
      img.alt = generatedAlt;
      img.loading = 'lazy';
      btn.appendChild(img);

      var cap = document.createElement('span');
      cap.className = 'photography-tile-caption';
      cap.textContent = generatedCaption || photo.title || '';
      btn.appendChild(cap);

      btn.addEventListener('click', function () {
        openDialog(photo);
      });
      grid.appendChild(btn);
    });

    section.appendChild(grid);
    return section;
  }

  fetch('photos.json')
    .then(function (r) {
      if (!r.ok) throw new Error('Could not load photos.json');
      return r.json();
    })
    .then(function (data) {
      config.signedPrintDefaultUrl = data.signedPrintDefaultUrl || '';
      config.freeUseNote = data.freeUseNote || '';

      var years = Array.isArray(data.years) ? data.years.slice() : [];
      years.sort(function (a, b) {
        return Number(b.year) - Number(a.year);
      });

      var total = 0;
      years.forEach(function (y) {
        var list = Array.isArray(y.photos) ? y.photos : [];
        if (!list.length) return;
        total += list.length;
        galleryEl.appendChild(renderYearSection(y.year, list));
      });

      if (total === 0) {
        if (emptyEl) emptyEl.hidden = false;
      } else if (emptyEl) {
        emptyEl.hidden = true;
      }
    })
    .catch(function () {
      if (errEl) errEl.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
    });
})();
