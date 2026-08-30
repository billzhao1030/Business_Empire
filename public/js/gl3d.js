// 一个够用就好的 WebGL 渲染器：矩阵、着色器、几何体、光照。
// 没有 three.js，没有任何外部依赖——整个游戏一个第三方包都不装，这里也不破例。

// ── 4×4 矩阵 ────────────────────────────────────────────────
export const M4 = {
  id: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      let v = 0;
      for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = v;
    }
    return o;
  },
  translate(x, y, z) { const m = M4.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z) { const m = M4.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); const m = M4.id(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); const m = M4.id(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a); const m = M4.id(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
    return m;
  },
  lookAt(eye, at, up) {
    const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -dot(x,eye), -dot(y,eye), -dot(z,eye), 1]);
  },
  // 法线矩阵：模型矩阵的逆转置（这里只有平移/旋转/缩放，取左上 3×3 的逆转置即可）
  normalFrom(m) {
    const a = [m[0],m[1],m[2], m[4],m[5],m[6], m[8],m[9],m[10]];
    const det = a[0]*(a[4]*a[8]-a[5]*a[7]) - a[1]*(a[3]*a[8]-a[5]*a[6]) + a[2]*(a[3]*a[7]-a[4]*a[6]);
    if (!det) return new Float32Array([1,0,0, 0,1,0, 0,0,1]);
    const d = 1 / det;
    return new Float32Array([
      (a[4]*a[8]-a[5]*a[7])*d, (a[2]*a[7]-a[1]*a[8])*d, (a[1]*a[5]-a[2]*a[4])*d,
      (a[5]*a[6]-a[3]*a[8])*d, (a[0]*a[8]-a[2]*a[6])*d, (a[2]*a[3]-a[0]*a[5])*d,
      (a[3]*a[7]-a[4]*a[6])*d, (a[1]*a[6]-a[0]*a[7])*d, (a[0]*a[4]-a[1]*a[3])*d,
    ]);
  },
};
const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };

// ── 几何体：都是三角形列表，带法线 ──────────────────────────
// 两端半径可以不同的胶囊体——人身上几乎每一段（手臂、腿、躯干）都是这个形状
export function capsule(r0, r1, h, seg = 20, rings = 10) {
  const pos = [], nrm = [], idx = [];
  const push = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nrm.push(nx, ny, nz); };
  const rows = [];
  // 下半球
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, a = (t - 1) * Math.PI / 2;
    rows.push({ y: -h / 2 + Math.sin(a) * r0, r: Math.cos(a) * r0, ny: Math.sin(a), nr: Math.cos(a) });
  }
  // 侧壁：半径从 r0 渐变到 r1
  const slope = (r1 - r0) / h;
  const sn = 1 / Math.hypot(1, slope);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    rows.push({ y: -h / 2 + t * h, r: r0 + (r1 - r0) * t, ny: -slope * sn, nr: sn });
  }
  // 上半球
  for (let i = 0; i <= rings; i++) {
    const t = i / rings, a = t * Math.PI / 2;
    rows.push({ y: h / 2 + Math.sin(a) * r1, r: Math.cos(a) * r1, ny: Math.sin(a), nr: Math.cos(a) });
  }
  for (const row of rows) for (let s = 0; s <= seg; s++) {
    const a = s / seg * Math.PI * 2, c = Math.cos(a), si = Math.sin(a);
    push(c * row.r, row.y, si * row.r, c * row.nr, row.ny, si * row.nr);
  }
  const w = seg + 1;
  for (let i = 0; i < rows.length - 1; i++) for (let s = 0; s < seg; s++) {
    const a = i * w + s, b = a + w;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}
// 椭球：头、手、脚、包
export function ball(seg = 22, rings = 16) {
  const pos = [], nrm = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const p = i / rings * Math.PI, y = Math.cos(p), r = Math.sin(p);
    for (let s = 0; s <= seg; s++) {
      const a = s / seg * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, y, z); nrm.push(x, y, z);
    }
  }
  const w = seg + 1;
  for (let i = 0; i < rings; i++) for (let s = 0; s < seg; s++) {
    const a = i * w + s, b = a + w;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}
// 盒子：地板、包、帽檐这类方的东西
export function box() {
  const f = [
    [[-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],[0,0,1]],
    [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
    [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1],[0,1,0]],
    [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]],
    [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],
    [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]],
  ];
  const pos = [], nrm = [], idx = [];
  f.forEach((face, i) => {
    const n = face[4];
    for (let k = 0; k < 4; k++) { pos.push(...face[k]); nrm.push(...n); }
    const b = i * 4;
    idx.push(b, b+1, b+2, b, b+2, b+3);
  });
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
}

