// Validates content/ against schema/ and checks cross-file rules:
// unique exercise ids, known tips, English text present, UI-locale coverage.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
for (const s of ['exercise', 'bank', 'langpack']) ajv.addSchema(read(`schema/${s}.schema.json`), `${s}.schema.json`);

/** Interface locales: every display string should exist in each of them (warning), and in English (error). */
const UI_LOCALES = fs.readdirSync(path.join(root, 'src/i18n')).filter(f => /^tips\..+\.json$/.test(f)).map(f => f.slice(5, -5));
const globalTips = new Set(Object.keys(read('src/i18n/tips.en.json')));
const files = ['content/bank/core.json', ...fs.readdirSync(path.join(root, 'content/langs')).sort().map(l => `content/langs/${l}/pack.json`)];
const ids = new Map();
let errors = 0, warnings = 0;
const err = m => { errors++; console.error('✗ ' + m); };
const warn = m => { warnings++; console.warn('! ' + m); };

function checkText(f, where, lt) {
  if (!lt) return;
  if (!lt.en) err(`${f}: ${where} has no English ("en") text`);
  for (const l of UI_LOCALES) if (!lt[l]) warn(`${f}: ${where} has no "${l}" text (falls back to English)`);
}

for (const f of files) {
  const data = read(f);
  const isPack = f.includes('/langs/');
  const validate = ajv.getSchema(isPack ? 'langpack.schema.json' : 'bank.schema.json');
  if (!validate(data)) {
    err(f);
    for (const e of validate.errors.slice(0, 20)) console.error(`   ${e.instancePath} ${e.message}`);
    continue;
  }
  if (isPack && path.basename(path.dirname(f)) !== data.id) err(`${f}: folder name must equal the pack id "${data.id}"`);
  const packTips = new Set(Object.keys(data.tips ?? {}));
  for (const [k, v] of Object.entries(data.tips ?? {})) checkText(f, `tip "${k}"`, v);
  if (isPack) checkText(f, 'name', data.name);
  for (const ex of data.exercises) {
    if (ids.has(ex.id)) err(`${f}: duplicate id "${ex.id}" (also in ${ids.get(ex.id)})`);
    ids.set(ex.id, f);
    if (!packTips.has(ex.tip) && !globalTips.has(ex.tip)) err(`${f}: unknown tip "${ex.tip}" in ${ex.id}`);
    for (const k of ['reg', 'emo', 'sub', 'title']) checkText(f, `${ex.id}.${k}`, ex[k]);
  }
  console.log(`✓ ${f} (${data.exercises.length} exercises)`);
}
for (const l of UI_LOCALES) {
  const keys = Object.keys(read(`src/i18n/tips.${l}.json`));
  const missing = [...globalTips].filter(k => !keys.includes(k));
  if (missing.length) err(`src/i18n/tips.${l}.json is missing: ${missing.join(', ')}`);
}
if (warnings) console.warn(`${warnings} warning(s).`);
if (errors) { console.error(`\n${errors} problem(s) found.`); process.exit(1); }
