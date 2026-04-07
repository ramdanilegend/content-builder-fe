'use client';

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type {
  Blueprint, Scene, Layer, AssetItem, Assets,
  Meta, Defaults, SceneAudio, SceneDuration,
  OutputBlueprint, OutputLayer, OutputScene, OutputAssetItem,
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
    voice: 'en-US-JennyNeural',
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
  | { type: 'LOAD_BLUEPRINT'; blueprint: Blueprint };

function reducer(state: State, action: Action): State {
  const { blueprint } = state;

  switch (action.type) {
    case 'SET_META':
      return { ...state, blueprint: { ...blueprint, meta: { ...blueprint.meta, ...action.payload } } };

    case 'SET_DEFAULTS':
      return { ...state, blueprint: { ...blueprint, defaults: { ...blueprint.defaults, ...action.payload } } };

    case 'ADD_ASSET':
      return {
        ...state,
        blueprint: {
          ...blueprint,
          assets: {
            ...blueprint.assets,
            [action.assetType]: [...blueprint.assets[action.assetType], action.item],
          },
        },
      };

    case 'REMOVE_ASSET':
      return {
        ...state,
        blueprint: {
          ...blueprint,
          assets: {
            ...blueprint.assets,
            [action.assetType]: blueprint.assets[action.assetType].filter(a => a.id !== action.id),
          },
        },
      };

    case 'ADD_SCENE': {
      const count = blueprint.scenes.length + 1;
      const scene = newScene(count);
      return {
        ...state,
        selectedSceneId: scene.id,
        selectedLayerId: null,
        blueprint: { ...blueprint, scenes: [...blueprint.scenes, scene] },
      };
    }

    case 'REMOVE_SCENE': {
      const scenes = blueprint.scenes.filter(s => s.id !== action.id);
      return {
        ...state,
        selectedSceneId: scenes.length ? scenes[scenes.length - 1].id : null,
        selectedLayerId: null,
        blueprint: { ...blueprint, scenes },
      };
    }

    case 'MOVE_SCENE': {
      const scenes = [...blueprint.scenes];
      const idx = scenes.findIndex(s => s.id === action.id);
      if (action.direction === 'up' && idx > 0) {
        [scenes[idx - 1], scenes[idx]] = [scenes[idx], scenes[idx - 1]];
      } else if (action.direction === 'down' && idx < scenes.length - 1) {
        [scenes[idx], scenes[idx + 1]] = [scenes[idx + 1], scenes[idx]];
      }
      return { ...state, blueprint: { ...blueprint, scenes } };
    }

    case 'UPDATE_SCENE':
      return {
        ...state,
        blueprint: {
          ...blueprint,
          scenes: blueprint.scenes.map(s =>
            s.id === action.id ? { ...s, ...action.payload } : s
          ),
        },
      };

    case 'SET_SCENE_DURATION':
      return {
        ...state,
        blueprint: {
          ...blueprint,
          scenes: blueprint.scenes.map(s =>
            s.id === action.id ? { ...s, duration: action.duration } : s
          ),
        },
      };

    case 'SET_SCENE_AUDIO':
      return {
        ...state,
        blueprint: {
          ...blueprint,
          scenes: blueprint.scenes.map(s =>
            s.id === action.id ? { ...s, audio: action.audio } : s
          ),
        },
      };

    case 'ADD_LAYER': {
      const layer = newLayer(action.layerType);
      return {
        ...state,
        selectedLayerId: layer._id,
        blueprint: {
          ...blueprint,
          scenes: blueprint.scenes.map(s =>
            s.id === action.sceneId ? { ...s, layers: [...s.layers, layer] } : s
          ),
        },
      };
    }

    case 'REMOVE_LAYER': {
      return {
        ...state,
        selectedLayerId: null,
        blueprint: {
          ...blueprint,
          scenes: blueprint.scenes.map(s =>
            s.id === action.sceneId
              ? { ...s, layers: s.layers.filter(l => l._id !== action.layerId) }
              : s
          ),
        },
      };
    }

    case 'UPDATE_LAYER':
      return {
        ...state,
        blueprint: {
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
        },
      };

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
      return {
        ...state,
        blueprint: {
          ...blueprint,
          scenes: blueprint.scenes.map(s => s.id === action.sceneId ? { ...s, layers } : s),
        },
      };
    }

    case 'SELECT_SCENE':
      return { ...state, selectedSceneId: action.id, selectedLayerId: null };

    case 'SELECT_LAYER':
      return { ...state, selectedLayerId: action.id };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.tab };

    case 'LOAD_BLUEPRINT':
      return { ...state, blueprint: action.blueprint, selectedSceneId: null, selectedLayerId: null };

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
  if (s.audio.voice?.text) out.audio.voice = s.audio.voice;
  if (s.audio.bgm?.src) out.audio.bgm = s.audio.bgm;
  if (s.effects && s.effects.length > 0) out.effects = s.effects;
  return out;
}

export function serializeBlueprint(blueprint: Blueprint): OutputBlueprint {
  const mapAssets = (arr: AssetItem[]): OutputAssetItem[] =>
    arr.map(({ id, path }) => ({ id, path }));

  return {
    meta: blueprint.meta,
    defaults: blueprint.defaults,
    assets: {
      images: mapAssets(blueprint.assets.images),
      videos: mapAssets(blueprint.assets.videos),
      audio: mapAssets(blueprint.assets.audio),
    },
    scenes: blueprint.scenes.map(cleanScene),
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

  return (
    <BlueprintContext.Provider value={{ state, dispatch, selectedScene, selectedLayer, getJson, getAllAssetFiles }}>
      {children}
    </BlueprintContext.Provider>
  );
}

export function useBlueprint() {
  const ctx = useContext(BlueprintContext);
  if (!ctx) throw new Error('useBlueprint must be used within BlueprintProvider');
  return ctx;
}
