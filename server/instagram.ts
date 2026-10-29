/* Instagram (API com login do Instagram): webhook de comentários → lanterna grátis → resposta pública com o link.
   - GET  /webhook/instagram  verificação (hub.verify_token)
   - POST /webhook/instagram  assinatura X-Hub-Signature-256 (IG_APP_SECRET) obrigatória
   Um comentário vira no máximo uma lanterna; cada @ tem uma lanterna grátis (comentar de novo só fortalece a dele).
   Respostas saem por uma fila com ritmo (não parecer spam e respeitar limite da Meta). */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import type { Hono } from 'hono';
import { config } from './config';
import { q, q1, lerConfig, gravarConfig } from './db';
import { lerComentario, desejoOk, limparHandle } from './texto';
import { aoVivo } from './vivo';

function assinaturaOk(bruto: Buffer, header?: string) {
  if (!header?.startsWith('sha256=') || !config.ig.appSecret) return false;
  const esp = createHmac('sha256', config.ig.appSecret).update(bruto).digest(), rec = Buffer.from(header.slice(7), 'hex');
  return rec.length === esp.length && timingSafeEqual(esp, rec);
}
const tokenIG = async () => (await lerConfig('ig_token')) || config.ig.token;

const PUBLICAS = [
  (h: string) => `🏮 @${h}, seu desejo tá pronto pra subir! Te mandei o link no direct ✉️`,
  (h: string) => `✨ @${h}, sua lanterna tá te esperando! Olha o direct 💌`,
  (h: string) => `🏮 Anotado, @${h}! O link pra soltar sua lanterna foi pro seu direct ✉️`,
  (h: string) => `💛 @${h}, desejo recebido! Corre no direct pra soltar sua lanterna 🏮`,
];
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const novoCodigo = () => Array.from(randomBytes(8), (x) => ALFA[x % ALFA.length]).join('');
export const textoDirect = (h: string, desejo: string, cidade: string, codigo: string) => desejo
  ? `Oi @${h}! Seu desejo “${desejo}” está pronto pra subir no céu de ${cidade} 🏮\n\nConfira, escolha sua lanterna e solte aqui 👇\n${config.site}/l/${codigo}\n\n(link só seu · se não abrir em 24h, ela sobe grátis sozinha)`
  : `Oi @${h}! Sua lanterna no céu de ${cidade} está te esperando 🏮\n\nEscreva seu desejo pra 2027, escolha sua lanterna e solte aqui 👇\n${config.site}/l/${codigo}\n\n(link só seu · seu desejo só aparece no céu quando você soltar)`;

export async function processarComentario(v: { id: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string }; parent_id?: string }) {
  if (!v?.id || !v.from?.username) return 'ignorado';
  if (v.parent_id) return 'resposta';                                   // respostas dentro de comentários não contam
  if (v.from.id && v.from.id === config.ig.contaId) return 'proprio';
  const h = limparHandle(v.from.username), texto = String(v.text || '').slice(0, 500);
  const novo = await q1(`insert into ig_comentarios (comment_id, media_id, from_id, username, texto) values ($1, $2, $3, $4, $5) on conflict do nothing returning comment_id`, [v.id, v.media?.id || null, v.from.id || null, h, texto]);
  if (!novo) return 'duplicado';
  const ja = await q1<{ id: number }>(`select id from lanternas where lower(handle) = $1 and origem = 'ig' and not oculta and estado = 'no_ceu' order by id limit 1`, [h]);
  if (ja) {
    await q(`update lanternas set forca = least(2.5, forca + 0.1) where id = $1`, [ja.id]);
    await q(`update ig_comentarios set estado = 'ja_tinha', lanterna_id = $2 where comment_id = $1`, [v.id, ja.id]);
    return 'ja_tinha';
  }
  // ainda tem uma pendente (comentou de novo antes de escolher): atualiza o desejo e reaproveita o mesmo link
  const pend = await q1<{ id: number; codigo: string }>(`select id, codigo from lanternas where lower(handle) = $1 and estado = 'pendente' order by id desc limit 1`, [h]);
  const { cidade, desejo } = lerComentario(texto);
  const vazio = desejo.replace(/[^\p{L}\p{N}]/gu, '').length < 2;   // só a cidade (ou só emoji): o desejo é escrito no jogo
  const ok = !vazio && desejoOk(desejo);
  const des = ok ? desejo : '', cid = cidade?.nome || 'Brasil';
  let l: { id: number; codigo: string } | undefined;
  if (pend) { await q(`update lanternas set desejo = $2, desejo_oculto = $3, cidade = $4, uf = $5 where id = $1`, [pend.id, des, !ok && !vazio, cid, cidade?.uf || '']); l = pend; }
  else l = await q1<{ id: number; codigo: string }>(
    `insert into lanternas (handle, desejo, desejo_oculto, cidade, uf, tipo, origem, ig_comment_id, estado, codigo) values ($1, $2, $3, $4, $5, 0, 'ig', $6, 'pendente', $7) on conflict (ig_comment_id) do nothing returning id, codigo`,
    [h, des, !ok && !vazio, cid, cidade?.uf || '', v.id, novoCodigo()]);
  if (!l) return 'duplicado';
  const pub = PUBLICAS[Math.floor(Math.random() * PUBLICAS.length)](h);
  await q(`update ig_comentarios set estado = 'pendente', lanterna_id = $2, resposta = $3, resposta_estado = $4, direct = $5, direct_estado = $6 where comment_id = $1`,
    [v.id, l.id, pub, config.ig.responder ? 'pendente' : 'desligada', textoDirect(h, des, cid, l.codigo), config.ig.responder && !pend ? 'pendente' : 'desligada']);   // quem já recebeu o link não ganha outro direct
  return 'pendente';
}

