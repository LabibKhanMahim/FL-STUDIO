import { useState, useRef, useEffect, useCallback } from 'react';

export interface StemConfig {
  id: string;
  name: string;
  color: string;
  freqRange: [number, number]; // Index range in the frequency bin (0-127)
  mute: boolean;
  solo: boolean;
}

export const STEMS: StemConfig[] = [
  { id: '1', name: 'Kick', color: '#ff5c5c', freqRange: [0, 2], mute: false, solo: false }, // Low lows
  { id: '2', name: 'Bass / 808', color: '#ff8a00', freqRange: [2, 6], mute: false, solo: false }, // Lows
  { id: '3', name: 'Snare', color: '#ffb900', freqRange: [15, 25], mute: false, solo: false }, // Low-mids
  { id: '4', name: 'Hi-Hat', color: '#c4ff00', freqRange: [60, 100], mute: false, solo: false }, // Highs
  { id: '5', name: 'Piano', color: '#00ff73', freqRange: [20, 40], mute: false, solo: false }, // Mids
  { id: '6', name: 'Synth', color: '#00d5ff', freqRange: [30, 60], mute: false, solo: false }, // Mid-highs
  { id: '7', name: 'Vocals', color: '#7b00ff', freqRange: [40, 80], mute: false, solo: false }, // Presence
  { id: '8', name: 'FX / Atmos', color: '#d900ff', freqRange: [100, 127], mute: false, solo: false }, // Air
];

export function useAudioEngine() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stems, setStems] = useState<StemConfig[]>(STEMS);
  const [audioProfile, setAudioProfile] = useState<Float32Array | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // We use Web Audio API to get frequency data for fake meter bounces
  const analyserData = useRef<{ freq: Uint8Array, time: Uint8Array }>({
    freq: new Uint8Array(0),
    time: new Uint8Array(0)
  });

  const requestRef = useRef<number>(null);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
  };

  const loadAudio = async (file: File) => {
    setIsLoading(true);
    
    // Simulate loading plugins and separating stems
    const steps = [
      "Loading plugins (Fruity Limiter)...",
      "Scanning frequencies...",
      "Extracting vocals via AI...",
      "Separating drum bus...",
      "Isolating bass and low-end...",
      "Project Loaded."
    ];

    for (let i = 0; i < steps.length; i++) {
      setLoadingText(steps[i]);
      await new Promise(r => setTimeout(r, 600)); // Fake processing time
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      audio.currentTime = 0;
    });

    initAudioContext();
    const ctx = audioContextRef.current!;

    // Perform actual quick analysis to make visualizer real
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Need a separate context for decoding if we want it isolated, but ctx is fine
      // decodeAudioData consumes the arrayBuffer
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)); 
      const data = audioBuffer.getChannelData(0);
      const PROFILE_BINS = 3000;
      const chunkSize = Math.floor(data.length / PROFILE_BINS);
      const profile = new Float32Array(PROFILE_BINS);
      for (let i = 0; i < PROFILE_BINS; i++) {
          let sum = 0;
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, data.length);
          const step = Math.max(1, Math.floor((end - start) / 20));
          let count = 0;
          for (let j = start; j < end; j += step) {
              sum += Math.abs(data[j]);
              count++;
          }
          profile[i] = sum / Math.max(1, count);
      }
      let max = 0;
      for(let i=0; i<PROFILE_BINS; i++) if(profile[i]>max) max=profile[i];
      if (max > 0) {
         for (let i = 0; i < PROFILE_BINS; i++) profile[i] = Math.pow(profile[i] / max, 0.7);
      }
      setAudioProfile(profile);
    } catch(err) {
      console.error("Analysis failed", err);
      const fake = new Float32Array(100).fill(0.5);
      setAudioProfile(fake);
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = source;

    analyserData.current.freq = new Uint8Array(analyser.frequencyBinCount);
    analyserData.current.time = new Uint8Array(analyser.frequencyBinCount);

    setIsLoaded(true);
    setIsLoading(false);
  };

  const play = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    audioRef.current?.play();
    setIsPlaying(true);
    startAnimation();
  };

  const pause = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    stopAnimation();
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    stopAnimation();
  };

  const startAnimation = useCallback(() => {
    const update = () => {
      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(analyserData.current.freq);
        analyserRef.current.getByteTimeDomainData(analyserData.current.time);
      }
      requestRef.current = requestAnimationFrame(update);
    };
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying]);

  const stopAnimation = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startAnimation();
    } else {
      stopAnimation();
    }
    return () => stopAnimation();
  }, [isPlaying, startAnimation, stopAnimation]);

  return {
    isLoaded,
    isLoading,
    loadingText,
    loadAudio,
    play,
    pause,
    stop,
    isPlaying,
    currentTime,
    duration,
    audioProfile,
    analyserData,
    stems,
    setStems
  };
}
