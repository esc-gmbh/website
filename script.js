/* ==========================================================================
   ESC GmbH – Interaktionen & Animationen
   ========================================================================== */

(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const storage = {
        get(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch (e) { /* z. B. privater Modus */ }
        }
    };

    // Aktuelles Jahr im Footer
    document.querySelectorAll('[data-year]').forEach(el => {
        el.textContent = new Date().getFullYear();
    });

    /* ---------- Header, Scroll-Fortschritt, Nach-oben-Button ---------- */
    const header = document.querySelector('.site-header');
    const progress = document.querySelector('.scroll-progress');
    const toTop = document.querySelector('.to-top');
    const heroBg = document.querySelector('.hero-bg');
    const footerBig = document.querySelector('.footer-big');
    let lastY = window.scrollY;
    let ticking = false;

    function onScroll() {
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;

        if (header) {
            header.classList.toggle('scrolled', y > 20);
            const navOpen = document.body.classList.contains('nav-open');
            header.classList.toggle('hidden', !navOpen && y > lastY && y > 400);
        }
        if (progress) {
            progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
        }
        if (toTop) {
            toTop.classList.toggle('show', y > 700);
        }
        if (heroBg && !reduceMotion) {
            heroBg.style.transform = `translate3d(0, ${y * 0.3}px, 0) scale(1.05)`;
        }
        if (footerBig) {
            // 0 % sobald der Schriftzug unten auftaucht, 100 % am Seitenende
            const startY = y + footerBig.getBoundingClientRect().top - window.innerHeight;
            const range = max - startY;
            const p = range > 0 ? (y - startY) / range : 1;
            footerBig.style.setProperty('--fill', `${Math.min(Math.max(p, 0), 1) * 100}%`);
        }
        updateProcess();
        updateNavSpy();

        lastY = y;
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(onScroll);
            ticking = true;
        }
    }, { passive: true });

    toTop?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    /* ---------- Mobile Navigation ---------- */
    const navToggle = document.querySelector('.nav-toggle');

    function setNav(open) {
        document.body.classList.toggle('nav-open', open);
        navToggle?.setAttribute('aria-expanded', String(open));
    }

    navToggle?.addEventListener('click', () => {
        setNav(!document.body.classList.contains('nav-open'));
    });

    document.querySelectorAll('.main-nav a').forEach(link => {
        link.addEventListener('click', () => setNav(false));
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') setNav(false);
    });

    /* ---------- Wort-für-Wort-Animation für Überschriften ---------- */
    document.querySelectorAll('.split-words').forEach(el => {
        let i = 0;
        const wrap = node => {
            const word = document.createElement('span');
            word.className = 'word';
            const inner = document.createElement('span');
            inner.style.setProperty('--i', i++);
            inner.appendChild(node);
            word.appendChild(inner);
            return word;
        };

        [...el.childNodes].forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const frag = document.createDocumentFragment();
                node.textContent.split(/(\s+)/).forEach(part => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) {
                        frag.appendChild(document.createTextNode(' '));
                    } else {
                        frag.appendChild(wrap(document.createTextNode(part)));
                    }
                });
                el.replaceChild(frag, node);
            } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') {
                const placeholder = document.createComment('');
                el.replaceChild(placeholder, node);
                el.replaceChild(wrap(node), placeholder);
            }
        });
    });

    /* ---------- Einblenden beim Scrollen ---------- */
    const revealEls = document.querySelectorAll('.reveal, .split-words');

    if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

        revealEls.forEach(el => revealObserver.observe(el));
    } else {
        revealEls.forEach(el => el.classList.add('visible'));
    }

    /* ---------- Wechselnde Begriffe im Hero ---------- */
    const rotator = document.querySelector('.rotator');

    if (rotator) {
        const words = [...rotator.children];
        let current = 0;

        setInterval(() => {
            const prev = words[current];
            current = (current + 1) % words.length;
            const next = words[current];

            prev.classList.remove('active');
            prev.classList.add('leaving');
            next.classList.remove('leaving');
            next.classList.add('active');

            setTimeout(() => prev.classList.remove('leaving'), 800);
        }, 2600);
    }

    /* ---------- Hero-Canvas: Stromimpulse auf einem Leiterbahn-Raster ---------- */
    const canvas = document.querySelector('.hero-canvas');

    // Läuft immer; am großen Bildschirm weniger und (per CSS) blassere Impulse
    if (canvas) {
        const ctx = canvas.getContext('2d');
        const GRID = 48;
        const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let width = 0;
        let height = 0;
        let sparks = [];
        let running = false;
        let frame = null;
        let lastSpawn = 0;
        let wide = false;
        let origin = null; // Mitte der 3D-Szene: am Desktop strömen die Impulse von dort weg

        function resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.offsetWidth;
            height = canvas.offsetHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            wide = width > 1024;
            const scene = document.querySelector('.hero-visual');
            if (wide && scene) {
                const c = canvas.getBoundingClientRect();
                const r = scene.getBoundingClientRect();
                origin = { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height * 0.55, r: Math.min(r.width, r.height) * 0.38 };
            } else {
                origin = null;
            }
        }

        // Richtung, die vom Szenen-Mittelpunkt wegführt
        const outward = (s, d) => (s.x - origin.x) * d[0] + (s.y - origin.y) * d[1] > 0;

        function spawn(x, y) {
            if (origin && x == null) {
                // Am Rand der Szene starten, Richtung nach außen
                const a = Math.random() * Math.PI * 2;
                const cx = Math.cos(a);
                const cy = Math.sin(a);
                const dir = Math.abs(cx) > Math.abs(cy) ? [Math.sign(cx), 0] : [0, Math.sign(cy)];
                sparks.push({
                    x: Math.round((origin.x + cx * origin.r) / GRID) * GRID,
                    y: Math.round((origin.y + cy * origin.r) / GRID) * GRID,
                    dx: dir[0],
                    dy: dir[1],
                    travelled: 0,
                    speed: 1.5 + Math.random() * 2,
                    life: 10 + Math.floor(Math.random() * 12)
                });
                return;
            }
            const gx = x == null ? Math.floor(Math.random() * (width / GRID)) * GRID : Math.round(x / GRID) * GRID;
            const gy = y == null ? Math.floor(Math.random() * (height / GRID)) * GRID : Math.round(y / GRID) * GRID;
            const dir = DIRS[Math.floor(Math.random() * 4)];
            sparks.push({
                x: gx,
                y: gy,
                dx: dir[0],
                dy: dir[1],
                travelled: 0,
                speed: 2 + Math.random() * 3,
                life: 8 + Math.floor(Math.random() * 14)
            });
        }

        function step() {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.07)';
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'source-over';

            const target = wide
                ? Math.max(5, Math.round((width * height) / 160000))
                : Math.max(10, Math.round((width * height) / 45000));
            if (sparks.length < target && Math.random() < 0.25) spawn();

            sparks.forEach(s => {
                const px = s.x;
                const py = s.y;
                s.x += s.dx * s.speed;
                s.y += s.dy * s.speed;
                s.travelled += s.speed;

                ctx.lineCap = 'round';
                ctx.strokeStyle = 'rgba(233, 240, 29, 0.18)';
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(s.x, s.y);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(248, 252, 150, 0.95)';
                ctx.lineWidth = 1.6;
                ctx.stroke();

                if (s.travelled >= GRID) {
                    s.travelled = 0;
                    s.x = Math.round(s.x / GRID) * GRID;
                    s.y = Math.round(s.y / GRID) * GRID;
                    s.life--;

                    if (Math.random() < 0.35) {
                        let turn = Math.random() < 0.5 ? 1 : -1;
                        // Am Desktop nur Abzweigungen, die weiter nach außen führen
                        if (origin && !outward(s, [s.dy * turn, s.dx * -turn])) turn = -turn;
                        [s.dx, s.dy] = [s.dy * turn, s.dx * -turn];

                        ctx.fillStyle = 'rgba(233, 240, 29, 0.9)';
                        ctx.beginPath();
                        ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            });

            sparks = sparks.filter(s => s.life > 0 && s.x > -GRID && s.x < width + GRID && s.y > -GRID && s.y < height + GRID);
            frame = requestAnimationFrame(step);
        }

        function start() {
            if (running) return;
            running = true;
            frame = requestAnimationFrame(step);
        }

        function stop() {
            running = false;
            cancelAnimationFrame(frame);
        }

        resize();
        window.addEventListener('resize', resize);

        canvas.parentElement.addEventListener('pointermove', e => {
            const now = performance.now();
            if (wide || now - lastSpawn < 90 || sparks.length > 80) return;
            lastSpawn = now;
            const rect = canvas.getBoundingClientRect();
            spawn(e.clientX - rect.left, e.clientY - rect.top);
        });

        new IntersectionObserver(([entry]) => {
            entry.isIntersecting ? start() : stop();
        }).observe(canvas);

        document.addEventListener('visibilitychange', () => {
            document.hidden ? stop() : start();
        });
    }

    /* ---------- 3D-Szene im Hero: Tagesablauf, Energiefluss, Smart-Home-Steuerung ---------- */
    const solarScene = document.querySelector('[data-solar]');

    if (solarScene) {
        const stage = solarScene.querySelector('.stage');
        const svg = solarScene.querySelector('.iso');
        const sunOrbit = svg.querySelector('.sun-orbit');
        const moonOrbit = svg.querySelector('.moon-orbit');
        const waterEls = svg.querySelectorAll('.water');
        const cells = [...svg.querySelectorAll('.cell')];
        const flows = name => svg.querySelectorAll(`.flow[data-line="${name}"]`);
        const appCard = solarScene.querySelector('.app-card');
        const rows = [...solarScene.querySelectorAll('[data-toggle]')];
        const graph = solarScene.querySelector('.graph');
        const graphLine = graph.querySelector('.g-line');
        const graphArea = graph.querySelector('.g-area');
        const graphNow = graph.querySelector('.g-now');
        const graphDot = graph.querySelector('.g-dot');
        const val = name => solarScene.querySelector(`[data-val="${name}"]`);
        const out = {
            pv: val('pv'),
            car: val('car'),
            carBar: val('car-bar'),
            water: val('water'),
            battery: val('battery'),
            batteryBar: val('battery-bar'),
            batteryChip: val('battery').closest('.chip'),
            batteryGraph: val('battery-graph'),
            time: val('time'),
            source: val('source')
        };
        const fmt = new Intl.NumberFormat('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        const HOURS_PER_SECOND = 24 / 36; // ein ganzer Tag in 36 Sekunden
        const SLOTS = 48;                 // Graph: ein Messpunkt pro halbe Stunde
        const GRAPH_W = 200;
        const GRAPH_H = 50;
        const state = { wohnen: false, kueche: false, water: true, car: true };
        const history = new Array(SLOTS).fill(null);
        let hour = 9;
        let battery = 45;
        let carCharge = 34;
        let waterTemp = 41;
        let isNight = null;
        let time = 0;
        let lastText = 0;
        let tiltX = 0;
        let tiltY = 0;
        let targetX = 0;
        let targetY = 0;
        let lastPointer = -1e9;
        let autoPausedUntil = 0;
        let autoIndex = 0;
        let last = performance.now();
        let frame = null;
        let visible = true;

        const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
        const nightAt = h => h < 6.6 || h > 19.4;

        // Energiemodell: ein Zeitschritt, ohne Darstellung
        function simulate(dt) {
            hour = (hour + dt * HOURS_PER_SECOND) % 24;
            const sunUp = hour >= 6 && hour <= 20;
            const sunT = clamp((hour - 6) / 14, 0, 1);
            const pv = sunUp ? 7.4 * Math.pow(Math.sin(Math.PI * sunT), 1.3) : 0;
            const solar = pv > 0.8;
            const load = 0.4 + (state.wohnen ? 0.4 : 0) + (state.kueche ? 0.4 : 0) + (state.water ? 1.2 : 0) + (state.car ? 1.8 : 0);
            const charging = solar && battery < 99.5;
            const discharging = !solar && battery > 0.5;
            const supply = solar || discharging;

            if (charging) battery += dt * 4.5 * (pv / 7.4);
            if (discharging) battery -= dt * load * 1.1;
            battery = clamp(battery, 0, 100);

            if (supply && state.car) {
                carCharge += dt * 5;
                if (carCharge >= 100) carCharge = 22;
            }
            waterTemp = clamp(waterTemp + (supply && state.water ? dt * 2.4 : -dt * 1.4), 35, 60);
            history[Math.floor(hour * SLOTS / 24) % SLOTS] = battery;

            return { pv, solar, charging, discharging, supply, sunUp, sunT };
        }

        // Zwei Tage vorab durchrechnen: Der Graph ist sofort vollständig und ohne Sprung
        (function prefill() {
            const saved = { ...state };
            for (let i = 0; i < 2 * 36 * 20; i++) {
                const night = nightAt(hour);
                state.wohnen = night;
                state.kueche = night;
                simulate(0.05);
            }
            Object.assign(state, saved);
        })();

        function drawGraph(discharging) {
            const pts = [];
            history.forEach((b, i) => {
                if (b !== null) pts.push([(i / (SLOTS - 1)) * GRAPH_W, GRAPH_H - (b / 100) * (GRAPH_H - 4) - 2]);
            });
            if (pts.length < 2) return;
            const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
            graphLine.setAttribute('d', d);
            graphArea.setAttribute('d', `${d} L${pts[pts.length - 1][0].toFixed(1)},${GRAPH_H} L${pts[0][0].toFixed(1)},${GRAPH_H} Z`);
            const x = (hour / 24) * GRAPH_W;
            const y = GRAPH_H - (battery / 100) * (GRAPH_H - 4) - 2;
            graphNow.setAttribute('x1', x.toFixed(1));
            graphNow.setAttribute('x2', x.toFixed(1));
            graphDot.setAttribute('cx', x.toFixed(1));
            graphDot.setAttribute('cy', y.toFixed(1));
            graph.classList.toggle('discharging', discharging);
        }

        function setFlow(name, on, reverse = false) {
            flows(name).forEach(f => {
                f.classList.toggle('off', !on);
                f.classList.toggle('reverse', on && reverse);
            });
        }

        function applyToggles() {
            rows.forEach(row => {
                const on = state[row.dataset.toggle];
                row.setAttribute('aria-pressed', String(on));
                row.querySelector('em').textContent = on ? 'An' : 'Aus';
            });
            svg.querySelectorAll('.window').forEach(w => w.classList.toggle('on', state[w.dataset.room]));
        }

        function ping() {
            appCard.classList.remove('ping');
            void appCard.offsetWidth;
            appCard.classList.add('ping');
        }

        rows.forEach(row => row.addEventListener('click', () => {
            state[row.dataset.toggle] = !state[row.dataset.toggle];
            autoPausedUntil = performance.now() + 12000;
            applyToggles();
            ping();
        }));

        // Ohne Eingriff schaltet die App Boiler und Wallbox selbst um
        setInterval(() => {
            if (performance.now() < autoPausedUntil || !visible) return;
            const key = autoIndex++ % 2 ? 'car' : 'water';
            state[key] = !state[key];
            applyToggles();
            ping();
        }, 4200);

        // Wasser bleibt blau; je heißer, desto tiefer der Farbton
        function waterColor(t) {
            const k = clamp((t - 35) / 25, 0, 1);
            return `hsl(${Math.round(205 + k * 12)}, 90%, ${Math.round(62 - k * 10)}%)`;
        }

        function tick(now) {
            const dt = Math.min(now - last, 50) / 1000;
            last = now;
            time += dt;

            const e = simulate(dt);

            // Sonne 6–20 Uhr, Mond 20–6 Uhr, jeweils im Bogen über das Dach
            const moonT = clamp(((hour - 20 + 24) % 24) / 10, 0, 1);
            sunOrbit.style.transform = `rotate(${-78 + 156 * e.sunT}deg)`;
            sunOrbit.style.opacity = e.sunUp ? clamp(Math.sin(Math.PI * e.sunT) * 4, 0, 1) : 0;
            moonOrbit.style.transform = `rotate(${-78 + 156 * moonT}deg)`;
            moonOrbit.style.opacity = e.sunUp ? 0 : clamp(Math.sin(Math.PI * moonT) * 4, 0, 1);

            const night = nightAt(hour);
            if (night !== isNight) {
                isNight = night;
                stage.classList.toggle('night', night);
                // Smart-Home-Automatik: abends Licht an, morgens aus
                state.wohnen = night;
                state.kueche = night;
                applyToggles();
            }

            setFlow('pv', e.pv > 0.5);
            setFlow('battery', e.charging || e.discharging, e.discharging);
            setFlow('house', e.supply);
            setFlow('water', e.supply && state.water);
            setFlow('car', e.supply && state.car);
            stage.classList.toggle('on-battery', e.discharging);
            svg.querySelector('.wallbox-led').classList.toggle('on', e.supply && state.car);
            svg.querySelector('.tank').classList.toggle('heating', e.supply && state.water);

            if (time - lastText > 0.2) {
                lastText = time;
                const hh = Math.floor(hour);
                const mm = Math.floor((hour - hh) * 6) * 10;
                out.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
                out.source.textContent = e.solar ? 'Sonnenstrom' : e.discharging ? 'Speicherstrom' : 'Netzstrom';
                out.pv.textContent = `${fmt.format(e.pv)} kW`;
                out.car.textContent = `${Math.floor(carCharge)} %`;
                out.carBar.style.width = `${carCharge}%`;
                out.water.textContent = `${Math.round(waterTemp)} °C`;
                out.battery.textContent = `${Math.round(battery)} %`;
                out.batteryGraph.textContent = `${Math.round(battery)} %`;
                out.batteryBar.style.width = `${battery}%`;
                out.batteryChip.classList.toggle('discharging', e.discharging);
                cells.forEach((c, i) => c.classList.toggle('on', battery > i * 25 + 2));
                const color = waterColor(waterTemp);
                waterEls.forEach(el => { el.style.fill = color; });
                drawGraph(e.discharging);
            }

            // Neigung: folgt der Maus, sonst sanftes Schwenken
            if (now - lastPointer > 2500) {
                targetX = Math.sin(time * 0.45) * 12;
                targetY = 8 + Math.sin(time * 0.31) * 4;
            }
            tiltX += (targetX - tiltX) * Math.min(dt * 3, 1);
            tiltY += (targetY - tiltY) * Math.min(dt * 3, 1);
            stage.style.transform = `rotateX(${tiltY}deg) rotateY(${tiltX}deg)`;

            frame = requestAnimationFrame(tick);
        }

        function startScene() {
            if (frame || !visible || document.hidden) return;
            last = performance.now();
            frame = requestAnimationFrame(tick);
        }

        function stopScene() {
            cancelAnimationFrame(frame);
            frame = null;
        }

        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            visible ? startScene() : stopScene();
        }).observe(solarScene);

        document.addEventListener('visibilitychange', () => {
            document.hidden ? stopScene() : startScene();
        });

        if (finePointer) {
            window.addEventListener('pointermove', e => {
                const rect = solarScene.getBoundingClientRect();
                const dx = (e.clientX - (rect.left + rect.width / 2)) / window.innerWidth;
                const dy = (e.clientY - (rect.top + rect.height / 2)) / window.innerHeight;
                targetX = Math.max(-1, Math.min(1, dx)) * -30;
                targetY = 8 + Math.max(-1, Math.min(1, dy)) * 18;
                lastPointer = performance.now();
            }, { passive: true });
        }

        applyToggles();
    }

    /* ---------- Navigation: aktuelle Seite bzw. aktuellen Abschnitt markieren ---------- */
    const mainNav = document.querySelector('.main-nav');
    const navLinks = mainNav ? [...mainNav.querySelectorAll('a')] : [];
    const samePage = path => path.replace(/index\.html$/, '');
    const spyLinks = navLinks.filter(a =>
        a.hash && samePage(a.pathname) === samePage(location.pathname) && document.querySelector(a.hash));
    let activeLink = navLinks.find(a => a.getAttribute('aria-current') === 'page') || null;
    let indicator = null;

    function moveIndicator(link) {
        if (!indicator) return;
        if (!link || link.classList.contains('btn')) {
            indicator.style.opacity = '0';
            return;
        }
        indicator.style.opacity = '1';
        indicator.style.width = `${link.offsetWidth}px`;
        indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    }

    function setActive(link) {
        if (link && link === activeLink && link.classList.contains('active')) return;
        navLinks.forEach(a => a.classList.toggle('active', a === link));
        activeLink = link;
        moveIndicator(link);
    }

    // Startseite: der Abschnitt, der gerade im Bild ist, wird markiert
    function updateNavSpy() {
        if (!spyLinks.length) return;
        let current = spyLinks[0];
        spyLinks.forEach(link => {
            if (document.querySelector(link.hash).getBoundingClientRect().top <= window.innerHeight * 0.4) {
                current = link;
            }
        });
        setActive(current);
    }

    if (mainNav) {
        indicator = document.createElement('span');
        indicator.className = 'nav-indicator';
        mainNav.appendChild(indicator);

        navLinks.forEach(a => a.addEventListener('pointerenter', () => moveIndicator(a)));
        mainNav.addEventListener('pointerleave', () => moveIndicator(activeLink));
        window.addEventListener('resize', () => moveIndicator(activeLink));
        document.fonts?.ready.then(() => moveIndicator(activeLink));

        setActive(activeLink);
    }

    /* ---------- Karten: 3D-Neigung & Lichtkegel ---------- */
    if (finePointer && !reduceMotion) {
        document.querySelectorAll('[data-tilt]').forEach(card => {
            card.addEventListener('pointermove', e => {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                card.style.setProperty('--mx', `${x * 100}%`);
                card.style.setProperty('--my', `${y * 100}%`);
                card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 7}deg) rotateY(${(x - 0.5) * 7}deg)`;
            });
            card.addEventListener('pointerleave', () => {
                card.style.transform = '';
            });
        });

        const glow = document.querySelector('.cursor-glow');
        if (glow) {
            document.body.classList.add('has-pointer');
            window.addEventListener('pointermove', e => {
                glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
            }, { passive: true });
        }
    }

    /* ---------- Ablauf: Fortschrittslinie ---------- */
    const processList = document.querySelector('.process-steps');
    const processSteps = processList ? [...processList.querySelectorAll('.process-step')] : [];

    function updateProcess() {
        if (!processList) return;
        const rect = processList.getBoundingClientRect();
        const start = window.innerHeight * 0.85;
        const end = window.innerHeight * 0.35;
        const p = Math.min(Math.max((start - rect.top) / (start - end), 0), 1);
        processList.style.setProperty('--progress', p);
        processSteps.forEach((step, i) => {
            step.classList.toggle('lit', p >= i / Math.max(processSteps.length - 1, 1) - 0.001 && p > 0);
        });
    }

    /* ---------- Google Maps erst nach Zustimmung laden ---------- */
    const COOKIE_KEY = 'esc_cookie_consent';
    const mapFrame = document.querySelector('.map-wrap iframe[data-src]');
    const mapPlaceholder = document.querySelector('.map-placeholder');

    function loadMap() {
        if (!mapFrame || mapFrame.src) return;
        mapFrame.src = mapFrame.dataset.src;
        mapPlaceholder?.remove();
    }

    document.querySelector('[data-load-map]')?.addEventListener('click', loadMap);

    if (storage.get(COOKIE_KEY) === 'accepted') loadMap();

    /* ---------- Cookie-Banner ---------- */
    const cookieBanner = document.getElementById('cookie-banner');

    function hideCookieBanner() {
        if (!cookieBanner) return;
        cookieBanner.classList.add('closing');
        setTimeout(() => { cookieBanner.hidden = true; }, 500);
    }

    if (cookieBanner) {
        if (storage.get(COOKIE_KEY)) {
            cookieBanner.hidden = true;
        }

        document.getElementById('accept-cookies')?.addEventListener('click', () => {
            storage.set(COOKIE_KEY, 'accepted');
            hideCookieBanner();
            loadMap();
        });

        document.getElementById('decline-cookies')?.addEventListener('click', () => {
            storage.set(COOKIE_KEY, 'declined');
            hideCookieBanner();
        });
    }

    /* ---------- Kontaktformular ohne Seitenwechsel absenden ---------- */
    const form = document.querySelector('.contact-form');

    if (form && window.fetch) {
        const status = form.querySelector('.form-status');
        const submit = form.querySelector('[type="submit"]');

        form.addEventListener('submit', async e => {
            e.preventDefault();
            submit.disabled = true;
            status.className = 'form-status';

            try {
                const res = await fetch(form.action, {
                    method: 'POST',
                    body: new FormData(form),
                    headers: { Accept: 'application/json' }
                });
                if (!res.ok) throw new Error(res.statusText);
                form.reset();
                status.textContent = 'Vielen Dank! Ihre Nachricht wurde gesendet – wir melden uns so schnell wie möglich.';
                status.classList.add('success');
            } catch (err) {
                status.textContent = 'Leider ist etwas schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt an office@esc-gmbh.at.';
                status.classList.add('error');
            } finally {
                submit.disabled = false;
            }
        });
    }

    onScroll();
})();
