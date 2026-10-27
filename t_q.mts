import pg from 'pg'; const c = new pg.Client({ connectionString: 'postgres://smn@127.0.0.1:54329/ceu2027' }); await c.connect();
console.log((await c.query(`select id, handle, desejo, cidade, uf, estado, codigo from lanternas`)).rows);
console.log((await c.query(`select comment_id, estado, resposta, direct, direct_estado from ig_comentarios`)).rows.map(r => ({ ...r, direct: r.direct?.replace(/\n/g, ' ⏎ ') })));
await c.end();
