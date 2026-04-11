export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';
export type AnchorType =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface Resolution { width: number; height: number }

export interface Meta {
  title: string;
  ratio: AspectRatio;
  fps: number;
  resolution: Resolution;
}

export interface Position {
  x: number;
  y: number;
  anchor: AnchorType;
  unit: 'percent';
}

export interface Defaults {
  duration: number;
  subtitle: boolean;
  voice: string;
  speed: number;
  pitch: number;
  position: Position;
}

/** Internal asset entry – includes the uploaded File for ZIP bundling */
export interface AssetItem {
  id: string;
  /** relative path that will appear in blueprint JSON, e.g. "assets/bg.jpg" */
  path: string;
  /** original filename */
  filename: string;
  /** actual File object for ZIP export – undefined when entered manually */
  file?: File;
}

export interface Assets {
  images: AssetItem[];
  videos: AssetItem[];
  audio: AssetItem[];
}

export interface LayerAnimation {
  type: string;
  duration: number;
}

export interface Layer {
  /** internal React key only – stripped from JSON output */
  _id: string;
  type: 'text' | 'image' | 'video';
  src?: string;
  content?: string;
  style?: string;
  loop?: boolean;
  position: Position;
  size?: { width: number };
  z_index: number;
  animation?: LayerAnimation;
}

export interface VoiceConfig {
  text: string;
  voice: string;
  speed?: number;
  pitch?: number;
}

export interface BgmConfig {
  src: string;
  volume: number;
  loop: boolean;
}

export interface SceneAudio {
  voice?: VoiceConfig;
  bgm?: BgmConfig;
}

export interface SceneDuration {
  mode: 'auto' | 'audio' | 'fixed';
  ms?: number;
}

export interface Scene {
  id: string;
  type: 'intro' | 'main' | 'outro';
  duration: SceneDuration;
  layers: Layer[];
  audio: SceneAudio;
  effects?: string[];
}

export interface Blueprint {
  meta: Meta;
  defaults: Defaults;
  assets: Assets;
  scenes: Scene[];
}

// ─── JSON output types (no _id, no File objects) ─────────────────────────────

/** assets.images / .videos / .audio → { "asset_id": "assets/images/file.jpg" } */
export type OutputAssetMap = Record<string, string>;

export interface OutputAssets {
  images: OutputAssetMap;
  videos: OutputAssetMap;
  audio: OutputAssetMap;
}

/** meta.resolution is serialized as "WxH" string e.g. "1080x1920" */
export interface OutputMeta {
  title: string;
  ratio: AspectRatio;
  resolution: string;
  fps: number;
}

export interface OutputLayer {
  type: 'text' | 'image' | 'video';
  src?: string;
  content?: string;
  style?: string;
  loop?: boolean;
  position: Position;
  size?: { width: number };
  z_index: number;
  animation?: LayerAnimation;
}

export interface OutputEffect {
  type: string;
  duration_ms: number;
}

export interface OutputScene {
  id: string;
  type: string;
  duration: SceneDuration;
  layers: OutputLayer[];
  audio: SceneAudio;
  effects?: OutputEffect[];
}

export interface OutputDefaults {
  duration: { mode: string; fallback_ms: number; end_delay_ms: number };
  position: { unit: string; anchor: string };
  voice: { provider: string; voice: string; speed: number; pitch: number };
  subtitle: {
    enabled: boolean;
    mode: string;
    source: string;
    style: {
      font_size: number;
      color: string;
      stroke_color: string;
      stroke_width: number;
      font_weight: string;
    };
    position: { x: number; y: number; anchor: string };
  };
}

export interface OutputBlueprint {
  meta: OutputMeta;
  defaults: OutputDefaults;
  assets: OutputAssets;
  scenes: OutputScene[];
}
