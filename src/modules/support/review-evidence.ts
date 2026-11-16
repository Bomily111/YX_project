import type { SupportLayoutRow } from './longitudinal-layout'

/** Evaluates recorded placement only. No geometry or engineering approval is inferred. */
export function supportReviewEvidence(rows: readonly SupportLayoutRow[]) {
  const checks = rows.map(row => {
    const valid = Number.isFinite(row.lengthM) && row.lengthM > 0 && row.offsetsM.length > 0
      && row.offsetsM.every((offset, i, all) => Number.isFinite(offset)
        && offset >= -row.lengthM - .5 - 1e-6 && offset <= -.5 + 1e-6
        && (i === 0 || offset > all[i - 1]!))
    return {
      rowId: row.id, resourceId: row.resourceId, component: row.component,
      placementRecord: valid ? 'consistent' : 'needs-review',
      nextAction: valid
        ? `核对${row.type}的${row.component}在对应工段设计中的适用性、首末站及标高。`
        : `先核查${row.component}的站位记录是否缺失、非有限、重复、乱序或超出当前装配范围。`,
      reinforcementSpacingVerified: false,
    }
  })
  return {
    scope: 'record-consistency-only',
    recordStatus: !checks.length ? 'missing' : checks.every(c => c.placementRecord === 'consistent') ? 'consistent' : 'needs-review',
    checks,
    evidenceGaps: [
      { id: 'section-design', status: 'missing', nextAction: '补充本工段设计版本、适用里程与章节或页码，再比对构件间距与布置。' },
      { id: 'field-measurement', status: 'missing', nextAction: '补充同一基准的实测记录，缺失时不计算设计实测偏差。' },
      { id: 'geometry-fit', status: 'not-verified', nextAction: '核验源断面适用性、标高与三台阶交界接缝；站位一致不能代替几何检查。' },
    ],
    engineeringAcceptance: 'not-verified',
    stopReason: '当前只读记录核查结束；补齐资料或几何检查后再判断，重复取景和显隐不能补齐证据。',
  }
}
