// 手绘风格世界地图（等距圆柱投影），零依赖
const LAND = [
  // 北美洲
  [[-168,65],[-160,71],[-140,70],[-125,70],[-100,72],[-80,73],[-62,60],[-55,47],[-66,45],[-70,42],[-76,35],[-81,25],[-97,26],[-105,20],[-110,23],[-115,30],[-124,40],[-130,55],[-140,60],[-152,59],[-166,55],[-168,65]],
  // 格陵兰
  [[-45,60],[-30,70],[-25,75],[-35,83],[-55,82],[-60,75],[-52,65],[-45,60]],
  // 南美洲
  [[-81,10],[-72,12],[-60,10],[-52,5],[-35,-5],[-38,-13],[-48,-25],[-58,-35],[-62,-42],[-68,-52],[-75,-52],[-73,-45],[-71,-30],[-70,-18],[-75,-5],[-81,0],[-81,10]],
  // 非洲
  [[-17,15],[-10,28],[10,37],[25,32],[35,31],[43,12],[51,12],[42,-2],[40,-15],[35,-25],[25,-34],[18,-34],[12,-18],[9,4],[-8,5],[-17,15]],
  // 欧亚大陆
  [[-10,36],[0,44],[12,45],[20,40],[30,36],[45,40],[50,30],[60,25],[68,23],[78,8],[80,15],[88,22],[95,16],[100,13],[106,10],[110,20],[120,23],[122,31],[122,40],[130,43],[136,55],[146,60],[160,60],[170,66],[180,68],[180,73],[140,76],[100,77],[80,73],[60,70],[40,68],[30,70],[25,71],[10,63],[5,60],[-5,58],[-10,50],[-10,36]],
  // 英国
  [[-5,50],[-3,53],[-5,58],[-2,58],[0,54],[1,52],[-5,50]],
  // 日本
  [[130,32],[135,34],[140,36],[142,41],[145,44],[141,45],[138,37],[133,34],[130,32]],
  // 东南亚群岛
  [[95,6],[105,2],[112,-3],[118,-8],[125,-9],[132,-4],[141,-3],[141,-9],[130,-9],[120,-10],[110,-8],[100,-1],[95,6]],
  // 菲律宾
  [[120,18],[124,13],[126,8],[122,6],[120,12],[120,18]],
  // 澳大利亚
  [[114,-22],[122,-18],[130,-12],[137,-12],[143,-11],[146,-19],[153,-25],[153,-32],[150,-38],[143,-39],[135,-35],[129,-32],[120,-34],[115,-34],[114,-22]],
  // 塔斯马尼亚
  [[145,-41],[148,-41],[148,-43],[145,-43],[145,-41]],
  // 新西兰
  [[172,-34],[178,-38],[177,-41],[174,-41],[172,-44],[168,-47],[166,-45],[170,-42],[172,-34]],
  // 马达加斯加
  [[43,-12],[50,-15],[47,-25],[44,-20],[43,-12]],
  // 南极洲
  [[-180,-70],[-140,-74],[-100,-73],[-60,-63],[-20,-70],[20,-70],[60,-67],[100,-66],[140,-67],[180,-72],[180,-88],[-180,-88],[-180,-70]],
];

const CSSVAR = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

