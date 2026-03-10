from __future__ import annotations

import html
import json
import os
import re
import threading
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.phet_ui_overrides import SIM_UI_OVERRIDES as DETAILED_SIM_UI_OVERRIDES


PHET_BASE_URL = "https://phet.colorado.edu"
PHET_METADATA_URL = PHET_BASE_URL + "/services/metadata/1.3/simulations?format=json&locale={locale}"
PHYSICS_CATEGORY_ID = "4"
DEFAULT_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60
CATALOG_SCHEMA_VERSION = 5
UI_PROFILE_VERSION = "2026.03.deep-2"
FETCH_WORKERS = 8

TOPIC_SPECS = [
    {
        "category_id": "5",
        "topic_key": "motion",
        "topic_label_zh": "运动与力学",
        "topic_label_en": "Motion & Mechanics",
        "observation_points": [
            "先辨认输入变量、运动状态量与结果显示区之间的对应关系，再逐步做单变量控制。",
            "连续改变位置、速度、受力、角度或质量等参数，比较图像与现象是否同步变化。",
            "重点记录阈值点、平衡点、极值点以及周期变化前后的差异。",
        ],
        "suggested_questions": [
            "这个实验里最值得先固定和先改变的变量分别是什么？",
            "哪些参数变化最容易导致运动状态或受力关系发生明显转折？",
            "如何把当前现象和相应的力学模型、图像或方程联系起来？",
        ],
        "research_focus_zh": "适合做参数控制、轨迹分析与动力学解释",
    },
    {
        "category_id": "6",
        "topic_key": "sound-and-waves",
        "topic_label_zh": "波动与振动",
        "topic_label_en": "Waves & Oscillation",
        "observation_points": [
            "优先辨认频率、振幅、相位、波长或张力等控制量分别对应哪一类图像变化。",
            "同时观察时间域波形、空间分布和统计读数，避免只看动画不看量化结果。",
            "重点比较共振、干涉、驻波与传播速度变化出现的条件。",
        ],
        "suggested_questions": [
            "当前界面里哪几个参数最直接影响波形与能量分布？",
            "什么条件下会出现最明显的干涉、驻波或共振现象？",
            "怎样把当前仿真结果与波动方程或实验课中的测量量对应起来？",
        ],
        "research_focus_zh": "适合做波形分析、相位比较与振动过程解释",
    },
    {
        "category_id": "7",
        "topic_key": "work-energy-and-power",
        "topic_label_zh": "功、能量与功率",
        "topic_label_en": "Work, Energy & Power",
        "observation_points": [
            "优先跟踪能量条、功率读数和状态变化图，确认能量流向与守恒关系。",
            "改变外力、摩擦、输入功率或热交换条件时，比较各类能量项的增减。",
            "重点检查图像变化是否能解释做功、转化效率与能量损耗。",
        ],
        "suggested_questions": [
            "当前实验最适合观察哪几类能量项之间的转化？",
            "哪些操作会改变功率或能量损耗，而哪些操作只改变分配方式？",
            "如何用守恒关系解释当前界面中的图像、读数和动态现象？",
        ],
        "research_focus_zh": "适合做能量转化、守恒与效率分析",
    },
    {
        "category_id": "8",
        "topic_key": "heat-and-thermodynamics",
        "topic_label_zh": "热学与统计现象",
        "topic_label_en": "Heat & Statistical Phenomena",
        "observation_points": [
            "先确定温度、压力、体积、粒子状态或能量势阱等关键量各自对应的显示区域。",
            "逐步改变粒子数、温度、碰撞、势能或相互作用参数，比较系统状态转移路径。",
            "重点分析宏观现象与微观粒子运动或统计分布是否一致。",
        ],
        "suggested_questions": [
            "当前仿真中哪些变量最能体现统计规律或热平衡过程？",
            "哪类控制会改变粒子分布、势能曲线或相变边界？",
            "怎样把界面上的图像和热学、统计物理中的概念联系起来？",
        ],
        "research_focus_zh": "适合做状态变化、统计分布与相互作用分析",
    },
    {
        "category_id": "9",
        "topic_key": "quantum-phenomena",
        "topic_label_zh": "量子现象",
        "topic_label_en": "Quantum Phenomena",
        "observation_points": [
            "优先辨认状态准备区、测量区、统计结果区之间的关系，避免把准备态和测量结果混为一谈。",
            "比较经典模型与量子模型在概率分布、测量后状态与统计波动上的差异。",
            "重点关注单次测量结果与多次统计结果之间的联系。",
        ],
        "suggested_questions": [
            "当前界面中状态准备、测量执行和统计展示分别在什么位置？",
            "哪些现象体现了叠加、测量更新或经典/量子差异？",
            "怎样把当前结果用更清晰的物理语言解释给初学者？",
        ],
        "research_focus_zh": "适合做状态准备、测量解释与概率分布分析",
    },
    {
        "category_id": "10",
        "topic_key": "light-and-radiation",
        "topic_label_zh": "光学与辐射",
        "topic_label_en": "Light & Radiation",
        "observation_points": [
            "先辨认光源、介质、透镜/镜面、像屏与读数区的位置关系，再观察光路变化。",
            "改变波长、焦距、介质、位置或几何参数时，比较像的位置、大小、亮度和方向变化。",
            "重点验证折射、反射、成像或辐射谱线的关键规律。",
        ],
        "suggested_questions": [
            "这个实验里哪几个参数最直接决定光路或成像结果？",
            "哪些界面读数最适合验证折射、反射、成像或谱线规律？",
            "怎样把当前现象和几何光学或辐射模型联系起来？",
        ],
        "research_focus_zh": "适合做光路分析、成像比较与谱线解释",
    },
    {
        "category_id": "11",
        "topic_key": "electricity-magnets-and-circuits",
        "topic_label_zh": "电磁与电路",
        "topic_label_en": "Electricity, Magnetism & Circuits",
        "observation_points": [
            "优先辨认器件区、搭建区、仪表区和场量显示区之间的关系。",
            "改变元件参数、连接方式、磁场或电荷分布后，比较电流、电压、场线与读数变化。",
            "重点分析稳态与瞬态、串并联结构以及场量分布的区别。",
        ],
        "suggested_questions": [
            "当前实验中最关键的元件参数和观测量分别是什么？",
            "哪些操作会显著改变电流、电压、场线或能量分布？",
            "怎样利用当前界面验证电路规律或电磁学关系？",
        ],
        "research_focus_zh": "适合做电路搭建、仪表读数与场量分析",
    },
]

TITLE_TRANSLATIONS = {
    "gravity-force-lab": "引力实验室",
    "forces-and-motion-basics": "力与运动基础",
    "pendulum-lab": "单摆实验",
    "build-an-atom": "构建原子",
    "under-pressure": "压强作用",
    "my-solar-system": "我的太阳系",
    "density": "密度",
    "balancing-act": "平衡探究",
    "keplers-laws": "开普勒定律",
    "gravity-force-lab-basics": "引力实验基础",
    "projectile-data-lab": "抛体数据实验",
    "projectile-motion": "抛体运动",
    "friction": "摩擦",
    "curve-fitting": "曲线拟合",
    "build-a-nucleus": "构建原子核",
    "buoyancy": "浮力",
    "buoyancy-basics": "浮力基础",
    "vector-addition": "矢量相加",
    "collision-lab": "碰撞实验",
    "calculus-grapher": "微积分绘图器",
    "hookes-law": "胡克定律",
    "energy-skate-park": "能量滑板公园",
    "energy-skate-park-basics": "能量滑板公园基础",
    "masses-and-springs-basics": "质量与弹簧基础",
    "masses-and-springs": "质量与弹簧",
    "gravity-and-orbits": "引力与轨道",
    "quantum-coin-toss": "量子抛硬币",
    "fourier-making-waves": "傅里叶合成波形",
    "wave-interference": "波的干涉",
    "waves-intro": "波动入门",
    "wave-on-a-string": "弦上的波",
    "generator": "发电机",
    "gas-properties": "气体性质",
    "faradays-electromagnetic-lab": "法拉第电磁实验",
    "energy-forms-and-changes": "能量形式与转化",
    "plinko-probability": "概率板实验",
    "atomic-interactions": "原子相互作用",
    "diffusion": "扩散",
    "gases-intro": "气体入门",
    "states-of-matter": "物态变化",
    "states-of-matter-basics": "物态变化基础",
    "rutherford-scattering": "卢瑟福散射",
    "models-of-the-hydrogen-atom": "氢原子模型",
    "quantum-measurement": "量子测量",
    "blackbody-spectrum": "黑体光谱",
    "bending-light": "光的折射",
    "color-vision": "颜色视觉",
    "geometric-optics": "几何光学",
    "geometric-optics-basics": "几何光学基础",
    "molecules-and-light": "分子与光",
    "circuit-construction-kit-ac": "交流电路搭建",
    "circuit-construction-kit-ac-virtual-lab": "交流电路搭建虚拟实验室",
    "coulombs-law": "库仑定律",
    "balloons-and-static-electricity": "气球与静电",
    "faradays-law": "法拉第定律",
    "capacitor-lab-basics": "电容实验基础",
    "resistance-in-a-wire": "导线中的电阻",
    "charges-and-fields": "电荷与电场",
    "circuit-construction-kit-dc": "直流电路搭建",
    "circuit-construction-kit-dc-virtual-lab": "直流电路搭建虚拟实验室",
    "magnet-and-compass": "磁铁与指南针",
    "magnets-and-electromagnets": "磁铁与电磁铁",
    "ohms-law": "欧姆定律",
    "john-travoltage": "静电放电实验",
}

