'use client';

import { useState, useCallback } from 'react';
import { Layers, Settings, Database, Clapperboard } from 'lucide-react';
import { BlueprintProvider, useBlueprint, serializeBlueprint } from '@/context/BlueprintContext';

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
  const { saveAs } = await import('file-saver');

  const zip = new JSZip();

  // blueprint.json
  zip.file('blueprint.json', JSON.stringify(blueprint, null, 2));

  // assets/ folder
  for (const { path, file } of assetFiles) {
    // path is like "assets/filename.ext"
    const arrayBuffer = await file.arrayBuffer();
    zip.file(path, arrayBuffer);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'blueprint';
  saveAs(blob, `${slug}-blueprint.zip`);
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

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* ── LEFT: Config sidebar ─────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-surface-1">
        {/* App title */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Clapperboard size={16} className="text-accent" />
          <span className="text-sm font-bold tracking-tight">Video Builder</span>
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
        <JsonPreview onExportZip={handleExportZip} />
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
