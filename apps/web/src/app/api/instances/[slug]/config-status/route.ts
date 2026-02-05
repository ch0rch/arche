import { NextRequest, NextResponse } from 'next/server'

import { getAuthenticatedUser } from '@/lib/auth'
import { getCommonWorkspaceConfigHash } from '@/lib/common-workspace-config-store'
import { prisma } from '@/lib/prisma'

type ConfigStatusResponse = {
  pending: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse<ConfigStatusResponse | { error: string }>> {
  const session = await getAuthenticatedUser()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  if (session.user.slug !== slug && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const common = await getCommonWorkspaceConfigHash()
  if (!common.ok) {
    const status = common.error === 'not_found'
      ? 404
      : common.error === 'kb_unavailable'
        ? 503
        : 500
    return NextResponse.json({ error: common.error ?? 'read_failed' }, { status })
  }

  const instance = await prisma.instance.findUnique({
    where: { slug },
    select: { appliedConfigSha: true }
  })

  const pending = instance?.appliedConfigSha !== common.hash
  return NextResponse.json({ pending })
}
