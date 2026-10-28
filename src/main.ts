/* Céu de 2027 · site. Lê o céu do servidor (lanternas reais) e acompanha ao vivo.
   Rotas: /            lobby → céu
          /l/CODIGO    link pessoal do direct: escolher a lanterna (grátis ou paga) e soltar
          /@handle     voa até a lanterna da pessoa
   ?demo usa dados fictícios (sem servidor). */
import './estilo.css';
import { criarCeu, type Lanterna } from './ceu';
import { api, aparelho, type Compacta, type CeuResp } from './api';
import { cartaoStory } from './story';
import { CIDADES, DESEJOS, EMPRESAS, MARCA, faltam, fmt, handleFake, rnd, cidadeSorteada, type Tipo } from './dados';
import { CORES, SKINS, PRECO_VISUAL, FAIXA_MAX, precoVisual, novos, vazio, type Visual } from '../server/catalogo';

const $ = <E extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as E;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', txt?: string | number) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = String(txt); return e; }
function bt(cls: string, html: string, f: () => void) { const b = el('button', cls); b.type = 'button'; b.innerHTML = html; b.onclick = f; return b; }
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ok */ } } };
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dois = (n: number) => String(n).padStart(2, '0');
const SITE = location.origin;
const noTopo = (l: { forca: number }) => l.forca >= 2.95;   // o servidor manda força 3 enquanto o topo pago vale

/* ícones de traço (desenhados aqui, sem biblioteca) */
const ICO = {
  cidade: '<svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V10l4-3 4 3v11M13 21V6l3-2 3 2v15M8 13h2M8 16h2M16 9h1M16 12h1M16 15h1"/></svg>',
  presente: '<svg viewBox="0 0 24 24"><rect x="3.5" y="9" width="17" height="11.5" rx="1.5"/><path d="M2.5 9h19v3.5h-19zM12 9v11.5M12 9c-1.5-3.5-6-4-6-1.2C6 9.5 9.5 9 12 9zm0 0c1.5-3.5 6-4 6-1.2C18 9.5 14.5 9 12 9z"/></svg>',
  loja: '<svg viewBox="0 0 24 24"><path d="M4 9.5 5.4 4h13.2L20 9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.5V20h13v-7.5M10 20v-4.5h4V20"/></svg>',
  fogos: '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="2.2"/></svg>',
  lanterna: '<svg viewBox="0 0 24 24"><path d="M8 4.5h8l1.5 2.5-1 11H7.5l-1-11L8 4.5zM9.5 18v2.2M14.5 18v2.2M10 2.5h4"/><path d="M12 10.5c1.3 1.2 1.3 2.8 0 4-1.3-1.2-1.3-2.8 0-4z"/></svg>',
  coracao: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5V20h14v-7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ig: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9"/></svg>',
  copiar: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></svg>',
};

const ceu = criarCeu($('#gl') as HTMLCanvasElement);
const ui = $('#ui');
const DEMO = new URLSearchParams(location.search).has('demo');

/* ============ estado ============ */
let dadosCeu: CeuResp | null = null, total = 0, ultimo = 0, nCidades = 0;
const CID: string[] = [], CID_IDX = new Map<string, number>();
const cidIdx = (c: string) => { let i = CID_IDX.get(c); if (i === undefined) { i = CID.length; CID.push(c); CID_IDX.set(c, i); } return i; };
const nomeCid = (i: number) => { const [n, uf] = (CID[i] || 'Brasil').split('|'); return uf ? `${n}, ${uf}` : n; };
const soNome = (i: number) => (CID[i] || 'Brasil').split('|')[0];
function deCompacta(c: Compacta): Lanterna {
  const [id, handle, desejo, cidade, tipo, forca, par, de, emp, vis] = c;
  return { id, handle, desejo, cid: cidIdx(cidade), tipo: tipo as Tipo, forca, par: par || undefined, de: de || undefined, empresa: emp ? { nome: emp[0], ig: emp[1], oferta: emp[2], cor: emp[3] } : undefined,
    vis: vis ? { skin: vis[0] || undefined, cor: vis[1] || undefined, rastro: !!vis[2], faixa: vis[3] || undefined } : undefined };
}
function postUrl() { return dadosCeu?.post || `https://www.instagram.com/${MARCA.ig.slice(1)}/`; }

/* ============ LOBBY ============ */
const lobby = el('section', 'lobby');
{
  const fundo = el('div', 'lb-fundo');
  for (let i = 0; i < 24; i++) { const l = el('i', 'lb-l' + (i % 8 === 0 ? ' ouro' : '')); l.style.left = `${4 + rnd() * 92}%`; l.style.animationDelay = `${-rnd() * 16}s`; l.style.animationDuration = `${11 + rnd() * 9}s`; l.style.setProperty('--s', String(0.5 + rnd() * 0.9)); fundo.append(l); }
  const box = el('div', 'lb-box');
  const topoL = el('div', 'lb-topo'), vivo = el('span', 'lb-vivo');
  topoL.append(el('span', 'lb-marca', 'Céu de 2027'), vivo);
  const meio = el('div', 'lb-meio');
  const tit = el('h1', 'lb-tit'); tit.innerHTML = '<small>Céu de</small><b>2027</b><span class="lb-mao">solte seu<br>desejo</span>';
  const cont = el('p', 'lb-cont');
  // um bilhete de verdade do céu, trocando sozinho (só aparece quando já tem lanterna)
  const bil = el('figure', 'lb-bil'), bq = el('blockquote'), cap = el('figcaption'); bil.append(bq, cap); bil.hidden = true;
  meio.append(tit, el('p', 'lb-sub', 'Uma lanterna com o seu desejo no céu da sua cidade. À meia-noite do dia 31, todas viram fogos, ao mesmo tempo.'), cont, bil);
  const acoes = el('div', 'lb-acoes');
  acoes.append(bt('btn papel grande', `${ICO.lanterna}<span>Soltar minha lanterna</span>`, () => { entrarNoCeu(); setTimeout(comoSoltar, 700); }), bt('lb-ver', 'só quero ver o céu', () => entrarNoCeu()));
  const como = el('p', 'lb-como'); como.innerHTML = `É só <b>comentar sua cidade</b> no post do ${MARCA.ig}. Chega um <b>link no seu direct</b>: abrindo ele, você escolhe a lanterna, escreve o desejo e solta.`;
  box.append(topoL, meio, acoes, como);
  lobby.append(fundo, box);
  const pinta = () => {
    const f = faltam();
    cont.innerHTML = `faltam <b>${f.d}</b> dias <b class="rel">${dois(f.h)}:${dois(f.m)}:${dois(f.s)}</b>`;
    vivo.innerHTML = total ? `<i></i><b>${fmt(total)}</b> no céu` : '<i></i>abrindo o céu';
  };
  let ultBil = -1;
  const trocaBil = () => {
    if (!lobby.isConnected) return;
    const ok: number[] = []; ceu.L.forEach((l, i) => { if (l && l.tipo !== 2 && l.desejo && !l.desejo.includes('segredo')) ok.push(i); });
    if (!ok.length) { bil.hidden = true; return; }
    let i = ok[Math.floor(rnd() * ok.length)]; if (ok.length > 1 && i === ultBil) i = ok[(ok.indexOf(i) + 1) % ok.length]; ultBil = i;
    const l = ceu.L[i]!;
    const poe = () => { bq.textContent = l.desejo; cap.textContent = `@${l.handle}, ${soNome(l.cid)}`; bil.classList.remove('troca'); };
    if (bil.hidden) { bil.hidden = false; poe(); } else { bil.classList.add('troca'); setTimeout(poe, 380); }
  };
  pinta(); setInterval(pinta, 1000); setTimeout(trocaBil, 900); setInterval(trocaBil, 5200);
}
function entrarNoCeu() { if (!lobby.isConnected) return; lobby.classList.add('sai'); document.body.classList.add('no-ceu'); setTimeout(() => lobby.remove(), 900); }

