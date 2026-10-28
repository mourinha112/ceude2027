/* Peças do vídeo. Regras (skill remotion-markup + motion): tudo movido por useCurrentFrame/interpolate/spring,
   nada de animação CSS; entra maior que o natural e assenta; sai acelerando; fundo nunca parado (câmera na mão). */
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Video } from '@remotion/media';
import { loadFont as bigShoulders } from '@remotion/google-fonts/BigShoulders';
import { loadFont as caveat } from '@remotion/google-fonts/Caveat';
import { loadFont as archivo } from '@remotion/google-fonts/Archivo';

export const DISP = bigShoulders('normal', { weights: ['800', '900'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const MAO = caveat('normal', { weights: ['700'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const SANS = archivo('normal', { weights: ['500', '700'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const COR = { noite: '#090a1c', papel: '#f3ead8', tinta: '#1e1a28', ouro: '#f2b33d', brasa: '#d9532b' };
const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SAI = Easing.bezier(0.7, 0, 0.84, 0);   // sair acelera

/** câmera na mão: deriva leve e contínua (nenhum quadro morto) + zoom lento opcional */
export const NaMao: FC<{ children: ReactNode; amp?: number; zoom?: [number, number] }> = ({ children, amp = 5, zoom = [1.05, 1.05] }) => {
  const f = useCurrentFrame(), { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{
      translate: `${Math.sin(f * 0.071) * amp + Math.sin(f * 0.173 + 1) * amp * 0.45}px ${Math.cos(f * 0.063) * amp + Math.sin(f * 0.151) * amp * 0.4}px`,
      rotate: `${Math.sin(f * 0.047) * 0.22}deg`,
      scale: interpolate(f, [0, durationInFrames], zoom, CL),
    }}>{children}</AbsoluteFill>
  );
};

/** entra com soco: começa grande e assenta em ~8 quadros (o corte acontece no movimento) */
export const Soco: FC<{ children: ReactNode; de?: number }> = ({ children, de = 1.13 }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 16, stiffness: 170, mass: 0.7 } });
  return <AbsoluteFill style={{ scale: interpolate(s, [0, 1], [de, 1]), filter: `blur(${interpolate(f, [0, 4], [6, 0], CL)}px)` }}>{children}</AbsoluteFill>;
};

/** trecho de uma cena gravada do app (video/public/clipes) */
export const Clip: FC<{ nome: string; de?: number; style?: CSSProperties }> = ({ nome, de = 0, style }) => {
  const { fps } = useVideoConfig();
  return <Video src={staticFile(`clipes/${nome}.mp4`)} trimBefore={Math.round(de * fps)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />;
};

/** a tela do app numa moldura de celular, mais baixa, deixando o topo pras legendas */
export const Celular: FC<{ children: ReactNode }> = ({ children }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), s = spring({ frame: f, fps, config: { damping: 18, stiffness: 120 } });
  const k = 0.76, w = 1080 * k, h = 1920 * k;
  return (
    <div style={{ position: 'absolute', left: (1080 - w) / 2, top: 400, width: w, height: h, translate: `0 ${interpolate(s, [0, 1], [260, 0])}px`, rotate: `${interpolate(s, [0, 1], [3, 0]) + Math.sin(f * 0.05) * 0.35}deg`, borderRadius: 54, overflow: 'hidden', boxShadow: '0 0 0 10px #05050d, 0 0 0 12px #2a2840, 0 60px 120px -30px #000' }}>
      <div style={{ width: 1080, height: 1920, scale: String(k), transformOrigin: '0 0' }}>{children}</div>
    </div>
  );
};

/** legenda de criador: palavra por palavra, cada uma "colada" com um tranco; a marcada vira fita de papel */
export type Linha = { t: string; fita?: boolean; tam?: number; cor?: string };
export const Legenda: FC<{ linhas: Linha[]; y: number; ate: number; tam?: number; passo?: number }> = ({ linhas, y, ate, tam = 118, passo = 4 }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  let k = 0;
  const sair = interpolate(f, [ate - 6, ate], [0, 1], { ...CL, easing: SAI });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: y, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, opacity: 1 - sair, translate: `0 ${-40 * sair}px`, scale: String(1 - 0.08 * sair) }}>
      {linhas.map((l, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 22px' }}>
          {(l.fita ? [l.t] : l.t.split(' ')).map((p, j) => {
            const atraso = k++ * passo, s = spring({ frame: f - atraso, fps, config: { damping: 11, stiffness: 210, mass: 0.55 } });
            const tamP = l.tam ?? tam;
            return (
              <span key={j} style={{
                fontFamily: DISP, fontWeight: 900, fontSize: tamP, lineHeight: 0.98, textTransform: 'uppercase', letterSpacing: 1,
                color: l.fita ? COR.tinta : l.cor || COR.papel,
                background: l.fita ? COR.papel : 'transparent', padding: l.fita ? '6px 22px 0' : 0, borderRadius: l.fita ? 6 : 0,
                boxShadow: l.fita ? '0 8px 0 #c9b994, 0 26px 40px -14px rgba(0,0,0,.7)' : 'none',
                textShadow: l.fita ? 'none' : '0 0 3px #0b0a18, 0 4px 0 #0b0a18, 3px 3px 0 #0b0a18, -3px 3px 0 #0b0a18, 3px -3px 0 #0b0a18, -3px -3px 0 #0b0a18, 0 18px 40px rgba(0,0,0,.8)',
                opacity: f >= atraso ? 1 : 0,
                scale: String(interpolate(s, [0, 1], [l.fita ? 1.5 : 1.32, 1])),
                rotate: `${(l.fita ? -2.5 : (j % 2 ? 1.2 : -1.4)) * interpolate(s, [0, 1], [2.5, 1])}deg`,
                display: 'inline-block',
              }}>{p}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** letra de mão (Caveat), escreve da esquerda pra direita */
export const Mao: FC<{ t: string; x: number; y: number; tam?: number; giro?: number; cor?: string; ate?: number; centro?: boolean }> = ({ t, x, y, tam = 64, giro = -4, cor = COR.ouro, ate = 9999, centro }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, Math.max(8, t.length * 1.2)], [0, 100], CL), sair = interpolate(f, [ate - 6, ate], [0, 1], CL);
  return (
    <div style={{ position: 'absolute', left: centro ? 0 : x, right: centro ? 0 : undefined, top: y, textAlign: centro ? 'center' : 'left', fontFamily: MAO, fontWeight: 700, fontSize: tam, color: cor, rotate: `${giro}deg`, whiteSpace: 'nowrap', textShadow: '0 3px 0 #0b0a18, 0 0 18px rgba(0,0,0,.8)', clipPath: `inset(-20% ${100 - p}% -20% -5%)`, opacity: 1 - sair }}>{t}</div>
  );
};

/** rabisco desenhado à mão: círculo torto, seta ou sublinhado (o traço "corre" como caneta) */
export function circuloMao(cx: number, cy: number, rx: number, ry: number) {
  const pts: string[] = [];
  for (let i = 0; i <= 44; i++) { const a = -2.1 + (i / 44) * Math.PI * 2.25, w = 1 + Math.sin(i * 1.7) * 0.035 + i * 0.0018; pts.push(`${(cx + Math.cos(a) * rx * w).toFixed(1)},${(cy + Math.sin(a) * ry * w).toFixed(1)}`); }
  return 'M' + pts.join(' L');
}
export const Rabisco: FC<{ d: string; dur?: number; cor?: string; larg?: number; ate?: number }> = ({ d, dur = 12, cor = COR.ouro, larg = 11, ate = 9999 }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, dur], [0, 1], { ...CL, easing: Easing.bezier(0.45, 0, 0.2, 1) }), sair = interpolate(f, [ate - 5, ate], [1, 0], CL);
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, opacity: sair, overflow: 'visible' }}>
      <path d={d} fill="none" stroke="#0b0a18" strokeWidth={larg + 8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} opacity={0.55} />
      <path d={d} fill="none" stroke={cor} strokeWidth={larg} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} />
    </svg>
  );
};

/** campo de comentário genérico (sem marca de rede social) digitando a cidade */
export const Comentario: FC<{ texto: string; deDigitar: number; porLetra?: number; toque: number }> = ({ texto, deDigitar, porLetra = 3, toque }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 15, stiffness: 160 } }), letras = [...texto];
  const n = Math.max(0, Math.min(letras.length, Math.floor((f - deDigitar) / porLetra) + 1)), enviado = f >= toque;
  const cursor = !enviado && Math.floor(f / 8) % 2 === 0;
  const aperto = interpolate(f, [toque - 2, toque, toque + 5], [1, 0.9, 1], CL);
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: 1290, translate: `0 ${interpolate(s, [0, 1], [260, 0])}px`, opacity: interpolate(f, [toque + 4, toque + 10], [1, 0], CL) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, background: '#fff', borderRadius: 999, padding: '18px 22px 18px 18px', boxShadow: '0 30px 60px -20px rgba(0,0,0,.8)' }}>
        <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'conic-gradient(from 200deg, #f9ce34, #ee2a7b, #6228d7, #f9ce34)', padding: 5, flex: 'none' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#d9cfc0', border: '5px solid #fff', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, fontFamily: SANS, fontWeight: 500, fontSize: 50, color: n ? '#111' : '#9a9a9a' }}>{n ? letras.slice(0, n).join('') : 'Adicione um comentário…'}{cursor ? <span style={{ color: '#3a7bff' }}>|</span> : null}</div>
        <div style={{ width: 92, height: 92, borderRadius: '50%', background: n === letras.length ? '#3a7bff' : '#c9d6ff', display: 'grid', placeItems: 'center', scale: String(aperto), flex: 'none' }}>
          <svg width={46} height={46} viewBox="0 0 24 24"><path d="M5 12h13M12 5l7 7-7 7" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
      {f >= toque - 3 && f < toque + 14 ? <Toque x={900} y={60} f={f - toque + 3} /> : null}
    </div>
  );
};
/** marca de toque do dedo */
export const Toque: FC<{ x: number; y: number; f: number }> = ({ x, y, f }) => {
  const r = interpolate(f, [0, 14], [30, 110], CL), o = interpolate(f, [0, 3, 14], [0.0, 0.85, 0], CL);
  return <div style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: '50%', background: 'rgba(255,255,255,.35)', border: '5px solid rgba(255,255,255,.9)', opacity: o }} />;
};

