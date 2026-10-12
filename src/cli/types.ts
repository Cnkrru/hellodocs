/*
 * 引擎内部契约：编译期与 CLI 共用
 * 由 CLI 显式构造后经 vite plugin options 传入编译管线（不靠环境变量，可类型化）
 */
import type { ResolvedConfig } from '../config/site.config.ts'

export type BuildContext = {
  userRoot: string // 用户项目根
  workDir: string // 生成物根，同时是 Vite root
  articleDir: string // 内容目录绝对路径，= userRoot/docsDir
  maxDepth: number
  homeMdPath: string // 首页内容源：用户 home.md，缺省回退包内模板
  config: ResolvedConfig // 已合并、已校验
}