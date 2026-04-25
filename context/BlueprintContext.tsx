'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type {
  Blueprint, Scene, Layer, AssetItem, Assets,
  Meta, Defaults, SceneAudio, SceneDuration, TimelineAudioClip,
  OutputBlueprint, OutputDefaults, OutputLayer, OutputScene, OutputAudioTrack,
  AnchorType, OutputAssetMap, SubtitleStyleConfig, SubtitlePositionConfig,
} from '@/types/blueprint';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _id = 1;
export const uid = () => `id_${Date.now()}_${_id++}`;

export const defaultPosition = () => ({
  x: 50, y: 50, anchor: 'center' as const, unit: 'percent' as const,
});

export const newLayer = (type: Layer['type']): Layer => ({
  _id: uid(),
  type,
  position: defaultPosition(),
  z_index: 0,
  ...(type === 'text' ? { content: 'New text', style: '' } : {}),
  ...(type === 'video' ? { loop: false } : {}),
  size: { width: 100 },
});

export const newScene = (index: number): Scene => ({
  id: `scene_${index}`,
  type: 'main',
  duration: { mode: 'auto' },
  layers: [],
  audio: {},
  effects: [],
});

// ─── State ────────────────────────────────────────────────────────────────────

interface State {
  blueprint: Blueprint;
  selectedSceneId: string | null;
  selectedLayerId: string | null;
  activeTab: 'meta' | 'defaults' | 'assets';
  past: Blueprint[];   // undo stack (max 50)
  future: Blueprint[]; // redo stack
}

const initialBlueprint: Blueprint = {
  meta: {
    title: 'My Video',
    ratio: '16:9',
    fps: 30,
    resolution: { width: 1920, height: 1080 },
  },
  defaults: {
    duration: 5000,
    subtitle: true,
    subtitleStyle: {
      font_size: 52,
      color: '#FFFFFF',
      stroke_color: '#000000',
      stroke_width: 3,
      font_weight: 'bold' as const,
      font_family: 'Poppins',
      max_width_pct: 85,
    },
    subtitlePosition: { x: 50, y: 83, anchor: 'bottom-center' as AnchorType },
    subtitleGranularity: 'sentence' as const,
    voice: 'en-US-JennyNeural',
    speed: 0.95,
    pitch: 1.0,
    position: defaultPosition(),
  },
  assets: { images: [], videos: [], audio: [] },
  scenes: [],
};

