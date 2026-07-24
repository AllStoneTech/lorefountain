/**
 * Pure, `vscode`-free detection of whether a folder already has some form of
 * loss protection — either an initialized git repository (walking up parent
 * directories, since a workspace folder may be a subdirectory of a larger
 * repo) or sitting inside a recognized consumer cloud-sync folder. Backs the
 * git-safety warning banner (Spec §13.7).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Case-insensitive path-segment fragments recognized as an already-synced,
 * already-backed-up location. Not exhaustive — the spec doesn't enumerate
 * "other recognized backup mechanisms", so this covers the common consumer
 * cloud-sync services most likely to appear in a writer's folder path.
 */
const CLOUD_SYNC_MARKERS = ['onedrive', 'dropbox', 'google drive', 'googledrive', 'icloud drive', 'iclouddrive'];

/**
 * Checks whether `folderPath` or any of its ancestor directories contains a
 * `.git` directory, so a workspace folder nested inside a larger repository
 * is still correctly recognized as version-controlled.
 *
 * @param folderPath - Absolute path to the folder to check.
 * @returns `true` if a `.git` directory is found at or above `folderPath`.
 */
export function hasGitAncestor(folderPath: string): boolean {
  let current = path.resolve(folderPath);
  for (;;) {
    if (fs.existsSync(path.join(current, '.git'))) return true;
    const parent = path.dirname(current);
    if (parent === current) return false;
    current = parent;
  }
}

/**
 * Checks whether `folderPath` sits inside a recognized consumer cloud-sync
 * folder (OneDrive, Dropbox, Google Drive, iCloud Drive), treated as an
 * "other recognized backup mechanism" per Spec §13.7.
 *
 * @param folderPath - Absolute path to the folder to check.
 * @returns `true` if the path contains a recognized cloud-sync marker.
 */
export function hasCloudSyncPath(folderPath: string): boolean {
  const normalized = folderPath.toLowerCase();
  return CLOUD_SYNC_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * Checks whether `folderPath` already has some recognized form of loss
 * protection — git or a cloud-sync folder — per Spec §13.7.
 *
 * @param folderPath - Absolute path to the folder to check.
 * @returns `true` if git or a recognized cloud-sync path already protects this folder.
 */
export function hasRecognizedBackup(folderPath: string): boolean {
  return hasGitAncestor(folderPath) || hasCloudSyncPath(folderPath);
}
