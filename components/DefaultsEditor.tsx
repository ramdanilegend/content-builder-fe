'use client';

import { useBlueprint } from '@/context/BlueprintContext';
import type { AnchorType, SubtitleStyleConfig, SubtitlePositionConfig } from '@/types/blueprint';
import VoicePicker from './VoicePicker';

const ANCHORS: AnchorType[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

/** Font families supported by the backend renderer */
const FONT_FAMILIES = [
  // Sans-serif / Modern
  'Poppins', 'Open Sans', 'Roboto', 'Ubuntu', 'Cantarell', 'Noto Sans',
  'Nimbus Sans', 'Fira Sans', 'Source Sans 3', 'Raleway', 'Nunito',
  'Josefin Sans', 'Exo 2', 'Quicksand', 'Cabin',
  // Serif
  'Lora', 'DejaVu Serif', 'Liberation Serif', 'EB Garamond',
  // Monospace
  'DejaVu Mono', 'Liberation Mono', 'Inconsolata',
  // Display / Impact
  'Bebas Neue', 'Anton', 'Black Han Sans', 'Titan One',
  // System fallback
  'DejaVu Sans',
];

export default function DefaultsEditor() {
  const { state, dispatch } = useBlueprint();
  const { defaults } = state.blueprint;

  const set = (payload: Partial<typeof defaults>) => dispatch({ type: 'SET_DEFAULTS', payload });

  // Safe fallbacks for blueprints that predate the subtitle style fields
  const subtitleStyle: SubtitleStyleConfig = defaults.subtitleStyle ?? {
    font_size: 52, color: '#FFFFFF', stroke_color: '#000000', stroke_width: 3,
    font_weight: 'bold', font_family: 'Poppins', max_width_pct: 85,
  };
  const subtitlePosition: SubtitlePositionConfig = defaults.subtitlePosition ?? {
    x: 50, y: 83, anchor: 'bottom-center' as AnchorType,
  };
  const subtitleGranularity = defaults.subtitleGranularity ?? 'sentence';

  const setSStyle = (patch: Partial<SubtitleStyleConfig>) =>
    set({ subtitleStyle: { ...subtitleStyle, ...patch } });

  const setSPos = (patch: Partial<SubtitlePositionConfig>) =>
    set({ subtitlePosition: { ...subtitlePosition, ...patch } });

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

      {/* ── Subtitle Style ───────────────────────────────────── */}
      {defaults.subtitle && (
        <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-3">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider block">Subtitle Style</span>

          {/* Granularity */}
          <label className="block">
            <span className="text-xs text-muted">Mode</span>
            <select
              className="field-input mt-1"
              value={subtitleGranularity}
              onChange={e => set({ subtitleGranularity: e.target.value as 'sentence' | 'word' })}
            >
              <option value="sentence">Sentence (static per scene)</option>
              <option value="word">Word-by-word (karaoke)</option>
            </select>
          </label>

          {/* Font family */}
          <label className="block">
            <span className="text-xs text-muted">Font Family</span>
            <select
              className="field-input mt-1"
              value={subtitleStyle.font_family ?? 'Poppins'}
              onChange={e => setSStyle({ font_family: e.target.value })}
            >
              {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>

          {/* Font weight */}
          <label className="block">
            <span className="text-xs text-muted">Font Weight</span>
            <select
              className="field-input mt-1"
              value={subtitleStyle.font_weight ?? 'bold'}
              onChange={e => setSStyle({ font_weight: e.target.value as 'normal' | 'bold' })}
            >
              <option value="bold">Bold</option>
              <option value="normal">Normal</option>
            </select>
          </label>

          {/* Font size */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-muted">Font Size</span>
              <span className="text-xs text-accent font-mono">{subtitleStyle.font_size}px</span>
            </div>
            <input
              type="range" min={18} max={120} step={2}
              value={subtitleStyle.font_size}
              onChange={e => setSStyle({ font_size: Number(e.target.value) })}
              className="w-full accent-accent h-1.5 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted"><span>18px</span><span>120px</span></div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted">Text Color</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={subtitleStyle.color}
                  onChange={e => setSStyle({ color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono text-muted">{subtitleStyle.color}</span>
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Stroke Color</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={subtitleStyle.stroke_color}
                  onChange={e => setSStyle({ stroke_color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs font-mono text-muted">{subtitleStyle.stroke_color}</span>
              </div>
            </label>
          </div>

          {/* Stroke width */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-muted">Stroke Width</span>
              <span className="text-xs text-accent font-mono">{subtitleStyle.stroke_width}px</span>
            </div>
            <input
              type="range" min={0} max={12} step={1}
              value={subtitleStyle.stroke_width}
              onChange={e => setSStyle({ stroke_width: Number(e.target.value) })}
              className="w-full accent-accent h-1.5 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted"><span>0</span><span>12px</span></div>
          </div>

          {/* Max width */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-muted">Max Width</span>
              <span className="text-xs text-accent font-mono">{subtitleStyle.max_width_pct}%</span>
            </div>
            <input
              type="range" min={30} max={100} step={5}
              value={subtitleStyle.max_width_pct}
              onChange={e => setSStyle({ max_width_pct: Number(e.target.value) })}
              className="w-full accent-accent h-1.5 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted"><span>30%</span><span>100%</span></div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <span className="text-xs text-muted block">Position</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-muted">X (%)</span>
                <input
                  type="number" min={0} max={100}
                  className="field-input"
                  value={subtitlePosition.x}
                  onChange={e => setSPos({ x: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                <span className="text-xs text-muted">Y (%)</span>
                <input
                  type="number" min={0} max={100}
                  className="field-input"
                  value={subtitlePosition.y}
                  onChange={e => setSPos({ y: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-muted">Anchor</span>
              <select
                className="field-input"
                value={subtitlePosition.anchor}
                onChange={e => setSPos({ anchor: e.target.value as AnchorType })}
              >
                {ANCHORS.map(a => <option key={a}>{a}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      <label className="block">
        <span className="field-label">Default Voice</span>
        <div className="mt-1">
          <VoicePicker value={defaults.voice} onChange={v => set({ voice: v })} />
        </div>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="field-label mb-0">Speed</span>
            <span className="text-xs text-accent font-mono">{defaults.speed.toFixed(2)}x</span>
          </div>
          <input
            type="range" min={0.5} max={2.0} step={0.05}
            value={defaults.speed}
            onChange={e => set({ speed: Number(e.target.value) })}
            className="w-full accent-accent h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span>0.5x</span><span>2.0x</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="field-label mb-0">Pitch</span>
            <span className="text-xs text-accent font-mono">{defaults.pitch.toFixed(2)}x</span>
          </div>
          <input
            type="range" min={0.5} max={2.0} step={0.05}
            value={defaults.pitch}
            onChange={e => set({ pitch: Number(e.target.value) })}
            className="w-full accent-accent h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-muted">
            <span>0.5x</span><span>2.0x</span>
          </div>
        </div>
      </div>

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
