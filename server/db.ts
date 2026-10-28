/* Banco (Postgres). O esquema é criado/atualizado sozinho ao subir (idempotente: só "if not exists"). */
import pg from 'pg';
import { config } from './config';

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
export const q = async <T = any>(sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows as T[];
export const q1 = async <T = any>(sql: string, p: unknown[] = []) => (await pool.query(sql, p)).rows[0] as T | undefined;

const ESQUEMA = `
create table if not exists lanternas (
  id serial primary key,
  handle text not null,
  desejo text not null,
  desejo_oculto boolean not null default false,
  cidade text not null default 'Brasil',
  uf text not null default '',
  tipo smallint not null default 0,          -- 0 normal · 1 dourada · 2 empresa · 3 casal
  par text,                                  -- casal: o outro @ · presente: quem deu
  de text,
  forca real not null default 0,
  origem text not null default 'ig',         -- ig · pix · admin
  ig_comment_id text unique,
  empresa jsonb,                             -- {nome, ig, oferta, cor}
  oculta boolean not null default false,
  realizado_em timestamptz,
  estado text not null default 'no_ceu',      -- pendente (esperando a pessoa escolher no link) · no_ceu
  codigo text unique,                        -- link pessoal /l/CODIGO (vai no direct)
  solta_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists lanternas_handle on lanternas (lower(handle));
create index if not exists lanternas_cidade on lanternas (cidade, uf);
alter table lanternas add column if not exists estado text not null default 'no_ceu';
alter table lanternas add column if not exists codigo text unique;
alter table lanternas add column if not exists solta_em timestamptz;
create index if not exists lanternas_pendentes on lanternas (estado, criado_em) where estado = 'pendente';
create table if not exists fortalecidas (lanterna_id int not null references lanternas(id) on delete cascade, aparelho text not null, criado_em timestamptz not null default now(), primary key (lanterna_id, aparelho));
create table if not exists ig_comentarios (
  comment_id text primary key, media_id text, from_id text, username text, texto text, recebido_em timestamptz not null default now(),
  estado text not null default 'novo', lanterna_id int, resposta text, resposta_estado text, tentativas int not null default 0, erro text,
  direct text, direct_estado text, direct_tentativas int not null default 0, direct_erro text
);
alter table ig_comentarios add column if not exists direct text;
alter table ig_comentarios add column if not exists direct_estado text;
alter table ig_comentarios add column if not exists direct_tentativas int not null default 0;
alter table ig_comentarios add column if not exists direct_erro text;
create table if not exists pagamentos (
  id text primary key, mp_id text unique, tipo text not null, valor numeric(10,2) not null, handle text not null, par text, desejo text, cidade text, uf text,
  status text not null default 'pendente', lanterna_id int, codigo text, criado_em timestamptz not null default now(), pago_em timestamptz
);
alter table pagamentos add column if not exists codigo text;
alter table pagamentos add column if not exists alvo int;            -- topo: a lanterna que sobe pro topo
alter table pagamentos add column if not exists nomes text[];        -- família: os @ de quem ganha
alter table lanternas add column if not exists destaque_ate timestamptz;
alter table lanternas add column if not exists visual jsonb;          -- personalização: {cor, skin, rastro, faixa}
alter table pagamentos add column if not exists visual jsonb;        -- o que foi comprado nesse Pix   -- no topo do céu da cidade até essa hora
create table if not exists pedidos_empresa (id serial primary key, nome text, ig text, zap text, cidade text, pacote text, criado_em timestamptz not null default now(), visto boolean not null default false);
create table if not exists logos (id serial primary key, tipo text not null, dados bytea not null, criado_em timestamptz not null default now());
create table if not exists config (chave text primary key, valor text not null, atualizado_em timestamptz not null default now());
`;
export async function migrar() { await pool.query(ESQUEMA); }
export async function lerConfig(chave: string) { return (await q1<{ valor: string }>(`select valor from config where chave = $1`, [chave]))?.valor ?? null; }
export async function gravarConfig(chave: string, valor: string) { await q(`insert into config (chave, valor) values ($1, $2) on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()`, [chave, valor]); }
