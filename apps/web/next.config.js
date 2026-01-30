import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // This repo contains a non-Node workspace (Obsidian vault). Make tracing explicit.
  outputFileTracingRoot: path.join(__dirname, '../..')
}

export default nextConfig
