# AI Video Editor - Technical Walkthrough

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Step 1: Asset Upload & Storage](#step-1-asset-upload--storage)
3. [Step 2: Transcription Pipeline](#step-2-transcription-pipeline)
4. [Step 3: Image Analysis Pipeline](#step-3-image-analysis-pipeline)
5. [Step 4: Chat Orchestration System](#step-4-chat-orchestration-system)
6. [Step 5: Video Editing Plan Generation](#step-5-video-editing-plan-generation)
7. [Step 6: Timeline Manipulation](#step-6-timeline-manipulation)
8. [Step 7: Overlay Animation Generation](#step-7-overlay-animation-generation)
9. [Step 8: Real-Time Preview Engine](#step-8-real-time-preview-engine)
10. [Step 9: Export & Compositing](#step-9-export--compositing)

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Asset Upload │  │   Timeline   │  │ Chat Interface│        │
│  │   Manager    │  │    Editor    │  │   (Claude)    │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                 │
│  ┌──────────────────────────────────────────────────┐         │
│  │         Real-Time Preview Engine                 │         │
│  │  ┌────────────┐  ┌─────────────────────────┐    │         │
│  │  │ Video Player│  │  Overlay Canvas/DOM    │    │         │
│  │  │  (video.js) │  │  (GSAP animations)     │    │         │
│  │  └────────────┘  └─────────────────────────┘    │         │
│  └──────────────────────────────────────────────────┘         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      STATE MANAGEMENT (Zustand)                 │
│  • Project State  • Assets  • Transcripts  • Timeline Edits    │
│  • Overlay Specs  • Chat History  • Export Config              │
├─────────────────────────────────────────────────────────────────┤
│                   LOCAL STORAGE (IndexedDB via Dexie)           │
│  • Video Blobs  • Image Blobs  • Audio Blobs  • Projects       │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                           │
│  • OpenAI Whisper API (Transcription)                          │
│  • Claude/GPT-4V API (Image Analysis, Chat Orchestration)      │
│  • FFmpeg.wasm or Server (Export Compositing)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Asset Upload & Storage

### Components
- **React Dropzone** - File upload UI
- **Dexie.js** - IndexedDB wrapper
- **UUID** - Generate unique asset IDs

### Process Flow

```typescript
// 1. User drops files into upload zone
interface Asset {
  id: string;              // UUID
  type: 'video' | 'audio' | 'image';
  filename: string;
  blob: Blob;
  url: string;             // ObjectURL for preview
  duration?: number;       // For video/audio
  metadata: {
    size: number;
    mimeType: string;
    uploadedAt: Date;
  };
  // Populated later:
  transcript?: Transcript;
  imageAnalysis?: ImageAnalysis;
}

// 2. Store in IndexedDB
import Dexie from 'dexie';

class VideoEditorDB extends Dexie {
  assets: Dexie.Table<Asset, string>;
  projects: Dexie.Table<Project, string>;
  
  constructor() {
    super('VideoEditorDB');
    this.version(1).stores({
      assets: 'id, type, filename',
      projects: 'id, name, createdAt'
    });
  }
}

const db = new VideoEditorDB();

// 3. Upload handler
async function handleAssetUpload(files: File[]) {
  for (const file of files) {
    const asset: Asset = {
      id: uuidv4(),
      type: determineType(file),
      filename: file.name,
      blob: file,
      url: URL.createObjectURL(file),
      metadata: {
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date()
      }
    };
    
    // Get duration for video/audio
    if (asset.type === 'video' || asset.type === 'audio') {
      asset.duration = await getMediaDuration(file);
    }
    
    await db.assets.add(asset);
    
    // Trigger processing pipelines
    if (asset.type === 'video' || asset.type === 'audio') {
      await transcribeAsset(asset.id);
    } else if (asset.type === 'image') {
      await analyzeImage(asset.id);
    }
  }
}

// Helper: Get media duration
function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const media = document.createElement(
      file.type.startsWith('video') ? 'video' : 'audio'
    );
    media.preload = 'metadata';
    media.onloadedmetadata = () => {
      resolve(media.duration);
      URL.revokeObjectURL(media.src);
    };
    media.src = URL.createObjectURL(file);
  });
}
```

### Libraries
- `react-dropzone`: File upload UI
- `dexie`: IndexedDB wrapper
- `uuid`: ID generation

---

## Step 2: Transcription Pipeline

### Components
- **OpenAI Whisper API** - Transcription service
- **axios** - HTTP client

### Process Flow

```typescript
interface TranscriptSegment {
  id: string;
  start: number;          // seconds
  end: number;            // seconds
  text: string;
  words?: {               // word-level timestamps
    word: string;
    start: number;
    end: number;
  }[];
}

interface Transcript {
  assetId: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
  processedAt: Date;
}

// Transcription function
async function transcribeAsset(assetId: string) {
  const asset = await db.assets.get(assetId);
  if (!asset || (asset.type !== 'video' && asset.type !== 'audio')) {
    throw new Error('Invalid asset for transcription');
  }
  
  // Convert blob to file for FormData
  const file = new File([asset.blob], asset.filename, {
    type: asset.metadata.mimeType
  });
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json'); // Get timestamps
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');
  
  const response = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    formData,
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  
  // Parse Whisper response
  const whisperData = response.data;
  
  const transcript: Transcript = {
    assetId: asset.id,
    language: whisperData.language,
    segments: whisperData.segments.map((seg: any, idx: number) => ({
      id: `${asset.id}-seg-${idx}`,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      words: seg.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end
      }))
    })),
    fullText: whisperData.text,
    processedAt: new Date()
  };
  
  // Update asset with transcript
  await db.assets.update(asset.id, { transcript });
  
  return transcript;
}
```

### Whisper API Response Format
```json
{
  "task": "transcribe",
  "language": "english",
  "duration": 152.34,
  "text": "Full transcript text here...",
  "segments": [
    {
      "id": 0,
      "seek": 0,
      "start": 0.0,
      "end": 5.5,
      "text": " Hey everyone, today I'm running through...",
      "tokens": [50364, 1911, 1518, ...],
      "temperature": 0.0,
      "avg_logprob": -0.25,
      "compression_ratio": 1.5,
      "no_speech_prob": 0.001,
      "words": [
        {"word": "Hey", "start": 0.0, "end": 0.3},
        {"word": "everyone", "start": 0.3, "end": 0.8},
        ...
      ]
    }
  ]
}
```

### Libraries
- `axios`: HTTP requests
- OpenAI Whisper API

---

## Step 3: Image & Video Frame Analysis Pipeline

### Components
- **Claude API** - Vision analysis (preferred)
- **Canvas API** - Video frame extraction

### Video Frame Extraction

For videos without useful audio (b-roll, vacation footage, etc.), extract frames for visual analysis:

```typescript
async function extractVideoFrames(
  videoBlob: Blob, 
  count: number = 3
): Promise<Blob[]> {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(videoBlob);
  
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = reject;
    video.load();
  });
  
  const frames: Blob[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // Extract frames at even intervals
  const interval = video.duration / (count + 1);
  
  for (let i = 1; i <= count; i++) {
    video.currentTime = interval * i;
    await new Promise(resolve => video.onseeked = resolve);
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const blob = await new Promise<Blob>((resolve) => 
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
    );
    
    frames.push(blob);
  }
  
  URL.revokeObjectURL(video.src);
  return frames;
}

// Integrate with asset upload
async function handleVideoUpload(file: File) {
  const asset: Asset = {
    id: uuidv4(),
    type: 'video',
    filename: file.name,
    blob: file,
    url: URL.createObjectURL(file),
    duration: await getMediaDuration(file),
    metadata: {
      size: file.size,
      mimeType: file.type,
      uploadedAt: new Date()
    }
  };
  
  await db.assets.add(asset);
  
  // Extract frames for visual analysis
  logToChat(`📸 Extracting frames from ${file.name}...`);
  const frames = await extractVideoFrames(file, 3);
  
  // Store frames as separate assets
  for (let i = 0; i < frames.length; i++) {
    const frameAsset: Asset = {
      id: uuidv4(),
      type: 'image',
      filename: `${asset.id}_frame_${i}.jpg`,
      blob: frames[i],
      url: URL.createObjectURL(frames[i]),
      metadata: {
        size: frames[i].size,
        mimeType: 'image/jpeg',
        uploadedAt: new Date(),
        extractedFrom: asset.id,
        timestamp: (asset.duration! / 4) * (i + 1) // Approximate timestamp
      }
    };
    
    await db.assets.add(frameAsset);
    
    // Trigger vision analysis
    await analyzeImage(frameAsset.id);
  }
  
  logToChat(`✓ Extracted 3 frames from ${file.name}`, {
    frames: frames.map((_, i) => `frame_${i}.jpg`)
  });
  
  // Also transcribe if it has audio
  if (await hasAudioTrack(file)) {
    await transcribeAsset(asset.id);
  }
}

async function hasAudioTrack(videoFile: File): Promise<boolean> {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(videoFile);
  
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
    video.load();
  });
  
  const hasAudio = video.mozHasAudio || 
    Boolean(video.webkitAudioDecodedByteCount) ||
    Boolean(video.audioTracks && video.audioTracks.length);
  
  URL.revokeObjectURL(video.src);
  return hasAudio;
}
```

### Process Flow

```typescript
interface ImageAnalysis {
  assetId: string;
  description: string;
  tags: string[];
  quadrants: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  };
  dominantColors: string[];
  suggestedCropRegions: {
    portrait: { x: number; y: number; width: number; height: number };
    landscape: { x: number; y: number; width: number; height: number };
    square: { x: number; y: number; width: number; height: number };
  };
  processedAt: Date;
}

async function analyzeImage(assetId: string) {
  const asset = await db.assets.get(assetId);
  if (!asset || asset.type !== 'image') {
    throw new Error('Invalid asset for image analysis');
  }
  
  // Convert blob to base64
  const base64 = await blobToBase64(asset.blob);
  
  // PROMPT TEMPLATE for Image Analysis
  const prompt = `Analyze this image in detail for use in video editing overlays.

Provide your analysis in the following JSON format:
{
  "description": "A detailed 2-3 sentence description of the image",
  "tags": ["tag1", "tag2", "tag3", ...], // 5-10 relevant tags
  "quadrants": {
    "topLeft": "What's in the top-left quarter",
    "topRight": "What's in the top-right quarter",
    "bottomLeft": "What's in the bottom-left quarter",
    "bottomRight": "What's in the bottom-right quarter"
  },
  "dominantColors": ["#RRGGBB", "#RRGGBB", ...], // 3-5 hex colors
  "suggestedCropRegions": {
    "portrait": {"x": 0, "y": 0, "width": 0, "height": 0},
    "landscape": {"x": 0, "y": 0, "width": 0, "height": 0},
    "square": {"x": 0, "y": 0, "width": 0, "height": 0}
  }
}

The crop regions should be normalized coordinates (0-1 range) representing the most interesting areas for each aspect ratio.`;

  // Call Claude API
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: asset.metadata.mimeType,
                data: base64
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  
  // Parse response
  const content = response.data.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    throw new Error('Failed to parse image analysis JSON');
  }
  
  const analysisData = JSON.parse(jsonMatch[0]);
  
  const imageAnalysis: ImageAnalysis = {
    assetId: asset.id,
    ...analysisData,
    processedAt: new Date()
  };
  
  // Update asset
  await db.assets.update(asset.id, { imageAnalysis });
  
  return imageAnalysis;
}

// Helper function
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]); // Remove data:image/... prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### Claude Vision API Response Format
```json
{
  "id": "msg_01...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "{\n  \"description\": \"A scenic mountain view...\",\n  \"tags\": [...],\n  ...JSON structure...\n}"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn"
}
```

### Libraries
- `axios`: HTTP requests
- Claude/OpenAI Vision API

---

## Step 4: Chat Orchestration System

### Components
- **Claude API** - Main orchestration LLM
- **React** - Chat UI
- **Streaming support** - Real-time responses

### Process Flow

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // For function calling / tool use
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface ProjectContext {
  assets: Asset[];
  transcripts: Transcript[];
  imageAnalyses: ImageAnalysis[];
  currentTimeline?: TimelineEdit;
  currentOverlay?: OverlaySpec;
}

interface ToolCall {
  id: string;
  name: string;
  input: any;
}

interface ToolResult {
  toolCallId: string;
  output: any;
  error?: string;
}

// SYSTEM PROMPT TEMPLATE
const SYSTEM_PROMPT = `You are an AI video editor assistant. You help users create polished, engaging videos from their raw footage.

You have access to the following tools:
- analyze_project: Get current project state
- create_edit_plan: Propose a video editing plan
- update_timeline: Modify the video timeline
- generate_overlay: Create HTML/CSS/JS overlay animations
- preview_segment: Show a specific time segment

Current Project Context:
{{PROJECT_CONTEXT}}

Guidelines:
1. Always understand the user's goals before making edits
2. Propose plans before executing major changes
3. Only use words that exist in the original transcripts (no adding narration)
4. Be creative with overlay animations but keep them tasteful
5. Optimize for the target platform (Instagram Reels = 9:16, max 90s)
6. Reference images/videos naturally when they're mentioned in the audio
7. Keep pacing dynamic - vary clip lengths

When the user asks to create a video:
1. First, ask clarifying questions (length, theme, platform, number of videos)
2. Propose a high-level plan with themes and timing
3. Get user approval or iterate
4. Execute the plan step-by-step, showing progress

Always respond conversationally and explain your reasoning.`;

// Chat handler
async function sendChatMessage(
  userMessage: string,
  projectContext: ProjectContext,
  chatHistory: ChatMessage[]
) {
  // Build context string
  const contextString = buildContextString(projectContext);
  
  const systemPrompt = SYSTEM_PROMPT.replace(
    '{{PROJECT_CONTEXT}}',
    contextString
  );
  
  // Prepare messages
  const messages = [
    ...chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    {
      role: 'user' as const,
      content: userMessage
    }
  ];
  
  // Call Claude with tool use
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: systemPrompt,
      messages,
      tools: TOOL_DEFINITIONS, // Defined below
      stream: true // Enable streaming
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      responseType: 'stream'
    }
  );
  
  // Handle streaming response
  let assistantMessage = '';
  let toolCalls: ToolCall[] = [];
  
  for await (const chunk of response.data) {
    const parsed = parseSSEChunk(chunk);
    
    if (parsed.type === 'content_block_delta') {
      if (parsed.delta.type === 'text_delta') {
        assistantMessage += parsed.delta.text;
        // Update UI in real-time
        updateChatUI(assistantMessage);
      }
    } else if (parsed.type === 'content_block_start') {
      if (parsed.content_block.type === 'tool_use') {
        toolCalls.push({
          id: parsed.content_block.id,
          name: parsed.content_block.name,
          input: parsed.content_block.input
        });
      }
    }
  }
  
  // Execute tool calls if any
  if (toolCalls.length > 0) {
    const toolResults = await executeTools(toolCalls, projectContext);
    
    // Continue conversation with tool results
    return await continueWithToolResults(
      messages,
      assistantMessage,
      toolCalls,
      toolResults,
      systemPrompt
    );
  }
  
  return {
    message: assistantMessage,
    toolCalls,
    updatedContext: projectContext
  };
}

// Build context string from project
function buildContextString(context: ProjectContext): string {
  const assetsSummary = context.assets.map(asset => {
    let summary = `[${asset.type.toUpperCase()}] ${asset.filename} (ID: ${asset.id})`;
    
    if (asset.duration) {
      summary += ` - Duration: ${asset.duration.toFixed(1)}s`;
    }
    
    if (asset.transcript) {
      summary += `\n  Transcript: "${asset.transcript.fullText.slice(0, 200)}..."`;
    }
    
    if (asset.imageAnalysis) {
      summary += `\n  Description: ${asset.imageAnalysis.description}`;
      summary += `\n  Tags: ${asset.imageAnalysis.tags.join(', ')}`;
    }
    
    return summary;
  }).join('\n\n');
  
  let context_str = `## Assets (${context.assets.length})\n${assetsSummary}`;
  
  if (context.currentTimeline) {
    context_str += `\n\n## Current Timeline\n${JSON.stringify(context.currentTimeline, null, 2)}`;
  }
  
  return context_str;
}
```

### Tool Definitions for Claude

```typescript
const TOOL_DEFINITIONS = [
  {
    name: 'analyze_project',
    description: 'Get comprehensive information about the current project including all assets, transcripts, and current edit state',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'clean_transcript',
    description: 'Clean up transcript by removing filler words (um, uh, like, you know) while preserving meaning and natural flow. Returns edited transcript with word-level timestamps.',
    input_schema: {
      type: 'object',
      properties: {
        asset_id: {
          type: 'string',
          description: 'ID of the video/audio asset to clean'
        },
        preserve_pauses: {
          type: 'boolean',
          description: 'Whether to keep meaningful pauses (default: true)',
          default: true
        },
        aggressiveness: {
          type: 'string',
          enum: ['light', 'medium', 'heavy'],
          description: 'How much to clean: light (only obvious fillers), medium (fillers + some repetition), heavy (aggressive cleanup)',
          default: 'medium'
        }
      },
      required: ['asset_id']
    }
  },
  {
    name: 'create_edit_plan',
    description: 'Create a structured plan for editing the video(s). Returns a plan object that can be refined before execution.',
    input_schema: {
      type: 'object',
      properties: {
        num_videos: {
          type: 'number',
          description: 'Number of final videos to create'
        },
        target_duration_per_video: {
          type: 'number',
          description: 'Target duration in seconds for each video'
        },
        aspect_ratio: {
          type: 'string',
          enum: ['9:16', '16:9', '1:1', '4:5'],
          description: 'Aspect ratio for the video'
        },
        themes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Theme or focus for each video'
        },
        platform: {
          type: 'string',
          enum: ['instagram', 'youtube', 'tiktok', 'general'],
          description: 'Target platform'
        },
        style: {
          type: 'string',
          enum: ['talking_head', 'b_roll', 'mixed'],
          description: 'Video style: talking_head (person speaking), b_roll (visuals with voiceover), or mixed',
          default: 'mixed'
        }
      },
      required: ['num_videos', 'target_duration_per_video', 'aspect_ratio', 'themes']
    }
  },
  {
    name: 'orchestrate_broll',
    description: 'Match visual assets (photos, video clips) to voiceover/narration timestamps for b-roll editing. Analyzes transcript and visual content to create intelligent matches.',
    input_schema: {
      type: 'object',
      properties: {
        narration_asset_id: {
          type: 'string',
          description: 'ID of the audio/video asset containing narration'
        },
        visual_asset_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of photos/videos to use as b-roll'
        },
        matching_strategy: {
          type: 'string',
          enum: ['semantic', 'chronological', 'emotional', 'mixed'],
          description: 'How to match visuals to narration',
          default: 'semantic'
        }
      },
      required: ['narration_asset_id', 'visual_asset_ids']
    }
  },
  {
    name: 'update_timeline',
    description: 'Modify the video timeline with cuts, reordering, and segment selection',
    input_schema: {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              asset_id: { type: 'string' },
              start_time: { type: 'number' },
              end_time: { type: 'number' },
              order: { type: 'number' },
              layer: {
                type: 'string',
                enum: ['main', 'overlay', 'broll'],
                description: 'Which layer this segment belongs to',
                default: 'main'
              }
            }
          },
          description: 'Array of timeline segments in order'
        },
        reasoning: {
          type: 'string',
          description: 'Explanation of why these cuts were made'
        }
      },
      required: ['segments', 'reasoning']
    }
  },
  {
    name: 'generate_overlay',
    description: 'Generate HTML/CSS/JS code for animated overlays synchronized with the video. Can create image overlays, text overlays, charts, and graphs.',
    input_schema: {
      type: 'object',
      properties: {
        overlay_events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['image', 'text', 'chart', 'graph'],
                description: 'Type of overlay'
              },
              timestamp: { type: 'number', description: 'When this overlay appears (seconds)' },
              duration: { type: 'number', description: 'How long it stays (seconds)' },
              asset_id: { 
                type: 'string', 
                description: 'ID of image to show (for image overlays)'
              },
              text_content: {
                type: 'string',
                description: 'Text to display (for text overlays)'
              },
              chart_config: {
                type: 'object',
                description: 'Chart configuration (for chart/graph overlays)',
                properties: {
                  type: { 
                    type: 'string',
                    enum: ['bar', 'line', 'pie', 'doughnut', 'scatter']
                  },
                  data: { type: 'object' },
                  options: { type: 'object' }
                }
              },
              animation: {
                type: 'string',
                enum: ['slideInLeft', 'slideInRight', 'slideInTop', 'slideInBottom', 'fadeIn', 'zoomIn', 'custom'],
                description: 'Animation type'
              },
              position: {
                type: 'string',
                enum: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'center', 'fullscreen'],
                description: 'Where to position the overlay'
              },
              size: {
                type: 'string',
                enum: ['small', 'medium', 'large', 'fullscreen'],
                description: 'Size of the overlay'
              }
            }
          },
          description: 'Timeline of overlay events'
        }
      },
      required: ['overlay_events']
    }
  },
  {
    name: 'suggest_content',
    description: 'Suggest additional content (images, videos, audio, screenshots) that would improve the video',
    input_schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['image', 'video', 'audio', 'screenshot'],
                description: 'Type of content to suggest'
              },
              description: { type: 'string' },
              reasoning: { type: 'string' },
              timing: { type: 'string', description: 'When/where to use it' },
              search_terms: { type: 'string', description: 'Keywords to find it' },
              screenshot_url: { type: 'string', description: 'URL to screenshot (for screenshot type)' },
              screenshot_instruction: { type: 'string', description: 'How to capture the screenshot' }
            }
          }
        }
      },
      required: ['suggestions']
    }
  },
  {
    name: 'preview_segment',
    description: 'Set the preview player to a specific time segment',
    input_schema: {
      type: 'object',
      properties: {
        start_time: { type: 'number' },
        end_time: { type: 'number' }
      },
      required: ['start_time', 'end_time']
    }
  }
];
```

### Transcript Cleanup Implementation

```typescript
async function cleanTranscript(
  input: {
    asset_id: string;
    preserve_pauses?: boolean;
    aggressiveness?: 'light' | 'medium' | 'heavy';
  },
  context: ProjectContext
): Promise<Transcript> {
  
  const asset = await db.assets.get(input.asset_id);
  if (!asset || !asset.transcript) {
    throw new Error('Asset not found or not transcribed');
  }
  
  logToChat(`🧹 Cleaning transcript for ${asset.filename}...`);
  
  // Build cleanup prompt for Claude
  const cleanupPrompt = `Clean up this transcript by removing filler words and making it more polished, while preserving the speaker's voice and meaning.

Original Transcript:
${asset.transcript.fullText}

Segments with timestamps:
${asset.transcript.segments.map(seg => 
  `[${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.text}`
).join('\n')}

Aggressiveness: ${input.aggressiveness || 'medium'}
Preserve Pauses: ${input.preserve_pauses !== false}

Rules:
1. Remove: um, uh, like (when filler), you know, I mean, sort of, kind of
2. Fix: repeated words, false starts, grammatical errors
3. Keep: meaningful pauses, speaker's tone and personality
4. Maintain: exact timestamps by adjusting word boundaries

Return JSON:
{
  "cleanedSegments": [
    {
      "id": "original-segment-id",
      "start": 0.0,
      "end": 5.5,
      "originalText": "Um, so like, we went to this, uh, amazing beach",
      "cleanedText": "We went to this amazing beach",
      "removedWords": ["Um", "like", "uh"],
      "confidence": 0.95
    }
  ],
  "summary": "Removed X filler words, cleaned Y segments"
}`;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: cleanupPrompt }]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  
  const content = response.data.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const cleanupData = JSON.parse(jsonMatch![0]);
  
  // Create cleaned transcript
  const cleanedTranscript: Transcript = {
    ...asset.transcript,
    segments: cleanupData.cleanedSegments.map((cleaned: any) => {
      const original = asset.transcript!.segments.find(s => s.id === cleaned.id)!;
      return {
        ...original,
        text: cleaned.cleanedText,
        metadata: {
          original: cleaned.originalText,
          removedWords: cleaned.removedWords,
          confidence: cleaned.confidence
        }
      };
    }),
    fullText: cleanupData.cleanedSegments.map((s: any) => s.cleanedText).join(' '),
    cleanedAt: new Date(),
    cleanupSummary: cleanupData.summary
  };
  
  // Update asset
  await db.assets.update(asset.id, { 
    transcript: cleanedTranscript,
    transcriptCleaned: true
  });
  
  logToChat(`✓ Transcript cleaned`, {
    summary: cleanupData.summary,
    before: asset.transcript.fullText.slice(0, 100) + '...',
    after: cleanedTranscript.fullText.slice(0, 100) + '...'
  });
  
  return cleanedTranscript;
}
```

### B-Roll Orchestration Implementation

```typescript
async function orchestrateBRoll(
  input: {
    narration_asset_id: string;
    visual_asset_ids: string[];
    matching_strategy?: string;
  },
  context: ProjectContext
): Promise<BRollPlan> {
  
  const narrationAsset = await db.assets.get(input.narration_asset_id);
  if (!narrationAsset || !narrationAsset.transcript) {
    throw new Error('Narration asset not found or not transcribed');
  }
  
  const visualAssets = await Promise.all(
    input.visual_asset_ids.map(id => db.assets.get(id))
  );
  
  logToChat(`🎬 Orchestrating b-roll for ${visualAssets.length} visual assets...`);
  
  // Build matching prompt
  const matchingPrompt = `Match visual assets to voiceover segments for b-roll editing.

Voiceover Transcript:
${narrationAsset.transcript.segments.map(seg => 
  `[${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.text}`
).join('\n')}

Visual Assets:
${visualAssets.map((asset, i) => {
  if (asset.type === 'image') {
    return `Asset ${i+1} (IMAGE): ${asset.imageAnalysis?.description || 'No description'}
Tags: ${asset.imageAnalysis?.tags.join(', ') || 'none'}`;
  } else {
    // Video with extracted frames
    const frames = context.assets.filter(a => 
      a.metadata?.extractedFrom === asset.id && a.type === 'image'
    );
    return `Asset ${i+1} (VIDEO): ${asset.filename}
Frames: ${frames.map(f => f.imageAnalysis?.description).join('; ')}`;
  }
}).join('\n\n')}

Matching Strategy: ${input.matching_strategy || 'semantic'}

Create a b-roll plan that:
1. Matches visuals to relevant voiceover segments
2. Times each visual to appear/disappear naturally
3. Ensures good pacing (don't change visuals too frequently)
4. Prioritizes semantic relevance

Return JSON:
{
  "matches": [
    {
      "voiceoverSegmentId": "seg-id",
      "visualAssetId": "asset-id",
      "startTime": 5.2,
      "endTime": 12.8,
      "reasoning": "Beach photo matches 'beach in Cancun' mention",
      "confidence": 0.95
    }
  ],
  "summary": "Matched X visuals to Y segments"
}`;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{ role: 'user', content: matchingPrompt }]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  
  const content = response.data.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const brollData = JSON.parse(jsonMatch![0]);
  
  logToChat(`✓ B-roll plan created`, {
    summary: brollData.summary,
    matches: brollData.matches.length
  });
  
  return {
    narrationAssetId: input.narration_asset_id,
    matches: brollData.matches,
    createdAt: new Date()
  };
}

