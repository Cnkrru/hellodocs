/* build：定位上下文 → 准备 WORK_DIR → vite-ssg 编程式构建（不 shell 外调） */
import { build as ssgBuild } from 'vite-ssg/node'

import { createBuildContext, ensureWorkDir } from './context.ts'
import { resolveOutDir, resolveUserRoot } from './paths.ts'
import { createEngineConfig, createSsgOptions } from './vite.config.ts'

export type BuildOptions = {
  rootArg?: string
  configPath?: string
  base?: string
  outDir?: string
}

export const build = async (options: BuildOptions) => {
  const userRoot = resolveUserRoot(options.rootArg)
  const ctx = await createBuildContext(userRoot, options.configPath)
  ensureWorkDir(ctx)
  const outDir = resolveOutDir(userRoot, options.outDir)
  const config = createEngineConfig(ctx, {
    command: 'build',
    mode: 'production',
    base: options.base,
    outDir,
  })
  await ssgBuild(createSsgOptions(ctx, outDir), config)
  console.log(`[hd] 构建完成：${outDir}`)
}