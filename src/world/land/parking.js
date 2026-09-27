import * as THREE from 'three';
import { cel, flat } from '../../core/toon.js';
import { rngKit } from '../../core/util.js';
import { TOWN } from '../../config.js';
import { LAND_SIGNS } from '../../data/town.js';
import { asphaltTex, ASPHALT_TILE } from '../kit/tex.js';
import { parkVehicle } from '../vehicles.js';
import { sheetGeo } from './geo.js';
import { noticeTex } from './tex.js';

/* ------------------------------------------------------------------ *
 * Across the road from the spawn (Tan's layout): the old photographers'
 * lot is a monthly car park (月極駐車場), and straight past it the river.
 * Two rows of bays with wheel stops, a walkway kept clear down the spawn's
 * axis to the stairs, a few cars, the lot's board.
 * ------------------------------------------------------------------ */

export function buildParking(ctx, parts) {
  const [x0, z0, x1, z1] = TOWN.land.parking;
  const r = rngKit(4242);
  const asphalt = cel({ color: 0x8a8ea0, bands: 3, tint: 0x5a5480, map: asphaltTex() });
  const g = sheetGeo(x0, x1, z0, z1, 0.03, ASPHALT_TILE);
  const lot = new THREE.Mesh(g, asphalt);
  lot.receiveShadow = true;
  ctx.add(lot);

  // bays 2.5 m wide: one row backing onto the river walk, one onto the road
  const rows = [{ za: z0 + 0.4, zb: z0 + 5.4, stopZ: z0 + 1.0 }, { za: z1 - 5.2, zb: z1 - 0.2, stopZ: z1 - 0.8 }];
  const walk = (x) => Math.abs(x) < 1.9;          // the way to the stairs behind the spawn
  const bays = [];
  for (const row of rows) {
    for (let x = x0 + 1.2; x + 2.5 <= x1 - 0.8; x += 2.5) {
      if (walk(x) || walk(x + 2.5) || (x < 0 && x + 2.5 > 0)) continue;
      parts.box('white', x - 0.06, x + 0.06, 0.03, 0.045, row.za, row.zb);
      parts.box('white', x + 2.44, x + 2.56, 0.03, 0.045, row.za, row.zb);
      parts.box('granite', x + 0.45, x + 2.05, 0.03, 0.15, row.stopZ - 0.08, row.stopZ + 0.08);   // the wheel stop
      bays.push({ x: x + 1.25, z: (row.za + row.zb) / 2, back: row === rows[0] ? -1 : 1 });
    }
  }
  // the walkway: two white lines down the spawn's axis
  for (const x of [-1.6, 1.6]) parts.box('white', x - 0.06, x + 0.06, 0.03, 0.045, z0, z1);

  // a few cars, nosed in, in the colours of a country town
  const kinds = ['kei', 'kei', 'keivan', 'kei', 'wagon', 'sedan', 'kei', 'minivan'];
  const cols = [0xf2eee6, 0xd9665a, 0x9fc0dc, 0xa8d4b4, 0x3a3e48, 0xe8e2d4, 0xc8b89a, 0xf2eee6];
  const taken = new Set();
  for (let i = 0; i < kinds.length; i++) {
    let b;
    for (let k = 0; k < 20; k++) { b = bays[r.int(0, bays.length - 1)]; if (!taken.has(b)) break; }
    if (taken.has(b)) continue;
    taken.add(b);
    parkVehicle(ctx, { kind: kinds[i], x: b.x, z: b.z, y: 0.03, ry: b.back > 0 ? 0 : Math.PI, color: cols[i] });
  }

  // the lot's board, on a post at the road edge, by the bridge road
  {
    const px = x1 - 1.2, pz = z1 - 0.3;
    parts.box('post', px - 0.05, px + 0.05, 0, 1.9, pz - 0.05, pz + 0.05);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), flat({ map: noticeTex('parking', LAND_SIGNS.parking, { w: 256, h: 128, red: { line: 1, color: '#2f7a3a' } }) }));
    board.position.set(px, 1.6, pz + 0.06);
    board.userData.detail = true;
    ctx.add(board);
    ctx.collide(px - 0.12, pz - 0.12, px + 0.12, pz + 0.12, 1.9);
  }

}
