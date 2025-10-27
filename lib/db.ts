import Dexie, { Table } from 'dexie';
import type { Asset, Project, TimelineEdit, OverlaySpec } from './types';

export class VideoEditorDB extends Dexie {
  assets!: Table<Asset, string>;
  projects!: Table<Project, string>;
  timelines!: Table<TimelineEdit, string>;
  overlays!: Table<OverlaySpec, string>;

  constructor() {
    super('VideoEditorDB');

    this.version(1).stores({
      assets: 'id, type, filename, metadata.uploadedAt',
      projects: 'id, name, createdAt, updatedAt',
      timelines: 'id, projectId, updatedAt',
      overlays: 'id, timelineId, updatedAt'
    });
  }
}

// Export singleton instance
export const db = new VideoEditorDB();
