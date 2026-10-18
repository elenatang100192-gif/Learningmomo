// 把公网 media URL 转成同源代理 URL，绕过 Chrome 的 Private Network Access (PNA)。
// 仅当 URL 是 http(s) 公网时走代理；其它（blob:/data:/已经同源的 /api/media 自身）原样返回。

export function mediaProxy(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  // 已经走代理就别再套一层
  if (u.startsWith('/api/media')) return u;
  // 相对路径（同源）不需要代理
  if (u.startsWith('/')) return u;
  // 只代理 http(s) 公网
  if (!/^https?:\/\//i.test(u)) return u;
  return '/api/media?u=' + encodeURIComponent(u);
}
