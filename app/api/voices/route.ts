import { NextResponse } from 'next/server';
import { MsEdgeTTS } from 'msedge-tts';

let cache: unknown[] | null = null;

export const dynamic = 'force-dynamic';

export async function GET() {
  if (cache) return NextResponse.json(cache);

  try {
    const tts = new MsEdgeTTS();
    const voices = await tts.getVoices();
    cache = voices;
    return NextResponse.json(voices);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
