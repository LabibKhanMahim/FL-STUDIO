import React, { useEffect, useRef, useMemo } from 'react';
import { StemConfig } from '../hooks/useAudioEngine';
import { cn } from '../lib/utils';
import { Power, Volume2, Search, Settings2, Magnet, Scissors } from 'lucide-react';

interface PlaylistProps {
  stems: StemConfig[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  analyserData: React.MutableRefObject<{ freq: Uint8Array, time: Uint8Array }>;
  audioProfile: Float32Array | null;
}

interface AudioClip {
  id: string;
  start: number; // 0 to 1
  end: number;   // 0 to 1
  label: string;
  varianceSeed: number; // For waveform generation
}

// Generate a dynamic arrangement structure based on actual audio profile
const generateArrangement = (stems: StemConfig[], profile: Float32Array | null): AudioClip[][] => {
  const arrangements: AudioClip[][] = [];
  
  stems.forEach((stem, index) => {
    const clips: AudioClip[] = [];
    const name = stem.name.toLowerCase();

    // Use a smaller number of chunks for generating logical clips so we don't get 3000 tiny clips
    const chunkCount = profile ? Math.min(200, profile.length) : 20;

    let inClip = false;
    let clipStart = 0;

    for (let i = 0; i < chunkCount; i++) {
        // sample profile if it exists (downsample mapping)
        const profileIdx = profile ? Math.floor((i / chunkCount) * profile.length) : 0;
        const val = profile ? profile[profileIdx] : Math.random();
        
        let threshold = 0.2;
        if (name.includes('kick') || name.includes('bass')) threshold = 0.4;
        else if (name.includes('vocal')) threshold = 0.3;
        else if (name.includes('fx')) threshold = 0.5;
        
        const adjustedVal = val + (Math.sin(i * index) * 0.1);

        if (adjustedVal > threshold && !inClip) {
            inClip = true;
            clipStart = i / chunkCount;
        } else if (adjustedVal <= threshold && inClip) {
            inClip = false;
            let end = i / chunkCount;
            if (name.includes('fx') && end - clipStart > 0.05) end = clipStart + 0.05;
            
            clips.push({
                id: `${index}-${clipStart}`,
                start: clipStart,
                end: end,
                label: `${stem.name} pt.${clips.length + 1}`,
                varianceSeed: Math.random()
            });
        }
    }
    
    if (inClip) {
        clips.push({
            id: `${index}-${clipStart}`,
            start: clipStart,
            end: 1.0,
            label: `${stem.name} pt.${clips.length + 1}`,
            varianceSeed: Math.random()
        });
    }

    arrangements.push(clips);
  });
  
  return arrangements;
};

export function Playlist({ stems, currentTime, duration, isPlaying, analyserData, audioProfile }: PlaylistProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const arrangement = useMemo(() => generateArrangement(stems, audioProfile), [stems, audioProfile]);
  const PIXELS_PER_SECOND = 60; // scale factor

  // Draw fake waveforms and playhead
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (containerRef.current) {
          canvas.height = Math.max(containerRef.current.clientHeight, stems.length * 61);
          canvas.width = Math.max(containerRef.current.clientWidth, (duration || 200) * PIXELS_PER_SECOND);
        }
      });
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      canvas.height = Math.max(containerRef.current.clientHeight, stems.length * 61);
      canvas.width = Math.max(containerRef.current.clientWidth, (duration || 200) * PIXELS_PER_SECOND);
    }

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const trackHeight = 60; 
      const trackGap = 1;

      // Draw horizontal grid lines
      ctx.strokeStyle = '#3f4044';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < stems.length + 1; i++) {
        const y = i * (trackHeight + trackGap);
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();

      // Timeline scale (bars/beats)
      const bpm = 130;
      const bps = bpm / 60;
      const totalBeats = (duration || 200) * bps;
      
      ctx.strokeStyle = '#2a2b2e';
      ctx.beginPath();
      for (let i = 0; i < totalBeats; i++) {
        if (canvas.width / totalBeats < 4 && i % 4 !== 0) continue; 
        
        const x = (i / totalBeats) * (duration || 200) * PIXELS_PER_SECOND;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        
        if (i % 4 === 0) {
          ctx.strokeStyle = '#3f4044';
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = '#2a2b2e';
        }
      }
      ctx.stroke();

      // Draw arranged clips
      stems.forEach((stem, index) => {
        const yOffset = index * (trackHeight + trackGap);
        const clips = arrangement[index];

        clips.forEach(clip => {
            const trackWidth = (duration || 200) * PIXELS_PER_SECOND;
            const clipX = clip.start * trackWidth;
            const clipW = (clip.end - clip.start) * trackWidth;
            
            if (clipW < 2) return;

            // Clip Background
            ctx.fillStyle = `${stem.color}15`; 
            ctx.strokeStyle = `${stem.color}90`; 
            
            ctx.fillRect(clipX, yOffset + 2, clipW, trackHeight - 4);
            ctx.strokeRect(clipX, yOffset + 2, clipW, trackHeight - 4);
            
            // Clip header bar
            ctx.fillStyle = `${stem.color}30`;
            ctx.fillRect(clipX, yOffset + 2, clipW, 14);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.fillText(clip.label, clipX + 4, yOffset + 13);

            // Draw hi-res waveform inside clip
            ctx.beginPath();
            ctx.strokeStyle = `${stem.color}d0`;
            ctx.lineWidth = 1.0;
            
            const points = Math.min(clipW, audioProfile ? audioProfile.length / 2 : clipW);
            for (let i = 0; i < points; i++) {
              const x = clipX + (i / points) * clipW;
              if (x > clipX + clipW) continue;

              const relPos = i / points;
              
              // Use real audio profile if available, map position perfectly
              let amplitude = 0.1;
              if (audioProfile && duration > 0) {
                 const absoluteTimeRatio = clip.start + relPos * (clip.end - clip.start);
                 const profileIdx = Math.floor(absoluteTimeRatio * audioProfile.length);
                 if (profileIdx >= 0 && profileIdx < audioProfile.length) {
                    amplitude = Math.max(0.05, audioProfile[profileIdx]);
                 }
              } else {
                 const seedBase = clip.varianceSeed * 1000 + i * 0.1;
                 amplitude = Math.abs(Math.sin(seedBase) * Math.cos(seedBase * 2.3)) * 0.8 + 0.1;
              }
              
              let envelope = 1;
              if (relPos < 0.05) envelope = relPos / 0.05;
              if (relPos > 0.95) envelope = (1 - relPos) / 0.05;
              amplitude *= envelope;
              
              const baseHeight = amplitude * (trackHeight - 20) * 0.8;
              const centerY = yOffset + trackHeight / 2 + 8;
              
              ctx.moveTo(x, centerY - baseHeight);
              ctx.lineTo(x, centerY + baseHeight);
            }
            ctx.stroke();
            
            // Add slight highlight border
            ctx.beginPath();
            ctx.strokeStyle = `${stem.color}30`;
            ctx.lineWidth = 2;
            for (let i = 0; i < points; i+=2) {
              const x = clipX + (i / points) * clipW;
              ctx.moveTo(x, yOffset + trackHeight / 2 + 8);
              ctx.lineTo(x, yOffset + trackHeight / 2 + 8);
            }
            ctx.stroke();
        });
      });

      // Draw Playhead & Auto-Scroll
      if (duration > 0) {
        const progress = currentTime / duration;
        const trackWidth = duration * PIXELS_PER_SECOND;
        const playheadX = progress * trackWidth;
        
        ctx.strokeStyle = '#ff7b00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvas.height);
        ctx.stroke();
        
        ctx.fillStyle = '#ff7b00';
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, 0);
        ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX, 10);
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 123, 0, 0.2)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvas.height);
        ctx.stroke();

        // Auto-Scroll Logic
        if (isPlaying && containerRef.current) {
            const scrollLeft = containerRef.current.scrollLeft;
            const viewWidth = containerRef.current.clientWidth;
            if (playheadX > scrollLeft + viewWidth * 0.85) {
                containerRef.current.scrollLeft = playheadX - viewWidth * 0.15;
            } else if (playheadX < scrollLeft) {
                containerRef.current.scrollLeft = Math.max(0, playheadX - viewWidth * 0.15);
            }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [stems, arrangement, currentTime, duration, isPlaying, analyserData, audioProfile]);

  const handleScroll = () => {
    if (scrollRef.current && containerRef.current) {
       containerRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  };

  const handleCanvasScroll = () => {
      if (scrollRef.current && containerRef.current) {
          scrollRef.current.scrollTop = containerRef.current.scrollTop;
      }
      
      // Keep ruler visually synced with horizontal scrolling
      const ruler = document.getElementById('playlist-ruler-container');
      if (ruler && containerRef.current) {
          ruler.scrollLeft = containerRef.current.scrollLeft;
      }
  };

  // Generate ticks for HTML timeline ruler
  const renderTimelineRuler = () => {
      const bpm = 130;
      const bps = bpm / 60;
      const totalBeats = (duration || 200) * bps;
      const rulerWidth = (duration || 200) * PIXELS_PER_SECOND;
      const markers = [];

      for(let i=0; i<Math.floor(totalBeats); i++) {
         if (i % 4 === 0) {
            markers.push(
               <div key={i} className="absolute h-2 border-l border-[#5f6064] flex flex-col" style={{ left: (i/totalBeats) * rulerWidth }}>
                  <span className="absolute -top-3 left-1 text-[9px] text-[#8e8e93] font-bold select-none">{Math.floor(i/4) + 1}</span>
               </div>
            );
         } else if (totalBeats < 400 || i % 2 === 0) { // Don't crowd
            markers.push(
               <div key={i} className="absolute h-1.5 border-l border-[#3f4044]" style={{ left: (i/totalBeats) * rulerWidth }}></div>
            );
         }
      }
      return (
         <div style={{ width: rulerWidth }} className="h-full relative">
            {markers}
         </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e20]">
      <div className="h-8 bg-[#2a2b2e] border-b border-[#3f4044] flex items-center px-3 justify-between shrink-0">
        <div className="flex gap-4 text-[#8e8e93]">
          <div className="text-[10px] font-bold">PLAYLIST - Arrangement</div>
        </div>
        <div className="flex gap-2 text-[#8e8e93] items-center">
           <div className="w-1.5 h-1.5 rounded-full bg-[#37d652] mr-2"></div>
           <Scissors className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
           <Magnet className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
           <Search className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div 
           className="w-48 bg-[#2a2b2e] border-r border-[#3f4044] flex flex-col overflow-y-auto shrink-0 z-10 custom-scrollbar"
           ref={scrollRef}
           onScroll={handleScroll}
        >
           {stems.map((stem, i) => (
             <div key={stem.id} className="h-[60px] border-b border-[#1e1e20] flex flex-col p-1 gap-1 shrink-0 bg-[#2a2b2e] group">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1.5 w-full">
                      <div className="w-3 h-3 rounded-[2px] shadow-sm ring-1 ring-black/50" style={{ backgroundColor: stem.color }}></div>
                      <span className="text-xs text-[#b3b4b8] group-hover:text-white font-semibold flex-1">Track {i + 1}</span>
                      <span className="text-[9px] text-[#555] max-w-[50px] truncate">{stem.name}</span>
                   </div>
                </div>
                <div className="flex items-center justify-between px-1 mt-auto pb-1">
                   <div className="flex gap-2.5 items-center">
                     <div className="w-3.5 h-3.5 rounded-full bg-[#1e1e20] flex items-center justify-center border border-[#111]">
                        <div className="w-1 h-1 rounded-full bg-[#37d652]"></div>
                     </div>
                     <div className="w-10 h-1.5 bg-[#161618] rounded-full overflow-hidden border border-[#111]">
                       <div className="h-full bg-[#8e8e93] w-[80%] rounded-full shadow-[0_0_2px_#000]"></div>
                     </div>
                   </div>
                   <Settings2 className="w-3.5 h-3.5 text-[#5f6064] cursor-pointer hover:text-white" />
                </div>
             </div>
           ))}
        </div>

        <div className="flex-1 flex flex-col bg-[#161618] relative">
          <div 
              id="playlist-ruler-container"
              className="h-6 bg-[#2a2b2e] border-b border-[#3f4044] shrink-0 overflow-hidden relative"
              style={{ paddingBottom: '0' }}
          >
             <div className="absolute inset-0 flex items-end ml-[1px]">
                 {duration > 0 ? renderTimelineRuler() : null}
             </div>
          </div>
          
          <div 
             ref={containerRef} 
             className="flex-1 relative overflow-auto custom-scrollbar"
             onScroll={handleCanvasScroll}
          >
             <canvas ref={canvasRef} className="absolute inset-0 block bg-[#1B2125]" />
          </div>
        </div>
      </div>
    </div>
  );
}
