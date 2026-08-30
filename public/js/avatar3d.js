// 3D 人物：用胶囊体和椭球搭出来的一具立体人形，衣服是真的套在身上的几何体。
// 可以拖着转，松手会自己慢慢转回来继续转。
import { Scene3D, M4, capsule, ball, box, hex2rgb } from './gl3d.js';

export const SKINS   = ['#f2d3bc','#e5b895','#c68d63','#a06a43','#6f4a2f','#4a2f1e'];
export const HAIRCOL = ['#241c18','#4a3524','#8a6236','#c9a227','#b4453a','#7a4a8a','#2f6f8a','#d8d8dc'];

// 每一段身体的位置与粗细，按七头半的人体比例摆的（全身 1.75 米）：
// 下巴 1.52 · 肩 1.44 · 胸 1.32 · 腰 1.12 · 胯 0.90 · 膝 0.48 · 踝 0.08
function rig(g) {
  const f = g === 'f';                      // 女性剪影：肩窄、腰细、胯宽
  return { f,
    headY: 1.640, headRx: 0.100, headRy: 0.126, headRz: 0.106,
    chinY: 1.508, neckY: 1.442,
    shY: 1.425, sh: f ? 0.175 : 0.203,      // 肩高与半肩宽
    chestY: 1.315, chest: f ? 0.147 : 0.163,
    waistY: 1.120, waist: f ? 0.106 : 0.124,
    hipY: 0.960,   hip: f ? 0.140 : 0.128,
    crotchY: 0.865,
    kneeY: 0.480, ankleY: 0.085,
    legX: f ? 0.082 : 0.090,
    thigh: f ? 0.088 : 0.092, calf: f ? 0.058 : 0.062, ankle: 0.040,
    upArm: f ? 0.043 : 0.049, foreArm: f ? 0.036 : 0.041,
    elbowY: 1.135, wristY: 0.905,
    armOut: 0.055,                          // 手臂外张，别和躯干粘成一片
  };
}

// 一段「从 A 点到 B 点」的胶囊：给两个端点和两端粗细，自己算旋转
function limb(x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz) || 1e-6;
  const yaw = Math.atan2(dx, dz);
  const pitch = Math.acos(Math.max(-1, Math.min(1, dy / len)));
  return { mid: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], len,
           rot: M4.mul(M4.rotY(yaw), M4.rotX(pitch)) };
}

