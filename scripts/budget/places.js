// scripts/_budget.mjs, in the page: the stops of Hachi's tour, each stood at and drawn (GPU MB as the page's own
// meter counts it, draws and triangles of the frame alone), and what is on the GPU at three of them.
(async () => {
  const M = window.__m;
  const quick = !!window.__budgetArg?.quick;
  const P = window.__budgetArg?.places ?? [
    ['famous view', 0, 16.5, 0, 0.16],
    ['konbini door', -2.3, 2.3, 0, 0.0],
    ['zebra, signals', -35, 20, 0.2, 0.05],
    ['Han, car park', -14, 21.5, 1.9, -0.02],
    ['mochi shop', 39.2, 12.5, 3.1416, 0.05],
    ['street mouth', 46.2, 4.2, 0, 0.03],
    ['street mid', 46.6, -34.3, -0.94, 0.02],
    ['donpen-do', 46.2, -39.4, -1.5708, 0.08],
    ['plaza', 50, -65.8, 0, 0.05],
    ['station entrance', 41.8, -76.8, -0.32, 0.1],
    ['plaza, looking back', 50, -84, 3.1416, 0.04],
    ['platform', 29, -97.5, -1.5708, 0.03, 'platform'],
    ['crossing', 80.6, -90.3, 0, 0.03, 'crossing'],
    ['crossing lane north', 80, -80, 3.1416, 0.03],
    ['lane to shrine', 20, -51.7, 1.5708, 0.03],
    ['shrine', -13, -49.8, 0, 0.09],
    ['shrine hall', -7.4, -63, 0.79, 0.13],
    ['shrine, looking out', -13.1, -64.5, 3.18, 0.03],
    ['pond gate', -50, -52.3, 1.5708, 0.03],
    ['bench', -73, -42.3, -0.01, 0.11],
    ['junction', -30, 6, 3.1416, 0.03],
    ['bridge', -30, 46, 3.1416, 0.0],
    ['gate bench', -30, 60, 3.1416, 0.03],
  ];
  const out = { places: {} };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const [name, x, z, yaw, pitch, train] of P) {
    M.goto({ x, z, yaw, pitch, look: 'golden', train });
    await wait(quick ? 250 : 450);
    const r = M.goto({ x, z, yaw, pitch });
    out.places[name] = { gpu: r.gpu, tex: r.tex, buf: r.buf, rb: r.rb, calls: r.calls, withShadow: r.withShadow, tris: r.tris };
  }
  out.peak = Math.round(M.meter.peak / 1048576);
  if (quick) return out;
  // what is on the GPU, by picture, at three stops
  const listAt = async (x, z, yaw, pitch) => {
    M.goto({ x, z, yaw, pitch }); await wait(600); M.goto({ x, z, yaw, pitch });
    const props = M.renderer.properties, gl = new Map(M.meter.textureList());
    const texs = new Map();
    const of = (m) => { const l = []; for (const v of Object.values(m)) if (v?.isTexture) l.push(v); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) l.push(u.value); return l; };
    M.scene.traverse((o) => {
      for (const m of [o.material].flat()) if (m) for (const t of of(m)) {
        if (!texs.has(t)) texs.set(t, new Set());
        let who = o.name || o.parent?.name || o.type;
        if (/^merged/.test(who)) who += `@${Math.round(o.position.x)},${Math.round(o.position.z)}`;
        texs.get(t).add(who);
      }
    });
    const rows = [], seen = new Set();
    let named = 0;
    for (const [t, users] of texs) {
      const h = props.get(t).__webglTexture;
      if (!h || seen.has(h)) continue;
      seen.add(h);
      const b = gl.get(h) ?? 0;
      named += b;
      rows.push([+(b / 1048576).toFixed(1), `${t.image?.width}x${t.image?.height}`, t.name || '', [...users].slice(0, 4).join('|')]);
    }
    rows.sort((a, b) => b[0] - a[0]);
    let other = 0; const others = [];
    for (const [h, b] of gl) if (!seen.has(h)) { other += b; others.push(+(b / 1048576).toFixed(1)); }
    others.sort((a, b) => b - a);
    // buffers by owner (their CPU copies' size: what the GPU holds of each)
    const geo = new Map(), gs = new Set();
    M.scene.traverse((o) => {
      const g = o.geometry; if (!g || gs.has(g)) return; gs.add(g);
      let b = 0; for (const a of Object.values(g.attributes)) b += a.array?.byteLength ?? 0; b += g.index?.array?.byteLength ?? 0;
      if (o.isInstancedMesh) b += o.instanceMatrix.array.byteLength + (o.instanceColor?.array.byteLength ?? 0);
      const k = (o.name || o.parent?.name || o.type).replace(/[-_]?\d+$/, '');
      const e = geo.get(k) ?? [0, 0]; e[0]++; e[1] += b / 1048576; geo.set(k, e);
    });
    return {
      texMB: Math.round(M.meter.textures / 1048576), sceneTexMB: Math.round(named / 1048576), otherTexMB: Math.round(other / 1048576), otherTex: others.slice(0, 14),
      tex: rows.slice(0, 40), lodFar: M.culler.lodFar, streamedOut: M.culler.out,
      geoCpu: [...geo].map(([k, e]) => [k, e[0], +e[1].toFixed(1)]).sort((a, b) => b[2] - a[2]).slice(0, 30),
    };
  };
  out.onGpu = { 'famous view': await listAt(0, 16.5, 0, 0.16), plaza: await listAt(50, -65.8, 0, 0.05), 'konbini door': await listAt(-2.3, 2.3, 0, 0) };
  out.mergeStats = globalThis.__mergeStats;
  out.lite = { siblings: M.lite.siblings, packed: M.lite.packed, atlasPages: M.lite.atlasPages, decals: M.lite.decals };
  out.targets = { scene: [M.pipeline.rtScene.width, M.pipeline.rtScene.height], scale: M.scale };
  return out;
})()
