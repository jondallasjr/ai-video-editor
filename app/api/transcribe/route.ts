import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Lazy initialization inside handler
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'video/mp4', 'video/webm', 'audio/webm'];
    if (!validTypes.some(type => file.type.includes(type.split('/')[1]))) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Supported: mp3, mp4, wav, m4a, webm` },
        { status: 400 }
      );
    }

    console.log(`[Transcribe] Processing file: ${file.name} (${file.size} bytes)`);

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    console.log(`[Transcribe] Success: ${transcription.text.substring(0, 100)}...`);

    // Transform to our transcript format
    const result = {
      language: transcription.language,
      duration: transcription.duration,
      text: transcription.text,
      segments: transcription.segments?.map((seg, i) => ({
        id: `seg-${i}`,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
      words: transcription.words?.map(w => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Transcribe] Error:', error);

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}
