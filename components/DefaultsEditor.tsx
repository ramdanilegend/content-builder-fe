'use client';

import { useBlueprint } from '@/context/BlueprintContext';
import type { AnchorType } from '@/types/blueprint';

const ANCHORS: AnchorType[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const VOICES = [
  'en-US-JennyNeural', 'en-US-GuyNeural', 'en-US-AriaNeural',
  'en-GB-SoniaNeural', 'en-GB-RyanNeural',
  'id-ID-GadisNeural', 'id-ID-ArdiNeural',
];

export default function DefaultsEditor() {
  const { state, dispatch } = useBlueprint();
  const { defaults } = state.blueprint;

  const set = (payload: Partial<typeof defaults>) => dispatch({ type: 'SET_DEFAULTS', payload });

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Defaults</h3>

      <label className="block">
        <span className="field-label">Default Duration (ms)</span>
        <input
          className="field-input"
          type="number"
          min={500}
          step={500}
          value={defaults.duration}
          onChange={e => set({ duration: Number(e.target.value) })}
        />
      </label>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 accent-accent rounded"
          checked={defaults.subtitle}
          onChange={e => set({ subtitle: e.target.checked })}
        />
        <span className="field-label mb-0">Enable Subtitles</span>
      </label>

      <label className="block">
        <span className="field-label">Default Voice</span>
        <select
          className="field-input"
          value={defaults.voice}
          onChange={e => set({ voice: e.target.value })}
        >
          {VOICES.map(v => <option key={v}>{v}</option>)}
        </select>
      </label>

      <div className="space-y-2">
        <span className="field-label block">Default Position</span>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-muted">X (%)</span>
            <input
              className="field-input"
              type="number" min={0} max={100}
              value={defaults.position.x}
              onChange={e => set({ position: { ...defaults.position, x: Number(e.target.value) } })}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Y (%)</span>
            <input
              className="field-input"
              type="number" min={0} max={100}
              value={defaults.position.y}
              onChange={e => set({ position: { ...defaults.position, y: Number(e.target.value) } })}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-muted">Anchor</span>
          <select
            className="field-input"
            value={defaults.position.anchor}
            onChange={e => set({ position: { ...defaults.position, anchor: e.target.value as AnchorType } })}
          >
            {ANCHORS.map(a => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
