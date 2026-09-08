import type { ExtensionConfig, StudioHost } from '../types'
import { ContentFileExtension } from '../types'
import { CONTENT_EXTENSIONS } from './file'
import { slugifyString } from './string'
import { joinURL, withoutLeadingSlash } from 'ufo'

export function getCandidateFilePath(folder: string, name: string, prefix: string | null | undefined, extension: string | null | undefined) {
  const baseName = slugifyString(name)
  const fullName = prefix ? `${prefix}.${baseName}` : baseName
  return withoutLeadingSlash(joinURL(folder, `${fullName}.${extension || ''}`)).toLowerCase()
}

export function getContentExtensionConfig(
  collection: StudioHost['collection'],
  folder: string,
  name: string,
  prefix?: string | null,
): ExtensionConfig {
  // Before a name is entered, offer extensions for an ordinary new file in
  // this folder. Recompute with the real name as soon as the user types, so
  // filename-specific includes and excludes use the host's exact matcher too.
  const allowed = CONTENT_EXTENSIONS.filter(extension => collection.getByFsPath(
    getCandidateFilePath(folder, name || 'new-file', prefix, extension),
  ))

  return {
    allowed,
    default: allowed.includes(ContentFileExtension.Markdown) ? ContentFileExtension.Markdown : allowed[0],
    editable: allowed.length > 1,
  }
}
