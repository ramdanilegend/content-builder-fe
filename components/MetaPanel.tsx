'use client';

import { useBlueprint } from '@/context/BlueprintContext';
import type { AspectRatio, Meta } from '@/types/blueprint';

const RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:3'];
const RESOLUTIONS: Record<AspectRatio, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:3': { width: 1440, height: 1080 },
};

export default function MetaPanel() {
  const { state, dispatch } = useBlueprint();
  const { meta } = state.blueprint;

  const set = (payload: Partial<Meta>) =>
    dispatch({ type: 'SET_META', payload });

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Video Meta</h3>

      <label className="block">
        <span className="field-label">Title</span>
        <input
          className="field-input"
          value={meta.title}
          onChange={e => set({ title: e.target.value })}
          placeholder="My Awesome Video"
        />
      </label>

      <label className="block">
        <span className="field-label">Aspect Ratio</span>
        <select
          className="field-input"
          value={meta.ratio}
          onChange={e => {
            const ratio = e.target.value as AspectRatio;
            set({ ratio, resolution: RESOLUTIONS[ratio] });
          }}
        >
          {RATIOS.map(r => <option key={r}>{r}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="field-label">FPS</span>
        <select
          className="field-input"
          value={meta.fps}
          onChange={e => set({ fps: Number(e.target.value) })}
        >
          {[24, 25, 30, 60].map(f => <option key={f}>{f}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Width (px)</span>
          <input
            className="field-input"
            type="number"
            value={meta.resolution.width}
            onChange={e => set({ resolution: { ...meta.resolution, width: Number(e.target.value) } })}
          />
        </label>
        <label className="block">
          <span className="field-label">Height (px)</span>
          <input
            className="field-input"
            type="number"
            value={meta.resolution.height}
            onChange={e => set({ resolution: { ...meta.resolution, height: Number(e.target.value) } })}
          />
        </label>
      </div>
    </div>
  );
}
