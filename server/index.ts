/* Céu de 2027 · servidor. Uma porta só: API + webhooks + site (dist/) em produção.
   Público:  GET /api/ceu · GET /api/ceu/novas?desde= · GET /api/lanterna/:handle · POST /api/lanternas/:id/fortalecer
             POST /api/empresas/pedido · GET /api/saude
   Admin:    /api/admin/* (senha → cookie assinado) */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { config, conferir } from './config';
import { migrar, q, q1, lerConfig, gravarConfig } from './db';
import { registrarInstagram, processarComentario } from './instagram';
import { registrarPix, pixAtivo } from './pix';
import { limparHandle, desejoOk } from './texto';
import { PRECO_VISUAL } from './catalogo';
import { maiorId, aoVivo } from './vivo';

const app = new Hono();

/* limite simples por IP (memória) */
const baldes = new Map<string, { n: number; ate: number }>();
const ip = (c: any) => (c.req.header('x-forwarded-for') || '').split(',')[0].trim() || c.req.header('x-real-ip') || 'local';
function limite(nome: string, max: number, janelaMs = 60_000) {
  return async (c: any, next: () => Promise<void>) => {
    const k = nome + ':' + ip(c), agora = Date.now(), b = baldes.get(k);
    if (!b || b.ate < agora) baldes.set(k, { n: 1, ate: agora + janelaMs }); else if (++b.n > max) return c.json({ ok: false, erro: 'calma! tenta de novo em instantes' }, 429);
    if (baldes.size > 50_000) baldes.clear();
    await next();
  };
}
app.use('*', async (c, next) => { await next(); c.header('x-content-type-options', 'nosniff'); c.header('referrer-policy', 'strict-origin-when-cross-origin'); });

/* ---------- formato compacto das lanternas ---------- */
type Linha = { id: number; handle: string; desejo: string; cidade: string; uf: string; tipo: number; par: string | null; de: string | null; forca: number; topo: boolean; empresa: any; visual: { cor?: string; skin?: string; rastro?: boolean; faixa?: string } | null; criado_em: Date; ordem: number };
// no topo (pago, 24h) a força vale 3: acima de qualquer lanterna fortalecida (máx. 2,5). O site reconhece por forca >= 3.
const COLS = `id, handle, desejo, cidade, uf, tipo, par, de, forca, coalesce(destaque_ate > now(), false) topo, empresa, visual, criado_em, ordem::int ordem`;
const compacto = (l: Linha) => [l.id, l.handle, l.desejo, l.cidade + (l.uf ? '|' + l.uf : ''), l.tipo, l.topo ? 3 : Math.round(l.forca * 100) / 100, l.par || '', l.de || '', l.empresa ? [l.empresa.nome, l.empresa.ig || '', l.empresa.oferta || '', l.empresa.cor || '#3ff0d8', l.empresa.logo || ''] : 0,
  l.visual ? [l.visual.skin || '', l.visual.cor || '', l.visual.rastro ? 1 : 0, l.visual.faixa || ''] : 0];

