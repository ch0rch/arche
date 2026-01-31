import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    instance: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auditEvent: vi.fn(),
}))

vi.mock('../docker', () => ({
  stopContainer: vi.fn(),
  removeContainer: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import * as docker from '../docker'
import { reapIdleInstances, startReaper, stopReaper } from '../reaper'

const mockPrisma = vi.mocked(prisma)
const mockDocker = vi.mocked(docker)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  stopReaper()
  vi.useRealTimers()
})

describe('reapIdleInstances', () => {
  it('returns 0 when no idle instances', async () => {
    mockPrisma.instance.findMany.mockResolvedValue([])

    const count = await reapIdleInstances()

    expect(count).toBe(0)
    expect(mockPrisma.instance.findMany).toHaveBeenCalledWith({
      where: {
        status: 'running',
        lastActivityAt: { lt: expect.any(Date) },
      },
    })
  })

  it('stops and removes idle instances', async () => {
    const idleInstance = {
      id: 'inst-1',
      slug: 'alice',
      status: 'running' as const,
      containerId: 'container-abc',
      serverPassword: 'enc',
      createdAt: new Date(),
      startedAt: new Date(),
      stoppedAt: null,
      lastActivityAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
    }
    mockPrisma.instance.findMany.mockResolvedValue([idleInstance])
    mockDocker.stopContainer.mockResolvedValue(undefined)
    mockDocker.removeContainer.mockResolvedValue(undefined)
    mockPrisma.instance.update.mockResolvedValue({} as never)

    const count = await reapIdleInstances()

    expect(count).toBe(1)
    expect(mockDocker.stopContainer).toHaveBeenCalledWith('container-abc')
    expect(mockDocker.removeContainer).toHaveBeenCalledWith('container-abc')
    expect(mockPrisma.instance.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: {
        status: 'stopped',
        stoppedAt: expect.any(Date),
        containerId: null,
      },
    })
  })

  it('continues reaping other instances if one fails', async () => {
    const instances = [
      {
        id: 'inst-1', slug: 'alice', status: 'running' as const,
        containerId: 'c1', serverPassword: 'enc',
        createdAt: new Date(), startedAt: new Date(),
        stoppedAt: null, lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: 'inst-2', slug: 'bob', status: 'running' as const,
        containerId: 'c2', serverPassword: 'enc',
        createdAt: new Date(), startedAt: new Date(),
        stoppedAt: null, lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    ]
    mockPrisma.instance.findMany.mockResolvedValue(instances)
    mockDocker.stopContainer
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined)
    mockDocker.removeContainer.mockResolvedValue(undefined)
    mockPrisma.instance.update
      .mockRejectedValueOnce(new Error('db fail'))
      .mockResolvedValueOnce({} as never)

    const count = await reapIdleInstances()

    // First fails (update throws), second succeeds
    expect(count).toBe(1)
  })

  it('handles instance without containerId', async () => {
    const instance = {
      id: 'inst-1', slug: 'alice', status: 'running' as const,
      containerId: null, serverPassword: 'enc',
      createdAt: new Date(), startedAt: new Date(),
      stoppedAt: null, lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
    }
    mockPrisma.instance.findMany.mockResolvedValue([instance])
    mockPrisma.instance.update.mockResolvedValue({} as never)

    const count = await reapIdleInstances()

    expect(count).toBe(1)
    expect(mockDocker.stopContainer).not.toHaveBeenCalled()
  })
})

describe('startReaper / stopReaper', () => {
  it('starts interval that calls reapIdleInstances', async () => {
    mockPrisma.instance.findMany.mockResolvedValue([])

    startReaper()

    // Initial call on start
    expect(mockPrisma.instance.findMany).toHaveBeenCalledTimes(1)

    stopReaper()
  })

  it('calling startReaper twice does not create duplicate intervals', () => {
    mockPrisma.instance.findMany.mockResolvedValue([])

    startReaper()
    startReaper()

    // Only one initial call
    expect(mockPrisma.instance.findMany).toHaveBeenCalledTimes(1)

    stopReaper()
  })
})