WORD_TRANSLATIONS = {
    "basics": "基础",
    "basic": "基础",
    "lab": "实验",
    "virtual": "虚拟",
    "motion": "运动",
    "forces": "力",
    "force": "力",
    "energy": "能量",
    "light": "光",
    "waves": "波",
    "wave": "波",
    "sound": "声",
    "gas": "气体",
    "states": "状态",
    "matter": "物态",
    "quantum": "量子",
    "measurement": "测量",
    "atom": "原子",
    "hydrogen": "氢",
    "circuit": "电路",
    "construction": "搭建",
    "kit": "套件",
    "current": "电流",
    "voltage": "电压",
    "optics": "光学",
    "geometric": "几何",
}

CONTROL_LIBRARY = [
    ("reset all", "重置", "Reset All", "用于回到初始状态，便于重新组织变量控制顺序。"),
    ("reset", "重置", "Reset", "用于撤回当前设置，重新开始一轮参数比较。"),
    ("play", "开始播放", "Play", "用于驱动时间演化或连续测量过程。"),
    ("pause", "暂停", "Pause", "用于冻结当前状态，便于逐项读取参数与图像。"),
    ("measure", "测量", "Measure", "用于执行一次观测、采样或读数获取。"),
    ("graph", "图像区", "Graph", "用于观察变量随时间或参数变化的趋势。"),
    ("histogram", "统计直方图", "Histogram", "用于比较多次试验后的结果分布。"),
    ("screen", "像屏或显示区", "Screen", "用于观察成像位置、亮度或实验结果投影。"),
    ("lens", "透镜", "Lens", "用于改变会聚或发散条件，观察成像与光路变化。"),
    ("mirror", "镜面", "Mirror", "用于改变反射路径并比较像的位置与方向。"),
    ("object", "物体", "Object", "用于设置实验对象的位置、大小或状态。"),
    ("image", "像", "Image", "用于判断像的位置、倒正、大小与清晰度。"),
    ("battery", "电池", "Battery", "用于提供电源并影响电路中的电势差。"),
    ("bulb", "灯泡", "Bulb", "用于观察电流变化带来的发光与功率差异。"),
    ("resistor", "电阻器", "Resistor", "用于改变回路电阻并比较电流、电压变化。"),
    ("switch", "开关", "Switch", "用于控制回路通断或切换实验状态。"),
    ("ammeter", "电流表", "Ammeter", "用于读取支路或主回路电流。"),
    ("voltmeter", "电压表", "Voltmeter", "用于比较元件两端电势差。"),
    ("capacitor", "电容器", "Capacitor", "用于观察储能、充放电或电压变化。"),
    ("charge", "电荷", "Charge", "用于改变电荷分布并比较场量变化。"),
    ("field", "场量显示", "Field", "用于观察电场、磁场或势能分布。"),
    ("magnet", "磁铁", "Magnet", "用于改变磁场方向和强度。"),
    ("compass", "指南针", "Compass", "用于读取局部磁场方向。"),
    ("spring", "弹簧", "Spring", "用于观察弹性恢复力与振动过程。"),
    ("mass", "质量块", "Mass", "用于改变惯性或重力效应。"),
    ("friction", "摩擦", "Friction", "用于比较耗散引起的运动与能量变化。"),
    ("position", "位置", "Position", "用于控制或读取物体所在位置。"),
    ("velocity", "速度", "Velocity", "用于比较运动快慢和方向变化。"),
    ("acceleration", "加速度", "Acceleration", "用于识别受力变化对应的运动响应。"),
    ("wavelength", "波长", "Wavelength", "用于改变颜色、干涉或传播特征。"),
    ("frequency", "频率", "Frequency", "用于改变振动节奏和周期现象。"),
    ("amplitude", "振幅", "Amplitude", "用于比较振动强弱和能量变化。"),
    ("probability", "概率显示", "Probability", "用于比较状态分布和测量结果。"),
    ("state", "状态选择", "State", "用于准备实验初态并比较不同状态下的结果。"),
]

READOUT_LIBRARY = [
    ("graph", "图像区用于展示变量变化趋势，适合读取斜率、周期或峰值位置。"),
    ("histogram", "统计直方图用于比较多次试验后的频数分布与概率差异。"),
    ("number display", "数值读数区用于精确记录关键物理量。"),
    ("display", "显示区用于同步呈现实验动画、图像与数值结果。"),
    ("current", "电流读数可用于比较不同支路、不同元件条件下的导电情况。"),
    ("voltage", "电压读数可用于判断电势差如何随器件和连接方式变化。"),
    ("energy", "能量显示可用于跟踪能量转化、守恒与损耗。"),
    ("image", "成像区可用于判断像的位置、大小、正倒和清晰度。"),
    ("screen", "像屏或结果显示区可用于读取投影位置、亮度或图样。"),
]

SIM_UI_OVERRIDES: dict[str, dict[str, Any]] = {
    "quantum-coin-toss": {
        "layout_zh": "该实验通常先出现主场景选择，再进入量子硬币或经典硬币的准备与测量界面。核心区域可分为状态准备区、测量执行区和统计结果区。",
        "screen_flow_zh": [
            "进入实验后，先在首页辨认可进入的硬币情境或统计场景，再进入具体实验界面。",
            "进入准备区后，先确定当前选择的是经典偏置硬币还是量子硬币，并观察初态是如何被设定的。",
            "完成状态准备后，再执行测量或重复投掷，重点比较单次结果与多次统计分布之间的联系。",
        ],
        "controls_zh": [
            "状态选择用于准备不同的初态，并决定后续测量分布的起点。",
            "测量按钮（Measure）用于执行一次观测，适合比较测量前后的状态更新。",
            "统计图或结果区（Histogram / Graph）用于比较经典偏置与量子叠加在多次测量中的差异。",
        ],
        "effects_zh": [
            "当初态改变时，单次测量结果虽然仍具有随机性，但长期统计分布会发生系统变化。",
            "量子硬币与经典偏置硬币在统计上都能出现偏向结果，但状态准备和测量解释不同。",
            "重复测量次数增加后，分布特征会更稳定，更适合讨论概率解释。",
        ],
        "readouts_zh": [
            "重点读取统计结果区的频数分布、概率变化和单次测量输出。",
        ],
        "terms_zh": [
            "测量（Measure）用于触发一次观测并查看结果更新。",
            "统计图（Histogram）用于比较多次试验后的频数分布。",
            "状态（State）用于表示当前准备的量子或经典初态。",
        ],
        "needs_manual_review": False,
    },
    "quantum-measurement": {
        "layout_zh": "该实验围绕状态准备、测量基选择和统计结果展示展开，界面通常包含准备区、测量区和结果区。",
        "screen_flow_zh": [
            "先在状态准备区确认系统的初始态，再进入测量设置区选择测量方向或测量基。",
            "完成设置后执行测量，比较单次结果、重复测量结果与状态更新之间的关系。",
            "切换不同测量设置时，重点观察概率分布和测量后状态如何改变。",
        ],
        "controls_zh": [
            "状态准备控件用于设置初始态，并决定后续测量的比较基础。",
            "测量设置用于选择观测方向或观测基，适合讨论不相容观测的差异。",
            "测量按钮（Measure）用于执行观测并生成统计结果。",
        ],
        "needs_manual_review": False,
    },
    "models-of-the-hydrogen-atom": {
        "layout_zh": "该实验通常包含模型切换区、辐射或谱线显示区以及电子状态演示区，适合比较不同原子模型的解释能力。",
        "screen_flow_zh": [
            "先在模型切换区依次选择不同氢原子模型，比较每个模型对实验现象的解释方式。",
            "进入每个模型后，重点观察电子状态、能级变化和辐射结果如何被表示。",
            "再对照谱线或观测结果区，判断当前模型能否解释实验现象以及解释到什么程度。",
        ],
        "controls_zh": [
            "模型选择用于在经典模型和量子模型之间切换，适合比较解释差异。",
            "辐射或能级相关控件用于观察跃迁、吸收和发射过程。",
            "谱线或显示区用于核对模型预测和实验现象是否一致。",
        ],
        "needs_manual_review": False,
    },
    "circuit-construction-kit-dc-virtual-lab": {
        "layout_zh": "该实验通常由器件工具箱、中央搭建区和右侧或下方仪表读数区组成，并可在实物视图与电路图视图之间切换。",
        "screen_flow_zh": [
            "进入实验后先在器件区选择电池、灯泡、电阻、导线和开关，再拖入中央搭建区完成回路连接。",
            "完成基本回路后，切换到仪表操作阶段，把电流表和电压表放到需要测量的位置，比较不同接法的读数差异。",
            "当需要从结构上分析回路时，可切换到电路图或示意图视图，再比较它与实物视图的一一对应关系。",
        ],
        "controls_zh": [
            "器件工具箱用于拖入电池、电阻、灯泡、开关等元件，直接决定回路结构。",
            "电流表（Ammeter）用于比较各支路或主回路的电流大小。",
            "电压表（Voltmeter）用于读取元件两端电势差，适合验证串并联规律。",
            "视图切换用于在实物搭建与电路图之间来回对照，帮助建立结构理解。",
        ],
        "effects_zh": [
            "当串并联结构改变时，灯泡亮度、电流分配和电压读数会同步变化。",
            "改变电阻、灯泡特性或电池数量后，回路总电流和局部读数会出现明显差异。",
            "错误接入仪表会改变回路结构，因此测量前应先辨认仪表应串联还是并联。",
        ],
        "readouts_zh": [
            "重点读取灯泡亮度、电流表、电压表以及不同视图中的连接关系。",
        ],
        "terms_zh": [
            "电流表（Ammeter）用于测量串联位置的电流。",
            "电压表（Voltmeter）用于比较元件两端的电压。",
            "电路图（Schematic）用于从结构上分析回路连接关系。",
        ],
        "needs_manual_review": False,
    },
    "circuit-construction-kit-dc": {
        "layout_zh": "该实验以器件拖拽搭建为主，界面通常包括器件区、回路搭建区和仪表读数区。",
        "screen_flow_zh": [
            "先在器件区选择所需元件并完成回路闭合，再观察灯泡、仪表和导线中的变化。",
            "随后加入电流表和电压表，对比不同连接方式下的读数差异。",
            "最后切换不同视图，比较实物连接和电路图表达之间的对应关系。",
        ],
        "needs_manual_review": False,
    },
    "circuit-construction-kit-ac-virtual-lab": {
        "layout_zh": "该实验在器件搭建基础上加入交流电源与周期性响应观察，核心由器件区、搭建区和读数区组成。",
        "screen_flow_zh": [
            "先完成基本回路搭建，再重点观察交流源驱动下各元件响应的周期变化。",
            "随后使用测量工具比较不同频率、不同元件组合下的电流和电压表现。",
            "必要时切换视图，比较示意图与实物响应的一致性。",
        ],
        "needs_manual_review": False,
    },
    "circuit-construction-kit-ac": {
        "screen_flow_zh": [
            "先搭建交流回路，再观察不同元件组合下的周期响应。",
            "加入测量工具后重点比较相对变化、峰值变化和电路结构变化的影响。",
        ],
        "needs_manual_review": False,
    },
    "geometric-optics-basics": {
        "layout_zh": "该实验通常围绕光源或物体、透镜/镜面、光线和像屏展开，界面核心是中央光路区与周边参数控制区。",
        "screen_flow_zh": [
            "进入实验后先辨认当前是透镜场景还是镜面场景，再确认物体、光学元件和像屏的位置关系。",
            "随后调节焦距、物距、屏幕位置或口径，比较主光线和像的位置如何变化。",
            "当像变清晰、倒正改变或像消失时，应及时回看光线路径和几何关系，判断原因来自哪一个参数变化。",
        ],
        "controls_zh": [
            "物体位置用于决定入射光线的初始条件，是分析成像位置的起点。",
            "焦距或光学元件参数用于改变会聚、发散或反射特征。",
            "像屏（Screen）用于验证像是否真实成于某一位置，并比较清晰度和亮度变化。",
        ],
        "effects_zh": [
            "物距和焦距变化会同步影响像距、放大率、倒正关系和清晰度。",
            "当物体跨过关键位置时，像的位置与性质会出现明显转折。",
            "若屏幕没有放在合适位置，即使成像规律成立，也可能看不到清晰实像。",
        ],
        "needs_manual_review": False,
    },
    "geometric-optics": {
        "screen_flow_zh": [
            "先选择当前使用的光学元件类型，再辨认物体、透镜或镜面以及像屏的位置关系。",
            "随后逐步调节物距、焦距、口径或屏幕位置，比较光路和成像变化。",
            "最后结合读数和光线图判断当前像的性质与形成原因。",
        ],
        "needs_manual_review": False,
    },
    "wave-interference": {
        "layout_zh": "该实验通常包含场景切换、波源控制区和波形显示区，适合比较不同介质和波源条件下的干涉现象。",
        "screen_flow_zh": [
            "先选择需要观察的场景或介质，再辨认波源位置、相位设置和显示方式。",
            "随后调节频率、振幅、相位差或波源数量，观察干涉条纹或波形叠加如何变化。",
            "当出现节点、腹部或明显干涉结构时，应同步读取图像区和参数区，判断形成条件。",
        ],
        "needs_manual_review": False,
    },
    "wave-on-a-string": {
        "layout_zh": "该实验围绕绳上的波动传播展开，界面通常包含驱动区、绳形显示区和参数控制区。",
        "screen_flow_zh": [
            "先辨认当前是脉冲、连续驱动还是手动驱动模式，再观察绳形显示区的响应。",
            "随后调节频率、振幅、张力和阻尼，比较传播速度、反射和驻波结构变化。",
            "当需要精确比较节点、腹部或相位时，应先暂停，再读取绳形与图像。",
        ],
        "needs_manual_review": False,
    },
    "energy-skate-park": {
        "layout_zh": "该实验一般由轨道区、滑块运动区和能量条/图像区组成，适合比较动能、势能和热能的转化。",
        "screen_flow_zh": [
            "先在轨道或场景区确定滑块的起始位置，再辨认能量条和图像显示区。",
            "随后调节轨道形状、摩擦或起始高度，比较速度变化与能量分配变化。",
            "当需要解释某一时刻的运动状态时，应同时读取位置、速度和能量条，避免只看动画。",
        ],
        "needs_manual_review": False,
    },
    "energy-skate-park-basics": {
        "screen_flow_zh": [
            "先确定滑块初始位置和轨道结构，再进入能量比较阶段。",
            "随后改变高度、摩擦或轨道形状，比较动能、势能和热能的变化。",
        ],
        "needs_manual_review": False,
    },
    "atomic-interactions": {
        "layout_zh": "该实验通常围绕粒子间距、势能曲线和相互作用强弱展开，界面包含粒子显示区、距离控制区和势能图像区。",
        "screen_flow_zh": [
            "先辨认粒子显示区和势能曲线区，再观察距离调节与势能变化的对应关系。",
            "随后改变粒子间距或相互作用相关参数，比较吸引区、排斥区和稳定平衡点的位置。",
            "当系统接近平衡点或越过势阱边界时，应重点读取势能曲线和粒子运动方向。",
        ],
        "needs_manual_review": False,
    },
}

