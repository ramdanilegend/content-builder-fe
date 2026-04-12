'use client';

import { useEffect, useState } from 'react';
import { useBlueprint } from '@/context/BlueprintContext';

/**
 * Builds a URL map for all uploaded asset File objects.
 * Keys are the asset's `id` AND its `path` so layers can resolve either way:
 *   - layer.src = asset.id    → map.get(asset.id)   ✓
 *   - layer.src = asset.path  → map.get(asset.path) ✓
 * Automatically revokes Object URLs on cleanup.
 */
export function useAssetUrls(): Map<string, string> {
  const { state } = useBlueprint();
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    const all = [
      ...state.blueprint.assets.images,
      ...state.blueprint.assets.videos,
    ];
    for (const asset of all) {
      if (asset.file) {
        const url = URL.createObjectURL(asset.file);
        // Index by both id and path so either reference works
        map.set(asset.id, url);
        map.set(asset.path, url);
        // Also index by bare filename as last-resort fallback
        map.set(asset.filename, url);
      }
    }
    setUrlMap(map);
    return () => {
      // Revoke unique URLs only (avoid double-revoking same blob URL)
      const unique = new Set(map.values());
      unique.forEach(url => URL.revokeObjectURL(url));
    };
  }, [state.blueprint.assets]);

  return urlMap;
}
