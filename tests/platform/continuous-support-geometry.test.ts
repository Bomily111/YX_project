import { expect, it } from 'vitest'
import * as T from 'three'
import { fitSupportUnit } from '@/modules/support/continuous-geometry'

it('shares identical joint coordinates across a bend and height change', () => {
  const source = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([2,3,0, 2,3,1], 3))
  const start = new T.Matrix4()
  const joint = new T.Matrix4().makeRotationY(.2).setPosition(0, .3, 1)
  const end = new T.Matrix4().makeRotationY(.4).setPosition(.2, .6, 2)
  const left = fitSupportUnit(source, start, joint).getAttribute('position')
  const right = fitSupportUnit(source, joint, end).getAttribute('position')
  expect([left.getX(1),left.getY(1),left.getZ(1)]).toEqual([right.getX(0),right.getY(0),right.getZ(0)])
  expect(source.getAttribute('position').getZ(1)).toBe(1)
})
it('preserves inclined anchor extensions beyond the nominal unit boundaries', () => {
  const source = new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute([0,0,2], 3))
  const fitted = fitSupportUnit(source, new T.Matrix4(), new T.Matrix4().makeTranslation(0, 0, 1))
  expect(fitted.getAttribute('position').getZ(0)).toBe(2)
})
