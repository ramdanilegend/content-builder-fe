'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Scene } from '@/types/blueprint';

// ─── Scene time entry ─────────────────────────────────────────────────────────

export interface SceneTime {
  scene: Scene;
  startMs: number;
  durationMs: number;
  endMs: number;
}

/** Compute absolute start/end times for each scene given a fallback duration. */
export function computeSceneTimes(scenes: Scene[], defaultDurationMs: number): SceneTime[] {
  let cursor = 0;
  return scenes.map(scene => {
    const durationMs =
      scene.duration.mode === 'fixed'
        ? Math.max(500, scene.duration.ms ?? defaultDurationMs)
        : defaultDurationMs;
    const st: SceneTime = { scene, startMs: cursor, durationMs, endMs: cursor + durationMs };
    cursor += durationMs;
    return st;
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface PlaybackControls {
  playheadMs: number;
  isPlaying: boolean;
  totalDurationMs: number;
  sceneTimes: SceneTime[];
  /** Scene currently at the playhead position */
  currentScene: SceneTime | undefined;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (ms: number) => void;
}

export function usePlayback(scenes: Scene[], defaultDurationMs: number): PlaybackControls {
  const [playheadMs, setPlayheadMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const rafRef    = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const sceneTimes = useMemo(
    () => computeSceneTimes(scenes, defaultDurationMs),
    [scenes, defaultDurationMs],
  );

  const totalDurationMs = sceneTimes.length > 0
    ? sceneTimes[sceneTimes.length - 1].endMs
    : defaultDurationMs;

  const currentScene = useMemo(
    () => sceneTimes.find(st => playheadMs >= st.startMs && playheadMs < st.endMs)
      ?? sceneTimes[sceneTimes.length - 1],
    [sceneTimes, playheadMs],
  );

  // ── Cancel animation frame ──────────────────────────────────────────────

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
  }, []);

  // ── play ────────────────────────────────────────────────────────────────

  const play = useCallback(() => {
    cancelRaf();
    setIsPlaying(true);

    const tick = (timestamp: number) => {
      if (lastTsRef.current === null) lastTsRef.current = timestamp;
      const delta = timestamp - lastTsRef.current;
      lastTsRef.current = timestamp;

      setPlayheadMs(prev => {
        const next = prev + delta;
        if (next >= totalDurationMs) {
          cancelRaf();
          setIsPlaying(false);
          return 0;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDurationMs]);

  // ── pause ───────────────────────────────────────────────────────────────

  const pause = useCallback(() => {
    cancelRaf();
    setIsPlaying(false);
  }, [cancelRaf]);

  const toggle = useCallback(() => {
    if (isPlaying) pause(); else play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((ms: number) => {
    setPlayheadMs(Math.max(0, Math.min(ms, totalDurationMs)));
  }, [totalDurationMs]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────

  useEffect(() => () => cancelRaf(), [cancelRaf]);

  // ── Re-compute total when scenes change while playing ───────────────────

  useEffect(() => {
    setPlayheadMs(prev => Math.min(prev, totalDurationMs));
  }, [totalDurationMs]);

  return { playheadMs, isPlaying, totalDurationMs, sceneTimes, currentScene, play, pause, toggle, seek };
}