const initialState: State = {
  blueprint: initialBlueprint,
  selectedSceneId: null,
  selectedLayerId: null,
  activeTab: 'meta',
  past: [],
  future: [],
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_META'; payload: Partial<Meta> }
  | { type: 'SET_DEFAULTS'; payload: Partial<Defaults> }
  | { type: 'ADD_ASSET'; assetType: keyof Assets; item: AssetItem }
  | { type: 'REMOVE_ASSET'; assetType: keyof Assets; id: string }
  | { type: 'ADD_SCENE' }
  | { type: 'REMOVE_SCENE'; id: string }
  | { type: 'MOVE_SCENE'; id: string; direction: 'up' | 'down' }
  | { type: 'UPDATE_SCENE'; id: string; payload: Partial<Omit<Scene, 'layers' | 'audio'>> }
  | { type: 'SET_SCENE_DURATION'; id: string; duration: SceneDuration }
  | { type: 'SET_SCENE_AUDIO'; id: string; audio: SceneAudio }
  | { type: 'ADD_LAYER'; sceneId: string; layerType: Layer['type'] }
  | { type: 'REMOVE_LAYER'; sceneId: string; layerId: string }
  | { type: 'UPDATE_LAYER'; sceneId: string; layerId: string; payload: Partial<Layer> }
  | { type: 'MOVE_LAYER'; sceneId: string; layerId: string; direction: 'up' | 'down' }
  | { type: 'SELECT_SCENE'; id: string | null }
  | { type: 'SELECT_LAYER'; id: string | null }
  | { type: 'SET_ACTIVE_TAB'; tab: State['activeTab'] }
  | { type: 'LOAD_BLUEPRINT'; blueprint: Blueprint }
  // ── History ──────────────────────────────────────────────────────────────
  | { type: 'UNDO' }
  | { type: 'REDO' }
  // ── Timeline operations ──────────────────────────────────────────────────
  | { type: 'SPLIT_SCENE'; id: string; atMs: number }
  | { type: 'SET_SCENE_DURATION_MS'; id: string; ms: number }
  // ── Global audio tracks ───────────────────────────────────────────────
  | { type: 'ADD_AUDIO_TRACK'; clip: TimelineAudioClip }
  | { type: 'UPDATE_AUDIO_TRACK'; id: string; payload: Partial<TimelineAudioClip> }
  | { type: 'REMOVE_AUDIO_TRACK'; id: string };

// Push current blueprint onto history before mutations
function withHistory(state: State, nextBlueprint: Blueprint, nextState?: Partial<State>): State {
  const past = [...state.past.slice(-49), state.blueprint];
  return { ...state, blueprint: nextBlueprint, past, future: [], ...nextState };
}

function reducer(state: State, action: Action): State {
  const { blueprint } = state;

  switch (action.type) {
    case 'SET_META':
      return withHistory(state, { ...blueprint, meta: { ...blueprint.meta, ...action.payload } });

    case 'SET_DEFAULTS':
      return withHistory(state, { ...blueprint, defaults: { ...blueprint.defaults, ...action.payload } });

    case 'ADD_ASSET':
      return withHistory(state, {
        ...blueprint,
        assets: {
          ...blueprint.assets,
          [action.assetType]: [...blueprint.assets[action.assetType], action.item],
        },
      });

    case 'REMOVE_ASSET':
      return withHistory(state, {
        ...blueprint,
        assets: {
          ...blueprint.assets,
          [action.assetType]: blueprint.assets[action.assetType].filter(a => a.id !== action.id),
        },
      });

    case 'ADD_SCENE': {
      const count = blueprint.scenes.length + 1;
      const scene = newScene(count);
      return withHistory(state, { ...blueprint, scenes: [...blueprint.scenes, scene] }, {
        selectedSceneId: scene.id,
        selectedLayerId: null,
      });
    }

    case 'REMOVE_SCENE': {
      const scenes = blueprint.scenes.filter(s => s.id !== action.id);
      return withHistory(state, { ...blueprint, scenes }, {
        selectedSceneId: scenes.length ? scenes[scenes.length - 1].id : null,
        selectedLayerId: null,
      });
    }

    case 'MOVE_SCENE': {
      const scenes = [...blueprint.scenes];
      const idx = scenes.findIndex(s => s.id === action.id);
      if (action.direction === 'up' && idx > 0) {
        [scenes[idx - 1], scenes[idx]] = [scenes[idx], scenes[idx - 1]];
      } else if (action.direction === 'down' && idx < scenes.length - 1) {
        [scenes[idx], scenes[idx + 1]] = [scenes[idx + 1], scenes[idx]];
      }
      return withHistory(state, { ...blueprint, scenes });
    }

    case 'UPDATE_SCENE':
      return withHistory(state, {
        ...blueprint,
        scenes: blueprint.scenes.map(s =>
          s.id === action.id ? { ...s, ...action.payload } : s
        ),
      });

    case 'SET_SCENE_DURATION':
      return withHistory(state, {
        ...blueprint,
        scenes: blueprint.scenes.map(s =>
          s.id === action.id ? { ...s, duration: action.duration } : s
        ),
      });

    case 'SET_SCENE_AUDIO':
      return withHistory(state, {
        ...blueprint,
        scenes: blueprint.scenes.map(s =>
          s.id === action.id ? { ...s, audio: action.audio } : s
        ),
      });

    case 'ADD_LAYER': {
      const layer = newLayer(action.layerType);
      return withHistory(state, {
        ...blueprint,
        scenes: blueprint.scenes.map(s =>
          s.id === action.sceneId ? { ...s, layers: [...s.layers, layer] } : s
        ),
      }, { selectedLayerId: layer._id });
    }

    case 'REMOVE_LAYER': {
      return withHistory(state, {
        ...blueprint,
        scenes: blueprint.scenes.map(s =>
          s.id === action.sceneId
            ? { ...s, layers: s.layers.filter(l => l._id !== action.layerId) }
            : s
        ),
      }, { selectedLayerId: null });
    }

    case 'UPDATE_LAYER':
      return withHistory(state, {
        ...blueprint,
        scenes: blueprint.scenes.map(s =>
          s.id === action.sceneId
            ? {
                ...s,
                layers: s.layers.map(l =>
                  l._id === action.layerId ? { ...l, ...action.payload } : l
                ),
              }
            : s
        ),
      });

    case 'MOVE_LAYER': {
      const scene = blueprint.scenes.find(s => s.id === action.sceneId);
      if (!scene) return state;
      const layers = [...scene.layers];
      const idx = layers.findIndex(l => l._id === action.layerId);
      if (action.direction === 'up' && idx > 0) {
        [layers[idx - 1], layers[idx]] = [layers[idx], layers[idx - 1]];
      } else if (action.direction === 'down' && idx < layers.length - 1) {
        [layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]];
      }
      return withHistory(state, {
        ...blueprint,
        scenes: blueprint.scenes.map(s => s.id === action.sceneId ? { ...s, layers } : s),
      });
    }

    case 'SELECT_SCENE':
      return { ...state, selectedSceneId: action.id, selectedLayerId: null };

    case 'SELECT_LAYER':
      return { ...state, selectedLayerId: action.id };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };

    case 'LOAD_BLUEPRINT':
      return { ...state, blueprint: action.blueprint, selectedSceneId: null, selectedLayerId: null, past: [], future: [] };

    // ── Undo / Redo ────────────────────────────────────────────────────────

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const past = [...state.past];
      const prev = past.pop()!;
      return {
        ...state,
        blueprint: prev,
        past,
        future: [state.blueprint, ...state.future.slice(0, 49)],
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const future = [...state.future];
      const next = future.shift()!;
      return {
        ...state,
        blueprint: next,
        future,
        past: [...state.past.slice(-49), state.blueprint],
      };
    }

    // ── Timeline operations ────────────────────────────────────────────────

    case 'SET_SCENE_DURATION_MS': {
      const nextBp: Blueprint = {
        ...blueprint,
        scenes: blueprint.scenes.map(s =>
          s.id === action.id ? { ...s, duration: { mode: 'fixed', ms: Math.max(500, action.ms) } } : s
        ),
      };
      return withHistory(state, nextBp);
    }

    case 'SPLIT_SCENE': {
      const sceneIdx = blueprint.scenes.findIndex(s => s.id === action.id);
      if (sceneIdx === -1) return state;
      const scene = blueprint.scenes[sceneIdx];
      const totalMs = scene.duration.mode === 'fixed'
        ? (scene.duration.ms ?? 5000)
        : 5000;
      const splitAt = Math.max(500, Math.min(action.atMs, totalMs - 500));
      const firstDuration: SceneDuration = { mode: 'fixed', ms: splitAt };
      const secondDuration: SceneDuration = { mode: 'fixed', ms: totalMs - splitAt };
      const first: Scene = { ...scene, duration: firstDuration, layers: scene.layers.map(l => ({ ...l, _id: uid() })) };
      const second: Scene = {
        ...scene,
        id: `${scene.id}_split`,
        duration: secondDuration,
        layers: scene.layers.map(l => ({ ...l, _id: uid() })),
      };
      const scenes = [
        ...blueprint.scenes.slice(0, sceneIdx),
        first,
        second,
        ...blueprint.scenes.slice(sceneIdx + 1),
      ];
      return withHistory(state, { ...blueprint, scenes }, { selectedSceneId: first.id });
    }

    // ── Global audio tracks ────────────────────────────────────────────────

    case 'ADD_AUDIO_TRACK':
      return withHistory(state, {
        ...blueprint,
        audioTracks: [...(blueprint.audioTracks ?? []), action.clip],
      });

    case 'UPDATE_AUDIO_TRACK':
      return withHistory(state, {
        ...blueprint,
        audioTracks: (blueprint.audioTracks ?? []).map(t =>
          t.id === action.id ? { ...t, ...action.payload } : t
        ),
      });

    case 'REMOVE_AUDIO_TRACK':
      return withHistory(state, {
        ...blueprint,
        audioTracks: (blueprint.audioTracks ?? []).filter(t => t.id !== action.id),
      });

    default:
      return state;
  }
}