/* fila: 1 envio a cada ~3 s. Primeiro o DIRECT (resposta privada ao comentário, com o link), depois a pública.
   A Meta aceita uma resposta privada por comentário (até 7 dias depois). Erro transitório: até 5 tentativas. */
let rodando = false;
async function enviar(caminho: string, corpo: unknown) {
  const token = await tokenIG(); if (!token) return { ok: false, transit: true, erro: 'sem token do Instagram' };
  const r = await fetch(`https://graph.instagram.com/${config.ig.versao}/${caminho}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(10_000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: String(e) } }) }) as unknown as Response);
  const j: any = await r.json().catch(() => ({}));
  return { ok: r.ok, transit: r.status === 0 || r.status >= 500 || r.status === 429 || [2, 4, 17, 32, 613].includes(j?.error?.code), erro: String(j?.error?.message || r.status).slice(0, 300) };
}
/* link escrito no texto não é clicável quando a mensagem chega como solicitação: vai como botão (template).
   Se a Meta recusar o template, manda o texto com o link como antes. */
const BOTAO = 'Soltar lanterna 🏮';
async function mandarDirect(recipient: { comment_id: string } | { id: string }, texto: string) {
  const url = texto.match(/https?:\/\/\S+/)?.[0];
  const caminho = `${encodeURIComponent(config.ig.contaId)}/messages`;
  if (url) {
    const corpo = texto.split(url).map((x) => x.trim()).filter(Boolean).join('\n\n').slice(0, 640);
    const r = await enviar(caminho, { recipient, message: { attachment: { type: 'template', payload: { template_type: 'button', text: corpo, buttons: [{ type: 'web_url', url, title: BOTAO }] } } } });
    if (r.ok || r.transit) return r;
    console.error('[ig] botão recusado, indo de texto:', r.erro);
  }
  return enviar(caminho, { recipient, message: { text: texto } });
}

/* a pessoa respondeu o direct (ex.: o link não abriu): abre janela de 24h, então reenviamos o botão da lanterna pendente dela */
async function processarMensagem(m: { sender?: { id?: string }; recipient?: { id?: string }; message?: { is_echo?: boolean } }) {
  const igsid = String(m?.sender?.id || ''); if (!igsid || m.message?.is_echo || igsid === config.ig.contaId || !m.message) return;
  const token = await tokenIG(); if (!token) return;
  const u: any = await fetch(`https://graph.instagram.com/${config.ig.versao}/${encodeURIComponent(igsid)}?fields=username`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }).then((x) => x.json()).catch(() => null);
  const h = u?.username ? limparHandle(u.username) : ''; if (!h) return;
  const l = await q1<{ id: number; codigo: string; desejo: string; cidade: string }>(`select id, codigo, case when desejo_oculto then '' else desejo end desejo, cidade from lanternas where lower(handle) = $1 and estado = 'pendente' order by id desc limit 1`, [h]);
  if (!l) return;
  const ult = Number(await lerConfig(`ig_reenvio_${l.id}`) || 0); if (Date.now() - ult < 60_000) return;   // não responder em rajada
  await gravarConfig(`ig_reenvio_${l.id}`, String(Date.now()));
  const r = await mandarDirect({ id: igsid }, textoDirect(h, l.desejo, l.cidade, l.codigo));
  if (!r.ok) console.error('[ig] reenvio do link', r.erro);
}

async function responderFila() {
  if (rodando || !config.ig.responder) return; rodando = true;
  try {
    const d = await q1<{ comment_id: string; direct: string; direct_tentativas: number }>(`select comment_id, direct, direct_tentativas from ig_comentarios where direct_estado = 'pendente' order by recebido_em limit 1`);
    if (d) {
      const r = await mandarDirect({ comment_id: d.comment_id }, d.direct);
      await q(`update ig_comentarios set direct_estado = $2, direct_tentativas = direct_tentativas + $3, direct_erro = $4 where comment_id = $1`, [d.comment_id, r.ok ? 'enviada' : r.transit && d.direct_tentativas < 4 ? 'pendente' : 'falhou', r.ok ? 0 : 1, r.ok ? null : r.erro]);
      return;
    }
    const c = await q1<{ comment_id: string; resposta: string; tentativas: number }>(`select comment_id, resposta, tentativas from ig_comentarios where resposta_estado = 'pendente' order by recebido_em limit 1`);
    if (!c) return;
    const r = await enviar(`${encodeURIComponent(c.comment_id)}/replies`, { message: c.resposta });
    await q(`update ig_comentarios set resposta_estado = $2, tentativas = tentativas + $3, erro = $4 where comment_id = $1`, [c.comment_id, r.ok ? 'enviada' : r.transit && c.tentativas < 4 ? 'pendente' : 'falhou', r.ok ? 0 : 1, r.ok ? null : r.erro]);
  } finally { rodando = false; }
}

/* quem não escolheu em 24h: a lanterna sobe grátis sozinha (ninguém fica sem) */
async function soltarEsquecidas() {
  const l = await q<{ id: number }>(`update lanternas set estado = 'no_ceu', solta_em = now(), desejo = case when desejo = '' then 'um desejo guardado em segredo 🤫' else desejo end where estado = 'pendente' and criado_em < now() - interval '24 hours' returning id`);
  for (const x of l) aoVivo(x.id);
}

/* token de longa duração do Instagram vale 60 dias: renova sozinho a cada 7 dias */
async function renovarToken() {
  const t = await tokenIG(); if (!t) return;
  const ult = Number(await lerConfig('ig_token_renovado') || 0); if (Date.now() - ult < 7 * 86_400_000) return;
  const r: any = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t)}`).then((x) => x.json()).catch(() => null);
  if (r?.access_token) { await gravarConfig('ig_token', r.access_token); await gravarConfig('ig_token_renovado', String(Date.now())); }
}

export function registrarInstagram(app: Hono) {
  app.get('/webhook/instagram', (c) => {
    if (c.req.query('hub.mode') === 'subscribe' && config.ig.verifyToken && c.req.query('hub.verify_token') === config.ig.verifyToken) return c.text(c.req.query('hub.challenge') || '');
    return c.text('proibido', 403);
  });
  app.post('/webhook/instagram', async (c) => {
    const bruto = Buffer.from(await c.req.arrayBuffer());
    if (!assinaturaOk(bruto, c.req.header('x-hub-signature-256'))) return c.json({ ok: false }, 401);
    let corpo: any; try { corpo = JSON.parse(bruto.toString('utf8')); } catch { return c.json({ ok: false }, 400); }
    for (const e of corpo?.entry || []) if (String(e?.id ?? '') === config.ig.contaId) for (const ch of e?.changes || []) if (ch?.field === 'comments') { try { await processarComentario(ch.value); } catch (err) { console.error('[ig] comentário', err); } }
    for (const e of corpo?.entry || []) if (String(e?.id ?? '') === config.ig.contaId) for (const m of e?.messaging || []) { try { await processarMensagem(m); } catch (err) { console.error('[ig] mensagem', err); } }
    return c.json({ ok: true });
  });
  setInterval(() => void responderFila().catch((e) => console.error('[ig] fila', e)), 3000);
  setInterval(() => void soltarEsquecidas().catch((e) => console.error('[ig] 24h', e)), 10 * 60_000);
  setInterval(() => void renovarToken().catch(() => {}), 6 * 3600_000); void renovarToken().catch(() => {});
}
