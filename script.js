const STEMS = [
  { name: 'Vocal', band: [350, 3200], color: '#ffb25c', detail: 'Lead Vox Lane' },
  { name: 'Bass / 808', band: [20, 180], color: '#73ff9d', detail: 'Sub Harmonics' },
  { name: 'Drums', band: [60, 12000], color: '#ffd36f', detail: 'Bus Group' },
  { name: 'Kick', band: [40, 120], color: '#ff9966', detail: 'Transient Lane' },
  { name: 'Snare', band: [180, 2200], color: '#ffb87a', detail: 'Transient Lane' },
  { name: 'Hi-Hat', band: [5000, 13000], color: '#93b6ff', detail: 'Top End' },
  { name: 'Piano', band: [200, 3800], color: '#a9c0ff', detail: 'Chord Stack' },
  { name: 'Melody', band: [400, 5000], color: '#d7a8ff', detail: 'Lead Motif' },
  { name: 'Synth', band: [120, 9000], color: '#8de7ff', detail: 'Poly Layer' },
  { name: 'FX / Atmosphere', band: [700, 15000], color: '#8bf8d6', detail: 'Spatial Textures' }
];

const el = {
  audioInput: document.getElementById('audioInput'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  status: document.getElementById('statusText'),
  playlistLanes: document.getElementById('playlistLanes'),
  mixerChannels: document.getElementById('mixerChannels'),
  sequencerRows: document.getElementById('sequencerRows'),
  piano: document.getElementById('pianoCanvas'),
  spectrum: document.getElementById('spectrumCanvas'),
  playhead: document.getElementById('playhead'),
  overlay: document.getElementById('startupOverlay'),
  startupLines: document.getElementById('startupLines'),
  startupProgress: document.getElementById('startupProgress')
};

let audioCtx;
let source;
let analyser;
let audioBuffer;
let waveSurfer;
let isPlaying = false;
let startedAt = 0;
let pausedAt = 0;
let frame;
let beatPulse = 0;
let bpmEstimate = 120;
let beatGrid = [];

const laneRefs = [];
const mixerRefs = [];
const sequencerRows = [];
const pianoCtx = el.piano.getContext('2d');
const spectrumCtx = el.spectrum.getContext('2d');
const fftBins = 1024;
const freqData = new Uint8Array(fftBins);
const timeData = new Uint8Array(fftBins);

function createLayout() {
  const frag = document.createDocumentFragment();
  STEMS.forEach((stem) => {
    const lane = document.createElement('article');
    lane.className = 'lane';
    lane.innerHTML = `
      <div class="lane-label">
        <div class="lane-name">${stem.name}</div>
        <div class="lane-sub">${stem.detail}</div>
      </div>
      <div class="wave-slot"><canvas class="wave-canvas"></canvas></div>
    `;
    const canvas = lane.querySelector('canvas');
    laneRefs.push({ ...stem, lane, canvas, ctx: canvas.getContext('2d'), energy: 0, waveform: [] });
    frag.appendChild(lane);
  });
  el.playlistLanes.appendChild(frag);

  const mixFrag = document.createDocumentFragment();
  const plugins = ['Fruity Parametric EQ 2', 'Fruity Limiter', 'Maximus', 'Reeverb 2', 'Delay 3', 'Soft Clipper'];
  const pluginRack = document.getElementById('pluginRack');
  pluginRack.innerHTML = plugins.map((name) => `<div class="plugin-slot">${name}</div>`).join('');
  STEMS.forEach((stem, i) => {
    const channel = document.createElement('div');
    channel.className = 'channel';
    channel.innerHTML = `
      <div class="channel-name">${i + 1}. ${stem.name}</div>
      <div class="meter"><div class="meter-fill"></div></div>
      <input class="fader" type="range" min="0" max="100" value="${62 - (i % 5) * 4}" />
    `;
    mixerRefs.push({ meter: channel.querySelector('.meter-fill') });
    mixFrag.appendChild(channel);
  });
  el.mixerChannels.appendChild(mixFrag);

  ['Kick', 'Snare', 'Hi-Hat'].forEach((name) => {
    const row = document.createElement('div');
    row.className = 'seq-row';
    const steps = Array.from({ length: 16 }, (_, i) => `<div class="step" data-step="${i}"></div>`).join('');
    row.innerHTML = `<div class="seq-row-name">${name}</div>${steps}`;
    sequencerRows.push({
      name,
      steps: [...row.querySelectorAll('.step')]
    });
    el.sequencerRows.appendChild(row);
  });

  [...laneRefs].forEach(({ canvas }) => resizeCanvas(canvas));
  resizeCanvas(el.piano);
  resizeCanvas(el.spectrum);
}

function resizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startupSequence() {
  const lines = [
    'Loading plugins...',
    'Calibrating project clock...',
    'Analyzing stems...',
    'Separating instruments...',
    'Generating mixer routes...',
    'Project Loaded.'
  ];

  if (typeof gsap === 'undefined') {
    el.overlay.style.display = 'none';
    return;
  }

  const tl = gsap.timeline({ onComplete: () => gsap.to(el.overlay, { autoAlpha: 0, duration: 0.6, onComplete: () => { el.overlay.style.display = 'none'; } }) });
  lines.forEach((line, i) => {
    tl.to(el.startupProgress, { width: `${((i + 1) / lines.length) * 100}%`, duration: 0.45 }, i * 0.45)
      .call(() => {
        const div = document.createElement('div');
        div.textContent = `> ${line}`;
        el.startupLines.appendChild(div);
      }, null, i * 0.45 + 0.06);
  });
}

function setupWaveSurfer(url) {
  if (typeof WaveSurfer === 'undefined') return;
  if (waveSurfer) waveSurfer.destroy();
  waveSurfer = WaveSurfer.create({
    container: '#masterWave',
    waveColor: '#465271',
    progressColor: '#ff9d2f',
    cursorColor: '#ffcf72',
    barWidth: 2,
    barGap: 1,
    height: 54,
    normalize: true,
    interact: false
  });
  waveSurfer.load(url);
}

function averageBand(data, fromHz, toHz, sampleRate) {
  const hzPerBin = sampleRate / 2 / data.length;
  const start = Math.max(0, Math.floor(fromHz / hzPerBin));
  const end = Math.min(data.length - 1, Math.ceil(toHz / hzPerBin));
  let sum = 0;
  let count = 0;
  for (let i = start; i <= end; i += 1) {
    sum += data[i];
    count += 1;
  }
  return count ? sum / (count * 255) : 0;
}

function drawLaneWave(laneRef, idx) {
  const { ctx, canvas, waveform, color, energy } = laneRef;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  waveform.push(energy * (0.6 + Math.random() * 0.8));
  if (waveform.length > w) waveform.shift();

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(13,16,24,0.92)';
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  waveform.forEach((value, x) => {
    const amp = value * h * 0.47 * (1 + (idx % 3) * 0.08);
    const y = h / 2 + Math.sin((x + performance.now() * 0.03) * 0.09) * amp;
    ctx.lineTo(x, y);
  });
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawSpectrum() {
  const w = el.spectrum.clientWidth;
  const h = el.spectrum.clientHeight;
  spectrumCtx.clearRect(0, 0, w, h);
  spectrumCtx.fillStyle = '#101523';
  spectrumCtx.fillRect(0, 0, w, h);

  const barCount = 80;
  const step = Math.floor(freqData.length / barCount);
  const barW = w / barCount;
  for (let i = 0; i < barCount; i += 1) {
    const v = freqData[i * step] / 255;
    const barH = Math.max(2, v * h);
    const hue = 110 - i * 1.1;
    spectrumCtx.fillStyle = `hsl(${hue}, 90%, ${45 + v * 30}%)`;
    spectrumCtx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
  }
}

function drawPianoRoll() {
  const w = el.piano.clientWidth;
  const h = el.piano.clientHeight;
  pianoCtx.clearRect(0, 0, w, h);
  pianoCtx.fillStyle = '#101422';
  pianoCtx.fillRect(0, 0, w, h);

  pianoCtx.strokeStyle = 'rgba(255,255,255,.08)';
  for (let y = 0; y < 12; y += 1) {
    const py = (y / 12) * h;
    pianoCtx.beginPath();
    pianoCtx.moveTo(0, py);
    pianoCtx.lineTo(w, py);
    pianoCtx.stroke();
  }

  const t = performance.now() * 0.0012;
  for (let i = 0; i < 18; i += 1) {
    const phase = (t * (0.55 + i * 0.03) + i * 0.21) % 1;
    const x = phase * (w + 90) - 90;
    const noteH = 8 + (i % 5);
    const y = ((i * 17) % (h - 20)) + (Math.sin(t * 3 + i) * 6);
    const energy = laneRefs[7]?.energy || 0;
    const alpha = 0.25 + energy * 0.75;
    pianoCtx.fillStyle = `rgba(173, 198, 255, ${alpha})`;
    pianoCtx.fillRect(x, y, 48 + (i % 3) * 15, noteH);
  }
}

function updateSequencer(beatPhase, energyMap) {
  const stepIndex = Math.floor((beatPhase % 1) * 16);
  sequencerRows.forEach((row) => {
    const intensity = energyMap[row.name] || 0;
    row.steps.forEach((step, i) => {
      const active = i === stepIndex && intensity > 0.18;
      step.classList.toggle('active', active);
      if (active) {
        step.style.transform = `scale(${1 + intensity * 0.35})`;
      } else {
        step.style.transform = 'scale(1)';
      }
    });
  });
}

function estimateBpm(data, sampleRate) {
  const env = [];
  const win = 1024;
  for (let i = 0; i < data.length - win; i += win) {
    let s = 0;
    for (let j = 0; j < win; j += 1) s += Math.abs(data[i + j]);
    env.push(s / win);
  }

  const minLag = Math.floor((60 / 170) * (sampleRate / win));
  const maxLag = Math.floor((60 / 70) * (sampleRate / win));
  let bestLag = minLag;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let corr = 0;
    for (let i = lag; i < env.length; i += 1) corr += env[i] * env[i - lag];
    if (corr > bestScore) {
      bestScore = corr;
      bestLag = lag;
    }
  }

  const bpm = Math.round(60 / (bestLag * win / sampleRate));
  return Math.max(70, Math.min(170, bpm || 120));
}

function buildBeatGrid(data, sampleRate) {
  const win = 2048;
  const hop = 512;
  const envelope = [];
  for (let i = 0; i < data.length - win; i += hop) {
    let sum = 0;
    for (let j = 0; j < win; j += 1) sum += Math.abs(data[i + j]);
    envelope.push(sum / win);
  }
  const mean = envelope.reduce((a, b) => a + b, 0) / Math.max(1, envelope.length);
  beatGrid = [];
  envelope.forEach((v, i) => {
    if (v > mean * 1.45) {
      beatGrid.push((i * hop) / sampleRate);
    }
  });
}

async function setupAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  const objectUrl = URL.createObjectURL(file);
  setupWaveSurfer(objectUrl);
  audioCtx = audioCtx || new AudioContext();
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;

  const channelData = audioBuffer.getChannelData(0);
  bpmEstimate = estimateBpm(channelData, audioBuffer.sampleRate);
  buildBeatGrid(channelData, audioBuffer.sampleRate);

  el.status.textContent = `Loaded: ${file.name} • ${Math.round(audioBuffer.duration)}s • ${bpmEstimate} BPM (estimated)`;
  [el.playBtn, el.pauseBtn, el.stopBtn].forEach((b) => { b.disabled = false; });
}

