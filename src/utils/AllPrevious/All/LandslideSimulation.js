/*
 * @Descripttion: 滑坡模拟类
 * @version:
 * @Author: JinYiGao
 * @Date: 2021-04-12 21:06:21
 * @LastEditors: anganao
 * @LastEditTime: 2023-12-11 16:04:51
 */
// import { request } from '../BaseCesiumTools/index';
import * as Cesium from 'Cesium';
import SimulationProcess from './SimulationProcess.ts';
import { request } from './Request.ts';

function LandslideSimulation(option) {
  this.viewer = option.viewer;
  this.url = option.url; // 文件路径
  this.loop = option.loop || false; // 是否循环

  this.frameNum = 0; // 滑坡总帧数
  this.maxS = 0.0;
  this.minS = 0.0; // 滑坡流体最大最小速度
  this.frameDataTin = []; // 每帧滑坡数据 tin形式
  this.frameData = []; // 每帧滑坡数据 单个point形式
  this.primitives = []; // 每一帧primitive
  this.index = 0; // 当前即将显示的primitive索引
  this.intervalID = undefined;
  this.listener = undefined;
  this.speed = 200; // 每帧播放间隔
  this.pause = true; // 是否暂停
  this.colorArray = []; // 分级色彩
  this.finish = false; // 是否已经结束模拟

  this.processBar = undefined; // 进度条
}

// //当前绘制的线段索引
// LandslideSimulation.prototype = {
//   get index() {
//     return store.getters.disasterFrame
//   },
//   set index(num) {
//     store.commit("dtglobe_store/setDisasterFrame", num)
//   }
// }

// 读取数据
LandslideSimulation.prototype.getData = function () {
  const _this = this;
  return new Promise((resolve) => {
    request({
      url: _this.url,
      withCredentials: false,
    }).then((data) => {
      const points = data.data.data;
      _this.maxS = data.data.maxS;
      _this.frameNum = points.length;
      resolve(points);
    });
  });
};

// 读取新的数据格式
LandslideSimulation.prototype.getDataNew = function () {
  const _this = this;
  return new Promise((resolve) => {
    request({
      url: _this.url,
      withCredentials: false,
    }).then((data) => {
      const points = data.data;
      _this.maxS = data.maxS;
      _this.frameNum = points[0].s.length - 1;
      resolve(points);
    });
  });
};

// 根据每帧数据点直接绘制点云
LandslideSimulation.prototype.addPrimitives = async function () {
  const data = await this.getData();
  // 获得每一帧数据
  for (let i = 0; i < data.length; i++) {
    this.frameData.push(data[i]);
    const framedata = data[i];
    const points = new Cesium.PointPrimitiveCollection();
    // 读取每一帧的点坐标
    for (let j = 0; j < framedata.length; j++) {
      const color = this.getColor(framedata[j].s, this.maxS);
      points.add({
        position: new Cesium.Cartesian3.fromDegrees(framedata[j].x, framedata[j].y, framedata[j].z + 10),
        pixelSize: 5,
        distanceDisplayCondition: {
          far: 50000,
          near: 100,
        },
        color,
        show: false,
      });
    }
    // 每一帧点云数据存入
    this.primitives.push(points);
    this.viewer.scene.primitives.add(points); // 全部添加进scene.primitives但不显示
  }
};

// 依次显示primitive
LandslideSimulation.prototype.showPrimitive = function () {
  const _this = this;
  this.intervalID = setInterval(() => {
    // 先看是否暂停
    if (!_this.pause) {
      // 先判断上一帧是否需要隐藏
      const preindex = (_this.index - 1 + _this.frameNum) % _this.frameNum;
      const prepointCollection = _this.primitives[preindex];
      if (prepointCollection.get(0).show) {
        for (let i = 0; i < prepointCollection.length; i++) {
          const p = prepointCollection.get(i);
          p.show = !p.show;
        }
      }

      const pointCollection = _this.primitives[_this.index];
      for (let i = 0; i < pointCollection.length; i++) {
        const p = pointCollection.get(i);
        p.show = !p.show;
      }

      _this.index = (_this.index + 1) % _this.frameNum;
    }
  }, _this.speed);
};

// -----------------------------------------------------方法二--------------------------------------
// 新的数据格式组织 s存储每一帧的点的状态 -1 为不显示
LandslideSimulation.prototype.addPrimitivesByS = async function () {
  const points = await this.getDataNew();
  // 获得所有点数据
  const pointsCollection = new Cesium.PointPrimitiveCollection();
  for (let i = 0; i < points.length; i++) {
    this.frameData.push(points[i]);
    const point = points[i];
    const color = this.getColor(point.s[0], this.maxS);
    pointsCollection.add({
      position: new Cesium.Cartesian3.fromDegrees(point.x, point.y, point.z),
      pixelSize: 5,
      distanceDisplayCondition: {
        far: 50000,
        near: 100,
      },
      color,
      show: false,
    });
  }
  this.primitives.push(pointsCollection);
  this.viewer.scene.primitives.add(pointsCollection); // 全部添加进scene.primitives但不显示

  // 数据加载完毕，添加进度条功能
  this.addBar();
  // this.processBar.createControlEvent(this.pause)
};
// 进度条功能加载
LandslideSimulation.prototype.addBar = function () {
  this.processBar = new SimulationProcess();
  this.processBar.setFrames(this.frameNum);
  this.processBar.createPlayEvent();
  this.processBar.createAdvanceEvent();
  this.processBar.createRetreatEvent();
  this.listenPlay();
};
// 监听是否播放
LandslideSimulation.prototype.listenPlay = function () {
  this.listener = setInterval(() => {
    if (this.processBar.pause) {
      this.showFrameByS(this.processBar.currentFrame);
    }
    if (this.processBar.pause === false) {
      if (this.intervalID === undefined) {
        this.showPrimitiveByS();
      }
    }
  }, 200);
};