/** notificação de mensagem genérica descendo do topo */
export const Notificacao: FC<{ toque: number }> = ({ toque }) => {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), s = spring({ frame: f, fps, config: { damping: 14, stiffness: 150 } });
  const zoom = interpolate(f, [toque + 2, toque + 12], [1, 1.06], { ...CL, easing: SAI });
  return (
    <div style={{ position: 'absolute', left: 40, right: 40, top: 240, translate: `0 ${interpolate(s, [0, 1], [-420, 0])}px`, scale: String(interpolate(f, [toque - 2, toque, toque + 4], [1, 0.97, 1], CL) * zoom) }}>
      <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start', background: 'rgba(250,247,240,.97)', borderRadius: 44, padding: '30px 34px', boxShadow: '0 40px 80px -24px rgba(0,0,0,.85)' }}>
        <div style={{ width: 96, height: 96, borderRadius: 26, background: COR.noite, display: 'grid', placeItems: 'center', flex: 'none' }}>
          <div style={{ width: 40, height: 52, borderRadius: '46% 46% 28% 28%', background: 'linear-gradient(180deg,#e8743b,#ffcf6e 70%,#fff1c7)', boxShadow: '0 0 26px 8px rgba(240,140,60,.55)' }} />
        </div>
        <div style={{ flex: 1, fontFamily: SANS, color: '#141414' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 40, fontWeight: 700 }}><span>ceude2027</span><span style={{ fontWeight: 500, color: '#888', fontSize: 34 }}>agora</span></div>
          <div style={{ fontSize: 40, fontWeight: 500, lineHeight: 1.25, marginTop: 6 }}>Oi! Sua lanterna no céu de Recife está te esperando 🏮 toque pra abrir</div>
        </div>
      </div>
      {f >= toque - 3 && f < toque + 14 ? <Toque x={620} y={150} f={f - toque + 3} /> : null}
    </div>
  );
};

