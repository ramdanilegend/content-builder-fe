'use client';

import { ChevronUp, ChevronDown, Trash2, Plus, Type, ImageIcon, Film } from 'lucide-react';
import { useBlueprint } from '@/context/BlueprintContext';
import type { Layer, AnchorType, Assets, LayerStyleObject } from '@/types/blueprint';

const ANCHORS: AnchorType[] = [
  'top-left', 'top-center', 'top-right',
  'center-left', 'center', 'center-right',
  'bottom-left', 'bottom-center', 'bottom-right',
];

const LAYER_ICON: Record<Layer['type'], React.ReactNode> = {
  text: <Type size={12} />,
  image: <ImageIcon size={12} />,
  video: <Film size={12} />,
};

const LAYER_COLOR: Record<Layer['type'], string> = {
  text: 'text-yellow-400',
  image: 'text-blue-400',
  video: 'text-green-400',
};

function Slider({ label, value, onChange, min = 0, max = 100, unit = '%' }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span><span>{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent h-1.5 cursor-pointer"
      />
    </div>
  );
}

// ── style helpers ─────────────────────────────────────────────────────────────

const PRESETS = [
  { value: 'title_center',  label: 'title_center',  desc: 'White 72px bold, black outline' },
  { value: 'cta_center',    label: 'cta_center',    desc: 'Gold 64px bold, black outline' },
  { value: 'subtitle',      label: 'subtitle',      desc: 'White 48px, medium outline' },
  { value: 'body',          label: 'body',          desc: 'White 44px, thin outline' },
];

function getStyleObj(layer: Layer): LayerStyleObject {
  if (typeof layer.style === 'object' && layer.style !== null) return layer.style as LayerStyleObject;
  return {};
}

function isCustomStyle(layer: Layer): boolean {
  return typeof layer.style !== 'string';
}

function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1 flex-1">
      <span className="text-xs text-muted block">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer border border-border bg-transparent p-0.5 shrink-0"
        />
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#ffffff"
          maxLength={7}
          className="field-input font-mono text-xs"
        />
      </div>
    </div>
  );
}

interface LayerItemProps {
  layer: Layer;
  sceneId: string;
  isSelected: boolean;
  assets: Assets;
  onSelect: () => void;
  onUpdate: (payload: Partial<Layer>) => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
}

