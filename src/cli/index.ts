/*
 * CLI 命令面：vdoc dev / build / preview
 * 参数解析用 Node 内置 parseArgs（零新增依赖），命令实现各管各的 vite 调用方式
 */
import { parseArgs } from 'node:util'

import { build } from './build.ts'
import { dev } from './dev.ts'
import { preview } from './preview.ts'

export { defineConfig } from '../config/site.config.ts'
export type { HomeCard, VdocConfig, NavItem, RepoConfig, ResolvedConfig } from '../config/site.config.ts'
export type { BuildContext } from './types.ts'

const HELP = `vdoc —— 整站文档生成器

用法：
  vdoc <command> [root] [options]

命令：
  dev       启动开发服务器
  build     构建静态站点（默认产出 <root>/dist）
  preview   本地预览已构建的产物

选项：
  --config <path>   指定配置文件（相对 root），默认探测 vdoc.config.ts
  --port <number>   dev / preview 的端口
  --base <path>     部署基础路径，默认 /
  --outDir <dir>    build / preview 的产物目录（相对 root），默认 dist
  -h, --help        显示帮助

root 缺省为当前工作目录。
`

const parsePort = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`--port 不是合法端口：${raw}`)
  }
  return port
}

export const run = async (argv: string[]) => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      port: { type: 'string' },
      base: { type: 'string' },
      outDir: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  const command = positionals[0]
  if (values.help || command === undefined || command === 'help') {
    console.log(HELP)
    return
  }

  // 各命令按自己声明的字段组装参数：共用一个宽对象时，多余的键会被静默忽略
  // （TS 的额外属性检查只作用于字面量），且 --port 会在 build 这类无关命令上误报错
  const rootArg = positionals[1]
  const { config: configPath, base, outDir } = values

  if (command === 'dev') return dev({ rootArg, configPath, base, port: parsePort(values.port) })
  if (command === 'build') return build({ rootArg, configPath, base, outDir })
  if (command === 'preview') {
    return preview({ rootArg, configPath, base, outDir, port: parsePort(values.port) })
  }
  throw new Error(`未知命令：${command}（可用：dev / build / preview）`)
}