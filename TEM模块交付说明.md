# 隧洞数字孪生平台 TEM 模块交付说明

## 交付内容

- `src/`：前端源码，包含 `/geophysical-voxel` 综合物探体素建模页面。
- `backend/`：TEM 上传、处理和任务接口源码。
- `scripts/`：项目数据转换及构建辅助脚本。
- `public/data/tem_output/`：现有 TEM 处理结果（含 `latest` 与其关联任务目录）。
- `dist/`：已构建的前端页面，可直接由静态 Web 服务器部署。
- 根目录配置文件与技术说明文档。

本包不包含 `node_modules`、Git 元数据、运行缓存、临时上传、Vp/Vs CSV，以及与本模块无关的大型隧洞和其他业务模型。

## 环境要求

- Node.js 20 或更高版本
- npm
- 如需重新运行 TEM 后端处理：Python 3.10 或更高版本

TEM Python 依赖：

```text
numpy scipy matplotlib scikit-image scikit-learn trimesh
```

## 前端源码运行

在交付包根目录执行：

```bash
npm install
npm run dev
```

浏览器打开终端输出的地址，然后访问：

```text
/geophysical-voxel
```

重新生成生产构建：

```bash
npm run build
```

## 已构建页面运行

`dist/` 需要通过 HTTP 静态服务器访问，不能直接双击 `index.html`。例如：

```bash
npx vite preview --host 0.0.0.0
```

如部署到 Nginx、IIS 等服务器，需要把未知路由回退到 `index.html`，以支持 `/geophysical-voxel`。

## TEM 后端运行

```bash
cd backend
copy .env.example .env
npm install
npm run start
```

请根据接收方环境修改 `.env`。TEM 算法说明见：

```text
backend/src/workers/tem/README.md
```

## 数据说明

本包 TEM 数据来自现有 `latest` 输出，三维坐标、范围和属性均取自随包数据文件，没有根据附件图片生成或推测坐标。主要文件：

- `tem_voxel_full.csv`：完整 TEM 体素数据。
- `tem_volume.raw`：128×128×128 Float32 体数据。
- `meta.json`：空间范围、统计量和异常体清单。
- `anomaly_k570_4x.glb`：低阻异常体三维模型。
- `line_profiles.json`：测线剖面数据。

富水提取规则为视电阻率 `< 570 Ω·m`；恰好等于 570 不计入富水区域。

## 当前 TEM 空间范围

- X：`-2.7971972411 ～ 58.5452076709`
- Y：`-50.9129394672 ～ 50.9129394672`
- Z：`-17.0635825927 ～ 30.4672917726`

以上数值直接摘自 `public/data/tem_output/latest/meta.json`。
