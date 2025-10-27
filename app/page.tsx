'use client';

import { useState } from 'react';
import AssetUpload from '@/components/AssetUpload';
import type { Asset } from '@/lib/types';

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>([]);

  const handleAssetsUploaded = (newAssets: Asset[]) => {
    setAssets(prev => [...prev, ...newAssets]);
    console.log('Assets uploaded:', newAssets);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            AI Video Editor
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Transform rambling recordings into polished social media content
          </p>
        </header>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Phase 1: Asset Upload & Storage
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload your videos, audio files, and images to get started
          </p>

          <AssetUpload onAssetsUploaded={handleAssetsUploaded} />
        </div>

        {/* Stats */}
        {assets.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Asset Summary
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {assets.filter(a => a.type === 'video').length}
                </div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Videos</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {assets.filter(a => a.type === 'audio').length}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">Audio Files</div>
              </div>
              <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {assets.filter(a => a.type === 'image').length}
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">Images</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
