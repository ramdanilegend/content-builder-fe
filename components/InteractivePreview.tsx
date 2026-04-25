'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Pause, Volume2, Monitor, Smartphone, Square } from 'lucide-react';
import { useBlueprint } from '@/context/BlueprintContext';
import type { Scene, Layer, LayerStyle, LayerStyleObject, AspectRatio } from '@/types/blueprint';
import type { PlaybackControls } from '@/hooks/usePlayback';

// ─── Anchor offset map ────────────────────────────────────────────────────────

const ANCHOR_CSS: Record<string, { translateX: string; translateY: string }> = {
  'top-left':      { translateX: '0%',    translateY: '0%'    },
  'top-center':    { translateX: '-50%',  translateY: '0%'    },
  'top-right':     { translateX: '-100%', translateY: '0%'    },
  'center-left':   { translateX: '0%',    translateY: '-50%'  },
  'center':        { translateX: '-50%',  translateY: '-50%'  },
  'center-right':  { translateX: '-100%', translateY: '-50%'  },
  'bottom-left':   { translateX: '0%',    translateY: '-100%' },
  'bottom-center': { translateX: '-50%',  translateY: '-100%' },
  'bottom-right':  { translateX: '-100%', translateY: '-100%' },
};

// ─── Text presets (mirrors backend) ──────────────────────────────────────────

const TEXT_PRESETS: Record<string, {
  fontSize: number; color: string; strokeColor: string; strokeWidth: number;
  fontWeight: string; textAlign: 'left' | 'center' | 'right'; maxWidthPct: number;
}> = {
  title_center: { fontSize: 72, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, fontWeight: 'bold',   textAlign: 'center', maxWidthPct: 80 },
  cta_center:   { fontSize: 60, color: '#FFD700', strokeColor: '#000000', strokeWidth: 3, fontWeight: 'bold',   textAlign: 'center', maxWidthPct: 80 },
  subtitle:     { fontSize: 52, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3, fontWeight: 'bold',   textAlign: 'center', maxWidthPct: 90 },
  body:         { fontSize: 36, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 2, fontWeight: 'normal', textAlign: 'left',   maxWidthPct: 80 },
};

const DEFAULT_PRESET = TEXT_PRESETS.subtitle;

function strokeShadow(color: string, w: number, scale: number) {
  const s = Math.max(1, Math.round(w * scale));
  return `-${s}px -${s}px 0 ${color}, ${s}px -${s}px 0 ${color}, -${s}px ${s}px 0 ${color}, ${s}px ${s}px 0 ${color}`;
}

function buildTextCss(style: LayerStyle | undefined | null, scale: number): React.CSSProperties {
  if (style && typeof style === 'object') {
    const o = style as LayerStyleObject;
    return {
      fontSize:    `${Math.max(8, Math.round((o.font_size ?? 48) * scale))}px`,
      color:        o.color ?? '#FFF',
      fontWeight:   o.font_weight ?? 'bold',
      textAlign:   (o.text_align ?? 'center') as React.CSSProperties['textAlign'],
      textShadow:   strokeShadow(o.stroke_color ?? '#000', o.stroke_width ?? 2, scale),
      lineHeight:   1.3,
      maxWidth:     `${o.max_width_pct ?? 85}%`,
      wordBreak:    'break-word',
      whiteSpace:   'pre-wrap',
      fontFamily:   'system-ui, sans-serif',
    };
  }
  const p = (typeof style === 'string' && TEXT_PRESETS[style.trim()]) || DEFAULT_PRESET;
  return {
    fontSize:    `${Math.max(8, Math.round(p.fontSize * scale))}px`,
    color:        p.color,
    fontWeight:   p.fontWeight,
    textAlign:    p.textAlign,
    textShadow:   strokeShadow(p.strokeColor, p.strokeWidth, scale),
    lineHeight:   1.3,
    maxWidth:     `${p.maxWidthPct}%`,
    wordBreak:    'break-word',
    whiteSpace:   'pre-wrap',
    fontFamily:   'system-ui, sans-serif',
  };
}

