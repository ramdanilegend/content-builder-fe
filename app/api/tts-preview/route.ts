import { NextRequest, NextResponse } from 'next/server';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

async function synthesize(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = await tts.toStream(text);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    audioStream.on('data', (d: Buffer) => chunks.push(d));
    audioStream.on('end', () => resolve(Buffer.concat(chunks)));
    audioStream.on('error', reject);
  });
}

export async function POST(req: NextRequest) {
  let text: string, voice: string;

  try {
    ({ text, voice } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!text || !voice) {
    return NextResponse.json({ error: 'Missing text or voice' }, { status: 400 });
  }

  try {
    const audio = await synthesize(text.slice(0, 200), voice);
    // Slice the underlying ArrayBuffer to avoid shared-buffer offset issues
    const arrayBuffer = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.length),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'TTS error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