/* ============ HUD ============ */
const topo = el('header', 'topo');
const marca = el('div', 'marca'); marca.textContent = 'Céu de 2027';
const cont = bt('cont', '', () => abrirVirada());
topo.append(marca, cont);
const contador = el('p', 'contador');
const feed = el('div', 'feed');
const filtroChip = bt('filtro', '', () => { ceu.filtrar(-1); filtroChip.hidden = true; }); filtroChip.hidden = true;
const nav = el('nav', 'nav');
nav.append(
  bt('nv', 'Cidades', () => abrirCidades()),
  bt('nv dot', 'Presente', () => abrirPresente()),
  bt('soltar', `${ICO.lanterna}<b>Soltar</b>`, () => comoSoltar()),
  bt('nv', 'Empresas', () => abrirEmpresas()),
  bt('nv', 'Virada', () => abrirVirada()),
);
ui.append(topo, contador, feed, filtroChip, nav);
const pintaHud = () => { const f = faltam(); cont.innerHTML = `<b>${f.d}d ${dois(f.h)}:${dois(f.m)}:${dois(f.s)}</b><small>pra virada</small>`; contador.innerHTML = `<i></i><b>${fmt(total)}</b> ${total === 1 ? 'lanterna' : 'lanternas'} no céu`; };
setInterval(pintaHud, 1000); pintaHud();

let avT = 0;
function aviso(txt: string, ms = 2800, cls = '') {
  document.querySelectorAll('.aviso').forEach((x) => x.remove());
  const a = el('div', 'aviso ' + cls, txt); ui.append(a);
  clearTimeout(avT); avT = window.setTimeout(() => { a.classList.add('sai'); setTimeout(() => a.remove(), 400); }, ms);
}
function noFeed(html: string) { const it = el('div', 'fd'); it.innerHTML = html; feed.prepend(it); while (feed.children.length > 3) feed.lastElementChild!.remove(); setTimeout(() => it.classList.add('velho'), 4500); }

/* ============ cartão da lanterna (bilhete) ============ */
const card = el('section', 'card'); card.hidden = true; ui.append(card);
const etq = el('div', 'etq'); etq.hidden = true; ui.append(etq);
let sel: number | null = null;
const TIPO_NOME = ['lanterna', 'dourada', 'empresa', 'de casal'];
function mostrar(i: number, mirar = true) {
  const l = ceu.L[i]; if (!l) return;
  sel = i; ceu.selecionar(i); if (mirar) ceu.mirar(i, 38);
  card.innerHTML = ''; card.className = 'card t' + l.tipo;
  card.append(bt('fx', ICO.x, fechar));
  if (l.tipo === 2 && l.empresa) {
    card.append(el('p', 'carimbo', 'patrocinado'), el('h2', 'cd-quem', l.empresa.nome));
    const n = el('blockquote', 'nota'); n.textContent = l.empresa.oferta; card.append(n);
    card.append(el('p', 'cd-cid', `${nomeCid(l.cid)}${l.empresa.ig ? ' · @' + l.empresa.ig : ''}`));
    if (l.empresa.ig) { const a = el('a', 'btn ouro grande', `Ver @${l.empresa.ig} no Instagram`) as HTMLAnchorElement; a.href = `https://www.instagram.com/${l.empresa.ig}/`; a.target = '_blank'; a.rel = 'noopener sponsored'; card.append(a); }
  } else {
    const meu = ls.get('c27_eu') === l.handle;
    card.append(el('p', 'carimbo', TIPO_NOME[l.tipo] + (meu ? ' · a sua' : '')));
    if (noTopo(l)) card.append(el('p', 'carimbo topo', `no topo do céu de ${soNome(l.cid)}`));
    const n = el('blockquote', 'nota'); n.textContent = l.desejo; card.append(n);
    if (l.vis?.faixa) card.append(el('p', 'cd-faixa', l.vis.faixa.toUpperCase()));
    const ass = el('p', 'cd-ass'); ass.textContent = '— @' + l.handle + (l.par ? ` & @${l.par}` : '');
    ass.append(el('span', '', `céu de ${nomeCid(l.cid)}${l.de ? ` · presente de @${l.de}` : ''}`)); card.append(ass);
    const ac = el('div', 'acoes');
    ac.append(
      bt('btn cheio', `${ICO.coracao}<span>Fortalecer</span>`, () => void fortalecer(i)),
      bt('btn linha', `${ICO.share}<span>Story</span>`, () => void story(l)),
      bt('btn linha', `${ICO.presente}<span>Presentear</span>`, () => abrirPresente(l.handle)),
    );
    card.append(ac);
    if (meu && dadosCeu?.pix.ativo) {   // no máximo duas ofertas, a mais forte primeiro
      const of: HTMLElement[] = [];
      of.push(bt('upsell', `<i class="pv-mini"></i><div><b>Personalizar a sua</b><small>faixa com frase, skin, cor, rastro de brilho</small></div><em>a partir de R$ ${reais(PRECO_VISUAL.cor)}</em>`, () => personalizar(i)));
      if (l.tipo === 0) of.push(bt('upsell leve', `<i class="mini-l d"></i><div><b>Deixar a sua dourada</b><small>maior, mais brilho, em destaque no céu</small></div><em>R$ ${preco('dourada')}</em>`, () => pagar({ tipo: 'dourada', handle: l.handle, desejo: '' })));
      if (!noTopo(l)) of.push(bt('upsell' + (of.length ? ' leve' : ''), `<i class="seta"></i><div><b>Colocar no topo do céu de ${esc(soNome(l.cid))}</b><small>acima de todas da cidade por 24 horas</small></div><em>R$ ${preco('topo')}</em>`, () => pagar({ tipo: 'topo', handle: l.handle, lanterna: String(l.id), desejo: '' }, l)));
      if (of.length < 2) of.push(bt('upsell leve', `<i class="mini-l"></i><div><b>Soltar pra família toda</b><small>4 douradas com o seu nome · sai R$ 3,73 cada</small></div><em>R$ ${preco('familia')}</em>`, () => abrirPresente('', true)));
      card.append(...of.slice(0, 2));
    }
  }
  card.hidden = false; etq.hidden = false; etq.textContent = l.tipo === 2 && l.empresa ? l.empresa.nome : '@' + l.handle;
}
function fechar() { sel = null; ceu.selecionar(null); card.hidden = true; etq.hidden = true; }
if (DEMO) (window as unknown as Record<string, unknown>).__mostrar = (t: number) => { const i = ceu.L.findIndex((l) => l && l.tipo === t); if (i >= 0) mostrar(i); };
ceu.aoTocar((i) => { if (i === null) { fechar(); return; } mostrar(i); });
ceu.aoPasso(() => { if (sel === null) return; const p = ceu.tela(sel); etq.style.transform = `translate(${p.x}px, ${p.y - 18}px) translate(-50%, -100%)`; etq.style.opacity = p.ok ? '1' : '0'; });
async function fortalecer(i: number) {
  const l = ceu.L[i]; if (!l) return;
  if (DEMO) { ceu.forca(i, Math.min(2.5, l.forca + 0.05)); aviso('💛 você fortaleceu essa lanterna'); return; }
  const r = await api.fortalecer(l.id, aparelho());
  if (!r.ok) { aviso(r.erro || 'não deu agora'); return; }
  ceu.forca(i, r.forca); aviso(`💛 você fortaleceu a lanterna de @${l.handle}: ela subiu um pouco`);
}
async function story(l: Lanterna) {
  aviso('preparando seu story…', 1500);
  const sk = SKINS.find((x) => x.k === l.vis?.skin), co = CORES.find((x) => x.k === l.vis?.cor);
  const r = await cartaoStory({ handle: l.handle, desejo: l.desejo, cidade: soNome(l.cid), tipo: l.tipo, site: SITE, faixa: l.vis?.faixa, cores: sk ? [sk.c2, sk.c1] : co ? [co.c, co.c] : undefined });
  if (r === 'baixado') aviso('imagem salva: poste no story e marque o perfil!', 3600);
}

