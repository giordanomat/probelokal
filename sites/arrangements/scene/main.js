import * as T from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

const C = {gelb:0xF5C242, rot:0xE0473C, blau:0x6EACDA, papier:0xF2EFE9, ink:0x141619, sockel:0x20242a, fell:0xe6e0d0, dunkel:0x2b3037};
const mats = {};
function M(c, o){ const k = c + JSON.stringify(o||{}); return mats[k] || (mats[k] = new T.MeshStandardMaterial(Object.assign({color:c, roughness:.32, metalness:.7, side:T.DoubleSide}, o||{}))); }
const brass = c => M(c, {roughness:.3, metalness:.78});
const trim  = () => M(C.papier, {roughness:.35, metalness:.5});
const matte = c => M(c, {roughness:.7, metalness:0});

function roundPath(pts, r){
  const P = pts.map(p => new T.Vector3(p[0], p[1], p[2]));
  const path = new T.CurvePath();
  let prev = P[0].clone();
  for (let i = 1; i < P.length - 1; i++){
    const a = P[i-1], b = P[i], c = P[i+1];
    const d1 = b.clone().sub(a), d2 = c.clone().sub(b);
    const rr = Math.min(r, d1.length()/2, d2.length()/2);
    const p1 = b.clone().sub(d1.clone().normalize().multiplyScalar(rr));
    const p2 = b.clone().add(d2.clone().normalize().multiplyScalar(rr));
    path.add(new T.LineCurve3(prev, p1));
    path.add(new T.QuadraticBezierCurve3(p1, b.clone(), p2));
    prev = p2;
  }
  path.add(new T.LineCurve3(prev, P[P.length-1]));
  return path;
}
function tube(pts, bend, rad, mat){ return new T.Mesh(new T.TubeGeometry(roundPath(pts, bend), 64, rad, 14, false), mat); }
function cyl(r1, r2, h, mat, seg){ return new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 28, 1, false), mat); }
function sph(r, mat){ return new T.Mesh(new T.SphereGeometry(r, 16, 12), mat); }

// Schallstück mit gekrümmter Trichterform, Achse +z, Öffnung vorne
function bell(rNeck, rMouth, len, x, y, z0, mat, k){
  const g = new T.Group(), pts = [], n = 28; k = k || 3.4;
  for (let i = 0; i <= n; i++){ const s = i/n; pts.push(new T.Vector2(rNeck + (rMouth - rNeck)*Math.pow(s, k), s*len)); }
  const geo = new T.LatheGeometry(pts, 56); geo.rotateX(Math.PI/2);
  const m = new T.Mesh(geo, mat); m.position.set(x, y, z0);
  const rim = new T.Mesh(new T.TorusGeometry(rMouth, Math.max(.012, rMouth*.045), 10, 64), trim());
  rim.position.set(x, y, z0 + len);
  g.add(m, rim); return g;
}
function valves(xs, y, z, mat, h){
  const g = new T.Group();
  xs.forEach(([x,zz]) => {
    const v = cyl(.03,.03,h||.2,mat,18); v.position.set(x,y,zz); g.add(v);
    const st = cyl(.011,.011,.1,trim(),8); st.position.set(x,y+(h||.2)/2+.04,zz); g.add(st);
    const cap = cyl(.026,.026,.02,matte(C.dunkel),16); cap.position.set(x,y+(h||.2)/2+.1,zz); g.add(cap);
  });
  return g;
}
function mouthpiece(x,y,z){ const m = cyl(.026,.05,.1,trim(),16); m.rotation.x = Math.PI/2; m.position.set(x,y,z); return m; }

function pedestal(r, col){
  const g = new T.Group();
  const d = cyl(r, r*1.02, .07, M(C.sockel,{roughness:.85, metalness:0}), 64); d.position.y = .035;
  const ring = new T.Mesh(new T.TorusGeometry(r*.97, .016, 8, 96), M(col,{roughness:.45, metalness:0, emissive:col, emissiveIntensity:.18})); ring.rotation.x = Math.PI/2; ring.position.y = .072;
  g.add(d, ring); return g;
}

