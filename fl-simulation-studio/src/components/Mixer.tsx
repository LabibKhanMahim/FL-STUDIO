import React, { useEffect, useRef, useState } from 'react';
import { StemConfig } from '../hooks/useAudioEngine';
import { SlidersHorizontal, ArrowDownUp, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

interface MixerProps {
  stems: StemConfig[];
  analyserData: React.MutableRefObject<{ freq: Uint8Array, time: Uint8Array }>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

const FADER_HEIGHT = 130;
const CANVAS_HEIGHT = 130;

interface MixerStripProps {
  key?: string | number;
  stem: StemConfig | null;
  index: number;
  isMaster?: boolean;
  analyserData: React.MutableRefObject<{ freq: Uint8Array, time: Uint8Array }>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

function MixerStrip({ stem, index, isMaster, analyserData, currentTime, duration, isPlaying }: MixerStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const autoCanvasRef = useRef<HTMLCanvasElement>(null);
  const faderRef = useRef<HTMLDivElement>(null);
  
  const volumeRef = useRef(0.8);
  const autoModeRef = useRef<'off' | 'read' | 'write'>('off');
  const [uiState, setUiState] = useState({ autoMode: 'off' });
  const automationData = useRef<Float32Array>(new Float32Array(200).fill(-1));
  const isDragging = useRef(false);

  // Sync latest props into refs for requestAnimationFrame
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const durRef = useRef(duration);
  durRef.current = duration;
  const isPlayRef = useRef(isPlaying);
  isPlayRef.current = isPlaying;

  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      // 1. Handle Automation Data
      // If we are playing, check progress
      if (durRef.current > 0 && isPlayRef.current) {
        const progress = timeRef.current / durRef.current;
        const bucket = Math.floor(progress * 200);
        if (bucket >= 0 && bucket < 200) {
          if (autoModeRef.current === 'write') {
            automationData.current[bucket] = volumeRef.current;
          } else if (autoModeRef.current === 'read' && !isDragging.current) {
            const val = automationData.current[bucket];
            if (val !== -1) {
              volumeRef.current = val;
            }
          }
        }
      }

      // 2. Update fader dom directly for smooth movement
      if (faderRef.current) {
          const topPx = (1 - volumeRef.current) * (FADER_HEIGHT - 36);
          faderRef.current.style.top = `${topPx}px`;
      }

      // 3. Draw Level Meter
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          let peakLevel = 0;
          if (isMaster) {
            let sum = 0;
            for (let j = 0; j < analyserData.current.freq.length; j++) {
              sum += analyserData.current.freq[j];
            }
            const avg = sum / analyserData.current.freq.length;
            peakLevel = Math.min(1.0, (avg / 128) * 1.5) * volumeRef.current;
          } else if (stem) {
            let peak = 0;
            const [startBin, endBin] = stem.freqRange;
            for (let j = startBin; j <= endBin; j++) {
              if (analyserData.current.freq[j] > peak) {
                peak = analyserData.current.freq[j];
              }
            }
            peakLevel = Math.min(1.0, (peak / 255) * 1.2) * volumeRef.current;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#161618';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const segmentCount = 30;
          const segmentHeight = canvas.height / segmentCount;
          const gap = 1;
          const activeSegments = Math.round(peakLevel * segmentCount);

          for (let i = 0; i < segmentCount; i++) {
            const y = canvas.height - (i * segmentHeight) - segmentHeight + gap;
            const h = segmentHeight - gap;
            let color = '#3f4044';
            if (i < activeSegments) {
               if (i < 20) color = '#37d652';
               else if (i < 26) color = '#ffb900';
               else color = '#ff5c5c';
            }
            ctx.fillStyle = color;
            if (isMaster) {
               ctx.fillRect(1, y, canvas.width - 2, h);
               ctx.fillRect(canvas.width / 2 + 1, y, canvas.width / 2 - 2, h);
            } else {
               ctx.fillRect(1, y, canvas.width - 2, h);
            }
          }

          if (activeSegments > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(1, canvas.height - (activeSegments * segmentHeight) - 2, canvas.width - 2, 2);
          }
        }
      }

      // 4. Draw Automation Canvas
      const autoCanvas = autoCanvasRef.current;
      if (autoCanvas) {
          const ctx = autoCanvas.getContext('2d');
          if (ctx) {
              ctx.clearRect(0, 0, autoCanvas.width, autoCanvas.height);
              
              // Frame
              ctx.fillStyle = '#161618';
              ctx.fillRect(0, 0, autoCanvas.width, autoCanvas.height);

              // Grid lines
              ctx.strokeStyle = '#2a2b2e';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, autoCanvas.height/2); ctx.lineTo(autoCanvas.width, autoCanvas.height/2);
              ctx.stroke();

              // Draw Data Line
              ctx.strokeStyle = autoModeRef.current === 'write' ? '#ff5c5c' : (autoModeRef.current === 'read' ? '#37d652' : '#8e8e93');
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              for(let i=0; i<200; i++) {
                  let val = automationData.current[i];
                  if (val === -1) val = 0.8; // Default value if untouched
                  const x = (i / 200) * autoCanvas.width;
                  const y = (1 - val) * autoCanvas.height;
                  if (i===0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
              }
              ctx.stroke();

              // Playhead
              if (durRef.current > 0) {
                  const px = (timeRef.current / durRef.current) * autoCanvas.width;
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                  ctx.fillRect(px, 0, 1, autoCanvas.height);
              }
          }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [stem, isMaster, analyserData]);

  const toggleAutoMode = () => {
    const next = autoModeRef.current === 'off' ? 'read' : (autoModeRef.current === 'read' ? 'write' : 'off');
    autoModeRef.current = next;
    setUiState({ autoMode: next });
  };

  const handlePointerDownFader = (e: React.PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    isDragging.current = true;
    const startY = e.clientY;
    const startVol = volumeRef.current;
    const TRAVEL = FADER_HEIGHT - 36;

    const onMove = (evt: PointerEvent) => {
        const deltaY = evt.clientY - startY;
        let newVol = startVol - (deltaY / TRAVEL);
        newVol = Math.max(0, Math.min(1, newVol));
        volumeRef.current = newVol;
    };

    const onUp = (evt: PointerEvent) => {
        isDragging.current = false;
        target.removeEventListener('pointermove', onMove as unknown as EventListener);
        target.removeEventListener('pointerup', onUp as unknown as EventListener);
    };

    target.addEventListener('pointermove', onMove as unknown as EventListener);
    target.addEventListener('pointerup', onUp as unknown as EventListener);
  };

  const handlePointerDownAutoDraw = (e: React.PointerEvent) => {
      if (autoModeRef.current !== 'write') {
          autoModeRef.current = 'write';
          setUiState({ autoMode: 'write'});
      }
      
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const rect = target.getBoundingClientRect();

      const updatePt = (evt: PointerEvent | React.PointerEvent) => {
          const x = evt.clientX - rect.left;
          const y = evt.clientY - rect.top;
          const bucket = Math.floor((x / rect.width) * 200);
          const val = 1 - (y / rect.height);
          if (bucket >= 0 && bucket < 200) {
              automationData.current[bucket] = Math.max(0, Math.min(1, val));
          }
      };
      updatePt(e);

      const onMove = (evt: PointerEvent) => updatePt(evt);
      const onUp = (evt: PointerEvent) => {
          target.removeEventListener('pointermove', onMove as unknown as EventListener);
          target.removeEventListener('pointerup', onUp as unknown as EventListener);
      };
      target.addEventListener('pointermove', onMove as unknown as EventListener);
      target.addEventListener('pointerup', onUp as unknown as EventListener);
  };

  return (
      <div className={cn(
        "flex flex-col items-center border-r border-[#3f4044] bg-[#2a2b2e] w-[64px] pb-2 shrink-0 relative",
        isMaster && "border-l-2 border-l-[#161618]"
      )}>
         <div className="h-6 w-full bg-[#161618] border-b border-[#3f4044] text-center text-[10px] font-bold py-1 text-[#8e8e93] truncate px-1">
            {isMaster ? 'M' : index + 1}
         </div>
         
         <div className="flex flex-col items-center py-2 gap-2 w-full border-b border-[#161618]">
            <div className="w-5 h-5 rounded-full border-2 border-[#161618] bg-gradient-to-br from-[#3f4044] to-[#1e1e20] relative">
               <div className="absolute top-[2px] left-1/2 w-0.5 h-1.5 bg-white -translate-x-1/2 origin-bottom rotate-0"></div>
            </div>
            <div className="w-4 h-4 rounded-full border-2 border-[#161618] bg-gradient-to-br from-[#3f4044] to-[#1e1e20] relative">
               <div className="absolute top-[1px] left-1/2 w-0.5 h-1 bg-[#ff7b00] -translate-x-1/2 origin-bottom rotate-0"></div>
            </div>
         </div>

         <div className="flex w-full p-1 gap-1.5 items-end justify-center select-none pt-2 relative">
            
            <div className="w-3 bg-[#161618] p-px border border-[#111] overflow-hidden rounded-sm" style={{ height: CANVAS_HEIGHT }}>
               <canvas ref={canvasRef} width={10} height={CANVAS_HEIGHT} className="block w-full h-full" />
            </div>

            <div className="w-[20px] bg-[#161618] border border-[#111] rounded-sm relative shadow-inner flex justify-center" style={{ height: FADER_HEIGHT }}>
               <div className="absolute inset-x-0 inset-y-2 flex flex-col justify-between items-center pointer-events-none">
                 {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className={cn("h-px w-2 bg-[#3f4044]", i === 2 && "w-3 bg-white")}></div>
                 ))}
               </div>
               
               <div 
                  ref={faderRef}
                  className="absolute w-[22px] h-[36px] bg-gradient-to-b from-[#5f6064] to-[#2a2b2e] border-2 border-[#111] rounded-sm shadow-lg cursor-ns-resize flex flex-col justify-center items-center gap-[2px] z-10"
                  style={{ top: `${(1 - 0.8) * (FADER_HEIGHT - 36)}px` }}
                  onPointerDown={handlePointerDownFader}
               >
                  <div className="h-[1px] w-4 bg-white/20"></div>
                  <div className="h-[2px] w-4 bg-white"></div>
                  <div className="h-[1px] w-4 bg-white/20"></div>
               </div>
            </div>
         </div>

         <div className="w-full flex md:flex-col items-center flex-col scale-90 mt-1 gap-1">
             <button 
                onClick={toggleAutoMode}
                className={cn(
                    "text-[8px] font-bold px-1 rounded border",
                    uiState.autoMode === 'off' ? "bg-[#161618] border-[#3f4044] text-[#555]" : 
                    uiState.autoMode === 'read' ? "bg-[#1a3a20] border-[#37d652] text-[#37d652]" : 
                    "bg-[#3a1a1a] border-[#ff5c5c] text-[#ff5c5c]"
                )}
             >
                {uiState.autoMode === 'off' ? 'AUTO OFF' : uiState.autoMode === 'read' ? 'AUTO READ' : 'AUTO WRITE'}
             </button>
             <div className="w-[52px] h-[30px] p-px bg-[#161618] border border-[#111] rounded shadow-inner">
                <canvas 
                    ref={autoCanvasRef} 
                    width={50} height={28} 
                    className="block w-full h-full cursor-crosshair rounded-sm"
                    onPointerDown={handlePointerDownAutoDraw}
                />
             </div>
         </div>

         <div className="mt-1 w-[52px] px-1">
            <div 
              className="text-[8px] font-bold text-center py-1 rounded-sm text-[#111] truncate shadow-inner shadow-white/20"
              style={{ backgroundColor: isMaster ? '#8e8e93' : (stem?.color || '#3f4044') }}
            >
               {isMaster ? 'Master' : (stem?.name || 'Insert')}
            </div>
         </div>
      </div>
  );
}

