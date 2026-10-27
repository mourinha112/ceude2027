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

const $ = <E extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as E;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', txt?: string | number) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = String(txt); return e; }
function bt(cls: string, html: string, f: () => void) { const b = el('button', cls); b.type = 'button'; b.innerHTML = html; b.onclick = f; return b; }
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ok */ } } };
const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dois = (n: number) => String(n).padStart(2, '0');
const SITE = location.origin;

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
  const [id, handle, desejo, cidade, tipo, forca, par, de, emp] = c;
  return { id, handle, desejo, cid: cidIdx(cidade), tipo: tipo as Tipo, forca, par: par || undefined, de: de || undefined, empresa: emp ? { nome: emp[0], ig: emp[1], oferta: emp[2], cor: emp[3] } : undefined };
}
function postUrl() { return dadosCeu?.post || `https://www.instagram.com/${MARCA.ig.slice(1)}/`; }

/* ============ LOBBY ============ */
const lobby = el('section', 'lobby');
{
  const fundo = el('div', 'lb-fundo');
  for (let i = 0; i < 24; i++) { const l = el('i', 'lb-l' + (i % 8 === 0 ? ' ouro' : '')); l.style.left = `${4 + rnd() * 92}%`; l.style.animationDelay = `${-rnd() * 16}s`; l.style.animationDuration = `${11 + rnd() * 9}s`; l.style.setProperty('--s', String(0.5 + rnd() * 0.9)); fundo.append(l); }
  const box = el('div', 'lb-box');
  box.append(el('p', 'lb-tag', 'até a virada · 31 de dezembro, meia-noite'));
  const tit = el('h1', 'lb-tit'); tit.innerHTML = '<span>Céu de</span><b>2027</b>'; box.append(tit);
  box.append(el('p', 'lb-sub', 'Solte uma lanterna com o seu desejo. À meia-noite do dia 31, todas viram fogos no céu do Brasil, ao mesmo tempo.'));
  const cont = el('div', 'lb-cont'); const c: Record<string, HTMLElement> = {};
  for (const [k, r] of [['d', 'dias'], ['h', 'horas'], ['m', 'min'], ['s', 'seg']]) { const d = el('div'); c[k] = el('b', '', '00'); d.append(c[k], el('small', '', r)); cont.append(d); }
  const nums = el('p', 'lb-nums');
  box.append(cont, nums);
  box.append(bt('btn ouro grande', `${ICO.lanterna}<span>Soltar minha lanterna</span>`, () => { entrarNoCeu(); setTimeout(comoSoltar, 700); }));
  box.append(bt('btn linha grande', 'Ver o céu agora', () => entrarNoCeu()));
  const pas = el('ol', 'lb-passos');
  for (const t of ['Comente o nome da sua cidade no post', 'Abra o link que chega no seu direct', 'Escreva seu desejo e veja sua lanterna subir']) pas.append(el('li', '', t));
  box.append(pas);
  lobby.append(fundo, box);
  const pinta = () => { const f = faltam(); c.d.textContent = String(f.d); c.h.textContent = dois(f.h); c.m.textContent = dois(f.m); c.s.textContent = dois(f.s); nums.innerHTML = total ? `<b>${fmt(total)}</b> ${total === 1 ? 'lanterna' : 'lanternas'} no céu · <b>${fmt(nCidades)}</b> ${nCidades === 1 ? 'cidade' : 'cidades'}` : 'seja uma das primeiras lanternas do céu'; };
  pinta(); setInterval(pinta, 1000);
}
function entrarNoCeu() { if (!lobby.isConnected) return; lobby.classList.add('sai'); document.body.classList.add('no-ceu'); setTimeout(() => lobby.remove(), 900); }

