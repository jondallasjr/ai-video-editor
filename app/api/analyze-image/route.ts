import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    // Lazy initialization inside handler
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
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
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Supported: jpeg, png, gif, webp` },
        { status: 400 }
      );
    }

    console.log(`[Analyze] Processing image: ${file.name} (${file.size} bytes)`);

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Analyze this image for use in a video editing application. Provide:
1. A detailed description (2-3 sentences)
2. Tags (5-10 relevant keywords)
3. Dominant colors (3-5 hex codes)
4. Quadrant descriptions (what's in each corner: topLeft, topRight, bottomLeft, bottomRight)
5. Suggested crop regions for different aspect ratios

Respond in JSON format:
{
  "description": "...",
  "tags": ["..."],
  "dominantColors": ["#..."],
  "quadrants": {
    "topLeft": "...",
    "topRight": "...",
    "bottomLeft": "...",
    "bottomRight": "..."
  },
  "suggestedCropRegions": {
    "portrait": {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1},
    "landscape": {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1},
    "square": {"x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1}
  }
}`,
            },
          ],
        },
      ],
    });

    console.log(`[Analyze] Success, tokens used: ${response.usage.input_tokens} in, ${response.usage.output_tokens} out`);

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = textContent.text;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const analysis = JSON.parse(jsonStr.trim());

    return NextResponse.json({
      ...analysis,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('[Analyze] Error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Image analysis failed' },
      { status: 500 }
    );
  }
}
