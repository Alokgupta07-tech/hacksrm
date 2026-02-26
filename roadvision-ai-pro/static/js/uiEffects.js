/* ============================================================
   uiEffects.js — UI Effects & Micro-interactions  (v3)
   UIEffects (smooth scroll, nav, parallax, modals, loading)
   ScanningEffect, InvestorDemo
   ============================================================ */

/* ─── UIEffects ──────────────────────────────────────────── */
class UIEffects {
    constructor() {
        this._smoothScroll();
        this._navScrollBehavior();
        this._parallaxHero();
        this._glowCursor();
    }

    /* --- smooth anchor scroll --- */
    _smoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(a.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    /* Update active nav link */
                    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
                    a.classList.add('active');
                }
            });
        });
    }

    /* --- navbar blur/shrink on scroll --- */
    _navScrollBehavior() {
        const nav = document.getElementById('main-nav');
        if (!nav) return;

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrolled = window.scrollY > 60;
                    nav.classList.toggle('scrolled', scrolled);
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    /* --- parallax on hero section --- */
    /* DISABLED — cinematicScroll.js now handles hero parallax via GSAP ScrollTrigger.
       Keeping raw style.transform here would fight GSAP's inline transform.
    */
    _parallaxHero() {
        /* no-op: managed by CinematicScroll system */
    }

    /* --- subtle glow following cursor --- */
    _glowCursor() {
        const glow = document.createElement('div');
        glow.style.cssText = `
            position: fixed; width: 400px; height: 400px;
            border-radius: 50%; pointer-events: none; z-index: 0;
            background: radial-gradient(circle, rgba(77,166,255,0.04) 0%, transparent 70%);
            transform: translate(-50%, -50%);
            transition: left 0.3s ease-out, top 0.3s ease-out;
        `;
        document.body.appendChild(glow);
        this._glowEl = glow;

        window.addEventListener('mousemove', (e) => {
            glow.style.left = e.clientX + 'px';
            glow.style.top = e.clientY + 'px';
        }, { passive: true });
    }

    /* --- show modal --- */
    static showModal(id) {
        const modal = document.getElementById(id);
        const overlay = document.getElementById('modal-overlay');
        if (!modal) return;

        if (overlay) overlay.hidden = false;
        modal.hidden = false;

        requestAnimationFrame(() => {
            if (overlay) overlay.classList.add('visible');
            modal.classList.add('visible');
        });
    }

    /* --- hide modal --- */
    static hideModal(id) {
        const modal = document.getElementById(id);
        const overlay = document.getElementById('modal-overlay');

        if (modal) modal.classList.remove('visible');
        if (overlay) overlay.classList.remove('visible');

        setTimeout(() => {
            if (modal) modal.hidden = true;
            if (overlay) overlay.hidden = true;
        }, 300);
    }

    /* --- hide all modals --- */
    static hideAllModals() {
        document.querySelectorAll('.modal-card').forEach(m => {
            m.classList.remove('visible');
            setTimeout(() => { m.hidden = true; }, 300);
        });
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => { overlay.hidden = true; }, 300);
        }
    }

    /* --- show error --- */
    static showError(msg) {
        const el = document.getElementById('error-message');
        if (el) el.textContent = msg;
        UIEffects.showModal('error-modal');
    }

    /* --- show success --- */
    static showSuccess(msg) {
        const el = document.getElementById('success-message');
        if (el) el.textContent = msg;
        UIEffects.showModal('success-modal');
    }

    /* --- loading overlay --- */
    static showLoading() {
        const el = document.getElementById('scanning-overlay-full');
        if (el) {
            el.hidden = false;
            requestAnimationFrame(() => el.classList.add('visible'));
        }
    }

    static hideLoading() {
        const el = document.getElementById('scanning-overlay-full');
        if (el) {
            el.classList.remove('visible');
            setTimeout(() => { el.hidden = true; }, 400);
        }
    }

    /* --- counter animation (for hero stats, metrics) --- */
    static animateCounter(el, target, duration = 1200, suffix = '') {
        if (!el) return;
        const start = performance.now();
        const from = 0;
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 4);
            el.textContent = Math.round(from + (target - from) * ease) + suffix;
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
}


/* ─── Scanning Effect for Detection Canvas ───────────────── */
class ScanningEffect {
    constructor() {
        this.overlay = document.getElementById('scanning-overlay');
        this.fullOverlay = document.getElementById('scanning-overlay-full');
    }

    start() {
        if (this.overlay) {
            this.overlay.hidden = false;
            this.overlay.classList.add('active');
        }
        UIEffects.showLoading();
    }

    stop() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            setTimeout(() => { this.overlay.hidden = true; }, 400);
        }
        UIEffects.hideLoading();
    }
}


/* ─── Investor Demo — auto walkthrough flow ──────────────── */
class InvestorDemo {
    constructor() {
        this.steps = [
            { action: 'scrollToUpload', delay: 1000 },
            { action: 'simulateUpload', delay: 2000 },
            { action: 'simulateAnalysis', delay: 3000 },
            { action: 'showResults', delay: 2000 },
            { action: 'scrollToDashboard', delay: 2000 }
        ];
        this.isRunning = false;
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;

        for (const step of this.steps) {
            if (!this.isRunning) break;
            await this._delay(step.delay);
            await this[step.action]?.();
        }

        this.isRunning = false;
    }

    stop() {
        this.isRunning = false;
    }

    _delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    scrollToUpload() {
        document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
    }

    simulateUpload() {
        /* Show a mock preview */
        const preview = document.getElementById('upload-preview');
        const previewImg = document.getElementById('preview-image');
        const analyzeBtn = document.getElementById('analyze-btn');
        const uploadContent = document.querySelector('.upload-content');

        if (previewImg) {
            /* Use a placeholder gradient as mock image */
            previewImg.src = 'data:image/svg+xml,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">' +
                '<rect fill="#1a1a2e" width="640" height="480"/>' +
                '<text x="320" y="240" text-anchor="middle" fill="#4DA6FF" font-size="20">' +
                'Demo Road Image</text></svg>'
            );
        }
        if (preview) preview.hidden = false;
        if (uploadContent) uploadContent.style.display = 'none';
        if (analyzeBtn) analyzeBtn.disabled = false;
    }

    async simulateAnalysis() {
        const analyzeBtn = document.getElementById('analyze-btn');
        if (analyzeBtn) analyzeBtn.click();
    }

    showResults() {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
    }

    scrollToDashboard() {
        document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
    }
}
