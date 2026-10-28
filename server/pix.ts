/* Pix pelo Mercado Pago. O preço vem SEMPRE do servidor. A lanterna só sobe/vira dourada quando o pagamento é
   confirmado consultando a própria API do Mercado Pago (o webhook só avisa; nunca confiamos no corpo dele).
   - POST /api/pix            { tipo: gratis|dourada|casal|presente|familia|topo|personalizar, visual? {cor, skin, rastro, faixa}, handle, par?, desejo, cidade?, uf?, codigo?, nomes? (família), lanterna? (topo) }
   - GET  /api/pix/:id        estado (o site consulta enquanto mostra o QR)
   - POST /webhook/mercadopago  aviso do Mercado Pago (type=payment, data.id) */
import { randomUUID } from 'node:crypto';
import type { Hono } from 'hono';
import { config } from './config';
import { q, q1 } from './db';
import { desejoOk, limparHandle } from './texto';
import { lerVisual, precoVisual, novos, vazio, type Visual } from './catalogo';
import { aoVivo } from './vivo';

const mp = (caminho: string, init: RequestInit = {}) => fetch(config.mp.api + caminho, { ...init, headers: { authorization: `Bearer ${config.mp.token}`, 'content-type': 'application/json', ...(init.headers || {}) }, signal: AbortSignal.timeout(15_000) });

export const pixAtivo = () => !!config.mp.token;

async function confirmar(pagId: string) {
  const p = await q1<{ id: string; tipo: string; handle: string; par: string | null; desejo: string | null; cidade: string | null; uf: string | null; status: string; mp_id: string; codigo: string | null; alvo: number | null; nomes: string[] | null; visual: Visual | null }>(`select * from pagamentos where id = $1`, [pagId]);
  if (!p || p.status === 'pago') return;
  const r: any = await mp(`/v1/payments/${encodeURIComponent(p.mp_id)}`).then((x) => x.json()).catch(() => null);
  if (!r || r.status !== 'approved' || r.external_reference !== p.id) { if (r?.status && ['rejected', 'cancelled', 'refunded', 'charged_back'].includes(r.status)) await q(`update pagamentos set status = $2 where id = $1`, [p.id, r.status]); return; }
  // trava: só um processo transforma o pagamento em lanterna
  const ok = await q1(`update pagamentos set status = 'pago', pago_em = now() where id = $1 and status <> 'pago' returning id`, [p.id]); if (!ok) return;
  let lid: number;
  if (p.tipo === 'personalizar') {   // não cria lanterna: veste a que já está no céu
    await vestir(p.alvo!, p.visual);
    await q(`update pagamentos set lanterna_id = $2 where id = $1`, [p.id, p.alvo]);
    return;
  }
  if (p.tipo === 'topo') {   // não cria lanterna: a escolhida fica no topo do céu da cidade (somando, se já estava)
    await q(`update lanternas set destaque_ate = greatest(coalesce(destaque_ate, now()), now()) + make_interval(hours => $2) where id = $1`, [p.alvo, config.horasTopo]);
    await q(`update pagamentos set lanterna_id = $2 where id = $1`, [p.id, p.alvo]);
    aoVivo(0); return;
  }
  if (p.tipo === 'familia') {   // a de quem comprou (a pendente do link, ou uma nova) + uma dourada pra cada @
    const ids: number[] = [];
    const pendF = p.codigo ? await q1<{ id: number }>(`update lanternas set estado = 'no_ceu', solta_em = now(), tipo = 1, forca = greatest(forca, 0.6), desejo = coalesce($2, desejo), desejo_oculto = case when $2 is null then desejo_oculto else false end where codigo = $1 and estado = 'pendente' returning id`, [p.codigo, p.desejo]) : undefined;
    if (pendF) { ids.push(pendF.id); await vestir(pendF.id, p.visual); }
    for (const n of p.nomes || []) ids.push((await q1<{ id: number }>(`insert into lanternas (handle, desejo, cidade, uf, tipo, de, forca, origem) values ($1, $2, $3, $4, 1, $5, 0.5, 'pix') returning id`, [n, p.desejo || 'que 2027 seja incrível', p.cidade || 'Brasil', p.uf || '', n === p.handle ? null : p.handle]))!.id);
    await q(`update pagamentos set lanterna_id = $2 where id = $1`, [p.id, ids[0]]);
    aoVivo(Math.max(...ids)); return;
  }
  // veio do link pessoal (/l/CODIGO): a lanterna pendente dela sobe já no tipo pago
  const pend = p.codigo ? await q1<{ id: number }>(`update lanternas set estado = 'no_ceu', solta_em = now(), tipo = $2, par = $3, forca = greatest(forca, $4), desejo = coalesce($5, desejo), desejo_oculto = case when $5 is null then desejo_oculto else false end where codigo = $1 and estado = 'pendente' returning id`,
    [p.codigo, p.tipo === 'casal' ? 3 : p.tipo === 'gratis' ? 0 : 1, p.tipo === 'casal' ? p.par : null, p.tipo === 'casal' ? 0.4 : p.tipo === 'gratis' ? 0 : 0.6, p.desejo]) : undefined;
  if (pend) lid = pend.id;
  else if (p.tipo === 'dourada') {
    const minha = await q1<{ id: number }>(`select id from lanternas where lower(handle) = $1 and not oculta order by (origem = 'ig') desc, id limit 1`, [p.handle]);
    if (minha) { await q(`update lanternas set tipo = 1, forca = greatest(forca, 0.6) where id = $1`, [minha.id]); lid = minha.id; }
    else lid = (await q1<{ id: number }>(`insert into lanternas (handle, desejo, cidade, uf, tipo, forca, origem) values ($1, $2, $3, $4, 1, 0.6, 'pix') returning id`, [p.handle, p.desejo || 'que 2027 seja incrível', p.cidade || 'Brasil', p.uf || '']))!.id;
  } else if (p.tipo === 'casal') {
    lid = (await q1<{ id: number }>(`insert into lanternas (handle, desejo, cidade, uf, tipo, par, forca, origem) values ($1, $2, $3, $4, 3, $5, 0.4, 'pix') returning id`, [p.handle, p.desejo, p.cidade || 'Brasil', p.uf || '', p.par]))!.id;
  } else {
    lid = (await q1<{ id: number }>(`insert into lanternas (handle, desejo, cidade, uf, tipo, de, forca, origem) values ($1, $2, $3, $4, 1, $5, 0.5, 'pix') returning id`, [p.par, p.desejo, p.cidade || 'Brasil', p.uf || '', p.handle]))!.id;
  }
  await vestir(lid, p.visual);
  await q(`update pagamentos set lanterna_id = $2 where id = $1`, [p.id, lid]);
  aoVivo(lid);
}
/** grava a personalização por cima da que já tinha (skin tira a cor lisa e vice-versa) */
async function vestir(id: number, v: Visual | null) {
  if (!v || vazio(v)) return;
  const tira = v.skin ? ['cor'] : v.cor ? ['skin'] : [];
  await q(`update lanternas set visual = (coalesce(visual, '{}'::jsonb) - $3::text[]) || $2::jsonb where id = $1`, [id, JSON.stringify(v), tira]);
}

