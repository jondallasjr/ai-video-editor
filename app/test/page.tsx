'use client';

import { useState } from 'react';
import { db } from '@/lib/db';
import { uploadAsset, getAllAssets, deleteAsset, getAssetsByType } from '@/lib/assets';
import { determineAssetType, formatFileSize, formatDuration } from '@/lib/media-utils';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'running';
  error?: string;
}

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);

    // Test 1: Database connection
    try {
      addResult({ name: 'Database connection', status: 'running' });
      await db.open();
      setResults(prev => prev.map(r =>
        r.name === 'Database connection' ? { ...r, status: 'pass' } : r
      ));
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'Database connection' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 2: determineAssetType function
    try {
      addResult({ name: 'determineAssetType - video', status: 'running' });
      const videoFile = new File([''], 'test.mp4', { type: 'video/mp4' });
      const videoType = determineAssetType(videoFile);
      if (videoType === 'video') {
        setResults(prev => prev.map(r =>
          r.name === 'determineAssetType - video' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error(`Expected 'video', got '${videoType}'`);
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'determineAssetType - video' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 3: determineAssetType - audio
    try {
      addResult({ name: 'determineAssetType - audio', status: 'running' });
      const audioFile = new File([''], 'test.mp3', { type: 'audio/mpeg' });
      const audioType = determineAssetType(audioFile);
      if (audioType === 'audio') {
        setResults(prev => prev.map(r =>
          r.name === 'determineAssetType - audio' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error(`Expected 'audio', got '${audioType}'`);
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'determineAssetType - audio' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 4: determineAssetType - image
    try {
      addResult({ name: 'determineAssetType - image', status: 'running' });
      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const imageType = determineAssetType(imageFile);
      if (imageType === 'image') {
        setResults(prev => prev.map(r =>
          r.name === 'determineAssetType - image' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error(`Expected 'image', got '${imageType}'`);
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'determineAssetType - image' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 5: formatFileSize function
    try {
      addResult({ name: 'formatFileSize', status: 'running' });
      const result1 = formatFileSize(1024);
      const result2 = formatFileSize(1048576);
      const result3 = formatFileSize(0);
      if (result1 === '1 KB' && result2 === '1 MB' && result3 === '0 Bytes') {
        setResults(prev => prev.map(r =>
          r.name === 'formatFileSize' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error(`formatFileSize failed: ${result1}, ${result2}, ${result3}`);
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'formatFileSize' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 6: formatDuration function
    try {
      addResult({ name: 'formatDuration', status: 'running' });
      const result1 = formatDuration(90);
      const result2 = formatDuration(3661);
      if (result1 === '1:30' && result2 === '61:01') {
        setResults(prev => prev.map(r =>
          r.name === 'formatDuration' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error(`formatDuration failed: ${result1}, ${result2}`);
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'formatDuration' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 7: Asset upload (image) and storage
    let testAssetId: string | null = null;
    try {
      addResult({ name: 'Upload image asset to IndexedDB', status: 'running' });

      // Create a simple test image (1x1 pixel PNG)
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const binary = atob(base64Data);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: 'image/png' });
      const testFile = new File([blob], 'test-image.png', { type: 'image/png' });

      const asset = await uploadAsset(testFile);
      testAssetId = asset.id;

      if (asset.id && asset.type === 'image' && asset.filename === 'test-image.png') {
        setResults(prev => prev.map(r =>
          r.name === 'Upload image asset to IndexedDB' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error('Asset properties not as expected');
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'Upload image asset to IndexedDB' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 8: Get all assets
    try {
      addResult({ name: 'Get all assets from IndexedDB', status: 'running' });
      const assets = await getAllAssets();
      if (Array.isArray(assets) && assets.length > 0) {
        setResults(prev => prev.map(r =>
          r.name === 'Get all assets from IndexedDB' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error('No assets found');
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'Get all assets from IndexedDB' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 9: Get assets by type
    try {
      addResult({ name: 'Get assets by type', status: 'running' });
      const images = await getAssetsByType('image');
      if (Array.isArray(images) && images.length > 0 && images[0].type === 'image') {
        setResults(prev => prev.map(r =>
          r.name === 'Get assets by type' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error('getAssetsByType failed');
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'Get assets by type' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 10: Delete asset
    try {
      addResult({ name: 'Delete asset from IndexedDB', status: 'running' });
      if (testAssetId) {
        await deleteAsset(testAssetId);
        const assets = await getAllAssets();
        const found = assets.find(a => a.id === testAssetId);
        if (!found) {
          setResults(prev => prev.map(r =>
            r.name === 'Delete asset from IndexedDB' ? { ...r, status: 'pass' } : r
          ));
        } else {
          throw new Error('Asset was not deleted');
        }
      } else {
        throw new Error('No test asset ID to delete');
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'Delete asset from IndexedDB' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    // Test 11: Database tables exist
    try {
      addResult({ name: 'Database schema - tables exist', status: 'running' });
      const tables = db.tables.map(t => t.name);
      const requiredTables = ['assets', 'projects', 'timelines', 'overlays'];
      const allExist = requiredTables.every(t => tables.includes(t));
      if (allExist) {
        setResults(prev => prev.map(r =>
          r.name === 'Database schema - tables exist' ? { ...r, status: 'pass' } : r
        ));
      } else {
        throw new Error(`Missing tables. Found: ${tables.join(', ')}`);
      }
    } catch (e) {
      setResults(prev => prev.map(r =>
        r.name === 'Database schema - tables exist' ? { ...r, status: 'fail', error: String(e) } : r
      ));
    }

    setIsRunning(false);
  };

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Phase 1 Test Suite
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tests for Asset Upload & Storage Module
        </p>

        <button
          onClick={runTests}
          disabled={isRunning}
          className={`
            px-6 py-3 rounded-lg font-medium text-white
            ${isRunning
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }
          `}
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>

        {results.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex gap-4">
              <span className="text-green-600 dark:text-green-400 font-medium">
                Passed: {passCount}
              </span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                Failed: {failCount}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                Total: {results.length}
              </span>
            </div>

            <div className="space-y-2">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`
                    p-4 rounded-lg border
                    ${result.status === 'pass'
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : result.status === 'fail'
                      ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                      : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {result.status === 'pass' && (
                      <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    {result.status === 'fail' && (
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    {result.status === 'running' && (
                      <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                    )}
                    <span className={`font-medium ${
                      result.status === 'pass' ? 'text-green-700 dark:text-green-300' :
                      result.status === 'fail' ? 'text-red-700 dark:text-red-300' :
                      'text-yellow-700 dark:text-yellow-300'
                    }`}>
                      {result.name}
                    </span>
                  </div>
                  {result.error && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-mono">
                      {result.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
