/* ============================================================
   aiPreviewRenderer.js — Live AI Detection Preview  (v6)

   Renders a simulated road-surface analysis inside the hero
   panel with animated bounding boxes, confidence labels,
   severity badges, and a continuous GSAP scan-line.

   v6 — complete rewrite fixing:
   • Zone-based box placement (guaranteed zero overlap)
   • Fresh dimension measurement every cycle (no stale w/h)
   • Deferred init — waits for hero GSAP entrance to finish
   • No <canvas> fallback — uses CSS background (no dark square)
   • Labels inside boxes (no vertical clipping above viewport)
   • Road textures via RoadTextureGenerator with Ken Burns zoom
   ============================================================ */

class AIPreviewRenderer {
    constructor(containerId = 'ai-preview-viewport') {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        /* UI references */
        this.scanline   = this.container.querySelector('.ai-preview-scanline');
        this.statusText = document.getElementById('ai-preview-status');
        this.countBadge = document.getElementById('ai-preview-count');
        this.fpsBadge   = document.getElementById('ai-preview-fps');

        /* State */
        this.isRunning        = false;
        this.texturesReady    = false;
        this.currentImageIndex = 0;
        this.roadImages       = [];
        this.bgElements       = [];   // 2 × <img> for crossfade
        this.overlayEl        = null;
        this.cycleTl          = null;  // GSAP master timeline
        this.cycleTimer       = null;
        this.frameCount       = 0;
        this.lastFpsTime      = performance.now();
        this.w = 0;
        this.h = 0;

        /* Detection templates */
        this.mockDetections = [
            { label: 'Longitudinal Crack', minConf: 85, maxConf: 97, severity: 'high' },
            { label: 'Alligator Crack',    minConf: 78, maxConf: 95, severity: 'high' },
            { label: 'Transverse Crack',   minConf: 80, maxConf: 94, severity: 'medium' },
            { label: 'Pothole',            minConf: 88, maxConf: 99, severity: 'high' },
            { label: 'Edge Crack',         minConf: 72, maxConf: 89, severity: 'medium' },
            { label: 'Surface Wear',       minConf: 65, maxConf: 82, severity: 'low' },
            { label: 'Patching',           minConf: 70, maxConf: 88, severity: 'low' },
        ];

        this.prefersReducedMotion =
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* Defer heavy init until the hero entrance animation has cleared
           and the element has stable layout dimensions. */
        this._deferredBoot();
    }

    /* ─── Deferred Boot ───────────────────────────────────── */
    _deferredBoot() {
        /* Wait 2 s — long enough for the hero GSAP entrance
           (badge 0.3s delay + titles 0.8s + visual 1s ≈ 1.6s)     */
        const BOOT_DELAY = 2000;
        setTimeout(() => {
            try { this._init(); }
            catch (e) { console.warn('[AIPreview] _init crashed:', e); }
        }, BOOT_DELAY);
    }

    /* ─── Initialise (called after hero animation settles) ── */
    _init() {
        this._measure();

        /* If container has no layout yet, retry up to 3 times */
        if (!this.w || !this.h || this.w < 30 || this.h < 30) {
            this._retryCount = (this._retryCount || 0) + 1;
            if (this._retryCount <= 3) {
                console.warn('[AIPreview] Container has 0 dimensions, retry', this._retryCount);
                setTimeout(() => this._init(), 800);
                return;
            }
        }

        this._createBgLayers();
        this._startScanline();
        this._generateRoadTextures();

        this.isRunning = true;
        this._trackFPS();
    }

    /* ─── Measure container (called every cycle) ──────────── */
    _measure() {
        const rect = this.container.getBoundingClientRect();
        this.w = rect.width  || this.container.clientWidth  || 0;
        this.h = rect.height || this.container.clientHeight || 0;
    }