// 依次更新每个点的显示状态以及颜色
LandslideSimulation.prototype.showPrimitiveByS = function () {
  const _this = this;
  this.intervalID = setInterval(() => {
    // 先看是否暂停
    if (!this.processBar.pause) {
      // // 进度条的参数
      // _this.processBar.updateCurrent(_this.index)
      // 得到所有点集合
      const pointCollection = _this.primitives[0];
      // 更新所有点显示以及颜色状态
      for (let i = 0; i < pointCollection.length; i++) {
        const p = pointCollection.get(i);
        // p.show = !p.show;
        // p.color = _this.getColor(_this.frameData[i].s[_this.index], _this.maxS);
        // s为-1则不显示改点
        if (_this.frameData[i].s[_this.processBar.currentFrame] == -1) {
          p.show = false;
        } else {
          p.show = true;
          p.color = _this.getColor(_this.frameData[i].s[_this.processBar.currentFrame], _this.maxS);
        }
      }
      if (_this.processBar.currentFrame > _this.frameNum) {
        if (!_this.loop) {
          // this.processBar.pause = true
          // _this.pause = this.processBar.pause
          _this.finish = true;
          // 触发一次播放按钮的点击事件
          const clickE = document.createEvent('MouseEvents');
          clickE.initEvent('click', true, true);
          this.processBar.playEle.dispatchEvent(clickE);
        }
      }
      _this.processBar.updateCurrent((_this.processBar.currentFrame + 1) % _this.frameNum);
    }
  }, this.speed);
};

// 展示指定帧数据
LandslideSimulation.prototype.showFrameByS = async function (frame) {
  const _this = this;
  _this.processBar.currentFrame = frame;
  // 更新所有点显示以及颜色状态
  const pointCollection = _this.primitives[0];
  for (let i = 0; i < pointCollection.length; i++) {
    const p = pointCollection.get(i);
    // p.show = !p.show;
    // s为-1则不显示改点
    if (_this.frameData[i].s[_this.processBar.currentFrame] == -1) {
      p.show = false;
    } else {
      p.show = true;
      p.color = _this.getColor(_this.frameData[i].s[_this.processBar.currentFrame], _this.maxS);
    }
  }
};
//-------------------------------------------------------------------------------------
// 暂停模拟
LandslideSimulation.prototype.pauseSimulation = function () {
  this.pause = true;
};

// 继续模拟
LandslideSimulation.prototype.goonSimulation = function () {
  this.pause = false;
};

// 清除所有模拟数据
LandslideSimulation.prototype.clearAll = function () {
  clearInterval(this.intervalID);
  clearInterval(this.listener);
  for (let i = 0; i < this.primitives.length; i++) {
    this.viewer.scene.primitives.remove(this.primitives[i]);
  }
  // 删除进度条
  this.processBar.father.removeChild(this.processBar.backElm);
};

// 展示指定帧数模拟数据
LandslideSimulation.prototype.showFrame = function (frame) {
  const preindex = (this.index - 1 + this.frameNum) % this.frameNum;
  const prepointCollection = this.primitives[preindex];
  if (prepointCollection.get(0).show) {
    for (let i = 0; i < prepointCollection.length; i++) {
      const p = prepointCollection.get(i);
      p.show = !p.show;
    }
  }

  const pointCollection = this.primitives[frame];
  for (let i = 0; i < pointCollection.length; i++) {
    const p = pointCollection.get(i);
    p.show = !p.show;
  }

  this.index = (frame + 1) % this.frameNum; // 在指定显示帧后 讲道理下一帧应该是frame后一帧
};

// 根据流体速度s设置顶点颜色
LandslideSimulation.prototype.getColor = function (value, maxS) {
  if (value === -1) {
    return Cesium.Color.fromRandom({
      red: 0.0,
      green: 0.0,
      blue: 0.0,
      alpha: 0.0,
    });
  }
  const frag = value / maxS;
  // 若色带没颜色 则生成
  if (this.colorArray.length == 0) {
    for (let r = 0; r < 256; r++) {
      this.colorArray.push(
        Cesium.Color.fromRandom({
          red: 0,
          green: r / 255.0,
          blue: 1.0,
          alpha: 1.0,
        })
      );
    }
    for (let b = 0; b < 256; b++) {
      this.colorArray.push(
        Cesium.Color.fromRandom({
          red: 0,
          green: 1.0,
          blue: 1.0 - b / 255.0,
          alpha: 1.0,
        })
      );
    }
    for (let r = 0; r < 256; r++) {
      this.colorArray.push(
        Cesium.Color.fromRandom({
          red: r / 255.0,
          green: 1.0,
          blue: 0,
          alpha: 1.0,
        })
      );
    }
    for (let g = 0; g < 256; g++) {
      this.colorArray.push(
        Cesium.Color.fromRandom({
          red: 1.0,
          green: 1.0 - g / 255.0,
          blue: 0,
          alpha: 1.0,
        })
      );
    }
  }
  const section = 1 / parseFloat(this.colorArray.length - 1); // 每段长度
  const index = parseInt(frag / section);
  return this.colorArray[index];
};

export default LandslideSimulation;
