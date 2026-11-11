export function supportOffsets(length = 10) {
  if (!Number.isInteger(length) || length < 1 || length > 20) throw new Error('测试支护长度须为1～20米整数；不自动取整或改成最近长度')
  return Array.from({ length }, (_, index) => -length - .5 + index)
}
/** Read the protected user request, excluding source-unit dimensions. */
export function resolveTestSupportLength(request: string): number {
  const values: number[] = []
  const number = (text: string) => {
    if (/^[+-]?\d/.test(text)) return Number(text)
    const digits: Record<string, number> = { 零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9 }
    if (/百|千|万|点|半/.test(text)) throw new Error('测试支护长度须为1～20米整数')
    const parts = text.split('十')
    if (parts.length === 2) return (parts[0] ? digits[parts[0]] : 1)*10 + (parts[1] ? digits[parts[1]] : 0)
    return digits[text]
  }
  for (const match of request.matchAll(/([+-]?\d+(?:\.\d+)?|[零一二两三四五六七八九十百千万点半]+)\s*(?:米|m\b)/gi)) {
    const after = request.slice(match.index! + match[0].length)
    if (/^\s*(?:单元|模板)/.test(after)) continue
    values.push(number(match[1]))
  }
  for (const match of request.matchAll(/(\d+|[零一二两三四五六七八九十百千万点半]+)\s*个\s*(?:已有|原始)?\s*(?:1|一)\s*(?:米|m)\s*(?:单元|模板)/gi)) values.push(number(match[1]))
  const lengths = [...new Set(values)]
  if (lengths.length > 1) throw new Error('请求含多个长度，请明确本次后方支护的长度')
  const length = lengths[0] ?? 10
  supportOffsets(length)
  return length
}
