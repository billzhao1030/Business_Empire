// 人物画像：纯手画的 SVG 纸娃娃，没有一张图片。
//
// 按 身体 → 下装 → 上装 → 外套 → 鞋 → 头发 → 配饰 的顺序一层层叠上去，
// 每件衣服自带剪影（shape）和两个颜色，画出来就是你身上那一套。
// 画布 200×360，站姿正面。

export const SKINS   = ['#f2d3bc','#e5b895','#c68d63','#a06a43','#6f4a2f','#4a2f1e'];
export const HAIRCOL = ['#241c18','#4a3524','#8a6236','#c9a227','#b4453a','#7a4a8a','#2f6f8a','#d8d8dc'];

const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;

// ── 身体 ────────────────────────────────────────────────────
function body(sk, g) {
  const hip = g === 'f' ? 30 : 26;                       // 女性剪影腰胯稍宽一点
  const sh  = g === 'f' ? 32 : 36;                       // 男性肩宽一点
  return `
    <ellipse cx="100" cy="62" rx="25" ry="29" fill="${sk}"/>
    <rect x="93" y="86" width="14" height="16" rx="6" fill="${sk}"/>
    <path d="M${100 - sh} 108 Q100 96 ${100 + sh} 108 L${100 + hip} 196 Q100 206 ${100 - hip} 196 Z" fill="${sk}"/>
    <rect x="${100 - sh - 8}" y="110" width="13" height="76" rx="6" fill="${sk}"/>
    <rect x="${100 + sh - 5}" y="110" width="13" height="76" rx="6" fill="${sk}"/>
    <rect x="82" y="192" width="15" height="82" rx="7" fill="${sk}"/>
    <rect x="103" y="192" width="15" height="82" rx="7" fill="${sk}"/>`;
}
function face(sk) {
  return `
    <circle cx="90" cy="60" r="3.1" fill="#2a2226"/><circle cx="110" cy="60" r="3.1" fill="#2a2226"/>
    <path d="M92 74 Q100 80 108 74" stroke="#2a2226" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M84 50 Q90 47 96 50" stroke="#2a2226" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>
    <path d="M104 50 Q110 47 116 50" stroke="#2a2226" stroke-width="2" fill="none" stroke-linecap="round" opacity=".75"/>`;
}
// ── 发型 ────────────────────────────────────────────────────
const HAIR = [
  c => P('M75 56 Q78 28 100 28 Q122 28 125 56 Q120 40 100 40 Q80 40 75 56 Z', c),                  // 短发
  c => P('M74 60 Q74 26 100 26 Q126 26 126 60 L122 54 Q120 38 100 38 Q80 38 78 54 Z', c),          // 寸头
  c => P('M74 58 Q74 26 100 26 Q126 26 126 58 L126 104 L118 104 L118 52 Q112 40 100 40 Q88 40 82 52 L82 104 L74 104 Z', c), // 长发
  c => `${P('M75 56 Q78 28 100 28 Q122 28 125 56 Q120 40 100 40 Q80 40 75 56 Z', c)}${P('M118 30 Q136 34 130 52 Q126 38 116 36 Z', c)}`, // 马尾
  c => P('M72 62 Q70 24 100 24 Q130 24 128 62 Q128 34 100 34 Q72 34 72 62 Z', c),                  // 爆炸头
  c => `${P('M76 54 Q80 30 100 30 Q120 30 124 54 Q118 42 100 42 Q82 42 76 54 Z', c)}${P('M78 46 L122 46 L120 40 L80 40 Z', c)}`, // 中分
  c => P('M78 52 Q84 32 100 32 Q118 32 122 52 Q114 44 100 46 Q86 44 78 52 Z', c),                  // 稀疏
  () => '',                                                                                          // 光头
];
// ── 各部位的剪影 ────────────────────────────────────────────
const TOP = {
  tee:   (a,b)=>`${P('M64 108 Q100 96 136 108 L132 168 Q100 176 68 168 Z',a)}${P('M64 108 L56 140 L68 144 L74 116 Z',b)}${P('M136 108 L144 140 L132 144 L126 116 Z',b)}`,
  polo:  (a,b)=>`${P('M64 108 Q100 96 136 108 L132 170 Q100 178 68 170 Z',a)}${P('M90 100 L100 118 L110 100 L104 97 L100 104 L96 97 Z',b)}`,
  shirt: (a,b)=>`${P('M64 108 Q100 96 136 108 L134 176 Q100 184 66 176 Z',a)}${P('M88 100 L100 122 L112 100 L106 96 L100 106 L94 96 Z',b)}${P('M98 118 L102 118 L102 176 L98 176 Z',b)}`,
  hoodie:(a,b)=>`${P('M58 112 Q100 94 142 112 L138 182 Q100 192 62 182 Z',a)}${P('M80 100 Q100 116 120 100 Q100 92 80 100 Z',b)}${P('M92 140 L108 140 L108 152 L92 152 Z',b)}`,
  knit:  (a,b)=>`${P('M62 110 Q100 98 138 110 L134 174 Q100 182 66 174 Z',a)}${P('M84 98 Q100 108 116 98 Q100 92 84 98 Z',b)}`,
  tank:  (a,b)=>`${P('M76 106 Q100 100 124 106 L122 168 Q100 174 78 168 Z',a)}${P('M84 104 L88 118 M116 104 L112 118',b)}`,
  gown:  (a,b)=>`${P('M70 104 Q100 94 130 104 L128 186 Q100 196 72 186 Z',a)}${P('M70 104 Q100 122 130 104 L128 116 Q100 132 72 116 Z',b)}`,
};
const BOTTOM = {
  pants: (a,b)=>`${P('M70 168 L130 168 L126 278 L106 278 L100 200 L94 278 L74 278 Z',a)}${P('M70 168 L130 168 L129 182 L71 182 Z',b)}`,
  shorts:(a,b)=>`${P('M70 168 L130 168 L127 224 L107 224 L100 196 L93 224 L73 224 Z',a)}${P('M70 168 L130 168 L129 180 L71 180 Z',b)}`,
  skirt: (a,b)=>`${P('M70 168 Q100 162 130 168 L142 236 Q100 248 58 236 Z',a)}${P('M70 168 Q100 162 130 168 L131 180 Q100 174 69 180 Z',b)}`,
  gown:  (a,b)=>`${P('M70 168 Q100 162 130 168 L152 286 Q100 300 48 286 Z',a)}${P('M70 168 Q100 162 130 168 L132 184 Q100 178 68 184 Z',b)}`,
};
const OUTER = {
  jacket:(a,b)=>`${P('M56 110 Q100 96 144 110 L140 180 L122 180 L122 116 L78 116 L78 180 L60 180 Z',a)}${P('M78 116 L78 180 L86 180 L86 118 Z',b)}${P('M122 116 L122 180 L114 180 L114 118 Z',b)}`,
  blazer:(a,b)=>`${P('M58 108 Q100 94 142 108 L138 190 L120 190 L118 114 L82 114 L80 190 L62 190 Z',a)}${P('M82 114 L100 150 L118 114 L110 108 L100 128 L90 108 Z',b)}`,
  coat:  (a,b)=>`${P('M54 108 Q100 94 146 108 L142 230 L120 230 L119 114 L81 114 L80 230 L58 230 Z',a)}${P('M81 114 L100 148 L119 114 L112 106 L100 126 L88 106 Z',b)}${P('M54 132 L58 132 L58 230 L54 230 Z',b)}`,
};
const SHOES = {
  sneak:(a,b)=>`${P('M74 272 L98 272 L98 292 Q86 296 70 292 Z',a)}${P('M102 272 L126 272 L130 292 Q114 296 102 292 Z',a)}${P('M70 288 L98 288 L98 293 L70 293 Z',b)}${P('M102 288 L130 288 L130 293 L102 293 Z',b)}`,
  boot: (a,b)=>`${P('M72 258 L98 258 L98 294 Q84 298 68 294 Z',a)}${P('M102 258 L128 258 L132 294 Q116 298 102 294 Z',a)}${P('M68 289 L98 289 L98 295 L68 295 Z',b)}${P('M102 289 L132 289 L132 295 L102 295 Z',b)}`,
  flat: (a,b)=>`${P('M74 274 L98 274 L98 290 Q84 293 70 290 Z',a)}${P('M102 274 L126 274 L130 290 Q114 293 102 290 Z',a)}${P('M70 287 L98 287 L98 291 L70 291 Z',b)}${P('M102 287 L130 287 L130 291 L102 291 Z',b)}`,
  heel: (a,b)=>`${P('M76 272 L98 272 L96 288 Q84 291 74 288 Z',a)}${P('M104 272 L126 272 L128 288 Q116 291 104 288 Z',a)}${P('M76 288 L82 288 L80 302 L76 302 Z',b)}${P('M120 288 L126 288 L126 302 L122 302 Z',b)}`,
};
const ACC = {
  cap:  (a,b)=>`${P('M74 44 Q100 22 126 44 L126 50 L74 50 Z',a)}${P('M126 44 L152 52 L150 58 L124 52 Z',b)}`,
  glass:(a,b)=>`${P('M78 56 L96 56 L96 66 L78 66 Z',a)}${P('M104 56 L122 56 L122 66 L104 66 Z',a)}${P('M96 59 L104 59 L104 62 L96 62 Z',b)}`,
  scarf:(a,b)=>`${P('M78 98 Q100 112 122 98 L124 116 Q100 128 76 116 Z',a)}${P('M112 116 L124 116 L128 154 L116 154 Z',b)}`,
  tie:  (a,b)=>`${P('M96 104 L104 104 L108 114 L100 122 L92 114 Z',a)}${P('M96 122 L104 122 L108 156 L100 166 L92 156 Z',b)}`,
  belt: (a,b)=>`${P('M70 166 L130 166 L130 178 L70 178 Z',a)}${P('M94 166 L106 166 L106 178 L94 178 Z',b)}`,
  bag:  (a,b)=>`${P('M134 140 L164 140 L168 186 L130 186 Z',a)}${P('M140 140 Q149 124 158 140',b,'stroke="'+b+'" stroke-width="4" fill="none"')}`,
  chain:(a,b)=>`${P('M86 100 Q100 126 114 100 Q100 116 86 100 Z',a)}${P('M96 118 L104 118 L104 128 L96 128 Z',b)}`,
  glove:(a,b)=>`${P('M50 178 L64 178 L64 200 L50 200 Z',a)}${P('M136 178 L150 178 L150 200 L136 200 Z',a)}`,
  stick:(a,b)=>`${P('M148 130 L153 130 L153 250 L148 250 Z',a)}${P('M142 246 L159 246 L159 254 L142 254 Z',b)}`,
};

