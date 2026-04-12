'use client';

import { Video, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export type GenerateStatus = 'idle' | 'generating' | 'success' | 'error';

interface Props {
  outputFilename: string;
  onOutputFilenameChange: (value: string) => void;
  onGenerate: () => void;
  status: GenerateStatus;
  errorMessage?: string;
  assetCount: number;
}

export default function GeneratePanel({
  outputFilename,
  onOutputFilenameChange,
  onGenerate,
  status,
  errorMessage,
  assetCount,
}: Props) {
  const isGenerating = status === 'generating';

  return (
    <div className="px-3 py-2.5 border-b border-border shrink-0 bg-surface-2 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Video size={11} className="text-accent" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          Generate Video
        </span>
      </div>

      {/* Output filename input */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 flex items-center gap-1 bg-surface border border-border rounded overflow-hidden focus-within:border-accent transition-colors">
          <input
            type="text"
            value={outputFilename}
            onChange={(e) => onOutputFilenameChange(e.target.value)}
            placeholder="nama-file-output"
            disabled={isGenerating}
            className="
              flex-1 bg-transparent px-2 py-1.5 text-xs text-white placeholder-muted
              focus:outline-none disabled:opacity-50 min-w-0
            "
          />
          <span className="text-xs text-muted pr-2 select-none shrink-0">.mp4</span>
        </div>
      </div>

      {/* Asset count badge */}
      {assetCount > 0 && (
        <p className="text-xs text-muted leading-none">
          🗂 {assetCount} asset{assetCount !== 1 ? 's' : ''} akan dikirim ke backend
        </p>
      )}
      {assetCount === 0 && (
        <p className="text-xs text-yellow-500/80 leading-none">
          ⚠ Belum ada asset yang di-upload
        </p>
      )}

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || !outputFilename.trim()}
        className="
          w-full flex items-center justify-center gap-1.5
          text-xs font-medium rounded px-2.5 py-2 transition-colors
          bg-green-600 hover:bg-green-500 text-white
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      >
        {isGenerating ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            Generating… (bisa beberapa menit)
          </>
        ) : (
          <>
            <Video size={12} />
            Generate &amp; Download Video
          </>
        )}
      </button>

      {/* Status feedback */}
      {status === 'success' && (
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <CheckCircle2 size={11} />
          Video berhasil di-generate &amp; didownload!
        </div>
      )}
      {status === 'error' && errorMessage && (
        <div className="flex items-start gap-1.5 text-xs text-red-400">
          <AlertCircle size={11} className="mt-0.5 shrink-0" />
          <span className="break-all">{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
