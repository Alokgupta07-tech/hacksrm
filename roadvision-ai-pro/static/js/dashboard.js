/* ============================================================
   dashboard.js — Dashboard Components  (v3)
   SeverityGauge3D, AnalyticsCharts, SystemHUD,
   CardTiltEffect, ScrollReveal, ButtonRipple
   ============================================================ */

/* ─── Severity Gauge ─────────────────────────────────────── */
class SeverityGauge3D {
    constructor() {
        this.needle = document.getElementById('gauge-needle');
        this.valueEl = document.getElementById('gauge-value');
        this.levelEl = document.getElementById('gauge-level');
        this.glowEl = document.getElementById('gauge-glow');
        this.currentValue = 0;
    }

    update(severity) {
        const pct = Math.min(Math.max(severity, 0), 100);
        const deg = -90 + (pct / 100) * 180; // -90 to 90

        if (this.needle) {
            this.needle.style.transform = `rotate(${deg}deg)`;
        }
        if (this.valueEl) {
            this._animateCounter(this.valueEl, this.currentValue, pct, '%');
        }
        if (this.levelEl) {
            let level = 'Low';
            if (pct >= 70) level = 'Critical';
            else if (pct >= 40) level = 'Moderate';
            this.levelEl.textContent = level;
            this.levelEl.className = 'gauge-level ' +
                (pct >= 70 ? 'critical' : pct >= 40 ? 'moderate' : 'low');
        }
        if (this.glowEl) {
            const hue = pct >= 70 ? 0 : pct >= 40 ? 40 : 200;
            this.glowEl.style.background =
                `radial-gradient(circle, hsla(${hue},80%,50%,0.15) 0%, transparent 70%)`;
        }
        this.currentValue = pct;
    }

    _animateCounter(el, from, to, suffix = '') {
        const duration = 800;
        const start = performance.now();
        const tick = (now) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(from + (to - from) * ease) + suffix;
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }
}

/* ─── Analytics Charts ───────────────────────────────────── */
class AnalyticsCharts {
    constructor() {
        this.historyChart = null;
        this.severityChart = null;
        this._initCharts();
    }

    _initCharts() {
        Chart.defaults.color = 'rgba(255,255,255,0.5)';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
        Chart.defaults.font.family = "'Inter', sans-serif";

        this._createHistoryChart();
        this._createSeverityChart();
    }

    _createHistoryChart() {
        const el = document.getElementById('history-chart');
        if (!el) return;

        const labels = this._generateTimeLabels(12);
        const data = labels.map(() => Math.floor(Math.random() * 30 + 5));

        this.historyChart = new Chart(el, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Detections',
                    data,
                    borderColor: '#4DA6FF',
                    backgroundColor: 'rgba(77,166,255,0.08)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#4DA6FF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(10,10,14,0.9)',
                        titleColor: '#fff',
                        bodyColor: 'rgba(255,255,255,0.7)',
                        borderColor: 'rgba(77,166,255,0.2)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 11 } } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { font: { size: 11 } }, beginAtZero: true }
                }
            }
        });
    }

    _createSeverityChart() {
        const el = document.getElementById('severity-chart');
        if (!el) return;

        this.severityChart = new Chart(el, {
            type: 'doughnut',
            data: {
                labels: ['Low', 'Moderate', 'Severe'],
                datasets: [{
                    data: [60, 30, 10],
                    backgroundColor: [
                        'rgba(77,166,255,0.7)',
                        'rgba(245,158,11,0.7)',
                        'rgba(239,68,68,0.7)'
                    ],
                    borderColor: 'rgba(10,10,14,0.8)',
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 12 } }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10,10,14,0.9)',
                        padding: 12,
                        cornerRadius: 8
                    }
                }
            }
        });
    }

    _generateTimeLabels(count) {
        const labels = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now - i * 3600 * 1000);
            labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        return labels;
    }

    addDetection(confidence, severity) {
        if (this.historyChart) {
            const ds = this.historyChart.data.datasets[0];
            ds.data.push(Math.round(confidence * 100));
            if (ds.data.length > 20) ds.data.shift();
            const labels = this.historyChart.data.labels;
            labels.push(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            if (labels.length > 20) labels.shift();
            this.historyChart.update('none');
        }
        if (this.severityChart) {
            const d = this.severityChart.data.datasets[0].data;
            if (severity < 0.4) d[0]++;
            else if (severity < 0.7) d[1]++;
            else d[2]++;
            this.severityChart.update('none');
        }
    }
}

/* ─── System HUD ─────────────────────────────────────────── */
class SystemHUD {
    constructor() {
        this.statusEl = document.getElementById('api-status');
        this.uptimeEl = document.getElementById('hud-uptime');
        this.requestsEl = document.getElementById('hud-requests');
        this.startTime = Date.now();
        this.requests = 0;
        this._tick();
    }

    _tick() {
        setInterval(() => {
            if (this.uptimeEl) {
                const s = Math.floor((Date.now() - this.startTime) / 1000);
                const m = Math.floor(s / 60);
                const sec = s % 60;
                this.uptimeEl.textContent =
                    String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
            }
        }, 1000);
    }

    setStatus(online) {
        if (!this.statusEl) return;
        this.statusEl.className = 'hud-indicator ' + (online ? 'online' : 'offline');
    }

    incrementRequests() {
        this.requests++;
        if (this.requestsEl) this.requestsEl.textContent = this.requests;
    }
}

/* ─── Card Tilt Effect (Apple-like) ──────────────────────── */
class CardTiltEffect {
    constructor() {
        this.cards = document.querySelectorAll('[data-tilt]');
        this._bind();
    }

    _bind() {
        this.cards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                card.style.transform =
                    `perspective(600px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(4px)`;
            }, { passive: true });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'perspective(600px) rotateY(0) rotateX(0) translateZ(0)';
            }, { passive: true });
        });
    }
}

/* ─── Scroll Reveal (GSAP ScrollTrigger) ────────────────── */
class ScrollReveal {
    constructor() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        gsap.registerPlugin(ScrollTrigger);

        this._revealAnimated();
    }

    _revealAnimated() {
        const items = document.querySelectorAll('[data-animate]');
        items.forEach(el => {
            const delay = parseFloat(el.dataset.delay || 0);
            gsap.fromTo(el,
                { y: 40, opacity: 0 },
                {
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 88%',
                        toggleActions: 'play none none none'
                    },
                    y: 0,
                    opacity: 1,
                    duration: 0.9,
                    delay,
                    ease: 'power3.out'
                }
            );
        });
    }
}

/* ─── Button Ripple Effect ───────────────────────────────── */
class ButtonRipple {
    constructor() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-primary, .btn-glass, .btn-analyze');
            if (!btn) return;

            const rect = btn.getBoundingClientRect();
            const ripple = document.createElement('span');
            const size = Math.max(rect.width, rect.height) * 2;
            ripple.style.cssText = `
                position: absolute; width: ${size}px; height: ${size}px;
                left: ${e.clientX - rect.left - size / 2}px;
                top: ${e.clientY - rect.top - size / 2}px;
                background: rgba(255,255,255,0.12);
                border-radius: 50%; transform: scale(0);
                animation: ripple-out 0.6s ease-out forwards;
                pointer-events: none;
            `;
            btn.style.position = btn.style.position || 'relative';
            btn.style.overflow = 'hidden';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 700);
        });

        /* Inject ripple keyframes once */
        if (!document.getElementById('ripple-style')) {
            const style = document.createElement('style');
            style.id = 'ripple-style';
            style.textContent = `
                @keyframes ripple-out {
                    to { transform: scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}