TOPIC_SPECS_BY_CATEGORY = {item["category_id"]: item for item in TOPIC_SPECS}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw).replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    lines = [" ".join(line.split()) for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def absolute_url(path: str | None) -> str:
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{PHET_BASE_URL}{path}"


def has_html_run(localized: dict[str, Any] | None) -> bool:
    if not isinstance(localized, dict):
        return False
    run_url = str(localized.get("runUrl") or "")
    return run_url.startswith("/sims/html/")


def choose_embed_url(en_localized: dict[str, Any], zh_localized: dict[str, Any] | None, all_locales_url: str | None) -> str:
    if has_html_run(zh_localized):
        return absolute_url(str(zh_localized.get("runUrl") or ""))
    if isinstance(all_locales_url, str) and all_locales_url.startswith("/sims/html/"):
        return absolute_url(all_locales_url)
    return absolute_url(str(en_localized.get("runUrl") or ""))


def choose_analysis_url(en_localized: dict[str, Any], all_locales_url: str | None) -> str:
    if isinstance(all_locales_url, str) and all_locales_url.startswith("/sims/html/"):
        return absolute_url(all_locales_url)
    run_url = str(en_localized.get("runUrl") or "")
    if run_url.endswith("_en.html"):
        return absolute_url(run_url.replace("_en.html", "_all.html"))
    return absolute_url(run_url)


def contains_english_words(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]{2,}", text or ""))


def needs_generated_chinese(text: str, *, min_chinese_chars: int = 10) -> bool:
    if not text:
        return True
    english_words = re.findall(r"[A-Za-z]{3,}", text)
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", text)
    return len(english_words) >= 3 and len(chinese_chars) < min_chinese_chars


def translate_title_fallback(title_en: str, slug: str) -> str:
    if slug in TITLE_TRANSLATIONS:
        return TITLE_TRANSLATIONS[slug]
    clean = title_en.strip()
    if not clean:
        return "课外仿真实验"
    translated_tokens: list[str] = []
    for token in re.split(r"([ :&()\-])", clean):
        token_lower = token.lower()
        translated_tokens.append(WORD_TRANSLATIONS.get(token_lower, token))
    translated = "".join(translated_tokens)
    translated = re.sub(r"\s+", " ", translated).strip(" -:()")
    translated = re.sub(r"[A-Za-z]{3,}", "", translated).strip(" -:()")
    return translated or "课外仿真实验"


def build_generated_intro(title_zh: str, topic_label_zh: str) -> str:
    return (
        f"{title_zh}属于{topic_label_zh}方向的可交互仿真实验，适合通过变量控制与现象对照来建立物理图景。"
        "建议先辨认界面中的控制区、图像区和读数区，再做单变量调节，比较参数变化前后的趋势、临界点和稳定状态。"
        "在解释现象时，应把界面读数、图像反馈和物理规律放在同一条分析链条中。"
    )


def build_generated_goals(topic_label_zh: str) -> str:
    return (
        f"通过该{topic_label_zh}实验，识别关键控制量和观测量之间的关系，"
        "能够依据界面现象解释参数变化的物理意义，并将仿真结果与课堂模型、图像和公式对应起来。"
    )


def pick_topic_spec(sim_id: int, metadata: dict[str, Any]) -> dict[str, Any]:
    categories = metadata.get("categories", {})
    for spec in TOPIC_SPECS:
        category = categories.get(spec["category_id"], {})
        simulation_ids = {int(value) for value in category.get("simulationIds", [])}
        if sim_id in simulation_ids:
            return spec
    return TOPIC_SPECS[0]


def build_topic_layout(topic_key: str) -> str:
    mapping = {
        "motion": "界面通常由运动场景区、参数调节区和图像或读数区组成，适合同步比较现象、图像和数值。",
        "sound-and-waves": "界面通常包含波源或驱动区、主显示区以及图像或读数区，适合比较波形、相位和传播效果。",
        "work-energy-and-power": "界面通常包含主场景区、能量或功率显示区以及参数调节区，适合同时跟踪状态变化和能量流向。",
        "heat-and-thermodynamics": "界面通常包含粒子或系统状态区、参数控制区以及图像/统计显示区，适合同时做宏观和微观解释。",
        "quantum-phenomena": "界面通常由状态准备区、测量区和统计结果区组成，适合区分初态、测量操作与结果分布。",
        "light-and-radiation": "界面通常包含光路展示区、几何参数控制区和成像/谱线显示区，适合同时分析结构和结果。",
        "electricity-magnets-and-circuits": "界面通常包含器件区、实验搭建区和仪表/场量显示区，适合在结构与读数之间来回对应。",
    }
    return mapping.get(topic_key, "界面一般由实验场景、参数控制和结果显示三部分组成。")


def build_research_focus(topic_key: str) -> str:
    return {
        "motion": "适合做参数控制、轨迹分析与动力学解释",
        "sound-and-waves": "适合做波形分析、相位比较与振动过程解释",
        "work-energy-and-power": "适合做能量转化、守恒与效率分析",
        "heat-and-thermodynamics": "适合做状态变化、统计分布与相互作用分析",
        "quantum-phenomena": "适合做状态准备、测量解释与概率分布分析",
        "light-and-radiation": "适合做光路分析、成像比较与谱线解释",
        "electricity-magnets-and-circuits": "适合做电路搭建、仪表读数与场量分析",
    }.get(topic_key, "适合做参数分析与现象观察")


def fetch_url_text(url: str) -> str:
    if not url:
        return ""
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "PhysicsAgent/1.0", "Accept": "text/html,application/json;q=0.9,*/*;q=0.8"},
        method="GET",
    )
    for _ in range(2):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", errors="ignore")
        except (urllib.error.HTTPError, urllib.error.URLError):
            continue
    return ""


