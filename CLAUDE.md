# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered video editing tool that transforms rambling recordings into polished social media content. This is an early-stage project (currently just initialized with boilerplate) that will combine AI transcription, video analysis, and automated editing workflows.

## Development Commands

**Start development server:**
```bash
npm run dev
```
Server runs at http://localhost:3000

**Build for production:**
```bash
npm build
```

**Lint code:**
```bash
npm run lint
```

**Start production server:**
```bash
npm start
```

## Environment Setup

Create `.env.local` with required API keys:
```
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

Test assets (videos/images) should be placed in `public/assets/` (this directory is gitignored).

## Architecture

### Tech Stack
- **Framework:** Next.js 14 with App Router (React 19)
- **TypeScript:** Strict mode enabled
- **Video Rendering:** Remotion for programmatic video generation and export
- **Storage:** IndexedDB via Dexie for client-side asset and project data
- **AI Services:**
  - Claude (Anthropic SDK) for chat interface and editing orchestration
  - Whisper (OpenAI) for audio transcription
- **UI:** Tailwind CSS 4 + GSAP for animations
- **Additional:** Monaco Editor for code/transcript editing, js-tiktoken for token counting

### Project Structure
- `app/` - Next.js App Router pages and layouts
- `docs/specs/` - Technical specifications (currently placeholder files)
- `public/assets/` - User-uploaded test assets (gitignored)

### Key Configuration
- **React Compiler:** Enabled in `next.config.ts` for automatic performance optimizations
- **Path Alias:** `@/*` maps to project root
- **Fonts:** Geist Sans and Geist Mono loaded via next/font/google

## Planned Features (MVP Phase)

The codebase is prepared for these core workflows:
1. **Asset Upload & Storage** - IndexedDB-based media management
2. **Transcription & Analysis** - Whisper integration with frame extraction
3. **Chat Orchestration** - Claude-powered editing interface with token tracking
4. **Timeline Editing** - Visual timeline with transcript cleanup (filler word removal) and B-roll matching
5. **Export** - Remotion-based video rendering

## Notes

- This is a new project with minimal implementation - most features listed in README are planned, not built
- Specs in `docs/specs/` are currently empty placeholder files
- No test framework is configured yet
- The project uses React 19 and Next.js 16 (relatively new versions)
