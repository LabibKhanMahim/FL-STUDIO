import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { Mixer } from './Mixer';
import { Playlist } from './Playlist';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { LoadingScreen } from './LoadingScreen';
import { PianoRoll } from './PianoRoll';

export default function FakeDaw() {
  const { 
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
    stems
  } = useAudioEngine();

  const [activeWindow, setActiveWindow] = useState<'playlist' | 'mixer' | 'pianoroll'>('playlist');

  const handleFileUpload = (file: File) => {
    loadAudio(file);
  };

  if (isLoading || !isLoaded) {
    return <LoadingScreen onUpload={handleFileUpload} isLoading={isLoading} loadingText={loadingText} />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-fl-bg text-fl-text font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <TopBar 
        isPlaying={isPlaying} 
        onPlay={play} 
        onPause={pause} 
        onStop={stop} 
        currentTime={currentTime} 
        duration={duration} 
        analyserData={analyserData}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Browser Panel */}
        <Sidebar />

        {/* Main Panels Area */}
        <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden bg-[#161618]">
          <div className="flex gap-2 mb-1">
            <button 
              className={cn("px-3 py-1 text-xs font-semibold rounded-sm border border-fl-panel-border transition-colors", activeWindow === 'playlist' ? 'bg-fl-panel text-fl-text-light' : 'bg-fl-bg hover:bg-fl-panel')}
              onClick={() => setActiveWindow('playlist')}
            >
              Playlist
            </button>
            <button 
              className={cn("px-3 py-1 text-xs font-semibold rounded-sm border border-fl-panel-border transition-colors", activeWindow === 'pianoroll' ? 'bg-fl-panel text-fl-text-light' : 'bg-fl-bg hover:bg-fl-panel')}
              onClick={() => setActiveWindow('pianoroll')}
            >
              Piano Roll
            </button>
            <button 
              className={cn("px-3 py-1 text-xs font-semibold rounded-sm border border-fl-panel-border transition-colors", activeWindow === 'mixer' ? 'bg-fl-panel text-fl-text-light' : 'bg-fl-bg hover:bg-fl-panel')}
              onClick={() => setActiveWindow('mixer')}
            >
              Mixer
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden bg-fl-panel rounded-md border border-fl-panel-border shadow-inner">
            {activeWindow === 'playlist' && (
              <Playlist 
                stems={stems} 
                currentTime={currentTime} 
                duration={duration} 
                isPlaying={isPlaying} 
                analyserData={analyserData} 
                audioProfile={audioProfile}
              />
            )}
            {activeWindow === 'pianoroll' && (
              <PianoRoll
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
                analyserData={analyserData}
                audioProfile={audioProfile}
              />
            )}
            {activeWindow === 'mixer' && (
              <Mixer 
                stems={stems} 
                analyserData={analyserData} 
                currentTime={currentTime}
                duration={duration}
                isPlaying={isPlaying}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