def is_ui_phrase(text: str) -> bool:
    candidate = " ".join(text.split())
    if len(candidate) < 3 or len(candidate) > 64:
        return False
    if not re.search(r"[A-Za-z]", candidate):
        return False
    if re.search(r"https?://|[{}<>]|\\.js$|\\.json$|\\.png$|\\.svg$", candidate, flags=re.IGNORECASE):
        return False
    if "/" in candidate and candidate.count("/") > 1:
        return False
    if re.search(r"[a-z][A-Z][a-z]", candidate) and " " not in candidate:
        return False
    if re.search(r"(Property|Node|Model|ScreenView|IO|prototype|PhET-iO|DisplayGlobals|Boolean Number String)", candidate):
        return False
    if candidate.isupper() and len(candidate) > 6:
        return False
    return True


def extract_ui_phrases(raw_html: str) -> list[str]:
    if not raw_html:
        return []
    matches: list[str] = []
    patterns = [
        r'"([^"\n\\]{3,64})"',
        r"'([^'\n\\]{3,64})'",
        r'aria-label="([^"]{3,64})"',
        r'content="([^"]{3,64})"',
    ]
    for pattern in patterns:
        matches.extend(re.findall(pattern, raw_html))
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in matches:
        candidate = html.unescape(" ".join(item.split())).strip()
        if not is_ui_phrase(candidate):
            continue
        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(candidate)
    return cleaned


def format_interface_term(zh_label: str, en_label: str, has_official_zh: bool) -> str:
    return zh_label if has_official_zh or not en_label else f"{zh_label}（{en_label}）"


def collect_matched_controls(ui_phrases: list[str]) -> list[tuple[str, str, str]]:
    lowered = [item.lower() for item in ui_phrases]
    matched: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    for keyword, zh_label, en_label, effect in CONTROL_LIBRARY:
        if any(keyword in item for item in lowered):
            if zh_label in seen:
                continue
            seen.add(zh_label)
            matched.append((zh_label, en_label, effect))
    return matched


def collect_matched_readouts(ui_phrases: list[str]) -> list[str]:
    lowered = [item.lower() for item in ui_phrases]
    results: list[str] = []
    seen: set[str] = set()
    for keyword, text in READOUT_LIBRARY:
        if any(keyword in item for item in lowered):
            if text in seen:
                continue
            seen.add(text)
            results.append(text)
    return results


def infer_screen_tokens(ui_phrases: list[str]) -> list[str]:
    candidates: list[str] = []
    for item in ui_phrases:
        lower = item.lower()
        if any(token in lower for token in ("screen", "lab", "intro", "basics", "model", "view", "experiment", "measurement", "graph")):
            candidates.append(item)
    results: list[str] = []
    seen: set[str] = set()
    for item in candidates:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        results.append(item)
    return results[:6]


def build_auto_screen_flow(title_zh: str, topic_key: str, screen_tokens: list[str], has_official_zh: bool) -> list[str]:
    if screen_tokens:
        flow: list[str] = []
        first = screen_tokens[0]
        flow.append(
            f"进入实验后先辨认起始场景或主要页面 {format_interface_term(first, first, has_official_zh)}，确认当前讨论的是哪一类实验对象与变量。"
        )
        for token in screen_tokens[1:3]:
            flow.append(
                f"当切换到 {format_interface_term(token, token, has_official_zh)} 后，应重新识别该页面新增的控件、图像与读数，再继续做参数比较。"
            )
        flow.append("完成页面辨认后，再做单变量调节，并把动画现象、图像变化与读数变化放在一起解读。")
        return flow[:4]

    generic = {
        "motion": [
            f"进入 {title_zh} 后先辨认主运动场景、参数调节区和图像或读数区，再开始调节变量。",
            "优先固定多数参数，只改变一个受力、位置、速度或几何量，比较现象是否出现临界变化。",
            "当出现平衡、转折或周期变化时，应及时读取图像和读数区，不只依赖动画观察。",
        ],
        "sound-and-waves": [
            f"进入 {title_zh} 后先确认当前波源或驱动方式，再辨认波形显示区和参数调节区。",
            "随后改变频率、振幅、相位或边界条件，比较干涉、驻波或传播变化。",
            "需要精读某一时刻时可先暂停，再观察图像、节点与读数之间的对应关系。",
        ],
        "work-energy-and-power": [
            f"进入 {title_zh} 后先找到主场景区和能量/功率显示区，再观察参数控制入口。",
            "随后改变高度、摩擦、输入功率或热交换条件，比较不同能量项的变化。",
            "当出现明显转化或损耗时，应同时读取能量条和状态变化，避免只看动画。",
        ],
        "heat-and-thermodynamics": [
            f"进入 {title_zh} 后先辨认粒子或系统状态区，再确认统计图像与参数调节区。",
            "随后改变温度、粒子数、距离或相互作用参数，比较系统状态的变化路径。",
            "当接近平衡点、相变边界或势阱位置时，应重点读取图像和数值变化。",
        ],
        "quantum-phenomena": [
            f"进入 {title_zh} 后先辨认状态准备区、测量区和统计结果区之间的关系。",
            "随后改变初态或测量设置，比较单次结果、重复测量和统计分布差异。",
            "当界面切换到另一类状态或测量页面时，应重新确认当前研究对象和对应控件。",
        ],
        "light-and-radiation": [
            f"进入 {title_zh} 后先确认光源、光学元件、像屏与主显示区的位置关系。",
            "随后逐步改变几何量、焦距、介质或波长，比较光路与成像变化。",
            "当像的位置、大小或亮度突变时，应回看光路和关键参数的变化来源。",
        ],
        "electricity-magnets-and-circuits": [
            f"进入 {title_zh} 后先辨认器件区、搭建区和仪表或场量显示区。",
            "随后先搭建最基本结构，再逐步添加元件和测量工具，比较读数变化。",
            "当切换视图或引入新器件后，应先确认结构变化，再解读电流、电压或场量结果。",
        ],
    }
    return generic.get(topic_key, [f"进入 {title_zh} 后先辨认控制区、主显示区和结果读数区，再开始调节参数。"])


def build_auto_controls(topic_key: str, ui_phrases: list[str], has_official_zh: bool) -> list[str]:
    matched = collect_matched_controls(ui_phrases)
    results = [
        f"{format_interface_term(zh_label, en_label, has_official_zh)}{effect}"
        for zh_label, en_label, effect in matched[:5]
    ]
    topic_defaults = {
        "motion": [
            "位置、速度或受力相关控件用于改变运动初态和动力学条件，应优先做单变量调节。",
            "开始与暂停用于冻结某一瞬时状态，便于结合图像和读数解释运动过程。",
        ],
        "sound-and-waves": [
            "频率、振幅和相位相关控件用于改变波源特征，是观察波形变化的核心入口。",
            "显示方式切换通常用于比较动画、图像和统计结果，应结合使用。",
        ],
        "work-energy-and-power": [
            "能量或功率相关控件用于改变输入、损耗或边界条件，是理解转化过程的关键。",
            "重置用于在完成一轮能量比较后迅速回到初态，重新组织实验顺序。",
        ],
        "heat-and-thermodynamics": [
            "温度、粒子数、距离或相互作用相关控件用于改变系统状态，应与图像区同步对照。",
            "开始与暂停适合用于对比平衡前后或状态转移前后的差异。",
        ],
        "quantum-phenomena": [
            "状态准备控件用于设置初态，测量控件用于执行观测，两者不应混为一谈。",
            "统计结果区应在多次重复后再做结论，避免用单次结果代表整体规律。",
        ],
        "light-and-radiation": [
            "物距、焦距、波长和像屏位置是优先调节的核心变量，直接影响光路与成像结果。",
            "图像显示区和像屏读数应结合使用，避免只凭视觉判断像的性质。",
        ],
        "electricity-magnets-and-circuits": [
            "器件区用于改变回路结构，仪表区用于读取结果，应先确认结构再解读读数。",
            "视图切换常用于比较实物连接和示意图，对排查接线问题很有帮助。",
        ],
    }
    for item in topic_defaults.get(topic_key, []):
        if item not in results:
            results.append(item)
    return results[:6]