interface BRollMatch {
  voiceoverSegmentId: string;
  visualAssetId: string;
  startTime: number;
  endTime: number;
  reasoning: string;
  confidence: number;
}

interface BRollPlan {
  narrationAssetId: string;
  matches: BRollMatch[];
  createdAt: Date;
}
```

### Console Logging in Chat

```typescript
// Replace all console.log with this
function logToChat(message: string, data?: any) {
  const timestamp = new Date().toLocaleTimeString();
  
  let content = `\`[${timestamp}]\` ${message}`;
  
  if (data) {
    const dataStr = JSON.stringify(data, null, 2);
    const truncated = dataStr.length > 500 
      ? dataStr.slice(0, 500) + '\n  ... (truncated)'
      : dataStr;
    
    content += `\n\`\`\`json\n${truncated}\n\`\`\``;
  }
  
  // Add to chat store
  const systemMessage: ChatMessage = {
    id: uuidv4(),
    role: 'system',
    content,
    timestamp: new Date()
  };
  
  // Update UI
  useChatStore.getState().addMessage(systemMessage);
}

// Usage examples throughout the codebase:
logToChat('✓ 12 videos uploaded', { totalDuration: '38m 50s' });
logToChat('📸 Extracting frames from run_thoughts_001.mov...');
logToChat('✓ Transcript cleaned', { 
  removedWords: 47,
  before: 'Um, so like, we went...',
  after: 'We went...'
});
logToChat('🎬 Orchestrating b-roll for 15 visual assets...');
logToChat('✓ B-roll plan created', { matches: 12 });
```

### Tool Execution (Updated)
async function executeTools(
  toolCalls: ToolCall[],
  context: ProjectContext
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  
  for (const call of toolCalls) {
    try {
      let output: any;
      
      switch (call.name) {
        case 'analyze_project':
          output = {
            num_assets: context.assets.length,
            total_duration: context.assets
              .filter(a => a.duration)
              .reduce((sum, a) => sum + (a.duration || 0), 0),
            assets: context.assets.map(a => ({
              id: a.id,
              type: a.type,
              filename: a.filename,
              has_transcript: !!a.transcript,
              has_analysis: !!a.imageAnalysis
            }))
          };
          break;
          
        case 'create_edit_plan':
          output = await createEditPlan(call.input, context);
          break;
          
        case 'update_timeline':
          output = await updateTimeline(call.input, context);
          break;
          
        case 'generate_overlay':
          output = await generateOverlay(call.input, context);
          break;
          
        case 'preview_segment':
          output = await setPreviewSegment(call.input);
          break;
          
        default:
          throw new Error(`Unknown tool: ${call.name}`);
      }
      
      results.push({
        toolCallId: call.id,
        output
      });
      
    } catch (error) {
      results.push({
        toolCallId: call.id,
        output: null,
        error: error.message
      });
    }
  }
  
  return results;
}
```

