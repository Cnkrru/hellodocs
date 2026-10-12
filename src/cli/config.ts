/*
 * 用户配置的加载、合并与校验
 *
 * 加载：jiti 运行时加载用户 TS，免去用户预编译
 * 合并：defaults ← user 浅合并，nav / homeCards / repo 这类结构字段整体覆盖
 * 校验：边界处校验（title 必填、docsDir 存在性），缺关键项直接抛错退出，不做静默兜底
 */
import fs from 'node:fs'
import path from 'node:path'

import { createJiti } from 'jiti'

import { defaultConfig, type KrudocConfig, type ResolvedConfig } from '../config/site.config.ts'

const CONFIG_FILES = ['krudoc.config.ts', 'krudoc.config.mts', 'krudoc.config.js', 'krudoc.config.mjs']

/* 定位用户配置文件：显式 --config 优先，否则在 USER_ROOT 下按序探测；都没有则返回 null，由 loadUserConfig 报错 */
const findConfigFile = (userRoot: string, configPath?: string): string | null => {
  if (configPath) {
    const abs = path.resolve(userRoot, configPath)
    if (!fs.existsSync(abs)) throw new Error(`找不到配置文件：${abs}`)
    return abs
  }
  for (const name of CONFIG_FILES) {
    const abs = path.join(userRoot, name)
    if (fs.existsSync(abs)) return abs
  }
  return null
}

/* 运行时加载用户 TS 配置；找不到配置文件直接报错（落到 title 必填会让人以为配置写错，而非文件不存在） */
export const loadUserConfig = async (userRoot: string, configPath?: string): Promise<KrudocConfig> => {
  const file = findConfigFile(userRoot, configPath)
  if (!file) {
    throw new Error(`未找到配置文件：${userRoot} 下缺少 ${CONFIG_FILES[0]}（可用 --config 指定其它路径）`)
  }
  const jiti = createJiti(import.meta.url)
  // default: true 等价于 mod?.default ?? mod，兼容 export default 与整体导出两种写法
  const raw = await jiti.import<KrudocConfig>(file, { default: true })
  if (!raw || typeof raw !== 'object') {
    throw new Error(`配置文件未导出配置对象：${file}`)
  }
  return raw
}

/* 合并默认值 + 校验边界，产出编译管线可用的 ResolvedConfig */
export const resolveConfig = (raw: KrudocConfig, userRoot: string): ResolvedConfig => {
  if (typeof raw.title !== 'string' || raw.title.trim() === '') {
    throw new Error('krudoc.config 缺少必填项 title（非空字符串）')
  }
  const docsDir = raw.docsDir ?? defaultConfig.docsDir
  const articleDir = path.join(userRoot, docsDir)
  if (!fs.existsSync(articleDir)) {
    throw new Error(`内容目录不存在：${articleDir}（配置项 docsDir=${docsDir}）`)
  }
  // repo.docsDir 缺省跟随顶层 docsDir，保证编辑链接与内容目录同一处
  const repo = { ...defaultConfig.repo, ...raw.repo }
  if (!repo.docsDir) repo.docsDir = docsDir
  return {
    title: raw.title,
    description: raw.description ?? defaultConfig.description,
    keywords: raw.keywords ?? defaultConfig.keywords,
    siteUrl: raw.siteUrl ?? defaultConfig.siteUrl,
    ogImage: raw.ogImage ?? defaultConfig.ogImage,
    ogImageAlt: raw.ogImageAlt ?? defaultConfig.ogImageAlt,
    copyright: raw.copyright ?? defaultConfig.copyright,
    docsDir,
    maxDepth: raw.maxDepth ?? defaultConfig.maxDepth,
    nav: raw.nav ?? defaultConfig.nav,
    homeCards: raw.homeCards ?? defaultConfig.homeCards,
    repo,
  }
}