    /* ─── Create background image + overlay DOM layers ────── */
    _createBgLayers() {
        /* Transparent 1×1 pixel to avoid broken-image icon */
        const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        /* Two <img> elements for seamless crossfade */
        for (let i = 0; i < 2; i++) {
            const img = document.createElement('img');
            img.className = 'ai-road-bg';
            img.alt = '';
            img.draggable = false;
            img.src = BLANK;
            this.container.prepend(img);
            this.bgElements.push(img);
        }

        /* Dark overlay with vignette */
        this.overlayEl = document.createElement('div');
        this.overlayEl.className = 'ai-road-overlay';
        /* Insert after imgs, before scanline */
        if (this.scanline) {
            this.container.insertBefore(this.overlayEl, this.scanline);
        } else {
            this.container.appendChild(this.overlayEl);
        }
    }

    /* ─── Generate road textures ──────────────────────────── */
    async _generateRoadTextures() {
        if (typeof RoadTextureGenerator === 'undefined') {
            this._startLegacyCycle();
            return;
        }

        if (this.statusText) this.statusText.textContent = 'Loading textures…';

        try {
            this._measure();
            const texW = Math.min(Math.round(this.w * 1.5), 960);
            const texH = Math.min(Math.round(this.h * 1.5), 720);

            const gen  = new RoadTextureGenerator(
                Math.max(texW, 320),
                Math.max(texH, 240)
            );
            this.roadImages = await gen.generateAll(6);
            this.texturesReady = true;
            this._startSyncedCycle();
        } catch (err) {
            console.warn('[AIPreview] Texture gen failed:', err);
            this._startLegacyCycle();
        }
    }

    /* ─── GSAP-synced image + detection cycle ─────────────── */
    _startSyncedCycle() {
        this.currentImageIndex = 0;
        this._runOneCycle();
    }

