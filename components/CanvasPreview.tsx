'use client';

import { useBlueprint } from '@/context/BlueprintContext';
import type { Scene, Layer } from '@/types/blueprint';

const LAYER_BG: Record<Layer['type'], string> = {
  text: 'bg-yellow-500/10 border border-yellow-500/30',
  image: 'bg-blue-500/10 border border-blue-500/30',
  video: 'bg-green-500/10 border border-green-500/30',
};

const ANCHOR_TRANSFORM: Record<string, string> = {
  'top-left': 'translate(0%, 0%)',
  'top-center': 'translate(-50%, 0%)',
  'top-right': 'translate(-100%, 0%)',
  'center-left': 'translate(0%, -50%)',
  'center': 'translate(-50%, -50%)',
  'center-right': 'translate(-100%, -50%)',
  'bottom-left': 'translate(0%, -100%)',
  'bottom-center': 'translate(-50%, -100%)',
  'bottom-right': 'translate(-100%, -100%)',
};

export default function CanvasPreview({ scene }: { scene: Scene }) {
  const { state } = useBlueprint();
  const { meta } = state.blueprint;

  // Calculate display ratio
  const isPortrait = meta.ratio === '9:16';
  const isSquare = meta.ratio === '1:1';
  const containerH = isPortrait ? 280 : isSquare ? 200 : 160;
  const containerW = isPortrait ? 157 : isSquare ? 200 : 284;

  const sortedLayers = [...scene.layers].sort((a, b) => a.z_index - b.z_index);

  return (
    <div
      className="relative bg-black rounded-lg overflow-hidden mx-auto border border-border"
      style={{ width: containerW, height: containerH }}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '25% 25%',
        }}
      />

      {/* Center crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-px h-full bg-white opacity-5" />
        <div className="h-px w-full bg-white opacity-5 absolute" />
      </div>

      {/* Layers */}
      {sortedLayers.map(layer => {
        const transform = ANCHOR_TRANSFORM[layer.position.anchor] || 'translate(-50%, -50%)';
        const width = layer.size?.width ?? 30;

        return (
          <div
            key={layer._id}
            className={`absolute rounded text-xs px-1.5 py-1 truncate max-w-[90%] ${LAYER_BG[layer.type]}`}
            style={{
              left: `${layer.position.x}%`,
              top: `${layer.position.y}%`,
              transform,
              zIndex: layer.z_index,
              width: `${Math.min(width, 95)}%`,
            }}
          >
            {layer.type === 'text'
              ? <span className="text-yellow-300 font-medium">{layer.content?.slice(0, 40) || 'Text'}</span>
              : <span className={layer.type === 'image' ? 'text-blue-300' : 'text-green-300'}>
                  [{layer.type}] {layer.src || 'no asset'}
                </span>
            }
          </div>
        );
      })}

      {sortedLayers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-muted">No layers</span>
        </div>
      )}

      {/* Label */}
      <div className="absolute bottom-1 right-1.5 text-[9px] text-muted font-mono opacity-60">
        {meta.ratio} · {scene.id}
      </div>
    </div>
  );
}