def build_auto_effects(topic_key: str) -> list[str]:
    mapping = {
        "motion": [
            "参数变化通常会同步改变轨迹、速度、加速度或平衡状态。",
            "跨过某些临界值后，系统可能从稳定转为失稳，或从静止转为运动。",
            "图像中的斜率、曲率或周期变化往往能直接对应动力学量的变化。",
        ],
        "sound-and-waves": [
            "频率和振幅变化会直接改变波形形态、能量分布和共振响应。",
            "边界条件或相位差改变后，干涉结构和节点位置会明显调整。",
            "暂停后读取图像更适合比较瞬时状态和相位关系。",
        ],
        "work-energy-and-power": [
            "输入条件和耗散条件改变后，能量条或功率读数会出现重新分配。",
            "某些现象变化并不代表总能量不守恒，而是转化路径发生了改变。",
            "同时观察状态动画与能量读数，更容易解释系统为何加速、减速或发热。",
        ],
        "heat-and-thermodynamics": [
            "温度、距离或相互作用变化通常会引起粒子分布、势能曲线和状态边界变化。",
            "系统趋于平衡时，宏观读数和微观图像会逐渐对应起来。",
            "当越过阈值或势阱边界时，现象会出现明显转折。",
        ],
        "quantum-phenomena": [
            "初态和测量设置变化会改变长期统计分布，而不只是单次结果。",
            "测量后的结果应结合状态更新理解，不能只看单步输出。",
            "多次重复后的统计图最适合解释概率规律和经典/量子差异。",
        ],
        "light-and-radiation": [
            "几何参数变化会同步影响像的位置、大小、亮度或方向。",
            "光学元件和介质变化会改变光路，因此应同时比较路径和结果。",
            "像屏位置不合适时，成像规律可能仍成立，但观察结果并不清晰。",
        ],
        "electricity-magnets-and-circuits": [
            "器件参数和连接结构变化会共同决定电流、电压或场量分布。",
            "错误放置仪表或误判串并联关系，往往会导致读数解释偏差。",
            "结构变化、读数变化和发光/受力现象应放在同一条分析链中理解。",
        ],
    }
    return mapping.get(topic_key, ["参数变化会引起现象、图像和读数的同步变化，应结合三者一起分析。"])


def build_auto_readouts(topic_key: str, ui_phrases: list[str]) -> list[str]:
    matched = collect_matched_readouts(ui_phrases)
    defaults = {
        "motion": ["重点读取位置、速度、加速度及其图像变化。"],
        "sound-and-waves": ["重点读取波形、节点位置、频率变化和统计图像。"],
        "work-energy-and-power": ["重点读取能量条、功率读数和状态变化。"],
        "heat-and-thermodynamics": ["重点读取温度、压力、粒子分布或势能图像。"],
        "quantum-phenomena": ["重点读取单次结果、概率显示和多次统计分布。"],
        "light-and-radiation": ["重点读取光路、像屏位置、像的性质和相关读数。"],
        "electricity-magnets-and-circuits": ["重点读取电流、电压、场线以及器件状态变化。"],
    }
    results = matched[:4]
    for item in defaults.get(topic_key, []):
        if item not in results:
            results.append(item)
    return results[:4]


def build_auto_terms(ui_phrases: list[str], topic_key: str, has_official_zh: bool) -> list[str]:
    matched = collect_matched_controls(ui_phrases)
    terms = [
        f"{format_interface_term(zh_label, en_label, has_official_zh)}是当前实验中需要优先辨认的界面术语。"
        for zh_label, en_label, _ in matched[:5]
    ]
    if terms:
        return terms
    defaults = {
        "motion": ["位置、速度、加速度等术语通常对应主显示区中的关键状态量。"],
        "sound-and-waves": ["频率、振幅、相位和波长通常是最重要的界面术语。"],
        "work-energy-and-power": ["能量、功率、热量或做功相关术语通常出现在显示区与图像区。"],
        "heat-and-thermodynamics": ["温度、压力、粒子、相互作用等术语通常对应参数区和图像区。"],
        "quantum-phenomena": ["状态、概率、测量等术语通常对应准备区、测量区和统计结果区。"],
        "light-and-radiation": ["物体、透镜、镜面、像屏、波长等术语通常是核心界面词。"],
        "electricity-magnets-and-circuits": ["电流、电压、电阻、电池、开关等术语通常对应器件区和仪表区。"],
    }
    return defaults.get(topic_key, ["先辨认界面中的核心术语，再开始调节参数。"])


def build_hidden_tutor_prompt(
    *,
    title_zh: str,
    topic_label_zh: str,
    intro_zh: str,
    layout_zh: str,
    screen_flow_zh: list[str],
    controls_zh: list[str],
    effects_zh: list[str],
    readouts_zh: list[str],
    terms_zh: list[str],
) -> str:
    parts = [
        f"你当前正在以“{title_zh}”课外仿真实验的专属助教身份回答问题。",
        f"实验主题：{topic_label_zh}",
        f"实验原理概述：{intro_zh}",
        f"界面结构：{layout_zh}",
        "页面流转：",
        *[f"- {item}" for item in screen_flow_zh[:4]],
        "关键控件：",
        *[f"- {item}" for item in controls_zh[:6]],
        "关键读数与显示：",
        *[f"- {item}" for item in readouts_zh[:4]],
        "参数变化常见影响：",
        *[f"- {item}" for item in effects_zh[:4]],
        "界面术语：",
        *[f"- {item}" for item in terms_zh[:5]],
        "回答要求：优先判断用户当前处于哪个页面或场景、哪些控件被改变、哪些读数最关键；若请求中带有当前仿真截图，则优先阅读截图中的参数状态、按钮状态、图像和读数，再给出解释。",
        "不要脱离当前实验界面泛泛而谈；若界面信息不足，应明确指出需要用户补充哪个页面、哪个读数或哪个操作结果。",
    ]
    return "\n".join(parts)


def build_ui_profile(
    *,
    slug: str,
    title_zh: str,
    title_en: str,
    topic_key: str,
    topic_label_zh: str,
    intro_zh: str,
    analysis_url: str,
    has_official_zh: bool,
) -> dict[str, Any]:
    ui_phrases = extract_ui_phrases(fetch_url_text(analysis_url))
    screen_tokens = infer_screen_tokens(ui_phrases)
    override = SIM_UI_OVERRIDES.get(slug, {})

    layout_zh = str(override.get("layout_zh") or build_topic_layout(topic_key)).strip()
    screen_flow_zh = [
        str(item).strip()
        for item in (override.get("screen_flow_zh") or build_auto_screen_flow(title_zh, topic_key, screen_tokens, has_official_zh))
        if str(item).strip()
    ]
    controls_zh = [
        str(item).strip()
        for item in (override.get("controls_zh") or build_auto_controls(topic_key, ui_phrases, has_official_zh))
        if str(item).strip()
    ]
    effects_zh = [str(item).strip() for item in (override.get("effects_zh") or build_auto_effects(topic_key)) if str(item).strip()]
    readouts_zh = [str(item).strip() for item in (override.get("readouts_zh") or build_auto_readouts(topic_key, ui_phrases)) if str(item).strip()]
    terms_zh = [str(item).strip() for item in (override.get("terms_zh") or build_auto_terms(ui_phrases, topic_key, has_official_zh)) if str(item).strip()]

    interface_guidance_zh = [layout_zh, *screen_flow_zh[:2], *controls_zh[:3]]
    hidden_tutor_prompt_zh = str(
        override.get("hidden_tutor_prompt_zh")
        or build_hidden_tutor_prompt(
            title_zh=title_zh,
            topic_label_zh=topic_label_zh,
            intro_zh=intro_zh,
            layout_zh=layout_zh,
            screen_flow_zh=screen_flow_zh,
            controls_zh=controls_zh,
            effects_zh=effects_zh,
            readouts_zh=readouts_zh,
            terms_zh=terms_zh,
        )
    ).strip()

    needs_manual_review = bool(
        override.get(
            "needs_manual_review",
            len(ui_phrases) < 12 or len(screen_flow_zh) < 2 or len(controls_zh) < 2,
        )
    )

    return {
        "layout_zh": layout_zh,
        "screen_flow_zh": screen_flow_zh,
        "controls_zh": controls_zh,
        "effects_zh": effects_zh,
        "readouts_zh": readouts_zh,
        "terms_zh": terms_zh,
        "interface_guidance_zh": interface_guidance_zh,
        "hidden_tutor_prompt_zh": hidden_tutor_prompt_zh,
        "ui_profile_version": UI_PROFILE_VERSION,
        "needs_manual_review": needs_manual_review,
    }


BIDI_CONTROL_RE = re.compile(r"[\u202a-\u202e\u2066-\u2069]")
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
}
COMMON_LABEL_TRANSLATIONS = {
    "mass 1": "质量 1",
    "mass 2": "质量 2",
    "mass": "质量",
    "planet mass": "行星质量",
    "satellite mass": "卫星质量",
    "star mass": "恒星质量",
    "moon mass": "月球质量",
    "space station mass": "空间站质量",
    "constant size": "大小不变",
    "force values": "力值",
    "gravity force": "引力",
    "move spheres": "移动球体",
    "move sphere": "移动球体",
    "ruler": "尺子",
    "measuring tape": "测量带",
    "distance": "距离",
    "path": "轨道",
    "grid": "网格",
    "return objects": "返回物体",
    "clear": "清除轨迹",
    "model": "模型",
    "to scale": "按比例",
    "lens": "透镜",
    "mirror": "镜面",
    "object": "物体",
    "screen": "像屏",
    "focal points": "焦点",
    "focal length": "焦距",
    "virtual image": "虚像",
    "real image": "实像",
    "classical coin": "经典硬币",
    "quantum \"coin\"": "量子“硬币”",
    "start measurement": "开始测量",
    "new coin": "新硬币",
    "prepared state": "准备态",
    "initial orientation": "初始朝向",
    "coin bias (state)": "硬币偏置（状态）",
    "single coin measurements": "单硬币测量",
    "multiple coin measurements": "多硬币测量",
    "probability": "概率",
    "battery": "电池",
    "wire": "导线",
    "light bulb": "灯泡",
    "resistor": "电阻",
    "switch": "开关",
    "show current": "显示电流",
    "electrons": "电子",
    "ammeter": "电流表",
    "voltmeter": "电压表",
    "current chart": "电流图",
    "voltage chart": "电压图",
    "frequency": "频率",
    "amplitude": "振幅",
    "phase": "相位",
    "wavelength": "波长",
    "energy": "能量",
    "friction": "摩擦",
    "velocity": "速度",
}
NOISE_KEY_PREFIXES = (
    "joist/menuitem",
    "joist/updates",
    "joist/credits",
    "joist/preferences.tabs",
    "joist/translation",
    "joist/thirdparty",
    "scenery_phet/key.",
    "scenery_phet/keyboardhelpdialog",
)
RELEVANT_HINTS = (
    "screen",
    "model",
    "scale",
    "mass",
    "force",
    "distance",
    "ruler",
    "tape",
    "move sphere",
    "path",
    "grid",
    "object",
    "image",
    "lens",
    "mirror",
    "focal",
    "coin",
    "probability",
    "measure",
    "state",
    "orientation",
    "bias",
    "battery",
    "bulb",
    "resistor",
    "switch",
    "ammeter",
    "voltmeter",
    "wire",
    "electron",
    "current",
    "voltage",
    "frequency",
    "amplitude",
    "phase",
    "wavelength",
    "energy",
    "friction",
    "velocity",
    "orbit",
)