// ─── JSON serializer (strip internal fields, remove undefined) ────────────────

function cleanLayer(l: Layer): OutputLayer {
  const out: OutputLayer = {
    type: l.type,
    position: l.position,
    z_index: l.z_index,
  };
  if (l.src) out.src = l.src;
  if (l.content !== undefined && l.content !== '') out.content = l.content;
  if (l.style) out.style = l.style;
  if (l.loop !== undefined) out.loop = l.loop;
  if (l.size) out.size = l.size;
  if (l.animation) out.animation = l.animation;
  return out;
}

function cleanScene(s: Scene): OutputScene {
  const out: OutputScene = {
    id: s.id,
    type: s.type,
    duration: s.duration.mode === 'fixed'
      ? { mode: 'fixed', ms: s.duration.ms ?? 3000 }
      : { mode: s.duration.mode },
    layers: s.layers.map(cleanLayer),
    audio: {},
  };
  if (s.audio.voice?.text) {
    out.audio.voice = {
      text: s.audio.voice.text,
      voice: s.audio.voice.voice,
      ...(s.audio.voice.speed !== undefined && { speed: s.audio.voice.speed }),
      ...(s.audio.voice.pitch !== undefined && { pitch: s.audio.voice.pitch }),
      // omit render field when true (true is the default); only emit when explicitly disabled
      ...(s.audio.voice.render === false && { render: false }),
    };
    // Per-scene subtitle override: backend reads scene.subtitle.enabled,
    // not a field inside audio.voice. Emit the override only when disabled
    // so the default (enabled) path stays clean.
    if (s.audio.voice.render_subtitle === false) {
      out.subtitle = { enabled: false };
    }
  }
  if (s.audio.bgm?.src) out.audio.bgm = s.audio.bgm;
  if (s.effects && s.effects.length > 0) {
    out.effects = s.effects.map(e => ({ type: e.type, duration_ms: e.duration_ms }));
  }
  return out;
}

