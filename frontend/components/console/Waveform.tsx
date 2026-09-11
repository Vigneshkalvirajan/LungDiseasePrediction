import React from "react";

const HEIGHTS = [
  24, 52, 80, 40, 28, 16, 20, 60, 88, 44, 32, 16, 12, 20, 48, 76, 40, 24, 12, 16,
  60, 84, 36, 20, 12, 16, 52, 80, 40, 24, 12, 16, 56, 88, 36, 20, 12, 16, 48, 76,
  32, 16, 12, 20, 52, 84, 40, 24, 12, 16, 60, 88, 36, 16, 12, 20, 52, 80, 32, 12,
  16, 40, 20, 12, 16, 24,
];

export function Waveform({ playhead = 64 }: { playhead?: number }) {
  return (
    <svg
      viewBox="0 0 800 120"
      preserveAspectRatio="none"
      className="h-24 w-full text-brand-soft"
      role="img"
      aria-label="Stethoscope audio waveform"
    >
      <line x1="0" y1="60" x2="800" y2="60" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      <g fill="currentColor">
        {HEIGHTS.map((h, i) => (
          <rect
            key={i}
            className="wave-bar"
            x={8 + i * 12}
            y={60 - h / 2}
            width="4"
            height={h}
            rx="2"
            style={{ animationDelay: `${(i * 0.08).toFixed(2)}s` }}
          />
        ))}
      </g>
      <line
        x1={(playhead / 100) * 800}
        y1="8"
        x2={(playhead / 100) * 800}
        y2="112"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.6"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

export function Spectrogram() {
  return (
    <svg
      viewBox="0 0 320 140"
      preserveAspectRatio="none"
      className="h-32 w-full text-brand-soft"
      role="img"
      aria-label="Frequency spectrogram of the recording"
    >
      <g className="spec-anim">
        <rect x="0" y="20" width="320" height="14" fill="currentColor" opacity="0.55" />
        <rect x="0" y="42" width="320" height="10" fill="currentColor" opacity="0.7" />
        <rect x="0" y="60" width="320" height="8" fill="currentColor" opacity="0.4" />
        <rect x="0" y="84" width="320" height="6" fill="currentColor" opacity="0.3" />
        <rect x="0" y="104" width="320" height="5" fill="currentColor" opacity="0.22" />
      </g>
      <g className="spec-anim" style={{ animationDelay: "1.4s" }}>
        <rect x="0" y="8" width="320" height="4" fill="currentColor" opacity="0.25" />
        <rect x="0" y="120" width="320" height="4" fill="currentColor" opacity="0.18" />
      </g>
      <g fill="currentColor" opacity="0.25">
        {[30, 80, 130, 180, 230, 280].map((x) => (
          <rect key={x} x={x} y="0" width="1" height="140" />
        ))}
      </g>
    </svg>
  );
}
