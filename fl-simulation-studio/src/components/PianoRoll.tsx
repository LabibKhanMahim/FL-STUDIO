import React, { useEffect, useRef, useState } from 'react';
import { Music, Magnet, Search, Wrench, Scissors, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface PianoRollProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  analyserData: React.MutableRefObject<{ freq: Uint8Array; time: Uint8Array }>;
  audioProfile: Float32Array | null;
}

interface Note {
  id: string;
  pitch: number; // 0-35 (3 octaves)
  start: number; // normalized time 0-1
  end: number;   // normalized time 0-1
  velocity: number;
}

const OCTAVES = 3;
const KEYS_PER_OCTAVE = 12;
const TOTAL_KEYS = OCTAVES * KEYS_PER_OCTAVE;
const KEY_HEIGHT = 20;
const PIXELS_PER_SECOND = 60; // Match playlist

// Helper to check if a key is black
const isBlackKey = (pitch: number) => {
  const noteInOctave = pitch % 12;
  return [1, 3, 6, 8, 10].includes(noteInOctave);
};

// Generate a random pleasant-looking fake melody
const generateFakeNotes = (duration: number, profile: Float32Array | null): Note[] => {
  if (!duration) return [];
  
  const notes: Note[] = [];
  const totalBeats = (duration / 60) * 130; // approx beats at 130bpm
  let currentBeat = 0;
  
  const scale = [0, 2, 4, 5, 7, 9, 11]; // Major scale relative to C
  const baseOctave = 1; // start from middle-ish

  let idCounter = 0;
  let previousPitch = baseOctave * 12 + scale[0];

  while (currentBeat < totalBeats) {
    const timeProgress = currentBeat / totalBeats;
    
    // Check energy at this time progress if profile exists
    let energy = 0.5;
    if (profile) {
       const bucket = Math.floor(timeProgress * profile.length);
       if (bucket >= 0 && bucket < profile.length) {
          energy = profile[bucket];
       }
    }

    // High energy = more notes, less empty space
    const emptyChance = profile ? (1 - energy) * 0.8 : 0.7;

    if (Math.random() < emptyChance) {
      currentBeat += 0.5; // smaller steps when skipping
      continue;
    }

    // High energy might mean faster notes
    const noteLengthBeats = (energy > 0.6 && Math.random() > 0.5) ? 0.25 : (Math.random() > 0.5 ? 0.5 : 1);
    const startObj = (currentBeat / totalBeats);
    const endObj = ((currentBeat + noteLengthBeats) / totalBeats);
    
    // Pick next pitch close to previous
    let scaleIndex = scale.findIndex(s => (previousPitch % 12) === s);
    if (scaleIndex === -1) scaleIndex = 0;
    
    // leap
    scaleIndex += Math.floor(Math.random() * 5) - 2;
    if (scaleIndex < 0) scaleIndex += scale.length;
    scaleIndex %= scale.length;

    const octaveOffset = Math.floor(Math.random() * 2);
    const pitch = (baseOctave + octaveOffset) * 12 + scale[scaleIndex];

    notes.push({
      id: `note-${idCounter++}`,
      pitch: Math.min(Math.max(pitch, 0), TOTAL_KEYS - 1),
      start: startObj,
      end: Math.min(endObj, 1),
      velocity: 0.6 + energy * 0.4
    });
    
    previousPitch = pitch;
    currentBeat += noteLengthBeats;
  }
  return notes;
};

