// Cenas reais gravadas do app (modo demo). O CSS esconde tudo que é número ou @ fictício da demo
// (contador, feed "fulano soltou", bilhete do lobby, etiqueta): o vídeo não mostra dado inventado como se fosse real.
const SEM_FICTICIO = `.lb-vivo, .contador, .feed, .lb-bil, .etq { display: none !important; }`;
const FPS = 30;
const js = (t, codigo) => ({ t, js: codigo });
const clica = (t, sel) => js(t, `document.querySelector(${JSON.stringify(sel)})?.click()`);
/** digita como gente: um caractere por vez, com ritmo um pouco irregular */
function digitar(t0, sel, texto, cps = 15) {
  const out = []; let t = t0;
  for (let i = 1; i <= [...texto].length; i++) {
    const parcial = [...texto].slice(0, i).join('');
    out.push(js(t, `{ const e = document.querySelector(${JSON.stringify(sel)}); if (e) { e.value = ${JSON.stringify(parcial)}; e.dispatchEvent(new Event('input', { bubbles: true })); } }`));
    t += (1 / cps) * (0.7 + ((i * 7919) % 10) / 16);
  }
  return out;
}
/** rolagem suave de um elemento (por quadro, com easing) */
function rolar(t0, t1, sel, ate) {
  const out = [], n = Math.max(1, Math.round((t1 - t0) * FPS));
  out.push(js(t0, `window.__r0 = document.querySelector(${JSON.stringify(sel)})?.scrollTop || 0`));
  for (let k = 1; k <= n; k++) { const p = k / n, e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2; out.push(js(t0 + k / FPS, `{ const el = document.querySelector(${JSON.stringify(sel)}); const alvo = ${typeof ate === 'number' ? ate : `(${ate})(el)`}; if (el) el.scrollTop = window.__r0 + (alvo - window.__r0) * ${e.toFixed(4)}; }`)); }
  return out;
}
const ateEl = (filho, folga = 20) => `(el) => { const f = el.querySelector(${JSON.stringify(filho)}); return f ? f.offsetTop - ${folga} : el.scrollTop; }`;
const FOLHA = '.folha';
const entrar = [0, 0.25, 0.5, 0.8].map((t) => clica(t, '.lb-ver'));
const DESEJO = 'casa própria e saúde pra minha mãe';
const FAIXA = 'CASA COMIGO, JU?';
// prepara a tela do link já preenchida (pras cenas que começam depois do desejo)
const preencher = (t) => [
  js(t, `{ const e = document.querySelector('.nota-ed textarea'); e.value = ${JSON.stringify(DESEJO)}; e.dispatchEvent(new Event('input', { bubbles: true })); }`),
];

export const CENAS = {
  teste: { url: '/?demo', css: SEM_FICTICIO, dur: 2, acoes: [clica(0, '.lb-ver')] },

  // lobby: o 2027 grande com lanternas subindo
  lobby: { url: '/?demo', css: SEM_FICTICIO, dur: 5, aquecer: 2500, acoes: [] },

  // céu cheio: entra no céu e deixa a câmera girar
  ceu: { url: '/?demo&hd', css: SEM_FICTICIO, dur: 8, aquecer: 2500, acoes: [...entrar] },
  // o mesmo céu sem a interface do app (fundo do gancho e das telas)
  ceulimpo: { url: '/?demo&hd', css: SEM_FICTICIO + ' .topo, .nav, .filtro { display: none !important; }', dur: 8, aquecer: 2500, acoes: [...entrar] },

  // link do direct: a folha sobe, rola até o desejo e digita
  escrever: {
    url: '/l/ABCDEFGH?demo', css: SEM_FICTICIO, dur: 7, aquecer: 150,
    acoes: [...rolar(1.6, 2.5, FOLHA, ateEl('.nota-ed', 120)), clica(2.6, '.nota-ed textarea'), ...digitar(2.8, '.nota-ed textarea', DESEJO, 16)],
  },

  // turbinar: abre, digita a faixa, escolhe a skin de coração e liga o rastro
  turbinar: {
    url: '/l/ABCDEFGH?demo', css: SEM_FICTICIO, dur: 7.5, aquecer: 900,
    acoes: [...preencher(0), ...rolar(0.1, 0.8, FOLHA, ateEl('.pv-abrir', 160)), clica(1.0, '.pv-abrir'),
      ...rolar(1.3, 2.0, FOLHA, ateEl('.pv', 40)), clica(2.1, '.pv-it .in'), ...digitar(2.3, '.pv-it .in', FAIXA, 12),
      ...rolar(4.0, 4.6, FOLHA, ateEl('.pv-sw', 230)), clica(4.8, '.sw.sk[data-k="coracao"]'),
      ...rolar(5.4, 6.0, FOLHA, ateEl('.pv-tg', 330)), clica(6.2, '.pv-tg')],
  },

  // a hora H: paga (Pix simulado da demo, cortado na edição) e a lanterna sobe com faixa, coração e rastro
  sobe: {
    url: '/l/ABCDEFGH?demo&hd', css: SEM_FICTICIO + ' .aviso { display: none !important; }', dur: 13.5, aquecer: 900,
    acoes: [...preencher(0), clica(0.02, '.pv-abrir'),
      js(0.05, `{ const e = document.querySelector('.pv-it .in'); e.value = ${JSON.stringify(FAIXA)}; e.dispatchEvent(new Event('input', { bubbles: true })); }`),
      clica(0.08, '.sw.sk[data-k="coracao"]'), clica(0.1, '.pv-tg'),
      clica(0.2, '.folha .btn.grande.ouro'), clica(0.5, '.folha.pix .btn.ouro'),
      // câmera fechada na lanterna (zoom do próprio céu: fov 62 → ~30)
      js(0.6, `document.querySelector('#gl').dispatchEvent(new WheelEvent('wheel', { deltaY: -520, bubbles: true }))`)],
  },

  // virada: abre a contagem e dispara o ensaio (10…1 e fogos)
  virada: {
    url: '/?demo&hd', css: SEM_FICTICIO, dur: 17, aquecer: 2500,
    acoes: [...entrar, clica(1.4, '.topo .cont'), clica(2.3, '.folha.virada .btn.ouro')],
  },
};