// ─── Aspect ratio dimensions ──────────────────────────────────────────────────

const RATIO_DIMS: Record<AspectRatio, [number, number]> = {
  '16:9':  [16, 9],
  '9:16':  [9, 16],
  '1:1':   [1, 1],
  '4:3':   [4, 3],
};

const RATIO_OPTIONS: { key: AspectRatio; icon: React.ReactNode; label: string }[] = [
  { key: '16:9',  icon: <Monitor  size={12} />, label: '16:9'  },
  { key: '9:16',  icon: <Smartphone size={12} />, label: '9:16' },
  { key: '1:1',   icon: <Square   size={12} />, label: '1:1'   },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  scene: Scene | undefined;
  assetUrls: Map<string, string>;
  playback: PlaybackControls;
  /** Map from sceneId → TTS entry (for loading badge) */
  ttsMap?: Map<string, { url: string; status: 'loading' | 'ready' | 'error' }>;
  /** Max container height px */
  maxHeight?: number;
}

// ─── Draggable layer wrapper ──────────────────────────────────────────────────

interface DragLayerProps {
  layer: Layer;
  sceneId: string;
  children: React.ReactNode;
  containerW: number;
  containerH: number;
  isSelected: boolean;
}

function DragLayer({ layer, sceneId, children, containerW, containerH, isSelected }: DragLayerProps) {
  const { dispatch } = useBlueprint();
  const dragRef   = useRef(false);
  const startRef  = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  const pos       = layer.position ?? { x: 50, y: 50, anchor: 'center', unit: 'percent' };
  const { translateX, translateY } = ANCHOR_CSS[pos.anchor] ?? ANCHOR_CSS['center'];
  const widthPct  = layer.size?.width ?? 100;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = true;
    startRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: pos.x, posY: pos.y };
    dispatch({ type: 'SELECT_SCENE', id: sceneId });
    dispatch({ type: 'SELECT_LAYER', id: layer._id });
  }, [dispatch, layer._id, pos.x, pos.y, sceneId]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ((e.clientX - startRef.current.mouseX) / containerW) * 100;
      const dy = ((e.clientY - startRef.current.mouseY) / containerH) * 100;
      const nx = Math.max(0, Math.min(100, startRef.current.posX + dx));
      const ny = Math.max(0, Math.min(100, startRef.current.posY + dy));
      dispatch({
        type: 'UPDATE_LAYER',
        sceneId,
        layerId: layer._id,
        payload: { position: { ...pos, x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } },
      });
    };
    const onUp = () => { dragRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [containerW, containerH, dispatch, layer._id, pos, sceneId]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position:  'absolute',
        left:      `${pos.x}%`,
        top:       `${pos.y}%`,
        transform: `translate(${translateX}, ${translateY})`,
        zIndex:    layer.z_index,
        width:     `${Math.min(widthPct, 100)}%`,
        cursor:    'move',
        outline:   isSelected ? '1.5px dashed rgba(255,255,255,0.7)' : undefined,
        outlineOffset: 2,
      }}
    >
      {children}
      {/* Resize handle (bottom-right) */}
      {isSelected && (
        <ResizeHandle layer={layer} sceneId={sceneId} containerW={containerW} />
      )}
    </div>
  );
}

// ─── Resize handle ────────────────────────────────────────────────────────────