/* ============ folhas (modais) ============ */
function folha(cls = '', aoFechar?: () => void) {
  document.querySelector('.modal')?.remove(); fechar();
  const fundo = el('div', 'modal'), cx = el('div', 'folha ' + cls);
  const fecharF = () => { aoFechar?.(); fundo.classList.add('sai'); setTimeout(() => fundo.remove(), 250); };
  fundo.onclick = (e) => { if (e.target === fundo) fecharF(); };
  cx.append(bt('fx', ICO.x, fecharF)); fundo.append(cx); ui.append(fundo);
  return { cx, fechar: fecharF };
}
const reais = (n: number) => n.toFixed(2).replace('.', ',');
const preco = (t: string) => (dadosCeu?.pix.precos[t] ?? ({ dourada: 4.9, casal: 7.9, presente: 4.9, familia: 14.9, topo: 9.9 } as Record<string, number>)[t]).toFixed(2).replace('.', ',');

/* ============ personalizar: faixa, skin, cor, rastro ============ */
const FUNDO_SKIN: Record<number, (a: string, b: string) => string> = {
  1: (a, b) => `repeating-linear-gradient(90deg, ${a} 0 5px, ${b} 5px 10px)`,
  2: (a, b) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='${a}' d='M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z'/></svg>`)}") 50% 55% / 72% no-repeat, ${b}`,
  3: (a, b) => `radial-gradient(${b} 0 1.6px, transparent 2px) 0 0 / 7px 7px, ${a}`,
  4: (a, b) => `radial-gradient(circle, #1a3a9e 0 22%, transparent 23%), conic-gradient(from 45deg at 50% 50%, ${b} 0 25%, transparent 0 50%, ${b} 0 75%, transparent 0) 50% 50% / 70% 70% no-repeat, ${a}`,
  5: () => 'linear-gradient(180deg, #ff6b6b, #ffd36b, #6bff9a, #6bc6ff, #b36bff)',
};
function fundoVis(v: Visual) {
  const sk = SKINS.find((x) => x.k === v.skin); if (sk) return FUNDO_SKIN[sk.pat](sk.c1, sk.c2);
  const co = CORES.find((x) => x.k === v.cor); return co ? co.c : '';
}
/** painel de escolha. ja = o que a lanterna já tem (não cobra de novo). aoMudar recebe o que foi escolhido e o preço disso */
function painelVisual(ja: Visual, aoMudar: (v: Visual, valor: number) => void) {
  const v: Visual = { ...ja };
  const box = el('div', 'pv');
  const prev = el('div', 'pv-prev'), pl = el('i', 'pv-l'), pfx = el('span', 'pv-fx'), prt = el('i', 'pv-rt');
  prev.append(prt, pl, pfx);
  const item = (nome: string, valor: number, tem: boolean) => { const d = el('div', 'pv-it'), c = el('div', 'pv-cab'); c.innerHTML = `<b>${nome}</b><em>${tem ? 'já é sua' : 'R$ ' + reais(valor)}</em>`; d.append(c); return d; };
  // faixa
  const iF = item('Faixa com frase', PRECO_VISUAL.faixa, !!ja.faixa);
  const fx = el('input', 'in'); fx.maxLength = FAIXA_MAX; fx.placeholder = 'ex.: CASA COMIGO, JU?'; fx.value = ja.faixa || '';
  fx.oninput = () => { v.faixa = fx.value.trim() || undefined; pinta(); };
  const sgF = el('div', 'sugs'); for (const t of ['FELIZ 2027', 'CASA COMIGO?', 'TE AMO MÃE', '2027 É NOSSO', 'FAMÍLIA UNIDA']) sgF.append(bt('sug', t, () => { fx.value = t; v.faixa = t; pinta(); }));
  iF.append(fx, sgF);
  // skin
  const iS = item('Skin', PRECO_VISUAL.skin, false), gS = el('div', 'pv-sw');
  for (const k of SKINS) { const b = bt('sw sk', `<i style="background:${FUNDO_SKIN[k.pat](k.c1, k.c2)}"></i><small>${k.n}</small>`, () => { v.skin = v.skin === k.k ? undefined : k.k; if (v.skin) v.cor = undefined; pinta(); }); b.dataset.k = k.k; gS.append(b); }
  iS.append(gS);
  // cor
  const iC = item('Cor lisa', PRECO_VISUAL.cor, false), gC = el('div', 'pv-sw cores');
  for (const k of CORES) { const b = bt('sw co', `<i style="background:${k.c}"></i><small>${k.n}</small>`, () => { v.cor = v.cor === k.k ? undefined : k.k; if (v.cor) v.skin = undefined; pinta(); }); b.dataset.k = k.k; gC.append(b); }
  iC.append(gC);
  // rastro
  const rt = bt('pv-tg', '', () => { if (ja.rastro) return; v.rastro = !v.rastro; pinta(); });
  const tot = el('p', 'pv-tot');
  box.append(prev, iF, iS, iC, rt, tot);
  const pinta = () => {
    gS.querySelectorAll<HTMLElement>('.sw').forEach((b) => { b.classList.toggle('on', b.dataset.k === v.skin); b.classList.toggle('tem', b.dataset.k === ja.skin); });
    gC.querySelectorAll<HTMLElement>('.sw').forEach((b) => { b.classList.toggle('on', b.dataset.k === v.cor); b.classList.toggle('tem', b.dataset.k === ja.cor); });
    rt.innerHTML = `<span><b>Rastro de brilho</b><small>faíscas atrás dela enquanto sobe</small></span><em>${ja.rastro ? 'já é sua' : 'R$ ' + reais(PRECO_VISUAL.rastro)}</em><i class="${v.rastro ? 'on' : ''}"></i>`;
    const f = fundoVis(v); pl.style.background = f; pl.classList.toggle('pers', !!f);
    pfx.textContent = (v.faixa || '').toUpperCase(); pfx.hidden = !v.faixa; prt.hidden = !v.rastro;
    const nv = novos(v, ja), valor = precoVisual(nv, ja), n = [nv.faixa, nv.skin || nv.cor, nv.rastro].filter(Boolean).length;
    tot.innerHTML = n >= 3 ? `3 itens juntos: <b>R$ ${reais(PRECO_VISUAL.desconto3)} de desconto</b>` : n ? `faltam ${3 - n} ${3 - n === 1 ? 'item' : 'itens'} pra ganhar R$ ${reais(PRECO_VISUAL.desconto3)} de desconto` : 'escolha o que quiser: tudo é opcional';
    aoMudar(nv, valor);
  };
  pinta();
  return box;
}
/** personalizar uma lanterna que já está no céu: a prévia aparece nela mesma, ao vivo */
function personalizar(i: number) {
  const l = ceu.L[i]; if (!l) return;
  if (!dadosCeu?.pix.ativo && !DEMO) { aviso('a personalização abre em breve ✨'); return; }
  const ja: Visual = { ...(l.vis || {}) }; let escolha: Visual = {}, valor = 0, pago = false;
  const { cx, fechar: f } = folha('personalizar', () => { if (!pago) ceu.vestir(i, ja); });
  cx.append(el('p', 'f-tag', `@${l.handle} · céu de ${soNome(l.cid)}`), el('h2', 'f-tit', 'Personalize sua lanterna'));
  const ok = el('button', 'btn ouro grande'); ok.type = 'button';
  cx.append(painelVisual(ja, (v, p) => {
    escolha = v; valor = p;
    ceu.vestir(i, { ...ja, ...v, ...(v.skin ? { cor: undefined } : v.cor ? { skin: undefined } : {}) });
    ok.disabled = vazio(v); ok.innerHTML = vazio(v) ? '<span>Escolha um item</span>' : `<span>Pagar R$ ${reais(p)} no Pix</span>`;
  }), ok);
  ceu.mirar(i, 30);
  ok.onclick = () => { if (vazio(escolha)) return; pago = true; void valor; f(); pagar({ tipo: 'personalizar', handle: l.handle, lanterna: String(l.id), desejo: '', visual: escolha }, l); };
}

