// Teste ponta a ponta dos pagamentos com um Mercado Pago falso (porta 8899) e o servidor na 8811. Rodar da raiz: npm run teste (precisa de Postgres; DB abaixo)
import http from 'node:http';
import { spawn } from 'node:child_process';
import pg from 'pg';

const DB = process.env.DATABASE_URL_TESTE || 'postgres://smn@127.0.0.1:54329/ceu2027';
const pagos = new Map();   // mp_id -> { status, ref }
let seq = Date.now();
const mp = http.createServer((req, res) => {
  let corpo = ''; req.on('data', (d) => (corpo += d)); req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST' && req.url === '/v1/payments') {
      const b = JSON.parse(corpo); const id = String(++seq); pagos.set(id, { status: 'pending', ref: b.external_reference, valor: b.transaction_amount });
      return res.end(JSON.stringify({ id, point_of_interaction: { transaction_data: { qr_code: 'pix-copia', qr_code_base64: 'AAAA' } } }));
    }
    const m = req.url.match(/^\/v1\/payments\/(\d+)/);
    if (m && pagos.has(m[1])) { const p = pagos.get(m[1]); return res.end(JSON.stringify({ id: m[1], status: p.status, external_reference: p.ref })); }
    res.statusCode = 404; res.end('{}');
  });
}).listen(8899);

