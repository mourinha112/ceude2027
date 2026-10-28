/* Céu de 2027 · vídeo de lançamento (9:16, 40 s). Cenas reais do app + motion por cima.
   Roteiro: gancho em 0–4 s (texto já se mexendo no 1º quadro, comentário sendo digitado e a lanterna disparando),
   depois o passo a passo de verdade (direct → desejo → faixa → sobe), o céu, a virada e a chamada.
   Áreas seguras de story/reels: texto importante entre y 230 e y 1500, longe da borda direita. */
import type React from 'react';
import { AbsoluteFill, Easing, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Audio } from '@remotion/media';
import { DURACAO, TEMPOS as T } from '../tempos.mjs';
import { Celular, Clarao, Clip, Comentario, LanternaVoa, Legenda, Mao, NaMao, Notificacao, Pelicula, Rabisco, Sombra, Soco, Treme, circuloMao, COR, SANS } from './pecas';

const ZoomSobe = ({ children, q }: { children: React.ReactNode; q: (s: number) => number }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ scale: String(interpolate(f, [0, q(8.55), q(9.05)], [1.22, 1.34, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.65, 0, 0.35, 1) })) }}>{children}</AbsoluteFill>;
};

export const Lancamento = () => {
  const { fps } = useVideoConfig();
  const q = (s: number) => Math.round(s * fps);   // segundos → quadros
  const cena = (de: number, ate: number) => ({ from: q(de), durationInFrames: q(ate) - q(de) });

  return (
    <AbsoluteFill style={{ background: COR.noite }}>
      {/* ───────── 0–4 s · GANCHO ───────── */}
      <Sequence name="Gancho" {...cena(0, T.corte1)}>
        <NaMao amp={6} zoom={[1.12, 1.2]}><Clip nome="ceulimpo" de={2.2} style={{ filter: 'brightness(.62) saturate(1.1)' }} /></NaMao>
        <Sequence name="Comentário" from={q(0.55)}><Comentario texto="Recife 🏮" deDigitar={q(0.35)} porLetra={T.porLetra} toque={q(T.toque) - q(0.55)} /></Sequence>
        <Sequence name="Lanterna dispara" from={q(T.lanterna)}><LanternaVoa x={540} y={1340} /></Sequence>
        <Sequence name="Texto 1" durationInFrames={q(T.lanterna) + 2}>
          <Legenda y={560} ate={q(T.lanterna) + 2} tam={150} linhas={[{ t: 'Comenta' }, { t: 'sua cidade', fita: true }]} />
        </Sequence>
        <Sequence name="Curiosidade" from={q(0.7)} durationInFrames={q(T.lanterna) - q(0.7)}><Mao t="e olha o que acontece 👀" x={0} y={905} tam={88} centro ate={q(T.lanterna) - q(0.7)} /></Sequence>
        <Sequence name="Texto 2" from={q(T.lanterna) + 2}>
          <Legenda y={600} ate={q(T.corte1) - q(T.lanterna) - 2} tam={140} passo={3} linhas={[{ t: 'sua lanterna' }, { t: 'sobe pro céu 🏮' }]} />
        </Sequence>
      </Sequence>

      {/* ───────── 4–5,5 s · CHEGA O DIRECT ───────── */}
      <Sequence name="Direct" {...cena(T.corte1, T.link)}>
        <Soco><NaMao amp={4} zoom={[1.15, 1.22]}><Clip nome="ceulimpo" de={4.6} style={{ filter: 'blur(10px) brightness(.5)' }} /></NaMao></Soco>
        <Sequence from={q(T.direct - T.corte1) - 6}><Notificacao toque={q(T.link - T.direct) - 2} /></Sequence>
        <Sequence from={q(T.direct - T.corte1)}><Legenda y={820} ate={q(T.link - T.direct)} tam={124} linhas={[{ t: 'chega um link' }, { t: 'no seu direct ✉️' }]} /></Sequence>
      </Sequence>

      {/* ───────── 5,5–11 s · ESCREVE O DESEJO (grátis) ───────── */}
      <Sequence name="Escreve" {...cena(T.link, T.turbinar)}>
        <NaMao amp={3} zoom={[1, 1.04]}><Clip nome="ceulimpo" de={1.2} style={{ filter: 'blur(14px) brightness(.45)' }} /></NaMao>
        <Celular>
          <Clip nome="escrever" de={0} />
          <Sequence from={q(0.45)} durationInFrames={q(1.15)}><Rabisco d={circuloMao(205, 742, 200, 238)} dur={11} larg={14} ate={q(1.15)} /></Sequence>
          <Sequence from={q(4.75)}><Rabisco d="M120 1162 C 330 1148, 560 1176, 760 1156 S 960 1150, 1000 1158" dur={9} larg={13} /></Sequence>
        </Celular>
        <Sombra />
        <Sequence durationInFrames={q(1.75)}><Legenda y={240} ate={q(1.75)} tam={128} linhas={[{ t: 'é grátis', fita: true }]} /></Sequence>
        <Sequence from={q(1.8)}><Legenda y={225} ate={q(T.turbinar - T.link) - q(1.8)} tam={110} passo={3} linhas={[{ t: 'escreve seu desejo' }, { t: 'pra 2027 ✍️' }]} /></Sequence>
      </Sequence>

      {/* ───────── 11–16 s · TURBINAR: FAIXA, SKIN, BRILHO ───────── */}
      <Sequence name="Turbinar" {...cena(T.turbinar, T.sobe)}>
        <NaMao amp={3} zoom={[1.04, 1]}><Clip nome="ceulimpo" de={3.4} style={{ filter: 'blur(14px) brightness(.45)' }} /></NaMao>
        <Soco de={1.06}>
          <Celular>
            <Clip nome="turbinar" de={2.0} />
            <Sequence from={q(0.6)} durationInFrames={q(1.35)}><Rabisco d={circuloMao(540, 455, 330, 92)} dur={10} larg={13} ate={q(1.35)} /></Sequence>
            <Sequence from={q(2.85)} durationInFrames={q(1.6)}><Rabisco d={circuloMao(190, 795, 118, 122)} dur={9} larg={13} ate={q(1.6)} /></Sequence>
            <Sequence from={q(4.25)}><Rabisco d={circuloMao(1012, 1402, 92, 70)} dur={8} larg={12} /></Sequence>
          </Celular>
        </Soco>
        <Sombra />
        <Sequence durationInFrames={q(1.9)}><Legenda y={225} ate={q(1.9)} tam={118} linhas={[{ t: 'quer aparecer?' }]} /></Sequence>
        <Sequence from={q(1.95)}><Legenda y={225} ate={q(T.sobe - T.turbinar) - q(1.95)} tam={112} passo={3} linhas={[{ t: 'bota uma faixa', fita: true }, { t: 'skin e brilho ✨', tam: 92 }]} /></Sequence>
      </Sequence>

      {/* ───────── 16–27 s · ELA SOBE ───────── */}
      <Sequence name="Sobe" {...cena(T.sobe, T.ceu)}>
        <Soco de={1.18}><NaMao amp={5} zoom={[1, 1]}><ZoomSobe q={q}><Clip nome="sobe" de={1.3} /></ZoomSobe></NaMao></Soco>
        <Clarao dur={12} forte={0.7} />
        <Sombra />
        <Sequence from={q(0.25)} durationInFrames={q(4.6)}><Legenda y={250} ate={q(4.6)} tam={120} passo={4} linhas={[{ t: 'e ela sobe' }, { t: 'no céu da sua cidade', tam: 96 }]} /></Sequence>
        <Sequence from={q(4.9)} durationInFrames={q(3.9)}><Legenda y={250} ate={q(3.9)} tam={128} linhas={[{ t: 'todo mundo vê 👀' }]} /></Sequence>
        <Sequence from={q(4.9)} durationInFrames={q(3.9)}><Mao t="a sua faixa lá em cima" x={0} y={440} tam={78} centro ate={q(3.9)} /></Sequence>
        <Sequence from={q(8.95)}><Legenda y={225} ate={q(T.ceu - T.sobe) - q(8.95)} tam={104} passo={3} linhas={[{ t: 'e o seu desejo fica' }, { t: 'lá até a virada', fita: true, tam: 96 }]} /></Sequence>
      </Sequence>

      {/* ───────── 27–31 s · O CÉU ───────── */}
      <Sequence name="Céu" {...cena(T.ceu, T.pausa)}>
        <Soco><NaMao amp={6} zoom={[1.05, 1.22]}><Clip nome="ceu" de={1.8} /></NaMao></Soco>
        <Sombra />
        <Sequence durationInFrames={q(2.2)}><Legenda y={250} ate={q(2.2)} tam={124} linhas={[{ t: 'cada cidade' }, { t: 'com o seu céu', fita: true }]} /></Sequence>
        <Sequence from={q(2.2)}><Mao t="qual vai brilhar mais?" x={0} y={290} tam={112} giro={-3} centro ate={q(T.pausa - T.ceu) - q(2.2)} /></Sequence>
      </Sequence>

      {/* ───────── 31–37 s · A VIRADA ───────── */}
      <Sequence name="Virada" {...cena(T.pausa, T.cta)}>
        <Treme em={q(T.fogos - T.pausa)} forca={18}>
          <NaMao amp={4} zoom={[1.05, 1.12]}><Clip nome="virada" de={8.6} /></NaMao>
        </Treme>
        <Sequence from={q(T.fogos - T.pausa)}><Clarao dur={16} forte={0.95} /></Sequence>
        <Sombra />
        <Sequence durationInFrames={q(T.fogos - T.pausa)}><Legenda y={240} ate={q(T.fogos - T.pausa)} tam={112} linhas={[{ t: '31/12 · meia-noite' }]} /></Sequence>
        <Sequence from={q(T.fogos - T.pausa) + 3}><Legenda y={1000} ate={q(T.cta - T.fogos) - 3} tam={150} passo={5} linhas={[{ t: 'todas viram' }, { t: 'fogos 🎆', fita: true }]} /></Sequence>
      </Sequence>

      {/* ───────── 37–40 s · CHAMADA ───────── */}
      <Sequence name="Chamada" {...cena(T.cta, DURACAO)}>
        <NaMao amp={3} zoom={[1.12, 1.18]}><Clip nome="virada" de={14.6} style={{ filter: 'blur(7px) brightness(.5)' }} /></NaMao>
        <Legenda y={520} ate={9999} tam={156} passo={4} linhas={[{ t: 'comenta' }, { t: 'sua cidade', fita: true }, { t: '👇', tam: 130 }]} />
        <Sequence from={q(0.5)}><Mao t="e solta a sua 🏮 @ceude2027" x={0} y={1080} tam={80} centro /></Sequence>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1440, textAlign: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 26, color: 'rgba(243,234,216,.55)' }}>cenas do app em modo demonstração</div>
      </Sequence>

      <Pelicula />
      <Audio src={staticFile('trilha.wav')} />
    </AbsoluteFill>
  );
};