/* como soltar (sem link): comentar no post */
function comoSoltar() {
  const { cx } = folha('como');
  cx.append(el('p', 'f-tag', 'como soltar a sua'), el('h2', 'f-tit', 'Comente sua cidade no post'));
  const ex = el('div', 'exemplo'); ex.innerHTML = '<small>comente assim</small><div class="ig-com"><i></i><p><b>seu_perfil</b>Recife 🏮</p></div><small class="ex-alt">quer já mandar o desejo? também vale: “Recife - casa própria”</small>'; cx.append(ex);
  const pas = el('ol', 'passos');
  for (const t of [`Abra o post do ${MARCA.ig} e comente o nome da sua cidade`, 'Em instantes chega no seu direct um link só seu (é só abrir, não precisa responder)', 'No link você escolhe a lanterna (grátis ou paga), escreve o desejo e solta']) pas.append(el('li', '', t));
  cx.append(pas);
  const a = el('a', 'btn ouro grande') as HTMLAnchorElement; a.href = postUrl(); a.target = '_blank'; a.rel = 'noopener'; a.className = 'btn ouro grande'; a.innerHTML = `${ICO.ig}<span>Comentar no Instagram</span>`; cx.append(a);
  cx.append(bt('btn linha grande', `${ICO.copiar}<span>Copiar o exemplo</span>`, async () => { try { await navigator.clipboard.writeText('Recife 🏮'); aviso('copiado! troque pela sua cidade'); } catch { aviso('Recife - casa própria'); } }));
  const busca = el('form', 'busca'); const inp = el('input'); inp.placeholder = 'já comentou? digite seu @'; inp.autocapitalize = 'none'; busca.append(inp, el('button', '', 'achar'));
  busca.onsubmit = (e) => { e.preventDefault(); void irPara(inp.value); };
  cx.append(busca);
}

