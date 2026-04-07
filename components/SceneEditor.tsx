'use client';

import { useBlueprint } from '@/context/BlueprintContext';
import type { Scene } from '@/types/blueprint';
import LayerEditor from './LayerEditor';
import AudioConfig from './AudioConfig';
import CanvasPreview from './CanvasPreview';

const SCENE_TYPES = ['intro', 'main', 'outro'] as const;

export default function SceneEditor() {
  const { selectedScene, dispatch } = useBlueprint();

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
      <label className="block">
        <span className="field-label">Effects (comma-separated)</span>
        <input
          className="field-input font-mono text-xs"
          value={(scene.effects ?? []).join(', ')}
          onChange={e => {
            const effects = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
            updateScene({ effects });
          }}
          placeholder="fade, blur, vignette"
        />
      </label>

      {/* Canvas Preview */}
      <div className="space-y-2">
        <span className="field-label block">Canvas Preview</span>
        <CanvasPreview scene={scene} />
      </div>

      {/* Layers */}
      <LayerEditor sceneId={sid} />

      {/* Audio */}
      <AudioConfig sceneId={sid} />
    </div>
  );
}
