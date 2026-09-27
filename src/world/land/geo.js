import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { cel } from '../../core/toon.js';

/* ------------------------------------------------------------------ *
 * Geometry helpers for the land: everything is gathered per material and
 * baked into one mesh each at the end (few, large meshes), and the many
 * small things go into one InstancedMesh per kind.
 * ------------------------------------------------------------------ */

/** A flat sheet at height y, UVs in world metres / tile (so textures tile
 * seamlessly across every plot of a kind).  `rot`: swap u and v. */
export function sheetGeo(x0, x1, z0, z1, y, tile = 1, { rot = false, uTile = tile } = {}) {
  const g = new THREE.BufferGeometry();
  const P = [x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0];
  const uv = [];
  for (let i = 0; i < 4; i++) {
    const x = P[i * 3], z = P[i * 3 + 2];
    if (rot) uv.push(z / tile, x / uTile); else uv.push(x / uTile, z / tile);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

/** A quad through four corners (a slope, a face), UVs given per corner. */
export function quadGeo(a, b, c, d, uv = [0, 0, 1, 0, 1, 1, 0, 1]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** An axis-aligned box from its extents. */
export function boxGeo(x0, x1, y0, y1, z0, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

/**
 * A collector: geometry per named material, baked into one mesh each.
 * `mats` maps a name to a material; `add(name, geo)`.
 */
export function makeParts(mats) {
  const lists = new Map();
  return {
    mats,
    add(name, geo) {
      if (!lists.has(name)) lists.set(name, []);
      lists.get(name).push(geo);
      return geo;
    },
    box(name, x0, x1, y0, y1, z0, z1) { return this.add(name, boxGeo(x0, x1, y0, y1, z0, z1)); },
    /** Bake everything into `group`, one mesh per material. */
    build(group, { cast = [], noShadow = [] } = {}) {
      const out = {};
      for (const [name, geos] of lists) {
        const flat = geos.map((g) => {
          const n = g.index ? g.toNonIndexed() : g;
          for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
          if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
          if (!n.attributes.normal) n.computeVertexNormals();
          return n;
        });
        const geo = mergeGeometries(flat, false);
        const mesh = new THREE.Mesh(geo, mats[name]);
        mesh.name = 'land-' + name;
        mesh.castShadow = cast.includes(name);
        mesh.receiveShadow = !noShadow.includes(name);
        group.add(mesh);
        out[name] = mesh;
      }
      lists.clear();
      return out;
    },
  };
}

/* ------------------------------ instances ------------------------------ */

/** A tuft of blades (seedlings, weeds, flower leaves): 5 thin triangles. */
function tuftGeo() {
  const pos = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const lean = 0.35 + (i % 2) * 0.2;
    const w = 0.035;
    const cx = Math.cos(a), sz = Math.sin(a);
    const px = -sz * w, pz = cx * w;
    pos.push(px, 0, pz, -px, 0, -pz, cx * lean * 0.5, 1, sz * lean * 0.5);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A reed clump: tall blades leaning out, some broken over. */
function reedGeo() {
  const pos = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (i % 3) * 0.7;
    const r0 = 0.08 + (i % 2) * 0.06;
    const h = 0.75 + ((i * 37) % 10) / 10 * 0.6;
    const lean = 0.15 + ((i * 13) % 7) / 7 * 0.3;
    const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0;
    const w = 0.03;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean;
    pos.push(bx + px, 0, bz + pz, bx - px, 0, bz - pz, tx, h, tz);
    // a plume on every third one
    if (i % 3 === 0) pos.push(tx - 0.03, h - 0.02, tz, tx + 0.03, h - 0.02, tz, tx + Math.cos(a) * 0.12, h + 0.2, tz + Math.sin(a) * 0.12);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A flower head: a small flattened ball. */
function headGeo() {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(1, 0.7, 1);
  return g.toNonIndexed();
}

/** A river stone: a squashed, rounded lump. */
function stoneGeo() {
  const sp = new THREE.SphereGeometry(1, 8, 5);
  sp.deleteAttribute('uv');
  sp.deleteAttribute('normal');
  const g = mergeVertices(sp);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setY(i, y > 0 ? y * 0.55 : y * 0.3);
    p.setX(i, p.getX(i) * (1 + ((i * 7) % 5) * 0.03));
  }
  g.computeVertexNormals();
  return g;
}

/* `soft`: drawn after the opaque world without writing depth, so the ink
 * pass (which reads depth) draws no line round every blade and petal:
 * grass and flowers read as painted texture, not scribble.  `up`: normals
 * straight up, lit like the ground they grow from (no band noise). */
/** A lotus or lily pad: a flat disc with its notch. */
function padGeo() {
  const g = new THREE.CircleGeometry(1, 14, 0.25, Math.PI * 2 - 0.5);
  g.rotateX(-Math.PI / 2);
  return g;
}

const KINDS = {
  tuft: { geo: tuftGeo, color: 0xffffff, tint: 0x6a7a8a, side: THREE.DoubleSide, soft: true, up: true },
  reed: { geo: reedGeo, color: 0xffffff, tint: 0x7a7088, side: THREE.DoubleSide, up: true },
  head: { geo: headGeo, color: 0xffffff, tint: 0xb090b0, soft: true, up: true },
  stone: { geo: stoneGeo, color: 0xffffff, tint: 0x5e5a78, smooth: true },
  pad: { geo: padGeo, color: 0xffffff, tint: 0x5a7a70, up: true },
};

/** Instances of every small kind, gathered from all the land's parts, then
 * built as one InstancedMesh per kind. */
export function makeScatter() {
  const lists = { tuft: [], reed: [], head: [], stone: [], pad: [] };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  return {
    lists,
    /** kind, position, size (sx, sy, sz), yaw, colour, tilt */
    put(kind, x, y, z, sx, sy, sz, yaw, color, tilt = 0) {
      lists[kind].push({ x, y, z, sx, sy, sz, yaw, color, tilt });
    },
    build(group) {
      const out = {};
      const col = new THREE.Color();
      for (const [kind, list] of Object.entries(lists)) {
        if (!list.length) continue;
        const K = KINDS[kind];
        const mat = cel({
          color: K.color, bands: 3, tint: K.tint, side: K.side ?? THREE.FrontSide, cache: false, flat: !K.smooth,
          transparent: !!K.soft, depthWrite: K.soft ? false : null,
        });
        // one pass for both faces (a double-sided transparent draw is two)
        mat.forceSinglePass = true;
        const geo = K.geo();
        if (K.up) {
          const n = geo.attributes.normal;
          for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
        }
        const mesh = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((o, i) => {
          e.set(o.tilt, o.yaw, 0); q.setFromEuler(e);
          m.compose(p.set(o.x, o.y, o.z), q, s.set(o.sx, o.sy, o.sz));
          mesh.setMatrixAt(i, m);
          mesh.setColorAt(i, col.set(o.color));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.name = 'land-' + kind;
        mesh.userData.detail = true;
        group.add(mesh);
        out[kind] = mesh;
      }
      return out;
    },
  };
}
