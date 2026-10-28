/*
 * AKTIVO — API bridge
 * Talks to the Apps Script backend (config.js → API_URL) with fetch().
 * It exposes the same interface as Apps Script's google.script.run, so the
 * page code works unchanged:
 *     google.script.run.withSuccessHandler(ok).withFailureHandler(fail).someServerFunction(a, b)
 *
 * Requests are sent as text/plain POST ("simple" CORS request, no preflight),
 * which is what Apps Script web apps support.
 */
(function () {
  'use strict';
  var cfg = window.AKTIVO_CONFIG || {};
  var TIMEOUT_MS = 45000;

  /* ---------- Clickjacking guard: dashboard & presenter must not be framed ---------- */
  var page = document.documentElement.getAttribute('data-page');
  if (window.top !== window.self && page !== 'index') {
    try { window.top.location.replace(window.self.location.href); }
    catch (e) { document.documentElement.style.display = 'none'; }
  }

  /* ---------- Site URLs (computed from where the site is hosted) ---------- */
  var base = location.href.split('#')[0].split('?')[0].replace(/[^\/]*$/, '');
  window.AK_SITE = {
    base: base,
    home: base,
    host: function (sessionId) { return base + 'host.html' + (sessionId ? '?s=' + encodeURIComponent(sessionId) : ''); },
    presenter: function (sessionId) { return base + 'presenter.html' + (sessionId ? '?s=' + encodeURIComponent(sessionId) : ''); },
    join: function (code) { return base + (code ? '?code=' + encodeURIComponent(code) : ''); }
  };

  // Logo used by akSetLogo() (the Apps Script version used a base64 constant)
  window.AKTIVO_LOGO_DATA_URI = 'assets/img/logo.png';

  /* ---------- Transport ---------- */
  function call(fn, args, ok, fail) {
    var done = false;
    var finish = function (cb, val) { if (done) return; done = true; if (cb) cb(val); };
    if (!cfg.API_URL || !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(cfg.API_URL)) {
      setTimeout(function () { finish(fail, new Error('CONFIG: API_URL in config.js is missing or is not an Apps Script /exec URL.')); }, 0);
      return;
    }
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
      finish(fail, new Error('TIMEOUT: The server took too long to respond.'));
    }, TIMEOUT_MS);

    fetch(cfg.API_URL, {
      method: 'POST',
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP_' + r.status);
        return r.text();
      })
      .then(function (text) {
        clearTimeout(timer);
        var res;
        try { res = JSON.parse(text); }
        catch (e) {
          // Apps Script returns an HTML page when the deployment is not public or the URL is wrong.
          throw new Error('BAD_RESPONSE: The server did not return JSON. Check that the Apps Script deployment is shared with "Anyone".');
        }
        if (res && res.ok) finish(ok, res.result);
        else finish(fail, new Error((res && res.error) || 'Server error'));
      })
      .catch(function (err) {
        clearTimeout(timer);
        finish(fail, err instanceof Error ? err : new Error(String(err)));
      });
  }

  function runner(ok, fail) {
    return new Proxy({}, {
      get: function (_, name) {
        if (name === 'withSuccessHandler') return function (f) { return runner(f, fail); };
        if (name === 'withFailureHandler') return function (f) { return runner(ok, f); };
        if (typeof name !== 'string') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments).map(function (a) { return a === undefined ? null : a; });
          call(name, args, ok, fail);
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = { run: runner(null, null) };

  /* Public config from the server (e.g. whether registration needs an invitation code). Cached per tab. */
  window.akPublicConfig = function (cb) {
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem('aktivo_public_config') || 'null'); } catch (e) {}
    if (cached) { cb(cached); return; }
    call('getPublicConfig', [], function (res) {
      try { sessionStorage.setItem('aktivo_public_config', JSON.stringify(res)); } catch (e) {}
      cb(res || {});
    }, function () { cb({}); });
  };
})();
