// scripts/_budget.mjs, before any page code: what each system of the phone's town costs before batching (triangles,
// buffers, pictures), how long each part of the build took, and (window.__budgetArg.cut: [system, ...]) the town
// built without some systems, to measure what they cost in a frame.
(() => {
  const marks = [];
  let last = performance.now();
  window.__sys = (name) => {
    const t = performance.now();
    marks.push([name, Math.round(t - last)]);
    globalThis.__sysRoot?.traverse((o) => { o.userData.sys ??= name; });
    last = performance.now();
  };
  const LAND = [
    [/pond|slowlife|reed|pad$|head$|kawara|yakisugi|shoji|plaster|timber|tile|willow|lattice|cedar|redFelt/, 'pond, teahouse, bench'],
    [/river|channel|bridge|granite|nosing|slab|masonry|rail|deck|lampHead|post$/, 'river, bridge'],
    [/paddy|plough|renge|ridge|mud|tuft|shed|steel|straw|cloth|concrete/, 'paddies'],
    [/hills/, 'far hills'],
    [/gate|rope|paper|iron|door|roof/, 'Deer Park gate'],
  ];
  const sysOf = (o) => {
    const chain = [];
    for (let a = o; a; a = a.parent) chain.push(a.name || '');
    const has = (re) => chain.some((n) => re.test(n));
    const n = o.name || '';
    if (has(/^lawson-interior$/)) return /^stock/.test(n) ? 'konbini: stock, labels' : /^store-quads/.test(n) ? 'konbini: signs, POP' : 'konbini: interior';
    if (has(/^lawson-shell$|^lawson-frame$/)) return 'konbini: shell';
    if (has(/^lawson/)) return 'konbini: forecourt, signs';
    if (has(/^megastore$/)) return 'donpen-do';
    if (has(/^pettan/)) return 'mochi shop';
    if (has(/^shrine/)) return 'shrine';
    if (has(/^hachi-home$/)) return "Hachi's home";
    if (has(/^animals-shiba$/)) return 'Hachi';
    if (has(/^animals|^sparrows$/)) return 'animals';
    if (has(/^station$/)) return 'station';
    if (has(/^level-crossing$/)) return 'level crossing';
    if (has(/^train-/)) return 'train: ' + chain.find((c) => /^train-/.test(c)).slice(6);
    if (has(/^line$/)) return 'line: track, catenary, fences';
    if (has(/^rx7$|^han/)) return 'Han, RX-7';
    if (has(/^apartment$/)) return 'apartment';
    if (has(/^shop-/)) return 'shops';
    if (has(/^house-/)) return 'houses';
    if (has(/^vehicle/)) return 'cars';
    if (has(/Sakura|fallenPetals|sakuraShower/)) return 'sakura';
    if (has(/^grove/)) return 'far groves';
    if (has(/^(pine|maple|mapleRed|camphor|shrub|zelkova)(Wood|Cards|Near|Far|Shadow)|^weeds$/)) return 'trees, shrubs';
    if (has(/^(pole|wires|lamp-post|mirror|a-board|vending|bicycle|bike-rack|signals)$|^sign-|^clutter-/)) return 'street furniture';
    if (has(/^roads$|^kit-decals|^nightPools$/)) return 'roads, decals';
    if (has(/^land$/)) { for (const [re, s] of LAND) if (re.test(n) || chain.slice(0, 3).some((c) => re.test(c))) return s; return 'land: other'; }
    if (n === 'ground') return 'roads, decals';
    return 'unnamed: ' + (o.userData.sys ?? '?');
  };
  window.__sysOf = sysOf;
  window.__preMerge = (root) => {
    const S = {};
    const texUsers = new Map(), geoSeen = new Set();
    const texs = (m) => { const l = []; for (const v of Object.values(m)) if (v?.isTexture) l.push(v); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) l.push(u.value); return l; };
    const cut = new Set(window.__budgetArg?.cut ?? []), gone = [];
    root.traverse((o) => {
      if (!(o.isMesh || o.isLine || o.isPoints)) return;
      const k = sysOf(o);
      // a house of the row beyond the line (line/index.js buildBeyond), by its place in the build
      const key = k === 'houses' && /^line/.test(o.userData.sys ?? '') ? 'houses beyond the line' : k;
      if (cut.has(key)) gone.push(o);
      const e = (S[key] ??= { meshes: 0, tris: 0, bufMB: 0, texMB: 0, tex: 0 });
      e.meshes += Array.isArray(o.material) ? o.material.length : 1;
      const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position?.count ?? 0) / 3;
      e.tris += Math.round(n * (o.isInstancedMesh ? o.count : 1));
      if (!geoSeen.has(g)) {
        geoSeen.add(g);
        let b = 0;
        for (const a of Object.values(g.attributes)) b += a.array?.byteLength ?? 0;
        b += g.index?.array?.byteLength ?? 0;
        e.bufMB += b / 1048576;
      }
      if (o.isInstancedMesh) e.bufMB += (o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0)) / 1048576;
      for (const m of [o.material].flat()) if (m) for (const t of texs(m)) {
        const src = t.source;
        if (!texUsers.has(src)) texUsers.set(src, { t, users: new Set() });
        texUsers.get(src).users.add(key);
      }
    });
    const shared = [];
    for (const { t, users } of texUsers.values()) {
      const w = t.image?.width ?? 0, h = t.image?.height ?? 0;
      const mb = w * h * 4 * (t.generateMipmaps ? 4 / 3 : 1) / 1048576;
      if (users.size === 1) { const e = S[[...users][0]]; e.texMB += mb; e.tex++; }
      else shared.push({ mb: +mb.toFixed(2), size: `${w}x${h}`, name: t.name || '', users: [...users] });
    }
    for (const e of Object.values(S)) { e.bufMB = +e.bufMB.toFixed(1); e.texMB = +e.texMB.toFixed(1); }
    shared.sort((a, b) => b.mb - a.mb);
    window.__systems = { systems: S, shared: shared.slice(0, 40), sharedMB: +shared.reduce((s, r) => s + r.mb, 0).toFixed(1) };
    window.__timings = marks;
    for (const o of gone) o.parent?.remove(o);
  };
})();
