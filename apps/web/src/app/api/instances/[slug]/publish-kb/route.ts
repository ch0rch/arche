import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getSessionFromToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { execInContainer } from '@/lib/spawner/docker'

export interface PublishKbResult {
  ok: boolean
  status: 'published' | 'nothing_to_publish' | 'push_rejected' | 'no_remote' | 'error'
  commitHash?: string
  files?: string[]
  message?: string
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return getSessionFromToken(token)
}

function generateCommitMessage(statOutput: string): string {
  // Parse file names from `git diff --cached --stat` output
  // Each line looks like: " file.md | 2 +-"
  // Last line is summary: " N files changed, ..."
  const lines = statOutput.split('\n').filter(l => l.trim().length > 0)
  const fileLines = lines.filter(l => l.includes('|'))
  const fileNames = fileLines.map(l => l.split('|')[0].trim())

  if (fileNames.length === 0) return 'Update files'
  if (fileNames.length <= 3) return `Update ${fileNames.join(', ')}`
  return `Update ${fileNames.length} files`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse<PublishKbResult | { error: string }>> {
  const session = await getAuthenticatedUser()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const instance = await prisma.instance.findUnique({
    where: { slug },
    select: { containerId: true, status: true },
  })

  if (!instance) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (instance.status !== 'running' || !instance.containerId) {
    return NextResponse.json({ error: 'instance_not_running' }, { status: 409 })
  }

  try {
    // 1. Check remote 'kb' exists
    const remoteCheck = await execInContainer(
      instance.containerId,
      ['git', 'remote', 'get-url', 'kb'],
      { timeout: 5000 }
    )

    if (remoteCheck.exitCode !== 0) {
      return NextResponse.json({
        ok: false,
        status: 'no_remote',
        message: 'KB remote not configured.',
      })
    }

    // 2. Check for changes
    const statusResult = await execInContainer(
      instance.containerId,
      ['git', 'status', '--porcelain'],
      { timeout: 5000 }
    )

    if (statusResult.stdout.trim() === '') {
      return NextResponse.json({
        ok: true,
        status: 'nothing_to_publish',
        message: 'Nothing to publish.',
      })
    }

    // 3. Stage all changes
    const addResult = await execInContainer(
      instance.containerId,
      ['git', 'add', '-A'],
      { timeout: 10000 }
    )

    if (addResult.exitCode !== 0) {
      return NextResponse.json({
        ok: false,
        status: 'error',
        message: `git add failed: ${addResult.stderr}`,
      })
    }

    // 4. Get diff stat for commit message
    const statResult = await execInContainer(
      instance.containerId,
      ['git', 'diff', '--cached', '--stat'],
      { timeout: 5000 }
    )

    const commitMessage = generateCommitMessage(statResult.stdout)

    // 5. Commit
    const commitResult = await execInContainer(
      instance.containerId,
      ['git', 'commit', '-m', commitMessage],
      { timeout: 10000 }
    )

    if (commitResult.exitCode !== 0) {
      return NextResponse.json({
        ok: false,
        status: 'error',
        message: `git commit failed: ${commitResult.stderr}`,
      })
    }

    // 6. Get commit hash
    const hashResult = await execInContainer(
      instance.containerId,
      ['git', 'rev-parse', '--short', 'HEAD'],
      { timeout: 5000 }
    )
    const commitHash = hashResult.stdout.trim()

    // 7. Get changed files
    const filesResult = await execInContainer(
      instance.containerId,
      ['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'],
      { timeout: 5000 }
    )
    const files = filesResult.stdout.split('\n').map(f => f.trim()).filter(f => f.length > 0)

    // 8. Detect current branch and push
    const branchResult = await execInContainer(
      instance.containerId,
      ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
      { timeout: 5000 }
    )
    const currentBranch = branchResult.stdout.trim() || 'main'

    const pushResult = await execInContainer(
      instance.containerId,
      ['git', 'push', 'kb', currentBranch],
      { timeout: 30000 }
    )

    if (pushResult.exitCode !== 0) {
      return NextResponse.json({
        ok: false,
        status: 'push_rejected',
        commitHash,
        files,
        message: 'Sync KB first',
      })
    }

    return NextResponse.json({
      ok: true,
      status: 'published',
      commitHash,
      files,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({
      ok: false,
      status: 'error',
      message,
    })
  }
}
