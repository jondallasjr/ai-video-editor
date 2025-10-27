import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import type { Asset } from './types';
import { determineAssetType, getMediaDuration, extractVideoFrames, hasAudioTrack } from './media-utils';

/**
 * Handle file upload and store in IndexedDB
 */
export async function uploadAsset(file: File): Promise<Asset> {
  const type = determineAssetType(file);

  const asset: Asset = {
    id: uuidv4(),
    type,
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
  if (type === 'video' || type === 'audio') {
    try {
      asset.duration = await getMediaDuration(file);
    } catch (error) {
      console.error('Failed to get media duration:', error);
      asset.duration = 0;
    }
  }

  // Store in IndexedDB
  await db.assets.add(asset);

  return asset;
}

/**
 * Upload multiple files
 */
export async function uploadAssets(files: File[]): Promise<Asset[]> {
  const assets: Asset[] = [];

  for (const file of files) {
    try {
      const asset = await uploadAsset(file);
      assets.push(asset);
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      throw error;
    }
  }

  return assets;
}

/**
 * Get all assets from database
 */
export async function getAllAssets(): Promise<Asset[]> {
  return await db.assets.toArray();
}

/**
 * Get asset by ID
 */
export async function getAsset(id: string): Promise<Asset | undefined> {
  return await db.assets.get(id);
}

/**
 * Delete asset
 */
export async function deleteAsset(id: string): Promise<void> {
  const asset = await db.assets.get(id);
  if (asset) {
    // Revoke object URL to free memory
    URL.revokeObjectURL(asset.url);
    await db.assets.delete(id);
  }
}

/**
 * Update asset
 */
export async function updateAsset(id: string, changes: Partial<Asset>): Promise<void> {
  await db.assets.update(id, changes);
}

/**
 * Get assets by type
 */
export async function getAssetsByType(type: 'video' | 'audio' | 'image'): Promise<Asset[]> {
  return await db.assets.where('type').equals(type).toArray();
}

/**
 * Extract frames from video and store as separate image assets
 * This is useful for b-roll matching in vacation videos
 */
export async function processVideoFrames(videoAsset: Asset): Promise<Asset[]> {
  if (videoAsset.type !== 'video') {
    throw new Error('Asset must be a video');
  }

  const frames = await extractVideoFrames(videoAsset.blob, 3);
  const frameAssets: Asset[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frameAsset: Asset = {
      id: uuidv4(),
      type: 'image',
      filename: `${videoAsset.filename}_frame_${i}.jpg`,
      blob: frames[i],
      url: URL.createObjectURL(frames[i]),
      metadata: {
        size: frames[i].size,
        mimeType: 'image/jpeg',
        uploadedAt: new Date(),
        extractedFrom: videoAsset.id,
        timestamp: (videoAsset.duration! / 4) * (i + 1)
      }
    };

    await db.assets.add(frameAsset);
    frameAssets.push(frameAsset);
  }

  return frameAssets;
}
