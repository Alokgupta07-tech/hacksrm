/* ============================================================
   threeScene.js — Premium 3D Background (v4 — Stunning Edition)
   Inspired by top 3D websites: particle network, floating
   geometry, reactive camera, neon glow orbs, depth fog
   ============================================================ */

class ThreeScene {
    constructor(canvasId = 'three-canvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
        this.clock = new THREE.Clock();
        this.particles = [];
        this.neonLines = [];
        this.floatingGeo = [];
        this.connectionLines = null;
        this.cameraBase = { x: 0, y: 6, z: 18 };
        this.driftAngle = 0;
        this.scrollY = 0;
        this._paused = false;
        this._frameCount = 0;

        this._init();
        this._createScene();
        this._addListeners();
        this._setupVisibility();
        this._animate();
    }

    /* ---------- initialise renderer, camera, scene ---------- */
    _init() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.85;

        this.camera = new THREE.PerspectiveCamera(
            55, window.innerWidth / window.innerHeight, 0.1, 300
        );
        this.camera.position.set(
            this.cameraBase.x,
            this.cameraBase.y,
            this.cameraBase.z
        );
        this.camera.lookAt(0, 0, 0);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050508, 0.018);
    }

    /* ---------- build visual elements ---------- */
    _createScene() {
        /* Ambient Light */
        const ambient = new THREE.AmbientLight(0x1a1a2e, 0.6);
        this.scene.add(ambient);

        /* Main directional light — blue tinted */
        const dir = new THREE.DirectionalLight(0x4da6ff, 0.5);
        dir.position.set(5, 15, 10);
        this.scene.add(dir);

        /* Hemisphere light for subtle sky gradient */
        const hemi = new THREE.HemisphereLight(0x1a1a3e, 0x050508, 0.4);
        this.scene.add(hemi);

        /* Point lights for neon glow effect */
        const pointLight1 = new THREE.PointLight(0x4da6ff, 1.5, 40);
        pointLight1.position.set(-10, 5, -10);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00f0ff, 1.2, 35);
        pointLight2.position.set(12, 3, 8);
        this.scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0x8b5cf6, 0.8, 30);
        pointLight3.position.set(0, 8, -15);
        this.scene.add(pointLight3);
        this.pointLights = [pointLight1, pointLight2, pointLight3];

        /* Ground Plane (dark asphalt) */
        const planeGeo = new THREE.PlaneGeometry(120, 120, 1, 1);
        const planeMat = new THREE.MeshStandardMaterial({
            color: 0x080810,
            roughness: 0.95,
            metalness: 0.05,
            transparent: true,
            opacity: 0.85
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -1;
        this.scene.add(plane);

        /* Wireframe Grid — animated */
        const gridGeo = new THREE.PlaneGeometry(80, 80, 40, 40);
        const gridMat = new THREE.MeshBasicMaterial({
            color: 0x4da6ff,
            wireframe: true,
            transparent: true,
            opacity: 0.035
        });
        this.grid = new THREE.Mesh(gridGeo, gridMat);
        this.grid.rotation.x = -Math.PI / 2;
        this.grid.position.y = -0.95;
        this.scene.add(this.grid);

        /* Particle Network */
        this._createParticleNetwork(120);

        /* Floating Geometry */
        this._createFloatingGeometry();

        /* Neon Accent Lines */
        this._createNeonLines(6);

        /* Glowing Orbs */
        this._createGlowOrbs();

        /* ★ Central Hero Object — ChainGPT-style focal 3D element */
        this._createHeroObject();
    }

    /* ---------- particle network ---------- */
    _createParticleNetwork(count) {
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        this.particlePositions = positions;
        this.particleCount = count;

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 60;
            positions[i * 3 + 1] = Math.random() * 12 + 0.5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
            sizes[i] = Math.random() * 3 + 1;
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        /* Particle spheres */
        const sphereGeo = new THREE.SphereGeometry(0.06, 8, 8);
        const colors = [0x4da6ff, 0x00f0ff, 0x8b5cf6, 0x34d399];

        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: colors[i % colors.length],
                transparent: true,
                opacity: 0.4 + Math.random() * 0.3
            });
            const mesh = new THREE.Mesh(sphereGeo, mat);
            mesh.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
            mesh.userData = {
                speed: Math.random() * 0.4 + 0.1,
                phase: Math.random() * Math.PI * 2,
                baseY: positions[i * 3 + 1],
                amplitude: Math.random() * 2 + 0.5,
                driftX: (Math.random() - 0.5) * 0.02,
                driftZ: (Math.random() - 0.5) * 0.02
            };
            this.particles.push(mesh);
            this.scene.add(mesh);
        }

        /* Connection lines between nearby particles */
        this._createConnectionLines();
    }

    /* ---------- connection lines between particles ---------- */
    _createConnectionLines() {
        const maxConnections = 300;
        const lineGeo = new THREE.BufferGeometry();
        const linePositions = new Float32Array(maxConnections * 6);
        const lineColors = new Float32Array(maxConnections * 6);
        lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        lineGeo.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
        lineGeo.setDrawRange(0, 0);

        const lineMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.25,
            blending: THREE.AdditiveBlending
        });

        this.connectionLines = new THREE.LineSegments(lineGeo, lineMat);
        this.connectionMaxDist = 8;
        this.scene.add(this.connectionLines);
    }

    /* ---------- floating geometric shapes ---------- */
    _createFloatingGeometry() {
        const shapes = [
            { geo: new THREE.IcosahedronGeometry(0.6, 0), pos: [-8, 4, -5] },
            { geo: new THREE.OctahedronGeometry(0.5, 0), pos: [10, 6, -8] },
            { geo: new THREE.TetrahedronGeometry(0.4, 0), pos: [-5, 7, 3] },
            { geo: new THREE.DodecahedronGeometry(0.35, 0), pos: [7, 3, 5] },
            { geo: new THREE.TorusGeometry(0.5, 0.15, 8, 16), pos: [-12, 5, -3] },
            { geo: new THREE.TorusKnotGeometry(0.35, 0.1, 32, 8), pos: [14, 4, -6] },
            { geo: new THREE.IcosahedronGeometry(0.8, 1), pos: [0, 9, -12] },
            { geo: new THREE.OctahedronGeometry(0.3, 0), pos: [-15, 3, 8] },
        ];

        const colors = [0x4da6ff, 0x00f0ff, 0x8b5cf6, 0x34d399];

        shapes.forEach((s, i) => {
            const mat = new THREE.MeshPhysicalMaterial({
                color: colors[i % colors.length],
                transparent: true,
                opacity: 0.15,
                wireframe: true,
                emissive: colors[i % colors.length],
                emissiveIntensity: 0.3,
                roughness: 0.2,
                metalness: 0.8
            });
            const mesh = new THREE.Mesh(s.geo, mat);
            mesh.position.set(...s.pos);
            mesh.userData = {
                rotSpeed: { x: (Math.random() - 0.5) * 0.02, y: (Math.random() - 0.5) * 0.02, z: (Math.random() - 0.5) * 0.01 },
                floatPhase: Math.random() * Math.PI * 2,
                floatSpeed: Math.random() * 0.3 + 0.2,
                floatAmp: Math.random() * 1.5 + 0.5,
                baseY: s.pos[1]
            };
            this.floatingGeo.push(mesh);
            this.scene.add(mesh);
        });
    }

    /* ---------- neon accent lines ---------- */
    _createNeonLines(count) {
        const colors = [0x4da6ff, 0x00f0ff, 0x8b5cf6, 0x00f0ff, 0x4da6ff, 0x34d399];
        for (let i = 0; i < count; i++) {
            const pts = [];
            const startX = (Math.random() - 0.5) * 60;
            const startZ = (Math.random() - 0.5) * 60;
            const numPts = 8 + Math.floor(Math.random() * 4);
            for (let j = 0; j < numPts; j++) {
                pts.push(new THREE.Vector3(
                    startX + j * 2.5 + (Math.random() - 0.5) * 2,
                    0.02 + Math.random() * 0.08,
                    startZ + (Math.random() - 0.5) * 6
                ));
            }
            const curve = new THREE.CatmullRomCurve3(pts);
            const geo = new THREE.TubeGeometry(curve, 40, 0.018, 4, false);
            const mat = new THREE.MeshBasicMaterial({
                color: colors[i % colors.length],
                transparent: true,
                opacity: 0.1
            });
            const line = new THREE.Mesh(geo, mat);
            line.userData = {
                phase: Math.random() * Math.PI * 2,
                baseOpacity: 0.1
            };
            this.neonLines.push(line);
            this.scene.add(line);
        }
    }

    /* ---------- glowing orbs ---------- */
    _createGlowOrbs() {
        this.glowOrbs = [];
        const orbData = [
            { color: 0x4da6ff, size: 0.3, pos: [-6, 3, -4], intensity: 0.8 },
            { color: 0x00f0ff, size: 0.25, pos: [8, 5, -6], intensity: 0.6 },
            { color: 0x8b5cf6, size: 0.35, pos: [3, 7, -10], intensity: 0.7 },
            { color: 0x34d399, size: 0.2, pos: [-10, 4, 5], intensity: 0.5 },
            { color: 0x4da6ff, size: 0.15, pos: [15, 2, 3], intensity: 0.4 },
        ];

        orbData.forEach(o => {
            const geo = new THREE.SphereGeometry(o.size, 16, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: o.color,
                transparent: true,
                opacity: o.intensity
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(...o.pos);
            mesh.userData = {
                phase: Math.random() * Math.PI * 2,
                baseY: o.pos[1],
                speed: Math.random() * 0.3 + 0.15,
                amplitude: Math.random() * 2 + 1
            };
            this.glowOrbs.push(mesh);
            this.scene.add(mesh);
        });
    }

    /* ---------- event listeners ---------- */
    _addListeners() {
        window.addEventListener('resize', () => this._onResize(), { passive: true });
        window.addEventListener('mousemove', (e) => {
            this.mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
            this.mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        }, { passive: true });
        window.addEventListener('scroll', () => {
            this.scrollY = window.scrollY / (document.body.scrollHeight - window.innerHeight);
        }, { passive: true });
    }

    _onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    /* ---------- visibility-aware pause ---------- */
    _setupVisibility() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._paused = true;
                this.clock.stop();
            } else {
                this._paused = false;
                this.clock.start();
                this._animate();
            }
        });

        /* Pause when canvas scrolls completely off-screen */
        if (typeof IntersectionObserver !== 'undefined') {
            const obs = new IntersectionObserver(entries => {
                this._paused = !entries[0].isIntersecting;
                if (!this._paused) {
                    this.clock.start();
                    this._animate();
                } else {
                    this.clock.stop();
                }
            }, { threshold: 0 });
            obs.observe(this.canvas);
        }
    }

    /* ---------- animation loop ---------- */
    _animate() {
        if (this._paused) return;              /* ← skip work when hidden/off-screen */
        requestAnimationFrame(() => this._animate());

        this._frameCount++;
        const t = this.clock.getElapsedTime();

        /* Smooth mouse interpolation */
        this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.04;
        this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.04;

        /* Camera drift — gentle orbiting + mouse influence + scroll parallax */
        this.driftAngle += 0.0006;
        const driftRadius = 2.5;
        const scrollOffset = this.scrollY * 8;
        this.camera.position.x = this.cameraBase.x
            + Math.sin(this.driftAngle) * driftRadius
            + this.mouse.x * 2;
        this.camera.position.y = this.cameraBase.y
            + Math.sin(t * 0.12) * 0.4
            - this.mouse.y * 0.6
            - scrollOffset * 0.5;
        this.camera.position.z = this.cameraBase.z
            + Math.cos(this.driftAngle) * driftRadius * 0.6
            - scrollOffset;
        this.camera.lookAt(0, -scrollOffset * 0.3, -scrollOffset * 0.5);

        /* Animate particles */
        for (const p of this.particles) {
            const d = p.userData;
            p.position.y = d.baseY + Math.sin(t * d.speed + d.phase) * d.amplitude;
            p.position.x += d.driftX;
            p.position.z += d.driftZ;
            p.material.opacity = 0.25 + Math.sin(t * 0.6 + d.phase) * 0.2;

            /* Wrap particles that drift too far */
            if (p.position.x > 35) p.position.x = -35;
            if (p.position.x < -35) p.position.x = 35;
            if (p.position.z > 35) p.position.z = -35;
            if (p.position.z < -35) p.position.z = 35;
        }

        /* Update connection lines — throttle to every 3rd frame */
        if (this._frameCount % 3 === 0) this._updateConnections();

        /* Animate floating geometry */
        for (const g of this.floatingGeo) {
            const d = g.userData;
            g.rotation.x += d.rotSpeed.x;
            g.rotation.y += d.rotSpeed.y;
            g.rotation.z += d.rotSpeed.z;
            g.position.y = d.baseY + Math.sin(t * d.floatSpeed + d.floatPhase) * d.floatAmp;
            /* React to mouse */
            g.rotation.x += this.mouse.y * 0.001;
            g.rotation.y += this.mouse.x * 0.001;
        }

        /* Pulse neon lines */
        for (const line of this.neonLines) {
            const d = line.userData;
            line.material.opacity = d.baseOpacity + Math.sin(t * 0.6 + d.phase) * 0.08;
        }

        /* Animate glow orbs */
        for (const orb of this.glowOrbs) {
            const d = orb.userData;
            orb.position.y = d.baseY + Math.sin(t * d.speed + d.phase) * d.amplitude;
            const scale = 1 + Math.sin(t * 0.8 + d.phase) * 0.15;
            orb.scale.setScalar(scale);
        }

        /* Animate point lights */
        if (this.pointLights) {
            this.pointLights[0].intensity = 1.5 + Math.sin(t * 0.5) * 0.5;
            this.pointLights[1].intensity = 1.2 + Math.sin(t * 0.7 + 1) * 0.4;
            this.pointLights[2].intensity = 0.8 + Math.sin(t * 0.3 + 2) * 0.3;
        }

        /* Subtle grid movement */
        if (this.grid) {
            this.grid.position.z = Math.sin(t * 0.1) * 0.5;
        }

        /* ★ Animate Central Hero Object */
        this._animateHeroObject(t);

        this.renderer.render(this.scene, this.camera);
    }

    /* ---------- update particle connections ---------- */
    _updateConnections() {
        if (!this.connectionLines) return;

        const positions = this.connectionLines.geometry.attributes.position.array;
        const colors = this.connectionLines.geometry.attributes.color.array;
        let vertexCount = 0;
        const maxDist = this.connectionMaxDist;
        const maxDistSq = maxDist * maxDist;
        const maxLines = 300;

        for (let i = 0; i < this.particles.length && vertexCount < maxLines * 2; i++) {
            for (let j = i + 1; j < this.particles.length && vertexCount < maxLines * 2; j++) {
                const dx = this.particles[i].position.x - this.particles[j].position.x;
                const dy = this.particles[i].position.y - this.particles[j].position.y;
                const dz = this.particles[i].position.z - this.particles[j].position.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq < maxDistSq) {
                    const alpha = 1 - distSq / maxDistSq;
                    const idx = vertexCount * 3;

                    positions[idx] = this.particles[i].position.x;
                    positions[idx + 1] = this.particles[i].position.y;
                    positions[idx + 2] = this.particles[i].position.z;
                    positions[idx + 3] = this.particles[j].position.x;
                    positions[idx + 4] = this.particles[j].position.y;
                    positions[idx + 5] = this.particles[j].position.z;

                    colors[idx] = 0.3 * alpha;
                    colors[idx + 1] = 0.65 * alpha;
                    colors[idx + 2] = 1.0 * alpha;
                    colors[idx + 3] = 0.3 * alpha;
                    colors[idx + 4] = 0.65 * alpha;
                    colors[idx + 5] = 1.0 * alpha;

                    vertexCount += 2;
                }
            }
        }

        this.connectionLines.geometry.setDrawRange(0, vertexCount);
        this.connectionLines.geometry.attributes.position.needsUpdate = true;
        this.connectionLines.geometry.attributes.color.needsUpdate = true;
    }

    /* ---------- public API ---------- */
    destroy() {
        this.renderer.dispose();
        window.removeEventListener('resize', this._onResize);
    }

    /* ---------- ★ central hero 3D object ---------- */
    _createHeroObject() {
        this.heroGroup = new THREE.Group();
        this.heroGroup.position.set(6, 5, 2);

        /* Main icosahedron — wireframe */
        const icoGeo = new THREE.IcosahedronGeometry(2.2, 1);
        const icoMat = new THREE.MeshPhysicalMaterial({
            color: 0x4da6ff,
            transparent: true,
            opacity: 0.18,
            wireframe: true,
            emissive: 0x4da6ff,
            emissiveIntensity: 0.5,
            roughness: 0.1,
            metalness: 0.9
        });
        this.heroIco = new THREE.Mesh(icoGeo, icoMat);
        this.heroGroup.add(this.heroIco);

        /* Inner solid icosahedron — subtle core glow */
        const innerGeo = new THREE.IcosahedronGeometry(1.0, 2);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.08
        });
        this.heroInner = new THREE.Mesh(innerGeo, innerMat);
        this.heroGroup.add(this.heroInner);

        /* Ring 1 — horizontal orbit */
        const ring1Geo = new THREE.TorusGeometry(3.2, 0.02, 8, 64);
        const ring1Mat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.2
        });
        this.heroRing1 = new THREE.Mesh(ring1Geo, ring1Mat);
        this.heroRing1.rotation.x = Math.PI / 2;
        this.heroGroup.add(this.heroRing1);

        /* Ring 2 — tilted orbit */
        const ring2Geo = new THREE.TorusGeometry(3.8, 0.015, 8, 64);
        const ring2Mat = new THREE.MeshBasicMaterial({
            color: 0x8b5cf6,
            transparent: true,
            opacity: 0.15
        });
        this.heroRing2 = new THREE.Mesh(ring2Geo, ring2Mat);
        this.heroRing2.rotation.x = Math.PI / 3;
        this.heroRing2.rotation.z = Math.PI / 6;
        this.heroGroup.add(this.heroRing2);

        /* Ring 3 — vertical orbit */
        const ring3Geo = new THREE.TorusGeometry(2.6, 0.018, 8, 64);
        const ring3Mat = new THREE.MeshBasicMaterial({
            color: 0x34d399,
            transparent: true,
            opacity: 0.12
        });
        this.heroRing3 = new THREE.Mesh(ring3Geo, ring3Mat);
        this.heroRing3.rotation.y = Math.PI / 4;
        this.heroGroup.add(this.heroRing3);

        /* Orbiting satellite spheres */
        this.heroSatellites = [];
        const satColors = [0x4da6ff, 0x00f0ff, 0x8b5cf6, 0x34d399, 0x4da6ff, 0x00f0ff];
        for (let i = 0; i < 6; i++) {
            const satGeo = new THREE.SphereGeometry(0.08, 8, 8);
            const satMat = new THREE.MeshBasicMaterial({
                color: satColors[i],
                transparent: true,
                opacity: 0.7
            });
            const sat = new THREE.Mesh(satGeo, satMat);
            sat.userData = {
                orbitRadius: 3.0 + Math.random() * 1.5,
                orbitSpeed: 0.3 + Math.random() * 0.4,
                orbitPhase: (i / 6) * Math.PI * 2,
                orbitTilt: Math.random() * Math.PI
            };
            this.heroSatellites.push(sat);
            this.heroGroup.add(sat);
        }

        /* Point light inside the hero object */
        const heroLight = new THREE.PointLight(0x4da6ff, 2, 15);
        heroLight.position.set(0, 0, 0);
        this.heroLight = heroLight;
        this.heroGroup.add(heroLight);

        this.scene.add(this.heroGroup);
    }

    /* ---------- ★ animate hero object ---------- */
    _animateHeroObject(t) {
        if (!this.heroGroup) return;

        /* Main rotation — slow, majestic spin + mouse reactivity */
        this.heroIco.rotation.x += 0.003 + this.mouse.y * 0.003;
        this.heroIco.rotation.y += 0.005 + this.mouse.x * 0.003;
        this.heroIco.rotation.z += 0.001;

        /* Inner core — counter-rotate */
        this.heroInner.rotation.x -= 0.004;
        this.heroInner.rotation.y -= 0.006;

        /* Pulsing glow */
        const pulse = 0.15 + Math.sin(t * 0.8) * 0.08;
        this.heroIco.material.opacity = pulse;
        this.heroIco.material.emissiveIntensity = 0.4 + Math.sin(t * 0.6) * 0.25;
        this.heroInner.material.opacity = 0.06 + Math.sin(t * 1.2) * 0.04;

        /* Rings — independent rotations */
        this.heroRing1.rotation.z += 0.008;
        this.heroRing2.rotation.z -= 0.006;
        this.heroRing2.rotation.x += 0.002;
        this.heroRing3.rotation.x += 0.005;
        this.heroRing3.rotation.z += 0.003;

        /* Ring opacity pulse */
        this.heroRing1.material.opacity = 0.15 + Math.sin(t * 0.5) * 0.08;
        this.heroRing2.material.opacity = 0.12 + Math.sin(t * 0.7 + 1) * 0.06;
        this.heroRing3.material.opacity = 0.10 + Math.sin(t * 0.9 + 2) * 0.05;

        /* Satellites orbit */
        for (const sat of this.heroSatellites) {
            const d = sat.userData;
            const angle = t * d.orbitSpeed + d.orbitPhase;
            sat.position.x = Math.cos(angle) * d.orbitRadius;
            sat.position.y = Math.sin(angle) * Math.sin(d.orbitTilt) * d.orbitRadius * 0.5;
            sat.position.z = Math.sin(angle) * Math.cos(d.orbitTilt) * d.orbitRadius;
            sat.material.opacity = 0.5 + Math.sin(t * 2 + d.orbitPhase) * 0.3;
        }

        /* Hero light pulsing */
        if (this.heroLight) {
            this.heroLight.intensity = 1.5 + Math.sin(t * 0.8) * 0.8;
        }

        /* Scroll morph — scale & position shift */
        const scrollInfluence = this.scrollY;
        const morphScale = 1 - scrollInfluence * 0.3;
        this.heroGroup.scale.setScalar(Math.max(morphScale, 0.5));
        this.heroGroup.position.y = 5 - scrollInfluence * 4;
        this.heroGroup.position.x = 6 + scrollInfluence * 3;

        /* Float up and down gently */
        this.heroGroup.position.y += Math.sin(t * 0.3) * 0.4;
    }
}
