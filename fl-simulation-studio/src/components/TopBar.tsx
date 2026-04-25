import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Square, Circle, ChevronDown, Monitor } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAudioEngine } from '../hooks/useAudioEngine';

interface TopBarProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  currentTime: number;
  duration: number;
  analyserData?: React.MutableRefObject<{ freq: Uint8Array, time: Uint8Array }>;
}

function formatTime(time: number) {
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  const ms = Math.floor((time % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
}

export function TopBar({ isPlaying, onPlay, onPause, onStop, currentTime, duration, analyserData }: TopBarProps) {
  const [cpuUsage, setCpuUsage] = useState(12);
  const spectrumRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCpuUsage(15 + Math.random() * 20);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setCpuUsage(8 + Math.random() * 5);
    }
  }, [isPlaying]);

  // Draw main spectrum
  useEffect(() => {
    if (!analyserData || !spectrumRef.current) return;
    const canvas = spectrumRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111';
      ctx.fillRect(0,0, canvas.width, canvas.height);

      if (isPlaying) {
         ctx.lineWidth = 2;
         ctx.strokeStyle = '#ff7b00';
         ctx.beginPath();
         const data = analyserData.current.freq;
         const sliceWidth = canvas.width / (data.length / 2); // only draw bottom half of freqs
         
         for(let i = 0; i < data.length / 2; i++) {
            const v = data[i] / 255.0;
            const y = canvas.height - (v * canvas.height);
            const x = i * sliceWidth;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
         }
         ctx.stroke();

         // Optional: draw mirrored lines or filled gradient
         ctx.lineTo(canvas.width, canvas.height);
         ctx.lineTo(0, canvas.height);
         ctx.fillStyle = 'rgba(255, 123, 0, 0.2)';
         ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, analyserData]);

  return (
    <div className="h-14 bg-fl-panel border-b border-fl-panel-border flex flex-col justify-center px-2 select-none z-20 shadow-md">
      <div className="flex items-center justify-between">
        {/* Left: Menus */}
        <div className="flex items-center gap-4">
           <div className="font-display font-bold text-[#ff7b00] text-xl tracking-tighter px-2 drop-shadow-[0_0_5px_rgba(255,123,0,0.5)]">FL SIM</div>
           <div className="flex text-xs font-semibold gap-3 text-fl-text">
             <span className="hover:text-white cursor-pointer">FILE</span>
             <span className="hover:text-white cursor-pointer">EDIT</span>
             <span className="hover:text-white cursor-pointer">ADD</span>
             <span className="hover:text-white cursor-pointer">PATTERNS</span>
             <span className="hover:text-white cursor-pointer">VIEW</span>
             <span className="hover:text-white cursor-pointer">OPTIONS</span>
             <span className="hover:text-white cursor-pointer">TOOLS</span>
             <span className="hover:text-white cursor-pointer">HELP</span>
           </div>
        </div>

        {/* Center: Transport & Time & Vis */}
        <div className="flex items-center gap-4 bg-[#161618] p-1.5 rounded border border-[#000] shadow-inner">
           {/* Transport controls */}
           <div className="flex items-center gap-1">
             <button 
               className={cn("p-1 rounded-sm border border-transparent hover:bg-white/10 active:border-[#ff7b00]", isPlaying && "text-fl-green")}
               onClick={isPlaying ? onPause : onPlay}
             >
               {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
             </button>
             <button 
               className="p-1 rounded-sm border border-transparent hover:bg-white/10 active:border-[#ff7b00]"
               onClick={onStop}
             >
               <Square className="w-5 h-5 fill-current" />
             </button>
             <button className="p-1 rounded-sm border border-transparent hover:bg-white/10 text-red-500">
               <Circle className="w-5 h-5 fill-current" />
             </button>
           </div>
           
           <div className="w-px h-6 bg-[#3f4044]"></div>

           {/* BPM & Mode */}
           <div className="flex flex-col items-center">
             <div className="text-[10px] text-[#8e8e93] font-bold">TEMPO</div>
             <div className="text-fl-orange font-mono text-sm">130.000</div>
           </div>

           <div className="w-px h-6 bg-[#3f4044]"></div>

           {/* Time Display */}
           <div className="flex bg-[#2a2b2e] border border-[#3f4044] rounded px-3 py-1 min-w-[100px] justify-center items-center">
             <div className="font-mono text-fl-green text-sm shadow-[0_0_5px_rgba(55,214,82,0.4)]">
               {formatTime(currentTime)}
             </div>
           </div>

           {/* Master Spectro */}
           {analyserData && (
               <div className="w-32 h-8 border border-[#3f4044] rounded overflow-hidden shadow-inner ml-2">
                 <canvas ref={spectrumRef} width={128} height={32} className="block w-full h-full" />
               </div>
           )}
        </div>

        {/* Right: CPU Load & Misc */}
        <div className="flex items-center gap-4">
           {/* CPU Meter */}
           <div className="flex flex-col items-end gap-1 px-3 py-1 bg-[#161618] rounded border border-[#000] shadow-inner">
             <div className="flex items-center gap-2">
               <Monitor className="w-3 h-3 text-[#ff7b00]" />
               <div className="text-[10px] font-bold text-[#8e8e93]">CPU</div>
               <div className="text-xs font-mono text-white w-8 text-right">{cpuUsage.toFixed(0)}%</div>
             </div>
             <div className="w-24 h-1.5 bg-[#2a2b2e] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-fl-green to-red-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, cpuUsage)}%` }}
                />
             </div>
           </div>

           <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#404044] to-[#1c1c1e] border-2 border-[#111] shadow-xl flex items-center justify-center font-display font-bold text-xs text-[#8e8e93] shadow-inner cursor-pointer hover:text-white transition-colors">
              ?
           </div>
        </div>
      </div>
    </div>
  );
}
