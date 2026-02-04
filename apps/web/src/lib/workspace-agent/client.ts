import { prisma } from '@/lib/prisma'
import { decryptPassword } from '@/lib/spawner/crypto'
import { getWorkspaceAgentPort } from '@/lib/spawner/config'

const DEFAULT_USERNAME = 'opencode'

export function getWorkspaceAgentUrl(slug: string): string {
  const containerName = `opencode-${slug}`
  const port = getWorkspaceAgentPort()
  const isContainer = process.env.CONTAINER_PROXY_HOST !== undefined || process.env.CONTAINER_SOCKET_PATH !== undefined

  if (isContainer) {
    return `http://${containerName}:${port}`
  }

  return `http://localhost:${port}`
}

export async function createWorkspaceAgentClient(slug: string): Promise<{
  baseUrl: string
  authHeader: string
} | null> {
  const instance = await prisma.instance.findUnique({
    where: { slug },
    select: { serverPassword: true, status: true }
  })

  if (!instance || !instance.serverPassword || instance.status !== 'running') {
    return null
  }

  try {
    const password = decryptPassword(instance.serverPassword)
    const authHeader = `Basic ${Buffer.from(`${DEFAULT_USERNAME}:${password}`).toString('base64')}`
    return {
      baseUrl: getWorkspaceAgentUrl(slug),
      authHeader
    }
  } catch {
    console.error(`[workspace-agent] Failed to decrypt password for ${slug}`)
    return null
  }
}
