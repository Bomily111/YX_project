/**
 * @ Author: WouRaoyu
 * @ Create Time: 2023-02-24 18:42:19
 * @ Modified by: WouRaoyu
 * @ Modified time: 2023-02-25 08:39:22
 * @ Description: 绘制刻度值和隧道中线
 */

import * as Cesium from 'Cesium';
// import store from '@/store';

/**
 * @description: 每一个刻段的文本
 * @param {*} params
 * @return {*}
 */
function LabelText(params) {
  let mileage = params.start + params.length;
  let mileagek = Math.floor(mileage / 1000);
  let mileagem = mileage - mileagek * 1000;
  return params.baseName + mileagek + '+' + String(mileagem).padStart(3, '0');
}

/**
 * @description: 绘制刻度尺
 * @param {*} viewer Cesium viewer
 * @param {*} positions 位置
 * @param {*} param1000
 * @param {*} param100
 * @param {*} param10
 * @return {void}
 */
function TScaler(viewer, positions, param1000, param100, param10) {
  this.viewer = viewer;
  this.current = undefined;
  this.blink = undefined;
  // eslint-disable-next-line no-unused-expressions
  this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
  this.centerLine = viewer.entities.add({
    name: 'Orange tunnel center line',
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
      width: 5,
      material: new Cesium.PolylineOutlineMaterialProperty({
        color: Cesium.Color.ORANGE,
        outlineWidth: 2,
        outlineColor: Cesium.Color.BLACK,
      }),
    },
  });

  this.rules = [1000, 100, 10];
  this.params = [param1000, param100, param10];
  // collections of drawn line and text primitives
  this.blines = viewer.scene.primitives.add(new Cesium.PolylineCollection());
  this.btexts = viewer.scene.primitives.add(new Cesium.LabelCollection());
  // collections of scales and labels primitives
  this.rulers = viewer.scene.primitives.add(new Cesium.PolylineCollection());
  this.labels = viewer.scene.primitives.add(new Cesium.LabelCollection());

  let pos1000mArray = Cesium.Cartesian3.fromDegreesArrayHeights(param1000.positions);
  for (let index = 0; index < pos1000mArray.length / 2; index++) {
    this.rulers.add({
      positions: pos1000mArray.slice(index * 2, (index + 1) * 2),
      width: 2,
    });
    this.labels.add({
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 5000.0),
      position: pos1000mArray[index * 2 + 1],
      text: LabelText({
        baseName: param1000.baseName,
        start: param1000.start,
        length: index * 1000,
      }),
    });
  }

  let pos100mArray = Cesium.Cartesian3.fromDegreesArrayHeights(param100.positions);
  for (let index = 0; index < pos100mArray.length / 2; index++) {
    if (index % 10 != 3) {
      this.rulers.add({
        positions: pos100mArray.slice(index * 2, (index + 1) * 2),
        width: 2,
      });
      if (index < 20) {
        this.labels.add({
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 500.0),
          position: pos100mArray[index * 2 + 1],
          scale: 0.75,
          text: LabelText({
            baseName: param100.baseName,
            start: param100.start,
            length: index * 100,
          }),
        });
      }
    }
  }

  let pos10mArray = Cesium.Cartesian3.fromDegreesArrayHeights(param10.positions);
  for (let index = 0; index < pos10mArray.length / 2; index++) {
    if (index % 10 != 0) {
      this.rulers.add({
        positions: pos10mArray.slice(index * 2, (index + 1) * 2),
        width: 2,
        zIndex: 99,
      });
      this.labels.add({
        // eyeOffset: new Cesium.Cartesian3(0.0, 0.0, -25),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 250.0),
        position: pos10mArray[index * 2 + 1],
        scale: 0.5,
        text: LabelText({
          baseName: param10.baseName,
          start: param10.start,
          length: index * 10,
        }),
      });
    }
  }
}

// TScaler.prototype.show = function () {};

// TScaler.prototype.hide = function () {};

TScaler.prototype.destroy = function () {
  this.rulers.removeAll();
  this.labels.removeAll();
  this.blines.removeAll();
  this.btexts.removeAll();
  this.rulers.destroy();
  this.labels.destroy();
  this.blines.destroy();
  this.btexts.destroy();
  // remove the center line
  this.viewer.entities.remove(this.centerLine);
  // remove the billboards
  if (this.billboards !== undefined) {
    this.billboards.show = false;
  }
};

