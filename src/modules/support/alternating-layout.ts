/** A delivered 1 m section occupies local z=0..1, so place each copy at its start chainage. */
export interface SupportSectionPlacement {
  index: number
  supportType: string
  chainage: number
  endChainage: number
}

export function planAlternatingSupportSections(
  startChainage: number,
  lengthM: number,
  supportTypes: readonly [string, string],
): SupportSectionPlacement[] {
  if (!Number.isFinite(startChainage) || !Number.isInteger(lengthM) || lengthM < 1 || lengthM > 50) {
    throw new Error('支护演示范围必须为 1–50 个整米断面')
  }
  if (supportTypes.some(type => !type.trim()) || supportTypes[0] === supportTypes[1]) {
    throw new Error('交替装配需要两种不同的支护断面')
  }
  return Array.from({ length: lengthM }, (_, index) => ({
    index,
    supportType: supportTypes[index % 2],
    chainage: startChainage + index,
    endChainage: startChainage + index + 1,
  }))
}
