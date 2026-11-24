// Generative Agent Sonification & Ambient Sound Studio (pure Web Audio API, zero deps)
'use strict';

const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALES = {
  // Western
  major: { name: 'Major (Ionian)', group: 'Western', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Natural Minor (Aeolian)', group: 'Western', intervals: [0, 2, 3, 5, 7, 8, 10] },
  dorian: { name: 'Dorian', group: 'Western', intervals: [0, 2, 3, 5, 7, 9, 10] },
  lydian: { name: 'Lydian', group: 'Western', intervals: [0, 2, 4, 6, 7, 9, 11] },
  mixolydian: { name: 'Mixolydian', group: 'Western', intervals: [0, 2, 4, 5, 7, 9, 10] },
  harmonic_minor: { name: 'Harmonic Minor', group: 'Western', intervals: [0, 2, 3, 5, 7, 8, 11] },
  pentatonic_major: { name: 'Pentatonic Major', group: 'Western', intervals: [0, 2, 4, 7, 9] },
  pentatonic_minor: { name: 'Pentatonic Minor', group: 'Western', intervals: [0, 3, 5, 7, 10] },

  // East Asian
  hirajoshi: { name: 'Hirajoshi (Japan)', group: 'East Asian', intervals: [0, 2, 3, 7, 8] },
  in_sen: { name: 'In Sen (Japan)', group: 'East Asian', intervals: [0, 1, 5, 7, 10] },
  yo: { name: 'Yo Scale (Japan)', group: 'East Asian', intervals: [0, 2, 5, 7, 9] },
  gong: { name: 'Gong Pentatonic (China)', group: 'East Asian', intervals: [0, 2, 4, 7, 9] },
  pelog: { name: 'Pelog (Indonesia)', group: 'East Asian', intervals: [0, 1, 3, 7, 8] },

  // Middle Eastern (supports microtonal float semitones)
  hijaz: { name: 'Hijaz', group: 'Middle Eastern', intervals: [0, 1, 4, 5, 7, 8, 11] },
  maqam_bayati: { name: 'Maqam Bayati (Microtonal)', group: 'Middle Eastern', intervals: [0, 1.5, 3, 5, 7, 8.5, 10] },
  maqam_rast: { name: 'Maqam Rast (Microtonal)', group: 'Middle Eastern', intervals: [0, 2, 3.5, 5, 7, 9, 10.5] },
  double_harmonic: { name: 'Double Harmonic (Byzantine)', group: 'Middle Eastern', intervals: [0, 1, 4, 5, 7, 8, 11] },

  // Rich / Exotic / Eastern European
  hungarian_minor: { name: 'Hungarian Minor', group: 'Rich & Exotic', intervals: [0, 2, 3, 6, 7, 8, 11] },
  enigmatic: { name: 'Enigmatic', group: 'Rich & Exotic', intervals: [0, 1, 4, 6, 8, 10, 11] },
  prometheus: { name: 'Prometheus (Scriabin)', group: 'Rich & Exotic', intervals: [0, 2, 4, 6, 9, 10] },
  whole_tone: { name: 'Whole Tone', group: 'Rich & Exotic', intervals: [0, 2, 4, 6, 8, 10] },
  octatonic: { name: 'Octatonic (Half-Whole Dim)', group: 'Rich & Exotic', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
};

const EPISODES = {
  magnetosphere: {
    id: 'magnetosphere',
    name: 'Earth Magnetosphere / VLF Chorus',
    badge: '1970s VLF',
    desc: 'Descending whistler sweeps, dawn chorus chirps, 7.83 Hz Schumann pulse & cosmic hiss.',
    scale: 'prometheus',
    root: 'D',
    octave: 4,
    tempo: 72,
    mix: { melody: 0.25, bubbles: 0.12, magnetosphere: 0.85, drone: 0.58 },
    reactivity: 0.78,
  },
  glass_minimal: {
    id: 'glass_minimal',
    name: '1970s Minimalist Glass Arpeggios',
    badge: '3+3+2 / 4+3',
    desc: 'Additive rhythmic cells per active agent tier: pro/opus bass, flash/sonnet mid, flash_lite/haiku shimmer.',
    scale: 'lydian',
    root: 'C',
    octave: 4,
    tempo: 116,
    mix: { melody: 0.86, bubbles: 0.08, magnetosphere: 0.14, drone: 0.45 },
    reactivity: 0.82,
  },
  asmr_bubbles: {
    id: 'asmr_bubbles',
    name: 'ASMR Water & Bubbles',
    badge: 'HYDRO BED',
    desc: 'LFO-filtered brown/pink water bed with stereo-panned bubble & gurgle drops.',
    scale: 'pentatonic_major',
    root: 'G',
    octave: 4,
    tempo: 68,
    mix: { melody: 0.22, bubbles: 0.90, magnetosphere: 0.06, drone: 0.32 },
    reactivity: 0.72,
  },
  tron_1977: {
    id: 'tron_1977',
    name: 'Tron 1977 Analog Synth Grid',
    badge: 'ANALOG ARP',
    desc: 'Warm detuned saw/triangle arpeggiator through resonant lowpass + sub-bass fifth drone.',
    scale: 'dorian',
    root: 'A',
    octave: 3,
    tempo: 108,
    mix: { melody: 0.82, bubbles: 0.06, magnetosphere: 0.22, drone: 0.68 },
    reactivity: 0.80,
  },
  zen_garden: {
    id: 'zen_garden',
    name: 'East Asian Zen & Rain',
    badge: 'KOTO / RAIN',
    desc: 'Hirajoshi / In Sen plucked koto & kalimba partials over soft filtered rain hiss.',
    scale: 'hirajoshi',
    root: 'E',
    octave: 4,
    tempo: 64,
    mix: { melody: 0.76, bubbles: 0.42, magnetosphere: 0.08, drone: 0.42 },
    reactivity: 0.65,
  },
  desert_oud: {
    id: 'desert_oud',
    name: 'Middle Eastern Oud & Drone',
    badge: 'MAQAMAT',
    desc: 'Hijaz / Bayati microtonal plucked resonant strings over a warm root + fifth drone.',
    scale: 'maqam_bayati',
    root: 'D',
    octave: 3,
    tempo: 78,
    mix: { melody: 0.80, bubbles: 0.10, magnetosphere: 0.12, drone: 0.72 },
    reactivity: 0.75,
  },
};

const BUILTIN_PRESETS = [
  ...Object.values(EPISODES).map(ep => ({
    name: `Episode · ${ep.name}`,
    builtin: true,
    config: {
      episode: ep.id,
      scale: ep.scale,
      root: ep.root,
      octave: ep.octave,
      tempo: ep.tempo,
      reactivity: ep.reactivity,
      mix: { ...ep.mix },
    },
  })),
  {
    name: 'Schumann Deep Space',
    builtin: true,
    config: {
      episode: 'magnetosphere',
      scale: 'whole_tone',
      root: 'F#',
      octave: 3,
      tempo: 56,
      reactivity: 0.85,
      mix: { melody: 0.18, bubbles: 0.05, magnetosphere: 0.95, drone: 0.74 },
    },
  },
  {
    name: 'Maqam Rast Twilight',
    builtin: true,
    config: {
      episode: 'desert_oud',
      scale: 'maqam_rast',
      root: 'C',
      octave: 4,
      tempo: 82,
      reactivity: 0.7,
      mix: { melody: 0.78, bubbles: 0.15, magnetosphere: 0.14, drone: 0.65 },
    },
  },
  {
    name: 'In Sen Rain Meditation',
    builtin: true,
    config: {
      episode: 'zen_garden',
      scale: 'in_sen',
      root: 'A',
      octave: 4,
      tempo: 60,
      reactivity: 0.6,
      mix: { melody: 0.68, bubbles: 0.56, magnetosphere: 0.05, drone: 0.48 },
    },
  },
];

const LS_CFG_KEY = 'gantt_sound_studio_cfg_v1';
const LS_PRESETS_KEY = 'gantt_sound_presets_v1';
const LS_VOL_KEY = 'gantt_asmr_vol';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const midiToFreq = midi => 440 * Math.pow(2, (midi - 69) / 12);

function scaleNoteFreq(cfg, degree = 0, octOffset = 0) {
  const sc = SCALES[cfg.scale] || SCALES.lydian;
  const iv = sc.intervals;
  const len = iv.length;
  const rootIdx = Math.max(0, ROOT_NOTES.indexOf(cfg.root));
  const octShift = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  const semi = iv[idx];
  const midi = (Number(cfg.octave) + 1 + octOffset + octShift) * 12 + rootIdx + semi;
  return midiToFreq(midi);
}

function defaultConfig(epId = 'magnetosphere') {
  const ep = EPISODES[epId] || EPISODES.magnetosphere;
  return {
    episode: ep.id,
    scale: ep.scale,
    root: ep.root,
    octave: ep.octave,
    tempo: ep.tempo,
    reactivity: ep.reactivity,
    master: Number(localStorage.getItem(LS_VOL_KEY) ?? 35) / 100,
    mix: { ...ep.mix },
  };
}

function loadSavedConfig() {
  const base = defaultConfig('magnetosphere');
  try {
    const raw = localStorage.getItem(LS_CFG_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        ...base,
        ...parsed,
        mix: { ...base.mix, ...(parsed.mix || {}) },
      };
    }
  } catch { /* ignore */ }
  return base;
}

class SoundStudioEngine {
  constructor() {
    this.cfg = loadSavedConfig();
    this.enabled = false;
    this.ctx = null;
    this.nodes = null;
    this.state = null;
    this.seenKeys = new Set();
    this.initializedFeed = false;
    this.arpStep = 0;
    this.cellCursor = 0;
    this.arpTimer = null;
    this.bubbleTimer = null;
    this.vlfTimer = null;
    this.presets = this.loadLocalPresets();
    this.listeners = new Set();
    this.domBound = false;
    this.lastEventToneAt = 0;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) {
      try { fn(this.getSnapshot()); } catch { /* ignore */ }
    }
  }

  saveConfig() {
    try {
      localStorage.setItem(LS_CFG_KEY, JSON.stringify(this.cfg));
      localStorage.setItem(LS_VOL_KEY, String(Math.round(this.cfg.master * 100)));
    } catch { /* ignore */ }
  }

  loadLocalPresets() {
    try {
      const raw = localStorage.getItem(LS_PRESETS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(p => p && p.name && p.config) : [];
    } catch {
      return [];
    }
  }

  saveLocalPresets() {
    try {
      localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(this.presets));
    } catch { /* ignore */ }
  }

  async syncPresetsFromServer() {
    try {
      const r = await fetch('/api/sound-presets', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data.presets) && data.presets.length) {
        const merged = new Map();
        for (const p of this.presets) merged.set(p.name, p);
        for (const p of data.presets) {
          if (p && p.name && p.config) merged.set(p.name, p);
        }
        this.presets = [...merged.values()];
        this.saveLocalPresets();
        this.emit();
      }
    } catch { /* offline or standalone */ }
  }

  async syncPresetsToServer() {
    try {
      await fetch('/api/sound-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: this.presets }),
      });
    } catch { /* ignore */ }
  }

  runningCount() {
    return this.state?.counts?.running || 0;
  }

  effectiveActivity() {
    const running = this.runningCount();
    const total = Math.max(1, this.state?.agents?.length || 1);
    const ratio = clamp(running / Math.min(8, total), 0, 1);
    const norm = clamp(running / 6, 0, 1);
    return clamp(0.15 + (0.65 * norm + 0.35 * ratio) * this.cfg.reactivity, 0.08, 1);
  }

  effectiveBpm() {
    const running = this.runningCount();
    const boost = running * 5.5 * this.cfg.reactivity;
    return Math.round(clamp(this.cfg.tempo + boost, 45, 175));
  }

  activeAgentsByModel() {
    const out = { pro: [], flash: [], flash_lite: [] };
    const agents = this.state?.agents || [];
    for (const a of agents) {
      if (a.state !== 'running') continue;
      if (a.model === 'pro' || a.model === 'opus') out.pro.push(a);
      else if (a.model === 'flash_lite' || a.model === 'haiku') out.flash_lite.push(a);
      else out.flash.push(a);
    }
    return out;
  }

  ensureAudio() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;

    const master = ctx.createGain();
    master.gain.value = this.cfg.master * 0.72;
    comp.connect(master);
    master.connect(ctx.destination);

    // Channel buses
    const chMelody = ctx.createGain();
    const chBubbles = ctx.createGain();
    const chMag = ctx.createGain();
    const chDrone = ctx.createGain();
    chMelody.connect(comp);
    chBubbles.connect(comp);
    chMag.connect(comp);
    chDrone.connect(comp);

    // Subtle stereo delay / shimmer bus for melody & VLF
    const delayL = ctx.createDelay(1.0);
    const delayR = ctx.createDelay(1.0);
    delayL.delayTime.value = 0.23;
    delayR.delayTime.value = 0.31;
    const fbL = ctx.createGain(); fbL.gain.value = 0.26;
    const fbR = ctx.createGain(); fbR.gain.value = 0.24;
    const wetLpf = ctx.createBiquadFilter();
    wetLpf.type = 'lowpass'; wetLpf.frequency.value = 2600;
    const wetGain = ctx.createGain(); wetGain.gain.value = 0.28;
    delayL.connect(fbL); fbL.connect(delayR);
    delayR.connect(fbR); fbR.connect(delayL);
    delayL.connect(wetLpf); delayR.connect(wetLpf);
    wetLpf.connect(wetGain); wetGain.connect(comp);

    const melodyWetSend = ctx.createGain(); melodyWetSend.gain.value = 0.35;
    melodyWetSend.connect(delayL);
    const magWetSend = ctx.createGain(); magWetSend.gain.value = 0.45;
    magWetSend.connect(delayR);

    // Noise buffer (brown/pink water bed + cosmic/rain hiss)
    const len = ctx.sampleRate * 4;
    const brownBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const pinkBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const bd = brownBuf.getChannelData(0);
    const pd = pinkBuf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.03 * w) / 1.03;
      bd[i] = last * 2.4;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      pd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.14;
    }

    // Water / Rain bed
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = brownBuf; waterSrc.loop = true;
    const waterLpf = ctx.createBiquadFilter();
    waterLpf.type = 'lowpass'; waterLpf.frequency.value = 280; waterLpf.Q.value = 1.5;
    const waterLfo = ctx.createOscillator();
    waterLfo.frequency.value = 0.18;
    const waterLfoGain = ctx.createGain();
    waterLfoGain.gain.value = 95;
    waterLfo.connect(waterLfoGain); waterLfoGain.connect(waterLpf.frequency);
    const waterGain = ctx.createGain(); waterGain.gain.value = 0;
    waterSrc.connect(waterLpf); waterLpf.connect(waterGain); waterGain.connect(chBubbles);
    waterSrc.start(); waterLfo.start();

    // Cosmic / Rain shimmer hiss
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = pinkBuf; hissSrc.loop = true;
    const hissBpf = ctx.createBiquadFilter();
    hissBpf.type = 'bandpass'; hissBpf.frequency.value = 1850; hissBpf.Q.value = 0.8;
    const hissGain = ctx.createGain(); hissGain.gain.value = 0;
    hissSrc.connect(hissBpf); hissBpf.connect(hissGain); hissGain.connect(chMag);
    hissSrc.start();

    // 7.83 Hz Schumann resonance AM carrier on warm low tone
    const schOsc = ctx.createOscillator();
    schOsc.type = 'sine';
    schOsc.frequency.value = scaleNoteFreq(this.cfg, 0, -2);
    const schLfo = ctx.createOscillator();
    schLfo.type = 'sine';
    schLfo.frequency.value = 7.83;
    const schAm = ctx.createGain();
    schAm.gain.value = 0.35; // modulated by 7.83 Hz
    const schLfoDepth = ctx.createGain();
    schLfoDepth.gain.value = 0.28;
    schLfo.connect(schLfoDepth); schLfoDepth.connect(schAm.gain);
    const schGain = ctx.createGain(); schGain.gain.value = 0;
    schOsc.connect(schAm); schAm.connect(schGain); schGain.connect(chMag);
    schOsc.start(); schLfo.start();

    // Harmonic Root + Fifth Pad Drone
    const droneOsc1 = ctx.createOscillator();
    const droneOsc2 = ctx.createOscillator();
    const droneOsc3 = ctx.createOscillator();
    droneOsc1.type = 'triangle';
    droneOsc2.type = 'sine';
    droneOsc3.type = 'sine';
    const droneLpf = ctx.createBiquadFilter();
    droneLpf.type = 'lowpass'; droneLpf.frequency.value = 520; droneLpf.Q.value = 1.2;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0;
    droneOsc1.connect(droneLpf); droneOsc2.connect(droneLpf); droneOsc3.connect(droneLpf);
    droneLpf.connect(droneGain); droneGain.connect(chDrone);
    droneOsc1.start(); droneOsc2.start(); droneOsc3.start();

    this.nodes = {
      master, comp,
      chMelody, chBubbles, chMag, chDrone,
      melodyWetSend, magWetSend,
      waterLpf, waterGain,
      hissBpf, hissGain,
      schOsc, schGain,
      droneOsc1, droneOsc2, droneOsc3, droneLpf, droneGain,
    };
    this.updateContinuousNodes();
    return true;
  }

  updateContinuousNodes() {
    if (!this.nodes || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.nodes;
    const act = this.effectiveActivity();
    const activeFactor = this.enabled ? 1 : 0;

    n.master.gain.setTargetAtTime(this.cfg.master * 0.72, t, 0.06);
    n.chMelody.gain.setTargetAtTime(this.cfg.mix.melody * activeFactor, t, 0.08);
    n.chBubbles.gain.setTargetAtTime(this.cfg.mix.bubbles * activeFactor, t, 0.08);
    n.chMag.gain.setTargetAtTime(this.cfg.mix.magnetosphere * activeFactor, t, 0.08);
    n.chDrone.gain.setTargetAtTime(this.cfg.mix.drone * activeFactor, t, 0.08);

    // Water bed & cosmic hiss levels react to activity
    n.waterGain.gain.setTargetAtTime(this.enabled ? 0.05 + act * 0.18 : 0, t, 0.35);
    n.waterLpf.frequency.setTargetAtTime(210 + act * 280, t, 0.35);

    n.hissGain.gain.setTargetAtTime(this.enabled ? 0.015 + act * 0.045 : 0, t, 0.4);
    n.hissBpf.frequency.setTargetAtTime(1200 + act * 1400, t, 0.4);

    // Drone + Schumann frequencies follow Root + Octave + Scale Fifth
    const rootLow = scaleNoteFreq(this.cfg, 0, -1);
    const fifthLow = rootLow * 1.4983; // pure-ish warm fifth
    const rootSub = rootLow * 0.5;
    n.droneOsc1.frequency.setTargetAtTime(rootLow, t, 0.18);
    n.droneOsc2.frequency.setTargetAtTime(fifthLow, t, 0.18);
    n.droneOsc3.frequency.setTargetAtTime(rootSub, t, 0.18);
    n.droneLpf.frequency.setTargetAtTime(340 + act * 540, t, 0.35);
    n.droneGain.gain.setTargetAtTime(this.enabled ? 0.07 + act * 0.09 : 0, t, 0.35);

    n.schOsc.frequency.setTargetAtTime(rootSub, t, 0.2);
    n.schGain.gain.setTargetAtTime(this.enabled ? 0.055 + act * 0.06 : 0, t, 0.35);
  }

  // ---- Synthesis Primitives ----

  playScaleTone(freq, delay = 0, durSec = 0.35, opts = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    if (this.cfg.mix.melody <= 0.01 && !opts.force) return;
    const t = this.ctx.currentTime + delay;
    const ep = this.cfg.episode;
    const amp = opts.amp ?? 0.14;
    const panVal = opts.pan ?? 0;

    const g = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';

    if (ep === 'desert_oud' || ep === 'zen_garden') {
      // Plucked resonant string / koto Karplus-like envelope
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = ep === 'desert_oud' ? 'sawtooth' : 'triangle';
      o2.type = 'sine';
      o1.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq * 2, t);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.32, t);
      g2.gain.exponentialRampToValueAtTime(0.01, t + durSec * 0.45);
      f.frequency.setValueAtTime(Math.min(5800, freq * (ep === 'desert_oud' ? 4.2 : 5.5)), t);
      f.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.25), t + durSec * 0.85);
      f.Q.value = ep === 'desert_oud' ? 2.4 : 1.6;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
      o1.connect(f); o2.connect(g2); g2.connect(f);
      o1.start(t); o2.start(t);
      o1.stop(t + durSec + 0.03); o2.stop(t + durSec + 0.03);
    } else if (ep === 'tron_1977') {
      // Detuned analog dual-osc synth through resonant lowpass
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = opts.wave || 'sawtooth';
      o2.type = 'triangle';
      o1.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq * 1.0045, t);
      f.frequency.setValueAtTime(Math.min(6200, freq * (3.2 + this.effectiveActivity() * 2.5)), t);
      f.frequency.exponentialRampToValueAtTime(Math.max(200, freq * 1.3), t + durSec);
      f.Q.value = 3.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp * 0.85, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
      o1.connect(f); o2.connect(f);
      o1.start(t); o2.start(t);
      o1.stop(t + durSec + 0.03); o2.stop(t + durSec + 0.03);
    } else {
      // Clean Glass / Marimba / Harmonic bell tone
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = opts.wave || 'triangle';
      o2.type = 'sine';
      o1.frequency.setValueAtTime(freq, t);
      o2.frequency.setValueAtTime(freq * 2, t);
      const g2 = this.ctx.createGain(); g2.gain.value = 0.18;
      f.frequency.setValueAtTime(Math.min(6800, freq * 4.5), t);
      f.Q.value = 0.8;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
      o1.connect(f); o2.connect(g2); g2.connect(f);
      o1.start(t); o2.start(t);
      o1.stop(t + durSec + 0.03); o2.stop(t + durSec + 0.03);
    }

    const dest = opts.force ? this.nodes.master : this.nodes.chMelody;
    if (pan) {
      pan.pan.value = clamp(panVal, -0.85, 0.85);
      f.connect(g); g.connect(pan); pan.connect(dest);
      if (!opts.force) pan.connect(this.nodes.melodyWetSend);
    } else {
      f.connect(g); g.connect(dest);
      if (!opts.force) g.connect(this.nodes.melodyWetSend);
    }
  }

  playBubble(baseHz = 270 + Math.random() * 190, durSec = 0.075 + Math.random() * 0.05, amp = 0.22, force = false) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    if (!force && this.cfg.mix.bubbles <= 0.01) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const bpf = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseHz, t);
    osc.frequency.exponentialRampToValueAtTime(baseHz * (1.85 + Math.random() * 0.75), t + durSec);
    bpf.type = 'bandpass'; bpf.frequency.setValueAtTime(baseHz * 1.45, t); bpf.Q.value = 3.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);
    const dest = force ? this.nodes.master : this.nodes.chBubbles;
    if (pan) {
      pan.pan.value = (Math.random() * 1.4) - 0.7;
      osc.connect(bpf); bpf.connect(g); g.connect(pan); pan.connect(dest);
    } else {
      osc.connect(bpf); bpf.connect(g); g.connect(dest);
    }
    osc.start(t); osc.stop(t + durSec + 0.025);
  }

  playGurgleBurst(count = 2, force = false) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.playBubble(220 + i * 75 + Math.random() * 130, 0.065 + Math.random() * 0.045, 0.18, force);
      }, i * (52 + Math.random() * 48));
    }
  }

  // Earth Magnetosphere / VLF Chorus: descending whistler sweep (3800Hz -> 380Hz) with chorus shimmer
  playWhistlerSweep(force = false) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    if (!force && this.cfg.mix.magnetosphere <= 0.01) return;
    const t = this.ctx.currentTime;
    const durSec = 0.85 + Math.random() * 0.95;
    const startHz = 3200 + Math.random() * 900; // ~3800Hz range
    const endHz = 340 + Math.random() * 90;    // ~380Hz range

    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(startHz, t);
    o1.frequency.exponentialRampToValueAtTime(endHz, t + durSec);
    o2.frequency.setValueAtTime(startHz * 1.009, t);
    o2.frequency.exponentialRampToValueAtTime(endHz * 1.007, t + durSec);

    const bpf = this.ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(startHz * 0.85, t);
    bpf.frequency.exponentialRampToValueAtTime(endHz * 1.15, t + durSec);
    bpf.Q.value = 1.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.07);
    g.gain.exponentialRampToValueAtTime(0.06, t + durSec * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durSec);

    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const dest = force ? this.nodes.master : this.nodes.chMag;
    o1.connect(bpf); o2.connect(bpf); bpf.connect(g);
    if (pan) {
      pan.pan.value = (Math.random() * 1.2) - 0.6;
      g.connect(pan); pan.connect(dest);
      if (!force) pan.connect(this.nodes.magWetSend);
    } else {
      g.connect(dest);
      if (!force) g.connect(this.nodes.magWetSend);
    }
    o1.start(t); o2.start(t);
    o1.stop(t + durSec + 0.04); o2.stop(t + durSec + 0.04);
  }

  // Rising dawn-chorus VLF chirps
  playDawnChorusCluster(count = 3, force = false) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    if (!force && this.cfg.mix.magnetosphere <= 0.01) return;
    for (let i = 0; i < count; i++) {
      const delay = i * (0.065 + Math.random() * 0.07);
      const t = this.ctx.currentTime + delay;
      const f0 = 750 + Math.random() * 1100;
      const f1 = f0 * (1.45 + Math.random() * 0.65);
      const d = 0.07 + Math.random() * 0.07;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.065, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      const dest = force ? this.nodes.master : this.nodes.chMag;
      osc.connect(g); g.connect(dest);
      if (!force) g.connect(this.nodes.magWetSend);
      osc.start(t); osc.stop(t + d + 0.02);
    }
  }

  // ---- Generative Sequencer Loops ----

  stepMelody() {
    if (!this.enabled) return;
    const running = this.runningCount();
    const bpm = this.effectiveBpm();
    const stepMs = Math.round((60 / bpm / 2) * 1000); // 8th-note grid

    if (this.cfg.mix.melody > 0.02) {
      const byModel = this.activeAgentsByModel();
      const sc = SCALES[this.cfg.scale] || SCALES.lydian;
      const len = sc.intervals.length;

      // Additive minimalist cell pattern: 3+3+2 or 4+3
      const cell = this.cfg.episode === 'glass_minimal'
        ? (this.arpStep % 16 < 8 ? [0, 2, 4, 0, 2, 4, 1, 3] : [0, 1, 3, 4, 0, 2, 3])
        : [0, 2, 4, 5, 4, 2, 1, 3];

      const deg = cell[this.cellCursor % cell.length];
      this.cellCursor++;

      const anyRunning = running > 0;
      if (anyRunning || this.arpStep % 4 === 0) {
        // Pro voice -> Bass / baritone root/fifth/deg
        if (byModel.pro.length > 0 || (this.cfg.episode === 'glass_minimal' && this.arpStep % 2 === 0)) {
          const proDeg = this.arpStep % 4 === 0 ? 0 : (deg % 3);
          this.playScaleTone(scaleNoteFreq(this.cfg, proDeg, -1), 0, 0.48, { amp: 0.13, pan: -0.25, wave: 'triangle' });
        }
        // Flash voice -> Mid arpeggio
        if (byModel.flash.length > 0 || anyRunning || this.arpStep % 4 === 0) {
          const flashDeg = (deg + (this.arpStep % len)) % (len * 2);
          this.playScaleTone(scaleNoteFreq(this.cfg, flashDeg, 0), 0.02, 0.34, { amp: 0.11, pan: 0.15 });
        }
        // Flash-Lite voice -> High crystalline shimmer
        if (byModel.flash_lite.length > 0) {
          const liteDeg = (deg + 2) % len;
          this.playScaleTone(scaleNoteFreq(this.cfg, liteDeg, 1), 0.04, 0.24, { amp: 0.075, pan: 0.45, wave: 'sine' });
        }
      }
      this.arpStep++;
    }

    this.arpTimer = setTimeout(() => this.stepMelody(), stepMs);
  }

  stepBubbles() {
    if (!this.enabled) return;
    const running = this.runningCount();
    const act = this.effectiveActivity();
    const wait = running > 0
      ? Math.max(480, 2200 - act * 1450) + Math.random() * 800
      : 3200 + Math.random() * 1400;

    if (this.cfg.mix.bubbles > 0.02 && (running > 0 || Math.random() < 0.35)) {
      if (Math.random() < 0.45) {
        this.playGurgleBurst(Math.min(4, 1 + Math.ceil((running || 1) / 2)));
      } else {
        this.playBubble();
      }
    }
    this.bubbleTimer = setTimeout(() => this.stepBubbles(), wait);
  }

  stepMagnetosphere() {
    if (!this.enabled) return;
    const running = this.runningCount();
    const act = this.effectiveActivity();
    const wait = running > 0
      ? Math.max(1100, 4800 - act * 3100) + Math.random() * 1800
      : 5200 + Math.random() * 2400;

    if (this.cfg.mix.magnetosphere > 0.02) {
      const r = Math.random();
      if (r < 0.55) this.playWhistlerSweep();
      else this.playDawnChorusCluster(Math.min(5, 2 + Math.ceil(act * 3)));
    }
    this.vlfTimer = setTimeout(() => this.stepMagnetosphere(), wait);
  }

  startLoops() {
    this.stopLoops();
    this.stepMelody();
    this.stepBubbles();
    this.stepMagnetosphere();
  }

  stopLoops() {
    clearTimeout(this.arpTimer);
    clearTimeout(this.bubbleTimer);
    clearTimeout(this.vlfTimer);
    this.arpTimer = this.bubbleTimer = this.vlfTimer = null;
  }

  // ---- Agent Event Sonification ----

  agentModelFor(agentId) {
    const a = this.state?.agents?.find(x => x.id === agentId);
    return a?.model || 'flash';
  }

  agentDegree(agentId) {
    let hash = 0;
    for (let i = 0; i < agentId.length; i++) hash = (hash * 31 + agentId.charCodeAt(i)) | 0;
    const sc = SCALES[this.cfg.scale] || SCALES.lydian;
    return Math.abs(hash) % sc.intervals.length;
  }

  playAgentEvent(ev) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const nowMs = Date.now();
    if (nowMs - this.lastEventToneAt < 65) return;
    this.lastEventToneAt = nowMs;

    const model = this.agentModelFor(ev.agent || '');
    const octOff = (model === 'pro' || model === 'opus') ? -1 : (model === 'flash_lite' || model === 'haiku') ? 1 : 0;
    const baseDeg = this.agentDegree(ev.agent || 'x');

    if (ev.state === 'start') {
      // Ascending scale motif
      this.playScaleTone(scaleNoteFreq(this.cfg, baseDeg, octOff), 0, 0.24, { amp: 0.14, force: true });
      this.playScaleTone(scaleNoteFreq(this.cfg, baseDeg + 2, octOff), 0.08, 0.30, { amp: 0.12, force: true });
    } else if (ev.state === 'progress' || ev.state === 'note') {
      if (this.cfg.mix.bubbles >= 0.35) this.playGurgleBurst(2);
      else if (this.cfg.mix.magnetosphere >= 0.55) this.playDawnChorusCluster(2);
      else this.playScaleTone(scaleNoteFreq(this.cfg, baseDeg + 1, octOff), 0, 0.22, { amp: 0.09 });
    } else if (ev.state === 'done') {
      // Bright triad resolution in active scale
      [0, 2, 4].forEach((off, i) => {
        this.playScaleTone(scaleNoteFreq(this.cfg, baseDeg + off, octOff), i * 0.075, 0.42, { amp: 0.14, force: true });
      });
    } else if (ev.state === 'blocked' || ev.state === 'failed') {
      // Low descending alert interval in current root
      const fHi = scaleNoteFreq(this.cfg, 1, -1);
      const fLo = scaleNoteFreq(this.cfg, 0, -2);
      this.playScaleTone(fHi, 0, 0.18, { amp: 0.15, wave: 'triangle', force: true });
      this.playScaleTone(fLo, 0.09, 0.28, { amp: 0.16, wave: 'triangle', force: true });
    }
  }

  onState(s) {
    this.state = s;
    this.updateContinuousNodes();
    const feed = s?.feed || [];
    if (!this.initializedFeed) {
      for (const ev of feed) this.seenKeys.add(`${ev.t}|${ev.agent}|${ev.state}|${ev.msg}`);
      this.initializedFeed = true;
      this.emit();
      return;
    }
    const fresh = [];
    for (const ev of feed) {
      const k = `${ev.t}|${ev.agent}|${ev.state}|${ev.msg}`;
      if (!this.seenKeys.has(k)) {
        this.seenKeys.add(k);
        fresh.push(ev);
      }
    }
    fresh.slice(0, 3).forEach((ev, i) => setTimeout(() => this.playAgentEvent(ev), i * 105));
    this.emit();
  }

  // ---- Controls & Presets ----

  async toggleEnabled(forceState = null) {
    if (!this.ensureAudio()) return false;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.enabled = forceState === null ? !this.enabled : Boolean(forceState);
    this.updateContinuousNodes();
    if (this.enabled) {
      this.startLoops();
      if (this.cfg.mix.magnetosphere >= 0.45) this.playWhistlerSweep(true);
      else if (this.cfg.mix.bubbles >= 0.45) this.playGurgleBurst(3, true);
      else this.previewChord();
    } else {
      this.stopLoops();
    }
    this.emit();
    return this.enabled;
  }

  async ensureRunningForPreview() {
    if (!this.ensureAudio()) return false;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return true;
  }

  async previewChord() {
    if (!(await this.ensureRunningForPreview())) return;
    const was = this.enabled;
    this.enabled = true;
    [0, 2, 4, 7].forEach((deg, i) => {
      this.playScaleTone(scaleNoteFreq(this.cfg, deg, 0), i * 0.08, 0.55, { amp: 0.15, force: true });
    });
    if (!was) setTimeout(() => { if (!this.arpTimer) this.enabled = false; }, 900);
  }

  async previewWhistler() {
    if (!(await this.ensureRunningForPreview())) return;
    const was = this.enabled;
    this.enabled = true;
    this.playWhistlerSweep(true);
    this.playDawnChorusCluster(3, true);
    if (!was) setTimeout(() => { if (!this.arpTimer) this.enabled = false; }, 1900);
  }

  async previewBubbles() {
    if (!(await this.ensureRunningForPreview())) return;
    const was = this.enabled;
    this.enabled = true;
    this.playGurgleBurst(4, true);
    if (!was) setTimeout(() => { if (!this.arpTimer) this.enabled = false; }, 700);
  }

  applyEpisode(epId) {
    const ep = EPISODES[epId];
    if (!ep) return;
    this.cfg.episode = ep.id;
    this.cfg.scale = ep.scale;
    this.cfg.root = ep.root;
    this.cfg.octave = ep.octave;
    this.cfg.tempo = ep.tempo;
    this.cfg.reactivity = ep.reactivity;
    this.cfg.mix = { ...ep.mix };
    this.saveConfig();
    this.updateContinuousNodes();
    this.emit();
  }

  updateConfig(patch) {
    if (patch.mix) {
      this.cfg.mix = { ...this.cfg.mix, ...patch.mix };
      delete patch.mix;
    }
    Object.assign(this.cfg, patch);
    this.saveConfig();
    this.updateContinuousNodes();
    this.emit();
  }

  applyPresetConfig(config) {
    if (!config || typeof config !== 'object') return;
    this.cfg = {
      ...this.cfg,
      episode: config.episode && EPISODES[config.episode] ? config.episode : this.cfg.episode,
      scale: config.scale && SCALES[config.scale] ? config.scale : this.cfg.scale,
      root: ROOT_NOTES.includes(config.root) ? config.root : this.cfg.root,
      octave: [3, 4, 5].includes(Number(config.octave)) ? Number(config.octave) : this.cfg.octave,
      tempo: clamp(Number(config.tempo || 90), 45, 160),
      reactivity: clamp(Number(config.reactivity ?? 0.75), 0, 1),
      mix: {
        melody: clamp(Number(config.mix?.melody ?? 0.5), 0, 1),
        bubbles: clamp(Number(config.mix?.bubbles ?? 0.2), 0, 1),
        magnetosphere: clamp(Number(config.mix?.magnetosphere ?? 0.2), 0, 1),
        drone: clamp(Number(config.mix?.drone ?? 0.4), 0, 1),
      },
    };
    this.saveConfig();
    this.updateContinuousNodes();
    this.emit();
  }

  saveUserPreset(name) {
    const clean = String(name || '').trim().slice(0, 64);
    if (!clean) return false;
    const entry = {
      name: clean,
      savedAt: new Date().toISOString(),
      config: {
        episode: this.cfg.episode,
        scale: this.cfg.scale,
        root: this.cfg.root,
        octave: this.cfg.octave,
        tempo: this.cfg.tempo,
        reactivity: this.cfg.reactivity,
        mix: { ...this.cfg.mix },
      },
    };
    this.presets = this.presets.filter(p => p.name !== clean).concat([entry]);
    this.saveLocalPresets();
    this.syncPresetsToServer();
    this.emit();
    return true;
  }

  deleteUserPreset(name) {
    this.presets = this.presets.filter(p => p.name !== name);
    this.saveLocalPresets();
    this.syncPresetsToServer();
    this.emit();
  }

  exportPresetsJSON() {
    return JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      active: this.cfg,
      presets: this.presets,
    }, null, 2);
  }

  importPresetsJSON(jsonText) {
    const data = JSON.parse(jsonText);
    const list = Array.isArray(data) ? data : Array.isArray(data?.presets) ? data.presets : [];
    let count = 0;
    const map = new Map(this.presets.map(p => [p.name, p]));
    for (const p of list) {
      if (p && typeof p.name === 'string' && p.name.trim() && p.config) {
        map.set(p.name.trim(), { name: p.name.trim(), savedAt: p.savedAt || new Date().toISOString(), config: p.config });
        count++;
      }
    }
    if (data?.active) this.applyPresetConfig(data.active);
    this.presets = [...map.values()];
    this.saveLocalPresets();
    this.syncPresetsToServer();
    this.emit();
    return count;
  }

  getSnapshot() {
    return {
      enabled: this.enabled,
      cfg: this.cfg,
      running: this.runningCount(),
      effectiveBpm: this.effectiveBpm(),
      activityPct: Math.round(this.effectiveActivity() * 100),
      presets: this.presets,
    };
  }

  // ---- Modal & Header DOM Binding ----

  bindUI() {
    if (this.domBound) return;
    this.domBound = true;

    const btn = document.getElementById('asmrBtn');
    const vol = document.getElementById('asmrVol');
    const openBtn = document.getElementById('soundStudioBtn');
    const ov = document.getElementById('soundStudioOv');

    if (vol) {
      vol.value = String(Math.round(this.cfg.master * 100));
      vol.addEventListener('input', () => {
        this.updateConfig({ master: clamp(Number(vol.value || 0) / 100, 0, 1) });
      });
    }

    if (btn) {
      btn.addEventListener('click', () => this.toggleEnabled());
    }

    if (openBtn && ov) {
      openBtn.addEventListener('click', () => {
        this.renderStudioModal(ov);
        ov.classList.add('on');
      });
    }

    this.onChange(() => {
      if (btn) {
        btn.setAttribute('aria-pressed', String(this.enabled));
        btn.classList.toggle('on', this.enabled);
        btn.textContent = this.enabled ? '🔊 SOUND' : '🔇 SOUND';
      }
      if (vol) {
        const v = String(Math.round(this.cfg.master * 100));
        if (vol.value !== v) vol.value = v;
      }
      if (ov && ov.classList.contains('on')) {
        this.syncStudioValues(ov);
      }
    });

    if (ov) this.renderStudioModal(ov);
    this.emit();
    this.syncPresetsFromServer();
  }

  renderStudioModal(ov) {
    const body = ov.querySelector('#ssBody');
    if (!body || body.dataset.built === '1') {
      this.syncStudioValues(ov);
      return;
    }
    body.dataset.built = '1';

    const groups = ['Western', 'East Asian', 'Middle Eastern', 'Rich & Exotic'];
    const scaleOptionsHtml = groups.map(g => {
      const opts = Object.entries(SCALES)
        .filter(([, s]) => s.group === g)
        .map(([k, s]) => `<option value="${k}">${s.name}</option>`)
        .join('');
      return `<optgroup label="${g}">${opts}</optgroup>`;
    }).join('');

    const rootOptionsHtml = ROOT_NOTES.map(r => `<option value="${r}">${r}</option>`).join('');

    const episodesHtml = Object.values(EPISODES).map(ep => `
      <button type="button" class="ss-ep" data-ep="${ep.id}">
        <div class="ss-ep-top"><strong>${ep.name}</strong><span class="badge m-flash">${ep.badge}</span></div>
        <div class="ss-ep-desc">${ep.desc}</div>
      </button>
    `).join('');

    body.innerHTML = `
      <div class="ss-top">
        <div class="ss-telemetry">
          <span>RUNNING <b id="ssRun">0</b></span>
          <span>EFF BPM <b id="ssEffBpm">--</b></span>
          <span>ACTIVITY <b id="ssAct">0%</b></span>
          <span>SCALE <b id="ssScaleNotes">--</b></span>
        </div>
        <div class="ss-actions">
          <button type="button" class="btn" id="ssPowerBtn">🔇 START AUDIO</button>
          <button type="button" class="btn" id="ssPreviewChord">♪ TEST CHORD</button>
          <button type="button" class="btn" id="ssPreviewVlf">⚡ WHISTLER</button>
          <button type="button" class="btn" id="ssPreviewBub">💧 BUBBLES</button>
        </div>
      </div>

      <div class="ss-sec-h">1 · EPISODE SCENES</div>
      <div class="ss-eps">${episodesHtml}</div>

      <div class="ss-grid">
        <div class="ss-box">
          <div class="ss-sec-h">2 · SCALE &amp; TONAL CENTER</div>
          <div class="ss-row">
            <label>Scale / Maqam
              <select id="ssScale">${scaleOptionsHtml}</select>
            </label>
          </div>
          <div class="ss-row ss-row-2">
            <label>Root Note
              <select id="ssRoot">${rootOptionsHtml}</select>
            </label>
            <label>Base Octave
              <select id="ssOctave">
                <option value="3">Octave 3 (Low)</option>
                <option value="4">Octave 4 (Mid)</option>
                <option value="5">Octave 5 (High)</option>
              </select>
            </label>
          </div>

          <div class="ss-sec-h" style="margin-top:12px">3 · ACTIVITY-REACTIVE LIVE MIXER</div>
          <div class="ss-sliders">
            <label><span>Master Volume</span><b id="ssValMaster">35%</b>
              <input type="range" id="ssMaster" min="0" max="100" value="35">
            </label>
            <label><span>Ch 1 · Scale Melodies / Arps</span><b id="ssValMelody">50%</b>
              <input type="range" id="ssMelody" min="0" max="100" value="50">
            </label>
            <label><span>Ch 2 · ASMR Water &amp; Bubbles</span><b id="ssValBubbles">20%</b>
              <input type="range" id="ssBubbles" min="0" max="100" value="20">
            </label>
            <label><span>Ch 3 · Magnetosphere / VLF &amp; 7.83Hz</span><b id="ssValMag">50%</b>
              <input type="range" id="ssMag" min="0" max="100" value="50">
            </label>
            <label><span>Ch 4 · Harmonic Root+Fifth Drone</span><b id="ssValDrone">45%</b>
              <input type="range" id="ssDrone" min="0" max="100" value="45">
            </label>
            <label><span>Agent Activity Reactivity</span><b id="ssValReact">75%</b>
              <input type="range" id="ssReact" min="0" max="100" value="75">
            </label>
            <label><span>Base Tempo (BPM)</span><b id="ssValTempo">72 BPM</b>
              <input type="range" id="ssTempo" min="45" max="160" value="72">
            </label>
          </div>
        </div>

        <div class="ss-box">
          <div class="ss-sec-h">4 · PRESETS (LOCAL + SERVER SYNC)</div>
          <div class="ss-save-bar">
            <input type="text" id="ssPresetName" placeholder="Preset name (e.g. Late Night Hijaz)">
            <button type="button" class="btn on" id="ssSavePreset">SAVE</button>
          </div>
          <div class="ss-io-bar">
            <button type="button" class="btn" id="ssExportBtn">⬇ EXPORT JSON</button>
            <label class="btn" style="cursor:pointer">⬆ IMPORT JSON<input type="file" id="ssImportFile" accept=".json,application/json" hidden></label>
            <span class="ss-status" id="ssPresetStatus"></span>
          </div>
          <div class="ss-preset-sub">Saved Mixes</div>
          <div class="ss-preset-list" id="ssUserPresets"></div>
          <div class="ss-preset-sub">Built-In Presets</div>
          <div class="ss-preset-list" id="ssBuiltinPresets"></div>
        </div>
      </div>
    `;

    // Wire events
    body.querySelectorAll('[data-ep]').forEach(el => {
      el.addEventListener('click', () => this.applyEpisode(el.dataset.ep));
    });

    body.querySelector('#ssPowerBtn').addEventListener('click', () => this.toggleEnabled());
    body.querySelector('#ssPreviewChord').addEventListener('click', () => this.previewChord());
    body.querySelector('#ssPreviewVlf').addEventListener('click', () => this.previewWhistler());
    body.querySelector('#ssPreviewBub').addEventListener('click', () => this.previewBubbles());

    body.querySelector('#ssScale').addEventListener('change', e => this.updateConfig({ scale: e.target.value }));
    body.querySelector('#ssRoot').addEventListener('change', e => this.updateConfig({ root: e.target.value }));
    body.querySelector('#ssOctave').addEventListener('change', e => this.updateConfig({ octave: Number(e.target.value) }));

    body.querySelector('#ssMaster').addEventListener('input', e => this.updateConfig({ master: Number(e.target.value) / 100 }));
    body.querySelector('#ssMelody').addEventListener('input', e => this.updateConfig({ mix: { melody: Number(e.target.value) / 100 } }));
    body.querySelector('#ssBubbles').addEventListener('input', e => this.updateConfig({ mix: { bubbles: Number(e.target.value) / 100 } }));
    body.querySelector('#ssMag').addEventListener('input', e => this.updateConfig({ mix: { magnetosphere: Number(e.target.value) / 100 } }));
    body.querySelector('#ssDrone').addEventListener('input', e => this.updateConfig({ mix: { drone: Number(e.target.value) / 100 } }));
    body.querySelector('#ssReact').addEventListener('input', e => this.updateConfig({ reactivity: Number(e.target.value) / 100 }));
    body.querySelector('#ssTempo').addEventListener('input', e => this.updateConfig({ tempo: Number(e.target.value) }));

    const statusEl = body.querySelector('#ssPresetStatus');
    const nameInput = body.querySelector('#ssPresetName');

    body.querySelector('#ssSavePreset').addEventListener('click', () => {
      const ok = this.saveUserPreset(nameInput.value || `${EPISODES[this.cfg.episode]?.badge || 'Mix'} · ${this.cfg.scale}`);
      if (ok) {
        nameInput.value = '';
        statusEl.textContent = 'Saved & synced';
      }
    });

    body.querySelector('#ssExportBtn').addEventListener('click', () => {
      const blob = new Blob([this.exportPresetsJSON()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gantt-sound-presets.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      statusEl.textContent = 'Exported JSON';
    });

    body.querySelector('#ssImportFile').addEventListener('change', async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const text = await f.text();
        const count = this.importPresetsJSON(text);
        statusEl.textContent = `Imported ${count} preset(s)`;
      } catch {
        statusEl.textContent = 'Invalid JSON file';
      }
      e.target.value = '';
    });

    this.syncStudioValues(ov);
  }

  syncStudioValues(ov) {
    const body = ov?.querySelector('#ssBody');
    if (!body || body.dataset.built !== '1') return;
    const c = this.cfg;

    body.querySelectorAll('[data-ep]').forEach(el => el.classList.toggle('on', el.dataset.ep === c.episode));

    const pwr = body.querySelector('#ssPowerBtn');
    if (pwr) {
      pwr.classList.toggle('on', this.enabled);
      pwr.textContent = this.enabled ? '🔊 AUDIO ON' : '🔇 START AUDIO';
    }

    const setVal = (sel, v) => { const el = body.querySelector(sel); if (el && el.value !== String(v)) el.value = String(v); };
    setVal('#ssScale', c.scale);
    setVal('#ssRoot', c.root);
    setVal('#ssOctave', c.octave);
    setVal('#ssMaster', Math.round(c.master * 100));
    setVal('#ssMelody', Math.round(c.mix.melody * 100));
    setVal('#ssBubbles', Math.round(c.mix.bubbles * 100));
    setVal('#ssMag', Math.round(c.mix.magnetosphere * 100));
    setVal('#ssDrone', Math.round(c.mix.drone * 100));
    setVal('#ssReact', Math.round(c.reactivity * 100));
    setVal('#ssTempo', c.tempo);

    const setTxt = (sel, t) => { const el = body.querySelector(sel); if (el && el.textContent !== t) el.textContent = t; };
    setTxt('#ssValMaster', `${Math.round(c.master * 100)}%`);
    setTxt('#ssValMelody', `${Math.round(c.mix.melody * 100)}%`);
    setTxt('#ssValBubbles', `${Math.round(c.mix.bubbles * 100)}%`);
    setTxt('#ssValMag', `${Math.round(c.mix.magnetosphere * 100)}%`);
    setTxt('#ssValDrone', `${Math.round(c.mix.drone * 100)}%`);
    setTxt('#ssValReact', `${Math.round(c.reactivity * 100)}%`);
    setTxt('#ssValTempo', `${c.tempo} BPM`);

    setTxt('#ssRun', String(this.runningCount()));
    setTxt('#ssEffBpm', String(this.effectiveBpm()));
    setTxt('#ssAct', `${Math.round(this.effectiveActivity() * 100)}%`);
    const sc = SCALES[c.scale] || SCALES.lydian;
    setTxt('#ssScaleNotes', `${c.root}${c.octave} [${sc.intervals.join(',')}]`);

    this.renderPresetLists(body);
  }

  renderPresetLists(body) {
    const uBox = body.querySelector('#ssUserPresets');
    const bBox = body.querySelector('#ssBuiltinPresets');
    if (!uBox || !bBox) return;

    uBox.innerHTML = '';
    if (!this.presets.length) {
      uBox.innerHTML = '<div class="empty" style="padding:8px">No saved mixes yet</div>';
    } else {
      for (const p of this.presets) {
        const row = document.createElement('div');
        row.className = 'ss-pr-row';
        const info = document.createElement('span');
        info.className = 'ss-pr-name';
        info.textContent = p.name;
        info.title = `${p.config?.scale || ''} · ${p.config?.root || ''}${p.config?.octave || ''}`;
        const loadBtn = document.createElement('button');
        loadBtn.type = 'button'; loadBtn.className = 'btn'; loadBtn.textContent = 'LOAD';
        loadBtn.addEventListener('click', () => this.applyPresetConfig(p.config));
        const delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.className = 'btn'; delBtn.textContent = '✕';
        delBtn.title = 'Delete preset';
        delBtn.addEventListener('click', () => this.deleteUserPreset(p.name));
        row.append(info, loadBtn, delBtn);
        uBox.appendChild(row);
      }
    }

    if (bBox.dataset.built !== '1') {
      bBox.dataset.built = '1';
      for (const p of BUILTIN_PRESETS) {
        const row = document.createElement('div');
        row.className = 'ss-pr-row';
        const info = document.createElement('span');
        info.className = 'ss-pr-name';
        info.textContent = p.name;
        const loadBtn = document.createElement('button');
        loadBtn.type = 'button'; loadBtn.className = 'btn'; loadBtn.textContent = 'LOAD';
        loadBtn.addEventListener('click', () => this.applyPresetConfig(p.config));
        row.append(info, loadBtn);
        bBox.appendChild(row);
      }
    }
  }
}

const studio = new SoundStudioEngine();
studio.ROOT_NOTES = ROOT_NOTES;
studio.SCALES = SCALES;
studio.EPISODES = EPISODES;
studio.BUILTIN_PRESETS = BUILTIN_PRESETS;
window.GanttSoundStudio = studio;

function init() {
  studio.bindUI();
  if (window.__GANTT_LAST_STATE__) {
    studio.onState(window.__GANTT_LAST_STATE__);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
