// backend/server.js

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = 3000;

// === 1. 中间件设置 ===
// 允许所有来源的跨域请求（在开发中最简单，但生产中应更严格）
app.use(cors());

// 为上传文件创建根目录
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 配置 Multer 将文件保存到磁盘
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 每个任务在上传时都有自己的专属文件夹
    const jobDir = path.join(UPLOAD_DIR, req.jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    // 使用原始文件名，以UTF-8编码处理中文名
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, originalName);
  }
});

// 在处理文件上传前，先为请求分配一个任务ID，以便Multer使用
const assignJobId = (req, res, next) => {
  req.jobId = crypto.randomBytes(16).toString('hex');
  next();
};

const upload = multer({ storage: storage });

// === 2. 内存中的任务存储 ===
// 在真实的应用中，您应该使用数据库（如 Redis 或 PostgreSQL）来存储任务状态。
// 对于此示例，一个简单的内存对象就足够了。
const jobs = {};

// === 3. 任务调度与处理 ===

/**
 * 执行并监控外部处理脚本
 * @param {string} jobId 任务ID
 * @param {string} scriptPath 脚本的绝对路径
 * @param {string[]} args 传递给脚本的参数
 */
function executeAndMonitorScript(jobId, scriptPath, args) {
    const job = jobs[jobId];
    const command = path.extname(scriptPath) === '.py' ? 'python' : scriptPath;
    const scriptArgs = path.extname(scriptPath) === '.py' ? [scriptPath, ...args] : args;

    const processingProcess = spawn(command, scriptArgs);

    job.status = 'processing';
    job.message = '处理脚本已启动...';
    console.log(`[Job ${jobId}] 执行: ${command} ${scriptArgs.join(' ')}`);

    // 监听脚本的标准输出 (stdout)
    processingProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[Job ${jobId} STDOUT]: ${output}`);
        // 定义一种通信“契约”：脚本通过打印JSON来更新状态
        // 例如: {"type": "progress", "value": 25, "message": "正在读取数据..."}
        try {
            const update = JSON.parse(output);
            if (update.type === 'progress' && job.status === 'processing') {
                job.progress = update.value;
                job.message = update.message;
            } else if (update.type === 'log') {
                job.log = `${new Date().toLocaleTimeString()}: ${update.message}`;
            }
        } catch (e) {
            // 如果不是JSON，则当作普通日志处理
            job.log = `${new Date().toLocaleTimeString()}: ${output}`;
        }
    });

    // 监听脚本的错误输出 (stderr)
    processingProcess.stderr.on('data', (data) => {
        const errorMsg = data.toString().trim();
        console.error(`[Job ${jobId} STDERR]: ${errorMsg}`);
        job.error = (job.error || '') + errorMsg + '\n';
        job.log = `${new Date().toLocaleTimeString()}: 错误: ${errorMsg}`;
    });

    // 监听脚本退出事件
    processingProcess.on('close', (code) => {
        console.log(`[Job ${jobId}] 脚本执行完毕，退出码: ${code}`);
        if (job.status !== 'error') { // 避免覆盖stderr中已设置的错误状态
            if (code === 0) {
                job.status = 'complete';
                job.progress = 100;
                job.message = '处理成功！';
            } else {
                job.status = 'error';
                job.message = '处理失败，请查看日志。';
                if (!job.error) job.error = `脚本以错误码 ${code} 退出。`;
            }
        }
        // 清理该任务的上传目录
        const jobDir = path.join(UPLOAD_DIR, jobId);
        fs.rm(jobDir, { recursive: true, force: true }, (err) => {
            if (err) console.error(`[Job ${jobId}] 清理目录 ${jobDir} 失败:`, err);
            else console.log(`[Job ${jobId}] 清理目录 ${jobDir} 成功。`);
        });
    });
}

/**
 * 任务调度器
 * @description 根据 modelKey 决定调用哪个处理脚本或函数。
 * @param {string} jobId - 任务ID
 * @param {string} modelKey - 模型类型，如 'tem', 'tsp', 'gpr'
 */
function runProcessingScript(jobId, modelKey) {
    const job = jobs[jobId];
    if (!job) return;

    console.log(`调度任务 ${jobId}，模型类型: '${modelKey}'...`);

    const jobDir = path.join(UPLOAD_DIR, jobId);
    const args = [jobId, jobDir]; // 将任务ID和数据目录作为参数传递
    let scriptPath = '';

    switch (modelKey) {
        case 'gpr': // 地质雷达
            // 假设您的EXE名为 gpr_processor.exe
            scriptPath = path.join(__dirname, 'bin', 'gpr_processor.exe');
            break;
        case 'tem': // 瞬变电磁
            // 确保 process_tem.py 脚本存在于 'scripts' 文件夹中
            scriptPath = path.join(__dirname, 'scripts', 'process_tem.py');
            break;
        default:
            console.warn(`-> 未找到 '${modelKey}' 的真实处理规则，将使用模拟处理。`);
            simulateProcessing(jobId); // 如果没有真实脚本，则回退到模拟
            return;
    }

    if (!fs.existsSync(scriptPath)) {
        const errorMsg = `后端错误: 未找到处理程序 ${path.basename(scriptPath)}。`;
        console.error(`-> 错误: 脚本或程序文件不存在: ${scriptPath}。`);
        job.status = 'error';
        job.error = errorMsg;
        job.message = '处理失败，请联系管理员。';
        return;
    }

    executeAndMonitorScript(jobId, scriptPath, args);
}

/**
 * 模拟后端处理 (作为备用)
 * @description 这个函数模仿一个长时间运行的处理任务。
 */
function simulateProcessing(jobId) {
  const job = jobs[jobId];
  if (!job) return;

  const processSteps = [
    { delay: 2000, progress: 10, message: '任务已接收，正在准备环境...' },
    { delay: 3000, progress: 30, message: '正在解析原始数据...' },
    { delay: 5000, progress: 60, message: '执行地质反演算法...' },
    { delay: 4000, progress: 85, message: '算法完成，开始生成三维网格...' },
    { delay: 2000, progress: 95, message: '网格优化与纹理烘焙...' },
  ];

  let cumulativeDelay = 0;
  processSteps.forEach(step => {
    cumulativeDelay += step.delay;
    setTimeout(() => {
      if (jobs[jobId] && jobs[jobId].status === 'processing') {
        jobs[jobId].progress = step.progress;
        jobs[jobId].message = step.message;
        // 在真实应用中，您可能会从处理脚本中获取日志行
        jobs[jobId].log = `${new Date().toLocaleTimeString()}: ${step.message}`;
      }
    }, cumulativeDelay);
  });

  // 最后一步：标记为完成
  setTimeout(() => {
    if (jobs[jobId] && jobs[jobId].status === 'processing') {
      jobs[jobId].status = 'complete';
      jobs[jobId].progress = 100;
      jobs[jobId].message = '处理成功！';
      jobs[jobId].log = `${new Date().toLocaleTimeString()}: 模型生成完毕！`;
    }
  }, cumulativeDelay + 1000);
}

// === 4. API 接口：开始处理 ===
// 这个接口接收文件并启动后台任务。
app.post('/api/process/:modelKey', assignJobId, upload.array('files'), (req, res) => {
  const { modelKey } = req.params;
  const files = req.files;
  const jobId = req.jobId;

  if (!files || files.length === 0) {
    return res.status(400).send('没有上传文件。');
  }

  // 存储任务信息
  jobs[jobId] = {
    id: jobId,
    modelKey: modelKey,
    status: 'processing', // 初始状态
    progress: 0,
    message: '已加入处理队列...',
    log: null,
    error: null,
    createdAt: new Date(),
  };

  console.log(`[${new Date().toISOString()}] 新任务启动: ${jobId} (模型: ${modelKey}, 文件数: ${files.length})`);

  // 调用任务调度器
  runProcessingScript(jobId, modelKey);

  res.status(202).json({ jobId: jobId });
});


// === 5. API 接口：获取任务状态 ===
// 前端会轮询此接口以获取任务的进度更新。
app.get('/api/process/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];

  if (!job) {
    return res.status(404).json({ error: '任务未找到' });
  }

  // 响应任务的当前状态
  res.status(200).json(job);
});


// === 6. 启动服务器 ===
app.listen(PORT, () => {
  console.log(`✅ 后端服务器正在 http://localhost:${PORT} 运行`);
});