/**
 * @description: Only support zoffset now
 * @param {*} mileage
 * @param {*} zoffset
 * @param {*} precision
 * @return {Cartesian3}
 */
TScaler.prototype.mileageToPosition = function (mileage, zoffset, precision) {
  let posAndDir = this.mileageToPositionWithDirection(mileage, zoffset, precision);
  if (posAndDir.length == 0) {
    return undefined;
  }
  return posAndDir[0];
};

/**
 * @description: 里程到屏幕坐标
 * @param {*} mileage
 * @param {*} zoffset
 * @param {*} precision
 * @return {Cartesian3}
 */
TScaler.prototype.mileageToPositionWithDirection = function (mileage, zoffset, precision = 10) {
  let results = new Array();
  for (let index = 0; index < 3; index++) {
    if (precision * 2 >= this.rules[index]) {
      let toStart = mileage - this.params[index].start;
      if (toStart < 0) {
        return;
      }
      let indexInArray = Math.floor(toStart / this.rules[index]) * 6;
      let ratioLerp = (toStart - (indexInArray / 6) * this.rules[index]) / this.rules[index];
      let arrayTemp = this.params[index].positions.slice(indexInArray, indexInArray + 9);
      let posBound = Cesium.Cartesian3.fromDegreesArrayHeights(arrayTemp);
      let posOnLine = Cesium.Cartesian3.lerp(posBound[0], posBound[2], ratioLerp, new Cesium.Cartesian3());
      let direction = Cesium.Cartesian3.subtract(posBound[0], posBound[2], new Cesium.Cartesian3());
      let posCartog = Cesium.Cartographic.fromCartesian(posOnLine);
      posCartog.height = posCartog.height + zoffset;
      Cesium.Cartesian3.normalize(direction, direction);
      results = [Cesium.Cartographic.toCartesian(posCartog), direction];
      return results;
    }
  }
};
// /**
//      * @description: 控制 面板 + 线段 + 文本的显示与隐藏
//      * @return {void}
//      */
// TScaler.prototype.activatePicker = function() {
//   this.handler.setInputAction((click) => {
//     var pickedFeature = this.viewer.scene.pick(click.position);
//     if (!Cesium.defined(pickedFeature)) { return; }
//     if (pickedFeature.id === undefined) { return; }
//     var pickedPosition = this.viewer.scene.pickPosition(click.position);
//     // clearInterval(this.blink);
//     this.boxVisibility(this.current, false);
//     this.blineVisibility(this.current, false);
//     this.btextVisibility(this.current, false);
//     if (this.current !== pickedFeature.id) {
//       store.commit("dtglobe_store/setGPModelPicked", pickedFeature.id);
//       store.commit("dtglobe_store/setPickedPos", pickedPosition);
//       // this.blink = setInterval(() => {
//       //     this.boxVisibility(pickedFeature.id);
//       // }, 500);
//       this.blineVisibility(pickedFeature.id, true);
//       this.btextVisibility(pickedFeature.id, true);
//       this.current = pickedFeature.id;
//     } else {
//       this.current = undefined;
//       store.commit("dtglobe_store/setGPModelPicked", undefined);
//     }
//   }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
// }

// /**
//  * @description: 关闭显示
//  * @return {void}
//  */
// TScaler.prototype.deactivatePicker = function() {
//   this.handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
//   clearInterval(this.blink);
//   store.commit("dtglobe_store/setGPModelPicked", undefined);
//   this.boxVisibility(this.current, false);
//   this.blineVisibility(this.current, false);
//   this.btextVisibility(this.current, false);
//   this.current = undefined;
// }

/**
 * @description: 控制单个label的显示与隐藏
 * @param {*} id label的id
 * @return {void}
 */
TScaler.prototype.labelVisibility = function (id) {
  const len = this.billboards.length;
  for (let i = 0; i < len; ++i) {
    const billboard = this.billboards.get(i);
    if (billboard.id === id) {
      billboard.show = !billboard.show;
    }
    return;
  }
};

/**
 * @description: 控制单个label的显示与隐藏
 * @param {*} id label的id
 * @param {*} status 设置的状态
 * @return {void}
 */
