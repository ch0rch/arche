import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock dockerode before importing the module
vi.mock('dockerode', () => {
  const mockContainer = {
    id: 'container-123',
    start: vi.fn(),
    stop: vi.fn(),
    remove: vi.fn(),
    inspect: vi.fn(),
  }

  const mockDocker = {
    createContainer: vi.fn().mockResolvedValue(mockContainer),
    getContainer: vi.fn().mockReturnValue(mockContainer),
  }

  return {
    default: vi.fn().mockImplementation(() => mockDocker),
    __mockDocker: mockDocker,
    __mockContainer: mockContainer,
  }
})

describe('docker', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    process.env.DOCKER_PROXY_HOST = 'test-proxy'
    process.env.DOCKER_PROXY_PORT = '2375'
    process.env.OPENCODE_IMAGE = 'test-image:latest'
    process.env.OPENCODE_NETWORK = 'test-network'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  describe('createContainer', () => {
    it('creates container with correct configuration', async () => {
      const { createContainer } = await import('../docker')
      const Docker = (await import('dockerode')).default
      const mockDocker = (await import('dockerode') as any).__mockDocker

      await createContainer('user-slug', 'secret-password')

      expect(Docker).toHaveBeenCalledWith({
        host: 'test-proxy',
        port: 2375,
      })

      expect(mockDocker.createContainer).toHaveBeenCalledWith({
        Image: 'test-image:latest',
        name: 'opencode-user-slug',
        Cmd: ['opencode', 'serve', '--hostname', '0.0.0.0', '--port', '4096'],
        Env: [
          'OPENCODE_SERVER_PASSWORD=secret-password',
          'OPENCODE_SERVER_USERNAME=opencode',
        ],
        HostConfig: {
          NetworkMode: 'test-network',
          RestartPolicy: { Name: 'unless-stopped' },
        },
        Labels: {
          'arche.managed': 'true',
          'arche.user.slug': 'user-slug',
        },
      })
    })

    it('returns the created container', async () => {
      const { createContainer } = await import('../docker')

      const container = await createContainer('slug', 'pass')

      expect(container.id).toBe('container-123')
    })
  })

  describe('startContainer', () => {
    it('starts a container by ID', async () => {
      const { startContainer } = await import('../docker')
      const mockContainer = (await import('dockerode') as any).__mockContainer

      await startContainer('container-123')

      expect(mockContainer.start).toHaveBeenCalled()
    })
  })

  describe('stopContainer', () => {
    it('stops a container with 10s timeout', async () => {
      const { stopContainer } = await import('../docker')
      const mockContainer = (await import('dockerode') as any).__mockContainer

      await stopContainer('container-123')

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 10 })
    })
  })

  describe('removeContainer', () => {
    it('removes a container with force option', async () => {
      const { removeContainer } = await import('../docker')
      const mockContainer = (await import('dockerode') as any).__mockContainer

      await removeContainer('container-123')

      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true })
    })
  })

  describe('inspectContainer', () => {
    it('returns container inspection data', async () => {
      const mockContainer = (await import('dockerode') as any).__mockContainer
      mockContainer.inspect.mockResolvedValue({ State: { Running: true } })

      const { inspectContainer } = await import('../docker')
      const info = await inspectContainer('container-123')

      expect(info).toEqual({ State: { Running: true } })
    })
  })

  describe('isContainerRunning', () => {
    it('returns true when container is running', async () => {
      const mockContainer = (await import('dockerode') as any).__mockContainer
      mockContainer.inspect.mockResolvedValue({ State: { Running: true } })

      const { isContainerRunning } = await import('../docker')
      const running = await isContainerRunning('container-123')

      expect(running).toBe(true)
    })

    it('returns false when container is not running', async () => {
      const mockContainer = (await import('dockerode') as any).__mockContainer
      mockContainer.inspect.mockResolvedValue({ State: { Running: false } })

      const { isContainerRunning } = await import('../docker')
      const running = await isContainerRunning('container-123')

      expect(running).toBe(false)
    })

    it('returns false when inspection fails', async () => {
      const mockContainer = (await import('dockerode') as any).__mockContainer
      mockContainer.inspect.mockRejectedValue(new Error('Container not found'))

      const { isContainerRunning } = await import('../docker')
      const running = await isContainerRunning('container-123')

      expect(running).toBe(false)
    })
  })
})