/* ============ HUD ============ */
const topo = el('header', 'topo');
const marca = el('div', 'marca'); marca.innerHTML = '<i>Céu de</i> 2027';
const cont = bt('cont', '', () => abrirVirada());
topo.append(marca, cont);
const contador = el('p', 'contador');
const feed = el('div', 'feed');
const filtroChip = bt('filtro', '', () => { ceu.filtrar(-1); filtroChip.hidden = true; }); filtroChip.hidden = true;
const nav = el('nav', 'nav');
nav.append(
  bt('nv', `${ICO.cidade}<small>Cidades</small>`, () => abrirCidades()),
  bt('nv', `${ICO.presente}<small>Presente</small>`, () => abrirPresente()),
  bt('soltar', `${ICO.lanterna}<b>Soltar</b>`, () => comoSoltar()),
  bt('nv', `${ICO.loja}<small>Empresas</small>`, () => abrirEmpresas()),
  bt('nv', `${ICO.fogos}<small>Virada</small>`, () => abrirVirada()),
);
ui.append(topo, contador, feed, filtroChip, nav);
const pintaHud = () => { const f = faltam(); cont.innerHTML = `<small>faltam</small> <b>${f.d}d ${dois(f.h)}:${dois(f.m)}:${dois(f.s)}</b>`; contador.innerHTML = `<i></i><b>${fmt(total)}</b> ${total === 1 ? 'lanterna' : 'lanternas'} no céu`; };
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
const TIPO_NOME = ['lanterna', 'lanterna dourada', 'lanterna de empresa', 'lanterna de casal'];
function mostrar(i: number, mirar = true) {
  const l = ceu.L[i]; if (!l) return;
  sel = i; ceu.selecionar(i); if (mirar) ceu.mirar(i, 38);
  card.innerHTML = ''; card.className = 'card t' + l.tipo;
  card.append(bt('fx', ICO.x, fechar));
  if (l.tipo === 2 && l.empresa) {
    card.append(el('p', 'cd-tipo', 'lanterna patrocinada'), el('h2', 'cd-quem', l.empresa.nome));
    const n = el('blockquote', 'nota'); n.textContent = l.empresa.oferta; card.append(n);
    card.append(el('p', 'cd-cid', `${nomeCid(l.cid)}${l.empresa.ig ? ' · @' + l.empresa.ig : ''}`));
    if (l.empresa.ig) { const a = el('a', 'btn ouro grande', `Ver @${l.empresa.ig} no Instagram`) as HTMLAnchorElement; a.href = `https://www.instagram.com/${l.empresa.ig}/`; a.target = '_blank'; a.rel = 'noopener sponsored'; card.append(a); }
  } else {
    const meu = ls.get('c27_eu') === l.handle;
    card.append(el('p', 'cd-tipo', TIPO_NOME[l.tipo] + (meu ? ' · a sua' : '') + (l.de ? ` · presente de @${l.de}` : '')));
    card.append(el('h2', 'cd-quem', '@' + l.handle + (l.par ? ` & @${l.par}` : '')));
    const n = el('blockquote', 'nota'); n.textContent = l.desejo; card.append(n);
    card.append(el('p', 'cd-cid', `céu de ${nomeCid(l.cid)}`));
    const ac = el('div', 'acoes');
    ac.append(
      bt('btn ouro', `${ICO.coracao}<span>Fortalecer</span>`, () => void fortalecer(i)),
      bt('btn linha', `${ICO.share}<span>Story</span>`, () => void story(l)),
      bt('btn linha', `${ICO.presente}<span>Presentear</span>`, () => abrirPresente(l.handle)),
    );
    card.append(ac);
    if (meu && l.tipo === 0 && dadosCeu?.pix.ativo) card.append(bt('virar-dourada', `deixar dourada · R$ ${preco('dourada')}`, () => pagar({ tipo: 'dourada', handle: l.handle, desejo: '' })));
  }
  card.hidden = false; etq.hidden = false; etq.textContent = l.tipo === 2 && l.empresa ? l.empresa.nome : '@' + l.handle;
}
function fechar() { sel = null; ceu.selecionar(null); card.hidden = true; etq.hidden = true; }
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
  const r = await cartaoStory({ handle: l.handle, desejo: l.desejo, cidade: soNome(l.cid), tipo: l.tipo, site: SITE });
  if (r === 'baixado') aviso('imagem salva: poste no story e marque o perfil!', 3600);
}