### Libraries
- `axios`: HTTP requests
- `eventsource-parser`: SSE parsing for streaming
- Claude API with tool use
- `js-tiktoken`: Token counting

---

## Step 4b: Enhanced Orchestration with Auto-Next-Action

### Automatic Action Determination

After each action completes, Claude determines the next action automatically:

```typescript
interface OrchestrationState {
  currentStep: WorkflowStep;
  completedActions: Action[];
  pendingActions: Action[];
  projectContext: ProjectContext;
  conversationHistory: ChatMessage[];
}

type WorkflowStep = 
  | 'asset_upload'
  | 'transcription'
  | 'image_analysis'
  | 'planning'
  | 'editing'
  | 'overlay_generation'
  | 'preview_iteration'
  | 'export';

// Main orchestration loop
async function orchestrate(
  userMessage: string | null,
  state: OrchestrationState
): Promise<OrchestrationResult> {
  
  // Track token usage
  const sessionTokens: TokenUsage[] = [];
  
  // Build the orchestration prompt
  const orchestrationPrompt = buildOrchestrationPrompt(
    state,
    userMessage
  );
  
  // Count input tokens
  const inputTokens = await countClaudeTokens(
    orchestrationPrompt,
    'claude-sonnet-4-20250514'
  );
  
  // Call Claude with action schema
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: ORCHESTRATION_SYSTEM_PROMPT,
      messages: orchestrationPrompt,
      temperature: 0.7
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  
  const content = response.data.content[0].text;
  
  // Track output tokens
  const outputTokens = content.length / 4; // Rough estimate
  const tokenUsage: TokenUsage = {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    model: 'claude-sonnet-4-20250514'
  };
  
  sessionTokens.push(tokenUsage);
  
  // Parse action from response
  const action = parseAction(content, tokenUsage);
  
  // Execute the action
  const result = await executeAction(action, state.projectContext);
  
  // Update state
  state.completedActions.push(action);
  state.currentStep = determineNextStep(action, state);
  
  // Determine if we should automatically proceed
  const shouldContinue = shouldAutoContinue(action, state);
  
  if (shouldContinue && !action.userMessage) {
    // Automatically determine next action
    return await orchestrate(null, state);
  }
  
  return {
    action,
    result,
    state,
    sessionTokens,
    totalCost: sessionTokens.reduce((sum, t) => sum + calculateCost(t), 0)
  };
}

// Orchestration system prompt
const ORCHESTRATION_SYSTEM_PROMPT = `You are the orchestration AI for a video editing application. Your role is to:

