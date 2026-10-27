/* Painel admin do Céu de 2027: números, comentários do Instagram (e se a resposta/direct saiu), moderação,
   pedidos de empresas, criar lanterna de empresa e configurar o post da vez e o token do Instagram. */
const app = document.getElementById('app')!;
const esc = (t: unknown) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const req = async (u: string, b?: unknown) => { const r = await fetch(u, { method: b === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b), credentials: 'same-origin' }); return { st: r.status, j: await r.json().catch(() => ({})) as any }; };
const TIPO = ['normal', 'dourada', 'empresa', 'casal'];
const quando = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function login(msg = '') {
  app.innerHTML = `<form id="login"><h1>Céu de 2027</h1><input type="password" id="s" placeholder="senha do admin" autocomplete="current-password"><button>entrar</button><span class="er">${esc(msg)}</span></form>`;
  (document.getElementById('login') as HTMLFormElement).onsubmit = async (e) => { e.preventDefault(); const r = await req('/api/admin/login', { senha: (document.getElementById('s') as HTMLInputElement).value }); if (r.st === 200) void painel(); else login(r.j.erro || 'erro'); };
}
async function painel() {
  const { st, j } = await req('/api/admin/resumo'); if (st === 401) { login(); return; }
  const n = j.n || {};
  app.innerHTML = `
  <div class="row" style="justify-content:space-between"><h1>Céu de 2027 · admin</h1><div class="row"><button class="s" id="atu">atualizar</button><button class="s" id="sair">sair</button></div></div>
  ${(j.avisos || []).map((a: string) => `<p class="av">⚠ falta configurar: ${esc(a)}</p>`).join('')}
  <div class="grid">
    <div class="k"><b>${n.total ?? 0}</b><small>lanternas</small></div><div class="k"><b>${j.hoje}</b><small>últimas 24h</small></div>
    <div class="k"><b>${n.douradas ?? 0}</b><small>douradas</small></div><div class="k"><b>${n.casais ?? 0}</b><small>casais</small></div>
    <div class="k"><b>${n.empresas ?? 0}</b><small>empresas</small></div><div class="k"><b>R$ ${(j.pagos?.total || 0).toFixed(2).replace('.', ',')}</b><small>${j.pagos?.n || 0} pagamentos</small></div>
    <div class="k"><b class="${j.falhas ? 'er' : ''}">${j.falhas}</b><small>respostas que falharam</small></div>
  </div>
  <section><h2>Post da vez e Instagram</h2>
    <div class="row"><input id="post" style="flex:1;min-width:260px" placeholder="https://www.instagram.com/p/..." value="${esc(j.post || '')}"><button id="sPost">salvar post</button></div>
    <div class="row" style="margin-top:8px"><input id="tok" type="password" style="flex:1;min-width:260px" placeholder="token de longa duração do Instagram (renova sozinho)"><button id="sTok">salvar token</button></div>
  </section>
  <section><h2>Comentários recebidos</h2><table><tr><th>quando</th><th>@</th><th>comentário</th><th>estado</th><th>resposta</th></tr>
    ${(j.comentarios || []).map((c: any) => `<tr><td class="mu">${quando(c.recebido_em)}</td><td>@${esc(c.username)}</td><td>${esc(c.texto)}</td><td>${esc(c.estado)}</td><td class="${c.resposta_estado === 'enviada' ? 'ok' : c.resposta_estado === 'falhou' ? 'er' : 'mu'}">${esc(c.resposta_estado || '')}${c.erro ? '<br><small>' + esc(c.erro) + '</small>' : ''}</td></tr>`).join('')}</table></section>
  <section><h2>Últimas lanternas (moderação)</h2><table><tr><th>#</th><th>@</th><th>desejo</th><th>cidade</th><th>tipo</th><th>origem</th><th></th></tr>
    ${(j.ultimas || []).map((l: any) => `<tr style="${l.oculta ? 'opacity:.45' : ''}"><td class="mu">${l.id}</td><td>@${esc(l.handle)}</td><td>${esc(l.desejo)}${l.desejo_oculto ? ' <small class="av">(filtrado)</small>' : ''}</td><td>${esc(l.cidade)}${l.uf ? ', ' + esc(l.uf) : ''}</td><td>${TIPO[l.tipo]}</td><td class="mu">${esc(l.origem)}</td><td><button class="s" data-oc="${l.id}" data-v="${l.oculta ? 0 : 1}">${l.oculta ? 'mostrar' : 'ocultar'}</button></td></tr>`).join('')}</table></section>
  <section><h2>Nova lanterna de empresa</h2><div class="row">
    <input id="eN" placeholder="nome"><input id="eI" placeholder="@ da empresa"><input id="eO" style="flex:1;min-width:220px" placeholder="oferta (aparece no céu)"><input id="eC" placeholder="cidade"><input id="eU" placeholder="UF" maxlength="2" style="width:60px"><input id="eK" type="color" value="#43d9c6"><label class="row"><input id="eD" type="checkbox">destaque</label><button id="eS">criar</button></div></section>
  <section><h2>Pedidos de empresas</h2><table><tr><th>quando</th><th>empresa</th><th>@</th><th>WhatsApp</th><th>cidade</th><th>pacote</th></tr>
    ${(j.pedidos || []).map((p: any) => `<tr><td class="mu">${quando(p.criado_em)}</td><td>${esc(p.nome)}</td><td>${p.ig ? '@' + esc(p.ig) : ''}</td><td><a style="color:#7be08f" href="https://wa.me/55${esc(String(p.zap).replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(p.zap)}</a></td><td>${esc(p.cidade)}</td><td>${esc(p.pacote)}</td></tr>`).join('')}</table></section>`;
  const v = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
  document.getElementById('atu')!.onclick = () => void painel();
  document.getElementById('sair')!.onclick = async () => { await req('/api/admin/sair', {}); login(); };
  document.getElementById('sPost')!.onclick = async () => { await req('/api/admin/config', { post_url: v('post') }); void painel(); };
  document.getElementById('sTok')!.onclick = async () => { await req('/api/admin/config', { ig_token: v('tok') }); alert('token salvo'); };
  document.getElementById('eS')!.onclick = async () => { const r = await req('/api/admin/empresa', { nome: v('eN'), ig: v('eI'), oferta: v('eO'), cidade: v('eC'), uf: v('eU'), cor: v('eK'), destaque: (document.getElementById('eD') as HTMLInputElement).checked }); if (!r.j.ok) alert(r.j.erro || 'erro'); void painel(); };
  app.querySelectorAll<HTMLButtonElement>('[data-oc]').forEach((b) => { b.onclick = async () => { await req(`/api/admin/lanterna/${b.dataset.oc}/ocultar`, { oculta: b.dataset.v === '1' }); void painel(); }; });
}
void painel();
