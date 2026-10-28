// Onde cada frase da narração entra (de/ate = trecho no arquivo da voz; em = segundo do vídeo). O voz.mjs corta, a edição posiciona.
import { TEMPOS as T } from './tempos.mjs';

export const FALAS = [
  { de: 0.0, ate: 3.65, em: 0.15 },                 // comenta o nome da sua cidade… e olha o que acontece!
  { de: 4.29, ate: 5.66, em: 4.1 },                 // chega um link no seu direct
  { de: 6.1, ate: 11.0, em: 5.75 },                 // você escreve seu desejo pra 2027. E é de graça!
  { de: 11.51, ate: 15.61, em: 11.25 },             // quer aparecer? bota uma faixa, uma skin, um brilho…
  { de: 16.28, ate: 18.32, em: 16.45 },             // e ela sobe no céu da sua cidade
  { de: 18.79, ate: 19.59, em: 20.95 },             // todo mundo vê!
  { de: 20.24, ate: 22.11, em: 25.0 },              // e o seu desejo fica lá até a virada
  { de: 22.84, ate: 26.06, em: T.ceu + 0.15 },      // cada cidade tem o seu céu. qual vai brilhar mais?
  { de: 29.34, ate: 29.83, em: T.contagem[0] },     // três
  { de: 30.18, ate: 30.73, em: T.contagem[1] },     // dois
  { de: 31.01, ate: 31.46, em: T.contagem[2] },     // um
  { de: 32.02, ate: 33.19, em: T.fogos + 0.2 },     // todas viram fogos!
  { de: 33.88, ate: 36.86, em: T.cta - 0.1 },       // comenta sua cidade aqui embaixo, e solta a sua!
];