/** lanterna que dispara do comentário pro céu, com rastro de faíscas */
export const LanternaVoa: FC<{ x: number; y: number }> = ({ x, y }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, 26], [0, 1], { ...CL, easing: Easing.bezier(0.55, 0, 0.9, 0.6) });
  const ly = y - p * (y + 260), lx = x + Math.sin(p * 5) * 40, sc = 1.25 - p * 0.55;
  const faiscas = Array.from({ length: 18 }, (_, i) => { const q = Math.max(0, p - i * 0.035); return { y: y - q * (y + 260) + 70, x: x + Math.sin(q * 5) * 40 + Math.sin(i * 2.3 + f * 0.6) * (10 + i * 2), o: (1 - i / 18) * (q > 0 ? 1 : 0), r: 9 - i * 0.35 }; });
  return (
    <>
      {faiscas.map((s, i) => <div key={i} style={{ position: 'absolute', left: s.x - s.r, top: s.y - s.r, width: s.r * 2, height: s.r * 2, borderRadius: '50%', background: '#fff3d0', boxShadow: '0 0 18px 6px rgba(255,200,110,.7)', opacity: s.o }} />)}
      <div style={{ position: 'absolute', left: lx - 60, top: ly - 78, width: 120, height: 156, scale: String(sc), borderRadius: '46% 46% 28% 28%', background: 'linear-gradient(180deg,#e8743b,#ffcf6e 70%,#fff1c7)', boxShadow: '0 0 90px 40px rgba(240,140,60,.55), inset 0 -26px 30px -10px #fff6d8' }} />
    </>
  );
};

