import { describe, expect, it } from 'vitest'
import type { CollectionInfo } from '@nuxt/content'
import { getCollectionByFilePath } from '../../../../module/src/runtime/utils/collection'
import { getCandidateFilePath, getContentExtensionConfig } from '../../../src/utils/contentCreation'

function collections(...sources: { include: string, exclude?: string[] }[]) {
  const list = sources.map((source, i) => ({ name: `collection${i}`, source: [source] }) as CollectionInfo)
  return {
    list: () => list,
    getByFsPath: (path: string) => getCollectionByFilePath(path, Object.fromEntries(list.map(c => [c.name, c]))),
  }
}

describe('content creation extensions', () => {
  it.each([
    ['blog/*.md', 'blog', ['md'], 'md'],
    ['printables/*.yaml', 'printables', ['yaml'], 'yaml'],
    ['printables/*.yml', 'printables', ['yml'], 'yml'],
    ['data/*.json', 'data', ['json'], 'json'],
  ])('preselects the single extension for %s', (include, folder, allowed, defaultExtension) => {
    expect(getContentExtensionConfig(collections({ include }), folder, '')).toEqual({
      allowed, default: defaultExtension, editable: false,
    })
  })

  it('expands braces and unions overlapping collections without duplicates', () => {
    const host = collections({ include: 'printables/*.{yml,yaml}' }, { include: 'printables/*.yaml' })
    expect(getContentExtensionConfig(host, 'printables', '').allowed).toEqual(['yaml', 'yml'])
    expect(getContentExtensionConfig(host, 'printables', '').default).toBe('yaml')
    expect(getContentExtensionConfig(host, 'printables', '').editable).toBe(true)
  })

  it('prefers Markdown only if a matching collection allows it', () => {
    expect(getContentExtensionConfig(collections({ include: '**/*.{yaml,md}' }), 'pages', '').default).toBe('md')
  })

  it('respects exclusions without masking another matching collection', () => {
    const host = collections(
      { include: '**/*.{md,yaml}', exclude: ['printables/**'] },
      { include: 'printables/*.yaml', exclude: ['printables/private*'] },
    )
    expect(getContentExtensionConfig(host, 'printables', 'worksheet').allowed).toEqual(['yaml'])
    expect(getContentExtensionConfig(host, 'printables', 'private-notes').allowed).toEqual([])
  })

  it('does not offer extensions for unmatched folders or descendants of a shallow source', () => {
    const host = collections({ include: 'blog/*.md' })
    for (const folder of ['other', 'blog/nested']) {
      expect(getContentExtensionConfig(host, folder, '')).toEqual({ allowed: [], default: undefined, editable: false })
    }
  })

  it('matches literal filenames, numeric prefixes, and normalized paths', () => {
    const host = collections({ include: 'data/2.worksheet.yaml' })
    expect(getContentExtensionConfig(host, '/data', 'Worksheet', '2').allowed).toEqual(['yaml'])
    expect(getContentExtensionConfig(host, '/data', 'Worksheet', '3').allowed).toEqual([])
    expect(getCandidateFilePath('/data', 'My Worksheet', '2', 'yaml')).toBe('data/2.my-worksheet.yaml')
  })
})
