/* ============================================================
   particles.js — Subtle 2D Canvas Particle System  (v3)
   Restrained particle count, refined connections, mouse repulsion
   + Light streaks accent layer
   ============================================================ */

class ParticleSystem {
    constructor(canvasId = 'particle-canvas') {
        this.canvas = document.getElementById(canvasId);
        /* If no dedicated canvas, create one as an overlay */
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.canvas.id = canvasId;
            this.canvas.style.cssText = `
                position: fixed; inset: 0; width: 100%; height: 100%;
                pointer-events: none; z-index: 0; opacity: 0.6;
            `;
            document.body.prepend(this.canvas);
        }

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: -9999, y: -9999 };
        this.dpr = Math.min(window.devicePixelRatio, 2);

        this.config = {
            count: 45,
            maxSpeed: 0.25,
            connectionDist: 140,
            mouseRepulse: 100,
            particleAlpha: 0.3,
            lineAlpha: 0.06,
            colors: ['#4DA6FF', '#00F0FF', '#6366F1']
        };

        this._paused = false;
        this._frameCount = 0;

        this._resize();
        this._populate();
        this._listen();
        this._setupVisibility();
        this._loop();
    }

    _resize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.w = w;
        this.h = h;
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    _populate() {
        this.particles = [];
        for (let i = 0; i < this.config.count; i++) {
            this.particles.push({
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                vx: (Math.random() - 0.5) * this.config.maxSpeed,
                vy: (Math.random() - 0.5) * this.config.maxSpeed,
                r: Math.random() * 1.5 + 0.5,
                color: this.config.colors[i % this.config.colors.length],
                alpha: Math.random() * 0.3 + 0.15
            });
        }
    }

    _listen() {
        window.addEventListener('resize', () => {
            this._resize();
            this._populate();
        }, { passive: true });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        }, { passive: true });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = -9999;
            this.mouse.y = -9999;
        }, { passive: true });
    }

    /* Pause when tab hidden or canvas off-screen */
    _setupVisibility() {
        document.addEventListener('visibilitychange', () => {
            this._paused = document.hidden;
            if (!this._paused) this._loop();
        });
        if (typeof IntersectionObserver !== 'undefined') {
            const obs = new IntersectionObserver(entries => {
                this._paused = !entries[0].isIntersecting;
                if (!this._paused) this._loop();
            }, { threshold: 0 });
            obs.observe(this.canvas);
        }
    }

    _loop() {
        if (this._paused) return;
        requestAnimationFrame(() => this._loop());

        this._frameCount++;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.w, this.h);

        const cfg = this.config;

        /* Update + draw particles */
        for (const p of this.particles) {
            /* Mouse repulsion */
            const dx = p.x - this.mouse.x;
            const dy = p.y - this.mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cfg.mouseRepulse && dist > 0) {
                const force = (cfg.mouseRepulse - dist) / cfg.mouseRepulse * 0.01;
                p.vx += (dx / dist) * force;
                p.vy += (dy / dist) * force;
            }

            /* Damping */
            p.vx *= 0.998;
            p.vy *= 0.998;

            p.x += p.vx;
            p.y += p.vy;

            /* Wrap edges */
            if (p.x < 0) p.x = this.w;
            if (p.x > this.w) p.x = 0;
            if (p.y < 0) p.y = this.h;
            if (p.y > this.h) p.y = 0;

            /* Draw dot */
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        }

        /* Draw connections — throttle to every 2nd frame */
        if (this._frameCount % 2 !== 0) { ctx.globalAlpha = 1; return; }
        ctx.globalAlpha = cfg.lineAlpha;
        ctx.strokeStyle = '#4DA6FF';
        ctx.lineWidth = 0.5;

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const a = this.particles[i];
                const b = this.particles[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = dx * dx + dy * dy;
                const maxD = cfg.connectionDist * cfg.connectionDist;
                if (dist < maxD) {
                    const alpha = cfg.lineAlpha * (1 - dist / maxD);
                    ctx.globalAlpha = alpha;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        ctx.globalAlpha = 1;
    }

    destroy() {
        // allow GC
        this.particles = [];
    }
}


/* ============================================================
   LightStreaks — horizontal accent streaks
   ============================================================ */
class LightStreaks {
    constructor() {
        this.streaks = [];
        this._create(3);
    }

    _create(count) {
        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'light-streak';
            el.style.cssText = `
                position: fixed;
                height: 1px;
                width: ${Math.random() * 200 + 100}px;
                top: ${Math.random() * 100}%;
                left: -220px;
                background: linear-gradient(90deg, transparent, rgba(77,166,255,0.15), transparent);
                pointer-events: none;
                z-index: 0;
                opacity: 0;
            `;
            document.body.appendChild(el);
            this.streaks.push({
                el,
                speed: Math.random() * 0.8 + 0.3,
                delay: Math.random() * 12000,
                active: false
            });
        }
        this._animate();
    }

    _animate() {
        if (document.hidden) { requestAnimationFrame(() => this._animate()); return; }
        const now = performance.now();
        for (const s of this.streaks) {
            if (!s.active && now > s.delay) {
                s.active = true;
                s.startTime = now;
                s.el.style.opacity = '1';
            }
            if (s.active) {
                const elapsed = (now - s.startTime) * 0.05 * s.speed;
                const x = -220 + elapsed;
                s.el.style.transform = `translateX(${x}px)`;
                if (x > window.innerWidth + 300) {
                    /* reset */
                    s.el.style.top = `${Math.random() * 100}%`;
                    s.startTime = now;
                    s.delay = 0;
                }
            }
        }
        requestAnimationFrame(() => this._animate());
    }

    destroy() {
        for (const s of this.streaks) s.el.remove();
        this.streaks = [];
    }
}
