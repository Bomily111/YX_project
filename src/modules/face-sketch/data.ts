export interface FaceSketchRecord {
  mileage: string
  mileageValue: number
  date: string
  photoUrl: string
  textureUrl: string
  distanceFromPortal: number
  width: number
  height: number
  area: number
  faceState: string
  excavation: string
  rockType: string
  rockHardness: string
  integrity: string
  structureGroups: number
  averageSpacing: number
  orientations: string[]
  weathering: string
  basicGrade: string
  correctedGrade: string
  waterInflow: number
  waterState: string
  buriedDepth: number
  stressState: string
  summary: string
}

const common = {
  excavation: '全断面',
  rockType: '二长花岗岩',
  rockHardness: '极硬岩',
  integrity: '较完整，局部较破碎',
  structureGroups: 2,
  averageSpacing: 0.4,
  orientations: ['N45°W/75°NE', 'N65°E/90°'],
  weathering: '弱风化',
  basicGrade: 'Ⅳ级',
  correctedGrade: 'Ⅳ级',
  stressState: '一般地应力',
  width: 8.16,
  height: 7.73,
  area: 59.29,
}

export const FACE_SKETCH_RECORDS: FaceSketchRecord[] = [
  {
    ...common,
    mileage: 'X1DK2+880.6', mileageValue: 2880.6, date: '2022-07-03',
    photoUrl: '/data/face_sketch/X1DK2_880_6.jpg', textureUrl: '/data/face_sketch/X1DK2_880_6_fitted.jpg', distanceFromPortal: 1024.4,
    faceState: '掌子面稳定，毛开挖面随时间松弛、掉块',
    waterInflow: 30, waterState: '淋雨状或线流状出水', buriedDepth: 561.51,
    summary: '掌子面围岩为弱风化二长花岗岩，节理裂隙较发育并见石英脉；整体较完整，拱顶局部较破碎。掌子面整体湿润、渗水，拱顶呈股状出水，后方呈淋雨状出水。',
  },
  {
    ...common,
    mileage: 'X1DK2+885.4', mileageValue: 2885.4, date: '2022-07-02',
    photoUrl: '/data/face_sketch/X1DK2_885_4.jpg', textureUrl: '/data/face_sketch/X1DK2_885_4_fitted.jpg', distanceFromPortal: 1019.6,
    faceState: '掌子面稳定，毛开挖面随时间松弛、掉块',
    waterInflow: 20, waterState: '潮湿或点滴状出水', buriedDepth: 558.42,
    summary: '掌子面围岩为弱风化二长花岗岩，节理裂隙较发育并见石英脉；围岩整体较完整，拱顶局部较破碎。掌子面整体湿润、渗水，拱顶呈股状出水。',
  },
  {
    ...common,
    mileage: 'X1DK2+892.6', mileageValue: 2892.6, date: '2022-06-29',
    photoUrl: '/data/face_sketch/X1DK2_892_6.jpg', textureUrl: '/data/face_sketch/X1DK2_892_6_fitted.jpg', distanceFromPortal: 1012.4,
    faceState: '掌子面稳定，毛开挖面随时间松弛、掉块',
    waterInflow: 30, waterState: '淋雨状或线流状出水', buriedDepth: 553.93,
    summary: '掌子面围岩为弱风化二长花岗岩，节理裂隙较发育并见石英脉；围岩整体较完整，拱顶局部较破碎。掌子面整体湿润、局部渗水，拱顶局部呈股状出水。',
  },
  {
    ...common,
    mileage: 'X1DK2+900.0', mileageValue: 2900.0, date: '2022-06-19',
    photoUrl: '/data/face_sketch/X1DK2_900_0.jpg', textureUrl: '/data/face_sketch/X1DK2_900_0_fitted.jpg', distanceFromPortal: 1005.0,
    width: 7.73, height: 8.16,
    faceState: '掌子面稳定，毛开挖面随时间松弛、掉块',
    waterInflow: 20, waterState: '潮湿或点滴状出水', buriedDepth: 549.97,
    summary: '掌子面围岩为弱风化二长花岗岩，节理裂隙较发育并见石英脉；围岩整体较完整至较破碎。掌子面整体湿润，多处渗水呈线状，拱顶滴水。',
  },
  {
    ...common,
    mileage: 'X1DK2+905.0', mileageValue: 2905.0, date: '2022-06-14',
    photoUrl: '/data/face_sketch/X1DK2_905_0.jpg', textureUrl: '/data/face_sketch/X1DK2_905_0_fitted.jpg', distanceFromPortal: 1000.0,
    faceState: '掌子面整体湿润，局部渗水，多个超前探孔呈股状出水',
    averageSpacing: 0.5,
    waterInflow: 50, waterState: '淋雨状或线流状出水', buriedDepth: 547.29,
    summary: '掌子面围岩为弱风化二长花岗岩，节理裂隙较发育并见石英脉；围岩整体较完整至较破碎。掌子面整体湿润、局部渗水，多个超前探孔呈股状出水。',
  },
]

export const FACE_SKETCH_REFERENCE = {
  mileageValue: 2937.0,
  anchor: [94.9058769996, 29.533338106, 2945.641] as [number, number, number],
  headingDeg: 101.833672597,
  pitchDeg: 0.286420559,
}
