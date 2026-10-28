// Trilha original sintetizada aqui (sem sample de ninguém = sem problema de direito autoral).
// 120 BPM (1 tempo = 15 quadros a 30 fps), os cortes do vídeo caem no tempo. Efeitos sincronizados com a edição.
// Uso: node video/trilha.mjs → video/public/trilha.wav
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPOS as T, DURACAO } from './tempos.mjs';

const SR = 44100, N = Math.ceil(DURACAO * SR), L = new Float32Array(N), R = new Float32Array(N);
let semente = 12345; const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
const f = (t) => Math.floor(t * SR);
const nota = (m) => 440 * 2 ** ((m - 69) / 12);
function soma(i, v, pan = 0) { if (i < 0 || i >= N) return; L[i] += v * (1 - Math.max(0, pan)); R[i] += v * (1 + Math.min(0, pan)); }

// --- instrumentos
function kick(t, g = 0.9) { for (let k = 0; k < SR * 0.35; k++) { const x = k / SR, fr = 48 + 110 * Math.exp(-x * 28); soma(f(t) + k, g * Math.sin(2 * Math.PI * fr * x * (1 + x)) * Math.exp(-x * 9)); } }
function palma(t, g = 0.22) { let lp = 0; for (let k = 0; k < SR * 0.18; k++) { const x = k / SR, n = rnd() * 2 - 1; lp += (n - lp) * 0.45; const e = Math.exp(-x * 22) * (x < 0.012 ? 0.6 : 1); soma(f(t) + k, g * (n - lp) * e, 0.1); } }
function chimbal(t, g = 0.06, pan = 0.3) { let hp = 0, prev = 0; for (let k = 0; k < SR * 0.05; k++) { const n = rnd() * 2 - 1; hp = 0.9 * (hp + n - prev); prev = n; soma(f(t) + k, g * hp * Math.exp(-k / SR * 70), pan); } }
function pad(t, dur, notas, g = 0.05) {
  for (const m of notas) for (const det of [-0.08, 0.08]) { const fr = nota(m) * 2 ** (det / 12), ph = rnd() * 6; for (let k = 0; k < SR * dur; k++) { const x = k / SR, env = Math.min(1, x / 0.35) * Math.min(1, (dur - x) / 0.5); soma(f(t) + k, g * env * (Math.sin(2 * Math.PI * fr * x + ph) * 0.7 + Math.sin(4 * Math.PI * fr * x + ph) * 0.12), det > 0 ? 0.35 : -0.35); } }
}
function sino(t, m, g = 0.08, pan = 0) { const fr = nota(m); for (let k = 0; k < SR * 1.2; k++) { const x = k / SR, e = Math.exp(-x * 4.5) * Math.min(1, x / 0.003); soma(f(t) + k, g * e * (Math.sin(2 * Math.PI * fr * x) + 0.35 * Math.sin(2 * Math.PI * fr * 2.76 * x) * Math.exp(-x * 6)), pan); } }
function baixo(t, dur, m, g = 0.16) { const fr = nota(m); for (let k = 0; k < SR * dur; k++) { const x = k / SR, e = Math.min(1, x / 0.01) * Math.exp(-x * 2.2) * Math.min(1, (dur - x) / 0.05); soma(f(t) + k, g * e * Math.tanh(2.2 * Math.sin(2 * Math.PI * fr * x))); } }
function subida(t0, t1, g = 0.18) { let lp = 0; const n = f(t1) - f(t0); for (let k = 0; k < n; k++) { const p = k / n, a = 0.02 + 0.55 * p * p; const nn = rnd() * 2 - 1; lp += (nn - lp) * a; soma(f(t0) + k, g * p * p * lp * 1.6, Math.sin(p * 9) * 0.3); } }
function impacto(t, g = 0.9) { kick(t, g); for (let k = 0; k < SR * 1.6; k++) { const x = k / SR; soma(f(t) + k, g * 0.35 * Math.sin(2 * Math.PI * 38 * x) * Math.exp(-x * 2.2)); } }
function whoosh(t, dur = 0.55, g = 0.3) { let lp = 0, bp = 0; const n = f(dur); for (let k = 0; k < n; k++) { const p = k / n, nn = rnd() * 2 - 1, a = 0.04 + 0.5 * Math.sin(Math.PI * p) ** 2; lp += (nn - lp) * a; bp += (lp - bp) * 0.2; soma(f(t) + k, g * Math.sin(Math.PI * p) ** 2 * (lp - bp) * 2, (p - 0.5) * 1.2); } }
function toque(t, g = 0.35) { for (let k = 0; k < SR * 0.03; k++) { const x = k / SR; soma(f(t) + k, g * Math.sin(2 * Math.PI * 1800 * x) * Math.exp(-x * 220) + g * 0.5 * (rnd() * 2 - 1) * Math.exp(-x * 400)); } }
function plim(t) { sino(t, 88, 0.16, -0.1); sino(t + 0.11, 93, 0.14, 0.1); }
function tique(t, g = 0.3) { for (let k = 0; k < SR * 0.08; k++) { const x = k / SR; soma(f(t) + k, g * Math.sin(2 * Math.PI * 1050 * x) * Math.exp(-x * 60)); } }
function estouro(t, g = 0.5, pan = 0) { impacto(t, g * 0.8); let lp = 0; for (let k = 0; k < SR * 1.4; k++) { const x = k / SR, nn = rnd() * 2 - 1; lp += (nn - lp) * 0.3; const crepita = rnd() < 0.004 * Math.exp(-x * 2) ? 1 : 0; soma(f(t) + k, g * (lp * 0.5 * Math.exp(-x * 5) + crepita * (rnd() - 0.5) * 3 * Math.exp(-x * 1.5)), pan); } }

