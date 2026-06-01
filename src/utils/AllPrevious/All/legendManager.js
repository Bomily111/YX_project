// 统一管理图例
const legends = {
  DBH: {
    title: 'DK280+394-DK280+419 地质情况专家判识',
    details: {
      序号: '1',
      里程范围: 'DK280+420~DK28+390',
      '长度(m)': '4.1',
      风险类别: '其他',
      探测结论: '岩性为细粒二长花岗岩，钻速均匀，无突进，无卡钻，无水，混合体呈灰白色。',
      地质风险等级: '正常',
    },
  },
  GPR: {
    title: 'DK280+408-DK280+428 地质情况专家判识',
    details: {
      反射波振幅: '变化较明显',
      同相轴连续性: '较差',
      反射波能量: 'DK280+408-DK280+428',
      围岩情况: '较发育',
      含水情况: '含水(沿裂隙线状流出)',
      综合评价: '节埋发育较密集，水量可能增大',
    },
  },
  AHD: {
    title: 'DK280+398-DK280+428 地质情况专家判识',
    details: {
      地层代号: '40',
      孔径: '76 mm',
      '长度(m)': '18',
      钻速: '255 转/分',
      钻孔压力: '0.01 MPa',
      出水位置: 'DK280+426',
      出水量: '0.01 m³/h',
      结论: `岩性：卵石土 
      钻速：缓慢 
      卡钻：无 
      突进：无 
      水色：淡黄色 
      围岩级别：IV级 
      瓦斯含量：0%`,
    },
  },
};

export function showLegend(modelType) {
  // 检查是否已有图例，避免重复创建
  let existingLegend = document.getElementById('legend-container');
  if (existingLegend) {
    existingLegend.remove();
  }

  if (!legends[modelType]) {
    console.warn(`未找到模型 ${modelType} 的图例`);
    return;
  }

  // 创建图例容器
  const legendContainer = document.createElement('div');
  legendContainer.id = 'legend-container';
  legendContainer.style.position = 'absolute';
  legendContainer.style.bottom = '20px';
  legendContainer.style.right = '10px';
  legendContainer.style.width = '330px';
  legendContainer.style.maxHeight = '50vh'; // 高度
  legendContainer.style.overflowY = 'auto'; // 启用垂直滚动条
  legendContainer.style.backgroundColor = 'rgba(21, 146, 136, 0.29)';
  legendContainer.style.padding = '5px';
  legendContainer.style.borderRadius = '8px';
  legendContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
  legendContainer.style.fontFamily = 'Arial, sans-serif';
  legendContainer.style.fontSize = '12px';
  // 添加滚动条样式
  legendContainer.style.cssText += `
    scrollbar-width: thin;
    scrollbar-color: rgba(8, 175, 164, 0.5) transparent; 
  `;
  const legendData = legends[modelType];

  const top = document.createElement('div');
  top.style.backgroundColor = 'rgb(8, 175, 164)';
  top.style.borderTopLeftRadius = '5px';
  top.style.borderTopRightRadius = '5px';
  top.style.display = 'flex';
  top.style.justifyContent = 'space-between';

  // 设置标题
  const title = document.createElement('h3');
  title.innerText = legendData.title;
  title.style.fontSize = '15px';
  title.style.marginTop = '0';
  title.style.color = 'white';
  title.style.padding = '5px 0 5px 10px';
  // title.style.width = '280px';

  // 创建表格
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.color = '#ddd';

  for (const [key, value] of Object.entries(legendData.details)) {
    const row = document.createElement('tr');

    const keyCell = document.createElement('td');
    keyCell.innerText = key;
    keyCell.style.border = '2px solid rgba(8, 175, 164, 0.83)';
    keyCell.style.padding = '5px';
    keyCell.style.width = '100px';

    const valueCell = document.createElement('td');
    valueCell.innerText = value;
    valueCell.style.border = '2px solid rgba(8, 175, 164, 0.83)';
    valueCell.style.padding = '5px';

    if (key.includes('等级')) {
      valueCell.style.color = 'green';
    }

    row.appendChild(keyCell);
    row.appendChild(valueCell);
    table.appendChild(row);
  }

  // 关闭按钮
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.style.paddingRight = '5px';
  closeButton.style.fontSize = '14px';
  closeButton.style.background = 'rgb(8, 175, 164)';
  closeButton.style.color = 'white';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '4px';
  closeButton.style.cursor = 'pointer';

  closeButton.addEventListener('click', () => {
    legendContainer.remove();
  });

  // 添加元素
  top.appendChild(title);
  top.appendChild(closeButton);
  legendContainer.appendChild(top);
  legendContainer.appendChild(table);

  // 插入到页面
  document.body.appendChild(legendContainer);
}
export function hideLegend() {
  const legend = document.getElementById('legend-container');
  if (legend) {
    legend.remove(); // 从 DOM 中移除图例
  }
}
