'use client';

import { useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { useBlueprint } from '@/context/BlueprintContext';
import type { Scene, LayerStyle, LayerStyleObject } from '@/types/blueprint';

// ─── Anchor transform map ──────────────────────────────────────────────────────

const ANCHOR_TRANSFORM: Record<string, string> = {
  'top-left':      'translate(0%, 0%)',
  'top-center':    'translate(-50%, 0%)',
  'top-right':     'translate(-100%, 0%)',
  'center-left':   'translate(0%, -50%)',
  'center':        'translate(-50%, -50%)',
  'center-right':  'translate(-100%, -50%)',
  'bottom-left':   'translate(0%, -100%)',
  'bottom-center': 'translate(-50%, -100%)',
  'bottom-right':  'translate(-100%, -100%)',
};

// ─── Text style presets (mirrors backend renderer) ─────────────────────────────

interface TextPreset {
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  fontWeight: string;
  textAlign: 'left' | 'center' | 'right';
  maxWidthPct: number;
}

const TEXT_PRESETS: Record<string, TextPreset> = {
  title_center: { fontSize: 72, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, fontWeight: 'bold',   textAlign: 'center', maxWidthPct: 80 },
  cta_center:   { fontSize: 60, color: '#FFD700', strokeColor: '#000000', strokeWidth: 3, fontWeight: 'bold',   textAlign: 'center', maxWidthPct: 80 },
  subtitle:     { fontSize: 52, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, fontWeight: 'bold',   textAlign: 'center', maxWidthPct: 90 },
  body:         { fontSize: 36, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, fontWeight: 'normal', textAlign: 'left',   maxWidthPct: 80 },
};

const DEFAULT_PRESET: TextPreset = {
  fontSize: 48, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2,
  fontWeight: 'bold', textAlign: 'center', maxWidthPct: 85,
};

function strokeShadow(color: string, width: number, scale: number): string {
  const sw = Math.max(1, Math.round(width * scale));
  return [
    `-${sw}px -${sw}px 0 ${color}`,
    ` ${sw}px -${sw}px 0 ${color}`,
    `-${sw}px  ${sw}px 0 ${color}`,
    ` ${sw}px  ${sw}px 0 ${color}`,
  ].join(', ');
}

function buildTextStyle(style: LayerStyle | undefined | null, scale: number): React.CSSProperties {
  // Object style: { font_size, color, stroke_color, ... }
  if (style && typeof style === 'object') {
    const obj = style as LayerStyleObject;
    return {
      fontSize:      `${Math.max(8, Math.round((obj.font_size ?? 48) * scale))}px`,
      color:          obj.color ?? '#FFFFFF',
      fontWeight:     obj.font_weight ?? 'bold',
      textAlign:      (obj.text_align ?? 'center') as React.CSSProperties['textAlign'],
      textShadow:     strokeShadow(obj.stroke_color ?? '#000000', obj.stroke_width ?? 2, scale),
      lineHeight:     1.3,
      maxWidth:       `${obj.max_width_pct ?? 85}%`,
      wordBreak:      'break-word',
      whiteSpace:     'pre-wrap',
      fontFamily:     'system-ui, sans-serif',
      ...(obj.letter_spacing ? { letterSpacing: `${Math.round(obj.letter_spacing * scale)}px` } : {}),
    };
  }

  // Named preset string
  const preset = (typeof style === 'string' && TEXT_PRESETS[style.trim()]) || DEFAULT_PRESET;
  return {
    fontSize:    `${Math.max(8, Math.round(preset.fontSize * scale))}px`,
    color:        preset.color,
    fontWeight:   preset.fontWeight,
    textAlign:    preset.textAlign,
    textShadow:   strokeShadow(preset.strokeColor, preset.strokeWidth, scale),
    lineHeight:   1.3,
    maxWidth:     `${preset.maxWidthPct}%`,
    wordBreak:    'break-word',
    whiteSpace:   'pre-wrap',
    fontFamily:   'system-ui, sans-serif',
  };
}

// ─── Video layer with play/pause controls ──────────────────────────────────────

function VideoLayer({ src, containerW, containerH }: { src: string; containerW: number; containerH: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    if (ref.current.paused) {
      ref.current.play();
      setPlaying(true);
    } else {
      ref.current.pause();
      setPlaying(false);
    }
  }, []);

  return (
    <div className="relative w-full h-full group/video">
      <video
        ref={ref}
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        autoPlay
        muted
        loop
        playsInline
      />
      {/* Play/pause button – shows on hover */}
      <button
        onClick={toggle}
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        title={playing ? 'Pause' : 'Play'}
      >
        <span className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
          {playing
            ? <Pause size={14} className="text-white" />
            : <Play  size={14} className="text-white ml-0.5" />}
        </span>
      </button>
      {/* Muted indicator */}
      <span className="absolute top-1 right-1 opacity-50">
        <Volume2 size={9} className="text-white" />
      </span>
    </div>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CanvasPreviewProps {
  scene: Scene;
  /** Object URLs keyed by asset id, path, or filename */
  assetUrls: Map<string, string>;
  /** Container height in px. Width auto-computed from ratio. Default: 280 */
  maxHeight?: number;
  /** Show colored ring borders per layer type. Default: false */
  showBorders?: boolean;
}

// ─── CanvasPreview ─────────────────────────────────────────────────────────────

export default function CanvasPreview({
  scene,
  assetUrls,
  maxHeight = 280,
  showBorders = false,
}: CanvasPreviewProps) {
  const { state } = useBlueprint();
  const { meta } = state.blueprint;

  const [rw, rh] = meta.ratio.split(':').map(Number);
  const containerH = maxHeight;
  const containerW = Math.round(containerH * (rw / rh));

  // Scale: preview px / actual resolution px
  const scale = containerH / meta.resolution.height;

  const sortedLayers = [...scene.layers].sort((a, b) => a.z_index - b.z_index);

  /**
   * Resolve an asset src (can be asset.id, asset.path, or bare filename).
   * Tries each in order until a match is found.
   */
  const resolveUrl = (src?: string): string | undefined => {
    if (!src) return undefined;
    // Direct hit (by id or full path)
    if (assetUrls.has(src)) return assetUrls.get(src);
    // Try stripping to bare filename
    const basename = src.split('/').pop() ?? src;
    if (assetUrls.has(basename)) return assetUrls.get(basename);
    // Partial suffix match: e.g. "lucario.png" matches "assets/images/lucario.png"
    for (const [key, url] of Array.from(assetUrls.entries())) {
      if (key.endsWith('/' + src) || key.endsWith('/' + basename)) return url;
    }
    return undefined;
  };

  return (
    <div
      className="relative bg-black rounded-lg overflow-hidden mx-auto border border-border/50 select-none"
      style={{ width: containerW, height: containerH, flexShrink: 0 }}
    >
      {sortedLayers.map(layer => {
        const pos       = layer.position ?? { x: 50, y: 50, anchor: 'center', unit: 'percent' };
        const transform = ANCHOR_TRANSFORM[pos.anchor] ?? 'translate(-50%, -50%)';
        const widthPct  = layer.size?.width ?? 100;
        const url       = resolveUrl(layer.src);

        // ── IMAGE ────────────────────────────────────────────────────────────
        if (layer.type === 'image') {
          const borderClass = showBorders ? 'ring-1 ring-blue-400/50' : '';
          return (
            <div
              key={layer._id}
              className={borderClass}
              style={{
                position:  'absolute',
                left:      `${pos.x}%`,
                top:       `${pos.y}%`,
                transform,
                zIndex:    layer.z_index,
                width:     `${Math.min(widthPct, 100)}%`,
              }}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={layer.src ?? 'image'}
                  draggable={false}
                  style={{
                    width:       '100%',
                    height:      'auto',
                    display:     'block',
                    objectFit:   'contain',
                  }}
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center bg-blue-500/10 border border-blue-500/30 rounded text-center gap-0.5"
                  style={{ aspectRatio: `${rw}/${rh}`, width: '100%' }}
                >
                  <span className="text-blue-400 text-[8px]">🖼</span>
                  <span className="text-blue-300 text-[8px] truncate px-1 w-full">{layer.src || 'no asset'}</span>
                </div>
              )}
            </div>
          );
        }

        // ── VIDEO ────────────────────────────────────────────────────────────
        if (layer.type === 'video') {
          const borderClass = showBorders ? 'ring-1 ring-green-400/50' : '';
          return (
            <div
              key={layer._id}
              className={`overflow-hidden ${borderClass}`}
              style={{
                position:    'absolute',
                left:        `${pos.x}%`,
                top:         `${pos.y}%`,
                transform,
                zIndex:      layer.z_index,
                width:       `${Math.min(widthPct, 100)}%`,
                aspectRatio: `${rw}/${rh}`,
              }}
            >
              {url ? (
                <VideoLayer src={url} containerW={containerW} containerH={containerH} />
              ) : (
                <div className="flex flex-col items-center justify-center bg-green-500/10 border border-green-500/30 w-full h-full gap-0.5">
                  <span className="text-green-400 text-[8px]">🎬</span>
                  <span className="text-green-300 text-[8px] truncate px-1 w-full text-center">{layer.src || 'no asset'}</span>
                </div>
              )}
            </div>
          );
        }

        // ── TEXT ─────────────────────────────────────────────────────────────
        if (layer.type === 'text') {
          const textCss    = buildTextStyle(layer.style ?? null, scale);
          const borderClass = showBorders ? 'ring-1 ring-yellow-400/50' : '';
          return (
            <div
              key={layer._id}
              className={borderClass}
              style={{
                position:       'absolute',
                left:           `${pos.x}%`,
                top:            `${pos.y}%`,
                transform,
                zIndex:         layer.z_index,
                width:          `${Math.min(widthPct, 100)}%`,
                display:        'flex',
                justifyContent: textCss.textAlign === 'right' ? 'flex-end'
                               : textCss.textAlign === 'center' ? 'center' : 'flex-start',
              }}
            >
              <span style={textCss}>{layer.content || 'Text'}</span>
            </div>
          );
        }

        return null;
      })}

      {sortedLayers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted">No layers</span>
        </div>
      )}

      {/* Watermark */}
      <div className="absolute bottom-1 right-1.5 text-[8px] text-white/25 font-mono pointer-events-none select-none">
        {meta.ratio} · {scene.id}
      </div>
    </div>
  );
}
