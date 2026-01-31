'use server'

import { cookies } from 'next/headers'
import { getSessionFromToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { startInstance, stopInstance, getInstanceStatus, isSlowStart } from '@/lib/spawner/core'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return getSessionFromToken(token)
}

export type SpawnerActionResult =
  | { ok: true; status: string }
  | { ok: false; error: string }

export async function startInstanceAction(slug: string): Promise<SpawnerActionResult> {
  const session = await getAuthenticatedUser()
  if (!session) return { ok: false, error: 'unauthorized' }

  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return { ok: false, error: 'forbidden' }
  }

  return startInstance(slug, session.user.id)
}

export async function stopInstanceAction(slug: string): Promise<SpawnerActionResult> {
  const session = await getAuthenticatedUser()
  if (!session) return { ok: false, error: 'unauthorized' }

  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return { ok: false, error: 'forbidden' }
  }

  return stopInstance(slug, session.user.id)
}

export async function getInstanceStatusAction(slug: string) {
  const session = await getAuthenticatedUser()
  if (!session) return null

  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return null
  }

  const instance = await getInstanceStatus(slug)
  if (!instance) return { status: 'stopped' as const, slowStart: false }

  return {
    ...instance,
    slowStart: isSlowStart(instance),
  }
}
