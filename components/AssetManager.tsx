'use client';

import { useRef } from 'react';
import { Trash2, Upload, ImageIcon, Film, Music } from 'lucide-react';
import { useBlueprint } from '@/context/BlueprintContext';
import { uid } from '@/context/BlueprintContext';
import type { Assets, AssetItem } from '@/types/blueprint';

type AssetType = keyof Assets;

const SECTIONS: { key: AssetType; label: string; accept: string; icon: React.ReactNode }[] = [
  { key: 'images', label: 'Images', accept: 'image/*', icon: <ImageIcon size={14} /> },
  { key: 'videos', label: 'Videos', accept: 'video/*', icon: <Film size={14} /> },
  { key: 'audio',  label: 'Audio',  accept: 'audio/*', icon: <Music size={14} /> },
];

function AssetSection({
  label, icon, accept, items, onAdd, onRemove,
}: {
  label: string;
  icon: React.ReactNode;
  accept: string;
  items: AssetItem[];
  onAdd: (item: AssetItem) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(file => {
      const ext = file.name.split('.').pop() ?? '';
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      const id = `${base}_${uid().slice(-4)}`;
      const path = `assets/${file.name}`;
      onAdd({ id, path, filename: file.name, file });
    });
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider">
          {icon} {label}
        </span>
        <button
          className="btn-ghost text-xs flex items-center gap-1"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={12} /> Upload
        </button>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handleFiles} />
      </div>

      {items.length === 0 && (
        <p className="text-xs text-muted italic px-2 py-3 border border-dashed border-border rounded-lg text-center">
          No {label.toLowerCase()} yet. Click Upload to add.
        </p>
      )}

      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2 bg-surface-2 rounded-lg px-3 py-2 group">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-accent truncate">{item.id}</p>
              <p className="text-xs text-muted truncate">{item.path}</p>
            </div>
            <button
              className="text-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 mt-0.5"
              onClick={() => onRemove(item.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AssetManager() {
  const { state, dispatch } = useBlueprint();
  const { assets } = state.blueprint;

  return (
    <div className="space-y-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">Asset Manager</h3>
      <p className="text-xs text-muted -mt-2">
        Upload files here. They will be placed in <code className="text-accent">assets/</code> inside the exported ZIP.
        Use the <span className="text-accent font-mono">id</span> to reference assets in layers.
      </p>

      {SECTIONS.map(({ key, label, accept, icon }) => (
        <AssetSection
          key={key}
          label={label}
          icon={icon}
          accept={accept}
          items={assets[key]}
          onAdd={item => dispatch({ type: 'ADD_ASSET', assetType: key, item })}
          onRemove={id => dispatch({ type: 'REMOVE_ASSET', assetType: key, id })}
        />
      ))}
    </div>
  );
}
