'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Plus, Trash2, Film, LayoutGrid } from 'lucide-react';
import { useBlueprint } from '@/context/BlueprintContext';
import AllScenesPreview from './AllScenesPreview';

const TYPE_BADGE: Record<string, string> = {
  intro: 'bg-blue-500/20 text-blue-300',
  main:  'bg-green-500/20 text-green-300',
  outro: 'bg-purple-500/20 text-purple-300',
};

export default function SceneList() {
  const { state, dispatch } = useBlueprint();
  const { scenes } = state.blueprint;
  const { selectedSceneId } = state;
  const [showAllPreview, setShowAllPreview] = useState(false);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted flex items-center gap-1.5">
            <Film size={13} /> Scenes
          </span>
          <div className="flex items-center gap-1">
            {/* Preview All button */}
            <button
              className="btn-ghost text-xs flex items-center gap-1 px-1.5"
              onClick={() => setShowAllPreview(true)}
              title="Preview all scenes"
              disabled={scenes.length === 0}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              className="btn-ghost text-xs flex items-center gap-1"
              onClick={() => dispatch({ type: 'ADD_SCENE' })}
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {scenes.length === 0 && (
            <div className="text-center py-8 text-xs text-muted italic">
              No scenes yet.<br />Click + Add to start.
            </div>
          )}

          {scenes.map((scene, i) => (
            <div
              key={scene.id}
              onClick={() => dispatch({ type: 'SELECT_SCENE', id: scene.id })}
              className={`group relative rounded-lg px-3 py-2.5 cursor-pointer transition-all border ${
                selectedSceneId === scene.id
                  ? 'bg-accent/10 border-accent/50 text-white'
                  : 'bg-surface-2 border-transparent hover:border-border text-muted hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-muted shrink-0">{i + 1}</span>
                  <span className="text-sm font-medium truncate">{scene.id}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-0.5 hover:text-white"
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'MOVE_SCENE', id: scene.id, direction: 'up' }); }}
                  ><ChevronUp size={13} /></button>
                  <button
                    className="p-0.5 hover:text-white"
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'MOVE_SCENE', id: scene.id, direction: 'down' }); }}
                  ><ChevronDown size={13} /></button>
                  <button
                    className="p-0.5 hover:text-red-400"
                    onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_SCENE', id: scene.id }); }}
                  ><Trash2 size={13} /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[scene.type]}`}>
                  {scene.type}
                </span>
                <span className="text-xs text-muted">
                  {scene.duration.mode === 'fixed' ? `${scene.duration.ms ?? 3000}ms` : scene.duration.mode}
                </span>
                <span className="text-xs text-muted ml-auto">
                  {scene.layers.length} layer{scene.layers.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Preview all footer button (only when scenes exist) */}
        {scenes.length > 0 && (
          <div className="px-3 py-2 border-t border-border">
            <button
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted hover:text-white btn-ghost py-1.5 rounded-lg transition-colors"
              onClick={() => setShowAllPreview(true)}
            >
              <LayoutGrid size={12} />
              Preview All {scenes.length} Scene{scenes.length !== 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>

      {/* All Scenes Preview modal */}
      {showAllPreview && (
        <AllScenesPreview onClose={() => setShowAllPreview(false)} />
      )}
    </>
  );
}
