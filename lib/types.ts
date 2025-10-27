// Core asset types
export interface Asset {
  id: string; // UUID
  type: 'video' | 'audio' | 'image';
  filename: string;
  blob: Blob;
  url: string; // ObjectURL for preview
  duration?: number; // For video/audio
  metadata: AssetMetadata;
  // Populated later:
  transcript?: Transcript;
  imageAnalysis?: ImageAnalysis;
}

export interface AssetMetadata {
  size: number;
  mimeType: string;
  uploadedAt: Date;
  extractedFrom?: string; // For video frames
  timestamp?: number; // For extracted frames
}

// Transcript types
export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  id: string;
  start: number; // seconds
  end: number; // seconds
  text: string;
  words?: TranscriptWord[]; // word-level timestamps
}

export interface Transcript {
  assetId: string;
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
  processedAt: Date;
}

// Image analysis types
export interface ImageAnalysis {
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
    portrait: CropRegion;
    landscape: CropRegion;
    square: CropRegion;
  };
  processedAt: Date;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Project types
export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  assetIds: string[]; // References to assets
  timeline?: TimelineEdit;
}

// Timeline types
export interface TimelineSegment {
  id: string;
  assetId: string;
  startTime: number; // Source asset start time
  endTime: number; // Source asset end time
  timelineStart: number; // Position in final timeline
  timelineDuration: number;
  order: number;
  transition?: Transition;
}

export interface Transition {
  type: 'cut' | 'fade' | 'dissolve';
  duration: number;
}

export interface TimelineEdit {
  id: string;
  projectId: string;
  segments: TimelineSegment[];
  totalDuration: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  updatedAt: Date;
}

// Overlay types
export interface OverlayEvent {
  timestamp: number;
  duration: number;
  assetId?: string; // For image overlays
  animation: string;
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  size: 'small' | 'medium' | 'large';
}

export interface OverlaySpec {
  id: string;
  timelineId: string;
  events: OverlayEvent[];
  htmlCode?: string;
  cssCode?: string;
  jsCode?: string;
  updatedAt: Date;
}
