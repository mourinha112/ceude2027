// Folha de contato: N quadros de uma cena gravada (ou do vídeo final) lado a lado, pra revisar sem assistir.
// Uso: node video/folha.mjs <cena|arquivo.mp4> <saida.jpg> [n=8]
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = dirname(fileURLToPath(import.meta.url));
const [alvo, saida, n0] = process.argv.slice(2), n = Number(n0 || 8);
const ent = existsSync(alvo) ? alvo : resolve(AQUI, 'public', 'clipes', alvo + '.mp4');
const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', ent]).stdout.toString());
const ts = Array.from({ length: n }, (_, k) => ((k + 0.5) * dur) / n);
const args = ['-hide_banner', '-loglevel', 'error', '-y'];
for (const t of ts) args.push('-ss', t.toFixed(2), '-i', ent);
const f = ts.map((_, k) => `[${k}]scale=216:384,drawtext=text='${ts[k].toFixed(1)}s':x=6:y=6:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6[v${k}]`).join(';') + ';' + ts.map((_, k) => `[v${k}]`).join('') + `hstack=${n}`;
args.push('-filter_complex', f, '-frames:v', '1', saida);
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' }); process.exit(r.status ?? 1);
