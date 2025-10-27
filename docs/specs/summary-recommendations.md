# AI Video Editor - Summary & Recommendations

## Executive Summary

After thorough research and detailed scenario planning, here's what we've learned:

### Key Findings

**1. Modern Libraries Available (2024-2025)**
- **Remotion** - React-based programmatic video creation (most popular, well-maintained)
- **Etro** - TypeScript video editing framework
- **Editly** - Node.js video assembly tool
- **js-tiktoken** - Token counting for OpenAI
- **@anthropic-ai/sdk** - Official Claude token counting

**2. API Keys Required**
- OpenAI API Key (Whisper transcription + optional GPT-4V vision)
- Anthropic Claude API Key (orchestration, vision, code generation)

**3. Cost Estimates (Based on Dummy Scenario)**
- 12 videos (39 minutes) → **$0.45 total**
  - Transcription: $0.23 (51%)
  - AI orchestration: $0.21 (47%)
  - Image analysis: $0.01 (2%)
- **Very affordable** for MVP

**4. Processing Time**
- Transcription: 2-3 minutes (parallel processing)
- AI planning: 5-10 seconds per action
- Export: 2-3 minutes per video
- **Total session: ~15 minutes** for 2 finished reels

---

## Recommended Architecture Changes

### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: [Project] [Tokens: 45K ($0.68)] [Export] [Settings]   │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│  MAIN CONTENT AREA             │    CHAT PANE                  │
│  (changes by workflow step)     │    (always visible)           │
│                                 │                               │
│  Steps:                         │  • Auto-progresses            │
│  1. Asset Upload & Review       │  • Shows AI reasoning         │
│  2. Transcript Review           │  • Content suggestions        │
│  3. Planning                    │  • Self-reported issues       │
│  4. Preview & Edit              │  • Token tracking             │
│  5. Code Editor                 │                               │
│                                 │                               │
├─────────────────────────────────┴───────────────────────────────┤
│                    TIMELINE EDITOR                              │
│  (always visible at bottom, traditional editor style)          │
└─────────────────────────────────────────────────────────────────┘
```

### Action-Based Orchestration

Every AI decision is an Action object:
```typescript
{
  actionId: "uuid",
  actionName: "update_timeline",
  payload: { /* action-specific data */ },
  reasoning: "Why I'm doing this",
  userMessage: "What to tell user",
  nextActionSuggestion: "What comes next",
  shouldWaitForUser: false,  // Auto-proceed?
  contentSuggestions: [...],
  issuesDetected: [...],  // AI self-critique
  tokenUsage: {...},
  estimatedCost: 0.0023
}
```

**Benefits:**
- Full transparency
- Easy debugging
- Clear cost tracking
- Autonomous operation with checkpoints

---

## Key Insights from Dummy Scenario

### What Works Really Well

1. **Autonomous Progression**
   - Upload → Transcribe → Analyze → Plan happens automatically
   - User only intervenes for approvals and tweaks
   - 5 min of user time, 10 min of AI time

2. **Intelligent Content Suggestions**
   - AI identified specific images needed with exact timestamps
   - Suggested *where* to find them ("search for: melancholy robot edward hopper")
   - Recognized missing elements (music, better lighting)
   - **NEW:** Suggests screenshots (Wikipedia, book covers, search results)
   - **NEW:** Suggests charts/graphs for data visualization

3. **Self-Awareness**
   - AI reported: "I said 60s but delivered 67s"
   - Flagged: "No image search feature exists yet"
   - Honest about limitations

4. **Natural Conversation**
   - No rigid menu systems
   - User can ask for changes anytime
   - AI understands context from full conversation
   - **NEW:** All logs visible in chat (truncated if long)

5. **Token Efficiency**
   - Most cost is transcription (one-time, unavoidable)
   - Planning/orchestration is cheap
   - Streaming keeps costs down

6. **Video Frame Analysis**
   - **NEW:** Extracts 3 frames per video for visual content analysis
   - Enables b-roll matching for vacation/vlog content
   - Works even without useful audio

7. **Transcript Cleanup**
   - **NEW:** Removes filler words (um, uh, like, you know)
   - Preserves meaning and speaker's voice
   - Maintains timestamp accuracy

### What Needs Improvement

1. **Missing Features for MVP+1:**
   - ~~Image search integration~~ (cut for MVP)
   - ~~Music library~~ (cut for MVP)
   - Screenshot capture automation (manual for now)

2. **Export Speed:**
   - Browser-based FFmpeg is slow (2-3 min per video)
   - **Solution:** Use Remotion (confirmed)

3. **Asset Management:**
   - No project saving/loading shown
   - Need: Export project file, resume later

### New Use Cases Supported

**Vacation/Vlog B-Roll:**
- User records voiceover describing trip
- Uploads 20+ photos/videos from vacation
- AI extracts frames from videos
- AI matches visuals to voiceover semantically
- Creates polished video with natural b-roll cuts

**Example:**
```
Voiceover: "We visited this amazing beach in Cancun..."
→ AI finds beach photo/video
→ Places as b-roll from 5.2s - 9.8s
→ Natural timing, no jarring cuts
```

---

## Technical Recommendations

### Use Remotion Instead of FFmpeg.wasm

**Reasons:**
1. Much faster rendering
2. React-based (fits our stack)
3. Built-in timeline management
4. Professional output quality
5. Active development & community

**Tradeoff:**
- Requires license for commercial use ($300/year/company)
- But: Free for solo developers, evaluation, small teams

### Implement in Phases

**Phase 1 - Core Video Editing (Week 1-2):**
- Asset upload & IndexedDB storage
- **Video frame extraction** (3 frames per video)
- **Whisper transcription** (OpenAI API)
- **Claude vision analysis** (frames + images)
- **Transcript cleanup** (remove filler words)
- Basic orchestration system
- **B-roll matching** for vacation videos
- Simple timeline (cuts only, no transitions)
- Export to MP4 via Remotion

**Phase 2 - Overlays & Charts (Week 3-4):**
- Text overlay generation
- Image overlay animation (GSAP)
- **Chart/graph generation** (Chart.js, D3.js)
- Monaco editor for overlay code
- Real-time preview with overlays
- Token tracking UI

**Phase 3 - Polish (Week 5+):**
- Beautiful timeline editor UI
- Transition effects
- Project save/load
- Export optimization
- Screenshot automation (optional)

---

## API Keys Required

You'll need **TWO API keys**:

### 1. OpenAI API Key
**Used for:**
- Whisper audio transcription ($0.006/minute)
- *Optional:* GPT-4V for image analysis (if not using Claude Vision)

**Get it:**
- https://platform.openai.com/api-keys
- Requires payment method
- Pay-as-you-go pricing

### 2. Anthropic Claude API Key  
**Used for:**
- Vision analysis (images + video frames) ($0.003/image)
- Chat orchestration (all AI decisions)
- Planning & code generation
- Transcript cleanup
- B-roll matching

**Get it:**
- https://console.anthropic.com/
- $5 free credit for new accounts
- Pay-as-you-go after that

**Note:** Claude **does not** offer audio transcription, which is why we need both APIs.

---

## Prompt Engineering Patterns

Based on the dummy scenario, here are the winning prompt patterns:

### 1. System Prompt Structure
```
You are [role]. Your job is to:
1. [Primary goal]
2. [Secondary goal]
3. [Tertiary goal]