// --- arranjo (tempo da música = tempo do vídeo)
const BEAT = 0.5, HARM = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]];   // Am7 · Fmaj7 · C · G (calor de fim de ano)
const BAIXO = [45, 41, 48, 43], ARP = [0, 2, 1, 3, 2, 1, 3, 2];
// gancho: pulso suave + subida até o 1º corte
pad(0, T.corte1, [57, 64, 69], 0.035);
for (let b = 0; b < T.corte1 / BEAT; b++) { kick(b * BEAT, 0.38); chimbal(b * BEAT + 0.25, 0.05); }   // pulso desde o 1º quadro
for (const t of T.teclas || []) toque(t, 0.18);   // cada letra digitada
subida(T.corte1 - 1.6, T.corte1, 0.16);
toque(T.toque, 0.55); whoosh(T.lanterna - 0.05, 0.8, 0.55);
impacto(T.corte1, 0.75);
// corpo: groove até a virada
for (let t = T.corte1, c = 0; t < T.pausa - 1e-6; t += BEAT * 4, c++) {
  const h = c % 4; pad(t, BEAT * 4 + 0.3, HARM[h], 0.032);
  for (let b = 0; b < 4; b++) {
    const tb = t + b * BEAT; if (tb >= T.pausa) break;
    kick(tb, 0.62); if (b % 2) palma(tb, 0.16); chimbal(tb + BEAT / 2, 0.05);
    if (tb >= T.sobe) { chimbal(tb + BEAT / 4, 0.035, -0.3); chimbal(tb + BEAT * 3 / 4, 0.035, 0.3); sino(tb, HARM[h][ARP[b * 2 % 8]] + 24, 0.022, 0.6); }   // a lanterna sobe: a música abre
    baixo(tb, BEAT * 0.9, BAIXO[h] - (b === 3 ? 0 : 0), 0.11);
    for (let e = 0; e < 2; e++) if (tb + e * BEAT / 2 < T.pausa) sino(tb + e * BEAT / 2, HARM[h][ARP[(b * 2 + e) % 8]] + 12, 0.035, e ? 0.4 : -0.4);
  }
}
plim(T.direct); plim(T.direct + 0.01);
for (const t of T.cortes) whoosh(t - 0.18, 0.4, 0.18);
subida(T.pausa - 2.5, T.pausa, 0.2);
// contagem: tudo para, só o tique e o pad segurando
pad(T.pausa, T.fogos - T.pausa, [57, 64, 69, 72], 0.03);
for (const t of T.contagem) { tique(t, 0.7); kick(t, 0.55); }
// virada: estouros e a música volta em festa
estouro(T.fogos, 0.75);
for (let k = 0; k < 14; k++) estouro(T.fogos + 0.35 + k * 0.33 + rnd() * 0.2, 0.22 + rnd() * 0.15, rnd() * 1.4 - 0.7);
for (let t = T.fogos, c = 0; t < DURACAO - 0.4; t += BEAT * 4, c++) {
  pad(t, BEAT * 4 + 0.3, HARM[(c + 2) % 4].map((m) => m + 0), 0.04);
  for (let b = 0; b < 4; b++) { const tb = t + b * BEAT; if (tb > DURACAO - 0.6) break; kick(tb, 0.7); if (b % 2) palma(tb, 0.18); for (let e = 0; e < 2; e++) sino(tb + e * 0.25, [76, 79, 81, 84][(b * 2 + e) % 4], 0.04, e ? 0.5 : -0.5); }
}
impacto(T.cta, 0.5);

// --- master: fade final, compressão leve, normaliza em -1 dBFS
const fadeIni = f(DURACAO - 1.1);
let pico = 0; for (let i = 0; i < N; i++) { const fd = i > fadeIni ? Math.max(0, 1 - (i - fadeIni) / (N - fadeIni)) : 1; L[i] = Math.tanh(L[i] * 1.15) * fd; R[i] = Math.tanh(R[i] * 1.15) * fd; pico = Math.max(pico, Math.abs(L[i]), Math.abs(R[i])); }
const ganho = 0.89 / (pico || 1);
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * ganho)) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * ganho)) * 32767), 46 + i * 4); }
const AQUI = dirname(fileURLToPath(import.meta.url)); mkdirSync(resolve(AQUI, 'public'), { recursive: true });
writeFileSync(resolve(AQUI, 'public', 'trilha.wav'), buf); console.log('trilha.wav', DURACAO + 's');
