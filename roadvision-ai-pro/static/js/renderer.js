/**
 * RoadVision AI Pro — Detection Renderer  (v2)
 *
 * Fixes bounding-box misalignment by properly scaling coordinates
 * from original image space to the CSS-displayed canvas size.
 *
 * Key changes from v1:
 *  - Canvas buffer always matches getBoundingClientRect() of its wrapper
 *  - scaleX / scaleY computed from original → displayed dimensions
 *  - Handles both pixel coords AND normalised (0–1) coords
 *  - ResizeObserver keeps canvas in sync with responsive layout
 *  - drawDetections(detections) accepts array (app.js compatible API)
 *  - 3D view, scanning overlay, and labels remain untouched
 */

class DetectionRenderer {
    constructor() {
        this.canvas         = document.getElementById('detection-canvas');
        this.threeContainer = document.getElementById('three-viz-container');
        this.ctx            = this.canvas ? this.canvas.getContext('2d') : null;
        this.wrapper        = this.canvas ? this.canvas.parentElement : null;   // .viz-wrapper

        this.image      = null;       // loaded Image element
        this.origW      = 0;          // original image width  (pixels the model saw)
        this.origH      = 0;          // original image height
        this.detections = [];
        this.viewMode   = '2d';

        /* Animation state */
        this.animationProgress = 0;
        this.isAnimating       = false;
        this._rafId            = null;

        /* Three.js for 3D mode */
        this.threeScene    = null;
        this.threeCamera   = null;
        this.threeRenderer = null;
        this.crackMeshes   = [];

        this._init();
    }

    /* ────────────────────────────────────────────────────── */
    /*  Initialisation                                        */
    /* ────────────────────────────────────────────────────── */
    _init() {
        if (!this.canvas || !this.wrapper) return;

        /* Initial sync */
        this._syncCanvasSize();

        /* ResizeObserver — efficient, fires only when wrapper size changes */
        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(() => {
                this._syncCanvasSize();
                if (this.image) this._render();
            });
            this._ro.observe(this.wrapper);
        }

