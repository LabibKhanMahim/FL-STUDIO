import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface LoadingScreenProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
  loadingText: string;
}

export function LoadingScreen({ onUpload, isLoading, loadingText }: LoadingScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      onUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-black text-[#ff7b00]">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl font-bold mb-8 tracking-tighter"
        >
          FL SIMULATION
        </motion.div>
        
        <div className="w-80 h-2 bg-[#2a2b2e] rounded-full overflow-hidden mb-4 border border-[#3f4044]">
          <motion.div 
            className="h-full bg-gradient-to-r from-[#ff7b00] to-[#ffb900]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3.6, ease: "linear" }}
          />
        </div>
        
        <div className="text-[#b3b4b8] text-sm font-medium animate-pulse">
          {loadingText}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col items-center justify-center h-screen w-full bg-fl-bg text-fl-text"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
       <div className="text-5xl font-bold mb-12 tracking-tighter text-[#ff7b00] drop-shadow-[0_0_15px_rgba(255,123,0,0.4)]">
          FL SIMULATION
       </div>
       <button
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "group relative px-8 py-8 bg-[#2a2b2e] hover:bg-[#34353a] border-2 hover:border-[#ff7b00] rounded-lg transition-all duration-300 flex flex-col items-center gap-4 overflow-hidden min-w-[400px] border-dashed",
          isDragging ? "border-[#ff7b00] bg-[#34353a] scale-105" : "border-[#3f4044]"
        )}
       >
          <div className="absolute inset-0 bg-[#ff7b00] opacity-0 group-hover:opacity-10 transition-opacity" />
          <Upload className={cn("w-10 h-10 transition-colors", isDragging ? "text-white" : "text-[#ff7b00]")} />
          <div className="flex flex-col items-center gap-1">
            <span className="font-semibold text-white tracking-wide text-xl">
              {isDragging ? "DROP AUDIO FILE HERE" : "UPLOAD OR DRAG TRACK"}
            </span>
            <span className="text-sm font-medium text-[#8e8e93]">
              Click to browse or drag and drop
            </span>
          </div>
       </button>
       <input 
          type="file" 
          accept="audio/*" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
       />
       <p className="mt-8 text-xs text-[#5f6064] max-w-md text-center">
         Supports MP3, WAV format. Audio will be visually separated into hyper-realistic virtual stems directly in your browser.
       </p>
    </div>
  );
}
