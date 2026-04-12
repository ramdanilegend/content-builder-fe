'use client';

import { useBlueprint } from '@/context/BlueprintContext';
import type { SceneAudio } from '@/types/blueprint';
import VoicePicker from './VoicePicker';

export default function AudioConfig({ sceneId }: { sceneId: string }) {
  const { state, dispatch, selectedScene } = useBlueprint();
  if (!selectedScene) return null;

  const { audio } = selectedScene;
  const audioAssets = state.blueprint.assets.audio;

  const update = (patch: Partial<SceneAudio>) => {
    dispatch({ type: 'SET_SCENE_AUDIO', id: sceneId, audio: { ...audio, ...patch } });
  };

  const hasVoice = !!audio.voice;
  const hasBgm = !!audio.bgm;

  return (
    <div className="space-y-4">
      <span className="field-label block">Audio</span>

      {/* Voice */}
      <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Voice (TTS)</span>
          <button
            className={`text-xs px-2 py-0.5 rounded ${hasVoice ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-accent/20 text-accent hover:bg-accent/30'} transition-colors`}
            onClick={() => update({ voice: hasVoice ? undefined : { text: '', voice: 'en-US-JennyNeural' } })}
          >
            {hasVoice ? 'Remove' : 'Enable'}
          </button>
        </div>

        {hasVoice && (
          <div className="space-y-2">
            {/* Render toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent rounded"
                checked={audio.voice?.render !== false}
                onChange={e => update({ voice: { ...audio.voice!, render: e.target.checked } })}
              />
              <span className="text-xs text-muted">Render audio in final video</span>
            </label>

            <label className="block">
              <span className="text-xs text-muted">Script text</span>
              <textarea
                className="field-input mt-1 resize-none"
                rows={3}
                value={audio.voice?.text ?? ''}
                onChange={e => update({ voice: { ...audio.voice!, text: e.target.value } })}
                placeholder="Text to speak..."
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Voice</span>
              <div className="mt-1">
                <VoicePicker
                  value={audio.voice?.voice ?? ''}
                  onChange={v => update({ voice: { ...audio.voice!, voice: v } })}
                  previewText={audio.voice?.text}
                />
              </div>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-muted">Speed</span>
                  <span className="text-xs text-accent font-mono">
                    {(audio.voice?.speed ?? 0.95).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range" min={0.5} max={2.0} step={0.05}
                  value={audio.voice?.speed ?? 0.95}
                  onChange={e => update({ voice: { ...audio.voice!, speed: Number(e.target.value) } })}
                  className="w-full accent-accent h-1.5 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted">
                  <span>0.5x</span><span>2.0x</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-muted">Pitch</span>
                  <span className="text-xs text-accent font-mono">
                    {(audio.voice?.pitch ?? 1.0).toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range" min={0.5} max={2.0} step={0.05}
                  value={audio.voice?.pitch ?? 1.0}
                  onChange={e => update({ voice: { ...audio.voice!, pitch: Number(e.target.value) } })}
                  className="w-full accent-accent h-1.5 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted">
                  <span>0.5x</span><span>2.0x</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BGM */}
      <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Background Music</span>
          <button
            className={`text-xs px-2 py-0.5 rounded ${hasBgm ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-accent/20 text-accent hover:bg-accent/30'} transition-colors`}
            onClick={() => update({ bgm: hasBgm ? undefined : { src: '', volume: 0.5, loop: true } })}
          >
            {hasBgm ? 'Remove' : 'Enable'}
          </button>
        </div>

        {hasBgm && (
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-muted">Audio Asset</span>
              <select
                className="field-input mt-1"
                value={audio.bgm?.src ?? ''}
                onChange={e => update({ bgm: { ...audio.bgm!, src: e.target.value } })}
              >
                <option value="">— select audio asset —</option>
                {audioAssets.map(a => (
                  <option key={a.id} value={a.id}>{a.id} ({a.filename})</option>
                ))}
              </select>
            </label>

            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted">
                <span>Volume</span>
                <span>{Math.round((audio.bgm?.volume ?? 0.5) * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={audio.bgm?.volume ?? 0.5}
                onChange={e => update({ bgm: { ...audio.bgm!, volume: Number(e.target.value) } })}
                className="w-full accent-accent h-1.5 cursor-pointer"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent"
                checked={audio.bgm?.loop ?? true}
                onChange={e => update({ bgm: { ...audio.bgm!, loop: e.target.checked } })}
              />
              <span className="text-xs text-muted">Loop BGM</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