// ── 渲染器 ──────────────────────────────────────────────────
const VS = `
attribute vec3 aPos; attribute vec3 aNrm;
uniform mat4 uProj, uView, uModel; uniform mat3 uNrm;
varying vec3 vN, vP;
void main(){ vec4 wp = uModel * vec4(aPos,1.0); vP = wp.xyz; vN = normalize(uNrm * aNrm);
  gl_Position = uProj * uView * wp; }`;
const FS = `
precision mediump float;
uniform vec3 uCol, uEye; uniform float uShine;
varying vec3 vN, vP;
void main(){
  vec3 N = normalize(vN);
  vec3 L = normalize(vec3(0.45, 0.85, 0.75));      // 主光：右上前方
  vec3 F = normalize(vec3(-0.6, 0.15, -0.5));      // 补光：左后，把轮廓提出来
  vec3 V = normalize(uEye - vP);
  float d = max(dot(N, L), 0.0);
  float f = max(dot(N, F), 0.0) * 0.28;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6) * 0.30;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 26.0) * uShine;
  vec3 c = uCol * (0.34 + 0.72 * d + f) + vec3(1.0) * spec + vec3(0.55,0.63,0.85) * rim;
  gl_FragColor = vec4(c, 1.0);
}`;

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export class Scene3D {
  constructor(canvas) {
    const opts = { antialias: true, alpha: true, preserveDrawingBuffer: false };
    this.gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!this.gl) throw new Error('no webgl');
    const gl = this.gl;
    this.canvas = canvas;
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    this.prog = p;
    gl.useProgram(p);
    this.loc = {
      pos: gl.getAttribLocation(p, 'aPos'), nrm: gl.getAttribLocation(p, 'aNrm'),
      proj: gl.getUniformLocation(p, 'uProj'), view: gl.getUniformLocation(p, 'uView'),
      model: gl.getUniformLocation(p, 'uModel'), nmat: gl.getUniformLocation(p, 'uNrm'),
      col: gl.getUniformLocation(p, 'uCol'), eye: gl.getUniformLocation(p, 'uEye'),
      shine: gl.getUniformLocation(p, 'uShine'),
    };
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    this.geo = new Map();
    this.parts = [];
    this.yaw = 0.38; this.pitch = 0.02; this.dist = 2.45; this.target = 0.92;
  }
  upload(name, g) {
    const gl = this.gl;
    const b = { pos: gl.createBuffer(), nrm: gl.createBuffer(), idx: gl.createBuffer(), n: g.idx.length };
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nrm); gl.bufferData(gl.ARRAY_BUFFER, g.nrm, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    this.geo.set(name, b);
    return b;
  }
  setParts(parts) { this.parts = parts; }
  resize() {
    const c = this.canvas, dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
    if (c.width !== (w * dpr | 0) || c.height !== (h * dpr | 0)) { c.width = w * dpr | 0; c.height = h * dpr | 0; }
    this.gl.viewport(0, 0, c.width, c.height);
    return w / h;
  }
  draw() {
    const gl = this.gl, L = this.loc;
    const aspect = this.resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const eye = [Math.sin(this.yaw) * cp * this.dist, this.target + sp * this.dist, Math.cos(this.yaw) * cp * this.dist];
    gl.uniformMatrix4fv(L.proj, false, M4.perspective(0.72, aspect, 0.1, 60));
    gl.uniformMatrix4fv(L.view, false, M4.lookAt(eye, [0, this.target, 0], [0, 1, 0]));
    gl.uniform3fv(L.eye, new Float32Array(eye));
    for (const part of this.parts) {
      const b = this.geo.get(part.geo);
      if (!b) continue;
      gl.uniformMatrix4fv(L.model, false, part.m);
      gl.uniformMatrix3fv(L.nmat, false, M4.normalFrom(part.m));
      gl.uniform3fv(L.col, part.col);
      gl.uniform1f(L.shine, part.shine ?? 0.10);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(L.pos); gl.vertexAttribPointer(L.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.nrm); gl.enableVertexAttribArray(L.nrm); gl.vertexAttribPointer(L.nrm, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
      gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_SHORT, 0);
    }
  }
  dispose() {
    const gl = this.gl;
    for (const b of this.geo.values()) { gl.deleteBuffer(b.pos); gl.deleteBuffer(b.nrm); gl.deleteBuffer(b.idx); }
    this.geo.clear();
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
export const hex2rgb = h => {
  const n = parseInt(String(h || '#888').slice(1), 16);
  return new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
};
