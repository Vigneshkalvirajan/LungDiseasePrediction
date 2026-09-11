"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  UploadCloud,
  FileAudio,
  Play,
  Pause,
  X,
  Volume2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface AudioUploaderProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export default function AudioUploader({
  selectedFile,
  onFileSelect,
  disabled = false,
}: AudioUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Update audio URL when file changes
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
      setIsPlaying(false);
      setCurrentTime(0);
      setFileError(null);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [selectedFile]);

  const handleFile = (file: File) => {
    const validExtensions = [".wav", ".mp3", ".ogg", ".flac"];
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");

    if (!validExtensions.includes(ext)) {
      setFileError(
        `Unsupported audio format (${ext}). Please select a .wav, .mp3, .ogg, or .flac file.`
      );
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setFileError("File is too large. Maximum supported size is 25MB.");
      return;
    }

    setFileError(null);
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-teal-950/60 border border-teal-800/40 text-teal-400">
            <Volume2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Stethoscope / Respiratory Sound
            </h3>
            <p className="text-xs text-slate-400">
              Acoustic recording for 768-D AST feature extraction & CNN inference
            </p>
          </div>
        </div>

        {selectedFile && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onFileSelect(null)}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-900/50 transition"
          >
            <X className="h-3.5 w-3.5" />
            <span>Remove</span>
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.ogg,.flac,audio/*"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {!selectedFile ? (
        /* Dropzone */
        <div
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-cyan-400 bg-cyan-950/20 scale-[0.99]"
              : "border-slate-700/80 bg-slate-900/40 hover:border-cyan-500/50 hover:bg-slate-900/70"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-cyan-950 to-teal-900 border border-cyan-800/50 flex items-center justify-center text-cyan-400 shadow-inner">
              <UploadCloud className="h-7 w-7 animate-pulse-subtle" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Click to browse or drop stethoscope audio file
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports WAV, MP3, OGG, FLAC (Up to 25MB)
              </p>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                WAV (ICBHI format)
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                16kHz Resampled
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                AST Spectrogram
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Selected Audio Preview Card */
        <div className="rounded-xl bg-slate-900/90 border border-cyan-500/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                <FileAudio className="h-5 w-5" />
              </div>
              <div className="max-w-[280px] sm:max-w-md">
                <p className="text-sm font-semibold text-white truncate">
                  {selectedFile.name}
                </p>
                <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                  <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>•</span>
                  <span>{selectedFile.type || "audio/wav"}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium flex items-center">
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" /> Audio Ready
                  </span>
                </div>
              </div>
            </div>

            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlayback}
              className="h-10 w-10 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/25 transition"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-slate-950" />
              ) : (
                <Play className="h-5 w-5 fill-slate-950 ml-0.5" />
              )}
            </button>
          </div>

          {/* Hidden HTML5 Audio Element */}
          {audioUrl && (
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={() => {
                if (audioRef.current) {
                  setCurrentTime(audioRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (audioRef.current) {
                  setDuration(audioRef.current.duration);
                }
              }}
              onEnded={() => setIsPlaying(false)}
            />
          )}

          {/* Waveform Visualization Bars & Progress */}
          <div className="pt-2">
            <div className="flex items-center space-x-1 h-8 px-2 bg-slate-950/70 rounded-lg border border-slate-800 justify-between overflow-hidden">
              {Array.from({ length: 32 }).map((_, i) => {
                const isActive =
                  duration > 0 ? (i / 32) <= (currentTime / duration) : false;
                const heights = [
                  "h-2", "h-4", "h-6", "h-3", "h-5", "h-7", "h-4", "h-2",
                  "h-5", "h-7", "h-3", "h-6", "h-4", "h-7", "h-5", "h-2",
                  "h-6", "h-4", "h-7", "h-5", "h-3", "h-6", "h-4", "h-7",
                  "h-2", "h-5", "h-3", "h-6", "h-4", "h-7", "h-3", "h-2",
                ];
                return (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${heights[i % heights.length]} ${
                      isActive
                        ? "bg-cyan-400 shadow-sm shadow-cyan-400"
                        : "bg-slate-700"
                    } ${isPlaying ? "opacity-100" : "opacity-75"}`}
                  />
                );
              })}
            </div>

            {/* Time Indicators */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {fileError && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{fileError}</span>
        </div>
      )}
    </div>
  );
}
