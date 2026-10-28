/* Céu de 2027 · dados de DEMONSTRAÇÃO (fictícios): cidades, desejos e @ gerados. */
export const MARCA = { nome: 'Céu de 2027', ig: '@ceude2027' };

export type Tipo = 0 | 1 | 2 | 3;   // 0 normal · 1 dourada · 2 empresa · 3 casal
export const CIDADES: [string, string, number][] = [
  ['São Paulo', 'SP', 12.3], ['Rio de Janeiro', 'RJ', 6.7], ['Brasília', 'DF', 3], ['Salvador', 'BA', 2.9], ['Fortaleza', 'CE', 2.7], ['Belo Horizonte', 'MG', 2.5],
  ['Manaus', 'AM', 2.2], ['Curitiba', 'PR', 1.9], ['Recife', 'PE', 1.6], ['Goiânia', 'GO', 1.5], ['Porto Alegre', 'RS', 1.5], ['Belém', 'PA', 1.5],
  ['Guarulhos', 'SP', 1.4], ['Campinas', 'SP', 1.2], ['São Luís', 'MA', 1.1], ['Maceió', 'AL', 1], ['Natal', 'RN', 0.9], ['Teresina', 'PI', 0.9],
  ['Campo Grande', 'MS', 0.9], ['João Pessoa', 'PB', 0.8], ['Cuiabá', 'MT', 0.65], ['Aracaju', 'SE', 0.65], ['Florianópolis', 'SC', 0.55], ['Vitória', 'ES', 0.4],
  ['Vila Velha', 'ES', 0.5], ['Uberlândia', 'MG', 0.7], ['Ribeirão Preto', 'SP', 0.7], ['Feira de Santana', 'BA', 0.6], ['Juiz de Fora', 'MG', 0.57], ['Londrina', 'PR', 0.58],
  ['Porto Velho', 'RO', 0.55], ['Macapá', 'AP', 0.5], ['Boa Vista', 'RR', 0.43], ['Rio Branco', 'AC', 0.4], ['Palmas', 'TO', 0.31], ['Caxias do Sul', 'RS', 0.5],
];
export const DESEJOS = [
  'casa própria em 2027 🏠', 'passar no concurso!!', 'saúde pra minha mãe ❤️', 'viajar pro nordeste com a família', 'emprego novo', 'pagar todas as dívidas',
  'voltar pra academia de verdade', 'meu filho nascer com saúde', 'tirar a carteira de motorista', 'abrir meu próprio negócio', 'conhecer a praia pela 1ª vez',
  'paz e muito trabalho', 'me formar na faculdade 🎓', 'que minha vó fique bem', 'comprar meu carro', 'mais tempo com quem eu amo', 'ser feliz e ponto',
  'meu time ser campeão ⚽', 'aprender inglês', 'casar com ela 💍', 'sair do aluguel', 'que todo mundo da família tenha saúde', 'ganhar mais e trabalhar menos',
  'viajar pra fora do país ✈️', 'paz no coração', 'reconstruir minha vida', 'meu primeiro apartamento', 'emagrecer com saúde', 'ver minha mãe sorrindo', 'que 2027 seja leve',
];
const NOMES = ['ana', 'lucas', 'julia', 'pedro', 'bia', 'gabriel', 'maria', 'joao', 'duda', 'rafa', 'carol', 'thiago', 'leticia', 'vini', 'nanda', 'gui', 'isa', 'bruno', 'lari', 'matheus', 'sofia', 'enzo', 'alice', 'davi', 'manu', 'caio', 'clara', 'igor', 'yasmin', 'renata'];
const SOBRE = ['silva', 'santos', 'souza', 'lima', 'costa', 'rocha', 'alves', 'melo', 'nunes', 'reis', 'dias', 'moura', 'barros', 'freitas'];
export const EMPRESAS: { nome: string; ig: string; oferta: string; cor: string; logo?: string }[] = [
  { nome: 'The Pet House', ig: 'thepethouse.vilas', oferta: 'rações, petiscos e acessórios: tudo que seu pet precisa', cor: '#d62828', logo: '/logos/the-pet-house.png' },
  { nome: 'Padaria Pão Quente', ig: 'paoquente', oferta: 'panetone com 15% off até o Natal', cor: '#2bd4c0' },
  { nome: 'Studio Bella', ig: 'studiobella', oferta: 'escova + unha na promoção de fim de ano', cor: '#ff6bb5' },
  { nome: 'Academia Força Total', ig: 'forcatotal', oferta: 'janeiro grátis pra quem soltou lanterna', cor: '#6f8cff' },
  { nome: 'Pizzaria Forno a Lenha', ig: 'fornoalenha', oferta: 'pizza grande + refri na virada', cor: '#ff7a3d' },
  { nome: 'Ótica Visão', ig: 'oticavisao', oferta: 'óculos de sol 2027 com 20% off', cor: '#8de05a' },
  { nome: 'Pet Amigo', ig: 'petamigo', oferta: 'banho e tosa de Natal', cor: '#c18cff' },
];

let semente = 20271231;
export const rnd = () => { semente ^= semente << 13; semente ^= semente >>> 17; semente ^= semente << 5; return ((semente >>> 0) % 1_000_000) / 1_000_000; };
export const handleFake = () => { const n = NOMES[Math.floor(rnd() * NOMES.length)], r = rnd(); return r < 0.35 ? n + SOBRE[Math.floor(rnd() * SOBRE.length)] : r < 0.7 ? `${n}_${Math.floor(1985 + rnd() * 23)}` : `${n}.${SOBRE[Math.floor(rnd() * SOBRE.length)]}`; };
export function cidadeSorteada() { const tot = CIDADES.reduce((s, c) => s + c[2], 0); let r = rnd() * tot; for (let i = 0; i < CIDADES.length; i++) { r -= CIDADES[i][2]; if (r <= 0) return i; } return 0; }
export const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
/** virada: 1/1/2027 00:00 em Brasília */
export const VIRADA = Date.UTC(2027, 0, 1, 3, 0, 0);
export function faltam(ms = VIRADA - Date.now()) { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }; }
/* filtro simples de texto (o servidor de verdade usa a moderação do ViraRua) */
const RUINS = ['porra', 'caralho', 'merda', 'puta', 'fdp', 'vtnc', 'buceta', 'cu ', 'viado', 'bosta', 'otario', 'idiota', 'macaco'];
export const textoOk = (t: string) => { const x = ' ' + t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' '; return !RUINS.some((r) => x.includes(r)) && !/https?:|www\.|@\w/.test(x); };
