/* preview：以 vite preview 本地伺服已构建的 dist（root 仍锚 WORK_DIR，与构建期一致） */
import { preview as vitePreview } from 'vite'

import { createBuildContext } from './context.ts'
import { resolveOutDir, resolveUserRoot, resolveWorkDir } from './paths.ts'

export type PreviewOptions = {
  rootArg?: string
  configPath?: string
  port?: number
  base?: string
  outDir?: string
}

export const preview = async (options: PreviewOptions) => {
  const userRoot = resolveUserRoot(options.rootArg)
  const ctx = await createBuildContext(userRoot, options.configPath)
  // outDir 与 build 同源：用 --outDir 构建后，preview 不带同一参数会去默认 dist/ 找产物
  const outDir = resolveOutDir(ctx.userRoot, options.outDir)
  const server = await vitePreview({
    configFile: false,
    root: resolveWorkDir(userRoot),
    base: options.base,
    build: { outDir },
    preview: { port: options.port },
    server: { cors: true },
  })
  server.printUrls()
  console.log(`[vdoc] 预览 ${outDir}`)
}