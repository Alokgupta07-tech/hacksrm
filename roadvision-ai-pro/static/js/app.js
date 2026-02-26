/* ============================================================
   app.js — Main Application Orchestrator  (v5.2)
   GSAP ScrollTrigger storytelling, upload flow, auth, Web3, monitor

   Web3 isolation note:
   All Web3Service references are guarded with
   `typeof Web3Service === 'undefined'` checks. Removing web3.js
   and the wallet/badge HTML makes this file work 100% without
   any dead-code errors.
   ============================================================ */

/* ── Global App State ─────────────────────────────────────── */
const appState = {
    isAuthenticated: false,
    token: null,
    currentFile: null,
    analysisCount: 0,
    browserLat: null,
    browserLon: null
};

/* ── Request Browser Geolocation on load ─────────────────── */
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            appState.browserLat = pos.coords.latitude;
            appState.browserLon = pos.coords.longitude;
            console.log(`[GPS] Browser location: ${appState.browserLat}, ${appState.browserLon}`);
        },
        (err) => console.warn('[GPS] Geolocation denied or unavailable:', err.message),
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

/* ── Wait for DOM ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

    /* --- Initialise all modules (each wrapped so one crash doesn't kill the rest) --- */
    const safe = (name, fn) => { try { return fn(); } catch(e) { console.warn(`[init] ${name} failed:`, e.message); return null; } };
    const threeScene   = safe('ThreeScene',      () => new ThreeScene('three-canvas'));
    const particles    = safe('ParticleSystem',   () => new ParticleSystem());
    const streaks      = safe('LightStreaks',     () => new LightStreaks());
    const gauge        = safe('SeverityGauge3D',  () => new SeverityGauge3D());
    const charts       = safe('AnalyticsCharts',  () => new AnalyticsCharts());
    const hud          = safe('SystemHUD',        () => new SystemHUD());
    const tilt         = safe('CardTiltEffect',   () => new CardTiltEffect());
    const scrollReveal = safe('ScrollReveal',     () => new ScrollReveal());
    const ripple       = safe('ButtonRipple',     () => new ButtonRipple());
    const ui           = safe('UIEffects',        () => new UIEffects());
    const scanner      = safe('ScanningEffect',   () => new ScanningEffect());
    const api          = safe('APIClient',        () => new APIClient()) || { healthCheck: async () => null, getHeaders: () => ({}), connect: () => {} };
    let   renderer     = null; // created when results load

    /* ── AI Preview Panel (hero live detection demo) ────── */
    let aiPreview = null;
    try {
        if (typeof AIPreviewRenderer !== 'undefined' && document.getElementById('ai-preview-viewport')) {
            aiPreview = new AIPreviewRenderer('ai-preview-viewport');
        }
    } catch (e) {
        console.warn('AIPreviewRenderer init skipped:', e.message);
    }

    /* ── Health Check ─────────────────────────────────────── */
    async function checkHealth() {
        try {
            const data = await api.healthCheck();
            hud.setStatus(true);
            return data;
        } catch {
            hud.setStatus(false);
        }
    }
    checkHealth();
    setInterval(checkHealth, 30000);

    /* ── GSAP Hero Entrance ───────────────────────────────── */
    function heroEntrance() {
        if (typeof gsap === 'undefined') return;

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        tl.fromTo('.hero-badge',
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7, delay: 0.3 })
          .fromTo('.title-line',
            { y: 60, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.15 }, '-=0.3')
          .fromTo('.hero-subtitle',
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7 }, '-=0.4')
          .fromTo('.hero-stats .stat-card-3d',
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 }, '-=0.3')
          .fromTo('.hero-cta',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6 }, '-=0.2')
          .fromTo('.hero-visual',
            { scale: 0.92, opacity: 0, y: 40 },
            { scale: 1, opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, '-=0.5');
    }
    heroEntrance();

    /* ── Metric Counter Animation ─────────────────────────── */
    function initMetricCounters() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        gsap.registerPlugin(ScrollTrigger);

        const metrics = document.querySelectorAll('.metric-num');
        metrics.forEach(el => {
            const target = parseInt(el.dataset.count, 10);
            if (isNaN(target)) return;

            ScrollTrigger.create({
                trigger: el,
                start: 'top 85%',
                once: true,
                onEnter: () => UIEffects.animateCounter(el, target, 1400)
            });
        });
    }
    initMetricCounters();

    /* ── Hero Counter Animation (SaaS-style stats) ────────── */
    function initHeroCounters() {
        if (typeof gsap === 'undefined') return;

        const counters = document.querySelectorAll('.hero-counter');
        counters.forEach(el => {
            const target   = parseFloat(el.dataset.target) || 0;
            const suffix   = el.dataset.suffix || '';
            const decimals = parseInt(el.dataset.decimals, 10) || 0;
            const duration = 2.0;

            /* Delay start by 1.5s so hero entrance plays first */
            const proxy = { val: 0 };
            gsap.to(proxy, { val: target, duration, delay: 1.5, ease: 'power2.out',
                onUpdate() {
                    if (decimals > 0) {
                        el.textContent = proxy.val.toFixed(decimals) + suffix;
                    } else {
                        el.textContent = Math.round(proxy.val).toLocaleString() + suffix;
                    }
                }
            });
        });
    }
    initHeroCounters();

    /* ── Upload Handler ───────────────────────────────────── */
    const uploadArea      = document.getElementById('upload-area');
    const fileInput       = document.getElementById('file-input');
    const previewEl       = document.getElementById('upload-preview');
    const previewImg      = document.getElementById('preview-image');
    const resetBtn        = document.getElementById('reset-btn');
    const analyzeBtn      = document.getElementById('analyze-btn');
    const uploadContent   = document.querySelector('.upload-content');
    const resultsSection  = document.getElementById('results');

    /* Click to open file picker */
    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            if (e.target.closest('.btn-reset') || e.target.closest('.preview-overlay')) return;
            fileInput?.click();
        });
    }

    /* Drag & Drop */
    if (uploadArea) {
        ['dragenter', 'dragover'].forEach(ev =>
            uploadArea.addEventListener(ev, (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            })
        );
        ['dragleave', 'drop'].forEach(ev =>
            uploadArea.addEventListener(ev, (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
            })
        );
        uploadArea.addEventListener('drop', (e) => {
            const file = e.dataTransfer?.files[0];
            if (file) handleFile(file);
        });
    }

    /* File input change */
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (file) handleFile(file);
        });
    }

    function handleFile(file) {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
            UIEffects.showError('Please select an image (JPG, PNG) or video (MP4, AVI, MOV) file.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            UIEffects.showError('File size must be under 10 MB.');
            return;
        }

        appState.currentFile = file;

        const previewVideo = document.getElementById('preview-video');

        if (isImage) {
            /* Show image preview */
            const reader = new FileReader();
            reader.onload = (e) => {
                if (previewImg) { previewImg.src = e.target.result; previewImg.classList.remove('hidden'); }
                if (previewVideo) { previewVideo.src = ''; previewVideo.classList.add('hidden'); }
                if (previewEl) previewEl.hidden = false;
                if (uploadContent) uploadContent.style.display = 'none';
                if (analyzeBtn) analyzeBtn.disabled = false;
            };
            reader.readAsDataURL(file);
        } else {
            /* Show video preview */
            const url = URL.createObjectURL(file);
            if (previewVideo) { previewVideo.src = url; previewVideo.classList.remove('hidden'); previewVideo.play(); }
            if (previewImg) previewImg.classList.add('hidden');
            if (previewEl) previewEl.hidden = false;
            if (uploadContent) uploadContent.style.display = 'none';
            if (analyzeBtn) analyzeBtn.disabled = false;
        }
    }

    /* Reset */
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetUpload();
        });
    }

    function resetUpload() {
        appState.currentFile = null;
        if (appState._videoStatsPoll) { clearInterval(appState._videoStatsPoll); appState._videoStatsPoll = null; }
        if (fileInput) fileInput.value = '';
        if (previewEl) previewEl.hidden = true;
        if (previewImg) { previewImg.src = ''; previewImg.classList.remove('hidden'); }
        const previewVideo = document.getElementById('preview-video');
        if (previewVideo) { previewVideo.src = ''; previewVideo.classList.add('hidden'); }
        const feedViewer = document.getElementById('video-feed-viewer');
        if (feedViewer) { feedViewer.src = ''; feedViewer.classList.add('hidden'); }
        if (uploadContent) uploadContent.style.display = '';
        if (analyzeBtn) analyzeBtn.disabled = true;
    }

    /* ── Analyze ──────────────────────────────────────────── */
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => analyze());
    }

    async function analyze() {
        if (!appState.currentFile) {
            UIEffects.showError('Please upload an image or video first.');
            return;
        }

        /* UI → loading */
        const btnText   = analyzeBtn?.querySelector('.btn-text');
        const btnLoader = analyzeBtn?.querySelector('.btn-loader');
        if (btnText) btnText.hidden = true;
        if (btnLoader) btnLoader.hidden = false;
        if (analyzeBtn) analyzeBtn.disabled = true;

        scanner.start();
        hud.incrementRequests();

        const isVideo = appState.currentFile.type.startsWith('video/');

        try {
            if (isVideo) {
                /* ── Video path: upload → stream MJPEG ── */
                const upload = await api.analyzeVideo(appState.currentFile);
                displayVideoFeed(upload.video_id, upload.path);
            } else {
                /* ── Image path: standard /predict ── */
                const result = await api.predict(appState.currentFile, appState.browserLat, appState.browserLon);
                displayResults(result);
                appState.analysisCount++;

                /* Update hero stat — increment counter */
                const statDet = document.getElementById('stat-detections');
                if (statDet) {
                    const current = parseInt(statDet.textContent.replace(/,/g, ''), 10) || 0;
                    statDet.textContent = (current + 1).toLocaleString();
                }
            }
        } catch (err) {
            UIEffects.showError(err.message || 'Analysis failed. Please try again.');
        } finally {
            scanner.stop();
            if (btnText) btnText.hidden = false;
            if (btnLoader) btnLoader.hidden = true;
            if (analyzeBtn) analyzeBtn.disabled = false;
        }
    }

    /* ── Display Video Feed (MJPEG) ──────────────────────── */
    function displayVideoFeed(videoId, videoPath) {
        if (!resultsSection) return;
        resultsSection.hidden = false;
        setTimeout(() => resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);

        const feedImg   = document.getElementById('video-feed-viewer');
        const canvas2d  = document.getElementById('detection-canvas');
        const viz3d     = document.getElementById('three-viz-container');

        /* Hide image canvas, show MJPEG stream */
        if (canvas2d) canvas2d.hidden = true;
        if (viz3d)    viz3d.hidden = true;
        if (feedImg) {
            feedImg.src = api.getVideoFeedUrl(videoId, videoPath);
            feedImg.classList.remove('hidden');
        }

        /* Poll video_stats every 2s for live detection counts */
        if (appState._videoStatsPoll) clearInterval(appState._videoStatsPoll);
        appState._videoStatsPoll = setInterval(async () => {
            const stats = await api.getVideoStats();
            if (!stats) return;
            const el = (id) => document.getElementById(id);
            const countEl = el('result-count');
            if (countEl) countEl.textContent = stats.detections || 0;

            const gpsEl = el('result-gps');
            if (gpsEl && stats.lat != null) {
                gpsEl.textContent = `${stats.lat.toFixed(6)}, ${stats.lon.toFixed(6)}`;
                gpsEl.closest('.gps-row')?.classList.remove('hidden');
            }
        }, 2000);
    }

    /* ── Display Results ──────────────────────────────────── */
    function displayResults(data) {
        if (!resultsSection) return;
        resultsSection.hidden = false;

        /* Scroll to results */
        setTimeout(() => {
            resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);

        /* Detection count, confidence, time */
        const detections = data.detections || [];
        const count = detections.length;
        const avgConf = count > 0
            ? detections.reduce((s, d) => s + (d.confidence || 0), 0) / count
            : 0;
        /* Backend returns inference_time_ms (already in ms) */
        const inferenceTime = data.inference_time_ms != null
            ? Math.round(data.inference_time_ms)
            : (data.inference_time ? Math.round(data.inference_time * 1000) : 0);
        /* Backend returns severity_score as 0-100, NOT 0-1 */
        const severity = data.severity_score != null
            ? Math.round(data.severity_score) : Math.round(avgConf * 100);

        const el = (id) => document.getElementById(id);
        UIEffects.animateCounter(el('result-count'), count, 600);
        UIEffects.animateCounter(el('result-confidence'), Math.round(avgConf * 100), 800, '%');
        UIEffects.animateCounter(el('result-time'), inferenceTime, 600, 'ms');
        UIEffects.animateCounter(el('result-score'), severity, 800);

        /* Severity level label */
        const severityLevelEl = el('result-severity-level');
        if (severityLevelEl && data.severity_level) {
            severityLevelEl.textContent = data.severity_level;
            severityLevelEl.className   = 'severity-badge severity-' + data.severity_level.toLowerCase();
        }

        /* GPS coordinates */
        const gpsEl = el('result-gps');
        if (gpsEl && data.gps) {
            if (data.gps.lat != null && data.gps.lon != null) {
                gpsEl.textContent = `${data.gps.lat.toFixed(6)}, ${data.gps.lon.toFixed(6)}`;
                gpsEl.closest('.gps-row')?.classList.remove('hidden');
            } else {
                gpsEl.textContent = 'No GPS data in image';
                gpsEl.closest('.gps-row')?.classList.remove('hidden');
            }
        }

        /* Per-class breakdown */
        const breakdownEl = el('class-breakdown');
        if (breakdownEl && detections.length > 0) {
            const counts = {};
            detections.forEach(d => {
                const cls = d.class_name || 'Unknown';
                counts[cls] = (counts[cls] || 0) + 1;
            });
            breakdownEl.innerHTML = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .map(([cls, n]) => `<div class="breakdown-row"><span class="breakdown-label">${cls}</span><span class="breakdown-count">${n}</span></div>`)
                .join('');
            breakdownEl.closest('.breakdown-card')?.classList.remove('hidden');
        }

        /* Hero stats */
        const accEl = document.getElementById('stat-accuracy');
        if (accEl) accEl.textContent = Math.round(avgConf * 100) + '%';
        const infEl = document.getElementById('stat-inference');
        if (infEl) infEl.textContent = inferenceTime + 'ms';

        /* Gauge */
        gauge.update(severity);

        /* Charts */
        charts.addDetection(avgConf, severity / 100);

        /* Renderer — 2D canvas (constructor finds elements by ID internally) */
        if (!renderer) {
            renderer = new DetectionRenderer();
        }
        renderer.loadImage(previewImg?.src)
            .then(() => renderer.drawDetections(detections));

        /* View toggle */
        setupViewToggle(detections);

        /* Blockchain verification badge — non-blocking, deferred to next frame
           so GSAP scroll, Three.js render, and stat counters are never stalled */
        const scanData = {
            imageName: appState.currentFile?.name || 'unknown',
            severity,
            confidence: Math.round(avgConf * 100),
            detectionCount: count,
            timestamp: Date.now()
        };
        triggerBlockchainVerification(scanData);
    }

    /* ── 2D / 3D View Toggle ──────────────────────────────── */
    function setupViewToggle(detections) {
        const toggleBtns = document.querySelectorAll('.toggle-btn');
        const canvas2d = document.getElementById('detection-canvas');
        const viz3d    = document.getElementById('three-viz-container');

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                toggleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const view = btn.dataset.view;
                if (canvas2d) canvas2d.hidden = view === '3d';
                if (viz3d) viz3d.hidden = view === '2d';

                if (view === '3d' && renderer && typeof renderer.init3DView === 'function') {
                    renderer.init3DView(detections);
                }
            });
        });
    }

    /* ── Web3 Wallet Integration (OPTIONAL — fully removable) ── */
    const walletBtn     = document.getElementById('connectWalletBtn');
    const walletBtnText = document.getElementById('walletBtnText');

    /* Set tooltip on wallet button if MetaMask not available */
    if (walletBtn) {
        const mmAvailable = typeof Web3Service !== 'undefined' && Web3Service.isMetaMaskAvailable();
        if (!mmAvailable) {
            walletBtn.setAttribute('data-tooltip', 'Wallet not detected — install MetaMask');
        }
    }

    function updateWalletUI(info) {
        if (!walletBtn) return;
        if (info && info.address) {
            walletBtnText.textContent = info.shortAddress || Web3Service.shortenAddress(info.address);
            walletBtn.classList.add('connected');
            /* Add green dot if not already there */
            if (!walletBtn.querySelector('.wallet-dot')) {
                const dot = document.createElement('span');
                dot.className = 'wallet-dot';
                walletBtn.appendChild(dot);
            }
        } else {
            walletBtnText.textContent = 'Connect Wallet';
            walletBtn.classList.remove('connected');
            const dot = walletBtn.querySelector('.wallet-dot');
            if (dot) dot.remove();
        }
    }

    if (walletBtn) {
        walletBtn.addEventListener('click', async () => {
            if (typeof Web3Service === 'undefined') return;

            if (Web3Service.isConnected()) {
                Web3Service.disconnect();
                return;
            }

            try {
                walletBtnText.textContent = 'Connecting…';
                const info = await Web3Service.connectWallet();
                updateWalletUI(info);
            } catch (err) {
                walletBtnText.textContent = 'Connect Wallet';
                const msg = err.message || 'Wallet connection failed';
                if (typeof UIEffects !== 'undefined' && UIEffects.showError) {
                    UIEffects.showError(msg);
                }
                console.warn('Web3 connect error:', msg);
            }
        });
    }

    /* Web3 Event Listeners */
    window.addEventListener('web3:connected', (e) => updateWalletUI(e.detail));
    window.addEventListener('web3:disconnected', () => updateWalletUI(null));
    window.addEventListener('web3:walletRestored', (e) => updateWalletUI(e.detail));
    window.addEventListener('web3:accountChanged', (e) => updateWalletUI(e.detail));

    /* ── Blockchain Badge Updater ─────────────────────────── */
    /*
     * Non-blocking: called via requestAnimationFrame so UI rendering,
     * GSAP hero animations, and Three.js draw calls are never stalled.
     * Uses staged progress to give a realistic verification feel.
     */
    function triggerBlockchainVerification(scanData) {
        requestAnimationFrame(() => {
            /* Fire-and-forget — catch all errors silently */
            _runBlockchainBadge(scanData).catch(err => {
                console.warn('Blockchain badge error (non-fatal):', err);
            });
        });
    }

    async function _runBlockchainBadge(scanData) {
        const badge      = document.getElementById('blockchain-badge');
        const title      = document.getElementById('chain-badge-title');
        const statusEl   = document.getElementById('chain-status');
        const dataHashEl = document.getElementById('chain-data-hash');
        const txHashEl   = document.getElementById('chain-tx-hash');
        const networkEl  = document.getElementById('chain-network');
        const progressBar= document.getElementById('chain-progress-bar');

        if (!badge) return;

        /* ── Phase 0: Show badge with GSAP entrance ──────── */
        badge.hidden = false;
        badge.className = 'blockchain-badge-card glass chain-pending';
        if (title)      title.textContent   = 'Verifying Report…';
        if (statusEl)   { statusEl.textContent = 'Pending'; statusEl.className = 'chain-value chain-status-val'; }
        if (dataHashEl) dataHashEl.textContent = '—';
        if (txHashEl)   txHashEl.textContent   = '—';
        if (networkEl)  networkEl.textContent   = '—';
        if (progressBar) progressBar.style.width = '0%';

        /* GSAP entrance — slide up with fade */
        if (typeof gsap !== 'undefined') {
            gsap.fromTo(badge,
                { y: 30, opacity: 0, scale: 0.97 },
                { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }
            );
        }

        /* ── Guard: Web3Service not loaded ───────────────── */
        if (typeof Web3Service === 'undefined') {
            _setBadgeOffchain(badge, title, statusEl, dataHashEl, txHashEl, networkEl, progressBar, null);
            return;
        }

        /* ── Phase 1: Hashing scan data (30%) ────────────── */
        if (title) title.textContent = 'Hashing scan data…';
        if (progressBar) progressBar.style.width = '30%';

        let dataHash;
        try {
            dataHash = await Web3Service.hashScanResult(scanData);
        } catch {
            dataHash = '—';
        }
        if (dataHashEl) dataHashEl.textContent = dataHash ? ('0x' + dataHash.slice(0, 20) + '…') : '—';

        /* ── Phase 2: Checking wallet (55%) ──────────────── */
        if (title) title.textContent = 'Checking wallet status…';
        if (progressBar) progressBar.style.width = '55%';
        /* Small yielding delay so CSS shimmer animation plays visibly */
        await _delay(400);

        const walletConnected = Web3Service.isConnected();

        /* ── Phase 3: On-chain / Off-chain branch ────────── */
        if (walletConnected) {
            if (title) title.textContent = 'Broadcasting to network…';
            if (progressBar) progressBar.style.width = '80%';
            await _delay(350);

            try {
                const result = await Web3Service.verifyOnChain(scanData);

                /* ── VERIFIED ──────────────────────────── */
                if (progressBar) progressBar.style.width = '100%';
                await _delay(200);

                badge.className = 'blockchain-badge-card glass chain-verified';
                if (title)      title.textContent      = '✓ Blockchain Verified';
                if (statusEl)   { statusEl.textContent  = 'Verified'; statusEl.className = 'chain-value chain-status-val'; }
                if (dataHashEl) dataHashEl.textContent  = result.dataHash ? ('0x' + result.dataHash.slice(0, 20) + '…') : '—';
                if (txHashEl)   txHashEl.textContent    = result.txHash ? (result.txHash.slice(0, 22) + '…') : '—';
                if (networkEl)  networkEl.textContent   = result.network || result.chain || '—';

                /* GSAP neon flash on verified */
                if (typeof gsap !== 'undefined') {
                    gsap.fromTo(badge,
                        { boxShadow: '0 0 0px rgba(52,211,153,0)' },
                        { boxShadow: '0 0 40px rgba(52,211,153,.18), 0 0 80px rgba(52,211,153,.08)',
                          duration: 0.8, ease: 'power2.out' }
                    );
                }
            } catch (err) {
                /* Tx failed — fall back to off-chain */
                _setBadgeOffchain(badge, title, statusEl, dataHashEl, txHashEl, networkEl, progressBar, dataHash);
                console.warn('On-chain verification failed:', err.message);
            }
        } else {
            /* ── DEMO MODE / NO WALLET ────────────────── */
            _setBadgeOffchain(badge, title, statusEl, dataHashEl, txHashEl, networkEl, progressBar, dataHash);
        }
    }

    /** Set badge to off-chain / demo-mode state */
    function _setBadgeOffchain(badge, title, statusEl, dataHashEl, txHashEl, networkEl, progressBar, dataHash) {
        if (progressBar) progressBar.style.width = '100%';
        badge.className = 'blockchain-badge-card glass chain-offchain';
        if (title)      title.textContent     = 'Demo Mode — Off-chain Report';
        if (statusEl)   { statusEl.textContent = 'Off-chain'; statusEl.className = 'chain-value chain-status-val'; }
        if (dataHashEl) dataHashEl.textContent = dataHash ? ('0x' + dataHash.slice(0, 20) + '…') : '—';
        if (txHashEl)   txHashEl.textContent   = 'N/A — connect wallet for on-chain';
        if (networkEl)  networkEl.textContent  = 'Local';

        /* Subtle GSAP fade-settle for off-chain */
        if (typeof gsap !== 'undefined') {
            gsap.to(badge, { opacity: 0.85, duration: 0.4, ease: 'power2.out',
                onComplete() { gsap.to(badge, { opacity: 1, duration: 0.3 }); }
            });
        }
    }

    /** Non-blocking delay helper */
    function _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* ── Auth Handler (non-demo mode) ─────────────────────── */
    const loginBtn   = document.getElementById('login-btn');
    const signupBtn  = document.getElementById('signup-btn');
    const loginForm  = document.getElementById('login-form');
    const errorClose = document.getElementById('error-close');
    const successClose = document.getElementById('success-close');
    const overlay    = document.getElementById('modal-overlay');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => UIEffects.showModal('login-modal'));
    }
    if (errorClose) {
        errorClose.addEventListener('click', () => UIEffects.hideModal('error-modal'));
    }
    if (successClose) {
        successClose.addEventListener('click', () => {
            UIEffects.hideModal('success-modal');
            resultsSection?.scrollIntoView({ behavior: 'smooth' });
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => UIEffects.hideAllModals());
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email')?.value;
            const pass  = document.getElementById('login-password')?.value;
            try {
                const data = await api.login(email, pass);
                appState.token = data.access_token;
                appState.isAuthenticated = true;
                api.setToken(data.access_token);
                UIEffects.hideModal('login-modal');
                UIEffects.showSuccess('Signed in successfully!');
            } catch (err) {
                UIEffects.showError(err.message || 'Login failed');
            }
        });
    }

    /* ── Investor Demo mode ───────────────────────────────── */
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'investor') {
        const demo = new InvestorDemo();
        setTimeout(() => demo.start(), 1500);
    }

    /* ── System Monitor — optional WebSocket ──────────────── */
    try {
        const ws = api.connectWebSocket();
        if (ws) {
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === 'health') hud.setStatus(msg.status === 'ok');
                } catch { /* ignore parse errors */ }
            };
        }
    } catch { /* WS optional */ }

    console.log('%c🛣️ RoadVision AI Pro v5.2 — Web3 + Animated Verification', 'color:#4DA6FF;font-weight:bold;font-size:14px');
});
