'use client';

/**
 * useTTSCache
 * ===========
 * Pre-fetches and caches TTS audio blobs for every scene that has voice text.
 * Returns a stable Map<sceneId, TTSEntry> that is updated asynchronously.
 *
 * Cache key = hash of (text + voice + speed + pitch).
 * If two scenes share identical params, the blob is reused.
 * Blob URLs are revoked only when the module-level cache is cleared.
 *
 * The hook re-fires whenever any scene's voice params change.
 */

import { useEffect, useRef, useState } from 'react';
import type { Scene, Defaults } from '@/types/blueprint';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TTSEntry {
  url:    string;
  status: 'loading' | 'ready' | 'error';
}

interface SceneVoiceSpec {
  sceneId: string;
  text:    string;
  voice:   string;
  speed:   number;
  pitch:   number;
}

// ─── Module-level blob cache (survives re-renders) ────────────────────────────

/** cacheKey → blob URL */
const blobCache = new Map<string, string>();

/** cacheKey → in-flight fetch (deduplicates parallel calls) */
const inflight  = new Map<string, Promise<string | null>>();

function makeCacheKey(spec: Omit<SceneVoiceSpec, 'sceneId'>): string {
  return `${spec.voice}|${spec.speed.toFixed(3)}|${spec.pitch.toFixed(3)}|${spec.text}`;
}

async function fetchTTSBlob(spec: Omit<SceneVoiceSpec, 'sceneId'>): Promise<string | null> {
  const key = makeCacheKey(spec);
  if (blobCache.has(key)) return blobCache.get(key)!;
  if (inflight.has(key))  return inflight.get(key)!;

  const promise = (async () => {
    try {
      const res = await fetch('/api/tts-full', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          text:  spec.text,
          voice: spec.voice,
          speed: spec.speed,
          pitch: spec.pitch,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      blobCache.set(key, url);
      return url;
    } catch (err) {
      console.warn('[useTTSCache] fetch failed:', err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTTSCache(scenes: Scene[], defaults: Defaults): Map<string, TTSEntry> {
  const [ttsMap, setTtsMap] = useState<Map<string, TTSEntry>>(new Map());

  /**
   * We derive voice specs from scenes and re-run whenever they change.
   * Using a serialised string as the effect dependency avoids stale closure
   * issues while still being deep-equal stable.
   */
  const specs: SceneVoiceSpec[] = scenes
    .filter(s => !!s.audio.voice?.text?.trim())
    .map(s => ({
      sceneId: s.id,
      text:    s.audio.voice!.text!.trim(),
      voice:   s.audio.voice!.voice  ?? defaults.voice,
      speed:   s.audio.voice!.speed  ?? defaults.speed  ?? 1.0,
      pitch:   s.audio.voice!.pitch  ?? defaults.pitch  ?? 1.0,
    }));

  // Serialise specs for use as effect dependency (stable reference comparison)
  const specsKey = JSON.stringify(specs.map(s => ({
    id: s.sceneId, key: makeCacheKey(s),
  })));

  // Ref to cancel stale async work after re-render or unmount
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    if (specs.length === 0) {
      setTtsMap(new Map());
      return;
    }

    // Immediately set loading state for scenes not yet cached
    setTtsMap(() => {
      const next = new Map<string, TTSEntry>();
      for (const spec of specs) {
        const key = makeCacheKey(spec);
        if (blobCache.has(key)) {
          next.set(spec.sceneId, { url: blobCache.get(key)!, status: 'ready' });
        } else {
          next.set(spec.sceneId, { url: '', status: 'loading' });
        }
      }
      return next;
    });

    // Fire async fetches for those not cached
    (async () => {
      for (const spec of specs) {
        if (cancelRef.current) break;
        const key = makeCacheKey(spec);
        if (blobCache.has(key)) continue; // already handled above

        const url = await fetchTTSBlob(spec);
        if (cancelRef.current) break;

        setTtsMap(prev => {
          const next = new Map(prev);
          next.set(spec.sceneId, url
            ? { url, status: 'ready' }
            : { url: '', status: 'error' });
          return next;
        });
      }
    })();

    return () => { cancelRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specsKey]);

  return ttsMap;
}
