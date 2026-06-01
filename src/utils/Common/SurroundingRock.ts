/*
 * 围岩体积模型加载工具
 * 流程：精灵图 → 三维体数据 → Marching Cubes 等值面 → Cesium Primitive
 */
import * as Cesium from 'cesium';
import { DTScopeEngine } from './Viewer';

// ─────────────────────────────────────────────────────────────────────────────
// Marching Cubes 标准查找表
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable */
const EDGE_TABLE = new Uint16Array([
  0x0,0x109,0x203,0x30a,0x406,0x50f,0x605,0x70c,0x80c,0x905,0xa0f,0xb06,0xc0a,0xd03,0xe09,0xf00,
  0x190,0x99,0x393,0x29a,0x596,0x49f,0x795,0x69c,0x99c,0x895,0xb9f,0xa96,0xd9a,0xc93,0xf99,0xe90,
  0x230,0x339,0x33,0x13a,0x636,0x73f,0x435,0x53c,0xa3c,0xb35,0x83f,0x936,0xe3a,0xf33,0xc39,0xd30,
  0x3a0,0x2a9,0x1a3,0xaa,0x7a6,0x6af,0x5a5,0x4ac,0xbac,0xaa5,0x9af,0x8a6,0xfaa,0xea3,0xda9,0xca0,
  0x460,0x569,0x663,0x76a,0x66,0x16f,0x265,0x36c,0xc6c,0xd65,0xe6f,0xf66,0x86a,0x963,0xa69,0xb60,
  0x5f0,0x4f9,0x7f3,0x6fa,0x1f6,0xff,0x3f5,0x2fc,0xdfc,0xcf5,0xfff,0xef6,0x9fa,0x8f3,0xbf9,0xaf0,
  0x650,0x759,0x453,0x55a,0x256,0x35f,0x55,0x15c,0xe5c,0xf55,0xc5f,0xd56,0xa5a,0xb53,0x859,0x950,
  0x7c0,0x6c9,0x5c3,0x4ca,0x3c6,0x2cf,0x1c5,0xcc,0xfcc,0xec5,0xdcf,0xcc6,0xbca,0xac3,0x9c9,0x8c0,
  0x8c0,0x9c9,0xac3,0xbca,0xcc6,0xdcf,0xec5,0xfcc,0xcc,0x1c5,0x2cf,0x3c6,0x4ca,0x5c3,0x6c9,0x7c0,
  0x950,0x859,0xb53,0xa5a,0xd56,0xc5f,0xf55,0xe5c,0x15c,0x55,0x35f,0x256,0x55a,0x453,0x759,0x650,
  0xaf0,0xbf9,0x8f3,0x9fa,0xef6,0xfff,0xcf5,0xdfc,0x2fc,0x3f5,0xff,0x1f6,0x6fa,0x7f3,0x4f9,0x5f0,
  0xb60,0xa69,0x963,0x86a,0xf66,0xe6f,0xd65,0xc6c,0x36c,0x265,0x16f,0x66,0x76a,0x663,0x569,0x460,
  0xca0,0xda9,0xea3,0xfaa,0x8a6,0x9af,0xaa5,0xbac,0x4ac,0x5a5,0x6af,0x7a6,0xaa,0x1a3,0x2a9,0x3a0,
  0xd30,0xc39,0xf33,0xe3a,0x936,0x83f,0xb35,0xa3c,0x53c,0x435,0x73f,0x636,0x13a,0x33,0x339,0x230,
  0xe90,0xf99,0xc93,0xd9a,0xa96,0xb9f,0x895,0x99c,0x69c,0x795,0x49f,0x596,0x29a,0x393,0x99,0x190,
  0xf00,0xe09,0xd03,0xc0a,0xb06,0xa0f,0x905,0x80c,0x70c,0x605,0x50f,0x406,0x30a,0x203,0x109,0x0,
]);