Current Context: [dynamic data]

Action Format: [JSON schema]

Guidelines:
- Be proactive
- Report issues honestly
- Suggest improvements
- Think ahead
```

### 2. State Summary Pattern
```
## Current Project State
**Step**: [current step]
**Assets**: [count and summary]
**Progress**: [what's done/pending]
**Last Action**: [previous action]

What should we do next?
```

### 3. Response Format (Structured)
```json
{
  "actionName": "...",
  "payload": {...},
  "reasoning": "Internal logic",
  "userMessage": "User-facing text",
  "nextActionSuggestion": "What's next",
  "shouldWaitForUser": true/false,
  "contentSuggestions": [...],
  "issuesDetected": [...]
}
```

This structure:
- Separates reasoning from user messaging
- Enables autonomous operation
- Provides transparency
- Tracks decisions

---

## Cost Projections

### Typical Session Costs

**Small Project (3-5 videos, 15 min total):**
- Transcription: $0.09
- Orchestration: $0.08
- Vision: $0.01
- **Total: ~$0.18**

**Medium Project (10-15 videos, 40 min total):**
- Transcription: $0.24
- Orchestration: $0.20
- Vision: $0.02
- **Total: ~$0.46**

**Large Project (30+ videos, 2 hours total):**
- Transcription: $0.72
- Orchestration: $0.50
- Vision: $0.05
- **Total: ~$1.27**

### Monthly User Estimates

**Light User (2 projects/month):**
- $0.90/month

**Regular User (10 projects/month):**
- $4.50/month

**Heavy User (50 projects/month):**
- $23.00/month

**Business/Agency (200 projects/month):**
- $92.00/month

**Conclusion:** API costs are *very* manageable. The real cost is development time, not AI usage.

---

## Risk Assessment

### Technical Risks

1. **FFmpeg Browser Performance** (High)
   - **Risk:** Slow exports frustrate users
   - **Mitigation:** Use Remotion or server-side rendering

2. **Large File Storage** (Medium)
   - **Risk:** IndexedDB has 1GB+ limits
   - **Mitigation:** Implement cleanup, warn users

3. **Token Context Limits** (Low)
   - **Risk:** Very long transcripts exceed context
   - **Mitigation:** Summarize or chunk long sessions

### Product Risks

1. **Complexity for Non-Technical Users** (Medium)
   - **Risk:** Editing HTML/CSS scares users
   - **Mitigation:** Start technical, add visual editor later

2. **AI Hallucinations** (Low)
   - **Risk:** Bad edits, wrong timestamps
   - **Mitigation:** Always show preview, user approval

3. **Competition** (Low for MVP)
   - **Risk:** OpusClip, Descript exist
   - **Mitigation:** Your multi-video approach is unique

---

## Go / No-Go Decision

### ✅ GO - This is a Great Idea

**Reasons:**
1. **Technical feasibility**: All pieces exist and work together
2. **Reasonable costs**: $0.45 per project is nothing
3. **Clear differentiation**: Multi-video orchestration is unique
4. **Fast MVP**: 4-5 weeks to working prototype
5. **Scalable**: Can start simple, add features iteratively

### 🎯 Success Metrics for MVP

**Week 1-2 Goal:**
- Upload 5 videos
- Get transcripts
- Generate 1-video plan
- See timeline

**Week 3-4 Goal:**
- Preview with overlays
- Export to MP4
- Token tracking works
- Cost under $0.50 per session

**Week 5-6 Goal:**
- 10 test users create videos
- Average satisfaction: 4+/5
- Average session: <20 minutes
- Bug rate: <5% of sessions

---

## Next Steps

1. **Provide API Keys** (whenever ready - I'll keep them secure)
   - OpenAI API Key
   - Anthropic Claude API Key

2. **Start with Phase 1** (Asset Upload + Transcription)
   - Set up Next.js project
   - Install dependencies
   - Create IndexedDB schema
   - Implement upload UI

3. **Use Claude Code** to build it
   - I'll guide you through each component
   - We'll test as we go
   - Iterate based on what works

4. **Reference Documents:**
   - Technical walkthrough for architecture
   - Dummy scenario for expected behavior
   - This summary for key decisions

---

## Questions Before We Start Coding?

- UI framework preference? (I recommend Next.js + Tailwind)
- Want to use Remotion or stick with FFmpeg? (I recommend Remotion)
- Deploy locally first or set up hosting? (Local first)
- Any features to deprioritize? (Image search, music can wait)

**Ready when you are!** 🚀