export function serializeBlueprint(blueprint: Blueprint): OutputBlueprint {
  // Convert array to object map { id: path }
  const mapAssets = (arr: AssetItem[]): Record<string, string> =>
    Object.fromEntries(arr.map(({ id, path }) => [id, path]));

  // Resolution as "WxH" string
  const { width, height } = blueprint.meta.resolution;
  const resolutionStr = `${width}x${height}`;

  // Transform internal defaults into backend-expected format

  // If every voice-enabled scene has explicitly disabled subtitles,
  // reflect that in the global flag so backends that only check
  // defaults.subtitle.enabled also honour the user's intent.
  const voiceScenes = blueprint.scenes.filter(s => !!s.audio.voice?.text);
  const allScenesDisableSubtitle =
    voiceScenes.length > 0 &&
    voiceScenes.every(s => s.audio.voice?.render_subtitle === false);
  const subtitleEnabled = blueprint.defaults.subtitle && !allScenesDisableSubtitle;

  const defaults: OutputDefaults = {
    duration: {
      mode: 'auto',
      fallback_ms: blueprint.defaults.duration,
      end_delay_ms: 400,
    },
    position: {
      unit: blueprint.defaults.position.unit,
      anchor: blueprint.defaults.position.anchor,
    },
    voice: {
      provider: 'edge_tts',
      voice: blueprint.defaults.voice,
      speed: blueprint.defaults.speed,
      pitch: blueprint.defaults.pitch,
    },
    subtitle: {
      enabled: subtitleEnabled,
      mode: 'burn',
      source: 'voice',
      granularity: blueprint.defaults.subtitleGranularity ?? 'sentence',
      style: {
        font_size:    blueprint.defaults.subtitleStyle?.font_size    ?? 52,
        color:        blueprint.defaults.subtitleStyle?.color        ?? '#FFFFFF',
        stroke_color: blueprint.defaults.subtitleStyle?.stroke_color ?? '#000000',
        stroke_width: blueprint.defaults.subtitleStyle?.stroke_width ?? 3,
        font_weight:  blueprint.defaults.subtitleStyle?.font_weight  ?? 'bold',
        font_family:  blueprint.defaults.subtitleStyle?.font_family  ?? 'Poppins',
        max_width_pct: blueprint.defaults.subtitleStyle?.max_width_pct ?? 85,
      },
      position: {
        x:      blueprint.defaults.subtitlePosition?.x      ?? 50,
        y:      blueprint.defaults.subtitlePosition?.y      ?? 83,
        anchor: blueprint.defaults.subtitlePosition?.anchor ?? 'bottom-center',
      },
    },
  };

  const audioTracks: OutputAudioTrack[] | undefined =
    blueprint.audioTracks && blueprint.audioTracks.length > 0
      ? blueprint.audioTracks.map(t => ({
          id:          t.id,
          src:         t.src,
          start_ms:    t.startMs,
          duration_ms: t.durationMs,
          volume:      t.volume,
          fade_in_ms:  t.fadeInMs,
          fade_out_ms: t.fadeOutMs,
          ...(t.label ? { label: t.label } : {}),
        }))
      : undefined;

  return {
    meta: {
      title: blueprint.meta.title,
      ratio: blueprint.meta.ratio,
      resolution: resolutionStr,
      fps: blueprint.meta.fps,
    },
    defaults,
    assets: {
      images: mapAssets(blueprint.assets.images),
      videos: mapAssets(blueprint.assets.videos),
      audio: mapAssets(blueprint.assets.audio),
    },
    scenes: blueprint.scenes.map(cleanScene),
    ...(audioTracks ? { audio_tracks: audioTracks } : {}),
  };
}