const TRI_TABLE: Int8Array[] = [
  new Int8Array([-1]),
  new Int8Array([0,8,3,-1]),
  new Int8Array([0,1,9,-1]),
  new Int8Array([1,8,3,9,8,1,-1]),
  new Int8Array([1,2,10,-1]),
  new Int8Array([0,8,3,1,2,10,-1]),
  new Int8Array([9,2,10,0,2,9,-1]),
  new Int8Array([2,8,3,2,10,8,10,9,8,-1]),
  new Int8Array([3,11,2,-1]),
  new Int8Array([0,11,2,8,11,0,-1]),
  new Int8Array([1,9,0,2,3,11,-1]),
  new Int8Array([1,11,2,1,9,11,9,8,11,-1]),
  new Int8Array([3,10,1,11,10,3,-1]),
  new Int8Array([0,10,1,0,8,10,8,11,10,-1]),
  new Int8Array([3,9,0,3,11,9,11,10,9,-1]),
  new Int8Array([9,8,10,10,8,11,-1]),
  new Int8Array([4,7,8,-1]),
  new Int8Array([4,3,0,7,3,4,-1]),
  new Int8Array([0,1,9,8,4,7,-1]),
  new Int8Array([4,1,9,4,7,1,7,3,1,-1]),
  new Int8Array([1,2,10,8,4,7,-1]),
  new Int8Array([3,4,7,3,0,4,1,2,10,-1]),
  new Int8Array([9,2,10,9,0,2,8,4,7,-1]),
  new Int8Array([2,10,9,2,9,7,2,7,3,7,9,4,-1]),
  new Int8Array([8,4,7,3,11,2,-1]),
  new Int8Array([11,4,7,11,2,4,2,0,4,-1]),
  new Int8Array([9,0,1,8,4,7,2,3,11,-1]),
  new Int8Array([4,7,11,9,4,11,9,11,2,9,2,1,-1]),
  new Int8Array([3,10,1,3,11,10,7,8,4,-1]),
  new Int8Array([1,11,10,1,4,11,1,0,4,7,11,4,-1]),
  new Int8Array([4,7,8,9,0,11,9,11,10,11,0,3,-1]),
  new Int8Array([4,7,11,4,11,9,9,11,10,-1]),
  new Int8Array([9,5,4,-1]),
  new Int8Array([9,5,4,0,8,3,-1]),
  new Int8Array([0,5,4,1,5,0,-1]),
  new Int8Array([8,5,4,8,3,5,3,1,5,-1]),
  new Int8Array([1,2,10,9,5,4,-1]),
  new Int8Array([3,0,8,1,2,10,4,9,5,-1]),
  new Int8Array([5,2,10,5,4,2,4,0,2,-1]),
  new Int8Array([2,10,5,3,2,5,3,5,4,3,4,8,-1]),
  new Int8Array([9,5,4,2,3,11,-1]),
  new Int8Array([0,11,2,0,8,11,4,9,5,-1]),
  new Int8Array([0,5,4,0,1,5,2,3,11,-1]),
  new Int8Array([2,1,5,2,5,8,2,8,11,4,8,5,-1]),
  new Int8Array([10,3,11,10,1,3,9,5,4,-1]),
  new Int8Array([4,9,5,0,8,1,8,10,1,8,11,10,-1]),
  new Int8Array([5,4,0,5,0,11,5,11,10,11,0,3,-1]),
  new Int8Array([5,4,8,5,8,10,10,8,11,-1]),
  new Int8Array([9,7,8,5,7,9,-1]),
  new Int8Array([9,3,0,9,5,3,5,7,3,-1]),
  new Int8Array([0,7,8,0,1,7,1,5,7,-1]),
  new Int8Array([1,5,3,3,5,7,-1]),
  new Int8Array([9,7,8,9,5,7,10,1,2,-1]),
  new Int8Array([10,1,2,9,5,0,5,3,0,5,7,3,-1]),
  new Int8Array([8,0,2,8,2,5,8,5,7,10,5,2,-1]),
  new Int8Array([2,10,5,2,5,3,3,5,7,-1]),
  new Int8Array([7,9,5,7,8,9,3,11,2,-1]),
  new Int8Array([9,5,7,9,7,2,9,2,0,2,7,11,-1]),
  new Int8Array([2,3,11,0,1,8,1,7,8,1,5,7,-1]),
  new Int8Array([11,2,1,11,1,7,7,1,5,-1]),
  new Int8Array([9,5,8,8,5,7,10,1,3,10,3,11,-1]),
  new Int8Array([5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1]),
  new Int8Array([11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1]),
  new Int8Array([11,10,5,7,11,5,-1]),
  new Int8Array([10,6,5,-1]),
  new Int8Array([0,8,3,5,10,6,-1]),
  new Int8Array([9,0,1,5,10,6,-1]),
  new Int8Array([1,8,3,1,9,8,5,10,6,-1]),
  new Int8Array([1,6,5,2,6,1,-1]),
  new Int8Array([1,6,5,1,2,6,3,0,8,-1]),
  new Int8Array([9,6,5,9,0,6,0,2,6,-1]),
  new Int8Array([5,9,8,5,8,2,5,2,6,3,2,8,-1]),
  new Int8Array([2,3,11,10,6,5,-1]),
  new Int8Array([11,0,8,11,2,0,10,6,5,-1]),
  new Int8Array([0,1,9,2,3,11,5,10,6,-1]),
  new Int8Array([5,10,6,1,9,2,9,11,2,9,8,11,-1]),
  new Int8Array([6,3,11,6,5,3,5,1,3,-1]),
  new Int8Array([0,8,11,0,11,5,0,5,1,5,11,6,-1]),
  new Int8Array([3,11,6,0,3,6,0,6,5,0,5,9,-1]),
  new Int8Array([6,5,9,6,9,11,11,9,8,-1]),
  new Int8Array([5,10,6,4,7,8,-1]),
  new Int8Array([4,3,0,4,7,3,6,5,10,-1]),
  new Int8Array([1,9,0,5,10,6,8,4,7,-1]),
  new Int8Array([10,6,5,1,9,7,1,7,3,7,9,4,-1]),
  new Int8Array([6,1,2,6,5,1,4,7,8,-1]),
  new Int8Array([1,2,5,5,2,6,3,0,4,3,4,7,-1]),
  new Int8Array([8,4,7,9,0,5,0,6,5,0,2,6,-1]),
  new Int8Array([7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1]),
  new Int8Array([3,11,2,7,8,4,10,6,5,-1]),
  new Int8Array([5,10,6,4,7,2,4,2,0,2,7,11,-1]),
  new Int8Array([0,1,9,4,7,8,2,3,11,5,10,6,-1]),
  new Int8Array([9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1]),
  new Int8Array([8,4,7,3,11,5,3,5,1,5,11,6,-1]),
  new Int8Array([5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1]),
  new Int8Array([0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1]),
  new Int8Array([6,5,9,6,9,11,4,7,9,7,11,9,-1]),
  new Int8Array([10,4,9,6,4,10,-1]),
  new Int8Array([4,10,6,4,9,10,0,8,3,-1]),
  new Int8Array([10,0,1,10,6,0,6,4,0,-1]),
  new Int8Array([8,3,1,8,1,6,8,6,4,6,1,10,-1]),
  new Int8Array([1,4,9,1,2,4,2,6,4,-1]),
  new Int8Array([3,0,8,1,2,9,2,4,9,2,6,4,-1]),
  new Int8Array([0,2,4,4,2,6,-1]),
  new Int8Array([8,3,2,8,2,4,4,2,6,-1]),
  new Int8Array([10,4,9,10,6,4,11,2,3,-1]),
  new Int8Array([0,8,2,2,8,11,4,9,10,4,10,6,-1]),
  new Int8Array([3,11,2,0,1,6,0,6,4,6,1,10,-1]),
  new Int8Array([6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1]),
  new Int8Array([9,6,4,9,3,6,9,1,3,11,6,3,-1]),
  new Int8Array([8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1]),
  new Int8Array([3,11,6,3,6,0,0,6,4,-1]),
  new Int8Array([6,4,8,11,6,8,-1]),
  new Int8Array([7,10,6,7,8,10,8,9,10,-1]),
  new Int8Array([0,7,3,0,10,7,0,9,10,6,7,10,-1]),
  new Int8Array([10,6,7,1,10,7,1,7,8,1,8,0,-1]),
  new Int8Array([10,6,7,10,7,1,1,7,3,-1]),
  new Int8Array([1,2,6,1,6,8,1,8,9,8,6,7,-1]),
  new Int8Array([2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1]),
  new Int8Array([7,8,0,7,0,6,6,0,2,-1]),
  new Int8Array([7,3,2,6,7,2,-1]),
  new Int8Array([2,3,11,10,6,8,10,8,9,8,6,7,-1]),
  new Int8Array([2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1]),
  new Int8Array([1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1]),
  new Int8Array([11,2,1,11,1,7,10,6,1,6,7,1,-1]),
  new Int8Array([8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1]),
  new Int8Array([0,9,1,11,6,7,-1]),
  new Int8Array([7,8,0,7,0,6,3,11,0,11,6,0,-1]),
  new Int8Array([7,11,6,-1]),
  new Int8Array([7,6,11,-1]),
  new Int8Array([3,0,8,11,7,6,-1]),
  new Int8Array([0,1,9,11,7,6,-1]),
  new Int8Array([8,1,9,8,3,1,11,7,6,-1]),
  new Int8Array([10,1,2,6,11,7,-1]),
  new Int8Array([1,2,10,3,0,8,6,11,7,-1]),
  new Int8Array([2,9,0,2,10,9,6,11,7,-1]),
  new Int8Array([6,11,7,2,10,3,10,8,3,10,9,8,-1]),
  new Int8Array([7,2,3,6,2,7,-1]),
  new Int8Array([7,0,8,7,6,0,6,2,0,-1]),
  new Int8Array([2,7,6,2,3,7,0,1,9,-1]),
  new Int8Array([1,6,2,1,8,6,1,9,8,8,7,6,-1]),
  new Int8Array([10,7,6,10,1,7,1,3,7,-1]),
  new Int8Array([10,7,6,1,7,10,1,8,7,1,0,8,-1]),
  new Int8Array([0,3,7,0,7,10,0,10,9,6,10,7,-1]),
  new Int8Array([7,6,10,7,10,8,8,10,9,-1]),
  new Int8Array([6,8,4,11,8,6,-1]),
  new Int8Array([3,6,11,3,0,6,0,4,6,-1]),
  new Int8Array([8,6,11,8,4,6,9,0,1,-1]),
  new Int8Array([9,4,6,9,6,3,9,3,1,11,3,6,-1]),
  new Int8Array([6,8,4,6,11,8,2,10,1,-1]),
  new Int8Array([1,2,10,3,0,11,0,6,11,0,4,6,-1]),
  new Int8Array([4,11,8,4,6,11,0,2,9,2,10,9,-1]),
  new Int8Array([10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1]),
  new Int8Array([8,2,3,8,4,2,4,6,2,-1]),
  new Int8Array([0,4,2,4,6,2,-1]),
  new Int8Array([1,9,0,2,3,4,2,4,6,4,3,8,-1]),
  new Int8Array([1,9,4,1,4,2,2,4,6,-1]),
  new Int8Array([8,1,3,8,6,1,8,4,6,6,10,1,-1]),
  new Int8Array([10,1,0,10,0,6,6,0,4,-1]),
  new Int8Array([4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1]),
  new Int8Array([10,9,4,6,10,4,-1]),
  new Int8Array([4,9,5,7,6,11,-1]),
  new Int8Array([0,8,3,4,9,5,11,7,6,-1]),
  new Int8Array([5,0,1,5,4,0,7,6,11,-1]),
  new Int8Array([11,7,6,8,3,4,3,5,4,3,1,5,-1]),
  new Int8Array([9,5,4,10,1,2,7,6,11,-1]),
  new Int8Array([6,11,7,1,2,10,0,8,3,4,9,5,-1]),
  new Int8Array([7,6,11,5,4,10,4,2,10,4,0,2,-1]),
  new Int8Array([3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1]),
  new Int8Array([7,2,3,7,6,2,5,4,9,-1]),
  new Int8Array([9,5,4,0,8,6,0,6,2,6,8,7,-1]),
  new Int8Array([3,6,2,3,7,6,1,5,0,5,4,0,-1]),
  new Int8Array([6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1]),
  new Int8Array([9,5,4,10,1,6,1,7,6,1,3,7,-1]),
  new Int8Array([1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1]),
  new Int8Array([4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1]),
  new Int8Array([7,6,10,7,10,8,5,4,10,4,8,10,-1]),
  new Int8Array([6,9,5,6,11,9,11,8,9,-1]),
  new Int8Array([3,6,11,0,6,3,0,5,6,0,9,5,-1]),
  new Int8Array([0,11,8,0,5,11,0,1,5,5,6,11,-1]),
  new Int8Array([6,11,3,6,3,5,5,3,1,-1]),
  new Int8Array([1,2,10,9,5,11,9,11,8,11,5,6,-1]),
  new Int8Array([0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1]),
  new Int8Array([11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1]),
  new Int8Array([6,11,3,6,3,5,2,10,3,10,5,3,-1]),
  new Int8Array([5,8,9,5,2,8,5,6,2,3,8,2,-1]),
  new Int8Array([9,5,6,9,6,0,0,6,2,-1]),
  new Int8Array([1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1]),
  new Int8Array([1,5,6,2,1,6,-1]),
  new Int8Array([1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1]),
  new Int8Array([10,1,0,10,0,6,9,5,0,5,6,0,-1]),
  new Int8Array([0,3,8,5,6,10,-1]),
  new Int8Array([10,5,6,-1]),
  new Int8Array([11,5,10,7,5,11,-1]),
  new Int8Array([11,5,10,11,7,5,8,3,0,-1]),
  new Int8Array([5,11,7,5,10,11,1,9,0,-1]),
  new Int8Array([10,7,5,10,11,7,9,8,1,8,3,1,-1]),
  new Int8Array([11,1,2,11,7,1,7,5,1,-1]),
  new Int8Array([0,8,3,1,2,7,1,7,5,7,2,11,-1]),
  new Int8Array([9,7,5,9,2,7,9,0,2,2,11,7,-1]),
  new Int8Array([7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1]),
  new Int8Array([2,5,10,2,3,5,3,7,5,-1]),
  new Int8Array([8,2,0,8,5,2,8,7,5,10,2,5,-1]),
  new Int8Array([9,0,1,5,10,3,5,3,7,3,10,2,-1]),
  new Int8Array([9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1]),
  new Int8Array([1,3,5,3,7,5,-1]),
  new Int8Array([0,8,7,0,7,1,1,7,5,-1]),
  new Int8Array([9,0,3,9,3,5,5,3,7,-1]),
  new Int8Array([9,8,7,5,9,7,-1]),
  new Int8Array([5,8,4,5,10,8,10,11,8,-1]),
  new Int8Array([5,0,4,5,11,0,5,10,11,11,3,0,-1]),
  new Int8Array([0,1,9,8,4,10,8,10,11,10,4,5,-1]),
  new Int8Array([10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1]),
  new Int8Array([2,5,1,2,8,5,2,11,8,4,5,8,-1]),
  new Int8Array([0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1]),
  new Int8Array([0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1]),
  new Int8Array([9,4,5,2,11,3,-1]),
  new Int8Array([2,5,10,3,5,2,3,4,5,3,8,4,-1]),
  new Int8Array([5,10,2,5,2,4,4,2,0,-1]),
  new Int8Array([3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1]),
  new Int8Array([5,10,2,5,2,4,1,9,2,9,4,2,-1]),
  new Int8Array([8,4,5,8,5,3,3,5,1,-1]),
  new Int8Array([0,4,5,1,0,5,-1]),
  new Int8Array([8,4,5,8,5,3,9,0,5,0,3,5,-1]),
  new Int8Array([9,4,5,-1]),
  new Int8Array([4,11,7,4,9,11,9,10,11,-1]),
  new Int8Array([0,8,3,4,9,7,9,11,7,9,10,11,-1]),
  new Int8Array([1,10,11,1,11,4,1,4,0,7,4,11,-1]),
  new Int8Array([3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1]),
  new Int8Array([4,11,7,9,11,4,9,2,11,9,1,2,-1]),
  new Int8Array([9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1]),
  new Int8Array([11,7,4,11,4,2,2,4,0,-1]),
  new Int8Array([11,7,4,11,4,2,8,3,4,3,2,4,-1]),
  new Int8Array([2,9,10,2,7,9,2,3,7,7,4,9,-1]),
  new Int8Array([9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1]),
  new Int8Array([3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1]),
  new Int8Array([1,10,2,8,7,4,-1]),
  new Int8Array([4,9,1,4,1,7,7,1,3,-1]),
  new Int8Array([4,9,1,4,1,7,0,8,1,8,7,1,-1]),
  new Int8Array([4,0,3,7,4,3,-1]),
  new Int8Array([4,8,7,-1]),
  new Int8Array([9,10,8,10,11,8,-1]),
  new Int8Array([3,0,9,3,9,11,11,9,10,-1]),
  new Int8Array([0,1,10,0,10,8,8,10,11,-1]),
  new Int8Array([3,1,10,11,3,10,-1]),
  new Int8Array([1,2,11,1,11,9,9,11,8,-1]),
  new Int8Array([3,0,9,3,9,11,1,2,9,2,11,9,-1]),
  new Int8Array([0,2,11,8,0,11,-1]),
  new Int8Array([3,2,11,-1]),
  new Int8Array([2,3,8,2,8,10,10,8,9,-1]),
  new Int8Array([9,10,2,0,9,2,-1]),
  new Int8Array([2,3,8,2,8,10,0,1,8,1,10,8,-1]),
  new Int8Array([1,10,2,-1]),
  new Int8Array([1,3,8,9,1,8,-1]),
  new Int8Array([0,9,1,-1]),
  new Int8Array([0,3,8,-1]),
  new Int8Array([-1]),
];
/* eslint-enable */

