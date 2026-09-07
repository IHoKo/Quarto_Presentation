<script>
// Three reveal.js integration fixes. All are load-bearing.
(function () {

  // =================================================================
  // 0. Stash the Mermaid sources NOW, at parse time.
  //
  //    Quarto's mermaid-init.js renders on `window load` and then
  //    *removes* the <pre> and appends an <svg> in its place, so the
  //    diagram source is gone by the time we could otherwise ask for
  //    it. This script sits at the end of <body>, which runs before
  //    any load handler, so the <pre> elements are still intact here.
  // =================================================================
  var mermaidStash = [];
  Array.prototype.forEach.call(
    document.querySelectorAll('pre.mermaid-js'),
    function (el) {
      mermaidStash.push({
        parent: el.parentElement,
        src: el.textContent.split('&nbsp;').join(' '),
        done: false
      });
    }
  );

  function init() {
    if (!window.Reveal) { return; }

    // ---------------------------------------------------------------
    // 1. Plotly measures its container on creation. Inside a reveal
    //    slide that is still hidden, that container is 0px wide, so the
    //    chart renders as a sliver and stays that way. Re-measure every
    //    plot on the slide we just landed on.
    // ---------------------------------------------------------------
    function resizePlots(ev) {
      var slide = (ev && ev.currentSlide) || Reveal.getCurrentSlide();
      if (!slide || !window.Plotly) { return; }
      var plots = slide.querySelectorAll('.plotly-graph-div');
      for (var i = 0; i < plots.length; i++) {
        try { Plotly.Plots.resize(plots[i]); } catch (e) { /* not drawn yet */ }
      }
    }

    // Run on arrival, then again on the next frame: Plotly sometimes
    // finishes its own layout pass after slidechanged fires.
    function resizeTwice(ev) {
      resizePlots(ev);
      requestAnimationFrame(function () { resizePlots(ev); });
      setTimeout(function () { resizePlots(ev); }, 250);
    }

    Reveal.on('ready', resizeTwice);
    Reveal.on('slidechanged', resizeTwice);
    Reveal.on('overviewhidden', resizeTwice);
    window.addEventListener('resize', function () { resizePlots(); });

    // ---------------------------------------------------------------
    // 2. On a `background-interactive` slide reveal hands pointer events
    //    to the iframe, which then swallows clicks meant for the escape
    //    hatch. Re-assert them on the overlay whenever we land there.
    // ---------------------------------------------------------------
    function claimOverlay() {
      var els = document.querySelectorAll('.demo-overlay, .demo-overlay a');
      for (var i = 0; i < els.length; i++) {
        els[i].style.pointerEvents = 'auto';
      }
    }
    Reveal.on('ready', claimOverlay);
    Reveal.on('slidechanged', claimOverlay);

    // ---------------------------------------------------------------
    // 3. Decorative: a slow digit drift on the title slide's tape, so
    //    the deck opens on something that looks alive. No network, no
    //    market data — it is scenery, and it says so in the notes.
    // ---------------------------------------------------------------
    var tape = document.querySelectorAll('[data-tick]');
    if (tape.length) {
      setInterval(function () {
        for (var i = 0; i < tape.length; i++) {
          var el = tape[i];
          var base = parseFloat(el.getAttribute('data-tick'));
          if (isNaN(base)) { continue; }
          var drift = (Math.random() - 0.5) * base * 0.004;
          el.textContent = (base + drift).toFixed(2);
          el.style.color = drift >= 0 ? '#2f7d6e' : '#a8442f';
        }
      }, 1400);
    }
  }

  // =================================================================
  // 4. Re-render every Mermaid diagram, correctly this time.
  //
  //    Quarto calls mermaid.mermaidAPI.render(id, text, el) with `el`
  //    being the <pre> *inside a reveal slide that is display:none*.
  //    Mermaid measures each label in that hidden subtree, gets
  //    nonsense widths, and sizes every node box to match — which is
  //    why labels came out clipped mid-word ("Finnhub sock", a 58px
  //    box around 110px of text).
  //
  //    Calling mermaid.render() with NO container makes mermaid use its
  //    own temporary node attached to the visible body, so text is
  //    measured for real. We also wait for document.fonts so the
  //    measurement uses Instrument Sans rather than a fallback.
  // =================================================================
  // Tallest a diagram may be. Slides are 900px in a 1600x900 deck, and the
  // heading + kicker take roughly a third of that.
  var MAX_H = '58vh';

  function reRenderMermaid() {
    if (!window.mermaid || !mermaidStash.length) { return; }

    var seq = 0;
    mermaidStash.forEach(function (entry) {
      if (entry.done || !entry.parent) { return; }
      entry.done = true;
      try {
        // mermaid 11 returns a promise; older builds return a string.
        var out = mermaid.render('mmd-remeasured-' + (++seq), entry.src);
        Promise.resolve(out).then(function (res) {
          var markup = (res && res.svg) ? res.svg : res;
          if (!markup) { return; }
          var holder = document.createElement('div');
          holder.innerHTML = markup;
          var fresh = holder.querySelector('svg');
          if (!fresh) { return; }
          fresh.classList.add('mermaid-js');
          // Size it from its own viewBox ratio. Capping width alone (rather
          // than letting max-height letterbox it) keeps a tall diagram from
          // overflowing its grid column and crushing the column beside it.
          fresh.removeAttribute('width');
          fresh.removeAttribute('height');
          var vb = (fresh.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
          fresh.style.width = '100%';
          fresh.style.height = 'auto';
          if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
            var ratio = (vb[2] / vb[3]).toFixed(4);
            fresh.style.maxWidth = 'min(100%, calc(' + MAX_H + ' * ' + ratio + '))';
          } else {
            fresh.style.maxWidth = '100%';
          }
          fresh.style.maxHeight = MAX_H;
          var old = entry.parent.querySelector('svg');
          if (old) { entry.parent.replaceChild(fresh, old); }
          else { entry.parent.appendChild(fresh); }
        }).catch(function () { /* keep Quarto's original render */ });
      } catch (e) { /* keep Quarto's original render */ }
    });
  }

  // Quarto's own handler is async, so wait until it has swapped every
  // <pre> for an <svg> before replacing them. Poll, with a deadline.
  function whenQuartoMermaidDone(cb) {
    var deadline = Date.now() + 8000;
    (function poll() {
      var pending = mermaidStash.some(function (e) {
        return e.parent && !e.parent.querySelector('svg');
      });
      if (!pending || Date.now() > deadline) { cb(); }
      else { setTimeout(poll, 100); }
    })();
  }

  function start() {
    init();
    if (!mermaidStash.length) { return; }
    var fonts = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();
    fonts.then(function () { whenQuartoMermaidDone(reRenderMermaid); });
  }

  if (document.readyState === 'complete') { start(); }
  else { window.addEventListener('load', start); }
})();
</script>
