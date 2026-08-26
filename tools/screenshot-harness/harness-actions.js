/*
 * Screenshot-harness only. Drives one scripted interaction from the query
 * string so each store screenshot is reproducible from a URL instead of a
 * hand-recorded click. It only dispatches the same events a user's click or
 * keystroke would; it does not change what the page does with them.
 *
 *   ?act=disclosure   press Start capture (raises the first-run consent modal)
 *   ?act=search       type "@example_account" into the Library search box
 *   ?act=album        expand the sample carousel inline
 *   ?act=videos       switch to the Videos tab
 *
 * Each action is a (do, done) pair and is retried until `done` reports true.
 * A fixed delay is not good enough: the pages bind listeners and populate from
 * asynchronous storage callbacks, and headless Chrome's --virtual-time-budget
 * compresses wall-clock timers unpredictably. Retrying until the effect is
 * observable is the only formulation that is reliable in both.
 */
(function () {
  'use strict';
  var act = (location.search.match(/[?&]act=([a-z]+)/) || [])[1];
  if (!act) return;

  var ACTIONS = {
    disclosure: {
      do: function () {
        var b = document.getElementById('capture-btn');
        if (b) b.click();
      },
      done: function () {
        var o = document.getElementById('consent-overlay');
        return !!o && !o.hidden;
      }
    },
    album: {
      do: function () {
        var b = document.querySelector('.carousel-indicator');
        if (b) b.click();
      },
      done: function () { return !!document.querySelector('.carousel-strip'); }
    },
    videos: {
      do: function () {
        var tabs = document.querySelectorAll('.tab');
        if (tabs[1]) tabs[1].click();
      },
      done: function () {
        var tabs = document.querySelectorAll('.tab');
        return !!tabs[1] && tabs[1].classList.contains('active');
      }
    },
    search: {
      do: function () {
        var i = document.getElementById('search-input');
        if (!i) return;
        i.value = '@example_account';
        i.dispatchEvent(new Event('input', { bubbles: true }));
      },
      // Typing into the box is not the effect worth waiting for — the filtered
      // grid is. gallery.js debounces the input, so assert on the card count.
      done: function () {
        var m = document.getElementById('search-meta');
        if (!m || m.hidden) return false;
        return document.querySelectorAll('.card').length <= 5;
      }
    }
  };

  var a = ACTIONS[act];
  if (!a) return;

  // Poll frequently but re-dispatch RARELY. gallery.js debounces the search
  // input; re-dispatching every tick kept resetting that debounce so it never
  // fired at all, and the grid stayed unfiltered while the box showed the
  // query. Dispatch, then leave the page alone long enough to react.
  var POLL_MS = 100;
  var REDISPATCH_EVERY = 12;   // ~1.2s, comfortably clear of the debounce
  var tries = 0;

  (function attempt() {
    if (a.done()) {
      document.documentElement.setAttribute('data-harness-ready', act);
      return;
    }
    if (tries > 150) return;
    if (tries % REDISPATCH_EVERY === 0) {
      try { a.do(); } catch (e) { /* keep polling */ }
    }
    tries++;
    setTimeout(attempt, POLL_MS);
  })();
})();