    _runOneCycle() {
        if (!this.isRunning) return;

        /* Fresh measurement every cycle */
        this._measure();

        const imgIdx  = this.currentImageIndex % this.roadImages.length;
        const nextIdx = (this.currentImageIndex + 1) % this.roadImages.length;

        const frontBg = this.bgElements[imgIdx % 2];
        const backBg  = this.bgElements[(imgIdx + 1) % 2];

        frontBg.src = this.roadImages[imgIdx];
        if (this.roadImages[nextIdx]) backBg.src = this.roadImages[nextIdx];

        this._clearBoxes();
        if (this.statusText) this.statusText.textContent = 'Scanning…';

        const zoomDuration = this.prefersReducedMotion ? 0 : 5.5;
        const zoomScale    = this.w < 360 ? 1.03 : 1.08;

        if (typeof gsap === 'undefined') {
            this._startLegacyCycle();
            return;
        }

        if (this.cycleTl) this.cycleTl.kill();

        this.cycleTl = gsap.timeline({
            onComplete: () => {
                this.currentImageIndex++;
                this._runOneCycle();
            }
        });

        /* Crossfade in */
        this.cycleTl.to(frontBg, { opacity: 1, duration: 0.8, ease: 'power2.inOut' }, 0);
        this.cycleTl.to(backBg,  { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 0.1);

        /* Ken Burns zoom */
        if (zoomDuration > 0) {
            gsap.set(frontBg, { scale: 1 });
            this.cycleTl.to(frontBg, { scale: zoomScale, duration: zoomDuration, ease: 'none' }, 0);
        }

        /* Generate detections at t=1 s */
        this.cycleTl.call(() => this._generateDetections(), null, 1.0);

        /* Fade out near end */
        const fadeStart = zoomDuration > 0 ? zoomDuration - 0.6 : 4.5;
        this.cycleTl.to(frontBg, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, fadeStart);

        /* Clear boxes just before next */
        this.cycleTl.call(() => this._clearBoxes(), null, fadeStart + 0.3);
    }

    /* ─── Legacy cycle (no road images) ───────────────────── */
    _startLegacyCycle() {
        this._measure();
        this._generateDetections();
        this.cycleTimer = setInterval(() => {
            this._measure();
            this._generateDetections();
        }, 4000 + Math.random() * 1500);
    }

    /* ─── Scanline ────────────────────────────────────────── */
    _startScanline() {
        if (!this.scanline) return;
        this.scanline.classList.add('active');
    }

    /* ─── Clear bounding boxes ────────────────────────────── */
    _clearBoxes() {
        this.container.querySelectorAll('.ai-bbox').forEach(el => {
            if (typeof gsap !== 'undefined') {
                gsap.to(el, { opacity: 0, scale: 0.92, duration: 0.2,
                    onComplete: () => el.remove() });
            } else {
                el.remove();
            }
        });
    }

    /* ─── Zone-based detection placement ──────────────────── */
    _generateDetections() {
        if (this.statusText) this.statusText.textContent = 'Scanning…';

        const w = this.w;
        const h = this.h;

        /* Bail if container not laid out yet */
        if (!w || !h || w < 50 || h < 50) return;

        /* Decide count: 2-4 */
        const count = 2 + Math.floor(Math.random() * 3);

        /* ── Zone strategy ────────────────────────────────
           Divide viewport into a grid, pick `count` unique cells,
           place one box per cell with random jitter.            */
        const COLS = 3;
        const ROWS = 2;
        const cellW = w / COLS;
        const cellH = h / ROWS;
        const PADDING = 10;

        /* Build shuffled list of cell indices (Fisher-Yates) */
        const cells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                cells.push({ col: c, row: r });
            }
        }
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
        }

        /* Pick first `count` cells */
        const chosen = cells.slice(0, Math.min(count, cells.length));

        /* Create boxes with stagger */
        chosen.forEach((cell, i) => {
            setTimeout(() => {
                if (!this.isRunning) return;
                this._addBoundingBox(cell, cellW, cellH, PADDING, i);

                if (i === chosen.length - 1) {
                    if (this.statusText) this.statusText.textContent = 'Live Analysis';
                    if (this.countBadge) this.countBadge.textContent = chosen.length + ' detected';
                }
            }, i * 260);
        });
    }

    /* ─── Add single bounding box ─────────────────────────── */
    _addBoundingBox(cell, cellW, cellH, pad, index) {
        const template = this.mockDetections[
            Math.floor(Math.random() * this.mockDetections.length)
        ];
        const conf = template.minConf +
            Math.floor(Math.random() * (template.maxConf - template.minConf));

        /* Box size: 50-80 % of cell, respecting padding */
        const maxBW = cellW - pad * 2;
        const maxBH = cellH - pad * 2;
        const bw = Math.round(maxBW * (0.50 + Math.random() * 0.30));
        const bh = Math.round(maxBH * (0.45 + Math.random() * 0.30));

        /* Position: cell origin + padding + random jitter */
        const cellLeft = cell.col * cellW;
        const cellTop  = cell.row * cellH;
        const jitterX  = Math.random() * Math.max(maxBW - bw, 0);
        const jitterY  = Math.random() * Math.max(maxBH - bh, 0);
        const left = Math.round(cellLeft + pad + jitterX);
        const top  = Math.round(cellTop  + pad + jitterY);

        /* DOM */
        const box = document.createElement('div');
        box.className = `ai-bbox severity-${template.severity}`;
        box.style.cssText =
            `left:${left}px;top:${top}px;width:${bw}px;height:${bh}px;`;

        /* Label INSIDE the box (top-left, inside border) */
        const label = document.createElement('span');
        label.className = 'ai-bbox-label';
        label.textContent = `${template.label} ${conf}%`;
        box.appendChild(label);

        this.container.appendChild(box);

        /* GSAP entrance */
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(box,
                { opacity: 0, scale: 0.85 },
                { opacity: 1, scale: 1, duration: 0.4,
                  ease: 'back.out(1.4)', delay: index * 0.06 });
        }
    }

    /* ─── FPS tracker ─────────────────────────────────────── */
    _trackFPS() {
        const loop = () => {
            if (!this.isRunning) return;
            this.frameCount++;
            const now = performance.now();
            if (now - this.lastFpsTime >= 1000) {
                if (this.fpsBadge) {
                    this.fpsBadge.textContent = this.frameCount + ' FPS';
                }
                this.frameCount = 0;
                this.lastFpsTime = now;
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    /* ─── Cleanup ─────────────────────────────────────────── */
    destroy() {
        this.isRunning = false;
        if (this.cycleTimer) clearInterval(this.cycleTimer);
        if (this.cycleTl) this.cycleTl.kill();
        this._clearBoxes();
        this.bgElements.forEach(img => img.remove());
        if (this.overlayEl) this.overlayEl.remove();
    }
}
