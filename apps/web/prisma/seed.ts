import argon2 from 'argon2'
import { PrismaClient, UserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  const email = (process.env.ARCHE_SEED_ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ARCHE_SEED_ADMIN_PASSWORD || ''
  const slug = (process.env.ARCHE_SEED_ADMIN_SLUG || '').trim().toLowerCase()

  if (!email || !password || !slug) {
    throw new Error('Missing seed env vars: ARCHE_SEED_ADMIN_EMAIL, ARCHE_SEED_ADMIN_PASSWORD, ARCHE_SEED_ADMIN_SLUG')
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { slug }]
    }
  })

  if (existing) {
    return
  }

  const passwordHash = await argon2.hash(password)

  await prisma.user.create({
    data: {
      email,
      slug,
      role: UserRole.ADMIN,
      passwordHash,
      totpEnabled: false
    }
  })
}

main()
  .then(async () => {
    await pool.end()
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    await pool.end().catch(() => {})
    await prisma.$disconnect()
    throw e
  })
