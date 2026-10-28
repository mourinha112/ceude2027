// Linha do tempo única (segundos) — a edição (src/) e a trilha (trilha.mjs) leem daqui, então som e corte não se desencontram.
// 120 BPM: cada tempo = 0,5 s = 15 quadros. Os cortes caem no tempo.
export const FPS = 30;
export const DURACAO = 40;
export const TEMPOS = {
  // gancho (0–4 s): texto já se mexendo no 1º quadro, comentário digitado, toque, lanterna dispara
  toque: 2.8, lanterna: 2.93, corte1: 4.0,
  // as 8 letras de "Recife 🏮" (o comentário entra em 0,55 s e digita a partir de 0,35 s dele, 4 quadros por letra;
  // o comentário pronto fica ~0,8 s na tela antes do toque)
  porLetra: 4,
  teclas: Array.from({ length: 8 }, (_, i) => 0.55 + 0.35 + (i * 4) / 30),
  // direct (4–5,5 s): notificação desce; a tela do link abre no 5,5
  direct: 4.2, link: 5.5,
  // cenas
  turbinar: 11.0, sobe: 16.0, ceu: 27.0,
  cortes: [5.5, 11.0, 16.0, 27.0],
  // virada: tudo para no 31, contagem 3·2·1, fogos
  pausa: 31.0, contagem: [31.0, 31.9, 32.8], fogos: 33.7,
  // chamada final
  cta: 37.0,
};