export function PianoRoll({ currentTime, duration, isPlaying, analyserData, audioProfile }: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activePitches, setActivePitches] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Note[]>([]);

  // Interaction State
  const draggingState = useRef<{
    noteId: string;
    type: 'start' | 'end' | 'move';
    startX: number;
    startY?: number;
    initialVal: number;
    initialStart?: number;
    initialEnd?: number;
    initialPitch?: number;
  } | null>(null);

  useEffect(() => {
    setNotes(generateFakeNotes(duration || 180, audioProfile));
  }, [duration, audioProfile]);

  // Handle Canvas Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        if (!Array.isArray(entries) || !entries.length) return;
        if (containerRef.current) {
          canvas.width = Math.max(containerRef.current.clientWidth, (duration || 180) * PIXELS_PER_SECOND);
          canvas.height = Math.max(containerRef.current.clientHeight, TOTAL_KEYS * KEY_HEIGHT);
        }
      });
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      canvas.width = Math.max(containerRef.current.clientWidth, (duration || 180) * PIXELS_PER_SECOND);
      canvas.height = Math.max(containerRef.current.clientHeight, TOTAL_KEYS * KEY_HEIGHT);
    }

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 1;
      for (let i = 0; i < TOTAL_KEYS; i++) {
        const y = i * KEY_HEIGHT;
        ctx.beginPath();
        const isBlack = isBlackKey(TOTAL_KEYS - 1 - i);
        ctx.strokeStyle = isBlack ? '#1e1e20' : '#2a2b2e';
        ctx.fillStyle = isBlack ? '#1a1a1c' : '#222325';
        ctx.fillRect(0, y, canvas.width, KEY_HEIGHT);
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      const bpm = 130;
      const bps = bpm / 60;
      const totalBeats = (duration || 180) * bps;
      
      ctx.strokeStyle = '#3f4044';
      ctx.beginPath();
      for (let i = 0; i < totalBeats; i++) {
        if (canvas.width / totalBeats < 4 && i % 4 !== 0) continue;
        const x = (i / totalBeats) * (duration || 180) * PIXELS_PER_SECOND;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        
        if (i % 4 === 0) {
          ctx.strokeStyle = '#4a4b4f';
          ctx.stroke();
          ctx.beginPath();
          ctx.strokeStyle = '#3f4044';
        }
      }
      ctx.stroke();

      const progress = duration > 0 ? (currentTime / duration) : 0;
      const trackWidth = (duration || 180) * PIXELS_PER_SECOND;
      const playheadX = progress * trackWidth;
      
      let melodyIntensity = 0;
      if (analyserData.current.freq.length > 0) {
          let sum = 0;
          for(let i = 40; i < 60; i++) sum += analyserData.current.freq[i];
          melodyIntensity = sum / 20 / 255;
      }

      const currentlyActive = new Set<number>();

      notes.forEach(note => {
        const x = note.start * trackWidth;
        const width = Math.max((note.end - note.start) * trackWidth, 2);
        
        const y = (TOTAL_KEYS - 1 - note.pitch) * KEY_HEIGHT;
        
        const isActive = progress >= note.start && progress <= note.end;
        if (isActive) {
            currentlyActive.add(note.pitch);
        }

        let hue = 140; // FL green
        let saturation = 90;
        let lightness = isActive ? 60 + (melodyIntensity * 30) : 40;

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        ctx.strokeStyle = `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`;
        
        ctx.fillRect(x + 1, y + 2, width - 2, KEY_HEIGHT - 4);
        ctx.strokeRect(x + 1, y + 2, width - 2, KEY_HEIGHT - 4);
        
        ctx.fillStyle = `rgba(0,0,0,0.3)`;
        ctx.fillRect(x + 1, y + KEY_HEIGHT - 6, width - 2, 4);
      });

      if (activePitches.size !== currentlyActive.size) {
          setActivePitches(currentlyActive);
      }

      // Draw Playhead
      if (duration > 0) {
        ctx.strokeStyle = '#ff7b00';
        ctx.lineWidth = 2;
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
  }, [notes, currentTime, duration, isPlaying, analyserData, activePitches]);

  const renderKeys = () => {
    const keys = [];
    for (let i = TOTAL_KEYS - 1; i >= 0; i--) {
      const isBlack = isBlackKey(i);
      const isActive = activePitches.has(i);
      
      keys.push(
        <div 
          key={i} 
          className={cn(
            "w-full flex justify-end items-center pr-2 text-[10px] select-none border-b",
            isBlack 
              ? "bg-[#111112] text-[#555] border-[#000]" 
              : "bg-[#e5e5e5] text-[#888] border-[#ccc]",
            isActive && isBlack && "bg-[#2a4530] text-[#7ceb92]",
            isActive && !isBlack && "bg-[#cce8d2] text-[#2ebd4f]"
          )}
          style={{ height: `${KEY_HEIGHT}px` }}
        >
          {i % 12 === 0 ? `C${Math.floor(i / 12) + 4}` : ''}
        </div>
      );
    }
    return keys;
  };

  const handleScroll = () => {
    if (scrollRef.current && containerRef.current) {
       containerRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  };

  const handleCanvasScroll = () => {
      if (scrollRef.current && containerRef.current) {
          scrollRef.current.scrollTop = containerRef.current.scrollTop;
      }
      const ruler = document.getElementById('pianoroll-ruler-container');
      if (ruler && containerRef.current) {
          ruler.scrollLeft = containerRef.current.scrollLeft;
      }
  };

  // Drag logic
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cw = Math.max(canvasRef.current.clientWidth, (duration || 180) * PIXELS_PER_SECOND);

    const pitch = TOTAL_KEYS - 1 - Math.floor(y / KEY_HEIGHT);

    // Find notes in this row
    const rowNotes = notes.filter(n => n.pitch === pitch);
    let targetNote: Note | null = null;
    let dragType: 'start' | 'end' | 'move' | null = null;

    // Check hit
    for (const n of rowNotes) {
      const noteStartX = n.start * cw;
      const noteEndX = n.end * cw;
      
      // If clicked near edges (within 5 pixels)
      if (Math.abs(x - noteStartX) < 5) {
         targetNote = n; dragType = 'start'; break;
      }
      if (Math.abs(x - noteEndX) < 5) {
         targetNote = n; dragType = 'end'; break;
      }
      if (x > noteStartX + 5 && x < noteEndX - 5) {
         targetNote = n; dragType = 'move'; break;
      }
    }

    if (targetNote && dragType) {
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingState.current = {
        noteId: targetNote.id,
        type: dragType,
        startX: e.clientX,
        startY: e.clientY,
        initialVal: dragType === 'start' ? targetNote.start : targetNote.end,
        initialStart: targetNote.start,
        initialEnd: targetNote.end,
        initialPitch: targetNote.pitch,
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canvasRef.current || !draggingState.current) return;
    const cw = Math.max(canvasRef.current.clientWidth, (duration || 180) * PIXELS_PER_SECOND);
    const dx = e.clientX - draggingState.current.startX;
    const dy = draggingState.current.startY !== undefined ? e.clientY - draggingState.current.startY : 0;
    
    const dTime = dx / cw;
    const dPitch = -Math.round(dy / KEY_HEIGHT); // Up is positive pitch
    
    setNotes(prev => prev.map(n => {
      if (n.id !== draggingState.current!.noteId) return n;
      
      let newStart = n.start;
      let newEnd = n.end;
      let newPitch = n.pitch;
      
      if (draggingState.current!.type === 'move') {
          const dt = (draggingState.current!.initialEnd! - draggingState.current!.initialStart!);
          newStart = Math.max(0, Math.min(1 - dt, draggingState.current!.initialStart! + dTime));
          newEnd = newStart + dt;
          newPitch = Math.max(0, Math.min(TOTAL_KEYS - 1, draggingState.current!.initialPitch! + dPitch));
      } else {
          const newVal = Math.max(0, Math.min(1, draggingState.current!.initialVal + dTime));
          if (draggingState.current!.type === 'start') {
             newStart = Math.min(newVal, n.end - 0.001);
          } else {
             newEnd = Math.max(newVal, n.start + 0.001);
          }
      }
      return { ...n, start: newStart, end: newEnd, pitch: newPitch };
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingState.current) {
       e.currentTarget.releasePointerCapture(e.pointerId);
       draggingState.current = null;
    }
  };

  // Generate ticks for HTML timeline ruler
  const renderTimelineRuler = () => {
      const bpm = 130;
      const bps = bpm / 60;
      const totalBeats = (duration || 180) * bps;
      const rulerWidth = (duration || 180) * PIXELS_PER_SECOND;
      const markers = [];

      for(let i=0; i<Math.floor(totalBeats); i++) {
         if (i % 4 === 0) {
            markers.push(
               <div key={i} className="absolute h-2 border-l border-[#5f6064] flex flex-col" style={{ left: (i/totalBeats) * rulerWidth }}>
                  <span className="absolute -top-3 left-1 text-[9px] text-[#8e8e93] font-bold select-none">{Math.floor(i/4) + 1}</span>
               </div>
            );
         } else if (totalBeats < 400 || i % 2 === 0) {
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
          <div className="text-[10px] font-bold flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-[#37d652]"></div>
             <Music className="w-3.5 h-3.5" /> PIANO ROLL - Synth
          </div>
        </div>
        <div className="flex gap-3 text-[#8e8e93] items-center">
            <Edit2 className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
            <Scissors className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
            <Wrench className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
            <div className="w-px h-4 bg-[#3f4044] mx-1"></div>
            <Magnet className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
            <Search className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
         <div 
           className="w-[70px] bg-[#2a2b2e] border-r border-[#3f4044] flex flex-col overflow-y-auto shrink-0 z-10 custom-scrollbar" 
           ref={scrollRef}
           onScroll={handleScroll}
         >
             {/* Filler space for timeline ruler height */}
             <div className="h-6 shrink-0 bg-[#2a2b2e] border-b border-[#3f4044]"></div>
             {renderKeys()}
         </div>

         <div className="flex-1 flex flex-col bg-[#161618] relative">
            <div 
                id="pianoroll-ruler-container"
                className="h-6 bg-[#2a2b2e] border-b border-[#3f4044] shrink-0 overflow-hidden relative"
                style={{ paddingBottom: '0' }}
            >
               <div className="absolute inset-0 flex items-end ml-[1px]">
                   {duration > 0 ? renderTimelineRuler() : null}
               </div>
            </div>

            <div 
              className="flex-1 relative overflow-auto bg-[#1B2125] custom-scrollbar" 
              ref={containerRef}
              onScroll={handleCanvasScroll}
            >
               <div 
                  style={{ height: Math.max(TOTAL_KEYS * KEY_HEIGHT, 100), width: Math.max(containerRef.current?.clientWidth || 0, (duration || 180) * PIXELS_PER_SECOND) }}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  className={cn(
                      "relative",
                      draggingState.current?.type === 'move' ? "cursor-grabbing" :
                      draggingState.current?.type ? "cursor-ew-resize" : ""
                  )}
                  onPointerMove={(e) => {
                      handlePointerMove(e);
                      if (!draggingState.current && canvasRef.current) {
                          const rect = canvasRef.current.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;
                          const cw = Math.max(canvasRef.current.clientWidth, (duration || 180) * PIXELS_PER_SECOND);
                          const pitch = TOTAL_KEYS - 1 - Math.floor(y / KEY_HEIGHT);
                          
                          const rowNotes = notes.filter(n => n.pitch === pitch);
                          let type = '';
                          for (const n of rowNotes) {
                              const noteStartX = n.start * cw;
                              const noteEndX = n.end * cw;
                              if (Math.abs(x - noteStartX) < 5 || Math.abs(x - noteEndX) < 5) {
                                  type = 'ew-resize'; break;
                              } else if (x > noteStartX + 5 && x < noteEndX - 5) {
                                  type = 'grab'; break;
                              }
                          }
                          e.currentTarget.style.cursor = type || 'default';
                      }
                  }}
               >
                  <canvas ref={canvasRef} className="absolute inset-0 block bg-[#1B2125]" />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