let cacheCeu: { em: number; corpo: Record<string, any> } | null = null;
app.get('/api/ceu', limite('ceu', 120), async (c) => {
  if (cacheCeu && Date.now() - cacheCeu.em < 15_000) return c.json(cacheCeu.corpo);
  const [tot, cid, recentes, fortes] = await Promise.all([
    q1<{ n: number; c: number }>(`select count(*)::int n, count(distinct cidade || uf)::int c from lanternas where not oculta and estado = 'no_ceu'`),
    q<{ cidade: string; uf: string; n: number }>(`select cidade, uf, count(*)::int n from lanternas where not oculta and estado = 'no_ceu' group by 1, 2 order by 3 desc limit 300`),
    q<Linha>(`select ${COLS} from lanternas where not oculta and estado = 'no_ceu' order by id desc limit 3500`),
    q<Linha>(`select ${COLS} from lanternas where not oculta and estado = 'no_ceu' and (tipo in (1, 2, 3) or forca > 0.3 or destaque_ate > now()) order by (destaque_ate > now()) is true desc, forca desc, id desc limit 1200`),
  ]);
  const vistos = new Set<number>(), lista: unknown[] = [];
  for (const l of [...fortes, ...recentes]) if (!vistos.has(l.id)) { vistos.add(l.id); lista.push(compacto(l)); }
  const corpo = { ok: true, total: tot!.n, cidades: tot!.c, ranking: cid.map((x) => [x.cidade, x.uf, x.n]), lanternas: lista, ultimo: maiorId(), post: (await lerConfig('post_url')) || `https://www.instagram.com/${config.ig.usuario}/`, pix: { ativo: pixAtivo(), precos: config.precos, visual: PRECO_VISUAL }, virada: config.virada, ig: config.ig.usuario };
  cacheCeu = { em: Date.now(), corpo };
  return c.json(corpo);
});
app.get('/api/ceu/novas', limite('novas', 240), async (c) => {
  const desde = Number(c.req.query('desde') || 0);
  if (desde >= maiorId() && maiorId() > 0) return c.json({ ok: true, lanternas: [], ultimo: maiorId() });
  const l = await q<Linha>(`select ${COLS} from lanternas where not oculta and estado = 'no_ceu' and ordem > $1 order by ordem limit 60`, [desde]);
  const tot = await q1<{ n: number }>(`select count(*)::int n from lanternas where not oculta and estado = 'no_ceu'`);
  const ult = l.length ? l[l.length - 1].ordem : desde;
  return c.json({ ok: true, lanternas: l.map(compacto), ultimo: ult, total: tot!.n });
});
app.get('/api/lanterna/:handle', limite('lanterna', 120), async (c) => {
  const h = limparHandle(c.req.param('handle'));
  const l = await q<Linha>(`select ${COLS} from lanternas where not oculta and estado = 'no_ceu' and (lower(handle) = $1 or lower(par) = $1) order by (lower(handle) = $1) desc, tipo = 1 desc, id limit 5`, [h]);
  // comentou mas ainda não abriu o link do direct: avisa que ela está esperando (o código do link nunca sai daqui)
  const pendente = !l.length && !!(await q1(`select 1 from lanternas where lower(handle) = $1 and estado = 'pendente' limit 1`, [h]));
  return c.json({ ok: true, lanternas: l.map(compacto), pendente });
});
app.post('/api/lanternas/:id/fortalecer', limite('forca', 40), async (c) => {
  const id = Number(c.req.param('id')), b = await c.req.json().catch(() => ({} as any)), ap = String(b.aparelho || '').slice(0, 40);
  if (!Number.isInteger(id) || !/^[a-z0-9]{12,40}$/.test(ap)) return c.json({ ok: false, erro: 'pedido inválido' }, 400);
  const novo = await q1(`insert into fortalecidas (lanterna_id, aparelho) select $1, $2 where exists (select 1 from lanternas where id = $1 and not oculta and estado = 'no_ceu') on conflict do nothing returning 1`, [id, ap]);
  if (!novo) return c.json({ ok: false, erro: 'você já fortaleceu essa lanterna 💛' }, 409);
  const r = await q1<{ forca: number }>(`update lanternas set forca = least(2.5, forca + 0.05) where id = $1 returning forca`, [id]);
  return c.json({ ok: true, forca: r?.forca });
});
app.post('/api/empresas/pedido', limite('empresa', 5, 3600_000), async (c) => {
  const b = await c.req.json().catch(() => ({} as any)), s = (v: unknown, n: number) => String(v || '').trim().slice(0, n);
  if (!s(b.nome, 80) || !s(b.zap, 20)) return c.json({ ok: false, erro: 'preencha o nome da empresa e o WhatsApp' }, 400);
  await q(`insert into pedidos_empresa (nome, ig, zap, cidade, pacote) values ($1,$2,$3,$4,$5)`, [s(b.nome, 80), limparHandle(s(b.ig, 40)), s(b.zap, 20), s(b.cidade, 60), s(b.pacote, 20)]);
  return c.json({ ok: true });
});
/* ---------- link pessoal do direct: /l/CODIGO ---------- */
const COD = /^[A-Z2-9]{8}$/;
app.get('/api/l/:codigo', limite('link', 60), async (c) => {
  const cod = c.req.param('codigo').toUpperCase(); if (!COD.test(cod)) return c.json({ ok: false, erro: 'link inválido' }, 404);
  const l = await q1<Linha & { estado: string; desejo_oculto: boolean }>(`select ${COLS}, estado, desejo_oculto from lanternas where codigo = $1 and not oculta`, [cod]);
  if (!l) return c.json({ ok: false, erro: 'esse link não existe ou expirou' }, 404);
  return c.json({ ok: true, estado: l.estado, lanterna: compacto(l), oculto: l.desejo_oculto, pix: { ativo: pixAtivo(), precos: config.precos } });
});
app.post('/api/l/:codigo/soltar', limite('soltar', 20), async (c) => {
  const cod = c.req.param('codigo').toUpperCase(); if (!COD.test(cod)) return c.json({ ok: false, erro: 'link inválido' }, 404);
  const b = await c.req.json().catch(() => ({} as any)), d = String(b.desejo || '').trim().slice(0, 90);
  if (d.length < 2) return c.json({ ok: false, erro: 'escreva seu desejo pra 2027' }, 400);
  if (!desejoOk(d)) return c.json({ ok: false, erro: 'esse desejo não passou no filtro (sem palavrão, link, telefone ou @)' }, 400);
  const l = await q1<{ id: number }>(`update lanternas set estado = 'no_ceu', solta_em = now(), ordem = nextval('lanternas_ordem'), desejo = coalesce(nullif($2, ''), desejo), desejo_oculto = case when $2 <> '' then false else desejo_oculto end
                                       where codigo = $1 and estado = 'pendente' and not oculta returning id`, [cod, d]);
  if (!l) { const ja = await q1<{ id: number }>(`select id from lanternas where codigo = $1 and estado = 'no_ceu'`, [cod]); return ja ? c.json({ ok: true, id: ja.id, ja: true }) : c.json({ ok: false, erro: 'esse link não existe ou expirou' }, 404); }
  void aoVivo(); cacheCeu = null;
  return c.json({ ok: true, id: l.id });
});
/* logo da empresa (enviado pelo admin) */
app.get('/api/logo/:id', async (c) => {
  const l = await q1<{ tipo: string; dados: Buffer }>(`select tipo, dados from logos where id = $1`, [Number(c.req.param('id')) || 0]);
  if (!l) return c.notFound();
  return c.body(new Uint8Array(l.dados), 200, { 'content-type': l.tipo, 'cache-control': 'public, max-age=31536000, immutable' });
});
const LOGO_OK = (v: unknown) => typeof v === 'string' && /^(\/api\/logo\/\d+|\/logos\/[a-z0-9-]+\.(png|webp|jpg))$/.test(v);
app.get('/api/saude', async (c) => c.json({ ok: true, db: !!(await q1(`select 1`).catch(() => null)), pix: pixAtivo(), ig: !!config.ig.contaId }));

