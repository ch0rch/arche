import { cookies } from 'next/headers'

import { TeamPageClient } from '@/components/team/team-page-client'
import { getSessionFromToken, SESSION_COOKIE_NAME } from '@/lib/auth'

export default async function TeamPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const session = token ? await getSessionFromToken(token) : null

  return (
    <TeamPageClient
      slug={slug}
      isAdmin={session?.user.role === 'ADMIN'}
      currentUserId={session?.user.id ?? null}
    />
  )
}
