import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const internalToken = process.env.ARCHE_INTERNAL_TOKEN
  if (!internalToken) {
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${internalToken}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  const instance = await prisma.instance.findUnique({ where: { slug } })
  if (!instance) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  await prisma.instance.update({
    where: { slug },
    data: { lastActivityAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
