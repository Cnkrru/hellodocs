/*
 * BuildContext 装配与 WORK_DIR 结构准备
 *
 * 「定位 USER_ROOT → 加载配置 → 构造 BuildContext → 确保 WORK_DIR 结构」是 dev/build/preview
 * 三条命令的共同前置，统一收在这里，命令实现只关心各自的 vite 调用方式。
 */
import fs from 'node:fs'
import path from 'node:path'

import { loadUserConfig, resolveConfig } from './config.ts'
import {
  packageHomeTemplate,
  packageIndexHtml,
  packagePublicDir,
  resolveCacheDir,
  resolvePublicDir,
  resolveWorkDir,
} from './paths.ts'
import type { BuildContext } from './types.ts'

/* 首页内容源：用户项目根的 home.md 优先，缺省回退包内模板 */
const resolveHomeMd = (userRoot: string) => {
  const userHome = path.join(userRoot, 'home.md')
  return fs.existsSync(userHome) ? userHome : packageHomeTemplate
}

export const createBuildContext = async (userRoot: string, configPath?: string): Promise<BuildContext> => {
  const raw = await loadUserConfig(userRoot, configPath)
  const config = resolveConfig(raw, userRoot)
  return {
    userRoot,
    workDir: resolveWorkDir(userRoot),
    articleDir: path.join(userRoot, config.docsDir),
    maxDepth: config.maxDepth,
    homeMdPath: resolveHomeMd(userRoot),
    config,
  }
}

/* 递归拷贝目录内容（不删目标已有文件）；源目录不存在时静默跳过 */
const copyDir = (from: string, to: string) => {
  if (!fs.existsSync(from)) return
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(src, dest)
    else fs.copyFileSync(src, dest)
  }
}

/*
 * 准备 WORK_DIR：建目录 → 铺静态资源 → 落 index.html
 * 静态资源两层叠加，后者覆盖前者，用户可覆盖引擎默认的图标/封面：
 *   1. 包内默认资源 src/theme/public（favicon、og-cover 等）
 *   2. 用户自有资源 USER_ROOT/public
 */
export const ensureWorkDir = (ctx: BuildContext) => {
  const publicDir = resolvePublicDir(ctx.workDir)
  fs.mkdirSync(resolveCacheDir(ctx.workDir), { recursive: true })
  fs.mkdirSync(publicDir, { recursive: true })
  copyDir(packagePublicDir, publicDir)
  copyDir(path.join(ctx.userRoot, 'public'), publicDir)
  fs.copyFileSync(packageIndexHtml, path.join(ctx.workDir, 'index.html'))
}