function ResizeHandle({ layer, sceneId, containerW }: {
  layer: Layer; sceneId: string; containerW: number;
}) {
  const { dispatch } = useBlueprint();
  const startRef = useRef({ mouseX: 0, startWidth: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startRef.current = {
      mouseX: e.clientX,
      startWidth: layer.size?.width ?? 100,
    };
    const onMove = (ev: MouseEvent) => {
      const dx     = ((ev.clientX - startRef.current.mouseX) / containerW) * 100;
      const newW   = Math.max(5, Math.min(100, startRef.current.startWidth + dx));
      dispatch({
        type: 'UPDATE_LAYER', sceneId, layerId: layer._id,
        payload: { size: { width: Math.round(newW) } },
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [containerW, dispatch, layer._id, layer.size?.width, sceneId]);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: 'absolute',
        right:    -6,
        bottom:   -6,
        width:    12,
        height:   12,
        borderRadius: '50%',
        background: '#fff',
        border: '2px solid #333',
        cursor: 'ew-resize',
        zIndex: 9999,
      }}
    />
  );
}

// ─── Video layer ──────────────────────────────────────────────────────────────

function VideoLayerEl({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    if (ref.current.paused) { ref.current.play(); setPlaying(true); }
    else                    { ref.current.pause(); setPlaying(false); }
  }, []);
  return (
    <div className="relative w-full h-full group/video">
      <video ref={ref} src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        autoPlay muted loop playsInline />
      <button onClick={toggle}
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/video:opacity-100 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.3)' }}>
        <span className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
          {playing ? <Pause size={12} className="text-white" /> : <Play size={12} className="text-white ml-0.5" />}
        </span>
      </button>
      <span className="absolute top-1 right-1 opacity-40"><Volume2 size={8} className="text-white" /></span>
    </div>
  );
}

// ─── InteractivePreview ───────────────────────────────────────────────────────

