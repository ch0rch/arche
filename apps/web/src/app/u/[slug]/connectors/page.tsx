import { ConnectorsPageClient } from '@/components/connectors/connectors-page-client'

export default async function ConnectorsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return <ConnectorsPageClient slug={slug} />
}
