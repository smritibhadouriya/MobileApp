import { getAudioContext } from "./sound";

// Generated ambient sounds: no audio files or external streams needed.
// Each layer is a looping noise buffer shaped by a filter (and for some, a baked-in envelope).
function noiseBuffer(ac, kind, seconds) {
  const length = Math.floor(ac.sampleRate * seconds);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else if (kind === "pink") {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    } else {
      data[i] = white * 0.5;
    }
  }
  return { buffer, data, length };
}

function buildBuffer(ac, preset) {
  if (preset === "ocean") {
    // Brown noise swelling in and out like waves (8s loop, two swells)
    const { buffer, data, length } = noiseBuffer(ac, "brown", 8);
    for (let i = 0; i < length; i++) {
      const phase = (i / length) * Math.PI * 4;
      data[i] *= 0.25 + 0.75 * Math.pow((1 - Math.cos(phase)) / 2, 1.5);
    }
    return buffer;
  }
  if (preset === "fire") {
    // Low rumble plus random crackles
    const { buffer, data, length } = noiseBuffer(ac, "brown", 6);
    for (let i = 0; i < length; i++) {
      data[i] *= 0.5;
      if (Math.random() < 0.0004) {
        const size = Math.floor(ac.sampleRate * (0.002 + Math.random() * 0.01));
        const amp = 0.4 + Math.random() * 0.6;
        for (let j = 0; j < size && i + j < length; j++) data[i + j] += (Math.random() * 2 - 1) * amp * (1 - j / size);
      }
    }
    return buffer;
  }
  const kind = { rain: "pink", white: "white", brown: "brown", wind: "pink" }[preset];
  return noiseBuffer(ac, kind, 4).buffer;
}

const FILTERS = {
  rain: { type: "bandpass", frequency: 1800, Q: 0.4 },
  white: { type: "lowpass", frequency: 9000, Q: 0.7 },
  brown: { type: "lowpass", frequency: 500, Q: 0.7 },
  ocean: { type: "lowpass", frequency: 900, Q: 0.5 },
  fire: { type: "lowpass", frequency: 3500, Q: 0.6 },
  wind: { type: "lowpass", frequency: 400, Q: 4 },
};

export const AMBIENT_LAYERS = [
  { id: "rain", label: "Rain", icon: "🌧️" },
  { id: "ocean", label: "Ocean", icon: "🌊" },
  { id: "fire", label: "Fireplace", icon: "🔥" },
  { id: "wind", label: "Wind", icon: "🍃" },
  { id: "white", label: "White Noise", icon: "📻" },
  { id: "brown", label: "Brown Noise", icon: "🟤" },
];

export function startAmbient(preset, volume) {
  const ac = getAudioContext();
  const filter = FILTERS[preset];
  const source = ac.createBufferSource();
  source.buffer = buildBuffer(ac, preset);
  source.loop = true;

  const biquad = ac.createBiquadFilter();
  biquad.type = filter.type;
  biquad.frequency.value = filter.frequency;
  biquad.Q.value = filter.Q;

  const gain = ac.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(volume, ac.currentTime, 0.3);

  source.connect(biquad).connect(gain).connect(ac.destination);
  source.start();

  return {
    setVolume: (v) => gain.gain.setTargetAtTime(v, ac.currentTime, 0.1),
    stop: () => {
      gain.gain.setTargetAtTime(0, ac.currentTime, 0.15);
      source.stop(ac.currentTime + 0.8);
    },
  };
}
