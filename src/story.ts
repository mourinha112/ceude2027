/* Cartão de story (1080×1920): céu, lanterna acesa, o desejo em destaque, @ e o site. Compartilha como imagem
   quando o celular deixa (Web Share com arquivo); senão baixa o PNG. */
export async function cartaoStory(o: { handle: string; desejo: string; cidade: string; tipo: number; site: string }) {
  await document.fonts?.ready;
  const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#040818'); g.addColorStop(0.55, '#1a1250'); g.addColorStop(0.82, '#5a2a6e'); g.addColorStop(1, '#f08a5d'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`; const r = Math.random() * 2.2; x.beginPath(); x.arc(Math.random() * W, Math.random() * H * 0.7, r, 0, 7); x.fill(); }
  // lanternas pequenas ao fundo
  for (let i = 0; i < 40; i++) { const lx = Math.random() * W, ly = 300 + Math.random() * 1300, s = 6 + Math.random() * 14; const gl = x.createRadialGradient(lx, ly, 0, lx, ly, s * 4); gl.addColorStop(0, 'rgba(255,190,110,.9)'); gl.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = gl; x.beginPath(); x.arc(lx, ly, s * 4, 0, 7); x.fill(); }
  // a lanterna dela
  const cx = W / 2, cy = 640, cor = o.tipo === 1 ? ['#fff4c9', '#ffd56a', 'rgba(255,220,120,'] : o.tipo === 3 ? ['#ffd1e1', '#ff7ea8', 'rgba(255,130,170,'] : ['#ffe2a8', '#ff9a3c', 'rgba(255,160,70,'];
  const halo = x.createRadialGradient(cx, cy, 0, cx, cy, 420); halo.addColorStop(0, cor[2] + '.75)'); halo.addColorStop(0.35, cor[2] + '.25)'); halo.addColorStop(1, cor[2] + '0)'); x.fillStyle = halo; x.fillRect(0, 0, W, H);
  const corpo = x.createLinearGradient(0, cy - 170, 0, cy + 170); corpo.addColorStop(0, cor[1]); corpo.addColorStop(1, cor[0]);
  x.fillStyle = corpo; x.beginPath(); x.moveTo(cx - 120, cy - 160); x.quadraticCurveTo(cx, cy - 210, cx + 120, cy - 160); x.lineTo(cx + 95, cy + 150); x.quadraticCurveTo(cx, cy + 175, cx - 95, cy + 150); x.closePath(); x.fill();
  x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(cx, cy + 130, 40, 18, 0, 0, 7); x.fill();
  // textos
  x.textAlign = 'center'; x.fillStyle = '#ffe2b0'; x.font = "800 52px 'Big Shoulders Display', sans-serif"; x.fillText('MEU DESEJO PRA 2027', cx, 1020);
  x.fillStyle = '#fffaf0'; let f = 112; x.font = `700 ${f}px Caveat, cursive`;
  const linhas = (txt: string, max: number) => { const out: string[] = []; let l = ''; for (const w of txt.split(' ')) { const t = l ? l + ' ' + w : w; if (x.measureText(t).width > max && l) { out.push(l); l = w; } else l = t; } if (l) out.push(l); return out; };
  let ls = linhas(`“${o.desejo}”`, 900); while (ls.length > 4 && f > 56) { f -= 8; x.font = `700 ${f}px Caveat, cursive`; ls = linhas(`“${o.desejo}”`, 900); }
  ls.forEach((l, i) => x.fillText(l, cx, 1140 + i * f * 1.15));
  x.font = '700 50px Archivo, sans-serif'; x.fillStyle = '#ffffff'; x.fillText('@' + o.handle, cx, 1180 + ls.length * f * 1.15 + 40);
  x.font = '500 38px Archivo, sans-serif'; x.fillStyle = '#d8d2f0'; x.fillText(`no céu de ${o.cidade}`, cx, 1240 + ls.length * f * 1.15 + 40);
  x.font = "900 92px 'Big Shoulders Display', sans-serif"; x.fillStyle = '#f3ead8'; x.fillText('CÉU DE 2027', cx, 1760);
  x.font = '600 36px Archivo, sans-serif'; x.fillStyle = '#ffffff'; x.fillText('solte a sua: ' + o.site.replace(/^https?:\/\//, ''), cx, 1830);
  const blob: Blob = await new Promise((ok) => c.toBlob((b) => ok(b!), 'image/png'));
  const arq = new File([blob], 'meu-desejo-2027.png', { type: 'image/png' });
  try { if (navigator.canShare?.({ files: [arq] })) { await navigator.share({ files: [arq], text: 'Soltei minha lanterna no Céu de 2027 🏮' }); return 'compartilhado'; } } catch { return 'cancelado'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = arq.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'baixado';
}
