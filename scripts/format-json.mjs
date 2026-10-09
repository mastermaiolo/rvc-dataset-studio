// Pretty-prints JSON with 2-space indent but keeps short arrays/objects of primitives on one line.
import fs from 'node:fs';
const isPrim = v => v === null || typeof v !== 'object';
const flat = v => Array.isArray(v) ? v.every(x => isPrim(x) || (Array.isArray(x) && x.every(isPrim))) : Object.values(v).every(isPrim);
function fmt(v, ind = '') {
  if (isPrim(v)) return JSON.stringify(v);
  const one = JSON.stringify(v).replace(/,(?=["[{\d-])/g, ', ').replace(/":/g, '": ');
  if (flat(v) && one.length + ind.length <= 110) return one;
  const nx = ind + '  ';
  if (Array.isArray(v)) return '[\n' + v.map(x => nx + fmt(x, nx)).join(',\n') + '\n' + ind + ']';
  return '{\n' + Object.entries(v).map(([k, x]) => nx + JSON.stringify(k) + ': ' + fmt(x, nx)).join(',\n') + '\n' + ind + '}';
}
for (const f of process.argv.slice(2)) fs.writeFileSync(f, fmt(JSON.parse(fs.readFileSync(f, 'utf8'))) + '\n');
