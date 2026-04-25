/**
 * POST /api/tts-full
 * ==================
 * Full-length TTS synthesis for in-browser preview playback.
 * No character limit.  Speed and pitch are applied via ProsodyOptions.
 *
 * Body: { text: string, voice: string, speed?: number, pitch?: number }
 * Response: audio/mpeg binary
 */

import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// ─── Prosody helpers (match Python backend convention) ────────────────────────

/**
 * Convert speed multiplier → edge-tts rate string.
 * e.g. 1.0 → '+0%', 1.2 → '+20%', 0.8 → '-20%'
 */
function speedToRate(speed: number): string {
  if (speed === 1.0) return '+0%';
  const pct = Math.round((speed - 1.0) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/**
 * Convert pitch multiplier → edge-tts Hz offset string.
 * e.g. 1.0 → '+0Hz', 1.5 → '+25Hz', 0.8 → '-10Hz'
 */
function pitchToHz(pitch: number): string {
  if (pitch === 1.0) return '+0Hz';
  const hz = Math.round((pitch - 1.0) * 50);
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`;
}

// ─── Synthesize ───────────────────────────────────────────────────────────────

async function synthesize(
  text:  string,
  voice: string,
  speed: number,
  pitch: number,
): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  // ProsodyOptions are accepted as a second argument to toStream()
  const { audioStream } = await tts.toStream(text, {
    rate:  speedToRate(speed),
    pitch: pitchToHz(pitch),
  });

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    audioStream.on('data',  (d: Buffer) => chunks.push(d));
    audioStream.on('end',   () => resolve(Buffer.concat(chunks)));
    audioStream.on('error', reject);
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let text: string, voice: string, speed: number, pitch: number;

  try {
    const body = await req.json();
    text  = String(body.text  ?? '').trim();
    voice = String(body.voice ?? 'en-US-JennyNeural').trim();
    speed = Number(body.speed ?? 1.0);
    pitch = Number(body.pitch ?? 1.0);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!text)  return NextResponse.json({ error: 'Missing text'  }, { status: 400 });
  if (!voice) return NextResponse.json({ error: 'Missing voice' }, { status: 400 });

  speed = Math.max(0.5, Math.min(2.0, speed));
  pitch = Math.max(0.5, Math.min(2.0, pitch));

  try {
    const audio       = await synthesize(text, voice, speed, pitch);
    const arrayBuffer = audio.buffer.slice(
      audio.byteOffset,
      audio.byteOffset + audio.byteLength,
    ) as ArrayBuffer;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':   'audio/mpeg',
        'Content-Length': String(audio.length),
        'Cache-Control':  'public, max-age=86400',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'TTS synthesis failed';
    console.error('[tts-full]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