/* ============ folhas (modais) ============ */
function folha(cls = '') {
  document.querySelector('.modal')?.remove(); fechar();
  const fundo = el('div', 'modal'), cx = el('div', 'folha ' + cls);
  const fecharF = () => { fundo.classList.add('sai'); setTimeout(() => fundo.remove(), 250); };
  fundo.onclick = (e) => { if (e.target === fundo) fecharF(); };
  cx.append(bt('fx', ICO.x, fecharF)); fundo.append(cx); ui.append(fundo);
  return { cx, fechar: fecharF };
}
const preco = (t: string) => (dadosCeu?.pix.precos[t] ?? ({ dourada: 4.9, casal: 7.9, presente: 4.9 } as Record<string, number>)[t]).toFixed(2).replace('.', ',');

/* como soltar (sem link): comentar no post */
function comoSoltar() {
  const { cx } = folha('como');
  cx.append(el('p', 'f-tag', 'como soltar a sua'), el('h2', 'f-tit', 'Comente sua cidade no post'));
  const ex = el('div', 'exemplo'); ex.innerHTML = '<small>exemplo de comentário</small><p>Recife 🏮</p><small class="ex-alt">quer escrever o desejo ali mesmo? também vale: “Recife - casa própria”</small>'; cx.append(ex);
  const pas = el('ol', 'passos');
  for (const t of [`Abra o post do ${MARCA.ig} e comente o nome da sua cidade`, 'Em instantes chega um link só seu no direct', 'Lá você escreve seu desejo, escolhe a lanterna e solta']) pas.append(el('li', '', t));
  cx.append(pas);
  const a = el('a', 'btn ouro grande') as HTMLAnchorElement; a.href = postUrl(); a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = `${ICO.ig}<span>Comentar no Instagram</span>`; cx.append(a);
  cx.append(bt('btn linha grande', `${ICO.copiar}<span>Copiar o exemplo</span>`, async () => { try { await navigator.clipboard.writeText('Recife 🏮'); aviso('copiado! troque pela sua cidade'); } catch { aviso('Recife - casa própria'); } }));
  const busca = el('form', 'busca'); const inp = el('input'); inp.placeholder = 'já comentou? digite seu @'; inp.autocapitalize = 'none'; busca.append(inp, el('button', '', 'achar'));
  busca.onsubmit = (e) => { e.preventDefault(); void irPara(inp.value); };
  cx.append(busca);
}

