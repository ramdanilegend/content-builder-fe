'use client';

import { useEffect, useCallback } from 'react';
import { X, Film, Layers, Clock, ChevronRight } from 'lucide-react';
import { useBlueprint } from '@/context/BlueprintContext';
import { useAssetUrls } from '@/hooks/useAssetUrls';
import CanvasPreview from './CanvasPreview';

// ─── Scene type badge colours ──────────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  intro: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  main:  'bg-green-500/20 text-green-300 border border-green-500/30',
  outro: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AllScenesPreviewProps {
  onClose: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AllScenesPreview({ onClose }: AllScenesPreviewProps) {
  const { state, dispatch } = useBlueprint();
  const assetUrls = useAssetUrls();
  const { scenes, meta } = state.blueprint;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSelectScene = useCallback((id: string) => {
    dispatch({ type: 'SELECT_SCENE', id });
    onClose();
  }, [dispatch, onClose]);

  // Thumbnail height for the preview grid
  const thumbH = 160;

  // Duration display helper
  const durationLabel = (scene: typeof scenes[number]) => {
    if (scene.duration.mode === 'fixed') return `${(scene.duration.ms ?? 3000) / 1000}s`;
    if (scene.duration.mode === 'audio') return 'audio';
    return 'auto';
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal panel */}
      <div className="relative flex flex-col h-full max-h-screen bg-surface-1 m-4 rounded-2xl overflow-hidden border border-border shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <Film size={18} className="text-accent" />
            <div>
              <h2 className="text-sm font-bold text-white">{meta.title}</h2>
              <p className="text-xs text-muted mt-0.5">
                {scenes.length} scene{scenes.length !== 1 ? 's' : ''} · {meta.ratio} · {meta.resolution.width}×{meta.resolution.height} · {meta.fps}fps
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scene grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {scenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted gap-3">
              <Film size={40} className="opacity-30" />
              <p className="text-sm">No scenes yet. Add a scene to start.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-5 justify-start">
              {scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className={`
                    group flex flex-col gap-2 cursor-pointer
                    rounded-xl p-3 border transition-all duration-150
                    ${state.selectedSceneId === scene.id
                      ? 'border-accent/60 bg-accent/5'
                      : 'border-border bg-surface-2 hover:border-accent/30 hover:bg-surface-2/80'}
                  `}
                  onClick={() => handleSelectScene(scene.id)}
                  title={`Click to edit ${scene.id}`}
                >
                  {/* Scene number badge */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-mono text-muted">#{index + 1}</span>
                    {state.selectedSceneId === scene.id && (
                      <span className="text-[9px] text-accent font-medium">● editing</span>
                    )}
                  </div>

                  {/* Canvas thumbnail */}
                  <div className="relative">
                    <CanvasPreview
                      scene={scene}
                      assetUrls={assetUrls}
                      maxHeight={thumbH}
                      showBorders={false}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 rounded-lg bg-accent/0 group-hover:bg-accent/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-1 text-white text-xs font-medium bg-black/60 px-2 py-1 rounded-full">
                        Edit <ChevronRight size={12} />
                      </div>
                    </div>
                  </div>

                  {/* Scene info */}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-white truncate max-w-[8rem]" title={scene.id}>
                      {scene.id}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_BADGE[scene.type] || TYPE_BADGE.main}`}>
                        {scene.type}
                      </span>
                      <span className="flex items-center gap-0.5 text-[9px] text-muted">
                        <Clock size={8} /> {durationLabel(scene)}
                      </span>
                      <span className="flex items-center gap-0.5 text-[9px] text-muted">
                        <Layers size={8} /> {scene.layers.length}
                      </span>
                    </div>
                    {scene.audio.voice?.text && (
                      <p className="text-[9px] text-muted/70 truncate max-w-[8rem] italic" title={scene.audio.voice.text}>
                        "{scene.audio.voice.text}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-xs text-muted">Click a scene to open it in the editor</span>
          <span className="text-xs text-muted font-mono">ESC to close</span>
        </div>
      </div>
    </div>
  );
}
