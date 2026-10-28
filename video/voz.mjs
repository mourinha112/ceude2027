// Narração (ElevenLabs, voz "Ana Alice", gravada inteira de uma vez) cortada frase a frase e encaixada nos cortes.
// de/ate = trecho no arquivo da voz; em = segundo do vídeo em que a frase entra. Gera public/voz/NN.wav (cortes com fade curto).
// Uso: node video/voz.mjs
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALAS } from './falas.mjs';



{
  const AQUI = dirname(fileURLToPath(import.meta.url)), src = resolve(AQUI, 'public/voz/g1.mp3');
  FALAS.forEach(({ de, ate }, i) => {
    const a = Math.max(0, de - 0.06), d = ate + 0.1 - a;
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(a), '-t', String(d), '-i', src,
      '-af', `afade=t=in:d=0.02,afade=t=out:st=${(d - 0.06).toFixed(3)}:d=0.06,volume=4dB,alimiter=limit=0.89:level=false`, '-ar', '44100', '-ac', '2',
      resolve(AQUI, `public/voz/${String(i).padStart(2, '0')}.wav`)]);
  });
  console.log(FALAS.length, 'falas');
}
