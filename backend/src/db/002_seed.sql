-- Seed data: reference tables, dictionaries, scene configs, default system config
SET client_encoding = 'UTF8';

-- ---- 地质模型类型 ----
INSERT INTO geological_model_types (code, name_cn, name_en, data_type, render_method, category, sort_order) VALUES
('weak_rock',     '软弱围岩',   'Weak Rock',              'glb',        'cesium_model',  'adverse_geology',    1),
('high_stress',   '高地应力',   'High Stress',            'glb',        'cesium_model',  'adverse_geology',    2),
('water_zone',    '富水带',     'Water-rich Zone',        'volume_json','volume_canvas',  'adverse_geology',    3),
('fracture_zone', '破碎带',     'Fracture Zone',          'volume_json','volume_canvas',  'adverse_geology',    4),
('face_sketch',   '掌子面素描', 'Tunnel Face Sketch',     'image',      'cesium_entity', 'face_monitoring',    5),
('gpr',           '地质雷达',   'Ground Penetrating Radar','glb',       'cesium_model',  'advance_prediction', 6),
('horiz_drill',   '超前水平钻', 'Advance Horizontal Drill','glb',        'cesium_model',  'advance_prediction', 7),
('deep_hole',     '加深炮孔',   'Deep Blast Holes',       'glb',        'cesium_model',  'advance_prediction', 8),
('tsp',           'TSP反演',    'Tunnel Seismic Prediction','volume_json','volume_canvas','advance_prediction', 9),
('tem',           '瞬变电磁',   'Transient Electromagnetic','volume_json','volume_canvas','advance_prediction',10);

-- ---- 设备类型 ----
INSERT INTO equipment_types (code, name_cn, category) VALUES
('drill_rig',       '三臂凿岩台车', 'drilling'),
('loader',          '装载机',       'loading'),
('shotcrete_robot', '混凝土喷射机', 'spraying'),
('ventilator',      '通风机',       'ventilation'),
('dump_truck',      '自卸车',       'hauling'),
('grouting_machine','注浆机',       'grouting'),
('excavator',       '挖掘机',       'excavation');

-- ---- 场景定义 ----
INSERT INTO scene_definitions (scene_key, name_cn, icon, color, sort_order) VALUES
('workface', '隧洞围岩', '⬡', '#00e5ff', 1),
('blast',    '开挖爆破', '💥', '#ff6b35', 2),
('support',  '围岩支护', '◈', '#aa88ff', 3),
('vent',     '通风除尘', '≋', '#44ff88', 4),
('dispatch', '装备调度', '◎', '#ffaa00', 5);

-- ---- 场景指标 ----
INSERT INTO scene_metrics (scene_key, label, metric_key, unit, display_order) VALUES
-- workface
('workface', '围岩等级', 'rock_level',       '级',   1),
('workface', '循环进尺', 'cycle_advance',    'm',    2),
('workface', '断面面积', 'cross_section',    'm²',  3),
('workface', '当前工序', 'current_procedure','',     4),
('workface', '在岗人数', 'personnel_count',  '人',   5),
('workface', '今日进尺', 'daily_advance',    'm',    6),
-- support
('support',  '监测断面', 'monitor_sections', '个',   1),
('support',  '拱顶沉降', 'arch_settlement',  'mm',   2),
('support',  '水平收敛', 'horiz_convergence','mm',   3),
('support',  '净空面积', 'clearance_area',   'm²',  4),
('support',  '初支厚度', 'primary_thickness','cm',   5),
('support',  '喷锚完成', 'shotcrete_pct',    '%',    6),
-- vent
('vent',     '风速',     'wind_speed',       'm/s',  1),
('vent',     '风量',     'air_volume',       'm³/min',2),
('vent',     '隧道温度', 'temperature',      '°C',   3),
('vent',     'CO浓度',   'co_concentration', 'ppm',  4),
('vent',     '粉尘浓度', 'dust_concentration','mg/m³',5),
('vent',     '氧气含量', 'o2_level',         '%',    6),
-- dispatch
('dispatch', '在岗人员', 'personnel_count',  '人',   1),
('dispatch', '在用设备', 'equipment_count',  '台',   2),
('dispatch', '今日出渣', 'muck_volume',      'm³',  3),
('dispatch', '运渣趟次', 'muck_trips',       '趟',   4),
('dispatch', '完成工序', 'procedures_done',  '道',   5),
('dispatch', '当班效率', 'shift_efficiency', '%',    6);

-- ---- 场景状态项 ----
INSERT INTO scene_status_items (scene_key, label, val, pct, level, display_order) VALUES
('workface', '围岩稳定性', '中等',     55, 'warn', 1),
('workface', '超前支护',   '已施做',   90, 'good', 2),
('workface', '地下水',     '少量渗水', 30, 'info', 3),
('workface', '瓦斯浓度',   '0.0%',      0, 'good', 4),
('support',  '结构稳定性', '稳定',     85, 'good', 1),
('support',  '沉降速率',   '0.3mm/d',  35, 'info', 2),
('support',  '锚杆应力',   '正常',     70, 'good', 3),
('support',  '二衬进度',   '72%',      72, 'good', 4),
('vent',     '主风机',     '运行中',  100, 'good', 1),
('vent',     '风筒完好率', '96%',      96, 'good', 2),
('vent',     'CO浓度',     '正常',     15, 'info', 3),
('vent',     '粉尘指数',   '正常',     24, 'info', 4),
('dispatch', '挖掘机',     '作业中',  100, 'good', 1),
('dispatch', '装载机',     '作业中',  100, 'good', 2),
('dispatch', '渣车调度',   '2台在途',  80, 'good', 3),
('dispatch', '通道畅通',   '正常',    100, 'good', 4);

-- ---- 系统配置 ----
INSERT INTO system_config (config_key, config_value, description, category, is_public) VALUES
('map_provider',      'Cesium Ion',         '地图提供商',                         'maps',    true),
('tdt_token',         '',                   '天地图 API Token',                   'maps',    true),
('ion_token',         '',                   'Cesium Ion Token',                   'maps',    true),
('ip_server',         'http://localhost:3000','API 服务器地址',                    'network', true),
('cdn_server',        'http://localhost:9000','CDN/对象存储地址',                   'network', true),
('neo4j_server',      'bolt://localhost:7687','Neo4j 服务器',                      'network', false),
('geoserver',         'http://localhost:8080/geoserver','GeoServer 地址',           'network', true),
('middleware_server', 'http://localhost:3001','中间件服务地址',                     'network', false),
('server_page',       '',                   '数据服务页面地址',                    'general', true),
('zzsm_image',        '',                   '地质素描影像服务地址',                 'general', true),
('debug_mode',        'false',              '调试模式',                            'general', true),
('open_fps',          'false',              '显示帧率',                            'general', true);

-- ---- 默认管理员用户（密码: admin123，生产环境请修改）----
-- bcrypt hash of 'admin123' with 12 rounds
INSERT INTO users (username, password_hash, display_name, role) VALUES
('admin', '$2b$12$LJ3m4ys3LkBCVxJGqOjPkuYVOYpGOKbHgEMoJxYzRqcMdFNP2sCuW', '系统管理员', 'admin');
