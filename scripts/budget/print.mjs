// node scripts/budget/print.mjs <report.json> [before.json]: a report of scripts/_budget.mjs as tables
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = process.argv[3] && !process.argv[3].startsWith('--') ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const pad = (v, n) => String(v).padStart(n);
console.log('load', JSON.stringify(r.load.marks), r.load.tier, 'lots', r.load.lots);
if (r.load.timings) console.log('build ms:', r.load.timings.map((a) => a.join(' ')).join(' | '));
if (r.systems) {
  const S = r.systems.systems;
  const rows = Object.entries(S).sort((x, y) => (y[1].texMB + y[1].bufMB) - (x[1].texMB + x[1].bufMB));
  console.log('\nsystem'.padEnd(35), 'meshes', '    tris', ' buf MB', ' tex MB', 'pics');
  for (const [k, e] of rows) console.log(k.padEnd(34), pad(e.meshes, 6), pad(e.tris, 8), pad(e.bufMB, 7), pad(e.texMB, 7), pad(e.tex, 4));
  const T = rows.reduce((s, [, e]) => { s.m += e.meshes; s.t += e.tris; s.b += e.bufMB; s.x += e.texMB; return s; }, { m: 0, t: 0, b: 0, x: 0 });
  console.log('total'.padEnd(34), pad(T.m, 6), pad(T.t, 8), pad(T.b.toFixed(1), 7), pad(T.x.toFixed(1), 7));
  console.log('\nshared pictures', r.systems.sharedMB, 'MB');
  for (const s of r.systems.shared.slice(0, 25)) console.log(' ', pad(s.mb, 6), s.size.padEnd(10), s.name.padEnd(14), s.users.join(', '));
}
const E = r.eval;
if (E?.places) {
  console.log('\nplace'.padEnd(25), ' GPU', ' tex', ' buf', '  rb', 'draws', '+shadow', '    tris', b ? '   | before: GPU draws' : '');
  for (const [k, p] of Object.entries(E.places)) {
    const q = b?.eval?.places?.[k];
    console.log(k.padEnd(24), pad(p.gpu, 4), pad(p.tex, 4), pad(p.buf, 4), pad(p.rb, 4), pad(p.calls, 5), pad(p.withShadow, 7), pad(p.tris, 8), q ? `   | ${pad(q.gpu, 4)} ${pad(q.calls, 5)}   (${pad(p.gpu - q.gpu, 4)} MB, ${pad(p.calls - q.calls, 5)} draws)` : '');
  }
  console.log('peak', E.peak, JSON.stringify(E.targets ?? ''), JSON.stringify(E.mergeStats ?? ''), JSON.stringify(E.lite ?? ''));
}
if (E?.onGpu && !process.argv.includes('--short')) for (const [k, g] of Object.entries(E.onGpu)) {
  console.log(`\n== on the GPU at ${k}: textures ${g.texMB} MB (scene's ${g.sceneTexMB}, targets and others ${g.otherTexMB}: ${g.otherTex.join(' ')}); far pages ${g.lodFar}, streamed out ${g.streamedOut}`);
  for (const t of g.tex) console.log('  ', pad(t[0], 5), t[1].padEnd(10), t[2].padEnd(14), t[3]);
  console.log('  buffers (CPU copies):', g.geoCpu.map((a) => `${a[0]} x${a[1]} ${a[2]}`).join(' · '));
}
if (r.errors) console.log('ERRORS', r.errors);
