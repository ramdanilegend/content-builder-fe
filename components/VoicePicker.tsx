'use client';

import { useEffect, useRef, useState } from 'react';

interface EdgeVoice {
  ShortName: string;
  FriendlyName: string;
  Locale: string;
  Gender: 'Male' | 'Female';
  VoiceTag?: {
    VoicePersonalities?: string[];
  };
}

interface Props {
  value: string;
  onChange: (voice: string) => void;
  previewText?: string;
  compact?: boolean;
}

const DEFAULT_PREVIEW_TEXT = 'Hello! This is a preview of my voice.';

function localeLang(locale: string) {
  return locale.split('-')[0].toUpperCase();
}

function localeLabel(locale: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(locale.split('-')[1] ?? '') ?? locale;
  } catch {
    return locale;
  }
}

export default function VoicePicker({ value, onChange, previewText, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [voices, setVoices] = useState<EdgeVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [langFilter, setLangFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch voice list once when opened
  useEffect(() => {
    if (!open || voices.length) return;
    setLoading(true);
    fetch('/api/voices')
      .then(r => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setVoices(data as EdgeVoice[]);
        else setError('Failed to load voices');
      })
      .catch(() => setError('Failed to load voices'))
      .finally(() => setLoading(false));
  }, [open, voices.length]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Unique languages for filter
  const languages = ['ALL', ...Array.from(new Set(voices.map(v => localeLang(v.Locale)))).sort()];

  const filtered = voices.filter(v => {
    const matchSearch =
      !search ||
      v.ShortName.toLowerCase().includes(search.toLowerCase()) ||
      v.FriendlyName.toLowerCase().includes(search.toLowerCase()) ||
      v.Locale.toLowerCase().includes(search.toLowerCase());
    const matchLang = langFilter === 'ALL' || localeLang(v.Locale) === langFilter;
    const matchGender = genderFilter === 'ALL' || v.Gender === genderFilter;
    return matchSearch && matchLang && matchGender;
  });

  async function playPreview(voice: string, e: React.MouseEvent) {
    e.stopPropagation();

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingVoice === voice) {
      setPlayingVoice(null);
      return;
    }

    const text = (previewText && previewText.trim()) ? previewText.trim() : DEFAULT_PREVIEW_TEXT;
    setPlayingVoice(voice);
    try {
      const res = await fetch('/api/tts-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.error('TTS preview error:', err);
      setPlayingVoice(null);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="field-input w-full text-left flex items-center justify-between gap-2"
      >
        <span className="truncate">{value || 'Select voice…'}</span>
        <svg className={`w-3.5 h-3.5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute z-50 mt-1 ${compact ? 'right-0 w-[420px]' : 'left-0 right-0 min-w-[360px]'} rounded-xl border border-border bg-surface shadow-2xl shadow-black/60`}>
          {/* Filters */}
          <div className="p-2.5 border-b border-border space-y-2">
            <input
              autoFocus
              type="text"
              placeholder="Search voice, locale…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="field-input w-full text-xs"
            />
            <div className="flex gap-2">
              <select
                value={langFilter}
                onChange={e => setLangFilter(e.target.value)}
                className="field-input flex-1 text-xs"
              >
                {languages.map(l => (
                  <option key={l} value={l}>{l === 'ALL' ? 'All Languages' : l}</option>
                ))}
              </select>
              <select
                value={genderFilter}
                onChange={e => setGenderFilter(e.target.value)}
                className="field-input text-xs"
              >
                <option value="ALL">All Genders</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>

          {/* Voice list */}
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="py-8 text-center text-xs text-muted animate-pulse">Loading voices…</div>
            )}
            {error && (
              <div className="py-6 text-center text-xs text-red-400">{error}</div>
            )}
            {!loading && !error && filtered.length === 0 && (
              <div className="py-6 text-center text-xs text-muted">No voices found</div>
            )}
            {!loading && filtered.map(v => {
              const isSelected = v.ShortName === value;
              const isPlaying = playingVoice === v.ShortName;
              return (
                <div
                  key={v.ShortName}
                  onClick={() => { onChange(v.ShortName); setOpen(false); }}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group
                    ${isSelected ? 'bg-accent/15' : 'hover:bg-surface-2'}`}
                >
                  {/* Selection dot */}
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-accent' : 'bg-transparent group-hover:bg-border'}`} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-medium truncate ${isSelected ? 'text-accent' : 'text-foreground'}`}>
                        {v.ShortName}
                      </span>
                      <span className={`text-[10px] px-1 rounded shrink-0 ${v.Gender === 'Female' ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {v.Gender === 'Female' ? '♀' : '♂'}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted truncate">
                      {v.Locale} · {localeLabel(v.Locale)}
                    </div>
                  </div>

                  {/* Play button */}
                  <button
                    type="button"
                    onClick={(e) => playPreview(v.ShortName, e)}
                    className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors
                      ${isPlaying
                        ? 'bg-accent text-white animate-pulse'
                        : 'bg-surface-2 text-muted hover:bg-accent/20 hover:text-accent opacity-0 group-hover:opacity-100'}`}
                    title="Preview voice"
                  >
                    {isPlaying ? (
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                        <rect x="5" y="4" width="3" height="12" rx="1" />
                        <rect x="12" y="4" width="3" height="12" rx="1" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 translate-x-px" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {!loading && !error && (
            <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted text-right">
              {filtered.length} of {voices.length} voices
            </div>
          )}
        </div>
      )}
    </div>
  );
}