export function Mixer({ stems, analyserData, currentTime, duration, isPlaying }: MixerProps) {
  const [fxSlots, setFxSlots] = useState<(string | null)[]>([
    'Fruity Parametric EQ 2',
    'Fruity Reeverb 2',
    'Fruity Limiter',
    null, null, null, null, null, null, null
  ]);
  const [activeMenu, setActiveMenu] = useState<{ index: number, top: number, left: number } | null>(null);
  
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const fxCanvasRef = useRef<HTMLCanvasElement>(null);
  const fxAutoData = useRef<Float32Array[]>(Array(10).fill(null).map(() => new Float32Array(200).fill(-1)));
  const fxAutoMode = useRef<('off'|'read'|'write')[]>(Array(10).fill('off'));
  const [fxUiState, setFxUiState] = useState<('off'|'read'|'write')[]>(Array(10).fill('off'));

  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  const durRef = useRef(duration);
  durRef.current = duration;
  const isPlayRef = useRef(isPlaying);
  isPlayRef.current = isPlaying;

  // Animation Loop for FX Panel Canvas
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      const canvas = fxCanvasRef.current;
      if (canvas && fxSlots[selectedSlot]) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.fillStyle = '#1B2125';
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              // Grid lines
              ctx.strokeStyle = '#2a2b2e';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(0, canvas.height/2); ctx.lineTo(canvas.width, canvas.height/2);
              ctx.moveTo(0, canvas.height/4); ctx.lineTo(canvas.width, canvas.height/4);
              ctx.moveTo(0, canvas.height*0.75); ctx.lineTo(canvas.width, canvas.height*0.75);
              ctx.stroke();

              // Draw Data
              const mode = fxAutoMode.current[selectedSlot];
              ctx.strokeStyle = mode === 'write' ? '#ff5c5c' : (mode === 'read' ? '#37d652' : '#8e8e93');
              ctx.lineWidth = 2;
              ctx.beginPath();
              
              const data = fxAutoData.current[selectedSlot];
              let hasData = false;
              for(let i=0; i<200; i++) {
                 if (data[i] !== -1) hasData = true;
                 // default to 0.5 (center) if no data
                 let val = data[i] === -1 ? 0.5 : data[i]; 
                 const x = (i / 200) * canvas.width;
                 const y = (1 - val) * canvas.height;
                 if (i===0) ctx.moveTo(x, y);
                 else ctx.lineTo(x, y);
              }
              if (!hasData) ctx.globalAlpha = 0.3;
              ctx.stroke();
              ctx.globalAlpha = 1.0;

              // Playhead
              if (durRef.current > 0) {
                  const px = (timeRef.current / durRef.current) * canvas.width;
                  ctx.fillStyle = 'rgba(255, 123, 0, 0.8)';
                  ctx.fillRect(px, 0, 2, canvas.height);
              }
          }
      } else if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             ctx.fillStyle = '#161618';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
      }
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [selectedSlot, fxSlots]);

  const FX_PLUGINS = [
    'Fruity Parametric EQ 2',
    'Fruity Reeverb 2',
    'Fruity Delay 3',
    'Fruity Flanger',
    'Gross Beat',
    'Maximus',
    'Soundgoodizer',
    'Fruity Limiter',
    'Fruity Compressor'
  ];

  const handleSlotMenuClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveMenu({
      index,
      top: rect.top,
      left: rect.left - 200
    });
  };

  const handleSlotClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedSlot(index);
    if (!fxSlots[index]) {
       handleSlotMenuClick(e, index);
    }
  };

  const handleSlotDoubleClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedSlot(index);
    handleSlotMenuClick(e, index);
  };

  const toggleFxAutoMode = (index: number) => {
    const current = fxAutoMode.current[index];
    const next = current === 'off' ? 'read' : (current === 'read' ? 'write' : 'off');
    fxAutoMode.current[index] = next;
    const newModes = [...fxUiState];
    newModes[index] = next;
    setFxUiState(newModes);
  };

  const handlePointerDownFxAuto = (e: React.PointerEvent) => {
      if (!fxSlots[selectedSlot]) return;

      if (fxAutoMode.current[selectedSlot] !== 'write') {
          fxAutoMode.current[selectedSlot] = 'write';
          const newModes = [...fxUiState];
          newModes[selectedSlot] = 'write';
          setFxUiState(newModes);
      }
      
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      const rect = target.getBoundingClientRect();
      
      let lastBucket = -1;

      const updatePt = (evt: PointerEvent | React.PointerEvent) => {
          const x = evt.clientX - rect.left;
          const y = evt.clientY - rect.top;
          let bucket = Math.floor((x / rect.width) * 200);
          bucket = Math.max(0, Math.min(199, bucket));
          const val = Math.max(0, Math.min(1, 1 - (y / rect.height)));
          
          const data = fxAutoData.current[selectedSlot];
          
          if (lastBucket !== -1 && Math.abs(bucket - lastBucket) > 1) {
             const startB = Math.min(bucket, lastBucket);
             const endB = Math.max(bucket, lastBucket);
             const startV = data[startB === lastBucket ? lastBucket : bucket] || val; // Fallback
             const endV = data[endB === lastBucket ? lastBucket : bucket] || val; // Fallback
             
             // In our interpolation, since we drag, we assume value travels from last to current linearly
             const prevVal = data[lastBucket] !== -1 ? data[lastBucket] : val;
             const steps = Math.abs(bucket - lastBucket);
             for (let i = 1; i <= steps; i++) {
                 const stepB = lastBucket < bucket ? lastBucket + i : lastBucket - i;
                 data[stepB] = prevVal + (val - prevVal) * (i / steps);
             }
          }
          data[bucket] = val;
          lastBucket = bucket;
      };
      updatePt(e);

      const onMove = (evt: PointerEvent) => updatePt(evt);
      const onUp = (evt: PointerEvent) => {
          target.removeEventListener('pointermove', onMove as unknown as EventListener);
          target.removeEventListener('pointerup', onUp as unknown as EventListener);
      };
      target.addEventListener('pointermove', onMove as unknown as EventListener);
      target.addEventListener('pointerup', onUp as unknown as EventListener);
  };

  const handleSelectPlugin = (index: number, plugin: string | null) => {
    const newSlots = [...fxSlots];
    newSlots[index] = plugin;
    setFxSlots(newSlots);
    setActiveMenu(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e20]">
      <div className="h-8 bg-[#2a2b2e] border-b border-[#3f4044] flex items-center px-3 justify-between shrink-0">
        <div className="flex gap-4 text-[#8e8e93]">
          <div className="text-[10px] font-bold flex items-center gap-2">
             <SlidersHorizontal className="w-3.5 h-3.5" /> MIXER
          </div>
        </div>
        <div className="flex gap-2 text-[#8e8e93] items-center">
            <ArrowDownUp className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-[#1e1e20]">
        <div className="flex flex-1 overflow-x-auto p-1 pb-2 custom-scrollbar">
           <MixerStrip 
              stem={null} 
              index={stems.length} 
              isMaster={true} 
              analyserData={analyserData} 
              currentTime={currentTime} 
              duration={duration} 
              isPlaying={isPlaying} 
           />
           
           <div className="w-1 bg-[#161618] border-x border-[#3f4044] mx-1 h-full shadow-inner z-10 shrink-0"></div>
           
           {stems.map((stem, index) => (
               <MixerStrip 
                  key={stem.id}
                  stem={stem} 
                  index={index} 
                  isMaster={false} 
                  analyserData={analyserData} 
                  currentTime={currentTime} 
                  duration={duration} 
                  isPlaying={isPlaying} 
               />
           ))}
           
           {Array.from({ length: 15 }).map((_, i) => (
             <div key={`empty-${i}`} className="flex flex-col items-center border-r border-[#3f4044] bg-[#2a2b2e] w-[64px] pb-2 shrink-0 opacity-50">
                <div className="h-6 w-full bg-[#161618] border-b border-[#3f4044] text-center text-[10px] font-bold py-1 text-[#5f6064]">
                   {stems.length + i + 1}
                </div>
                <div className="flex flex-col items-center py-2 gap-2 w-full border-b border-[#161618]">
                  <div className="w-5 h-5 rounded-full border-2 border-[#161618] bg-gradient-to-br from-[#3f4044] to-[#1e1e20]"></div>
                  <div className="w-4 h-4 rounded-full border-2 border-[#161618] bg-gradient-to-br from-[#3f4044] to-[#1e1e20]"></div>
                </div>
                <div className="flex w-full p-1 gap-1.5 items-end justify-center pt-2 relative">
                  <div className="w-3 bg-[#161618] border border-[#111] overflow-hidden rounded-sm" style={{ height: CANVAS_HEIGHT }}></div>
                  <div className="w-[20px] bg-[#161618] border border-[#111] rounded-sm relative" style={{ height: FADER_HEIGHT }}>
                    <div className="absolute inset-x-0 inset-y-2 flex flex-col justify-between items-center pointer-events-none">
                       <div className="h-px w-2 bg-[#3f4044]"></div><div className="h-px w-2 bg-[#3f4044]"></div><div className="h-px w-3 bg-[#8e8e93]"></div><div className="h-px w-2 bg-[#3f4044]"></div><div className="h-px w-2 bg-[#3f4044]"></div>
                    </div>
                    <div className="absolute w-[22px] h-[36px] bg-[#3f4044] border-2 border-[#111] rounded-sm top-[20%] right-[-2px]"></div>
                  </div>
                </div>
                
                <div className="w-full flex flex-col items-center scale-90 mt-1 gap-1">
                   <div className="text-[8px] font-bold px-1 rounded border bg-[#161618] border-[#3f4044] text-[#555]">AUTO OFF</div>
                   <div className="w-[52px] h-[30px] p-px bg-[#161618] border border-[#111] rounded shadow-inner"></div>
                </div>

                <div className="mt-1 w-[52px] px-1">
                   <div className="text-[8px] font-bold text-center py-1 rounded-sm text-[#111] truncate bg-gray-600">Insert</div>
                </div>
             </div>
           ))}
        </div>

        {/* Master FX Panel */}
        <div className="w-[200px] bg-[#2a2b2e] border-l border-[#3f4044] flex flex-col shrink-0 z-10 shadow-[-5px_0_15px_rgba(0,0,0,0.5)] relative">
            <div className="h-6 w-full bg-[#161618] border-b border-[#3f4044] text-[10px] font-bold py-1 px-2 text-[#8e8e93]">
               MASTER - FX SLOTS
            </div>
            <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar bg-[#1e1e20]">
               {fxSlots.map((plugin, i) => {
                 const isActive = plugin !== null;
                 const isSelected = selectedSlot === i;
                 return (
                   <div 
                      key={i} 
                      className={cn(
                        "flex h-[24px] bg-[#2a2b2e] border rounded-[3px] items-center pl-1.5 shrink-0 group relative",
                        isSelected ? "border-[#ff7b00]" : "border-[#3f4044] hover:border-[#8e8e93]",
                        "cursor-pointer shadow-sm transition-colors"
                      )}
                      onClick={(e) => handleSlotClick(e, i)}
                      onDoubleClick={(e) => handleSlotDoubleClick(e, i)}
                   >
                     <div className={cn(
                        "w-2.5 h-2.5 rounded-full border border-[#111] shrink-0 mr-2",
                        isActive ? "bg-[#37d652] shadow-[0_0_4px_#37d652]" : "bg-[#161618]"
                     )}></div>
                     <span className={cn(
                        "text-[10px] font-semibold truncate flex-1",
                        isActive ? "text-[#e0e0e0]" : "text-[#5f6064]"
                     )}>
                       {plugin ? plugin : `Slot ${i + 1}`}
                     </span>
                     
                     <div 
                        className="w-5 h-full flex items-center justify-center hover:bg-[#3f4044] rounded-r-[2px] ml-1 border-l border-[#3f4044]/50"
                        onClick={(e) => {
                           setSelectedSlot(i);
                           handleSlotMenuClick(e, i);
                        }}
                     >
                       <ChevronDown className="w-3 h-3 text-[#8e8e93]" />
                     </div>
                   </div>
                 );
               })}
               
               <div className="mt-auto pt-2 pb-2 px-1 flex flex-col gap-1 relative border-t border-[#3f4044] mt-2">
                 <div className="flex justify-between items-center bg-[#1B2125] -mx-2 px-2 py-1 mb-1 shadow-sm">
                   <div className="text-[9px] text-[#2ebd4f] font-bold truncate flex-1 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#37d652]"></div>
                      {fxSlots[selectedSlot] ? `AUTOMATE: ${fxSlots[selectedSlot]}` : 'NO PLUGIN'}
                   </div>
                   <button 
                      onClick={() => toggleFxAutoMode(selectedSlot)}
                      disabled={!fxSlots[selectedSlot]}
                      className={cn(
                          "text-[8px] font-bold px-1.5 py-0.5 rounded border ml-1 shrink-0",
                          !fxSlots[selectedSlot] ? "bg-[#161618] border-[#3f4044] text-[#3f4044] cursor-not-allowed" :
                          fxUiState[selectedSlot] === 'write' ? "bg-[#3a1a1a] border-[#ff5c5c] text-[#ff5c5c]" : 
                          fxUiState[selectedSlot] === 'read' ? "bg-[#1a3a20] border-[#37d652] text-[#37d652]" : 
                          "bg-[#1B2125] border-[#3f4044] text-[#8e8e93] hover:text-white"
                      )}
                   >
                     {fxUiState[selectedSlot] === 'write' ? 'WRITE' : fxUiState[selectedSlot] === 'read' ? 'READ' : 'OFF'}
                   </button>
                 </div>
                 <div className="h-[75px] bg-[#1B2125] rounded border border-[#111] relative overflow-hidden shadow-inner w-full ring-1 ring-[#3f4044]">
                    <canvas 
                       ref={fxCanvasRef} 
                       width={180} height={75} 
                       className={cn(
                          "block w-full h-full",
                          fxSlots[selectedSlot] ? "cursor-crosshair" : "opacity-30 cursor-not-allowed"
                       )}
                       onPointerDown={handlePointerDownFxAuto}
                    />
                 </div>
               </div>
            </div>
        </div>
      </div>
      
      {/* Floating FX Menu Context */}
      {activeMenu && (
         <div className="fixed inset-0 z-[100]" onClick={() => setActiveMenu(null)}>
            <div 
               className="fixed w-[180px] bg-[#2a2b2e] border border-[#3f4044] rounded shadow-xl py-1 flex flex-col"
               style={{ top: Math.min(activeMenu.top, window.innerHeight - 300), left: activeMenu.left }}
               onClick={(e) => e.stopPropagation()}
            >
               <div className="px-3 py-1 text-[10px] font-bold text-[#8e8e93] mb-1 uppercase tracking-wider">Select Plugin</div>
               <div 
                  className="px-3 py-1.5 text-[10px] text-[#8e8e93] hover:bg-[#ff7b00] hover:text-white cursor-pointer font-bold mx-1 rounded-sm"
                  onClick={() => handleSelectPlugin(activeMenu.index, null)}
               >
                  (none)
               </div>
               <div className="h-px w-full bg-[#161618] my-1"></div>
               {FX_PLUGINS.map(p => (
                  <div 
                     key={p} 
                     className="px-3 py-1.5 text-[10px] text-[#e0e0e0] hover:bg-[#3f4044] cursor-pointer font-semibold mx-1 rounded-sm"
                     onClick={() => handleSelectPlugin(activeMenu.index, p)}
                  >
                     {p}
                  </div>
               ))}
            </div>
         </div>
      )}
    </div>
  );
}