/* ============ link pessoal do direct: escolher a lanterna ============ */
async function escolher(cod: string) {
  entrarNoCeu();
  const r = DEMO ? { ok: true, estado: 'pendente' as const, lanterna: [0, ls.get('c27_eu') || 'voce', '', 'Recife|PE', 0, 0, '', '', 0] as Compacta, oculto: false, pix: { ativo: true, precos: { dourada: 4.9, casal: 7.9, presente: 4.9 } } } : await api.link(cod);
  if (!r.ok) { aviso(r.erro || 'esse link não existe ou expirou', 4200); return; }
  const l = deCompacta(r.lanterna); ls.set('c27_eu', l.handle);
  if (r.estado === 'no_ceu') { await carregarCeu(); const i = ceu.indice(l.id); if (i >= 0) { mostrar(i); aviso('sua lanterna já está no céu ✨'); } return; }
  const pix = r.pix.ativo;
  const { cx, fechar: f } = folha('escolher');
  const semDesejo = r.oculto || !l.desejo;
  cx.append(el('p', 'f-tag', `@${l.handle} · céu de ${soNome(l.cid)}`), el('h2', 'f-tit', semDesejo ? 'Escreva seu desejo pra 2027' : 'Seu desejo está pronto pra subir'));
  const nota = el('div', 'nota-ed'); const ta = el('textarea'); ta.maxLength = 90; ta.rows = 2; ta.value = r.oculto ? '' : l.desejo; ta.placeholder = 'escreva seu desejo pra 2027'; nota.append(el('small', '', semDesejo ? 'seu desejo · só aparece no céu quando você soltar' : 'seu desejo (dá pra ajustar)'), ta); cx.append(nota);
  if (semDesejo) { const sg = el('div', 'sugs'); for (const t of ['casa própria 🏠', 'saúde pra minha família', 'passar no concurso', 'emprego novo', 'viajar mais ✈️', 'que 2027 seja leve']) sg.append(bt('sug', esc(t), () => { ta.value = t; })); cx.append(sg); setTimeout(() => ta.focus(), 400); }
  let tipo = 'gratis' as 'gratis' | 'dourada' | 'casal';
  const ops = el('div', 'opcoes');
  const OP: [typeof tipo, string, string, string][] = [['gratis', 'Lanterna', 'grátis', 'sobe no céu da sua cidade'], ['dourada', 'Dourada', `R$ ${preco('dourada')}`, 'maior, mais brilho e em destaque'], ['casal', 'De casal', `R$ ${preco('casal')}`, 'duas lanternas que sobem juntas']];
  for (const [k, n, p, d] of OP) {
    const b = bt('op op-' + k, `<i class="mini-l"></i><b>${n}</b><em>${p}</em><small>${d}</small>`, () => { if (k !== 'gratis' && !pix) { aviso('as lanternas especiais abrem em breve ✨'); return; } tipo = k; pinta(); });
    b.dataset.k = k; if (k !== 'gratis' && !pix) b.classList.add('off'); ops.append(b);
  }
  const par = el('input', 'in'); par.placeholder = '@ do seu amor'; par.autocapitalize = 'none'; par.hidden = true;
  const ok = el('button', 'btn ouro grande'); ok.type = 'button';
  const pinta = () => { ops.querySelectorAll<HTMLElement>('.op').forEach((b) => b.classList.toggle('on', b.dataset.k === tipo)); par.hidden = tipo !== 'casal'; ok.innerHTML = tipo === 'gratis' ? `${ICO.lanterna}<span>Soltar minha lanterna</span>` : `<span>Pagar R$ ${preco(tipo)} no Pix e soltar</span>`; };
  ok.onclick = async () => {
    const d = ta.value.trim();
    if (d.length < 2) { aviso('escreva seu desejo'); ta.focus(); return; }
    if (tipo === 'gratis') {
      ok.disabled = true;
      const s = DEMO ? { ok: true, id: 900000 + Math.floor(rnd() * 99999) } : await api.soltar(cod, d);
      ok.disabled = false;
      if (!s.ok) { aviso(s.erro || 'não deu agora, tenta de novo'); return; }
      f(); subir({ ...l, id: s.id, desejo: d });
    } else {
      const p = par.value.trim().replace(/^@+/, '');
      if (tipo === 'casal' && !p) { aviso('digite o @ da outra pessoa'); par.focus(); return; }
      f(); pagar({ tipo, handle: l.handle, par: p, desejo: d, codigo: cod }, { ...l, desejo: d, tipo: tipo === 'casal' ? 3 : 1, par: p || undefined });
    }
  };
  cx.append(el('p', 'f-rot', 'escolha a sua lanterna'), ops, par, ok, el('p', 'f-nota', pix ? 'pagar só muda o visual da lanterna. Pix pelo Mercado Pago.' : 'se você não escolher, ela sobe grátis sozinha em 24h.'));
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
async function pagar(b: Record<string, string>, previa?: Lanterna) {
  const { cx, fechar: f } = folha('pix');
  cx.append(el('p', 'f-tag', 'pagamento'), el('h2', 'f-tit', `Pix · R$ ${preco(b.tipo)}`));
  const area = el('div', 'pix-area', 'gerando o Pix…'); cx.append(area);
  if (DEMO) {
    area.textContent = ''; area.append(el('div', 'qr-demo'), el('p', 'f-nota', 'demonstração: no site de verdade aparece o QR Code do Mercado Pago.'));
    cx.append(bt('btn ouro grande', 'Simular Pix pago', () => { f(); concluir(900000 + Math.floor(rnd() * 99999)); })); return;
  }
  const r = await api.pix(b);
  if (!r.ok) { area.textContent = r.erro || 'não consegui gerar o Pix'; return; }
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
    const base: Lanterna = previa || { id, handle: b.tipo === 'presente' ? b.par : b.handle, desejo: b.desejo, cid: cidIdx(b.cidade || 'Brasil'), tipo: b.tipo === 'casal' ? 3 : 1, forca: 0.6, de: b.tipo === 'presente' ? b.handle : undefined };
    setTimeout(() => subir({ ...base, id, tipo: b.tipo === 'casal' ? 3 : 1, forca: 0.6 }), 900);
    if (b.tipo === 'presente') setTimeout(() => presenteEnviado(b.par, b.handle), 10_500);
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
function abrirPresente(para = '') {
  const { cx, fechar: f } = folha('presente-f');
  cx.append(el('p', 'f-tag', `R$ ${preco('presente')} · lanterna dourada`), el('h2', 'f-tit', 'Solte uma lanterna pra alguém'));
  const de = el('input', 'in'); de.placeholder = 'seu @'; de.autocapitalize = 'none'; de.value = ls.get('c27_eu') || '';
  const pa = el('input', 'in'); pa.placeholder = '@ de quem vai ganhar'; pa.autocapitalize = 'none'; pa.value = para;
  const ds = el('textarea', 'in'); ds.maxLength = 90; ds.rows = 2; ds.placeholder = 'o desejo que você quer pra essa pessoa';
  const sc = el('select', 'in'); for (const c of CIDADES) { const o = el('option', '', `${c[0]} - ${c[1]}`); o.value = `${c[0]}|${c[1]}`; sc.append(o); }
  const sug = el('div', 'sugs'); for (const s of ['muita saúde e paz', 'que 2027 seja seu melhor ano', 'casa própria 🏠', 'muito amor 💛', 'passar no concurso']) sug.append(bt('sug', esc(s), () => { ds.value = s; }));
  cx.append(de, pa, ds, sug, sc);
  if (!dadosCeu?.pix.ativo && !DEMO) { cx.append(el('p', 'f-nota', 'os presentes abrem em breve ✨ siga o perfil pra saber primeiro.')); return; }
  cx.append(bt('btn ouro grande', `<span>Pagar R$ ${preco('presente')} no Pix</span>`, () => {
    const h = de.value.trim().replace(/^@+/, ''), p = pa.value.trim().replace(/^@+/, ''), d = ds.value.trim(), [cid, uf] = sc.value.split('|');
    if (!h || !p) { aviso('preencha os dois @'); return; }
    if (d.length < 2) { aviso('escreva o desejo'); return; }
    ls.set('c27_eu', h); f(); pagar({ tipo: 'presente', handle: h, par: p, desejo: d, cidade: cid, uf });
  }));
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
  ceu.lote(() => { for (const c of lista) ceu.colocar(deCompacta(c)); });
  total = 48_213; nCidades = 2049;
  const cont2 = new Map<string, number>(); for (const c of lista) cont2.set(c[3], (cont2.get(c[3]) || 0) + 1);
  dadosCeu = { ok: true, total, cidades: nCidades, ranking: [...cont2].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [c, uf] = k.split('|'); return [c, uf, n * 18]; }), lanternas: [], ultimo: 0, post: `https://www.instagram.com/${MARCA.ig.slice(1)}/`, pix: { ativo: true, precos: { dourada: 4.9, casal: 7.9, presente: 4.9 } }, virada: 0, ig: MARCA.ig };
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
