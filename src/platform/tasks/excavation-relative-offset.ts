export function excavationRelativeOffsets(request: string) {
  return [...request.matchAll(/开挖基准(?:点)?\s*(前方|后方)\s*(\d+(?:\.\d+)?)\s*(?:米|m\b)/gi)]
}