1. Analyze the current state of the project
2. Determine the next best action to take
3. Execute actions autonomously when appropriate
4. Ask the user for input when needed
5. Suggest missing content or improvements
6. Report issues in your own logic when detected

Current Workflow Steps:
- asset_upload: User uploads videos/images/audio
- transcription: Transcribe audio from videos
- image_analysis: Analyze and tag images
- planning: Create editing plan with user
- editing: Cut and arrange timeline
- overlay_generation: Create animated overlays
- preview_iteration: User reviews and refines
- export: Final video export

Action Format:
You must respond with a JSON action object:

{
  "actionName": "action_type",
  "payload": {
    // action-specific data
  },
  "reasoning": "Why you're taking this action",
  "userMessage": "Message to display to user (if any)",
  "nextActionSuggestion": "What might come next",
  "shouldWaitForUser": true/false,
  "contentSuggestions": [
    "Suggestion 1 for missing/better content",
    "Suggestion 2..."
  ],
  "issuesDetected": [
    "Issue 1 with my own logic/approach",
    "Issue 2..."
  ]
}

Available Actions:
- analyze_assets: Review uploaded content
- transcribe_videos: Trigger transcription
- analyze_images: Trigger image analysis
- create_plan: Generate editing plan
- request_clarification: Ask user for more info
- update_timeline: Modify video cuts
- generate_overlay: Create HTML/CSS/JS overlays
- suggest_content: Recommend additional footage/images
- report_issue: Flag problems in your logic
- preview_segment: Show specific time range
- execute_export: Start final render

Guidelines:
1. Be proactive - don't wait for user if next step is clear
2. Set shouldWaitForUser=true only when you need input/approval
3. Always provide contentSuggestions when you see gaps
4. Use issuesDetected to report when:
   - Your plan has logical flaws
   - You're missing important context
   - A better approach exists
   - Your code might be buggy
5. Be concise in userMessage - save details for reasoning
6. Think ahead with nextActionSuggestion

Remember: You're autonomous but collaborative. Move the project forward while keeping the user informed.`;

function buildOrchestrationPrompt(
  state: OrchestrationState,
  userMessage: string | null
): any[] {
  const messages = [];
  
  // Add conversation history (last 10 messages)
  const recentHistory = state.conversationHistory.slice(-10);
  messages.push(...recentHistory.map(m => ({
    role: m.role,
    content: m.content
  })));
  
  // Add current state summary
  const stateSummary = `
## Current Project State

**Workflow Step**: ${state.currentStep}

**Assets**: ${state.projectContext.assets.length} total
${state.projectContext.assets.map(a => 
  `- [${a.type}] ${a.filename} ${a.duration ? `(${a.duration.toFixed(1)}s)` : ''}`
).join('\n')}

**Completed Actions**: ${state.completedActions.length}
Last action: ${state.completedActions[state.completedActions.length - 1]?.actionName || 'none'}

**Timeline State**: ${state.projectContext.currentTimeline ? 'In progress' : 'Not started'}

**Transcription Progress**:
${state.projectContext.assets
  .filter(a => a.type === 'video' || a.type === 'audio')
  .map(a => `- ${a.filename}: ${a.transcript ? 'Complete' : 'Pending'}`)
  .join('\n')}

**Image Analysis Progress**:
${state.projectContext.assets
  .filter(a => a.type === 'image')
  .map(a => `- ${a.filename}: ${a.imageAnalysis ? 'Complete' : 'Pending'}`)
  .join('\n')}
`;
  
  messages.push({
    role: 'user',
    content: stateSummary
  });
  
  // Add user message if present
  if (userMessage) {
    messages.push({
      role: 'user',
      content: userMessage
    });
  } else {
    // Request next action
    messages.push({
      role: 'user',
      content: 'What should we do next? Respond with your action JSON.'
    });
  }
  
  return messages;
}

function parseAction(content: string, tokenUsage: TokenUsage): Action {
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid action JSON in response');
  }
  
  const actionData = JSON.parse(jsonMatch[0]);
  
  return {
    actionId: uuidv4(),
    actionName: actionData.actionName,
    payload: actionData.payload || {},
    reasoning: actionData.reasoning,
    userMessage: actionData.userMessage,
    nextActionSuggestion: actionData.nextActionSuggestion,
    tokenUsage,
    estimatedCost: calculateCost(tokenUsage),
    timestamp: new Date(),
    shouldWaitForUser: actionData.shouldWaitForUser,
    contentSuggestions: actionData.contentSuggestions || [],
    issuesDetected: actionData.issuesDetected || []
  };
}

async function executeAction(
  action: Action,
  context: ProjectContext
): Promise<any> {
  switch (action.actionName) {
    case 'analyze_assets':
      return analyzeAllAssets(context);
      
    case 'transcribe_videos':
      const videos = context.assets.filter(a => 
        a.type === 'video' && !a.transcript
      );
      return Promise.all(videos.map(v => transcribeAsset(v.id)));
      
    case 'analyze_images':
      const images = context.assets.filter(a => 
        a.type === 'image' && !a.imageAnalysis
      );
      return Promise.all(images.map(i => analyzeImage(i.id)));
      
    case 'create_plan':
      return createEditPlan(action.payload, context);
      
    case 'update_timeline':
      return updateTimeline(action.payload, context);
      
    case 'generate_overlay':
      return generateOverlay(action.payload, context);
      
    case 'suggest_content':
      // Just log suggestions, no execution needed
      return { suggestions: action.contentSuggestions };
      
    case 'report_issue':
      // Log issue for developer attention
      console.error('AI Reported Issue:', action.issuesDetected);
      return { issues: action.issuesDetected };
      
    default:
      throw new Error(`Unknown action: ${action.actionName}`);
  }
}

function shouldAutoContinue(
  action: Action,
  state: OrchestrationState
): boolean {
  // Don't continue if user input needed
  if (action.shouldWaitForUser) return false;
  
  // Don't continue if we just showed a message
  if (action.userMessage) return false;
  
  // Don't continue if we reported issues
  if (action.issuesDetected && action.issuesDetected.length > 0) return false;
  
  // Continue for automatic actions
  const autoContinueActions = [
    'transcribe_videos',
    'analyze_images',
    'analyze_assets'
  ];
  
  return autoContinueActions.includes(action.actionName);
}

