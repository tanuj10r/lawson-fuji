import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Shared forms for facades (town quality pass).
 *
 * chamferBox   a building's main volume with its four upright edges cut
 *              at 45 degrees: the cut catches its own cel band, so a
 *              corner reads as a made thing rather than a CG box edge.
 *              Centred like BoxGeometry, drop-in for it.
 * ------------------------------------------------------------------ */

const chamfers = new Map();
export function chamferBox(w, h, d, c = 0.07) {
  const key = [w, h, d, c].map((v) => v.toFixed(3)).join(':');
  if (chamfers.has(key)) return chamfers.get(key);
  const x = w / 2, z = d / 2;
  c = Math.min(c, x * 0.3, z * 0.3);
  const s = new THREE.Shape();
  s.moveTo(-x + c, -z);
  s.lineTo(x - c, -z);
  s.lineTo(x, -z + c);
  s.lineTo(x, z - c);
  s.lineTo(x - c, z);
  s.lineTo(-x + c, z);
  s.lineTo(-x, z - c);
  s.lineTo(-x, -z + c);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  // shape in (x, y) = (x, -z), extruded up: stand it on end, centre it
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h / 2, 0);
  // box-like UVs (metres), so a skin tiled in metres still lands right
  const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ny = Math.abs(nor.getY(i)), nx = Math.abs(nor.getX(i));
    uv.setXY(i, ny > 0.5 ? pos.getX(i) : nx > 0.7 ? pos.getZ(i) : pos.getX(i), ny > 0.5 ? pos.getZ(i) : pos.getY(i));
  }
  chamfers.set(key, g);
  return g;
}
