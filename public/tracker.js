/*
 * Vaney Media — site tracker
 * Include this once, near the end of <body>, on vaneymedia.com:
 *
 *   <script src="https://YOUR-ADMIN-PROJECT.vercel.app/tracker.js"></script>
 *
 * The API base URL is read automatically from this script's own <src>, so
 * no other config is needed. To record a conversion event from a button,
 * call the global helper, e.g.:
 *
 *   <button onclick="vaneyTrack('add_to_cart')">Add to cart</button>
 *
 * Recognized event names: add_to_cart, checkout_start, contact_submit,
 * newsletter_signup, video_play.
 */
(function () {
  var scriptEl = document.currentScript;
  var API_BASE = scriptEl ? scriptEl.src.replace(/\/tracker\.js.*$/, '') : '';
  if (!API_BASE) return;

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var visitorId = localStorage.getItem('vaney_vid');
  var isNewVisitor = false;
  if (!visitorId) {
    visitorId = uuid();
    localStorage.setItem('vaney_vid', visitorId);
    isNewVisitor = true;
  }

  var sessionId = sessionStorage.getItem('vaney_sid');
  var isNewSession = false;
  if (!sessionId) {
    sessionId = uuid();
    sessionStorage.setItem('vaney_sid', sessionId);
    isNewSession = true;
  }

  function send(event, extra) {
    var payload = Object.assign(
      {
        event: event,
        path: location.pathname + location.hash,
        referrer: document.referrer || '',
        sessionId: sessionId,
        isNewSession: isNewSession,
        isNewVisitor: isNewVisitor,
      },
      extra || {}
    );
    // Only the first event of the session counts as the session's start.
    isNewSession = false;

    try {
      var body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API_BASE + '/api/track', new Blob([body], { type: 'application/json' }));
      } else {
        fetch(API_BASE + '/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true,
        }).catch(function () {});
      }
    } catch (e) {
      /* tracking must never break the page */
    }
  }

  send('pageview');
  window.addEventListener('hashchange', function () {
    send('pageview');
  });

  // Lightweight heartbeat so "on site now" stays accurate without inflating
  // page view counts.
  setInterval(function () {
    send('ping');
  }, 45000);

  window.vaneyTrack = function (name) {
    send(name);
  };
})();
