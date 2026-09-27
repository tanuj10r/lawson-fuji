import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * Wall skins for facades (town quality pass), multiplied over a toon
 * material's colour and tiled in metres by the panel that carries them.
 *
 *   tileTex()   タイル貼り: the glazed facing tile of a 1970s shop building,
 *               1.2 m tile, 6 x 12 bricks with pale grout and a faint
 *               glaze variation.  128 px: it is seen from across the street.
 * ------------------------------------------------------------------ */

export const TILE_TILE = 1.2;
let tile = null;
export function tileTex() {
  if (tile) return tile;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 128);
  let a = 97;
  const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const rows = 12, cols = 6, rh = 128 / rows, cw = 128 / cols;
  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? cw / 2 : 0;
    for (let i = -1; i < cols; i++) {
      const x = i * cw + off;
      const v = 0.86 + r() * 0.14;
      c.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(252 * v)},${Math.round(250 * v)})`;
      c.fillRect(x + 1, j * rh + 1, cw - 2, rh - 2);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 1, j * rh + 1, cw - 2, 1.5);
    }
  }
  tile = new THREE.CanvasTexture(cv);
  tile.colorSpace = THREE.SRGBColorSpace;
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping;
  tile.anisotropy = 8;
  return tile;
}
