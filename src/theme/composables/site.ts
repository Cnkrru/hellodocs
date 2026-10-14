/*
 * 站点配置读取：编译期已把解析后的配置写进 .cache/site.json（parseArticle.ts 的 syncSiteConfig），
 * theme 内不 import 配置源文件，统一从这份产物同步读 —— SSG 预渲染和客户端一致。
 * 改配置后需重新构建才生效（开发模式不热更新配置）。
 * glob 而非静态 import：首次构建该文件可能尚未生成，glob 返回空对象而非编译报错
 *
 * 契约单一出处：类型由 src/config/site.config.ts 的 serializeSiteConfig 反推，
 * 不再在这里抄一份键名表 —— 两处手写时改了键名不会报错，只会静默读到 undefined。
 * 仅类型导入，编译期擦除，配置模块不会被打进浏览器包。
 */
import type { serializeSiteConfig } from '../../config/site.config.ts'

/** .cache/site.json 的形状 = serializeSiteConfig 的返回值 */
export type SiteConfig = ReturnType<typeof serializeSiteConfig>

const siteMap = import.meta.glob<SiteConfig>('/.cache/site.json', {
  eager: true,
  import: 'default',
})

/** 站点配置单例：编译期写死进产物，此处只做同步读取 */
export const site: SiteConfig = siteMap['/.cache/site.json'] ?? ({} as SiteConfig)
