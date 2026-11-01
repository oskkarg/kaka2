/**
 * Web Audio 8-bit Synthesizer for DIV-8 Fantasy Console
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private masterGain: GainNode | null = null;

  private init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.25;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.25;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playSound(idOrName: number | string) {
    if (this.muted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    if (idOrName === 1 || idOrName === 'laser' || idOrName === 'disparo') {
      // Pew Pew laser
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.15);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    } else if (idOrName === 2 || idOrName === 'explosion' || idOrName === 'bomba') {
      // Noise burst explosion
      const bufferSize = this.ctx.sampleRate * 0.35;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.linearRampToValueAtTime(80, t + 0.35);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t);
    } else if (idOrName === 3 || idOrName === 'jump' || idOrName === 'salto') {
      // Retro jump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    } else if (idOrName === 4 || idOrName === 'hit' || idOrName === 'golpe') {
      // Hit / bump
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.1);
    } else if (idOrName === 5 || idOrName === 'coin' || idOrName === 'moneda') {
      // Two-note coin chime (B5 -> E6)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(987.77, t);
      osc.frequency.setValueAtTime(1318.51, t + 0.08);

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.08);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    } else if (idOrName === 6 || idOrName === 'powerup' || idOrName === 'mejora') {
      // 4-note ascending fanfare
      const notes = [330, 392, 494, 659];
      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        const noteStart = t + i * 0.07;
        gain.gain.setValueAtTime(0.2, noteStart);
        gain.gain.linearRampToValueAtTime(0.01, noteStart + 0.07);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(noteStart);
        osc.stop(noteStart + 0.07);
      });
    } else if (idOrName === 7 || idOrName === 'gameover') {
      // Descending sad tones
      const notes = [440, 415, 392, 330];
      notes.forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const noteStart = t + i * 0.14;
        gain.gain.setValueAtTime(0.25, noteStart);
        gain.gain.linearRampToValueAtTime(0.01, noteStart + 0.14);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(noteStart);
        osc.stop(noteStart + 0.14);
      });
    } else {
      // Simple beep tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  public tone(freq: number, durationMs: number = 100, wave: OscillatorType = 'square') {
    if (this.muted) return;
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const durSec = durationMs / 1000;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.01, t + durSec);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + durSec);
  }
}

export const audio = new SoundEngine();
