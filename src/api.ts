/* Cliente da API do Céu de 2027. Lanterna compacta: [id, handle, desejo, "Cidade|UF", tipo, forca, par, de, empresa|0] */
export type Compacta = [number, string, string, string, number, number, string, string, 0 | [string, string, string, string, string?], (0 | [string, string, number, string])?];
export type CeuResp = { ok: true; total: number; cidades: number; ranking: [string, string, number][]; lanternas: Compacta[]; ultimo: number; post: string; pix: { ativo: boolean; precos: Record<string, number> }; virada: number; ig: string };
async function pedir<T>(url: string, init?: RequestInit): Promise<T & { ok: boolean; erro?: string }> {
  try {
    const r = await fetch(url, { credentials: 'same-origin', ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok !== false, ...j };
  } catch { return { ok: false, erro: 'sem conexão' } as T & { ok: boolean; erro?: string }; }
}
const post = <T>(url: string, b: unknown) => pedir<T>(url, { method: 'POST', body: JSON.stringify(b) });
export const api = {
  ceu: () => pedir<CeuResp>('/api/ceu'),
  novas: (desde: number) => pedir<{ lanternas: Compacta[]; ultimo: number; total?: number }>(`/api/ceu/novas?desde=${desde}`),
  porHandle: (h: string) => pedir<{ lanternas: Compacta[] }>(`/api/lanterna/${encodeURIComponent(h)}`),
  link: (cod: string) => pedir<{ estado: 'pendente' | 'no_ceu'; lanterna: Compacta; oculto: boolean; pix: { ativo: boolean; precos: Record<string, number> } }>(`/api/l/${encodeURIComponent(cod)}`),
  soltar: (cod: string, desejo: string) => post<{ id: number; ja?: boolean }>(`/api/l/${encodeURIComponent(cod)}/soltar`, { desejo }),
  fortalecer: (id: number, aparelho: string) => post<{ forca: number }>(`/api/lanternas/${id}/fortalecer`, { aparelho }),
  pix: (b: Record<string, unknown>) => post<{ id: string; valor: number; copia: string; qr: string }>('/api/pix', b),
  pixEstado: (id: string) => pedir<{ status: string; lanterna: number | null }>(`/api/pix/${id}`),
  pedidoEmpresa: (b: Record<string, string>) => post('/api/empresas/pedido', b),
};
export function aparelho() {
  try { let a = localStorage.getItem('c27_ap'); if (!a || !/^[a-z0-9]{12,40}$/.test(a)) { a = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20); localStorage.setItem('c27_ap', a); } return a; }
  catch { return 'semstorage' + Math.floor(Math.random() * 1e9).toString(36); }
}
