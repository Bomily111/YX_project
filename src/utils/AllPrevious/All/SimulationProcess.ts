/*
 * @Author: anganao
 * @Date: 2023-09-22 16:31:03
 * @LastEditors: xingxu-webgis 1833104160@qq.com
 * @LastEditTime: 2024-03-01 20:56:34
 * @FilePath: \Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Utils\AllPrevious\All\SimulationProcess.ts
 * @Description: 模拟动画的进度条面板
 * Copyright (c) 2023 by VGE, All Rights Reserved.
 */
import './spStyle.scss';
export default class SimulationProcess {
  father: HTMLDivElement;
  backElm: HTMLDivElement;
  controlElm: HTMLDivElement;
  progressElm: HTMLDivElement;
  timeEle: HTMLDivElement;
  indicesEle: HTMLDivElement;
  advanceEle: HTMLDivElement;
  retreatEle: HTMLDivElement;
  playEle: HTMLDivElement;
  //参数
  indicesPos = 0;
  frames = 2;
  currentFrame = 0;
  pause = true;
  detail = false; // 展示指定数据
  constructor(id = 'app') {
    this.father = <HTMLDivElement>document.getElementById(id);
    // 添加元素
    this.createElements();
    // 添加事件
    this.createProgressEvent();
    this.createIndicesEvent();
  }
  createElements() {
    this.backElm = this.createEleJob(this.father, 'background');

    this.controlElm = this.createEleJob(this.backElm, 'control');
    this.retreatEle = this.createEleJob(this.controlElm, 'retreat');
    this.playEle = this.createEleJob(this.controlElm, 'play');
    this.advanceEle = this.createEleJob(this.controlElm, 'advance');

    this.progressElm = this.createEleJob(this.backElm, 'progress');
    this.indicesEle = this.createEleJob(this.progressElm, 'indices');

    this.timeEle = this.createEleJob(this.backElm, 'time');
  }
  /**
   * 进度条点击事件, 获取点击的帧率和进度点位置
   *
   * @memberof SimulationProcess
   */
  createProgressEvent() {
    //返回indices的pos
    this.progressElm.onclick = (e) => {
      const eleW = this.progressElm.offsetWidth;
      const clickW = e.offsetX;
      let ratio = clickW / eleW;
      if (ratio < 0) {
        ratio = 0.0;
      }
      if (ratio > eleW) {
        ratio = eleW;
      }
      this.currentFrame = Math.round(ratio * this.frames);
      // this.indicesPos = eleW / this.frames * this.currentFrame
      //this.detail = true
      // 调用相关函数
      this.pause = true;
      this.playEle.style.backgroundImage = 'var(--start)';
      this.changeIndicesPos();
      this.upDateTime();
    };
  }
  /**
   * 前进功能
   *
   * @memberof SimulationProcess
   */
  createAdvanceEvent() {
    this.advanceEle.onclick = (e) => {
      this.currentFrame = (this.currentFrame + 1) % (this.frames + 1);
      //this.detail = true
      this.pause = true;
      // 调用相关函数
      this.changeIndicesPos();
      this.upDateTime();
    };
  }
  /**
   * 后退功能
   *
   * @memberof SimulationProcess
   */
  createRetreatEvent() {
    this.retreatEle.onclick = (e) => {
      if (this.currentFrame === 0) {
        return;
      }
      this.currentFrame = this.currentFrame - 1;
      // this.detail = true
      this.pause = true;
      // 调用相关函数
      this.changeIndicesPos();
      this.upDateTime();
    };
  }
  createIndicesEvent() {
    this.indicesEle.onclick = (e) => {
      e.stopPropagation();
    };
  }
  /**
   * 创建播放和暂停功能
   *
   * @memberof SimulationProcess
   */
  createPlayEvent() {
    this.playEle.onclick = (e) => {
      this.pause = !this.pause;
      if (this.pause) {
        this.playEle.style.backgroundImage = 'var(--start)';
      } else {
        this.playEle.style.backgroundImage = 'var(--stop)';
      }
    };
  }
  /**
   * 改变indices的显示位置
   *
   * @memberof SimulationProcess
   */
  changeIndicesPos() {
    const eleW = this.progressElm.offsetWidth;
    this.indicesPos = (eleW / this.frames) * this.currentFrame;
    this.indicesEle.style.left = this.indicesPos + 'px';
  }
  private createEleJob(parent, name) {
    const ele = document.createElement('div');
    ele.classList.add(name);
    parent.appendChild(ele);
    return ele;
  }
  // 模拟进度控制模块
  /**
   * 设置总帧数，表示数据加载完毕，准备开始模拟
   *
   * @param {number} num
   * @memberof SimulationProcess
   */
  setFrames(num: number) {
    this.frames = num;
    this.upDateTime();
  }
  updateCurrent(num: number) {
    this.currentFrame = num;
    this.upDateTime();
    this.changeIndicesPos();
  }
  /**
   * 设置时间元素的显示内容
   *
   * @memberof SimulationProcess
   */
  upDateTime() {
    this.timeEle.innerHTML = this.currentFrame + ' / ' + this.frames;
  }
}