export class Avatar3D {
  constructor(canvas) {
    this.sc = new Scene3D(canvas);
    // 一段单位胶囊（半径 1、长 1），靠缩放变成粗细长短不同的每一段
    this.sc.upload('cap', capsule(1, 1, 1, 20, 8));
    this.sc.upload('cone', capsule(1, 0.72, 1, 20, 8));
    this.sc.upload('ball', ball(22, 14));
    this.sc.upload('box', box());
    this.spin = true;
    this._drag = null;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', e => {
      this._drag = { x: e.clientX, y: e.clientY, yaw: this.sc.yaw, pitch: this.sc.pitch };
      this.spin = false; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!this._drag) return;
      this.sc.yaw = this._drag.yaw + (e.clientX - this._drag.x) * 0.011;
      this.sc.pitch = Math.max(-0.5, Math.min(0.75, this._drag.pitch + (e.clientY - this._drag.y) * 0.006));
      this.draw();
    });
    const stop = () => { if (this._drag) { this._drag = null; setTimeout(() => { this.spin = true; }, 2200); } };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.sc.dist = Math.max(1.5, Math.min(5.5, this.sc.dist + Math.sign(e.deltaY) * 0.22));
      this.draw();
    }, { passive: false });
    this._loop = () => {
      if (this._dead) return;
      if (this.spin) { this.sc.yaw += 0.0042; this.draw(); }
      this._raf = requestAnimationFrame(this._loop);
    };
    this._raf = requestAnimationFrame(this._loop);
  }

  // 把「身上这一套」翻译成一堆带颜色的几何体
  build(look) {
    const g = look?.gender || 'x';
    const R = rig(g);
    const skin = hex2rgb(SKINS[Math.min(5, look?.skin ?? 2)]);
    const hair = hex2rgb(HAIRCOL[Math.min(7, look?.haircol ?? 0)]);
    const s = look?.slots || {};
    const P = [];
    const put = (geo, m, col, shine) => P.push({ geo, m, col, shine });

    // 一段肢体：从 (x0,y0,z0) 到 (x1,y1,z1)，半径 r，可选外套一层厚度 pad
    const seg = (a, b, r, col, shine = 0.08, geo = 'cap') => {
      const L = limb(...a, ...b);
      const m = M4.mul(M4.mul(M4.translate(...L.mid), L.rot), M4.scale(r, L.len / 2, r));
      put(geo, m, col, shine);
    };
    const orb = (x, y, z, rx, ry, rz, col, shine = 0.10) =>
      put('ball', M4.mul(M4.translate(x, y, z), M4.scale(rx, ry, rz)), col, shine);

    // ── 身上这一套 ──
    const top = s.top, bottom = s.bottom, outer = s.outer, shoes = s.shoes, acc = s.acc;
    const topC = top ? hex2rgb(top.col) : skin;
    const botC = bottom ? hex2rgb(bottom.col) : hex2rgb('#3a3f4a');
    const sleeveLong = top && ['shirt', 'knit', 'hoodie', 'gown'].includes(top.shape);
    const legsLong = !bottom || bottom.shape === 'pants' || bottom.shape === 'gown';
    const skirt = bottom && (bottom.shape === 'skirt' || bottom.shape === 'gown');

    // ── 躯干：胸 → 腰 → 胯，三段，粗细各不同才有人形 ──
    seg([0, R.shY - 0.02, 0], [0, R.waistY, 0], R.chest, top ? topC : skin, 0.07, 'cone');   // 胸腔：肩宽腰窄
    seg([0, R.hipY, 0], [0, R.crotchY - 0.01, 0], R.hip, bottom && !skirt ? botC : (top ? topC : skin), 0.07, 'cone');
    seg([0, R.hipY + 0.01, 0], [0, R.waistY + 0.02, 0], R.waist * 1.04, top ? topC : skin, 0.07);   // 腰腹
    orb(0, R.shY, 0, R.sh * 0.98, 0.062, R.chest * 0.80, top ? topC : skin, 0.07);               // 肩线
    if (R.f) orb(0, R.chestY + 0.03, R.chest * 0.62, 0.088, 0.058, 0.052, top ? topC : skin, 0.07);

    // ── 脖子与头 ──
    seg([0, R.neckY - 0.04, 0], [0, R.chinY - 0.01, -0.004], 0.048, skin, 0.06);
    orb(0, R.headY, -0.004, R.headRx, R.headRy, R.headRz, skin, 0.13);
    orb(0, R.headY - 0.055, R.headRz * 0.52, 0.052, 0.046, 0.040, skin, 0.13);          // 下颌
    orb(0, R.headY - 0.008, R.headRz * 0.86, 0.017, 0.021, 0.016, skin, 0.13);          // 鼻
    for (const sx of [-1, 1]) {
      orb(sx * 0.036, R.headY + 0.022, R.headRz * 0.80, 0.016, 0.013, 0.010, hex2rgb('#f4f2ef'), 0.45);
      orb(sx * 0.037, R.headY + 0.021, R.headRz * 0.87, 0.0075, 0.0075, 0.006, hex2rgb('#241c18'), 0.65);
      orb(sx * 0.088, R.headY - 0.005, -0.010, 0.017, 0.030, 0.020, skin, 0.10);        // 耳
    }
    put('box', M4.mul(M4.translate(0, R.headY - 0.052, R.headRz * 0.80), M4.scale(0.020, 0.004, 0.006)),
      hex2rgb('#8a5a56'), 0.2);                                                          // 嘴

    // ── 手臂：外张一点，肘部有折角 ──
    for (const sx of [-1, 1]) {
      const shX = sx * R.sh, elX = sx * (R.sh + R.armOut), wrX = sx * (R.sh + R.armOut * 1.5);
      const outC = outer ? hex2rgb(outer.col) : null;
      const upperC = outC || (top ? topC : skin);
      const lowerC = outC || (sleeveLong ? topC : skin);
      orb(shX * 0.94, R.shY - 0.016, 0, R.upArm * 1.12, R.upArm * 1.06, R.upArm * 1.10, upperC, 0.07);
      seg([shX, R.shY - 0.03, 0], [elX, R.elbowY, 0.008], R.upArm, upperC, 0.07, 'cone');
      seg([elX, R.elbowY, 0.008], [wrX, R.wristY, 0.022], R.foreArm, lowerC, 0.07, 'cone');
      orb(wrX + sx * 0.004, R.wristY - 0.055, 0.028, 0.040, 0.056, 0.026, skin, 0.10);   // 手
    }

    // ── 腿 ──
    for (const sx of [-1, 1]) {
      const lx = sx * R.legX;
      const bare = skirt || !legsLong;
      const legC = bare ? skin : botC;
      seg([lx, R.crotchY + 0.01, 0], [lx * 0.94, R.kneeY, 0.004], R.thigh, legC, 0.07, 'cone');
      orb(lx * 0.94, R.kneeY, 0.008, R.calf * 1.12, R.calf * 1.06, R.calf * 1.06, legC, 0.07);
      seg([lx * 0.94, R.kneeY - 0.01, 0.004], [lx * 0.9, R.ankleY, -0.004], R.calf, legC, 0.07, 'cone');
      // 鞋
      const shC = shoes ? hex2rgb(shoes.col) : hex2rgb('#2b2b33');
      const heel = shoes && shoes.shape === 'heel';
      if (shoes && shoes.shape === 'boot')
        seg([lx * 0.9, R.ankleY - 0.02, -0.004], [lx * 0.9, R.ankleY + 0.115, 0], R.calf * 1.10, shC, 0.24, 'cone');
      put('ball', M4.mul(M4.mul(M4.translate(lx * 0.9, (heel ? 0.052 : 0.036), 0.045), M4.rotX(-0.13)),
        M4.scale(0.052, heel ? 0.030 : 0.038, 0.115)), shC, shoes ? 0.28 : 0.12);
      if (heel) put('box', M4.mul(M4.translate(lx * 0.9, 0.026, -0.038), M4.scale(0.013, 0.026, 0.015)),
        shoes ? hex2rgb(shoes.col2) : shC, 0.3);
    }

    // ── 裙子 ──
    if (skirt) {
      const long = bottom.shape === 'gown';
      const bot = long ? 0.16 : R.crotchY - 0.13;
      const m = M4.mul(M4.translate(0, (bot + R.hipY + 0.02) / 2, 0),
        M4.mul(M4.rotZ(Math.PI), M4.scale(R.hip * 1.04, (R.hipY + 0.02 - bot) / 2, R.hip * 1.02)));
      put('cone', m, botC, 0.09);
    }

    // ── 外套 ──
    if (outer) {
      const oc = hex2rgb(outer.col), oc2 = hex2rgb(outer.col2);
      const bot = outer.shape === 'coat' ? R.crotchY - 0.16 : R.hipY - 0.03;
      seg([0, R.shY - 0.02, 0], [0, bot, 0], R.chest * 1.10, oc, 0.10, 'cone');
      const pTop = R.chestY + 0.02;
      put('box', M4.mul(M4.translate(0, (bot + pTop) / 2, R.chest * 1.055),
        M4.scale(0.013, (pTop - bot) / 2, 0.008)), oc2, 0.14);
      // 翻领：从领口斜着往下开成一个 V
      for (const sx of [-1, 1]) put('box', M4.mul(M4.mul(
        M4.translate(sx * 0.036, R.chestY + 0.062, R.chest * 1.01), M4.rotZ(sx * 0.30)),
        M4.scale(0.020, 0.058, 0.008)), oc2, 0.12);
      orb(0, R.neckY - 0.045, R.chest * 0.55, 0.088, 0.040, 0.048, oc2, 0.12);
    }

    // ── 头发 ──
    const hs = look?.hair ?? 0;
    if (hs !== 7) {
      // 贴着颅骨的一层，稍稍往后压，把额头留出来
      const puff = hs === 4 ? 1.30 : hs === 6 ? 1.02 : 1.075;
      put('ball', M4.mul(M4.translate(0, R.headY + 0.030, -0.008),
        M4.scale(R.headRx * puff, R.headRy * (hs === 4 ? 1.12 : 0.92), R.headRz * puff)), hair, 0.15);
      if (hs !== 6) put('ball', M4.mul(M4.translate(0, R.headY + 0.062, R.headRz * 0.42),
        M4.scale(R.headRx * 0.86, 0.030, R.headRz * 0.62)), hair, 0.15);   // 刘海
      if (hs === 2 || hs === 5)                        // 长发 / 中分：披到肩上
        put('ball', M4.mul(M4.translate(0, R.headY - 0.105, -0.052),
          M4.scale(R.headRx * 0.98, 0.105, R.headRz * 0.66)), hair, 0.13);
      if (hs === 3)                                    // 马尾
        orb(0, R.headY - 0.035, -R.headRz * 1.55, 0.046, 0.088, 0.058, hair, 0.13);
      if (hs === 0 || hs === 1)                        // 短发/寸头：鬓角
        for (const sx of [-1, 1]) orb(sx * R.headRx * 0.95, R.headY - 0.020, -0.020, 0.020, 0.045, 0.045, hair, 0.13);
    }

    // ── 配饰 ──
    if (acc) {
      const ac = hex2rgb(acc.col), ac2 = hex2rgb(acc.col2);
      switch (acc.shape) {
        case 'cap':
          orb(0, R.headY + 0.062, -0.008, R.headRx * 1.13, 0.058, R.headRz * 1.11, ac, 0.14);
          put('box', M4.mul(M4.mul(M4.translate(0, R.headY + 0.040, R.headRz * 1.22), M4.rotX(-0.13)),
            M4.scale(0.078, 0.008, 0.068)), ac2, 0.14); break;
        case 'glass':
          for (const sx of [-1, 1]) put('box', M4.mul(M4.translate(sx * 0.037, R.headY + 0.022, R.headRz * 0.86),
            M4.scale(0.029, 0.019, 0.007)), ac, 0.55);
          put('box', M4.mul(M4.translate(0, R.headY + 0.022, R.headRz * 0.86), M4.scale(0.011, 0.004, 0.005)), ac2, 0.4); break;
        case 'scarf':
          seg([0, R.neckY - 0.06, 0], [0, R.chinY - 0.03, 0], 0.072, ac, 0.10);
          seg([0.028, R.chestY - 0.09, 0.095], [0.018, R.neckY - 0.04, 0.055], 0.026, ac2, 0.10); break;
        case 'tie':
          put('box', M4.mul(M4.translate(0, R.chestY - 0.030, R.chest * 1.10), M4.scale(0.020, 0.100, 0.010)), ac, 0.18);
          put('box', M4.mul(M4.translate(0, R.neckY - 0.058, R.chest * 1.06), M4.scale(0.024, 0.024, 0.013)), ac2, 0.18); break;
        case 'belt':
          seg([0, R.waistY + 0.02, 0], [0, R.waistY + 0.05, 0], R.waist * 1.08, ac, 0.26);
          put('box', M4.mul(M4.translate(0, R.waistY + 0.035, R.waist * 1.04), M4.scale(0.023, 0.018, 0.009)), ac2, 0.5); break;
        case 'bag':
          put('box', M4.mul(M4.translate(0.255, R.waistY - 0.05, 0.02), M4.scale(0.072, 0.082, 0.032)), ac, 0.18);
          seg([0.225, R.waistY + 0.03, 0.02], [R.sh * 0.85, R.shY - 0.01, 0.02], 0.010, ac2, 0.14); break;
        case 'chain':
          seg([0, R.chestY - 0.02, R.chest * 0.84], [0, R.neckY - 0.05, R.chest * 0.50], 0.012, ac, 0.75); break;
        case 'glove':
          for (const sx of [-1, 1]) orb(sx * (R.sh + R.armOut * 1.5), R.wristY - 0.055, 0.028,
            0.044, 0.060, 0.030, ac, 0.16); break;
        case 'stick':
          seg([0.30, 0.02, 0.06], [0.30, 0.92, 0.06], 0.012, ac, 0.20);
          orb(0.30, 0.955, 0.06, 0.023, 0.023, 0.023, ac2, 0.3); break;
      }
    }

    // 站着的地面
    put('ball', M4.mul(M4.translate(0, 0.004, 0), M4.scale(0.46, 0.006, 0.46)), hex2rgb('#12141c'), 0.0);
    this.sc.setParts(P);
    this.draw();
  }
  draw() { try { this.sc.draw(); } catch {} }
  dispose() { this._dead = true; cancelAnimationFrame(this._raf); this.sc.dispose(); }
}
