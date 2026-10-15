/**
 * 站内链接组件。
 *
 * 这里刻意使用普通 `<a>`，而不是 `next/link`。
 *
 * 原因：本站固定的 vinext `1.0.0-beta.5` 的客户端软导航（RSC prefetch /
 * hybrid client route）在当前构建下会在点击时抛出 `TypeError: e is not a function`，
 * 并伴随 `[vinext] RSC prefetch setup error: TypeError: ee is not a function`，
 * 表现是点击站内链接完全没有反应（整页访问地址栏输入 URL 则正常）。
 * 该问题与业务代码无关，通过无头浏览器在本地生产构建和公网部署上都可复现。
 *
 * 普通 `<a>` 走浏览器整页跳转，不经过客户端路由，因此不受影响。站点页面体积很小，
 * 整页跳转与软导航的体验差异可以忽略。
 *
 * 将来升级 vinext 并确认软导航恢复正常后，只需改回这里的实现（或直接替换成
 * `next/link`），调用方无需改动。
 */
import type { AnchorHTMLAttributes } from "react";

export function SiteLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} />;
}
