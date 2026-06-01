/*
 * @Author: anganao
 * @Date: 2023-09-19 14:32:03
 * @LastEditors: xingxu-webgis 1833104160@qq.com
 * @LastEditTime: 2024-03-12 16:50:51
 * @FilePath: \Geology-v3\src\views\SceneManagement\ConstructionSurfaceGeoModel\Utils\AllPrevious\index.js
 * @Description: 这里面包含所有以前得功能，以方便平台移植,依赖库文件{ gl-matrix, dat.gui, jquery }
 * Copyright (c) 2023 by VGE, All Rights Reserved.
 */
import * as Cesium from 'Cesium';
import TScaler from './All/TunnelScaler';
import { Positions, Rulers1000m, Rulers100m, Rulers10m } from './All/TunnelInfo';
import { hideLegend } from './All/legendManager.js';
import {
  lookAtFixed,
  controlTFSModel,
  controlTSPModel,
  controlTEMModel,
  controlWATERModel,
  controlPOSUIModel,
  controlGPRModel,
  controlAHDModel,
  controlDBHModel,
  controlTEGModel,
  loadAHDModelSummary,
  loadDBHModelSummary,
  loadGPRModelSummary,
  loadTSPModelSummary,
  loadTFSModelSummary,
  destroySummaryBox,
} from './All/DataController';
// import LandslideSimulation from './All/LandslideSimulation';
// import StoneSimulation from './All/StoneSimulation';
import { initVolume } from './All/ShareVolume01';

export default class Previous {
  constructor(viewer) {
    this.primitives = {}; // 存放加载的内容，以方便以后删除

    // 地灾模拟状态
    this.landslide = undefined;
    this.stone = undefined;

    Previous.SVData = []; // 代替之前的globe全局变量
    Previous.SVData[0] = viewer;
    this.drawVolume();
  }

  /**
   * 关闭康定2号隧道施工面尺度所有模型效果
   *
   * @memberof Previous
   */
  clearPrimitiveModel() {
    // this.deleteTFS();
    // this.deleteTSP();
    // this.deleteTEM();
    // this.deleteAHD();
    // this.deleteDBH();
    // this.deleteGPR();
    Object.keys(this.primitives).forEach((key) => {
      if (key === 'tscaler' || key === 'TEG') {
        return;
      }
      this.deletePrimitive(key);
    });
    Previous.SVData.showVolume = false;
    //删除地质情况专家判识表格
    hideLegend();
    //删除分析结论表格
    destroySummaryBox();
  }

  /**
   * 康定二号地质场景，刻度尺的加载, 标记为tscaler
   *
   * @memberof Previous
   */
  loadTScaler() {
    const params1000 = {
      positions: Rulers1000m,
      baseName: 'DK',
      start: 280000,
    };
    const params100 = {
      positions: Rulers100m,
      baseName: 'DK',
      start: 279700,
    };
    const params10 = {
      positions: Rulers10m,
      baseName: 'DK',
      start: 279700,
    };
    this.primitives.tscaler = new TScaler(Previous.SVData[0], Positions, params1000, params100, params10);
  }

  deleteTScaler() {
    this.deletePrimitive('tscaler');
  }

  /**
   * 康定二号场景，加载其他地质模型
   *
   * @param {*} url
   * @memberof Previous
   */
  loadForcastModel(url) {
    hideLegend();
    destroySummaryBox();
    Previous.SVData.showVolume = true;
    initVolume(url);
    lookAtFixed(Previous.SVData.showVolume);
  }

  /**
   * 康定二号地质场景，掌子面的加载, 标记为TFS
   *
   * @memberof Previous
   */
  loadTFS() {
    console.log('TFS模型load了');
    this.primitives.TFS = controlTFSModel(Previous.SVData[0]);
    loadTFSModelSummary();
  }

  deleteTFS() {
    this.deletePrimitive('TFS');
  }

  /**
   * 康定二号地质场景，长距离预测的加载, 标记为TSP
   *
   * @memberof Previous
   */
  // loadTSP() {
  //   // console.log('TSP模型load了');
  //   controlTSPModel('rt', true, Previous.SVData[0]);
  //   loadTSPModelSummary();
  // }

  // deleteTSP() {
  //   controlTSPModel('rt', false, Previous.SVData[0]);
  // }

