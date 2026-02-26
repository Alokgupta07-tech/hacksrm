/* ============================================================
   roadTextureGen.js — Procedural Road Texture Generator  (v1)
   
   Generates photorealistic road surface images on offscreen
   canvases. Each texture is unique with realistic details:
   cracks, potholes, asphalt grain, lane markings, patches.
   
   Zero network cost — no image downloads needed.
   Used by AIPreviewRenderer for cycling road backgrounds.
   ============================================================ */

class RoadTextureGenerator {
    constructor(width = 640, height = 480) {
        this.w = width;
        this.h = height;
        this.textures = [];     // cached data URLs
        this.ready = false;

        /* Asphalt color palette — sampled from real road photos */
        this.palettes = [
            { base: [38, 36, 34],  grain: [50, 48, 44],  name: 'fresh-asphalt' },
            { base: [52, 50, 48],  grain: [65, 62, 58],  name: 'worn-asphalt' },
            { base: [44, 42, 40],  grain: [58, 55, 52],  name: 'grey-highway' },
            { base: [35, 33, 30],  grain: [48, 44, 40],  name: 'dark-tarmac' },
            { base: [56, 54, 50],  grain: [70, 66, 62],  name: 'old-concrete' },
            { base: [42, 40, 38],  grain: [55, 52, 48],  name: 'patched-road' },
        ];
    }