// ─────────────────────────────────────────────────────────────────────────────
// 精灵图 → 3D 体数据
// ─────────────────────────────────────────────────────────────────────────────

function loadVolumeFromSprite(
  url: string,
  xRes: number,
  yRes: number,
  zRes: number,
  tilesPerRow: number,
): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, img.width, img.height).data;

      const vol = new Float32Array(xRes * yRes * zRes);
      for (let z = 0; z < zRes; z++) {
        const tileCol = z % tilesPerRow;
        const tileRow = Math.floor(z / tilesPerRow);
        const ox = tileCol * xRes;
        const oy = tileRow * yRes;
        for (let y = 0; y < yRes; y++) {
          for (let x = 0; x < xRes; x++) {
            const px = ox + x;
            const py = oy + y;
            const idx = (py * img.width + px) * 4;
            // 灰度归一化 [0,1]
            vol[z * yRes * xRes + y * xRes + x] =
              (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
          }
        }
      }
      resolve(vol);
    };
    img.onerror = () => reject(new Error(`无法加载体数据图片: ${url}`));
    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Marching Cubes
// ─────────────────────────────────────────────────────────────────────────────

function sampleVol(vol: Float32Array, x: number, y: number, z: number, xR: number, yR: number): number {
  return vol[z * yR * xR + y * xR + x];
}

