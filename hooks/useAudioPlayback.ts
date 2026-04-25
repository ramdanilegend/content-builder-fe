'use client';

/**
 * useAudioPlayback
 * ================
 * Plays back global audio tracks + per-scene BGM using the HTML5 Audio API
 * so the preview canvas sounds like the final video during playback.
 *
 * Design principles:
 *  - One HTMLAudioElement per unique asset URL (re-used across seeks)
 *  - On play: every track whose window covers the current playheadMs is
 *    started from the correct intra-clip offset
 *  - On pause / stop: all elements are paused
 *  - On seek while playing: stop everything, then call startAll()
 *  - Global audio tracks span scene boundaries freely
 *  - Per-scene BGM is treated as a synthetic TimelineAudioClip
 */

import { useEffect, useRef, useCallback } from 'react';
import type { TimelineAudioClip } from '@/types/blueprint';
import type { SceneTime } from './usePlayback';
import type { TTSEntry } from './useTTSCache';

// ─── Internal clip shape ──────────────────────────────────────────────────────

interface AudioJob {
  id:         string;
  url:        string;
  startMs:    number;
  durationMs: number;
  volume:     number;
  fadeInMs:   number;
  fadeOutMs:  number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAudioPlayback(params: {
  audioTracks: TimelineAudioClip[];       // global timeline clips
  sceneTimes:  SceneTime[];               // for per-scene BGM + TTS timing
  assetUrls:   Map<string, string>;       // asset id → object URL (for BGM)
  ttsMap:      Map<string, TTSEntry>;     // sceneId → TTS blob URL
  playheadMs:  number;
  isPlaying:   boolean;
}) {
  const { audioTracks, sceneTimes, assetUrls, ttsMap, playheadMs, isPlaying } = params;

  /** One HTMLAudioElement per job id */
  const elements = useRef<Map<string, HTMLAudioElement>>(new Map());
  const isPlayingRef = useRef(false);
  const playheadRef  = useRef(0);

  // Keep refs in sync
  isPlayingRef.current = isPlaying;
  playheadRef.current  = playheadMs;

  // ── Build job list ──────────────────────────────────────────────────────────
  const buildJobs = useCallback((): AudioJob[] => {
    const jobs: AudioJob[] = [];

    // 1. Global audio tracks
    for (const clip of audioTracks) {
      const basename = clip.src.split('/').pop() ?? '';
      const url = assetUrls.get(clip.src)
        ?? assetUrls.get(basename)
        ?? (() => {
          let found: string | undefined;
          assetUrls.forEach((u, key) => {
            if (!found && (key.endsWith('/' + clip.src) || key.endsWith('/' + basename))) found = u;
          });
          return found;
        })();

      if (!url) continue;
      jobs.push({
        id:         `global_${clip.id}`,
        url,
        startMs:    clip.startMs,
        durationMs: clip.durationMs,
        volume:     clip.volume,
        fadeInMs:   clip.fadeInMs,
        fadeOutMs:  clip.fadeOutMs,
      });
    }

    // 2. Per-scene BGM
    for (const st of sceneTimes) {
      const bgm = st.scene.audio?.bgm;
      if (!bgm?.src) continue;
      const url = assetUrls.get(bgm.src)
        ?? assetUrls.get(bgm.src.split('/').pop() ?? '');
      if (!url) continue;
      jobs.push({
        id:         `bgm_${st.scene.id}`,
        url,
        startMs:    st.startMs,
        durationMs: st.durationMs,
        volume:     bgm.volume ?? 0.5,
        fadeInMs:   0,
        fadeOutMs:  0,
      });
    }

    // 3. Per-scene TTS voice (pre-fetched via useTTSCache)
    for (const st of sceneTimes) {
      const entry = ttsMap.get(st.scene.id);
      if (!entry || entry.status !== 'ready' || !entry.url) continue;
      jobs.push({
        id:         `tts_${st.scene.id}`,
        url:         entry.url,
        startMs:    st.startMs,
        durationMs: st.durationMs,
        volume:     1.0,
        fadeInMs:   0,
        fadeOutMs:  0,
      });
    }

    return jobs;
  }, [audioTracks, sceneTimes, assetUrls, ttsMap]);

  // ── Get or create HTMLAudioElement ──────────────────────────────────────────
  const getElement = useCallback((job: AudioJob): HTMLAudioElement => {
    let el = elements.current.get(job.id);
    if (!el || el.src !== job.url) {
      el?.pause();
      el = new Audio(job.url);
      el.preload = 'auto';
      elements.current.set(job.id, el);
    }
    return el;
  }, []);

  // ── Start all active jobs at the current playhead position ──────────────────
  const startAll = useCallback((atMs: number) => {
    const jobs = buildJobs();
    for (const job of jobs) {
      const localMs = atMs - job.startMs;
      // Only play if playhead is inside the clip window
      if (localMs < 0 || localMs >= job.durationMs) continue;

      const el = getElement(job);
      el.volume  = Math.max(0, Math.min(1, job.volume));
      el.loop    = false;
      // Seek to the correct position within the clip
      const offsetS = localMs / 1000;
      el.currentTime = offsetS;
      el.play().catch(() => {/* autoplay policy – ignore */});
    }
  }, [buildJobs, getElement]);

  // ── Pause / stop all ────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    elements.current.forEach(el => el.pause());
  }, []);

  // ── React to isPlaying changes ──────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      startAll(playheadMs);
    } else {
      stopAll();
    }
  // Re-run only when isPlaying flips — playheadMs handled separately below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // ── React to seek while playing ─────────────────────────────────────────────
  const prevPlayheadRef = useRef(playheadMs);
  useEffect(() => {
    // If paused, don't do anything when playhead changes
    if (!isPlayingRef.current) {
      prevPlayheadRef.current = playheadMs;
      return;
    }
    // If the jump is large (>250ms beyond normal drift), it's a seek — restart audio
    const drift = playheadMs - prevPlayheadRef.current;
    if (Math.abs(drift) > 300) {
      stopAll();
      startAll(playheadMs);
    }
    prevPlayheadRef.current = playheadMs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playheadMs]);

  // ── Also restart audio when the asset URLs, tracks, or TTS changes while playing ──
  useEffect(() => {
    if (isPlayingRef.current) {
      stopAll();
      startAll(playheadRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioTracks, sceneTimes, assetUrls, ttsMap]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      elements.current.forEach(el => { el.pause(); el.src = ''; });
      elements.current.clear();
    };
  }, []);
}
