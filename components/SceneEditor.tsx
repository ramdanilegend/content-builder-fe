'use client';

import { useBlueprint } from '@/context/BlueprintContext';
import { useAssetUrls } from '@/hooks/useAssetUrls';
import type { Scene, SceneEffect, SceneEffectType } from '@/types/blueprint';
import LayerEditor from './LayerEditor';
import AudioConfig from './AudioConfig';
import CanvasPreview from './CanvasPreview';
import SceneAudioPreview from './SceneAudioPreview';

// ── supported scene-level effects ────────────────────────────────────────────

const SCENE_EFFECTS: { type: SceneEffectType; label: string; desc: string }[] = [
  { type: 'fade_in',  label: 'Fade In',   desc: 'Fade from black at scene start' },
  { type: 'fade_out', label: 'Fade Out',  desc: 'Fade to black at scene end' },
  { type: 'fade',     label: 'Fade Both', desc: 'Fade in + fade out (same duration)' },
];

function EffectsPicker({
  effects,
  onChange,
}: {
  effects: SceneEffect[];
  onChange: (effects: SceneEffect[]) => void;
}) {
  const activeMap = Object.fromEntries(effects.map(e => [e.type, e.duration_ms]));

  const toggle = (type: SceneEffectType) => {
    if (activeMap[type] !== undefined) {
      onChange(effects.filter(e => e.type !== type));
    } else {
      onChange([...effects, { type, duration_ms: 500 }]);
    }
  };

  const setDuration = (type: SceneEffectType, ms: number) => {
    onChange(effects.map(e => e.type === type ? { ...e, duration_ms: ms } : e));
  };

  return (
    <div className="space-y-2">
      <span className="field-label block">Scene Effects</span>
      <div className="flex flex-col gap-2">
        {SCENE_EFFECTS.map(({ type, label, desc }) => {
          const active = activeMap[type] !== undefined;
          return (
            <div key={type} className={`rounded-lg border transition-all ${active ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface-2'}`}>
              <div className="flex items-center gap-3 px-3 py-2">
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => toggle(type)}
                  className={`w-8 h-4 rounded-full transition-colors shrink-0 relative ${active ? 'bg-accent' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${active ? 'left-4' : 'left-0.5'}`} />
                </button>

                {/* Label + desc */}
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium ${active ? 'text-white' : 'text-muted'}`}>{label}</span>
                  <span className="text-xs text-muted ml-2">— {desc}</span>
                </div>

                {/* Duration input — only shown when active */}
                {active && (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={100}
                      max={3000}
                      step={100}
                      value={activeMap[type]}
                      onChange={e => setDuration(type, Number(e.target.value))}
                      className="field-input w-20 text-xs text-right"
                    />
                    <span className="text-xs text-muted">ms</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SCENE_TYPES = ['intro', 'main', 'outro'] as const;

export default function SceneEditor() {
  const { selectedScene, dispatch } = useBlueprint();
  const assetUrls = useAssetUrls();

  if (!selectedScene) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted text-sm">
        <span className="text-4xl mb-3">🎬</span>
        Select a scene from the left to start editing.
      </div>
    );
  }

  const scene = selectedScene;
  const sid = scene.id;

  const updateScene = (payload: Partial<Omit<Scene, 'layers' | 'audio'>>) =>
    dispatch({ type: 'UPDATE_SCENE', id: sid, payload });

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Scene identity */}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Scene ID</span>
          <input
            className="field-input"
            value={scene.id}
            onChange={e => updateScene({ id: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="field-label">Type</span>
          <select
            className="field-input"
            value={scene.type}
            onChange={e => updateScene({ type: e.target.value as typeof SCENE_TYPES[number] })}
          >
            {SCENE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <span className="field-label block">Duration</span>
        <div className="flex gap-2">
          <select
            className="field-input flex-1"
            value={scene.duration.mode}
            onChange={e => {
              const mode = e.target.value as 'auto' | 'audio' | 'fixed';
              dispatch({ type: 'SET_SCENE_DURATION', id: sid, duration: { mode, ms: mode === 'fixed' ? 3000 : undefined } });
            }}
          >
            <option value="auto">auto</option>
            <option value="audio">audio</option>
            <option value="fixed">fixed</option>
          </select>
          {scene.duration.mode === 'fixed' && (
            <input
              className="field-input w-32"
              type="number"
              min={500}
              step={500}
              placeholder="ms"
              value={scene.duration.ms ?? 3000}
              onChange={e => dispatch({ type: 'SET_SCENE_DURATION', id: sid, duration: { mode: 'fixed', ms: Number(e.target.value) } })}
            />
          )}
        </div>
      </div>

      {/* Effects */}
      <EffectsPicker
        effects={scene.effects ?? []}
        onChange={effects => updateScene({ effects })}
      />

      {/* Canvas Preview – realistic with actual images, video, and styled text */}
      <div className="space-y-2">
        <span className="field-label block">Canvas Preview</span>
        <CanvasPreview
          scene={scene}
          assetUrls={assetUrls}
          maxHeight={280}
          showBorders
        />
        {/* Scene audio preview: play TTS voice + BGM */}
        <SceneAudioPreview scene={scene} assetUrls={assetUrls} />
      </div>

      {/* Layers */}
      <LayerEditor sceneId={sid} />

      {/* Audio */}
      <AudioConfig sceneId={sid} />
    </div>
  );
}
