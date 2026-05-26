(() => {
    /* =========================================================
        CONFIG
        ---------------------------------------------------------
        - Put PNGs next to this file:
          off.png (OFF), on.png (ON)
    ========================================================== */
    const IMG_OFF = "img/on.png";
    const IMG_ON = "img/off.png"; 

    const DEBUG_ALIGN = false;

    const OFF_EXTRA_SCALE = 1.00;
    const OFF_OFFSET_X = 0;
    const OFF_OFFSET_Y = 0;

    const ON_EXTRA_SCALE = 1.00;
    const ON_OFFSET_X = 0;
    const ON_OFFSET_Y = 0;

    // Animation speeds
    const SKY_EASE = 0.060;
    const LAMP_EASE = 0.090;

    // Physics feel
    const GRAVITY = 0.75;
    const DRAG = 0.992;
    const ITER = 12;
    const SEGMENTS = 20;

    /* =========================================================
        CANVAS (with DPR)
    ========================================================== */
    const canvas = document.getElementById("c");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;

    /* =========================================================
        RESPONSIVE SIZES
    ========================================================== */
    const BASE = {
        BULB_BOX: 190,
        BASE_SCALE: 0.92,
        ROPE_LEN: 170,
        HANDLE_R: 6,
        TOGGLE_THRESHOLD: 14,

        PANEL_W: 360,
        PANEL_H: 280,
        PANEL_R: 28,

        BLOOM_R: 220,
        BEAM_R0: 26,
        BEAM_N: 16,

        HINT_FONT: 13
    };

    let uiScale = 1;
    let BULB_BOX = BASE.BULB_BOX;
    let BASE_SCALE = BASE.BASE_SCALE;
    let ROPE_LEN = BASE.ROPE_LEN;
    let HANDLE_R = BASE.HANDLE_R;
    let TOGGLE_THRESHOLD = BASE.TOGGLE_THRESHOLD;

    let PANEL_W = BASE.PANEL_W;
    let PANEL_H = BASE.PANEL_H;
    let PANEL_R = BASE.PANEL_R;

    let BLOOM_R = BASE.BLOOM_R;
    let BEAM_R0 = BASE.BEAM_R0;
    let BEAM_N = BASE.BEAM_N;

    let HINT_FONT = BASE.HINT_FONT;

    /* =========================================================
        STATE
    ========================================================== */
    let targetOn = false;
    let skyT = 0; // 0=day, 1=night
    let lampT = 0; // 0=off, 1=on

    /* =========================================================
        LAYOUT
    ========================================================== */
    const bulb = {
        x: () => W * 0.5,
        y: () => H * (W < 520 ? 0.24 : 0.26)
    };

    function anchorPoint() {
        return { x: bulb.x(), y: bulb.y() + BULB_BOX * 0.47 };
    }

    /* =========================================================
        HELPERS
    ========================================================== */
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function roundRect(x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    function distToSegment(px, py, ax, ay, bx, by) {
        const vx = bx - ax, vy = by - ay;
        const wx = px - ax, wy = py - ay;
        const c1 = vx * wx + vy * wy;
        if (c1 <= 0) return Math.hypot(px - ax, py - ay);
        const c2 = vx * vx + vy * vy;
        if (c2 <= c1) return Math.hypot(px - bx, py - by);
        const t = c1 / c2;
        const projx = ax + t * vx;
        const projy = ay + t * vy;
        return Math.hypot(px - projx, py - projy);
    }

    /* =========================================================
        RESPONSIVE (derived from uiScale)
    ========================================================== */
    function recomputeResponsive() {
        uiScale = clamp(Math.min(W / 900, H / 700), 0.70, 1.15);

        BULB_BOX = Math.round(BASE.BULB_BOX * uiScale);
        BASE_SCALE = BASE.BASE_SCALE;

        ROPE_LEN = Math.round(BASE.ROPE_LEN * uiScale);
        HANDLE_R = Math.round(clamp(BASE.HANDLE_R * uiScale, 4, 12));
        TOGGLE_THRESHOLD = Math.round(BASE.TOGGLE_THRESHOLD * uiScale);

        PANEL_W = Math.round(clamp(BASE.PANEL_W * uiScale, 260, 430));
        PANEL_H = Math.round(clamp(BASE.PANEL_H * uiScale, 220, 360));
        PANEL_R = Math.round(clamp(BASE.PANEL_R * uiScale, 18, 34));

        BLOOM_R = Math.round(clamp(BASE.BLOOM_R * uiScale, 150, 260));
        BEAM_R0 = Math.round(clamp(BASE.BEAM_R0 * uiScale, 18, 34));
        BEAM_N = Math.round(clamp(BASE.BEAM_N, 12, 18));

        HINT_FONT = Math.round(clamp(BASE.HINT_FONT * uiScale, 11, 14));
    }

    /* =========================================================
        SKY OBJECTS
    ========================================================== */
    let stars = [];
    let clouds = [];

    function regenStars() {
        const density = (W < 520 ? 0.70 : 1.0);
        const count = Math.floor(((W * H) / 26000) * density);
        stars = Array.from({ length: count }, () => ({
            x: Math.random() * W,
            y: Math.random() * H * 0.62,
            r: Math.random() * 1.2 + 0.35,
            p: Math.random() * Math.PI * 2,
            s: 0.010 + Math.random() * 0.018
        }));
    }

    function regenClouds() {
        const count = Math.max(3, Math.floor(W / 260));
        clouds = Array.from({ length: count }, () => ({
            x: Math.random() * W,
            y: H * (0.10 + Math.random() * 0.22),
            sc: (0.85 + Math.random() * 0.9) * (W < 520 ? 0.85 : 1.0),
            vx: (0.12 + Math.random() * 0.25) * (W < 520 ? 0.85 : 1.0),
            wob: Math.random() * Math.PI * 2
        }));
    }

    function updateClouds() {
        for (const c of clouds) {
            c.x += c.vx;
            c.wob += 0.004;
            if (c.x > W + 260) c.x = -320;
        }
    }

    /* =========================================================
        SUBTLE NOISE (glass feel)
    ========================================================== */
    let noisePattern = null;
    function buildNoise() {
        const n = document.createElement("canvas");
        n.width = 96; n.height = 96;
        const nc = n.getContext("2d");
        const img = nc.createImageData(n.width, n.height);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = (Math.random() * 255) | 0;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
            img.data[i + 3] = (Math.random() * 18) | 0;
        }
        nc.putImageData(img, 0, 0);
        noisePattern = ctx.createPattern(n, "repeat");
    }

    /* =========================================================
        IMAGES + auto normalization
    ========================================================== */
    const imgOff = new Image();
    const imgOn = new Image();
    imgOff.src = IMG_OFF;
    imgOn.src = IMG_ON;

    const imgMeta = {
        off: { k: 1.0, trim: null },
        on: { k: 1.0, trim: null }
    };

    function computeTrimBox(img) {
        return null;
    }

    function updateNormalization() {
        imgMeta.off.k = 1.0;
        imgMeta.on.k = 1.0;
    }

    imgOff.onload = () => { updateNormalization(); };
    imgOn.onload = () => { updateNormalization(); };

    /* =========================================================
        LIGHT BEAMS (360-degree)
    ========================================================== */
    let beams = [];
    function genBeams() {
        const n = BEAM_N;
        beams = Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2;
            const upFactor = 0.35 + 0.65 * ((Math.sin(a) + 1) / 2);

            return {
                a: a + (Math.random() * 0.14 - 0.07),
                w: 0.10 + Math.random() * 0.10,
                l: (140 + Math.random() * 220) * uiScale,
                ph: Math.random() * Math.PI * 2,
                sp: 0.010 + Math.random() * 0.012,
                k: upFactor
            };
        });
    }

    /* =========================================================
        ROPE PHYSICS (Verlet)
    ========================================================== */
    const rope = [];
    let segLen = 1;

    function resetRope() {
        segLen = ROPE_LEN / (SEGMENTS - 1);
        rope.length = 0;
        const a = anchorPoint();
        for (let i = 0; i < SEGMENTS; i++) {
            const y = a.y + i * segLen;
            rope.push({ x: a.x, y, px: a.x, py: y });
        }
    }

    function handlePoint() { return rope[rope.length - 1]; }

    function ropeStep() {
        const a = anchorPoint();

        rope[0].x = a.x; rope[0].y = a.y;
        rope[0].px = a.x; rope[0].py = a.y;

        for (let i = 1; i < rope.length; i++) {
            const p = rope[i];
            const vx = (p.x - p.px) * DRAG;
            const vy = (p.y - p.py) * DRAG;
            p.px = p.x; p.py = p.y;
            p.x += vx;
            p.y += vy + GRAVITY;
        }

        if (dragging) {
            const h = handlePoint();
            h.x = targetX;
            h.y = targetY;
        }

        for (let k = 0; k < ITER; k++) {
            rope[0].x = a.x; rope[0].y = a.y;
            if (dragging) {
                const h = handlePoint();
                h.x = targetX; h.y = targetY;
            }
            for (let i = 0; i < rope.length - 1; i++) {
                const p1 = rope[i], p2 = rope[i + 1];
                let dx = p2.x - p1.x;
                let dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy) || 0.0001;
                const diff = (dist - segLen) / dist;

                const p1Pinned = (i === 0);
                const p2Pinned = (dragging && i + 1 === rope.length - 1);

                if (p1Pinned && p2Pinned) continue;
                if (p1Pinned) {
                    p2.x -= dx * diff;
                    p2.y -= dy * diff;
                } else if (p2Pinned) {
                    p1.x += dx * diff;
                    p1.y += dy * diff;
                } else {
                    p1.x += dx * diff * 0.5; p1.y += dy * diff * 0.5;
                    p2.x -= dx * diff * 0.5; p2.y -= dy * diff * 0.5;
                }
            }
        }
    }

    /* =========================================================
        HIT TESTS (knob + rope)
    ========================================================== */
    function hitHandle(x, y) {
        const h = handlePoint();
        return Math.hypot(x - h.x, y - h.y) <= (HANDLE_R + 16);
    }

    function hitRope(x, y) {
        const hitRadius = (2.4 * uiScale) + 10;
        for (let i = 0; i < rope.length - 1; i++) {
            const a = rope[i], b = rope[i + 1];
            if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= hitRadius) return true;
        }
        return false;
    }

    function updateCursor(e) {
        if (e.pointerType !== "mouse") return;
        const x = e.clientX, y = e.clientY;
        const over = hitHandle(x, y) || hitRope(x, y);
        canvas.style.cursor = dragging ? "grabbing" : (over ? "grab" : "default");
    }

    canvas.addEventListener("pointerleave", () => {
        canvas.style.cursor = "default";
    });

    /* =========================================================
        POINTER (single knob)
    ========================================================== */
    let dragging = false, activeId = null;
    let startX = 0, startY = 0, movedEnough = false;
    let targetX = 0, targetY = 0;

    canvas.addEventListener("pointerdown", (e) => {
        updateCursor(e);

        const x = e.clientX, y = e.clientY;
        if (!hitHandle(x, y)) return;

        initAudio();
        ac.resume?.();

        canvas.setPointerCapture(e.pointerId);
        activeId = e.pointerId;
        dragging = true;

        startX = x; startY = y; movedEnough = false;
        targetX = x; targetY = y;

        const h = handlePoint();
        h.x = x; h.y = y; h.px = x; h.py = y;

        sfxGrab();
        updateCursor(e);
    });

    canvas.addEventListener("pointermove", (e) => {
        updateCursor(e);

        if (!dragging || e.pointerId !== activeId) return;
        const x = e.clientX, y = e.clientY;

        const dist = Math.hypot(x - startX, y - startY);
        if (!movedEnough && dist > TOGGLE_THRESHOLD) movedEnough = true;

        targetX = x; targetY = y;
        sfxPull(clamp(dist / 140, 0, 1));
    });

    canvas.addEventListener("pointerup", (e) => {
        if (e.pointerId !== activeId) { updateCursor(e); return; }
        dragging = false; activeId = null;

        if (movedEnough) {
            targetOn = !targetOn;
            sfxToggle(targetOn);
        }
        updateCursor(e);
    });

    /* =========================================================
        AUDIO (synthetic SFX + subtle hum)
    ========================================================== */
    let ac = null, master = null, humOsc = null, humGain = null;
    let lastPullSfx = 0;

    function initAudio() {
        if (ac) return;
        ac = new (window.AudioContext || window.webkitAudioContext)();

        master = ac.createGain();
        master.gain.value = 0.9;

        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -24;
        comp.knee.value = 30;
        comp.ratio.value = 12;
        comp.attack.value = 0.003;
        comp.release.value = 0.15;

        master.connect(comp);
        comp.connect(ac.destination);

        humOsc = ac.createOscillator();
        humGain = ac.createGain();
        humOsc.type = "sine";
        humOsc.frequency.value = 92;
        humGain.gain.value = 0.0001;
        humOsc.connect(humGain).connect(master);
        humOsc.start();
    }

    function beep({ freq = 400, dur = 0.06, gain = 0.08, type = "sine", slideTo = null }) {
        if (!ac) return;
        const t0 = ac.currentTime;

        const o = ac.createOscillator();
        const g = ac.createGain();

        o.type = type;
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);

        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        o.connect(g).connect(master);
        o.start(t0);
        o.stop(t0 + dur);
    }

    function sfxGrab() {
        beep({ freq: 520, dur: 0.05, gain: 0.06, type: "triangle", slideTo: 430 });
    }

    function sfxToggle(isOn) {
        beep({ freq: 220, dur: 0.035, gain: 0.06, type: "square", slideTo: 180 });
        if (isOn) beep({ freq: 660, dur: 0.09, gain: 0.07, type: "sine", slideTo: 880 });
        else beep({ freq: 420, dur: 0.08, gain: 0.06, type: "sine", slideTo: 300 });
    }

    function sfxPull(v) {
        if (!ac) return;
        const now = performance.now();
        if (now - lastPullSfx < 90) return;
        lastPullSfx = now;

        const f = 180 + clamp(v, 0, 1) * 140;
        beep({ freq: f, dur: 0.02, gain: 0.025, type: "triangle", slideTo: f * 0.92 });
    }

    /* =========================================================
        DRAW: BACKGROUND (day/night blend)
    ========================================================== */
    function drawDay(alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;

        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#16485f");
        g.addColorStop(1, "#060c12");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        const sx = W * 0.16, sy = H * 0.16;
        const rg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 120);
        rg.addColorStop(0, "rgba(255,217,90,0.28)");
        rg.addColorStop(1, "rgba(255,217,90,0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(sx, sy, 120, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "rgba(255,217,90,0.98)";
        ctx.beginPath(); ctx.arc(sx, sy, 22, 0, Math.PI * 2); ctx.fill();

        updateClouds();
        for (const c of clouds) drawCloud(c, alpha);

        ctx.restore();
    }

    function drawNight(alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;

        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, "#02070c");
        g.addColorStop(1, "#060c12");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "#fff";
        for (const s of stars) {
            s.p += s.s;
            const tw = 0.35 + (Math.sin(s.p) * 0.35 + 0.35);
            ctx.globalAlpha = alpha * tw;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = alpha;

        const mx = W * 0.16, my = H * 0.16;
        const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
        mg.addColorStop(0, "rgba(255,255,255,0.14)");
        mg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(mx, my, 120, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI * 2); ctx.fill();

        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath(); ctx.arc(mx + 12, my - 6, 30, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";

        ctx.restore();
    }

    function drawNoise(alpha) {
        if (!noisePattern || alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = noisePattern;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    function drawCloud(c, parentAlpha) {
        const x = c.x, y = c.y + Math.sin(c.wob) * 2.2;
        const s = c.sc;

        ctx.save();
        ctx.globalAlpha = parentAlpha * 0.30;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(x + 70 * s, y + 34 * s, 78 * s, 14 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const gx = x + 65 * s, gy = y;
        const grad = ctx.createRadialGradient(gx, gy, 12 * s, gx, gy, 120 * s);
        grad.addColorStop(0, "rgba(255,255,255,0.92)");
        grad.addColorStop(1, "rgba(230,245,255,0.78)");
        ctx.fillStyle = grad;
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.6;

        ctx.beginPath();
        ctx.ellipse(x + 18 * s, y + 12 * s, 34 * s, 20 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 52 * s, y - 6 * s, 40 * s, 24 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 92 * s, y + 0 * s, 50 * s, 28 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 126 * s, y + 12 * s, 38 * s, 22 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 78 * s, y + 18 * s, 70 * s, 30 * s, 0, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    /* =========================================================
        DRAW: GLASS PANEL
    ========================================================== */
    function drawGlassPanel() {
        const cx = bulb.x(), cy = bulb.y();

        const w = PANEL_W;
        const h = PANEL_H;
        const x = cx - w / 2;
        const y = cy - h / 2 + 18 * uiScale;

        ctx.save();

        ctx.shadowColor = "rgba(0,0,0,0.35)";
        ctx.shadowBlur = 26 * uiScale;
        ctx.shadowOffsetY = 12 * uiScale;

        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, "rgba(255,255,255,0.10)");
        g.addColorStop(1, "rgba(255,255,255,0.05)");
        ctx.fillStyle = g;

        roundRect(x, y, w, h, PANEL_R);
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;

        ctx.strokeStyle = "rgba(255,255,255,0.20)";
        ctx.lineWidth = 1.5;
        roundRect(x, y, w, h, PANEL_R);
        ctx.stroke();

        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 2.2 * uiScale;
        ctx.beginPath();
        ctx.moveTo(x + 46 * uiScale, y + 48 * uiScale);
        ctx.quadraticCurveTo(x + w * 0.55, y + 18 * uiScale, x + w - 52 * uiScale, y + 76 * uiScale);
        ctx.stroke();

        ctx.restore();
    }

    /* =========================================================
        DRAW: BLOOM + BEAMS + BULB
    ========================================================== */
    function drawBloom() {
        if (lampT <= 0.001) return;
        const cx = bulb.x(), cy = bulb.y();

        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.85 * lampT;

        const rg = ctx.createRadialGradient(cx, cy, 8, cx, cy, BLOOM_R);
        rg.addColorStop(0, "rgba(255,217,90,0.22)");
        rg.addColorStop(0.35, "rgba(255,217,90,0.10)");
        rg.addColorStop(1, "rgba(255,217,90,0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(cx, cy, BLOOM_R, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }

    function drawBeams() {
        if (lampT <= 0.01) return;

        const cx = bulb.x();
        const cy = bulb.y();

        ctx.save();
        ctx.globalCompositeOperation = "screen";

        for (const b of beams) {
            b.ph += b.sp;
            const shimmer = 0.70 + Math.sin(b.ph) * 0.22;

            const ang = b.a;
            const len = b.l;
            const spr = b.w;

            const r0 = BEAM_R0;

            const x1 = cx + Math.cos(ang - spr) * r0;
            const y1 = cy + Math.sin(ang - spr) * r0;
            const x2 = cx + Math.cos(ang + spr) * r0;
            const y2 = cy + Math.sin(ang + spr) * r0;

            const x3 = cx + Math.cos(ang) * (r0 + len);
            const y3 = cy + Math.sin(ang) * (r0 + len);

            const strength = lampT * b.k;
            ctx.globalAlpha = 0.55 * strength * shimmer;

            const grad = ctx.createLinearGradient(cx, cy, x3, y3);
            grad.addColorStop(0, `rgba(255,217,90,0.22)`);
            grad.addColorStop(0.25, `rgba(255,217,90,0.10)`);
            grad.addColorStop(1, "rgba(255,217,90,0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    function drawBulb() {
        const cx = bulb.x(), cy = bulb.y();
        const box = BULB_BOX;

        drawBloom();
        drawBeams();

        drawBulbImage(imgOff, imgMeta.off, cx, cy, box, BASE_SCALE, (1 - lampT),
            OFF_EXTRA_SCALE, OFF_OFFSET_X, OFF_OFFSET_Y);

        drawBulbImage(imgOn, imgMeta.on, cx, cy, box, BASE_SCALE, (lampT),
            ON_EXTRA_SCALE, ON_OFFSET_X, ON_OFFSET_Y);

        if (DEBUG_ALIGN) {
            ctx.save();
            ctx.strokeStyle = "rgba(0,255,255,0.7)";
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - box / 2, cy - box / 2, box, box);
            ctx.restore();
        }
    }

    function drawBulbImage(img, meta, cx, cy, box, baseScale, alpha, extraScale, ox, oy) {
        if (alpha <= 0.0005) return;
        if (img.naturalWidth <= 0) return;

        const iw = img.naturalWidth, ih = img.naturalHeight;
        const fit = Math.min(box / iw, box / ih);

        const kAuto = (meta && meta.k) ? meta.k : 1.0;
        const s = fit * baseScale * kAuto * extraScale;

        const dw = iw * s, dh = ih * s;
        const dx = cx - dw / 2 + ox;
        const dy = cy - dh / 2 + oy;

        ctx.save();
        ctx.globalAlpha = alpha;

        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = 10 * uiScale;
        ctx.shadowOffsetY = 4 * uiScale;

        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.restore();
    }

    /* =========================================================
        DRAW: ROPE + SINGLE KNOB
    ========================================================== */
    function drawRopeSmooth() {
        ctx.save();
        ctx.strokeStyle = "rgba(235,248,255,0.92)";
        ctx.lineWidth = 2.4 * uiScale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(rope[0].x, rope[0].y);
        for (let i = 1; i < rope.length - 1; i++) {
            const p = rope[i];
            const n = rope[i + 1];
            const mx = (p.x + n.x) / 2;
            const my = (p.y + n.y) / 2;
            ctx.quadraticCurveTo(p.x, p.y, mx, my);
        }
        const last = rope[rope.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
        ctx.restore();
    }

    function drawSingleKnob() {
        const h = handlePoint();
        const cx = h.x, cy = h.y;

        ctx.save();
        ctx.globalAlpha = 0.30;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.ellipse(cx, cy + HANDLE_R * 1.8, HANDLE_R * 1.8, HANDLE_R * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.fillStyle = "rgba(250,252,255,0.98)";
        ctx.strokeStyle = "rgba(140,165,175,0.85)";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(cx, cy, HANDLE_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const hiR = Math.max(1, HANDLE_R * 0.28);
        const hiOx = HANDLE_R * 0.28;
        const hiOy = HANDLE_R * 0.28;

        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(cx - hiOx, cy - hiOy, hiR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /* =========================================================
        DRAW: HINT
    ========================================================== */
    function drawHint() {
        const text = "Pull the cord, then release to toggle.";
        ctx.save();
        ctx.font = `${HINT_FONT}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
        const padX = 12 * uiScale;
        const tw = ctx.measureText(text).width;

        const x = 16 * uiScale;
        const y = H - 18 * uiScale;

        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.2;
        roundRect(x, y - 20 * uiScale, tw + padX * 2, 26 * uiScale, 13 * uiScale);
        ctx.fill();
        ctx.stroke();

        ctx.globalAlpha = 0.65;
        ctx.fillStyle = "rgba(255,255,255,0.80)";
        ctx.fillText(text, x + padX, y - 2 * uiScale);
        ctx.restore();
    }

    /* =========================================================
        TRANSITIONS + HUM
    ========================================================== */
    function tickTransitions() {
        const goal = targetOn ? 1 : 0;
        skyT += (goal - skyT) * SKY_EASE;
        lampT += (goal - lampT) * LAMP_EASE;
        skyT = clamp(skyT, 0, 1);
        lampT = clamp(lampT, 0, 1);

        if (humGain) {
            const g = 0.001 + lampT * 0.015;
            humGain.gain.setTargetAtTime(g, ac.currentTime, 0.08);
        }
    }

    /* =========================================================
        RESIZE (RESPONSIVE ENTRY)
    ========================================================== */
    function resize() {
        dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        W = window.innerWidth;
        H = window.innerHeight;

        canvas.width = Math.floor(W * dpr);
        canvas.height = Math.floor(H * dpr);
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        recomputeResponsive();
        regenStars();
        regenClouds();
        genBeams();
        resetRope();
    }
    window.addEventListener("resize", resize);

    /* =========================================================
        LOOP
    ========================================================== */
    function draw() {
        tickTransitions();
        ropeStep();

        ctx.clearRect(0, 0, W, H);

        drawDay(1 - skyT);
        drawNight(skyT);
        drawNoise(0.08);

        drawGlassPanel();
        
        drawRopeSmooth();
        drawSingleKnob();
        
        drawBulb();
        
        drawHint();

        requestAnimationFrame(draw);
    }

    /* =========================================================
        INIT
    ========================================================== */
    buildNoise();
    resize();
    draw();

})();

```
