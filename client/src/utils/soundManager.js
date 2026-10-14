/**
 * Web Audio API Synthesizer & Sound Effects
 * High-performance, lightweight audio engine:
 * - Upbeat enjoyment game BGM (8th-note groove, low CPU, zero GC thrashing)
 * - Correct/wrong chimes & countdown ticks
 * - Party Popper Boom celebration fanfare
 * Completely offline and asset-free.
 */
class SoundManager {
  constructor() {
    this.ctx = null;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.isMuted = false;
    this.bgmVolume = 0.25;
    this.listeners = new Set();
    this.stepIndex = 0;
    this.masterGain = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn({
          bgmPlaying: this.bgmPlaying,
          isMuted: this.isMuted,
        });
      } catch {}
    });
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  resumeAudio() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      return ctx.resume();
    }
    return Promise.resolve();
  }

  // Cheerful correct answer chime (3 fast rising tones)
  playCorrect() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.07;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.23);
      });
    } catch {}
  }

  // Soft incorrect thud
  playIncorrect() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.23);
    } catch {}
  }

  // Timer Tick (crisp click)
  playTick() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {}
  }

  /**
   * Dramatic PARTY POPPER BOOM! 🎉💥
   * Punchy cannon sub-bass + crisp pop + triumphant celebration arpeggio
   */
  playPopperBoom() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Cannon Sub-Bass Boom
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(130, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.35);

      subGain.gain.setValueAtTime(0.45, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.4);

      // 2. High snap / pop noise burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.12);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const popFilter = ctx.createBiquadFilter();
      popFilter.type = 'bandpass';
      popFilter.frequency.setValueAtTime(1400, now);

      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.35, now);
      popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      noiseSource.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(ctx.destination);
      noiseSource.start(now);
      noiseSource.stop(now + 0.13);

      // 3. Victory Arpeggio (C Major triumph fanfare)
      const fanfare = [
        { freq: 523.25, time: 0.1 },  // C5
        { freq: 659.25, time: 0.18 }, // E5
        { freq: 783.99, time: 0.26 }, // G5
        { freq: 1046.5, time: 0.36 }, // C6
      ];

      fanfare.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + n.time;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, t);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + 0.46);
      });
    } catch {}
  }

  playVictoryPopper() {
    this.playPopperBoom();
  }

  /**
   * Ultra-Lightweight, Catchy Enjoyment Game Groove 🎶
   * 8th-note pulse (240ms interval = ~125 BPM).
   * Allocates at most 1 oscillator per tick (zero CPU load, buttery smooth 60fps).
   */
  startQuizBGM() {
    if (this.bgmPlaying || this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.bgmPlaying = true;
    this.stepIndex = 0;
    this.notify();

    // Catchy upbeat C major / Am scale notes
    const melodyScale = [523.25, 659.25, 783.99, 880.00, 659.25, 783.99, 1046.5, 783.99];
    const bassScale = [130.81, 164.81, 174.61, 196.00];

    const playBgmStep = () => {
      if (!this.bgmPlaying || this.isMuted) return;

      try {
        const now = ctx.currentTime;
        const step = this.stepIndex;

        // Alternate: on even steps play rhythmic bass note, on odd steps play melodic pluck
        if (step % 2 === 0) {
          const bassOsc = ctx.createOscillator();
          const bassGain = ctx.createGain();

          bassOsc.type = 'triangle';
          const bFreq = bassScale[(step / 2) % bassScale.length];
          bassOsc.frequency.setValueAtTime(bFreq, now);

          bassGain.gain.setValueAtTime(0.001, now);
          bassGain.gain.linearRampToValueAtTime(0.06 * this.bgmVolume, now + 0.02);
          bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

          bassOsc.connect(bassGain);
          bassGain.connect(this.masterGain || ctx.destination);

          bassOsc.start(now);
          bassOsc.stop(now + 0.21);
        } else {
          const mOsc = ctx.createOscillator();
          const mGain = ctx.createGain();

          mOsc.type = 'sine';
          const mFreq = melodyScale[step % melodyScale.length];
          mOsc.frequency.setValueAtTime(mFreq, now);

          mGain.gain.setValueAtTime(0.001, now);
          mGain.gain.linearRampToValueAtTime(0.045 * this.bgmVolume, now + 0.015);
          mGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

          mOsc.connect(mGain);
          mGain.connect(this.masterGain || ctx.destination);

          mOsc.start(now);
          mOsc.stop(now + 0.19);
        }

        this.stepIndex = (this.stepIndex + 1) % 16;
      } catch {}

      // Steady 240ms 8th-note tempo
      this.bgmTimer = setTimeout(playBgmStep, 240);
    };

    playBgmStep();
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.notify();
  }

  // Live Arena has a slightly fuller, but still gentle, background groove.
  startLiveArenaBGM() {
    this.setVolume(0.45);
    this.startQuizBGM();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBGM();
    } else {
      this.startQuizBGM();
    }
    this.notify();
    return this.isMuted;
  }

  setVolume(vol) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    }
  }
}

export const soundManager = new SoundManager();
