import type { MediaAccept } from '../../../module/src/schema'
import type { StudioHost, TreeItem } from '../types'
import { isImageFile, isPdfFile } from './file'

export function acceptsMedia(path: string, accept: MediaAccept[] = ['image/*']) {
  return (accept.includes('image/*') && isImageFile(path))
    || (accept.includes('application/pdf') && isPdfFile(path))
}

export function isPdfUrl(url: string) {
  return isPdfFile(url.split(/[?#]/)[0])
}

export async function resolveMediaSelectionUrl(media: TreeItem, host: Pick<StudioHost, 'meta' | 'media'>) {
  if (!host.meta.media?.external) return media.routePath || media.fsPath

  // Tree listings can contain only storage keys. Read the storage metadata
  // rather than constructing a URL from a key that omits the storage prefix.
  const path = /^https?:\/\//i.test(media.routePath || '')
    ? media.routePath
    : (await host.media.get(media.fsPath))?.path
  if (!path || !/^https?:\/\//i.test(path)) {
    throw new Error('The selected file has no public URL. Check external media storage configuration.')
  }
  return path
}