export function drawWorld(canvas, opts) {
  const { places, home, selected, visited, hovered } = opts;
  const w = canvas.parentElement?.clientWidth || canvas.clientWidth || 860;
  const h = Math.round(w * 0.50);
  const r = window.devicePixelRatio || 1;
  canvas.width = w * r; canvas.height = h * r;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(r, 0, 0, r, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // 投影：纬度限制在 ±85，避免极地拉伸
  const X = lon => (lon + 180) / 360 * w;
  const Y = lat => (85 - Math.max(-85, Math.min(85, lat))) / 170 * h;

  // 海洋
  const og = ctx.createLinearGradient(0, 0, 0, h);
  og.addColorStop(0, CSSVAR('--bg2')); og.addColorStop(1, CSSVAR('--bg'));
  ctx.fillStyle = og; ctx.fillRect(0, 0, w, h);

  // 经纬网
  ctx.strokeStyle = CSSVAR('--line'); ctx.lineWidth = 0.6; ctx.globalAlpha = 0.55;
  for (let lon = -180; lon <= 180; lon += 30) { ctx.beginPath(); ctx.moveTo(X(lon), 0); ctx.lineTo(X(lon), h); ctx.stroke(); }
  for (let lat = -60; lat <= 80; lat += 30) { ctx.beginPath(); ctx.moveTo(0, Y(lat)); ctx.lineTo(w, Y(lat)); ctx.stroke(); }
  ctx.globalAlpha = 1;
  // 赤道
  ctx.strokeStyle = CSSVAR('--line2'); ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke(); ctx.setLineDash([]);

  // 陆地
  for (const poly of LAND) {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat)));
    ctx.closePath();
    ctx.fillStyle = CSSVAR('--panel2'); ctx.fill();
    ctx.strokeStyle = CSSVAR('--line2'); ctx.lineWidth = 1; ctx.stroke();
  }

  // 从家出发的航线
  const hx = X(home.lon), hy = Y(home.lat);
  const target = places.find(p => p.id === (hovered || selected));
  if (target) {
    const tx = X(target.lon), ty = Y(target.lat);
    ctx.beginPath(); ctx.moveTo(hx, hy);
    const mx = (hx + tx) / 2, my = (hy + ty) / 2 - Math.abs(tx - hx) * 0.18 - 18;
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.strokeStyle = CSSVAR('--gold'); ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
    ctx.stroke(); ctx.setLineDash([]);
  }

  // 目的地圆点
  const pts = [];
  for (const p of places) {
    const x = X(p.lon), y = Y(p.lat);
    const been = !!visited[p.id];
    const isSel = p.id === selected, isHov = p.id === hovered;
    const rad = isSel || isHov ? 6 : been ? 5 : 3.6;
    if (been) { ctx.beginPath(); ctx.arc(x, y, rad + 5, 0, 7); ctx.fillStyle = CSSVAR('--up') + '33'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 7);
    ctx.fillStyle = been ? CSSVAR('--up') : isSel || isHov ? CSSVAR('--gold') : CSSVAR('--dim');
    ctx.fill();
    ctx.strokeStyle = CSSVAR('--bg'); ctx.lineWidth = 1.4; ctx.stroke();
    pts.push({ id: p.id, x, y, r: Math.max(9, rad + 5) });
  }
  // 家
  ctx.beginPath(); ctx.arc(hx, hy, 8, 0, 7); ctx.fillStyle = CSSVAR('--gold') + '44'; ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, 7); ctx.fillStyle = CSSVAR('--gold'); ctx.fill();
  ctx.font = '600 10.5px ' + CSSVAR('--sans');
  ctx.fillStyle = CSSVAR('--gold'); ctx.textAlign = 'center';
  ctx.fillText('🏠 ' + home.zh, hx, hy + 18);

  // 悬停/选中标签
  const lab = pts.find(q => q.id === (hovered || selected));
  if (lab && target) {
    const text = `${target.flag} ${target.zh}`;
    ctx.font = '700 11.5px ' + CSSVAR('--sans');
    const tw = ctx.measureText(text).width + 14;
    let lx = Math.min(Math.max(lab.x - tw / 2, 4), w - tw - 4), ly = lab.y - 26;
    if (ly < 4) ly = lab.y + 12;
    ctx.fillStyle = CSSVAR('--panel'); ctx.strokeStyle = CSSVAR('--line2'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(lx, ly, tw, 20, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = CSSVAR('--txt'); ctx.textAlign = 'left';
    ctx.fillText(text, lx + 7, ly + 14);
  }
  return { pts, w, h };
}
