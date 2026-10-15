/**
 * AudioWorklet: reenvía PCM mono a 16 kHz al hilo principal en bloques.
 *
 * Sustituye a ScriptProcessorNode (obsoleto y en el hilo principal).
 * El rate reduction se hace aquí, en el hilo de audio, sin bloquear el vídeo.
 */
const TARGET_RATE = 16000;
const CHUNK = 1600; // 100 ms @ 16 kHz

class PcmTapProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.target = TARGET_RATE;
    this.ratio = sampleRate / TARGET_RATE;
    this.buffer = new Float32Array(CHUNK);
    this.filled = 0;
    this.cursor = 0;
    this.port.onmessage = (event) => {
      if (event.data && event.data.type === "reset") {
        this.filled = 0;
        this.cursor = 0;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    for (let i = 0; i < channel.length; i += 1) {
      this.cursor += 1;
      if (this.cursor < this.ratio) continue;
      this.cursor -= this.ratio;
      this.buffer[this.filled] = channel[i];
      this.filled += 1;
      if (this.filled === CHUNK) {
        const out = new Int16Array(CHUNK);
        for (let j = 0; j < CHUNK; j += 1) {
          const sample = Math.max(-1, Math.min(1, this.buffer[j]));
          out[j] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        }
        this.port.postMessage(out, [out.buffer]);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-tap", PcmTapProcessor);
