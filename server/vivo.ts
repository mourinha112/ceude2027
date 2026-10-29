/* "ao vivo": o site busca as lanternas novas a cada poucos segundos (GET /api/ceu/novas?desde=ORDEM).
   Segue a ORDEM DE SOLTURA (não o id: o id nasce no comentário e a lanterna pode subir horas depois).
   Aqui fica a maior ordem já no céu, em memória, para responder rápido quando não há nada novo. */
import { q1 } from './db';
let maior = 0;
export async function aoVivo() { const r = await q1<{ m: number }>(`select coalesce(max(ordem), 0)::int m from lanternas where estado = 'no_ceu'`); maior = r?.m || 0; }
export const maiorId = () => maior;
