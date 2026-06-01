/*
 * @Author: 枫林残忆
 * @Date: 2024-03-11 10:49:54
 * @LastEditors: 枫林残忆 2997534654@qq.com
 * @LastEditTime: 2024-04-11 20:05:37
 * @FilePath: \Geology-V3\src\config\AppConfig.ts
 * @Description: 整个应用程序的配置
 * Copyright (c) 2024 by VGE, All Rights Reserved.
 */
import { singleTon } from '../utils/DesignMode';
export interface AppConfigInterface {
  ipServer: string; // 服务器地址
  cdnServer: string; // 内容分发服务器，存放比较大的资源或者离线库
  neo4jServer: string; // neo4j服务器地址
  geoserver: string; // geoserver
  middlewareServer: string; // 中间件服务的地址
  openFPS: boolean; // 打开帧率
  openlayerControl: boolean; // 图层控制器
  debugMode: boolean; // 是否打开调试模式
  mapProvider: string; // 地图提供商
  tdtToken: string; // 天地图 token，当然必须用户选择 "Tianditu Map"
  ionToken: string; // cesium ion的密钥，全球地形+必应地图都需要
  serverPage: string; // 后台数据服务地址
  zzsmImage: string; // 地质素描影像服务
}

class AppConfig {
  async loadConfig(jsonPath: string): Promise<void> {
    let data = await fetch(jsonPath).then((response) => {
      return response.json();
    });
    this.appConfig = data;
    if (import.meta.env.MODE == 'development') {
      this.appConfig.geoserver = '/geoserver'; // 使用vite的代理
    }
  }

  getConfig() {
    return this.appConfig;
  }
  appConfig: AppConfigInterface;
}

export default singleTon(AppConfig);
