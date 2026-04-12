'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Square, Mic, Music, AlertCircle } from 'lucide-react';
import type { Scene } from '@/types/blueprint';
import { useBlueprint } from '@/context/BlueprintContext';

type PlayState = 'idle' | 'playing' | 'done' | 'error';

interface SceneAudioPreviewProps {
  scene: Scene;
  /** Object URLs keyed by asset id / path / filename */
  assetUrls: Map<string, string>;
}

export default function SceneAudioPreview({ scene, assetUrls }: SceneAudioPreviewProps) {
  const { state } = useBlueprint();
  const { defaults } = state.blueprint;

  const [playState, setPlayState] = useState<PlayState>('idle');
  const [progress, setProgress] = useState(0);          // 0–100
  const [elapsed, setElapsed]   = useState(0);          // seconds
  const [duration, setDuration] = useState<number | null>(null); // seconds
  const [errorMsg, setErrorMsg] = useState('');

  const bgmRef    = useRef<HTMLAudioElement | null>(null);
  const rafRef    = useRef<number | null>(null);
  const startRef  = useRef<number>(0);
  const utterRef  = useRef<SpeechSynthesisUtterance | null>(null);

  // Cleanup on unmount
  useEffect(() => () => stopAll(), []);

  /** Resolve asset src → blob URL */
  const resolveUrl = useCallback((src?: string): string | undefined => {
    if (!src) return undefined;
    if (assetUrls.has(src)) return assetUrls.get(src);
    const basename = src.split('/').pop() ?? src;
    if (assetUrls.has(basename)) return assetUrls.get(basename);
    for (const [key, url] of Array.from(assetUrls.entries())) {
      if (key.endsWith('/' + src) || key.endsWith('/' + basename)) return url;
    }
    return undefined;
  }, [assetUrls]);

  const stopAll = useCallback(() => {
    // Stop TTS
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    utterRef.current = null;

    // Stop BGM
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
      bgmRef.current = null;
    }

    // Stop RAF timer
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stopAll();
    setPlayState('idle');
    setProgress(0);
    setElapsed(0);
  }, [stopAll]);

  /** Animate progress bar via requestAnimationFrame */
  const startProgressTimer = useCallback((totalSec: number) => {
    startRef.current = performance.now();

    const tick = () => {
      const sec = (performance.now() - startRef.current) / 1000;
      setElapsed(Math.min(sec, totalSec));
      setProgress(Math.min((sec / totalSec) * 100, 100));

      if (sec < totalSec) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlayState('done');
        setProgress(100);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(async () => {
    setPlayState('playing');
    setProgress(0);
    setElapsed(0);
    setErrorMsg('');

    const voice    = scene.audio.voice;
    const bgm      = scene.audio.bgm;
    const voiceText = voice?.text?.trim();
    const bgmUrl    = resolveUrl(bgm?.src);

    let estimatedDuration = 3; // fallback seconds

    // ── Start BGM ────────────────────────────────────────────────────────────
    if (bgm && bgmUrl) {
      const audio = new Audio(bgmUrl);
      audio.volume = bgm.volume ?? 0.4;
      audio.loop   = bgm.loop ?? true;
      bgmRef.current = audio;
      try {
        await audio.play();
        if (!voiceText && audio.duration && isFinite(audio.duration)) {
          estimatedDuration = audio.duration;
        }
      } catch {
        // BGM autoplay blocked – silently skip
      }
    }

    // ── Start TTS voice ───────────────────────────────────────────────────────
    if (voiceText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(voiceText);

      // Match voice preference if available
      const voices = window.speechSynthesis.getVoices();
      const voiceName = voice?.voice ?? defaults.voice ?? '';
      // Try exact match, then language prefix (en-US → en)
      const langPrefix = voiceName.split('-').slice(0, 2).join('-');
      const matched = voices.find(v => v.name === voiceName)
                   ?? voices.find(v => v.lang.startsWith(langPrefix))
                   ?? voices.find(v => v.lang.startsWith('en'));
      if (matched) utter.voice = matched;

      const speedVal = voice?.speed ?? defaults.speed ?? 1;
      utter.rate   = typeof speedVal === 'number' ? speedVal : 1;
      utter.volume = 1;

      // Estimate duration from word count (~2.5 words per second at normal rate)
      const wordCount = voiceText.split(/\s+/).length;
      estimatedDuration = wordCount / (2.5 * utter.rate);

      utter.onend = () => {
        stopAll();
        setPlayState('done');
        setProgress(100);
      };
      utter.onerror = () => {
        stopAll();
        setPlayState('error');
        setErrorMsg('TTS failed. Try a shorter text or check browser permissions.');
      };

      utterRef.current = utter;
      window.speechSynthesis.speak(utter);
    }

    setDuration(estimatedDuration);
    startProgressTimer(estimatedDuration);
  }, [scene.audio, defaults, resolveUrl, startProgressTimer, stopAll]);

  // ─── helpers ────────────────────────────────────────────────────────────────

  const hasVoice = !!scene.audio.voice?.text?.trim();
  const hasBgm   = !!scene.audio.bgm?.src;
  const hasAudio = hasVoice || hasBgm;

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!hasAudio) return null;

  return (
    <div className="mt-2 rounded-xl border border-border bg-surface-2 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">Scene Preview</span>
        <div className="flex items-center gap-2">
          {hasVoice && (
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Mic size={9} /> voice
            </span>
          )}
          {hasBgm && (
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <Music size={9} /> bgm
            </span>
          )}
        </div>
      </div>

      {/* Voice text preview */}
      {hasVoice && (
        <p className="text-[10px] text-muted/80 italic leading-relaxed line-clamp-2 border-l-2 border-accent/30 pl-2">
          "{scene.audio.voice!.text}"
        </p>
      )}

      {/* Controls + progress */}
      <div className="flex items-center gap-2">
        {playState === 'idle' || playState === 'done' ? (
          <button
            onClick={play}
            className="flex items-center gap-1.5 text-xs font-medium bg-accent hover:bg-accent/80 text-black px-3 py-1.5 rounded-lg transition-colors"
          >
            <Play size={12} className="fill-current" />
            {playState === 'done' ? 'Replay' : 'Preview Scene'}
          </button>
        ) : playState === 'playing' ? (
          <button
            onClick={stop}
            className="flex items-center gap-1.5 text-xs font-medium bg-red-500/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Square size={10} className="fill-current" /> Stop
          </button>
        ) : null}

        {/* Progress bar + timer */}
        {(playState === 'playing' || playState === 'done') && duration !== null && (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 bg-surface-1 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-accent transition-all rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted shrink-0">
              {fmtSec(elapsed)} / {fmtSec(duration)}
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {playState === 'error' && (
        <div className="flex items-start gap-1.5 text-[10px] text-red-400">
          <AlertCircle size={10} className="mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Done badge */}
      {playState === 'done' && (
        <p className="text-[10px] text-green-400">✓ Preview complete</p>
      )}
    </div>
  );
}