  /**
   * 康定二号地质场景，中距离预测的加载, 标记为TEM
   *
   * @memberof Previous
   */
  loadTEM() {
    // console.log('TEM模型load了');
    controlTEMModel('temrt', true);
  }

  deleteTEM() {
    controlTEMModel('temrt', false);
  }

  /**
   * 康定二号地质场景，富水带模型加载
   *
   * @memberof Previous
   */
  loadWATER() {
    controlWATERModel('water', true);
  }

  deleteWATER() {
    controlWATERModel('water', false);
  }

  /**
   * 康定二号地质场景，破碎带模型加载
   *
   * @memberof Previous
   */
  loadPOSUI() {
    controlPOSUIModel('posui', true);
  }

  deletePOSUI() {
    controlPOSUIModel('posui', false);
  }

  /**
   * @description: 康定二号地质场景，地质体剖切加载，标记为TEG
   * @memberof Previous
   */
  loadTEG() {
    // console.log('TEG模型load了');
    this.primitives.TEG = controlTEGModel(Previous.SVData[0]);
  }

  deleteTEG() {
    this.deletePrimitive('TEG');
  }

  // /**
  //  * 康定二号地质场景，地质雷达的加载, 标记为GPR
  //  *
  //  * @memberof Previous
  //  */
  // loadGPR() {
  //   // console.log('GPR模型load了');
  //   this.primitives.GPR = controlGPRModel('rgb');
  //   loadGPRModelSummary();
  // }

  // deleteGPR() {
  //   this.deletePrimitive('GPR');
  // }

  // /**
  //  * 康定二号地质场景，超前水平钻的加载, 标记为AHD
  //  *
  //  * @memberof Previous
  //  */
  // loadAHD() {
  //   // console.log('AHD模型load了');
  //   this.primitives.AHD = controlAHDModel();
  //   loadAHDModelSummary();
  // }

  // deleteAHD() {
  //   this.deletePrimitive('AHD');
  // }

  // /**
  //  * 康定二号地质场景，加深炮孔的加载, 标记为DBH
  //  *
  //  * @memberof Previous
  //  */
  // loadDBH() {
  //   // console.log('DBH模型load了');
  //   this.primitives.DBH = controlDBHModel();
  //   loadDBHModelSummary();
  // }

  // deleteDBH() {
  //   this.deletePrimitive('DBH');
  // }

  /**
   * @description: 控制地球的隐藏
   * @return {void}
   */
  deleteEarth() {
    const sceneController = Previous.SVData[0].scene;
    sceneController.sun.show = false;
    sceneController.globe.show = false;
    sceneController.moon.show = false;
    sceneController.skyBox.show = false;
    // scene.fog.enabled = false;

    Previous.SVData[0].scene.light = new Cesium.DirectionalLight({
      direction: new Cesium.Cartesian3(0.354925, -0.890918, -0.283358),
    });
    Previous.SVData[0].enviromentBrightness = 0.95;
  }

  /**
   * @description: 恢复地球的正常显示
   * @return {void}
   */
  loadEarth() {
    // restore the globe
    const sceneController = Previous.SVData[0].scene;
    sceneController.sun.show = true;
    sceneController.globe.show = true;
    sceneController.moon.show = true;
    sceneController.skyBox.show = true;
  }

  /**
   * 删除对应的primitive
   *
   * @param {*} name 该模型存储在primitives中的标记
   * @memberof Previous
   */
  deletePrimitive(name) {
    if (this.primitives[name] !== undefined) {
      this.primitives[name].destroy();
      this.primitives[name] = undefined;
      lookAtFixed(false);
    }
  }

  /**
   * 滑坡模拟
   *
   * @param {*} url
   * @memberof Previous
   */
  loadLandslideSimulation(url) {
    console.warn('LandslideSimulation not available in this build');
  }

  deleteLandslideSimulation() {
    this.landslide = undefined;
  }

  loadStoneSimulation(url) {
    console.warn('StoneSimulation not available in this build');
  }

  deleteStoneSimulation() {
    this.stone = undefined;
  }

  drawVolume() {
    const loopRender = () => {
      requestAnimationFrame(loopRender);
      if (Previous.SVData[1]) {
        Previous.SVData[1].draw();
      }
    };
    loopRender();
  }
}
