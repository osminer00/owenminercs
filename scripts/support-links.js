(function () {
  function isHttpUrl(s) {
    return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
  }
  function apply(data) {
    if (!data || !isHttpUrl(data.ko_fi)) return;
    var url = data.ko_fi.trim();
    document.querySelectorAll('a[data-kofi-link]').forEach(function (a) {
      a.setAttribute('href', url);
    });
  }
  var path = '/donation-links.json';
  fetch(path, { credentials: 'same-origin' })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (data) {
      if (data) apply(data);
    })
    .catch(function () {});
})();
