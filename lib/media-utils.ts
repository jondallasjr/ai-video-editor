/**
 * Get duration of video or audio file
 */
export function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const isVideo = file.type.startsWith('video');
    const media = document.createElement(isVideo ? 'video' : 'audio');

    media.preload = 'metadata';

    media.onloadedmetadata = () => {
      resolve(media.duration);
      URL.revokeObjectURL(media.src);
    };

    media.onerror = () => {
      URL.revokeObjectURL(media.src);
      reject(new Error('Failed to load media metadata'));
    };

    media.src = URL.createObjectURL(file);
  });
}

/**
 * Determine asset type from file
 */
export function determineAssetType(file: File): 'video' | 'audio' | 'image' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';

  // Fallback to extension check
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext || '')) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext || '')) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'image';

  throw new Error(`Unsupported file type: ${file.type || file.name}`);
}

/**
 * Check if video file has audio track
 */
export async function hasAudioTrack(videoFile: File): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(videoFile);

    video.onloadedmetadata = () => {
      // Different browsers expose audio detection differently
      const hasAudio =
        // @ts-ignore - Firefox
        video.mozHasAudio ||
        // @ts-ignore - Safari
        Boolean(video.webkitAudioDecodedByteCount) ||
        // Modern browsers
        Boolean(video.audioTracks && video.audioTracks.length > 0);

      URL.revokeObjectURL(video.src);
      resolve(hasAudio);
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(false);
    };

    video.load();
  });
}

/**
 * Extract frames from video at even intervals
 */
export async function extractVideoFrames(
  videoBlob: Blob,
  count: number = 3
): Promise<Blob[]> {
  const video = document.createElement('video');
  video.src = URL.createObjectURL(videoBlob);

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
    video.load();
  });

  const frames: Blob[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Extract frames at even intervals
  const interval = video.duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    video.currentTime = interval * i;
    await new Promise(resolve => {
      video.onseeked = resolve;
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create blob from canvas'));
      }, 'image/jpeg', 0.85);
    });

    frames.push(blob);
  }

  URL.revokeObjectURL(video.src);
  return frames;
}

/**
 * Convert blob to base64 (useful for API calls)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
