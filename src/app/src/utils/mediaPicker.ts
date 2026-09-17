import type { MediaAccept } from '../../../module/src/schema'
import type { StudioHost, TreeItem } from '../types'
import { isImageFile, isPdfFile } from './file'

export type ImageDimensions = {
  width: number
  height: number
}

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

/** Load an image at its full URL and return its intrinsic pixel dimensions. */
export function loadImageDimensions(src: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new globalThis.Image()

    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        resolve({ width, height })
        return
      }

      reject(new Error('The selected image has no intrinsic dimensions.'))
    }
    image.onerror = () => reject(new Error('The selected image dimensions could not be loaded.'))
    image.src = src
  })
}
