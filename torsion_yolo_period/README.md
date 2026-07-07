# torsion_yolo_period

基于 YOLO-Seg 的扭摆法周期自动测量模块。

**核心思路：YOLO 负责检测杆子，物理算法负责计算周期。**

```
视频帧 → YOLO-Seg 检测杆子 mask → PCA 提取主方向角 θ
       → 角度连续化(unwrap) → Savitzky-Golay 平滑
       → 同向过零法 / 峰值法 / 阻尼正弦拟合 → 周期 T
```

---

## 目录结构

```
torsion_yolo_period/
├── config.yaml              # 全局参数
├── extract_frames.py        # 从视频抽帧
├── make_dataset_split.py    # train/val/test 划分
├── train_yolo_seg.py        # YOLO-Seg 训练
├── infer_video.py           # 单视频推理 + 周期估计
├── angle_utils.py           # PCA角度提取、平滑、插值
├── period_estimator.py      # 三种周期估计方法
├── visualize.py             # 图表与报告生成
├── run_pipeline.py          # 一键处理多视频
├── data/
│   ├── videos/              # 放入四个 .mp4
│   ├── images/              # 划分后的图像 (train/val/test)
│   ├── labels/              # 划分后的标签
│   └── torsion_rod_seg.yaml # YOLO 数据集配置
├── outputs/                 # 推理输出
└── weights/                 # 放入训练好的 best.pt
```

---

## 环境安装

```bash
pip install ultralytics opencv-python numpy scipy matplotlib pandas
```

> 如无 GPU，训练时在 `train_yolo_seg.py` 中设置 `--device cpu`，速度较慢（建议至少 4 核 CPU）。

---

## 完整使用流程

### 第一步：准备视频

将四个视频放入 `data/videos/`：

```
data/videos/扭摆法测量角度.mp4
data/videos/扭摆法测量实际演示.mp4
data/videos/扭摆法测量实际演示2.mp4
data/videos/扭摆法测量实际演示3.mp4
```

### 第二步：抽帧

```bash
python extract_frames.py --videos data/videos --interval 5 --out data/images_raw
```

每个视频每隔 5 帧抽一张，每视频至少 100 张。输出到 `data/images_raw/<video_stem>/`。

### 第三步：人工标注（YOLO-Seg 格式）

推荐工具：[Labelme](https://github.com/wkentaro/labelme)、[CVAT](https://cvat.ai/)、[Roboflow](https://roboflow.com/)

**标注规范：**

- 类别只有一个：`rod`（类别 ID = 0）
- 标注对象：杆子可见区域的多边形轮廓
- **不要**标注底座、转轴、圆盘、桌面、刻度盘

**各视频标注注意事项：**

| 视频 | 注意点 |
|------|--------|
| 扭摆法测量角度.mp4 | 标注红色线段区域；背景椭圆盘不要标注 |
| 扭摆法测量实际演示.mp4 | 标注银色细杆的可见部分；杆子超出画面时只标可见段；黑色三角底盘不标 |
| 扭摆法测量实际演示2.mp4 | 标注竖直/接近竖直的银色杆；增强不同方向的训练数据 |
| 扭摆法测量实际演示3.mp4 | 杆子被圆盘遮挡时只标可见杆段；增强遮挡鲁棒性 |

**标签格式（YOLO-Seg polygon）：**

```
0 x1 y1 x2 y2 x3 y3 ...
```

所有坐标归一化到 [0, 1]，至少 4 个多边形顶点。

将标注结果保存到 `data/labels_raw/<video_stem>/<frame>.txt`，与图像文件同名。

**建议标注数量：** 每视频 100～200 张，总计 400～800 张。

### 第四步：数据集划分

```bash
python make_dataset_split.py \
    --images data/images_raw \
    --labels data/labels_raw \
    --out_images data/images \
    --out_labels data/labels \
    --ratio 0.7 0.2 0.1
```

划分后每个视频的数据都出现在 train/val/test 中，避免单视角过拟合。

### 第五步：训练 YOLO-Seg

```bash
# GPU 训练（推荐）
python train_yolo_seg.py --weights yolo11n-seg.pt --epochs 100 --device 0

# CPU 训练（慢）
python train_yolo_seg.py --weights yolo11n-seg.pt --epochs 100 --device cpu
```

训练完成后，最优权重位于：
```
runs/torsion_rod_seg/yolo_seg_rod/weights/best.pt
```

将其复制到 `weights/best.pt`：
```bash
cp runs/torsion_rod_seg/yolo_seg_rod/weights/best.pt weights/best.pt
```

### 第六步：推理并计算周期（一键处理全部视频）

```bash
python run_pipeline.py \
    --weights weights/best.pt \
    --videos "data/videos/扭摆法测量角度.mp4" \
             "data/videos/扭摆法测量实际演示.mp4" \
             "data/videos/扭摆法测量实际演示2.mp4" \
             "data/videos/扭摆法测量实际演示3.mp4" \
    --output outputs
```

或处理整个目录：
```bash
python run_pipeline.py --weights weights/best.pt --video_dir data/videos --output outputs
```

---

## 输出说明

每个视频生成独立子目录：

```
outputs/
├── 扭摆法测量实际演示/
│   ├── detection_overlay.mp4   # 叠加 mask + 方向线的检测视频
│   ├── angle_series.csv        # 每帧角度数据
│   ├── angle_period_plot.png   # 角度—时间曲线（含周期标注）
│   └── report.md               # 文字报告（可直接用于实验报告）
├── 扭摆法测量实际演示2/
│   └── ...
└── summary.json                # 所有视频结果汇总
```

**CSV 字段说明：**

| 字段 | 说明 |
|------|------|
| frame_id | 帧编号 |
| time | 时间戳 (s) |
| theta_raw | PCA 原始角度 (rad)，范围 (-π/2, π/2] |
| theta_unwrapped | 连续化角度 (rad) |
| theta_smooth | Savitzky-Golay 平滑角度 (rad) |
| confidence | YOLO 检测置信度 |
| mask_area | 检测 mask 面积（像素数） |
| valid | 该帧检测是否成功 |

---

## 周期估计方法

| 方法 | 说明 | 适用场景 |
|------|------|----------|
| 同向过零法（默认） | 找平滑曲线同向过零点，差值为周期 | 信噪比好、振幅稳定 |
| 峰值法 | 找局部极大值，差值为周期 | 振幅较大、峰值明显 |
| 阻尼正弦拟合 | 拟合 θ(t)=θ₀+A·e^(-λt)·cos(2πt/T+φ) | 需要参考值；作为校验 |

---

## 鲁棒性设计

- **角度 180° 等价性**：使用 `unwrap(2θ)/2` 而非直接 `unwrap(θ)`，避免杆子对称导致的周期估计错误
- **短暂遮挡**：连续失败帧数 ≤ `max_gap_frames` 时线性插值补全
- **mask 面积过滤**：`mask_area < min_mask_area` 的帧标记为无效，不参与周期计算
- **竖屏/横屏自适应**：所有计算基于像素坐标，不假设固定分辨率
- **拟合失败保护**：阻尼正弦拟合失败时自动退回过零法或峰值法

---

## 单独运行各模块

```bash
# 只抽帧
python extract_frames.py --videos data/videos/扭摆法测量实际演示.mp4 --out data/images_raw

# 只推理单个视频
python infer_video.py --video data/videos/扭摆法测量实际演示.mp4 --weights weights/best.pt

# 只做数据集划分
python make_dataset_split.py
```
