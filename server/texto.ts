/* Do comentário para a lanterna: acha a cidade (5.571 municípios do IBGE), separa o desejo e modera o texto. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sem = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
type Mun = { nome: string; uf: string; pop: number; k: string };
const MUN: Mun[] = (JSON.parse(readFileSync(resolve(import.meta.dirname, 'data/municipios.json'), 'utf8')) as [number, string, string, number][])
  .map(([, nome, uf, pop]) => ({ nome, uf, pop, k: sem(nome) }));
// nomes longos primeiro ("São José dos Campos" antes de "São José"); entre homônimos, o mais populoso
const ORDEM = [...MUN].sort((a, b) => b.k.length - a.k.length || b.pop - a.pop);
const UFS = new Set(['ac', 'al', 'ap', 'am', 'ba', 'ce', 'df', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'sp', 'se', 'to']);
const ESTADOS: Record<string, string> = { acre: 'ac', alagoas: 'al', amapa: 'ap', amazonas: 'am', bahia: 'ba', ceara: 'ce', goias: 'go', maranhao: 'ma', paraiba: 'pb', parana: 'pr', pernambuco: 'pe', piaui: 'pi', rondonia: 'ro', roraima: 'rr', sergipe: 'se', tocantins: 'to' };
const APELIDOS: Record<string, [string, string]> = { 'sampa': ['São Paulo', 'SP'], 'bh': ['Belo Horizonte', 'MG'], 'poa': ['Porto Alegre', 'RS'], 'floripa': ['Florianópolis', 'SC'], 'rio': ['Rio de Janeiro', 'RJ'], 'sp': ['São Paulo', 'SP'], 'rj': ['Rio de Janeiro', 'RJ'], 'bsb': ['Brasília', 'DF'], 'ssa': ['Salvador', 'BA'] };
const PALAVRAS_COMUNS = new Set(['paz', 'amor', 'saude', 'sorte', 'vitoria', 'esperanca', 'alegria', 'uniao', 'feliz', 'fe', 'vida', 'luz', 'gloria', 'bonito', 'formosa', 'serra', 'cruz', 'alianca', 'liberdade', 'harmonia', 'bom jesus', 'boa vista', 'belem', 'natal', 'palmas', 'triunfo', 'jardim', 'centro', 'nova', 'esperanca', 'progresso', 'sucesso', 'canaa', 'brasil']);

/** separa cidade e desejo. Aceita "Recife - casa própria", "casa própria (Recife PE)", "Floripa: viajar" etc. */
export function lerComentario(texto: string) {
  const limpo = texto.replace(/@[\w.]+/g, ' ').replace(/#\w+/g, ' ').replace(/https?:\S+/g, ' ').replace(/\s+/g, ' ').trim();
  const s = ' ' + sem(limpo).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let cidade: { nome: string; uf: string } | null = null, achado = '', melhor = 0;
  // todas as cidades que aparecem no texto; vence a de maior pontuação:
  // população × (UF certa escrita do lado ×200) × (no começo do texto ×4) · palavras comuns ("paz", "natal"…) só valem com UF
  for (const m of ORDEM) {
    if (m.k.length < 3) continue;
    const i = s.indexOf(' ' + m.k + ' ');
    if (i < 0) continue;
    const tok = s.slice(i + m.k.length + 2).split(' ')[0], ufTok = UFS.has(tok) ? tok : ESTADOS[tok] || '';
    const comUf = ufTok === m.uf.toLowerCase();
    if (PALAVRAS_COMUNS.has(m.k) && !comUf) continue;
    const pts = Math.max(1, m.pop) * (comUf ? 200 : 1) * (i <= 1 ? 4 : 1) * (m.k.length >= 6 ? 1.5 : 1);
    if (pts > melhor) { melhor = pts; cidade = { nome: m.nome, uf: m.uf }; achado = comUf ? m.k + ' ' + tok : m.k; }
  }
  if (!cidade) for (const [k, v] of Object.entries(APELIDOS)) if (s.includes(' ' + k + ' ')) { cidade = { nome: v[0], uf: v[1] }; achado = k; break; }
  // desejo = o texto sem o pedaço da cidade e sem separadores nas pontas
  let desejo = limpo;
  if (achado) {
    const partes = achado.split(' ');
    const re = new RegExp(partes.map((p) => p.split('').map((ch) => `[${ch}${({ a: 'áàâã', e: 'éê', i: 'í', o: 'óôõ', u: 'úü', c: 'ç' } as Record<string, string>)[ch] || ''}]`).join('')).join('[\\s,.\\-/]*'), 'i');
    desejo = desejo.replace(re, ' ');
  }
  desejo = desejo.replace(/[(\[{]\s*[)\]}]/g, ' ').replace(/^[\s\-–—:,.;|/]+|[\s\-–—:,;|/(]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
  return { cidade, desejo };
}

/* moderação: palavrão, ofensa, link, telefone, @ no texto. Desejo bloqueado vira "desejo guardado em segredo". */
const PALAVROES = ['puta', 'puto', 'fdp', 'vtnc', 'vsf', 'pica', 'rola', 'cu', 'viado', 'bosta', 'corno', 'bet', 'lula', 'bolsonaro', 'pix'];
const RADICAIS = ['porra', 'caralh', 'merd', 'bucet', 'bocet', 'otari', 'idiot', 'macac', 'arrombad', 'desgrac', 'piranh', 'vagabund', 'retardad', 'nazi', 'hitler', 'estupr', 'onlyfans', 'privacy', 'tigrinho', 'cassin', 'aposta', 'chave pix', 'matar ', 'morte a'];
export function desejoOk(t: string) {
  const x = ' ' + sem(t).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  if (PALAVROES.some((w) => x.includes(' ' + w + ' ')) || RADICAIS.some((r) => x.includes(' ' + r))) return false;
  if (/https?:|www\.|\.com|@\w|\d{8,}/i.test(t)) return false;
  return t.trim().length >= 2;
}
export const limparHandle = (h: string) => h.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30);
