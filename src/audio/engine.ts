import { concatFloat32, midiToHz } from '../lib/music';
import type { Exercise } from '../bank/types';
import workletUrl from './capture.worklet.ts?worker&url';

/**
 * Audio engine: one AudioContext for the whole app, the microphone chain
 * (source → analyser for the meters, source → capture node for recording)
 * and the reference-tone synthesizer.
 */

export type MicError = 'insecure' | 'unsupported' | 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | string;
export type MicResult = { ok: true } | { ok: false; error: MicError };

interface CaptureBackend {
  kind: 'worklet' | 'script';
  start(): void;
  stop(): Promise<Float32Array>;
  disconnect(): void;
}

type ACtor = typeof AudioContext;
const AC = (): ACtor | undefined =>
  (globalThis as { AudioContext?: ACtor; webkitAudioContext?: ACtor }).AudioContext ??
  (globalThis as { webkitAudioContext?: ACtor }).webkitAudioContext;

async function workletBackend(ctx: AudioContext, src: AudioNode, sink: AudioNode): Promise<CaptureBackend | null> {
  if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
  try {
    await ctx.audioWorklet.addModule(workletUrl);
  } catch {
    return null;
  }
  const node = new AudioWorkletNode(ctx, 'rvcds-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers',
  });
  src.connect(node);
  node.connect(sink);
  let chunks: Float32Array[] = [];
  let done: (() => void) | null = null;
  node.port.onmessage = (e: MessageEvent<{ type: 'data'; data: Float32Array } | { type: 'done' }>) => {
    if (e.data.type === 'data') chunks.push(e.data.data);
    else done?.();
  };
  return {
    kind: 'worklet',
    start() {
      chunks = [];
      node.port.postMessage('start');
    },
    stop() {
      return new Promise(resolve => {
        const finish = () => {
          done = null;
          clearTimeout(timer);
          const out = concatFloat32(chunks);
          chunks = [];
          resolve(out);
        };
        const timer = setTimeout(finish, 1000);
        done = finish;
        node.port.postMessage('stop');
      });
    },
    disconnect() {
      try { src.disconnect(node); node.disconnect(); } catch {}
    },
  };
}

