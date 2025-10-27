# AI Video Editor

AI-powered video editing tool that transforms rambling recordings into polished social media content.

## Features (MVP)

- 🎤 Audio transcription (Whisper)
- 🖼️ Video frame extraction & analysis
- 🧹 Transcript cleanup (removes filler words)
- 🎬 B-roll orchestration (semantic matching)
- 💬 AI chat interface for editing
- 📊 Token cost tracking
- 🎥 Export via Remotion

## Tech Stack

- **Framework:** Next.js 14 + TypeScript
- **Video:** Remotion
- **Storage:** IndexedDB (Dexie)
- **AI:** Claude (Anthropic) + Whisper (OpenAI)
- **UI:** Tailwind CSS + GSAP

## Getting Started

1. Install dependencies:
```bash
   npm install
```

2. Create `.env.local`:
```
   OPENAI_API_KEY=your_key_here
   ANTHROPIC_API_KEY=your_key_here
```

3. Run development server:
```bash
   npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Documentation

See `docs/specs/` for detailed technical specifications.

## Development Plan

- [ ] Phase 1: Asset upload & storage
- [ ] Phase 1: Transcription & analysis  
- [ ] Phase 1: Chat orchestration
- [ ] Phase 1: Timeline editing
- [ ] Phase 1: Export
- [ ] Phase 2: Overlays & animations

## Testing

Add test videos/images to `public/assets/` (gitignored).