import { prisma } from '@/lib/prisma'
import { getIdleTimeoutMinutes } from './config'
import * as docker from './docker'
import { auditEvent } from '@/lib/auth'

let reaperInterval: NodeJS.Timeout | null = null

export async function reapIdleInstances(): Promise<number> {
  const timeoutMinutes = getIdleTimeoutMinutes()
  const threshold = new Date(Date.now() - timeoutMinutes * 60 * 1000)

  const idleInstances = await prisma.instance.findMany({
    where: {
      status: 'running',
      lastActivityAt: { lt: threshold },
    },
  })

  let reapedCount = 0

  for (const instance of idleInstances) {
    try {
      if (instance.containerId) {
        await docker.stopContainer(instance.containerId).catch(() => {})
        await docker.removeContainer(instance.containerId).catch(() => {})
      }

      await prisma.instance.update({
        where: { id: instance.id },
        data: {
          status: 'stopped',
          stoppedAt: new Date(),
          containerId: null,
        },
      })

      await auditEvent({
        actorUserId: null,
        action: 'instance.reaped_idle',
        metadata: {
          slug: instance.slug,
          lastActivityAt: instance.lastActivityAt,
          idleMinutes: timeoutMinutes,
        },
      })

      reapedCount++
    } catch {
      // best-effort
    }
  }

  return reapedCount
}

export function startReaper(): void {
  if (reaperInterval) return
  const REAPER_INTERVAL_MS = 5 * 60 * 1000

  reaperInterval = setInterval(async () => {
    try {
      const count = await reapIdleInstances()
      if (count > 0) {
        console.error(`[reaper] Stopped ${count} idle instance(s)`)
      }
    } catch (err) {
      console.error('[reaper] Error:', err)
    }
  }, REAPER_INTERVAL_MS)

  reapIdleInstances().catch(() => {})
}

export function stopReaper(): void {
  if (reaperInterval) {
    clearInterval(reaperInterval)
    reaperInterval = null
  }
}