function interp(iso: number, v0: number, v1: number, p0: number[], p1: number[]): number[] {
  const t = Math.abs(v1 - v0) < 1e-6 ? 0.5 : (iso - v0) / (v1 - v0);
  return [p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1]), p0[2] + t * (p1[2] - p0[2])];
}

function marchingCubes(
  vol: Float32Array,
  xRes: number,
  yRes: number,
  zRes: number,
  isovalue: number,
): { vertices: Float32Array; indices: Uint32Array } {
  const verts: number[] = [];
  const idxs: number[]  = [];

  for (let z = 0; z < zRes - 1; z++) {
    for (let y = 0; y < yRes - 1; y++) {
      for (let x = 0; x < xRes - 1; x++) {
        // 8 个角点值
        const vals = [
          sampleVol(vol, x,   y,   z,   xRes, yRes),
          sampleVol(vol, x+1, y,   z,   xRes, yRes),
          sampleVol(vol, x+1, y+1, z,   xRes, yRes),
          sampleVol(vol, x,   y+1, z,   xRes, yRes),
          sampleVol(vol, x,   y,   z+1, xRes, yRes),
          sampleVol(vol, x+1, y,   z+1, xRes, yRes),
          sampleVol(vol, x+1, y+1, z+1, xRes, yRes),
          sampleVol(vol, x,   y+1, z+1, xRes, yRes),
        ];
        // 8 个角点坐标
        const pts = [
          [x,   y,   z  ], [x+1, y,   z  ], [x+1, y+1, z  ], [x,   y+1, z  ],
          [x,   y,   z+1], [x+1, y,   z+1], [x+1, y+1, z+1], [x,   y+1, z+1],
        ];

        let cubeIdx = 0;
        for (let i = 0; i < 8; i++) if (vals[i] > isovalue) cubeIdx |= (1 << i);

        const edgeMask = EDGE_TABLE[cubeIdx];
        if (edgeMask === 0) continue;

        // 12 条边的插值顶点
        const edgePts: (number[] | null)[] = new Array(12).fill(null);
        const EDGES: [number, number][] = [
          [0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7],
        ];
        for (let e = 0; e < 12; e++) {
          if (edgeMask & (1 << e)) {
            const [a, b] = EDGES[e];
            edgePts[e] = interp(isovalue, vals[a], vals[b], pts[a], pts[b]);
          }
        }

        const tri = TRI_TABLE[cubeIdx];
        for (let t = 0; t < tri.length && tri[t] !== -1; t += 3) {
          const base = verts.length / 3;
          for (let k = 0; k < 3; k++) {
            const p = edgePts[tri[t + k]]!;
            verts.push(p[0], p[1], p[2]);
          }
          idxs.push(base, base + 1, base + 2);
        }
      }
    }
  }

  return {
    vertices: new Float32Array(verts),
    indices:  new Uint32Array(idxs),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 法线计算（face normals → vertex normals 平滑）
// ─────────────────────────────────────────────────────────────────────────────

function computeNormals(vertices: Float32Array, indices: Uint32Array): Float32Array {
  const normals = new Float32Array(vertices.length);
  const counts  = new Uint32Array(vertices.length / 3);

  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i] * 3, i1 = indices[i+1] * 3, i2 = indices[i+2] * 3;
    const ax = vertices[i1] - vertices[i0], ay = vertices[i1+1] - vertices[i0+1], az = vertices[i1+2] - vertices[i0+2];
    const bx = vertices[i2] - vertices[i0], by = vertices[i2+1] - vertices[i0+1], bz = vertices[i2+2] - vertices[i0+2];
    const nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
    for (const idx of [indices[i], indices[i+1], indices[i+2]]) {
      normals[idx*3] += nx; normals[idx*3+1] += ny; normals[idx*3+2] += nz;
      counts[idx]++;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.sqrt(normals[i]**2 + normals[i+1]**2 + normals[i+2]**2) || 1;
    normals[i] /= len; normals[i+1] /= len; normals[i+2] /= len;
  }
  return normals;
}

// ─────────────────────────────────────────────────────────────────────────────
// 构建 Cesium Primitive
// ─────────────────────────────────────────────────────────────────────────────

function buildPrimitive(
  vertices: Float32Array,
  normals:  Float32Array,
  indices:  Uint32Array,
  modelMatrix: Cesium.Matrix4,
): Cesium.Primitive {
  const posAttr = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: vertices,
  });
  const normAttr = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: normals,
  });

  const geometry = new Cesium.Geometry({
    attributes: {
      position: posAttr,
      normal:   normAttr,
    },
    indices,
    primitiveType:  Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromVertices(Array.from(vertices) as any),
  });

  const material = Cesium.Material.fromType('Color', {
    color: Cesium.Color.fromCssColorString('#a05828').withAlpha(0.92),
  });

  const appearance = new Cesium.MaterialAppearance({
    material,
    faceForward: true,
    translucent: true,
    closed: false,
  });

  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({ geometry }),
    appearance,
    modelMatrix,
    asynchronous: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 公开 API