function trumpet(col){
  const g = new T.Group(), m = brass(col), y = .7;
  g.add(tube([[-.07,y,-.46],[-.07,y,.2],[0,y,.32]], .1, .036, m));
  g.add(tube([[.07,y,.18],[.07,y,-.34],[.07,y-.24,-.34],[.07,y-.24,.18],[.07,y,.18+.001]], .1, .033, m));
  g.add(tube([[.07,y,.18],[.07,y,.3]], 0, .033, m));
  g.add(bell(.05, .25, .5, 0, y, .3, m, 3.2));
  g.add(valves([[-.07,-.06],[-.07,.05],[-.07,.16]], y+.1, 0, m, .2));
  g.add(mouthpiece(-.07,y,-.52));
  // Stimmzug-Schleife oben
  g.add(tube([[-.07,y,-.3],[-.07,y+.2,-.3],[.07,y+.2,-.3],[.07,y,-.3]], .06, .026, m));
  g.userData.note = new T.Vector3(0,.7,.95); return g;
}
function trombone(col){
  const g = new T.Group(), m = brass(col), y = .78;
  g.add(tube([[-.09,y,-.30],[-.09,y,.82]], 0, .03, m));
  g.add(tube([[.09,y,-.30],[.09,y,.82]], 0, .03, m));
  g.add(tube([[-.09,y,.66],[-.09,y,.88],[.09,y,.88],[.09,y,.66]], .09, .03, m));
  g.add(tube([[.09,y,-.30],[.09,y,-.5],[.38,y,-.5],[.38,y,.3]], .16, .042, m));
  g.add(tube([[-.09,y,-.30],[-.09,y,-.52]], 0, .03, m));
  g.add(bell(.055, .3, .5, .38, y, .3, m, 3.3));
  const b1 = new T.Mesh(new T.BoxGeometry(.22,.03,.035), trim()); b1.position.set(0,y,.3); g.add(b1);
  const b2 = new T.Mesh(new T.BoxGeometry(.22,.03,.035), trim()); b2.position.set(0,y,-.12); g.add(b2);
  g.add(mouthpiece(-.09,y,-.58));
  g.position.x = -.14;
  const h = new T.Group(); h.add(g); h.userData.note = new T.Vector3(.24,y,.95); return h;
}
function euphonium(col){
  // Euphonium (Fasnacht): stehende, schlanke Bauform – Schallstück oben, Ventile vorn, kompakte Windungen
  const g = new T.Group(), m = brass(col);
  g.add(tube([[-.3,.62,-.06],[-.3,.2,-.06],[.3,.2,-.06],[.3,.92,-.06],[-.3,.92,-.06],[-.3,.66,-.06]], .2, .062, m));
  g.add(tube([[-.17,.55,.0],[-.17,.12,.0],[.17,.12,.0],[.17,.6,.0]], .15, .045, m));
  g.add(tube([[-.2,.9,.12],[-.2,.5,.12],[.2,.5,.12],[.2,.9,.12]], .14, .034, m));
  const bg = new T.Group(); bg.position.set(0,.95,-.02); bg.rotation.x = .12;
  const pts = [], n = 32; for (let i = 0; i <= n; i++){ const s = i/n; pts.push(new T.Vector2(.075 + (.36-.075)*Math.pow(s, 2.7), s*.72)); }
  bg.add(new T.Mesh(new T.LatheGeometry(pts, 64), m));
  const rim = new T.Mesh(new T.TorusGeometry(.36,.022,10,80), trim()); rim.rotation.x = Math.PI/2; rim.position.y = .72; bg.add(rim);
  g.add(bg);
  g.add(valves([[-.1,.17],[0,.17],[.1,.17]], .74, 0, m, .34));
  g.add(tube([[.1,.98,.17],[.36,1.02,.12],[.42,1.16,.1]], .1, .028, m));
  const mp = cyl(.03,.05,.1,trim(),16); mp.position.set(.42,1.2,.1); g.add(mp);
  const hook = sph(.03, M(C.gelb,{metalness:.7,roughness:.3})); hook.position.set(-.3,.55,.04); g.add(hook);
  g.userData.note = new T.Vector3(0,2.0,.1); return g;
}
function sousa(col){
  // Sousaphon: große Windung um den Spieler, Schallstück schwingt über den Kopf nach vorn-oben
  const g = new T.Group(), m = brass(col);
  const ring = (r,t,y,z,x) => { const q = new T.Mesh(new T.TorusGeometry(r,t,18,96), m); q.position.set(x||0,y,z); q.rotation.x = -.18; g.add(q); return q; };
  ring(.62,.085,.82,-.25,0); ring(.44,.062,.82,-.2,0); ring(.27,.045,.82,-.15,0);
  const sb = bell(.1, .66, .8, 0, 0, 0, m, 2.5); sb.position.set(0,1.38,-.28); sb.rotation.x = -.42; g.add(sb);
  g.add(tube([[0,1.4,-.3],[0,1.2,-.5],[0,.9,-.55]], .1, .07, m));
  g.add(valves([[.22,-.02],[.34,-.02],[.46,-.02]], .95, 0, m, .26).rotateZ(0));
  g.add(tube([[-.2,.34,.1],[-.1,.3,.3],[-.1,.7,.3],[0,.82,.08]], .1, .028, m));
  g.add(mouthpiece(-.2,.34,.06));
  g.userData.note = new T.Vector3(0,1.95,.9); return g;
}
function pauken(){
  // Fasnachts-Pauke: Marschtrommel, am Bauch getragen (Tragegestell), mit Filzschlägeln
  const g = new T.Group(), shellM = M(0x252a31,{roughness:.3, metalness:.35}), head = matte(C.fell), chrome = M(C.papier,{roughness:.25, metalness:.85}), gold = M(C.gelb,{metalness:.7, roughness:.3}), strap = matte(0x3a3f47);
  const sticks = [];
  const D = [[-.64,.56,.44],[.62,.46,.38]];
  D.forEach(([x,r,dp], i) => {
    const y = .98;
    const sh = cyl(r,r,dp,shellM,64); sh.rotation.x = Math.PI/2; sh.position.set(x,y,0); g.add(sh);
    const hd = new T.Mesh(new T.CircleGeometry(r*.97,64), head); hd.position.set(x,y,dp/2+.004); g.add(hd);
    const hd2 = new T.Mesh(new T.CircleGeometry(r*.97,64), head); hd2.rotation.y = Math.PI; hd2.position.set(x,y,-dp/2-.004); g.add(hd2);
    [dp/2,-dp/2].forEach(z => { const hoop = new T.Mesh(new T.TorusGeometry(r*1.005,.022,10,96), chrome); hoop.position.set(x,y,z); g.add(hoop); });
    for (let k = 0; k < 10; k++){ const a = k/10*Math.PI*2; const rod = cyl(.008,.008,dp+.02,chrome,6); rod.rotation.x = Math.PI/2; rod.position.set(x+Math.cos(a)*(r+.02), y+Math.sin(a)*(r+.02), 0); g.add(rod); const lug = cyl(.018,.018,.06,chrome,10); lug.rotation.x = Math.PI/2; lug.position.set(x+Math.cos(a)*(r+.02), y+Math.sin(a)*(r+.02), 0); g.add(lug); }
    const st = new T.Group(); st.position.set(x+.2, y+.32, dp/2+.62);
    const s = cyl(.012,.012,.55,M(C.papier,{roughness:.4,metalness:.1}),8); s.rotation.x = Math.PI/2; s.position.z = -.275; const tip = sph(.058, M(C.papier,{roughness:.9,metalness:0})); tip.position.z = -.56; const band = new T.Mesh(new T.TorusGeometry(.05,.01,6,20), gold); band.position.z = -.5; st.add(s,tip,band); st.userData.i = i; sticks.push(st); g.add(st);
    // Tragegurt über den Schultern: je Trommel ein Bügel
  });
  // Tragestange (zeigt: wird am Körper getragen)
  const pole = cyl(.025,.025,1.7,chrome,10); pole.position.set(0,.85,-.45); g.add(pole);
  const bar = cyl(.02,.02,1.5,chrome,10); bar.rotation.z = Math.PI/2; bar.position.set(0,.98,-.4); g.add(bar);
  const top = cyl(.02,.02,.9,chrome,10); top.rotation.z = Math.PI/2; top.position.set(0,1.7,-.45); g.add(top);
  [-.45,.45].forEach(x => { const s = new T.Mesh(new T.BoxGeometry(.05,.72,.012), strap); s.position.set(x*1.05,1.34,-.43); g.add(s); const b = sph(.03, gold); b.position.set(x*1.05,.98,-.4); g.add(b); });
  [-.4,.4].forEach(x => { const f = cyl(.03,.03,.04,chrome,10); f.position.set(x,.02,-.45); g.add(f); });
  const base = new T.Mesh(new T.TorusGeometry(.35,.02,8,40), chrome); base.rotation.x = Math.PI/2; base.position.set(0,.03,-.45); g.add(base);
  g.userData.sticks = sticks; return g;
}
function cymbal(r, y, tilt){
  const pts = [new T.Vector2(.001,.05), new T.Vector2(r*.18,.04), new T.Vector2(r*.5,.0), new T.Vector2(r,-.03)];
  const m = new T.Mesh(new T.LatheGeometry(pts, 48), M(C.gelb,{metalness:.9, roughness:.22})); m.position.y = y; m.rotation.z = tilt; return m;
}
function kit(){
  // »Chochi«: Fasnachts-Schlagzeug auf dem fahrbaren Gestell
  const g = new T.Group(), shell = M(C.papier,{roughness:.32, metalness:.5}), gold = M(C.gelb,{metalness:.75, roughness:.28}), fell = matte(C.fell), pole = M(C.papier,{roughness:.35, metalness:.55}), tyre = matte(0x2c3036);
  const rod = (a,b,r) => { const A = new T.Vector3(...a), B = new T.Vector3(...b); const m = new T.Mesh(new T.CylinderGeometry(r,r,A.distanceTo(B),10), pole); m.position.copy(A.clone().add(B).multiplyScalar(.5)); m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), B.clone().sub(A).normalize()); g.add(m); };
  // Fahrgestell: Achse mit zwei Rädern, vorn kurze Füße, hinten Schiebegriff
  rod([-.75,.3,-.35],[.75,.3,-.35],.022);
  [-.75,.75].forEach(x => { const w = new T.Mesh(new T.TorusGeometry(.28,.05,12,40), tyre); w.rotation.y = Math.PI/2; w.position.set(x,.3,-.35); g.add(w); const hub = new T.Mesh(new T.CylinderGeometry(.22,.22,.03,32), pole); hub.rotation.z = Math.PI/2; hub.position.set(x,.3,-.35); g.add(hub); const cap = sph(.045, gold); cap.position.set(x+(x>0?.03:-.03),.3,-.35); g.add(cap); });
  [-.5,.5].forEach(x => { rod([x,.3,-.35],[x,.05,.5],.02); rod([x,.3,-.35],[x*.9,1.5,-.15],.022); });
  rod([-.5,.5,.05],[.5,.5,.05],.02); rod([-.45*1.0,1.38,-.15],[.45,1.38,-.15],.02);
  rod([-.5,.3,-.35],[-.5,1.05,-.85],.02); rod([.5,.3,-.35],[.5,1.05,-.85],.02); rod([-.5,1.05,-.85],[.5,1.05,-.85],.02);
  // Trommeln
  const drum = (x,y,z,r,h,tiltX,col) => { const d = new T.Group(); d.position.set(x,y,z); d.rotation.x = tiltX; const s = cyl(r,r,h,shell,48); d.add(s); const f = new T.Mesh(new T.CircleGeometry(r*.96,48), fell); f.rotation.x = -Math.PI/2; f.position.y = h/2+.003; d.add(f); const hp = new T.Mesh(new T.TorusGeometry(r,.016,8,64), gold); hp.rotation.x = Math.PI/2; hp.position.y = h/2; d.add(hp); const hp2 = new T.Mesh(new T.TorusGeometry(r,.016,8,64), gold); hp2.rotation.x = Math.PI/2; hp2.position.y = -h/2; d.add(hp2); g.add(d); return d; };
  drum(-.28,1.14,.1,.22,.2,.38); drum(.28,1.14,.1,.22,.2,.38);   // Hänge-Toms
  drum(0,.76,.3,.26,.17,.2);                                       // Snare
  drum(.62,.72,.2,.28,.3,.12);                                     // Standtom
  const bass = cyl(.32,.32,.32,shell,48); bass.rotation.x = Math.PI/2; bass.position.set(-.5,.52,.25); g.add(bass);   // kleine Bassdrum
  const bf = new T.Mesh(new T.CircleGeometry(.3,48), fell); bf.position.set(-.5,.52,.416); g.add(bf);
  [.16,-.16].forEach(z => { const h = new T.Mesh(new T.TorusGeometry(.32,.018,8,64), gold); h.position.set(-.5,.52,.25+z); g.add(h); });
  // Becken auf Auslegern
  rod([-.45,1.3,-.15],[-.95,1.15,-.05],.015); const hh1 = cymbal(.2,1.16,0); hh1.position.set(-.95,1.16,-.05); g.add(hh1); const hh2 = cymbal(.2,1.2,Math.PI); hh2.position.set(-.95,1.22,-.05); g.add(hh2);
  rod([0,1.45,-.15],[.15,1.85,-.2],.015); const cr = cymbal(.34,1.86,.12); cr.position.set(.15,1.86,-.2); g.add(cr);
  rod([.45,1.38,-.15],[1.0,1.3,-.1],.015); const rd = cymbal(.36,1.31,-.1); rd.position.set(1.0,1.31,-.1); g.add(rd);
  const sticks = [];
  [[-.28,1.28,.06],[0,.92,.25]].forEach((pos,i) => {
    const st = new T.Group(); st.position.set(pos[0]+.1, pos[1]+.3, pos[2]-.15);
    const s = cyl(.012,.012,.6,pole,8); s.rotation.x = Math.PI/2; s.position.z = .28; const tip = sph(.034, gold); tip.position.z = .58; st.add(s,tip); st.userData.i = i; sticks.push(st); g.add(st);
  });
  g.userData.sticks = sticks; return g;
}

