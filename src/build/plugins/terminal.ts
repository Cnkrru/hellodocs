/*
 * terminal 终端组件插件
 *
 * 语法：围栏代码块，语言名 terminal，以 `$ ` 开头的行按命令渲染，其余按输出渲染：
 *   ```terminal
 *   $ npm i -D @hello/vdoc
 *   added 1 package
 *   ```
 * Mac 风格三色圆点顶栏，编译期直出纯 HTML。
 */
import type { ComponentPlugin } from './base.ts'

// 命令行（$ 提示符）
const TERMINAL_CMD = (esc: (s: string) => string, cmd: string): string =>
  `\n        <div class="terminal-line terminal-cmd"><span class="terminal-prompt">$</span> ${esc(
    cmd,
  )}</div>`

// 输出行
const TERMINAL_OUT = (esc: (s: string) => string, line: string): string =>
  `\n        <div class="terminal-line">${esc(line)}</div>`

// 终端窗口：Mac 风格三色圆点顶栏 + 行体
const TERMINAL_WINDOW = (rows: string): string => `
<div class="terminal" v-pre>
    <div class="terminal-bar">
        <span class="terminal-dot dot-red"></span>
        <span class="terminal-dot dot-yellow"></span>
        <span class="terminal-dot dot-green"></span>
        <span class="terminal-title">terminal</span>
    </div>
    <div class="terminal-body">${rows}
    </div>
</div>`

export const terminalBlock: ComponentPlugin = {
  name: 'terminal',
  fenceLangs: ['terminal'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    const rows = content
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim().length > 0)
      .map((l) => (l.startsWith('$ ') ? TERMINAL_CMD(esc, l.slice(2)) : TERMINAL_OUT(esc, l)))
      .join('')
    return TERMINAL_WINDOW(rows)
  },
}
