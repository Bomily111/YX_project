import * as Cesium from 'Cesium';
// import Vue from "vue";
import { initVolume } from './ShareVolume01.js';
import { showLegend } from './legendManager.js';
import Previous from '../index.js';

function lookAtFixed(status) {
  Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  if (status) {
    Previous.SVData[0].scene.camera.flyTo({
      easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
      destination: {
        x: -1138123.2102885062,
        y: 5413122.241687714,
        z: 3171382.583795801,
      },
      orientation: {
        heading: 5.497791654142265,
        pitch: -0.6154907919216184,
        roll: 0.0,
      },
      duration: 1,
      complete: () => {
        Previous.SVData[0].camera.lookAt(new Cesium.Cartesian3.fromDegrees(101.873124, 29.9938189, 3241.74), new Cesium.Cartesian3(50, -50, 50));
      },
    });
  } else {
    Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
}

/**
 * @description: tunnel engineering geological cliping model
 * @param {*} viewer
 * @return {*}
 */
function controlTEGModel(viewer) {
  const LocalFrameToFixedFrame = Cesium.Transforms.localFrameToFixedFrameGenerator('up', 'east');
  const modelMatrixA = LocalFrameToFixedFrame(Cesium.Cartesian3.fromDegrees(101.78831283519401, 30.041374197296615, 3632.5594175092197));
  const teg = viewer.scene.primitives.add(
    Cesium.Model.fromGltf({
      modelMatrix: modelMatrixA,
      // url: 'http://192.168.50.6:9999/CZSCZQ-2/GeologyProject/DemoTextureDiff.glb'
      url: 'scene/data/DemoTextureDiff.glb',
    })
  );
  teg.show = true;
  return teg;
}

async function controlTSPModel(itemIdx, isshow, viewer) {
  // 初始化shareVolume中的全局变量SVData的值
  viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  if (!isshow) {
    Previous.SVData.showVolume = false;
  } else {
    Previous.SVData.showVolume = true;
    if (itemIdx === 'vp') {
      initVolume('data/VP/Vp.raw.json');
    } else if (itemIdx === 'vs') {
      initVolume('data/VS/Vs.raw.json');
    } else if (itemIdx === 'e') {
      initVolume('data/E/E.raw.json');
    } else if (itemIdx === 'pr') {
      initVolume('data/TSP/Pr.raw.json');
    } else if (itemIdx === 'rt') {
      initVolume('data/TSP/Rt.raw.json');
    }
  }
  if (Previous.SVData.showVolume) {
    viewer.scene.camera.flyTo({
      easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
      destination: {
        x: -1138261.8069596183,
        y: 5413218.443779531,
        z: 3171329.2261780854,
      },
      orientation: {
        heading: 5.588458302117164,
        pitch: -0.5694746160768638,
        roll: 0.0,
      },
      duration: 1,
      complete: () => {
        viewer.camera.lookAt(new Cesium.Cartesian3.fromDegrees(101.873547, 29.993751, 3246.3), new Cesium.Cartesian3(125, -150, 125));
      },
    });
  } else {
    viewer.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }

  // if (dtmmap["tsplb"] === undefined) {
  //   const lbs = new Array();
  //   lbs.push(dtmmap["tscaler"].addLabelByMileage(280362, 55, "tsplb_1"));

  //   // dtmmap["tscaler"].mileageBBox(280342, new Cesium.Cartesian3(40, 75, 75), "tsplb_1");
  //   dtmmap["tscaler"].mileageLBnd(280342, new Cesium.Cartesian3(40, 75, 75), "tsplb_1");

  //   lbs.push(dtmmap["tscaler"].addLabelByMileage(280432, 55, "tsplb_2"));

  //   // dtmmap["tscaler"].mileageBBox(280382, new Cesium.Cartesian3(100, 75, 75), "tsplb_2", Cesium.Color.YELLOW);
  //   dtmmap["tscaler"].mileageLBnd(280382, new Cesium.Cartesian3(100, 75, 75), "tsplb_2", Cesium.Color.YELLOW);

  //   lbs.push(dtmmap["tscaler"].addLabelByMileage(280512, 55, "tsplb_3"));

  //   // dtmmap["tscaler"].mileageBBox(280482, new Cesium.Cartesian3(60, 75, 75), "tsplb_3");
  //   dtmmap["tscaler"].mileageLBnd(280482, new Cesium.Cartesian3(60, 75, 75), "tsplb_3");

  //   dtmmap["tsplb"] = lbs;
  // } else {
  //   dtmmap["tsplb"].forEach(element => {
  //     element.show = !element.show;
  //   });
  // }
}

function controlTEMModel(itemIdx, isshow) {
  Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  if (!isshow) {
    Previous.SVData.showVolume = false;
  } else {
    Previous.SVData.showVolume = true;
    if (itemIdx === 'tem') {
      initVolume('data/TEM/TEM.raw.json');
    } else if (itemIdx === 'temrt') {
      initVolume('data/TEM/TEMRt.raw.json');
    }
  }

  if (Previous.SVData.showVolume) {
    Previous.SVData[0].camera.flyTo({
      easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
      destination: {
        x: -1138216.6617071424,
        y: 5413159.92750569,
        z: 3171343.5485766563,
      },
      orientation: {
        heading: 5.639690960179587,
        pitch: -0.5404391077808919,
        roll: 0.0,
      },
      duration: 1,
      complete: () => {
        Previous.SVData[0].camera.lookAt(new Cesium.Cartesian3.fromDegrees(101.873732, 29.993712, 3245.82), new Cesium.Cartesian3(75, -100, 75));
      },
    });
  } else {
    Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }

  // if (dtmmap["temlb"] === undefined) {
  //   const lbs = new Array();
  //   lbs.push(dtmmap["tscaler"].addLabelByMileage(280392, 35, "temlb_1"));

  //   // dtmmap["tscaler"].mileageBBox(280366, new Cesium.Cartesian3(55, 125, 25), "temlb_1", Cesium.Color.YELLOW);
  //   dtmmap["tscaler"].mileageLBnd(280366, new Cesium.Cartesian3(55, 125, 25), "temlb_1", Cesium.Color.YELLOW);

  //   dtmmap["temlb"] = lbs;
  // } else {
  //   dtmmap["temlb"].forEach(element => {
  //     element.show = !element.show;
  //   });
  // }
}

function controlWATERModel(itemIdx, isshow) {
  Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  if (!isshow) {
    Previous.SVData.showVolume = false;
  } else {
    Previous.SVData.showVolume = true;
    if (itemIdx === 'water') {
      initVolume('data/WATER/Water.json');
    }
  }
  if (Previous.SVData.showVolume) {
    Previous.SVData[0].camera.flyTo({
      easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
      destination: {
        x: -1138261.8069596183,
        y: 5413218.443779531,
        z: 3171329.2261780854,
      },
      orientation: {
        heading: 5.588458302117164,
        pitch: -0.5694746160768638,
        roll: 0.0,
      },
      duration: 1,
      complete: () => {
        Previous.SVData[0].camera.lookAt(new Cesium.Cartesian3.fromDegrees(101.873547, 29.993751, 3246.3), new Cesium.Cartesian3(125, -150, 125));
      },
    });
  } else {
    Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
}

function controlPOSUIModel(itemIdx, isshow) {
  Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  if (!isshow) {
    Previous.SVData.showVolume = false;
  } else {
    Previous.SVData.showVolume = true;
    if (itemIdx === 'posui') {
      initVolume('data/POSUI/posui.json');
    }
  }
  if (Previous.SVData.showVolume) {
    Previous.SVData[0].camera.flyTo({
      easingFunction: Cesium.EasingFunction.QUINTIC_OUT,
      destination: {
        x: -1138261.8069596183,
        y: 5413218.443779531,
        z: 3171329.2261780854,
      },
      orientation: {
        heading: 5.588458302117164,
        pitch: -0.5694746160768638,
        roll: 0.0,
      },
      duration: 1,
      complete: () => {
        Previous.SVData[0].camera.lookAt(new Cesium.Cartesian3.fromDegrees(101.873547, 29.993751, 3246.3), new Cesium.Cartesian3(125, -150, 125));
      },
    });
  } else {
    Previous.SVData[0].scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
}

function controlGPRModel(itemIdx) {
  /* eslint-disable-next-line */
  const LocalFrameToFixedFrame = Cesium.Transforms.localFrameToFixedFrameGenerator('up', 'east');
  const modelMatrix = LocalFrameToFixedFrame(Cesium.Cartesian3.fromDegrees(101.78831283519401, 30.04025419729661, 3632.5594175092197));
  const primitive = Previous.SVData[0].scene.primitives.add(
    Cesium.Model.fromGltf({
      modelMatrix,
      url: `scene/data/GPR/model_${itemIdx}.glb`,
    })
  );
  primitive.show = true;
  lookAtFixed(primitive.show);
  // createGPRLegend();
  showLegend('GPR');
  return primitive;
}

function controlAHDModel() {
  const LocalFrameToFixedFrame = Cesium.Transforms.localFrameToFixedFrameGenerator('up', 'east');
  const modelMatrix = LocalFrameToFixedFrame(Cesium.Cartesian3.fromDegrees(101.78831283519401, 30.04025419729661, 3632.5594175092197));
  const primitive = Previous.SVData[0].scene.primitives.add(
    Cesium.Model.fromGltf({
      modelMatrix,
      url: 'scene/data/AHD/model.glb',
    })
  );
  primitive.show = true;
  lookAtFixed(primitive.show);
  showLegend('AHD');
  return primitive;
  // if (dtmmap["ahdlb"] === undefined) {
  //   const lbs = new Array();
  //   lbs.push(dtmmap["tscaler"].addLabelByMileage(280413, 15, "ahdlb_1"));

  //   // dtmmap["tscaler"].mileageBBox(280366, new Cesium.Cartesian3(55, 125, 25), "temlb_1", Cesium.Color.YELLOW);
  //   dtmmap["tscaler"].mileageLBnd(280398, new Cesium.Cartesian3(30, 125, 15), "ahdlb_1", Cesium.Color.YELLOW);

  //   dtmmap["ahdlb"] = lbs;
  // } else {
  //   dtmmap["ahdlb"].forEach(element => {
  //     element.show = !element.show;
  //   });
  // }
}

function controlDBHModel() {
  const LocalFrameToFixedFrame = Cesium.Transforms.localFrameToFixedFrameGenerator('up', 'east');
  const modelMatrix = LocalFrameToFixedFrame(Cesium.Cartesian3.fromDegrees(101.78855283519401, 30.040214597296615, 3631.759417509219));
  const primitive = Previous.SVData[0].scene.primitives.add(
    Cesium.Model.fromGltf({
      modelMatrix,
      url: 'scene/data/DBH/model.glb',
    })
  );
  primitive.show = true;

  lookAtFixed(primitive.show);
  // createDBHLegend();
  showLegend('DBH');

  return primitive;
}

function controlTFSModel(viewer) {
  // const LocalFrameToFixedFrame = Cesium.Transforms.localFrameToFixedFrameGenerator('up', 'east');
  // const modelMatrix = LocalFrameToFixedFrame(Cesium.Cartesian3.fromDegrees(101.78855283519401, 30.040214597296615, 3631.759417509219));
  // const tfs = viewer.scene.primitives.add(
  //   Cesium.Model.fromGltf({
  //     modelMatrix,
  //     url: 'scene/data/TFS/model.glb',
  //   })
  // );
  // tfs.show = true;
  // lookAtFixed(tfs.show, viewer);
  // return tfs;
  lookAtFixed(true);
}
// 销毁旧的 summaryBox
function destroySummaryBox() {
  const existingBox = document.getElementById('summary-box');
  if (existingBox) {
    existingBox.remove();
  }
}

// 创建 summaryBox
function createSummaryBox(title, attributes, summary) {
  const summaryBox = document.createElement('div');
  summaryBox.id = 'summary-box';

  const attributesHTML = attributes
    .map(
      (attr) => `
        <div class="summary-attribute">
            <span class="attr-name">${attr.name}：</span>
            <span class="attr-value">${attr.value}</span>
        </div>
    `
    )
    .join('');

  summaryBox.innerHTML = `
		<div class="top">
			<h2 class="summary-title">${title}</h2>
			<div class="closeButton">关闭</div>
		</div>
    <div class="summary-attributes">${attributesHTML}</div>
    <div class="summary-content">
         <p class="summary-label">☆分析结论：</p>
		<p>${summary}</p>
    </div>
  `;

  // 设置 summaryBox 的整体样式
  Object.assign(summaryBox.style, {
    position: 'fixed',
    top: '60px',
    right: '10px',
    width: '320px',
    padding: '5px', // 去除 padding，改为内部元素单独设置
    backgroundColor: 'rgba(21, 146, 136, 0.29)',
    color: '#fff',
    // border: '2px solid rgb(8, 175, 164)',
    borderRadius: '5px',
    zIndex: '1000',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'left',
    overflow: 'hidden', // 防止内容溢出
  });

  const topElement = summaryBox.querySelector('.top');
  Object.assign(topElement.style, {
    backgroundColor: 'rgb(8, 175, 164)', // 标题背景色
    borderTopLeftRadius: '5px',
    borderTopRightRadius: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  });

  // 设置标题样式
  const titleElement = summaryBox.querySelector('.summary-title');
  Object.assign(titleElement.style, {
    color: '#fff', // 标题文字颜色
    padding: '5px 10px', // 标题内边距
    margin: '0', // 去除默认 margin
    fontSize: '16px',
    fontWeight: 'bold',
    borderTopLeftRadius: '5px',
    borderTopRightRadius: '5px',
    display: 'inline-block',
  });

  //设置关闭按钮样式
  const buttonElement = summaryBox.querySelector('.closeButton');
  Object.assign(buttonElement.style, {
    backgroundColor: 'rgb(8, 175, 164)',
    color: '#fff',
    fontSize: '12px',
    paddingRight: '10px',
    cursor: 'pointer',
  });
  buttonElement.addEventListener('click', () => {
    summaryBox.remove();
  });

  // 设置属性区域样式
  const attributesElement = summaryBox.querySelector('.summary-attributes');
  Object.assign(attributesElement.style, {
    padding: '5px',
    fontSize: '14px',
    borderLeft: '2px solid rgba(8, 175, 164, 0.83)',
    borderRight: '2px solid rgba(8, 175, 164, 0.83)',
    // backgroundColor: 'rgba(19, 107, 108, 0.32)', // 属性区域背景色
    // borderBottom: '2px solid rgba(8, 175, 164, 0.83)', // 分隔线
  });

  // 设置属性名样式
  const attributeNames = summaryBox.querySelectorAll('.attr-name');
  attributeNames.forEach((name) => {
    Object.assign(name.style, {
      color: '#15cba5', // 属性名颜色
      fontSize: '14px',
      fontWeight: 'bold',
    });
  });

  // 设置属性值样式
  const attributeValues = summaryBox.querySelectorAll('.attr-value');
  attributeValues.forEach((value) => {
    Object.assign(value.style, {
      color: '#fff', // 属性值颜色
    });
  });

  // 设置总结内容样式
  const contentElement = summaryBox.querySelector('.summary-content');
  Object.assign(contentElement.style, {
    padding: '5px',
    fontSize: '12px',
    // lineHeight: '1.5',
    color: '#ddd', // 总结文字颜色
    // backgroundColor: 'rgba(19, 107, 108, 0.32)', // 属性区域背景色
    border: '2px solid rgba(8, 175, 164, 0.83)',

    borderBottomLeftRadius: '5px',
    borderBottomRightRadius: '5px',
  });

  document.body.appendChild(summaryBox);

  // 设置“总结：”样式
  const summaryLabel = summaryBox.querySelector('.summary-label');
  Object.assign(summaryLabel.style, {
    fontWeight: 'bold', // 加粗
    color: '#15cba5', // 亮绿色
    marginBottom: '5px', // 与内容之间的间距
    fontSize: '14px', // 字体大小
  });
}

// 加载 GPR 模型的 summaryBox
function loadGPRModelSummary() {
  destroySummaryBox(); // 销毁旧的 summaryBox
  createSummaryBox(
    '地质雷达',
    [
      { name: '预报距离', value: '30m' },
      { name: '检测日期', value: '2023.2.9' },
    ],
    '施做超前水平钻孔对异常段进一步探测，控制进尺及爆破，及时支护，防止掉块，涌水等工程地质灾害的发生，确保工程施工安全。'
  );
}

// 加载 DBH 模型的 summaryBox
function loadDBHModelSummary() {
  destroySummaryBox(); // 销毁旧的 summaryBox
  createSummaryBox(
    '加深炮孔',
    [
      { name: '预报距离', value: '30m' },
      { name: '检测日期', value: '2023.2.9' },
    ],
    '1)掘进过程中密切关注出水位置的的地下水发育情况，及时引排，遇到承压水要增加泄水孔，水量较大时可注浆处理;2)对于突进的情况，要注意破碎及岩溶发育，宜引起涌泥和溜塌'
  );
}

// 加载 AHD 模型的 summaryBox
function loadAHDModelSummary() {
  destroySummaryBox(); // 销毁旧的 summaryBox
  createSummaryBox(
    '超前水平钻',
    [
      { name: '预报距离', value: '30m' },
      { name: '检测日期', value: '2023.2.9' },
    ],
    '1)掘进过程中密切关注出水位置的的地下水发育情况，及时引排，遇到承压水要增加泄水孔，水量较大时可注浆处理;	2)对于突进的情况，要注意破碎及岩溶发育，宜引起涌泥和溜塌。'
  );
}

// 加载 TSP 模型的 summaryBox
function loadTSPModelSummary() {
  destroySummaryBox(); // 销毁旧的 summaryBox
  createSummaryBox(
    'TSP 模型',
    [
      { name: '预报方法', value: '地震反射波法' },
      { name: '预报距离', value: '200m' },
      { name: '检测日期', value: '2023.2.9' },
    ],
    '预报段围岩整体较破碎，局部破碎，节理裂隙较发育，含水。建议施做超前水平钻孔对异常段进一步探测，控制进尺及爆破，及时支护，防止掉块、涌水等工程地质灾害的发生，确保工程施工安全。'
  );
}

// 加载 TFS 模型的 summaryBox
function loadTFSModelSummary() {
  destroySummaryBox(); // 销毁旧的 summaryBo
}

export {
  lookAtFixed,
  controlTEGModel,
  controlTSPModel,
  controlTEMModel,
  controlWATERModel,
  controlPOSUIModel,
  controlGPRModel,
  controlAHDModel,
  controlDBHModel,
  controlTFSModel,
  loadAHDModelSummary,
  loadDBHModelSummary,
  loadGPRModelSummary,
  loadTSPModelSummary,
  loadTFSModelSummary,
  destroySummaryBox,
};