    /* ─── Generate all textures (call once at startup) ────── */
    async generateAll(count = 6) {
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(this._renderTexture(i));
        }
        this.textures = await Promise.all(promises);
        this.ready = true;
        return this.textures;
    }

    /* ─── Render a single road texture to data URL ────────── */
    _renderTexture(index) {
        return new Promise(resolve => {
            /* Use requestIdleCallback or setTimeout to avoid blocking */
            const run = () => {
                const cvs = document.createElement('canvas');
                cvs.width = this.w;
                cvs.height = this.h;
                const ctx = cvs.getContext('2d');
                const palette = this.palettes[index % this.palettes.length];

                /* Layer 1: Base asphalt fill */
                this._drawAsphaltBase(ctx, palette);

                /* Layer 2: Macro grain / aggregate texture */
                this._drawAggregateGrain(ctx, palette);

                /* Layer 3: Fine noise grain for realism */
                this._drawFineNoise(ctx);

                /* Layer 4: Road features (varies per texture) */
                switch (index % 6) {
                    case 0: this._drawLongitudinalCracks(ctx); break;
                    case 1: this._drawPothole(ctx); break;
                    case 2: this._drawAlligatorCracks(ctx); break;
                    case 3: this._drawTransverseCracks(ctx); this._drawLaneMarking(ctx); break;
                    case 4: this._drawPatchRepair(ctx); this._drawEdgeCracks(ctx); break;
                    case 5: this._drawWornSurface(ctx); this._drawLaneMarking(ctx); break;
                }

                /* Layer 5: Subtle water stains / oil spots */
                this._drawStains(ctx);

                resolve(cvs.toDataURL('image/jpeg', 0.85));
            };

            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(run);
            } else {
                setTimeout(run, index * 50);
            }
        });
    }

    /* ─── Layer 1: Asphalt base with gradient variation ───── */
    _drawAsphaltBase(ctx, palette) {
        const [r, g, b] = palette.base;

        /* Subtle vertical gradient (darker at edges, like worn road) */
        const grad = ctx.createLinearGradient(0, 0, 0, this.h);
        grad.addColorStop(0, `rgb(${r - 5},${g - 5},${b - 5})`);
        grad.addColorStop(0.3, `rgb(${r + 3},${g + 3},${b + 2})`);
        grad.addColorStop(0.7, `rgb(${r + 2},${g + 2},${b + 1})`);
        grad.addColorStop(1, `rgb(${r - 4},${g - 4},${b - 5})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.w, this.h);

        /* Radial light variation (simulating sunlight) */
        const cx = this.w * (0.3 + Math.random() * 0.4);
        const cy = this.h * (0.2 + Math.random() * 0.3);
        const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.w * 0.6);
        radGrad.addColorStop(0, `rgba(${r + 18},${g + 16},${b + 14},0.35)`);
        radGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radGrad;
        ctx.fillRect(0, 0, this.w, this.h);
    }

    /* ─── Layer 2: Aggregate / gravel texture ─────────────── */
    _drawAggregateGrain(ctx, palette) {
        const [r, g, b] = palette.grain;
        const count = 6000;

        for (let i = 0; i < count; i++) {
            const x = Math.random() * this.w;
            const y = Math.random() * this.h;
            const size = Math.random() * 3 + 0.5;
            const variance = Math.floor(Math.random() * 25 - 12);
            const alpha = Math.random() * 0.22 + 0.05;

            ctx.fillStyle = `rgba(${r + variance},${g + variance},${b + variance},${alpha})`;

            if (Math.random() > 0.7) {
                /* Occasional larger stone/aggregate */
                ctx.beginPath();
                ctx.ellipse(x, y, size * 1.5, size, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(x, y, size, size);
            }
        }
    }

    /* ─── Layer 3: Fine photographic noise ────────────────── */
    _drawFineNoise(ctx) {
        const imgData = ctx.getImageData(0, 0, this.w, this.h);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 14;
            data[i]     += noise;
            data[i + 1] += noise;
            data[i + 2] += noise;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    /* ─── Crack Generators ────────────────────────────────── */

    _drawLongitudinalCracks(ctx) {
        /* 2-3 long cracks running mostly vertical */
        const crackCount = 2 + Math.floor(Math.random() * 2);
        for (let c = 0; c < crackCount; c++) {
            ctx.save();
            ctx.strokeStyle = `rgba(15,12,10,${0.6 + Math.random() * 0.3})`;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 3;

            let x = this.w * (0.2 + Math.random() * 0.6);
            let y = this.h * 0.05;
            ctx.beginPath();
            ctx.moveTo(x, y);

            while (y < this.h * 0.95) {
                x += (Math.random() - 0.5) * 18;
                y += 8 + Math.random() * 15;
                ctx.lineTo(x, y);
            }
            ctx.stroke();

            /* Secondary thin branch cracks */
            if (Math.random() > 0.4) {
                const branchY = this.h * (0.3 + Math.random() * 0.4);
                ctx.lineWidth = 0.5 + Math.random();
                ctx.beginPath();
                ctx.moveTo(x + (Math.random() - 0.5) * 20, branchY);
                for (let s = 0; s < 6; s++) {
                    ctx.lineTo(
                        x + (Math.random() - 0.5) * 60,
                        branchY + s * 12 + Math.random() * 8
                    );
                }
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    _drawAlligatorCracks(ctx) {
        /* Network of interconnected cracks in a region */
        const cx = this.w * (0.25 + Math.random() * 0.5);
        const cy = this.h * (0.25 + Math.random() * 0.5);
        const radius = Math.min(this.w, this.h) * (0.15 + Math.random() * 0.2);

        ctx.save();
        ctx.strokeStyle = 'rgba(12,10,8,0.55)';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 2;

        const segments = 18 + Math.floor(Math.random() * 12);
        for (let i = 0; i < segments; i++) {
            ctx.lineWidth = 0.5 + Math.random() * 1.5;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius;
            const sx = cx + Math.cos(angle) * dist;
            const sy = cy + Math.sin(angle) * dist;
            const len = 15 + Math.random() * 40;
            const dir = angle + (Math.random() - 0.5) * 1.5;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(dir) * len, sy + Math.sin(dir) * len);
            ctx.stroke();
        }
        ctx.restore();
    }

    _drawTransverseCracks(ctx) {
        /* 1-2 horizontal cracks across the road */
        const count = 1 + Math.floor(Math.random() * 2);
        for (let c = 0; c < count; c++) {
            ctx.save();
            ctx.strokeStyle = `rgba(15,12,10,${0.5 + Math.random() * 0.3})`;
            ctx.lineWidth = 1.5 + Math.random() * 2;
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 3;

            let x = this.w * 0.05;
            let y = this.h * (0.3 + Math.random() * 0.4);

            ctx.beginPath();
            ctx.moveTo(x, y);
            while (x < this.w * 0.95) {
                x += 12 + Math.random() * 20;
                y += (Math.random() - 0.5) * 10;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    _drawEdgeCracks(ctx) {
        /* Cracks along the left or right edge */
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const baseX = side === 'left' ? this.w * 0.05 : this.w * 0.92;

        ctx.save();
        ctx.strokeStyle = 'rgba(15,12,10,0.5)';
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 2;

        for (let i = 0; i < 5; i++) {
            let x = baseX + (Math.random() - 0.5) * 30;
            let y = this.h * Math.random() * 0.3;

            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let s = 0; s < 8; s++) {
                x += (side === 'left' ? 1 : -1) * (Math.random() * 12);
                y += 15 + Math.random() * 20;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    /* ─── Pothole ─────────────────────────────────────────── */
    _drawPothole(ctx) {
        const cx = this.w * (0.3 + Math.random() * 0.4);
        const cy = this.h * (0.3 + Math.random() * 0.4);
        const rx = 30 + Math.random() * 50;
        const ry = 20 + Math.random() * 35;

        ctx.save();

        /* Shadow / depth ring */
        const outerGrad = ctx.createRadialGradient(cx, cy, rx * 0.3, cx, cy, rx * 1.3);
        outerGrad.addColorStop(0, 'rgba(5,4,3,0.7)');
        outerGrad.addColorStop(0.6, 'rgba(20,18,16,0.4)');
        outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 1.3, ry * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();

        /* Inner dark hole */
        ctx.fillStyle = 'rgba(10,8,6,0.8)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, Math.random() * 0.3, 0, Math.PI * 2);
        ctx.fill();

        /* Highlight rim (light catching the edge) */
        ctx.strokeStyle = 'rgba(80,75,70,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy - 2, rx, ry, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();

        /* Debris/gravel inside */
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * rx * 0.7;
            const dx = cx + Math.cos(angle) * dist;
            const dy = cy + Math.sin(angle) * dist * (ry / rx);
            const val = Math.floor(15 + Math.random() * 20);
            ctx.fillStyle = `rgba(${val},${val - 2},${val - 3},${0.3 + Math.random() * 0.4})`;
            ctx.fillRect(dx, dy, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
        ctx.restore();

        /* Surrounding radial cracks */
        ctx.save();
        ctx.strokeStyle = 'rgba(15,12,10,0.4)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 6; i++) {
            const angle = Math.random() * Math.PI * 2;
            const startDist = rx * 1.1;
            const endDist = startDist + 20 + Math.random() * 40;
            ctx.beginPath();
            ctx.moveTo(
                cx + Math.cos(angle) * startDist,
                cy + Math.sin(angle) * startDist * (ry / rx)
            );
            ctx.lineTo(
                cx + Math.cos(angle + (Math.random() - 0.5) * 0.4) * endDist,
                cy + Math.sin(angle + (Math.random() - 0.5) * 0.4) * endDist * (ry / rx)
            );
            ctx.stroke();
        }
        ctx.restore();
    }

    /* ─── Patch / Repair area ─────────────────────────────── */
    _drawPatchRepair(ctx) {
        const px = this.w * (0.2 + Math.random() * 0.4);
        const py = this.h * (0.2 + Math.random() * 0.4);
        const pw = 80 + Math.random() * 100;
        const ph = 60 + Math.random() * 80;

        ctx.save();

        /* Slightly different colored patch */
        ctx.fillStyle = `rgba(28,26,24,0.6)`;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + pw + (Math.random() - 0.5) * 10, py + (Math.random() - 0.5) * 8);
        ctx.lineTo(px + pw + (Math.random() - 0.5) * 12, py + ph + (Math.random() - 0.5) * 8);
        ctx.lineTo(px + (Math.random() - 0.5) * 10, py + ph + (Math.random() - 0.5) * 6);
        ctx.closePath();
        ctx.fill();

        /* Patch edge seam */
        ctx.strokeStyle = 'rgba(60,56,52,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        /* Coarser aggregate on patch */
        for (let i = 0; i < 120; i++) {
            const x = px + Math.random() * pw;
            const y = py + Math.random() * ph;
            const val = 22 + Math.floor(Math.random() * 20);
            ctx.fillStyle = `rgba(${val},${val},${val},${0.2 + Math.random() * 0.2})`;
            ctx.fillRect(x, y, Math.random() * 2.5 + 0.5, Math.random() * 2.5 + 0.5);
        }
        ctx.restore();
    }

    /* ─── Worn / faded surface ────────────────────────────── */
    _drawWornSurface(ctx) {
        /* Light patches where asphalt is worn thin */
        for (let i = 0; i < 4; i++) {
            const cx = Math.random() * this.w;
            const cy = Math.random() * this.h;
            const size = 40 + Math.random() * 80;

            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
            grad.addColorStop(0, 'rgba(72,68,64,0.2)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
        }

        /* Tire marks */
        ctx.save();
        ctx.strokeStyle = 'rgba(30,28,26,0.15)';
        ctx.lineWidth = 12 + Math.random() * 8;
        ctx.lineCap = 'round';

        const trackX = this.w * (0.3 + Math.random() * 0.15);
        ctx.beginPath();
        ctx.moveTo(trackX, 0);
        ctx.lineTo(trackX + (Math.random() - 0.5) * 10, this.h);
        ctx.stroke();

        const trackX2 = trackX + 60 + Math.random() * 30;
        ctx.beginPath();
        ctx.moveTo(trackX2, 0);
        ctx.lineTo(trackX2 + (Math.random() - 0.5) * 10, this.h);
        ctx.stroke();
        ctx.restore();
    }

    /* ─── Lane marking (dashed or solid) ──────────────────── */
    _drawLaneMarking(ctx) {
        const x = this.w * (0.48 + (Math.random() - 0.5) * 0.08);
        const isDashed = Math.random() > 0.4;

        ctx.save();
        ctx.fillStyle = `rgba(200,195,180,${0.2 + Math.random() * 0.15})`;

        if (isDashed) {
            const dashLen = 25 + Math.random() * 15;
            const gap = 20 + Math.random() * 10;
            for (let y = 0; y < this.h; y += dashLen + gap) {
                ctx.fillRect(x - 3, y, 6, dashLen);
            }
        } else {
            ctx.fillRect(x - 2.5, 0, 5, this.h);
        }
        ctx.restore();
    }

    /* ─── Random oil/water stains ─────────────────────────── */
    _drawStains(ctx) {
        const stainCount = 2 + Math.floor(Math.random() * 3);

        for (let i = 0; i < stainCount; i++) {
            const cx = Math.random() * this.w;
            const cy = Math.random() * this.h;
            const size = 10 + Math.random() * 30;

            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
            const isDark = Math.random() > 0.5;

            if (isDark) {
                grad.addColorStop(0, 'rgba(20,18,16,0.25)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
            } else {
                grad.addColorStop(0, 'rgba(55,52,48,0.15)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(cx, cy, size, size * (0.6 + Math.random() * 0.4), 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