TScaler.prototype.blineVisibility = function (id, status) {
  const len = this.blines.length;
  for (let i = 0; i < len; ++i) {
    const bline = this.blines.get(i);
    if (bline.id === id) {
      if (status !== undefined) {
        bline.show = status;
      } else {
        bline.show = !bline.show;
      }
    }
  }
};

/**
 * @description: 控制单个label的显示与隐藏
 * @param {*} id label的文本id
 * @param {*} status 设置的状态
 * @return {void}
 */
TScaler.prototype.btextVisibility = function (id, status) {
  const len = this.btexts.length;
  for (let i = 0; i < len; ++i) {
    const btext = this.btexts.get(i);
    if (btext.id === id) {
      if (status !== undefined) {
        btext.show = status;
      } else {
        btext.show = !btext.show;
      }
    }
  }
};
/**
 * @description: 控制box面板的显示与隐藏
 * @param {*} id
 * @param {*} status
 * @return {void}
 */
TScaler.prototype.boxVisibility = function (id, status) {
  const entity = this.viewer.entities.getById(id);
  if (entity === undefined) {
    return;
  }
  if (entity.id !== id) {
    return;
  }
  if (status !== undefined) {
    entity.show = status;
  } else {
    entity.show = !entity.show;
  }
};

/**
 * @description: 通过里程数添加label
 * @param {*} mileage 里程
 * @param {*} zoffset 偏移
 * @param {*} name
 * @param {*} precision
 * @return {*}
 */
TScaler.prototype.addLabelByMileage = function (mileage, zoffset, name, precision) {
  let position = this.mileageToPosition(mileage, zoffset, precision);
  if (position === undefined) {
    return false;
  }
  if (this.billboards === undefined) {
    this.billboards = this.viewer.scene.primitives.add(new Cesium.BillboardCollection());
  }
  return this.billboards.add({
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 500.0),
    image: 'icon/info.png',
    position: position,
    width: 50, // default: undefined
    height: 50, // default: undefined
    id: name,
  });
};

TScaler.prototype.mileageBBox = function (mileage, bbox, name, color, precision) {
  let posAndDir = this.mileageToPositionWithDirection(mileage + bbox.x / 2, 0.0, precision);
  let position = posAndDir[0];
  let direction = posAndDir[1];

  let matrix = Cesium.Transforms.rotationMatrixFromPositionVelocity(position, direction);
  let quat = Cesium.Quaternion.fromRotationMatrix(matrix);

  if (color === undefined) {
    color = Cesium.Color.GREEN;
  }

  return this.viewer.entities.add({
    position: position,
    orientation: quat,
    box: {
      dimensions: bbox,
      material: color,
    },
    id: name,
    show: false,
  });
};

TScaler.prototype.mileageLBnd = function (mileage, bbox, name, color, precision) {
  if (color === undefined) {
    color = Cesium.Color.GREEN;
  }

  const material = Cesium.Material.fromType('Color', {
    color: color,
  });

  let positionStartBtm = this.mileageToPosition(mileage, 0.0, precision);
  let posCartog = Cesium.Cartographic.fromCartesian(positionStartBtm);
  posCartog.height = posCartog.height + bbox.z;
  let positionStartTop = Cesium.Cartographic.toCartesian(posCartog);
  this.blines.add({
    positions: [positionStartBtm, positionStartTop],
    material: material,
    width: 5,
    id: name,
    show: false,
  });
  this.btexts.add({
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 500.0),
    position: positionStartTop,
    scale: 0.5,
    id: name,
    fillColor: color,
    text: LabelText({
      baseName: 'DK',
      start: 0.0,
      length: mileage,
    }),
    show: false,
  });

  positionStartBtm = this.mileageToPosition(mileage + bbox.x, 0.0, precision);
  posCartog = Cesium.Cartographic.fromCartesian(positionStartBtm);
  posCartog.height = posCartog.height + bbox.z;
  positionStartTop = Cesium.Cartographic.toCartesian(posCartog);
  this.blines.add({
    positions: [positionStartBtm, positionStartTop],
    material: material,
    width: 5,
    id: name,
    show: false,
  });
  this.btexts.add({
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 500.0),
    position: positionStartTop,
    scale: 0.5,
    id: name,
    fillColor: color,
    text: LabelText({
      baseName: 'DK',
      start: 0.0,
      length: mileage + bbox.x,
    }),
    show: false,
  });
};

export default TScaler;