/* ---------- admin ---------- */
const assinar = (v: string) => v + '.' + createHmac('sha256', config.segredo).update(v).digest('hex').slice(0, 32);
const sessaoOk = (c: any) => { const k = getCookie(c, 'ceu_adm') || ''; const [v] = k.split('.'); if (!v) return false; const a = assinar(v); return a.length === k.length && timingSafeEqual(Buffer.from(a), Buffer.from(k)) && Number(v) > Date.now(); };
app.post('/api/admin/login', limite('login', 8, 15 * 60_000), async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const s = String(b.senha || ''), ok = config.adminSenha && s.length === config.adminSenha.length && timingSafeEqual(Buffer.from(s), Buffer.from(config.adminSenha));
  if (!ok) return c.json({ ok: false, erro: 'senha errada' }, 401);
  setCookie(c, 'ceu_adm', assinar(String(Date.now() + 12 * 3600_000)), { httpOnly: true, sameSite: 'Strict', secure: config.producao, path: '/api/admin', maxAge: 12 * 3600 });
  return c.json({ ok: true });
});
app.use('/api/admin/*', async (c, next) => { if (c.req.path === '/api/admin/login') return next(); if (!sessaoOk(c)) return c.json({ ok: false, erro: 'entre de novo' }, 401); return next(); });
app.post('/api/admin/sair', (c) => { deleteCookie(c, 'ceu_adm', { path: '/api/admin' }); return c.json({ ok: true }); });
app.get('/api/admin/resumo', async (c) => {
  const [n, hoje, pagos, coms, pedidos, ultimas, falhas] = await Promise.all([
    q1(`select count(*)::int total, count(*) filter (where tipo = 1)::int douradas, count(*) filter (where tipo = 3)::int casais, count(*) filter (where tipo = 2)::int empresas, count(*) filter (where oculta)::int ocultas from lanternas`),
    q1(`select count(*)::int n from lanternas where criado_em > now() - interval '24 hours'`),
    q1(`select count(*)::int n, coalesce(sum(valor), 0)::float total from pagamentos where status = 'pago'`),
    q(`select comment_id, username, texto, estado, resposta_estado, erro, recebido_em from ig_comentarios order by recebido_em desc limit 30`),
    q(`select * from pedidos_empresa order by id desc limit 30`),
    q(`select id, handle, desejo, desejo_oculto, cidade, uf, tipo, origem, oculta, visual->>'faixa' faixa, criado_em from lanternas order by id desc limit 60`),
    q1(`select count(*)::int n from ig_comentarios where resposta_estado = 'falhou'`),
  ]);
  return c.json({ ok: true, n, hoje: hoje!.n, pagos, comentarios: coms, pedidos, ultimas, falhas: falhas!.n, post: await lerConfig('post_url'), avisos: conferir() });
});
app.post('/api/admin/lanterna/:id/ocultar', async (c) => { const b = await c.req.json().catch(() => ({} as any)); await q(`update lanternas set oculta = $2 where id = $1`, [Number(c.req.param('id')), b.oculta !== false]); cacheCeu = null; return c.json({ ok: true }); });
app.post('/api/admin/lanterna/:id/faixa', async (c) => { await q(`update lanternas set visual = visual - 'faixa' where id = $1`, [Number(c.req.param('id'))]); cacheCeu = null; return c.json({ ok: true }); });
app.post('/api/admin/lanterna/:id/desejo', async (c) => { const b = await c.req.json().catch(() => ({} as any)); const d = String(b.desejo || '').slice(0, 90); if (!desejoOk(d)) return c.json({ ok: false, erro: 'texto não passou no filtro' }, 400); await q(`update lanternas set desejo = $2, desejo_oculto = false where id = $1`, [Number(c.req.param('id')), d]); cacheCeu = null; return c.json({ ok: true }); });
app.post('/api/admin/logo', async (c) => {
  const b = await c.req.json().catch(() => ({} as any)), m = String(b.dados || '').match(/^data:(image\/(?:png|webp|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return c.json({ ok: false, erro: 'mande uma imagem PNG, JPG ou WebP' }, 400);
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 400_000) return c.json({ ok: false, erro: 'imagem grande demais (máx. 400 KB)' }, 400);
  const r = await q1<{ id: number }>(`insert into logos (tipo, dados) values ($1, $2) returning id`, [m[1], buf]);
  return c.json({ ok: true, url: `/api/logo/${r!.id}` });
});
app.post('/api/admin/empresa', async (c) => {
  const b = await c.req.json().catch(() => ({} as any)), s = (v: unknown, n: number) => String(v || '').trim().slice(0, n);
  if (!s(b.nome, 60) || !s(b.oferta, 90)) return c.json({ ok: false, erro: 'nome e oferta' }, 400);
  const l = await q1<{ id: number }>(`insert into lanternas (handle, desejo, cidade, uf, tipo, forca, origem, empresa) values ($1, $2, $3, $4, 2, $5, 'admin', $6) returning id`,
    [limparHandle(s(b.ig, 40)) || 'empresa', s(b.oferta, 90), s(b.cidade, 60) || 'Brasil', s(b.uf, 2).toUpperCase(), b.destaque ? 1.2 : 0.6, JSON.stringify({ nome: s(b.nome, 60), ig: limparHandle(s(b.ig, 40)), oferta: s(b.oferta, 90), cor: /^#[0-9a-f]{6}$/i.test(b.cor) ? b.cor : '#3ff0d8', logo: LOGO_OK(b.logo) ? b.logo : '' })]);
  void aoVivo(); cacheCeu = null; return c.json({ ok: true, id: l!.id });
});
app.post('/api/admin/config', async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  if (typeof b.post_url === 'string' && /^https:\/\/(www\.)?instagram\.com\//.test(b.post_url)) await gravarConfig('post_url', b.post_url.slice(0, 200));
  if (typeof b.ig_token === 'string' && b.ig_token.length > 40) { await gravarConfig('ig_token', b.ig_token.trim()); await gravarConfig('ig_token_renovado', String(Date.now())); }
  cacheCeu = null; return c.json({ ok: true });
});
/* teste local (sem Meta): simula um comentário. Só fora de produção. */
if (!config.producao) app.post('/api/dev/comentario', async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const r = await processarComentario({ id: 'dev_' + Date.now() + Math.random().toString(36).slice(2, 6), text: String(b.texto || ''), from: { id: 'dev', username: String(b.username || 'teste') }, media: { id: 'dev' } });
  cacheCeu = null; return c.json({ ok: true, r });
});

// rotas do Instagram e do Pix ANTES do site: o app.get('*') do site engoliria os GET delas (webhook e consulta do Pix)
await migrar();
registrarInstagram(app); registrarPix(app);

/* ---------- site (produção) ---------- */
const dist = resolve(import.meta.dirname, '../dist');
// o serveStatic dessa versão só aceita raiz relativa à pasta atual (com caminho absoluto ele não acha nada e cai no index.html)
const raiz = relative(process.cwd(), dist) || '.';
if (existsSync(dist)) {
  app.use('/assets/*', serveStatic({ root: raiz, onFound: (_p, c) => { c.header('cache-control', 'public, max-age=31536000, immutable'); } }));
  app.use('/*', serveStatic({ root: raiz }));
  const indice = () => readFileSync(resolve(dist, 'index.html'), 'utf8');
  app.get('/admin', (c) => c.html(readFileSync(resolve(dist, 'admin.html'), 'utf8')));
  app.get('/empresas', (c) => c.html(readFileSync(resolve(dist, 'empresas.html'), 'utf8')));
  app.get('*', (c) => c.html(indice()));   // /@handle e afins caem no app
}

await aoVivo();
const faltando = conferir(); if (faltando.length) console.warn('[ceu] configuração faltando:\n - ' + faltando.join('\n - '));
serve({ fetch: app.fetch, port: config.porta }, () => console.log(`[ceu] no ar em http://localhost:${config.porta}`));
