/* ============================================================
   cinematicScroll.js — Premium Cinematic Scroll System  (v1)
   ────────────────────────────────────────────────────────────
   Transforms page scroll into a high-end, camera-like cinematic
   experience with multi-layer parallax, depth blur, floating
   glass cards, and smooth scrub-based section transitions.

   Requirements:
     • GSAP 3.x + ScrollTrigger (CDN)
     • Three.js background running on #three-canvas
     • Dark AI theme with glassmorphism (glass.css, main.css)

   Performance contract:
     • GPU-only transforms (translate3d, scale)
     • will-change hints applied/removed per section
     • Heavy parallax disabled below 768 px
     • All DOM refs cached at init time
     • requestAnimationFrame-safe (no forced layouts in loop)
   ============================================================ */

(function () {
    'use strict';

    /* ─── Guard: bail if GSAP / ScrollTrigger missing ─────── */
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        console.warn('[CinematicScroll] GSAP or ScrollTrigger not found — skipping.');
        return;
    }

    /* ─── Constants ───────────────────────────────────────── */
    const MOBILE_BP     = 768;
    const TABLET_BP     = 1024;
    const SCRUB_SMOOTH  = 1.2;          // seconds of smoothing on scrub
    const PARALLAX_EASE = 'none';       // linear for scroll-linked motion
    const REVEAL_EASE   = 'power3.out'; // entrance animations
    const STAGGER_GAP   = 0.10;         // seconds between staggered children

    /* ─── Cached DOM refs (populated in init) ─────────────── */
    const DOM = {};

    /* ─── Utility: safely query ────────────────────────────── */
    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

    /* ─── Utility: is desktop? ────────────────────────────── */
    function isDesktop() { return window.innerWidth > MOBILE_BP; }

    /* ==========================================================
       INIT — called once on DOMContentLoaded
       ========================================================== */
    function init() {
        gsap.registerPlugin(ScrollTrigger);

        cacheDOM();
        applyCinematicHints();

        /* Desktop-only heavy effects via GSAP matchMedia */
        ScrollTrigger.matchMedia({

            /* ── Desktop / Tablet (> 768 px) ──────────────── */
            '(min-width: 769px)': function () {
                buildHeroExit();
                buildMultiLayerParallax();
                buildSectionReveals();
                buildFloatingCards();
                buildDepthBlur();
                buildCTAEntrance();
            },

            /* ── Mobile (≤ 768 px) — lightweight only ─────── */
            '(max-width: 768px)': function () {
                buildSectionReveals();   // keep reveals, skip parallax
            }
        });

        console.log('%c🎬 CinematicScroll v1 ready', 'color:#00F0FF;font-weight:bold');
    }


    /* ==========================================================
       1  CACHE DOM
       ========================================================== */
    function cacheDOM() {
        DOM.hero          = $('#hero');
        DOM.heroContent   = $('.hero-content');
        DOM.heroVisual    = $('.hero-visual');
        DOM.heroGlow      = $('.hero-section::before') || null; // pseudo — handled via class
        DOM.heroGlowOrbs  = $('.hero-glow-orbs');
        DOM.heroScanBeam  = $('.hero-scan-beam');

        DOM.problem       = $('#problem');
        DOM.metrics       = $('#metrics');
        DOM.upload        = $('#upload');
        DOM.results       = $('#results');
        DOM.enterprise    = $('#enterprise');
        DOM.dashboard     = $('#dashboard');
        DOM.cta           = $('#cta');
        DOM.footer        = $('footer');

        DOM.threeCanvas   = $('#three-canvas');

        /* Collections for batch operations */
        DOM.sections      = $$('section');
        DOM.glassCards    = $$('.problem-card, .enterprise-card, .analytics-card-glass, .stat-card-glass, .stat-card-3d');
        DOM.sectionHeaders = $$('.section-header');
    }


    /* ==========================================================
       2  CINEMATIC HINTS — will-change + perspective parents
       ========================================================== */
    function applyCinematicHints() {
        /* Perspective wrapper for floating-card depth */
        DOM.glassCards.forEach(card => {
            const parent = card.parentElement;
            if (parent && !parent.style.perspective) {
                parent.style.perspective = '1200px';
            }
            card.style.willChange = 'transform, opacity';
        });

        /* Hero layers */
        if (DOM.heroContent) DOM.heroContent.style.willChange = 'transform, opacity';
        if (DOM.heroVisual)  DOM.heroVisual.style.willChange  = 'transform, opacity';
    }


    /* ==========================================================
       3  HERO EXIT — cinematic fade-scale-blur as user scrolls
       ========================================================== */
    function buildHeroExit() {
        if (!DOM.hero) return;

        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: DOM.hero,
                start:   'top top',
                end:     'bottom 20%',
                scrub:   SCRUB_SMOOTH,
                /* No pin — hero scrolls away naturally */
            }
        });

        /* Hero content fades + lifts + shrinks */
        if (DOM.heroContent) {
            tl.to(DOM.heroContent, {
                y:       -120,
                scale:   0.95,
                opacity: 0,
                ease:    PARALLAX_EASE,
            }, 0);
        }

        /* Hero visual (AI preview) — separate parallax rate */
        if (DOM.heroVisual) {
            tl.to(DOM.heroVisual, {
                y:       -60,
                scale:   0.96,
                opacity: 0,
                ease:    PARALLAX_EASE,
            }, 0);
        }

        /* Glow orbs intensify then fade */
        if (DOM.heroGlowOrbs) {
            tl.to(DOM.heroGlowOrbs, {
                opacity: 1.4,
                scale:   1.15,
                ease:    PARALLAX_EASE,
                duration: 0.4,
            }, 0)
            .to(DOM.heroGlowOrbs, {
                opacity: 0,
                ease:    PARALLAX_EASE,
                duration: 0.6,
            }, 0.4);
        }

        /* Scan beam fades out early */
        if (DOM.heroScanBeam) {
            tl.to(DOM.heroScanBeam, {
                opacity: 0,
                ease:    PARALLAX_EASE,
            }, 0);
        }
    }


    /* ==========================================================
       4  MULTI-LAYER DEPTH PARALLAX (4 layers)
       ──────────────────────────────────────────
       Layer 1 (background glow)   → scroll × 0.2
       Layer 2 (Three.js wrapper)  → scroll × 0.4
       Layer 3 (section headers)   → scroll × 0.6
       Layer 4 (cards / charts)    → scroll × 0.8
       ========================================================== */
    function buildMultiLayerParallax() {

        /* Layer 1 — Hero glow orbs (slowest) */
        if (DOM.heroGlowOrbs) {
            gsap.to(DOM.heroGlowOrbs, {
                yPercent: -20,
                ease: PARALLAX_EASE,
                scrollTrigger: {
                    trigger: DOM.hero,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                }
            });
        }

        /* Layer 2 — Three.js canvas subtle shift */
        if (DOM.threeCanvas) {
            gsap.to(DOM.threeCanvas, {
                y: () => window.innerHeight * 0.15,
                ease: PARALLAX_EASE,
                scrollTrigger: {
                    trigger: document.body,
                    start: 'top top',
                    end: 'bottom bottom',
                    scrub: true,
                }
            });
        }

        /* Layer 3 — Section headers (medium parallax per section) */
        DOM.sectionHeaders.forEach(header => {
            gsap.fromTo(header, {
                y: 40,
            }, {
                y: -20,
                ease: PARALLAX_EASE,
                scrollTrigger: {
                    trigger: header,
                    start: 'top 90%',
                    end: 'top 20%',
                    scrub: true,
                }
            });
        });

        /* Layer 4 — Glass cards micro-parallax */
        DOM.glassCards.forEach((card, i) => {
            /* Stagger the start slightly for wave-like feel */
            const offset = (i % 3) * 10;

            gsap.fromTo(card, {
                y: 30 + offset,
            }, {
                y: -10 - offset * 0.3,
                ease: PARALLAX_EASE,
                scrollTrigger: {
                    trigger: card,
                    start: 'top 95%',
                    end: 'top 15%',
                    scrub: true,
                }
            });
        });
    }


    /* ==========================================================
       5  SECTION REVEALS — cinematic stagger + scale pop
       ========================================================== */
    function buildSectionReveals() {

        const revealSections = [
            DOM.problem,
            DOM.metrics,
            DOM.upload,
            DOM.enterprise,
            DOM.dashboard,
            DOM.cta,
        ].filter(Boolean);

        revealSections.forEach(section => {
            /* Find direct children to stagger */
            const children = $$('.section-header, .problem-grid, .metrics-grid, ' +
                '.upload-container, .enterprise-grid, .analytics-grid, ' +
                '.section-overline, .section-title, .section-subtitle, ' +
                '[data-animate]', section);

            if (!children.length) return;

            /* Set initial state */
            gsap.set(children, {
                opacity: 0,
                y: 50,
                scale: 0.97,
            });

            ScrollTrigger.create({
                trigger: section,
                start: 'top 80%',
                once: true,
                onEnter: () => {
                    gsap.to(children, {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        duration: 0.9,
                        stagger: STAGGER_GAP,
                        ease: REVEAL_EASE,
                        clearProps: 'will-change',
                        onComplete: () => {
                            /* Clean up will-change after animation */
                            children.forEach(c => c.style.willChange = 'auto');
                        }
                    });
                }
            });
        });
    }


    /* ==========================================================
       6  FLOATING GLASS CARDS — scroll-linked 3D rotation
       ========================================================== */
    function buildFloatingCards() {

        DOM.glassCards.forEach(card => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: card,
                    start:  'top 90%',
                    end:    'top 30%',
                    scrub:  SCRUB_SMOOTH,
                }
            });

            tl.fromTo(card, {
                rotateX: 4,
                rotateY: -2,
                scale:   0.96,
                opacity: 0.5,
                boxShadow: '0 0 0px rgba(77,166,255,0)',
            }, {
                rotateX: 0,
                rotateY: 0,
                scale:   1,
                opacity: 1,
                boxShadow: '0 8px 40px rgba(77,166,255,0.08)',
                ease: PARALLAX_EASE,
            });
        });

        /* Viewport glow intensification — pulse when fully visible */
        DOM.glassCards.forEach(card => {
            ScrollTrigger.create({
                trigger: card,
                start: 'top 70%',
                end:   'bottom 30%',
                onEnter:     () => card.classList.add('cine-active'),
                onLeave:     () => card.classList.remove('cine-active'),
                onEnterBack: () => card.classList.add('cine-active'),
                onLeaveBack: () => card.classList.remove('cine-active'),
            });
        });
    }


    /* ==========================================================
       7  DEPTH-OF-FIELD BLUR SYSTEM — simulated camera focus
       ========================================================== */
    function buildDepthBlur() {
        const blurrableSections = [
            DOM.problem,
            DOM.metrics,
            DOM.upload,
            DOM.enterprise,
            DOM.dashboard,
            DOM.cta,
        ].filter(Boolean);

        /*
         * PERF NOTE: Using opacity-only transitions instead of filter:blur()
         * on section wrappers. CSS filter:blur() forces the browser to
         * rasterize the entire subtree (including children with their own
         * backdrop-filter) into an offscreen bitmap — extremely expensive.
         * Opacity is composited on the GPU for near-zero cost.
         */
        blurrableSections.forEach(section => {
            gsap.set(section, { opacity: 0.55 });

            ScrollTrigger.create({
                trigger: section,
                start:   'top 85%',
                end:     'bottom 15%',
                onEnter() {
                    gsap.to(section, {
                        opacity: 1,
                        duration: 0.7,
                        ease:    'power2.out',
                    });
                },
                onLeave() {
                    gsap.to(section, {
                        opacity: 0.6,
                        duration: 0.5,
                        ease:    'power2.in',
                    });
                },
                onEnterBack() {
                    gsap.to(section, {
                        opacity: 1,
                        duration: 0.7,
                        ease:    'power2.out',
                    });
                },
                onLeaveBack() {
                    gsap.to(section, {
                        opacity: 0.55,
                        duration: 0.5,
                        ease:    'power2.in',
                    });
                },
            });
        });

        /* Three.js background — subtle opacity reduction on scroll (no filter) */
        if (DOM.threeCanvas) {
            gsap.to(DOM.threeCanvas, {
                opacity: 0.5,
                ease: PARALLAX_EASE,
                scrollTrigger: {
                    trigger: document.body,
                    start: 'top top',
                    end: '30% top',
                    scrub: true,
                }
            });
        }
    }


    /* ==========================================================
       8  CTA ENTRANCE — dramatic final reveal
       ========================================================== */
    function buildCTAEntrance() {
        if (!DOM.cta) return;

        const children = $$('.section-overline, .section-title, .section-subtitle, .btn-primary', DOM.cta);
        if (!children.length) return;

        gsap.set(children, { opacity: 0, y: 60, scale: 0.94 });

        ScrollTrigger.create({
            trigger: DOM.cta,
            start: 'top 75%',
            once: true,
            onEnter: () => {
                gsap.to(children, {
                    opacity:  1,
                    y:        0,
                    scale:    1,
                    duration: 1,
                    stagger:  0.12,
                    ease:     'power4.out',
                });
            }
        });
    }


    /* ==========================================================
       9  SCROLL-VELOCITY GLOW — intensify ambient glow on fast scroll
       ========================================================== */
    (function velocityGlow() {
        let lastY = 0;
        let glowEl = null;
        let decayRaf = 0;

        function createGlowLayer() {
            glowEl = document.createElement('div');
            glowEl.className = 'cine-velocity-glow';
            glowEl.setAttribute('aria-hidden', 'true');
            document.body.appendChild(glowEl);
        }

        /*
         * PERF: Use passive scroll event instead of rAF loop.
         * The glow only needs updating when the user actually scrolls,
         * not 60 times a second when idle.
         */
        function onScroll() {
            const y = window.scrollY;
            const velocity = Math.abs(y - lastY);
            lastY = y;

            if (glowEl) {
                const intensity = Math.min(velocity / 60, 1);
                glowEl.style.opacity = intensity * 0.35;
            }

            /* Fade out after scrolling stops (single rAF, not a loop) */
            cancelAnimationFrame(decayRaf);
            decayRaf = requestAnimationFrame(() => {
                if (glowEl) glowEl.style.opacity = '0';
            });
        }

        /* Only on desktop */
        if (isDesktop()) {
            createGlowLayer();
            window.addEventListener('scroll', onScroll, { passive: true });
        }
    })();


    /* ==========================================================
       BOOTSTRAP
       ========================================================== */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
