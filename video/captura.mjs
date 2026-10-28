// Grava cenas REAIS do app (localhost:5310, modo demo) quadro a quadro, com o tempo virtual do Chrome:
// cada quadro avança exatos 1/30 s (timers, requestAnimationFrame, CSS e o céu 3D andam juntos), então sai liso mesmo sem GPU.
// Uso: node video/captura.mjs <cena> [<cena>...]   (cenas em video/cenas.mjs) → video/quadros/<cena>/*.jpg → video/public/clipes/<cena>.mp4
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CENAS } from './cenas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PW = process.env.PLAYWRIGHT_CORE || 'C:/Users/Mourinha/Documents/seumundonovo/video-studio/node_modules/playwright-core/index.mjs';
const { chromium } = await import(pathToFileURL(PW).href);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = 30, SITE = process.env.SITE || 'http://localhost:5310';

async function gravar(nome) {
  const c = CENAS[nome]; if (!c) throw new Error('cena desconhecida: ' + nome);
  const dir = resolve(AQUI, 'quadros', nome); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb'] });
  // celular: 405×720 css × 2,667 = 1080×1920
  const page = await browser.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 1080 / 405, isMobile: true, hasTouch: true });
  const erros = []; page.on('pageerror', (e) => erros.push(e.message));
  const cdp = await page.context().newCDPSession(page);
  if (c.css) await page.addInitScript((css) => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.append(s); }); }, c.css);
  await page.goto(SITE + c.url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  // tempo virtual: daqui pra frente o relógio da página só anda quando a gente manda
  const passo = (ms) => new Promise((ok) => { cdp.once('Emulation.virtualTimeBudgetExpired', ok); cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: ms }); });
  await passo(c.aquecer ?? 1500);
  const acoes = [...(c.acoes || [])].sort((a, b) => a.t - b.t);
  const total = Math.round(c.dur * FPS); const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = i / FPS;
    while (acoes.length && acoes[0].t <= t + 1e-6) { const a = acoes.shift(); await page.evaluate(a.js); }
    await passo(1000 / FPS);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
    writeFileSync(resolve(dir, String(i).padStart(5, '0') + '.jpg'), Buffer.from(shot.data, 'base64'));
    if (i % 30 === 0) process.stdout.write(`\r${nome}: ${i}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  await browser.close();
  mkdirSync(resolve(AQUI, 'public', 'clipes'), { recursive: true });
  const saida = resolve(AQUI, 'public', 'clipes', nome + '.mp4');
  const ff = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', resolve(dir, '%05d.jpg'), '-vf', 'scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-r', String(FPS), '-movflags', '+faststart', saida], { stdio: 'inherit' });
  console.log(`\r${nome}: ${total} quadros em ${((Date.now() - t0) / 1000).toFixed(0)}s → ${saida}${ff.status ? ' (ffmpeg falhou)' : ''}${erros.length ? '\n  erros na página: ' + erros.join(' | ') : ''}`);
}

for (const n of process.argv.slice(2)) await gravar(n);
