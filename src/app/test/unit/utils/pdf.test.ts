import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { serviceWorker } from '../../../src/service-worker'
import { getFileIcon, isAudioFile, isImageFile, isMediaFile, isPdfFile, isVideoFile, MEDIA_EXTENSIONS } from '../../../src/utils/file'

describe('PDF media support', () => {
  it.each(['/documents/guide.pdf', '/documents/GUIDE.PDF'])('classifies %s as a document, without exposing it in image/video pickers', (path) => {
    expect(isMediaFile(path)).toBe(true)
    expect(isPdfFile(path)).toBe(true)
    expect(isImageFile(path)).toBe(false)
    expect(isVideoFile(path)).toBe(false)
    expect(isAudioFile(path)).toBe(false)
    expect(getFileIcon(path)).toBe('i-lucide-file-text')
    expect(MEDIA_EXTENSIONS).toContain('pdf')
  })

  it('does not allow arbitrary document extensions', () => {
    expect(isMediaFile('/document.exe')).toBe(false)
    expect(isPdfFile('/document.pdf.exe')).toBe(false)
  })

  it.each(['guide.pdf', 'GUIDE.PDF'])('serves unpublished %s bytes with the PDF content type', async (name) => {
    const context = {
      self: { addEventListener() {} },
      URL,
      Response,
      Uint8Array,
      atob,
      console: { log() {} },
    }
    const worker = runInNewContext(`${serviceWorker()}
      getData = async () => JSON.stringify({
        status: 'created', modified: { raw: 'data:application/pdf;base64,JVBERi0xLjcK' }
      });
      ({ extractImagePath, fetchFromIndexedDB })
    `, context)
    const path = `/documents/${name}`
    expect(worker.extractImagePath(new URL(`https://example.com${path}?v=1`))).toBe(path)
    const response = await worker.fetchFromIndexedDB({}, path)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(await response.text()).toBe('%PDF-1.7\n')
  })
})
