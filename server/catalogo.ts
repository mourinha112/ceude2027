/* Personalização da lanterna (usado pelo servidor e pelo site). Só dados: nada de node aqui.
   O preço é sempre calculado no servidor a partir daqui; o site só mostra. */
export type Visual = { cor?: string; skin?: string; rastro?: boolean; faixa?: string };

// cor lisa
export const CORES: { k: string; n: string; c: string }[] = [
  { k: 'rosa', n: 'Rosa', c: '#ff6fa8' }, { k: 'azul', n: 'Azul', c: '#4f9dff' }, { k: 'verde', n: 'Verde', c: '#3fd884' },
  { k: 'roxo', n: 'Roxa', c: '#a873ff' }, { k: 'branca', n: 'Branca', c: '#fff3dc' }, { k: 'vermelha', n: 'Vermelha', c: '#ff4a3d' },
];
// skins: estampa desenhada na lanterna. pat: 1 listras · 2 coração · 3 estrelas · 4 Brasil · 5 arco-íris
// (cores de time só como cores: sem escudo, sem nome de clube)
export const SKINS: { k: string; n: string; pat: number; c1: string; c2: string }[] = [
  { k: 'coracao', n: 'Coração', pat: 2, c1: '#ff5d8f', c2: '#ffe3ec' },
  { k: 'estrelada', n: 'Estrelada', pat: 3, c1: '#3d47b8', c2: '#ffe9a8' },
  { k: 'brasil', n: 'Brasil', pat: 4, c1: '#1fa64a', c2: '#ffd400' },
  { k: 'arcoiris', n: 'Arco-íris', pat: 5, c1: '#ff6b6b', c2: '#6bc6ff' },
  { k: 'pretobranco', n: 'Preto e branco', pat: 1, c1: '#202020', c2: '#f4f4f4' },
  { k: 'vermelhopreto', n: 'Vermelho e preto', pat: 1, c1: '#d8262c', c2: '#1a1a1a' },
  { k: 'verdebranco', n: 'Verde e branco', pat: 1, c1: '#11934a', c2: '#f4f4f4' },
  { k: 'azulbranco', n: 'Azul e branco', pat: 1, c1: '#1e63d6', c2: '#f4f4f4' },
];
export const PRECO_VISUAL = { faixa: 6.9, cor: 2.9, skin: 4.9, rastro: 3.9, desconto3: 1.8 };
export const FAIXA_MAX = 28;

/** limpa o que veio do site: só chaves do catálogo; skin e cor não vão juntas (a skin manda) */
export function lerVisual(v: any): Visual {
  const o: Visual = {};
  if (v && typeof v === 'object') {
    if (SKINS.some((s) => s.k === v.skin)) o.skin = v.skin;
    else if (CORES.some((c) => c.k === v.cor)) o.cor = v.cor;
    if (v.rastro === true || v.rastro === 1 || v.rastro === '1') o.rastro = true;
    const f = String(v.faixa || '').replace(/\s+/g, ' ').trim().slice(0, FAIXA_MAX);
    if (f.length >= 2) o.faixa = f;
  }
  return o;
}
/** preço dos itens novos (o que já está na lanterna não cobra de novo) */
export function precoVisual(v: Visual, ja: Visual = {}) {
  const p = PRECO_VISUAL; let t = 0, n = 0;
  if (v.faixa && v.faixa !== ja.faixa) { t += p.faixa; n++; }
  if (v.skin && v.skin !== ja.skin) { t += p.skin; n++; } else if (v.cor && v.cor !== ja.cor && !v.skin) { t += p.cor; n++; }
  if (v.rastro && !ja.rastro) { t += p.rastro; n++; }
  if (n >= 3) t -= p.desconto3;
  return Math.round(t * 100) / 100;
}
/** só os itens que estão sendo comprados agora (pra gravar por cima do que já tinha) */
export function novos(v: Visual, ja: Visual = {}): Visual {
  const o: Visual = {};
  if (v.faixa && v.faixa !== ja.faixa) o.faixa = v.faixa;
  if (v.skin && v.skin !== ja.skin) o.skin = v.skin; else if (v.cor && v.cor !== ja.cor && !v.skin) o.cor = v.cor;
  if (v.rastro && !ja.rastro) o.rastro = true;
  return o;
}
export const vazio = (v: Visual) => !v.faixa && !v.cor && !v.skin && !v.rastro;