function determineNextStep(
  action: Action,
  state: OrchestrationState
): WorkflowStep {
  // Logic to advance workflow step based on action
  const stepProgression: Record<string, WorkflowStep> = {
    'analyze_assets': 'transcription',
    'transcribe_videos': 'image_analysis',
    'analyze_images': 'planning',
    'create_plan': 'editing',
    'update_timeline': 'overlay_generation',
    'generate_overlay': 'preview_iteration',
  };
  
  return stepProgression[action.actionName] || state.currentStep;
}
```

### Token Usage Tracker Component

```typescript
// TokenUsageTracker.tsx
import React from 'react';

interface TokenUsageTrackerProps {
  actions: Action[];
}

export function TokenUsageTracker({ actions }: TokenUsageTrackerProps) {
  const totalUsage = actions.reduce((sum, action) => {
    return {
      inputTokens: sum.inputTokens + action.tokenUsage.inputTokens,
      outputTokens: sum.outputTokens + action.tokenUsage.outputTokens,
      totalTokens: sum.totalTokens + action.tokenUsage.totalTokens
    };
  }, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  
  const totalCost = actions.reduce(
    (sum, action) => sum + action.estimatedCost,
    0
  );
  
  // Group by model
  const byModel = actions.reduce((acc, action) => {
    const model = action.tokenUsage.model;
    if (!acc[model]) {
      acc[model] = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0
      };
    }
    acc[model].inputTokens += action.tokenUsage.inputTokens;
    acc[model].outputTokens += action.tokenUsage.outputTokens;
    acc[model].totalTokens += action.tokenUsage.totalTokens;
    acc[model].cost += action.estimatedCost;
    return acc;
  }, {} as Record<string, any>);
  
  return (
    <div className="token-usage-tracker">
      <div className="usage-summary">
        <div className="metric">
          <span className="label">Total Tokens:</span>
          <span className="value">{totalUsage.totalTokens.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="label">Total Cost:</span>
          <span className="value cost">${totalCost.toFixed(4)}</span>
        </div>
      </div>
      
      <div className="usage-breakdown">
        <h4>By Model</h4>
        {Object.entries(byModel).map(([model, usage]) => (
          <div key={model} className="model-usage">
            <div className="model-name">{model}</div>
            <div className="model-stats">
              <span>{usage.totalTokens.toLocaleString()} tokens</span>
              <span>${usage.cost.toFixed(4)}</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="recent-actions">
        <h4>Recent Actions</h4>
        {actions.slice(-5).reverse().map(action => (
          <div key={action.actionId} className="action-item">
            <div className="action-header">
              <span className="action-name">{action.actionName}</span>
              <span className="action-cost">${action.estimatedCost.toFixed(4)}</span>
            </div>
            <div className="action-tokens">
              {action.tokenUsage.totalTokens.toLocaleString()} tokens
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Step 5: Video Editing Plan Generation

### Components
- Claude API orchestration from Step 4

### Process Flow

```typescript
interface EditPlan {
  id: string;
  numVideos: number;
  videos: VideoSpec[];
  createdAt: Date;
  status: 'draft' | 'approved' | 'executing';
}

interface VideoSpec {
  index: number;
  theme: string;
  targetDuration: number;
  aspectRatio: string;
  platform: string;
  segments: SegmentSpec[];
  estimatedDuration: number;
}

interface SegmentSpec {
  assetId: string;
  startTime: number;
  endTime: number;
  transcriptText: string;
  order: number;
  reasoning: string;
}

// This is called by the create_edit_plan tool
async function createEditPlan(
  input: {
    num_videos: number;
    target_duration_per_video: number;
    aspect_ratio: string;
    themes: string[];
    platform: string;
  },
  context: ProjectContext
): Promise<EditPlan> {
  
  // Build a detailed prompt for Claude to analyze and create a plan
  const planningPrompt = `Based on the project assets and transcripts, create a detailed editing plan.

Requirements:
- ${input.num_videos} video(s)
- Target duration: ${input.target_duration_per_video}s each
- Aspect ratio: ${input.aspect_ratio}
- Platform: ${input.platform}
- Themes: ${input.themes.join(', ')}

Available Assets:
${context.assets.map(asset => {
  if (asset.type === 'video' || asset.type === 'audio') {
    return `
Asset: ${asset.id}
Duration: ${asset.duration}s
Transcript:
${asset.transcript?.segments.map(seg => 
  `[${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.text}`
).join('\n')}
`;
  } else {
    return `
Asset: ${asset.id} (IMAGE)
Description: ${asset.imageAnalysis?.description}
Tags: ${asset.imageAnalysis?.tags.join(', ')}
`;
  }
}).join('\n---\n')}

Create a JSON plan with this structure:
{
  "videos": [
    {
      "index": 0,
      "theme": "Theme description",
      "segments": [
        {
          "assetId": "asset-id",
          "startTime": 12.5,
          "endTime": 18.3,
          "transcriptText": "Exact words from transcript",
          "order": 0,
          "reasoning": "Why this segment fits the theme"
        }
      ]
    }
  ],
  "reasoning": "Overall strategy explanation"
}

Important:
- Only use exact words from the transcripts (no additions)
- Maintain natural flow and pacing
- Consider emotional beats and storytelling
- Leave room for overlays at key moments
- Respect the target duration (can be slightly under/over)`;

  // Call Claude again (nested call within tool execution)
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: planningPrompt
        }
      ]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  
  // Parse the plan
  const content = response.data.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const planData = JSON.parse(jsonMatch[0]);
  
  // Build EditPlan object
  const editPlan: EditPlan = {
    id: uuidv4(),
    numVideos: input.num_videos,
    videos: planData.videos.map((video: any) => ({
      ...video,
      targetDuration: input.target_duration_per_video,
      aspectRatio: input.aspect_ratio,
      platform: input.platform,
      estimatedDuration: video.segments.reduce(
        (sum: number, seg: any) => sum + (seg.endTime - seg.startTime),
        0
      )
    })),
    createdAt: new Date(),
    status: 'draft'
  };
  
  return editPlan;
}
```

### Response Format
```json
{
  "id": "plan-uuid",
  "numVideos": 2,
  "videos": [
    {
      "index": 0,
      "theme": "Morning run motivation",
      "targetDuration": 60,
      "aspectRatio": "9:16",
      "platform": "instagram",
      "segments": [
        {
          "assetId": "asset-video-1",
          "startTime": 5.2,
          "endTime": 12.8,
          "transcriptText": "I love starting my day with a run because...",
          "order": 0,
          "reasoning": "Strong opening hook about motivation"
        },
        {
          "assetId": "asset-video-2",
          "startTime": 45.0,
          "endTime": 52.3,
          "transcriptText": "The sunrise this morning was incredible...",
          "order": 1,
          "reasoning": "Visual moment, good place for image overlay"
        }
      ],
      "estimatedDuration": 58.9
    }
  ],
  "status": "draft"
}
```

---

## Step 6: Timeline Manipulation

### Components
- **Zustand Store** - Timeline state
- **React** - Timeline UI
- Custom timeline component

### Process Flow

```typescript
interface TimelineEdit {
  id: string;
  projectId: string;
  segments: TimelineSegment[];
  totalDuration: number;
  aspectRatio: string;
  updatedAt: Date;
}

interface TimelineSegment {
  id: string;
  assetId: string;
  startTime: number;      // Start in source asset
  endTime: number;        // End in source asset
  timelineStart: number;  // Position in final timeline
  timelineDuration: number;
  order: number;
  transition?: {
    type: 'cut' | 'fade' | 'dissolve';
    duration: number;
  };
}

// Zustand store
import create from 'zustand';

interface EditorStore {
  timeline: TimelineEdit | null;
  setTimeline: (timeline: TimelineEdit) => void;
  updateSegment: (segmentId: string, updates: Partial<TimelineSegment>) => void;
  addSegment: (segment: TimelineSegment) => void;
  removeSegment: (segmentId: string) => void;
  reorderSegments: (newOrder: string[]) => void;
}

const useEditorStore = create<EditorStore>((set) => ({
  timeline: null,
  
  setTimeline: (timeline) => set({ timeline }),
  
  updateSegment: (segmentId, updates) =>
    set((state) => {
      if (!state.timeline) return state;
      
      const segments = state.timeline.segments.map(seg =>
        seg.id === segmentId ? { ...seg, ...updates } : seg
      );
      
      return {
        timeline: {
          ...state.timeline,
          segments,
          updatedAt: new Date()
        }
      };
    }),
  
  addSegment: (segment) =>
    set((state) => {
      if (!state.timeline) return state;
      
      return {
        timeline: {
          ...state.timeline,
          segments: [...state.timeline.segments, segment],
          updatedAt: new Date()
        }
      };
    }),
  
  removeSegment: (segmentId) =>
    set((state) => {
      if (!state.timeline) return state;
      
      return {
        timeline: {
          ...state.timeline,
          segments: state.timeline.segments.filter(seg => seg.id !== segmentId),
          updatedAt: new Date()
        }
      };
    }),
  
  reorderSegments: (newOrder) =>
    set((state) => {
      if (!state.timeline) return state;
      
      const segmentMap = new Map(
        state.timeline.segments.map(seg => [seg.id, seg])
      );
      
      const segments = newOrder.map((id, index) => ({
        ...segmentMap.get(id)!,
        order: index
      }));
      
      // Recalculate timeline positions
      let currentTime = 0;
      segments.forEach(seg => {
        seg.timelineStart = currentTime;
        seg.timelineDuration = seg.endTime - seg.startTime;
        currentTime += seg.timelineDuration;
      });
      
      return {
        timeline: {
          ...state.timeline,
          segments,
          totalDuration: currentTime,
          updatedAt: new Date()
        }
      };
    })
}));

// Tool implementation
async function updateTimeline(
  input: {
    segments: {
      asset_id: string;
      start_time: number;
      end_time: number;
      order: number;
    }[];
    reasoning: string;
  },
  context: ProjectContext
): Promise<TimelineEdit> {
  
  const segments: TimelineSegment[] = input.segments
    .sort((a, b) => a.order - b.order)
    .map((seg, index) => {
      const duration = seg.end_time - seg.start_time;
      const timelineStart = input.segments
        .slice(0, index)
        .reduce((sum, s) => sum + (s.end_time - s.start_time), 0);
      
      return {
        id: uuidv4(),
        assetId: seg.asset_id,
        startTime: seg.start_time,
        endTime: seg.end_time,
        timelineStart,
        timelineDuration: duration,
        order: seg.order,
        transition: { type: 'cut', duration: 0 }
      };
    });
  
  const totalDuration = segments.reduce(
    (sum, seg) => sum + seg.timelineDuration,
    0
  );
  
  const timeline: TimelineEdit = {
    id: uuidv4(),
    projectId: context.assets[0]?.id || 'default', // Simplified
    segments,
    totalDuration,
    aspectRatio: '9:16', // From plan
    updatedAt: new Date()
  };
  
  // Update store
  useEditorStore.getState().setTimeline(timeline);
  
  return timeline;
}
```

### Timeline UI Component (simplified)

```typescript
// TimelineEditor.tsx
function TimelineEditor() {
  const timeline = useEditorStore(state => state.timeline);
  const updateSegment = useEditorStore(state => state.updateSegment);
  
  if (!timeline) return <div>No timeline loaded</div>;
  
  return (
    <div className="timeline-container">
      <div className="timeline-ruler">
        {/* Time markers */}
      </div>
      
      <div className="timeline-tracks">
        {timeline.segments.map(segment => (
          <TimelineSegment
            key={segment.id}
            segment={segment}
            onUpdate={(updates) => updateSegment(segment.id, updates)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Libraries
- `zustand`: State management
- `react-dnd`: Drag-and-drop for timeline
- Custom React components

---

## Step 7: Overlay Animation Generation

### Components
- **GSAP** - Animation library
- **Claude API** - HTML/CSS/JS generation

### Process Flow

```typescript
interface OverlayEvent {
  id: string;
  timestamp: number;
  duration: number;
  assetId: string;
  animation: string;
  position: string;
  size: string;
  customCSS?: string;
}

interface OverlaySpec {
  id: string;
  timelineId: string;
  events: OverlayEvent[];
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  createdAt: Date;
}

// Generate overlay code via Claude
async function generateOverlay(
  input: {
    overlay_events: {
      timestamp: number;
      duration: number;
      asset_id: string;
      animation: string;
      position: string;
      size: string;
    }[];
  },
  context: ProjectContext
): Promise<OverlaySpec> {
  
  // Build asset information
  const assetInfo = input.overlay_events.map(event => {
    const asset = context.assets.find(a => a.id === event.asset_id);
    return {
      id: event.asset_id,
      url: asset?.url || '',
      description: asset?.imageAnalysis?.description || '',
      colors: asset?.imageAnalysis?.dominantColors || []
    };
  });
  
  // PROMPT TEMPLATE for Overlay Generation
  const prompt = `Create HTML/CSS/JS code for animated video overlays.

Requirements:
- Use GSAP for animations (CDN: https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js)
- Synchronize with video via JavaScript (video.currentTime)
- Responsive design that works at ${context.currentTimeline?.aspectRatio || '9:16'}
- Clean, modern aesthetic
- Performance optimized (avoid heavy effects)

Overlay Events:
${input.overlay_events.map((event, i) => `
Event ${i + 1}:
  - Time: ${event.timestamp}s - ${event.timestamp + event.duration}s
  - Asset: ${event.asset_id}
  - Animation: ${event.animation}
  - Position: ${event.position}
  - Size: ${event.size}
  - Image Info: ${assetInfo[i]?.description}
`).join('\n')}

Asset URLs (use these IDs):
${assetInfo.map(a => `  ${a.id}: "${a.url}"`).join('\n')}

Generate THREE separate code blocks:

\`\`\`html
<!-- HTML structure -->
\`\`\`

\`\`\`css
/* CSS styles */
\`\`\`

\`\`\`javascript
// JavaScript with GSAP animations
// Assume: const video = document.getElementById('main-video');
\`\`\`

The JavaScript should:
1. Listen to video.ontimeupdate
2. Show/hide/animate overlays based on video.currentTime
3. Use GSAP for smooth animations
4. Handle both play and seek events
5. Clean up animations when overlays disappear

Keep animations smooth (60fps) and avoid flickering.`;

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    },
    {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }
  );
  
  // Parse code blocks
  const content = response.data.content[0].text;
  
  const htmlMatch = content.match(/```html\n([\s\S]*?)\n```/);
  const cssMatch = content.match(/```css\n([\s\S]*?)\n```/);
  const jsMatch = content.match(/```javascript\n([\s\S]*?)\n```/);
  
  if (!htmlMatch || !cssMatch || !jsMatch) {
    throw new Error('Failed to parse overlay code blocks');
  }
  
  const overlaySpec: OverlaySpec = {
    id: uuidv4(),
    timelineId: context.currentTimeline?.id || '',
    events: input.overlay_events.map(event => ({
      id: uuidv4(),
      ...event
    })),
    htmlCode: htmlMatch[1],
    cssCode: cssMatch[1],
    jsCode: jsMatch[1],
    createdAt: new Date()
  };
  
  return overlaySpec;
}
```

### Example Generated Code

```html
<!-- HTML -->
<div id="overlay-container" class="overlay-container">
  <div id="overlay-1" class="overlay-item" data-asset="asset-img-1">
    <img src="" alt="" />
  </div>
  <div id="overlay-2" class="overlay-item" data-asset="asset-img-2">
    <img src="" alt="" />
  </div>
</div>
```

```css
/* CSS */
.overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.overlay-item {
  position: absolute;
  opacity: 0;
  transform: translateX(-100%);
}

.overlay-item.position-topRight {
  top: 20px;
  right: 20px;
}

.overlay-item.size-medium img {
  width: 200px;
  height: auto;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
```

```javascript
// JavaScript (GSAP)
const video = document.getElementById('main-video');
const overlayContainer = document.getElementById('overlay-container');

const overlayTimeline = gsap.timeline({ paused: true });

// Event 1: Image slides in from left at 5.2s
overlayTimeline.add(() => {
  const overlay1 = document.getElementById('overlay-1');
  overlay1.querySelector('img').src = getAssetUrl('asset-img-1');
  
  gsap.fromTo(overlay1,
    { x: -300, opacity: 0 },
    { x: 0, opacity: 1, duration: 0.8, ease: 'power2.out' }
  );
}, 5.2);

// Event 1: Image slides out at 11.7s
overlayTimeline.add(() => {
  const overlay1 = document.getElementById('overlay-1');
  gsap.to(overlay1, {
    x: 300,
    opacity: 0,
    duration: 0.6,
    ease: 'power2.in'
  });
}, 11.7);

// Event 2: Second image fades in at 18.5s
overlayTimeline.add(() => {
  const overlay2 = document.getElementById('overlay-2');
  overlay2.querySelector('img').src = getAssetUrl('asset-img-2');
  
  gsap.fromTo(overlay2,
    { scale: 0.5, opacity: 0 },
    { scale: 1, opacity: 1, duration: 1, ease: 'back.out(1.7)' }
  );
}, 18.5);

// Sync with video
let lastTime = 0;
video.ontimeupdate = () => {
  const currentTime = video.currentTime;
  
  // Handle seeking
  if (Math.abs(currentTime - lastTime) > 0.5) {
    overlayTimeline.seek(currentTime);
  } else {
    overlayTimeline.time(currentTime);
  }
  
  lastTime = currentTime;
};

// Helper
function getAssetUrl(assetId) {
  // Look up asset URL from context
  return assetUrls[assetId];
}
```

### Libraries
- `gsap`: Animation library (CDN)
- Monaco Editor: Code editing UI

---

## Step 8: Real-Time Preview Engine

### Components
- **video.js** or native `<video>` - Video playback
- **GSAP** - Overlay animations
- **React** - UI components

### Process Flow

```typescript
// PreviewPlayer.tsx
import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';

interface PreviewPlayerProps {
  timeline: TimelineEdit;
  overlaySpec: OverlaySpec;
}

function PreviewPlayer({ timeline, overlaySpec }: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  
  const [currentSegment, setCurrentSegment] = useState<TimelineSegment | null>(null);
  
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Initialize video.js (optional, can use native video)
    const player = videojs(videoRef.current, {
      controls: true,
      fluid: true,
      aspectRatio: timeline.aspectRatio
    });
    
    playerRef.current = player;
    
    return () => {
      player.dispose();
    };
  }, []);
  
  useEffect(() => {
    if (!playerRef.current || !timeline) return;
    
    // Set up segment switching
    const video = videoRef.current!;
    
    video.ontimeupdate = () => {
      const timelineTime = video.currentTime;
      
      // Find current segment
      const segment = timeline.segments.find(
        seg => timelineTime >= seg.timelineStart &&
               timelineTime < seg.timelineStart + seg.timelineDuration
      );
      
      if (segment && segment !== currentSegment) {
        switchToSegment(segment, timelineTime);
        setCurrentSegment(segment);
      }
    };
    
  }, [timeline, currentSegment]);
  
  useEffect(() => {
    if (!overlaySpec || !overlayRef.current) return;
    
    // Inject overlay code
    injectOverlayCode(overlaySpec);
    
  }, [overlaySpec]);
  
  function switchToSegment(segment: TimelineSegment, timelineTime: number) {
    const video = videoRef.current!;
    
    // Get the asset
    const asset = assets.find(a => a.id === segment.assetId);
    if (!asset) return;
    
    // Calculate position within segment
    const segmentOffset = timelineTime - segment.timelineStart;
    const sourceTime = segment.startTime + segmentOffset;
    
    // Switch video source
    video.src = asset.url;
    video.currentTime = sourceTime;
    video.play();
  }
  
  function injectOverlayCode(spec: OverlaySpec) {
    const container = overlayRef.current!;
    
    // Clear existing
    container.innerHTML = '';
    
    // Inject HTML
    container.innerHTML = spec.htmlCode;
    
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = spec.cssCode;
    container.appendChild(style);
    
    // Inject JS (safely)
    const script = document.createElement('script');
    script.textContent = spec.jsCode;
    container.appendChild(script);
  }
  
  return (
    <div className="preview-container" style={{ position: 'relative' }}>
      {/* Video layer */}
      <video
        ref={videoRef}
        className="video-js"
        style={{ width: '100%', height: 'auto' }}
      />
      
      {/* Overlay layer */}
      <div
        ref={overlayRef}
        className="overlay-layer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}
```

### Segment Switching Logic

The key challenge is smoothly switching between video segments. Here's the approach:

```typescript
// SegmentPlayer.ts
class SegmentPlayer {
  private video: HTMLVideoElement;
  private timeline: TimelineEdit;
  private virtualTime: number = 0; // Time in the final timeline
  private currentSegmentIndex: number = 0;
  
  constructor(video: HTMLVideoElement, timeline: TimelineEdit) {
    this.video = video;
    this.timeline = timeline;
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    this.video.addEventListener('timeupdate', () => {
      this.handleTimeUpdate();
    });
    
    this.video.addEventListener('seeking', () => {
      this.handleSeeking();
    });
  }
  
  private handleTimeUpdate() {
    const segment = this.timeline.segments[this.currentSegmentIndex];
    if (!segment) return;
    
    // Calculate virtual timeline position
    const segmentProgress = this.video.currentTime - segment.startTime;
    this.virtualTime = segment.timelineStart + segmentProgress;
    
    // Check if we've reached end of segment
    if (this.video.currentTime >= segment.endTime) {
      this.advanceToNextSegment();
    }
    
    // Emit custom event for overlays to sync
    this.emitTimeUpdate(this.virtualTime);
  }
  
  private async advanceToNextSegment() {
    this.currentSegmentIndex++;
    
    const nextSegment = this.timeline.segments[this.currentSegmentIndex];
    if (!nextSegment) {
      // End of timeline
      this.video.pause();
      return;
    }
    
    // Load next segment
    await this.loadSegment(nextSegment);
    this.video.play();
  }
  
  private async loadSegment(segment: TimelineSegment) {
    const asset = await db.assets.get(segment.assetId);
    if (!asset) throw new Error('Asset not found');
    
    // Only change source if different asset
    if (this.video.src !== asset.url) {
      this.video.src = asset.url;
      await new Promise(resolve => {
        this.video.onloadedmetadata = resolve;
      });
    }
    
    this.video.currentTime = segment.startTime;
  }
  
  public seek(timelineTime: number) {
    // Find segment containing this time
    const segmentIndex = this.timeline.segments.findIndex(
      seg => timelineTime >= seg.timelineStart &&
             timelineTime < seg.timelineStart + seg.timelineDuration
    );
    
    if (segmentIndex === -1) return;
    
    const segment = this.timeline.segments[segmentIndex];
    const offset = timelineTime - segment.timelineStart;
    const sourceTime = segment.startTime + offset;
    
    this.currentSegmentIndex = segmentIndex;
    this.loadSegment(segment).then(() => {
      this.video.currentTime = sourceTime;
    });
  }
  
  private emitTimeUpdate(time: number) {
    const event = new CustomEvent('virtualTimeUpdate', {
      detail: { time }
    });
    this.video.dispatchEvent(event);
  }
}
```

### Libraries
- `video.js`: Enhanced video player (optional)
- `gsap`: Overlay animations
- Native Web APIs: video element, CustomEvent

---

## Step 9: Export & Compositing

### Components
- **FFmpeg.wasm** or server-side FFmpeg
- **Canvas API** + **MediaRecorder** (alternative)

### Process Flow

```typescript
interface ExportConfig {
  format: 'mp4' | 'mov';
  quality: 'high' | 'medium' | 'low';
  resolution: '1080p' | '720p' | '4K';
  aspectRatio: string;
  includeOverlays: boolean;
}

// Method 1: FFmpeg-based export
async function exportWithFFmpeg(
  timeline: TimelineEdit,
  overlaySpec: OverlaySpec | null,
  config: ExportConfig
): Promise<Blob> {
  
  const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = createFFmpeg({ log: true });
  
  await ffmpeg.load();
  
  // Step 1: Create video-only timeline
  const videoFilter = await createVideoFilter(timeline, ffmpeg);
  
  // Step 2: If overlays, render them to video
  let overlayVideo: Blob | null = null;
  if (config.includeOverlays && overlaySpec) {
    overlayVideo = await renderOverlaysToVideo(overlaySpec, timeline, config);
  }
  
  // Step 3: Composite
  let outputName = 'output.mp4';
  
  if (overlayVideo) {
    // Add overlay as separate input
    ffmpeg.FS('writeFile', 'overlay.webm', await fetchFile(overlayVideo));
    
    await ffmpeg.run(
      '-i', 'main.mp4',
      '-i', 'overlay.webm',
      '-filter_complex', '[1:v]colorkey=0x00FF00:0.3:0.2[ckout];[0:v][ckout]overlay[out]',
      '-map', '[out]',
      '-map', '0:a',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', getCRF(config.quality),
      outputName
    );
  } else {
    // Just process main video
    await ffmpeg.run(
      ...videoFilter,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', getCRF(config.quality),
      outputName
    );
  }
  
  const data = ffmpeg.FS('readFile', outputName);
  const blob = new Blob([data.buffer], { type: 'video/mp4' });
  
  return blob;
}

async function createVideoFilter(
  timeline: TimelineEdit,
  ffmpeg: any
): Promise<string[]> {
  // Build complex filter for segment concatenation
  
  const filterParts: string[] = [];
  const inputs: string[] = [];
  
  for (let i = 0; i < timeline.segments.length; i++) {
    const segment = timeline.segments[i];
    const asset = await db.assets.get(segment.assetId);
    
    if (!asset) continue;
    
    // Write asset to FFmpeg FS
    const filename = `input${i}.mp4`;
    ffmpeg.FS('writeFile', filename, await fetchFile(asset.blob));
    
    inputs.push('-i', filename);
    
    // Trim to segment
    filterParts.push(
      `[${i}:v]trim=start=${segment.startTime}:end=${segment.endTime},setpts=PTS-STARTPTS[v${i}];` +
      `[${i}:a]atrim=start=${segment.startTime}:end=${segment.endTime},asetpts=PTS-STARTPTS[a${i}]`
    );
  }
  
  // Concatenate all segments
  const vInputs = timeline.segments.map((_, i) => `[v${i}]`).join('');
  const aInputs = timeline.segments.map((_, i) => `[a${i}]`).join('');
  
  filterParts.push(
    `${vInputs}concat=n=${timeline.segments.length}:v=1:a=0[outv];` +
    `${aInputs}concat=n=${timeline.segments.length}:v=0:a=1[outa]`
  );
  
  const filterComplex = filterParts.join('');
  
  return [
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[outv]',
    '-map', '[outa]'
  ];
}

// Method 2: Canvas-based overlay rendering
async function renderOverlaysToVideo(
  overlaySpec: OverlaySpec,
  timeline: TimelineEdit,
  config: ExportConfig
): Promise<Blob> {
  
  // Create off-screen canvas
  const canvas = document.createElement('canvas');
  const { width, height } = getResolution(config.resolution, config.aspectRatio);
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  
  // Set up MediaRecorder
  const stream = canvas.captureStream(60); // 60 fps
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 8000000
  });
  
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  
  recorder.start();
  
  // Render each frame
  const fps = 60;
  const frameDuration = 1000 / fps;
  const totalFrames = Math.ceil(timeline.totalDuration * fps);
  
  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    
    // Clear canvas with green (for chroma key)
    ctx.fillStyle = '#00FF00';
    ctx.fillRect(0, 0, width, height);
    
    // Find active overlays at this time
    const activeOverlays = overlaySpec.events.filter(
      event => time >= event.timestamp && time < event.timestamp + event.duration
    );
    
    // Render each overlay
    for (const overlay of activeOverlays) {
      await renderOverlay(ctx, overlay, time, width, height);
    }
    
    // Wait for next frame
    await new Promise(resolve => setTimeout(resolve, frameDuration));
  }
  
  recorder.stop();
  
  return new Promise(resolve => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };
  });
}

async function renderOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: OverlayEvent,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const asset = await db.assets.get(overlay.assetId);
  if (!asset || asset.type !== 'image') return;
  
  // Load image
  const img = new Image();
  img.src = asset.url;
  await img.decode();
  
  // Calculate position and size
  const { x, y, width, height } = calculateOverlayLayout(
    overlay,
    canvasWidth,
    canvasHeight
  );
  
  // Apply animation transform
  const progress = (currentTime - overlay.timestamp) / overlay.duration;
  const transform = getAnimationTransform(overlay.animation, progress);
  
  ctx.save();
  ctx.globalAlpha = transform.opacity;
  ctx.translate(x + transform.translateX, y + transform.translateY);
  ctx.scale(transform.scale, transform.scale);
  ctx.drawImage(img, -width/2, -height/2, width, height);
  ctx.restore();
}

function getCRF(quality: string): string {
  switch (quality) {
    case 'high': return '18';
    case 'medium': return '23';
    case 'low': return '28';
    default: return '23';
  }
}

function getResolution(res: string, aspectRatio: string) {
  // Map resolution + aspect ratio to width/height
  const ratios: Record<string, [number, number]> = {
    '9:16': [9, 16],
    '16:9': [16, 9],
    '1:1': [1, 1],
    '4:5': [4, 5]
  };
  
  const [rw, rh] = ratios[aspectRatio] || [16, 9];
  
  switch (res) {
    case '1080p':
      return aspectRatio === '9:16' 
        ? { width: 1080, height: 1920 }
        : { width: 1920, height: 1080 };
    case '720p':
      return aspectRatio === '9:16'
        ? { width: 720, height: 1280 }
        : { width: 1280, height: 720 };
    case '4K':
      return aspectRatio === '9:16'
        ? { width: 2160, height: 3840 }
        : { width: 3840, height: 2160 };
    default:
      return { width: 1920, height: 1080 };
  }
}
```

### Export UI Component

```typescript
function ExportDialog({ timeline, overlaySpec }: ExportDialogProps) {
  const [config, setConfig] = useState<ExportConfig>({
    format: 'mp4',
    quality: 'high',
    resolution: '1080p',
    aspectRatio: timeline.aspectRatio,
    includeOverlays: true
  });
  
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  async function handleExport() {
    setExporting(true);
    
    try {
      const blob = await exportWithFFmpeg(timeline, overlaySpec, config);
      
      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${Date.now()}.${config.format}`;
      a.click();
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    } finally {
      setExporting(false);
    }
  }
  
  return (
    <div className="export-dialog">
      <h2>Export Video</h2>
      
      {/* Config options */}
      <div className="export-options">
        <label>
          Quality:
          <select value={config.quality} onChange={e => setConfig({...config, quality: e.target.value})}>
            <option value="high">High (18 CRF)</option>
            <option value="medium">Medium (23 CRF)</option>
            <option value="low">Low (28 CRF)</option>
          </select>
        </label>
        
        <label>
          Resolution:
          <select value={config.resolution} onChange={e => setConfig({...config, resolution: e.target.value})}>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="4K">4K</option>
          </select>
        </label>
        
        <label>
          <input
            type="checkbox"
            checked={config.includeOverlays}
            onChange={e => setConfig({...config, includeOverlays: e.target.checked})}
          />
          Include Overlays
        </label>
      </div>
      
      <button onClick={handleExport} disabled={exporting}>
        {exporting ? `Exporting... ${progress}%` : 'Export'}
      </button>
    </div>
  );
}
```

### Libraries
- `@ffmpeg/ffmpeg`: FFmpeg.wasm
- Canvas API + MediaRecorder: Browser-native compositing
- Native download via blob URLs

---

## UI Layout Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Top Bar / Header                           │
│  [Project Name] [Token Usage: 45.2K ($0.68)] [Export] [Settings]  │
├───────────────────────────────────────┬─────────────────────────────┤
│                                       │                             │
│                                       │    CHAT INTERFACE           │
│         MAIN CONTENT AREA            │    (Always Visible)         │
│                                       │                             │
│  [Assets View] [Preview] [Code]      │  ┌───────────────────────┐ │
│                                       │  │  User: Let's make a   │ │
│  Dynamically changes based on         │  │  video about...       │ │
│  workflow step:                       │  └───────────────────────┘ │
│  1. Asset Upload & Review             │  ┌───────────────────────┐ │
│  2. Transcript Review                 │  │  Claude: I'll analyze │ │
│  3. Planning Phase                    │  │  your content...      │ │
│  4. Preview & Iteration               │  └───────────────────────┘ │
│  5. Code Editor (overlays)            │                             │
│                                       │  [Type message...]          │
│                                       │                             │
├───────────────────────────────────────┴─────────────────────────────┤
│                      TIMELINE EDITOR                                │
│  (Always visible at bottom, like traditional editors)              │
│  ═══════════════════════════════════════════════════════            │
│  ║ Video Track  [====][====][==]                                   │
│  ║ Audio Track  [===================]                              │
│  ║ Overlay Track     [===]  [===]                                  │
│  ═══════════════════════════════════════════════════════            │
│  [00:00:00]────────────────────────────────────────[00:01:30]      │
└─────────────────────────────────────────────────────────────────────┘
```

The main content area changes views based on the workflow step, while chat and timeline remain constant.

## Action-Based Orchestration System

### Action Schema

Every AI decision results in an Action object:

```typescript
interface Action {
  actionId: string;           // Unique ID for tracking
  actionName: string;         // Type of action
  payload: ActionPayload;     // Action-specific data
  reasoning: string;          // Why this action
  userMessage?: string;       // Message to show user
  nextActionSuggestion?: string; // What might come next
  tokenUsage: TokenUsage;     // Tokens used for this action
  estimatedCost: number;      // Cost in USD
  timestamp: Date;
}

interface ActionPayload {
  [key: string]: any;         // Action-specific parameters
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
}

// Example Action Types
type ActionName = 
  | 'analyze_assets'
  | 'create_plan'
  | 'update_timeline'
  | 'generate_overlay'
  | 'suggest_content'
  | 'report_issue'
  | 'request_clarification'
  | 'execute_plan';
```

### Token Cost Lookup Table

```typescript
const MODEL_COSTS = {
  // OpenAI (per 1M tokens)
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'whisper-1': { input: 0.006 }, // per minute
  
  // Anthropic (per 1M tokens)
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },
  'claude-haiku-4-20250514': { input: 0.25, output: 1.25 },
  
  // Image analysis (per image)
  'gpt-4-vision': { input: 0.01 },
  'claude-vision': { input: 0.003 }
};

function calculateCost(usage: TokenUsage): number {
  const costs = MODEL_COSTS[usage.model];
  if (!costs) return 0;
  
  const inputCost = (usage.inputTokens / 1_000_000) * costs.input;
  const outputCost = (usage.outputTokens / 1_000_000) * (costs.output || 0);
  
  return inputCost + outputCost;
}
```

### Token Counting Implementation

```typescript
import { encoding_for_model } from 'js-tiktoken';
import Anthropic from '@anthropic-ai/sdk';

// For OpenAI models
function countOpenAITokens(text: string, model: string): number {
  const encoding = encoding_for_model(model);
  const tokens = encoding.encode(text);
  const count = tokens.length;
  encoding.free();
  return count;
}

// For Claude models (official method)
const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

async function countClaudeTokens(messages: any[], model: string): Promise<number> {
  const result = await anthropic.messages.countTokens({
    model,
    messages
  });
  return result.input_tokens;
}

// Wrapper for tracking
async function trackTokenUsage(
  input: string | any[],
  output: string,
  model: string
): Promise<TokenUsage> {
  let inputTokens: number;
  
  if (model.startsWith('claude')) {
    inputTokens = await countClaudeTokens(
      typeof input === 'string' ? [{ role: 'user', content: input }] : input,
      model
    );
  } else {
    inputTokens = countOpenAITokens(
      typeof input === 'string' ? input : JSON.stringify(input),
      model
    );
  }
  
  const outputTokens = model.startsWith('claude')
    ? countOpenAITokens(output, 'gpt-4') // Approximate
    : countOpenAITokens(output, model);
  
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    model
  };
}
```

## Summary: Complete Library List

### Core Framework
- **React** - UI framework
- **Next.js** - Full-stack React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling

### State & Storage
- **Zustand** - State management
- **Dexie.js** - IndexedDB wrapper
- **UUID** - ID generation

### Media Processing
- **@ffmpeg/ffmpeg** or **Remotion** - Video editing/compositing
- **video.js** - Enhanced video player (optional)
- **Etro** (alternative) - Programmatic video editing

### File Handling
- **react-dropzone** - File upload UI

### Animations
- **GSAP** - Professional animation library
- **Remotion** (if used) - React-based video animations

### Code Editing
- **Monaco Editor** (@monaco-editor/react) - VS Code-like code editor

### API Clients
- **axios** - HTTP requests
- **eventsource-parser** - SSE parsing for streaming

### Token Counting & Cost Tracking
- **js-tiktoken** - OpenAI token counting
- **@anthropic-ai/sdk** - Claude token counting (official)

### UI Components
- **react-dnd** - Drag and drop (for timeline)
- **@radix-ui/react-*** - Headless UI components
- Custom timeline components

### External APIs
- **OpenAI Whisper API** - Transcription
- **Claude API** - Orchestration, vision, code generation
- **GPT-4V API** - Alternative vision

### Build Tools
- **Vite** or **Next.js** - Build system
- **ESLint** + **Prettier** - Code quality

---

## Next Steps for MVP

1. **Set up project structure**
   - Next.js app with TypeScript
   - Install dependencies
   - Configure Tailwind

2. **Implement asset upload & storage**
   - React Dropzone component
   - IndexedDB schema with Dexie
   - Asset list UI

3. **Build transcription pipeline**
   - OpenAI Whisper API integration
   - Progress indicators
   - Transcript viewer

4. **Build image analysis pipeline**
   - Claude Vision API integration
   - Analysis viewer/editor

5. **Implement chat interface**
   - Chat UI component
   - Claude API with tool use
   - Streaming responses

6. **Build timeline editor**
   - Timeline component
   - Segment manipulation
   - Zustand store integration

7. **Implement preview player**
   - Video player with segment switching
   - Overlay injection
   - Sync mechanism

8. **Build overlay generator**
   - Claude code generation
   - Monaco editor integration
   - GSAP animations

9. **Implement export**
   - FFmpeg.wasm integration
   - Export dialog
   - Progress tracking

10. **Polish & test**
    - Error handling
    - Loading states
    - Edge cases

Would you like me to start generating the actual code structure now, or do you have any questions about this technical walkthrough?