// 画一个人。slots 是 {top,bottom,outer,shoes,acc}，每个可以是 null
export function avatarSVG(look, opts = {}) {
  const g = look?.gender || 'x';
  const sk = SKINS[Math.min(SKINS.length - 1, look?.skin ?? 2)];
  const hc = HAIRCOL[Math.min(HAIRCOL.length - 1, look?.haircol ?? 0)];
  const s = look?.slots || {};
  const draw = (lib, piece) => {
    if (!piece) return '';
    const f = lib[piece.shape];
    return f ? f(piece.col, piece.col2) : '';
  };
  const bare = !s.top && !s.bottom && !s.outer;
  return `<svg viewBox="0 0 200 330" class="avatar" ${opts.style ? `style="${opts.style}"` : ''}
      role="img" aria-label="avatar" preserveAspectRatio="xMidYMid meet">
    <ellipse cx="100" cy="316" rx="52" ry="9" fill="rgba(0,0,0,.18)"/>
    ${body(sk, g)}
    ${bare ? P('M76 112 L124 112 L124 176 L76 176 Z', 'rgba(255,255,255,.10)') : ''}
    ${draw(BOTTOM, s.bottom)}
    ${draw(TOP, s.top)}
    ${draw(OUTER, s.outer)}
    ${draw(SHOES, s.shoes)}
    ${HAIR[Math.min(HAIR.length - 1, look?.hair ?? 0)](hc)}
    ${face(sk)}
    ${draw(ACC, s.acc)}
  </svg>`;
}
