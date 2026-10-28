/* Céu de 2027 · página de venda para lojas (/empresas).
   Dá pra personalizar o link que vai no direct: /empresas?loja=Padaria%20Pão%20Quente&cidade=Recife&ig=padariapaoquente */
import './empresas.css';
import { api } from './api';
import { fmt, MARCA } from './dados';

const P = new URLSearchParams(location.search);
const limpa = (v: string | null, n: number) => (v || '').replace(/[<>"'&]/g, '').trim().slice(0, n);
const loja = limpa(P.get('loja'), 40), cidade = limpa(P.get('cidade'), 40), ig = limpa(P.get('ig'), 30).replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '');
const ondeCeu = cidade ? `no céu de ${cidade}` : 'no céu da sua cidade';

const PACOTES: [string, string, string, string[]][] = [
  ['local', 'Local', '49', ['1 lanterna turquesa no céu da sua cidade', 'nome, @ e oferta no bilhete', 'fica até a virada']],
  ['destaque', 'Destaque', '99', ['tudo do Local', 'lanterna maior', 'mais alta no céu da cidade']],
  ['virada', 'Virada', '199', ['tudo do Destaque', 'sua marca nos fogos da meia-noite']],
];

const pg = document.getElementById('pg')!;
pg.innerHTML = `
<section class="hero">
  <div class="ls" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i class="${i % 5 === 0 ? 't' : ''}" style="left:${(i * 53) % 96 + 2}%;animation-delay:${-i * 1.7}s;animation-duration:${12 + (i % 4) * 3}s;--s:${0.6 + (i % 3) * 0.3}"></i>`).join('')}</div>
  <p class="marca">Céu de 2027 <span>· para empresas</span></p>
  <h1><span class="mao">${loja ? esc(loja) : 'a sua loja'}</span>no céu<br>de 2027</h1>
  <p class="sub">Até a virada, a cidade inteira vai abrir o céu pra ver as lanternas. A sua pode estar lá, ${esc(ondeCeu)}, com o seu @ e a sua oferta.</p>
  <p class="vivo" hidden></p>
  <a class="cta" href="#pedido">Quero minha lanterna</a>
</section>

<section class="bloco exemplo">
  <p class="tag">é assim que aparece</p>
  <div class="bil">
    <p class="carimbo">patrocinado</p>
    <h3>${loja ? esc(loja) : 'Padaria Pão Quente'}</h3>
    <p class="oferta">Panetone com 20% off até o dia 31 🎄</p>
    <p class="cid">${cidade ? esc(cidade) : 'Recife, PE'} · @${ig || 'padariapaoquente'}</p>
    <span class="bt">Ver @${ig || 'padariapaoquente'} no Instagram</span>
  </div>
  <p class="nota">Quem toca na lanterna turquesa lê a oferta e vai direto pro seu perfil.${loja ? '' : ' (exemplo)'}</p>
</section>

<section class="bloco">
  <p class="tag">por que funciona</p>
  <ol class="pq">
    <li><b>Todo mundo procura a própria cidade.</b> Quem entra vai direto pro céu de onde mora e vê as lanternas de lá, inclusive a sua.</li>
    <li><b>É época de comprar.</b> Dezembro é o mês de panetone, presente, roupa nova e ceia. Sua oferta aparece bem nessa hora.</li>
    <li><b>Não parece anúncio.</b> É uma lanterna no meio dos desejos das pessoas. Dá curiosidade de tocar pra ver o que está escrito.</li>
    <li><b>Termina numa festa.</b> À meia-noite do dia 31, todas as lanternas viram fogos ao vivo. No pacote Virada, a sua marca explode junto.</li>
  </ol>
</section>

<section class="bloco">
  <p class="tag">quanto custa</p>
  <div class="pacs">${PACOTES.map(([k, n, p, it]) => `<button type="button" class="pac${k === 'destaque' ? ' on' : ''}" data-k="${k}">${k === 'destaque' ? '<span class="fita">mais pedido</span>' : ''}<b>${n}</b><em>R$ ${p}</em><ul>${it.map((x) => `<li>${x}</li>`).join('')}</ul></button>`).join('')}</div>
  <p class="nota">Pagamento único até a virada. Sem mensalidade, sem contrato.</p>
</section>

<section class="bloco papel" id="pedido">
  <p class="tag">fazer o pedido</p>
  <h2>A gente monta a lanterna pra você</h2>
  <form id="f">
    <input class="in" name="nome" placeholder="nome da loja" required value="${esc(loja)}" />
    <input class="in" name="ig" placeholder="@ da loja" autocapitalize="none" value="${ig ? '@' + ig : ''}" />
    <input class="in" name="zap" placeholder="WhatsApp com DDD" inputmode="tel" required />
    <input class="in" name="cidade" placeholder="cidade" value="${esc(cidade)}" />
    <button class="enviar" type="submit">Enviar pedido · pacote <span id="pn">Destaque</span></button>
    <p class="nota">A gente te chama no WhatsApp pra combinar a oferta. Só paga depois de aprovar como ficou.</p>
  </form>
</section>

<footer><a href="/">ver o céu agora →</a><span>${MARCA.ig}</span></footer>`;

function esc(t: string) { return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }

let pacote = 'destaque';
const pn = document.getElementById('pn')!;
document.querySelectorAll<HTMLButtonElement>('.pac').forEach((b) => b.addEventListener('click', () => {
  pacote = b.dataset.k!; document.querySelectorAll('.pac').forEach((x) => x.classList.toggle('on', x === b));
  pn.textContent = b.querySelector('b')!.textContent!;
  document.getElementById('pedido')!.scrollIntoView({ behavior: 'smooth' });
}));

const f = document.getElementById('f') as HTMLFormElement;
f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f)) as Record<string, string>;
  if (!d.nome.trim() || d.zap.replace(/\D/g, '').length < 10) { alerta('preencha o nome da loja e o WhatsApp com DDD'); return; }
  const bt = f.querySelector('button')!; bt.disabled = true;
  const r = await api.pedidoEmpresa({ ...d, pacote });
  bt.disabled = false;
  if (!r.ok) { alerta(r.erro || 'não deu agora, tenta de novo'); return; }
  f.innerHTML = `<p class="feito">Pedido recebido! A gente te chama no WhatsApp em breve.</p>`;
});
function alerta(t: string) { let a = document.querySelector('.alerta'); if (!a) { a = document.createElement('p'); a.className = 'alerta'; f.prepend(a); } a.textContent = t; }

// números reais do céu (só aparecem quando já tem gente)
void api.ceu().then((r) => {
  if (!r.ok || r.total < 50) return;
  const v = document.querySelector<HTMLElement>('.vivo')!;
  const daCidade = cidade ? r.ranking.find(([c]) => c.toLowerCase() === cidade.toLowerCase())?.[2] : 0;
  v.innerHTML = `<i></i><b>${fmt(r.total)}</b> lanternas no céu em <b>${fmt(r.cidades)}</b> cidades${daCidade ? ` · <b>${fmt(daCidade)}</b> em ${esc(cidade)}` : ''}`;
  v.hidden = false;
});