// ─── Blueprint Deserializer (OutputBlueprint → Blueprint) ────────────────────

export function deserializeBlueprint(output: OutputBlueprint): Blueprint {
  // Parse "WxH" resolution string back to object
  const [w, h] = (output.meta?.resolution ?? '1920x1080').split('x').map(Number);

  // Convert { id: path } asset maps back to AssetItem arrays (no file objects)
  const mapToArray = (map: OutputAssetMap = {}): AssetItem[] =>
    Object.entries(map).map(([id, path]) => ({
      id,
      path,
      filename: path.split('/').pop() ?? id,
    }));

  // Reconstruct Scene from OutputScene (add _id to layers, flatten effects)
  const parseScene = (s: OutputScene): Scene => {
    const audio = s.audio ?? {};
    // Restore per-scene render_subtitle flag from the scene-level subtitle
    // override that was emitted during serialization.
    const voice = audio.voice
      ? { ...audio.voice, ...(s.subtitle?.enabled === false && { render_subtitle: false }) }
      : audio.voice;
    return {
      id: s.id,
      type: s.type as Scene['type'],
      duration: s.duration,
      layers: (s.layers ?? []).map(l => ({
        ...l,
        _id: uid(),
        position: l.position ?? { x: 50, y: 50, anchor: 'center' as AnchorType, unit: 'percent' as const },
      })),
      audio: { ...audio, voice },
      effects: s.effects?.map(e => ({ type: e.type as import('@/types/blueprint').SceneEffectType, duration_ms: e.duration_ms ?? 500 })) ?? [],
    };
  };

  return {
    meta: {
      title: output.meta?.title ?? 'Imported Blueprint',
      ratio: output.meta?.ratio ?? '16:9',
      fps: output.meta?.fps ?? 30,
      resolution: { width: w || 1920, height: h || 1080 },
    },
    defaults: {
      duration: output.defaults?.duration?.fallback_ms ?? 5000,
      subtitle: output.defaults?.subtitle?.enabled ?? true,
      subtitleStyle: {
        font_size:    output.defaults?.subtitle?.style?.font_size    ?? 52,
        color:        output.defaults?.subtitle?.style?.color        ?? '#FFFFFF',
        stroke_color: output.defaults?.subtitle?.style?.stroke_color ?? '#000000',
        stroke_width: output.defaults?.subtitle?.style?.stroke_width ?? 3,
        font_weight:  ((output.defaults?.subtitle?.style as any)?.font_weight ?? 'bold') as 'normal' | 'bold',
        font_family:  (output.defaults?.subtitle?.style as any)?.font_family  ?? 'Poppins',
        max_width_pct: output.defaults?.subtitle?.style?.max_width_pct ?? 85,
      },
      subtitlePosition: {
        x:      output.defaults?.subtitle?.position?.x      ?? 50,
        y:      output.defaults?.subtitle?.position?.y      ?? 83,
        anchor: (output.defaults?.subtitle?.position?.anchor ?? 'bottom-center') as AnchorType,
      },
      subtitleGranularity: (output.defaults?.subtitle?.granularity as 'sentence' | 'word') ?? 'sentence',
      voice: output.defaults?.voice?.voice ?? 'en-US-JennyNeural',
      speed: output.defaults?.voice?.speed ?? 0.95,
      pitch: output.defaults?.voice?.pitch ?? 1.0,
      position: {
        x: 50,
        y: 50,
        anchor: (output.defaults?.position?.anchor ?? 'center') as AnchorType,
        unit: 'percent',
      },
    },
    assets: {
      images: mapToArray(output.assets?.images),
      videos: mapToArray(output.assets?.videos),
      audio:  mapToArray(output.assets?.audio),
    },
    scenes: (output.scenes ?? []).map(parseScene),
    audioTracks: (output.audio_tracks ?? []).map(t => ({
      id:         t.id,
      src:        t.src,
      startMs:    t.start_ms,
      durationMs: t.duration_ms,
      volume:     t.volume,
      fadeInMs:   t.fade_in_ms,
      fadeOutMs:  t.fade_out_ms,
      label:      t.label,
    })),
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface Ctx {
  state: State;
  dispatch: React.Dispatch<Action>;
  selectedScene: Scene | undefined;
  selectedLayer: Layer | undefined;
  getJson: () => OutputBlueprint;
  getAllAssetFiles: () => { path: string; file: File }[];
  canUndo: boolean;
  canRedo: boolean;
}

const BlueprintContext = createContext<Ctx | null>(null);

export function BlueprintProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const selectedScene = state.blueprint.scenes.find(s => s.id === state.selectedSceneId);
  const selectedLayer = selectedScene?.layers.find(l => l._id === state.selectedLayerId);

  const getJson = useCallback(() => serializeBlueprint(state.blueprint), [state.blueprint]);

  const getAllAssetFiles = useCallback(() => {
    const { images, videos, audio } = state.blueprint.assets;
    const all = [...images, ...videos, ...audio];
    return all.filter(a => a.file).map(a => ({ path: a.path, file: a.file! }));
  }, [state.blueprint.assets]);

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return (
    <BlueprintContext.Provider value={{ state, dispatch, selectedScene, selectedLayer, getJson, getAllAssetFiles, canUndo, canRedo }}>
      {children}
    </BlueprintContext.Provider>
  );
}

export function useBlueprint() {
  const ctx = useContext(BlueprintContext);
  if (!ctx) throw new Error('useBlueprint must be used within BlueprintProvider');
  return ctx;
}