/* ============ link pessoal do direct: escolher a lanterna ============ */
async function escolher(cod: string) {
  entrarNoCeu();
  const r = DEMO ? { ok: true, estado: 'pendente' as const, lanterna: [0, ls.get('c27_eu') || 'voce', '', 'Recife|PE', 0, 0, '', '', 0] as Compacta, oculto: false, pix: { ativo: true, precos: { dourada: 4.9, casal: 7.9, presente: 4.9, familia: 14.9, topo: 9.9 } } } : await api.link(cod);
  if (!r.ok) { aviso(r.erro || 'esse link não existe ou expirou', 4200); return; }
  const l = deCompacta(r.lanterna); ls.set('c27_eu', l.handle);
  if (r.estado === 'no_ceu') { await carregarCeu(); const i = ceu.indice(l.id); if (i >= 0) { mostrar(i); aviso('sua lanterna já está no céu ✨'); } return; }
  const pix = r.pix.ativo;
  const { cx, fechar: f } = folha('escolher');
  const semDesejo = r.oculto || !l.desejo;
  cx.append(el('p', 'f-tag', `@${l.handle} · céu de ${soNome(l.cid)}`), el('h2', 'f-tit', 'Sua lanterna pra 2027'));
  const nota = el('div', 'nota-ed'); const ta = el('textarea'); ta.maxLength = 90; ta.rows = 2; ta.value = r.oculto ? '' : l.desejo; ta.placeholder = 'escreva seu desejo pra 2027'; nota.append(el('small', '', semDesejo ? 'só aparece no céu quando você soltar' : 'veio do seu comentário · dá pra ajustar'), ta);
  const sg = el('div', 'sugs'); sg.hidden = !semDesejo; if (semDesejo) { for (const t of ['casa própria 🏠', 'saúde pra minha família', 'passar no concurso', 'emprego novo', 'viajar mais ✈️', 'que 2027 seja leve']) sg.append(bt('sug', esc(t), () => { ta.value = t; })); }
  let tipo = 'gratis' as 'gratis' | 'dourada' | 'casal' | 'familia';
  const ops = el('div', 'opcoes');
  const OP: [typeof tipo, string, string, string][] = [['gratis', 'Lanterna', 'grátis', 'sobe no céu da sua cidade'], ['dourada', 'Dourada', `R$ ${preco('dourada')}`, 'maior, brilha mais e fica em destaque'], ['casal', 'De casal', `R$ ${preco('casal')}`, 'duas lanternas que sobem juntas']];
  for (const [k, n, p, d] of OP) {
    const b = bt('op op-' + k, `${k === 'dourada' ? '<span class="fita">brilha mais</span>' : ''}<i class="mini-l"></i><b>${n}</b><em>${p}</em><small>${d}</small>`, () => { if (k !== 'gratis' && !pix) { aviso('as lanternas especiais abrem em breve ✨'); return; } tipo = k; pinta(); });
    b.dataset.k = k; if (k !== 'gratis' && !pix) b.classList.add('off'); ops.append(b);
  }
  const fam = bt('op-fam', `<span class="mini-l"></span><span class="mini-l d"></span><span class="mini-l"></span><span class="mini-l"></span><div><b>Família · 4 douradas</b><small>a sua + 3 pra quem você ama · sai R$ 3,73 cada</small></div><em>R$ ${preco('familia')}</em>`, () => { if (!pix) { aviso('as lanternas especiais abrem em breve ✨'); return; } tipo = 'familia'; pinta(); });
  fam.dataset.k = 'familia'; if (!pix) fam.classList.add('off');
  const par = el('input', 'in'); par.placeholder = '@ do seu amor'; par.autocapitalize = 'none'; par.hidden = true;
  const famBox = el('div', 'fam-box'); famBox.hidden = true;
  const famIn = [1, 2, 3].map((n) => { const i = el('input', 'in'); i.placeholder = `@ da pessoa ${n}${n > 1 ? ' (opcional)' : ''}`; i.autocapitalize = 'none'; famBox.append(i); return i; });
  famBox.append(el('p', 'f-nota', 'o mesmo desejo sobe nas 4, com o seu nome. Depois você manda o link pra cada um.'));
  const ok = el('button', 'btn grande'); ok.type = 'button';
  let extras: Visual = {}, vExtras = 0, pintaLink: (() => void) | undefined;
  const pvAbrir = bt('pv-abrir', '<span><b>Personalizar</b><small>faixa com frase, skin, cor e rastro de brilho</small></span><em>opcional</em>', () => { pvAbrir.hidden = true; pv.hidden = false; });
  const pv = painelVisual({}, (v, p) => { extras = v; vExtras = p; pintaLink?.(); }); pv.hidden = true;
  if (!pix) pvAbrir.hidden = true;
  const pinta = () => { ops.querySelectorAll<HTMLElement>('.op').forEach((b) => b.classList.toggle('on', b.dataset.k === tipo)); fam.classList.toggle('on', tipo === 'familia'); par.hidden = tipo !== 'casal'; famBox.hidden = tipo !== 'familia'; const total = (tipo === 'gratis' ? 0 : Number(preco(tipo).replace(',', '.'))) + vExtras; ok.className = 'btn grande ' + (total ? 'ouro' : 'papel escuro'); ok.innerHTML = total ? `<span>Pagar R$ ${reais(total)} no Pix e soltar</span>` : `${ICO.lanterna}<span>Soltar minha lanterna</span>`; }; pintaLink = pinta;
  ok.onclick = async () => {
    const d = ta.value.trim();
    if (d.length < 2) { aviso('escreva seu desejo'); ta.focus(); return; }
    if (tipo === 'gratis' && !vazio(extras)) { f(); pagar({ tipo: 'gratis', handle: l.handle, desejo: d, codigo: cod, visual: extras }, { ...l, desejo: d, tipo: 0, vis: extras }); return; }
    if (tipo === 'gratis') {
      ok.disabled = true;
      const s = DEMO ? { ok: true, id: 900000 + Math.floor(rnd() * 99999) } : await api.soltar(cod, d);
      ok.disabled = false;
      if (!s.ok) { aviso(s.erro || 'não deu agora, tenta de novo'); return; }
      f(); subir({ ...l, id: s.id, desejo: d });
    } else {
      const p = par.value.trim().replace(/^@+/, '');
      if (tipo === 'casal' && !p) { aviso('digite o @ da outra pessoa'); par.focus(); return; }
      if (tipo === 'familia') {
        const nomes = famIn.map((i) => i.value.trim().replace(/^@+/, '')).filter(Boolean);
        if (!nomes.length) { aviso('digite pelo menos um @'); famIn[0].focus(); return; }
        f(); pagar({ tipo, handle: l.handle, desejo: d, codigo: cod, nomes: nomes.join(','), visual: extras }, { ...l, desejo: d, tipo: 1, vis: vazio(extras) ? undefined : extras }); return;
      }
      f(); pagar({ tipo, handle: l.handle, par: p, desejo: d, codigo: cod, visual: extras }, { ...l, desejo: d, tipo: tipo === 'casal' ? 3 : 1, par: p || undefined, vis: vazio(extras) ? undefined : extras });
    }
  };
  cx.append(el('p', 'f-rot', '1 · escolha a sua lanterna'), ops, fam, par, famBox, el('p', 'f-rot', '2 · escreva seu desejo'), nota, sg, el('p', 'f-rot', '3 · deixe com a sua cara'), pvAbrir, pv, ok, el('p', 'f-nota', pix ? 'As pagas só mudam o visual da lanterna. Pix pelo Mercado Pago, cai na hora.' : 'Se você não escolher, ela sobe grátis sozinha em 24h.'));
  pinta();
}

/* a lanterna subindo na tela da pessoa (o momento do story) */
function subir(l: Lanterna) {
  const i = ceu.colocar(l, true, true); if (i < 0) return;
  ls.set('c27_eu', l.handle); total++; pintaHud();
  ceu.seguir(i); aviso('sua lanterna está subindo…', 3800, 'ouro');
  setTimeout(() => {
    ceu.pararSeguir(); mostrar(i, false);
    aviso(`ela está no céu de ${soNome(l.cid)} ✨ na virada vira fogos`, 4200, 'ouro');
  }, 8800);
}