// ─────────────────────────────────────────────────────────────────────────────

export interface SurroundingRockConfig {
  /** 精灵图 URL（相对于 public/），例如 '/data/POSUI/posui0112.jpg' */
  url: string;
  /** 体素分辨率 [xRes, yRes, zRes] */
  res: [number, number, number];
  /** 每行瓦片数（精灵图横向排列列数），默认按 ceil(sqrt(zRes)) 推算 */
  tilesPerRow?: number;
  /** 等值面阈值 [0,1]，默认 0.65 */
  isovalue?: number;
  /** 锚点经纬度高程（模型中心放置位置）*/
  anchor: { lon: number; lat: number; height: number };
  /**
   * 每个体素对应的实际米数 [x, y, z]
   * 例如 [0.5, 0.5, 0.6] 表示每体素 0.5m × 0.5m × 0.6m
   */
  metersPerVoxel: [number, number, number];
  /** 绕 Z 轴旋转（方位角，度），使模型朝向与隧道走向对齐，默认 0 */
  headingDeg?: number;
}

let _primitive: Cesium.Primitive | null = null;

export async function loadSurroundingRock(
  options: SurroundingRockConfig,
  customViewer?: any,
): Promise<void> {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer) { console.warn('⚠️ 围岩模型：Viewer 未初始化'); return; }

  removeSurroundingRock(customViewer);

  const [xRes, yRes, zRes] = options.res;
  const isovalue    = options.isovalue    ?? 0.65;
  const tilesPerRow = options.tilesPerRow ?? Math.ceil(Math.sqrt(zRes));
  const mpv         = options.metersPerVoxel;
  const headingRad  = Cesium.Math.toRadians(options.headingDeg ?? 0);

  console.log('⏳ 围岩模型：加载体数据...');
  let vol: Float32Array;
  try {
    vol = await loadVolumeFromSprite(options.url, xRes, yRes, zRes, tilesPerRow);
  } catch (e) {
    console.error('❌ 围岩模型：体数据加载失败', e);
    return;
  }

  console.log('⚙️ 围岩模型：执行 Marching Cubes...');
  const { vertices, indices } = marchingCubes(vol, xRes, yRes, zRes, isovalue);
  if (vertices.length === 0) { console.warn('⚠️ 围岩模型：等值面为空，请调整 isovalue'); return; }

  const normals = computeNormals(vertices, indices);

  // 将体素坐标居中并缩放为米
  const cx = xRes / 2, cy = yRes / 2, cz = zRes / 2;
  for (let i = 0; i < vertices.length; i += 3) {
    vertices[i]   = (vertices[i]   - cx) * mpv[0];
    vertices[i+1] = (vertices[i+1] - cy) * mpv[1];
    vertices[i+2] = (vertices[i+2] - cz) * mpv[2];
  }

  // 建立以 anchor 为原点的 ENU 坐标系，并附加 heading 旋转
  const origin = Cesium.Cartesian3.fromDegrees(
    options.anchor.lon, options.anchor.lat, options.anchor.height,
  );
  const enu    = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const rot    = Cesium.Matrix4.fromRotationTranslation(
    Cesium.Matrix3.fromRotationZ(headingRad),
    Cesium.Cartesian3.ZERO,
  );
  const modelMatrix = Cesium.Matrix4.multiply(enu, rot, new Cesium.Matrix4());

  const primitive = buildPrimitive(vertices, normals, indices, modelMatrix);
  _primitive = viewer.scene.primitives.add(primitive);
  console.log(`✅ 围岩模型已加载（${indices.length / 3} 个三角面，isovalue=${isovalue}）`);
}

export function removeSurroundingRock(customViewer?: any): void {
  const viewer = customViewer || DTScopeEngine.viewer;
  if (!viewer || !_primitive) return;
  viewer.scene.primitives.remove(_primitive);
  _primitive = null;
}