function connectSource(offset = 0) {
  if (source) {
    try { source.disconnect(); } catch {}
  }
  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  source.start(0, offset);
  startedAt = audioCtx.currentTime - offset;
  source.onended = () => {
    if (isPlaying && currentTime() >= audioBuffer.duration - 0.02) stop();
  };
}

function currentTime() {
  return isPlaying ? audioCtx.currentTime - startedAt : pausedAt;
}

function updateUIFrame() {
  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  const sampleRate = audioCtx.sampleRate;
  const energies = {};

  laneRefs.forEach((laneRef, i) => {
    const [low, high] = laneRef.band;
    let e = averageBand(freqData, low, high, sampleRate);

    if (laneRef.name === 'Vocal') e *= 1 + averageBand(freqData, 700, 2400, sampleRate) * 0.8;
    if (laneRef.name === 'Bass / 808') e *= 1 + averageBand(freqData, 30, 90, sampleRate) * 1.2;
    if (laneRef.name === 'Kick') e *= 1 + averageBand(freqData, 45, 80, sampleRate) * 1.4;

    laneRef.energy = Math.min(1, e);
    energies[laneRef.name] = laneRef.energy;
    drawLaneWave(laneRef, i);

    laneRef.lane.classList.toggle('active', laneRef.energy > 0.24);
    if (mixerRefs[i]) mixerRefs[i].meter.style.height = `${Math.min(100, laneRef.energy * 115)}%`;
  });

  const t = currentTime();
  let recentBeat = 0;
  for (let i = beatGrid.length - 1; i >= 0; i -= 1) {
    if (beatGrid[i] <= t) {
      recentBeat = beatGrid[i];
      break;
    }
  }
  beatPulse = ((t - recentBeat) * bpmEstimate) / 60;
  updateSequencer(beatPulse, energies);
  drawSpectrum();
  drawPianoRoll();
  const progress = Math.min(1, t / audioBuffer.duration);
  el.playhead.style.left = `${progress * 100}%`;
  if (waveSurfer && waveSurfer.setTime) waveSurfer.setTime(t);

  if (isPlaying) frame = requestAnimationFrame(updateUIFrame);
}

