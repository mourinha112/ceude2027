/* "ao vivo": o site busca as lanternas novas a cada poucos segundos (GET /api/ceu/novas?desde=ID).
   Aqui só fica o maior id conhecido em memória para responder rápido quando não há nada novo. */
let maior = 0;
export function aoVivo(id: number) { if (id > maior) maior = id; }
export const maiorId = () => maior;