        /* Fallback: window resize (covers orientation-change etc.) */
        window.addEventListener('resize', () => {
            this._syncCanvasSize();
            if (this.image) this._render();
        });
    }

    /* ────────────────────────────────────────────────────── */
    /*  Canvas ↔ Display Sync                                 */
    /*                                                        */
    /*  The CSS rule `width:100%; height:100%` stretches the  */
    /*  <canvas> element inside .viz-wrapper, but the buffer  */
    /*  resolution (canvas.width / canvas.height) must be set */
    /*  explicitly so drawing is 1:1 with displayed pixels.   */
    /* ────────────────────────────────────────────────────── */
    _syncCanvasSize() {
        if (!this.canvas || !this.wrapper) return;
        const rect = this.wrapper.getBoundingClientRect();
        const dpr  = Math.min(window.devicePixelRatio || 1, 2); // cap at 2× for perf

        const displayW = Math.round(rect.width);
        const displayH = Math.round(rect.height);

        /* Only resize buffer when dimensions actually changed */
        if (this.canvas.width !== displayW * dpr || this.canvas.height !== displayH * dpr) {
            this.canvas.width  = displayW * dpr;
            this.canvas.height = displayH * dpr;
            this.canvas.style.width  = displayW + 'px';
            this.canvas.style.height = displayH + 'px';
            if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        /* Store CSS-pixel dimensions for coordinate math */
        this._displayW = displayW;
        this._displayH = displayH;
    }

    /* ────────────────────────────────────────────────────── */
    /*  Image Loading                                         */
    /* ────────────────────────────────────────────────────── */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img  = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                this.image = img;
                this.origW = img.naturalWidth;
                this.origH = img.naturalHeight;
                this._syncCanvasSize();
                this._render();
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    /* ────────────────────────────────────────────────────── */
    /*  Public API called by app.js                           */
    /*  Accepts the raw detections array from /predict.       */
    /* ────────────────────────────────────────────────────── */
    drawDetections(detections) {
        this.detections = detections || [];
        this.animationProgress = 0;
        this.isAnimating = true;

        if (this.viewMode === '3d') {
            this._create3DCracks();
        }
        this._animateBoxes();
    }

    /* ────────────────────────────────────────────────────── */
    /*  Coordinate scaling helpers                            */
    /*                                                        */
    /*  The image is drawn letter-boxed (contain) inside the  */
    /*  canvas.  We compute:                                  */
    /*    fitScale  = how much the image was shrunk            */
    /*    offsetX/Y = centering offset (letter-box bars)      */
    /*                                                        */
    /*  Each detection coord is then:                         */
    /*    screenX = coord * fitScale + offset                 */
    /*  If the API returns normalised 0–1 coords we first     */
    /*  multiply by origW / origH to get pixel coords.        */
    /* ────────────────────────────────────────────────────── */
    _getTransform() {
        const cw = this._displayW;
        const ch = this._displayH;

        const fitScale = Math.min(cw / this.origW, ch / this.origH);

        const scaledW = this.origW * fitScale;
        const scaledH = this.origH * fitScale;
        const offsetX = (cw - scaledW) / 2;
        const offsetY = (ch - scaledH) / 2;

        return { fitScale, offsetX, offsetY, scaledW, scaledH };
    }

    /**
     * Convert a single detection's coordinates to canvas-CSS-pixel space.
     *
     * Supports two formats:
     *  • Pixel coords   (x1 > 1 typically)  — e.g. 120, 340, 280, 400
     *  • Normalised 0–1 (all coords ≤ 1.0)  — e.g. 0.18, 0.53, 0.43, 0.62
     */
    _mapBox(det, t) {
        let { x1, y1, x2, y2 } = det;

        /* Normalised → pixel (if all four coords are ≤ 1 it's likely normalised) */
        const isNorm = (x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1);
        if (isNorm) {
            x1 *= this.origW;
            y1 *= this.origH;
            x2 *= this.origW;
            y2 *= this.origH;
        }

        return {
            sx: x1 * t.fitScale + t.offsetX,
            sy: y1 * t.fitScale + t.offsetY,
            sw: (x2 - x1) * t.fitScale,
            sh: (y2 - y1) * t.fitScale
        };
    }

    /* ────────────────────────────────────────────────────── */
    /*  2D Render                                             */
    /* ────────────────────────────────────────────────────── */
    _render() {
        if (!this.ctx || !this.image || this.viewMode !== '2d') return;

        const ctx = this.ctx;
        const cw  = this._displayW;
        const ch  = this._displayH;

        ctx.clearRect(0, 0, cw, ch);

        /* Letter-box draw */
        const t = this._getTransform();
        ctx.drawImage(this.image, t.offsetX, t.offsetY, t.scaledW, t.scaledH);

        /* Detections */
        this._drawBoxes(ctx, t);
    }

    _drawBoxes(ctx, t) {
        const dets = this.detections;
        if (!dets.length) return;

        dets.forEach((detection, index) => {
            const { sx, sy, sw, sh } = this._mapBox(detection, t);
            const color = detection.color || '#4DA6FF';

            /* Stagger per box */
            const delay    = index * 0.08;
            let   progress = Math.max(0, Math.min(1, (this.animationProgress - delay) / 0.6));
            if (progress <= 0) return;

            /* ── Animated perimeter stroke ──────────────── */
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth   = 2;
            ctx.setLineDash([]);

            const perimeter     = 2 * (sw + sh);
            const currentLength = perimeter * progress;

            ctx.beginPath();

            /* Top edge */
            if (currentLength > 0) {
                ctx.moveTo(sx, sy);
                ctx.lineTo(sx + Math.min(sw, currentLength), sy);
            }
            /* Right edge */
            if (currentLength > sw) {
                ctx.lineTo(sx + sw, sy + Math.min(sh, currentLength - sw));
            }
            /* Bottom edge */
            if (currentLength > sw + sh) {
                ctx.lineTo(sx + sw - Math.min(sw, currentLength - sw - sh), sy + sh);
            }
            /* Left edge */
            if (currentLength > 2 * sw + sh) {
                ctx.lineTo(sx, sy + sh - Math.min(sh, currentLength - 2 * sw - sh));
            }

            ctx.stroke();

            /* Neon glow */
            ctx.shadowColor = color;
            ctx.shadowBlur  = 10 * progress;
            ctx.stroke();
            ctx.shadowBlur  = 0;
            ctx.restore();

            /* ── Confidence label (after box fully drawn) ── */
            if (progress >= 1) {
                const conf = detection.confidence || 0;
                const className = detection.class_name || '';
                const label = className
                    ? `${className} ${(conf * 100).toFixed(0)}%`
                    : `${(conf * 100).toFixed(0)}%`;
                ctx.font         = 'bold 12px Inter, sans-serif';
                const labelW     = ctx.measureText(label).width + 12;
                const labelH     = 22;

                ctx.fillStyle = color;
                ctx.fillRect(sx, sy - labelH - 4, labelW, labelH);

                ctx.fillStyle    = '#000';
                ctx.textAlign    = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, sx + 6, sy - labelH / 2 - 4);
            }
        });
    }

    /* ────────────────────────────────────────────────────── */
    /*  Box-draw animation loop                               */
    /* ────────────────────────────────────────────────────── */
    _animateBoxes() {
        if (!this.isAnimating) return;

        this.animationProgress += 0.025;

        if (this.animationProgress >= 1) {
            this.animationProgress = 1;
            this.isAnimating = false;
        }

        if (this.viewMode === '2d') {
            this._render();
        }

        if (this.isAnimating) {
            this._rafId = requestAnimationFrame(() => this._animateBoxes());
        }
    }

    /* ────────────────────────────────────────────────────── */
    /*  View mode                                             */
    /* ────────────────────────────────────────────────────── */
    setViewMode(mode) {
        this.viewMode = mode;

        if (mode === '2d') {
            if (this.canvas) this.canvas.hidden = false;
            if (this.threeContainer) this.threeContainer.hidden = true;
            this._render();
        } else {
            if (this.canvas) this.canvas.hidden = true;
            if (this.threeContainer) this.threeContainer.hidden = false;
            this.init3DView(this.detections);
        }
    }

    /* ────────────────────────────────────────────────────── */
    /*  3D Visualization  (unchanged logic, tidied)           */
    /* ────────────────────────────────────────────────────── */
    init3DView(detections) {
        if (detections) this.detections = detections;
        this._initThree();
        this._create3DCracks();
    }

    _initThree() {
        if (this.threeRenderer) return;
        if (typeof THREE === 'undefined') return;

        const container = this.threeContainer;
        if (!container) return;
        const width  = container.clientWidth;
        const height = container.clientHeight;

        this.threeScene = new THREE.Scene();
        this.threeScene.background = new THREE.Color(0x0a0a0f);

        this.threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.threeCamera.position.set(0, 8, 12);
        this.threeCamera.lookAt(0, 0, 0);

        this.threeRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.threeRenderer.setSize(width, height);
        this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.threeRenderer.domElement);

        /* Lights */
        this.threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 10, 5);
        this.threeScene.add(dir);
        const red = new THREE.PointLight(0xff3366, 1, 20);
        red.position.set(-5, 5, -5);
        this.threeScene.add(red);

        /* Base plane + grid */
        const planeGeo = new THREE.PlaneGeometry(15, 15);
        const planeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8, metalness: 0.2 });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        this.threeScene.add(plane);

        const grid = new THREE.GridHelper(15, 15, 0x00d4ff, 0x1a1a2e);
        grid.position.y = 0.01;
        this.threeScene.add(grid);

        this._animate3D();
    }

    _create3DCracks() {
        if (!this.threeScene) return;

        this.crackMeshes.forEach(c => this.threeScene.remove(c.mesh));
        this.crackMeshes = [];
        if (!this.image) return;

        const imgW  = this.origW || this.image.naturalWidth;
        const imgH  = this.origH || this.image.naturalHeight;
        const scale = 10 / Math.max(imgW, imgH);

        this.detections.forEach((det, idx) => {
            let { x1, y1, x2, y2 } = det;
            const confidence = det.confidence || 0;

            /* Normalised → pixel */
            if (x1 <= 1 && y1 <= 1 && x2 <= 1 && y2 <= 1) {
                x1 *= imgW; y1 *= imgH; x2 *= imgW; y2 *= imgH;
            }

            const bw = (x2 - x1) * scale;
            const bh = (y2 - y1) * scale;
            const extrusion = (det.depth || confidence) * 3;

            const color = confidence >= 0.8 ? 0x00ff88 :
                          confidence >= 0.5 ? 0xffcc00 : 0xff3366;

            const geo = new THREE.BoxGeometry(bw, extrusion, bh);
            const mat = new THREE.MeshStandardMaterial({
                color, emissive: color, emissiveIntensity: 0.3,
                transparent: true, opacity: 0.8
            });
            const mesh = new THREE.Mesh(geo, mat);

            const cx = ((x1 + x2) / 2 - imgW / 2) * scale;
            const cz = ((y1 + y2) / 2 - imgH / 2) * scale;
            mesh.position.set(cx, extrusion / 2, cz);
            mesh.visible = false;

            this.threeScene.add(mesh);
            this.crackMeshes.push({ mesh, targetY: extrusion / 2, delay: idx * 0.1, progress: 0 });
        });

        this._animate3DExtrusion();
    }

    _animate3DExtrusion() {
        let allDone = true;

        this.crackMeshes.forEach(c => {
            if (c.progress < 1) {
                c.progress += 0.02;
                allDone = false;

                if (c.progress >= c.delay) {
                    const p = Math.min(1, (c.progress - c.delay) / 0.5);
                    c.mesh.visible   = true;
                    c.mesh.position.y = c.targetY * p;
                    c.mesh.scale.y    = p;
                }
            }
        });

        if (!allDone) {
            requestAnimationFrame(() => this._animate3DExtrusion());
        }
    }

    _animate3D() {
        if (!this.threeRenderer) return;
        requestAnimationFrame(() => this._animate3D());
        if (this.threeScene) this.threeScene.rotation.y += 0.001;
        this.threeRenderer.render(this.threeScene, this.threeCamera);
    }

    /* ────────────────────────────────────────────────────── */
    /*  Cleanup                                               */
    /* ────────────────────────────────────────────────────── */
    clear() {
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this.ctx) this.ctx.clearRect(0, 0, this._displayW, this._displayH);
        this.image      = null;
        this.detections = [];
        this.crackMeshes.forEach(c => { if (this.threeScene) this.threeScene.remove(c.mesh); });
        this.crackMeshes = [];
    }

    destroy() {
        if (this._ro) this._ro.disconnect();
        this.clear();
    }
}

/* No auto-init here — app.js creates the instance when results load */