/* ============ Pix (Mercado Pago) ============ */
async function pagar(b: Record<string, any>, previa?: Lanterna) {
  const { cx, fechar: f } = folha('pix');
  cx.append(el('p', 'f-tag', b.tipo === 'topo' ? 'topo do céu · 24 horas' : b.tipo === 'familia' ? 'pacote família · 4 douradas' : b.tipo === 'personalizar' ? 'personalização' : 'pagamento'), el('h2', 'f-tit', `Pix · R$ ${reais((b.tipo === 'gratis' || b.tipo === 'personalizar' ? 0 : Number(preco(b.tipo).replace(',', '.'))) + precoVisual(b.visual || {}, b.tipo === 'personalizar' ? previa?.vis || {} : {}))}`));
  const area = el('div', 'pix-area', 'gerando o Pix…'); cx.append(area);
  if (DEMO) {
    area.textContent = ''; area.append(el('div', 'qr-demo'), el('p', 'f-nota', 'demonstração: no site de verdade aparece o QR Code do Mercado Pago.'));
    cx.append(bt('btn ouro grande', 'Simular Pix pago', () => { f(); concluir(900000 + Math.floor(rnd() * 99999)); })); return;
  }
  const r = await api.pix(b);
  if (!r.ok) { area.textContent = r.erro || 'não consegui gerar o Pix'; return; }
  cx.querySelector('.f-tit')!.textContent = `Pix · R$ ${reais(r.valor)}`;   // o valor que vale é o do servidor
  area.textContent = '';
  const img = el('img', 'qr') as HTMLImageElement; img.src = 'data:image/png;base64,' + r.qr; img.alt = 'QR Code Pix';
  const copia = bt('btn linha grande', `${ICO.copiar}<span>Copiar código Pix</span>`, async () => { try { await navigator.clipboard.writeText(r.copia); aviso('código copiado: cole no app do seu banco'); } catch { aviso('não deu pra copiar'); } });
  const st = el('p', 'pix-st', 'aguardando o pagamento…');
  area.append(img, copia, st);
  const t0 = Date.now();
  const tk = setInterval(async () => {
    if (!cx.isConnected || Date.now() - t0 > 30 * 60_000) { clearInterval(tk); return; }
    const e = await api.pixEstado(r.id);
    if (e.ok && e.status === 'pago' && e.lanterna) { clearInterval(tk); f(); concluir(e.lanterna); }
    else if (e.ok && e.status && !['pendente', 'pago'].includes(e.status)) { clearInterval(tk); st.textContent = 'pagamento não aprovado. Tente de novo.'; }
  }, 3000);
  function concluir(id: number) {
    aviso('💸 Pix recebido!', 1500);
    if (b.tipo === 'personalizar') {   // veste a que já está no céu
      const i = ceu.indice(Number(b.lanterna)), ja = previa?.vis || {}, v = b.visual as Visual;
      if (i >= 0) { ceu.vestir(i, { ...ja, ...v, ...(v.skin ? { cor: undefined } : v.cor ? { skin: undefined } : {}) }); setTimeout(() => { ceu.mirar(i, 30); mostrar(i, false); aviso('sua lanterna está de cara nova ✨', 3600, 'ouro'); }, 700); }
      return;
    }
    if (b.tipo === 'topo') {   // não nasce lanterna nova: a dela sobe pro alto da cidade
      const i = ceu.indice(Number(b.lanterna));
      if (i >= 0) { ceu.forca(i, 3); setTimeout(() => { ceu.mirar(i, 46); mostrar(i, false); aviso(`sua lanterna está no topo do céu de ${soNome(ceu.L[i]!.cid)} pelas próximas 24h ✨`, 4600, 'ouro'); }, 900); }
      return;
    }
    const base: Lanterna = previa || { id, handle: b.tipo === 'presente' ? b.par : b.handle, desejo: b.desejo, cid: cidIdx(b.cidade || 'Brasil'), tipo: b.tipo === 'casal' ? 3 : b.tipo === 'gratis' ? 0 : 1, forca: 0.6, de: b.tipo === 'presente' ? b.handle : undefined };
    if (b.tipo === 'familia') {   // as da família aparecem em volta; o site recarrega o resto no ao vivo
      const nomes: string[] = String(b.nomes || '').split(',').filter(Boolean);
      if (previa) setTimeout(() => subir({ ...base, id, tipo: 1, forca: 0.6 }), 900);
      else nomes.forEach((n, k) => setTimeout(() => { ceu.colocar({ ...base, id: id + k + 1, handle: n, tipo: 1, forca: 0.5, de: n === b.handle ? undefined : b.handle }, true); }, 900 + k * 500));
      setTimeout(() => familiaEnviada(nomes, b.handle), previa ? 10_500 : 3500);
      return;
    }
    setTimeout(() => subir({ ...base, id, tipo: b.tipo === 'casal' ? 3 : b.tipo === 'gratis' ? 0 : 1, forca: b.tipo === 'gratis' ? 0 : 0.6 }), 900);
    if (b.tipo === 'presente') setTimeout(() => presenteEnviado(b.par, b.handle), 10_500);
  }
}
function familiaEnviada(nomes: string[], de: string) {
  const { cx } = folha('ok');
  cx.append(el('p', 'f-tag', 'pacote família'), el('h2', 'f-tit', 'As lanternas da família estão no céu'));
  cx.append(el('p', 'f-nota', 'Mande pra cada um ver a lanterna que você soltou:'));
  for (const n of nomes.filter((x) => x !== de)) {
    const link = `${SITE}/@${n}`;
    cx.append(bt('btn linha grande', `${ICO.share}<span>Enviar pra @${esc(n)}</span>`, async () => {
      const txt = `@${n}, soltei uma lanterna pra você no Céu de 2027 💛 olha ela: ${link}`;
      try { if (navigator.share) { await navigator.share({ text: txt, url: link }); return; } } catch { return; }
      try { await navigator.clipboard.writeText(txt); aviso('mensagem copiada: cole no direct'); } catch { aviso(link, 5000); }
    }));
  }
}
function presenteEnviado(para: string, de: string) {
  const { cx } = folha('ok');
  cx.append(el('p', 'f-tag', 'presente entregue'), el('h2', 'f-tit', `Sua lanterna pra @${para} está no céu`));
  cx.append(el('p', 'f-nota', 'Mande o link pra pessoa ver a lanterna que você soltou pra ela:'));
  const link = `${SITE}/@${para}`;
  cx.append(bt('btn ouro grande', `${ICO.share}<span>Enviar o link pra @${esc(para)}</span>`, async () => {
    const txt = `@${para}, soltei uma lanterna pra você no Céu de 2027 💛 olha ela: ${link}`;
    try { if (navigator.share) { await navigator.share({ text: txt, url: link }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(txt); aviso('mensagem copiada: cole no direct dela'); } catch { aviso(link, 5000); }
  }));
  void de;
}

/* ============ presente (pela página) ============ */
function abrirPresente(para = '', familia = false) {
  const { cx, fechar: f } = folha('presente-f');
  let modo = familia ? 'familia' : 'presente';
  const tag = el('p', 'f-tag'), tit = el('h2', 'f-tit');
  const modos = el('div', 'modos');
  const m1 = bt('modo', `<b>1 lanterna</b><span>R$ ${preco('presente')}</span>`, () => { modo = 'presente'; pinta(); });
  const m4 = bt('modo', `<b>Família · 4</b><span>R$ ${preco('familia')}</span><i>sai R$ 3,73 cada</i>`, () => { modo = 'familia'; pinta(); });
  modos.append(m1, m4);
  const de = el('input', 'in'); de.placeholder = 'seu @'; de.autocapitalize = 'none'; de.value = ls.get('c27_eu') || '';
  const pas = [1, 2, 3, 4].map((n) => { const i = el('input', 'in'); i.autocapitalize = 'none'; i.placeholder = n === 1 ? '@ de quem vai ganhar' : `@ da pessoa ${n} (opcional)`; return i; });
  pas[0].value = para;
  const ds = el('textarea', 'in'); ds.maxLength = 90; ds.rows = 2;
  const sc = el('select', 'in'); for (const c of CIDADES) { const o = el('option', '', `${c[0]} - ${c[1]}`); o.value = `${c[0]}|${c[1]}`; sc.append(o); }
  const sug = el('div', 'sugs'); for (const s of ['muita saúde e paz', 'que 2027 seja seu melhor ano', 'casa própria 🏠', 'muito amor 💛', 'família unida sempre']) sug.append(bt('sug', esc(s), () => { ds.value = s; }));
  const ok = el('button', 'btn ouro grande'); ok.type = 'button';
  const pinta = () => {
    const fm = modo === 'familia';
    m1.classList.toggle('on', !fm); m4.classList.toggle('on', fm);
    tag.textContent = fm ? 'pacote família · 4 lanternas douradas' : `R$ ${preco('presente')} · lanterna dourada`;
    tit.textContent = fm ? 'Solte pra família toda' : 'Solte uma lanterna pra alguém';
    pas.forEach((p, k) => { p.hidden = !fm && k > 0; if (k === 0) p.placeholder = fm ? '@ da pessoa 1 (pode ser você)' : '@ de quem vai ganhar'; });
    ds.placeholder = fm ? 'o desejo pra família (sobe nas 4)' : 'o desejo que você quer pra essa pessoa';
    ok.innerHTML = `<span>Pagar R$ ${preco(modo)} no Pix</span>`;
  };
  cx.append(tag, tit, modos, de, ...pas, ds, sug, sc);
  if (!dadosCeu?.pix.ativo && !DEMO) { cx.append(el('p', 'f-nota', 'os presentes abrem em breve ✨ siga o perfil pra saber primeiro.')); pinta(); return; }
  ok.onclick = () => {
    const h = de.value.trim().replace(/^@+/, ''), nomes = pas.filter((p) => !p.hidden).map((p) => p.value.trim().replace(/^@+/, '')).filter(Boolean), d = ds.value.trim(), [cid, uf] = sc.value.split('|');
    if (!h || !nomes.length) { aviso(modo === 'familia' ? 'preencha o seu @ e pelo menos um da família' : 'preencha os dois @'); return; }
    if (d.length < 2) { aviso('escreva o desejo'); return; }
    ls.set('c27_eu', h); f();
    if (modo === 'familia') pagar({ tipo: 'familia', handle: h, nomes: nomes.join(','), desejo: d, cidade: cid, uf });
    else pagar({ tipo: 'presente', handle: h, par: nomes[0], desejo: d, cidade: cid, uf });
  };
  cx.append(ok); pinta();
}

/* ============ cidades ============ */
function abrirCidades() {
  const { cx, fechar: f } = folha('lista');
  cx.append(el('p', 'f-tag', 'ranking'), el('h2', 'f-tit', 'O céu de cada cidade'));
  const lista = dadosCeu?.ranking?.length ? dadosCeu.ranking : [];
  if (!lista.length) { cx.append(el('p', 'f-nota', 'o céu ainda está começando: seja a primeira lanterna da sua cidade.')); return; }
  cx.append(bt('ci tudo', 'Ver o Brasil inteiro', () => { ceu.filtrar(-1); filtroChip.hidden = true; f(); }));
  const max = lista[0][2];
  lista.slice(0, 60).forEach(([n, uf, q], k) => {
    const chave = n + (uf ? '|' + uf : ''), b = bt('ci', '', () => { const i = CID_IDX.get(chave); if (i === undefined) { aviso('nenhuma lanterna dessa cidade carregada ainda'); return; } ceu.filtrar(i); filtroChip.hidden = false; filtroChip.innerHTML = `céu de <b>${esc(n)}</b> ${ICO.x}`; f(); });
    b.innerHTML = `<span class="p">${k + 1}</span><b>${esc(n)}${uf ? `, ${uf}` : ''}</b><span class="n">${fmt(q)}</span><i style="width:${(q / max) * 100}%"></i>`;
    cx.append(b);
  });
}

/* ============ empresas ============ */
function abrirEmpresas() {
  const { cx } = folha('empresas');
  cx.append(el('p', 'f-tag', 'para lojas e empresas'), el('h2', 'f-tit', 'Sua empresa no céu'));
  cx.append(el('p', 'f-nota', 'Uma lanterna turquesa com o nome, o @ e a oferta da sua loja no céu da sua cidade até a virada. Quem toca vê a oferta e vai pro seu Instagram.'));
  const pg = el('a', 'lb-ver') as HTMLAnchorElement; pg.href = '/empresas'; pg.textContent = 'ver como funciona em detalhes'; pg.style.cssText = 'display:block;padding:10px 0 0;color:inherit'; cx.append(pg);
  let pac = 'destaque';
  const ps = el('div', 'pacotes');
  for (const [k, n, p, d] of [['local', 'Local', 'R$ 49', '1 lanterna no céu da sua cidade'], ['destaque', 'Destaque', 'R$ 99', 'lanterna maior + aparece no ao vivo'], ['virada', 'Virada', 'R$ 199', 'lanterna + sua marca nos fogos da meia-noite']]) {
    const b = bt('pac', `<b>${n}</b><em>${p}</em><small>${d}</small>`, () => { pac = k; ps.querySelectorAll('.pac').forEach((x) => x.classList.toggle('on', x === b)); }); if (k === pac) b.classList.add('on'); ps.append(b);
  }
  const nome = el('input', 'in'); nome.placeholder = 'nome da empresa';
  const ig = el('input', 'in'); ig.placeholder = '@ da empresa'; ig.autocapitalize = 'none';
  const zap = el('input', 'in'); zap.placeholder = 'WhatsApp com DDD'; zap.inputMode = 'tel';
  const cid = el('input', 'in'); cid.placeholder = 'cidade';
  cx.append(ps, nome, ig, zap, cid, bt('btn ouro grande', '<span>Quero anunciar</span>', async () => {
    if (!nome.value.trim() || zap.value.replace(/\D/g, '').length < 10) { aviso('preencha o nome e o WhatsApp com DDD'); return; }
    const r = DEMO ? { ok: true } : await api.pedidoEmpresa({ nome: nome.value, ig: ig.value, zap: zap.value, cidade: cid.value, pacote: pac });
    if (!r.ok) { aviso((r as { erro?: string }).erro || 'não deu agora'); return; }
    cx.innerHTML = ''; cx.append(el('p', 'f-tag', 'pedido recebido'), el('h2', 'f-tit', 'A gente te chama no WhatsApp'), el('p', 'f-nota', 'Em breve entramos em contato pra montar a lanterna da sua empresa.'));
  }));
}

/* ============ virada ============ */
function abrirVirada() {
  const { cx, fechar: f } = folha('virada');
  const ft = faltam();
  cx.append(el('p', 'f-tag', '31 de dezembro · meia-noite (Brasília)'), el('h2', 'f-tit', 'A virada'));
  const c = el('div', 'v-cont'); c.innerHTML = `<b>${ft.d}</b><small>dias</small><b>${dois(ft.h)}</b><small>h</small><b>${dois(ft.m)}</b><small>min</small>`; cx.append(c);
  cx.append(el('p', 'f-nota', 'À meia-noite, todas as lanternas do Brasil viram fogos ao mesmo tempo, ao vivo. Depois, cada uma vira uma estrela que fica o ano inteiro.'));
  cx.append(bt('btn ouro grande', `${ICO.fogos}<span>Ver o ensaio da virada</span>`, () => { f(); ensaio(); }));
}
function ensaio() {
  fechar();
  const o = el('div', 'regressiva'); ui.append(o); let n = 10;
  const tick = () => {
    if (n > 0) { o.textContent = String(n); o.classList.remove('bate'); void o.offsetWidth; o.classList.add('bate'); n--; setTimeout(tick, 900); return; }
    o.remove(); ceu.virada();
    const fe = el('div', 'feliz'); fe.innerHTML = '<span>Feliz</span><b>2027</b>'; ui.append(fe);
    setTimeout(() => { fe.classList.add('sai'); setTimeout(() => fe.remove(), 800); }, 7000);
    if (navigator.vibrate) navigator.vibrate([80, 60, 120]);
  };
  tick();
}

/* ============ dados: céu do servidor + ao vivo ============ */
async function irPara(h: string) {
  const hd = h.trim().replace(/^@+/, '').toLowerCase(); if (!hd) return;
  document.querySelector('.modal')?.remove();
  const local = ceu.L.findIndex((l) => l && l.handle === hd);
  if (local >= 0) { mostrar(local); return; }
  if (DEMO) { aviso(`não achei @${hd}`); return; }
  const r = await api.porHandle(hd);
  if (!r.ok || !r.lanternas.length) { aviso(`@${hd} ainda não tem lanterna no céu`, 3200); return; }
  const i = ceu.colocar(deCompacta(r.lanternas[0])); if (i >= 0) mostrar(i);
}
async function carregarCeu() {
  if (dadosCeu || DEMO) return;
  const r = await api.ceu();
  if (!r.ok) { aviso('não consegui carregar o céu agora', 3000); return; }
  dadosCeu = r; total = r.total; nCidades = r.cidades; ultimo = r.ultimo;
  ceu.lote(() => { for (const c of r.lanternas.slice().reverse()) ceu.colocar(deCompacta(c)); });
  pintaHud();
}
async function aoVivoLoop() {
  if (!DEMO && dadosCeu && !document.hidden) {
    const r = await api.novas(ultimo);
    if (r.ok) {
      if (typeof r.total === 'number') total = r.total;
      for (const c of r.lanternas) {
        const l = deCompacta(c); if (ceu.indice(l.id) >= 0) continue;
        ceu.colocar(l, true);
        if (document.body.classList.contains('no-ceu')) noFeed(`<b>@${esc(l.handle)}</b> soltou uma lanterna em ${esc(soNome(l.cid))}`);
      }
      ultimo = Math.max(ultimo, r.ultimo || 0);
    }
  }
  setTimeout(aoVivoLoop, 7000);
}
function carregarDemo() {
  const lista: Compacta[] = [];
  for (let k = 0; k < 2600; k++) { const ci = cidadeSorteada(), t = rnd() < 0.04 ? 1 : rnd() < 0.012 ? 2 : rnd() < 0.04 ? 3 : 0, e = EMPRESAS[k % EMPRESAS.length]; lista.push([k + 1, t === 2 ? e.ig : handleFake(), t === 2 ? e.oferta : DESEJOS[Math.floor(rnd() * DESEJOS.length)], `${CIDADES[ci][0]}|${CIDADES[ci][1]}`, t, rnd() < 0.08 ? rnd() * 1.2 : rnd() * 0.25, t === 3 ? handleFake() : '', '', t === 2 ? [e.nome, e.ig, e.oferta, e.cor] : 0]); }
  const FXS = ['FELIZ 2027', 'CASA COMIGO, JU?', 'TE AMO MÃE', '2027 É NOSSO', 'FAMÍLIA SILVA', 'VAI DAR CERTO'];
  for (const c of lista) if (c[4] !== 2 && rnd() < 0.05) c[9] = [rnd() < 0.6 ? SKINS[Math.floor(rnd() * SKINS.length)].k : '', rnd() < 0.4 ? CORES[Math.floor(rnd() * CORES.length)].k : '', rnd() < 0.35 ? 1 : 0, rnd() < 0.45 ? FXS[Math.floor(rnd() * FXS.length)] : ''];
  ceu.lote(() => { for (const c of lista) ceu.colocar(deCompacta(c)); });
  total = 48_213; nCidades = 2049;
  const cont2 = new Map<string, number>(); for (const c of lista) cont2.set(c[3], (cont2.get(c[3]) || 0) + 1);
  dadosCeu = { ok: true, total, cidades: nCidades, ranking: [...cont2].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [c, uf] = k.split('|'); return [c, uf, n * 18]; }), lanternas: [], ultimo: 0, post: `https://www.instagram.com/${MARCA.ig.slice(1)}/`, pix: { ativo: true, precos: { dourada: 4.9, casal: 7.9, presente: 4.9, familia: 14.9, topo: 9.9 } }, virada: 0, ig: MARCA.ig };
  (function laco() { const ci = cidadeSorteada(), l: Lanterna = { id: 800000 + Math.floor(rnd() * 99999), handle: handleFake(), desejo: DESEJOS[Math.floor(rnd() * DESEJOS.length)], cid: cidIdx(`${CIDADES[ci][0]}|${CIDADES[ci][1]}`), tipo: rnd() < 0.08 ? 1 : 0, forca: rnd() * 0.3 }; ceu.colocar(l, true); total++; if (document.body.classList.contains('no-ceu')) noFeed(`<b>@${esc(l.handle)}</b> soltou uma lanterna em ${esc(soNome(l.cid))}`); setTimeout(laco, 2600 + rnd() * 2600); })();
}

/* ============ início ============ */
(async () => {
  if (DEMO) carregarDemo(); else await carregarCeu();
  void aoVivoLoop();
  const cam = location.pathname.match(/^\/l\/([A-Za-z0-9]{8})\/?$/), arroba = decodeURIComponent(location.pathname).match(/^\/@([\w.]{1,30})\/?$/);
  if (cam) void escolher(cam[1].toUpperCase());
  else if (arroba) { entrarNoCeu(); setTimeout(() => void irPara(arroba[1]), 600); }
  else ui.append(lobby);
  setTimeout(() => { $('#carrega')?.classList.add('some'); setTimeout(() => $('#carrega')?.remove(), 700); }, 400);
})();
