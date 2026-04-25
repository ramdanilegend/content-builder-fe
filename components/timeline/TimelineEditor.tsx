'use client';

import React, {
  useRef, useState, useCallback, useEffect, useMemo,
} from 'react';
import {
  Play, Pause, SkipBack, Scissors, Trash2, Magnet,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, PlusCircle, Music,
} from 'lucide-react';
import { useBlueprint, uid } from '@/context/BlueprintContext';
import type { Scene, TimelineAudioClip } from '@/types/blueprint';
import type { SceneTime, PlaybackControls } from '@/hooks/usePlayback';
import type { TTSEntry } from '@/hooks/useTTSCache';

// ─── Visual constants ─────────────────────────────────────────────────────────

const BASE_PX_PER_MS = 0.08;
const RULER_H        = 26;
const TRACK_H        = 34;
const AUDIO_TRACK_H  = 42;          // global audio clips are taller
const HEADER_W       = 136;
const SCENE_GAP      = 2;
const SNAP_THRESHOLD = 8;

// ─── Colors ───────────────────────────────────────────────────────────────────

const LAYER_BG:     Record<string, string> = { video: '#16a34a', image: '#2563eb', text: '#d97706' };
const LAYER_BORDER: Record<string, string> = { video: '#4ade80', image: '#60a5fa', text: '#fbbf24' };
const TTS_BG    = '#7c3aed';
const TTS_BORDER = '#a78bfa';
const BGM_BG    = '#0e7490';
const BGM_BORDER = '#22d3ee';
const GLOBAL_AUDIO_BG     = '#b45309';   // amber-700
const GLOBAL_AUDIO_BORDER = '#fbbf24';   // amber-400

// ─── Seeded waveform ─────────────────────────────────────────────────────────

function seededWave(seed: string, count: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const vals: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    vals.push(0.2 + (((h >>> 16) & 0xffff) / 0xffff) * 0.6 + Math.sin(i * 0.4) * 0.1);
  }
  return vals;
}

function WaveformBar({ seed, width, height, color }: {
  seed: string; width: number; height: number; color: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width  = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    const bars   = Math.max(4, Math.floor(width / 3));
    const vals   = seededWave(seed, bars);
    const barW   = width / bars;
    const midY   = height / 2;
    ctx.fillStyle    = color;
    ctx.globalAlpha  = 0.8;
    vals.forEach((v, i) => {
      const bh = Math.max(2, v * height * 0.88);
      ctx.fillRect(i * barW, midY - bh / 2, Math.max(1, barW - 1), bh);
    });
  }, [seed, width, height, color]);
  return <canvas ref={canvasRef} style={{ width, height, display: 'block' }} width={width} height={height} />;
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s / 60);
  const ss = s % 60;
  const ms2 = Math.floor((ms % 1000) / 10);
  return m > 0
    ? `${m}:${String(ss).padStart(2, '0')}.${String(ms2).padStart(2, '0')}`
    : `${ss}.${String(ms2).padStart(2, '0')}`;
}

// ─── Track row data ───────────────────────────────────────────────────────────

interface TrackDef {
  key: string;
  label: string;
  type: 'layer' | 'tts' | 'bgm';
  layerIdx?: number;
}

function buildTracks(scenes: Scene[]): TrackDef[] {
  const maxLayers = Math.max(0, ...scenes.map(s => s.layers.length));
  const tracks: TrackDef[] = [];
  for (let i = 0; i < maxLayers; i++) {
    tracks.push({ key: `layer_${i}`, label: `Layer ${i + 1}`, type: 'layer', layerIdx: i });
  }
  if (scenes.some(s => !!s.audio.voice?.text)) tracks.push({ key: 'tts', label: 'Voice (TTS)', type: 'tts' });
  if (scenes.some(s => !!s.audio.bgm?.src))    tracks.push({ key: 'bgm', label: 'Scene BGM',  type: 'bgm' });
  return tracks;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  playback: PlaybackControls;
  ttsMap?: Map<string, TTSEntry>;
}

// ─── TimelineEditor ───────────────────────────────────────────────────────────