function play() {
  if (!audioBuffer || isPlaying) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  connectSource(pausedAt);
  isPlaying = true;
  el.status.textContent = `Playing • ${bpmEstimate} BPM showcase simulation`;
  updateUIFrame();
}

function pause() {
  if (!isPlaying) return;
  pausedAt = currentTime();
  isPlaying = false;
  try { source.stop(); } catch {}
  cancelAnimationFrame(frame);
  el.status.textContent = `Paused at ${pausedAt.toFixed(1)}s`;
}

function stop() {
  if (source) {
    try { source.stop(); } catch {}
  }
  isPlaying = false;
  pausedAt = 0;
  cancelAnimationFrame(frame);
  el.playhead.style.left = '0%';
  if (waveSurfer && waveSurfer.setTime) waveSurfer.setTime(0);
  el.status.textContent = `Stopped • Ready`;
}

function bindEvents() {
  el.audioInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    el.status.textContent = 'Decoding and analyzing uploaded song…';
    await setupAudio(file);
  });

  el.playBtn.addEventListener('click', play);
  el.pauseBtn.addEventListener('click', pause);
  el.stopBtn.addEventListener('click', stop);

  window.addEventListener('resize', () => {
    [...laneRefs].forEach(({ canvas }) => resizeCanvas(canvas));
    resizeCanvas(el.piano);
    resizeCanvas(el.spectrum);
  });
}

createLayout();
bindEvents();
startupSequence();
