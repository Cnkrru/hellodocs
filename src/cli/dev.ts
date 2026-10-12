/* dev：定位上下文 → 准备 WORK_DIR → 起 vite dev server */
import { createServer } from 'vite'

import { createBuildContext, ensureWorkDir } from './context.ts'
import { resolveUserRoot } from './paths.ts'
import { createEngineConfig } from './vite.config.ts'

export type DevOptions = {
  rootArg?: string
  configPath?: string
  port?: number
  base?: string
}

export const dev = async (options: DevOptions) => {
  const userRoot = resolveUserRoot(options.rootArg)
  const ctx = await createBuildContext(userRoot, options.configPath)
  ensureWorkDir(ctx)
  const server = await createServer(
    createEngineConfig(ctx, {
      command: 'serve',
      mode: 'development',
      base: options.base,
      port: options.port,
    }),
  )
  await server.listen()
  server.printUrls()
}