export default function TimelineEditor({ playback, ttsMap }: Props) {
  const { state, dispatch, canUndo, canRedo } = useBlueprint();
  const { blueprint } = state;
  const { sceneTimes, playheadMs, isPlaying, toggle, seek, totalDurationMs } = playback;

  const [zoom,   setZoom]   = useState(1);
  const [snap,   setSnap]   = useState(true);
  const [height, setHeight] = useState(230);

  // drag state (refs avoid re-renders)
  const draggingPlayhead = useRef(false);
  const trimState        = useRef<{ sceneId: string; startX: number; startMs: number } | null>(null);
  /** Dragging a global audio clip body */
  const dragAudioClip    = useRef<{ id: string; startX: number; origStartMs: number } | null>(null);
  /** Trimming a global audio clip edge */
  const trimAudioClip    = useRef<{
    id: string; edge: 'left' | 'right';
    startX: number; origStartMs: number; origDurationMs: number;
  } | null>(null);
  const resizingTimeline = useRef(false);
  const resizeStartY     = useRef(0);
  const resizeStartH     = useRef(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pxPerMs   = BASE_PX_PER_MS * zoom;

  const globalAudioTracks = blueprint.audioTracks ?? [];

  // ── Auto-scroll playhead into view while playing ────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = playheadMs * pxPerMs;
    const { scrollLeft, clientWidth } = el;
    if (x < scrollLeft + 20 || x > scrollLeft + clientWidth - 40) {
      el.scrollLeft = Math.max(0, x - clientWidth / 2);
    }
  }, [isPlaying, playheadMs, pxPerMs]);

  // ── Track definitions ───────────────────────────────────────────────────────
  const tracks = useMemo(() => buildTracks(blueprint.scenes), [blueprint.scenes]);

  // ── Ruler tick interval ─────────────────────────────────────────────────────
  const tickIntervalMs = useMemo(() => {
    for (const c of [100, 250, 500, 1000, 2000, 5000, 10000]) {
      if (c * pxPerMs >= 40) return c;
    }
    return 10000;
  }, [pxPerMs]);

  const trackW = Math.max(800, totalDurationMs * pxPerMs + 200);

  // ── X coordinate → ms ───────────────────────────────────────────────────────
  const xToMs = useCallback((clientX: number): number => {
    const el = scrollRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x    = clientX - rect.left - HEADER_W + el.scrollLeft;
    const ms   = x / pxPerMs;
    if (!snap) return Math.max(0, ms);
    const snaps = [0, ...sceneTimes.flatMap(st => [st.startMs, st.endMs])];
    for (const s of snaps) {
      if (Math.abs(s * pxPerMs - x) < SNAP_THRESHOLD) return s;
    }
    return Math.max(0, ms);
  }, [pxPerMs, snap, sceneTimes]);

  // ── Playhead drag ────────────────────────────────────────────────────────────
  const onPlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingPlayhead.current = true;
  }, []);

  const onRulerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    seek(Math.max(0, xToMs(e.clientX)));
    draggingPlayhead.current = true;
  }, [xToMs, seek]);

  // ── Scene clip trim ──────────────────────────────────────────────────────────
  const onTrimStart = useCallback((e: React.MouseEvent, sceneId: string, currentMs: number) => {
    e.preventDefault(); e.stopPropagation();
    trimState.current = { sceneId, startX: e.clientX, startMs: currentMs };
  }, []);

  // ── Global audio clip: drag body ─────────────────────────────────────────────
  const onAudioClipMouseDown = useCallback((e: React.MouseEvent, clip: TimelineAudioClip) => {
    e.preventDefault(); e.stopPropagation();
    dragAudioClip.current = { id: clip.id, startX: e.clientX, origStartMs: clip.startMs };
  }, []);

  // ── Global audio clip: trim left / right edge ────────────────────────────────
  const onAudioTrimMouseDown = useCallback((
    e: React.MouseEvent,
    clip: TimelineAudioClip,
    edge: 'left' | 'right',
  ) => {
    e.preventDefault(); e.stopPropagation();
    trimAudioClip.current = {
      id: clip.id, edge,
      startX: e.clientX,
      origStartMs: clip.startMs,
      origDurationMs: clip.durationMs,
    };
  }, []);

  // ── Global mouse move / up ───────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Playhead drag
      if (draggingPlayhead.current) {
        seek(Math.max(0, Math.min(xToMs(e.clientX), totalDurationMs)));
      }

      // Scene trim
      if (trimState.current) {
        const { sceneId, startX, startMs } = trimState.current;
        const newMs = Math.max(500, Math.round(startMs + (e.clientX - startX) / pxPerMs));
        dispatch({ type: 'SET_SCENE_DURATION_MS', id: sceneId, ms: newMs });
      }

      // Audio clip drag (move body)
      if (dragAudioClip.current) {
        const { id, startX, origStartMs } = dragAudioClip.current;
        const dMs     = (e.clientX - startX) / pxPerMs;
        const newStart = Math.max(0, Math.round(origStartMs + dMs));
        dispatch({ type: 'UPDATE_AUDIO_TRACK', id, payload: { startMs: newStart } });
      }

      // Audio clip left-edge trim (moves start, shrinks from left)
      if (trimAudioClip.current) {
        const { id, edge, startX, origStartMs, origDurationMs } = trimAudioClip.current;
        const dMs = (e.clientX - startX) / pxPerMs;
        if (edge === 'right') {
          const newDur = Math.max(200, Math.round(origDurationMs + dMs));
          dispatch({ type: 'UPDATE_AUDIO_TRACK', id, payload: { durationMs: newDur } });
        } else {
          const newStart = Math.max(0, Math.round(origStartMs + dMs));
          const newDur   = Math.max(200, Math.round(origDurationMs - dMs));
          dispatch({ type: 'UPDATE_AUDIO_TRACK', id, payload: { startMs: newStart, durationMs: newDur } });
        }
      }

      // Timeline resize
      if (resizingTimeline.current) {
        const dy = resizeStartY.current - e.clientY;
        setHeight(Math.max(140, Math.min(520, resizeStartH.current + dy)));
      }
    };

    const onUp = () => {
      draggingPlayhead.current = false;
      trimState.current        = null;
      dragAudioClip.current    = null;
      trimAudioClip.current    = null;
      resizingTimeline.current = false;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [xToMs, seek, totalDurationMs, pxPerMs, dispatch]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); dispatch({ type: 'REDO' });
      }
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        if (state.selectedSceneId) {
          const st = sceneTimes.find(s => s.scene.id === state.selectedSceneId);
          if (st) dispatch({ type: 'SPLIT_SCENE', id: state.selectedSceneId, atMs: playheadMs - st.startMs });
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedLayerId && state.selectedSceneId) {
        dispatch({ type: 'REMOVE_LAYER', sceneId: state.selectedSceneId, layerId: state.selectedLayerId });
      }
      if (e.key === 'ArrowLeft')  seek(Math.max(0,              playheadMs - (e.shiftKey ? 1000 : 100)));
      if (e.key === 'ArrowRight') seek(Math.min(totalDurationMs, playheadMs + (e.shiftKey ? 1000 : 100)));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle, dispatch, seek, playheadMs, totalDurationMs, state.selectedSceneId, state.selectedLayerId, sceneTimes]);

  // ── Ctrl+scroll to zoom ──────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(z => Math.max(0.3, Math.min(8, z * (e.deltaY < 0 ? 1.15 : 0.87))));
    }
  }, []);

  // ── Timeline panel resize ────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingTimeline.current = true;
    resizeStartY.current     = e.clientY;
    resizeStartH.current     = height;
  }, [height]);

  // ── Add a new global audio track from an audio asset ────────────────────────
  const addGlobalAudioTrack = useCallback((assetId: string, assetLabel: string) => {
    const clip: TimelineAudioClip = {
      id:         uid(),
      src:        assetId,
      startMs:    Math.round(playheadMs),
      durationMs: totalDurationMs > 0 ? Math.round(totalDurationMs - playheadMs) : 10000,
      volume:     0.8,
      fadeInMs:   0,
      fadeOutMs:  500,
      label:      assetLabel,
    };
    dispatch({ type: 'ADD_AUDIO_TRACK', clip });
  }, [dispatch, playheadMs, totalDurationMs]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  const playheadX = playheadMs * pxPerMs;

  return (
    <div
      className="flex flex-col bg-[#111] border-t border-[#2a2a2a] select-none"
      style={{ height }}
      onWheel={onWheel}
    >
      {/* Resize handle */}
      <div
        className="h-1.5 w-full cursor-ns-resize bg-[#222] hover:bg-accent/40 transition-colors shrink-0"
        onMouseDown={onResizeMouseDown}
      />

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#222] shrink-0 bg-[#161616]">
        <button title="Go to start" onClick={() => seek(0)} className="btn-ghost p-1">
          <SkipBack size={13} />
        </button>
        <button
          title="Play / Pause (Space)"
          onClick={toggle}
          className="btn-ghost p-1.5 rounded-full bg-accent/10 hover:bg-accent/25 transition-colors"
        >
          {isPlaying
            ? <Pause size={14} className="text-accent" />
            : <Play  size={14} className="text-accent ml-0.5" />}
        </button>
        <span className="font-mono text-[11px] text-muted tabular-nums w-28">
          {fmtTime(playheadMs)} / {fmtTime(totalDurationMs)}
        </span>

        <div className="flex-1" />

        {/* Undo / Redo */}
        <button title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })} className="btn-ghost p-1 disabled:opacity-30">
          <ChevronLeft size={13} />
        </button>
        <button title="Redo (Ctrl+Y)" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })} className="btn-ghost p-1 disabled:opacity-30">
          <ChevronRight size={13} />
        </button>

        {/* Split */}
        <button
          title="Split selected scene at playhead (S)"
          disabled={!state.selectedSceneId}
          onClick={() => {
            if (!state.selectedSceneId) return;
            const st = sceneTimes.find(s => s.scene.id === state.selectedSceneId);
            if (st) dispatch({ type: 'SPLIT_SCENE', id: state.selectedSceneId, atMs: playheadMs - st.startMs });
          }}
          className="btn-ghost p-1 disabled:opacity-30"
        >
          <Scissors size={13} />
        </button>

        {/* Delete selected layer */}
        <button
          title="Delete selected layer (Delete)"
          disabled={!state.selectedLayerId}
          onClick={() => {
            if (state.selectedLayerId && state.selectedSceneId)
              dispatch({ type: 'REMOVE_LAYER', sceneId: state.selectedSceneId, layerId: state.selectedLayerId });
          }}
          className="btn-ghost p-1 disabled:opacity-30 hover:text-red-400"
        >
          <Trash2 size={13} />
        </button>

        {/* Snap */}
        <button title="Snap to grid" onClick={() => setSnap(v => !v)}
          className={`btn-ghost p-1 ${snap ? 'text-accent' : 'text-muted'}`}>
          <Magnet size={13} />
        </button>

        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.max(0.3, z / 1.5))} className="btn-ghost p-1"><ZoomOut size={13} /></button>
        <input type="range" min={0.3} max={8} step={0.05} value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-20 accent-accent" />
        <button onClick={() => setZoom(z => Math.min(8, z * 1.5))} className="btn-ghost p-1"><ZoomIn size={13} /></button>
      </div>

      {/* ── Track area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Track headers column */}
        <div className="shrink-0 flex flex-col bg-[#0f0f0f] border-r border-[#222] z-10" style={{ width: HEADER_W }}>
          {/* Ruler header */}
          <div style={{ height: RULER_H }} className="border-b border-[#222] flex items-center px-2">
            <span className="text-[10px] text-muted">Timeline</span>
          </div>

          {/* Scene / layer tracks */}
          {tracks.map(track => (
            <div key={track.key} style={{ height: TRACK_H }}
              className="flex items-center px-2 border-b border-[#1c1c1c] gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{
                background: track.type === 'tts' ? TTS_BG : track.type === 'bgm' ? BGM_BG : '#555'
              }} />
              <span className="text-[11px] text-muted truncate">{track.label}</span>
            </div>
          ))}

          {/* Divider: global audio section */}
          <div className="px-2 py-1 border-b border-[#2a2a2a] bg-[#0d0d0d]">
            <span className="text-[9px] text-muted uppercase tracking-widest">Global Audio</span>
          </div>

          {/* Global audio track headers */}
          {globalAudioTracks.map((clip, i) => (
            <div key={clip.id} style={{ height: AUDIO_TRACK_H }}
              className="flex items-center px-2 border-b border-[#1c1c1c] gap-1.5 group">
              <Music size={10} className="text-amber-400 shrink-0" />
              <span className="text-[10px] text-amber-300/80 truncate flex-1">
                {clip.label || clip.src}
              </span>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                title="Remove audio track"
                onClick={() => dispatch({ type: 'REMOVE_AUDIO_TRACK', id: clip.id })}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}

          {/* Add global audio track button */}
          {blueprint.assets.audio.length > 0 && (
            <div className="px-2 py-1.5 border-b border-[#1c1c1c]">
              <select
                className="w-full bg-[#1a1a1a] border border-[#333] rounded text-[10px] text-muted px-1 py-0.5"
                onChange={e => {
                  const id = e.target.value;
                  if (!id) return;
                  const asset = blueprint.assets.audio.find(a => a.id === id);
                  if (asset) addGlobalAudioTrack(asset.id, asset.filename);
                  e.target.value = '';
                }}
                defaultValue=""
                title="Add global audio track"
              >
                <option value="" disabled>+ Add audio track…</option>
                {blueprint.assets.audio.map(a => (
                  <option key={a.id} value={a.id}>{a.filename}</option>
                ))}
              </select>
            </div>
          )}

          {blueprint.assets.audio.length === 0 && globalAudioTracks.length === 0 && (
            <div className="px-2 py-2">
              <span className="text-[10px] text-muted/50">Upload audio in Assets</span>
            </div>
          )}
        </div>

        {/* Scrollable timeline body */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
          <div style={{ width: trackW, position: 'relative' }}>

            {/* ── Ruler ──────────────────────────────────────────────────── */}
            <div
              style={{ height: RULER_H, position: 'relative', cursor: 'crosshair' }}
              className="border-b border-[#222] bg-[#0d0d0d] sticky top-0 z-20"
              onMouseDown={onRulerMouseDown}
            >
              {/* Scene bands */}
              {sceneTimes.map((st, i) => (
                <div key={st.scene.id} style={{
                  position: 'absolute', left: st.startMs * pxPerMs,
                  width: st.durationMs * pxPerMs - SCENE_GAP,
                  top: 0, height: RULER_H,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
                  borderLeft: '1px solid #2a2a2a',
                }}>
                  <span className="absolute top-0.5 left-1 text-[9px] text-white/30 truncate pointer-events-none"
                    style={{ maxWidth: st.durationMs * pxPerMs - 8 }}>
                    {st.scene.id}
                  </span>
                </div>
              ))}
              {/* Ticks */}
              {Array.from({ length: Math.ceil(totalDurationMs / tickIntervalMs) + 1 }, (_, i) => {
                const ms = i * tickIntervalMs;
                return (
                  <div key={ms} style={{ position: 'absolute', left: ms * pxPerMs, top: 0, height: RULER_H }}>
                    <div style={{ position: 'absolute', top: RULER_H - 6, width: 1, height: 6, background: '#3a3a3a' }} />
                    <span className="absolute text-[9px] text-[#555] whitespace-nowrap" style={{ top: 4, left: 2 }}>
                      {fmtTime(ms)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* ── Scene / layer track rows ────────────────────────────────── */}
            {tracks.map((track, tIdx) => (
              <div key={track.key} style={{
                height: TRACK_H, position: 'relative',
                background: tIdx % 2 === 0 ? '#0f0f0f' : '#111',
                borderBottom: '1px solid #1a1a1a',
              }}>
                {sceneTimes.map(st => {
                  const { scene, startMs, durationMs } = st;
                  const clipX = startMs * pxPerMs;
                  const clipW = durationMs * pxPerMs - SCENE_GAP;
                  if (clipW < 1) return null;

                  if (track.type === 'layer') {
                    const layers = [...scene.layers].sort((a, b) => a.z_index - b.z_index);
                    const layer  = layers[track.layerIdx ?? 0];
                    if (!layer) return (
                      <div key={scene.id} style={{ position: 'absolute', left: clipX, width: clipW, top: 2, height: TRACK_H - 4, background: 'transparent' }} />
                    );
                    const bg     = LAYER_BG[layer.type] ?? '#444';
                    const border = LAYER_BORDER[layer.type] ?? '#666';
                    const isSelected = state.selectedLayerId === layer._id;
                    const label  = layer.content ?? layer.src ?? layer.type;
                    return (
                      <div key={scene.id} title={label} style={{
                        position: 'absolute', left: clipX, width: clipW, top: 2, height: TRACK_H - 4,
                        background: bg, border: `1px solid ${isSelected ? '#fff' : border}`,
                        borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
                        boxShadow: isSelected ? '0 0 0 1px #fff' : undefined,
                      }}
                        onClick={() => { dispatch({ type: 'SELECT_SCENE', id: scene.id }); dispatch({ type: 'SELECT_LAYER', id: layer._id }); }}
                      >
                        <span className="absolute inset-0 flex items-center px-1.5 text-[10px] text-white/80 truncate pointer-events-none">{label}</span>
                        <div style={{ position: 'absolute', right: 0, top: 0, width: 7, height: '100%', cursor: 'ew-resize', background: `${border}88`, borderRadius: '0 3px 3px 0' }}
                          onMouseDown={e => onTrimStart(e, scene.id, durationMs)} />
                      </div>
                    );
                  }

                  if (track.type === 'tts') {
                    const hasContent = !!scene.audio.voice?.text;
                    const label      = scene.audio.voice?.text?.slice(0, 40) ?? '';
                    const ttsEntry   = ttsMap?.get(scene.id);
                    // If the scene has voice text but no entry yet, it's implicitly loading
                    const ttsStatus  = ttsEntry?.status ?? (hasContent ? 'loading' : undefined);
                    const isLoading  = ttsStatus === 'loading';
                    const isError    = ttsStatus === 'error';
                    const isReady    = ttsStatus === 'ready';

                    return hasContent ? (
                      <div key={scene.id} style={{
                        position: 'absolute', left: clipX, width: clipW, top: 2, height: TRACK_H - 4,
                        background: isError ? '#7f1d1d' : TTS_BG,
                        border: `1px solid ${isError ? '#f87171' : TTS_BORDER}`,
                        borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                      }} onClick={() => dispatch({ type: 'SELECT_SCENE', id: scene.id })}>

                        {/* Waveform — visible only when audio is ready */}
                        {isReady && (
                          <div className="absolute inset-0 flex items-center">
                            <WaveformBar seed={`${scene.id}-tts`} width={Math.max(1, clipW - 2)} height={TRACK_H - 6} color="rgba(255,255,255,0.45)" />
                          </div>
                        )}

                        {/* Loading shimmer */}
                        {isLoading && (
                          <div className="absolute inset-0 animate-pulse" style={{ background: 'rgba(167,139,250,0.18)' }}>
                            <div className="absolute inset-0 flex items-center justify-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-purple-300/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-1 h-1 rounded-full bg-purple-300/70 animate-bounce" style={{ animationDelay: '120ms' }} />
                              <div className="w-1 h-1 rounded-full bg-purple-300/70 animate-bounce" style={{ animationDelay: '240ms' }} />
                            </div>
                          </div>
                        )}

                        {/* Error state */}
                        {isError && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-[9px] text-red-300 font-medium tracking-wide">⚠ TTS error</span>
                          </div>
                        )}

                        <span className="absolute bottom-0.5 left-1.5 text-[9px] text-white/60 truncate pointer-events-none" style={{ maxWidth: clipW - 10 }}>{label}</span>
                        <div style={{ position: 'absolute', right: 0, top: 0, width: 7, height: '100%', cursor: 'ew-resize', background: `${TTS_BORDER}88`, borderRadius: '0 3px 3px 0' }}
                          onMouseDown={e => onTrimStart(e, scene.id, durationMs)} />
                      </div>
                    ) : (
                      <div key={scene.id} style={{ position: 'absolute', left: clipX, width: clipW, top: 2, height: TRACK_H - 4, background: 'rgba(255,255,255,0.02)', border: '1px dashed #2a2a2a', borderRadius: 4 }} />
                    );
                  }

                  if (track.type === 'bgm') {
                    const hasContent = !!scene.audio.bgm?.src;
                    const label = scene.audio.bgm?.src ?? '';
                    return hasContent ? (
                      <div key={scene.id} style={{
                        position: 'absolute', left: clipX, width: clipW, top: 2, height: TRACK_H - 4,
                        background: BGM_BG, border: `1px solid ${BGM_BORDER}`,
                        borderRadius: 4, overflow: 'hidden', cursor: 'pointer',
                      }} onClick={() => dispatch({ type: 'SELECT_SCENE', id: scene.id })}>
                        <div className="absolute inset-0 flex items-center">
                          <WaveformBar seed={`${scene.id}-bgm`} width={Math.max(1, clipW - 2)} height={TRACK_H - 6} color="rgba(255,255,255,0.45)" />
                        </div>
                        <span className="absolute bottom-0.5 left-1.5 text-[9px] text-white/60 truncate pointer-events-none" style={{ maxWidth: clipW - 10 }}>{label}</span>
                        <div style={{ position: 'absolute', right: 0, top: 0, width: 7, height: '100%', cursor: 'ew-resize', background: `${BGM_BORDER}88`, borderRadius: '0 3px 3px 0' }}
                          onMouseDown={e => onTrimStart(e, scene.id, durationMs)} />
                      </div>
                    ) : (
                      <div key={scene.id} style={{ position: 'absolute', left: clipX, width: clipW, top: 2, height: TRACK_H - 4, background: 'rgba(255,255,255,0.02)', border: '1px dashed #2a2a2a', borderRadius: 4 }} />
                    );
                  }

                  return null;
                })}
              </div>
            ))}

            {/* ── Global audio section divider ─────────────────────────── */}
            <div style={{
              height: 20, background: '#0a0a0a', borderTop: '1px solid #2a2a2a',
              borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center',
            }}>
              <span className="text-[9px] text-white/20 uppercase tracking-widest px-2">
                Global Audio Tracks — drag freely across scenes
              </span>
            </div>

            {/* ── Global audio clip rows ───────────────────────────────── */}
            {globalAudioTracks.map((clip, i) => {
              const clipX = clip.startMs * pxPerMs;
              const clipW = Math.max(20, clip.durationMs * pxPerMs);
              return (
                <div key={clip.id} style={{
                  height: AUDIO_TRACK_H, position: 'relative',
                  background: i % 2 === 0 ? '#0f0f0f' : '#111',
                  borderBottom: '1px solid #1a1a1a',
                }}>
                  {/* The draggable clip */}
                  <div
                    style={{
                      position: 'absolute', left: clipX, width: clipW,
                      top: 3, height: AUDIO_TRACK_H - 6,
                      background: GLOBAL_AUDIO_BG,
                      border: `1.5px solid ${GLOBAL_AUDIO_BORDER}`,
                      borderRadius: 5, overflow: 'visible', cursor: 'grab',
                      boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
                    }}
                    onMouseDown={e => onAudioClipMouseDown(e, clip)}
                  >
                    {/* Waveform fill */}
                    <div className="absolute inset-0 rounded overflow-hidden pointer-events-none">
                      <WaveformBar seed={clip.id} width={Math.max(1, clipW - 4)} height={AUDIO_TRACK_H - 10} color="rgba(255,255,255,0.4)" />
                    </div>

                    {/* Label */}
                    <span className="absolute bottom-1 left-2 text-[9px] text-white/80 truncate pointer-events-none font-medium"
                      style={{ maxWidth: clipW - 24 }}>
                      {clip.label || clip.src}
                    </span>

                    {/* Volume badge */}
                    <span className="absolute top-1 right-7 text-[8px] text-amber-200/70 pointer-events-none tabular-nums">
                      {Math.round(clip.volume * 100)}%
                    </span>

                    {/* Left trim handle */}
                    <div
                      style={{
                        position: 'absolute', left: 0, top: 0, width: 8, height: '100%',
                        cursor: 'ew-resize', background: `${GLOBAL_AUDIO_BORDER}99`,
                        borderRadius: '4px 0 0 4px', zIndex: 2,
                      }}
                      onMouseDown={e => onAudioTrimMouseDown(e, clip, 'left')}
                      title="Trim start"
                    >
                      <div className="absolute inset-y-0 left-2 w-px bg-white/40" />
                    </div>

                    {/* Right trim handle */}
                    <div
                      style={{
                        position: 'absolute', right: 0, top: 0, width: 8, height: '100%',
                        cursor: 'ew-resize', background: `${GLOBAL_AUDIO_BORDER}99`,
                        borderRadius: '0 4px 4px 0', zIndex: 2,
                      }}
                      onMouseDown={e => onAudioTrimMouseDown(e, clip, 'right')}
                      title="Trim end"
                    >
                      <div className="absolute inset-y-0 right-2 w-px bg-white/40" />
                    </div>
                  </div>
                </div>
              );
            })}

            {globalAudioTracks.length === 0 && (
              <div style={{ height: 32, background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}
                className="flex items-center px-4 gap-2">
                <Music size={10} className="text-muted/40" />
                <span className="text-[10px] text-muted/40">
                  Add an audio track above to drag it freely across scenes
                </span>
              </div>
            )}

            {/* ── Playhead ────────────────────────────────────────────────── */}
            <div style={{
              position: 'absolute', top: 0, left: playheadX, width: 2,
              height: '100%', background: '#ef4444', zIndex: 30, pointerEvents: 'none',
            }}>
              <div
                style={{
                  position: 'absolute', top: 0, left: -5,
                  width: 12, height: 14, background: '#ef4444',
                  clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                  cursor: 'ew-resize', pointerEvents: 'all',
                }}
                onMouseDown={onPlayheadMouseDown}
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
