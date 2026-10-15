#!/usr/bin/env node
/*
 * hd CLI 入口：薄壳
 * 用 jiti 运行时加载包内 TS（一期免打包、免 dist），统一捕获错误并给出非 0 退出码，便于 CI
 */
import { fileURLToPath } from 'node:url'

import { createJiti } from 'jiti'

const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url))
const jiti = createJiti(import.meta.url)

try {
  const { run } = await jiti.import(entry)
  await run(process.argv.slice(2))
} catch (error) {
  // 预期错误（配置缺失、参数非法）只打一行 message，保持输出干净；
  // 引擎自身意外崩溃时设 HD_DEBUG=1 追加堆栈，便于定位
  if (error instanceof Error) {
    console.error(error.message)
    if (process.env.HD_DEBUG) console.error(error.stack)
  } else {
    console.error(error)
  }
  process.exit(1)
}