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

  // Cheerful, rewarding correct answer chime (4-note ascending major sparkle)
  playCorrect() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // C5, E5, G5, C6 (Bright triumphant arpeggio)
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.055;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);

        osc.start(start);
        osc.stop(start + 0.29);
      });
    } catch {}
  }

  // Soft, friendly arcade "uh-oh" chime (playful downward slide)
  playIncorrect() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Two quick downward playful notes
      const notes = [
        { freq: 280, dur: 0.12, time: 0 },
        { freq: 210, dur: 0.22, time: 0.09 },
      ];

      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + n.time;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, t);
        osc.frequency.exponentialRampToValueAtTime(n.freq * 0.75, t + n.dur);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);

        osc.start(t);
        osc.stop(t + n.dur + 0.01);
      });
    } catch {}
  }

  // Crisp, dynamic countdown tick
  playTick() {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5 woodblock pitch
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.035);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.038);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
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
   * Catchy, Enjoyable Game-Show Soundtrack & Arcade Groove 🎶
   * 128 BPM (~234ms 8th-note pulse).
   * 4-Bar Chord Progression (C - G - Am - F) with bouncy bass, sparkling synth arpeggio,
   * and subtle rhythmic hi-hat percussion for an energetic, interactive live quiz feel!
   */
  startQuizBGM() {
    if (this.bgmPlaying || this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.bgmPlaying = true;
    this.stepIndex = 0;
    this.notify();

    // 4-Bar Chord Progression Bass Frequencies (C -> G -> Am -> F)
    const chordBassRoots = [
      { low: 65.41, oct: 130.81 },  // C2, C3
      { low: 49.00, oct: 98.00 },   // G1, G2
      { low: 55.00, oct: 110.00 },  // A1, A2
      { low: 43.65, oct: 87.31 },   // F1, F2
    ];

    // Catchy Game Melody Pattern across the 4 chords
    const melodyPatterns = [
      [523.25, 659.25, 783.99, 1046.50], // C major arpeggio
      [392.00, 587.33, 783.99, 987.77],  // G major arpeggio
      [440.00, 523.25, 659.25, 880.00],  // A minor arpeggio
      [349.23, 523.25, 659.25, 880.00],  // F major / add9
    ];

    const playBgmStep = () => {
      if (!this.bgmPlaying || this.isMuted) return;

      try {
        const now = ctx.currentTime;
        const step = this.stepIndex; // 0 to 15 (16 eighth notes in 4 bars of 4/4)
        const chordIdx = Math.floor(step / 4) % 4;
        const subStep = step % 4;

        // 1. Bouncy Synth Bass (Disco-funk octave bounce)
        const bassPair = chordBassRoots[chordIdx];
        const bassFreq = subStep % 2 === 0 ? bassPair.low : bassPair.oct;

        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.001, now);
        bassGain.gain.linearRampToValueAtTime(0.09 * this.bgmVolume, now + 0.015);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);

        bassOsc.connect(bassGain);
        bassGain.connect(this.masterGain || ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.22);

        // 2. Sparkling Upbeat Synth Melody
        const chordNotes = melodyPatterns[chordIdx];
        const melFreq = chordNotes[subStep % chordNotes.length];

        const mOsc = ctx.createOscillator();
        const mGain = ctx.createGain();
        mOsc.type = 'sine';
        mOsc.frequency.setValueAtTime(melFreq, now);

        mGain.gain.setValueAtTime(0.001, now);
        mGain.gain.linearRampToValueAtTime(0.055 * this.bgmVolume, now + 0.012);
        mGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

        mOsc.connect(mGain);
        mGain.connect(this.masterGain || ctx.destination);
        mOsc.start(now);
        mOsc.stop(now + 0.2);

        // 3. Subtle Hi-Hat / Shaker Tick on 16th beats to give dance groove
        if (step % 2 === 1) {
          const bufferSize = Math.floor(ctx.sampleRate * 0.025);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.008));
          }
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(6500, now);

          const hGain = ctx.createGain();
          hGain.gain.setValueAtTime(0.025 * this.bgmVolume, now);
          hGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.024);

          noise.connect(filter);
          filter.connect(hGain);
          hGain.connect(this.masterGain || ctx.destination);
          noise.start(now);
          noise.stop(now + 0.026);
        }

        this.stepIndex = (this.stepIndex + 1) % 16;
      } catch {}

      // Energetic 128 BPM groove = 234ms per 8th note
      this.bgmTimer = setTimeout(playBgmStep, 234);
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