const BUILD = {trumpet, trombone, euphonium, sousa};
// Aufstellung (Winkel von der Mitte, Radius um den Dirigenten): hinten Sousaphone, dann Posaunen, Trompeten, vorne Euphonien.
// Links/rechts Schlagzeug, dahinter die Pauken.
const LAYOUT = [];
[-22,0,22].forEach((a,n) => LAYOUT.push({k:'sousa', col:C.blau, r:6.9, a, sc:1.12, ped:1.0, row:0}));
[-36,-12,12,36].forEach(a => LAYOUT.push({k:'trombone', col:C.rot, r:5.5, a, sc:1.3, ped:.82, row:1}));
[-44,-22,0,22,44].forEach(a => LAYOUT.push({k:'trumpet', col:C.gelb, r:4.3, a, sc:1.6, ped:.78, row:2}));
[-33,-11,11,33].forEach(a => LAYOUT.push({k:'euphonium', col:C.blau, r:2.6, a, sc:1.05, ped:.6, row:3}));
[-68,68].forEach(a => LAYOUT.push({k:'kit', col:C.papier, r:4.9, a, sc:1.25, ped:1.4, row:1.5}));
[-62,62].forEach(a => LAYOUT.push({k:'pauken', col:C.papier, r:7.0, a, sc:1.3, ped:1.3, row:.5}));

