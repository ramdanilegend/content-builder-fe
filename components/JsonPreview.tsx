'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Download, Save, FolderOpen, FileDown, Upload } from 'lucide-react';
import { useBlueprint, serializeBlueprint } from '@/context/BlueprintContext';
import GeneratePanel, { type GenerateStatus } from './GeneratePanel';

interface Props {
  onExportZip: () => void;
  onSaveWorkspace: () => void;
  onLoadWorkspace: () => void;
  onExportBlueprint: () => void;
  onImportBlueprint: () => void;
  onGenerate: () => void;
  outputFilename: string;
  onOutputFilenameChange: (value: string) => void;
  generateStatus: GenerateStatus;
  generateError?: string;
  saving?: boolean;
  loading?: boolean;
  importingBlueprint?: boolean;
}

export default function JsonPreview({
  onExportZip,
  onSaveWorkspace,
  onLoadWorkspace,
  onExportBlueprint,
  onImportBlueprint,
  onGenerate,
  outputFilename,
  onOutputFilenameChange,
  generateStatus,
  generateError,
  saving,
  loading,
  importingBlueprint,
}: Props) {
  const { state } = useBlueprint();
  const [copied, setCopied] = useState(false);
  const [json, setJson] = useState('');

  useEffect(() => {
    const out = serializeBlueprint(state.blueprint);
    setJson(JSON.stringify(out, null, 2));
  }, [state.blueprint]);

  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allAssets = [
    ...state.blueprint.assets.images,
    ...state.blueprint.assets.videos,
    ...state.blueprint.assets.audio,
  ];
  const uploadedCount = allAssets.filter(a => a.file).length;

  return (
    <div className="flex flex-col h-full">
      {/* Top action row */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">JSON Preview</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={copy}
            className="btn-ghost text-xs flex items-center gap-1"
            title="Copy JSON"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={onExportZip}
            className="flex items-center gap-1 text-xs bg-accent hover:bg-accent-hover text-white rounded px-2.5 py-1 transition-colors"
            title={`Export ZIP (${uploadedCount} asset${uploadedCount !== 1 ? 's' : ''} bundled)`}
          >
            <Download size={12} />
            Export ZIP
          </button>
        </div>
      </div>

      {/* Workspace row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 bg-surface-2">
        <span className="text-xs text-muted flex-1">Workspace</span>
        <button
          onClick={onSaveWorkspace}
          disabled={saving}
          className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-50"
          title="Save Workspace (includes assets)"
        >
          <Save size={12} />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onLoadWorkspace}
          disabled={loading}
          className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-50"
          title="Load Workspace from file"
        >
          <FolderOpen size={12} />
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>

      {/* Blueprint row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0 bg-surface-2">
        <span className="text-xs text-muted flex-1">Blueprint</span>
        <button
          onClick={onExportBlueprint}
          className="btn-ghost text-xs flex items-center gap-1"
          title="Export blueprint.json (structure only, no assets)"
        >
          <FileDown size={12} />
          Export
        </button>
        <button
          onClick={onImportBlueprint}
          disabled={importingBlueprint}
          className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-50"
          title="Import blueprint.json"
        >
          <Upload size={12} />
          {importingBlueprint ? 'Importing…' : 'Import'}
        </button>
      </div>

      {/* ── Generate Video panel ── */}
      <GeneratePanel
        outputFilename={outputFilename}
        onOutputFilenameChange={onOutputFilenameChange}
        onGenerate={onGenerate}
        status={generateStatus}
        errorMessage={generateError}
        assetCount={uploadedCount}
      />

      {uploadedCount > 0 && (
        <div className="px-3 py-1.5 bg-accent/10 border-b border-accent/20 shrink-0">
          <p className="text-xs text-accent">
            📦 {uploadedCount} asset file{uploadedCount !== 1 ? 's' : ''} will be bundled in <code>assets/</code>
          </p>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <pre className="text-xs font-mono text-green-300 p-3 leading-5 whitespace-pre">
          {json}
        </pre>
      </div>
    </div>
  );
}