/** granulado de filme (muda a cada 2 quadros) + vinheta: tira a cara de "render limpo" */
export const Pelicula: FC = () => {
  const f = useCurrentFrame(), sem = Math.floor(f / 2) % 97;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, opacity: 0.085, mixBlendMode: 'overlay' }}>
        <filter id={`g${sem}`}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={sem} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter={`url(#g${sem})`} />
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 80% at 50% 45%, transparent 55%, rgba(0,0,0,.55) 100%)' }} />
    </AbsoluteFill>
  );
};

/** faixa escura atrás das legendas do topo (leitura em qualquer fundo) */
export const Sombra: FC<{ topo?: boolean }> = ({ topo = true }) => (
  <AbsoluteFill style={{ background: topo ? 'linear-gradient(180deg, rgba(6,6,18,.82) 0%, rgba(6,6,18,.45) 24%, transparent 40%)' : 'linear-gradient(0deg, rgba(6,6,18,.8) 0%, transparent 40%)' }} />
);

/** clarão quente (corte de impacto) */
export const Clarao: FC<{ dur?: number; forte?: number }> = ({ dur = 10, forte = 0.85 }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, #fff8e6, #ffd27a 40%, rgba(255,160,60,0) 75%)', opacity: interpolate(f, [0, 1, dur], [0, forte, 0], CL), mixBlendMode: 'screen' }} />;
};

/** treme a tela (estouro) */
export const Treme: FC<{ children: ReactNode; em: number; forca?: number }> = ({ children, em, forca = 16 }) => {
  const f = useCurrentFrame(), k = interpolate(f, [em, em + 14], [1, 0], CL) * (f >= em ? 1 : 0);
  return <AbsoluteFill style={{ translate: `${Math.sin(f * 2.7) * forca * k}px ${Math.cos(f * 3.1) * forca * k}px` }}>{children}</AbsoluteFill>;
};
