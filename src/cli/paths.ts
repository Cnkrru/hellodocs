/*
 * 三根路径模型：整个生成器的地基
 *
 * PKG_ROOT  包安装位置，引擎资源都在 src/ 下（入口模板 index.html、theme、组件插件）
 * USER_ROOT 用户项目根（CLI 的 cwd，或 hd dev <dir> 指定）
 * WORK_DIR  <USER_ROOT>/.hd，所有生成物集中于此
 *
 * 关键决策：Vite root 指向 WORK_DIR。theme 与路由里 import.meta.glob('/.cache/...')
 * 的前导 / 是相对 Vite root 解析的，把 root 定为 WORK_DIR 后 .cache 落在它下面，
 * 这些 glob 字面量一字不用改，主题侧改动趋近于零。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* path.resolve 归一化掉尾部分隔符：new URL('../..') 指向目录，fileURLToPath 会带上尾分隔符 */
export const pkgRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

export const resolveUserRoot = (rootArg?: string) => path.resolve(process.cwd(), rootArg ?? '.')

export const resolveWorkDir = (userRoot: string) => path.join(userRoot, '.hd')

/* → /.cache/* */
export const resolveCacheDir = (workDir: string) => path.join(workDir, '.cache')

/* → publicDir，/config/*.json 与 /imgs/* 等静态资源都从这里服务 */
export const resolvePublicDir = (workDir: string) => path.join(workDir, 'public')

/* 构建产物默认落在用户项目内的 dist，便于直接部署；--outDir 可覆写（相对 USER_ROOT） */
export const resolveOutDir = (userRoot: string, outDir?: string) =>
  outDir ? path.resolve(userRoot, outDir) : path.join(userRoot, 'dist')

/* 包内资源 */
export const packageIndexHtml = path.join(pkgRoot, 'src/index.html')
export const packagePublicDir = path.join(pkgRoot, 'src/theme/public')
export const packageHomeTemplate = path.join(pkgRoot, 'src/theme/views/home.md')