const srv = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server/index.ts'], { env: { ...process.env, PORT: '8811', DATABASE_URL: DB, MP_ACCESS_TOKEN: 'teste', MP_API: 'http://127.0.0.1:8899', ADMIN_SENHA: 'senha-de-teste-123', SITE_URL: 'http://localhost:8811', NODE_ENV: 'development', IG_RESPONDER: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', (d) => (log += d)); srv.stderr.on('data', (d) => (log += d));
const db = new pg.Client(DB); await db.connect();
const U = 'http://127.0.0.1:8811';
const j = async (url, b) => { const r = await fetch(U + url, b ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) } : {}); return { st: r.status, ...(await r.json().catch(() => ({}))) }; };
let falhas = 0; const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FALHOU ') + msg); if (!c) falhas++; };
for (let i = 0; i < 60; i++) { try { if ((await fetch(U + '/api/saude')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }

const tag = 't' + Date.now().toString(36);
// --- família pelo link pessoal
await j('/api/dev/comentario', { username: tag, texto: 'Recife' });
const pend = (await db.query(`select id, codigo, estado from lanternas where handle = $1`, [tag])).rows[0];
ok(pend?.estado === 'pendente', 'comentário vira lanterna pendente');
let r = await j('/api/pix', { tipo: 'familia', handle: tag, codigo: pend.codigo, desejo: 'saúde pra família', nomes: '' });
ok(r.st === 400, 'família sem @ é recusada');
r = await j('/api/pix', { tipo: 'familia', handle: 'outro', codigo: pend.codigo, desejo: 'saúde pra família', nomes: `@${tag}mae, ${tag}pai ${tag}vo;${tag}extra` });
ok(r.ok && r.valor === 14.9, `Pix da família gerado com valor do servidor (${r.valor})`);
const pf = (await db.query(`select * from pagamentos where id = $1`, [r.id])).rows[0];
ok(pf.handle === tag && pf.nomes.length === 3, `pelo link: @ vem da lanterna e no máximo 3 nomes (${pf.nomes})`);
let e = await j('/api/pix/' + r.id);
ok(e.status === 'pendente', 'antes de pagar continua pendente');
ok((await db.query(`select count(*)::int n from lanternas where de = $1`, [tag])).rows[0].n === 0, 'nada sobe antes do pagamento');
pagos.get(pf.mp_id).status = 'approved';
e = await j('/api/pix/' + r.id);
ok(e.status === 'pago' && e.lanterna === pend.id, 'pago: devolve a lanterna da pessoa');
const fam = (await db.query(`select handle, tipo, estado, de, desejo from lanternas where handle = $1 or de = $1 order by id`, [tag])).rows;
ok(fam.length === 4 && fam.every((l) => l.tipo === 1 && l.estado === 'no_ceu'), `4 douradas no céu (${fam.map((l) => l.handle).join(', ')})`);
ok(fam.filter((l) => l.de === tag).length === 3 && fam.every((l) => l.desejo === 'saúde pra família'), 'as 3 da família com "presente de" e o mesmo desejo');
e = await j('/api/pix/' + r.id);
ok((await db.query(`select count(*)::int n from lanternas where de = $1`, [tag])).rows[0].n === 3, 'consultar de novo não duplica');

// --- família pela página (sem link): até 4
r = await j('/api/pix', { tipo: 'familia', handle: tag + 'b', desejo: 'paz', cidade: 'Natal', uf: 'RN', nomes: 'a1x,a2x,a3x,a4x,a5x' });
const pf2 = (await db.query(`select nomes from pagamentos where id = $1`, [r.id])).rows[0];
ok(pf2.nomes.length === 4, 'pela página: no máximo 4 nomes');

// --- topo
const alvo = fam[0];
const aid = (await db.query(`select id from lanternas where handle = $1 and de is null`, [tag])).rows[0].id;
r = await j('/api/pix', { tipo: 'topo', lanterna: 99999999, desejo: '' });
ok(r.st === 404, 'topo de lanterna que não existe é recusado');
r = await j('/api/pix', { tipo: 'topo', lanterna: aid, desejo: '' });
ok(r.ok && r.valor === 9.9, `Pix do topo gerado (${r.valor})`);
const pt = (await db.query(`select * from pagamentos where id = $1`, [r.id])).rows[0];
let lan = await j('/api/lanterna/' + tag);
ok(lan.lanternas[0][5] < 3, 'antes de pagar não está no topo');
// pagamento com referência trocada não vale
pagos.get(pt.mp_id).ref = 'outra-coisa'; pagos.get(pt.mp_id).status = 'approved';
e = await j('/api/pix/' + r.id);
ok(e.status === 'pendente', 'Mercado Pago com referência diferente não libera');
pagos.get(pt.mp_id).ref = pt.id;
e = await j('/api/pix/' + r.id);
ok(e.status === 'pago', 'topo pago');
lan = await j('/api/lanterna/' + tag);
ok(lan.lanternas[0][5] === 3, 'no topo: força 3 na API');
const h = (await db.query(`select extract(epoch from destaque_ate - now())/3600 h from lanternas where id = $1`, [aid])).rows[0].h;
ok(h > 23.9 && h <= 24, `vale por 24h (${Number(h).toFixed(2)}h)`);
const ceu = await j('/api/ceu');
ok(ceu.pix.precos.familia === 14.9 && ceu.pix.precos.topo === 9.9, 'preços novos vão pro site');
ok(ceu.lanternas.some((l) => l[0] === aid && l[5] === 3), 'a do topo vem na lista do céu');
// segundo topo soma mais 24h
r = await j('/api/pix', { tipo: 'topo', lanterna: aid, desejo: '' });
const pt2 = (await db.query(`select mp_id from pagamentos where id = $1`, [r.id])).rows[0]; pagos.get(pt2.mp_id).status = 'approved'; await j('/api/pix/' + r.id);
const h2 = (await db.query(`select extract(epoch from destaque_ate - now())/3600 h from lanternas where id = $1`, [aid])).rows[0].h;
ok(h2 > 47.9, `comprar de novo soma (${Number(h2).toFixed(2)}h)`);
// topo vencido volta ao normal
await db.query(`update lanternas set destaque_ate = now() - interval '1 minute' where id = $1`, [aid]);
lan = await j('/api/lanterna/' + tag);
ok(lan.lanternas[0][5] < 3, 'depois das 24h volta à força normal');

// --- personalização
const pagar = async (b) => { const r = await j('/api/pix', b); if (!r.ok) return r; const mpid = (await db.query(`select mp_id from pagamentos where id = $1`, [r.id])).rows[0].mp_id; pagos.get(mpid).status = 'approved'; return { ...r, e: await j('/api/pix/' + r.id) }; };
r = await j('/api/pix', { tipo: 'personalizar', lanterna: aid, visual: {} });
ok(r.st === 400, 'personalizar sem item é recusado');
r = await j('/api/pix', { tipo: 'personalizar', lanterna: aid, visual: { faixa: 'vai tomar no cu' } });
ok(r.st === 400, 'faixa com palavrão é recusada');
r = await j('/api/pix', { tipo: 'personalizar', lanterna: aid, visual: { faixa: 'casa comigo ju', skin: 'brasil', cor: 'rosa', rastro: true, preco: 0.01 } });
ok(r.ok && r.valor === 13.9, `faixa + skin + rastro = R$ 13,90 com desconto, preço do site ignorado (${r.valor})`);
let vis = (await db.query(`select visual from lanternas where id = $1`, [aid])).rows[0].visual;
ok(!vis, 'nada muda antes de pagar');
const mp1 = (await db.query(`select mp_id from pagamentos where id = $1`, [r.id])).rows[0].mp_id; pagos.get(mp1).status = 'approved'; await j('/api/pix/' + r.id);
vis = (await db.query(`select visual from lanternas where id = $1`, [aid])).rows[0].visual;
ok(vis?.faixa === 'casa comigo ju' && vis.skin === 'brasil' && vis.rastro === true && !vis.cor, `pago: lanterna vestida (${JSON.stringify(vis)})`);
lan = await j('/api/lanterna/' + tag);
ok(JSON.stringify(lan.lanternas[0][9]) === JSON.stringify(['brasil', '', 1, 'casa comigo ju']), 'a personalização vai pro site');
r = await j('/api/pix', { tipo: 'personalizar', lanterna: aid, visual: { faixa: 'casa comigo ju', rastro: true } });
ok(r.st === 400, 'não cobra de novo o que já tem');
r = await pagar({ tipo: 'personalizar', lanterna: aid, visual: { cor: 'azul', rastro: true } });
ok(r.valor === 2.9, `comprar cor depois cobra só a cor (${r.valor})`);
vis = (await db.query(`select visual from lanternas where id = $1`, [aid])).rows[0].visual;
ok(vis.cor === 'azul' && !vis.skin && vis.faixa === 'casa comigo ju', 'cor nova tira a skin e mantém a faixa');
r = await j('/api/pix', { tipo: 'personalizar', lanterna: aid, visual: { skin: 'nao-existe' } });
ok(r.st === 400, 'skin que não existe é recusada');
// grátis + personalização pelo link
const tag2 = tag + 'g';
await j('/api/dev/comentario', { username: tag2, texto: 'Natal' });
const pend2 = (await db.query(`select id, codigo from lanternas where handle = $1`, [tag2])).rows[0];
r = await j('/api/pix', { tipo: 'gratis', codigo: pend2.codigo, desejo: 'paz', visual: {} });
ok(r.st === 400, 'grátis sem personalização não gera Pix');
r = await pagar({ tipo: 'gratis', codigo: pend2.codigo, desejo: 'paz', visual: { faixa: 'feliz 2027' } });
ok(r.valor === 6.9 && r.e.status === 'pago', `grátis + faixa = R$ 6,90 (${r.valor})`);
const l2 = (await db.query(`select tipo, estado, visual, desejo from lanternas where id = $1`, [pend2.id])).rows[0];
ok(l2.tipo === 0 && l2.estado === 'no_ceu' && l2.visual.faixa === 'feliz 2027' && l2.desejo === 'paz', 'sobe normal, com a faixa e o desejo');
// dourada + skin pelo link
const tag3 = tag + 'd';
await j('/api/dev/comentario', { username: tag3, texto: 'Natal' });
const pend3 = (await db.query(`select id, codigo from lanternas where handle = $1`, [tag3])).rows[0];
r = await pagar({ tipo: 'dourada', codigo: pend3.codigo, desejo: 'paz', visual: { skin: 'coracao' } });
ok(r.valor === 9.8, `dourada + skin = R$ 9,80 (${r.valor})`);
const l3 = (await db.query(`select tipo, visual from lanternas where id = $1`, [pend3.id])).rows[0];
ok(l3.tipo === 1 && l3.visual.skin === 'coracao', 'sobe dourada com a skin');
r = await j('/api/pix', { tipo: 'presente', handle: 'x1', par: 'x2', desejo: 'paz', visual: { faixa: 'oi' } });
ok(r.ok && r.valor === 4.9, `presente pela página ignora personalização (${r.valor})`);

// --- página de empresas
const pgE = await fetch(U + '/empresas'); ok(pgE.status === 200, '/empresas responde (' + pgE.status + ')');

// --- ao vivo: quem comentou ANTES e soltou DEPOIS também aparece pra quem já está com o site aberto
await j('/api/dev/comentario', { username: tag + 'v1', texto: 'Recife' });
await j('/api/dev/comentario', { username: tag + 'v2', texto: 'Recife' });
const [v1, v2] = (await db.query(`select id, codigo from lanternas where handle in ($1, $2) order by id`, [tag + 'v1', tag + 'v2'])).rows;
await j(`/api/l/${v2.codigo}/soltar`, { desejo: 'paz' });
const marco = (await j('/api/ceu/novas?desde=0')).ultimo;
await j(`/api/l/${v1.codigo}/soltar`, { desejo: 'saúde' });
const nv = await j(`/api/ceu/novas?desde=${marco}`);
ok(nv.lanternas?.some((x) => x[0] === v1.id), 'lanterna de id menor solta depois chega no ao vivo');

// limpeza: só o que este teste criou
await db.query(`delete from lanternas where handle like $1 or de like $1`, [tag + '%']);
await db.query(`delete from lanternas where handle in ('a1x','a2x','a3x','a4x')`);
await db.query(`delete from pagamentos where handle like $1 or handle = 'x1'`, [tag + '%']);
await db.query(`delete from ig_comentarios where username = $1`, [tag]);
await db.end(); srv.kill(); mp.close();
if (falhas) console.log('\n--- log do servidor ---\n' + log.slice(-3000));
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK'); process.exit(falhas ? 1 : 0);
