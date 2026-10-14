/*
 * steps 步骤组件插件
 *
 * 语法：围栏代码块，语言名 steps，每行『标题 | 描述（可省略）』：
 *   ```steps
 *   安装 | npm i -D @hello/vdoc
 *   ```
 * 序号由编译期自动生成，不写进内容里。
 */
import type { ComponentPlugin } from './base.ts'

// 单条：序号由编译期生成后传入
const STEPS_ITEM = (
  esc: (s: string) => string,
  no: number,
  title: string,
  desc: string,
): string => `
    <div class="steps-item">
        <span class="steps-no">${no}</span>
        <div class="steps-body">
            <div class="steps-title">${esc(title)}</div>
            ${desc ? `<div class="steps-desc">${esc(desc)}</div>` : ''}
        </div>
    </div>`

const STEPS_WRAP = (items: string): string => `
<div class="steps" v-pre>${items}
</div>`

export const stepsBlock: ComponentPlugin = {
  name: 'steps',
  fenceLangs: ['steps'],
  render(ctx, content) {
    const esc = ctx.escapeHtml
    let n = 0
    const items = content
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [title = '', desc = ''] = ctx.splitRow(l)
        n += 1
        return STEPS_ITEM(esc, n, title, desc)
      })
      .join('')
    return STEPS_WRAP(items)
  },
}
