import { mkdir } from 'fs/promises'
import { join } from 'path'
import { getUsersBasePath } from '@/lib/spawner/config'
import { assertValidSlug } from '@/lib/validation/slug'

export async function ensureUserDirectory(slug: string): Promise<string | null> {
  assertValidSlug(slug)
  const basePath = getUsersBasePath()
  if (!basePath) return null

  const userPath = join(basePath, slug)
  await mkdir(join(userPath, 'connectors'), { recursive: true, mode: 0o700 })
  await mkdir(join(userPath, 'agents'), { recursive: true, mode: 0o700 })
  return userPath
}

export function getUserDataHostPath(slug: string): string | null {
  assertValidSlug(slug)
  const basePath = getUsersBasePath()
  return basePath ? join(basePath, slug) : null
}