export function registrarPix(app: Hono) {
  app.post('/api/pix', async (c) => {
    if (!pixAtivo()) return c.json({ ok: false, erro: 'pagamentos ainda não abertos' }, 503);
    const b = await c.req.json().catch(() => ({} as any));
    const tipo = ['gratis', 'dourada', 'casal', 'presente', 'familia', 'topo', 'personalizar'].includes(b.tipo) ? b.tipo as string : null;
    let handle = limparHandle(String(b.handle || '')), cidade = String(b.cidade || '').slice(0, 60), uf = String(b.uf || '').slice(0, 2);
    const par = limparHandle(String(b.par || '')), desejo = String(b.desejo || '').trim().slice(0, 90);
    const codigo = /^[A-Z2-9]{8}$/.test(String(b.codigo || '').toUpperCase()) ? String(b.codigo).toUpperCase() : null;
    if (codigo) {   // pagamento a partir do link pessoal: o @ e a cidade vêm da lanterna pendente
      const l = await q1<{ handle: string; cidade: string; uf: string }>(`select handle, cidade, uf from lanternas where codigo = $1 and estado = 'pendente'`, [codigo]);
      if (!l) return c.json({ ok: false, erro: 'essa lanterna já subiu ou o link expirou' }, 409);
      handle = l.handle; cidade = l.cidade; uf = l.uf;
      if (tipo === 'presente' || tipo === 'topo' || tipo === 'personalizar') return c.json({ ok: false, erro: 'isso é pela página principal' }, 400);
    }
    let alvo: number | null = null, nomes: string[] | null = null, visual: Visual = {};
    if (tipo === 'personalizar') {   // veste uma lanterna que já está no céu: cobra só o que ela ainda não tem
      const l = await q1<{ id: number; handle: string; cidade: string; uf: string; visual: Visual | null }>(`select id, handle, cidade, uf, visual from lanternas where id = $1 and estado = 'no_ceu' and not oculta and tipo <> 2`, [Number(b.lanterna) || 0]);
      if (!l) return c.json({ ok: false, erro: 'não achei essa lanterna no céu' }, 404);
      alvo = l.id; handle = handle || l.handle; cidade = l.cidade; uf = l.uf;
      visual = novos(lerVisual(b.visual), l.visual || {});
      if (vazio(visual)) return c.json({ ok: false, erro: 'escolha pelo menos um item novo' }, 400);
    } else if (codigo) visual = lerVisual(b.visual);   // no link: vai junto com a lanterna escolhida
    if (tipo === 'gratis' && (!codigo || vazio(visual))) return c.json({ ok: false, erro: 'a grátis sobe direto, sem Pix' }, 400);
    if (visual.faixa && !desejoOk(visual.faixa)) return c.json({ ok: false, erro: 'o texto da faixa não passou no filtro (sem palavrão, link, telefone ou @)' }, 400);
    if (tipo === 'topo') {   // a lanterna tem que estar no céu; o @ e a cidade vêm dela
      const l = await q1<{ id: number; handle: string; cidade: string; uf: string }>(`select id, handle, cidade, uf from lanternas where id = $1 and estado = 'no_ceu' and not oculta and tipo <> 2`, [Number(b.lanterna) || 0]);
      if (!l) return c.json({ ok: false, erro: 'não achei essa lanterna no céu' }, 404);
      alvo = l.id; handle = handle || l.handle; cidade = l.cidade; uf = l.uf;
    }
    if (tipo === 'familia') {   // pelo link: a sua + até 3 · pela página: até 4
      const max = codigo ? 3 : 4;
      nomes = [...new Set(String(b.nomes || '').split(/[\s,;]+/).map(limparHandle).filter((n) => n.length >= 2))].slice(0, max);
      if (!nomes.length) return c.json({ ok: false, erro: 'digite pelo menos um @ da sua família' }, 400);
    }
    if (!tipo || !handle) return c.json({ ok: false, erro: 'escolha a lanterna e digite o seu @' }, 400);
    if ((tipo === 'casal' || tipo === 'presente') && !par) return c.json({ ok: false, erro: 'digite o @ da outra pessoa' }, 400);
    if ((codigo || !['dourada', 'topo', 'personalizar'].includes(tipo)) && !desejoOk(desejo)) return c.json({ ok: false, erro: 'esse desejo não passou no filtro (sem palavrão, link, telefone ou @)' }, 400);
    if (desejo && !desejoOk(desejo)) return c.json({ ok: false, erro: 'esse desejo não passou no filtro' }, 400);
    const valor = Math.round(((config.precos[tipo] || 0) + precoVisual(visual)) * 100) / 100, id = randomUUID();
    const email = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(b.email || '')) ? String(b.email) : `pix+${id.slice(0, 8)}@${new URL(config.site).hostname.replace(/^localhost$/, 'ceude2027.com.br')}`;
    const r: any = await mp('/v1/payments', {
      method: 'POST', headers: { 'X-Idempotency-Key': id },
      body: JSON.stringify({ transaction_amount: valor, description: `Céu de 2027 · ${tipo === 'topo' ? 'topo do céu 24h' : tipo === 'familia' ? 'pacote família (4 lanternas)' : tipo === 'personalizar' || tipo === 'gratis' ? 'personalização da lanterna' : 'lanterna ' + tipo}${!vazio(visual) && tipo !== 'personalizar' && tipo !== 'gratis' ? ' + personalização' : ''}`, payment_method_id: 'pix', external_reference: id, notification_url: `${config.site}/webhook/mercadopago`, date_of_expiration: new Date(Date.now() + 30 * 60_000).toISOString().replace('Z', '-00:00'), payer: { email } }),
    }).then((x) => x.json()).catch(() => null);
    const td = r?.point_of_interaction?.transaction_data;
    if (!r?.id || !td?.qr_code) { console.error('[pix] mercado pago', r?.message || r); return c.json({ ok: false, erro: 'não consegui gerar o Pix agora, tenta de novo em instantes' }, 502); }
    await q(`insert into pagamentos (id, mp_id, tipo, valor, handle, par, desejo, cidade, uf, codigo, alvo, nomes, visual) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [id, String(r.id), tipo, valor, handle, par || null, desejo || null, cidade || null, uf || null, codigo, alvo, nomes, vazio(visual) ? null : JSON.stringify(visual)]);
    return c.json({ ok: true, id, valor, copia: td.qr_code, qr: td.qr_code_base64 });
  });
  app.get('/api/pix/:id', async (c) => {
    const id = c.req.param('id'); if (!/^[0-9a-f-]{36}$/.test(id)) return c.json({ ok: false }, 400);
    let p = await q1<{ status: string; lanterna_id: number | null; criado_em: Date }>(`select status, lanterna_id, criado_em from pagamentos where id = $1`, [id]);
    if (p && p.status === 'pendente') { await confirmar(id); p = await q1(`select status, lanterna_id, criado_em from pagamentos where id = $1`, [id]); }
    return c.json({ ok: !!p, status: p?.status, lanterna: p?.lanterna_id ?? null });
  });
  app.post('/webhook/mercadopago', async (c) => {
    const b = await c.req.json().catch(() => ({} as any));
    const mpId = String(b?.data?.id || c.req.query('data.id') || c.req.query('id') || '');
    if (mpId) { const p = await q1<{ id: string }>(`select id from pagamentos where mp_id = $1`, [mpId]); if (p) await confirmar(p.id).catch((e) => console.error('[pix] confirmar', e)); }
    return c.json({ ok: true });
  });
  // rede de segurança: confere pendentes dos últimos 40 min a cada minuto
  setInterval(async () => { if (!pixAtivo()) return; for (const p of await q<{ id: string }>(`select id from pagamentos where status = 'pendente' and criado_em > now() - interval '40 minutes'`)) await confirmar(p.id).catch(() => {}); }, 60_000);
}
