'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Layers, Settings, Database, Clapperboard, Save, FolderOpen,
  Undo2, Redo2, Play, Pause, SkipBack, ChevronDown, ChevronRight as ChevronRightIcon,
  Download, Zap,
} from 'lucide-react';
import {
  BlueprintProvider, useBlueprint,
  serializeBlueprint, deserializeBlueprint,
} from '@/context/BlueprintContext';
import type { Blueprint, AssetItem } from '@/types/blueprint';
import type { GenerateStatus } from '@/components/GeneratePanel';
import { useAssetUrls } from '@/hooks/useAssetUrls';
import { usePlayback } from '@/hooks/usePlayback';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';
import { useTTSCache } from '@/hooks/useTTSCache';

import SceneList    from '@/components/SceneList';
import SceneEditor  from '@/components/SceneEditor';
import MetaPanel    from '@/components/MetaPanel';
import DefaultsEditor from '@/components/DefaultsEditor';
import AssetManager from '@/components/AssetManager';
import JsonPreview  from '@/components/JsonPreview';
import TimelineEditor from '@/components/timeline/TimelineEditor';
import InteractivePreview from '@/components/InteractivePreview';

// ─── ZIP / Workspace helpers (unchanged) ─────────────────────────────────────

async function exportZip(
  blueprint: ReturnType<typeof serializeBlueprint>,
  assetFiles: { path: string; file: File }[],
  title: string
) {
  const JSZip    = (await import('jszip')).default;
  const fileSaver = await import('file-saver');
  const saveAs   = fileSaver.saveAs ?? fileSaver.default?.saveAs;
  const zip      = new JSZip();
  zip.file('blueprint.json', JSON.stringify(blueprint, null, 2));
  for (const { path, file } of assetFiles) zip.file(path, await file.arrayBuffer());
  const blob = await zip.generateAsync({ type: 'blob' });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'blueprint';
  saveAs(blob, `${slug}-blueprint.zip`);
}

