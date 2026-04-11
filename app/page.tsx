'use client';

import { useState, useCallback, useRef } from 'react';
import { Layers, Settings, Database, Clapperboard, Save, FolderOpen } from 'lucide-react';
import { BlueprintProvider, useBlueprint, serializeBlueprint } from '@/context/BlueprintContext';
import type { Blueprint, AssetItem } from '@/types/blueprint';

import SceneList from '@/components/SceneList';
import SceneEditor from '@/components/SceneEditor';
import MetaPanel from '@/components/MetaPanel';
import DefaultsEditor from '@/components/DefaultsEditor';
import AssetManager from '@/components/AssetManager';
import JsonPreview from '@/components/JsonPreview';

// ─── ZIP Export ───────────────────────────────────────────────────────────────

async function exportZip(
  blueprint: ReturnType<typeof serializeBlueprint>,
  assetFiles: { path: string; file: File }[],
  title: string
) {
  const JSZip = (await import('jszip')).default;
  const fileSaver = await import('file-saver');
  const saveAs = fileSaver.saveAs ?? fileSaver.default?.saveAs;

  const zip = new JSZip();

  // blueprint.json
  zip.file('blueprint.json', JSON.stringify(blueprint, null, 2));

  // assets/ folder — already includes category subfolder in path
  for (const { path, file } of assetFiles) {
    zip.file(path, await file.arrayBuffer());
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'blueprint';
  saveAs(blob, `${slug}-blueprint.zip`);
}

// ─── Workspace Save ───────────────────────────────────────────────────────────

async function saveWorkspace(blueprint: Blueprint, assetFiles: { path: string; file: File }[], title: string) {
  const JSZip = (await import('jszip')).default;
  const fileSaver = await import('file-saver');
  const saveAs = fileSaver.saveAs ?? fileSaver.default?.saveAs;

  const zip = new JSZip();

  // Strip File objects from assets for serialization
  const state = {
    meta: blueprint.meta,
    defaults: blueprint.defaults,
    assets: {
      images: blueprint.assets.images.map(({ id, path, filename }) => ({ id, path, filename })),
      videos: blueprint.assets.videos.map(({ id, path, filename }) => ({ id, path, filename })),
      audio:  blueprint.assets.audio.map(({ id, path, filename })  => ({ id, path, filename })),
    },
    scenes: blueprint.scenes,
  };
  zip.file('workspace-state.json', JSON.stringify(state, null, 2));

  // Bundle asset files at their categorized paths
  for (const { path, file } of assetFiles) {
    zip.file(path, await file.arrayBuffer());
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
  saveAs(blob, `${slug}.workspace.zip`);
}

// ─── Workspace Load ───────────────────────────────────────────────────────────

async function loadWorkspace(
  file: File,
  dispatch: React.Dispatch<{ type: 'LOAD_BLUEPRINT'; blueprint: Blueprint }>
) {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);

  const stateFile = zip.file('workspace-state.json');
  if (!stateFile) throw new Error('Not a valid workspace file (workspace-state.json missing)');

  const stateJson = await stateFile.async('text');
  const state = JSON.parse(stateJson);

  const restoreAssets = async (items: Omit<AssetItem, 'file'>[]): Promise<AssetItem[]> =>
    Promise.all(items.map(async (item) => {
      const zipEntry = zip.file(item.path);
      if (zipEntry) {
        const blob = await zipEntry.async('blob');
        const restored = new File([blob], item.filename);
        return { ...item, file: restored };
      }
      return item;
    }));

  const blueprint: Blueprint = {
    ...state,
    assets: {
      images: await restoreAssets(state.assets.images),
      videos: await restoreAssets(state.assets.videos),
      audio:  await restoreAssets(state.assets.audio),
    },
  };

  dispatch({ type: 'LOAD_BLUEPRINT', blueprint });
}

// ─── Left sidebar tab types ───────────────────────────────────────────────────

type SideTab = 'meta' | 'defaults' | 'assets';

const SIDE_TABS: { key: SideTab; label: string; icon: React.ReactNode }[] = [
  { key: 'meta', label: 'Meta', icon: <Settings size={14} /> },
  { key: 'defaults', label: 'Defaults', icon: <Layers size={14} /> },
  { key: 'assets', label: 'Assets', icon: <Database size={14} /> },
];

// ─── Inner app (needs context) ─────────────────────────────────────────────────

function AppInner() {
  const { state, dispatch, getJson, getAllAssetFiles } = useBlueprint();
  const [sideTab, setSideTab] = useState<SideTab>('meta');
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadInputRef = useRef<HTMLInputElement>(null);

  const handleExportZip = useCallback(async () => {
    setExporting(true);
    try {
      const json = getJson();
      const files = getAllAssetFiles();
      await exportZip(json, files, state.blueprint.meta.title);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. Check console for details.');
    } finally {
      setExporting(false);
    }
  }, [getJson, getAllAssetFiles, state.blueprint.meta.title]);

  const handleSaveWorkspace = useCallback(async () => {
    setSaving(true);
    try {
      const files = getAllAssetFiles();
      await saveWorkspace(state.blueprint, files, state.blueprint.meta.title);
    } catch (err) {
      console.error('Save workspace failed', err);
      alert('Save workspace failed. Check console for details.');
    } finally {
      setSaving(false);
    }
  }, [getAllAssetFiles, state.blueprint]);

  const handleLoadWorkspace = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      await loadWorkspace(file, dispatch as React.Dispatch<{ type: 'LOAD_BLUEPRINT'; blueprint: Blueprint }>);
    } catch (err) {
      console.error('Load workspace failed', err);
      alert(`Load failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  }, [dispatch]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* ── LEFT: Config sidebar ─────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-surface-1">
        {/* App title + workspace actions */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Clapperboard size={16} className="text-accent" />
          <span className="text-sm font-bold tracking-tight flex-1">Video Builder</span>
          <button
            title="Save Workspace"
            onClick={handleSaveWorkspace}
            disabled={saving}
            className="btn-ghost p-1 disabled:opacity-50"
          >
            <Save size={13} />
          </button>
          <button
            title="Load Workspace"
            onClick={() => loadInputRef.current?.click()}
            disabled={loading}
            className="btn-ghost p-1 disabled:opacity-50"
          >
            <FolderOpen size={13} />
          </button>
          <input
            ref={loadInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleLoadWorkspace}
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {SIDE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSideTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs transition-colors ${
                sideTab === tab.key
                  ? 'text-white border-b-2 border-accent bg-accent/5'
                  : 'text-muted hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {sideTab === 'meta' && <MetaPanel />}
          {sideTab === 'defaults' && <DefaultsEditor />}
          {sideTab === 'assets' && <AssetManager />}
        </div>
      </aside>

      {/* ── CENTER: Scene list + editor ──────────────────────────────── */}
      <main className="flex flex-1 min-w-0 overflow-hidden">
        {/* Scene list */}
        <div className="w-52 shrink-0 border-r border-border bg-surface-1 flex flex-col">
          <SceneList />
        </div>

        {/* Scene editor */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5">
            {state.selectedSceneId ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Clapperboard size={15} className="text-accent" />
                  <h2 className="text-sm font-semibold">
                    Scene: <span className="text-accent font-mono">{state.selectedSceneId}</span>
                  </h2>
                </div>
                <SceneEditor />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted">
                <span className="text-5xl mb-4">🎬</span>
                <p className="text-sm">Select a scene or add a new one to start editing.</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── RIGHT: JSON preview ──────────────────────────────────────── */}
      <aside className="w-80 shrink-0 flex flex-col border-l border-border bg-surface-1">
        <JsonPreview
          onExportZip={handleExportZip}
          onSaveWorkspace={handleSaveWorkspace}
          onLoadWorkspace={() => loadInputRef.current?.click()}
          saving={saving}
          loading={loading}
        />
      </aside>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <BlueprintProvider>
      <AppInner />
    </BlueprintProvider>
  );
}
