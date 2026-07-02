/* ============================================================================
   MOTION — GSAP scroll choreography for the homepage.
   Loaded with defer after the GSAP + ScrollTrigger CDN scripts. Everything
   here is progressive enhancement: when GSAP fails to load (offline, CDN
   blocked) or the user prefers reduced motion, this file does nothing and
   the CSS rise-in cascade + vanilla ScrollAnimations in script.js take over.
   ============================================================================ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.gsap || reduceMotion) return;

  var gsap = window.gsap;
  if (window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
  }

  // Signal that GSAP owns entrances/reveals: the CSS hero cascade and the
  // vanilla ScrollAnimations/StatCounter in script.js check for this class.
  document.documentElement.classList.add('gsap-motion');

  var EASE = 'power3.out';

  // --------------------------------------------------------------------------
  // Hero entrance timeline
  // --------------------------------------------------------------------------
  var tl = gsap.timeline({ defaults: { ease: EASE, duration: 0.9 } });

  tl.from('.hero-label', { y: 26, opacity: 0 })
    .from('.hero-title', { y: 34, opacity: 0, scale: 0.97 }, '-=0.7')
    .from('.hero-subtitle', { y: 26, opacity: 0 }, '-=0.7')
    .from('.hero-cta-row .hero-cta', { y: 22, opacity: 0, stagger: 0.07 }, '-=0.65')
    .from('.stats-bar .stat-box', { y: 28, opacity: 0, stagger: 0.08 }, '-=0.6');

  // --------------------------------------------------------------------------
  // Stat counter — tween 0 → target when the stats bar enters the viewport
  // --------------------------------------------------------------------------
  document.querySelectorAll('.stat-count').forEach(function (el) {
    var target = parseInt(el.dataset.countTo, 10);
    if (!Number.isFinite(target)) return;
    var state = { value: 0 };
    gsap.to(state, {
      value: target,
      duration: 1.1,
      ease: 'power2.out',
      snap: { value: 1 },
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: function () {
        el.textContent = String(Math.round(state.value));
      }
    });
  });

  if (!window.ScrollTrigger) return;

  // --------------------------------------------------------------------------
  // Scroll-scrubbed parallax — hero content drifts up and fades as you scroll
  // past it; the aurora spotlight lags slightly behind for depth.
  // --------------------------------------------------------------------------
  gsap.to('.hero-inner', {
    y: -60,
    opacity: 0.35,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero-section',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  });

  // --------------------------------------------------------------------------
  // Batched staggered reveals for the content grids
  // --------------------------------------------------------------------------
  var revealSelectors = [
    '.section-header',
    '.featured-story',
    '.experience-card',
    '.metric-card',
    '.work-card',
    '.skill-card',
    '.contact-item'
  ].join(', ');

  var revealTargets = document.querySelectorAll(revealSelectors);
  if (revealTargets.length) {
    gsap.set(revealTargets, { y: 32, opacity: 0 });

    window.ScrollTrigger.batch(revealTargets, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: EASE,
          stagger: 0.09,
          overwrite: true,
          onComplete: function () {
            // Clear GSAP's inline transform so CSS hover lifts and the JS
            // card tilt aren't fighting a stale inline style.
            gsap.set(batch, { clearProps: 'transform,opacity' });
          }
        });
      }
    });

    // Anything already revealed on load (above the fold) shouldn't wait
    window.ScrollTrigger.refresh();
  }
})();