def normalize_text(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw).replace("\r\n", "\n").replace("\r", "\n").replace("\xa0", " ")
    text = BIDI_CONTROL_RE.sub("", text)
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    lines = [" ".join(line.split()) for line in text.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def fetch_url_text(url: str) -> str:
    if not url:
        return ""
    request = urllib.request.Request(url, headers=BROWSER_HEADERS, method="GET")
    for _ in range(2):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", errors="ignore")
        except (urllib.error.HTTPError, urllib.error.URLError):
            continue
    return ""


def fetch_json_dict(url: str) -> dict[str, Any]:
    raw = fetch_url_text(url)
    if not raw.strip():
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def derive_asset_base_url(analysis_url: str) -> str:
    if not analysis_url:
        return ""
    match = re.search(r"(https://phet\.colorado\.edu/sims/html/[^/]+/latest)", analysis_url)
    if match:
        return match.group(1)
    return analysis_url.rsplit("/", 1)[0]


def fetch_sim_string_maps(analysis_url: str, has_official_zh: bool) -> tuple[dict[str, Any], dict[str, Any]]:
    base_url = derive_asset_base_url(analysis_url)
    if not base_url:
        return {}, {}
    en_map = fetch_json_dict(f"{base_url}/english-string-map.json")
    zh_map = fetch_json_dict(f"{base_url}/zh_CN-string-map.json") if has_official_zh else {}
    return en_map, zh_map


def extract_bundle_phrases(analysis_url: str) -> list[str]:
    raw_html = fetch_url_text(analysis_url)
    if not raw_html:
        return []
    phrases = extract_ui_phrases(raw_html)
    results: list[str] = []
    seen: set[str] = set()
    for item in phrases:
        clean = normalize_text(item)
        key = clean.lower()
        if not clean or key in seen:
            continue
        seen.add(key)
        results.append(clean)
        if len(results) >= 140:
            break
    return results


def is_relevant_string_entry(key: str, text: str) -> bool:
    key_lower = key.lower()
    text_lower = text.lower()
    if not text_lower:
        return False
    if any(key_lower.startswith(prefix) for prefix in NOISE_KEY_PREFIXES):
        return False
    if "http" in text_lower or "copyright" in text_lower or "licensing" in text_lower:
        return False
    if len(text_lower) > 220:
        return False
    return any(hint in key_lower or hint in text_lower for hint in RELEVANT_HINTS)


def build_ui_entries(
    en_map: dict[str, Any],
    zh_map: dict[str, Any],
    bundle_phrases: list[str],
) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for key in dict.fromkeys([*en_map.keys(), *zh_map.keys()]):
        en_text = normalize_text(en_map.get(key))
        zh_text = normalize_text(zh_map.get(key))
        if not is_relevant_string_entry(key, en_text or zh_text):
            continue
        item = {
            "key": key.lower(),
            "key_raw": key,
            "en": en_text,
            "zh": zh_text,
            "search": f"{key} {en_text} {zh_text}".lower(),
        }
        marker = (item["key"], item["en"], item["zh"])
        if marker in seen:
            continue
        seen.add(marker)
        entries.append(item)
    for phrase in bundle_phrases:
        search = phrase.lower()
        if not any(hint in search for hint in RELEVANT_HINTS):
            continue
        marker = ("bundle", phrase, "")
        if marker in seen:
            continue
        seen.add(marker)
        entries.append({"key": f"bundle:{search}", "key_raw": "bundle", "en": phrase, "zh": "", "search": search})
    return entries


def format_entry_label(entry: dict[str, str]) -> str:
    zh_text = entry.get("zh", "")
    en_text = entry.get("en", "")
    if zh_text and not contains_english_words(zh_text):
        if en_text and zh_text != en_text:
            return f"{zh_text}（{en_text}）"
        return zh_text
    english_clean = en_text.strip().strip(":")
    translated = COMMON_LABEL_TRANSLATIONS.get(english_clean.lower()) if english_clean else ""
    if translated and english_clean:
        return f"{translated}（{english_clean}）"
    return english_clean or zh_text or entry.get("key_raw", "")


def find_matching_entries(entries: list[dict[str, str]], patterns: list[str], *, limit: int = 6) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry in entries:
        if not any(pattern in entry["search"] for pattern in patterns):
            continue
        label = format_entry_label(entry)
        if not label or label in seen:
            continue
        seen.add(label)
        results.append(entry)
        if len(results) >= limit:
            break
    return results


def labels_for_patterns(entries: list[dict[str, str]], patterns: list[str], *, limit: int = 6) -> list[str]:
    return [format_entry_label(entry) for entry in find_matching_entries(entries, patterns, limit=limit)]


def append_unique(target: list[str], text: str) -> None:
    clean = normalize_text(text)
    if clean and clean not in target:
        target.append(clean)


def extract_screen_names(slug: str, entries: list[dict[str, str]]) -> list[str]:
    screen_labels: list[str] = []
    for entry in entries:
        key = entry["key"]
        if "/screen." in key or key.endswith(".screen") or key.endswith("/screen.lab"):
            append_unique(screen_labels, format_entry_label(entry))
    if slug == "gravity-and-orbits":
        for label in labels_for_patterns(entries, ["gravity_and_orbits/model", " gravity_and_orbits/model ", "gravity_and_orbits/to scale", "gravity_and_orbits/toscale", " to scale "]):
            append_unique(screen_labels, label)
        append_unique(screen_labels, "模型（Model）")
        append_unique(screen_labels, "按比例（To Scale）")
    return screen_labels[:4]


def build_specific_sections(
    slug: str,
    topic_key: str,
    title_zh: str,
    entries: list[dict[str, str]],
    screen_names: list[str],
) -> dict[str, list[str] | str]:
    controls: list[str] = []
    effects: list[str] = []
    readouts: list[str] = []
    first_steps: list[str] = []
    terms: list[str] = []

    mass_labels = labels_for_patterns(entries, ["mass 1", "mass 2", "planet mass", "satellite mass", "star mass", "moon mass", "space station mass"], limit=6)
    constant_size_labels = labels_for_patterns(entries, ["constant size"], limit=2)
    force_value_labels = labels_for_patterns(entries, ["force values", "gravity force"], limit=3)
    move_labels = labels_for_patterns(entries, ["move spheres", "move sphere"], limit=2)
    ruler_labels = labels_for_patterns(entries, ["ruler", "measuring tape", "distance"], limit=3)
    orbit_labels = labels_for_patterns(entries, ["path", "grid", "return objects", "clear"], limit=4)
    optics_labels = labels_for_patterns(entries, ["lens", "mirror", "focal length", "focal points", "virtual image", "real image", "screen", "object"], limit=8)
    quantum_labels = labels_for_patterns(entries, ["classical coin", "quantum \"coin\"", "start measurement", "new coin", "prepared state", "initial orientation", "coin bias", "probability", "single coin measurements", "multiple coin measurements"], limit=10)
    circuit_labels = labels_for_patterns(entries, ["battery", "wire", "light bulb", "resistor", "switch", "show current", "electrons", "ammeter", "voltmeter", "current chart", "voltage chart"], limit=10)
    wave_labels = labels_for_patterns(entries, ["frequency", "amplitude", "phase", "wavelength"], limit=6)

    if mass_labels:
        append_unique(controls, f"{'、'.join(mass_labels[:4])} 是当前界面中最值得优先单独调节的质量相关控件；一次只改一个质量量，更容易看清力、轨道或图像变化来自哪里。")
        append_unique(effects, "当质量相关控件变化时，系统中的引力、轨道弯曲、箭头长度或对应读数通常会同步改变，因此应先固定其余变量再解释。")
        append_unique(terms, f"{mass_labels[0]} 是当前实验需要优先辨认的质量控制入口。")

    if constant_size_labels:
        append_unique(controls, f"{constant_size_labels[0]} 用于把球体显示大小固定住，便于把注意力放在质量数值和力值变化上，而不是被图形大小变化干扰。")
        append_unique(effects, f"勾选 {constant_size_labels[0]} 后，视觉大小不再跟着质量变化，但引力仍会继续变化，因此它不会让引力保持不变。")
        append_unique(terms, f"{constant_size_labels[0]} 表示固定球体显示大小的选项。")

    if force_value_labels:
        append_unique(controls, f"{'、'.join(force_value_labels)} 用于直接显示当前作用力的数值，是验证参数变化与力大小关系的关键显示项。")
        append_unique(readouts, f"重点读取 {'、'.join(force_value_labels)} 中的数值，再和当前图像或箭头长度做对照。")
        append_unique(first_steps, f"先打开 {force_value_labels[0]}，保证每次改参数后都能立即看到数值变化。")

    if move_labels or ruler_labels:
        visible_tools = "、".join((move_labels + ruler_labels)[:4])
        append_unique(controls, f"{visible_tools} 负责改变物体间距或读取当前距离，最适合用来验证“距离改变后现象和数值会怎样变”。")
        append_unique(effects, "当距离相关控件变化时，系统的受力强弱、轨道尺度或图像位置通常会明显变化，距离越近时变化往往更敏感。")
        append_unique(readouts, f"如果界面已经显示 {visible_tools}，应优先读取距离或位置读数，不要只靠视觉估计。")

    if orbit_labels:
        append_unique(controls, f"{'、'.join(orbit_labels[:4])} 适合配合质量或速度调节一起使用，用来对比轨道形状、尺度和历史轨迹。")
        append_unique(effects, "打开轨迹、网格或测量工具后，更容易分清当前变化是轨道形状变了、尺度变了，还是仅仅显示方式变了。")

    if optics_labels:
        append_unique(controls, f"{'、'.join(optics_labels[:5])} 构成了当前光学页面的主控件与主对象；先辨认物体、光学元件和像屏，再解释成像结果。")
        append_unique(effects, "焦距、物体位置和像屏位置变化会一起影响像的位置、大小、正倒和清晰度，因此应同时看光路和像的状态。")
        append_unique(readouts, "光学实验应优先读取物体位置、焦点位置、像屏位置以及真实像/虚像状态。")
        append_unique(first_steps, "先固定焦距，只移动物体位置；等成像规律看清以后，再移动像屏或切换页面。")

    if quantum_labels:
        append_unique(controls, f"{'、'.join(quantum_labels[:6])} 是当前量子硬币页面的核心入口；先确定准备态，再进入测量。")
        append_unique(effects, "改变准备态或偏置后，单次结果可能仍然随机，但多次测量后的概率分布会系统性改变。")
        append_unique(readouts, "量子硬币实验应优先读取概率显示、准备态信息以及单次/多次测量结果。")
        append_unique(first_steps, "先确定你正在比较经典硬币还是量子“硬币”，再固定一个准备态去做重复测量。")

    if circuit_labels:
        append_unique(controls, f"{'、'.join(circuit_labels[:6])} 构成当前电路页面的核心器件和测量工具；应先确认回路是否闭合，再解释读数。")
        append_unique(effects, "电池、开关、电阻和测量工具改变后，电流、电压、电子流和灯泡亮度往往会一起变化，因此要把结构变化和读数变化对应起来。")
        append_unique(readouts, "电路实验应优先读取电流、电压、电子流显示和灯泡亮度，而不是只看元件摆放。")
        append_unique(first_steps, "先搭一个最简单的闭合回路，再加入电阻、开关和仪表逐项比较。")

    if wave_labels:
        append_unique(controls, f"{'、'.join(wave_labels[:4])} 是当前波动页面的关键控制量，建议每次只改一个量。")
        append_unique(effects, "频率、振幅、相位或波长变化后，波形、干涉结构或传播速度会发生对应变化。")
        append_unique(readouts, "波动实验应同时读取波形、节点位置和相关数值，避免只看动画。")

    if not screen_names and topic_key == "quantum-phenomena":
        append_unique(first_steps, "先辨认当前页面里哪个区域负责准备态，哪个区域负责执行测量，哪个区域负责显示统计结果。")
    if screen_names:
        if len(screen_names) == 1:
            append_unique(first_steps, f"先确认当前就在 {screen_names[0]} 页面，再辨认该页面的控件和读数。")
        else:
            append_unique(first_steps, f"先在首页分清 {screen_names[0]} 和 {screen_names[1]} 这类不同页面，再进入当前页面做单变量比较。")

    if not controls:
        visible_labels = labels_for_patterns(entries, list(RELEVANT_HINTS), limit=5)
        if visible_labels:
            append_unique(controls, f"当前界面已经出现 {'、'.join(visible_labels)} 等控件或显示项，先辨认它们分别控制什么，再开始调参。")
    if not effects:
        append_unique(effects, f"{title_zh} 中的参数变化应与动画现象、图像变化和数值读数一起解释，不能只看其中一个。")
    if not readouts:
        append_unique(readouts, "先找到当前页面中真正会变的数值、图像或状态标记，再根据这些变化判断参数作用。")
    if not first_steps:
        append_unique(first_steps, "先确认当前在哪个页面，再固定大部分参数，只改变一个控件去观察结果。")
    if not terms:
        visible_labels = labels_for_patterns(entries, list(RELEVANT_HINTS), limit=4)
        for label in visible_labels[:4]:
            append_unique(terms, f"{label} 是当前实验中需要优先辨认的界面术语。")

    return {
        "controls_zh": controls[:6],
        "interaction_effects_zh": effects[:6],
        "readouts_zh": readouts[:5],
        "first_steps_zh": first_steps[:5],
        "terms_zh": terms[:6],
    }


def build_auto_screen_flow_v2(title_zh: str, topic_key: str, screen_names: list[str]) -> list[str]:
    if len(screen_names) >= 2:
        return [
            f"先在首页分清 {screen_names[0]}、{screen_names[1]} 等不同页面，再决定你当前要比较的是哪一类场景。",
            f"进入 {screen_names[0]} 这类页面后，先辨认该页面新增的主控件、主对象和结果显示区。",
            "当切换到另一页面后，必须重新确认当前的控件含义和观察重点，再继续做参数比较。",
        ]
    if len(screen_names) == 1:
        return [
            f"进入实验后先确认当前处于 {screen_names[0]} 页面，再辨认该页面的主控件和读数区。",
            "完成页面定位后，再开始单变量调节，并把画面变化和数值变化放在一起解释。",
        ]
    return build_auto_screen_flow(title_zh, topic_key, [], False)


def build_auto_layout_v2(topic_key: str, screen_names: list[str]) -> str:
    if screen_names:
        return f"该实验存在 {len(screen_names)} 个主要页面或场景切换入口，进入具体页面后通常需要在主场景区、参数控制区和读数/显示区之间来回对照。"
    return build_topic_layout(topic_key)


def build_hidden_tutor_prompt(
    *,
    title_zh: str,
    topic_label_zh: str,
    intro_zh: str,
    layout_zh: str,
    screen_flow_zh: list[str],
    controls_zh: list[str],
    interaction_effects_zh: list[str],
    readouts_zh: list[str],
    first_steps_zh: list[str],
    terms_zh: list[str],
) -> str:
    parts = [
        f"你当前正在以“{title_zh}”课外仿真实验的专属助教身份回答问题。",
        f"实验主题：{topic_label_zh}",
        f"实验原理概述：{intro_zh}",
        f"界面结构：{layout_zh}",
        "页面流转：",
        *[f"- {item}" for item in screen_flow_zh[:4]],
        "建议先做哪一步：",
        *[f"- {item}" for item in first_steps_zh[:4]],
        "可以调什么：",
        *[f"- {item}" for item in controls_zh[:6]],
        "怎么调会发生什么：",
        *[f"- {item}" for item in interaction_effects_zh[:5]],
        "关键读数与结果区：",
        *[f"- {item}" for item in readouts_zh[:5]],
        "界面术语：",
        *[f"- {item}" for item in terms_zh[:6]],
        "回答顺序必须是：先定位当前页面和控件，再解释当前截图或描述中的参数、读数和现象，最后再解释物理原理。",
        "如果用户没有说明当前在哪个页面、改了哪个控件，应优先根据截图判断；截图仍不足时，要用当前实验真实控件名继续追问。",
        "不要脱离当前实验界面泛泛而谈，不要只背公式。若界面信息不足，必须明确指出还缺哪一个页面、控件、勾选项或读数。",
    ]
    return "\n".join(parts)


def build_ui_profile(
    *,
    slug: str,
    title_zh: str,
    title_en: str,
    topic_key: str,
    topic_label_zh: str,
    intro_zh: str,
    analysis_url: str,
    has_official_zh: bool,
) -> dict[str, Any]:
    en_map, zh_map = fetch_sim_string_maps(analysis_url, has_official_zh)
    bundle_phrases = extract_bundle_phrases(analysis_url)
    entries = build_ui_entries(en_map, zh_map, bundle_phrases)
    screen_names = extract_screen_names(slug, entries)

    override = dict(SIM_UI_OVERRIDES.get(slug, {}))
    override.update(DETAILED_SIM_UI_OVERRIDES.get(slug, {}))

    layout_zh = str(override.get("layout_zh") or build_auto_layout_v2(topic_key, screen_names)).strip()
    screen_flow_zh = [
        str(item).strip()
        for item in (override.get("screen_flow_zh") or build_auto_screen_flow_v2(title_zh, topic_key, screen_names))
        if str(item).strip()
    ]

    auto_sections = build_specific_sections(slug, topic_key, title_zh, entries, screen_names)
    controls_zh = [str(item).strip() for item in (override.get("controls_zh") or auto_sections["controls_zh"]) if str(item).strip()]
    interaction_effects_zh = [
        str(item).strip()
        for item in (override.get("interaction_effects_zh") or override.get("effects_zh") or auto_sections["interaction_effects_zh"])
        if str(item).strip()
    ]
    readouts_zh = [str(item).strip() for item in (override.get("readouts_zh") or auto_sections["readouts_zh"]) if str(item).strip()]
    first_steps_zh = [str(item).strip() for item in (override.get("first_steps_zh") or auto_sections["first_steps_zh"]) if str(item).strip()]
    terms_zh = [str(item).strip() for item in (override.get("terms_zh") or auto_sections["terms_zh"]) if str(item).strip()]

    hidden_tutor_prompt_zh = str(
        override.get("hidden_tutor_prompt_zh")
        or build_hidden_tutor_prompt(
            title_zh=title_zh,
            topic_label_zh=topic_label_zh,
            intro_zh=intro_zh,
            layout_zh=layout_zh,
            screen_flow_zh=screen_flow_zh,
            controls_zh=controls_zh,
            interaction_effects_zh=interaction_effects_zh,
            readouts_zh=readouts_zh,
            first_steps_zh=first_steps_zh,
            terms_zh=terms_zh,
        )
    ).strip()

    needs_manual_review = bool(
        override.get(
            "needs_manual_review",
            len(entries) < 8 or len(screen_flow_zh) < 2 or len(controls_zh) < 2 or len(first_steps_zh) < 2,
        )
    )

    return {
        "layout_zh": layout_zh,
        "screen_flow_zh": screen_flow_zh,
        "controls_zh": controls_zh,
        "effects_zh": interaction_effects_zh,
        "interaction_effects_zh": interaction_effects_zh,
        "readouts_zh": readouts_zh,
        "first_steps_zh": first_steps_zh,
        "terms_zh": terms_zh,
        "interface_guidance_zh": [*first_steps_zh[:2], *controls_zh[:2], *interaction_effects_zh[:2]],
        "hidden_tutor_prompt_zh": hidden_tutor_prompt_zh,
        "ui_profile_version": UI_PROFILE_VERSION,
        "needs_manual_review": needs_manual_review,
    }


class PhetCatalogService:
    def __init__(self, cache_path: Path, *, max_age_seconds: int = DEFAULT_CACHE_MAX_AGE_SECONDS):
        self.cache_path = cache_path
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.max_age_seconds = max_age_seconds
        self._lock = threading.Lock()

    def get_catalog(self, *, force_refresh: bool = False) -> dict[str, Any]:
        with self._lock:
            cached = self._load_cache()
            if cached and not force_refresh and not self._is_stale(cached) and self._schema_matches(cached):
                return cached
            try:
                fresh = self.refresh_catalog()
                self._save_cache(fresh)
                return fresh
            except Exception as exc:
                if cached and self._schema_matches(cached):
                    return cached
                raise RuntimeError(f"实验目录暂时不可用：{exc}") from exc

    def refresh_catalog(self) -> dict[str, Any]:
        en_metadata = self._fetch_metadata("en")
        zh_metadata = self._fetch_metadata("zh_CN")
        return self._build_catalog(en_metadata, zh_metadata)

    def _fetch_metadata(self, locale: str) -> dict[str, Any]:
        url = PHET_METADATA_URL.format(locale=locale)
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "PhysicsAgent/1.0", "Accept": "application/json"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"实验元数据请求失败（HTTP {exc.code}）：{detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"实验元数据请求失败：{exc.reason}") from exc

    def _build_catalog(self, en_metadata: dict[str, Any], zh_metadata: dict[str, Any]) -> dict[str, Any]:
        physics_ids = {
            int(value)
            for value in en_metadata.get("categories", {}).get(PHYSICS_CATEGORY_ID, {}).get("simulationIds", [])
        }
        zh_simulations = self._simulation_map(zh_metadata)
        groups: dict[str, dict[str, Any]] = {
            spec["topic_key"]: {
                "topic_key": spec["topic_key"],
                "topic_label_zh": spec["topic_label_zh"],
                "topic_label_en": spec["topic_label_en"],
                "sims": [],
            }
            for spec in TOPIC_SPECS
        }

        base_items: list[tuple[str, dict[str, Any]]] = []
        for project in en_metadata.get("projects", []):
            for simulation in project.get("simulations", []):
                sim_id = int(simulation.get("id") or 0)
                if sim_id not in physics_ids:
                    continue
                slug = str(simulation.get("name") or "").strip()
                if not slug:
                    continue

                localized_en = (simulation.get("localizedSimulations") or {}).get("en")
                if not isinstance(localized_en, dict):
                    continue

                en_run = str(localized_en.get("runUrl") or "")
                all_locales_url = str(simulation.get("allLocalesSimURL") or "")
                if not en_run.startswith("/sims/html/") and not all_locales_url.startswith("/sims/html/"):
                    continue

                zh_simulation = zh_simulations.get(slug, {})
                localized_zh = (zh_simulation.get("localizedSimulations") or {}).get("zh_CN")
                topic_spec = pick_topic_spec(sim_id, en_metadata)
                has_official_zh = has_html_run(localized_zh)

                title_en = normalize_text(localized_en.get("title") or slug)
                raw_title_zh = normalize_text((localized_zh or {}).get("title"))
                title_zh = raw_title_zh if raw_title_zh and not contains_english_words(raw_title_zh) else translate_title_fallback(title_en, slug)

                intro_zh = normalize_text((localized_zh or {}).get("description"))
                learning_goals_zh = normalize_text((localized_zh or {}).get("learningGoals"))
                if needs_generated_chinese(intro_zh):
                    intro_zh = build_generated_intro(title_zh, topic_spec["topic_label_zh"])
                if needs_generated_chinese(learning_goals_zh):
                    learning_goals_zh = build_generated_goals(topic_spec["topic_label_zh"])

                official_page_url = absolute_url(
                    str((localized_zh or {}).get("simPageUrl") or localized_en.get("simPageUrl") or "")
                )
                embed_url = choose_embed_url(localized_en, localized_zh, all_locales_url)
                if not embed_url:
                    continue

                base_items.append(
                    (
                        topic_spec["topic_key"],
                        {
                            "slug": slug,
                            "sim_id": sim_id,
                            "title_zh": title_zh,
                            "title_en": title_en,
                            "topic_zh": topic_spec["topic_label_zh"],
                            "topic_en": topic_spec["topic_label_en"],
                            "intro_zh": intro_zh,
                            "learning_goals_zh": learning_goals_zh,
                            "official_page_url": official_page_url,
                            "embed_url": embed_url,
                            "has_official_zh": has_official_zh,
                            "translation_source": "official" if normalize_text((localized_zh or {}).get("description")) else "generated",
                            "research_focus_zh": topic_spec["research_focus_zh"],
                            "observation_points": topic_spec["observation_points"],
                            "suggested_questions": topic_spec["suggested_questions"],
                            "_analysis_url": choose_analysis_url(localized_en, all_locales_url),
                            "_topic_key": topic_spec["topic_key"],
                        },
                    )
                )

        with ThreadPoolExecutor(max_workers=FETCH_WORKERS) as executor:
            future_map = {
                executor.submit(self._build_enriched_item, item): (topic_key, item)
                for topic_key, item in base_items
            }
            for future in as_completed(future_map):
                topic_key, fallback_item = future_map[future]
                try:
                    groups[topic_key]["sims"].append(future.result())
                except Exception:
                    fallback = dict(fallback_item)
                    fallback.update(
                        build_ui_profile(
                            slug=fallback["slug"],
                            title_zh=fallback["title_zh"],
                            title_en=fallback["title_en"],
                            topic_key=fallback["_topic_key"],
                            topic_label_zh=fallback["topic_zh"],
                            intro_zh=fallback["intro_zh"],
                            analysis_url="",
                            has_official_zh=bool(fallback["has_official_zh"]),
                        )
                    )
                    fallback.pop("_analysis_url", None)
                    fallback.pop("_topic_key", None)
                    groups[topic_key]["sims"].append(fallback)

        ordered_groups: list[dict[str, Any]] = []
        total = 0
        for spec in TOPIC_SPECS:
            group = groups[spec["topic_key"]]
            group["sims"].sort(key=lambda item: (item["title_zh"], item["title_en"]))
            if not group["sims"]:
                continue
            total += len(group["sims"])
            ordered_groups.append(group)

        return {
            "schema_version": CATALOG_SCHEMA_VERSION,
            "ui_profile_version": UI_PROFILE_VERSION,
            "updated_at": utc_now_iso(),
            "total": total,
            "groups": ordered_groups,
        }

    def _build_enriched_item(self, item: dict[str, Any]) -> dict[str, Any]:
        enriched = dict(item)
        enriched.update(
            build_ui_profile(
                slug=item["slug"],
                title_zh=item["title_zh"],
                title_en=item["title_en"],
                topic_key=item["_topic_key"],
                topic_label_zh=item["topic_zh"],
                intro_zh=item["intro_zh"],
                analysis_url=item["_analysis_url"],
                has_official_zh=bool(item["has_official_zh"]),
            )
        )
        enriched.pop("_analysis_url", None)
        enriched.pop("_topic_key", None)
        return enriched

    def _simulation_map(self, metadata: dict[str, Any]) -> dict[str, dict[str, Any]]:
        simulations: dict[str, dict[str, Any]] = {}
        for project in metadata.get("projects", []):
            for simulation in project.get("simulations", []):
                slug = str(simulation.get("name") or "").strip()
                if slug:
                    simulations[slug] = simulation
        return simulations

    def _load_cache(self) -> dict[str, Any] | None:
        if not self.cache_path.exists():
            return None
        try:
            return json.loads(self.cache_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    def _save_cache(self, payload: dict[str, Any]) -> None:
        self.cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _schema_matches(self, payload: dict[str, Any]) -> bool:
        if int(payload.get("schema_version") or 0) != CATALOG_SCHEMA_VERSION:
            return False
        for group in payload.get("groups", []):
            for sim in group.get("sims", []):
                return (
                    isinstance(sim.get("interface_guidance_zh"), list)
                    and isinstance(sim.get("screen_flow_zh"), list)
                    and isinstance(sim.get("controls_zh"), list)
                    and isinstance(sim.get("effects_zh"), list)
                    and isinstance(sim.get("interaction_effects_zh"), list)
                    and isinstance(sim.get("readouts_zh"), list)
                    and isinstance(sim.get("first_steps_zh"), list)
                    and isinstance(sim.get("terms_zh"), list)
                    and isinstance(sim.get("hidden_tutor_prompt_zh"), str)
                    and isinstance(sim.get("layout_zh"), str)
                )
        return True

    def _is_stale(self, payload: dict[str, Any]) -> bool:
        timestamp = str(payload.get("updated_at") or "").strip()
        if not timestamp:
            return True
        try:
            updated_at = datetime.fromisoformat(timestamp)
        except ValueError:
            return True
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - updated_at).total_seconds() > self.max_age_seconds


def resolve_phet_cache_age_seconds() -> int:
    raw = os.getenv("PHET_CACHE_MAX_AGE_SECONDS", "").strip()
    if not raw:
        return DEFAULT_CACHE_MAX_AGE_SECONDS
    try:
        return max(300, int(raw))
    except ValueError:
        return DEFAULT_CACHE_MAX_AGE_SECONDS
