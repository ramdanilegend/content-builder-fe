'use client';

import { ChevronUp, ChevronDown, Trash2, Plus, Type, ImageIcon, Film } from 'lucide-react';
import { useBlueprint } from '@/context/BlueprintContext';
import type { Layer, AnchorType, Assets } from '@/types/blueprint';

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

function Slider({ label, value, onChange, min = 0, max = 100 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted">
        <span>{label}</span><span>{value}%</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent h-1.5 cursor-pointer"
      />
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
              <label className="block">
                <span className="field-label">Style (CSS)</span>
                <input
                  className="field-input font-mono text-xs"
                  value={layer.style ?? ''}
                  onChange={e => onUpdate({ style: e.target.value })}
                  placeholder="font-size: 48px; color: white; font-weight: bold;"
                />
              </label>
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
