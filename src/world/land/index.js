import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { TOWN } from '../../config.js';
import { DEER_PARK } from '../../data/town.js';
import { makeTimberFence } from '../buildings.js';

/* ------------------------------------------------------------------ *
 * The land north of the main road (town quality pass), where M2's old
 * town stood: paddies, the levee, the river, the bridge, the farm track
 * and the Deer Park gate.  Laid out by config.js TOWN.land, in the town's
 * own (turned) frame.
 *
 * PHASE 0 PLACEHOLDER: flat shapes that fix the layout, the colliders and
 * the walkable ground.  The river & paddies builder (docs/BUILDERS.md)
 * replaces the look; the rects, heights and the way across stay.
 * ------------------------------------------------------------------ */

const PLOT = { w: 22, d: 13, ridge: 0.9, ridgeH: 0.22 };

function box(x0, x1, y0, y1, z0, z1, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
}
function sheet(x0, x1, z0, z1, y, mat) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
}

export function buildLand(ctx) {
  const L = TOWN.land;
  const mat = {
    water: cel({ color: 0x9cc0cc, bands: 3, tint: 0x6a78a0 }),
    river: cel({ color: 0x6f9fb4, bands: 3, tint: 0x4a5a8a }),
    earth: cel({ color: 0x9c8a6a, bands: 3, tint: 0x6a5a78 }),
    grass: cel({ color: 0x9cc48f, bands: 3, tint: 0x5b6f8c }),
    concrete: cel({ color: 0xc9c6bc, bands: 3, tint: 0x6f6790 }),
    track: cel({ color: 0xb8a888, bands: 3, tint: 0x6f6790 }),
    wood: cel({ color: 0x7a5a42, bands: 3, tint: 0x4a3a58 }),
  };
  const tx0 = L.track.x - L.track.w / 2, tx1 = L.track.x + L.track.w / 2;

  /* ---- paddies: flooded plots in a grid of raised earth paths (畦道) ---- */
  const paddies = (r) => {
    const [x0, z0, x1, z1] = r;
    for (let z = z0; z < z1 - 3; z += PLOT.d + PLOT.ridge) {
      const zb = Math.min(z + PLOT.d, z1 - PLOT.ridge);
      for (let x = x0; x < x1 - 3; x += PLOT.w + PLOT.ridge) {
        const xb = Math.min(x + PLOT.w, x1 - PLOT.ridge);
        // the track runs through: no plot across it
        if (xb > tx0 - 0.5 && x < tx1 + 0.5 && z1 <= 0) {
          if (x < tx0 - 3) ctx.add(sheet(x + PLOT.ridge, tx0 - 0.5, z + PLOT.ridge, zb, 0.04, mat.water));
          if (xb > tx1 + 3) ctx.add(sheet(tx1 + 0.5, xb, z + PLOT.ridge, zb, 0.04, mat.water));
          continue;
        }
        ctx.add(sheet(x + PLOT.ridge, xb, z + PLOT.ridge, zb, 0.04, mat.water));
      }
    }
    // the earth under and between the plots, a little raised: the paths
    ctx.add(sheet(x0, x1, z0, z1, 0.02, mat.earth));
  };
  paddies(L.near);
  paddies(L.far);
  paddies(L.east);

  /* ---- the farm track, up from the main road's zebra ---- */
  ctx.add(sheet(tx0, tx1, L.track.z0, L.track.z1, 0.06, mat.track));

  /* ---- the levee (堤防) and the far bank ---- */
  const lv = L.levee;
  for (const [a, b] of [[-118, tx0], [tx1, 118]]) {
    ctx.add(box(a, b, 0, lv.top, lv.z0, lv.z1, mat.grass));
    ctx.collide(a, lv.z0, b, lv.z1, lv.top);
    ctx.add(box(a, b, 0, L.farBank.top, L.farBank.z0, L.farBank.z1, mat.grass));
    ctx.collide(a, L.farBank.z0, b, L.farBank.z1, L.farBank.top);
  }

  /* ---- the river: water you can't walk into ---- */
  ctx.add(sheet(-118, 118, L.river.z0, L.river.z1, 0.03, mat.river));
  for (const [a, b] of [[-118, L.bridge.x - L.bridge.w / 2], [L.bridge.x + L.bridge.w / 2, 118]]) {
    ctx.collide(a, L.river.z0, b, L.river.z1, 3);
  }

  /* ---- the bridge: a low concrete deck with rails ---- */
  const bx0 = L.bridge.x - L.bridge.w / 2, bx1 = L.bridge.x + L.bridge.w / 2;
  ctx.add(box(bx0, bx1, 0, 0.3, L.bridge.z0, L.bridge.z1, mat.concrete));
  ctx.platform({ x0: bx0, x1: bx1, z0: L.bridge.z0, z1: L.bridge.z1, top: 0.3 });
  for (const x of [bx0 + 0.1, bx1 - 0.1]) {
    ctx.add(box(x - 0.1, x + 0.1, 0.3, 1.1, L.river.z0, L.river.z1, mat.concrete));
    ctx.collide(x - 0.12, L.river.z0, x + 0.12, L.river.z1, 1.1);
  }

  /* ---- the Deer Park gate: closed, with its board ---- */
  const g = L.deerGate;
  for (const dx of [-2.2, 2.2]) {
    ctx.add(box(g.x + dx - 0.15, g.x + dx + 0.15, 0, 2.6, g.z - 0.15, g.z + 0.15, mat.wood));
  }
  ctx.add(box(g.x - 2.6, g.x + 2.6, 2.45, 2.7, g.z - 0.2, g.z + 0.2, mat.wood));
  ctx.add(makeTimberFence({ x: g.x, z: g.z, y: 0, len: 4.2, axis: 'x', h: 1.3 }));
  ctx.collide(g.x - 2.4, g.z - 0.3, g.x + 2.4, g.z + 0.3, 1.3);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), flat({ map: gateBoard() }));
  board.position.set(g.x, 1.75, g.z + 0.18);
  ctx.add(board);
}

/** The gate's board: 鹿公園 近日公開, and the English line under it. */
function gateBoard() {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = '#e9dcc0'; c.fillRect(0, 0, 512, 256);
  c.strokeStyle = '#6a4a32'; c.lineWidth = 12; c.strokeRect(6, 6, 500, 244);
  c.fillStyle = '#3a2a22'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `bold 84px 'Hiragino Mincho ProN', serif`;
  c.fillText(DEER_PARK.jp, 256, 82);
  c.font = `bold 44px 'Hiragino Kaku Gothic ProN', sans-serif`;
  c.fillStyle = '#b8402e';
  c.fillText(DEER_PARK.soon, 256, 156);
  c.font = `bold 30px 'Helvetica Neue', sans-serif`;
  c.fillStyle = '#3a2a22';
  c.fillText(DEER_PARK.en, 256, 214);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
