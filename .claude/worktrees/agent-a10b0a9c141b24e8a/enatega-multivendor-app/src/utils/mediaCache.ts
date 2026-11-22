import { File, Directory, Paths } from 'expo-file-system'
import * as Crypto from 'expo-crypto'

let cacheDir: Directory | null = null
const pendingDownloads = new Map<string, Promise<string>>()

function getCacheDir(): Directory {
  if (!cacheDir) {
    cacheDir = new Directory(Paths.cache, 'banner-media-cache')
  }
  return cacheDir
}

function stripQueryAndHash(url = ''): string {
  return url.split('#')[0].split('?')[0]
}

function getFileExtension(url = '', fallback = 'bin'): string {
  const clean = stripQueryAndHash(url)
  const parts = clean.split('.')
  const ext = parts.length > 1 ? parts.pop() : fallback
  return (ext || fallback).toLowerCase()
}

function ensureCacheDir(): void {
  const dir = getCacheDir()
  if (!dir.exists) {
    dir.create({ intermediates: true })
  }
}

export async function getCachedMediaUri(
  remoteUrl: string,
  type: 'file' | 'image' = 'file'
): Promise<string> {
  if (!remoteUrl || remoteUrl.startsWith('file://')) return remoteUrl

  const normalized = stripQueryAndHash(remoteUrl)
  const ext = getFileExtension(remoteUrl, type === 'image' ? 'jpg' : 'mp4')
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized)

  ensureCacheDir()

  const localFile = new File(getCacheDir(), `${hash}.${ext}`)
  if (localFile.exists && localFile.size && localFile.size > 0) {
    return localFile.uri
  }

  if (pendingDownloads.has(normalized)) {
    return pendingDownloads.get(normalized) as Promise<string>
  }

  const downloadPromise = (async () => {
    try {
      const file = await File.downloadFileAsync(remoteUrl, localFile, { idempotent: true })
      return file.uri
    } catch (_e) {
      return remoteUrl
    } finally {
      pendingDownloads.delete(normalized)
    }
  })()

  pendingDownloads.set(normalized, downloadPromise)
  return downloadPromise
}
