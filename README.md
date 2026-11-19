# 豌豆攀援观察 · Pisum sativum

黑底植物交互原型。身体侧倾或手动输入影响生长方向，豌豆按自身节奏弯曲、长叶和探索。场景由 Three.js 实时绘制。游戏、纹理生成器、MediaPipe 运行文件与模型均在本地。

## 启动

在线体验：https://palliumur.github.io/pea-climbing-game/ 。点击 ENABLE CAMERA 后允许摄像头，即可使用身体姿态引导生长。

解压后双击 play.html 即可打开游戏。macOS 也可双击「启动原型.command」启动本机网页。启动器使用系统 Python 3，在默认浏览器打开本机页面；关闭终端窗口即结束服务。也可在有 Node.js 与 Python 3 的环境运行 `npm start`，再打开 http://127.0.0.1:4173/ 。摄像头需要 localhost 或 HTTPS。

从 GitHub 克隆后，可运行 `python3 tools/build-local-page.py` 生成供双击打开的 `play.html`。

## GitHub Pages 部署

发布前运行 `npm test` 和 `npm run build:pages`，将修改推送到 GitHub 的 `main` 分支。在仓库 Settings → Pages 中选择 Deploy from a branch、`main`、`/ (root)` 并保存。根目录的 `index.html` 由 `dist/index.html` 生成，使用 `dist/` 内的同一套游戏文件；`.nojekyll` 让 GitHub 直接发布静态资源。

## 操作

- 首屏展示一株由模拟生成的中期豌豆。左下角只有摄像头框、当前操作提示及一个开关。
- 点击 **ENABLE CAMERA** 并授权，预览框显示镜像视频。让肩膀与髋部同时入镜，面对镜头自然站直约一秒。左右侧倾控制横向，肩膀向镜头轻倾会引导植株朝前景生长，轻微后倾会引导它往深处生长。如果提示改为 “Step closer or farther”，正对镜头小步靠近或退后即可用肩宽变化引导纵深。首次进入体验时从幼株开始。
- 镜像预览用薄荷绿细线和圆点显示肩、肘、腕、髋。躯干中线连接双肩与双髋的中点，身体侧倾决定总体生长方向。
- 镜头从全景切换到生长端，随后以固定距离和角度跟随顶芽，直到卷须完成缠绕并继续生长。识别丢失时生长暂停。点击 **DISABLE CAMERA** 停止摄像头，重新开启可继续原来的植株。视频只在浏览器本地处理。
- 摄像头关闭时，左右方向键调整横向，上箭头引向场景深处，下箭头引向前景。空格暂停或继续，R 重新生长。

## 场景与代码

| 文件 | 实现 |
| --- | --- |
| `dist/simulation.js` | 方向映射、缓动、主茎历史、接触和固定 |
| `dist/growth.js` | 器官发育、分叉卷须、沿接触网壳的渐进卷绕 |
| `dist/supports.js` | 六根固定种子网壳的顶点、三角面、截面查询、接触检测和叶面避让 |
| `dist/habitat.js` | 薄暗网面、分层网线、连续地形与静态灰白点云 |
| `dist/botanical.js`、`dist/growing-mesh.js`、`dist/foliage.js` | 固定在叶片表面的印刷纹理、复用缓冲的渐细管网格、叶形和局部避让 |
| `dist/scene.js` | 器官组装、视口适配、全景与生长端相机 |
| `dist/app.js` | 摄像头开关、姿态追踪、键盘输入和当前提示 |

六根网壳保留不同的空间坐标。逐杆路线测试从同一株幼苗出发，使用左右加前后的肩髋输入，直到目标完成缠绕。不同网壳的直径影响相同长度卷须能绕过的角度。可达性还取决于实际生长路线与深度。距离、时间、转向响应、显示色和相机尺度均为展演参数。

## 可解释的回应规则

1. 从 MediaPipe 双肩、双髋四个关键点计算身体中轴相对竖直的倾斜角，按视频画幅校正，镜像后得到目标方向；低置信度或腰部未入镜时暂停生长。
2. 方向以最大 0.25 rad/s 缓慢接近目标，主茎顶芽以 0.061 场景单位/s 伸长。上部柔软区域产生小幅、约 10.8 s 一周的弯曲，下部保留。
3. 新复叶从顶芽附近逐节生成，节间长度有小幅固定差异，每片记录独立叶龄。叶轴伸长，小叶先折叠，再分别沿中脉伸长、向两侧展宽。托叶、近端小叶、叶端卷须分开生成。
4. 卷须用沿长度逐步累积的弯曲产生探索。下部早期复叶省去卷须，上部不同叶片采用不同的分枝数量、长度和分出位置，不再每组都重复三根。
5. 实际空间接触当前网壳表面后，固定接触点。接触前约 0.24 场景单位的柔软卷须随当前卷曲方向连续弯曲，远端在 8.4 s 内逐渐绕壳卷曲，主茎保持连续伸长。卷绕曲线以平滑包络跨过网壳的三角棱角，保留小幅间隙；统一远端卷曲进度，避免末端在中途反折。用剩余远端长度和接触期伸长量约束卷曲弧长，不搬动整个植株。
6. 使用持续存在的顶点缓存每帧更新网格；暂停冻结植物模拟时钟。

在接触网壳前，相同幅度的左倾与右倾有相同的转向速度上限和幅度。卷须碰到网壳后，从实际接触位置开始缠绕。

以上数值是时间压缩后的展演参数，不是论文实验的物理测量或已校准的植物生长模型。人的姿态到方向的映射、椭圆近似和状态转移为设计转译。

本次检验：参与者能否理解身体输入如何影响探索方向，并根据植物与支撑关系调整动作。该版本不模拟邻株影响，也不用于验证真实植物的生物学机制。

## 来源与技术

- 植物运动：Guerra et al. (2019), *Flexible control of movement in plants*, https://doi.org/10.1038/s41598-019-53118-0
- 单株/双株研究背景：Bonato et al. (2023), *Evidence of Motor Intentions in Plants: A Kinematical Study*, https://doi.org/10.1037/com0000351
- 视觉与实现参考：Meng To / ThreeUI, *Sylva Living World — Living Green*, https://threeui.com/three-js/sylva-living-world/living-green ，公开社区实现 https://github.com/MengTo/threeui ，MIT License。参考了程序化几何、实例化植被、材质细节和氛围分层的实现方法，本项目的豌豆几何、纹理与运动代码为重新实现。
- Three.js 0.170.0：MIT，许可随 `dist/vendor/three/LICENSE` 保存。
- MediaPipe Tasks Vision 0.10.21：Apache-2.0，轻量 Pose Landmarker 模型来自 Google 官方模型仓库。

## 检查

运行 `npm test`。40 项测试覆盖姿态映射、转向缓动、旧茎保持、叶龄与分叉、表面接触、两种深度输入各自到达六根网壳的路线、远端长度预算、固定连接与重置。缠绕回归检查以 60 fps 遍历六根网壳的完整卷绕过程，检查接触固定、局部折角、末端连续性和渲染样条。`tests/visual/wrap-study.html` 可查看不同网壳与卷绕进度，供渲染检查使用。

原版生长研究与纹理来源记录分别保存在 [GROWTH_RESEARCH.md](GROWTH_RESEARCH.md) 和 [TEXTURE_PROVENANCE.md](TEXTURE_PROVENANCE.md)。新版页面使用程序生成的印刷纹理。