function ease(t){ t = Math.max(0, Math.min(1, t)); const c = 1.5; return 1 + (c+1)*Math.pow(t-1,3) + c*Math.pow(t-1,2); }

function init(canvas, stage, DEBUG){
  const renderer = new T.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'low-power'});
  renderer.setClearColor(0x000000, 0);
  
  const scene = new T.Scene();
  const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .5;
  const camera = new T.PerspectiveCamera(31, 2, .1, 80);
  const TGT = new T.Vector3(0,.3,-3.2), R = new T.Vector3(0,9.6,13.6);

  scene.add(new T.HemisphereLight(0xdfe6ff, 0x20242a, .7));
  const key = new T.DirectionalLight(0xffffff, 1.7); key.position.set(3,9,8); scene.add(key);
  const rim = new T.DirectionalLight(0x6EACDA, .9); rim.position.set(-6,4,-7); scene.add(rim);
  const warm = new T.DirectionalLight(0xF5C242, .6); warm.position.set(7,3,-4); scene.add(warm);

  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gx = gc.getContext('2d');
  const gr = gx.createRadialGradient(128,128,10,128,128,126); gr.addColorStop(0,'rgba(38,43,50,1)'); gr.addColorStop(.65,'rgba(30,34,40,.85)'); gr.addColorStop(1,'rgba(24,27,31,0)');
  gx.fillStyle = gr; gx.fillRect(0,0,256,256);
  const gtex = new T.CanvasTexture(gc); gtex.colorSpace = T.SRGBColorSpace;
  const floor = new T.Mesh(new T.CircleGeometry(10.2,96), new T.MeshBasicMaterial({map:gtex, transparent:true, depthWrite:false})); floor.rotation.x = -Math.PI/2; scene.add(floor);
  [2.7,4.1,5.5,6.9].forEach(r => {
    const pts = []; for (let a = -84; a <= 84; a += 2){ const t = a*Math.PI/180; pts.push(new T.Vector3(r*Math.sin(t), .012, -r*Math.cos(t))); }
    scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({color:C.papier, transparent:true, opacity:.1})));
  });

  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const sx = sc.getContext('2d');
  const sg = sx.createRadialGradient(64,64,6,64,64,62); sg.addColorStop(0,'rgba(0,0,0,.6)'); sg.addColorStop(1,'rgba(0,0,0,0)'); sx.fillStyle = sg; sx.fillRect(0,0,128,128);
  const stex = new T.CanvasTexture(sc);

  const items = [];
  LAYOUT.forEach((L, i) => {
    const holder = new T.Group();
    const t = L.a*Math.PI/180;
    holder.position.set(L.r*Math.sin(t), 0, -L.r*Math.cos(t));
    holder.rotation.y = -t;
    const shadow = new T.Mesh(new T.PlaneGeometry(L.ped*2.9, L.ped*2.9), new T.MeshBasicMaterial({map:stex, transparent:true, depthWrite:false})); shadow.rotation.x = -Math.PI/2; shadow.position.y = .006; holder.add(shadow);
    holder.add(pedestal(L.ped, L.col));
    const inst = L.k === 'pauken' ? pauken() : L.k === 'kit' ? kit() : BUILD[L.k](L.col);
    inst.scale.setScalar(L.sc); inst.position.y = .07;
    holder.add(inst);
    const notes = [];
    if (inst.userData.note){
      for (let n = 0; n < 2; n++){
        const nm = new T.Mesh(new T.CapsuleGeometry(.025,.1,4,8), new T.MeshBasicMaterial({color:L.col, transparent:true, opacity:0}));
        nm.rotation.z = Math.PI/2; inst.add(nm); notes.push(nm);
      }
    }
    scene.add(holder);
    items.push({holder, inst, notes, L, ph:i*.9, i});
  });

  // Dirigent: das Zeichen als Scheibe auf einem Podest
  const cond = new T.Group(); cond.position.set(0,0,1.3);
  const pod = cyl(.85,.9,.22,M(C.sockel,{roughness:.8,metalness:0}),64); pod.position.y = .11; cond.add(pod);
  const pr = new T.Mesh(new T.TorusGeometry(.85,.022,8,80), M(C.gelb,{roughness:.4,metalness:.2,emissive:C.gelb,emissiveIntensity:.25})); pr.rotation.x = Math.PI/2; pr.position.y = .225; cond.add(pr);
  const stem = cyl(.06,.09,.5,M(C.papier,{roughness:.4,metalness:.4}),24); stem.position.y = .46; cond.add(stem);
  const disc = new T.Group(); disc.position.set(0,1.28,0); disc.rotation.x = -.08;
  const dk = cyl(.78,.78,.12,M(C.ink,{roughness:.55,metalness:.1}),72); dk.rotation.x = Math.PI/2; disc.add(dk);
  const dr = new T.Mesh(new T.TorusGeometry(.78,.038,12,96), M(C.papier,{roughness:.4,metalness:.1})); disc.add(dr);
  const k = 1.56/200;
  [[C.gelb,-14,33,92],[C.rot,15,-1,94],[C.blau,-5,-35,114]].forEach(([c,ox,oy,w]) => {
    const rad = 13*k, len = w*k - 2*rad;
    const pm2 = new T.Mesh(new T.CapsuleGeometry(rad, len, 8, 18), M(c,{roughness:.5,metalness:0}));
    pm2.rotation.z = Math.PI/2; pm2.position.set(ox*k, oy*k, .09); disc.add(pm2);
  });
  cond.add(disc);
  const baton = new T.Group(); baton.position.set(.66,1.86,.1);
  const bs = new T.Mesh(new T.CapsuleGeometry(.02,.8,4,10), M(C.papier,{roughness:.4,metalness:.1})); bs.position.set(.2,.4,0); bs.rotation.z = -.5; baton.add(bs);
  const bt = sph(.045, M(C.gelb,{roughness:.4,metalness:.1,emissive:C.gelb,emissiveIntensity:.4})); bt.position.set(.4,.8,0); baton.add(bt);
  cond.add(baton);
  const pulses = [0,1].map(() => { const m = new T.Mesh(new T.TorusGeometry(1,.012,6,96), new T.MeshBasicMaterial({color:C.gelb, transparent:true, opacity:0})); m.rotation.x = Math.PI/2; m.position.y = .02; cond.add(m); return m; });
  scene.add(cond);

  let yaw = 0, yawT = 0, W = 0, H = 0, running = false, raf = 0, t0 = performance.now();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const INTRO = reduce ? 0 : 1.0;
  function resize(){
    const w = Math.round(canvas.clientWidth || stage.clientWidth || 600); const h = Math.round(w*0.5);
    if (!w || (w === W && h === H)) return; W = w; H = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(w, h, false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
  }
  function frame(now){
    const t = reduce ? 3.5 : (now - t0)/1000;
    yaw += (yawT - yaw)*.06;
    const az = yaw*.35 + (reduce ? 0 : Math.sin(t*.25)*.07);
    const el = R.y, d = Math.hypot(R.x, R.z);
    camera.position.set(TGT.x + Math.sin(az)*d, TGT.y + el, TGT.z + Math.cos(az)*d);
    camera.lookAt(TGT);
    items.forEach(it => {
      const s = ease((t - INTRO - it.L.row*.18 - (it.i%3)*.05)/.7);
      it.holder.scale.setScalar(Math.max(.001, s));
      const b = Math.sin(t*2.3 + it.ph);
      if (it.L.k !== 'pauken' && it.L.k !== 'kit'){ it.inst.rotation.x = b*.02; it.inst.position.y = .07 + Math.abs(b)*.018; }
      else { const sk = it.inst.userData.sticks; const sg = it.L.k === 'pauken' ? 1 : -1; sk.forEach((st, j) => { st.rotation.x = sg*(.1 + (Math.sin(t*7 + j*1.9 + it.i) * .5 + .5) * .6); }); }
      const np = it.inst.userData.note;
      if (np){ it.notes.forEach((nm, n) => {
        const p = ((t*.3 + it.i*.173 + n*.5) % 1);
        nm.position.set(np.x + (n ? .12 : -.12)*p*2, np.y + p*1.2, np.z + p*.3);
        nm.material.opacity = Math.sin(Math.PI*p)*.85;
      }); }
    });
    cond.scale.setScalar(Math.max(.001, ease((t - INTRO + .35)/.7)));
    const sw = Math.sin(t*5.2);
    baton.rotation.z = -.15 + sw*.4; baton.rotation.x = Math.cos(t*2.6)*.12;
    pulses.forEach((m, n) => { const p = ((t*.34 + n*.5) % 1); const s = .9 + p*2.2; m.scale.set(s,s,s); m.material.opacity = (1-p)*.28; });
    renderer.render(scene, camera);
  }
  function loop(now){ if (!running) return; frame(now); raf = requestAnimationFrame(loop); }
  function start(){ if (running || reduce) return; running = true; raf = requestAnimationFrame(loop); }
  function stop(){ running = false; cancelAnimationFrame(raf); }
  resize(); let rq = 0; new ResizeObserver(() => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; resize(); if (!running) frame(performance.now()); }); }).observe(stage);
  if (reduce){ frame(performance.now()); }
  else {
    new IntersectionObserver(es => es.forEach(e => e.isIntersecting && !document.hidden ? start() : stop()), {threshold:0}).observe(stage);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  }
  if (matchMedia('(pointer:fine)').matches) window.addEventListener('pointermove', e => { yawT = (e.clientX/innerWidth - .5)*2; });
  if (DEBUG){ window.__o = {camera, TGT, frame, scene, R, setT(v){ t0 = performance.now() - v*1000; }}; }
  return true;
}

export function start(DEBUG){
  const stage = document.querySelector('.stage'); const canvas = document.getElementById('orch3d');
  if (!stage || !canvas) return;
  try { init(canvas, stage, DEBUG); stage.classList.add('is3d'); }
  catch (e) { stage.classList.add('no3d'); }
}
