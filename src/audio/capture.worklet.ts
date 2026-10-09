/**
 * AudioWorklet that copies the microphone signal off the audio thread while capture is on.
 * Samples are batched (4096 frames ≈ 85 ms at 48 kHz) and transferred, never copied twice.
 * Messages in: 'start' | 'stop'. Messages out: {type:'data', data:Float32Array} | {type:'done'}.
 */

interface AudioWorkletProcessorLike {
  readonly port: MessagePort;
}
declare const AudioWorkletProcessor: { prototype: AudioWorkletProcessorLike; new (): AudioWorkletProcessorLike };
declare function registerProcessor(name: string, ctor: unknown): void;

const BATCH = 4096;

class CaptureProcessor extends AudioWorkletProcessor {
  private on = false;
  private buf = new Float32Array(BATCH);
  private n = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data === 'start') {
        this.n = 0;
        this.on = true;
      } else if (e.data === 'stop') {
        this.flush();
        this.on = false;
        this.port.postMessage({ type: 'done' });
      }
    };
  }

  private flush(): void {
    if (!this.n) return;
    const out = this.buf.slice(0, this.n);
    this.port.postMessage({ type: 'data', data: out }, [out.buffer]);
    this.n = 0;
  }

  process(inputs: Float32Array[][]): boolean {
    const ch = inputs[0]?.[0];
    if (this.on && ch) {
      let i = 0;
      while (i < ch.length) {
        const k = Math.min(ch.length - i, BATCH - this.n);
        this.buf.set(ch.subarray(i, i + k), this.n);
        this.n += k;
        i += k;
        if (this.n === BATCH) this.flush();
      }
    }
    return true;
  }
}

registerProcessor('rvcds-capture', CaptureProcessor);
