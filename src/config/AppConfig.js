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
class AppConfig {
    async loadConfig(jsonPath) {
        let data;
        // 优先从后端 API 加载实时配置
        try {
            const apiRes = await fetch('/api/config');
            if (apiRes.ok) {
                const raw = await apiRes.json();
                // 将 snake_case API key 映射为 camelCase
                const apiConfig = {};
                const keyMap = {
                    ip_server: 'ipServer', cdn_server: 'cdnServer', neo4j_server: 'neo4jServer',
                    geoserver: 'geoserver', middleware_server: 'middlewareServer',
                    open_fps: 'openFPS', openlayer_control: 'openlayerControl',
                    debug_mode: 'debugMode', map_provider: 'mapProvider',
                    tdt_token: 'tdtToken', ion_token: 'ionToken',
                    server_page: 'serverPage', zzsm_image: 'zzsmImage',
                };
                for (const [k, v] of Object.entries(raw)) {
                    apiConfig[keyMap[k] || k] = v;
                }
                console.log('[AppConfig] 从 API 加载配置');
                data = { ...this.defaults(), ...apiConfig };
            }
            else {
                throw new Error('API unavailable');
            }
        }
        catch {
            // 回退到本地 JSON 文件
            console.log('[AppConfig] API 不可用，回退到本地 JSON');
            data = await fetch(jsonPath).then((r) => r.json());
        }
        this.appConfig = data;
        if (import.meta.env.MODE == 'development') {
            this.appConfig.geoserver = '/geoserver';
        }
    }
    /** 配置默认值（确保不依赖外部即可运行） */
    defaults() {
        return {
            ipServer: 'http://localhost:3000',
            cdnServer: '',
            neo4jServer: 'bolt://localhost:7687',
            geoserver: '',
            middlewareServer: '',
            openFPS: false,
            openlayerControl: false,
            debugMode: false,
            mapProvider: 'Cesium Ion',
            tdtToken: '',
            ionToken: '',
            serverPage: '',
            zzsmImage: '',
        };
    }
    getConfig() {
        return this.appConfig;
    }
    appConfig;
}
export default singleTon(AppConfig);