function exportBlueprintJson(blueprint: ReturnType<typeof serializeBlueprint>, title: string) {
  const blob = new Blob([JSON.stringify(blueprint, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'blueprint'}.blueprint.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function saveWorkspace(blueprint: Blueprint, assetFiles: { path: string; file: File }[], title: string) {
  const JSZip    = (await import('jszip')).default;
  const fileSaver = await import('file-saver');
  const saveAs   = fileSaver.saveAs ?? fileSaver.default?.saveAs;
  const zip      = new JSZip();
  const state    = {
    meta:    blueprint.meta,
    defaults: blueprint.defaults,
    assets: {
      images: blueprint.assets.images.map(({ id, path, filename }) => ({ id, path, filename })),
      videos: blueprint.assets.videos.map(({ id, path, filename }) => ({ id, path, filename })),
      audio:  blueprint.assets.audio.map(({ id, path, filename })  => ({ id, path, filename })),
    },
    scenes: blueprint.scenes,
  };
  zip.file('workspace-state.json', JSON.stringify(state, null, 2));
  for (const { path, file } of assetFiles) zip.file(path, await file.arrayBuffer());
  const blob = await zip.generateAsync({ type: 'blob' });
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
  saveAs(blob, `${slug}.workspace.zip`);
}

async function loadWorkspace(
  file: File,
  dispatch: React.Dispatch<{ type: 'LOAD_BLUEPRINT'; blueprint: Blueprint }>
) {
  const JSZip = (await import('jszip')).default;
  const zip   = await JSZip.loadAsync(file);
  const stateFile = zip.file('workspace-state.json');
  if (!stateFile) throw new Error('Not a valid workspace file (workspace-state.json missing)');
  const state = JSON.parse(await stateFile.async('text'));
  const restoreAssets = async (items: Omit<AssetItem, 'file'>[]): Promise<AssetItem[]> =>
    Promise.all(items.map(async (item) => {
      const entry = zip.file(item.path);
      if (entry) {
        const blob = await entry.async('blob');
        return { ...item, file: new File([blob], item.filename) };
      }
      return item;
    }));
  dispatch({
    type: 'LOAD_BLUEPRINT',
    blueprint: {
      ...state,
      assets: {
        images: await restoreAssets(state.assets.images),
        videos: await restoreAssets(state.assets.videos),
        audio:  await restoreAssets(state.assets.audio),
      },
    },
  });
}

async function generateVideo(
  blueprint: ReturnType<typeof serializeBlueprint>,
  assetFiles: { path: string; file: File }[],
  outputFilename: string,
): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_CONTENT_BUILDER_API_URL?.replace(/\/$/, '') || 'http://localhost:8000';
  const formData = new FormData();
  formData.append('blueprint', JSON.stringify(blueprint));
  formData.append('output_filename', outputFilename.trim() || 'output');
  for (const { path, file } of assetFiles) formData.append(path, file, file.name);
  const res = await fetch(`${apiUrl}/generate`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText) || `Server error ${res.status}`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${outputFilename.trim().replace(/[^a-z0-9 _-]/gi, '_') || 'output'}.mp4`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sidebar tab types ────────────────────────────────────────────────────────

type SideTab = 'meta' | 'defaults' | 'assets';

const SIDE_TABS: { key: SideTab; label: string; icon: React.ReactNode }[] = [
  { key: 'meta',     label: 'Meta',     icon: <Settings  size={13} /> },
  { key: 'defaults', label: 'Defaults', icon: <Layers    size={13} /> },
  { key: 'assets',   label: 'Assets',   icon: <Database  size={13} /> },
];

// ─── Inner app ────────────────────────────────────────────────────────────────

function AppInner() {
  const { state, dispatch, getJson, getAllAssetFiles, canUndo, canRedo } = useBlueprint();
  const assetUrls  = useAssetUrls();
  const playback   = usePlayback(state.blueprint.scenes, state.blueprint.defaults.duration);

  // ── Pre-fetch TTS audio for every scene that has voice text ─────────────
  const ttsMap = useTTSCache(state.blueprint.scenes, state.blueprint.defaults);

  // ── Wire up real audio playback during preview ───────────────────────────
  useAudioPlayback({
    audioTracks: state.blueprint.audioTracks ?? [],
    sceneTimes:  playback.sceneTimes,
    assetUrls,
    ttsMap,
    playheadMs:  playback.playheadMs,
    isPlaying:   playback.isPlaying,
  });

  const [sideTab, setSideTab]   = useState<SideTab>('meta');
  const [rightTab, setRightTab] = useState<'scenes' | 'editor' | 'json'>('scenes');

  // ── Resizable panels ─────────────────────────────────────────────────────
  const [leftWidth,  setLeftWidth]  = useState(224);   // px — left sidebar
  const [rightWidth, setRightWidth] = useState(288);   // px — right sidebar

  const resizingLeft  = useRef(false);
  const resizingRight = useRef(false);
  const resizeStartX  = useRef(0);
  const resizeStartW  = useRef(0);

  const onLeftDividerDown  = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingLeft.current = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = leftWidth;
  }, [leftWidth]);

  const onRightDividerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRight.current = true;
    resizeStartX.current  = e.clientX;
    resizeStartW.current  = rightWidth;
  }, [rightWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizingLeft.current) {
        const dx = e.clientX - resizeStartX.current;
        setLeftWidth(Math.max(160, Math.min(480, resizeStartW.current + dx)));
      }
      if (resizingRight.current) {
        const dx = resizeStartX.current - e.clientX;
        setRightWidth(Math.max(200, Math.min(520, resizeStartW.current + dx)));
      }
    };
    const onUp = () => {
      resizingLeft.current  = false;
      resizingRight.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, []);

  const [exporting,          setExporting]          = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [loading,            setLoading]            = useState(false);
  const [importingBlueprint, setImportingBlueprint] = useState(false);
  const [outputFilename,     setOutputFilename]     = useState('');
  const [generateStatus,     setGenerateStatus]     = useState<GenerateStatus>('idle');
  const [generateError,      setGenerateError]      = useState<string | undefined>();

  const loadInputRef        = useRef<HTMLInputElement>(null);
  const importBlueprintRef  = useRef<HTMLInputElement>(null);

  // During playback: canvas follows the playhead (scene at current time).
  // When paused: show the manually selected scene (or playhead scene as fallback).
  const previewScene = playback.isPlaying
    ? playback.currentScene?.scene
    : (state.blueprint.scenes.find(s => s.id === state.selectedSceneId)
        ?? playback.currentScene?.scene);

  const handleSaveWorkspace = useCallback(async () => {
    setSaving(true);
    try { await saveWorkspace(state.blueprint, getAllAssetFiles(), state.blueprint.meta.title); }
    catch (err) { alert('Save failed. Check console.'); console.error(err); }
    finally { setSaving(false); }
  }, [getAllAssetFiles, state.blueprint]);

  const handleLoadWorkspace = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try { await loadWorkspace(file, dispatch as React.Dispatch<{ type: 'LOAD_BLUEPRINT'; blueprint: Blueprint }>); }
    catch (err) { alert(`Load failed: ${err instanceof Error ? err.message : err}`); }
    finally { setLoading(false); e.target.value = ''; }
  }, [dispatch]);

  const handleExportZip = useCallback(async () => {
    setExporting(true);
    try { await exportZip(getJson(), getAllAssetFiles(), state.blueprint.meta.title); }
    catch (err) { alert('Export failed.'); console.error(err); }
    finally { setExporting(false); }
  }, [getJson, getAllAssetFiles, state.blueprint.meta.title]);

  const handleExportBlueprint = useCallback(() => {
    exportBlueprintJson(getJson(), state.blueprint.meta.title);
  }, [getJson, state.blueprint.meta.title]);

  const handleImportBlueprint = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingBlueprint(true);
    try {
      const output = JSON.parse(await file.text());
      dispatch({ type: 'LOAD_BLUEPRINT', blueprint: deserializeBlueprint(output) });
    } catch (err) { alert(`Import failed: ${err instanceof Error ? err.message : err}`); }
    finally { setImportingBlueprint(false); e.target.value = ''; }
  }, [dispatch]);

  const handleGenerate = useCallback(async () => {
    setGenerateStatus('generating');
    setGenerateError(undefined);
    try {
      await generateVideo(getJson(), getAllAssetFiles(), outputFilename.trim() || state.blueprint.meta.title || 'output');
      setGenerateStatus('success');
      setTimeout(() => setGenerateStatus('idle'), 4000);
    } catch (err) {
      setGenerateStatus('error');
      setGenerateError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [getJson, getAllAssetFiles, outputFilename, state.blueprint.meta.title]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface text-white">

      {/* ═══ TOPBAR ═══════════════════════════════════════════════════════ */}
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-1 shrink-0 z-30">
        {/* Logo */}
        <Clapperboard size={15} className="text-accent shrink-0" />
        <span className="text-sm font-bold tracking-tight mr-2">Video Builder</span>

        {/* Undo / Redo */}
        <button
          title="Undo (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => dispatch({ type: 'UNDO' })}
          className="btn-ghost p-1.5 disabled:opacity-30"
        >
          <Undo2 size={14} />
        </button>
        <button
          title="Redo (Ctrl+Y)"
          disabled={!canRedo}
          onClick={() => dispatch({ type: 'REDO' })}
          className="btn-ghost p-1.5 disabled:opacity-30"
        >
          <Redo2 size={14} />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Playback controls */}
        <button title="Go to start" onClick={() => playback.seek(0)} className="btn-ghost p-1.5">
          <SkipBack size={13} />
        </button>
        <button
          title="Play / Pause (Space)"
          onClick={playback.toggle}
          className="btn-ghost p-1.5 rounded-full bg-accent/10 hover:bg-accent/25 transition-colors"
        >
          {playback.isPlaying
            ? <Pause size={14} className="text-accent" />
            : <Play  size={14} className="text-accent ml-0.5" />}
        </button>
        <span className="font-mono text-[11px] text-muted tabular-nums w-20">
          {(playback.playheadMs / 1000).toFixed(2)}s
        </span>

        <div className="flex-1" />

        {/* Workspace actions */}
        <button title="Save Workspace" onClick={handleSaveWorkspace} disabled={saving}  className="btn-ghost p-1.5 disabled:opacity-50">
          <Save size={13} />
        </button>
        <button title="Load Workspace" onClick={() => loadInputRef.current?.click()} disabled={loading} className="btn-ghost p-1.5 disabled:opacity-50">
          <FolderOpen size={13} />
        </button>
        <button title="Export Blueprint JSON" onClick={handleExportBlueprint} className="btn-ghost p-1.5">
          <Download size={13} />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Generate */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={outputFilename}
            onChange={e => setOutputFilename(e.target.value)}
            placeholder={state.blueprint.meta.title || 'output'}
            className="bg-surface border border-border rounded px-2 py-1 text-xs w-32"
          />
          <button
            onClick={handleGenerate}
            disabled={generateStatus === 'generating'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              generateStatus === 'generating'  ? 'bg-accent/50 text-white/50 cursor-wait' :
              generateStatus === 'success'     ? 'bg-green-600 text-white' :
              generateStatus === 'error'       ? 'bg-red-600 text-white' :
              'bg-accent text-white hover:bg-accent/80'
            }`}
          >
            <Zap size={12} />
            {generateStatus === 'generating' ? 'Generating…' :
             generateStatus === 'success'    ? 'Done ✓' :
             generateStatus === 'error'      ? 'Error' : 'Generate'}
          </button>
        </div>

        {generateError && (
          <span className="text-red-400 text-xs truncate max-w-48" title={generateError}>⚠ {generateError}</span>
        )}

        <input ref={loadInputRef}       type="file" accept=".zip"  className="hidden" onChange={handleLoadWorkspace} />
        <input ref={importBlueprintRef} type="file" accept=".json" className="hidden" onChange={handleImportBlueprint} />
      </header>

      {/* ═══ MAIN AREA ════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
        <aside className="shrink-0 flex flex-col border-r border-border bg-surface-1" style={{ width: leftWidth }}>
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
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
          <div className="flex-1 overflow-y-auto p-3">
            {sideTab === 'meta'     && <MetaPanel />}
            {sideTab === 'defaults' && <DefaultsEditor />}
            {sideTab === 'assets'   && <AssetManager />}
          </div>
        </aside>

        {/* ── LEFT DRAG DIVIDER ─────────────────────────────────────────── */}
        <div
          onMouseDown={onLeftDividerDown}
          className="w-1 shrink-0 cursor-ew-resize bg-border hover:bg-accent/60 active:bg-accent transition-colors z-20"
          title="Drag to resize"
        />

        {/* ── CENTER: Preview ────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#0d0d0d]">
          <div className="flex-1 overflow-y-auto flex items-center justify-center p-4">
            <InteractivePreview
              scene={previewScene}
              assetUrls={assetUrls}
              playback={playback}
              ttsMap={ttsMap}
              maxHeight={Math.min(420, 520)}
            />
          </div>
        </main>

        {/* ── RIGHT DRAG DIVIDER ────────────────────────────────────────── */}
        <div
          onMouseDown={onRightDividerDown}
          className="w-1 shrink-0 cursor-ew-resize bg-border hover:bg-accent/60 active:bg-accent transition-colors z-20"
          title="Drag to resize"
        />

        {/* ── RIGHT SIDEBAR ──────────────────────────────────────────────── */}
        <aside className="shrink-0 flex flex-col border-l border-border bg-surface-1" style={{ width: rightWidth }}>
          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            {(['scenes', 'editor', 'json'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2 text-xs capitalize transition-colors ${
                  rightTab === tab
                    ? 'text-white border-b-2 border-accent bg-accent/5'
                    : 'text-muted hover:text-white'
                }`}
              >
                {tab === 'scenes' ? 'Scenes' : tab === 'editor' ? 'Properties' : 'JSON'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {rightTab === 'scenes' && <SceneList />}
            {rightTab === 'editor' && (
              <div className="p-3">
                {state.selectedSceneId ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Clapperboard size={13} className="text-accent" />
                      <span className="text-xs font-semibold">
                        <span className="text-accent font-mono">{state.selectedSceneId}</span>
                      </span>
                    </div>
                    <SceneEditor />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-muted">
                    <span className="text-3xl mb-2">🎬</span>
                    <p className="text-xs text-center">Select a scene to edit its properties</p>
                  </div>
                )}
              </div>
            )}
            {rightTab === 'json' && (
              <JsonPreview
                onExportZip={handleExportZip}
                onSaveWorkspace={handleSaveWorkspace}
                onLoadWorkspace={() => loadInputRef.current?.click()}
                onExportBlueprint={handleExportBlueprint}
                onImportBlueprint={() => importBlueprintRef.current?.click()}
                onGenerate={handleGenerate}
                outputFilename={outputFilename}
                onOutputFilenameChange={setOutputFilename}
                generateStatus={generateStatus}
                generateError={generateError}
                saving={saving}
                loading={loading}
                importingBlueprint={importingBlueprint}
              />
            )}
          </div>
        </aside>
      </div>

      {/* ═══ TIMELINE ═════════════════════════════════════════════════════ */}
      <TimelineEditor playback={playback} ttsMap={ttsMap} />
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