function scriptBackend(ctx: AudioContext, src: AudioNode, sink: AudioNode): CaptureBackend {
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  src.connect(proc);
  proc.connect(sink);
  let chunks: Float32Array[] | null = null;
  proc.onaudioprocess = e => {
    if (chunks) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  return {
    kind: 'script',
    start() { chunks = []; },
    async stop() {
      const out = concatFloat32(chunks ?? []);
      chunks = null;
      return out;
    },
    disconnect() {
      try { src.disconnect(proc); proc.disconnect(); } catch {}
    },
  };
}

interface RefVoice {
  o1: OscillatorNode;
  o2: OscillatorNode;
  g: GainNode;
}

export interface MicInfo {
  sampleRate: number;
  capture: 'worklet' | 'script';
  /** Processing the browser applied despite our constraints (e.g. ['noiseSuppression']). */
  forcedProcessing: string[];
  label: string;
}

class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private bus: GainNode | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: CaptureBackend | null = null;
  private refs: RefVoice[] = [];
  private playSrc: AudioBufferSourceNode | null = null;
  private outGain = 0.6;
  info: MicInfo | null = null;
  capturing = false;

  /** Called when reference tones start/stop, so the UI can update the Tone button. */
  onRefChange: (playing: boolean) => void = () => {};
  /** Called when the microphone track ends (unplugged, permission revoked). */
  onMicLost: () => void = () => {};

  constructor() {
    if (typeof document !== 'undefined') {
      // iOS/Safari start contexts suspended and may "interrupt" them; resume on any user gesture.
      const wake = () => { if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => {}); };
      document.addEventListener('pointerdown', wake, true);
      document.addEventListener('keydown', wake, true);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
    }
  }

  get supported(): boolean {
    return !!AC();
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 0;
  }

  get micReady(): boolean {
    return !!this.source;
  }

  /** Creates (or resumes) the AudioContext. Must run inside a user gesture the first time. */
  ensure(sampleRate?: number): AudioContext {
    if (!this.ctx) {
      const C = AC();
      if (!C) throw new Error('Web Audio unsupported');
      this.ctx = sampleRate ? new C({ latencyHint: 'interactive', sampleRate }) : new C({ latencyHint: 'interactive' });
      this.bus = this.ctx.createGain();
      this.bus.gain.value = this.outGain;
      this.bus.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setOutput(vol: number, muted: boolean): void {
    this.outGain = muted ? 0 : vol;
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(this.outGain, this.ctx.currentTime, 0.02);
  }

  private pendingMic: Promise<MicResult> | null = null;

  /** Opens the microphone once; concurrent callers (double clicks, Space while enabling) share the same request. */
  initMic(): Promise<MicResult> {
    if (this.source) return Promise.resolve({ ok: true });
    this.pendingMic ??= this.openMic().finally(() => { this.pendingMic = null; });
    return this.pendingMic;
  }

  private async openMic(): Promise<MicResult> {
    if (this.source) return { ok: true };
    if (typeof window !== 'undefined' && !window.isSecureContext) return { ok: false, error: 'insecure' };
    if (!navigator.mediaDevices?.getUserMedia || !this.supported) return { ok: false, error: 'unsupported' };
    this.ensure();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: { ideal: 1 } },
      });
    } catch (e) {
      return { ok: false, error: (e as DOMException)?.name || 'unknown' };
    }
    const track = this.stream.getAudioTracks()[0];
    const st = (track?.getSettings?.() ?? {}) as MediaTrackSettings;
    let src: MediaStreamAudioSourceNode;
    try {
      src = this.ctx!.createMediaStreamSource(this.stream);
    } catch {
      // Firefox refuses to connect a stream whose rate differs from the context: rebuild at the device rate.
      await this.ctx!.close().catch(() => {});
      this.ctx = null;
      this.ensure(st.sampleRate || undefined);
      src = this.ctx!.createMediaStreamSource(this.stream);
    }
    const ctx = this.ctx!;
    this.source = src;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    const sink = ctx.createGain();
    sink.gain.value = 0;
    sink.connect(ctx.destination);
    this.capture = (await workletBackend(ctx, src, sink)) ?? scriptBackend(ctx, src, sink);
    track?.addEventListener('ended', () => this.releaseMic(true));
    this.info = {
      sampleRate: ctx.sampleRate,
      capture: this.capture.kind,
      forcedProcessing: (['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const).filter(k => st[k] === true),
      label: track?.label ?? '',
    };
    return { ok: true };
  }

  private releaseMic(lost: boolean): void {
    this.capture?.disconnect();
    this.capture = null;
    try { this.source?.disconnect(); } catch {}
    this.source = null;
    this.analyser = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.capturing = false;
    if (lost) this.onMicLost();
  }

  startCapture(): void {
    if (!this.capture) return;
    this.capture.start();
    this.capturing = true;
  }

  async stopCapture(): Promise<Float32Array> {
    if (!this.capture || !this.capturing) return new Float32Array(0);
    this.capturing = false;
    return this.capture.stop();
  }

  /* ---------------- reference synth ---------------- */

  get refPlaying(): boolean {
    return this.refs.length > 0;
  }

  /**
   * Schedules the reference melody of an exercise at `when` (context time).
   * With `first`, plays only the first note for `len` seconds (count-in pitch).
   * Returns the end time, or 0 if the exercise has no pitch.
   */
  playReference(ex: Exercise, when: number, tr: number, opt: { first?: boolean; len?: number } = {}): number {
    const ctx = this.ensure();
    const bus = this.bus!;
    const s = ex.sched.filter(x => x.f);
    if (!s.length) return 0;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    const lp = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain();
    o1.type = 'triangle';
    o2.type = 'sine';
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    lp.Q.value = 0.4;
    g2.gain.value = 0.5;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(bus);
    g.gain.setValueAtTime(0, when);
    const L = 0.25;
    const F = (m: number, t: number, ramp?: boolean) => {
      const f = midiToHz(m + tr);
      if (ramp) {
        o1.frequency.exponentialRampToValueAtTime(f, t);
        o2.frequency.exponentialRampToValueAtTime(f / 2, t);
      } else {
        o1.frequency.setValueAtTime(f, t);
        o2.frequency.setValueAtTime(f / 2, t);
      }
    };
    let end: number;
    if (opt.first) {
      const len = opt.len ?? 1.5;
      F(s[0].f![0], when);
      g.gain.linearRampToValueAtTime(L, when + 0.05);
      g.gain.setValueAtTime(L, when + len - 0.15);
      g.gain.linearRampToValueAtTime(0, when + len);
      end = when + len;
    } else {
      for (const x of s) {
        const a = when + x.t0, b = when + x.t1, f = x.f!;
        F(f[0], a);
        g.gain.setValueAtTime(0, a);
        g.gain.linearRampToValueAtTime(L, a + 0.03);
        if (f.length > 1) {
          const seg = (b - a) / (f.length - 1);
          for (let j = 1; j < f.length; j++) F(f[j], a + seg * j, true);
        }
        g.gain.setValueAtTime(L, Math.max(a + 0.04, b - 0.05));
        g.gain.linearRampToValueAtTime(0, b);
      }
      end = when + s[s.length - 1].t1;
    }
    o1.start(when); o2.start(when);
    o1.stop(end + 0.05); o2.stop(end + 0.05);
    const voice: RefVoice = { o1, o2, g };
    this.refs.push(voice);
    o1.onended = () => {
      this.refs = this.refs.filter(v => v !== voice);
      if (!this.refs.length) this.onRefChange(false);
    };
    this.onRefChange(true);
    return end;
  }

  stopReference(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const n of this.refs) {
      try {
        n.g.gain.cancelScheduledValues(now);
        n.g.gain.setTargetAtTime(0, now, 0.015);
        n.o1.stop(now + 0.08);
        n.o2.stop(now + 0.08);
      } catch {}
    }
  }

  /* ---------------- take playback ---------------- */

  play(pcm: Float32Array, sr: number, onEnd: () => void): void {
    const ctx = this.ensure();
    this.stopPlayback();
    const b = ctx.createBuffer(1, pcm.length, sr);
    b.getChannelData(0).set(pcm);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.onended = () => {
      if (this.playSrc === s) {
        this.playSrc = null;
        onEnd();
      }
    };
    s.start();
    this.playSrc = s;
  }

  stopPlayback(): void {
    const s = this.playSrc;
    this.playSrc = null;
    if (s) try { s.stop(); } catch {}
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }
}

export const engine = new AudioEngine();
