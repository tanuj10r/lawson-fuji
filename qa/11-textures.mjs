// Which meshes use the biggest textures (production build: window.__scene is still there, QA-011).
//   node qa/11-textures.mjs
import { open, wait, writeJSON, ART } from './lib.mjs';
import path from 'node:path';

const s = await open({ name: '11-textures', autoplay: false });
try {
  await s.page.goto(process.env.QA_BASE || 'http://127.0.0.1:5180/');
  await s.page.waitForSelector('.overlay .menu-action', { timeout: 300000 });
  await wait(3000);
  const r = await s.page.evaluate(() => {
    const users = new Map();
    window.__scene.scene.traverse((o) => {
      for (const m of [o.material].flat().filter(Boolean)) for (const [k, v] of Object.entries(m)) {
        if (!v?.isTexture) continue;
        const e = users.get(v) ?? { w: v.image?.width ?? 0, h: v.image?.height ?? 0, mips: v.generateMipmaps, slots: new Set(), meshes: new Set() };
        e.slots.add(k); e.meshes.add(o.name || o.parent?.name || o.type);
        users.set(v, e);
      }
    });
    return [...users.values()].map((e) => ({ w: e.w, h: e.h, MB: Math.round(e.w * e.h * 4 * (e.mips ? 4 / 3 : 1) / 1048576 * 10) / 10, slots: [...e.slots], meshes: [...e.meshes].slice(0, 6), n: e.meshes.size }))
      .sort((a, b) => b.MB - a.MB).slice(0, 12);
  });
  writeJSON(path.join(ART, '11-textures', 'result.json'), r);
  for (const x of r) console.log(`${x.w}x${x.h} ${x.MB} MB  ${x.slots.join(',')}  used by ${x.n}: ${x.meshes.join(', ')}`);
} finally { await s.close(); }
