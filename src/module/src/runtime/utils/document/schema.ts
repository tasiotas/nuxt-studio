import type { CollectionInfo, CollectionItemBase } from '@nuxt/content'
import type { DatabaseItem, DatabasePageItem } from 'nuxt-studio/app'
import { getOrderedSchemaKeys } from '../collection'
import { omit, pick } from '../object'
import { cleanUrlSegment } from '../url'
import { addPageTypeFields, generateTitleFromPath, parseDocumentId } from './utils'

export const reservedKeys = ['id', 'fsPath', 'stem', 'extension', '__hash__', 'path', 'body', 'meta', 'rawbody']

function cloneSchemaDefault(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneSchemaDefault)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneSchemaDefault(item)]))
  }

  return value
}

export function applyCollectionSchema(id: string, collectionInfo: CollectionInfo, document: CollectionItemBase) {
  let parsedContent = { ...document, id } as DatabaseItem
  if (collectionInfo.type === 'page') {
    parsedContent = addPageTypeFields(parsedContent)
  }

  const result = { id } as DatabaseItem
  const meta = parsedContent.meta

  const collectionKeys = getOrderedSchemaKeys(collectionInfo.schema)
  const properties = Object.values(collectionInfo.schema.definitions)[0]?.properties || {}

  if (collectionKeys.includes('title') && parsedContent.title === undefined) {
    const { basename } = parseDocumentId(id)
    parsedContent.title = generateTitleFromPath(cleanUrlSegment(basename))
  }

  for (const key of collectionKeys) {
    const property = properties[key]
    if (parsedContent[key] === undefined && property && 'default' in property && property.default !== undefined) {
      parsedContent[key] = cloneSchemaDefault(property.default)
    }
  }

  for (const key of Object.keys(parsedContent)) {
    if (collectionKeys.includes(key)) {
      result[key] = parsedContent[key as keyof typeof parsedContent]
    }
    else {
      meta[key] = parsedContent[key as keyof typeof parsedContent]
    }
  }

  // Clean fsPath from meta to avoid storing it in the database
  if (meta.fsPath) {
    Reflect.deleteProperty(meta, 'fsPath')
  }

  result.meta = meta

  // Storing `content` into `rawbody` field
  // TODO: handle rawbody
  // if (collectionKeys.includes('rawbody')) {
  //   result.rawbody = result.rawbody ?? file.body
  // }

  if (collectionKeys.includes('seo')) {
    // DO NOT mutate the input's seo object
    const seo = { ...((result.seo as DatabasePageItem['seo']) || {}) }
    seo.title = seo.title || result.title as string
    seo.description = seo.description || result.description as string
    result.seo = seo
  }

  return result
}

export function pickReservedKeysFromDocument(document: DatabaseItem): DatabaseItem {
  return pick(document, reservedKeys) as DatabaseItem
}

export function cleanDataKeys(document: DatabaseItem): DatabaseItem {
  const result = omit(document, reservedKeys)
  // Default value of navigation is true, so we can safely remove it.
  // D1 may store booleans as strings, so handle both 'true' and true.
  if (result.navigation === true || result.navigation === 'true') {
    Reflect.deleteProperty(result, 'navigation')
  }

  if (document.seo) {
    const seo = { ...(document.seo as Record<string, unknown>) }
    if (!seo.title || seo.title === document.title) {
      Reflect.deleteProperty(seo, 'title')
    }
    if (!seo.description || seo.description === document.description) {
      Reflect.deleteProperty(seo, 'description')
    }
    if (Object.keys(seo).length === 0) {
      Reflect.deleteProperty(result, 'seo')
    }
    else {
      result.seo = seo
    }
  }

  if (!document.title) {
    Reflect.deleteProperty(result, 'title')
  }

  if (!document.description) {
    Reflect.deleteProperty(result, 'description')
  }

  // expand meta to the root
  for (const key in (document.meta || {})) {
    if (!reservedKeys.includes(key)) {
      result[key] = (document.meta as Record<string, unknown>)[key]
    }
  }

  for (const key in (result || {})) {
    if (result[key] === null) {
      Reflect.deleteProperty(result, key)
    }

    if (Array.isArray(result[key]) && (result[key] as unknown[]).length === 0) {
      Reflect.deleteProperty(result, key)
    }
  }

  return result as DatabaseItem
}