export default function InteractivePreview({ scene, assetUrls, playback, ttsMap, maxHeight = 340 }: Props) {
  const { state, dispatch } = useBlueprint();
  const { meta } = state.blueprint;

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(meta.ratio);

  // Sync aspect ratio with blueprint meta
  useEffect(() => { setAspectRatio(meta.ratio); }, [meta.ratio]);

  const [rw, rh] = RATIO_DIMS[aspectRatio] ?? [16, 9];
  const containerH = maxHeight;
  const containerW = Math.round(containerH * (rw / rh));
  const scale      = containerH / meta.resolution.height;

  const resolveUrl = useCallback((src?: string): string | undefined => {
    if (!src) return undefined;
    if (assetUrls.has(src)) return assetUrls.get(src);
    const base = src.split('/').pop() ?? src;
    if (assetUrls.has(base)) return assetUrls.get(base);
    for (const [key, url] of Array.from(assetUrls.entries())) {
      if (key.endsWith('/' + src) || key.endsWith('/' + base)) return url;
    }
  }, [assetUrls]);

  if (!scene) {
    return (
      <div className="flex flex-col items-center justify-center gap-3" style={{ height: containerH }}>
        <span className="text-4xl">🎬</span>
        <p className="text-muted text-sm">No scene selected</p>
      </div>
    );
  }

  const sortedLayers = [...scene.layers].sort((a, b) => a.z_index - b.z_index);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Aspect ratio picker */}
      <div className="flex items-center gap-1">
        {RATIO_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => {
              setAspectRatio(opt.key);
              dispatch({ type: 'SET_META', payload: { ratio: opt.key } });
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-colors ${
              aspectRatio === opt.key
                ? 'bg-accent text-white'
                : 'text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div
        className="relative bg-black rounded-lg overflow-hidden border border-border/50 select-none"
        style={{ width: containerW, height: containerH, flexShrink: 0 }}
        onClick={() => {
          dispatch({ type: 'SELECT_LAYER', id: null });
        }}
      >
        {sortedLayers.map(layer => {
          const url       = resolveUrl(layer.src);
          const isSelected = state.selectedLayerId === layer._id;

          if (layer.type === 'image') {
            return (
              <DragLayer key={layer._id} layer={layer} sceneId={scene.id}
                containerW={containerW} containerH={containerH} isSelected={isSelected}>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={layer.src ?? 'image'} draggable={false}
                    style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
                ) : (
                  <div className="flex items-center justify-center bg-blue-500/10 border border-blue-500/30 rounded text-center"
                    style={{ aspectRatio: `${rw}/${rh}`, width: '100%' }}>
                    <span className="text-blue-300 text-[9px] px-1">🖼 {layer.src || 'no asset'}</span>
                  </div>
                )}
              </DragLayer>
            );
          }

          if (layer.type === 'video') {
            const [rw2, rh2] = RATIO_DIMS[aspectRatio] ?? [16, 9];
            return (
              <DragLayer key={layer._id} layer={layer} sceneId={scene.id}
                containerW={containerW} containerH={containerH} isSelected={isSelected}>
                <div className="overflow-hidden" style={{ aspectRatio: `${rw2}/${rh2}` }}>
                  {url ? (
                    <VideoLayerEl src={url} />
                  ) : (
                    <div className="flex items-center justify-center bg-green-500/10 border border-green-500/30 w-full h-full">
                      <span className="text-green-300 text-[9px] px-1">🎬 {layer.src || 'no asset'}</span>
                    </div>
                  )}
                </div>
              </DragLayer>
            );
          }

          if (layer.type === 'text') {
            const textCss = buildTextCss(layer.style ?? null, scale);
            return (
              <DragLayer key={layer._id} layer={layer} sceneId={scene.id}
                containerW={containerW} containerH={containerH} isSelected={isSelected}>
                <div style={{ display: 'flex', justifyContent: textCss.textAlign === 'right' ? 'flex-end' : textCss.textAlign === 'center' ? 'center' : 'flex-start' }}>
                  <span style={textCss}>{layer.content || 'Text'}</span>
                </div>
              </DragLayer>
            );
          }

          return null;
        })}

        {sortedLayers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted">No layers</span>
          </div>
        )}

        {/* Playback overlay (top-left time) */}
        <div className="absolute top-1.5 left-2 text-[9px] font-mono text-white/30 pointer-events-none">
          {Math.floor(playback.playheadMs / 1000).toFixed(0)}s · {scene.id}
        </div>

        {/* TTS status badge */}
        {(() => {
          const entry = ttsMap?.get(scene.id);
          if (!entry || entry.status === 'ready') return null;
          return (
            <div className={`absolute top-1.5 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium pointer-events-none ${
              entry.status === 'loading' ? 'bg-blue-500/80 text-white' : 'bg-red-500/80 text-white'
            }`}>
              {entry.status === 'loading' ? (
                <><span className="animate-spin inline-block">⟳</span> Voice loading…</>
              ) : (
                <>⚠ Voice error</>
              )}
            </div>
          );
        })()}

        {/* Ratio watermark */}
        <div className="absolute bottom-1 right-1.5 text-[8px] text-white/20 pointer-events-none select-none">
          {meta.ratio}
        </div>
      </div>

      {/* Playback bar */}
      <div className="flex items-center gap-2 w-full" style={{ maxWidth: containerW }}>
        <button
          onClick={playback.toggle}
          className="btn-ghost p-1.5 rounded-full bg-white/5 hover:bg-accent/20 transition-colors shrink-0"
        >
          {playback.isPlaying
            ? <Pause size={13} className="text-accent" />
            : <Play  size={13} className="text-accent ml-0.5" />}
        </button>

        {/* Seek bar */}
        <div className="relative flex-1 h-1.5 rounded-full bg-white/10 cursor-pointer group"
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            playback.seek(ratio * playback.totalDurationMs);
          }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-accent transition-none"
            style={{ width: `${playback.totalDurationMs > 0 ? (playback.playheadMs / playback.totalDurationMs) * 100 : 0}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `calc(${playback.totalDurationMs > 0 ? (playback.playheadMs / playback.totalDurationMs) * 100 : 0}% - 6px)` }}
          />
        </div>

        <span className="text-[10px] font-mono text-muted shrink-0 tabular-nums">
          {(playback.playheadMs / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
