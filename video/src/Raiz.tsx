import { Composition } from 'remotion';
import { Lancamento } from './Lancamento';
import { DURACAO, FPS } from '../tempos.mjs';

export const Raiz = () => (
  <Composition id="Lancamento" component={Lancamento} durationInFrames={DURACAO * FPS} fps={FPS} width={1080} height={1920} />
);