function LayerItem({ layer, sceneId, isSelected, assets, onSelect, onUpdate, onRemove, onMove }: LayerItemProps) {
  const allMedia = [...assets.images, ...assets.videos];
  const audioAssets = assets.audio;

  return (
    <div className={`rounded-lg border transition-all ${isSelected ? 'border-accent/60 bg-accent/5' : 'border-border bg-surface-2'}`}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={onSelect}
      >
        <span className={`shrink-0 ${LAYER_COLOR[layer.type]}`}>{LAYER_ICON[layer.type]}</span>
        <span className="text-xs font-medium flex-1 truncate">
          {layer.type === 'text' ? (layer.content?.slice(0, 30) || 'Text layer') : (layer.src || `${layer.type} layer`)}
        </span>
        <span className="text-xs text-muted">z:{layer.z_index}</span>
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button className="p-0.5 text-muted hover:text-white" onClick={() => onMove('up')}><ChevronUp size={12} /></button>
          <button className="p-0.5 text-muted hover:text-white" onClick={() => onMove('down')}><ChevronDown size={12} /></button>
          <button className="p-0.5 text-muted hover:text-red-400" onClick={onRemove}><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Editor (expanded when selected) */}
      {isSelected && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          {/* Text-specific */}
          {layer.type === 'text' && (
            <>
              <label className="block">
                <span className="field-label">Content</span>
                <textarea
                  className="field-input resize-none"
                  rows={3}
                  value={layer.content ?? ''}
                  onChange={e => onUpdate({ content: e.target.value })}
                  placeholder="Enter text content..."
                />
              </label>

              {/* ── Style Preset ── */}
              <label className="block">
                <span className="field-label">Style Preset</span>
                <select
                  className="field-input"
                  value={typeof layer.style === 'string' ? layer.style : '__custom__'}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__custom__') onUpdate({ style: {} });
                    else onUpdate({ style: val });
                  }}
                >
                  <option value="__custom__">Custom (manual settings below)</option>
                  {PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>
                  ))}
                </select>
              </label>

              {/* ── Custom style controls (shown when not using a preset) ── */}
              {isCustomStyle(layer) && (() => {
                const s = getStyleObj(layer);
                const update = (patch: Partial<LayerStyleObject>) =>
                  onUpdate({ style: { ...s, ...patch } });
                return (
                  <div className="space-y-3 border-l-2 border-accent/20 pl-3">

                    {/* Font family */}
                    <label className="block">
                      <span className="text-xs text-muted">Font Family</span>
                      <select
                        className="field-input mt-1"
                        value={s.font_family ?? ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (val) update({ font_family: val });
                          else { const { font_family: _, ...rest } = s; onUpdate({ style: rest }); }
                        }}
                      >
                        <option value="">─ Default (DejaVu Sans Bold) ─</option>
                        <optgroup label="Sans-Serif / Modern">
                          <option value="Poppins">Poppins — geometric, YouTube titles</option>
                          <option value="Open Sans">Open Sans — humanist, news &amp; docs</option>
                          <option value="Roboto">Roboto — Google standard, clean UI</option>
                          <option value="Ubuntu">Ubuntu — modern, strong title cards</option>
                          <option value="Cantarell">Cantarell — rounded, approachable</option>
                          <option value="Noto Sans">Noto Sans — international coverage</option>
                          <option value="Nimbus Sans">Nimbus Sans — Helvetica-style, broadcast</option>
                          <option value="DejaVu Sans">DejaVu Sans — versatile, wide support</option>
                          <option value="Liberation Sans">Liberation Sans — Arial substitute</option>
                          <option value="Arimo">Arimo — ultra-clean, Chrome OS</option>
                          <option value="Carlito">Carlito — Calibri-style, webinars</option>
                          <option value="FreeSans">FreeSans — general purpose</option>
                        </optgroup>
                        <optgroup label="Condensed / Impact Style">
                          <option value="DejaVu Sans Condensed">DejaVu Sans Condensed — action titles</option>
                          <option value="Liberation Sans Narrow">Liberation Sans Narrow — info-dense</option>
                          <option value="Nimbus Sans Narrow">Nimbus Sans Narrow — Impact-style</option>
                        </optgroup>
                        <optgroup label="Serif / Editorial / Cinematic">
                          <option value="Lora">Lora — documentary, cinematic titles</option>
                          <option value="DejaVu Serif">DejaVu Serif — editorial content</option>
                          <option value="Liberation Serif">Liberation Serif — news, formal</option>
                          <option value="Tinos">Tinos — Times New Roman, journalism</option>
                          <option value="Caladea">Caladea — Cambria-style, elegant</option>
                          <option value="EB Garamond">EB Garamond — film credits, classical</option>
                          <option value="Vollkorn">Vollkorn — scholarly, cinematic</option>
                          <option value="Linux Libertine">Linux Libertine — art-house, literary</option>
                          <option value="Nimbus Roman">Nimbus Roman — formal productions</option>
                          <option value="FreeSerif">FreeSerif — wide Unicode coverage</option>
                          <option value="URW Bookman">URW Bookman — warm editorial serif</option>
                          <option value="URW Gothic">URW Gothic — Avant Garde display</option>
                        </optgroup>
                        <optgroup label="Monospace / Techy">
                          <option value="Inconsolata">Inconsolata — programmer aesthetic</option>
                          <option value="Hack">Hack — hacker / cyber overlay style</option>
                          <option value="DejaVu Mono">DejaVu Mono — code lower-thirds</option>
                          <option value="Liberation Mono">Liberation Mono — terminal graphics</option>
                          <option value="FreeMono">FreeMono — typewriter style</option>
                          <option value="Nimbus Mono">Nimbus Mono — clean typewriter</option>
                        </optgroup>
                        <optgroup label="Decorative / Special">
                          <option value="Jura">Jura — sci-fi, gaming, futuristic</option>
                          <option value="M Plus">M Plus — Japanese-influenced, unique</option>
                          <option value="Linux Biolinum">Linux Biolinum — humanist display</option>
                        </optgroup>
                      </select>
                    </label>

                    {/* Font size */}
                    <label className="block">
                      <span className="text-xs text-muted">Font Size (px)</span>
                      <input
                        type="number"
                        min={12} max={300} step={2}
                        value={s.font_size ?? 52}
                        onChange={e => update({ font_size: Number(e.target.value) })}
                        className="field-input mt-1"
                      />
                    </label>

                    {/* Colors */}
                    <div className="flex gap-3">
                      <ColorField
                        label="Text Color"
                        value={s.color ?? '#ffffff'}
                        onChange={v => update({ color: v })}
                      />
                      <ColorField
                        label="Stroke Color"
                        value={s.stroke_color ?? '#000000'}
                        onChange={v => update({ stroke_color: v })}
                      />
                    </div>

                    {/* Stroke width */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted">
                        <span>Stroke Width</span>
                        <span>{s.stroke_width ?? 3}px</span>
                      </div>
                      <input
                        type="range" min={0} max={12} step={1}
                        value={s.stroke_width ?? 3}
                        onChange={e => update({ stroke_width: Number(e.target.value) })}
                        className="w-full accent-accent h-1.5 cursor-pointer"
                      />
                    </div>

                    {/* Max width */}
                    <Slider
                      label="Max Width"
                      min={20} max={100}
                      value={s.max_width_pct ?? 80}
                      onChange={v => update({ max_width_pct: v })}
                    />

                    {/* Text align */}
                    <label className="block">
                      <span className="text-xs text-muted">Text Align</span>
                      <select
                        className="field-input mt-1"
                        value={s.text_align ?? 'center'}
                        onChange={e => update({ text_align: e.target.value as 'left' | 'center' | 'right' })}
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </label>

                    {/* Italic toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-accent"
                        checked={s.italic ?? false}
                        onChange={e => update({ italic: e.target.checked })}
                      />
                      <span className="text-xs text-muted">Italic</span>
                      {s.italic && (
                        <span className="text-xs text-accent/70 italic">
                          (uses italic font variant)
                        </span>
                      )}
                    </label>

                  </div>
                );
              })()}
            </>
          )}

          {/* Media-specific */}
          {(layer.type === 'image' || layer.type === 'video') && (
            <label className="block">
              <span className="field-label">Asset Reference</span>
              <select
                className="field-input"
                value={layer.src ?? ''}
                onChange={e => onUpdate({ src: e.target.value || undefined })}
              >
                <option value="">— select asset —</option>
                {allMedia.map(a => (
                  <option key={a.id} value={a.id}>{a.id} ({a.filename})</option>
                ))}
              </select>
            </label>
          )}

          {layer.type === 'video' && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent"
                checked={layer.loop ?? false}
                onChange={e => onUpdate({ loop: e.target.checked })}
              />
              <span className="field-label mb-0">Loop video</span>
            </label>
          )}

          {/* Position */}
          <div className="space-y-2">
            <span className="field-label block">Position</span>
            <Slider label="X (%)" value={layer.position.x} onChange={v => onUpdate({ position: { ...layer.position, x: v } })} />
            <Slider label="Y (%)" value={layer.position.y} onChange={v => onUpdate({ position: { ...layer.position, y: v } })} />
            <label className="block">
              <span className="text-xs text-muted">Anchor</span>
              <select
                className="field-input mt-1"
                value={layer.position.anchor}
                onChange={e => onUpdate({ position: { ...layer.position, anchor: e.target.value as AnchorType } })}
              >
                {ANCHORS.map(a => <option key={a}>{a}</option>)}
              </select>
            </label>
          </div>

          {/* Size */}
          <Slider
            label="Width (%)"
            value={layer.size?.width ?? 100}
            onChange={v => onUpdate({ size: { width: v } })}
          />

          {/* Z-index */}
          <label className="block">
            <span className="field-label">Z-Index</span>
            <input
              className="field-input"
              type="number"
              value={layer.z_index}
              onChange={e => onUpdate({ z_index: Number(e.target.value) })}
            />
          </label>

          {/* Animation */}
          <div className="space-y-2">
            <span className="field-label block">Animation (optional)</span>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-muted">Type</span>
                <select
                  className="field-input mt-1"
                  value={layer.animation?.type ?? ''}
                  onChange={e => {
                    if (!e.target.value) onUpdate({ animation: undefined });
                    else onUpdate({ animation: { type: e.target.value, duration: layer.animation?.duration ?? 500 } });
                  }}
                >
                  <option value="">None</option>
                  {['fade-in', 'fade-out', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom-in', 'zoom-out'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-muted">Duration (ms)</span>
                <input
                  className="field-input mt-1"
                  type="number"
                  min={100}
                  step={100}
                  value={layer.animation?.duration ?? 500}
                  disabled={!layer.animation}
                  onChange={e => onUpdate({ animation: { ...layer.animation!, duration: Number(e.target.value) } })}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LayerEditor({ sceneId }: { sceneId: string }) {
  const { state, dispatch, selectedScene, selectedLayer } = useBlueprint();
  const { assets } = state.blueprint;

  if (!selectedScene) return null;

  const addLayer = (type: Layer['type']) => dispatch({ type: 'ADD_LAYER', sceneId, layerType: type });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="field-label">Layers</span>
        <div className="flex items-center gap-1">
          {(['text', 'image', 'video'] as Layer['type'][]).map(t => (
            <button
              key={t}
              className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
              onClick={() => addLayer(t)}
              title={`Add ${t} layer`}
            >
              <Plus size={11} />
              <span className={LAYER_COLOR[t]}>{LAYER_ICON[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedScene.layers.length === 0 && (
        <p className="text-xs text-muted italic text-center py-4 border border-dashed border-border rounded-lg">
          No layers. Add text, image, or video layers above.
        </p>
      )}

      <div className="space-y-2">
        {selectedScene.layers.map(layer => (
          <LayerItem
            key={layer._id}
            layer={layer}
            sceneId={sceneId}
            isSelected={state.selectedLayerId === layer._id}
            assets={assets}
            onSelect={() => dispatch({ type: 'SELECT_LAYER', id: layer._id })}
            onUpdate={payload => dispatch({ type: 'UPDATE_LAYER', sceneId, layerId: layer._id, payload })}
            onRemove={() => dispatch({ type: 'REMOVE_LAYER', sceneId, layerId: layer._id })}
            onMove={dir => dispatch({ type: 'MOVE_LAYER', sceneId, layerId: layer._id, direction: dir })}
          />
        ))}
      </div>
    </div>
  );
}
