/* Configuração por variáveis de ambiente (.env no servidor; nunca no git). */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// carrega .env simples (CHAVE=valor) se existir
const arq = resolve(process.cwd(), '.env');
if (existsSync(arq)) for (const l of readFileSync(arq, 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
const env = (k: string, d = '') => process.env[k] ?? d;

export const config = {
  porta: Number(env('PORT', '8810')),
  databaseUrl: env('DATABASE_URL', 'postgres://ceu@127.0.0.1:5432/ceu2027'),
  site: env('SITE_URL', 'http://localhost:5310').replace(/\/$/, ''),
  adminSenha: env('ADMIN_SENHA'),
  segredo: env('CHAVE_SESSAO', 'troque-isto'),
  ig: {
    appSecret: env('IG_APP_SECRET'), verifyToken: env('IG_VERIFY_TOKEN'), contaId: env('IG_CONTA_ID'), token: env('IG_TOKEN'),
    versao: env('IG_GRAPH_VERSAO', 'v26.0'), responder: env('IG_RESPONDER', '1') === '1', usuario: env('IG_USUARIO', 'ceude2027'),
  },
  mp: { token: env('MP_ACCESS_TOKEN'), segredoWebhook: env('MP_WEBHOOK_SECRET') },
  precos: { dourada: 4.9, casal: 7.9, presente: 4.9 } as Record<string, number>,
  virada: Date.UTC(2027, 0, 1, 3, 0, 0),
  producao: env('NODE_ENV') === 'production',
};
export function conferir() {
  const f: string[] = [];
  if (!config.adminSenha || config.adminSenha.length < 10) f.push('ADMIN_SENHA (mín. 10 caracteres)');
  if (config.producao && config.segredo === 'troque-isto') f.push('CHAVE_SESSAO');
  if (!config.ig.appSecret || !config.ig.verifyToken || !config.ig.contaId) f.push('IG_APP_SECRET / IG_VERIFY_TOKEN / IG_CONTA_ID (comentário → lanterna desligado)');
  if (!config.mp.token) f.push('MP_ACCESS_TOKEN (Pix desligado: só lanternas grátis)');
  return f;
}
