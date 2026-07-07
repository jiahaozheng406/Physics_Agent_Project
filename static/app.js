
(() => {
  "use strict";

  const TWO_PI = Math.PI * 2;
  const NEWTON_VIEW_RADIUS_M = 5.2e-3;
  const AUTH_REQUEST_TIMEOUT_MS = 12000;
  const AUTH_TOKEN_STORAGE_KEY = "physics_agent_auth_token_v1";
  const API_BASE_URL_VERSION_STORAGE_KEY = "physics_agent_api_base_url_version_v1";
  const LEGACY_SESSION_STORAGE_KEY = "physics_agent_session_id";
  const PROVIDER_LABELS = {
    phone: "手机验证码",
    wechat: "微信",
    qq: "QQ",
    demo: "体验账号",
    local: "本地模式",
  };
  const ROLE_LABELS = {
    teacher: "教师端",
    student: "学生端",
  };
  let ACTIVE_USER_STORAGE_SCOPE = "anonymous";

  const experiments = [
    {
      id: "michelson",
      name: "迈克耳孙干涉仪测定激光波长",
      category: "光学实验",
      brief: "通过条纹吞吐与光程差变化反推激光波长。",
      intro: "本实验利用分束镜将同一束激光分成两路，再经反射后重新叠加形成干涉条纹。通过精细调节可动镜位移并统计条纹吞吐级次，可以把镜面位移与光程差变化对应起来，进而测定激光波长。",
      formula: "近轴条件下可取 Δ≈2d；若镜面位移为 Δd、条纹变化级数为 N，则 λ = 2Δd / N。",
      outcomes: [
        "理解迈克耳孙干涉仪中分光、反射、合束与干涉的基本路径。",
        "掌握条纹吞吐法测定波长的读数思路与数据处理方法。",
        "能够分析镜面倾斜、振动干扰与回程空程对测量结果的影响。",
      ],
      tips: [
        "先调出清晰且稳定的中心干涉条纹，再开始计数。",
        "条纹级次统计应保持镜面单向运动，避免机械回差引入误差。",
        "建议多次重复测量并计算平均值，再结合估读误差给出不确定度。",
      ],
      quiz: [
        "为什么迈克耳孙干涉仪中镜面实际移动 Δd 时，光程差会变化 2Δd？",
        "若可动镜移动 0.158 mm 时观察到 500 条条纹吞吐，试计算入射激光波长。",
        "实验中条纹模糊或漂移通常与哪些调节状态或环境因素有关？",
      ],
      simulationState: "ready",
    },
    {
      id: "newton-rings",
      name: "牛顿环实验",
      category: "光学实验",
      brief: "利用等厚干涉圆环测定曲率半径或光波波长。",
      intro: "牛顿环由平凸透镜与平板玻璃之间形成的空气薄膜产生，是典型的等厚干涉现象。实验通过测量不同级次暗环或明环的直径，建立环半径与级次之间的关系，从而求取透镜曲率半径或入射光波长。",
      formula: "暗环满足 r_k^2 = kRλ；常用相邻级次或隔级差分消除系统零点误差。",
      outcomes: [
        "理解等厚干涉的形成条件及牛顿环明暗分布规律。",
        "掌握显微测量与环径平方差处理的数据方法。",
        "能够判断中心暗斑、接触状态与曲率半径之间的实验联系。",
      ],
      tips: [
        "测量时宜选取对称方向读数并取平均，以减小偏心误差。",
        "优先使用较高但仍清晰可辨的级次，以提高数据灵敏度。",
        "不要直接用单个环径作结论，建议采用多组数据线性处理。",
      ],
      quiz: [
        "为什么牛顿环中心通常表现为暗斑？这一结论与反射相位变换有什么关系？",
        "若暗环半径平方与级次成线性关系，线性图像的斜率物理意义是什么？",
        "使用隔级测量代替相邻级测量可以减少哪一类实验误差？",
      ],
      simulationState: "ready",
    },
    {
      id: "wheatstone-bridge",
      name: "用惠斯通电桥测电阻",
      category: "电学实验",
      brief: "利用桥路平衡条件精密测量中值电阻。",
      intro: "惠斯通电桥通过比较桥路两臂的电势差实现平衡测量，是经典的零示法实验。实验中通过调节比例臂和比较臂，使检流计示零，再根据桥路平衡关系求得未知电阻，突出体现了比较测量与高灵敏零点判断的思想。",
      formula: "桥路平衡时有 Rx = (R1 / R2)Rs。",
      outcomes: [
        "掌握桥路平衡法测量未知电阻的基本操作流程。",
        "理解检流计示零法相较直接测量法的精度优势。",
        "能够分析电源波动、比例臂误差和接触电阻对结果的影响。",
      ],
      tips: [
        "接近平衡时再压下开关观察检流计偏转，减少检流计受冲击时间。",
        "先粗调比例臂，再细调比较臂，可更快找到平衡位置。",
        "多次改变比例臂后重复测量，可验证结果的稳定性与可靠性。",
      ],
      quiz: [
        "为什么桥路平衡时检流计中没有电流，但桥路仍可测出未知电阻？",
        "若 R1:R2 = 1:2，平衡时 Rs = 246.0 Ω，试求未知电阻 Rx。",
        "在惠斯通电桥实验中，接触电阻会主要影响哪类被测电阻的测量结果？",
      ],
      simulationState: "ready",
    },
    {
      id: "double-arm-bridge",
      name: "双臂电桥测量低电阻",
      category: "电学实验",
      brief: "利用开尔文双桥抑制引线和接触电阻影响，测量低值电阻。",
      intro: "双臂电桥适用于毫欧级低电阻测量，其核心思想是在桥路中引入附加比例臂，从而有效补偿连接导线与接触电阻。实验重点在于理解低电阻测量为何容易受附加电阻影响，以及双桥结构如何提高测量准确性。",
      formula: "理想平衡时可近似写为 Rx = (R1 / R2)Rs，并通过附加比例臂补偿引线电阻影响。",
      outcomes: [
        "理解低电阻测量中引线电阻与接触电阻不可忽略的原因。",
        "掌握双臂电桥相对于惠斯通电桥的结构改进与使用场景。",
        "能够说明附加比例臂失配时测量误差的来源。",
      ],
      tips: [
        "连接导线应牢固紧密，避免毫欧级测量中出现接触漂移。",
        "调桥前先确认主比例臂与附加比例臂满足设计配比关系。",
        "低阻实验中应尽量减小导线发热和外界温升影响。",
      ],
      quiz: [
        "为什么测量低电阻时不能简单照搬普通惠斯通电桥的接线方式？",
        "双臂电桥中的附加比例臂失去匹配会带来什么误差后果？",
        "若被测对象发热明显，测得电阻值通常会如何变化？为什么？",
      ],
      simulationState: "ready",
    },
    {
      id: "oscilloscope",
      name: "数字示波器的调整和使用",
      category: "仪器使用",
      brief: "掌握垂直、水平与触发系统的联动调节方法。",
      intro: "数字示波器是电学实验中最常用的通用测量仪器之一。实验通过观察波形、调整量程、设置时基与触发方式，使学生建立“信号幅值—时间结构—同步显示”三者统一理解，并为后续交流电路与瞬态过程实验打下基础。",
      formula: "示波器核心读数关系为：电压值 = 垂直刻度 × 格数；周期 = 时基刻度 × 水平格数。",
      outcomes: [
        "理解垂直灵敏度、时基扫描和触发系统的基本作用。",
        "掌握周期、频率、峰峰值与相位差的示波器读数方法。",
        "能够根据波形稳定性判断触发设置是否合理。",
      ],
      tips: [
        "测量前先做探头补偿，避免波形顶部和边沿失真。",
        "先把波形调入屏幕中央，再细调时基与灵敏度。",
        "观察不稳定波形时，应优先检查触发源、触发电平与耦合方式。",
      ],
      quiz: [
        "为什么触发系统设置不当时，示波器上会出现波形左右漂移或跳动？",
        "若一个周期横向占 4.5 格、时基为 0.2 ms/div，试求信号频率。",
        "交流耦合与直流耦合各适合观察哪些类型的电压信号？",
      ],
      simulationState: "ready",
    },
    {
      id: "torsion-pendulum",
      name: "扭摆法测量物体的转动惯量",
      category: "力学实验",
      brief: "利用扭摆周期与转动惯量关系反求未知物体惯量。",
      intro: "扭摆系统在扭转回复力矩作用下做近似简谐振动，其周期由系统总转动惯量与扭转系数共同决定。实验通过比较空盘、标准件与待测物的振动周期，求出未知物体的转动惯量，并体会动力学参数的间接测量方法。",
      formula: "扭摆周期满足 T = 2π√(I / K)，常用比较法消去扭转系数 K。",
      outcomes: [
        "理解扭摆系统的回复力矩与角位移之间的线性关系。",
        "掌握通过周期比较法测量未知转动惯量的基本方法。",
        "能够分析阻尼、计时和装配偏心对实验结果的影响。",
      ],
      tips: [
        "起始角度不宜过大，以保证系统满足小角度近似。",
        "建议测量多个周期总时长，再换算单周期以降低随机误差。",
        "待测物应尽量与转轴同心固定，避免额外晃动和偏心转动。",
      ],
      quiz: [
        "为什么扭摆法通常采用“测 10 个周期总时长”而不是只测 1 个周期？",
        "若空盘周期与加载后的周期均增大，说明系统的哪个物理量发生了主要变化？",
        "实验中起振角过大时，周期测量可能会受到什么影响？",
      ],
      simulationState: "ready",
    },
    {
      id: "dielectric-constant",
      name: "电介质电容率的测量",
      category: "电磁学实验",
      brief: "通过平行板电容变化测定材料相对介电常数。",
      intro: "本实验将待测介质插入平行板电容器中，通过比较插入前后的电容变化，测定材料的相对介电常数。实验既涉及静电场中介质极化的物理图像，也强调几何尺寸、边缘效应和材料均匀性对结果的影响。",
      formula: "理想平行板模型下 C = εrε0S / d，因此 εr ≈ C介质 / C空气。",
      outcomes: [
        "理解电介质极化与电容增大的微观和宏观原因。",
        "掌握由电容变化反推相对介电常数的实验思路。",
        "能够讨论边缘效应、极板平行度与材料厚度误差对结果的影响。",
      ],
      tips: [
        "介质片插入时应保持平整，避免出现倾斜或局部悬空。",
        "测量前后极板间距不应随意变化，否则会引入系统误差。",
        "若仪器有零点漂移，应先完成空载校准再进行正式测量。",
      ],
      quiz: [
        "为什么把介质插入电容器后，电容一般会增大？",
        "若介质未完全填满极板间空间，直接使用理想公式会产生什么偏差？",
        "在本实验中，极板不平行会同时影响哪些测量量？",
      ],
      simulationState: "ready",
    },
    {
      id: "spectrometer-prism",
      name: "分光计调节和棱镜顶角的测定",
      category: "光学实验",
      brief: "通过分光计自准与反射像测量棱镜顶角。",
      intro: "分光计实验首先训练光学平台的规范调节，包括望远镜调焦、平行光管调节与转台整平。完成仪器调节后，再利用棱镜两反射面的像位差测定顶角，为后续最小偏向角法测折射率奠定基础。",
      formula: "棱镜顶角可由两反射像方位差求得，常用关系为 A = φ / 2。",
      outcomes: [
        "掌握分光计“先调仪器、后测数据”的规范流程。",
        "理解自准法与反射法在光学调节中的作用。",
        "能够说明顶角测量与棱镜折射率实验之间的前后联系。",
      ],
      tips: [
        "先保证望远镜与平行光管都对无穷远成像清晰，再进行平台调平。",
        "读取游标时应两侧同时记录，并取平均减小偏心误差。",
        "转台锁紧与微调应交替使用，避免粗暴操作导致视线偏移。",
      ],
      quiz: [
        "为什么分光计实验中必须先进行望远镜与平行光管的调焦？",
        "若两反射像的角位置差为 119°52′，试写出棱镜顶角的表达结果。",
        "双游标同时读数的目的是什么？它主要补偿哪类误差？",
      ],
      simulationState: "ready",
    },
    {
      id: "franck-hertz",
      name: "弗兰克-赫兹实验",
      category: "近代物理实验",
      brief: "通过电子与原子非弹性碰撞验证原子能级量子化。",
      intro: "弗兰克-赫兹实验通过记录电子流随加速电压变化的周期性峰谷，揭示电子与原子发生非弹性碰撞时只能交换特定能量，从而为原子定态与能级量子化提供直接实验支持。实验是连接经典电子学与近代原子物理的重要桥梁。",
      formula: "相邻电流峰（或谷）之间的电压间隔近似对应原子第一激发能：ΔE ≈ eΔU。",
      outcomes: [
        "理解电子与原子碰撞中弹性碰撞和非弹性碰撞的区别。",
        "掌握通过峰谷间距估算原子激发能的实验方法。",
        "能够把实验曲线特征与原子能级量子化联系起来解释。",
      ],
      tips: [
        "实验管需要预热稳定后再开始记录曲线，避免热漂移过大。",
        "峰谷位置不宜只读单点，应结合整段曲线走势判断。",
        "应区分接触电势差对曲线整体平移和峰间距的不同影响。",
      ],
      quiz: [
        "为什么弗兰克-赫兹曲线会出现近似周期性的电流峰谷结构？",
        "若相邻峰值电压差约为 4.9 V，它对应的原子激发能应如何表示？",
        "接触电势差会主要影响峰间距还是峰谷整体位置？为什么？",
      ],
      simulationState: "ready",
    },
    {
      id: "bohr-resonance",
      name: "玻尔共振仪研究受迫振动",
      category: "力学实验",
      brief: "观察驱动频率变化下的振幅响应与相位特征。",
      intro: "受迫振动实验以玻尔共振仪为平台，通过改变驱动频率与阻尼强弱，观察系统振幅、相位和能量吸收的变化规律。实验重点在于理解共振峰的形成条件，以及频率响应曲线背后的动力学机制。",
      formula: "稳态振幅满足 A = M0 / √((k - Iω²)² + (cω)²)，共振附近振幅最大。",
      outcomes: [
        "理解自由振动、受迫振动与阻尼振动之间的联系。",
        "掌握共振曲线、共振频率和品质因数的基本物理意义。",
        "能够解释频率偏离共振点时振幅衰减与相位变化的趋势。",
      ],
      tips: [
        "每次改变频率后应等待系统进入稳态，再读取振幅。",
        "阻尼较小时峰值更尖锐，调节频率时应采用更小步长。",
        "记录上升频率与下降频率两组数据，有助于比较实验重复性。",
      ],
      quiz: [
        "为什么受迫振动系统在驱动频率接近固有频率时更容易出现大振幅？",
        "阻尼增大后，共振峰的高度和宽度通常会怎样变化？",
        "实验中若刚刚把驱动频率调大，振幅短时间内仍未稳定，应立即读数吗？为什么？",
      ],
      simulationState: "ready",
    },
    {
      id: "grating-spectrum",
      name: "光栅原子光谱的定性研究",
      category: "光学实验",
      brief: "利用光栅衍射分辨谱线并识别不同元素的特征发射。",
      intro: "本实验借助透射光栅把复色光展开为不同级次的离散谱线，通过比较各谱线的位置、颜色和相对强度，对光源中的元素成分作定性分析。实验体现了波动光学中的干涉与衍射统一图像，也引入了原子光谱的特征性概念。",
      formula: "光栅衍射主极大满足 d sinθ = kλ。",
      outcomes: [
        "理解光栅常数、衍射级次与谱线位置之间的对应关系。",
        "掌握利用特征谱线进行元素定性识别的基本思路。",
        "能够分析狭缝宽度、光栅质量与仪器调节对分辨率的影响。",
      ],
      tips: [
        "先调整狭缝宽度与亮度，再进行谱线识别，避免谱线过宽重叠。",
        "观察时应区分零级像与一级、二级谱线，防止误判。",
        "记录谱线颜色时建议结合相对位置和亮度，而不是单凭主观印象。",
      ],
      quiz: [
        "为什么光栅比单缝更适合用于原子光谱的分辨观察？",
        "若已知光栅常数 d，测得一级谱线衍射角 θ，应如何写出对应波长表达式？",
        "实验中增大狭缝宽度为什么会让谱线更亮却更不利于分辨？",
      ],
      simulationState: "ready",
    },
    {
      id: "hall-effect",
      name: "霍尔效应测量磁感应强度",
      category: "电磁学实验",
      brief: "利用霍尔电压与电流、磁场关系测定磁感应强度。",
      intro: "霍尔效应实验通过在载流导体或半导体中施加垂直磁场，观察横向电势差的产生，从而建立霍尔电压与磁感应强度之间的定量关系。实验既反映洛伦兹力对载流子偏转的作用，也帮助学生理解传感器测磁原理。",
      formula: "常见写法为 UH = KHIB / d，因此 B 可由霍尔电压、电流和样品厚度反求。",
      outcomes: [
        "理解霍尔电势差产生的物理机制及其方向判定方法。",
        "掌握通过霍尔电压测量磁感应强度的基本流程。",
        "能够说明零点漂移、接触不对称与温度变化对结果的影响。",
      ],
      tips: [
        "换向法测量可以有效削弱零漂与热电势对结果的干扰。",
        "测量时应保证励磁电流与工作电流稳定，避免瞬时波动。",
        "样品安装方向若发生偏差，会直接影响霍尔电压的正负和大小。",
      ],
      quiz: [
        "为什么霍尔电压的测量常常需要采用电流换向或磁场换向方法？",
        "若只改变磁场方向而保持工作电流方向不变，霍尔电压将如何变化？",
        "在本实验中，样品厚度测量误差会怎样传递到磁感应强度结果中？",
      ],
      simulationState: "ready",
    },
    {
      id: "potentiometer-emf",
      name: "用电位差计测量电源电动势与内阻",
      category: "电学实验",
      brief: "通过补偿法精密测量电源开路电动势和内阻。",
      intro: "电位差计测量属于典型的补偿法，其核心在于使被测支路处于零电流状态，从而避免仪表分流对被测电压的扰动。实验先测开路电动势，再引入负载测端电压，最终依据两次补偿长度关系求得电源内阻。",
      formula: "补偿平衡时电压与平衡长度成正比，常用 r = R(l1 / l2 - 1) 求内阻。",
      outcomes: [
        "理解补偿法相对于直接电压表测量的精度优势。",
        "掌握由平衡长度比求电动势和内阻的实验方法。",
        "能够分析工作电流不稳和滑线电阻不均匀对结果的影响。",
      ],
      tips: [
        "测量前应先稳定工作回路电流，保证电位梯度恒定。",
        "平衡点应通过逐渐逼近方式寻找，不宜快速滑动越过。",
        "负载电阻切换后应等待指针稳定，再记录新的平衡长度。",
      ],
      quiz: [
        "为什么电位差计测量时要求被测支路在平衡时无电流通过？",
        "若开路平衡长度为 l1、接入负载后的平衡长度为 l2，应如何表示端电压与电动势之比？",
        "工作电流波动会对整个电位梯度造成什么影响？为什么这会破坏测量精度？",
      ],
      simulationState: "ready",
    },
    {
      id: "photoelectric-effect",
      name: "光电效应测定普朗克常量",
      category: "近代物理实验",
      brief: "利用截止电压与入射频率的线性关系测定普朗克常量。",
      intro: "光电效应实验通过测量不同频率入射光对应的截止电压，建立电子最大初动能与光频率的线性关系。实验直接体现了光量子假设，是学生理解爱因斯坦光电方程和普朗克常量实验测定的重要基础。",
      formula: "截止条件满足 eUc = hν - W，作 Uc-ν 图线可由斜率求 h / e。",
      outcomes: [
        "理解截止电压、逸出功与光频率之间的线性关系。",
        "掌握用图像法由实验数据求普朗克常量的思路。",
        "能够区分光强改变与频率改变对光电子行为的不同影响。",
      ],
      tips: [
        "不同单色光对应的截止电压应在同一工作条件下测量，减少系统漂移。",
        "图像拟合时应注意剔除明显偏离趋势的异常点并说明原因。",
        "实验讨论中要强调：截止电压反映的是最大初动能，而非光电流大小。",
      ],
      quiz: [
        "为什么增大入射光强通常会增大光电流，却不会改变截止电压？",
        "若 Uc-ν 图像斜率已知，应如何由斜率求得普朗克常量 h？",
        "截止频率的物理意义是什么？它与阴极材料的哪个参数有关？",
      ],
      simulationState: "ready",
    },
  ];

  const experimentMap = new Map(experiments.map((exp) => [exp.id, exp]));
  const implementedSimulationIds = new Set(experiments.filter((exp) => exp.simulationState === "ready").map((exp) => exp.id));
  const DATA_LAB_FIT_LABELS = {
    linear: "线性拟合",
    quadratic: "二次曲线拟合",
    exponential: "指数曲线拟合",
    power: "幂函数拟合",
    logarithmic: "对数曲线拟合",
  };
  const DATA_LAB_QUANTITY_PRESETS = [
    { key: "custom", label: "自定义", axisLabel: "自定义量", unit: "", expression: "x" },
    { key: "force", label: "力 F", axisLabel: "力 F", unit: "N", expression: "F" },
    { key: "current", label: "电流 I", axisLabel: "电流 I", unit: "A", expression: "I" },
    { key: "voltage", label: "电压 U", axisLabel: "电压 U", unit: "V", expression: "U" },
    { key: "length", label: "长度 x", axisLabel: "长度 x", unit: "m", expression: "x" },
    { key: "displacement", label: "位移 Δx", axisLabel: "位移 Δx", unit: "mm", expression: "DeltaX" },
    { key: "time", label: "时间 t", axisLabel: "时间 t", unit: "s", expression: "t" },
    { key: "frequency", label: "频率 f", axisLabel: "频率 f", unit: "Hz", expression: "f" },
    { key: "mass", label: "质量 m", axisLabel: "质量 m", unit: "kg", expression: "m" },
    { key: "resistance", label: "电阻 R", axisLabel: "电阻 R", unit: "Ω", expression: "R" },
    { key: "power", label: "功率 P", axisLabel: "功率 P", unit: "W", expression: "P" },
    { key: "temperature", label: "温度 T", axisLabel: "温度 T", unit: "K", expression: "T" },
  ];
  const DATA_LAB_DEFAULT_SAMPLE_KEY = "force-extension";
  const DATA_LAB_SAMPLES = {
    "force-extension": {
      xPreset: "custom",
      xLabel: "x",
      xUnit: "N",
      xExpression: "x",
      yPreset: "custom",
      yLabel: "y",
      yUnit: "mm",
      yExpression: "y",
      fitType: "linear",
      tableText: [
        "0.50,1.23",
        "1.00,2.44",
        "1.50,3.71",
        "2.00,4.86",
        "2.50,6.17",
      ].join("\n"),
      uncertainties: {},
      xBUncertainty: "",
      yBUncertainty: "",
      status: "已载入示例点，可直接修改后重新绘图。",
    },
    "current-voltage": {
      xPreset: "custom",
      xLabel: "x",
      xUnit: "A",
      xExpression: "x",
      yPreset: "custom",
      yLabel: "y",
      yUnit: "V",
      yExpression: "y",
      fitType: "linear",
      tableText: [
        "0.10,0.98",
        "0.15,1.47",
        "0.20,1.99",
        "0.25,2.47",
        "0.30,3.01",
      ].join("\n"),
      uncertainties: {},
      xBUncertainty: "",
      yBUncertainty: "",
      status: "已载入示例点，可直接修改后重新绘图。",
    },
  };
  const API_BASE_URL_STORAGE_KEY = "physics_agent_api_base_url";
  const MODEL_API_KEY_STORAGE_KEY = "physics_agent_model_api_key";
  const UI_VIEW_STATE_KEY = "__physics_agent_ui_view__";
  const ANDROID_BACK_EXIT_INTERVAL_MS = 2000;

  function getDataLabSample(sampleKey = DATA_LAB_DEFAULT_SAMPLE_KEY) {
    return DATA_LAB_SAMPLES[sampleKey] || DATA_LAB_SAMPLES[DATA_LAB_DEFAULT_SAMPLE_KEY];
  }

  function createDataLabState(sampleKey = DATA_LAB_DEFAULT_SAMPLE_KEY) {
    const sample = getDataLabSample(sampleKey);
    const samplePoints = (() => {
      try {
        return parseSimpleDataLabPoints(sample.tableText).rows.map((row) => ({
          x: row.x,
          y: row.y,
        }));
      } catch {
        return [];
      }
    })();
    return {
      isOpen: false,
      sampleKey,
      xPreset: sample.xPreset,
      xLabel: sample.xLabel,
      xUnit: sample.xUnit,
      xExpression: sample.xExpression,
      yPreset: sample.yPreset,
      yLabel: sample.yLabel,
      yUnit: sample.yUnit,
      yExpression: sample.yExpression,
      fitType: sample.fitType || "linear",
      draftX: "",
      draftY: "",
      points: samplePoints,
      tableText: sample.tableText,
      uncertainties: { ...(sample.uncertainties || {}) },
      xBUncertainty: String(sample.xBUncertainty ?? ""),
      yBUncertainty: String(sample.yBUncertainty ?? ""),
      result: null,
      lastVariables: [],
      status: sample.status || "",
      error: "",
    };
  }

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function isLocalDevelopmentOrigin() {
    const hostname = String(window.location.hostname || "").trim().toLowerCase();
    return hostname === "127.0.0.1" || hostname === "localhost";
  }

  function loadRuntimeConfig() {
    const runtime = window.__PHYSICS_AGENT_RUNTIME__;
    const rawConfig = runtime && typeof runtime === "object" ? runtime : {};
    const explicitMode = String(rawConfig.appMode || "").trim().toLowerCase();
    const backendMode = String(rawConfig.backendMode || "").trim().toLowerCase();
    const nativePlatform = Boolean(window.Capacitor?.isNativePlatform?.());
    const isCapacitorShell = explicitMode === "capacitor" || nativePlatform;
    const apiBaseUrlVersion = String(rawConfig.apiBaseUrlVersion || "").trim();
    let customApiBaseUrl = getStoredApiBaseUrl();
    const customModelApiKey = getStoredModelApiKey();
    const configuredApiBaseUrl = normalizeBaseUrl(rawConfig.apiBaseUrl);
    const defaultApiBaseUrl = normalizeBaseUrl(rawConfig.defaultApiBaseUrl);
    const configuredModelApiKey = String(rawConfig.modelApiKey || "").trim();
    const lockApiBaseUrl = Boolean(rawConfig.lockApiBaseUrl);

    if (isCapacitorShell && apiBaseUrlVersion) {
      const bundledApiBaseUrl = configuredApiBaseUrl || defaultApiBaseUrl;
      const appliedVersion = getStoredApiBaseUrlVersion();
      if (appliedVersion !== apiBaseUrlVersion) {
        if (customApiBaseUrl && bundledApiBaseUrl && customApiBaseUrl !== bundledApiBaseUrl) {
          setStoredApiBaseUrl("");
          customApiBaseUrl = "";
        }
        setStoredApiBaseUrlVersion(apiBaseUrlVersion);
      }
    }

    const resolvedApiBaseUrl = lockApiBaseUrl
      ? (configuredApiBaseUrl || (isCapacitorShell ? defaultApiBaseUrl : ""))
      : (customApiBaseUrl || configuredApiBaseUrl || (isCapacitorShell ? defaultApiBaseUrl : ""));
    const resolvedBackendMode = backendMode || (isCapacitorShell ? "lite" : "remote");
    const isLiteBackend = resolvedBackendMode === "lite";

    const disableServiceWorker = Boolean(rawConfig.disableServiceWorker || isCapacitorShell || isLocalDevelopmentOrigin());

    return {
      appMode: explicitMode || (isCapacitorShell ? "capacitor" : "web"),
      backendMode: resolvedBackendMode,
      isLiteBackend,
      isCapacitorShell,
      customApiBaseUrl: lockApiBaseUrl ? "" : customApiBaseUrl,
      configuredApiBaseUrl,
      defaultApiBaseUrl,
      apiBaseUrlVersion,
      lockApiBaseUrl,
      apiBaseUrl: resolvedApiBaseUrl,
      customModelApiKey: customModelApiKey,
      configuredModelApiKey,
      modelApiKey: customModelApiKey || configuredModelApiKey,
      showConnectionSettings: !isLiteBackend && Boolean(rawConfig.showConnectionSettings),
      showModelKeySettings: Boolean(rawConfig.showModelKeySettings ?? isLiteBackend),
      disableServiceWorker,
    };
  }

  function resolveRequestUrl(input) {
    if (typeof input !== "string") return input;
    if (/^[a-z][a-z0-9+.-]*:/i.test(input)) return input;
    if (input.startsWith("/api/") && APP.runtime.apiBaseUrl) {
      return `${APP.runtime.apiBaseUrl}${input}`;
    }
    return input;
  }

  function resolveAssetUrl(path) {
    return new URL(path, window.location.href).toString();
  }

  const nativeFetch = window.fetch.bind(window);

  async function fetchWithTimeout(input, init, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || AUTH_REQUEST_TIMEOUT_MS));
    try {
      return await fetch(input, {
        ...(init || {}),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error?.name === "AbortError" || controller.signal.aborted;
      if (aborted) {
        const target = resolveRequestUrl(input);
        throw new Error(`请求超时：${typeof target === "string" ? target : "接口"} 无响应，请检查服务是否可访问。`);
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function buildNetworkFailureMessage(input, error) {
    const target = resolveRequestUrl(input);
    const targetText = typeof target === "string" ? target : "后端接口";
    const hints = [];
    const activeBase = APP.runtime.apiBaseUrl || APP.runtime.customApiBaseUrl || APP.runtime.defaultApiBaseUrl || "";

    if (APP.runtime.isLiteBackend) {
      hints.push("请先设置 DashScope API Key");
      hints.push("并确认手机可以联网");
    } else if (APP.runtime.isCapacitorShell) {
      if (!activeBase) {
        hints.push("请先设置服务地址");
      } else if (activeBase.includes("10.0.2.2")) {
        hints.push("10.0.2.2 仅适用于模拟器");
      } else {
        hints.push(`当前地址：${activeBase}`);
      }
      hints.push("确认手机与电脑在同一网络");
      hints.push("若浏览器也打不开，请检查防火墙");
    } else {
      hints.push("请确认服务已启动");
    }

    const detail = error?.message && error.message !== "Failed to fetch" ? `（${error.message}）` : "";
    return `无法连接后端 ${targetText}${detail}。${hints.join("；")}。`;
  }

  function shouldUseLiteBackendForRequest(input) {
    if (
      typeof input !== "string"
      || !input.startsWith("/api/")
      || !window.PhysicsAgentLiteBackend?.handleRequest
    ) {
      return false;
    }
    if (APP.runtime.isLiteBackend) {
      return true;
    }
    if (!APP.localApiMode) {
      return false;
    }
    return !input.startsWith("/api/auth/");
  }

  const fetch = async (input, init) => {
    const nextInit = { ...(init || {}) };
    const nextHeaders = new Headers(nextInit.headers || {});
    if (
      APP?.auth?.token
      && typeof input === "string"
      && input.startsWith("/api/")
      && !nextHeaders.has("Authorization")
    ) {
      nextHeaders.set("Authorization", `Bearer ${APP.auth.token}`);
    }
    nextInit.headers = nextHeaders;

    if (shouldUseLiteBackendForRequest(input)) {
      return await window.PhysicsAgentLiteBackend.handleRequest({ input, init: nextInit, runtime: APP.runtime });
    }
    try {
      return await nativeFetch(resolveRequestUrl(input), nextInit);
    } catch (error) {
      throw new Error(buildNetworkFailureMessage(input, error));
    }
  };

  const APP = {
    sessionId: getOrCreateSessionId(),
    runtime: loadRuntimeConfig(),
    auth: {
      enabled: true,
      token: loadAuthToken(),
      user: null,
      config: null,
      selectedRole: "teacher",
      smsCooldownUntil: 0,
      smsCooldownTimer: 0,
      backendReachable: true,
      bootstrapError: "",
      forceGateVisible: false,
      pendingAction: "",
    },
    localApiMode: false,
    uploadScope: "session",
    pendingImage: null,
    pendingAudio: null,
    history: loadHistory(),
    sessionCatalog: { folders: [], sessions: [] },
    teacherStats: {
      loading: false,
      loaded: false,
      error: "",
      data: null,
    },
    sending: false,
    mediaRecorder: null,
    recordingTimer: null,
    isHydrating: true,
    currentSessionTitle: "新对话",
    folderOpenMap: loadFolderOpenMap(),
    quickJumpItems: [],
    quickJumpActiveId: null,
    openMenuId: null,
    dragSessionId: null,
    installPromptEvent: null,
    phet: {
      isOpen: false,
      detailOpen: false,
      loading: false,
      error: "",
      updatedAt: "",
      total: 0,
      groups: [],
      activeTopic: "all",
      selectedSlug: "",
      mobileScreen: "catalog",
      frameReady: false,
      frameTimeoutId: 0,
      captureStream: null,
      captureVideo: null,
      captureCanvas: null,
      captureReady: false,
      captureNoticeShown: false,
    },
    webCamera: {
      stream: null,
      ready: false,
      opening: false,
    },
    courseLab: {
      isOpen: false,
      expId: "",
      focusSection: "overview",
    },
    dataLab: createDataLabState(),
    pendulum: {
      isOpen: false,
      videoFile: null,
      videoUrl: "",
      processedVideoUrl: "",
      processedVideoSource: "",
      processedVideoLoading: false,
      processedVideoError: "",
      result: null,
      status: "请选择单摆实验视频。",
      error: "",
      recordingStream: null,
      mediaRecorder: null,
      recordingChunks: [],
      recording: false,
      recordingDiscard: false,
      animationRaf: 0,
      animationStartedAt: 0,
    },
    torsion: {
      isOpen: false,
      videoFile: null,
      videoUrl: "",
      processedVideoUrl: "",
      processedVideoSource: "",
      processedVideoLoading: false,
      processedVideoError: "",
      result: null,
      status: "请选择扭摆实验视频。",
      error: "",
      liveStream: null,
      liveActive: false,
      liveTimer: 0,
      livePending: false,
      liveStartedAt: 0,
      liveFrameIndex: 0,
      liveDetectedFrames: 0,
      liveAngleOffsetDeg: null,
      liveInitialAngleDeg: null,
      liveLastRawAngleDeg: null,
      liveSeries: [],
      liveDetectorHits: { yolov5: 0, opencv: 0 },
      liveLastGeometry: null,
      liveFrameSize: null,
    },
    androidBack: {
      lastRootPressAt: 0,
      listenerReady: false,
      listenerHandle: null,
    },
  };

  const SIM = {
    currentExpId: "michelson",
    isOpen: false,
    canvasCssW: 0,
    canvasCssH: 0,
    timeSec: 0,
    lastFrameMs: 0,
    scheduledDrawRaf: 0,
    motion: "stable",
    lastControlAction: { expId: "", key: "", direction: 0 },
    params: {
      michelson: {
        lambdaNm: 632.8,
        displacementUm: 0,
        dBaseUm: 58,
        dAnimatedUm: 58,
      },
      "newton-rings": {
        lambdaNm: 546.1,
        curvatureMm: 1000,
        centerGapNm: 0,
        tiltUrad: 0,
        defectXmm: 0.0,
        defectYmm: 0.0,
        defectRadiusMm: 0.0,
        defectDepthNm: 0.0,
        actualCenterGapNm: null,
        actualCenterIntensityPct: null,
        measurementRecords: [],
      },
      "wheatstone-bridge": {
        ratio: 1,
        rsDigits: {
          d1000: 2,
          d100: 4,
          d10: 5,
          d1: 0,
        },
        rsOhm: 2450,
        rxOhm: randomWheatstoneUnknownRx(),
        supplyV: 3,
        switchPressed: false,
        deltaV: 0,
        needleAngleDeg: 0,
        targetNeedleDeg: 0,
        galvanometerMaxDeg: 34,
        galvanometerGainDegPerV: 120,
      },
      "bohr-resonance": {
        freqHz: 1.5,
        damping: 0.22,
        drive: 1.0,
        inertia: 1.0,
        naturalFreqHz: 1.5,
      },
      "spectrometer-prism": {
        prismAngleDeg: 60,
        telescopeDeg: 120,
        theta1Deg: null,
        theta2Deg: null,
        lastAlignedIndex: -1,
      },
      "torsion-pendulum": {
        objectKey: "empty-disk",
        theta0Deg: 32,
        currentThetaDeg: 32,
        prevThetaDeg: 32,
        simTimeSec: 0,
        isOscillating: true,
        damping: 0.015,
        torsionK: 0.12,
        diskInertia: 0.0064,
        knownInertia: 0.0088,
        objectInertia: {
          "empty-disk": 0,
          "standard-cylinder": 0.0088,
          "unknown-cylinder": 0.0126,
        },
        stopwatch: {
          running: false,
          startMs: 0,
          elapsedMs: 0,
          cycleCount: 0,
          targetCycles: 10,
        },
        measurements: {
          "empty-disk": null,
          "standard-cylinder": null,
          "unknown-cylinder": null,
        },
      },
      "double-arm-bridge": {
        ratio: 1.0,
        standardMilliOhm: 5.0,
        unknownMilliOhm: 4.8,
        leadMilliOhm: 0.45,
      },
      oscilloscope: {
        freqHz: 500,
        amplitudeV: 2.0,
        timebaseMs: 1.0,
      },
      "dielectric-constant": {
        epsilonR: 3.5,
        fillRatio: 0.65,
        baseCapPf: 42,
      },
      "franck-hertz": {
        acceleratingV: 24,
        retardingV: 1.5,
        excitationV: 4.9,
      },
      "grating-spectrum": {
        linesPerMm: 600,
        angleDeg: 18,
        sourceKey: "mercury",
        sourceProfiles: {
          mercury: {
            label: "汞灯",
            linesNm: [404.7, 435.8, 546.1, 577.0],
          },
          hydrogen: {
            label: "氢灯",
            linesNm: [410.2, 434.0, 486.1, 656.3],
          },
          sodium: {
            label: "钠灯",
            linesNm: [589.0, 589.6],
          },
        },
        spectralLinesNm: [404.7, 435.8, 546.1, 577.0],
      },
      "hall-effect": {
        magneticT: 0.55,
        currentMa: 10,
        hallCoeff: 0.18,
      },
      "potentiometer-emf": {
        emfV: 1.50,
        loadOhm: 8,
        internalOhm: 1.2,
        totalLengthCm: 100,
      },
      "photoelectric-effect": {
        freqThz: 650,
        reverseV: 1.0,
        thresholdThz: 470,
        intensity: 0.7,
      },
    },
    renderCache: {
      newton: {
        key: "",
        canvas: null,
        quality: "full",
      },
    },
  };

  const els = {
    authGate: document.getElementById("authGate"),
    openAuthGateBtn: document.getElementById("openAuthGateBtn"),
    closeAuthGateBtn: document.getElementById("closeAuthGateBtn"),
    authQuickLogoutBtn: document.getElementById("authQuickLogoutBtn"),
    authRoleSwitch: document.getElementById("authRoleSwitch"),
    authDisplayNameInput: document.getElementById("authDisplayNameInput"),
    authPhoneInput: document.getElementById("authPhoneInput"),
    authCodeInput: document.getElementById("authCodeInput"),
    authSendCodeBtn: document.getElementById("authSendCodeBtn"),
    authPhoneLoginBtn: document.getElementById("authPhoneLoginBtn"),
    authPhoneHint: document.getElementById("authPhoneHint"),
    authWechatBtn: document.getElementById("authWechatBtn"),
    authQqBtn: document.getElementById("authQqBtn"),
    authDemoBtn: document.getElementById("authDemoBtn"),
    authProviderStatus: document.getElementById("authProviderStatus"),
    authProviderHint: document.getElementById("authProviderHint"),
    authDebugCodeNotice: document.getElementById("authDebugCodeNotice"),
    authConnectionCard: document.getElementById("authConnectionCard"),
    authConnectionText: document.getElementById("authConnectionText"),
    authConfigureApiBaseBtn: document.getElementById("authConfigureApiBaseBtn"),

    userWorkspaceSection: document.getElementById("userWorkspaceSection"),
    userRoleBadge: document.getElementById("userRoleBadge"),
    userAvatar: document.getElementById("userAvatar"),
    userDisplayName: document.getElementById("userDisplayName"),
    userProviderMeta: document.getElementById("userProviderMeta"),
    logoutBtn: document.getElementById("logoutBtn"),
    teacherIsolationHint: document.getElementById("teacherIsolationHint"),
    studentIsolationHint: document.getElementById("studentIsolationHint"),
    teacherStatsSection: document.getElementById("teacherStatsSection"),
    teacherStatsMeta: document.getElementById("teacherStatsMeta"),
    teacherStatsQuestionCount: document.getElementById("teacherStatsQuestionCount"),
    teacherStatsStudentCount: document.getElementById("teacherStatsStudentCount"),
    teacherStatsSessionCount: document.getElementById("teacherStatsSessionCount"),
    refreshTeacherStatsBtn: document.getElementById("refreshTeacherStatsBtn"),
    exportTeacherStatsBtn: document.getElementById("exportTeacherStatsBtn"),
    teacherTopQuestions: document.getElementById("teacherTopQuestions"),
    teacherRecentQuestions: document.getElementById("teacherRecentQuestions"),

    uploadSection: document.getElementById("uploadSection"),
    uploadSectionMeta: document.getElementById("uploadSectionMeta"),
    uploadScopeSwitch: document.getElementById("uploadScopeSwitch"),
    uploadRoleHint: document.getElementById("uploadRoleHint"),
    fileInput: document.getElementById("fileInput"),
    uploadDropzone: document.getElementById("uploadDropzone"),
    nativeMediaActions: document.getElementById("nativeMediaActions"),
    takePhotoBtn: document.getElementById("takePhotoBtn"),
    pickPhotoBtn: document.getElementById("pickPhotoBtn"),
    uploadStatus: document.getElementById("uploadStatus"),
    uploadedFiles: document.getElementById("uploadedFiles"),
    clearDocsBtn: document.getElementById("clearDocsBtn"),
    pendingImageBar: document.getElementById("pendingImageBar"),
    pendingImageText: document.getElementById("pendingImageText"),
    clearPendingImageBtn: document.getElementById("clearPendingImageBtn"),
    pendingAudioBar: document.getElementById("pendingAudioBar"),
    pendingAudioText: document.getElementById("pendingAudioText"),
    clearPendingAudioBtn: document.getElementById("clearPendingAudioBtn"),

    historyList: document.getElementById("historyList"),
    clearHistoryBtn: document.getElementById("clearHistoryBtn"),
    newConversationBtn: document.getElementById("newConversationBtn"),
    newFolderBtn: document.getElementById("newFolderBtn"),
    installAppBtn: document.getElementById("installAppBtn"),
    mobileConnectionSection: document.getElementById("mobileConnectionSection"),
    configureApiBaseBtn: document.getElementById("configureApiBaseBtn"),
    apiBaseHint: document.getElementById("apiBaseHint"),
    modelKeySection: document.getElementById("modelKeySection"),
    configureModelApiKeyBtn: document.getElementById("configureModelApiKeyBtn"),
    modelApiKeyHint: document.getElementById("modelApiKeyHint"),

    chatMessages: document.getElementById("chatMessages"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    chatCameraBtn: document.getElementById("chatCameraBtn"),
    sendBtn: document.getElementById("sendBtn"),
    recordBtn: document.getElementById("recordBtn"),
    modelBadge: document.getElementById("modelBadge"),
    networkBadge: document.getElementById("networkBadge"),

    openLabMenuBtn: document.getElementById("openLabMenuBtn"),
    closeLabMenuBtn: document.getElementById("closeLabMenuBtn"),
    labMenuPanel: document.getElementById("labMenuPanel"),
    experimentLibraryContainer: document.getElementById("experimentLibraryContainer"),
    togglePhetWorkspaceBtn: document.getElementById("togglePhetWorkspaceBtn"),
    closePhetWorkspaceBtn: document.getElementById("closePhetWorkspaceBtn"),
    openDataLabBtn: document.getElementById("openDataLabBtn"),
    openPendulumLabBtn: document.getElementById("openPendulumLabBtn"),
    openTorsionLabBtn: document.getElementById("openTorsionLabBtn"),
    contentShell: document.getElementById("contentShell"),
    phetWorkspace: document.getElementById("phetWorkspace"),
    phetDetailModal: document.getElementById("phetDetailModal"),
    phetCatalogMeta: document.getElementById("phetCatalogMeta"),
    phetTopicTabs: document.getElementById("phetTopicTabs"),
    phetCatalogList: document.getElementById("phetCatalogList"),
    closePhetDetailBtn: document.getElementById("closePhetDetailBtn"),
    phetEmptyState: document.getElementById("phetEmptyState"),
    phetDetailContent: document.getElementById("phetDetailContent"),
    phetDetailTitle: document.getElementById("phetDetailTitle"),
    phetLanguageBadge: document.getElementById("phetLanguageBadge"),
    phetDetailMeta: document.getElementById("phetDetailMeta"),
    phetSaveImageBtn: document.getElementById("phetSaveImageBtn"),
    phetOpenNewWindowLink: document.getElementById("phetOpenNewWindowLink"),
    phetBackToCatalogBtn: document.getElementById("phetBackToCatalogBtn"),
    phetFrameNotice: document.getElementById("phetFrameNotice"),
    phetFrameLoading: document.getElementById("phetFrameLoading"),
    phetFrame: document.getElementById("phetFrame"),
    phetIntroText: document.getElementById("phetIntroText"),
    phetObservationList: document.getElementById("phetObservationList"),
    phetQuestionHintList: document.getElementById("phetQuestionHintList"),
    phetInterfaceGuidanceList: document.getElementById("phetInterfaceGuidanceList"),
    phetQuestionInput: document.getElementById("phetQuestionInput"),
    phetAskBtn: document.getElementById("phetAskBtn"),

    labDetailModal: document.getElementById("labDetailModal"),
    closeLabDetailBtn: document.getElementById("closeLabDetailBtn"),
    labDetailBackBtn: document.getElementById("labDetailBackBtn"),
    labDetailTitle: document.getElementById("labDetailTitle"),
    labDetailCategory: document.getElementById("labDetailCategory"),
    labDetailBrief: document.getElementById("labDetailBrief"),
    labDetailFormula: document.getElementById("labDetailFormula"),
    labDetailIntroText: document.getElementById("labDetailIntroText"),
    labDetailOutcomeList: document.getElementById("labDetailOutcomeList"),
    labDetailTipList: document.getElementById("labDetailTipList"),
    labDetailQuizList: document.getElementById("labDetailQuizList"),
    labDetailSimHint: document.getElementById("labDetailSimHint"),
    labDetailSimBtn: document.getElementById("labDetailSimBtn"),
    labDetailAskIntroBtn: document.getElementById("labDetailAskIntroBtn"),
    labDetailAskQuizBtn: document.getElementById("labDetailAskQuizBtn"),
    labDetailNav: document.getElementById("labDetailNav"),

    simulationModal: document.getElementById("simulationModal"),
    closeSimulationBtn: document.getElementById("closeSimulationBtn"),
    saveSimulationImageBtn: document.getElementById("saveSimulationImageBtn"),
    simulationCanvas: document.getElementById("simulationCanvas"),
    simulationModalTitle: document.getElementById("simulationModalTitle"),
    simulationModalSubtitle: document.querySelector("#simulationModal .modal-header p"),
    simReadout: document.getElementById("simReadout"),
    simLambdaRange: document.getElementById("simLambdaRange"),
    simLambdaLabel: document.querySelector('label[for="simLambdaRange"]'),
    simLambdaValue: document.getElementById("simLambdaValue"),
    simLambdaNumberWrap: document.getElementById("simLambdaNumberWrap"),
    simLambdaNumber: document.getElementById("simLambdaNumber"),
    simLambdaUnit: document.getElementById("simLambdaUnit"),
    simDisplacementRange: document.getElementById("simDisplacementRange"),
    simDisplacementLabel: document.querySelector('label[for="simDisplacementRange"]'),
    simDisplacementValue: document.getElementById("simDisplacementValue"),
    simDisplacementNumberWrap: document.getElementById("simDisplacementNumberWrap"),
    simDisplacementNumber: document.getElementById("simDisplacementNumber"),
    simDisplacementUnit: document.getElementById("simDisplacementUnit"),
    simColorName: document.getElementById("simColorName"),
    simColorLabel: document.querySelector("#simColorName")?.previousElementSibling,
    simOpdValue: document.getElementById("simOpdValue"),
    simOpdLabel: document.querySelector("#simOpdValue")?.previousElementSibling,
    simFringeCount: document.getElementById("simFringeCount"),
    simFringeLabel: document.querySelector("#simFringeCount")?.previousElementSibling,
    invokeAgentFromSimBtn: document.getElementById("invokeAgentFromSimBtn"),

    dataLabModal: document.getElementById("dataLabModal"),
    closeDataLabBtn: document.getElementById("closeDataLabBtn"),
    dataLabApplyBtn: document.getElementById("dataLabApplyBtn"),
    dataLabClearPointsBtn: document.getElementById("dataLabClearPointsBtn"),
    dataLabUseForceExampleBtn: document.getElementById("dataLabUseForceExampleBtn"),
    dataLabUseCurrentExampleBtn: document.getElementById("dataLabUseCurrentExampleBtn"),
    dataLabSendToChatBtn: document.getElementById("dataLabSendToChatBtn"),
    dataLabFitType: document.getElementById("dataLabFitType"),
    dataLabPointXInput: document.getElementById("dataLabPointXInput"),
    dataLabPointYInput: document.getElementById("dataLabPointYInput"),
    dataLabXBUncertainty: document.getElementById("dataLabXBUncertainty"),
    dataLabYBUncertainty: document.getElementById("dataLabYBUncertainty"),
    dataLabAddPointBtn: document.getElementById("dataLabAddPointBtn"),
    dataLabPointList: document.getElementById("dataLabPointList"),
    dataLabPointCount: document.getElementById("dataLabPointCount"),
    dataLabXPreset: document.getElementById("dataLabXPreset"),
    dataLabXLabel: document.getElementById("dataLabXLabel"),
    dataLabXUnit: document.getElementById("dataLabXUnit"),
    dataLabXExpression: document.getElementById("dataLabXExpression"),
    dataLabYPreset: document.getElementById("dataLabYPreset"),
    dataLabYLabel: document.getElementById("dataLabYLabel"),
    dataLabYUnit: document.getElementById("dataLabYUnit"),
    dataLabYExpression: document.getElementById("dataLabYExpression"),
    dataLabTableInput: document.getElementById("dataLabTableInput"),
    dataLabUncertaintyList: document.getElementById("dataLabUncertaintyList"),
    dataLabPlot: document.getElementById("dataLabPlot"),
    dataLabPlotCaption: document.getElementById("dataLabPlotCaption"),
    dataLabStats: document.getElementById("dataLabStats"),
    dataLabResultSummary: document.getElementById("dataLabResultSummary"),
    dataLabResultTableBody: document.getElementById("dataLabResultTableBody"),
    dataLabStatus: document.getElementById("dataLabStatus"),
    pendulumLabModal: document.getElementById("pendulumLabModal"),
    closePendulumLabBtn: document.getElementById("closePendulumLabBtn"),
    pendulumAnalyzeBtn: document.getElementById("pendulumAnalyzeBtn"),
    pendulumClearBtn: document.getElementById("pendulumClearBtn"),
    pendulumVideoInput: document.getElementById("pendulumVideoInput"),
    pendulumPickVideoBtn: document.getElementById("pendulumPickVideoBtn"),
    pendulumRecordBtn: document.getElementById("pendulumRecordBtn"),
    pendulumVideoDropzone: document.getElementById("pendulumVideoDropzone"),
    pendulumVideoPreview: document.getElementById("pendulumVideoPreview"),
    pendulumVideoMeta: document.getElementById("pendulumVideoMeta"),
    pendulumLengthInput: document.getElementById("pendulumLengthInput"),
    pendulumGravityInput: document.getElementById("pendulumGravityInput"),
    pendulumDetectorSelect: document.getElementById("pendulumDetectorSelect"),
    pendulumStatus: document.getElementById("pendulumStatus"),
    pendulumDetectionMeta: document.getElementById("pendulumDetectionMeta"),
    pendulumMetricExp: document.getElementById("pendulumMetricExp"),
    pendulumMetricTheory: document.getElementById("pendulumMetricTheory"),
    pendulumMetricError: document.getElementById("pendulumMetricError"),
    pendulumMetricStability: document.getElementById("pendulumMetricStability"),
    pendulumCurveCaption: document.getElementById("pendulumCurveCaption"),
    pendulumCurvePlot: document.getElementById("pendulumCurvePlot"),
    pendulumTrajectoryCanvas: document.getElementById("pendulumTrajectoryCanvas"),
    pendulumProcessedVideo: document.getElementById("pendulumProcessedVideo"),
    pendulumProcessedMeta: document.getElementById("pendulumProcessedMeta"),
    pendulumProcessedPlaceholder: document.getElementById("pendulumProcessedPlaceholder"),
    pendulumResultSummary: document.getElementById("pendulumResultSummary"),
    pendulumSendToChatBtn: document.getElementById("pendulumSendToChatBtn"),
    torsionLabModal: document.getElementById("torsionLabModal"),
    closeTorsionLabBtn: document.getElementById("closeTorsionLabBtn"),
    torsionAnalyzeBtn: document.getElementById("torsionAnalyzeBtn"),
    torsionClearBtn: document.getElementById("torsionClearBtn"),
    torsionVideoInput: document.getElementById("torsionVideoInput"),
    torsionPickVideoBtn: document.getElementById("torsionPickVideoBtn"),
    torsionLiveBtn: document.getElementById("torsionLiveBtn"),
    torsionVideoDropzone: document.getElementById("torsionVideoDropzone"),
    torsionVideoPreview: document.getElementById("torsionVideoPreview"),
    torsionLiveOverlayCanvas: document.getElementById("torsionLiveOverlayCanvas"),
    torsionVideoMeta: document.getElementById("torsionVideoMeta"),
    torsionKappaInput: document.getElementById("torsionKappaInput"),
    torsionCalibrationInertiaInput: document.getElementById("torsionCalibrationInertiaInput"),
    torsionCalibrationPeriodInput: document.getElementById("torsionCalibrationPeriodInput"),
    torsionInitialAngleInput: document.getElementById("torsionInitialAngleInput"),
    torsionDetectorSelect: document.getElementById("torsionDetectorSelect"),
    torsionStatus: document.getElementById("torsionStatus"),
    torsionDetectionMeta: document.getElementById("torsionDetectionMeta"),
    torsionMetricPeriod: document.getElementById("torsionMetricPeriod"),
    torsionMetricInertia: document.getElementById("torsionMetricInertia"),
    torsionMetricKappa: document.getElementById("torsionMetricKappa"),
    torsionMetricStability: document.getElementById("torsionMetricStability"),
    torsionCurveCaption: document.getElementById("torsionCurveCaption"),
    torsionCurvePlot: document.getElementById("torsionCurvePlot"),
    torsionProcessedVideo: document.getElementById("torsionProcessedVideo"),
    torsionProcessedMeta: document.getElementById("torsionProcessedMeta"),
    torsionProcessedPlaceholder: document.getElementById("torsionProcessedPlaceholder"),
    torsionResultSummary: document.getElementById("torsionResultSummary"),
    torsionSendToChatBtn: document.getElementById("torsionSendToChatBtn"),
    webCameraModal: document.getElementById("webCameraModal"),
    closeWebCameraBtn: document.getElementById("closeWebCameraBtn"),
    webCameraVideo: document.getElementById("webCameraVideo"),
    webCameraCanvas: document.getElementById("webCameraCanvas"),
    webCameraPlaceholder: document.getElementById("webCameraPlaceholder"),
    webCameraStatus: document.getElementById("webCameraStatus"),
    webCameraAlbumBtn: document.getElementById("webCameraAlbumBtn"),
    webCameraCaptureBtn: document.getElementById("webCameraCaptureBtn"),

    toastRoot: document.getElementById("toastRoot"),
    quickJumpPanel: document.getElementById("quickJumpPanel"),
    quickJumpList: document.getElementById("quickJumpList"),
  };

  if (!els.chatForm || !els.chatInput || !els.experimentLibraryContainer || !els.simulationCanvas) {
    return;
  }

  const simCtx = els.simulationCanvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!simCtx) return;

  if (window.marked?.setOptions) {
    marked.setOptions({ gfm: true, breaks: true });
  }

  renderExperimentLibrary();
  renderPhetWorkspace();
  bindEvents();
  renderHistory();
  updatePendingAttachmentBars();
  syncInstallButtonState();
  syncMobileConnectionUi();
  syncModelKeyUi();
  syncNativeMediaUi();
  syncImmersiveState();
  ensureUiHistoryBase();
  registerNativeBackButtonHandler().catch(() => {});
  updateNetworkBadge();
  registerAndroidPwaSupport();
  if (APP.runtime.isLiteBackend) {
    window.PhysicsAgentLiteBackend?.preload?.().catch(() => {});
  }
  configureSimulationUI("michelson");
  ensureSimulationCanvasSize();
  startSimulationLoop();
  initializeDataLab();
  renderPendulumLab();
  renderTorsionLab();
  if (!APP.runtime.isLiteBackend) {
    APP.auth.forceGateVisible = shouldAutoPresentAuthGate() || !APP.auth.token;
    syncAuthUi();
  }
  bootstrapWorkspace().catch((error) => {
    APP.isHydrating = false;
    APP.auth.user = null;
    APP.auth.pendingAction = "";
    APP.auth.backendReachable = false;
    APP.auth.bootstrapError = error?.message || "后端连接失败";
    APP.auth.config = APP.auth.config || { providers: [], sms: { enabled: false } };
    APP.sessionCatalog = { folders: [], sessions: [] };
    APP.history = [];
    els.chatMessages.innerHTML = "";
    renderHistory();
    refreshQuickJumpPanel();
    renderUploadedFileList([]);
    setUploadStatus("当前无法连接后端，请先配置可访问的服务地址");
    syncAuthUi();
    setAuthGateVisible(true);
    const mobileHint = APP.runtime.isLiteBackend
      ? "请先设置 DashScope API Key。"
      : APP.runtime.isCapacitorShell && APP.runtime.showConnectionSettings
        ? "请先设置可访问的服务地址。"
        : "";
    showToast(`工作区初始化失败：${error.message}${mobileHint ? `。${mobileHint}` : ""}`);
  });

  function bindEvents() {
    els.openAuthGateBtn?.addEventListener("click", () => {
      if (APP.auth.user?.display_name && els.authDisplayNameInput && !els.authDisplayNameInput.value.trim()) {
        els.authDisplayNameInput.value = APP.auth.user.display_name;
      }
      if (APP.auth.user?.role) {
        APP.auth.selectedRole = APP.auth.user.role;
      }
      APP.auth.forceGateVisible = true;
      syncAuthUi();
    });

    els.closeAuthGateBtn?.addEventListener("click", () => {
      APP.auth.forceGateVisible = false;
      syncAuthUi();
    });

    els.authRoleSwitch?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-auth-role]");
      if (!button) return;
      APP.auth.selectedRole = button.getAttribute("data-auth-role") || "teacher";
      els.authRoleSwitch.querySelectorAll("[data-auth-role]").forEach((node) => {
        const active = node === button;
        node.classList.toggle("active", active);
        node.setAttribute("aria-selected", active ? "true" : "false");
      });
      setAuthDebugNotice("", { visible: false });
      updatePhoneAuthHint();
    });

    [els.authWechatBtn, els.authQqBtn, els.authDemoBtn].forEach((button) => {
      button?.addEventListener("click", async () => {
        try {
          await handleAuthProviderLogin(button.getAttribute("data-auth-provider"));
        } catch (error) {
          showToast(`登录失败：${error.message}`);
        }
      });
    });

    els.authSendCodeBtn?.addEventListener("click", async () => {
      try {
        await handlePhoneCodeSend();
      } catch (error) {
        showToast(`发送失败：${error.message}`);
      }
    });

    els.authPhoneLoginBtn?.addEventListener("click", async () => {
      try {
        await handlePhoneCodeLogin();
      } catch (error) {
        showToast(`登录失败：${error.message}`);
      }
    });

    els.authCodeInput?.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      try {
        await handlePhoneCodeLogin();
      } catch (error) {
        showToast(`登录失败：${error.message}`);
      }
    });

    els.logoutBtn?.addEventListener("click", async () => {
      await logoutCurrentUser();
    });

    els.authQuickLogoutBtn?.addEventListener("click", async () => {
      await logoutCurrentUser();
    });

    els.uploadScopeSwitch?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-upload-scope]");
      if (!button) return;
      APP.uploadScope = button.getAttribute("data-upload-scope") || "session";
      syncUploadScopeUi();
      setUploadStatus(APP.uploadScope === "teacher_kb" ? "即将上传到教师知识库" : "即将上传到当前对话");
    });

    els.chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = els.chatInput.value.trim();
      if (!text && !APP.pendingImage && !APP.pendingAudio) return;
      sendMessage(text);
    });

    els.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        els.chatForm.requestSubmit();
      }
    });

    els.chatInput.addEventListener("input", () => {
      autoResizeTextarea(els.chatInput);
    });

    els.fileInput?.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      await uploadFiles(files);
      els.fileInput.value = "";
    });

    els.chatCameraBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleNativeMediaMenu();
    });

    els.takePhotoBtn?.addEventListener("click", async () => {
      closeNativeMediaMenu();
      await handleNativePhotoSelection("camera");
    });

    els.pickPhotoBtn?.addEventListener("click", async () => {
      closeNativeMediaMenu();
      await handleNativePhotoSelection("photos");
    });

    ["dragenter", "dragover"].forEach((name) => {
      els.uploadDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.uploadDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      els.uploadDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.uploadDropzone.classList.remove("dragover");
      });
    });

    els.uploadDropzone?.addEventListener("drop", async (event) => {
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      await uploadFiles(files);
    });

    els.clearPendingImageBtn?.addEventListener("click", () => {
      APP.pendingImage = null;
      updatePendingAttachmentBars();
    });

    els.clearPendingAudioBtn?.addEventListener("click", () => {
      APP.pendingAudio = null;
      updatePendingAttachmentBars();
    });

    els.clearDocsBtn?.addEventListener("click", async () => {
      await clearDocuments();
    });

    els.clearHistoryBtn?.addEventListener("click", async () => {
      await clearConversationHistory();
    });

    els.refreshTeacherStatsBtn?.addEventListener("click", async () => {
      await loadTeacherStats({ force: true });
    });

    els.exportTeacherStatsBtn?.addEventListener("click", async () => {
      await exportTeacherStats();
    });

    els.newConversationBtn?.addEventListener("click", async () => {
      await startNewConversation();
    });

    els.newFolderBtn?.addEventListener("click", async () => {
      await createFolderInteractive();
    });

    els.installAppBtn?.addEventListener("click", async () => {
      await handleInstallApp();
    });

    els.configureApiBaseBtn?.addEventListener("click", async () => {
      await configureApiBaseUrlInteractive();
    });

    els.authConfigureApiBaseBtn?.addEventListener("click", async () => {
      await configureApiBaseUrlInteractive();
    });

    els.configureModelApiKeyBtn?.addEventListener("click", async () => {
      await configureModelApiKeyInteractive();
    });

    els.togglePhetWorkspaceBtn?.addEventListener("click", async () => {
      if (APP.phet.isOpen) {
        closePhetWorkspace();
        return;
      }
      await openPhetWorkspace();
    });

    els.openDataLabBtn?.addEventListener("click", () => {
      openDataLabModal();
    });

    els.openPendulumLabBtn?.addEventListener("click", () => {
      openPendulumLabModal();
    });

    els.openTorsionLabBtn?.addEventListener("click", () => {
      openTorsionLabModal();
    });

    els.closePhetWorkspaceBtn?.addEventListener("click", () => {
      closePhetWorkspace();
    });

    els.phetWorkspace?.addEventListener("click", (event) => {
      if (event.target === els.phetWorkspace) {
        closePhetWorkspace();
      }
    });

    els.closeDataLabBtn?.addEventListener("click", () => {
      closeDataLabModal();
    });

    els.closePendulumLabBtn?.addEventListener("click", () => {
      closePendulumLabModal();
    });

    els.closeTorsionLabBtn?.addEventListener("click", () => {
      closeTorsionLabModal();
    });

    els.dataLabModal?.addEventListener("click", (event) => {
      if (event.target === els.dataLabModal) {
        closeDataLabModal();
      }
    });

    els.pendulumLabModal?.addEventListener("click", (event) => {
      if (event.target === els.pendulumLabModal) {
        closePendulumLabModal();
      }
    });

    els.torsionLabModal?.addEventListener("click", (event) => {
      if (event.target === els.torsionLabModal) {
        closeTorsionLabModal();
      }
    });

    els.pendulumPickVideoBtn?.addEventListener("click", () => {
      els.pendulumVideoInput?.click();
    });

    els.pendulumVideoDropzone?.addEventListener("click", () => {
      els.pendulumVideoInput?.click();
    });

    els.pendulumVideoInput?.addEventListener("change", (event) => {
      const file = Array.from(event.target.files || [])[0];
      if (file) {
        setPendulumVideoFile(file);
      }
      event.target.value = "";
    });

    ["dragenter", "dragover"].forEach((name) => {
      els.pendulumVideoDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.pendulumVideoDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      els.pendulumVideoDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.pendulumVideoDropzone.classList.remove("dragover");
      });
    });

    els.pendulumVideoDropzone?.addEventListener("drop", (event) => {
      const file = Array.from(event.dataTransfer?.files || [])[0];
      if (file) {
        setPendulumVideoFile(file);
      }
    });

    els.pendulumAnalyzeBtn?.addEventListener("click", async () => {
      await analyzePendulumVideo({ prompt: "请根据这个单摆实验视频测量周期，并分析误差来源。" });
    });

    els.pendulumRecordBtn?.addEventListener("click", async () => {
      await togglePendulumRecording();
    });

    els.pendulumClearBtn?.addEventListener("click", () => {
      resetPendulumLab();
    });

    els.pendulumDetectorSelect?.addEventListener("change", () => {
      APP.pendulum.status = pendulumDetectorHint(els.pendulumDetectorSelect?.value || "auto");
      APP.pendulum.error = "";
      renderPendulumLab();
    });

    els.pendulumSendToChatBtn?.addEventListener("click", () => {
      sendPendulumResultToChat();
    });

    els.pendulumProcessedVideo?.addEventListener("error", () => {
      handlePendulumProcessedVideoPlaybackError();
    });

    els.torsionPickVideoBtn?.addEventListener("click", () => {
      els.torsionVideoInput?.click();
    });

    els.torsionLiveBtn?.addEventListener("click", async () => {
      if (APP.torsion.liveActive) {
        stopTorsionLiveAnalysis();
      } else {
        await startTorsionLiveAnalysis();
      }
    });

    els.torsionVideoDropzone?.addEventListener("click", () => {
      els.torsionVideoInput?.click();
    });

    els.torsionVideoInput?.addEventListener("change", (event) => {
      const file = Array.from(event.target.files || [])[0];
      if (file) setTorsionVideoFile(file);
      event.target.value = "";
    });

    ["dragenter", "dragover"].forEach((name) => {
      els.torsionVideoDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.torsionVideoDropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      els.torsionVideoDropzone?.addEventListener(name, (event) => {
        event.preventDefault();
        event.stopPropagation();
        els.torsionVideoDropzone.classList.remove("dragover");
      });
    });

    els.torsionVideoDropzone?.addEventListener("drop", (event) => {
      const file = Array.from(event.dataTransfer?.files || [])[0];
      if (file) setTorsionVideoFile(file);
    });

    els.torsionAnalyzeBtn?.addEventListener("click", async () => {
      await analyzeTorsionVideo({ prompt: "请根据这个扭摆实验视频测量周期并计算转动惯量。" });
    });

    els.torsionClearBtn?.addEventListener("click", () => {
      resetTorsionLab();
    });

    els.torsionDetectorSelect?.addEventListener("change", () => {
      APP.torsion.status = torsionDetectorHint(els.torsionDetectorSelect?.value || "auto");
      APP.torsion.error = "";
      renderTorsionLab();
    });

    els.torsionSendToChatBtn?.addEventListener("click", () => {
      sendTorsionResultToChat();
    });

    els.torsionProcessedVideo?.addEventListener("error", () => {
      handleTorsionProcessedVideoPlaybackError();
    });

    els.closeWebCameraBtn?.addEventListener("click", () => {
      closeWebCameraModal();
    });

    els.webCameraModal?.addEventListener("click", (event) => {
      if (event.target === els.webCameraModal) {
        closeWebCameraModal();
      }
    });

    els.webCameraAlbumBtn?.addEventListener("click", async () => {
      closeWebCameraModal();
      await openFallbackImagePicker({ capture: false, sourceLabel: "相册图片" });
    });

    els.webCameraCaptureBtn?.addEventListener("click", async () => {
      try {
        await captureWebCameraPhoto();
      } catch (error) {
        showToast(`拍照失败：${error.message || "未知错误"}`);
      }
    });

    els.dataLabApplyBtn?.addEventListener("click", () => {
      refreshDataLabComputation();
    });

    els.dataLabClearPointsBtn?.addEventListener("click", () => {
      clearDataLabPoints();
    });

    els.dataLabUseForceExampleBtn?.addEventListener("click", () => {
      applyDataLabSample("force-extension");
    });

    els.dataLabUseCurrentExampleBtn?.addEventListener("click", () => {
      applyDataLabSample("current-voltage");
    });

    els.dataLabSendToChatBtn?.addEventListener("click", () => {
      sendDataLabSummaryToChat();
    });

    [els.dataLabXPreset, els.dataLabYPreset].forEach((select) => {
      select?.addEventListener("change", (event) => {
        handleDataLabPresetChange(event.currentTarget);
      });
    });

    [
      els.dataLabXUnit,
      els.dataLabYUnit,
      els.dataLabFitType,
      els.dataLabXBUncertainty,
      els.dataLabYBUncertainty,
    ].forEach((input) => {
      input?.addEventListener("input", () => {
        syncDataLabStateFromInputs();
        refreshDataLabComputation({ silent: true });
      });
      input?.addEventListener("change", () => {
        syncDataLabStateFromInputs();
        refreshDataLabComputation({ silent: true });
      });
    });

    [els.dataLabPointXInput, els.dataLabPointYInput].forEach((input) => {
      input?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        addDataLabPointFromDraft();
      });
    });

    els.dataLabAddPointBtn?.addEventListener("click", () => {
      addDataLabPointFromDraft();
    });

    els.dataLabPointList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-point-index]");
      if (!button) return;
      const index = Number(button.getAttribute("data-remove-point-index"));
      if (!Number.isInteger(index) || index < 0) return;
      removeDataLabPoint(index);
    });

    els.phetBackToCatalogBtn?.addEventListener("click", () => {
      closePhetDetail();
    });

    els.closePhetDetailBtn?.addEventListener("click", () => {
      closePhetDetail();
    });

    els.phetDetailModal?.addEventListener("click", (event) => {
      if (event.target === els.phetDetailModal) {
        closePhetDetail();
      }
    });

    els.phetTopicTabs?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-topic-key]");
      if (!button) return;
      APP.phet.activeTopic = button.getAttribute("data-topic-key") || "all";
      ensurePhetSelection();
      renderPhetTopicTabs();
      renderPhetCatalog();
      renderPhetDetail();
    });

    els.phetCatalogList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-phet-slug]");
      if (!button) return;
      const slug = button.getAttribute("data-phet-slug");
      if (!slug) return;
      openPhetDetail(slug);
    });

    els.phetQuestionHintList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-suggestion]");
      if (!button || !els.phetQuestionInput) return;
      els.phetQuestionInput.value = button.getAttribute("data-suggestion") || "";
      autoResizeTextarea(els.phetQuestionInput);
      els.phetQuestionInput.focus();
    });

    els.phetSaveImageBtn?.addEventListener("click", async () => {
      await savePhetExperimentImage();
    });

    els.phetAskBtn?.addEventListener("click", async () => {
      await askFromPhetWorkspace();
    });

    els.phetQuestionInput?.addEventListener("keydown", async (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        await askFromPhetWorkspace();
      }
    });

    els.phetQuestionInput?.addEventListener("input", () => {
      autoResizeTextarea(els.phetQuestionInput);
    });

    els.phetFrame?.addEventListener("load", () => {
      APP.phet.frameReady = true;
      clearTimeout(APP.phet.frameTimeoutId);
      APP.phet.frameTimeoutId = 0;
      els.phetFrameLoading?.classList.add("hidden");
      els.phetFrameNotice?.classList.add("hidden");
    });

    els.recordBtn?.addEventListener("click", async () => {
      if (APP.mediaRecorder?.state === "recording") {
        stopRecording();
        return;
      }
      await startRecording();
    });

    window.addEventListener("beforeunload", () => {
      stopPhetCaptureStream();
      stopWebCameraStream();
      stopPendulumRecording({ discard: true });
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".session-tree")) {
        closeFloatingMenus();
      }
      if (!event.target.closest(".chat-media-entry")) {
        closeNativeMediaMenu();
      }
    });

    els.historyList?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (button) {
        event.stopPropagation();
        const action = button.getAttribute("data-action");
        const sessionId = button.getAttribute("data-session-id");
        const folderId = button.getAttribute("data-folder-id");

        if (action === "toggle-folder" && folderId) {
          APP.folderOpenMap[folderId] = !APP.folderOpenMap[folderId];
          saveFolderOpenMap(APP.folderOpenMap);
          renderHistory();
          return;
        }
        if (action === "toggle-folder-menu" && folderId) {
          toggleFloatingMenu(`folder:${folderId}`);
          return;
        }
        if (action === "toggle-session-menu" && sessionId) {
          toggleFloatingMenu(`session:${sessionId}`);
          return;
        }
        if (action === "rename-folder" && folderId) {
          closeFloatingMenus();
          await renameFolderInteractive(folderId);
          return;
        }
        if (action === "new-session-in-folder" && folderId) {
          closeFloatingMenus();
          await createProjectConversation(folderId);
          return;
        }
        if (action === "delete-folder" && folderId) {
          closeFloatingMenus();
          await deleteFolderInteractive(folderId);
          return;
        }
        if (action === "rename-session" && sessionId) {
          closeFloatingMenus();
          await renameSessionInteractive(sessionId);
          return;
        }
        if (action === "move-session-picker" && sessionId) {
          closeFloatingMenus();
          await moveSessionInteractive(sessionId);
          return;
        }
        if (action === "move-session-root" && sessionId) {
          closeFloatingMenus();
          await moveSessionToFolder(sessionId, null);
          return;
        }
        if (action === "delete-session" && sessionId) {
          closeFloatingMenus();
          await deleteSessionInteractive(sessionId);
          return;
        }
      }

      const sessionRow = event.target.closest("[data-session-id].session-row");
      if (sessionRow) {
        const sessionId = sessionRow.getAttribute("data-session-id");
        if (sessionId && sessionId !== APP.sessionId) {
          await switchConversation(sessionId);
        }
      }
    });

    els.historyList?.addEventListener("dragstart", (event) => {
      const sessionRow = event.target.closest("[data-session-id].session-row");
      if (!sessionRow) return;
      const sessionId = sessionRow.getAttribute("data-session-id");
      if (!sessionId) return;
      APP.dragSessionId = sessionId;
      closeFloatingMenus();
      sessionRow.classList.add("dragging");
      event.dataTransfer?.setData("text/plain", sessionId);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
      }
    });

    els.historyList?.addEventListener("dragend", () => {
      APP.dragSessionId = null;
      clearDropTargets();
      els.historyList.querySelectorAll(".session-row.dragging").forEach((node) => {
        node.classList.remove("dragging");
      });
    });

    els.historyList?.addEventListener("dragover", (event) => {
      const dropZone = event.target.closest("[data-drop-folder]");
      if (!dropZone || !APP.dragSessionId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      clearDropTargets();
      dropZone.classList.add("drag-over");
    });

    els.historyList?.addEventListener("drop", async (event) => {
      const dropZone = event.target.closest("[data-drop-folder]");
      const sessionId = APP.dragSessionId || event.dataTransfer?.getData("text/plain");
      clearDropTargets();
      if (!dropZone || !sessionId) return;
      event.preventDefault();
      APP.dragSessionId = null;
      const folderId = dropZone.getAttribute("data-drop-folder");
      await moveSessionToFolder(sessionId, folderId === "root" ? null : folderId);
    });

    els.historyList?.addEventListener("scroll", () => {
      syncOpenMenuPlacement();
    });

    els.quickJumpList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-target-id]");
      if (!button) return;
      const targetId = button.getAttribute("data-target-id");
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    els.chatMessages?.addEventListener("scroll", () => {
      updateQuickJumpActive();
    });

    els.openLabMenuBtn?.addEventListener("click", () => {
      const willOpen = els.labMenuPanel.classList.contains("hidden");
      els.labMenuPanel.classList.toggle("hidden");
      els.openLabMenuBtn.setAttribute("aria-expanded", String(willOpen));
    });

    els.closeLabMenuBtn?.addEventListener("click", () => {
      els.labMenuPanel.classList.add("hidden");
      els.openLabMenuBtn.setAttribute("aria-expanded", "false");
    });

    els.experimentLibraryContainer.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("button[data-action]");
      if (!actionBtn) return;

      const expCard = actionBtn.closest("[data-exp-id]");
      if (!expCard) return;

      const expId = expCard.getAttribute("data-exp-id");
      const experiment = experimentMap.get(expId);
      if (!experiment) return;

      const action = actionBtn.getAttribute("data-action");

      if (action === "open-detail") {
        openCourseLabDetail(expId);
        return;
      }

      if (action === "principles") {
        openCourseLabDetail(expId, { section: "overview" });
        return;
      }

      if (action === "questions") {
        openCourseLabDetail(expId, { section: "quiz" });
        return;
      }

      if (action === "simulate") {
        if (implementedSimulationIds.has(experiment.id)) {
          openCourseLabDetail(expId, { section: "simulation" });
          launchExperimentSimulation(expId);
          return;
        }
        openCourseLabDetail(expId, { section: "simulation" });
      }
    });

    els.closeLabDetailBtn?.addEventListener("click", closeCourseLabDetail);
    els.labDetailBackBtn?.addEventListener("click", closeCourseLabDetail);
    els.labDetailModal?.addEventListener("click", (event) => {
      if (event.target === els.labDetailModal) {
        closeCourseLabDetail();
      }
    });
    els.labDetailSimBtn?.addEventListener("click", () => {
      const experiment = experimentMap.get(APP.courseLab.expId);
      if (!experiment) return;
      if (implementedSimulationIds.has(experiment.id)) {
        launchExperimentSimulation(experiment.id);
        return;
      }
      openSimulationPlaceholder(experiment);
    });
    els.labDetailAskIntroBtn?.addEventListener("click", () => {
      const experiment = experimentMap.get(APP.courseLab.expId);
      if (!experiment) return;
      fillAndSendPrompt(buildExperimentPrinciplePrompt(experiment));
    });
    els.labDetailAskQuizBtn?.addEventListener("click", () => {
      const experiment = experimentMap.get(APP.courseLab.expId);
      if (!experiment) return;
      fillAndSendPrompt(buildExperimentQuizPrompt(experiment));
    });
    els.labDetailNav?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-lab-section]");
      if (!button) return;
      const section = button.getAttribute("data-lab-section") || "overview";
      APP.courseLab.focusSection = section;
      syncCourseLabNavState();
      focusCourseLabSection(section);
    });

    els.closeSimulationBtn?.addEventListener("click", closeSimulationModal);
    els.saveSimulationImageBtn?.addEventListener("click", async () => {
      await saveCurrentSimulationImage();
    });
    els.simulationModal?.addEventListener("click", (event) => {
      if (event.target === els.simulationModal) {
        closeSimulationModal();
      }
    });

    els.simLambdaRange?.addEventListener("input", (event) => {
      onSimulationSliderInput(1, Number.parseFloat(event.target.value));
    });

    els.simLambdaRange?.addEventListener("change", () => {
      if (SIM.currentExpId === "torsion-pendulum") {
        releaseTorsionOscillation();
      }
    });

    els.simLambdaNumber?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.target.blur();
    });

    els.simLambdaNumber?.addEventListener("change", (event) => {
      if (SIM.currentExpId !== "newton-rings") return;
      const value = normalizeSimulationNumberInputValue(event.target);
      if (!Number.isFinite(value)) {
        syncSimulationNumberInputValue(els.simLambdaNumber, SIM.params["newton-rings"].lambdaNm);
        return;
      }
      onSimulationSliderInput(1, value);
    });

    els.simDisplacementRange?.addEventListener("input", (event) => {
      onSimulationSliderInput(2, Number.parseFloat(event.target.value));
    });

    els.simDisplacementNumber?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.target.blur();
    });

    els.simDisplacementNumber?.addEventListener("change", (event) => {
      if (SIM.currentExpId !== "newton-rings") return;
      const value = normalizeSimulationNumberInputValue(event.target);
      if (!Number.isFinite(value)) {
        syncSimulationNumberInputValue(els.simDisplacementNumber, SIM.params["newton-rings"].curvatureMm);
        return;
      }
      onSimulationSliderInput(2, value);
    });

    els.invokeAgentFromSimBtn?.addEventListener("click", () => {
      const prompt = buildSimulationPrompt(SIM.currentExpId);
      closeSimulationModal();
      fillAndSendPrompt(prompt);
    });

    window.addEventListener("resize", () => {
      ensureSimulationCanvasSize();
      if (SIM.currentExpId === "newton-rings") {
        renderNewtonChartPanel();
      }
      syncOpenMenuPlacement();
      if (APP.phet.isOpen) {
        renderPhetWorkspace();
      }
      if (APP.pendulum.isOpen && APP.pendulum.result) {
        renderPendulumTrajectoryFrame(performance.now());
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && els.chatCameraBtn && !els.chatCameraBtn.classList.contains("hidden") && !els.nativeMediaActions?.classList.contains("hidden")) {
        closeNativeMediaMenu();
        return;
      }
      if (event.key === "Escape" && els.webCameraModal && !els.webCameraModal.classList.contains("hidden")) {
        closeWebCameraModal();
        return;
      }
      if (event.key === "Escape" && APP.dataLab.isOpen) {
        closeDataLabModal();
        return;
      }
      if (event.key === "Escape" && APP.pendulum.isOpen) {
        closePendulumLabModal();
        return;
      }
      if (event.key === "Escape" && APP.torsion.isOpen) {
        closeTorsionLabModal();
        return;
      }
      if (event.key === "Escape" && SIM.isOpen) {
        closeSimulationModal();
        return;
      }
      if (event.key === "Escape" && APP.courseLab.isOpen) {
        closeCourseLabDetail();
        return;
      }
      if (event.key === "Escape" && APP.phet.detailOpen) {
        closePhetDetail();
        return;
      }
      if (event.key === "Escape" && APP.phet.isOpen) {
        closePhetWorkspace();
      }
    });

    window.addEventListener("popstate", () => {
      resetAndroidBackExitTimer();
      applyUiHistoryState();
    });

    document.addEventListener("backbutton", (event) => {
      event.preventDefault?.();
      handleAndroidBackNavigation().catch(() => {});
    });
  }

  function isStandalonePwa() {
    return Boolean(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  }

  function isCompactViewport() {
    return Boolean(window.matchMedia?.("(max-width: 820px)").matches || window.innerWidth <= 820);
  }

  function ensureUiHistoryBase() {
    const current = history.state?.[UI_VIEW_STATE_KEY];
    if (!current) {
      history.replaceState({ ...(history.state || {}), [UI_VIEW_STATE_KEY]: "root" }, "", window.location.href);
    }
  }

  function getCapacitorAppPlugin() {
    const cap = window.Capacitor;
    if (!APP.runtime.isCapacitorShell || !cap) return null;
    if (cap.Plugins?.App) return cap.Plugins.App;
    if (typeof cap.registerPlugin === "function") {
      try {
        return cap.registerPlugin("App");
      } catch {
        return null;
      }
    }
    return null;
  }

  function getCapacitorCameraPlugin() {
    const cap = window.Capacitor;
    if (!APP.runtime.isCapacitorShell || !cap) return null;
    if (cap.Plugins?.Camera) return cap.Plugins.Camera;
    if (typeof cap.registerPlugin === "function") {
      try {
        return cap.registerPlugin("Camera");
      } catch {
        return null;
      }
    }
    return null;
  }

  function resetAndroidBackExitTimer() {
    APP.androidBack.lastRootPressAt = 0;
  }

  function isLabMenuOpen() {
    return Boolean(els.labMenuPanel && !els.labMenuPanel.classList.contains("hidden"));
  }

  function closeLabMenu() {
    if (!els.labMenuPanel || !els.openLabMenuBtn) return;
    els.labMenuPanel.classList.add("hidden");
    els.openLabMenuBtn.setAttribute("aria-expanded", "false");
  }

  async function sendAppToDesktop() {
    const appPlugin = getCapacitorAppPlugin();
    if (appPlugin?.minimizeApp) {
      try {
        await appPlugin.minimizeApp();
        return;
      } catch {}
    }
    if (appPlugin?.exitApp) {
      try {
        await appPlugin.exitApp();
        return;
      } catch {}
    }
    if (window.navigator?.app?.exitApp) {
      window.navigator.app.exitApp();
    }
  }

  async function handleAndroidBackNavigation() {
    if (APP.openMenuId) {
      closeFloatingMenus();
      resetAndroidBackExitTimer();
      return;
    }

    if (isLabMenuOpen()) {
      closeLabMenu();
      resetAndroidBackExitTimer();
      return;
    }

    if (getActiveUiView() !== "root") {
      resetAndroidBackExitTimer();
      history.back();
      return;
    }

    const now = Date.now();
    if (now - APP.androidBack.lastRootPressAt <= ANDROID_BACK_EXIT_INTERVAL_MS) {
      resetAndroidBackExitTimer();
      await sendAppToDesktop();
      return;
    }

    APP.androidBack.lastRootPressAt = now;
    showToast("再按一次返回键即可回到桌面");
  }

  async function registerNativeBackButtonHandler() {
    if (!APP.runtime.isCapacitorShell || APP.androidBack.listenerReady) return;
    const appPlugin = getCapacitorAppPlugin();
    if (!appPlugin?.addListener) return;

    APP.androidBack.listenerHandle = await appPlugin.addListener("backButton", async () => {
      await handleAndroidBackNavigation();
    });
    APP.androidBack.listenerReady = true;
  }

  function replaceUiHistoryView(view = "root") {
    history.replaceState({ ...(history.state || {}), [UI_VIEW_STATE_KEY]: view }, "", window.location.href);
  }

  function pushUiHistoryView(view) {
    ensureUiHistoryBase();
    const current = history.state?.[UI_VIEW_STATE_KEY] || "root";
    if (current === view) return;
    history.pushState({ ...(history.state || {}), [UI_VIEW_STATE_KEY]: view }, "", window.location.href);
  }

  function getActiveUiView() {
    if (APP.dataLab.isOpen) return "data-lab";
    if (APP.pendulum.isOpen) return "pendulum-lab";
    if (APP.torsion.isOpen) return "torsion-lab";
    if (SIM.isOpen) return "simulation";
    if (APP.courseLab.isOpen) return "course-lab";
    if (APP.phet.detailOpen) return "phet-detail";
    if (APP.phet.isOpen) return "phet-catalog";
    return "root";
  }

  function applyUiHistoryState() {
    const targetView = history.state?.[UI_VIEW_STATE_KEY] || "root";
    while (true) {
      const currentView = getActiveUiView();
      if (currentView === targetView || currentView === "root") {
        break;
      }
      if (currentView === "data-lab") {
        closeDataLabModal({ skipHistory: true });
        continue;
      }
      if (currentView === "pendulum-lab") {
        closePendulumLabModal({ skipHistory: true });
        continue;
      }
      if (currentView === "torsion-lab") {
        closeTorsionLabModal({ skipHistory: true });
        continue;
      }
      if (currentView === "simulation") {
        closeSimulationModal({ skipHistory: true });
        continue;
      }
      if (currentView === "course-lab") {
        closeCourseLabDetail({ skipHistory: true });
        continue;
      }
      if (currentView === "phet-detail") {
        closePhetDetail({ skipHistory: true });
        continue;
      }
      if (currentView === "phet-catalog") {
        closePhetWorkspace({ skipHistory: true });
        continue;
      }
      break;
    }
  }

  function syncImmersiveState() {
    const immersiveOpen = APP.dataLab.isOpen || APP.pendulum.isOpen || APP.torsion.isOpen || APP.phet.isOpen || APP.phet.detailOpen || APP.courseLab.isOpen || SIM.isOpen;
    document.body.classList.toggle("immersive-open", immersiveOpen);
  }

  async function bootstrapWorkspace() {
    APP.auth.enabled = !APP.runtime.isLiteBackend;

    if (!APP.auth.enabled) {
      APP.auth.user = {
        id: "lite-local",
        display_name: "本地体验模式",
        role: "teacher",
        provider: "local",
      };
      syncAuthUi();
      ensureSessionIdForCurrentUser();
      APP.history = loadHistory();
      await hydrateSession();
      return;
    }

    try {
      await loadAuthConfig();
    } catch (error) {
      if (!(await recoverSameOriginApiBaseForLocalWeb(error))) {
        throw error;
      }
      await loadAuthConfig();
    }
    const restored = await restoreAuthSession();
    if (shouldAutoPresentAuthGate()) {
      APP.auth.forceGateVisible = true;
      syncAuthUi();
    }
    if (!restored) {
      APP.isHydrating = false;
      APP.sessionCatalog = { folders: [], sessions: [] };
      APP.history = [];
      els.chatMessages.innerHTML = "";
      renderHistory();
      refreshQuickJumpPanel();
      renderUploadedFileList([]);
      setUploadStatus("请先登录后进入工作区");
      return;
    }

    syncAuthUi();
    ensureSessionIdForCurrentUser();
    APP.history = loadHistory();
    try {
      await hydrateSession();
    } catch {
      setCurrentSessionId(generateSessionId());
      await hydrateSession();
    }
  }

  async function recoverSameOriginApiBaseForLocalWeb(error) {
    const canRecover = !APP.runtime.isCapacitorShell
      && isLocalDevelopmentOrigin()
      && Boolean(APP.runtime.customApiBaseUrl);
    if (!canRecover) {
      return false;
    }

    setStoredApiBaseUrl("");
    APP.runtime = loadRuntimeConfig();
    syncInstallButtonState();
    syncMobileConnectionUi();
    syncNativeMediaUi();
    syncModelKeyUi();
    updateNetworkBadge();
    console.warn("Recovered local web app to same-origin API base after connection failure:", error?.message || error);
    return true;
  }

  async function loadAuthConfig() {
    const response = await fetchWithTimeout("/api/auth/config", undefined, 8000);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json().catch(() => ({}));
    APP.auth.config = data;
    APP.auth.backendReachable = true;
    APP.auth.bootstrapError = "";
    if (els.authProviderStatus) {
      const readyCount = Array.isArray(data.providers)
        ? data.providers.filter((item) => item.configured && item.key !== "demo").length
        : 0;
      els.authProviderStatus.textContent = readyCount
        ? `可用入口 ${readyCount}`
        : "仅体验模式";
    }
    if (els.authProviderHint && data.oauth_note) {
      const smsModeHint = data.sms?.delivery_mode === "mock"
        ? "当前验证码为测试模式，不会发送真实短信，验证码会直接显示在页面中。"
        : "";
      els.authProviderHint.textContent = [smsModeHint, "微信 / QQ 后续接入。"].filter(Boolean).join(" ");
    }
    if (els.authDebugCodeNotice) {
      els.authDebugCodeNotice.classList.add("hidden");
      els.authDebugCodeNotice.textContent = "";
    }
    updatePhoneAuthHint();
    updateSmsCountdownUi();
  }

  async function restoreAuthSession() {
    if (APP.localApiMode && APP.auth.user?.provider === "local" && !APP.auth.token) {
      syncAuthUi();
      return true;
    }
    if (!APP.auth.token) {
      APP.auth.user = null;
      APP.auth.forceGateVisible = false;
      syncAuthUi();
      return false;
    }

    const response = await fetchWithTimeout("/api/auth/me", undefined, 8000);
    if (!response.ok) {
      clearAuthToken();
      APP.auth.token = "";
      APP.auth.user = null;
      APP.auth.forceGateVisible = false;
      syncAuthUi();
      return false;
    }

    const data = await response.json().catch(() => ({}));
    APP.localApiMode = false;
    APP.auth.user = data.user || null;
    APP.auth.forceGateVisible = Boolean(APP.auth.user && shouldAutoPresentAuthGate());
    syncAuthUi();
    return Boolean(APP.auth.user);
  }

  function normalizePhoneInputValue(value) {
    const digits = String(value || "").replace(/\D+/g, "");
    if (digits.startsWith("86") && digits.length === 13) {
      return digits.slice(2);
    }
    return digits;
  }

  function setAuthDebugNotice(message = "", { visible = true } = {}) {
    if (!els.authDebugCodeNotice) return;
    const text = String(message || "").trim();
    if (!visible || !text) {
      els.authDebugCodeNotice.textContent = "";
      els.authDebugCodeNotice.classList.add("hidden");
      return;
    }
    els.authDebugCodeNotice.textContent = text;
    els.authDebugCodeNotice.classList.remove("hidden");
  }

  function updatePhoneAuthHint() {
    if (!els.authPhoneHint) return;
    const smsConfig = APP.auth.config?.sms || {};
    const backendReachable = APP.auth.backendReachable !== false;
    const authBusy = Boolean(APP.auth.pendingAction);
    if (els.authPhoneLoginBtn) {
      els.authPhoneLoginBtn.disabled = !backendReachable || smsConfig.enabled === false || authBusy;
    }
    const modeHint = !backendReachable
      ? `服务未连接。${APP.auth.bootstrapError || "请先设置可访问的地址。"}`
      : smsConfig.enabled === false
        ? "短信验证码未开启。"
        : smsConfig.delivery_mode === "mock"
          ? "当前为测试模式，不会发送真实短信，验证码会直接显示并自动回填。"
          : "验证码会发送到手机。";
    const roleHint = APP.auth.selectedRole === "teacher"
      ? (smsConfig.teacher_whitelist_enabled
        ? "教师手机号需先登记。"
        : "教师端手机号登录需白名单；未登记请切换学生端或使用体验登录。")
      : "未登记手机号默认进入学生端。";
    els.authPhoneHint.textContent = `${modeHint}${roleHint}`;
  }

  function updateSmsCountdownUi() {
    const button = els.authSendCodeBtn;
    if (!button) return;
    if (APP.auth.pendingAction === "send-code") {
      button.disabled = true;
      button.textContent = "发送中...";
      return;
    }
    if (APP.auth.pendingAction) {
      button.disabled = true;
      return;
    }
    if (APP.auth.backendReachable === false) {
      button.disabled = true;
      button.textContent = "后端未连接";
      return;
    }
    const smsEnabled = APP.auth.config?.sms?.enabled !== false;
    if (!smsEnabled) {
      button.disabled = true;
      button.textContent = "短信未开启";
      return;
    }

    const remainingSeconds = Math.max(0, Math.ceil((APP.auth.smsCooldownUntil - Date.now()) / 1000));
    if (remainingSeconds > 0) {
      button.disabled = true;
      button.textContent = `${remainingSeconds}s 后重发`;
      return;
    }

    if (APP.auth.smsCooldownTimer) {
      window.clearInterval(APP.auth.smsCooldownTimer);
      APP.auth.smsCooldownTimer = 0;
    }
    APP.auth.smsCooldownUntil = 0;
    button.disabled = false;
    button.textContent = "获取验证码";
  }

  function syncAuthConnectionUi() {
    if (!els.authConnectionCard || !els.authConnectionText) return;
    const shouldShow = APP.auth.enabled && APP.runtime.showConnectionSettings;
    els.authConnectionCard.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;

    const currentBase = APP.runtime.customApiBaseUrl || APP.runtime.apiBaseUrl || APP.runtime.defaultApiBaseUrl || "未配置";
    if (APP.localApiMode) {
      els.authConnectionText.textContent = `服务地址：${currentBase}。当前为本地体验模式。`;
      return;
    }
    const reachabilityHint = APP.auth.backendReachable === false
      ? "当前地址不可达，可先使用体验模式。"
      : "真机请使用电脑局域网地址。";
    els.authConnectionText.textContent = `服务地址：${currentBase}。${reachabilityHint}`;
  }

  async function enterLocalExperienceMode({ displayName = "", role = "teacher", source = "demo", toastMessage = "" } = {}) {
    APP.localApiMode = true;
    APP.auth.token = "";
    APP.auth.user = {
      id: `local-${role}`,
      display_name: String(displayName || (role === "teacher" ? "本地教师体验" : "本地学生体验")).trim(),
      role,
      provider: "local",
      source,
    };
    APP.auth.forceGateVisible = false;
    APP.auth.pendingAction = "";
    APP.uploadScope = "session";
    clearAuthToken();
    syncAuthUi();
    ensureSessionIdForCurrentUser();
    APP.history = loadHistory();
    try {
      await hydrateSession();
    } catch {
      setCurrentSessionId(generateSessionId());
      await hydrateSession();
    }
    if (toastMessage) {
      showToast(toastMessage);
    }
  }

  function startSmsCountdown(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    if (APP.auth.smsCooldownTimer) {
      window.clearInterval(APP.auth.smsCooldownTimer);
      APP.auth.smsCooldownTimer = 0;
    }
    APP.auth.smsCooldownUntil = safeSeconds > 0 ? Date.now() + safeSeconds * 1000 : 0;
    updateSmsCountdownUi();
    if (!safeSeconds) return;
    APP.auth.smsCooldownTimer = window.setInterval(() => {
      updateSmsCountdownUi();
    }, 250);
  }

  async function handlePhoneCodeSend() {
    if (APP.auth.pendingAction) {
      showToast("正在处理上一个登录操作，请稍候。");
      return;
    }
    const phone = normalizePhoneInputValue(els.authPhoneInput?.value);
    if (phone.length !== 11) {
      throw new Error("请输入有效的 11 位手机号");
    }

    const button = els.authSendCodeBtn;
    const previousLabel = button?.textContent || "获取验证码";
    if (button) {
      button.disabled = true;
      button.textContent = "发送中...";
    }
    APP.auth.pendingAction = "send-code";
    syncAuthUi();

    try {
      const response = await fetchWithTimeout("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `HTTP ${response.status}`);
      }

      if (els.authPhoneInput) {
        els.authPhoneInput.value = phone;
      }
      if (data.debug_code && els.authCodeInput) {
        els.authCodeInput.value = data.debug_code;
      }
      if (data.delivery_mode === "mock" && data.debug_code) {
        setAuthDebugNotice(`测试验证码：${data.debug_code}（已自动填入）`);
      } else {
        setAuthDebugNotice("", { visible: false });
      }
      startSmsCountdown(
        Number(data.cooldown_seconds || APP.auth.config?.sms?.cooldown_seconds || 60),
      );
      updatePhoneAuthHint();
      showToast(
        data.delivery_mode === "mock" && data.debug_code
          ? `当前为测试模式，不会发送真实短信。验证码已自动填入：${data.debug_code}`
          : (data.message || "验证码已发送，请注意查收"),
      );
    } catch (error) {
      if (/无法连接后端|请求超时/.test(error?.message || "")) {
        APP.auth.backendReachable = false;
        APP.auth.bootstrapError = error.message;
        syncAuthUi();
      }
      throw error;
    } finally {
      APP.auth.pendingAction = "";
      if (!APP.auth.smsCooldownUntil && button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
      syncAuthUi();
    }
  }

  async function handlePhoneCodeLogin() {
    if (APP.auth.pendingAction) {
      showToast("正在处理上一个登录操作，请稍候。");
      return;
    }
    const phone = normalizePhoneInputValue(els.authPhoneInput?.value);
    const code = String(els.authCodeInput?.value || "").trim();
    const displayName = String(els.authDisplayNameInput?.value || "").trim();

    if (phone.length !== 11) {
      throw new Error("请输入有效的 11 位手机号");
    }
    if (!code) {
      throw new Error("请输入短信验证码");
    }

    const button = els.authPhoneLoginBtn;
    const previousLabel = button?.innerHTML || "";
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="ri-loader-4-line"></i><span>登录中...</span>';
    }
    APP.auth.pendingAction = "phone-login";
    syncAuthUi();

    try {
      const response = await fetchWithTimeout("/api/auth/login/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          role: APP.auth.selectedRole,
          display_name: displayName,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `HTTP ${response.status}`);
      }

      APP.auth.token = data.token || "";
      APP.auth.user = data.user || null;
      APP.localApiMode = false;
      APP.auth.forceGateVisible = false;
      APP.uploadScope = "session";
      saveAuthToken(APP.auth.token);
      if (els.authCodeInput) {
        els.authCodeInput.value = "";
      }
      setAuthDebugNotice("", { visible: false });
      syncAuthUi();
      ensureSessionIdForCurrentUser();
      APP.history = loadHistory();
      await hydrateSession();
      showToast(`${roleLabel(APP.auth.user?.role)}已进入工作区`);
    } catch (error) {
      if (/无法连接后端|请求超时/.test(error?.message || "")) {
        APP.auth.backendReachable = false;
        APP.auth.bootstrapError = error.message;
        syncAuthUi();
      }
      setAuthDebugNotice(`登录失败：${error?.message || "请稍后重试"}`);
      throw error;
    } finally {
      APP.auth.pendingAction = "";
      if (button) {
        button.disabled = false;
        button.innerHTML = previousLabel || '<i class="ri-smartphone-line"></i><span>手机号验证码登录</span>';
      }
      syncAuthUi();
    }
  }

  async function handleAuthProviderLogin(provider) {
    if (APP.auth.pendingAction) {
      showToast("正在处理上一个登录操作，请稍候。");
      return;
    }
    const providerKey = String(provider || "demo").trim() || "demo";
    const displayName = String(els.authDisplayNameInput?.value || "").trim()
      || (APP.auth.selectedRole === "teacher" ? "教师用户" : "学生用户");
    const providerConfig = Array.isArray(APP.auth.config?.providers)
      ? APP.auth.config.providers.find((item) => item.key === providerKey)
      : null;

    if (providerKey !== "demo" && !providerConfig?.configured) {
      showToast(`${providerLabel(providerKey)}正式 OAuth 尚未配置，当前将先进入本地演示登录。`);
    }

    const triggerButton = providerKey === "wechat"
      ? els.authWechatBtn
      : providerKey === "qq"
        ? els.authQqBtn
        : els.authDemoBtn;
    const previousLabel = triggerButton?.innerHTML || "";
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.innerHTML = providerKey === "demo"
        ? '<i class="ri-loader-4-line"></i><span>进入中...</span>'
        : '<i class="ri-loader-4-line"></i><span>登录中...</span>';
    }
    APP.auth.pendingAction = `provider-${providerKey}`;
    syncAuthUi();

    try {
      if (providerKey === "demo" && APP.auth.backendReachable === false) {
        await enterLocalExperienceMode({
          displayName,
          role: APP.auth.selectedRole,
          source: "fallback",
          toastMessage: "远端未连通，已进入本地体验模式",
        });
        return;
      }

      const response = await fetchWithTimeout("/api/auth/login/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerKey,
          role: APP.auth.selectedRole,
          display_name: displayName,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `HTTP ${response.status}`);
      }

      APP.auth.token = data.token || "";
      APP.auth.user = data.user || null;
      APP.localApiMode = false;
      APP.auth.forceGateVisible = false;
      APP.uploadScope = "session";
      saveAuthToken(APP.auth.token);
      syncAuthUi();
      ensureSessionIdForCurrentUser();
      APP.history = loadHistory();
      await hydrateSession();
      showToast(providerKey === "demo" ? "已进入体验模式" : `${roleLabel(APP.auth.user?.role)}已进入工作区`);
    } catch (error) {
      const isNetworkFailure = /无法连接后端|请求超时/.test(error?.message || "");
      if (providerKey === "demo") {
        if (isNetworkFailure || APP.auth.backendReachable === false) {
          APP.auth.backendReachable = false;
          APP.auth.bootstrapError = error?.message || "后端未连接";
        }
        syncAuthUi();
        await enterLocalExperienceMode({
          displayName,
          role: APP.auth.selectedRole,
          source: isNetworkFailure || APP.auth.backendReachable === false ? "fallback" : "local-demo",
          toastMessage: isNetworkFailure || APP.auth.backendReachable === false
            ? "后端未连接，已切换到本地体验模式"
            : "远端体验登录失败，已切换到本地体验模式",
        });
        return;
      }
      if (isNetworkFailure) {
        APP.auth.backendReachable = false;
        APP.auth.bootstrapError = error.message;
        syncAuthUi();
      }
      throw error;
    } finally {
      APP.auth.pendingAction = "";
      if (triggerButton) {
        triggerButton.disabled = false;
        triggerButton.innerHTML = previousLabel;
      }
      syncAuthUi();
    }
  }

  async function logoutCurrentUser() {
    try {
      if (APP.auth.token) {
        await fetch("/api/auth/logout", { method: "POST" });
      }
    } catch {
      // no-op
    }

    APP.auth.token = "";
    APP.auth.user = null;
    APP.localApiMode = false;
    APP.auth.forceGateVisible = true;
    APP.auth.pendingAction = "";
    clearAuthToken();
    APP.sessionCatalog = { folders: [], sessions: [] };
    APP.history = [];
    APP.pendingImage = null;
    APP.pendingAudio = null;
    APP.uploadScope = "session";
    APP.sessionId = generateSessionId();
    startSmsCountdown(0);
    if (els.authCodeInput) {
      els.authCodeInput.value = "";
    }
    setAuthDebugNotice("", { visible: false });
    els.chatMessages.innerHTML = "";
    renderUploadedFileList([]);
    updatePendingAttachmentBars();
    setUploadStatus("请先登录后进入工作区");
    renderHistory();
    refreshQuickJumpPanel();
    syncAuthUi();
  }

  function syncAuthUi() {
    const user = APP.auth.user;
    const isTeacher = user?.role === "teacher";
    const authGateVisible = APP.auth.enabled && (!user || APP.auth.forceGateVisible);
    const authUnavailable = APP.auth.enabled && APP.auth.backendReachable === false;
    const authBusy = Boolean(APP.auth.pendingAction);
    const demoLoginBusy = APP.auth.pendingAction === "provider-demo";
    ACTIVE_USER_STORAGE_SCOPE = user?.id || "anonymous";
    setAuthGateVisible(authGateVisible);

    if (els.openAuthGateBtn) {
      els.openAuthGateBtn.classList.toggle("hidden", !APP.auth.enabled);
      els.openAuthGateBtn.innerHTML = user
        ? '<i class="ri-user-switch-line"></i><span>切换账号</span>'
        : '<i class="ri-login-circle-line"></i><span>进入登录</span>';
    }
    if (els.closeAuthGateBtn) {
      els.closeAuthGateBtn.classList.toggle("hidden", !(user && APP.auth.forceGateVisible));
    }
    if (els.authQuickLogoutBtn) {
      els.authQuickLogoutBtn.classList.toggle("hidden", !user);
    }

    if (els.userWorkspaceSection) {
      els.userWorkspaceSection.classList.toggle("hidden", !user);
    }
    if (els.authRoleSwitch) {
      els.authRoleSwitch.querySelectorAll("[data-auth-role]").forEach((node) => {
        const active = node.getAttribute("data-auth-role") === APP.auth.selectedRole;
        node.classList.toggle("active", active);
        node.setAttribute("aria-selected", active ? "true" : "false");
      });
    }
    if (els.userRoleBadge) {
      els.userRoleBadge.textContent = user ? roleLabel(user.role) : "未登录";
    }
    if (els.userAvatar) {
      const displayName = String(user?.display_name || "Physics Agent").trim();
      const initials = displayName.length >= 2 ? displayName.slice(0, 2).toUpperCase() : "PA";
      els.userAvatar.textContent = initials;
    }
    if (els.userDisplayName) {
      els.userDisplayName.textContent = user?.display_name || "未登录";
    }
    if (els.userProviderMeta) {
      if (!user) {
        els.userProviderMeta.textContent = authUnavailable ? "当前后端未连接，请先修复连接后再登录" : "请先完成身份验证";
      } else if (user.provider === "local") {
        els.userProviderMeta.textContent = APP.runtime.isLiteBackend
          ? "当前为本地轻后端模式，默认开放完整工作区。"
          : `${roleLabel(user.role)}本地体验模式 · 聊天与会话已切换到当前设备`;
      } else {
        els.userProviderMeta.textContent = `${providerLabel(user.provider)}身份 · ${roleLabel(user.role)} · 会话与资料按角色隔离`;
      }
    }
    if (els.authProviderStatus && authUnavailable) {
      els.authProviderStatus.textContent = "后端未连接，可先本地体验";
    }
    if (els.authWechatBtn) {
      els.authWechatBtn.disabled = authUnavailable || authBusy;
    }
    if (els.authQqBtn) {
      els.authQqBtn.disabled = authUnavailable || authBusy;
    }
    if (els.authDemoBtn) {
      els.authDemoBtn.disabled = demoLoginBusy;
    }
    els.teacherIsolationHint?.classList.toggle("hidden", !isTeacher);
    els.studentIsolationHint?.classList.toggle("hidden", isTeacher || !user);
    els.teacherStatsSection?.classList.toggle("hidden", !isTeacher);
    renderTeacherStats();

    if (els.uploadSectionMeta) {
      els.uploadSectionMeta.textContent = isTeacher
        ? "PDF / DOCX / 图片 / 音频 / 拍照"
        : "学生端默认关闭外部知识库上传";
    }

    const uploadLocked = Boolean(user) && !isTeacher;
    els.uploadScopeSwitch?.classList.toggle("hidden", !isTeacher);
    if (els.uploadRoleHint) {
      if (!user || isTeacher) {
        els.uploadRoleHint.classList.add("hidden");
      } else {
        els.uploadRoleHint.classList.remove("hidden");
        els.uploadRoleHint.textContent = "学生端当前不开放外部知识库上传，Agent 检索范围仅限学生会话与实验上下文。";
      }
    }
    els.uploadDropzone?.classList.toggle("hidden", uploadLocked);
    if (els.fileInput) {
      els.fileInput.disabled = uploadLocked;
    }
    if (els.clearDocsBtn) {
      els.clearDocsBtn.disabled = uploadLocked;
    }

    syncUploadScopeUi();
    syncNativeMediaUi();
    updatePhoneAuthHint();
    updateSmsCountdownUi();
    syncAuthConnectionUi();
    syncModelKeyUi();
  }

  function syncUploadScopeUi() {
    if (!els.uploadScopeSwitch) return;
    const isTeacher = APP.auth.user?.role === "teacher";
    els.uploadScopeSwitch.querySelectorAll("[data-upload-scope]").forEach((button) => {
      const active = isTeacher && button.getAttribute("data-upload-scope") === APP.uploadScope;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function setAuthGateVisible(visible) {
    els.authGate?.classList.toggle("hidden", !visible);
    document.body.classList.toggle("auth-gate-open", visible);
  }

  function providerLabel(provider) {
    return PROVIDER_LABELS[provider] || "统一身份";
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || "学生端";
  }

  function shouldAutoPresentAuthGate() {
    return APP.auth.enabled && (APP.runtime.isCapacitorShell || window.matchMedia("(max-width: 640px)").matches);
  }

  function dataLabFitLabel(type) {
    return DATA_LAB_FIT_LABELS[type] || DATA_LAB_FIT_LABELS.linear;
  }

  function syncInstallButtonState() {
    const button = els.installAppBtn;
    if (!button) return;

    button.classList.remove("hidden");
    button.disabled = false;

    if (APP.runtime.isCapacitorShell) {
      button.dataset.state = "native";
      button.innerHTML = '<i class="ri-smartphone-line"></i><span>当前为安卓 App</span>';
      button.title = "当前页面已运行在 Capacitor 安卓容器中";
      button.disabled = true;
      return;
    }

    if (isStandalonePwa()) {
      button.dataset.state = "installed";
      button.innerHTML = '<i class="ri-checkbox-circle-line"></i><span>安卓应用已安装</span>';
      button.title = "当前已处于应用模式";
      button.disabled = true;
      return;
    }

    if (APP.installPromptEvent) {
      button.dataset.state = "ready";
      button.innerHTML = '<i class="ri-android-line"></i><span>安装到安卓</span>';
      button.title = "点击后可添加到安卓主屏";
      return;
    }

    button.dataset.state = "hint";
    button.innerHTML = '<i class="ri-smartphone-line"></i><span>添加到主屏</span>';
    button.title = "若未出现安装弹窗，请在浏览器菜单中选择“安装应用”或“添加到主屏幕”";
  }

  function updateNetworkBadge() {
    const badge = els.networkBadge;
    if (!badge) return;
    const online = navigator.onLine !== false;
    badge.textContent = online ? "在线" : "离线";
    badge.classList.toggle("pill-green", online);
    badge.classList.toggle("pill-amber", !online);
  }

  function syncMobileConnectionUi() {
    const section = els.mobileConnectionSection;
    const hint = els.apiBaseHint;
    const button = els.configureApiBaseBtn;
    if (!section) return;

    const shouldShow = APP.runtime.showConnectionSettings;
    section.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;

    if (button) {
      const buttonLabel = APP.runtime.customApiBaseUrl ? "修改地址" : "设置地址";
      button.innerHTML = `<i class="ri-links-line"></i><span>${buttonLabel}</span>`;
    }

    if (hint) {
      const currentBase = APP.runtime.apiBaseUrl || "同源";
      const modeHint = APP.runtime.isCapacitorShell
        ? "真机填电脑局域网地址；模拟器可用 http://10.0.2.2:8000。"
        : "网页端默认同源。";
      hint.textContent = `当前地址：${currentBase}。${modeHint}`;
    }
    syncAuthConnectionUi();
  }

  function syncModelKeyUi() {
    const section = els.modelKeySection;
    const hint = els.modelApiKeyHint;
    const button = els.configureModelApiKeyBtn;
    if (!section) return;

    const shouldShow = APP.runtime.showModelKeySettings || APP.localApiMode;
    section.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) return;

    if (button) {
      const buttonLabel = APP.runtime.customModelApiKey || APP.runtime.configuredModelApiKey
        ? "修改模型密钥"
        : "设置模型密钥";
      button.innerHTML = `<i class="ri-key-2-line"></i><span>${buttonLabel}</span>`;
    }

    if (hint) {
      const maskedKey = APP.runtime.modelApiKey
        ? `${APP.runtime.modelApiKey.slice(0, 6)}...${APP.runtime.modelApiKey.slice(-4)}`
        : "尚未设置";
      const modeHint = APP.localApiMode
        ? "当前为本地体验模式，使用手机本地 Key。"
        : "仅在本地模式下需要。";
      hint.textContent = `当前状态：${maskedKey}。${modeHint}`;
    }
  }

  function canUseNativeMedia() {
    const uploadLocked = APP.auth.user && APP.auth.user.role !== "teacher";
    return !uploadLocked && (APP.runtime.isCapacitorShell || Boolean(window.FileReader));
  }

  function closeNativeMediaMenu() {
    els.nativeMediaActions?.classList.add("hidden");
    if (els.chatCameraBtn) {
      els.chatCameraBtn.classList.remove("is-open");
      els.chatCameraBtn.setAttribute("aria-expanded", "false");
    }
  }

  function toggleNativeMediaMenu(forceOpen) {
    if (!canUseNativeMedia() || !els.nativeMediaActions || !els.chatCameraBtn) {
      closeNativeMediaMenu();
      return;
    }
    const shouldOpen = typeof forceOpen === "boolean"
      ? forceOpen
      : els.nativeMediaActions.classList.contains("hidden");
    els.nativeMediaActions.classList.toggle("hidden", !shouldOpen);
    els.chatCameraBtn.classList.toggle("is-open", shouldOpen);
    els.chatCameraBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  function syncNativeMediaUi() {
    const mediaAvailable = canUseNativeMedia();
    if (els.chatCameraBtn) {
      els.chatCameraBtn.classList.toggle("hidden", !mediaAvailable);
      if (!mediaAvailable) {
        els.chatCameraBtn.setAttribute("aria-expanded", "false");
        els.chatCameraBtn.classList.remove("is-open");
      }
    }
    if (!mediaAvailable) {
      els.nativeMediaActions?.classList.add("hidden");
      closeWebCameraModal();
    }
  }

  async function configureModelApiKeyInteractive() {
    const initialValue = APP.runtime.customModelApiKey || APP.runtime.configuredModelApiKey || "";
    const promptText = "请输入 DashScope API Key。该密钥只保存在当前手机；留空可清除。";
    const nextValue = window.prompt(promptText, initialValue);
    if (nextValue === null) return;

    setStoredModelApiKey(nextValue);
    APP.runtime = loadRuntimeConfig();
    syncInstallButtonState();
    syncMobileConnectionUi();
    syncModelKeyUi();
    syncNativeMediaUi();
    updateNetworkBadge();

    const maskedKey = APP.runtime.modelApiKey
      ? `${APP.runtime.modelApiKey.slice(0, 6)}...${APP.runtime.modelApiKey.slice(-4)}`
      : "已清除";
    showToast(`轻后端模型密钥已更新：${maskedKey}`);
  }

  async function registerAndroidPwaSupport() {
    window.addEventListener("online", updateNetworkBadge);
    window.addEventListener("offline", updateNetworkBadge);

    if (APP.runtime.disableServiceWorker) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister().catch(() => {}));
        }).catch(() => {});
      }
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys
            .filter((key) => key.startsWith("physics-agent-pwa-v"))
            .forEach((key) => caches.delete(key).catch(() => {}));
        }).catch(() => {});
      }
      return;
    }

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(resolveAssetUrl("./sw.js"), {
          updateViaCache: "none",
        });
        registration.update().catch(() => {});
      } catch (error) {
        console.warn("PWA service worker register failed:", error);
      }
    }

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      APP.installPromptEvent = event;
      syncInstallButtonState();
    });

    window.addEventListener("appinstalled", () => {
      APP.installPromptEvent = null;
      syncInstallButtonState();
      showToast("安卓版已安装到主屏，可像独立应用一样打开。");
    });
  }

  async function handleInstallApp() {
    if (APP.runtime.isCapacitorShell) {
      showToast("当前已运行在安卓 App 容器内，无需再次安装。");
      return;
    }

    if (isStandalonePwa()) {
      showToast("当前已经处于安卓应用模式。");
      return;
    }

    if (!APP.installPromptEvent) {
      showToast("若未自动弹出安装提示，请在安卓浏览器菜单中选择“安装应用”或“添加到主屏幕”。");
      return;
    }

    const promptEvent = APP.installPromptEvent;
    APP.installPromptEvent = null;
    syncInstallButtonState();

    try {
      await promptEvent.prompt();
      const outcome = await promptEvent.userChoice;
      if (outcome?.outcome !== "accepted" && !isStandalonePwa()) {
        APP.installPromptEvent = promptEvent;
        syncInstallButtonState();
      }
    } catch (error) {
      APP.installPromptEvent = promptEvent;
      syncInstallButtonState();
      showToast(`安装提示调用失败：${error.message}`);
    }
  }

  async function configureApiBaseUrlInteractive() {
    const initialValue = APP.runtime.customApiBaseUrl || APP.runtime.apiBaseUrl || APP.runtime.defaultApiBaseUrl || "";
    const promptText = APP.runtime.isCapacitorShell
      ? "请输入服务地址。真机填电脑局域网地址；模拟器可用 http://10.0.2.2:8000。留空恢复默认。"
      : "请输入服务地址；留空恢复同源模式。";
    const nextValue = window.prompt(promptText, initialValue);
    if (nextValue === null) return;

    setStoredApiBaseUrl(nextValue);
    APP.runtime = loadRuntimeConfig();
    syncInstallButtonState();
    syncMobileConnectionUi();
    syncNativeMediaUi();
    updateNetworkBadge();

    APP.pendingImage = null;
    APP.pendingAudio = null;
    updatePendingAttachmentBars();
    setUploadStatus("正在刷新后端连接...");
    els.chatMessages.innerHTML = "";
    refreshQuickJumpPanel();

    try {
      if (APP.auth.enabled) {
        await loadAuthConfig();
        await restoreAuthSession();
        if (shouldAutoPresentAuthGate()) {
          APP.auth.forceGateVisible = true;
        }
      }
      await hydrateSession();
      APP.auth.backendReachable = true;
      APP.auth.bootstrapError = "";
      syncAuthUi();
      showToast(`地址已更新：${APP.runtime.apiBaseUrl || "同源"}`);
    } catch (error) {
      APP.auth.backendReachable = false;
      APP.auth.bootstrapError = error?.message || "后端连接失败";
      syncAuthUi();
      showToast(`后端地址已保存，但当前无法连通：${error.message}`);
    }
  }

  async function clearConversationHistory() {
    try {
      await fetch(`/api/clear-history?session_id=${encodeURIComponent(APP.sessionId)}`, { method: "POST" });
      APP.history = [];
      saveHistory(APP.history);
      renderHistory();
      els.chatMessages.innerHTML = "";
      refreshQuickJumpPanel();
      await loadSessionCatalog();
    } catch (error) {
      showToast(`清空历史失败：${error.message}`);
    }
  }
  async function startNewConversation() {
    closeFloatingMenus();
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新对话" }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      await switchConversation(data.session_id, { isNew: true });
    } catch (error) {
      showToast(`创建新对话失败：${error.message}`);
    }
  }
  async function createProjectConversation(folderId) {
    if (!folderId) return;
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "新对话", folder_id: folderId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      const data = await response.json();
      await switchConversation(data.session_id, { isNew: true });
      APP.folderOpenMap[folderId] = true;
      saveFolderOpenMap(APP.folderOpenMap);
      await loadSessionCatalog();
    } catch (error) {
      showToast(`项目内新建对话失败：${error.message}`);
    }
  }

  async function switchConversation(sessionId, { isNew = false } = {}) {
    closeFloatingMenus();
    setCurrentSessionId(sessionId);
    APP.pendingImage = null;
    APP.pendingAudio = null;
    updatePendingAttachmentBars();
    els.chatMessages.innerHTML = "";
    refreshQuickJumpPanel();
    await hydrateSession();
    if (isNew) {
      els.chatInput.focus();
    }
  }

  async function loadSessionCatalog() {
    if (APP.auth.enabled && !APP.auth.user) {
      APP.sessionCatalog = { folders: [], sessions: [] };
      renderHistory();
      return;
    }
    const response = await fetch("/api/sessions");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    APP.sessionCatalog = {
      folders: Array.isArray(data.folders) ? data.folders : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
    };
    APP.openMenuId = null;
    renderHistory();
  }

  async function openPhetWorkspace() {
    const wasOpen = APP.phet.isOpen;
    closeCourseLabDetail({ preserveSelection: true, skipHistory: true });
    APP.phet.isOpen = true;
    APP.phet.detailOpen = false;
    APP.phet.mobileScreen = "catalog";
    renderPhetWorkspace();
    syncImmersiveState();
    refreshQuickJumpPanel();
    if (!wasOpen) {
      pushUiHistoryView("phet-catalog");
    }
    if (!APP.phet.groups.length) {
      await loadPhetCatalog();
    } else {
      ensurePhetSelection();
      renderPhetCatalog();
      renderPhetDetail();
    }
  }

  function closePhetWorkspace({ skipHistory = false } = {}) {
    const stateView = history.state?.[UI_VIEW_STATE_KEY] || "root";
    if (!skipHistory && stateView === "phet-catalog") {
      history.back();
      return;
    }
    APP.phet.isOpen = false;
    APP.phet.detailOpen = false;
    APP.phet.mobileScreen = "catalog";
    clearTimeout(APP.phet.frameTimeoutId);
    APP.phet.frameTimeoutId = 0;
    if (skipHistory && (stateView === "phet-catalog" || stateView === "phet-detail")) {
      replaceUiHistoryView("root");
    }
    renderPhetWorkspace();
    syncImmersiveState();
    refreshQuickJumpPanel();
  }

  async function loadPhetCatalog() {
    APP.phet.loading = true;
    APP.phet.error = "";
    renderPhetWorkspace();
    renderPhetCatalog();
    try {
      const response = await fetch("/api/phet/catalog");
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      const data = await response.json();
      APP.phet.updatedAt = data.updated_at || "";
      APP.phet.total = Number(data.total || 0);
      APP.phet.groups = Array.isArray(data.groups) ? data.groups : [];
      APP.phet.error = "";
      ensurePhetSelection();
      renderPhetWorkspace();
      renderPhetTopicTabs();
      renderPhetCatalog();
      renderPhetDetail();
    } catch (error) {
      APP.phet.error = error.message;
      showToast(`实验目录载入失败：${error.message}`);
      renderPhetWorkspace();
      renderPhetCatalog();
      renderPhetDetail();
    } finally {
      APP.phet.loading = false;
      renderPhetWorkspace();
    }
  }

  function renderPhetWorkspace() {
    if (els.contentShell) {
      els.contentShell.classList.remove("workspace-open");
    }
    if (els.phetWorkspace) {
      els.phetWorkspace.classList.toggle("hidden", !APP.phet.isOpen);
    }
    if (els.phetDetailModal) {
      els.phetDetailModal.classList.toggle("hidden", !APP.phet.detailOpen);
    }
    if (els.togglePhetWorkspaceBtn) {
      els.togglePhetWorkspaceBtn.classList.toggle("active", APP.phet.isOpen);
      els.togglePhetWorkspaceBtn.setAttribute("aria-expanded", APP.phet.isOpen ? "true" : "false");
    }
    if (els.phetCatalogMeta) {
      if (APP.phet.loading) {
        els.phetCatalogMeta.textContent = "正在同步实验目录";
      } else if (APP.phet.error) {
        els.phetCatalogMeta.textContent = `目录载入失败：${APP.phet.error}`;
      } else if (APP.phet.total) {
        const stamp = APP.phet.updatedAt ? formatPhetUpdatedAt(APP.phet.updatedAt) : "刚刚";
        els.phetCatalogMeta.textContent = `共 ${APP.phet.total} 个实验 · ${stamp} 更新`;
      } else {
        els.phetCatalogMeta.textContent = "准备载入实验目录";
      }
    }
    renderPhetTopicTabs();
  }

  function renderPhetTopicTabs() {
    if (!els.phetTopicTabs) return;
    const groups = APP.phet.groups || [];
    if (!groups.length) {
      els.phetTopicTabs.innerHTML = "";
      return;
    }
    const tabs = [
      { key: "all", label: "全部" },
      ...groups.map((group) => ({
        key: group.topic_key,
        label: group.topic_label_zh || group.topic_label_en || group.topic_key,
      })),
    ];
    els.phetTopicTabs.innerHTML = tabs
      .map(
        (tab) => `
          <button
            type="button"
            class="phet-topic-tab${tab.key === APP.phet.activeTopic ? " active" : ""}"
            data-topic-key="${tab.key}"
          >
            ${escapeHtml(tab.label)}
          </button>
        `
      )
      .join("");
  }

  function getFilteredPhetGroups() {
    const activeTopic = APP.phet.activeTopic || "all";
    return (APP.phet.groups || [])
      .filter((group) => activeTopic === "all" || group.topic_key === activeTopic)
      .map((group) => ({ ...group, sims: Array.isArray(group.sims) ? group.sims : [] }))
      .filter((group) => group.sims.length);
  }

  function findPhetSimulation(slug = APP.phet.selectedSlug) {
    if (!slug) return null;
    for (const group of APP.phet.groups || []) {
      const match = (group.sims || []).find((sim) => sim.slug === slug);
      if (match) return match;
    }
    return null;
  }

  function ensurePhetSelection() {
    const filteredGroups = getFilteredPhetGroups();
    const current = findPhetSimulation(APP.phet.selectedSlug);
    const stillVisible = filteredGroups.some((group) => (group.sims || []).some((sim) => sim.slug === current?.slug));
    if (stillVisible) {
      return current;
    }
    const next = filteredGroups[0]?.sims?.[0] || null;
    APP.phet.selectedSlug = next?.slug || "";
    return next;
  }

  function selectPhetSimulation(slug, { revealDetail = true } = {}) {
    if (!slug) return;
    const wasDetailOpen = APP.phet.detailOpen;
    APP.phet.selectedSlug = slug;
    APP.phet.detailOpen = Boolean(revealDetail);
    renderPhetWorkspace();
    syncImmersiveState();
    renderPhetCatalog();
    renderPhetDetail();
    if (APP.phet.detailOpen && !wasDetailOpen) {
      pushUiHistoryView("phet-detail");
    }
    requestAnimationFrame(() => {
      els.phetDetailContent?.scrollTo?.({ top: 0, behavior: "smooth" });
    });
  }

  function openPhetDetail(slug) {
    selectPhetSimulation(slug, { revealDetail: true });
  }

  function closePhetDetail({ skipHistory = false } = {}) {
    if (!skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "phet-detail") {
      history.back();
      return;
    }
    APP.phet.detailOpen = false;
    APP.phet.mobileScreen = "catalog";
    if (skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "phet-detail") {
      replaceUiHistoryView(APP.phet.isOpen ? "phet-catalog" : "root");
    }
    renderPhetWorkspace();
    syncImmersiveState();
  }

  function renderPhetCatalog() {
    if (!els.phetCatalogList) return;
    const groups = getFilteredPhetGroups();
    if (APP.phet.loading && !groups.length) {
      els.phetCatalogList.innerHTML = `<div class="phet-empty-list">正在加载实验目录...</div>`;
      return;
    }
    if (APP.phet.error && !groups.length) {
      els.phetCatalogList.innerHTML = `<div class="phet-empty-list">实验目录暂时不可用，请稍后重试。</div>`;
      return;
    }
    if (!groups.length) {
      els.phetCatalogList.innerHTML = `<div class="phet-empty-list">当前主题下暂无可展示的实验。</div>`;
      return;
    }

    els.phetCatalogList.innerHTML = groups
      .map(
        (group) => `
          <section class="phet-group">
            <div class="phet-group-header">${escapeHtml(group.topic_label_zh || group.topic_label_en || group.topic_key)}</div>
            <div class="phet-group-list">
              ${(group.sims || [])
                .map(
                  (sim) => `
                    <button
                      type="button"
                      class="phet-sim-btn${sim.slug === APP.phet.selectedSlug ? " active" : ""}"
                      data-phet-slug="${sim.slug}"
                    >
                      <span class="phet-sim-copy">
                        <span class="phet-sim-title">${escapeHtml(sim.title_zh || sim.title_en || sim.slug)}</span>
                        <span class="phet-sim-meta">${escapeHtml(sim.research_focus_zh || sim.topic_label_zh || "适合现象观察与变量分析")}</span>
                      </span>
                      <span class="phet-sim-side">
                        <span class="phet-sim-language${sim.has_official_zh ? " is-zh" : ""}">${escapeHtml(sim.has_official_zh ? "中文" : "中英讲解")}</span>
                        <i class="ri-arrow-right-up-line"></i>
                      </span>
                    </button>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
  }

  function renderPhetDetail() {
    const sim = ensurePhetSelection();
    if (!els.phetEmptyState || !els.phetDetailContent) return;

    if (!APP.phet.detailOpen) {
      els.phetEmptyState.classList.add("hidden");
      els.phetDetailContent.classList.add("hidden");
      return;
    }

    if (!sim) {
      els.phetEmptyState.classList.remove("hidden");
      els.phetDetailContent.classList.add("hidden");
      return;
    }

    els.phetEmptyState.classList.add("hidden");
    els.phetDetailContent.classList.remove("hidden");

    if (els.phetDetailTitle) {
      els.phetDetailTitle.textContent = sim.title_zh || sim.title_en || sim.slug;
    }
    if (els.phetLanguageBadge) {
      els.phetLanguageBadge.textContent = sim.has_official_zh ? "中文界面" : "英文界面（支持中文讲解）";
      els.phetLanguageBadge.classList.toggle("is-zh", Boolean(sim.has_official_zh));
      els.phetLanguageBadge.classList.toggle("is-en", !sim.has_official_zh);
    }
    if (els.phetDetailMeta) {
      els.phetDetailMeta.textContent = `${sim.topic_zh || "课外实验"} · ${sim.research_focus_zh || "适合参数分析与现象观察"}`;
    }
    if (els.phetOpenNewWindowLink) {
      els.phetOpenNewWindowLink.href = sim.embed_url || "#";
    }
    if (els.phetIntroText) {
      els.phetIntroText.textContent = sim.intro_zh || "该实验当前缺少详细概述，建议先进入仿真界面识别变量、读数与现象，再结合规律提出问题。";
    }
    if (els.phetObservationList) {
      const observationBlocks = [];
      (sim.observation_points || []).forEach((item) => observationBlocks.push(item));
      (sim.readouts_zh || []).slice(0, 2).forEach((item) => observationBlocks.push(item));
      renderTextBlocks(els.phetObservationList, observationBlocks);
    }
    if (els.phetQuestionHintList) {
      els.phetQuestionHintList.innerHTML = (sim.suggested_questions || [])
        .map(
          (item) => `
            <button type="button" class="phet-suggestion-btn" data-suggestion="${escapeAttribute(item)}">
              ${escapeHtml(item)}
            </button>
          `
        )
        .join("");
    }
    if (els.phetInterfaceGuidanceList) {
      renderGuidanceSections(els.phetInterfaceGuidanceList, sim);
    }
    if (els.phetQuestionInput) {
      els.phetQuestionInput.placeholder = `围绕“${sim.title_zh || sim.title_en || sim.slug}”继续提出分析问题`;
      autoResizeTextarea(els.phetQuestionInput);
    }

    updatePhetFrame(sim);
  }

  function updatePhetFrame(sim) {
    if (!els.phetFrame || !sim?.embed_url) return;
    clearTimeout(APP.phet.frameTimeoutId);
    if (els.phetFrame.src === sim.embed_url && APP.phet.frameReady) {
      els.phetFrameLoading?.classList.add("hidden");
      els.phetFrameNotice?.classList.add("hidden");
      return;
    }
    APP.phet.frameReady = false;
    els.phetFrameLoading?.classList.remove("hidden");
    els.phetFrameNotice?.classList.add("hidden");
    if (els.phetFrame.src !== sim.embed_url) {
      els.phetFrame.src = sim.embed_url;
    }
    APP.phet.frameTimeoutId = window.setTimeout(() => {
      if (!APP.phet.frameReady) {
        els.phetFrameLoading?.classList.add("hidden");
        els.phetFrameNotice?.classList.remove("hidden");
      }
    }, 8000);
  }

  function renderTextBlocks(container, items) {
    if (!container) return;
    const blocks = (Array.isArray(items) ? items : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    container.innerHTML = blocks.map((item) => `<div class="phet-text-block">${escapeHtml(item)}</div>`).join("");
  }

  function renderGuidanceSections(container, sim) {
    if (!container) return;
    const sections = [
      {
        title: "先看哪里",
        items: [sim.layout_zh, ...(Array.isArray(sim.screen_flow_zh) ? sim.screen_flow_zh.slice(0, 3) : [])],
      },
      {
        title: "可以调什么",
        items: Array.isArray(sim.controls_zh) ? sim.controls_zh : [],
      },
      {
        title: "怎么调会发生什么",
        items: Array.isArray(sim.interaction_effects_zh) && sim.interaction_effects_zh.length
          ? sim.interaction_effects_zh
          : (Array.isArray(sim.effects_zh) ? sim.effects_zh : []),
      },
      {
        title: "建议先做哪一步",
        items: Array.isArray(sim.first_steps_zh) ? sim.first_steps_zh : [],
      },
    ]
      .map((section) => ({
        ...section,
        items: (Array.isArray(section.items) ? section.items : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      }))
      .filter((section) => section.items.length);

    container.innerHTML = sections
      .map(
        (section) => `
          <section class="phet-guidance-section">
            <h5 class="phet-guidance-title">${escapeHtml(section.title)}</h5>
            <div class="phet-guidance-list">
              ${section.items.map((item) => `<div class="phet-guidance-item">${escapeHtml(item)}</div>`).join("")}
            </div>
          </section>
        `
      )
      .join("");
  }

  function stopPhetCaptureStream() {
    const stream = APP.phet.captureStream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    APP.phet.captureStream = null;
    APP.phet.captureReady = false;
    if (APP.phet.captureVideo) {
      APP.phet.captureVideo.pause();
      APP.phet.captureVideo.srcObject = null;
    }
  }

  function canUseWebCameraCapture() {
    return !APP.runtime.isCapacitorShell && Boolean(navigator.mediaDevices?.getUserMedia);
  }

  function stopWebCameraStream() {
    const stream = APP.webCamera.stream;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    APP.webCamera.stream = null;
    APP.webCamera.ready = false;
    APP.webCamera.opening = false;
    if (els.webCameraVideo) {
      els.webCameraVideo.pause();
      els.webCameraVideo.srcObject = null;
    }
    if (els.webCameraPlaceholder) {
      els.webCameraPlaceholder.classList.remove("hidden");
      els.webCameraPlaceholder.innerHTML = `
        <i class="ri-camera-lens-line"></i>
        <span>正在准备摄像头画面…</span>
      `;
    }
    if (els.webCameraCaptureBtn) {
      els.webCameraCaptureBtn.disabled = true;
    }
  }

  function closeWebCameraModal() {
    els.webCameraModal?.classList.add("hidden");
    stopWebCameraStream();
  }

  async function ensureWebCameraStream() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("当前浏览器不支持网页拍照");
    }

    const activeTrack = APP.webCamera.stream?.getVideoTracks?.()[0];
    if (activeTrack && activeTrack.readyState === "live" && APP.webCamera.ready) {
      return APP.webCamera.stream;
    }

    APP.webCamera.opening = true;
    if (els.webCameraStatus) {
      els.webCameraStatus.textContent = "正在请求浏览器摄像头权限…";
    }
    if (els.webCameraCaptureBtn) {
      els.webCameraCaptureBtn.disabled = true;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    APP.webCamera.stream = stream;
    if (els.webCameraVideo) {
      els.webCameraVideo.srcObject = stream;
      if (els.webCameraVideo.readyState < 1) {
        await new Promise((resolve) => {
          const handleReady = () => {
            els.webCameraVideo?.removeEventListener("loadedmetadata", handleReady);
            resolve();
          };
          els.webCameraVideo.addEventListener("loadedmetadata", handleReady, { once: true });
        });
      }
      await els.webCameraVideo.play().catch(() => {});
    }

    APP.webCamera.ready = true;
    APP.webCamera.opening = false;
    if (els.webCameraPlaceholder) {
      els.webCameraPlaceholder.classList.add("hidden");
    }
    if (els.webCameraStatus) {
      els.webCameraStatus.textContent = "画面已就绪，点击下方“拍照并使用”即可进入图片提问。";
    }
    if (els.webCameraCaptureBtn) {
      els.webCameraCaptureBtn.disabled = false;
    }
    return stream;
  }

  async function openWebCameraModal() {
    if (!els.webCameraModal) {
      await openFallbackImagePicker({ capture: true, sourceLabel: "拍照图片" });
      return;
    }

    els.webCameraModal.classList.remove("hidden");
    try {
      await ensureWebCameraStream();
    } catch (error) {
      stopWebCameraStream();
      APP.webCamera.opening = false;
      APP.webCamera.ready = false;
      if (els.webCameraStatus) {
        els.webCameraStatus.textContent = `摄像头启动失败：${error.message || "未知错误"}。你也可以改用相册导入。`;
      }
      if (els.webCameraPlaceholder) {
        els.webCameraPlaceholder.classList.remove("hidden");
        els.webCameraPlaceholder.innerHTML = `
          <i class="ri-camera-off-line"></i>
          <span>暂时无法获取摄像头画面，请检查浏览器权限或改用相册导入。</span>
        `;
      }
      if (els.webCameraCaptureBtn) {
        els.webCameraCaptureBtn.disabled = true;
      }
    }
  }

  async function captureWebCameraPhoto() {
    const video = els.webCameraVideo;
    const canvas = els.webCameraCanvas;
    if (!video || !canvas || !APP.webCamera.ready) {
      throw new Error("摄像头画面尚未准备完成");
    }

    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    if (width < 2 || height < 2) {
      throw new Error("未获取到有效的视频画面尺寸");
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("无法创建拍照画布");
    }
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) {
      throw new Error("浏览器未返回可用图像数据");
    }

    const base64 = await blobToBase64(blob);
    setPendingImageFromNative({
      base64,
      mime: blob.type || "image/jpeg",
      name: formatNativeImageName("camera", blob.type || "image/jpeg"),
      sourceLabel: "拍照图片",
    });
    closeWebCameraModal();
  }

  async function ensurePhetCaptureStream() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("当前浏览器不支持标签页共享截图");
    }

    const activeTrack = APP.phet.captureStream?.getVideoTracks?.()[0];
    if (activeTrack && activeTrack.readyState === "live" && APP.phet.captureReady) {
      return APP.phet.captureStream;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude",
      },
      audio: false,
    });

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.srcObject = stream;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video
          .play()
          .then(resolve)
          .catch(reject);
      };
      video.onerror = () => reject(new Error("无法初始化仿真截图流"));
    });

    stream.getVideoTracks().forEach((track) => {
      track.onended = () => {
        APP.phet.captureReady = false;
        APP.phet.captureStream = null;
      };
    });

    APP.phet.captureStream = stream;
    APP.phet.captureVideo = video;
    APP.phet.captureCanvas = APP.phet.captureCanvas || document.createElement("canvas");
    APP.phet.captureReady = true;
    return stream;
  }

  async function capturePhetWorkspaceImage(options = {}) {
    const { failureToast = "", markNotice = true } = options;
    if (!els.phetFrame) return null;
    try {
      await ensurePhetCaptureStream();
    } catch (error) {
      if (failureToast) {
        showToast(typeof failureToast === "function" ? failureToast(error) : failureToast);
      } else if (!APP.phet.captureNoticeShown) {
        showToast(`本次未获取到当前仿真画面，已按文本模式继续：${error.message}`);
      }
      if (markNotice) {
        APP.phet.captureNoticeShown = true;
      }
      return null;
    }

    const video = APP.phet.captureVideo;
    const canvas = APP.phet.captureCanvas;
    if (!video || !canvas || !APP.phet.captureReady) {
      return null;
    }

    const rect = els.phetFrame.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) {
      return null;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.width;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || rect.height;
    const scaleX = (video.videoWidth || viewportWidth) / viewportWidth;
    const scaleY = (video.videoHeight || viewportHeight) / viewportHeight;
    const sourceX = Math.max(0, Math.floor(rect.left * scaleX));
    const sourceY = Math.max(0, Math.floor(rect.top * scaleY));
    const sourceW = Math.max(1, Math.floor(rect.width * scaleX));
    const sourceH = Math.max(1, Math.floor(rect.height * scaleY));

    canvas.width = sourceW;
    canvas.height = sourceH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, sourceW, sourceH);
    ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return {
      base64: dataUrl,
      mime: "image/jpeg",
    };
  }

  async function savePhetExperimentImage() {
    const sim = findPhetSimulation();
    if (!sim) {
      showToast("请先选择一个课外实验");
      return;
    }

    await runWithBusyButton(els.phetSaveImageBtn, "保存中", async () => {
      showToast("浏览器将请求共享当前标签页；系统会自动裁剪并保存实验区域。");
      const image = await capturePhetWorkspaceImage({
        markNotice: false,
        failureToast: (error) => `未能保存当前实验图像：${error.message || "浏览器未授权截图"}`,
      });
      if (!image?.base64) return;

      const blob = dataUrlToBlob(image.base64, image.mime || "image/jpeg");
      const timestamp = formatExportTimestamp();
      const slug = sanitizeFilenamePart(sim.slug || sim.title_en || "phet-experiment");
      const filename = `phet-${slug}-${timestamp}.jpg`;
      await saveBlobWithShareFallback(blob, filename, {
        shareTitle: `${sim.title_zh || sim.title_en || "课外实验"}图像`,
        shareText: "课外仿真实验当前画面",
        shareSuccessToast: "已调起系统分享面板，可直接保存或发送实验图像。",
        downloadToast: `已开始保存实验图像：${filename}`,
        preferDownload: true,
      });
    }).catch((error) => {
      showToast(`保存实验图像失败：${error.message || "未知错误"}`);
    });
  }

  async function askFromPhetWorkspace() {
    const sim = findPhetSimulation();
    const question = String(els.phetQuestionInput?.value || "").trim();
    if (!sim) {
      showToast("请先选择一个课外实验");
      return;
    }
    if (!question) {
      showToast("先输入你想提问的问题");
      return;
    }

    const hiddenImage = await capturePhetWorkspaceImage();
    if (hiddenImage) {
      APP.phet.captureNoticeShown = false;
    }

    await sendMessage(question, {
      hiddenImage,
      externalLabContext: {
        provider: "phet",
        slug: sim.slug,
        title_zh: sim.title_zh || "",
        title_en: sim.title_en || "",
        topic_zh: sim.topic_zh || "",
        intro_zh: sim.intro_zh || "",
        interface_guidance_zh: Array.isArray(sim.interface_guidance_zh) ? sim.interface_guidance_zh : [],
        layout_zh: sim.layout_zh || "",
        screen_flow_zh: Array.isArray(sim.screen_flow_zh) ? sim.screen_flow_zh : [],
        controls_zh: Array.isArray(sim.controls_zh) ? sim.controls_zh : [],
        interaction_effects_zh: Array.isArray(sim.interaction_effects_zh) ? sim.interaction_effects_zh : [],
        effects_zh: Array.isArray(sim.effects_zh) ? sim.effects_zh : [],
        readouts_zh: Array.isArray(sim.readouts_zh) ? sim.readouts_zh : [],
        first_steps_zh: Array.isArray(sim.first_steps_zh) ? sim.first_steps_zh : [],
        terms_zh: Array.isArray(sim.terms_zh) ? sim.terms_zh : [],
        hidden_tutor_prompt_zh: sim.hidden_tutor_prompt_zh || "",
        ui_profile_version: sim.ui_profile_version || "",
        needs_manual_review: Boolean(sim.needs_manual_review),
        sim_url: sim.embed_url || "",
        official_page_url: sim.official_page_url || "",
        has_official_zh: Boolean(sim.has_official_zh),
      },
    });

    if (els.phetQuestionInput) {
      els.phetQuestionInput.value = "";
      autoResizeTextarea(els.phetQuestionInput);
    }
  }

  function formatPhetUpdatedAt(value) {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return "刚刚";
    return new Date(time).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function createFolderInteractive() {
    const projectName = window.prompt("输入新项目名称");
    if (projectName === null) return;
    const projectCleanName = projectName.trim();
    if (!projectCleanName) return;
    try {
      const response = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectCleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`新建项目失败：${error.message}`);
    }
  }

  async function renameFolderInteractive(folderId) {
    const projectInfo = APP.sessionCatalog.folders.find((item) => item.id === folderId);
    const projectName = window.prompt("修改项目名称", projectInfo?.name || "");
    if (projectName === null) return;
    const projectCleanName = projectName.trim();
    if (!projectCleanName) return;
    try {
      const response = await fetch(`/api/folders/${encodeURIComponent(folderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectCleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`重命名项目失败：${error.message}`);
    }
  }

  async function renameSessionInteractive(sessionId) {
    const session = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    const name = window.prompt("修改对话名称", session?.title || "");
    if (name === null) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanName }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      if (sessionId === APP.sessionId) {
        APP.currentSessionTitle = cleanName;
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`重命名对话失败：${error.message}`);
    }
  }

  async function moveSessionToFolder(sessionId, folderId) {
    const session = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    if (!session) return;
    if ((session.folder_id || null) === (folderId || null)) return;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
      if (sessionId === APP.sessionId) {
        await hydrateSession();
      }
    } catch (error) {
      showToast(`移动对话失败：${error.message}`);
    }
  }

  async function deleteSessionInteractive(sessionId) {
    const session = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    if (!session) return;
    const confirmed = window.confirm(`删除对话“${session.title || "未命名对话"}”后无法恢复，是否继续？`);
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      if (sessionId === APP.sessionId) {
        await startNewConversation();
        return;
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`删除对话失败：${error.message}`);
    }
  }

  async function deleteFolderInteractive(folderId) {
    const projectInfo = APP.sessionCatalog.folders.find((item) => item.id === folderId);
    if (!projectInfo) return;
    const projectConfirmed = window.confirm(`删除项目“${projectInfo.name}”后，其中对话会移出项目，是否继续？`);
    if (!projectConfirmed) return;
    try {
      const response = await fetch(`/api/folders/${encodeURIComponent(folderId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      delete APP.folderOpenMap[folderId];
      saveFolderOpenMap(APP.folderOpenMap);
      await loadSessionCatalog();
      if (APP.sessionCatalog.sessions.some((item) => item.session_id === APP.sessionId)) {
        await hydrateSession();
      }
    } catch (error) {
      showToast(`删除项目失败：${error.message}`);
    }
  }

  async function moveSessionInteractive(sessionId) {
    const currentSession = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    const targetName = window.prompt("输入目标项目名称，留空则移出项目", currentSession?.folder_name || "");
    if (targetName === null) return;
    const targetCleanName = targetName.trim();
    let targetFolderId = null;
    try {
      if (targetCleanName) {
        let targetFolder = APP.sessionCatalog.folders.find((item) => item.name === targetCleanName);
        if (!targetFolder) {
          const createResp = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: targetCleanName }),
          });
          if (!createResp.ok) {
            const error = await createResp.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${createResp.status}`);
          }
          targetFolder = await createResp.json();
        }
        targetFolderId = targetFolder.id;
      }
      await moveSessionToFolder(sessionId, targetFolderId);
    } catch (error) {
      showToast(`移动对话失败：${error.message}`);
    }
    return;
    const current = APP.sessionCatalog.sessions.find((item) => item.session_id === sessionId);
    const name = window.prompt("输入目标文件夹名称，留空则移出文件夹", current?.folder_name || "");
    if (name === null) return;
    const cleanName = name.trim();
    let folderId = null;
    try {
      if (cleanName) {
        let folder = APP.sessionCatalog.folders.find((item) => item.name === cleanName);
        if (!folder) {
          const createResp = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: cleanName }),
          });
          if (!createResp.ok) {
            const error = await createResp.json().catch(() => ({}));
            throw new Error(error.detail || `HTTP ${createResp.status}`);
          }
          folder = await createResp.json();
        }
        folderId = folder.id;
      }

      const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      await loadSessionCatalog();
    } catch (error) {
      showToast(`移动对话失败：${error.message}`);
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast("当前浏览器不支持录音");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const preferredMime = MediaRecorder.isTypeSupported?.("audio/webm") ? "audio/webm" : "";
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      APP.mediaRecorder = recorder;
      if (els.recordBtn) {
        els.recordBtn.classList.add("recording");
        els.recordBtn.title = "停止录音";
      }

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", async () => {
        clearTimeout(APP.recordingTimer);
        APP.recordingTimer = null;
        stream.getTracks().forEach((track) => track.stop());
        if (els.recordBtn) {
          els.recordBtn.classList.remove("recording");
          els.recordBtn.title = "开始录音";
        }
        APP.mediaRecorder = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          return;
        }
        if (blob.size > 10 * 1024 * 1024) {
          showToast("录音超过 10MB 上限，请缩短时长");
          return;
        }
        const base64 = await blobToBase64(blob);
        APP.pendingAudio = {
          base64,
          mime: blob.type || "audio/webm",
          name: `录音 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
        };
        APP.pendingImage = null;
        updatePendingAttachmentBars();
      });

      recorder.start();
      showToast("开始录音，30 秒后会自动停止");
      APP.recordingTimer = window.setTimeout(() => {
        stopRecording();
      }, 30000);
    } catch (error) {
      showToast(`无法开始录音：${error.message}`);
    }
  }

  function stopRecording() {
    if (APP.mediaRecorder?.state === "recording") {
      APP.mediaRecorder.stop();
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
      reader.onload = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.readAsDataURL(blob);
    });
  }

  function appendUploadedFileListItem(text) {
    if (!els.uploadedFiles || !text) return;
    const li = document.createElement("li");
    li.textContent = text;
    els.uploadedFiles.prepend(li);
    while (els.uploadedFiles.children.length > 8) {
      els.uploadedFiles.lastElementChild?.remove();
    }
  }

  function normalizeImageMime(formatOrMime) {
    const raw = String(formatOrMime || "").trim().toLowerCase();
    if (!raw) return "image/jpeg";
    if (raw.startsWith("image/")) {
      return raw === "image/jpg" ? "image/jpeg" : raw;
    }
    return raw === "jpg" ? "image/jpeg" : `image/${raw}`;
  }

  function formatNativeImageName(sourceType, mime) {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const stamp = `${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const ext = normalizeImageMime(mime).replace("image/", "").replace("jpeg", "jpg");
    return `${sourceType === "camera" ? "现场拍照" : "相册图片"} ${stamp}.${ext}`;
  }

  function looksLikeUserCancellation(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return (
      message.includes("cancel")
      || message.includes("canceled")
      || message.includes("cancelled")
      || message.includes("user denied")
      || message.includes("no image picked")
      || message.includes("selection cancelled")
    );
  }

  function setPendingImageFromNative({ base64, mime, name, sourceLabel }) {
    APP.pendingImage = {
      base64,
      mime: normalizeImageMime(mime),
      name: name || "手机图片",
    };
    APP.pendingAudio = null;
    updatePendingAttachmentBars();
    appendUploadedFileListItem(`${APP.pendingImage.name}：已就绪（视觉分析）`);
    setUploadStatus(`${sourceLabel}已就绪，可直接向 Agent 提问`);
    showToast(`${sourceLabel}已就绪，下一条消息将调用视觉模型`);
  }

  async function openFallbackImagePicker({ capture = false, sourceLabel = "图片" } = {}) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) {
      input.setAttribute("capture", "environment");
    }

    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      setUploadStatus(`正在处理${sourceLabel}...`);
      await uploadFiles(files);
    }, { once: true });

    input.click();
  }

  async function ensureNativeCameraPermission(cameraPlugin) {
    if (!cameraPlugin?.checkPermissions || !cameraPlugin?.requestPermissions) return;
    const existing = await cameraPlugin.checkPermissions().catch(() => null);
    if (existing?.camera === "granted" || existing?.camera === "limited") return;

    const next = await cameraPlugin.requestPermissions({ permissions: ["camera"] });
    if (next?.camera !== "granted" && next?.camera !== "limited") {
      throw new Error("未获得相机权限，请在系统设置中允许相机访问");
    }
  }

  async function handleNativePhotoSelection(sourceType) {
    const sourceLabel = sourceType === "camera" ? "拍照图片" : "相册图片";
    const cameraPlugin = getCapacitorCameraPlugin();

    if (!cameraPlugin?.getPhoto) {
      if (sourceType === "camera" && canUseWebCameraCapture()) {
        await openWebCameraModal();
        return;
      }
      await openFallbackImagePicker({ capture: sourceType === "camera", sourceLabel });
      return;
    }

    try {
      if (sourceType === "camera") {
        await ensureNativeCameraPermission(cameraPlugin);
      }

      const photo = await cameraPlugin.getPhoto({
        source: sourceType === "camera" ? "CAMERA" : "PHOTOS",
        resultType: "base64",
        quality: 92,
        allowEditing: false,
        correctOrientation: true,
        saveToGallery: false,
        width: 1800,
        height: 1800,
      });

      if (!photo?.base64String) {
        throw new Error("未读取到可发送的图片数据");
      }

      setPendingImageFromNative({
        base64: photo.base64String,
        mime: photo.format,
        name: formatNativeImageName(sourceType, photo.format),
        sourceLabel,
      });
    } catch (error) {
      if (looksLikeUserCancellation(error)) return;
      showToast(`${sourceLabel}失败：${error.message || "未知错误"}`);
    }
  }

  function onSimulationSliderInput(index, value) {
    if (!Number.isFinite(value)) return;

    const expId = SIM.currentExpId;

    if (expId === "michelson") {
      const p = SIM.params.michelson;
      if (index === 1) {
        const delta = value - p.lambdaNm;
        p.lambdaNm = value;
        markControlAction(expId, "lambdaNm", delta);
      } else {
        const delta = value - p.displacementUm;
        p.displacementUm = value;
        if (Math.abs(delta) < 0.0003) {
          SIM.motion = "stable";
        } else {
          SIM.motion = delta > 0 ? "outward" : "inward";
        }
        markControlAction(expId, "displacementUm", delta);
      }
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      if (index === 1) {
        const delta = value - p.lambdaNm;
        p.lambdaNm = value;
        markControlAction(expId, "lambdaNm", delta);
      } else {
        const delta = value - p.curvatureMm;
        p.curvatureMm = value;
        markControlAction(expId, "curvatureMm", delta);
      }
    }

    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      if (index === 1) {
        const delta = value - p.freqHz;
        p.freqHz = value;
        markControlAction(expId, "freqHz", delta);
      } else {
        const delta = value - p.damping;
        p.damping = value;
        markControlAction(expId, "damping", delta);
      }
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      if (index === 1) {
        const delta = value - p.prismAngleDeg;
        p.prismAngleDeg = value;
        p.theta1Deg = null;
        p.theta2Deg = null;
        p.lastAlignedIndex = -1;
        markControlAction(expId, "prismAngleDeg", delta);
      } else {
        const delta = value - p.telescopeDeg;
        p.telescopeDeg = normalizeDeg(value);
        markControlAction(expId, "telescopeDeg", delta);
      }
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      if (index === 1) {
        const clamped = clamp(value, 0, 90);
        const delta = clamped - p.theta0Deg;
        p.theta0Deg = clamped;
        p.currentThetaDeg = clamped;
        p.prevThetaDeg = clamped;
        p.simTimeSec = 0;
        p.isOscillating = false;
        markControlAction(expId, "theta0Deg", delta);
      }
    }

    if (expId === "double-arm-bridge") {
      const p = SIM.params["double-arm-bridge"];
      if (index === 1) {
        const delta = value - p.ratio;
        p.ratio = value;
        markControlAction(expId, "ratio", delta);
      } else {
        const delta = value - p.standardMilliOhm;
        p.standardMilliOhm = value;
        markControlAction(expId, "standardMilliOhm", delta);
      }
    }

    if (expId === "oscilloscope") {
      const p = SIM.params.oscilloscope;
      if (index === 1) {
        const delta = value - p.freqHz;
        p.freqHz = value;
        markControlAction(expId, "freqHz", delta);
      } else {
        const delta = value - p.amplitudeV;
        p.amplitudeV = value;
        markControlAction(expId, "amplitudeV", delta);
      }
    }

    if (expId === "dielectric-constant") {
      const p = SIM.params["dielectric-constant"];
      if (index === 1) {
        const delta = value - p.epsilonR;
        p.epsilonR = value;
        markControlAction(expId, "epsilonR", delta);
      } else {
        const clamped = clamp(value, 0, 1);
        const delta = clamped - p.fillRatio;
        p.fillRatio = clamped;
        markControlAction(expId, "fillRatio", delta);
      }
    }

    if (expId === "franck-hertz") {
      const p = SIM.params["franck-hertz"];
      if (index === 1) {
        const delta = value - p.acceleratingV;
        p.acceleratingV = value;
        markControlAction(expId, "acceleratingV", delta);
      } else {
        const delta = value - p.retardingV;
        p.retardingV = value;
        markControlAction(expId, "retardingV", delta);
      }
    }

    if (expId === "grating-spectrum") {
      const p = SIM.params["grating-spectrum"];
      if (index === 1) {
        const delta = value - p.linesPerMm;
        p.linesPerMm = value;
        markControlAction(expId, "linesPerMm", delta);
      } else {
        const delta = value - p.angleDeg;
        p.angleDeg = value;
        markControlAction(expId, "angleDeg", delta);
      }
    }

    if (expId === "hall-effect") {
      const p = SIM.params["hall-effect"];
      if (index === 1) {
        const delta = value - p.magneticT;
        p.magneticT = value;
        markControlAction(expId, "magneticT", delta);
      } else {
        const delta = value - p.currentMa;
        p.currentMa = value;
        markControlAction(expId, "currentMa", delta);
      }
    }

    if (expId === "potentiometer-emf") {
      const p = SIM.params["potentiometer-emf"];
      if (index === 1) {
        const delta = value - p.emfV;
        p.emfV = value;
        markControlAction(expId, "emfV", delta);
      } else {
        const delta = value - p.loadOhm;
        p.loadOhm = value;
        markControlAction(expId, "loadOhm", delta);
      }
    }

    if (expId === "photoelectric-effect") {
      const p = SIM.params["photoelectric-effect"];
      if (index === 1) {
        const delta = value - p.freqThz;
        p.freqThz = value;
        markControlAction(expId, "freqThz", delta);
      } else {
        const delta = value - p.reverseV;
        p.reverseV = value;
        markControlAction(expId, "reverseV", delta);
      }
    }

    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function markControlAction(expId, key, delta) {
    SIM.lastControlAction = {
      expId,
      key,
      direction: Math.abs(delta) < 1e-9 ? 0 : delta > 0 ? 1 : -1,
    };
  }

  function openPendulumLabModal() {
    const wasOpen = APP.pendulum.isOpen;
    APP.pendulum.isOpen = true;
    els.pendulumLabModal?.classList.remove("hidden");
    syncImmersiveState();
    renderPendulumLab();
    if (!wasOpen) {
      pushUiHistoryView("pendulum-lab");
    }
    startPendulumTrajectoryAnimation();
  }

  function closePendulumLabModal({ skipHistory = false } = {}) {
    if (!skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "pendulum-lab") {
      history.back();
      return;
    }
    APP.pendulum.isOpen = false;
    if (skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "pendulum-lab") {
      replaceUiHistoryView("root");
    }
    if (APP.pendulum.recording) {
      stopPendulumRecording({ discard: true });
    }
    els.pendulumLabModal?.classList.add("hidden");
    stopPendulumTrajectoryAnimation();
    syncImmersiveState();
  }

  function renderPendulumLab() {
    els.openPendulumLabBtn?.classList.toggle("active", APP.pendulum.isOpen);
    renderPendulumVideoPreview();
    renderPendulumRecordingState();
    renderPendulumStatus(APP.pendulum.error || APP.pendulum.status, Boolean(APP.pendulum.error));
    renderPendulumResult(APP.pendulum.result);
  }

  function renderPendulumVideoPreview() {
    const file = APP.pendulum.videoFile;
    if (els.pendulumVideoMeta) {
      els.pendulumVideoMeta.textContent = file
        ? `${file.name} · ${formatFileSize(file.size)}`
        : "mp4 / webm / mov / avi / mkv";
    }
    if (!els.pendulumVideoPreview) return;
    if (APP.pendulum.recording) {
      els.pendulumVideoPreview.classList.remove("hidden");
      return;
    }
    if (!file || !APP.pendulum.videoUrl) {
      els.pendulumVideoPreview.pause?.();
      els.pendulumVideoPreview.removeAttribute("src");
      els.pendulumVideoPreview.srcObject = null;
      els.pendulumVideoPreview.classList.add("hidden");
      return;
    }
    if (els.pendulumVideoPreview.src !== APP.pendulum.videoUrl) {
      els.pendulumVideoPreview.srcObject = null;
      els.pendulumVideoPreview.controls = true;
      els.pendulumVideoPreview.muted = true;
      els.pendulumVideoPreview.src = APP.pendulum.videoUrl;
    }
    els.pendulumVideoPreview.classList.remove("hidden");
  }

  function renderPendulumRecordingState() {
    if (!els.pendulumRecordBtn) return;
    els.pendulumRecordBtn.classList.toggle("recording", APP.pendulum.recording);
    const label = els.pendulumRecordBtn.querySelector("span");
    if (label) {
      label.textContent = APP.pendulum.recording ? "停止录制" : "摄像头录制";
    }
    const icon = els.pendulumRecordBtn.querySelector("i");
    if (icon) {
      icon.className = APP.pendulum.recording ? "ri-stop-circle-line" : "ri-record-circle-line";
    }
  }

  function renderPendulumStatus(message, isError = false) {
    if (!els.pendulumStatus) return;
    els.pendulumStatus.textContent = message || "";
    els.pendulumStatus.classList.toggle("is-error", Boolean(isError));
  }

  function renderPendulumResult(result) {
    const hasResult = Boolean(result);
    if (els.pendulumMetricExp) els.pendulumMetricExp.textContent = hasResult ? `${formatPendulumNumber(result.period_experimental, 4)} s` : "-- s";
    if (els.pendulumMetricTheory) {
      els.pendulumMetricTheory.textContent = hasResult
        ? (Number.isFinite(Number(result.period_theoretical)) ? `${formatPendulumNumber(result.period_theoretical, 4)} s` : "待输入 L")
        : "-- s";
    }
    if (els.pendulumMetricError) {
      els.pendulumMetricError.textContent = hasResult
        ? (Number.isFinite(Number(result.error)) ? formatPendulumPercent(result.error) : "未计算")
        : "--";
    }
    if (els.pendulumMetricStability) {
      els.pendulumMetricStability.textContent = hasResult ? (result.stability?.level || "样本不足") : "--";
    }
    if (els.pendulumDetectionMeta) {
      const hits = result?.detector_hits || {};
      els.pendulumDetectionMeta.textContent = hasResult
        ? `检测 ${result.detected_points || 0}/${result.frame_count || 0} 帧 · ${result.detector || "opencv"} · YOLO ${hits.yolov5 || 0} 帧`
        : "等待分析";
    }
    if (els.pendulumCurveCaption) {
      els.pendulumCurveCaption.textContent = hasResult
        ? `主频 ${formatPendulumNumber(result.dominant_frequency_hz, 4)} Hz · FPS ${formatPendulumNumber(result.fps, 2)}`
        : "摆球横向位移随时间变化";
    }
    if (els.pendulumCurvePlot) {
      els.pendulumCurvePlot.innerHTML = hasResult
        ? buildPendulumCurveSvg(result)
        : '<div class="pendulum-placeholder">完成分析后显示 x(t) 周期曲线。</div>';
    }
    if (els.pendulumResultSummary) {
      els.pendulumResultSummary.innerHTML = hasResult
        ? buildPendulumSummaryMarkup(result)
        : '<div class="data-lab-summary-empty">完成分析后，这里会显示周期、误差来源与操作改进建议。</div>';
    }
    renderPendulumProcessedVideo(result);
    if (els.pendulumSendToChatBtn) {
      els.pendulumSendToChatBtn.disabled = !hasResult;
    }
    if (hasResult && APP.pendulum.isOpen) {
      startPendulumTrajectoryAnimation();
    } else {
      renderPendulumTrajectoryEmpty();
    }
  }

  function clearPendulumProcessedVideo() {
    if (APP.pendulum.processedVideoUrl) {
      URL.revokeObjectURL(APP.pendulum.processedVideoUrl);
    }
    APP.pendulum.processedVideoUrl = "";
    APP.pendulum.processedVideoSource = "";
    APP.pendulum.processedVideoLoading = false;
    APP.pendulum.processedVideoError = "";
    if (els.pendulumProcessedVideo) {
      els.pendulumProcessedVideo.pause?.();
      els.pendulumProcessedVideo.removeAttribute("src");
      els.pendulumProcessedVideo.load?.();
    }
  }

  function renderPendulumProcessedVideo(result) {
    const hasResult = Boolean(result);
    const hasProcessedSource = Boolean(result?.processed_video_url);
    const hasPlayableVideo = Boolean(APP.pendulum.processedVideoUrl);
    const missingProcessedReason = !hasResult
      ? "完成分析后显示带检测点与轨迹标注的视频。"
      : APP.pendulum.processedVideoError
        ? APP.pendulum.processedVideoError
        : result.processed_video_created === false
          ? (result.processed_video_error || "后端未能生成标注视频，请检查 OpenCV 视频编码支持。")
          : result.processed_video_created === undefined
            ? "当前分析结果不包含处理后视频字段，可能来自旧后端或旧结果；请在新版端口重新点击“开始分析”。"
            : hasProcessedSource
              ? "处理后视频已生成，正在准备播放。"
              : "本次分析未生成处理后视频。";
    if (els.pendulumProcessedMeta) {
      els.pendulumProcessedMeta.textContent = !hasResult
        ? "等待分析"
        : APP.pendulum.processedVideoLoading
          ? "正在加载标注视频"
          : hasPlayableVideo
            ? `${result.detector_requested || "auto"} → ${result.detector || "opencv"}`
            : APP.pendulum.processedVideoError
              ? "标注视频加载失败"
              : hasProcessedSource
                ? "可加载处理后视频"
                : "未生成标注视频";
    }
    if (els.pendulumProcessedPlaceholder) {
      els.pendulumProcessedPlaceholder.classList.toggle("hidden", hasPlayableVideo);
      els.pendulumProcessedPlaceholder.textContent = !hasResult
        ? "完成分析后显示带检测点与轨迹标注的视频。"
        : APP.pendulum.processedVideoLoading
          ? "正在加载带检测点与轨迹标注的视频。"
          : missingProcessedReason;
    }
    if (!els.pendulumProcessedVideo) return;
    if (!hasPlayableVideo) {
      els.pendulumProcessedVideo.pause?.();
      els.pendulumProcessedVideo.classList.add("hidden");
      return;
    }
    if (els.pendulumProcessedVideo.src !== APP.pendulum.processedVideoUrl) {
      els.pendulumProcessedVideo.src = APP.pendulum.processedVideoUrl;
      els.pendulumProcessedVideo.load?.();
    }
    els.pendulumProcessedVideo.classList.remove("hidden");
  }

  function handlePendulumProcessedVideoPlaybackError() {
    if (!APP.pendulum.processedVideoUrl) return;
    URL.revokeObjectURL(APP.pendulum.processedVideoUrl);
    APP.pendulum.processedVideoUrl = "";
    APP.pendulum.processedVideoError = "浏览器无法播放这份标注视频，已切换为重新分析时生成 WebM 格式。";
    APP.pendulum.status = "单摆周期测量完成；处理后视频无法播放。";
    if (els.pendulumProcessedVideo) {
      els.pendulumProcessedVideo.pause?.();
      els.pendulumProcessedVideo.removeAttribute("src");
      els.pendulumProcessedVideo.classList.add("hidden");
    }
    renderPendulumLab();
  }

  async function loadPendulumProcessedVideo(result) {
    clearPendulumProcessedVideo();
    const source = String(result?.processed_video_url || "");
    if (!source) {
      renderPendulumLab();
      return;
    }
    APP.pendulum.processedVideoLoading = true;
    APP.pendulum.processedVideoSource = source;
    APP.pendulum.processedVideoError = "";
    renderPendulumLab();
    try {
      const response = await fetch(source, { method: "GET" });
      if (!response.ok) {
        throw new Error(await readApiErrorMessage(response, `处理后视频加载失败 (${response.status})`));
      }
      const blob = await response.blob();
      if (APP.pendulum.result !== result || APP.pendulum.processedVideoSource !== source) {
        return;
      }
      APP.pendulum.processedVideoUrl = URL.createObjectURL(blob);
    } catch (error) {
      APP.pendulum.processedVideoError = error?.message || "处理后视频加载失败";
    } finally {
      if (APP.pendulum.result === result && APP.pendulum.processedVideoSource === source) {
        APP.pendulum.processedVideoLoading = false;
        APP.pendulum.status = APP.pendulum.processedVideoError
          ? "单摆周期测量完成；处理后视频加载失败。"
          : "单摆周期测量完成，处理后视频已就绪。";
      }
      renderPendulumLab();
    }
  }

  function setPendulumVideoFile(file) {
    if (!file) return;
    if (!isSupportedPendulumVideo(file)) {
      APP.pendulum.error = "请上传 mp4、webm、mov、avi 或 mkv 格式的视频。";
      renderPendulumLab();
      showToast(APP.pendulum.error);
      return;
    }
    stopPendulumRecording({ discard: true });
    if (APP.pendulum.videoUrl) {
      URL.revokeObjectURL(APP.pendulum.videoUrl);
    }
    clearPendulumProcessedVideo();
    APP.pendulum.videoFile = file;
    APP.pendulum.videoUrl = URL.createObjectURL(file);
    APP.pendulum.result = null;
    APP.pendulum.error = "";
    APP.pendulum.status = `已载入视频：${file.name}`;
    renderPendulumLab();
    openPendulumLabModal();
  }

  function isSupportedPendulumVideo(file) {
    const name = String(file?.name || "").toLowerCase();
    const type = String(file?.type || "").toLowerCase();
    return (
      type.startsWith("video/")
      || /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(name)
    );
  }

  function resetPendulumLab() {
    stopPendulumRecording({ discard: true });
    if (APP.pendulum.videoUrl) {
      URL.revokeObjectURL(APP.pendulum.videoUrl);
    }
    clearPendulumProcessedVideo();
    APP.pendulum.videoFile = null;
    APP.pendulum.videoUrl = "";
    APP.pendulum.result = null;
    APP.pendulum.status = "请选择单摆实验视频。";
    APP.pendulum.error = "";
    APP.pendulum.recordingChunks = [];
    renderPendulumLab();
    stopPendulumTrajectoryAnimation();
  }

  async function togglePendulumRecording() {
    if (APP.pendulum.recording) {
      stopPendulumRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast("当前浏览器不支持视频录制");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const preferredMime = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ].find((mime) => MediaRecorder.isTypeSupported?.(mime));
      const recorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
      APP.pendulum.recordingStream = stream;
      APP.pendulum.mediaRecorder = recorder;
      APP.pendulum.recordingChunks = [];
      APP.pendulum.recordingDiscard = false;
      APP.pendulum.recording = true;
      APP.pendulum.error = "";
      APP.pendulum.status = "正在录制单摆视频。";

      if (els.pendulumVideoPreview) {
        els.pendulumVideoPreview.src = "";
        els.pendulumVideoPreview.srcObject = stream;
        els.pendulumVideoPreview.controls = false;
        els.pendulumVideoPreview.muted = true;
        els.pendulumVideoPreview.classList.remove("hidden");
        els.pendulumVideoPreview.play?.().catch(() => {});
      }

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) {
          APP.pendulum.recordingChunks.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        finalizePendulumRecording(recorder.mimeType || "video/webm");
      }, { once: true });

      recorder.start();
      renderPendulumLab();
      showToast("单摆视频录制已开始");
    } catch (error) {
      APP.pendulum.error = `无法开始录制：${error.message || "未知错误"}`;
      renderPendulumLab();
      showToast(APP.pendulum.error);
      stopPendulumRecording({ discard: true });
    }
  }

  function stopPendulumRecording({ discard = false } = {}) {
    APP.pendulum.recordingDiscard = Boolean(discard);
    const recorder = APP.pendulum.mediaRecorder;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    stopPendulumRecordingStream();
    APP.pendulum.recording = false;
    renderPendulumRecordingState();
  }

  function stopPendulumRecordingStream() {
    APP.pendulum.recordingStream?.getTracks?.().forEach((track) => track.stop());
    APP.pendulum.recordingStream = null;
  }

  function finalizePendulumRecording(mimeType) {
    const chunks = APP.pendulum.recordingChunks || [];
    const discard = APP.pendulum.recordingDiscard;
    APP.pendulum.recording = false;
    APP.pendulum.mediaRecorder = null;
    APP.pendulum.recordingChunks = [];
    stopPendulumRecordingStream();

    if (discard || !chunks.length) {
      renderPendulumLab();
      return;
    }

    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    if (!blob.size) {
      APP.pendulum.error = "录制视频为空，请重新录制。";
      renderPendulumLab();
      return;
    }
    const filename = `pendulum-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
    const file = new File([blob], filename, { type: blob.type || "video/webm" });
    setPendulumVideoFile(file);
    APP.pendulum.status = `录制完成：${filename}`;
    renderPendulumLab();
  }

  async function analyzePendulumVideo({ prompt = "帮我测单摆周期", appendToChat = true } = {}) {
    if (APP.auth.enabled && !APP.auth.user) {
      setAuthGateVisible(true);
      showToast("请先登录后再分析单摆视频");
      return null;
    }
    if (!APP.pendulum.videoFile) {
      openPendulumLabModal();
      APP.pendulum.error = "请先选择或录制单摆实验视频。";
      renderPendulumLab();
      showToast(APP.pendulum.error);
      return null;
    }
    if (APP.sending) {
      showToast("正在处理上一条请求，请稍候");
      return null;
    }

    const rawLength = String(els.pendulumLengthInput?.value || "").trim();
    const hasLength = rawLength !== "";
    const lengthM = hasLength ? Number(rawLength) : null;
    const gravity = Number(els.pendulumGravityInput?.value || "9.8");
    const detector = els.pendulumDetectorSelect?.value || "auto";
    if (hasLength && (!Number.isFinite(lengthM) || lengthM <= 0)) {
      APP.pendulum.error = "摆长 L 必须大于 0。";
      renderPendulumLab();
      showToast(APP.pendulum.error);
      return null;
    }
    if (!Number.isFinite(gravity) || gravity <= 0) {
      APP.pendulum.error = "重力加速度 g 必须大于 0。";
      renderPendulumLab();
      showToast(APP.pendulum.error);
      return null;
    }

    APP.sending = true;
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.recordBtn) els.recordBtn.disabled = true;
    APP.pendulum.error = "";
    APP.pendulum.status = "正在进行摆球检测与周期计算。";
    renderPendulumLab();

    let loadingRow = null;
    if (appendToChat) {
      appendUserMessage(`[单摆周期测量]\n${prompt}\n视频文件：${APP.pendulum.videoFile.name}`);
      if (prompt) pushHistory(prompt);
      loadingRow = appendLoadingMessage();
    }

    try {
      const form = new FormData();
      form.append("session_id", APP.sessionId);
      if (hasLength) form.append("length_m", String(lengthM));
      form.append("gravity", String(gravity));
      form.append("detector", detector);
      form.append("message", prompt || "帮我测单摆周期");
      form.append("video", APP.pendulum.videoFile, APP.pendulum.videoFile.name || "pendulum-video.webm");

      const result = await runWithBusyButton(els.pendulumAnalyzeBtn, "分析中", async () => {
        const response = await fetch("/api/physics/pendulum/analyze", { method: "POST", body: form });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, `单摆分析失败 (${response.status})`));
        }
        return await response.json();
      });

      APP.pendulum.result = result;
      APP.pendulum.status = result.processed_video_url ? "单摆周期测量完成，正在加载处理后视频。" : "单摆周期测量完成。";
      APP.pendulum.error = "";
      renderPendulumLab();
      loadPendulumProcessedVideo(result).catch(() => {});
      showToast("单摆周期测量完成");

      if (appendToChat) {
        loadingRow?.remove();
        await hydrateSession();
      }
      return result;
    } catch (error) {
      loadingRow?.remove();
      APP.pendulum.error = error.message || "单摆视频分析失败";
      renderPendulumLab();
      if (appendToChat) {
        appendAgentMessage(`单摆视频分析失败：${APP.pendulum.error}`);
      }
      showToast(APP.pendulum.error);
      return null;
    } finally {
      APP.sending = false;
      if (els.sendBtn) els.sendBtn.disabled = false;
      if (els.recordBtn) els.recordBtn.disabled = false;
      scrollChatToBottom();
      refreshQuickJumpPanel();
    }
  }

  async function readApiErrorMessage(response, fallback) {
    const text = await response.text().catch(() => "");
    if (!text.trim()) return fallback;
    try {
      const data = JSON.parse(text);
      return data.detail || fallback;
    } catch {
      return text.trim() || fallback;
    }
  }

  function buildPendulumCurveSvg(result) {
    const trajectory = Array.isArray(result?.trajectory) ? result.trajectory : [];
    if (trajectory.length < 2) {
      return '<div class="pendulum-placeholder">轨迹点不足，无法绘制周期曲线。</div>';
    }
    const width = 760;
    const height = 300;
    const padLeft = 52;
    const padRight = 22;
    const padTop = 24;
    const padBottom = 42;
    const xs = trajectory.map((point) => Number(point.x_smooth ?? point.x)).filter(Number.isFinite);
    const ts = trajectory.map((point) => Number(point.t)).filter(Number.isFinite);
    if (xs.length < 2 || ts.length < 2) {
      return '<div class="pendulum-placeholder">轨迹时间序列不足，无法绘制周期曲线。</div>';
    }
    const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    const values = trajectory.map((point) => Number(point.x_smooth ?? point.x) - meanX);
    const tMin = Math.min(...trajectory.map((point) => Number(point.t)).filter(Number.isFinite));
    const tMax = Math.max(...trajectory.map((point) => Number(point.t)).filter(Number.isFinite));
    const yMin = Math.min(...values);
    const yMax = Math.max(...values);
    const x0 = padLeft;
    const x1 = width - padRight;
    const y0 = padTop;
    const y1 = height - padBottom;
    const scaleX = (t) => x0 + ((t - tMin) / Math.max(tMax - tMin, 1e-9)) * (x1 - x0);
    const scaleY = (value) => y1 - ((value - yMin) / Math.max(yMax - yMin, 1e-9)) * (y1 - y0);
    const path = trajectory
      .map((point, index) => {
        const x = scaleX(Number(point.t));
        const y = scaleY(Number(point.x_smooth ?? point.x) - meanX);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
    const zeroY = scaleY(0);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => tMin + (tMax - tMin) * ratio);
    const grid = ticks.map((tick) => {
      const x = scaleX(tick);
      return `
        <line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="rgba(72, 96, 132, 0.12)" stroke-width="1" />
        <text x="${x}" y="${height - 16}" text-anchor="middle" fill="#51627b" font-size="12">${escapeHtml(formatPendulumNumber(tick, 2))}</text>
      `;
    }).join("");
    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="单摆横向位移周期曲线">
        <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(248,251,255,0.96)" />
        ${grid}
        <line x1="${x0}" y1="${zeroY}" x2="${x1}" y2="${zeroY}" stroke="rgba(35,49,73,0.32)" stroke-dasharray="5 6" />
        <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="#425673" stroke-width="1.7" />
        <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="#425673" stroke-width="1.7" />
        <path d="${path}" fill="none" stroke="#2f7f78" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <text x="${x0}" y="${height - 16}" fill="#263954" font-size="13" font-weight="700">t / s</text>
        <text x="20" y="${y0 + 8}" fill="#263954" font-size="13" font-weight="700" transform="rotate(-90 20 ${y0 + 8})">x - x̄ / px</text>
      </svg>
    `;
  }

  function buildPendulumSummaryMarkup(result) {
    const stability = result.stability || {};
    const hasTheory = Number.isFinite(Number(result.period_theoretical)) && Number.isFinite(Number(result.error));
    const theoryLine = hasTheory
      ? `实验周期 <code>${escapeHtml(formatPendulumNumber(result.period_experimental, 4))} s</code>，理论周期 <code>${escapeHtml(formatPendulumNumber(result.period_theoretical, 4))} s</code>，相对误差 <code>${escapeHtml(formatPendulumPercent(result.error))}</code>。`
      : `实验周期 <code>${escapeHtml(formatPendulumNumber(result.period_experimental, 4))} s</code>；未输入实测摆长，暂不计算理论误差，反推等效摆长约 <code>${escapeHtml(formatPendulumNumber(result.length_equivalent_m, 4))} m</code>。`;
    const items = [
      `<div class="data-lab-summary-item">${theoryLine}</div>`,
      `<div class="data-lab-summary-item">检测器：请求 <code>${escapeHtml(result.detector_requested || "auto")}</code>，实际 <code>${escapeHtml(result.detector || "opencv")}</code>；有效检测率：<code>${escapeHtml(formatPendulumPercent(result.detection_rate))}</code>。</div>`,
      `<div class="data-lab-summary-item">周期计算方法：<code>${escapeHtml(result.period_method || "视觉轨迹分析")}</code>；检测命中：<code>YOLO ${escapeHtml(String(result.detector_hits?.yolov5 || 0))}</code> / <code>OpenCV ${escapeHtml(String(result.detector_hits?.opencv || 0))}</code>。</div>`,
      `<div class="data-lab-summary-item">稳定性：<code>${escapeHtml(stability.level || "样本不足")}</code>${Number.isFinite(Number(stability.coefficient_variation_percent)) ? `，变异系数 <code>${escapeHtml(formatPendulumNumber(stability.coefficient_variation_percent, 2))}%</code>` : ""}。</div>`,
      ...(result.theory_note ? [`<div class="data-lab-summary-item">${escapeHtml(result.theory_note)}</div>`] : []),
      ...(Array.isArray(result.detector_notes) && result.detector_notes.length ? [`<div class="pendulum-explain-block">${escapeHtml(result.detector_notes.join("\n")).replace(/\n/g, "<br>")}</div>`] : []),
      `<div class="pendulum-explain-block">${escapeHtml(result.analysis || "").replace(/\n/g, "<br>")}</div>`,
      `<div class="pendulum-advice-block">${escapeHtml(result.advice || "").replace(/\n/g, "<br>")}</div>`,
    ];
    return items.join("");
  }

  function renderPendulumTrajectoryEmpty() {
    const canvas = els.pendulumTrajectoryCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || canvas.clientWidth || 360));
    const cssH = Math.max(240, Math.round(rect.height || canvas.clientHeight || 280));
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#f8fbff";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#5c6d84";
    ctx.font = "14px 'Microsoft YaHei', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("完成分析后显示摆球轨迹动画", cssW / 2, cssH / 2);
  }

  function startPendulumTrajectoryAnimation() {
    stopPendulumTrajectoryAnimation();
    if (!APP.pendulum.isOpen || !APP.pendulum.result) {
      renderPendulumTrajectoryEmpty();
      return;
    }
    APP.pendulum.animationStartedAt = performance.now();
    const tick = (ts) => {
      renderPendulumTrajectoryFrame(ts);
      if (APP.pendulum.isOpen && APP.pendulum.result) {
        APP.pendulum.animationRaf = requestAnimationFrame(tick);
      }
    };
    APP.pendulum.animationRaf = requestAnimationFrame(tick);
  }

  function stopPendulumTrajectoryAnimation() {
    if (APP.pendulum.animationRaf) {
      cancelAnimationFrame(APP.pendulum.animationRaf);
      APP.pendulum.animationRaf = 0;
    }
  }

  function renderPendulumTrajectoryFrame(ts = performance.now()) {
    const canvas = els.pendulumTrajectoryCanvas;
    const trajectory = Array.isArray(APP.pendulum.result?.trajectory) ? APP.pendulum.result.trajectory : [];
    if (!canvas || trajectory.length < 2) {
      renderPendulumTrajectoryEmpty();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || canvas.clientWidth || 420));
    const cssH = Math.max(250, Math.round(rect.height || canvas.clientHeight || 300));
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const xs = trajectory.map((point) => Number(point.x_smooth ?? point.x)).filter(Number.isFinite);
    const ys = trajectory.map((point) => Number(point.y_smooth ?? point.y)).filter(Number.isFinite);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 28;
    const scaleX = (value) => pad + ((value - minX) / Math.max(maxX - minX, 1e-9)) * (cssW - pad * 2);
    const scaleY = (value) => pad + ((value - minY) / Math.max(maxY - minY, 1e-9)) * (cssH - pad * 2);

    const gradient = ctx.createLinearGradient(0, 0, cssW, cssH);
    gradient.addColorStop(0, "#f8fbff");
    gradient.addColorStop(1, "#edf4f8");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.strokeStyle = "rgba(72, 96, 132, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i += 1) {
      const gx = pad + ((cssW - pad * 2) / 5) * i;
      const gy = pad + ((cssH - pad * 2) / 5) * i;
      ctx.beginPath();
      ctx.moveTo(gx, pad);
      ctx.lineTo(gx, cssH - pad);
      ctx.moveTo(pad, gy);
      ctx.lineTo(cssW - pad, gy);
      ctx.stroke();
    }

    ctx.beginPath();
    trajectory.forEach((point, index) => {
      const x = scaleX(Number(point.x_smooth ?? point.x));
      const y = scaleY(Number(point.y_smooth ?? point.y));
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(47, 127, 120, 0.72)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    const elapsed = ((ts - APP.pendulum.animationStartedAt) / 1000) % Math.max(1, trajectory.length / 26);
    const activeIndex = Math.min(trajectory.length - 1, Math.floor((elapsed * 26) % trajectory.length));
    const active = trajectory[activeIndex];
    const activeX = scaleX(Number(active.x_smooth ?? active.x));
    const activeY = scaleY(Number(active.y_smooth ?? active.y));
    ctx.beginPath();
    ctx.arc(activeX, activeY, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#2f7f78";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(activeX, activeY, 15, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(47, 127, 120, 0.22)";
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  function sendPendulumResultToChat() {
    if (!APP.pendulum.result) {
      showToast("请先完成单摆周期测量。");
      return;
    }
    const prompt = buildPendulumFollowupPrompt(APP.pendulum.result);
    closePendulumLabModal({ skipHistory: true });
    els.chatInput.value = prompt;
    autoResizeTextarea(els.chatInput);
    sendMessage(prompt, { skipPendulumRouting: true });
  }

  function buildPendulumFollowupPrompt(result) {
    const hasTheory = Number.isFinite(Number(result.period_theoretical)) && Number.isFinite(Number(result.error));
    return [
      "请基于刚才的单摆视频测量结果，进一步用实验报告语言解释：",
      `实验周期 T_exp = ${formatPendulumNumber(result.period_experimental, 4)} s。`,
      hasTheory
        ? `理论周期 T_theory = ${formatPendulumNumber(result.period_theoretical, 4)} s，相对误差 = ${formatPendulumPercent(result.error)}。`
        : `未输入实测摆长，暂不计算理论误差；由实验周期反推等效摆长 L_eff = ${formatPendulumNumber(result.length_equivalent_m, 4)} m。`,
      result.length_input_provided
        ? `摆长 L = ${formatPendulumNumber(result.length_m, 4)} m，g = ${formatPendulumNumber(result.gravity, 3)} m/s^2。`
        : `g = ${formatPendulumNumber(result.gravity, 3)} m/s^2。`,
      "请说明误差来源、是否满足小角近似，并给出下一次实验的操作改进建议。",
    ].join("\n");
  }

  function shouldRouteToPendulumAnalysis(text, options = {}) {
    if (options.skipPendulumRouting || options.hiddenImage || options.externalLabContext || APP.pendingImage || APP.pendingAudio) {
      return false;
    }
    const clean = String(text || "").trim();
    if (!clean) return false;
    if (/(?:为什么|原理|公式|推导|解释|讲解|区别|对比|意义|怎么理解|是什么|什么是|why|what is|explain)/i.test(clean)) {
      return false;
    }
    return /(?:单摆|摆动视频|摆球|pendulum)/i.test(clean)
      && /(?:视频|上传|拍摄|录像|帮我测|帮我分析|自动测量|自动分析)/i.test(clean);
  }

  function formatPendulumNumber(value, digits = 3) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "--";
    return numeric.toFixed(digits);
  }

  function formatPendulumPercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "--";
    return `${(numeric * 100).toFixed(2)}%`;
  }

  function formatFileSize(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return "0 KB";
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  function pendulumDetectorHint(detector) {
    if (detector === "yolov5") {
      return "将严格使用 YOLOv5 检测摆球；建议先配置自训练 pendulum_bob 权重。";
    }
    if (detector === "opencv") {
      return "将使用传统视觉候选点检测，适合快速回退对照。";
    }
    return "自动模式会优先尝试 YOLOv5，识别不足时回退传统视觉。";
  }

  function openTorsionLabModal() {
    const wasOpen = APP.torsion.isOpen;
    APP.torsion.isOpen = true;
    els.torsionLabModal?.classList.remove("hidden");
    syncImmersiveState();
    renderTorsionLab();
    if (!wasOpen) pushUiHistoryView("torsion-lab");
  }

  function closeTorsionLabModal({ skipHistory = false } = {}) {
    if (!skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "torsion-lab") {
      history.back();
      return;
    }
    APP.torsion.isOpen = false;
    if (skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "torsion-lab") {
      replaceUiHistoryView("root");
    }
    stopTorsionLiveAnalysis({ silent: true });
    els.torsionLabModal?.classList.add("hidden");
    syncImmersiveState();
  }

  function renderTorsionLab() {
    els.openTorsionLabBtn?.classList.toggle("active", APP.torsion.isOpen);
    renderTorsionVideoPreview();
    renderTorsionStatus(APP.torsion.error || APP.torsion.status, Boolean(APP.torsion.error));
    renderTorsionResult(APP.torsion.result);
  }

  function renderTorsionVideoPreview() {
    const file = APP.torsion.videoFile;
    if (els.torsionVideoMeta) {
      els.torsionVideoMeta.textContent = APP.torsion.liveActive
        ? `实时摄像头 · ${APP.torsion.liveDetectedFrames}/${APP.torsion.liveFrameIndex} 帧`
        : file ? `${file.name} · ${formatFileSize(file.size)}` : "mp4 / webm / mov / avi / mkv";
    }
    if (els.torsionLiveBtn) {
      els.torsionLiveBtn.classList.toggle("recording", APP.torsion.liveActive);
      const label = els.torsionLiveBtn.querySelector("span");
      if (label) label.textContent = APP.torsion.liveActive ? "停止实时" : "实时测量";
    }
    if (!els.torsionVideoPreview) return;
    if (APP.torsion.liveActive && APP.torsion.liveStream) {
      if (els.torsionVideoPreview.srcObject !== APP.torsion.liveStream) {
        els.torsionVideoPreview.pause?.();
        els.torsionVideoPreview.removeAttribute("src");
        els.torsionVideoPreview.srcObject = APP.torsion.liveStream;
      }
      els.torsionVideoPreview.controls = false;
      els.torsionVideoPreview.muted = true;
      els.torsionVideoPreview.classList.remove("hidden");
      els.torsionLiveOverlayCanvas?.classList.remove("hidden");
      return;
    }
    if (els.torsionVideoPreview.srcObject) {
      els.torsionVideoPreview.srcObject = null;
    }
    els.torsionLiveOverlayCanvas?.classList.add("hidden");
    if (!file || !APP.torsion.videoUrl) {
      els.torsionVideoPreview.pause?.();
      els.torsionVideoPreview.removeAttribute("src");
      els.torsionVideoPreview.classList.add("hidden");
      return;
    }
    if (els.torsionVideoPreview.src !== APP.torsion.videoUrl) {
      els.torsionVideoPreview.controls = true;
      els.torsionVideoPreview.muted = true;
      els.torsionVideoPreview.src = APP.torsion.videoUrl;
    }
    els.torsionVideoPreview.classList.remove("hidden");
  }

  function renderTorsionStatus(message, isError = false) {
    if (!els.torsionStatus) return;
    els.torsionStatus.textContent = message || "";
    els.torsionStatus.classList.toggle("is-error", Boolean(isError));
  }

  function renderTorsionResult(result) {
    const hasResult = Boolean(result);
    if (els.torsionMetricPeriod) els.torsionMetricPeriod.textContent = hasResult ? `${formatPendulumNumber(result.period_experimental, 4)} s` : "-- s";
    if (els.torsionMetricInertia) {
      els.torsionMetricInertia.textContent = hasResult && Number.isFinite(Number(result.moment_inertia))
        ? `${formatPendulumNumber(result.moment_inertia, 8)} kg·m²`
        : "需 κ";
    }
    if (els.torsionMetricKappa) {
      els.torsionMetricKappa.textContent = hasResult && Number.isFinite(Number(result.torsion_constant))
        ? `${formatPendulumNumber(result.torsion_constant, 6)}`
        : "--";
    }
    if (els.torsionMetricStability) {
      els.torsionMetricStability.textContent = hasResult ? (result.stability?.level || "样本不足") : "--";
    }
    if (els.torsionDetectionMeta) {
      const hits = result?.detector_hits || {};
      els.torsionDetectionMeta.textContent = hasResult
        ? `检测 ${result.detected_points || 0}/${result.frame_count || 0} 帧 · ${result.detector || "opencv"} · YOLO ${hits.yolov5 || 0} 帧`
        : "等待分析";
    }
    if (els.torsionCurveCaption) {
      els.torsionCurveCaption.textContent = hasResult
        ? `主频 ${formatPendulumNumber(result.dominant_frequency_hz, 4)} Hz · FPS ${formatPendulumNumber(result.fps, 2)}`
        : "θ(t) 随时间变化";
    }
    if (els.torsionCurvePlot) {
      els.torsionCurvePlot.innerHTML = hasResult ? buildTorsionCurveSvg(result) : '<div class="pendulum-placeholder">完成分析后显示 θ(t) 角度曲线。</div>';
    }
    if (els.torsionResultSummary) {
      els.torsionResultSummary.innerHTML = hasResult ? buildTorsionSummaryMarkup(result) : '<div class="data-lab-summary-empty">完成分析后，这里会显示周期、转动惯量与操作改进建议。</div>';
    }
    if (els.torsionSendToChatBtn) els.torsionSendToChatBtn.disabled = !hasResult;
    renderTorsionProcessedVideo(result);
  }

  function clearTorsionProcessedVideo() {
    if (APP.torsion.processedVideoUrl) URL.revokeObjectURL(APP.torsion.processedVideoUrl);
    APP.torsion.processedVideoUrl = "";
    APP.torsion.processedVideoSource = "";
    APP.torsion.processedVideoLoading = false;
    APP.torsion.processedVideoError = "";
    if (els.torsionProcessedVideo) {
      els.torsionProcessedVideo.pause?.();
      els.torsionProcessedVideo.removeAttribute("src");
      els.torsionProcessedVideo.load?.();
    }
  }

  function renderTorsionProcessedVideo(result) {
    const hasResult = Boolean(result);
    const hasProcessedSource = Boolean(result?.processed_video_url);
    const hasPlayableVideo = Boolean(APP.torsion.processedVideoUrl);
    const message = !hasResult
      ? "完成分析后显示带角度标注的视频。"
      : result.live
        ? "实时模式已在摄像头画面上叠加检测线，不生成离线标注视频。"
      : APP.torsion.processedVideoError
        ? APP.torsion.processedVideoError
        : result.processed_video_created === false
          ? (result.processed_video_error || "后端未能生成扭摆标注视频。")
          : hasProcessedSource
            ? "处理后视频已生成，正在准备播放。"
            : "本次分析未生成处理后视频。";
    if (els.torsionProcessedMeta) {
      els.torsionProcessedMeta.textContent = !hasResult
        ? "等待分析"
        : result.live
          ? "实时标注"
        : APP.torsion.processedVideoLoading
          ? "正在加载标注视频"
          : hasPlayableVideo
            ? `${result.detector_requested || "auto"} → ${result.detector || "opencv"}`
            : APP.torsion.processedVideoError
              ? "标注视频加载失败"
              : hasProcessedSource
                ? "可加载处理后视频"
                : "未生成标注视频";
    }
    if (els.torsionProcessedPlaceholder) {
      els.torsionProcessedPlaceholder.classList.toggle("hidden", hasPlayableVideo);
      els.torsionProcessedPlaceholder.textContent = APP.torsion.processedVideoLoading ? "正在加载带角度标注的视频。" : message;
    }
    if (!els.torsionProcessedVideo) return;
    if (!hasPlayableVideo) {
      els.torsionProcessedVideo.pause?.();
      els.torsionProcessedVideo.classList.add("hidden");
      return;
    }
    if (els.torsionProcessedVideo.src !== APP.torsion.processedVideoUrl) {
      els.torsionProcessedVideo.src = APP.torsion.processedVideoUrl;
      els.torsionProcessedVideo.load?.();
    }
    els.torsionProcessedVideo.classList.remove("hidden");
  }

  async function loadTorsionProcessedVideo(result) {
    clearTorsionProcessedVideo();
    const source = String(result?.processed_video_url || "");
    if (!source) {
      renderTorsionLab();
      return;
    }
    APP.torsion.processedVideoLoading = true;
    APP.torsion.processedVideoSource = source;
    APP.torsion.processedVideoError = "";
    renderTorsionLab();
    try {
      const response = await fetch(source, { method: "GET" });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, `处理后视频加载失败 (${response.status})`));
      const blob = await response.blob();
      if (APP.torsion.result !== result || APP.torsion.processedVideoSource !== source) return;
      APP.torsion.processedVideoUrl = URL.createObjectURL(blob);
    } catch (error) {
      APP.torsion.processedVideoError = error?.message || "处理后视频加载失败";
    } finally {
      if (APP.torsion.result === result && APP.torsion.processedVideoSource === source) {
        APP.torsion.processedVideoLoading = false;
        APP.torsion.status = APP.torsion.processedVideoError ? "扭摆测量完成；处理后视频加载失败。" : "扭摆测量完成，处理后视频已就绪。";
      }
      renderTorsionLab();
    }
  }

  function handleTorsionProcessedVideoPlaybackError() {
    if (!APP.torsion.processedVideoUrl) return;
    URL.revokeObjectURL(APP.torsion.processedVideoUrl);
    APP.torsion.processedVideoUrl = "";
    APP.torsion.processedVideoError = "浏览器无法播放这份扭摆标注视频。";
    APP.torsion.status = "扭摆测量完成；处理后视频无法播放。";
    if (els.torsionProcessedVideo) {
      els.torsionProcessedVideo.pause?.();
      els.torsionProcessedVideo.removeAttribute("src");
      els.torsionProcessedVideo.classList.add("hidden");
    }
    renderTorsionLab();
  }

  function setTorsionVideoFile(file) {
    if (!file) return;
    if (!isSupportedPendulumVideo(file)) {
      APP.torsion.error = "请上传 mp4、webm、mov、avi 或 mkv 格式的视频。";
      renderTorsionLab();
      showToast(APP.torsion.error);
      return;
    }
    stopTorsionLiveAnalysis({ silent: true });
    if (APP.torsion.videoUrl) URL.revokeObjectURL(APP.torsion.videoUrl);
    clearTorsionProcessedVideo();
    APP.torsion.videoFile = file;
    APP.torsion.videoUrl = URL.createObjectURL(file);
    APP.torsion.result = null;
    APP.torsion.error = "";
    APP.torsion.status = `已载入视频：${file.name}`;
    renderTorsionLab();
    openTorsionLabModal();
  }

  function resetTorsionLab() {
    stopTorsionLiveAnalysis({ silent: true });
    if (APP.torsion.videoUrl) URL.revokeObjectURL(APP.torsion.videoUrl);
    clearTorsionProcessedVideo();
    APP.torsion.videoFile = null;
    APP.torsion.videoUrl = "";
    APP.torsion.result = null;
    APP.torsion.status = "请选择扭摆实验视频。";
    APP.torsion.error = "";
    renderTorsionLab();
  }

  async function startTorsionLiveAnalysis() {
    if (!APP.auth.token) {
      showToast("请先登录后再进行实时测量");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      APP.torsion.error = "当前浏览器不支持摄像头实时测量。";
      renderTorsionLab();
      showToast(APP.torsion.error);
      return;
    }

    let initialAngleDeg = null;
    try {
      initialAngleDeg = readOptionalFiniteNumber(els.torsionInitialAngleInput, "初始角 θ0");
    } catch (error) {
      APP.torsion.error = error.message || "初始角参数无效";
      renderTorsionLab();
      showToast(APP.torsion.error);
      return;
    }

    stopTorsionLiveAnalysis({ silent: true });
    if (APP.torsion.videoUrl) URL.revokeObjectURL(APP.torsion.videoUrl);
    clearTorsionProcessedVideo();
    APP.torsion.videoFile = null;
    APP.torsion.videoUrl = "";
    APP.torsion.result = null;
    APP.torsion.error = "";
    APP.torsion.status = "正在请求摄像头权限。";
    renderTorsionLab();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      APP.torsion.liveStream = stream;
      APP.torsion.liveActive = true;
      APP.torsion.livePending = false;
      APP.torsion.liveStartedAt = performance.now();
      APP.torsion.liveFrameIndex = 0;
      APP.torsion.liveDetectedFrames = 0;
      APP.torsion.liveAngleOffsetDeg = null;
      APP.torsion.liveInitialAngleDeg = initialAngleDeg;
      APP.torsion.liveLastRawAngleDeg = null;
      APP.torsion.liveSeries = [];
      APP.torsion.liveDetectorHits = { yolov5: 0, opencv: 0 };
      APP.torsion.liveLastGeometry = null;
      APP.torsion.liveFrameSize = null;
      APP.torsion.status = "实时测量已启动，请让横杆或红色标记完整出现在画面中。";
      renderTorsionLab();

      if (els.torsionVideoPreview) {
        els.torsionVideoPreview.srcObject = stream;
        els.torsionVideoPreview.controls = false;
        els.torsionVideoPreview.muted = true;
        els.torsionVideoPreview.classList.remove("hidden");
        await els.torsionVideoPreview.play?.().catch(() => {});
      }
      scheduleTorsionLiveFrame(180);
      showToast("实时扭摆测量已启动");
    } catch (error) {
      APP.torsion.error = `无法启动摄像头：${error.message || "权限被拒绝"}`;
      stopTorsionLiveAnalysis({ silent: true });
      renderTorsionLab();
      showToast(APP.torsion.error);
    }
  }

  function stopTorsionLiveAnalysis({ silent = false } = {}) {
    if (APP.torsion.liveTimer) {
      clearTimeout(APP.torsion.liveTimer);
      APP.torsion.liveTimer = 0;
    }
    APP.torsion.liveStream?.getTracks?.().forEach((track) => track.stop());
    APP.torsion.liveStream = null;
    APP.torsion.liveActive = false;
    APP.torsion.livePending = false;
    if (els.torsionVideoPreview?.srcObject) {
      els.torsionVideoPreview.pause?.();
      els.torsionVideoPreview.srcObject = null;
    }
    clearTorsionLiveOverlay();
    if (!silent && APP.torsion.liveSeries.length) {
      APP.torsion.status = "实时测量已停止，可继续查看本次滚动周期结果。";
      renderTorsionLab();
      showToast("实时测量已停止");
    }
  }

  function scheduleTorsionLiveFrame(delay = 260) {
    if (!APP.torsion.liveActive) return;
    if (APP.torsion.liveTimer) clearTimeout(APP.torsion.liveTimer);
    APP.torsion.liveTimer = window.setTimeout(() => {
      APP.torsion.liveTimer = 0;
      captureTorsionLiveFrame().catch(() => {});
    }, delay);
  }

  async function captureTorsionLiveFrame() {
    if (!APP.torsion.liveActive || APP.torsion.livePending) return;
    const video = els.torsionVideoPreview;
    if (!video || !video.videoWidth || !video.videoHeight) {
      scheduleTorsionLiveFrame(220);
      return;
    }
    APP.torsion.livePending = true;
    APP.torsion.liveFrameIndex += 1;
    try {
      const blob = await captureVideoFrameBlob(video);
      if (!blob) throw new Error("无法读取摄像头画面");
      const form = new FormData();
      const selectedDetector = els.torsionDetectorSelect?.value || "opencv";
      form.append("detector", selectedDetector === "yolov5" ? "yolov5" : "opencv");
      if (Number.isFinite(Number(APP.torsion.liveLastRawAngleDeg))) {
        form.append("last_angle_deg", String(APP.torsion.liveLastRawAngleDeg));
      }
      form.append("image", blob, "torsion-live-frame.jpg");
      const response = await fetch("/api/physics/torsion/live-frame", { method: "POST", body: form });
      if (!response.ok) throw new Error(await readApiErrorMessage(response, `实时帧分析失败 (${response.status})`));
      const frameResult = await response.json();
      if (!APP.torsion.liveActive) return;
      appendTorsionLiveFrameResult(frameResult);
    } catch (error) {
      if (APP.torsion.liveActive) {
        APP.torsion.status = error.message || "当前帧未识别到横杆或标记点。";
        renderTorsionLab();
      }
    } finally {
      APP.torsion.livePending = false;
      if (APP.torsion.liveActive) scheduleTorsionLiveFrame(260);
    }
  }

  function captureVideoFrameBlob(video) {
    const sourceWidth = video.videoWidth || 0;
    const sourceHeight = video.videoHeight || 0;
    if (!sourceWidth || !sourceHeight) return Promise.resolve(null);
    const maxSide = 720;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const canvas = captureVideoFrameBlob.canvas || document.createElement("canvas");
    captureVideoFrameBlob.canvas = canvas;
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return Promise.resolve(null);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.72);
    });
  }

  function appendTorsionLiveFrameResult(frameResult) {
    const rawTheta = Number(frameResult.theta_deg);
    if (!Number.isFinite(rawTheta)) return;
    if (APP.torsion.liveAngleOffsetDeg === null) {
      APP.torsion.liveAngleOffsetDeg = Number.isFinite(Number(APP.torsion.liveInitialAngleDeg))
        ? Number(APP.torsion.liveInitialAngleDeg) - rawTheta
        : 0;
    }
    APP.torsion.liveLastRawAngleDeg = rawTheta;
    APP.torsion.liveDetectedFrames += 1;
    const detector = String(frameResult.detector || "opencv");
    if (detector === "yolov5") {
      APP.torsion.liveDetectorHits.yolov5 += 1;
    } else {
      APP.torsion.liveDetectorHits.opencv += 1;
    }
    APP.torsion.liveLastGeometry = frameResult.geometry || null;
    APP.torsion.liveFrameSize = {
      width: Number(frameResult.frame_width) || 0,
      height: Number(frameResult.frame_height) || 0,
    };
    const t = Math.max(0, (performance.now() - APP.torsion.liveStartedAt) / 1000);
    const theta = rawTheta + APP.torsion.liveAngleOffsetDeg;
    APP.torsion.liveSeries.push({
      frame: APP.torsion.liveFrameIndex,
      t: Number(t.toFixed(4)),
      theta_deg: Number(theta.toFixed(4)),
      theta_raw_deg: Number(rawTheta.toFixed(4)),
      confidence: Number(frameResult.confidence) || 0,
      method: frameResult.method || "",
      geometry: frameResult.geometry || null,
    });
    if (APP.torsion.liveSeries.length > 600) {
      APP.torsion.liveSeries.splice(0, APP.torsion.liveSeries.length - 600);
    }
    smoothTorsionLiveSeries(APP.torsion.liveSeries);
    APP.torsion.result = buildTorsionLiveResult(frameResult);
    APP.torsion.status = APP.torsion.result.period_experimental
      ? `实时测量中：T ≈ ${formatPendulumNumber(APP.torsion.result.period_experimental, 4)} s，当前角 ${formatPendulumNumber(theta, 2)}°。`
      : `实时测量中：当前角 ${formatPendulumNumber(theta, 2)}°，正在积累完整振动周期。`;
    APP.torsion.error = "";
    drawTorsionLiveOverlay(frameResult, theta);
    renderTorsionLab();
  }

  function smoothTorsionLiveSeries(series) {
    for (let index = 0; index < series.length; index += 1) {
      const start = Math.max(0, index - 2);
      const end = Math.min(series.length, index + 3);
      const windowValues = series.slice(start, end).map((point) => Number(point.theta_deg)).filter(Number.isFinite);
      const average = windowValues.reduce((sum, value) => sum + value, 0) / Math.max(1, windowValues.length);
      series[index].theta_smooth_deg = Number(average.toFixed(4));
    }
  }

  function buildTorsionLiveResult(frameResult) {
    const series = APP.torsion.liveSeries.slice(-260);
    const periodInfo = estimateTorsionLivePeriod(series);
    const period = Number.isFinite(Number(periodInfo.period)) ? Number(periodInfo.period) : null;
    const kappaInfo = resolveTorsionLiveKappa();
    const inertia = period && kappaInfo.kappa ? kappaInfo.kappa * Math.pow(period / (2 * Math.PI), 2) : null;
    const detectionRate = APP.torsion.liveDetectedFrames / Math.max(1, APP.torsion.liveFrameIndex);
    const elapsed = series.length >= 2 ? series[series.length - 1].t - series[0].t : 0;
    const fps = elapsed > 0 ? (series.length - 1) / elapsed : null;
    return {
      period_experimental: period ? Number(period.toFixed(4)) : null,
      moment_inertia: Number.isFinite(inertia) ? Number(inertia.toFixed(8)) : null,
      torsion_constant: Number.isFinite(kappaInfo.kappa) ? Number(kappaInfo.kappa.toFixed(8)) : null,
      torsion_constant_source: kappaInfo.source,
      detector: frameResult.detector || "opencv",
      detector_requested: frameResult.detector_requested || (els.torsionDetectorSelect?.value || "opencv"),
      detector_hits: { ...APP.torsion.liveDetectorHits },
      detector_notes: frameResult.detector_notes || [],
      detected_points: APP.torsion.liveDetectedFrames,
      frame_count: APP.torsion.liveFrameIndex,
      detection_rate: detectionRate,
      fps,
      dominant_frequency_hz: period ? 1 / period : null,
      period_method: period ? "实时峰值滚动估计" : "实时角度检测中",
      period_intervals: periodInfo.intervals,
      stability: periodInfo.stability,
      initial_angle_deg: APP.torsion.liveInitialAngleDeg,
      angle_offset_deg: APP.torsion.liveAngleOffsetDeg,
      angle_series: series,
      live: true,
      analysis: period
        ? "实时模式正在逐帧提取扭摆横杆角度，并用最近角度序列的峰值间隔滚动估计周期。周期稳定后可停止测量并记录结果。"
        : "实时模式已开始提取角度，但完整振动周期样本仍不足；请继续保持拍摄，等待曲线出现多个峰谷。",
      advice: "实时测量时建议相机固定、画面正对或俯视转盘，让红色横杆或高对比标记完整入镜；若使用 YOLO，请确保后端已加载扭摆杆/标记点权重。",
    };
  }

  function resolveTorsionLiveKappa() {
    const direct = Number(String(els.torsionKappaInput?.value || "").trim());
    if (Number.isFinite(direct) && direct > 0) {
      return { kappa: direct, source: "直接输入 κ" };
    }
    const inertia = Number(String(els.torsionCalibrationInertiaInput?.value || "").trim());
    const period = Number(String(els.torsionCalibrationPeriodInput?.value || "").trim());
    if (Number.isFinite(inertia) && inertia > 0 && Number.isFinite(period) && period > 0) {
      return { kappa: (4 * Math.PI * Math.PI * inertia) / (period * period), source: "标定法 I0/T0" };
    }
    return { kappa: null, source: "未给定" };
  }

  function estimateTorsionLivePeriod(series) {
    const points = series
      .map((point) => ({ t: Number(point.t), y: Number(point.theta_smooth_deg ?? point.theta_deg) }))
      .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.y))
      .sort((a, b) => a.t - b.t);
    if (points.length < 10) {
      return { period: null, intervals: [], stability: { sample_count: 0, level: "样本不足" } };
    }
    const values = points.map((point) => point.y);
    const center = median(values);
    const centered = values.map((value) => value - center);
    const amplitude = percentile(centered, 95) - percentile(centered, 5);
    if (!Number.isFinite(amplitude) || amplitude < 1.2) {
      return { period: null, intervals: [], stability: { sample_count: 0, level: "振幅不足" } };
    }
    const threshold = Math.max(0.6, amplitude * 0.16);
    const duration = points[points.length - 1].t - points[0].t;
    const meanDt = duration / Math.max(1, points.length - 1);
    const minPeakGap = Math.max(0.35, meanDt * 2.2);
    const maxima = collectLivePeaks(points, centered, 1, threshold, minPeakGap);
    const minima = collectLivePeaks(points, centered, -1, threshold, minPeakGap);
    const intervals = [...peakIntervals(maxima), ...peakIntervals(minima)]
      .filter((value) => value >= 0.35 && value <= 20)
      .sort((a, b) => a - b);
    if (!intervals.length) {
      return { period: null, intervals: [], stability: { sample_count: 0, level: "周期样本不足" } };
    }
    const period = median(intervals);
    const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
    const variance = intervals.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / intervals.length;
    const std = Math.sqrt(variance);
    const cv = period > 0 ? (std / period) * 100 : null;
    const level = intervals.length < 2 ? "样本不足" : cv <= 3 ? "稳定" : cv <= 8 ? "基本稳定" : "波动较大";
    return {
      period,
      intervals: intervals.map((value) => Number(value.toFixed(4))),
      stability: {
        sample_count: intervals.length,
        mean_period: Number(mean.toFixed(4)),
        std_period: Number(std.toFixed(4)),
        coefficient_variation_percent: Number.isFinite(cv) ? Number(cv.toFixed(3)) : null,
        level,
      },
    };
  }

  function collectLivePeaks(points, centered, sign, threshold, minGap) {
    const peaks = [];
    for (let index = 1; index < centered.length - 1; index += 1) {
      const value = centered[index] * sign;
      if (value < threshold) continue;
      if (value < centered[index - 1] * sign || value < centered[index + 1] * sign) continue;
      const current = { t: points[index].t, y: centered[index] };
      const last = peaks[peaks.length - 1];
      if (!last || current.t - last.t >= minGap) {
        peaks.push(current);
      } else if (Math.abs(current.y) > Math.abs(last.y)) {
        peaks[peaks.length - 1] = current;
      }
    }
    return peaks;
  }

  function peakIntervals(peaks) {
    const intervals = [];
    for (let index = 1; index < peaks.length; index += 1) {
      intervals.push(peaks[index].t - peaks[index - 1].t);
    }
    return intervals;
  }

  function median(values) {
    if (!values.length) return NaN;
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return NaN;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function percentile(values, percent) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return NaN;
    const index = (Math.min(100, Math.max(0, percent)) / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  function drawTorsionLiveOverlay(frameResult, thetaDeg) {
    const canvas = els.torsionLiveOverlayCanvas;
    const video = els.torsionVideoPreview;
    if (!canvas || !video || !APP.torsion.liveActive) return;
    const rect = video.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const sourceWidth = Number(frameResult.frame_width) || APP.torsion.liveFrameSize?.width || video.videoWidth || width;
    const sourceHeight = Number(frameResult.frame_height) || APP.torsion.liveFrameSize?.height || video.videoHeight || height;
    const scale = Math.min(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
    const offsetX = (width - sourceWidth * scale) / 2;
    const offsetY = (height - sourceHeight * scale) / 2;
    const line = frameResult.geometry?.line;
    if (Array.isArray(line) && line.length === 4) {
      const x1 = offsetX + Number(line[0]) * scale;
      const y1 = offsetY + Number(line[1]) * scale;
      const x2 = offsetX + Number(line[2]) * scale;
      const y2 = offsetY + Number(line[3]) * scale;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(47, 127, 120, 0.98)";
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.strokeStyle = "rgba(47, 127, 120, 0.35)";
      [x1, y1, x2, y2].forEach((_, index, arr) => {
        if (index % 2) return;
        ctx.beginPath();
        ctx.arc(arr[index], arr[index + 1], 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
    ctx.fillStyle = "rgba(9, 16, 30, 0.72)";
    ctx.fillRect(12, 12, 160, 34);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(`θ = ${formatPendulumNumber(thetaDeg, 2)}°`, 24, 34);
  }

  function clearTorsionLiveOverlay() {
    const canvas = els.torsionLiveOverlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.add("hidden");
  }

  function readOptionalPositiveNumber(input, label) {
    const raw = String(input?.value || "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${label} 必须大于 0。`);
    }
    return value;
  }

  function readOptionalFiniteNumber(input, label) {
    const raw = String(input?.value || "").trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new Error(`${label} 必须是有效数值。`);
    }
    return value;
  }

  async function analyzeTorsionVideo({ prompt = "帮我用扭摆法测转动惯量", appendToChat = true } = {}) {
    if (!APP.auth.token) {
      showToast("请先登录后再分析扭摆视频");
      return null;
    }
    if (APP.torsion.liveActive) {
      showToast("实时测量正在进行，停止后可查看滚动周期结果。");
      return APP.torsion.result;
    }
    if (!APP.torsion.videoFile) {
      openTorsionLabModal();
      APP.torsion.error = "请先选择扭摆实验视频。";
      renderTorsionLab();
      showToast(APP.torsion.error);
      return null;
    }
    if (APP.sending) {
      showToast("正在处理上一条请求，请稍候");
      return null;
    }

    let kappa = null;
    let calibrationInertia = null;
    let calibrationPeriod = null;
    let initialAngleDeg = null;
    try {
      kappa = readOptionalPositiveNumber(els.torsionKappaInput, "扭转常量 κ");
      calibrationInertia = readOptionalPositiveNumber(els.torsionCalibrationInertiaInput, "标定转动惯量 I0");
      calibrationPeriod = readOptionalPositiveNumber(els.torsionCalibrationPeriodInput, "标定周期 T0");
      initialAngleDeg = readOptionalFiniteNumber(els.torsionInitialAngleInput, "初始角 θ0");
      if ((calibrationInertia === null) !== (calibrationPeriod === null)) {
        throw new Error("标定法需要同时输入 I0 与 T0。");
      }
    } catch (error) {
      APP.torsion.error = error.message || "参数无效";
      renderTorsionLab();
      showToast(APP.torsion.error);
      return null;
    }

    APP.sending = true;
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.recordBtn) els.recordBtn.disabled = true;
    APP.torsion.error = "";
    APP.torsion.status = "正在进行 YOLO/视觉角度检测与周期计算。";
    renderTorsionLab();

    let loadingRow = null;
    if (appendToChat) {
      appendUserMessage(`[扭摆法测转动惯量]\n${prompt}\n视频文件：${APP.torsion.videoFile.name}`);
      if (prompt) pushHistory(prompt);
      loadingRow = appendLoadingMessage();
    }

    try {
      const form = new FormData();
      form.append("session_id", APP.sessionId);
      if (kappa !== null) form.append("torsion_constant", String(kappa));
      if (calibrationInertia !== null) form.append("calibration_inertia", String(calibrationInertia));
      if (calibrationPeriod !== null) form.append("calibration_period", String(calibrationPeriod));
      if (initialAngleDeg !== null) form.append("initial_angle_deg", String(initialAngleDeg));
      form.append("detector", els.torsionDetectorSelect?.value || "auto");
      form.append("message", prompt || "帮我用扭摆法测转动惯量");
      form.append("video", APP.torsion.videoFile, APP.torsion.videoFile.name || "torsion-video.webm");

      const result = await runWithBusyButton(els.torsionAnalyzeBtn, "分析中", async () => {
        const response = await fetch("/api/physics/torsion/analyze", { method: "POST", body: form });
        if (!response.ok) throw new Error(await readApiErrorMessage(response, `扭摆分析失败 (${response.status})`));
        return await response.json();
      });

      APP.torsion.result = result;
      APP.torsion.status = result.processed_video_url ? "扭摆测量完成，正在加载处理后视频。" : "扭摆测量完成。";
      APP.torsion.error = "";
      renderTorsionLab();
      loadTorsionProcessedVideo(result).catch(() => {});
      showToast("扭摆法测转动惯量完成");
      if (appendToChat) {
        loadingRow?.remove();
        await hydrateSession();
      }
      return result;
    } catch (error) {
      loadingRow?.remove();
      APP.torsion.error = error.message || "扭摆视频分析失败";
      renderTorsionLab();
      if (appendToChat) appendAgentMessage(`扭摆视频分析失败：${APP.torsion.error}`);
      showToast(APP.torsion.error);
      return null;
    } finally {
      APP.sending = false;
      if (els.sendBtn) els.sendBtn.disabled = false;
      if (els.recordBtn) els.recordBtn.disabled = false;
      scrollChatToBottom();
      refreshQuickJumpPanel();
    }
  }

  function buildTorsionCurveSvg(result) {
    const series = Array.isArray(result.angle_series) ? result.angle_series : [];
    if (series.length < 2) return '<div class="pendulum-placeholder">角度序列不足，无法绘制曲线。</div>';
    const width = 760;
    const height = 270;
    const pad = { left: 54, right: 24, top: 24, bottom: 42 };
    const times = series.map((point) => Number(point.t)).filter(Number.isFinite);
    const values = series.map((point) => Number(point.theta_smooth_deg ?? point.theta_deg)).filter(Number.isFinite);
    if (times.length < 2 || values.length < 2) return '<div class="pendulum-placeholder">角度时间序列不足，无法绘制曲线。</div>';
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const xScale = (value) => pad.left + ((value - minT) / Math.max(maxT - minT, 1e-9)) * (width - pad.left - pad.right);
    const yScale = (value) => pad.top + (1 - (value - minV) / Math.max(maxV - minV, 1e-9)) * (height - pad.top - pad.bottom);
    const path = series.map((point, index) => {
      const x = xScale(Number(point.t));
      const y = yScale(Number(point.theta_smooth_deg ?? point.theta_deg));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ");
    const xTicks = [minT, minT + (maxT - minT) / 2, maxT];
    const yZero = yScale(0);
    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="扭摆角度周期曲线">
        <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#f8fbff" />
        ${xTicks.map((tick) => `<line x1="${xScale(tick)}" y1="${pad.top}" x2="${xScale(tick)}" y2="${height - pad.bottom}" stroke="#dfe8f1" />`).join("")}
        <line x1="${pad.left}" y1="${Math.max(pad.top, Math.min(height - pad.bottom, yZero))}" x2="${width - pad.right}" y2="${Math.max(pad.top, Math.min(height - pad.bottom, yZero))}" stroke="#b7c5d5" stroke-dasharray="5 7" />
        <path d="${path}" fill="none" stroke="#2f7f78" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#425673" stroke-width="1.6" />
        <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#425673" stroke-width="1.6" />
        ${xTicks.map((tick) => `<text x="${xScale(tick)}" y="${height - 16}" text-anchor="middle" fill="#51627b" font-size="12">${escapeHtml(formatPendulumNumber(tick, 2))}</text>`).join("")}
        <text x="${width - 54}" y="${height - 16}" fill="#263954" font-size="13" font-weight="700">t / s</text>
        <text x="20" y="92" fill="#263954" font-size="13" font-weight="700" transform="rotate(-90 20 92)">θ / deg</text>
      </svg>
    `;
  }

  function buildTorsionSummaryMarkup(result) {
    const stability = result.stability || {};
    const inertiaLine = Number.isFinite(Number(result.moment_inertia))
      ? `转动惯量 <code>${escapeHtml(formatPendulumNumber(result.moment_inertia, 8))} kg·m²</code>。`
      : "未输入 κ 或标定数据，暂只输出扭摆周期。";
    const items = [
      `<div class="data-lab-summary-item">扭摆周期 <code>${escapeHtml(formatPendulumNumber(result.period_experimental, 4))} s</code>，${inertiaLine}</div>`,
      `<div class="data-lab-summary-item">检测器：请求 <code>${escapeHtml(result.detector_requested || "auto")}</code>，实际 <code>${escapeHtml(result.detector || "opencv")}</code>；有效检测率：<code>${escapeHtml(formatPendulumPercent(result.detection_rate))}</code>。</div>`,
      `<div class="data-lab-summary-item">周期方法：<code>${escapeHtml(result.period_method || "角度序列分析")}</code>；κ 来源：<code>${escapeHtml(result.torsion_constant_source || "未给定")}</code>。</div>`,
      ...(Number.isFinite(Number(result.initial_angle_deg)) ? [`<div class="data-lab-summary-item">初始角校准：<code>θ0 = ${escapeHtml(formatPendulumNumber(result.initial_angle_deg, 2))}°</code>，角度整体偏移 <code>${escapeHtml(formatPendulumNumber(result.angle_offset_deg, 2))}°</code>。</div>`] : []),
      `<div class="data-lab-summary-item">稳定性：<code>${escapeHtml(stability.level || "样本不足")}</code>${Number.isFinite(Number(stability.coefficient_variation_percent)) ? `，变异系数 <code>${escapeHtml(formatPendulumNumber(stability.coefficient_variation_percent, 2))}%</code>` : ""}。</div>`,
      ...(Array.isArray(result.detector_notes) && result.detector_notes.length ? [`<div class="pendulum-explain-block">${escapeHtml(result.detector_notes.join("\n")).replace(/\n/g, "<br>")}</div>`] : []),
      `<div class="pendulum-explain-block">${escapeHtml(result.analysis || "").replace(/\n/g, "<br>")}</div>`,
      `<div class="pendulum-advice-block">${escapeHtml(result.advice || "").replace(/\n/g, "<br>")}</div>`,
    ];
    return items.join("");
  }

  function sendTorsionResultToChat() {
    if (!APP.torsion.result) {
      showToast("请先完成扭摆法测量。");
      return;
    }
    const result = APP.torsion.result;
    const prompt = [
      "请基于刚才的扭摆法视频测量结果，进一步用实验报告语言解释：",
      `扭摆周期 T = ${formatPendulumNumber(result.period_experimental, 4)} s。`,
      Number.isFinite(Number(result.moment_inertia))
        ? `转动惯量 I = ${formatPendulumNumber(result.moment_inertia, 8)} kg·m²，κ = ${formatPendulumNumber(result.torsion_constant, 8)} N·m/rad。`
        : "尚未输入扭转常量 κ 或标定数据，因此暂未计算转动惯量。",
      "请说明周期测量方法、误差来源、YOLO 标记点要求，并给出下一次实验的操作改进建议。",
    ].join("\n");
    closeTorsionLabModal({ skipHistory: true });
    els.chatInput.value = prompt;
    autoResizeTextarea(els.chatInput);
    sendMessage(prompt, { skipTorsionRouting: true });
  }

  function shouldRouteToTorsionAnalysis(text, options = {}) {
    if (options.skipTorsionRouting || options.hiddenImage || options.externalLabContext || APP.pendingImage || APP.pendingAudio) return false;
    const clean = String(text || "").trim();
    if (!clean) return false;
    // Conceptual/explanatory questions (原理、公式、为什么...) should get a normal
    // chat answer, not force the video-upload modal open.
    if (/(?:为什么|原理|公式|推导|解释|讲解|区别|对比|意义|怎么理解|是什么|什么是|why|what is|explain)/i.test(clean)) {
      return false;
    }
    return /(?:扭摆|转动惯量|惯量|torsion|moment of inertia)/i.test(clean)
      && /(?:视频|上传|拍摄|录像|帮我测|帮我分析|自动测量|自动分析)/i.test(clean);
  }

  function torsionDetectorHint(detector) {
    if (detector === "yolo-seg") return "将严格使用 YOLO-Seg 杆子分割模型：检测杆子 mask，用 PCA 主方向计算角度。";
    if (detector === "yolov5") return "将严格使用 YOLOv5；建议训练 torsion_rod 杆子类别，或 torsion_marker 标记点类别。";
    if (detector === "opencv") return "将使用传统视觉提取横杆/标记点角度，适合作为快速回退。";
    return "自动模式会优先尝试 YOLO-Seg 杆子分割，未配置权重时依次回退 YOLOv5、传统视觉。";
  }

  function initializeDataLab() {
    if (!els.dataLabModal) return;
    applyDataLabStateToInputs();
    refreshDataLabComputation({ silent: true });
  }

  function populateDataLabPresetOptions() {
    return "";
  }

  function applyDataLabStateToInputs() {
    if (!els.dataLabModal) return;
    if (els.dataLabXUnit) els.dataLabXUnit.value = APP.dataLab.xUnit || "";
    if (els.dataLabYUnit) els.dataLabYUnit.value = APP.dataLab.yUnit || "";
    if (els.dataLabFitType) els.dataLabFitType.value = APP.dataLab.fitType || "linear";
    if (els.dataLabPointXInput) els.dataLabPointXInput.value = APP.dataLab.draftX || "";
    if (els.dataLabPointYInput) els.dataLabPointYInput.value = APP.dataLab.draftY || "";
    if (els.dataLabXBUncertainty) els.dataLabXBUncertainty.value = APP.dataLab.xBUncertainty || "";
    if (els.dataLabYBUncertainty) els.dataLabYBUncertainty.value = APP.dataLab.yBUncertainty || "";
    renderDataLabPointList();
    renderDataLabStatus(APP.dataLab.error || APP.dataLab.status || "请输入坐标点并添加到图像中。", Boolean(APP.dataLab.error));
  }

  function syncDataLabStateFromInputs() {
    APP.dataLab.xPreset = "custom";
    APP.dataLab.xLabel = "x";
    APP.dataLab.xUnit = els.dataLabXUnit?.value.trim() || "";
    APP.dataLab.xExpression = "x";
    APP.dataLab.yPreset = "custom";
    APP.dataLab.yLabel = "y";
    APP.dataLab.yUnit = els.dataLabYUnit?.value.trim() || "";
    APP.dataLab.yExpression = "y";
    APP.dataLab.fitType = els.dataLabFitType?.value || APP.dataLab.fitType || "linear";
    APP.dataLab.draftX = els.dataLabPointXInput?.value.trim() || "";
    APP.dataLab.draftY = els.dataLabPointYInput?.value.trim() || "";
    APP.dataLab.xBUncertainty = els.dataLabXBUncertainty?.value.trim() || "";
    APP.dataLab.yBUncertainty = els.dataLabYBUncertainty?.value.trim() || "";
    APP.dataLab.tableText = serializeDataLabPoints(APP.dataLab.points);
  }

  function handleDataLabPresetChange(control) {
    void control;
  }

  function applyDataLabQuantityPreset(axis, presetKey) {
    void axis;
    void presetKey;
  }

  function openDataLabModal() {
    const wasOpen = APP.dataLab.isOpen;
    APP.dataLab.isOpen = true;
    els.dataLabModal?.classList.remove("hidden");
    syncImmersiveState();
    if (!wasOpen) {
      pushUiHistoryView("data-lab");
    }
    applyDataLabStateToInputs();
    refreshDataLabComputation({ silent: true });
  }

  function closeDataLabModal({ skipHistory = false } = {}) {
    if (!skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "data-lab") {
      history.back();
      return;
    }
    APP.dataLab.isOpen = false;
    if (skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "data-lab") {
      replaceUiHistoryView("root");
    }
    els.dataLabModal?.classList.add("hidden");
    syncImmersiveState();
  }

  function applyDataLabSample(sampleKey) {
    const wasOpen = APP.dataLab.isOpen;
    APP.dataLab = {
      ...createDataLabState(sampleKey),
      isOpen: wasOpen,
    };
    applyDataLabStateToInputs();
    refreshDataLabComputation({ silent: true });
  }

  function addDataLabPointFromDraft() {
    syncDataLabStateFromInputs();
    const xValue = Number(APP.dataLab.draftX);
    const yValue = Number(APP.dataLab.draftY);
    if (!Number.isFinite(xValue) || !Number.isFinite(yValue)) {
      APP.dataLab.error = "请输入有效的 X、Y 数值后再添加。";
      renderDataLabStatus(APP.dataLab.error, true);
      showToast(APP.dataLab.error);
      return;
    }
    APP.dataLab.points = [
      ...(APP.dataLab.points || []),
      { x: xValue, y: yValue },
    ];
    APP.dataLab.draftX = "";
    APP.dataLab.draftY = "";
    APP.dataLab.error = "";
    APP.dataLab.tableText = serializeDataLabPoints(APP.dataLab.points);
    applyDataLabStateToInputs();
    refreshDataLabComputation({ silent: true });
    els.dataLabPointXInput?.focus();
  }

  function removeDataLabPoint(index) {
    APP.dataLab.points = (APP.dataLab.points || []).filter((_, pointIndex) => pointIndex !== index);
    APP.dataLab.tableText = serializeDataLabPoints(APP.dataLab.points);
    APP.dataLab.error = "";
    applyDataLabStateToInputs();
    refreshDataLabComputation({ silent: true });
  }

  function clearDataLabPoints() {
    APP.dataLab.points = [];
    APP.dataLab.tableText = "";
    APP.dataLab.result = null;
    APP.dataLab.error = "";
    APP.dataLab.status = "已清空坐标点，请重新输入。";
    applyDataLabStateToInputs();
    renderDataLabOutputs(null);
    renderDataLabStatus(APP.dataLab.status);
    els.dataLabPointXInput?.focus();
  }

  function serializeDataLabPoints(points = []) {
    return (points || [])
      .map((point) => `${formatDataLabNumber(point.x, 8)},${formatDataLabNumber(point.y, 8)}`)
      .join("\n");
  }

  function renderDataLabPointList() {
    if (els.dataLabPointCount) {
      els.dataLabPointCount.textContent = `${(APP.dataLab.points || []).length} 个点`;
    }
    if (!els.dataLabPointList) return;
    const points = APP.dataLab.points || [];
    if (!points.length) {
      els.dataLabPointList.innerHTML = '<div class="data-lab-point-empty">还没有坐标点。先输入一组 X、Y，再点击“添加点并重绘”。</div>';
      return;
    }
    els.dataLabPointList.innerHTML = points
      .map((point, index) => `
        <div class="data-lab-point-row">
          <span class="data-lab-point-index">#${index + 1}</span>
          <div class="data-lab-point-value">
            <span>X</span>
            <strong>${escapeHtml(formatDataLabNumber(point.x, 8))}</strong>
          </div>
          <div class="data-lab-point-value">
            <span>Y</span>
            <strong>${escapeHtml(formatDataLabNumber(point.y, 8))}</strong>
          </div>
          <button
            type="button"
            class="data-lab-point-remove"
            data-remove-point-index="${index}"
            aria-label="删除第 ${index + 1} 个点"
          >
            <i class="ri-delete-bin-6-line"></i>
          </button>
        </div>
      `)
      .join("");
  }

  function refreshDataLabComputation({ silent = false } = {}) {
    if (!els.dataLabModal) return;
    syncDataLabStateFromInputs();
    try {
      const result = analyzeDataLab(APP.dataLab);
      APP.dataLab.result = result;
      APP.dataLab.lastVariables = [];
      APP.dataLab.error = "";
      APP.dataLab.status = result.fit
        ? `已完成 ${result.points.length} 个点的${result.fit.label}，并更新不确定度。`
        : result.fitError
          ? `已绘制 ${result.points.length} 个点，并更新不确定度。${result.fitError}`
          : `已绘制 ${result.points.length} 个点，并更新不确定度。`;
      renderDataLabOutputs(result);
      renderDataLabStatus(APP.dataLab.status);
    } catch (error) {
      APP.dataLab.result = null;
      APP.dataLab.error = error?.message || "数据分析失败";
      APP.dataLab.lastVariables = [];
      renderDataLabOutputs(null);
      renderDataLabStatus(APP.dataLab.error, true);
      if (!silent) {
        showToast(APP.dataLab.error);
      }
    }
  }

  function renderDataLabUncertaintyInputs(variableNames = []) {
    void variableNames;
  }

  function renderDataLabOutputs(result) {
    renderDataLabPlot(result);
    renderDataLabSummary(result);
  }

  function renderDataLabPlot(result) {
    if (!els.dataLabPlot) return;
    if (!result || !result.points.length) {
      els.dataLabPlot.innerHTML = buildDataLabPlaceholder(APP.dataLab.error || "暂无可显示的数据图像。");
      if (els.dataLabPlotCaption) {
        els.dataLabPlotCaption.textContent = "请先输入至少一个坐标点";
      }
      return;
    }
    els.dataLabPlot.innerHTML = buildDataLabPlotSvg(result);
    if (els.dataLabPlotCaption) {
      els.dataLabPlotCaption.textContent = result.fit
        ? `${result.fit.label}：${result.fit.formula}，R² = ${formatDataLabNumber(result.fit.r2, 5)}`
        : (result.fitError || "已绘制散点，当前未生成拟合曲线。");
    }
  }

  function renderDataLabMetrics(result) {
    void result;
  }

  function renderDataLabSummary(result) {
    if (!els.dataLabResultSummary) return;
    if (!result || !result.points.length) {
      els.dataLabResultSummary.innerHTML = '<div class="data-lab-summary-empty">输入坐标点后，这里会显示拟合公式、相关系数与不确定度。</div>';
      return;
    }
    const summaryItems = [
      `<div class="data-lab-summary-item">已输入点数：<code>${escapeHtml(String(result.points.length))}</code></div>`,
      `<div class="data-lab-summary-item">拟合类型：<code>${escapeHtml(dataLabFitLabel(result.fitType))}</code></div>`,
    ];
    if (result.fit) {
      summaryItems.push(`<div class="data-lab-summary-item">拟合公式：<code>${escapeHtml(result.fit.formula)}</code></div>`);
      summaryItems.push(`<div class="data-lab-summary-item">相关系数：<code>R² = ${escapeHtml(formatDataLabNumber(result.fit.r2, 6))}</code></div>`);
    } else {
      summaryItems.push(`<div class="data-lab-summary-item">${escapeHtml(result.fitError || "当前数据不足以生成稳定拟合。")}</div>`);
    }
    if (result.uncertainty) {
      summaryItems.push(buildDataLabUncertaintySummaryMarkup("横坐标不确定度", result.xLabel, result.xUnit, result.uncertainty.x));
      summaryItems.push(buildDataLabUncertaintySummaryMarkup("纵坐标不确定度", result.yLabel, result.yUnit, result.uncertainty.y));
    }
    els.dataLabResultSummary.innerHTML = summaryItems.join("");
  }

  function renderDataLabTable(result) {
    void result;
  }

  function renderDataLabStatus(message, isError = false) {
    if (!els.dataLabStatus) return;
    els.dataLabStatus.textContent = message || "";
    els.dataLabStatus.classList.toggle("is-error", Boolean(isError));
  }

  function sendDataLabSummaryToChat() {
    if (!APP.dataLab.result) {
      showToast("请先完成一次有效的拟合，再发送给 Agent。");
      return;
    }
    const prompt = buildDataLabSummaryPrompt(APP.dataLab.result);
    closeDataLabModal({ skipHistory: true });
    fillAndSendPrompt(prompt);
  }

  function buildDataLabSummaryPrompt(result) {
    const rows = result.points
      .slice(0, 16)
      .map((point) => `${point.index}. x=${formatDataLabNumber(point.x, 6)}；y=${formatDataLabNumber(point.y, 6)}`)
      .join("\n");
    const fitSummary = result.fit
      ? `${result.fit.label}：${result.fit.formula}，R^2 = ${formatDataLabNumber(result.fit.r2, 6)}。`
      : `当前未生成稳定拟合：${result.fitError || "数据点不足"}。`;
    const uncertaintySummary = result.uncertainty
      ? [
          `横坐标不确定度：平均值 ${formatUncertaintyValue(result.uncertainty.x.mean, result.xUnit)}；A 类 ${formatUncertaintyValue(result.uncertainty.x.aClass, result.xUnit)}；B 类 ${formatUncertaintyValue(result.uncertainty.x.bClass, result.xUnit)}；总不确定度 ${formatUncertaintyValue(result.uncertainty.x.total, result.xUnit)}。`,
          `纵坐标不确定度：平均值 ${formatUncertaintyValue(result.uncertainty.y.mean, result.yUnit)}；A 类 ${formatUncertaintyValue(result.uncertainty.y.aClass, result.yUnit)}；B 类 ${formatUncertaintyValue(result.uncertainty.y.bClass, result.yUnit)}；总不确定度 ${formatUncertaintyValue(result.uncertainty.y.total, result.yUnit)}。`,
        ].join("\n")
      : "";
    return [
      "请根据以下实验数据拟合结果，概括图像趋势、物理意义，并给出实验改进建议。",
      `横坐标：${formatAxisLabel(result.xLabel, result.xUnit)}`,
      `纵坐标：${formatAxisLabel(result.yLabel, result.yUnit)}`,
      fitSummary,
      uncertaintySummary,
      rows ? `数据点如下：\n${rows}` : "",
      result.points.length > 16 ? `其余 ${result.points.length - 16} 组数据已省略。` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function renderExperimentLibrary() {
    const html = experiments
      .map(
        (exp) => `
        <article class="experiment-card" data-exp-id="${exp.id}">
          <button class="exp-entry-btn" data-action="open-detail" type="button">
            <span class="exp-entry-copy">
              <span class="exp-entry-title">${escapeHtml(exp.name)}</span>
              <span class="exp-entry-meta">${escapeHtml(`${exp.category} · ${exp.brief}`)}</span>
            </span>
            <i class="ri-arrow-right-up-line"></i>
          </button>
          <div class="exp-chip-row">
            <button class="submenu-btn exp-chip-btn" data-action="simulate" type="button">进入实验页</button>
            <button class="submenu-btn exp-chip-btn" data-action="principles" type="button">实验介绍</button>
            <button class="submenu-btn exp-chip-btn" data-action="questions" type="button">检验题目</button>
          </div>
        </article>
      `
      )
      .join("");

    els.experimentLibraryContainer.innerHTML = html;
  }

  function openCourseLabDetail(expId, { section = "overview" } = {}) {
    const experiment = experimentMap.get(expId);
    if (!experiment) return;
    const wasOpen = APP.courseLab.isOpen;
    if (APP.phet.isOpen) {
      closePhetWorkspace({ skipHistory: true });
    }
    APP.courseLab.isOpen = true;
    APP.courseLab.expId = expId;
    APP.courseLab.focusSection = section;
    renderCourseLabDetail();
    if (!wasOpen) {
      pushUiHistoryView("course-lab");
    }
    els.labMenuPanel?.classList.add("hidden");
    els.openLabMenuBtn?.setAttribute("aria-expanded", "false");
    requestAnimationFrame(() => {
      focusCourseLabSection(section);
    });
  }

  function closeCourseLabDetail({ preserveSelection = false, skipHistory = false } = {}) {
    if (!skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "course-lab") {
      history.back();
      return;
    }
    APP.courseLab.isOpen = false;
    APP.courseLab.focusSection = "overview";
    if (!preserveSelection) {
      APP.courseLab.expId = "";
    }
    if (skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "course-lab") {
      replaceUiHistoryView("root");
    }
    els.labDetailModal?.classList.remove("simulation-host-hidden");
    els.labDetailModal?.classList.add("hidden");
    syncImmersiveState();
  }

  function renderCourseLabDetail() {
    const experiment = experimentMap.get(APP.courseLab.expId);
    if (!experiment || !els.labDetailModal) return;

    if (els.labDetailTitle) {
      els.labDetailTitle.textContent = experiment.name;
    }
    if (els.labDetailCategory) {
      els.labDetailCategory.textContent = `${experiment.category} · ${implementedSimulationIds.has(experiment.id) ? "已内置交互仿真" : "实验详情页"}`;
    }
    if (els.labDetailBrief) {
      els.labDetailBrief.textContent = experiment.brief;
    }
    if (els.labDetailFormula) {
      els.labDetailFormula.textContent = experiment.formula;
    }
    if (els.labDetailIntroText) {
      els.labDetailIntroText.textContent = experiment.intro;
    }
    renderSimpleList(els.labDetailOutcomeList, experiment.outcomes);
    renderSimpleList(els.labDetailTipList, experiment.tips);
    renderOrderedList(els.labDetailQuizList, experiment.quiz);

    if (els.labDetailSimHint) {
      els.labDetailSimHint.textContent = implementedSimulationIds.has(experiment.id)
        ? "当前实验已接入交互式仿真，可在独立窗口中继续调节参数并观察现象。"
        : "当前实验先提供完整的实验介绍与检验题目，交互式仿真界面仍在扩展中。";
    }
    if (els.labDetailSimBtn) {
      els.labDetailSimBtn.textContent = implementedSimulationIds.has(experiment.id) ? "进入交互仿真" : "查看仿真计划";
      els.labDetailSimBtn.classList.toggle("is-secondary", !implementedSimulationIds.has(experiment.id));
    }

    syncCourseLabNavState();
    els.labDetailModal.classList.remove("hidden");
    syncImmersiveState();
  }

  function renderSimpleList(container, items) {
    if (!container) return;
    const values = Array.isArray(items)
      ? items.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    container.innerHTML = values.map((item) => `<div class="lab-detail-list-item">${escapeHtml(item)}</div>`).join("");
  }

  function renderOrderedList(container, items) {
    if (!container) return;
    const values = Array.isArray(items)
      ? items.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    container.innerHTML = values.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function syncCourseLabNavState() {
    if (!els.labDetailNav) return;
    const buttons = els.labDetailNav.querySelectorAll("[data-lab-section]");
    buttons.forEach((button) => {
      const isActive = button.getAttribute("data-lab-section") === APP.courseLab.focusSection;
      button.classList.toggle("active", isActive);
    });
  }

  function focusCourseLabSection(section) {
    const sectionMap = {
      overview: "labSectionOverview",
      goals: "labSectionGoals",
      quiz: "labSectionQuiz",
      simulation: "labSectionSimulation",
    };
    const targetId = sectionMap[section] || sectionMap.overview;
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openSimulationPlaceholder(experiment) {
    showToast(`【${experiment.name}】的交互式仿真正在搭建中，敬请期待。`);
  }

  function launchExperimentSimulation(expId) {
    const experiment = experimentMap.get(expId);
    if (!experiment) return;
    try {
      openSimulationModal(expId);
    } catch (error) {
      console.error("failed to open simulation", expId, error);
      showToast(`打开【${experiment.name}】仿真失败：${error?.message || "未知错误"}`);
    }
  }

  function openSimulationModal(expId) {
    const wasOpen = SIM.isOpen;
    SIM.currentExpId = expId;
    SIM.isOpen = true;
    configureSimulationUI(expId);
    els.labDetailModal?.classList.add("simulation-host-hidden");
    els.simulationModal.classList.remove("hidden");
    syncImmersiveState();
    if (!wasOpen) {
      pushUiHistoryView("simulation");
    }
    ensureSimulationCanvasSize();
    drawCurrentSimulation();
  }

  function closeSimulationModal({ skipHistory = false } = {}) {
    if (!skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "simulation") {
      history.back();
      return;
    }
    if (SIM.currentExpId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      if (p.stopwatch.running) {
        stopTorsionStopwatch(p, false);
      }
    }

    if (SIM.currentExpId === "wheatstone-bridge") {
      setWheatstoneSwitchPressed(false);
    }
    SIM.isOpen = false;
    if (skipHistory && (history.state?.[UI_VIEW_STATE_KEY] || "root") === "simulation") {
      replaceUiHistoryView(APP.courseLab.isOpen ? "course-lab" : "root");
    }
    els.simulationModal.classList.add("hidden");
    if (APP.courseLab.isOpen) {
      els.labDetailModal?.classList.remove("simulation-host-hidden");
    }
    syncImmersiveState();
  }

  async function saveCurrentSimulationImage() {
    if (!SIM.isOpen || !els.simulationCanvas) {
      showToast("请先进入一个交互仿真实验");
      return;
    }

    await runWithBusyButton(els.saveSimulationImageBtn, "保存中", async () => {
      drawCurrentSimulation();
      const blob = await new Promise((resolve) => els.simulationCanvas.toBlob(resolve, "image/png"));
      if (!blob) {
        throw new Error("浏览器未返回可用图像数据");
      }

      const experiment = experimentMap.get(SIM.currentExpId);
      const timestamp = formatExportTimestamp();
      const slug = sanitizeFilenamePart(SIM.currentExpId || "simulation");
      const filename = `${slug}-${timestamp}.png`;
      await saveBlobWithShareFallback(blob, filename, {
        shareTitle: `${experiment?.name || "实验仿真"}图像`,
        shareText: "交互仿真实验当前画面",
        shareSuccessToast: "已调起系统分享面板，可直接保存或发送实验图像。",
        downloadToast: `已开始保存实验图像：${filename}`,
        preferDownload: true,
      });
    }).catch((error) => {
      showToast(`保存实验图像失败：${error.message || "未知错误"}`);
    });
  }

  function configureSimulationUI(expId) {
    const expName = experimentMap.get(expId)?.name || "实验仿真";
    if (els.simulationModalTitle) {
      els.simulationModalTitle.textContent = `${expName} 仿真`;
    }
    els.simReadout?.classList.remove("hidden");

    const lambdaRow = els.simLambdaRange?.closest(".control-row");
    const displacementRow = els.simDisplacementRange?.closest(".control-row");
    const newtonPanel = ensureNewtonControlPanel();
    const torsionPanel = ensureTorsionControlPanel();
    const wheatstonePanel = ensureWheatstoneControlPanel();
    const gratingPanel = ensureGratingControlPanel();

    if (lambdaRow) lambdaRow.classList.remove("hidden");
    if (displacementRow) displacementRow.classList.remove("hidden");
    configureSimulationNumberField("lambda");
    configureSimulationNumberField("displacement");
    if (newtonPanel) newtonPanel.classList.add("hidden");
    if (torsionPanel) torsionPanel.classList.add("hidden");
    if (wheatstonePanel) wheatstonePanel.classList.add("hidden");
    if (gratingPanel) gratingPanel.classList.add("hidden");

    if (expId === "michelson") {
      const p = SIM.params.michelson;
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "等倾干涉圆环 · 2d cosθ = kλ";
      }
      configureSlider(els.simLambdaRange, { min: 400, max: 700, step: 0.1, value: p.lambdaNm });
      configureSlider(els.simDisplacementRange, { min: -8, max: 8, step: 0.01, value: p.displacementUm });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "激光波长 λ";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "微动镜位移 d（相对零位）";
      if (els.simColorLabel) els.simColorLabel.textContent = "颜色";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "Δ(2d)";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "估算级次 N";
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "等厚干涉扩展模型 · t = h₀ + r²/(2R) + x·tanα + Δh_d";
      }
      configureSlider(els.simLambdaRange, { min: 400, max: 700, step: 0.1, value: p.lambdaNm });
      configureSlider(els.simDisplacementRange, { min: 300, max: 3000, step: 10, value: p.curvatureMm });
      configureSimulationNumberField("lambda", { min: 400, max: 700, step: 0.1, value: p.lambdaNm, unit: "nm" });
      configureSimulationNumberField("displacement", { min: 300, max: 3000, step: 10, value: p.curvatureMm, unit: "mm" });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "激光波长 λ";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "透镜曲率半径 R";
      if (els.simColorLabel) els.simColorLabel.textContent = "中心空气隙 h₀";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "中心光强 I_c/I₀";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "可见圆环数";
      els.simReadout?.classList.add("hidden");
      if (newtonPanel) newtonPanel.classList.remove("hidden");
      syncNewtonPanelFromState();
    }

    if (expId === "wheatstone-bridge") {
      const p = SIM.params["wheatstone-bridge"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "惠斯通电桥平衡 · Rx = (R1/R2)Rs";
      }
      configureSlider(els.simLambdaRange, { min: 0, max: 1, step: 1, value: 0 });
      configureSlider(els.simDisplacementRange, { min: 0, max: 1, step: 1, value: 0 });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "比例臂 R1/R2";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "比较臂 Rs";
      if (els.simColorLabel) els.simColorLabel.textContent = "开关 K";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "检流计 dV";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "指针偏转";

      if (lambdaRow) lambdaRow.classList.add("hidden");
      if (displacementRow) displacementRow.classList.add("hidden");
      if (wheatstonePanel) wheatstonePanel.classList.remove("hidden");

      p.rsOhm = computeWheatstoneRsFromDigits(p.rsDigits);
      setWheatstoneSwitchPressed(false);
      syncWheatstonePanelFromState();
    }

    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "受迫振动稳态 · A = M0 / sqrt((k - Iω²)² + (cω)²)";
      }
      configureSlider(els.simLambdaRange, { min: 0.2, max: 3.0, step: 0.01, value: p.freqHz });
      configureSlider(els.simDisplacementRange, { min: 0.02, max: 1.2, step: 0.01, value: p.damping });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "驱动频率 f (Hz)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "阻尼系数 c";
      if (els.simColorLabel) els.simColorLabel.textContent = "相位差 φ";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "稳态振幅 A";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "共振频率 f_r";
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "分光计反射法 · φ = 2A";
      }
      configureSlider(els.simLambdaRange, { min: 50, max: 70, step: 0.1, value: p.prismAngleDeg });
      configureSlider(els.simDisplacementRange, { min: 0, max: 360, step: 0.05, value: p.telescopeDeg });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "待测棱镜顶角 A (°)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "望远镜转角 θ (°)";
      if (els.simColorLabel) els.simColorLabel.textContent = "反射夹角 φ";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "当前望远镜偏差 Δθ";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "测得顶角 A_meas";
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "扭摆周期公式 · T = 2π√(I/K)";
      }
      configureSlider(els.simLambdaRange, { min: 0, max: 90, step: 0.1, value: p.theta0Deg });
      configureSlider(els.simDisplacementRange, { min: 0, max: 360, step: 0.1, value: 0 });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "初始偏转角 θ0 (°)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "秒表读数";
      if (els.simColorLabel) els.simColorLabel.textContent = "实验对象";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "当前周期 T";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "计时结果";

      if (displacementRow) displacementRow.classList.add("hidden");
      if (torsionPanel) torsionPanel.classList.remove("hidden");
      p.currentThetaDeg = p.theta0Deg;
      p.prevThetaDeg = p.theta0Deg;
      p.simTimeSec = 0;
      p.isOscillating = true;
      syncTorsionPanelFromState();
    }

    if (expId === "double-arm-bridge") {
      const p = SIM.params["double-arm-bridge"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "开尔文双桥 · 低电阻补偿测量";
      }
      configureSlider(els.simLambdaRange, { min: 0.5, max: 2.0, step: 0.01, value: p.ratio });
      configureSlider(els.simDisplacementRange, { min: 1, max: 10, step: 0.1, value: p.standardMilliOhm });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "比例臂比值 R1/R2";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "标准低阻 Rs (mΩ)";
      if (els.simColorLabel) els.simColorLabel.textContent = "引线补偿";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "桥路失衡 ΔR";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "估计 Rx";
    }

    if (expId === "oscilloscope") {
      const p = SIM.params.oscilloscope;
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "数字示波器 · 波形、时基与幅值读数";
      }
      configureSlider(els.simLambdaRange, { min: 100, max: 2000, step: 10, value: p.freqHz });
      configureSlider(els.simDisplacementRange, { min: 0.5, max: 5.0, step: 0.1, value: p.amplitudeV });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "信号频率 f (Hz)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "信号峰值 U_m (V)";
      if (els.simColorLabel) els.simColorLabel.textContent = "示波模式";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "峰峰值 Vpp";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "周期 T";
    }

    if (expId === "dielectric-constant") {
      const p = SIM.params["dielectric-constant"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "平行板电容器 · 介质插入与电容变化";
      }
      configureSlider(els.simLambdaRange, { min: 1.0, max: 8.0, step: 0.1, value: p.epsilonR });
      configureSlider(els.simDisplacementRange, { min: 0, max: 1, step: 0.01, value: p.fillRatio });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "相对介电常数 εr";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "介质插入比例";
      if (els.simColorLabel) els.simColorLabel.textContent = "有效 ε";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "电容 C";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "较空气增益";
    }

    if (expId === "franck-hertz") {
      const p = SIM.params["franck-hertz"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "弗兰克-赫兹曲线 · 峰谷间距与激发能";
      }
      configureSlider(els.simLambdaRange, { min: 0, max: 60, step: 0.2, value: p.acceleratingV });
      configureSlider(els.simDisplacementRange, { min: 0, max: 5, step: 0.1, value: p.retardingV });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "加速电压 U_a (V)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "拒斥电压 U_r (V)";
      if (els.simColorLabel) els.simColorLabel.textContent = "峰谷间隔";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "集电极电流";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "对应激发能";
    }

    if (expId === "grating-spectrum") {
      const p = SIM.params["grating-spectrum"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "光栅光谱 · 一级谱线展开与定性识别";
      }
      configureSlider(els.simLambdaRange, { min: 300, max: 1200, step: 10, value: p.linesPerMm });
      configureSlider(els.simDisplacementRange, { min: 0, max: 35, step: 0.2, value: p.angleDeg });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "光栅密度 n (线/mm)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "观察角 θ (°)";
      if (els.simColorLabel) els.simColorLabel.textContent = "最邻近谱线";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "一级衍射 λ";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "角分散趋势";
      if (gratingPanel) gratingPanel.classList.remove("hidden");
      syncGratingPanelFromState();
    }

    if (expId === "hall-effect") {
      const p = SIM.params["hall-effect"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "霍尔效应 · 电流、磁场与横向电势差";
      }
      configureSlider(els.simLambdaRange, { min: 0.05, max: 1.2, step: 0.01, value: p.magneticT });
      configureSlider(els.simDisplacementRange, { min: 1, max: 20, step: 0.2, value: p.currentMa });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "磁感应强度 B (T)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "工作电流 I (mA)";
      if (els.simColorLabel) els.simColorLabel.textContent = "电荷偏转";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "霍尔电压 U_H";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "磁场测量";
    }

    if (expId === "potentiometer-emf") {
      const p = SIM.params["potentiometer-emf"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "电位差计补偿法 · 电动势与内阻测量";
      }
      configureSlider(els.simLambdaRange, { min: 1.0, max: 2.0, step: 0.01, value: p.emfV });
      configureSlider(els.simDisplacementRange, { min: 1, max: 30, step: 0.5, value: p.loadOhm });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "开路电动势 E (V)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "负载电阻 R (Ω)";
      if (els.simColorLabel) els.simColorLabel.textContent = "平衡长度比";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "端电压 U";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "估算内阻 r";
    }

    if (expId === "photoelectric-effect") {
      const p = SIM.params["photoelectric-effect"];
      if (els.simulationModalSubtitle) {
        els.simulationModalSubtitle.textContent = "光电效应 · 截止电压与入射频率";
      }
      configureSlider(els.simLambdaRange, { min: 400, max: 1000, step: 5, value: p.freqThz });
      configureSlider(els.simDisplacementRange, { min: 0, max: 3, step: 0.02, value: p.reverseV });
      if (els.simLambdaLabel) els.simLambdaLabel.textContent = "入射频率 ν (THz)";
      if (els.simDisplacementLabel) els.simDisplacementLabel.textContent = "反向电压 U_r (V)";
      if (els.simColorLabel) els.simColorLabel.textContent = "是否出射";
      if (els.simOpdLabel) els.simOpdLabel.textContent = "截止电压 U_c";
      if (els.simFringeLabel) els.simFringeLabel.textContent = "光电流状态";
    }

    updateSimulationPanelUI();
  }
  function configureSlider(rangeEl, config) {
    if (!rangeEl) return;
    rangeEl.min = String(config.min);
    rangeEl.max = String(config.max);
    rangeEl.step = String(config.step);
    rangeEl.value = String(config.value);
  }

  function configureNumberInput(inputEl, config) {
    if (!inputEl) return;
    inputEl.min = String(config.min);
    inputEl.max = String(config.max);
    inputEl.step = String(config.step);
    inputEl.value = String(config.value);
  }

  function countStepDecimals(stepValue) {
    const text = String(stepValue ?? "");
    if (!text || text === "any") return 0;
    if (text.includes("e-")) {
      return Number.parseInt(text.split("e-")[1], 10) || 0;
    }
    const dotIndex = text.indexOf(".");
    return dotIndex >= 0 ? text.length - dotIndex - 1 : 0;
  }

  function formatSimulationNumberByInput(inputEl, value) {
    if (!inputEl || !Number.isFinite(value)) return "";
    const digits = countStepDecimals(inputEl.step);
    return digits > 0 ? value.toFixed(digits) : value.toFixed(0);
  }

  function normalizeSimulationNumberInputValue(inputEl) {
    if (!inputEl) return null;
    const rawValue = Number.parseFloat(inputEl.value);
    if (!Number.isFinite(rawValue)) return null;

    let nextValue = rawValue;
    const min = Number.parseFloat(inputEl.min);
    const max = Number.parseFloat(inputEl.max);
    const step = Number.parseFloat(inputEl.step);
    if (Number.isFinite(min)) nextValue = Math.max(min, nextValue);
    if (Number.isFinite(max)) nextValue = Math.min(max, nextValue);
    if (Number.isFinite(step) && step > 0) {
      const base = Number.isFinite(min) ? min : 0;
      nextValue = Math.round((nextValue - base) / step) * step + base;
      if (Number.isFinite(min)) nextValue = Math.max(min, nextValue);
      if (Number.isFinite(max)) nextValue = Math.min(max, nextValue);
      nextValue = Number.parseFloat(nextValue.toFixed(countStepDecimals(step)));
    }
    inputEl.value = formatSimulationNumberByInput(inputEl, nextValue);
    return nextValue;
  }

  function syncSimulationNumberInputValue(inputEl, value) {
    if (!inputEl || document.activeElement === inputEl || !Number.isFinite(value)) return;
    inputEl.value = formatSimulationNumberByInput(inputEl, value);
  }

  function configureSimulationNumberField(kind, config = null) {
    const isLambda = kind === "lambda";
    const wrap = isLambda ? els.simLambdaNumberWrap : els.simDisplacementNumberWrap;
    const input = isLambda ? els.simLambdaNumber : els.simDisplacementNumber;
    const unit = isLambda ? els.simLambdaUnit : els.simDisplacementUnit;
    if (!wrap || !input || !unit) return;

    const visible = Boolean(config);
    wrap.classList.toggle("hidden", !visible);
    if (!visible) return;

    configureNumberInput(input, config);
    unit.textContent = config.unit || "";
  }

  function startSimulationLoop() {
    const loop = (ts) => {
      requestAnimationFrame(loop);

      if (!SIM.lastFrameMs) {
        SIM.lastFrameMs = ts;
      }

      const dt = clamp((ts - SIM.lastFrameMs) / 1000, 0.001, 0.06);
      SIM.lastFrameMs = ts;
      SIM.timeSec += dt;

      if (!SIM.isOpen) return;

      if (SIM.currentExpId === "michelson") {
        const p = SIM.params.michelson;
        const target = p.dBaseUm + p.displacementUm;
        p.dAnimatedUm += (target - p.dAnimatedUm) * 0.16;
      }

      if (SIM.currentExpId === "torsion-pendulum") {
        updateTorsionPendulumState(dt);
      }

      if (SIM.currentExpId === "wheatstone-bridge") {
        updateWheatstoneBridgeState(dt);
      }
      drawCurrentSimulation();
    };

    requestAnimationFrame(loop);
  }

  function scheduleSimulationDraw() {
    if (SIM.scheduledDrawRaf) return;
    SIM.scheduledDrawRaf = requestAnimationFrame(() => {
      SIM.scheduledDrawRaf = 0;
      if (!SIM.isOpen) return;
      drawCurrentSimulation();
    });
  }

  function drawCurrentSimulation() {
    if (SIM.currentExpId === "michelson") {
      drawMichelson();
      return;
    }

    if (SIM.currentExpId === "newton-rings") {
      drawNewtonRings();
      return;
    }

    if (SIM.currentExpId === "bohr-resonance") {
      drawBohrResonance();
      return;
    }

    if (SIM.currentExpId === "spectrometer-prism") {
      drawSpectrometerPrism();
      return;
    }

    if (SIM.currentExpId === "torsion-pendulum") {
      drawTorsionPendulum();
      return;
    }

    if (SIM.currentExpId === "wheatstone-bridge") {
      drawWheatstoneBridge();
      return;
    }

    if (SIM.currentExpId === "double-arm-bridge") {
      drawDoubleArmBridge();
      return;
    }

    if (SIM.currentExpId === "oscilloscope") {
      drawOscilloscope();
      return;
    }

    if (SIM.currentExpId === "dielectric-constant") {
      drawDielectricConstant();
      return;
    }

    if (SIM.currentExpId === "franck-hertz") {
      drawFranckHertz();
      return;
    }

    if (SIM.currentExpId === "grating-spectrum") {
      drawGratingSpectrum();
      return;
    }

    if (SIM.currentExpId === "hall-effect") {
      drawHallEffect();
      return;
    }

    if (SIM.currentExpId === "potentiometer-emf") {
      drawPotentiometerEmf();
      return;
    }

    if (SIM.currentExpId === "photoelectric-effect") {
      drawPhotoelectricEffect();
    }
  }
  function ensureSimulationCanvasSize() {
    const wrap = els.simulationCanvas.parentElement;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;

    els.simulationCanvas.width = Math.round(width * dpr);
    els.simulationCanvas.height = Math.round(height * dpr);
    els.simulationCanvas.style.width = `${width}px`;
    els.simulationCanvas.style.height = `${height}px`;

    simCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    SIM.canvasCssW = width;
    SIM.canvasCssH = height;
  }

  function drawMichelson() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params.michelson;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxRadius = Math.min(w, h) * 0.455;
    const focalPx = Math.min(w, h) * 0.73;

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createRadialGradient(cx, cy, maxRadius * 0.05, cx, cy, maxRadius * 1.16);
    bg.addColorStop(0, "rgba(15, 26, 52, 0.98)");
    bg.addColorStop(1, "rgba(2, 6, 16, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    simCtx.save();
    simCtx.translate(cx, cy);

    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.clip();

    const color = wavelengthToRGB(p.lambdaNm);
    const radii = computeMichelsonRadii(p.lambdaNm, p.dAnimatedUm, maxRadius, focalPx);

    for (let i = 0; i < radii.length; i += 1) {
      const r = radii[i];
      const next = radii[i + 1] ?? r + 2.2;
      const spacing = Math.max(0.7, next - r);

      const envelope = Math.exp(-Math.pow(r / (maxRadius * 1.28), 1.2));
      const orderFactor = i % 2 === 0 ? 0.95 : 0.34;
      const alpha = clamp(envelope * orderFactor, 0.04, 0.92);
      const lineWidth = clamp(spacing * 0.62, 0.7, 5.6);

      simCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`;
      simCtx.lineWidth = lineWidth;
      simCtx.beginPath();
      simCtx.arc(0, 0, r, 0, TWO_PI);
      simCtx.stroke();

      simCtx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.22).toFixed(3)})`;
      simCtx.lineWidth = Math.max(0.4, lineWidth * 0.22);
      simCtx.beginPath();
      simCtx.arc(0, 0, r, 0, TWO_PI);
      simCtx.stroke();
    }

    const centerGlow = simCtx.createRadialGradient(0, 0, 0, 0, 0, maxRadius * 0.12);
    centerGlow.addColorStop(0, "rgba(255, 255, 255, 0.86)");
    centerGlow.addColorStop(0.26, `rgba(${color.r}, ${color.g}, ${color.b}, 0.55)`);
    centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    simCtx.fillStyle = centerGlow;
    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius * 0.12, 0, TWO_PI);
    simCtx.fill();

    simCtx.restore();

    els.simReadout.textContent = `λ=${p.lambdaNm.toFixed(1)}nm · d=${p.displacementUm >= 0 ? "+" : ""}${p.displacementUm.toFixed(3)}μm`;
  }

  function computeMichelsonRadii(lambdaNm, dUm, maxRadius, focalPx) {
    const lambda = lambdaNm * 1e-9;
    const d = Math.max(8e-6, dUm * 1e-6);

    const kMax = Math.floor((2 * d) / lambda);
    const radii = [];

    for (let k = kMax; k >= 1; k -= 1) {
      const cosTheta = (k * lambda) / (2 * d);
      if (cosTheta <= 0 || cosTheta > 1) continue;

      const theta = Math.acos(cosTheta);
      const radius = focalPx * Math.tan(theta);

      if (radius > maxRadius * 1.06) break;
      if (radius >= 1) radii.push(radius);
      if (radii.length > 450) break;
    }

    return radii;
  }

  function drawNewtonRings() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["newton-rings"];
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxRadius = Math.min(w, h) * 0.455;
    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createRadialGradient(cx, cy, maxRadius * 0.05, cx, cy, maxRadius * 1.18);
    bg.addColorStop(0, "rgba(20, 18, 28, 0.98)");
    bg.addColorStop(1, "rgba(4, 6, 14, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    simCtx.save();
    simCtx.translate(cx, cy);

    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.clip();

    simCtx.fillStyle = "rgba(0, 0, 0, 0.92)";
    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.fill();

    const color = wavelengthToRGB(p.lambdaNm);
    const patternCanvas = getNewtonPatternCanvas(maxRadius, p);
    if (patternCanvas) {
      simCtx.drawImage(patternCanvas, -maxRadius, -maxRadius, maxRadius * 2, maxRadius * 2);
    }

    const edgeGlow = simCtx.createRadialGradient(0, 0, maxRadius * 0.08, 0, 0, maxRadius * 0.95);
    edgeGlow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`);
    edgeGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    simCtx.fillStyle = edgeGlow;
    simCtx.beginPath();
    simCtx.arc(0, 0, maxRadius, 0, TWO_PI);
    simCtx.fill();

    simCtx.restore();

    drawNewtonDefectMarker(cx, cy, maxRadius, p);
  }

  function getNewtonPatternCanvas(maxRadius, p) {
    const cache = SIM.renderCache.newton;
    const cssDiameter = Math.max(180, Math.round(maxRadius * 2));
    const quality = cache.quality === "preview" ? "preview" : "full";
    const key = [
      quality,
      cssDiameter,
      p.lambdaNm.toFixed(2),
      p.curvatureMm.toFixed(2),
      p.centerGapNm.toFixed(1),
      p.tiltUrad.toFixed(1),
      p.defectXmm.toFixed(2),
      p.defectYmm.toFixed(2),
      p.defectRadiusMm.toFixed(2),
      p.defectDepthNm.toFixed(1),
    ].join("|");

    if (cache.key === key && cache.canvas) {
      return cache.canvas;
    }

    const renderSize = quality === "preview"
      ? clamp(Math.round(cssDiameter * 0.68), 180, 420)
      : clamp(Math.round(cssDiameter * 0.86), 220, 640);
    const canvas = document.createElement("canvas");
    canvas.width = renderSize;
    canvas.height = renderSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    const image = ctx.createImageData(renderSize, renderSize);
    const data = image.data;
    const radiusPx = renderSize * 0.5;
    const pxPerM = radiusPx / NEWTON_VIEW_RADIUS_M;
    const color = wavelengthToRGB(p.lambdaNm);
    const edgeBlendPx = Math.max(8, radiusPx * 0.08);

    for (let y = 0; y < renderSize; y += 1) {
      for (let x = 0; x < renderSize; x += 1) {
        const dxPx = x + 0.5 - radiusPx;
        const dyPx = y + 0.5 - radiusPx;
        const radius = Math.hypot(dxPx, dyPx);
        const index = (y * renderSize + x) * 4;

        if (radius > radiusPx) {
          data[index + 3] = 0;
          continue;
        }

        const xM = dxPx / pxPerM;
        const yM = dyPx / pxPerM;
        const intensity = computeNewtonIntensityAtPoint(xM, yM, p);
        const radialRatio = clamp(radius / radiusPx, 0, 1);
        const envelope = Math.exp(-Math.pow(radialRatio, 1.42) * 0.72);
        const spectral = Math.pow(intensity, 0.82) * envelope;
        const glow = Math.pow(intensity, 2.0) * 72 * Math.exp(-radialRatio * 0.95);
        const base = 4 + 14 * Math.exp(-Math.pow(radialRatio, 1.8) * 3.1);
        const edgeFade = clamp((radiusPx - radius) / edgeBlendPx, 0, 1);

        data[index] = clamp(base + color.r * spectral + glow * 0.22, 0, 255);
        data[index + 1] = clamp(base + color.g * spectral + glow * 0.20, 0, 255);
        data[index + 2] = clamp(base + color.b * spectral + glow * 0.26, 0, 255);
        data[index + 3] = Math.round(255 * edgeFade);
      }
    }

    ctx.putImageData(image, 0, 0);
    cache.key = key;
    cache.canvas = canvas;
    return canvas;
  }

  function computeNewtonDefectContributionM(xM, yM, p) {
    const radiusM = Math.max(0, Number(p.defectRadiusMm) || 0) * 1e-3;
    const depthM = (Number(p.defectDepthNm) || 0) * 1e-9;
    if (radiusM < 1e-9 || Math.abs(depthM) < 1e-12) return 0;

    const defectXM = (Number(p.defectXmm) || 0) * 1e-3;
    const defectYM = (Number(p.defectYmm) || 0) * 1e-3;
    const dx = xM - defectXM;
    const dy = yM - defectYM;
    const sigma = Math.max(radiusM * 0.42, 6e-5);
    const exponent = -((dx * dx) + (dy * dy)) / (2 * sigma * sigma);
    return depthM * Math.exp(exponent);
  }

  function computeNewtonThicknessM(xM, yM, p) {
    const curvatureM = Math.max(0.3, Number(p.curvatureMm) || 1000) / 1000;
    const centerGapM = Math.max(0, Number(p.centerGapNm) || 0) * 1e-9;
    const tiltRad = (Number(p.tiltUrad) || 0) * 1e-6;
    const sphericalGap = ((xM * xM) + (yM * yM)) / (2 * curvatureM);
    const wedgeGap = xM * Math.tan(tiltRad);
    const defectGap = computeNewtonDefectContributionM(xM, yM, p);
    return Math.max(0, centerGapM + sphericalGap + wedgeGap + defectGap);
  }

  function computeNewtonNormalizedIntensity(thicknessM, lambdaNm) {
    const lambdaM = Math.max(380, Number(lambdaNm) || 546.1) * 1e-9;
    return 0.5 * (1 - Math.cos((4 * Math.PI * thicknessM) / lambdaM));
  }

  function computeNewtonIntensityAtPoint(xM, yM, p) {
    return computeNewtonNormalizedIntensity(computeNewtonThicknessM(xM, yM, p), p.lambdaNm);
  }

  function computeNewtonCenterIntensity(p) {
    return computeNewtonIntensityAtPoint(0, 0, p);
  }

  function drawNewtonDefectMarker(cx, cy, maxRadius, p) {
    if (p.defectRadiusMm <= 0.01 || Math.abs(p.defectDepthNm) <= 0.1) return;

    const pxPerM = maxRadius / NEWTON_VIEW_RADIUS_M;
    const markerX = cx + (p.defectXmm * 1e-3 * pxPerM);
    const markerY = cy + (p.defectYmm * 1e-3 * pxPerM);
    const markerR = Math.max(6, p.defectRadiusMm * 1e-3 * pxPerM);
    const crossHalf = Math.max(5, markerR * 0.42);

    simCtx.save();
    simCtx.setLineDash([5, 4]);
    simCtx.strokeStyle = "rgba(255, 86, 86, 0.92)";
    simCtx.lineWidth = 1.6;
    simCtx.beginPath();
    simCtx.arc(markerX, markerY, markerR, 0, TWO_PI);
    simCtx.stroke();
    simCtx.setLineDash([]);
    simCtx.beginPath();
    simCtx.moveTo(markerX - crossHalf, markerY);
    simCtx.lineTo(markerX + crossHalf, markerY);
    simCtx.moveTo(markerX, markerY - crossHalf);
    simCtx.lineTo(markerX, markerY + crossHalf);
    simCtx.stroke();
    simCtx.fillStyle = "rgba(255, 112, 112, 0.98)";
    simCtx.font = "700 16px 'Segoe UI', sans-serif";
    simCtx.textAlign = "left";
    simCtx.textBaseline = "bottom";
    simCtx.fillText("缺陷", markerX + markerR + 8, markerY - 6);
    simCtx.restore();
  }

  function drawNewtonCenterIntensityChart(ctx, w, h, p, color) {
    const comparison = computeNewtonComparisonMetrics(p);
    const plotLeft = 68;
    const plotRight = w - 26;
    const plotTop = 32;
    const plotBottom = h - 58;
    const plotW = Math.max(40, plotRight - plotLeft);
    const plotH = Math.max(40, plotBottom - plotTop);
    const maxGapNm = Math.max(
      800,
      Math.ceil((p.centerGapNm + 140) / 100) * 100,
      Math.ceil((p.lambdaNm * 2.4) / 100) * 100,
      Number.isFinite(comparison.actualCenterGapNm) ? Math.ceil((comparison.actualCenterGapNm + 140) / 100) * 100 : 0,
    );
    const defectAtCenterNm = computeNewtonDefectContributionM(0, 0, p) * 1e9;
    const currentIntensity = computeNewtonCenterIntensity(p);

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(8, 15, 28, 0.84)";
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.fill();

    ctx.strokeStyle = "rgba(224, 238, 255, 0.16)";
    ctx.lineWidth = 1;
    roundRect(ctx, 0, 0, w, h, 16);
    ctx.stroke();

    ctx.font = "14px 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(196, 216, 242, 0.78)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = plotBottom - (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();

      ctx.fillText((i / 4).toFixed(2), plotLeft - 10, y);
    }

    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i += 1) {
      const x = plotLeft + (plotW * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
      ctx.fillText(`${Math.round((maxGapNm * i) / 4)}`, x, plotBottom + 20);
    }

    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.96)`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i <= 180; i += 1) {
      const gapNm = (maxGapNm * i) / 180;
      const thicknessM = Math.max(0, (gapNm + defectAtCenterNm) * 1e-9);
      const intensity = computeNewtonNormalizedIntensity(thicknessM, p.lambdaNm);
      const x = plotLeft + (gapNm / maxGapNm) * plotW;
      const y = plotBottom - intensity * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const currentX = plotLeft + (clamp(p.centerGapNm, 0, maxGapNm) / maxGapNm) * plotW;
    const currentY = plotBottom - currentIntensity * plotH;
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.beginPath();
    ctx.arc(currentX, currentY, 5.1, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.9)`;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(currentX, currentY, 8.8, 0, TWO_PI);
    ctx.stroke();

    if (comparison.hasActualGap && comparison.hasActualIntensity) {
      const actualX = plotLeft + (clamp(comparison.actualCenterGapNm, 0, maxGapNm) / maxGapNm) * plotW;
      const actualY = plotBottom - clamp(comparison.actualCenterIntensityPct / 100, 0, 1) * plotH;

      ctx.strokeStyle = "rgba(255, 196, 93, 0.88)";
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(actualX, actualY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "rgba(255, 196, 93, 0.96)";
      ctx.beginPath();
      ctx.rect(actualX - 5.2, actualY - 5.2, 10.4, 10.4);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 196, 93, 0.5)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(actualX - 7.4, actualY - 7.4, 14.8, 14.8);
    }

    ctx.fillStyle = "rgba(224, 238, 255, 0.9)";
    ctx.font = "600 15px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("I_c / I₀", 14, 22);
    ctx.textAlign = "right";
    ctx.fillText("h₀ / nm", w - 14, h - 14);
    ctx.restore();
  }

  function renderNewtonChartPanel() {
    const panel = ensureNewtonControlPanel();
    if (!panel || panel.classList.contains("hidden")) return;
    const chartHost = panel.querySelector("#newtonChartHost");
    const chartCanvas = panel.querySelector("#newtonChartCanvas");
    if (!chartHost || !chartCanvas) return;

    const rect = chartHost.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || chartHost.clientWidth || 0));
    const cssH = Math.max(276, Math.min(360, Math.round(cssW * 0.38)));
    if (cssW < 2 || cssH < 2) return;

    const dpr = window.devicePixelRatio || 1;
    chartCanvas.width = Math.round(cssW * dpr);
    chartCanvas.height = Math.round(cssH * dpr);
    chartCanvas.style.width = `${cssW}px`;
    chartCanvas.style.height = `${cssH}px`;

    const chartCtx = chartCanvas.getContext("2d");
    if (!chartCtx) return;
    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const p = SIM.params["newton-rings"];
    drawNewtonCenterIntensityChart(chartCtx, cssW, cssH, p, wavelengthToRGB(p.lambdaNm));
  }

  function buildNewtonReadoutText(p) {
    const centerIntensity = computeNewtonCenterIntensity(p);
    const ringCount = estimateNewtonVisibleRingCount(p.lambdaNm, p.curvatureMm, p.centerGapNm);
    const defectEnabled = p.defectRadiusMm > 0.01 && Math.abs(p.defectDepthNm) > 0.1;
    const defectText = defectEnabled
      ? `缺陷 Δh_d=${p.defectDepthNm >= 0 ? "+" : ""}${p.defectDepthNm.toFixed(0)}nm`
      : "无缺陷";
    return `λ=${p.lambdaNm.toFixed(1)}nm（${wavelengthBandName(p.lambdaNm)}） · R=${p.curvatureMm.toFixed(0)}mm · h₀=${p.centerGapNm.toFixed(0)}nm · α=${p.tiltUrad >= 0 ? "+" : ""}${p.tiltUrad.toFixed(0)}μrad · I_c≈${(centerIntensity * 100).toFixed(1)}% · ${defectText} · N≈${ringCount}`;
  }

  function computeNewtonSweepPercentDifference(simValue, idealValue) {
    if (!Number.isFinite(simValue) || !Number.isFinite(idealValue)) return null;
    if (Math.abs(idealValue) < 1e-9) {
      return Math.abs(simValue) < 1e-9 ? 0 : null;
    }
    return (Math.abs(simValue - idealValue) / Math.abs(idealValue)) * 100;
  }

  function createNewtonTiltSweepStudyParams(p, alphaDeg) {
    return {
      ...p,
      tiltUrad: alphaDeg * (Math.PI / 180) * 1e6,
      defectXmm: 0,
      defectYmm: 0,
      defectRadiusMm: 0,
      defectDepthNm: 0,
    };
  }

  function estimateNewtonSimulatedTiltShiftMm(p) {
    const alphaRad = (Number(p.tiltUrad) || 0) * 1e-6;
    if (Math.abs(alphaRad) < 1e-12) return 0;

    const curvatureM = Math.max(0.3, Number(p.curvatureMm) || 1000) / 1000;
    const expectedCenterM = -curvatureM * Math.tan(alphaRad);
    const searchSpanM = Math.max(6e-3, Math.abs(expectedCenterM) * 2.4 + 2e-3);
    const sampleCount = 6001;
    let minThickness = Infinity;

    for (let i = 0; i < sampleCount; i += 1) {
      const ratio = i / (sampleCount - 1);
      const xM = -searchSpanM + ratio * searchSpanM * 2;
      const thickness = computeNewtonThicknessM(xM, 0, p);
      if (thickness < minThickness) {
        minThickness = thickness;
      }
    }

    const tolerance = Math.max(1e-12, minThickness * 0.05 + 1e-12);
    let firstXM = null;
    let lastXM = null;

    for (let i = 0; i < sampleCount; i += 1) {
      const ratio = i / (sampleCount - 1);
      const xM = -searchSpanM + ratio * searchSpanM * 2;
      const thickness = computeNewtonThicknessM(xM, 0, p);
      if (Math.abs(thickness - minThickness) <= tolerance) {
        if (firstXM == null) firstXM = xM;
        lastXM = xM;
      }
    }

    const centerXM = ((firstXM ?? expectedCenterM) + (lastXM ?? expectedCenterM)) * 0.5;
    return Math.abs(centerXM) * 1e3;
  }

  function buildNewtonTiltSweepRows(p) {
    const rows = [];
    for (let alphaDeg = 0; alphaDeg <= 5.0001; alphaDeg += 0.5) {
      const alphaRad = alphaDeg * Math.PI / 180;
      const studyParams = createNewtonTiltSweepStudyParams(p, alphaDeg);
      const idealShiftMm = Math.abs((Number(p.curvatureMm) || 1000) * Math.tan(alphaRad));
      const simulatedShiftMm = estimateNewtonSimulatedTiltShiftMm(studyParams);
      rows.push({
        alphaDeg,
        idealShiftMm,
        simulatedShiftMm,
        percentDiff: computeNewtonSweepPercentDifference(simulatedShiftMm, idealShiftMm),
      });
    }
    return rows;
  }

  function formatNewtonSweepMm(value) {
    return Number.isFinite(value) ? value.toFixed(3) : "--";
  }

  function drawBohrResonance() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["bohr-resonance"];

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(10, 18, 34, 1)");
    bg.addColorStop(1, "rgba(6, 12, 24, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const splitX = w * 0.44;
    const gap = 16;

    const leftX0 = 12;
    const leftY0 = 12;
    const leftW = splitX - 2 * leftX0;
    const leftH = h - 24;

    simCtx.fillStyle = "rgba(255, 255, 255, 0.03)";
    roundRect(simCtx, leftX0, leftY0, leftW, leftH, 14);
    simCtx.fill();
    simCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    simCtx.lineWidth = 1;
    roundRect(simCtx, leftX0, leftY0, leftW, leftH, 14);
    simCtx.stroke();

    const omega = TWO_PI * p.freqHz;
    const phase = forcedPhase(p.freqHz, p.damping, p);
    const amp = forcedAmplitude(p.freqHz, p.damping, p);
    const peakAmp = Math.max(peakAmplitudeForDamping(p.damping, p), 1e-6);
    const ampRatio = clamp(amp / peakAmp, 0, 1.2);
    const thetaAmp = 0.08 + ampRatio * 0.56;
    const theta = thetaAmp * Math.cos(SIM.timeSec * omega - phase);

    const pivotX = leftX0 + leftW * 0.5;
    const pivotY = leftY0 + leftH * 0.2;
    const rodLength = Math.min(leftW, leftH) * 0.36;
    const bobX = pivotX + rodLength * Math.sin(theta);
    const bobY = pivotY + rodLength * Math.cos(theta);

    simCtx.strokeStyle = "rgba(160, 198, 255, 0.52)";
    simCtx.lineWidth = 1.2;
    simCtx.beginPath();
    simCtx.moveTo(leftX0 + leftW * 0.18, pivotY);
    simCtx.lineTo(leftX0 + leftW * 0.82, pivotY);
    simCtx.stroke();

    simCtx.setLineDash([4, 5]);
    simCtx.strokeStyle = "rgba(255,255,255,0.2)";
    simCtx.beginPath();
    simCtx.moveTo(pivotX, pivotY);
    simCtx.lineTo(pivotX, pivotY + rodLength + 22);
    simCtx.stroke();
    simCtx.setLineDash([]);

    simCtx.strokeStyle = "rgba(114, 220, 255, 0.42)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.arc(pivotX, pivotY, rodLength, Math.PI / 2 - thetaAmp, Math.PI / 2 + thetaAmp);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(138, 221, 255, 0.92)";
    simCtx.lineWidth = 2.4;
    simCtx.beginPath();
    simCtx.moveTo(pivotX, pivotY);
    simCtx.lineTo(bobX, bobY);
    simCtx.stroke();

    const bobGlow = simCtx.createRadialGradient(bobX - 4, bobY - 4, 2, bobX, bobY, 16);
    bobGlow.addColorStop(0, "rgba(255,255,255,0.95)");
    bobGlow.addColorStop(0.35, "rgba(124,220,255,0.85)");
    bobGlow.addColorStop(1, "rgba(34,150,212,0.2)");
    simCtx.fillStyle = bobGlow;
    simCtx.beginPath();
    simCtx.arc(bobX, bobY, 12, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(230, 241, 255, 0.88)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.fillText(`θmax ≈ ${(thetaAmp * 180 / Math.PI).toFixed(1)}°`, leftX0 + 14, leftY0 + 22);
    simCtx.fillText(`A/Apeak = ${ampRatio.toFixed(2)}`, leftX0 + 14, leftY0 + 40);

    const rightX0 = splitX + gap;
    const rightY0 = 16;
    const rightX1 = w - 16;
    const rightY1 = h - 22;

    simCtx.fillStyle = "rgba(255, 255, 255, 0.03)";
    roundRect(simCtx, rightX0 - 6, rightY0 - 6, rightX1 - rightX0 + 12, rightY1 - rightY0 + 10, 14);
    simCtx.fill();
    simCtx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    simCtx.lineWidth = 1;
    roundRect(simCtx, rightX0 - 6, rightY0 - 6, rightX1 - rightX0 + 12, rightY1 - rightY0 + 10, 14);
    simCtx.stroke();

    const chartPadL = 26;
    const chartPadR = 12;
    const chartPadT = 10;
    const chartPadB = 24;

    const chartX0 = rightX0 + chartPadL;
    const chartX1 = rightX1 - chartPadR;
    const chartY0 = rightY0 + chartPadT;
    const chartY1 = rightY1 - chartPadB;

    const fMin = 0.2;
    const fMax = 3.0;
    const samples = 220;

    const curve = [];
    let maxA = 1e-6;
    for (let i = 0; i <= samples; i += 1) {
      const f = fMin + (fMax - fMin) * (i / samples);
      const a = forcedAmplitude(f, p.damping, p);
      curve.push([f, a]);
      if (a > maxA) maxA = a;
    }

    simCtx.strokeStyle = "rgba(255,255,255,0.22)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(chartX0, chartY1);
    simCtx.lineTo(chartX1, chartY1);
    simCtx.lineTo(chartX1, chartY0);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(90, 193, 255, 0.92)";
    simCtx.lineWidth = 2;
    simCtx.beginPath();
    curve.forEach(([f, a], idx) => {
      const x = chartX0 + ((f - fMin) / (fMax - fMin)) * (chartX1 - chartX0);
      const y = chartY1 - (a / maxA) * (chartY1 - chartY0);
      if (idx === 0) simCtx.moveTo(x, y);
      else simCtx.lineTo(x, y);
    });
    simCtx.stroke();

    const pointX = chartX0 + ((p.freqHz - fMin) / (fMax - fMin)) * (chartX1 - chartX0);
    const pointY = chartY1 - (amp / maxA) * (chartY1 - chartY0);

    simCtx.fillStyle = "rgba(255, 196, 93, 0.98)";
    simCtx.beginPath();
    simCtx.arc(pointX, pointY, 5.2, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(255, 196, 93, 0.35)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(pointX, chartY1);
    simCtx.lineTo(pointX, pointY);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(230, 241, 255, 0.88)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.fillText("f (Hz)", chartX1 - 28, chartY1 + 16);
    simCtx.fillText("A", chartX0 - 18, chartY0 + 8);

    const fRes = resonancePeakFrequencyHz(p.damping, p);
    simCtx.fillText(`f_r≈${fRes.toFixed(2)}Hz`, chartX0 + 8, chartY0 + 14);

    els.simReadout.textContent = `f=${p.freqHz.toFixed(2)} Hz · c=${p.damping.toFixed(2)} · A=${amp.toExponential(2)}`;
  }



  function ensureNewtonControlPanel() {
    const controlsRoot = els.simulationModal?.querySelector(".simulation-controls");
    if (!controlsRoot) return null;

    let panel = document.getElementById("newtonControlPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "newtonControlPanel";
      panel.className = "control-row newton-control-panel hidden";
      panel.innerHTML = `
        <div class="newton-panel-head">
          <div class="newton-panel-title">
            <strong>非理想接触修正</strong>
            <span id="newtonPanelHint">引入中心空气隙、倾斜与局部缺陷后，可观察牛顿环的偏移与畸变。</span>
          </div>
          <div class="newton-panel-actions">
            <button id="newtonRecordBtn" type="button" class="sim-action-btn">记录当前数据</button>
            <button id="newtonSaveRecordsBtn" type="button" class="sim-action-btn sim-action-btn-secondary">保存表格</button>
            <button id="newtonClearRecordsBtn" type="button" class="sim-action-btn sim-action-btn-secondary">清空记录</button>
            <button id="newtonExportBtn" type="button" class="sim-action-btn">保存图像</button>
            <button id="newtonResetBtn" type="button" class="sim-action-btn sim-action-btn-secondary">恢复理想接触</button>
          </div>
        </div>
        <div class="newton-control-grid">
          <div class="newton-control-field">
            <div class="control-head">
              <label for="newtonCenterGapRange">中心空气隙 h₀</label>
              <span id="newtonCenterGapValue">0 nm</span>
            </div>
            <div class="newton-input-row">
              <input id="newtonCenterGapRange" data-newton-key="centerGapNm" type="range" min="0" max="1500" step="1" value="0" />
              <label class="newton-number-box" for="newtonCenterGapNumber">
                <input
                  id="newtonCenterGapNumber"
                  data-newton-number-key="centerGapNm"
                  type="number"
                  min="0"
                  max="1500"
                  step="1"
                  value="0"
                  inputmode="decimal"
                />
                <span>nm</span>
              </label>
            </div>
          </div>
          <div class="newton-control-field">
            <div class="control-head">
              <label for="newtonTiltRange">倾斜角 α</label>
              <span id="newtonTiltValue">0 μrad</span>
            </div>
            <div class="newton-input-row">
              <input id="newtonTiltRange" data-newton-key="tiltUrad" type="range" min="-240" max="240" step="1" value="0" />
              <label class="newton-number-box" for="newtonTiltNumber">
                <input
                  id="newtonTiltNumber"
                  data-newton-number-key="tiltUrad"
                  type="number"
                  min="-240"
                  max="240"
                  step="1"
                  value="0"
                  inputmode="decimal"
                />
                <span>μrad</span>
              </label>
            </div>
          </div>
          <div class="newton-control-field">
            <div class="control-head">
              <label for="newtonDefectXRange">缺陷位置 x</label>
              <span id="newtonDefectXValue">0.00 mm</span>
            </div>
            <div class="newton-input-row">
              <input id="newtonDefectXRange" data-newton-key="defectXmm" type="range" min="-3.5" max="3.5" step="0.01" value="0" />
              <label class="newton-number-box" for="newtonDefectXNumber">
                <input
                  id="newtonDefectXNumber"
                  data-newton-number-key="defectXmm"
                  type="number"
                  min="-3.5"
                  max="3.5"
                  step="0.01"
                  value="0"
                  inputmode="decimal"
                />
                <span>mm</span>
              </label>
            </div>
          </div>
          <div class="newton-control-field">
            <div class="control-head">
              <label for="newtonDefectYRange">缺陷位置 y</label>
              <span id="newtonDefectYValue">0.00 mm</span>
            </div>
            <div class="newton-input-row">
              <input id="newtonDefectYRange" data-newton-key="defectYmm" type="range" min="-3.5" max="3.5" step="0.01" value="0" />
              <label class="newton-number-box" for="newtonDefectYNumber">
                <input
                  id="newtonDefectYNumber"
                  data-newton-number-key="defectYmm"
                  type="number"
                  min="-3.5"
                  max="3.5"
                  step="0.01"
                  value="0"
                  inputmode="decimal"
                />
                <span>mm</span>
              </label>
            </div>
          </div>
          <div class="newton-control-field">
            <div class="control-head">
              <label for="newtonDefectRadiusRange">缺陷尺度 r_d</label>
              <span id="newtonDefectRadiusValue">0.00 mm</span>
            </div>
            <div class="newton-input-row">
              <input id="newtonDefectRadiusRange" data-newton-key="defectRadiusMm" type="range" min="0" max="1.8" step="0.01" value="0" />
              <label class="newton-number-box" for="newtonDefectRadiusNumber">
                <input
                  id="newtonDefectRadiusNumber"
                  data-newton-number-key="defectRadiusMm"
                  type="number"
                  min="0"
                  max="1.8"
                  step="0.01"
                  value="0"
                  inputmode="decimal"
                />
                <span>mm</span>
              </label>
            </div>
          </div>
          <div class="newton-control-field">
            <div class="control-head">
              <label for="newtonDefectDepthRange">缺陷附加隙厚 Δh_d</label>
              <span id="newtonDefectDepthValue">+0 nm</span>
            </div>
            <div class="newton-input-row">
              <input id="newtonDefectDepthRange" data-newton-key="defectDepthNm" type="range" min="-320" max="320" step="5" value="0" />
              <label class="newton-number-box" for="newtonDefectDepthNumber">
                <input
                  id="newtonDefectDepthNumber"
                  data-newton-number-key="defectDepthNm"
                  type="number"
                  min="-320"
                  max="320"
                  step="5"
                  value="0"
                  inputmode="decimal"
                />
                <span>nm</span>
              </label>
            </div>
          </div>
        </div>
        <div id="newtonPanelSummary" class="newton-panel-summary">当前为理想接触模型，中心保持暗斑。</div>
        <div id="newtonChartHost" class="newton-chart-host">
          <button id="newtonExportChartBtn" type="button" class="newton-chart-save-btn">保存曲线</button>
          <canvas id="newtonChartCanvas" class="newton-chart-canvas"></canvas>
        </div>
        <div class="newton-records" aria-live="polite">
          <div class="newton-records-head">
            <strong>仿真数据记录表</strong>
            <span id="newtonRecordMeta">点击“记录当前数据”后，将把上方仿真参数写入表格。</span>
          </div>
          <div class="newton-record-table-wrap">
            <table class="newton-record-table">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>记录时间</th>
                  <th>λ / nm</th>
                  <th>R / mm</th>
                  <th>h₀ / nm</th>
                  <th>I_c / %</th>
                  <th>α / μrad</th>
                  <th>缺陷中心 / mm</th>
                  <th>r_d / mm</th>
                  <th>Δh_d / nm</th>
                  <th>可见环数</th>
                </tr>
              </thead>
              <tbody id="newtonRecordTableBody">
                <tr>
                  <td colspan="11" class="newton-record-empty">暂无记录</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;

      const metrics = controlsRoot.querySelector(".sim-metrics");
      if (metrics) controlsRoot.insertBefore(panel, metrics);
      else controlsRoot.appendChild(panel);

      panel.querySelectorAll('input[type="range"][data-newton-key]').forEach((input) => {
        input.addEventListener("input", () => {
          if (SIM.currentExpId !== "newton-rings") return;
          const key = input.getAttribute("data-newton-key");
          if (!key) return;
          updateNewtonParameter(key, Number.parseFloat(input.value), {
            preview: true,
            deferDraw: true,
          });
        });

        input.addEventListener("change", () => {
          if (SIM.currentExpId !== "newton-rings") return;
          const key = input.getAttribute("data-newton-key");
          if (!key) return;
          updateNewtonParameter(key, Number.parseFloat(input.value), {
            preview: false,
            deferDraw: true,
          });
        });
      });

      panel.querySelectorAll('input[type="number"][data-newton-number-key]').forEach((input) => {
        input.addEventListener("input", () => {
          if (SIM.currentExpId !== "newton-rings") return;
          const key = input.getAttribute("data-newton-number-key");
          const value = Number.parseFloat(input.value);
          if (!key || !Number.isFinite(value)) return;
          updateNewtonParameter(key, value, {
            preview: false,
            deferDraw: true,
          });
        });

        input.addEventListener("change", () => {
          if (SIM.currentExpId !== "newton-rings") return;
          const key = input.getAttribute("data-newton-number-key");
          if (!key) return;
          const value = Number.parseFloat(input.value);
          if (!Number.isFinite(value)) {
            syncNewtonPanelFromState();
            return;
          }
          const clampedValue = updateNewtonParameter(key, value, {
            preview: false,
            deferDraw: true,
          });
          input.value = formatNewtonNumberInputValue(key, clampedValue);
        });
      });

      panel.querySelector("#newtonExportBtn")?.addEventListener("click", () => {
        if (SIM.currentExpId !== "newton-rings") return;
        exportNewtonSimulationImage().catch((error) => {
          showToast(`导出图像失败：${error.message || "未知错误"}`);
        });
      });

      panel.querySelector("#newtonRecordBtn")?.addEventListener("click", () => {
        if (SIM.currentExpId !== "newton-rings") return;
        recordNewtonMeasurement();
      });

      panel.querySelector("#newtonSaveRecordsBtn")?.addEventListener("click", () => {
        if (SIM.currentExpId !== "newton-rings") return;
        saveNewtonMeasurementData().catch((error) => {
          showToast(`保存表格失败：${error.message || "未知错误"}`);
        });
      });

      panel.querySelector("#newtonClearRecordsBtn")?.addEventListener("click", () => {
        if (SIM.currentExpId !== "newton-rings") return;
        clearNewtonMeasurementRecords();
      });

      panel.querySelector("#newtonExportChartBtn")?.addEventListener("click", () => {
        if (SIM.currentExpId !== "newton-rings") return;
        exportNewtonChartImage().catch((error) => {
          showToast(`导出曲线失败：${error.message || "未知错误"}`);
        });
      });

      panel.querySelector("#newtonResetBtn")?.addEventListener("click", () => {
        if (SIM.currentExpId !== "newton-rings") return;
        resetNewtonNonIdealParameters();
      });
    }

    return panel;
  }

  function clampNewtonParameter(key, value) {
    if (!Number.isFinite(value)) return 0;
    if (key === "centerGapNm") return clamp(value, 0, 1500);
    if (key === "tiltUrad") return clamp(value, -240, 240);
    if (key === "defectXmm" || key === "defectYmm") return clamp(value, -3.5, 3.5);
    if (key === "defectRadiusMm") return clamp(value, 0, 1.8);
    if (key === "defectDepthNm") return clamp(value, -320, 320);
    return value;
  }

  function formatNewtonNumberInputValue(key, value) {
    if (!Number.isFinite(value)) return "";
    if (key === "centerGapNm" || key === "tiltUrad" || key === "defectDepthNm") {
      return value.toFixed(0);
    }
    if (key === "defectXmm" || key === "defectYmm" || key === "defectRadiusMm") {
      return value.toFixed(2);
    }
    return String(value);
  }

  function updateNewtonParameter(key, nextValue, options = {}) {
    const p = SIM.params["newton-rings"];
    if (!(key in p)) return;
    const { preview = false, deferDraw = false } = options;
    const clampedValue = clampNewtonParameter(key, nextValue);
    const delta = clampedValue - Number(p[key] || 0);
    p[key] = clampedValue;
    SIM.renderCache.newton.quality = preview ? "preview" : "full";
    if (Math.abs(delta) > 1e-9) {
      markControlAction("newton-rings", key, delta);
    }
    updateSimulationPanelUI();
    if (SIM.isOpen) {
      return clampedValue;
    }
    if (deferDraw) {
      scheduleSimulationDraw();
    } else {
      drawCurrentSimulation();
    }
    return clampedValue;
  }

  function normalizeNewtonActualMeasurement(key, rawValue) {
    const text = String(rawValue ?? "").trim();
    if (!text) return null;
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value)) return null;
    if (key === "actualCenterGapNm") return clamp(value, 0, 5000);
    if (key === "actualCenterIntensityPct") return clamp(value, 0, 100);
    return value;
  }

  function computeNewtonPercentDifference(simValue, actualValue) {
    if (!Number.isFinite(simValue) || !Number.isFinite(actualValue) || Math.abs(actualValue) < 1e-9) {
      return null;
    }
    return (Math.abs(simValue - actualValue) / Math.abs(actualValue)) * 100;
  }

  function computeNewtonComparisonMetrics(p) {
    const simCenterGapNm = Math.max(0, Number(p.centerGapNm) || 0);
    const simCenterIntensityPct = computeNewtonCenterIntensity(p) * 100;
    const actualCenterGapNm = normalizeNewtonActualMeasurement("actualCenterGapNm", p.actualCenterGapNm);
    const actualCenterIntensityPct = normalizeNewtonActualMeasurement("actualCenterIntensityPct", p.actualCenterIntensityPct);
    const gapDiffNm = Number.isFinite(actualCenterGapNm) ? simCenterGapNm - actualCenterGapNm : null;
    const intensityDiffPct = Number.isFinite(actualCenterIntensityPct)
      ? simCenterIntensityPct - actualCenterIntensityPct
      : null;
    return {
      simCenterGapNm,
      simCenterIntensityPct,
      actualCenterGapNm,
      actualCenterIntensityPct,
      gapDiffNm,
      intensityDiffPct,
      gapPercentDiff: computeNewtonPercentDifference(simCenterGapNm, actualCenterGapNm),
      intensityPercentDiff: computeNewtonPercentDifference(simCenterIntensityPct, actualCenterIntensityPct),
      hasActualGap: Number.isFinite(actualCenterGapNm),
      hasActualIntensity: Number.isFinite(actualCenterIntensityPct),
      hasActualData: Number.isFinite(actualCenterGapNm) || Number.isFinite(actualCenterIntensityPct),
    };
  }

  function formatNewtonSignedValue(value, digits = 1, unit = "") {
    if (!Number.isFinite(value)) return "--";
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(digits)}${unit}`;
  }

  function formatNewtonPercent(value) {
    return Number.isFinite(value) ? `${value.toFixed(1)}%` : "--";
  }

  function formatNewtonRecordedAt(value) {
    const time = Date.parse(value || "");
    if (!Number.isFinite(time)) return "刚刚";
    return new Date(time).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatNewtonRecordNumber(value, digits = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(digits) : "--";
  }

  function updateNewtonActualMeasurement(key, rawValue) {
    const p = SIM.params["newton-rings"];
    if (!(key in p)) return;
    p[key] = normalizeNewtonActualMeasurement(key, rawValue);
    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function resetNewtonNonIdealParameters() {
    const p = SIM.params["newton-rings"];
    p.centerGapNm = 0;
    p.tiltUrad = 0;
    p.defectXmm = 0;
    p.defectYmm = 0;
    p.defectRadiusMm = 0;
    p.defectDepthNm = 0;
    SIM.lastControlAction = {
      expId: "newton-rings",
      key: "idealReset",
      direction: 0,
    };
    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function buildNewtonMeasurementSnapshot(p) {
    const comparison = computeNewtonComparisonMetrics(p);
    return {
      recordedAt: new Date().toISOString(),
      lambdaNm: p.lambdaNm,
      curvatureMm: p.curvatureMm,
      simCenterGapNm: comparison.simCenterGapNm,
      actualCenterGapNm: comparison.actualCenterGapNm,
      gapDiffNm: comparison.gapDiffNm,
      gapPercentDiff: comparison.gapPercentDiff,
      simCenterIntensityPct: comparison.simCenterIntensityPct,
      actualCenterIntensityPct: comparison.actualCenterIntensityPct,
      intensityDiffPct: comparison.intensityDiffPct,
      intensityPercentDiff: comparison.intensityPercentDiff,
      tiltUrad: p.tiltUrad,
      defectXmm: p.defectXmm,
      defectYmm: p.defectYmm,
      defectRadiusMm: p.defectRadiusMm,
      defectDepthNm: p.defectDepthNm,
      visibleRingCount: estimateNewtonVisibleRingCount(p.lambdaNm, p.curvatureMm, p.centerGapNm),
      comparisonNote: comparison.hasActualData
        ? "百分差按 |仿真-实测| / |实测| × 100% 计算"
        : "当前仅保存仿真数据，尚未录入实测值",
    };
  }

  function recordNewtonMeasurement() {
    const p = SIM.params["newton-rings"];
    const record = buildNewtonMeasurementSnapshot(p);
    if (!Array.isArray(p.measurementRecords)) {
      p.measurementRecords = [];
    }
    p.measurementRecords.push(record);
    if (p.measurementRecords.length > 36) {
      p.measurementRecords = p.measurementRecords.slice(-36);
    }
    syncNewtonPanelFromState();
    showToast(
      record.comparisonNote.includes("尚未录入")
        ? "已记录当前仿真数据；如需百分差，请先补入实测值。"
        : "已记录当前测量点，可继续保存为 CSV。"
    );
  }

  function clearNewtonMeasurementRecords() {
    const p = SIM.params["newton-rings"];
    p.measurementRecords = [];
    syncNewtonPanelFromState();
    showToast("已清空牛顿环仿真数据记录表。");
  }

  function renderNewtonMeasurementRecords(panel) {
    const p = SIM.params["newton-rings"];
    const records = Array.isArray(p.measurementRecords) ? p.measurementRecords : [];
    const body = panel?.querySelector("#newtonRecordTableBody");
    const meta = panel?.querySelector("#newtonRecordMeta");
    const clearBtn = panel?.querySelector("#newtonClearRecordsBtn");
    const saveBtn = panel?.querySelector("#newtonSaveRecordsBtn");
    if (!body) return;

    if (meta) {
      meta.textContent = records.length
        ? `已记录 ${records.length} 组仿真数据，可继续改变参数并追加记录。`
        : "点击“记录当前数据”后，将把上方仿真参数写入表格。";
    }
    if (clearBtn) clearBtn.disabled = records.length === 0;
    if (saveBtn) saveBtn.disabled = records.length === 0;

    if (!records.length) {
      body.innerHTML = `
        <tr>
          <td colspan="11" class="newton-record-empty">暂无记录</td>
        </tr>
      `;
      return;
    }

    body.innerHTML = records.map((record, index) => {
      const defectCenter = `(${formatNewtonSignedValue(Number(record.defectXmm), 2)}, ${formatNewtonSignedValue(Number(record.defectYmm), 2)})`;
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(formatNewtonRecordedAt(record.recordedAt))}</td>
          <td>${escapeHtml(formatNewtonRecordNumber(record.lambdaNm, 1))}</td>
          <td>${escapeHtml(formatNewtonRecordNumber(record.curvatureMm, 0))}</td>
          <td>${escapeHtml(formatNewtonRecordNumber(record.simCenterGapNm, 1))}</td>
          <td>${escapeHtml(formatNewtonRecordNumber(record.simCenterIntensityPct, 2))}</td>
          <td>${escapeHtml(formatNewtonRecordNumber(record.tiltUrad, 1))}</td>
          <td>${escapeHtml(defectCenter)}</td>
          <td>${escapeHtml(formatNewtonRecordNumber(record.defectRadiusMm, 2))}</td>
          <td>${escapeHtml(formatNewtonRecordNumber(record.defectDepthNm, 1))}</td>
          <td>${escapeHtml(String(record.visibleRingCount ?? "--"))}</td>
        </tr>
      `;
    }).join("");
  }

  async function saveNewtonMeasurementData() {
    const p = SIM.params["newton-rings"];
    const records = Array.isArray(p.measurementRecords) && p.measurementRecords.length
      ? p.measurementRecords
      : [buildNewtonMeasurementSnapshot(p)];
    const headers = [
      "记录时间",
      "波长_nm",
      "曲率半径_mm",
      "仿真中心空气隙_nm",
      "实测中心空气隙_nm",
      "中心空气隙差值_仿真减实测_nm",
      "中心空气隙百分差",
      "仿真中心光强_pct",
      "实测中心光强_pct",
      "中心光强差值_仿真减实测_pct",
      "中心光强百分差",
      "倾斜角_urad",
      "缺陷X_mm",
      "缺陷Y_mm",
      "缺陷尺度_mm",
      "缺陷附加隙厚_nm",
      "可见环数估计",
      "说明",
    ];
    const csvCell = (value) => {
      if (value === null || value === undefined || value === "") return "";
      const text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    };
    const lines = records.map((record) => [
      formatNewtonRecordedAt(record.recordedAt),
      record.lambdaNm.toFixed(1),
      record.curvatureMm.toFixed(0),
      record.simCenterGapNm.toFixed(1),
      Number.isFinite(record.actualCenterGapNm) ? record.actualCenterGapNm.toFixed(1) : "",
      Number.isFinite(record.gapDiffNm) ? record.gapDiffNm.toFixed(1) : "",
      Number.isFinite(record.gapPercentDiff) ? record.gapPercentDiff.toFixed(2) : "",
      record.simCenterIntensityPct.toFixed(2),
      Number.isFinite(record.actualCenterIntensityPct) ? record.actualCenterIntensityPct.toFixed(2) : "",
      Number.isFinite(record.intensityDiffPct) ? record.intensityDiffPct.toFixed(2) : "",
      Number.isFinite(record.intensityPercentDiff) ? record.intensityPercentDiff.toFixed(2) : "",
      record.tiltUrad.toFixed(1),
      record.defectXmm.toFixed(2),
      record.defectYmm.toFixed(2),
      record.defectRadiusMm.toFixed(2),
      record.defectDepthNm.toFixed(1),
      String(record.visibleRingCount),
      record.comparisonNote,
    ]);
    const csv = `\uFEFF${[headers, ...lines].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await saveBlobWithShareFallback(blob, `newton-rings-measurements-${timestamp}.csv`, {
      shareTitle: "牛顿环测量数据",
      shareText: "牛顿环仿真与实测对比数据",
      shareSuccessToast: "已调起系统分享面板，可直接保存或发送测量数据。",
      downloadToast: `已开始保存测量数据：newton-rings-measurements-${timestamp}.csv`,
    });
  }

  function syncNewtonPanelFromState() {
    const p = SIM.params["newton-rings"];
    const panel = ensureNewtonControlPanel();
    if (!panel) return;

    const centerIntensity = computeNewtonCenterIntensity(p);
    const defectEnabled = p.defectRadiusMm > 0.01 && Math.abs(p.defectDepthNm) > 0.1;
    const comparison = computeNewtonComparisonMetrics(p);

    const bindValue = (inputId, valueId, value, formatter) => {
      const input = panel.querySelector(`#${inputId}`);
      const display = panel.querySelector(`#${valueId}`);
      if (input) input.value = String(value);
      if (display) display.textContent = formatter(value);
    };

    const syncNumberInput = (inputId, key, value) => {
      const input = panel.querySelector(`#${inputId}`);
      if (input && document.activeElement !== input) {
        input.value = formatNewtonNumberInputValue(key, value);
      }
    };

    bindValue("newtonCenterGapRange", "newtonCenterGapValue", p.centerGapNm, (value) => `${value.toFixed(0)} nm`);
    syncNumberInput("newtonCenterGapNumber", "centerGapNm", p.centerGapNm);
    bindValue("newtonTiltRange", "newtonTiltValue", p.tiltUrad, (value) => `${value >= 0 ? "+" : ""}${value.toFixed(0)} μrad`);
    syncNumberInput("newtonTiltNumber", "tiltUrad", p.tiltUrad);
    bindValue("newtonDefectXRange", "newtonDefectXValue", p.defectXmm, (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)} mm`);
    syncNumberInput("newtonDefectXNumber", "defectXmm", p.defectXmm);
    bindValue("newtonDefectYRange", "newtonDefectYValue", p.defectYmm, (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)} mm`);
    syncNumberInput("newtonDefectYNumber", "defectYmm", p.defectYmm);
    bindValue("newtonDefectRadiusRange", "newtonDefectRadiusValue", p.defectRadiusMm, (value) => `${value.toFixed(2)} mm`);
    syncNumberInput("newtonDefectRadiusNumber", "defectRadiusMm", p.defectRadiusMm);
    bindValue("newtonDefectDepthRange", "newtonDefectDepthValue", p.defectDepthNm, (value) => `${value >= 0 ? "+" : ""}${value.toFixed(0)} nm`);
    syncNumberInput("newtonDefectDepthNumber", "defectDepthNm", p.defectDepthNm);

    const hint = panel.querySelector("#newtonPanelHint");
    if (hint) {
      hint.textContent = defectEnabled
        ? "当前已引入局部厚度缺陷，圆环会在缺陷附近出现局部扭曲。"
        : "当前未加入局部缺陷，可优先比较中心空气隙与倾斜对条纹的整体影响。";
    }

    const summary = panel.querySelector("#newtonPanelSummary");
    if (summary) {
      const defectText = defectEnabled
        ? `缺陷中心位于 (${p.defectXmm >= 0 ? "+" : ""}${p.defectXmm.toFixed(2)}, ${p.defectYmm >= 0 ? "+" : ""}${p.defectYmm.toFixed(2)}) mm，尺度 ${p.defectRadiusMm.toFixed(2)} mm。`
        : "当前未启用局部缺陷。";
      summary.textContent = `当前仿真：中心空气隙 h₀=${p.centerGapNm.toFixed(0)} nm，中心归一化光强约 ${(centerIntensity * 100).toFixed(1)}%。${defectText}`;
    }

    renderNewtonMeasurementRecords(panel);
    renderNewtonChartPanel();
  }

  async function exportNewtonSimulationImage() {
    if (!els.simulationCanvas || SIM.currentExpId !== "newton-rings") {
      throw new Error("当前未处于牛顿环仿真界面");
    }

    const sourceCanvas = els.simulationCanvas;
    const dpr = sourceCanvas.width / Math.max(1, SIM.canvasCssW);
    const cropCssSize = Math.min(SIM.canvasCssW, SIM.canvasCssH) * 0.91;
    const cropCssX = (SIM.canvasCssW - cropCssSize) * 0.5;
    const cropCssY = (SIM.canvasCssH - cropCssSize) * 0.5;
    const cropPxSize = Math.max(1, Math.round(cropCssSize * dpr));
    const cropPxX = Math.round(cropCssX * dpr);
    const cropPxY = Math.round(cropCssY * dpr);

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cropPxSize;
    exportCanvas.height = cropPxSize;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) {
      throw new Error("无法创建导出画布");
    }

    exportCtx.clearRect(0, 0, cropPxSize, cropPxSize);
    exportCtx.save();
    exportCtx.beginPath();
    exportCtx.arc(cropPxSize * 0.5, cropPxSize * 0.5, cropPxSize * 0.5, 0, TWO_PI);
    exportCtx.clip();
    exportCtx.drawImage(
      sourceCanvas,
      cropPxX,
      cropPxY,
      cropPxSize,
      cropPxSize,
      0,
      0,
      cropPxSize,
      cropPxSize,
    );
    exportCtx.restore();

    const blob = await new Promise((resolve) => exportCanvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error("浏览器未返回可用图像数据");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await saveBlobWithShareFallback(blob, `newton-rings-${timestamp}.png`, {
      shareTitle: "牛顿环仿真导出图像",
      shareText: "牛顿环仿真图像与中心空气隙-中心光强曲线",
      shareSuccessToast: "已调起系统分享面板，可直接保存或发送图像。",
      downloadToast: `已开始下载到本地：newton-rings-${timestamp}.png`,
      preferDownload: true,
    });
  }

  async function exportNewtonChartImage() {
    if (SIM.currentExpId !== "newton-rings") {
      throw new Error("当前未处于牛顿环仿真界面");
    }

    const panel = ensureNewtonControlPanel();
    const chartCanvas = panel?.querySelector("#newtonChartCanvas");
    if (!(chartCanvas instanceof HTMLCanvasElement)) {
      throw new Error("未找到可导出的曲线画布");
    }

    renderNewtonChartPanel();

    const blob = await new Promise((resolve) => chartCanvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error("浏览器未返回可用图像数据");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await saveBlobWithShareFallback(blob, `newton-rings-chart-${timestamp}.png`, {
      shareTitle: "牛顿环曲线导出图像",
      shareText: "牛顿环中心空气隙与中心光强关系曲线",
      shareSuccessToast: "已调起系统分享面板，可直接保存或发送曲线图像。",
      downloadToast: `已开始下载到本地：newton-rings-chart-${timestamp}.png`,
      preferDownload: true,
    });
  }

  function formatExportTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  function sanitizeFilenamePart(value) {
    return String(value || "experiment")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "experiment";
  }

  function dataUrlToBlob(dataUrl, fallbackMime = "image/png") {
    const text = String(dataUrl || "");
    const match = text.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
    const mime = match?.[1] || fallbackMime;
    const payload = match ? match[3] : text;
    const binary = match?.[2] ? atob(payload) : atob(payload.replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  }

  async function runWithBusyButton(button, busyText, task) {
    const label = button?.querySelector?.("span");
    const originalText = label?.textContent || "";
    const wasDisabled = Boolean(button?.disabled);
    if (button) {
      button.disabled = true;
      button.classList.add("is-busy");
    }
    if (label && busyText) {
      label.textContent = busyText;
    }

    try {
      return await task();
    } finally {
      if (button) {
        button.disabled = wasDisabled;
        button.classList.remove("is-busy");
      }
      if (label) {
        label.textContent = originalText;
      }
    }
  }

  async function saveBlobWithShareFallback(blob, filename, options = {}) {
    const {
      shareTitle = "牛顿环导出文件",
      shareText = "牛顿环实验导出内容",
      shareSuccessToast = "已调起系统分享面板，可直接保存文件。",
      downloadToast = `已开始导出文件：${filename}`,
      preferDownload = false,
    } = options;
    const supportsShare = typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof File === "function";
    if (!preferDownload && supportsShare) {
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: shareText,
          });
          showToast(shareSuccessToast);
          return;
        } catch (error) {
          if (String(error?.name || "") !== "AbortError") {
            console.warn("navigator.share failed, fallback to download", error);
          } else {
            return;
          }
        }
      }
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1600);
    showToast(downloadToast);
  }

  function ensureWheatstoneControlPanel() {
    const controlsRoot = els.simulationModal?.querySelector(".simulation-controls");
    if (!controlsRoot) return null;

    let panel = document.getElementById("wheatstoneControlPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "wheatstoneControlPanel";
      panel.className = "control-row hidden";
      panel.innerHTML = `
        <div class="control-head">
          <label for="wheatRatioSelect">Ratio Arm R1/R2</label>
          <span id="wheatRsTotal">Rs = 2450 Ω</span>
        </div>
        <select id="wheatRatioSelect" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);background:rgba(9,16,30,0.72);color:#e8f3ff;outline:none;">
          <option value="0.01">0.01</option>
          <option value="0.1">0.1</option>
          <option value="1" selected>1</option>
          <option value="10">10</option>
          <option value="100">100</option>
        </select>
        <div style="margin-top:10px;border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:10px;background:rgba(7,13,25,0.62);">
          <div style="font-size:12px;color:rgba(214,232,255,0.82);margin-bottom:8px;">Rs 十进电阻箱（1000/100/10/1 Ω）</div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×1000 Ω
              <input id="wheatDigit1000" type="number" min="0" max="9" step="1" value="2" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×100 Ω
              <input id="wheatDigit100" type="number" min="0" max="9" step="1" value="4" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×10 Ω
              <input id="wheatDigit10" type="number" min="0" max="9" step="1" value="5" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:11px;color:rgba(214,232,255,0.8);">×1 Ω
              <input id="wheatDigit1" type="number" min="0" max="9" step="1" value="0" style="padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(15,24,44,0.7);color:#e8f3ff;" />
            </label>
          </div>
          <div id="wheatBalanceHint" style="margin-top:8px;font-size:12px;color:rgba(214,232,255,0.82);">按住开关 K 观察检流计偏转。</div>
        </div>
        <button id="wheatSwitchBtn" type="button" style="margin-top:10px;width:100%;padding:9px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.07);color:#e8f3ff;">按住以闭合开关 K</button>
      `;

      const metrics = controlsRoot.querySelector(".sim-metrics");
      if (metrics) controlsRoot.insertBefore(panel, metrics);
      else controlsRoot.appendChild(panel);

      const ratioSelect = panel.querySelector("#wheatRatioSelect");
      const digitInputs = [panel.querySelector("#wheatDigit1000"), panel.querySelector("#wheatDigit100"), panel.querySelector("#wheatDigit10"), panel.querySelector("#wheatDigit1")];
      const switchBtn = panel.querySelector("#wheatSwitchBtn");

      ratioSelect?.addEventListener("change", () => {
        if (SIM.currentExpId !== "wheatstone-bridge") return;
        const p = SIM.params["wheatstone-bridge"];
        const old = p.ratio;
        p.ratio = Number.parseFloat(ratioSelect.value) || 1;
        markControlAction("wheatstone-bridge", "ratio", p.ratio - old);
        updateWheatstoneBridgeState(1 / 60);
        updateSimulationPanelUI();
        drawCurrentSimulation();
      });

      digitInputs.forEach((input) => {
        input?.addEventListener("input", () => {
          if (SIM.currentExpId !== "wheatstone-bridge") return;
          updateWheatstoneFromPanel();
        });
      });

      const releaseSwitch = () => setWheatstoneSwitchPressed(false);
      switchBtn?.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        setWheatstoneSwitchPressed(true);
      });
      switchBtn?.addEventListener("pointerup", releaseSwitch);
      switchBtn?.addEventListener("pointerleave", releaseSwitch);
      switchBtn?.addEventListener("pointercancel", releaseSwitch);
      switchBtn?.addEventListener("blur", releaseSwitch);
    }

    return panel;
  }

  function randomWheatstoneUnknownRx() {
    const base = 300 + Math.random() * 5200;
    return Math.round(base / 5) * 5;
  }

  function normalizeWheatstoneDigit(value) {
    if (!Number.isFinite(value)) return 0;
    return clamp(Math.round(value), 0, 9);
  }

  function computeWheatstoneRsFromDigits(digits) {
    return normalizeWheatstoneDigit(digits.d1000) * 1000 + normalizeWheatstoneDigit(digits.d100) * 100 + normalizeWheatstoneDigit(digits.d10) * 10 + normalizeWheatstoneDigit(digits.d1);
  }

  function updateWheatstoneFromPanel() {
    const panel = ensureWheatstoneControlPanel();
    if (!panel) return;

    const p = SIM.params["wheatstone-bridge"];
    const oldRs = p.rsOhm;

    const d1000Input = panel.querySelector("#wheatDigit1000");
    const d100Input = panel.querySelector("#wheatDigit100");
    const d10Input = panel.querySelector("#wheatDigit10");
    const d1Input = panel.querySelector("#wheatDigit1");

    p.rsDigits.d1000 = normalizeWheatstoneDigit(Number.parseFloat(d1000Input?.value));
    p.rsDigits.d100 = normalizeWheatstoneDigit(Number.parseFloat(d100Input?.value));
    p.rsDigits.d10 = normalizeWheatstoneDigit(Number.parseFloat(d10Input?.value));
    p.rsDigits.d1 = normalizeWheatstoneDigit(Number.parseFloat(d1Input?.value));

    p.rsOhm = computeWheatstoneRsFromDigits(p.rsDigits);
    markControlAction("wheatstone-bridge", "rsOhm", p.rsOhm - oldRs);

    updateWheatstoneBridgeState(1 / 60);
    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function setWheatstoneSwitchPressed(pressed) {
    const p = SIM.params["wheatstone-bridge"];
    p.switchPressed = Boolean(pressed);

    const panel = ensureWheatstoneControlPanel();
    const btn = panel?.querySelector("#wheatSwitchBtn");
    if (btn) {
      if (p.switchPressed) {
        btn.textContent = "松开以断开开关 K";
        btn.style.background = "rgba(26,124,84,0.42)";
        btn.style.borderColor = "rgba(124,255,198,0.45)";
      } else {
        btn.textContent = "按住以闭合开关 K";
        btn.style.background = "rgba(255,255,255,0.07)";
        btn.style.borderColor = "rgba(255,255,255,0.22)";
      }
    }

    updateWheatstoneBridgeState(1 / 60);
    updateSimulationPanelUI();
    drawCurrentSimulation();
  }

  function computeWheatstoneBridgeState(p) {
    const ratio = Math.max(0.01, Number(p.ratio) || 1);
    const r2 = 1000;
    const r1 = ratio * r2;
    const rs = Math.max(1, Number(p.rsOhm) || 1);
    const rx = Math.max(1, Number(p.rxOhm) || 1);
    const sourceV = Math.max(0.1, Number(p.supplyV) || 3);

    const vLeft = sourceV * (r2 / (r1 + r2));
    const vRight = sourceV * (rs / (rx + rs));
    const deltaV = vRight - vLeft;

    const imbalance = r1 * rs - r2 * rx;
    const balanceRs = (r2 / r1) * rx;
    return { ratio, rs, rx, deltaV, imbalance, balanceRs };
  }

  function updateWheatstoneBridgeState(dt) {
    const p = SIM.params["wheatstone-bridge"];
    p.rsOhm = computeWheatstoneRsFromDigits(p.rsDigits);
    const calc = computeWheatstoneBridgeState(p);
    p.deltaV = calc.deltaV;

    const maxNeedle = p.galvanometerMaxDeg;
    const gain = p.galvanometerGainDegPerV;
    p.targetNeedleDeg = p.switchPressed ? clamp(calc.deltaV * gain, -maxNeedle, maxNeedle) : 0;

    const smooth = clamp((dt || 1 / 60) * 11, 0.08, 0.3);
    p.needleAngleDeg += (p.targetNeedleDeg - p.needleAngleDeg) * smooth;

    syncWheatstonePanelFromState();
  }

  function estimateWheatstoneGridDeflection(angleDeg, maxDeg) {
    const unit = Math.max(1, maxDeg / 10);
    return Math.round(Math.abs(angleDeg) / unit);
  }

  function wheatstoneDeflectionText(angleDeg) {
    if (Math.abs(angleDeg) < 1.2) return "接近零位";
    return angleDeg > 0 ? "向右" : "向左";
  }

  function syncWheatstonePanelFromState() {
    const p = SIM.params["wheatstone-bridge"];
    const panel = ensureWheatstoneControlPanel();
    if (!panel) return;

    const ratioSelect = panel.querySelector("#wheatRatioSelect");
    if (ratioSelect) ratioSelect.value = String(p.ratio);

    const rsTotal = panel.querySelector("#wheatRsTotal");
    if (rsTotal) rsTotal.textContent = `Rs = ${p.rsOhm.toFixed(0)} Ω`;

    const hint = panel.querySelector("#wheatBalanceHint");
    const calc = computeWheatstoneBridgeState(p);
    const isNearBalance = Math.abs(calc.deltaV) < 0.0015;
    const deflect = wheatstoneDeflectionText(p.needleAngleDeg);
    const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);

    if (hint) {
      if (!p.switchPressed) hint.textContent = "按住开关 K 观察检流计。";
      else if (isNearBalance) hint.textContent = "电桥已经接近平衡。";
      else hint.textContent = `指针${deflect} ${grids} 格，请微调 Rs。`;
    }
  }

  function drawWheatstoneResistor(x1, y1, x2, y2, label, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length < 1) return;

    const angle = Math.atan2(dy, dx);
    const lead = Math.min(20, length * 0.18);
    const bodyLen = Math.max(12, length - 2 * lead);
    const steps = 8;
    const amp = 5;

    simCtx.save();
    simCtx.translate(x1, y1);
    simCtx.rotate(angle);

    simCtx.strokeStyle = color;
    simCtx.lineWidth = 2;
    simCtx.beginPath();
    simCtx.moveTo(0, 0);
    simCtx.lineTo(lead, 0);
    for (let i = 0; i <= steps; i += 1) {
      const x = lead + (bodyLen / steps) * i;
      const y = i === 0 || i === steps ? 0 : i % 2 === 0 ? -amp : amp;
      simCtx.lineTo(x, y);
    }
    simCtx.lineTo(lead + bodyLen + lead, 0);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(230,241,255,0.9)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.textAlign = "center";
    simCtx.textBaseline = "bottom";
    simCtx.fillText(label, lead + bodyLen * 0.5, -10);
    simCtx.restore();
  }

  function drawWheatstoneBridge() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["wheatstone-bridge"];
    const calc = computeWheatstoneBridgeState(p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(8, 16, 32, 1)");
    bg.addColorStop(1, "rgba(6, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const cx = w * 0.36;
    const cy = h * 0.52;
    const rx = Math.min(w * 0.22, h * 0.28);
    const ry = Math.min(w * 0.15, h * 0.22);
    const top = { x: cx, y: cy - ry };
    const left = { x: cx - rx, y: cy };
    const right = { x: cx + rx, y: cy };
    const bottom = { x: cx, y: cy + ry };

    drawWheatstoneResistor(top.x, top.y, left.x, left.y, `R1=${(calc.ratio * 1000).toFixed(0)}Ω`, "rgba(112,226,255,0.92)");
    drawWheatstoneResistor(left.x, left.y, bottom.x, bottom.y, "R2=1000Ω", "rgba(112,226,255,0.92)");
    drawWheatstoneResistor(top.x, top.y, right.x, right.y, "Rx=?", "rgba(252,186,120,0.92)");
    drawWheatstoneResistor(right.x, right.y, bottom.x, bottom.y, `Rs=${calc.rs.toFixed(0)}Ω`, "rgba(252,186,120,0.92)");

    const kx = (left.x + right.x) * 0.5;
    simCtx.strokeStyle = "rgba(120, 208, 255, 0.88)";
    simCtx.lineWidth = 2.2;
    simCtx.beginPath();
    simCtx.moveTo(left.x, left.y);
    simCtx.lineTo(kx - 18, cy);
    simCtx.moveTo(kx + 18, cy);
    simCtx.lineTo(right.x, right.y);
    simCtx.stroke();

    if (p.switchPressed) {
      simCtx.strokeStyle = "rgba(130,255,192,0.95)";
      simCtx.lineWidth = 2.4;
      simCtx.beginPath();
      simCtx.moveTo(kx - 18, cy);
      simCtx.lineTo(kx + 18, cy);
      simCtx.stroke();
    } else {
      simCtx.strokeStyle = "rgba(255,210,154,0.9)";
      simCtx.lineWidth = 2.2;
      simCtx.beginPath();
      simCtx.moveTo(kx - 18, cy);
      simCtx.lineTo(kx + 14, cy - 12);
      simCtx.stroke();
    }

    const meterX = w * 0.78;
    const meterY = h * 0.54;
    const meterR = Math.min(w, h) * 0.19;

    simCtx.fillStyle = "rgba(12, 22, 40, 0.9)";
    roundRect(simCtx, meterX - meterR - 18, meterY - meterR - 24, meterR * 2 + 36, meterR * 1.45 + 36, 16);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(220, 236, 255, 0.35)";
    simCtx.lineWidth = 1.5;
    simCtx.beginPath();
    simCtx.arc(meterX, meterY, meterR, degToRad(210), degToRad(-30), false);
    simCtx.stroke();

    const normalized = clamp(p.needleAngleDeg / Math.max(1, p.galvanometerMaxDeg), -1, 1);
    const pointerDeg = 90 - normalized * 120;
    const needleTip = polarPoint(meterX, meterY, meterR * 0.78, pointerDeg);

    simCtx.strokeStyle = "rgba(255, 92, 92, 0.95)";
    simCtx.lineWidth = 2.8;
    simCtx.beginPath();
    simCtx.moveTo(meterX, meterY);
    simCtx.lineTo(needleTip.x, needleTip.y);
    simCtx.stroke();

    const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);
    const deflectText = p.switchPressed ? `${wheatstoneDeflectionText(p.needleAngleDeg)} ${grids} 格` : "开路";
    els.simReadout.textContent = `R1/R2=${calc.ratio.toFixed(2)} · Rs=${calc.rs.toFixed(0)}Ω · dV=${(calc.deltaV * 1000).toFixed(2)}mV · ${deflectText}`;
  }
  function ensureTorsionControlPanel() {
    const controlsRoot = els.simulationModal?.querySelector(".simulation-controls");
    if (!controlsRoot) return null;

    let panel = document.getElementById("torsionControlPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "torsionControlPanel";
      panel.className = "control-row hidden";
      panel.innerHTML = `
        <div class="control-head">
          <label for="torsionObjectSelect">实验对象</label>
          <span id="torsionCycleHint">周期 T：-- s</span>
        </div>
        <select id="torsionObjectSelect" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);background:rgba(9,16,30,0.72);color:#e8f3ff;outline:none;">
          <option value="empty-disk">空载圆盘（测 T0）</option>
          <option value="standard-cylinder">标准圆柱体（测 T1）</option>
          <option value="unknown-cylinder">未知圆柱体（测 T2）</option>
        </select>
        <div style="margin-top:10px;border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:10px;background:rgba(7,13,25,0.62);">
          <div id="torsionStopwatchDisplay" style="font-size:30px;line-height:1.1;font-weight:700;letter-spacing:1px;text-align:center;color:#e8f3ff;">00.000 s</div>
          <div style="margin-top:10px;display:flex;gap:8px;">
            <button id="torsionTimerToggleBtn" type="button" style="flex:1;padding:8px 10px;border-radius:10px;border:1px solid rgba(112,226,255,0.35);background:rgba(22,86,128,0.35);color:#dff6ff;">开始计时</button>
            <button id="torsionTimerResetBtn" type="button" style="padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.06);color:#e8f3ff;">重置</button>
          </div>
          <div id="torsionTimerInfo" style="margin-top:8px;font-size:12px;color:rgba(214,232,255,0.82);">建议测量 10 个周期计时，以减小读数误差。</div>
        </div>
      `;

      const metrics = controlsRoot.querySelector(".sim-metrics");
      if (metrics) controlsRoot.insertBefore(panel, metrics);
      else controlsRoot.appendChild(panel);

      const objectSelect = panel.querySelector("#torsionObjectSelect");
      const toggleBtn = panel.querySelector("#torsionTimerToggleBtn");
      const resetBtn = panel.querySelector("#torsionTimerResetBtn");

      objectSelect?.addEventListener("change", () => {
        if (SIM.currentExpId !== "torsion-pendulum") return;
        const p = SIM.params["torsion-pendulum"];
        p.objectKey = objectSelect.value;
        p.currentThetaDeg = p.theta0Deg;
        p.prevThetaDeg = p.theta0Deg;
        p.simTimeSec = 0;
        p.isOscillating = true;
        resetTorsionStopwatch(true);
        updateSimulationPanelUI();
        drawCurrentSimulation();
      });

      toggleBtn?.addEventListener("click", () => {
        if (SIM.currentExpId !== "torsion-pendulum") return;
        toggleTorsionStopwatch();
      });

      resetBtn?.addEventListener("click", () => {
        if (SIM.currentExpId !== "torsion-pendulum") return;
        resetTorsionStopwatch(true);
        updateSimulationPanelUI();
      });
    }

    return panel;
  }

  function getGratingSourceProfile(p) {
    const sourceProfiles = p?.sourceProfiles || {};
    return sourceProfiles[p.sourceKey] || sourceProfiles.mercury || {
      label: "汞灯",
      linesNm: Array.isArray(p?.spectralLinesNm) ? p.spectralLinesNm : [404.7, 435.8, 546.1, 577.0],
    };
  }

  function ensureGratingControlPanel() {
    const controlsRoot = els.simulationModal?.querySelector(".simulation-controls");
    if (!controlsRoot) return null;

    let panel = document.getElementById("gratingControlPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "gratingControlPanel";
      panel.className = "control-row hidden";
      panel.innerHTML = `
        <div class="control-head">
          <label for="gratingSourceSelect">谱灯光源</label>
          <span id="gratingSourceHint">用于定性识别元素谱线</span>
        </div>
        <select id="gratingSourceSelect" style="width:100%;margin-top:6px;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,0.18);background:rgba(9,16,30,0.72);color:#e8f3ff;outline:none;">
          <option value="mercury">汞灯</option>
          <option value="hydrogen">氢灯</option>
          <option value="sodium">钠灯</option>
        </select>
        <div id="gratingLineLegend" style="margin-top:10px;border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:10px;background:rgba(7,13,25,0.62);font-size:12px;color:rgba(220,235,255,0.86);line-height:1.6;">
          当前谱线：--
        </div>
      `;

      const metrics = controlsRoot.querySelector(".sim-metrics");
      if (metrics) controlsRoot.insertBefore(panel, metrics);
      else controlsRoot.appendChild(panel);

      const sourceSelect = panel.querySelector("#gratingSourceSelect");
      sourceSelect?.addEventListener("change", () => {
        if (SIM.currentExpId !== "grating-spectrum") return;
        const p = SIM.params["grating-spectrum"];
        const nextKey = sourceSelect.value;
        if (!p.sourceProfiles?.[nextKey]) return;
        p.sourceKey = nextKey;
        p.spectralLinesNm = [...p.sourceProfiles[nextKey].linesNm];
        markControlAction("grating-spectrum", "sourceKey", 1);
        syncGratingPanelFromState();
        updateSimulationPanelUI();
        drawCurrentSimulation();
      });
    }

    return panel;
  }

  function syncGratingPanelFromState() {
    const p = SIM.params["grating-spectrum"];
    const panel = ensureGratingControlPanel();
    if (!panel) return;

    const profile = getGratingSourceProfile(p);
    const sourceSelect = panel.querySelector("#gratingSourceSelect");
    const hint = panel.querySelector("#gratingSourceHint");
    const legend = panel.querySelector("#gratingLineLegend");

    if (sourceSelect) sourceSelect.value = p.sourceKey;
    if (hint) hint.textContent = `当前光源：${profile.label}`;
    if (legend) {
      legend.innerHTML = profile.linesNm
        .map((lambdaNm) => {
          const color = wavelengthToRGB(lambdaNm);
          return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
            <span style="display:inline-flex;align-items:center;gap:8px;">
              <span style="width:10px;height:10px;border-radius:999px;background:rgb(${color.r}, ${color.g}, ${color.b});box-shadow:0 0 0 3px rgba(${color.r}, ${color.g}, ${color.b}, 0.16);"></span>
              <span>${escapeHtml(wavelengthBandName(lambdaNm))}</span>
            </span>
            <strong>${lambdaNm.toFixed(1)} nm</strong>
          </div>`;
        })
        .join("");
    }
  }

  function getTorsionObjectLabel(key) {
    if (key === "standard-cylinder") return "标准圆柱体";
    if (key === "unknown-cylinder") return "未知圆柱体";
    return "空载圆盘";
  }

  function getTorsionTotalInertia(p, key = p.objectKey) {
    return p.diskInertia + (p.objectInertia[key] || 0);
  }

  function getTorsionPeriodSec(p, key = p.objectKey) {
    const I = Math.max(getTorsionTotalInertia(p, key), 1e-6);
    return TWO_PI * Math.sqrt(I / Math.max(p.torsionK, 1e-6));
  }

  function formatStopwatchMs(ms) {
    return `${(ms / 1000).toFixed(3)} s`;
  }

  function getTorsionElapsedMs(p) {
    const st = p.stopwatch;
    if (!st.running) return st.elapsedMs;
    return st.elapsedMs + (performance.now() - st.startMs);
  }

  function releaseTorsionOscillation() {
    const p = SIM.params["torsion-pendulum"];
    p.simTimeSec = 0;
    p.currentThetaDeg = p.theta0Deg;
    p.prevThetaDeg = p.theta0Deg;
    p.isOscillating = true;
  }

  function toggleTorsionStopwatch() {
    const p = SIM.params["torsion-pendulum"];
    const st = p.stopwatch;

    if (st.running) {
      stopTorsionStopwatch(p, true);
      return;
    }

    if (!p.isOscillating) {
      releaseTorsionOscillation();
    }

    st.running = true;
    st.startMs = performance.now();
    st.elapsedMs = 0;
    st.cycleCount = 0;
    p.prevThetaDeg = p.currentThetaDeg;
    syncTorsionPanelFromState();
  }

  function stopTorsionStopwatch(p, saveRecord) {
    const st = p.stopwatch;
    if (!st.running) return;

    st.elapsedMs = getTorsionElapsedMs(p);
    st.running = false;
    st.startMs = 0;

    if (saveRecord && st.cycleCount > 0) {
      p.measurements[p.objectKey] = {
        elapsedMs: st.elapsedMs,
        cycles: st.cycleCount,
        periodSec: st.elapsedMs / 1000 / st.cycleCount,
      };
    }

    syncTorsionPanelFromState();
  }

  function resetTorsionStopwatch(keepRecords = true) {
    const p = SIM.params["torsion-pendulum"];
    const st = p.stopwatch;

    st.running = false;
    st.startMs = 0;
    st.elapsedMs = 0;
    st.cycleCount = 0;

    if (!keepRecords) {
      p.measurements["empty-disk"] = null;
      p.measurements["standard-cylinder"] = null;
      p.measurements["unknown-cylinder"] = null;
    }

    syncTorsionPanelFromState();
  }

  function syncTorsionPanelFromState() {
    const p = SIM.params["torsion-pendulum"];
    const panel = ensureTorsionControlPanel();
    if (!panel) return;

    const objectSelect = panel.querySelector("#torsionObjectSelect");
    const toggleBtn = panel.querySelector("#torsionTimerToggleBtn");
    const display = panel.querySelector("#torsionStopwatchDisplay");
    const info = panel.querySelector("#torsionTimerInfo");
    const cycleHint = panel.querySelector("#torsionCycleHint");

    if (objectSelect) objectSelect.value = p.objectKey;

    const elapsedMs = getTorsionElapsedMs(p);
    if (display) display.textContent = formatStopwatchMs(elapsedMs);

    if (toggleBtn) {
      toggleBtn.textContent = p.stopwatch.running ? "停止计时" : "开始计时";
      toggleBtn.style.background = p.stopwatch.running ? "rgba(164,52,52,0.35)" : "rgba(22,86,128,0.35)";
      toggleBtn.style.borderColor = p.stopwatch.running ? "rgba(255,160,160,0.38)" : "rgba(112,226,255,0.35)";
    }

    const m0 = p.measurements["empty-disk"]?.elapsedMs;
    const m1 = p.measurements["standard-cylinder"]?.elapsedMs;
    const m2 = p.measurements["unknown-cylinder"]?.elapsedMs;

    if (info) {
      const progress = p.stopwatch.running
        ? `计时中：${p.stopwatch.cycleCount}/${p.stopwatch.targetCycles} 周期`
        : "建议测量 10 个周期计时，以减小读数误差。";
      info.textContent = `${progress}  T0=${m0 ? formatStopwatchMs(m0) : "--"} · T1=${m1 ? formatStopwatchMs(m1) : "--"} · T2=${m2 ? formatStopwatchMs(m2) : "--"}`;
    }

    if (cycleHint) {
      const period = getTorsionPeriodSec(p);
      cycleHint.textContent = `周期 T：${period.toFixed(3)} s`;
    }
  }

  function updateTorsionPendulumState(dt) {
    const p = SIM.params["torsion-pendulum"];
    if (!p.isOscillating) {
      syncTorsionPanelFromState();
      return;
    }

    const period = getTorsionPeriodSec(p);
    const omega = TWO_PI / Math.max(period, 1e-6);

    p.simTimeSec += dt;
    const theta = p.theta0Deg * Math.exp(-p.damping * p.simTimeSec) * Math.cos(omega * p.simTimeSec);

    const prev = p.currentThetaDeg;
    p.prevThetaDeg = prev;
    p.currentThetaDeg = theta;

    const st = p.stopwatch;
    if (st.running) {
      if (prev < 0 && theta >= 0) {
        st.cycleCount += 1;
        if (st.cycleCount >= st.targetCycles) {
          stopTorsionStopwatch(p, true);
        }
      }
      syncTorsionPanelFromState();
    }
  }

  function drawTorsionPendulum() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["torsion-pendulum"];
    const cx = w * 0.5;
    const cy = h * 0.55;
    const diskR = Math.min(w, h) * 0.24;

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(11, 20, 40, 1)");
    bg.addColorStop(1, "rgba(5, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    simCtx.strokeStyle = "rgba(172, 200, 240, 0.18)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(cx, 18);
    simCtx.lineTo(cx, cy - diskR * 0.95);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(165, 205, 255, 0.16)";
    simCtx.beginPath();
    simCtx.arc(cx, 18, 8, 0, TWO_PI);
    simCtx.fill();

    simCtx.save();
    simCtx.translate(cx, cy);
    simCtx.scale(1, 0.82);

    const plateGrad = simCtx.createRadialGradient(0, -diskR * 0.2, diskR * 0.05, 0, 0, diskR);
    plateGrad.addColorStop(0, "rgba(198, 214, 238, 0.9)");
    plateGrad.addColorStop(0.45, "rgba(127, 152, 192, 0.92)");
    plateGrad.addColorStop(1, "rgba(58, 74, 98, 0.96)");
    simCtx.fillStyle = plateGrad;
    simCtx.beginPath();
    simCtx.arc(0, 0, diskR, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(229, 239, 255, 0.5)";
    simCtx.lineWidth = 1.2;
    simCtx.beginPath();
    simCtx.arc(0, 0, diskR, 0, TWO_PI);
    simCtx.stroke();

    drawTorsionObjectOverlay(diskR, p.objectKey);

    simCtx.restore();

    const thetaRad = degToRad(p.currentThetaDeg);
    const lineLen = diskR * 0.9;
    const x1 = cx - lineLen * Math.cos(thetaRad);
    const y1 = cy + lineLen * 0.82 * Math.sin(thetaRad);
    const x2 = cx + lineLen * Math.cos(thetaRad);
    const y2 = cy - lineLen * 0.82 * Math.sin(thetaRad);

    simCtx.strokeStyle = "rgba(255, 88, 88, 0.95)";
    simCtx.lineWidth = 3.2;
    simCtx.beginPath();
    simCtx.moveTo(x1, y1);
    simCtx.lineTo(x2, y2);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(255, 240, 240, 0.95)";
    simCtx.beginPath();
    simCtx.arc(cx, cy, 5, 0, TWO_PI);
    simCtx.fill();

    const T = getTorsionPeriodSec(p);
    const label = getTorsionObjectLabel(p.objectKey);
    els.simReadout.textContent = `对象=${label} · θ=${p.currentThetaDeg.toFixed(2)}° · T=${T.toFixed(3)} s · 10T≈${(10 * T).toFixed(3)} s`;

    syncTorsionPanelFromState();
  }

  function drawTorsionObjectOverlay(diskR, objectKey) {
    if (objectKey === "standard-cylinder") {
      const rg = simCtx.createRadialGradient(-diskR * 0.08, -diskR * 0.08, 2, 0, 0, diskR * 0.28);
      rg.addColorStop(0, "rgba(250, 250, 255, 0.96)");
      rg.addColorStop(1, "rgba(126, 139, 162, 0.95)");
      simCtx.fillStyle = rg;
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.24, 0, TWO_PI);
      simCtx.fill();
      simCtx.strokeStyle = "rgba(230, 238, 255, 0.65)";
      simCtx.lineWidth = 1;
      simCtx.stroke();
      return;
    }

    if (objectKey === "unknown-cylinder") {
      simCtx.fillStyle = "rgba(164, 182, 208, 0.92)";
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.26, 0, TWO_PI);
      simCtx.fill();
      simCtx.fillStyle = "rgba(58, 74, 98, 0.98)";
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.12, 0, TWO_PI);
      simCtx.fill();
      simCtx.strokeStyle = "rgba(230, 238, 255, 0.58)";
      simCtx.lineWidth = 1;
      simCtx.beginPath();
      simCtx.arc(0, 0, diskR * 0.26, 0, TWO_PI);
      simCtx.stroke();
      return;
    }

    simCtx.fillStyle = "rgba(210, 228, 255, 0.62)";
    simCtx.beginPath();
    simCtx.arc(0, 0, diskR * 0.08, 0, TWO_PI);
    simCtx.fill();
  }
  function drawSpectrometerPrism() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;

    const p = SIM.params["spectrometer-prism"];
    const A = clamp(p.prismAngleDeg, 50, 70);
    const theta = normalizeDeg(p.telescopeDeg);
    const { refl1Deg, refl2Deg, phiDeg } = computeSpectrometerReflections(A);

    simCtx.clearRect(0, 0, w, h);

    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(7, 16, 32, 1)");
    bg.addColorStop(1, "rgba(5, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const cx = w * 0.43;
    const cy = h * 0.53;
    const dialR = Math.min(w * 0.31, h * 0.43);

    const dialFill = simCtx.createRadialGradient(cx, cy, dialR * 0.08, cx, cy, dialR);
    dialFill.addColorStop(0, "rgba(22, 36, 66, 0.9)");
    dialFill.addColorStop(1, "rgba(10, 18, 34, 0.92)");
    simCtx.fillStyle = dialFill;
    simCtx.beginPath();
    simCtx.arc(cx, cy, dialR, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(168, 196, 240, 0.28)";
    simCtx.lineWidth = 1.4;
    simCtx.beginPath();
    simCtx.arc(cx, cy, dialR, 0, TWO_PI);
    simCtx.stroke();

    for (let deg = 0; deg < 360; deg += 5) {
      const major = deg % 30 === 0;
      const r0 = major ? dialR * 0.87 : dialR * 0.91;
      const r1 = dialR * 0.97;
      const p0 = polarPoint(cx, cy, r0, deg);
      const p1 = polarPoint(cx, cy, r1, deg);
      simCtx.strokeStyle = major ? "rgba(211, 226, 255, 0.6)" : "rgba(211, 226, 255, 0.28)";
      simCtx.lineWidth = major ? 1.2 : 0.8;
      simCtx.beginPath();
      simCtx.moveTo(p0.x, p0.y);
      simCtx.lineTo(p1.x, p1.y);
      simCtx.stroke();

      if (major) {
        const labelPos = polarPoint(cx, cy, dialR * 0.8, deg);
        simCtx.fillStyle = "rgba(230, 241, 255, 0.72)";
        simCtx.font = "11px 'Segoe UI', sans-serif";
        simCtx.textAlign = "center";
        simCtx.textBaseline = "middle";
        simCtx.fillText(String(deg), labelPos.x, labelPos.y);
      }
    }

    const apex = { x: cx - dialR * 0.23, y: cy };
    const sideLen = dialR * 0.56;
    const halfA = degToRad(A / 2);
    const upper = {
      x: apex.x + sideLen * Math.cos(halfA),
      y: apex.y - sideLen * Math.sin(halfA),
    };
    const lower = {
      x: apex.x + sideLen * Math.cos(halfA),
      y: apex.y + sideLen * Math.sin(halfA),
    };

    const prismFill = simCtx.createLinearGradient(apex.x, apex.y, upper.x, lower.y);
    prismFill.addColorStop(0, "rgba(90, 192, 255, 0.26)");
    prismFill.addColorStop(1, "rgba(72, 138, 244, 0.14)");
    simCtx.fillStyle = prismFill;
    simCtx.beginPath();
    simCtx.moveTo(apex.x, apex.y);
    simCtx.lineTo(upper.x, upper.y);
    simCtx.lineTo(lower.x, lower.y);
    simCtx.closePath();
    simCtx.fill();

    simCtx.strokeStyle = "rgba(165, 223, 255, 0.9)";
    simCtx.lineWidth = 1.35;
    simCtx.beginPath();
    simCtx.moveTo(apex.x, apex.y);
    simCtx.lineTo(upper.x, upper.y);
    simCtx.lineTo(lower.x, lower.y);
    simCtx.closePath();
    simCtx.stroke();

    const collimatorStartX = cx - dialR * 1.08;
    const collimatorEndX = apex.x - dialR * 0.05;
    simCtx.strokeStyle = "rgba(122, 235, 173, 0.42)";
    simCtx.lineWidth = 12;
    simCtx.lineCap = "round";
    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, cy);
    simCtx.lineTo(collimatorEndX, cy);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(160, 255, 196, 0.92)";
    simCtx.lineWidth = 2.2;
    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, cy);
    simCtx.lineTo(collimatorEndX, cy);
    simCtx.stroke();

    const hitUpper = {
      x: apex.x + (upper.x - apex.x) * 0.34,
      y: apex.y + (upper.y - apex.y) * 0.34,
    };
    const hitLower = {
      x: apex.x + (lower.x - apex.x) * 0.34,
      y: apex.y + (lower.y - apex.y) * 0.34,
    };

    simCtx.strokeStyle = "rgba(128, 247, 173, 0.9)";
    simCtx.lineWidth = 1.5;
    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, hitUpper.y);
    simCtx.lineTo(hitUpper.x, hitUpper.y);
    simCtx.stroke();

    simCtx.beginPath();
    simCtx.moveTo(collimatorStartX, hitLower.y);
    simCtx.lineTo(hitLower.x, hitLower.y);
    simCtx.stroke();

    const reflLen = dialR * 1.05;
    const reflAngles = [refl1Deg, refl2Deg];
    const hitPoints = [hitUpper, hitLower];

    reflAngles.forEach((deg, idx) => {
      const start = hitPoints[idx];
      const end = polarPoint(start.x, start.y, reflLen, deg);

      simCtx.strokeStyle = "rgba(243, 248, 255, 0.2)";
      simCtx.lineWidth = 5.2;
      simCtx.beginPath();
      simCtx.moveTo(start.x, start.y);
      simCtx.lineTo(end.x, end.y);
      simCtx.stroke();

      simCtx.strokeStyle = "rgba(231, 239, 255, 0.9)";
      simCtx.lineWidth = 1.8;
      simCtx.beginPath();
      simCtx.moveTo(start.x, start.y);
      simCtx.lineTo(end.x, end.y);
      simCtx.stroke();

      const marker = polarPoint(cx, cy, dialR * 0.74, deg);
      simCtx.fillStyle = "rgba(255, 210, 116, 0.94)";
      simCtx.beginPath();
      simCtx.arc(marker.x, marker.y, 3.2, 0, TWO_PI);
      simCtx.fill();
    });

    const tubeEnd = polarPoint(cx, cy, dialR * 1.02, theta);
    const tubeHead = polarPoint(cx, cy, dialR * 0.8, theta);

    simCtx.strokeStyle = "rgba(96, 198, 255, 0.88)";
    simCtx.lineWidth = 5.4;
    simCtx.lineCap = "round";
    simCtx.beginPath();
    simCtx.moveTo(cx, cy);
    simCtx.lineTo(tubeEnd.x, tubeEnd.y);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(205, 240, 255, 0.95)";
    simCtx.lineWidth = 1.4;
    simCtx.beginPath();
    simCtx.moveTo(cx, cy);
    simCtx.lineTo(tubeEnd.x, tubeEnd.y);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(77, 164, 235, 0.95)";
    simCtx.beginPath();
    simCtx.arc(tubeHead.x, tubeHead.y, 4.6, 0, TWO_PI);
    simCtx.fill();

    const delta1 = signedAngleDeltaDeg(theta, refl1Deg);
    const delta2 = signedAngleDeltaDeg(theta, refl2Deg);
    const pickFirst = Math.abs(delta1) <= Math.abs(delta2);
    const nearestIndex = pickFirst ? 0 : 1;
    const nearestDelta = pickFirst ? delta1 : delta2;

    updateSpectrometerCapture(p, nearestIndex, theta, Math.abs(nearestDelta));
    drawSpectrometerEyepiece(w, h, nearestDelta, p, [refl1Deg, refl2Deg]);

    const t1Text = Number.isFinite(p.theta1Deg) ? `${normalizeDeg(p.theta1Deg).toFixed(2)}°` : "--";
    const t2Text = Number.isFinite(p.theta2Deg) ? `${normalizeDeg(p.theta2Deg).toFixed(2)}°` : "--";
    els.simReadout.textContent = `A=${A.toFixed(2)}° · φ=${phiDeg.toFixed(2)}° · θ=${theta.toFixed(2)}° · θ1=${t1Text} · θ2=${t2Text}`;
  }

  function drawSpectrometerEyepiece(canvasW, canvasH, nearestDelta, p, reflAnglesDeg) {
    const fieldR = Math.min(canvasW, canvasH) * 0.16;
    const ox = canvasW - fieldR - 18;
    const oy = fieldR + 16;

    simCtx.save();

    simCtx.fillStyle = "rgba(6, 10, 20, 0.96)";
    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR + 7, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(15, 26, 44, 0.95)";
    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(201, 224, 255, 0.55)";
    simCtx.lineWidth = 1.4;
    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR, 0, TWO_PI);
    simCtx.stroke();

    simCtx.beginPath();
    simCtx.arc(ox, oy, fieldR - 1.5, 0, TWO_PI);
    simCtx.clip();

    simCtx.strokeStyle = "rgba(222, 236, 255, 0.55)";
    simCtx.lineWidth = 1;
    simCtx.beginPath();
    simCtx.moveTo(ox - fieldR, oy);
    simCtx.lineTo(ox + fieldR, oy);
    simCtx.stroke();

    simCtx.beginPath();
    simCtx.moveTo(ox, oy - fieldR);
    simCtx.lineTo(ox, oy + fieldR);
    simCtx.stroke();

    const sightWindowDeg = 7;
    const absDelta = Math.abs(nearestDelta);
    if (absDelta < sightWindowDeg) {
      const normalized = clamp(nearestDelta / sightWindowDeg, -1, 1);
      const slitX = ox + normalized * (fieldR * 0.62);
      const glow = Math.exp(-Math.pow(absDelta / 1.2, 2));

      simCtx.strokeStyle = `rgba(232, 248, 255, ${clamp(0.25 + glow * 0.8, 0, 1)})`;
      simCtx.lineWidth = 6;
      simCtx.beginPath();
      simCtx.moveTo(slitX, oy - fieldR * 0.86);
      simCtx.lineTo(slitX, oy + fieldR * 0.86);
      simCtx.stroke();

      simCtx.strokeStyle = `rgba(255, 255, 255, ${clamp(0.4 + glow * 0.6, 0, 1)})`;
      simCtx.lineWidth = 1.8;
      simCtx.beginPath();
      simCtx.moveTo(slitX, oy - fieldR * 0.86);
      simCtx.lineTo(slitX, oy + fieldR * 0.86);
      simCtx.stroke();
    }

    simCtx.restore();

    const measuredA = measuredPrismAngleFromReadings(p.theta1Deg, p.theta2Deg);
    simCtx.fillStyle = "rgba(226, 240, 255, 0.86)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.textAlign = "left";
    simCtx.textBaseline = "alphabetic";
    simCtx.fillText("望远镜目镜视场", ox - fieldR, oy + fieldR + 16);

    const t1 = Number.isFinite(p.theta1Deg) ? `${normalizeDeg(p.theta1Deg).toFixed(2)}°` : "--";
    const t2 = Number.isFinite(p.theta2Deg) ? `${normalizeDeg(p.theta2Deg).toFixed(2)}°` : "--";
    const aText = measuredA == null ? "--" : `${measuredA.toFixed(2)}°`;
    simCtx.fillText(`θ1=${t1}  θ2=${t2}  A_meas=${aText}`, ox - fieldR, oy + fieldR + 32);

    simCtx.fillStyle = "rgba(180, 210, 255, 0.72)";
    simCtx.fillText(`理论角 ${reflAnglesDeg[0].toFixed(2)}° / ${reflAnglesDeg[1].toFixed(2)}°`, ox - fieldR, oy + fieldR + 48);
  }

  function computeSpectrometerReflections(prismAngleDeg) {
    const A = clamp(prismAngleDeg, 0.1, 89.9);
    return {
      refl1Deg: normalizeDeg(180 - A),
      refl2Deg: normalizeDeg(180 + A),
      phiDeg: 2 * A,
    };
  }

  function updateSpectrometerCapture(p, sideIndex, telescopeDeg, absDelta) {
    const lockTol = 0.16;
    const releaseTol = 0.6;

    if (absDelta <= lockTol) {
      const theta = normalizeDeg(telescopeDeg);
      if (sideIndex === 0) {
        p.theta1Deg = theta;
      } else {
        p.theta2Deg = theta;
      }
      p.lastAlignedIndex = sideIndex;
      return;
    }

    if (absDelta > releaseTol) {
      p.lastAlignedIndex = -1;
    }
  }

  function measuredPrismAngleFromReadings(theta1Deg, theta2Deg) {
    if (!Number.isFinite(theta1Deg) || !Number.isFinite(theta2Deg)) return null;
    return Math.abs(signedAngleDeltaDeg(theta1Deg, theta2Deg)) / 2;
  }

  function computeDoubleArmBridgeState(p) {
    const idealMeasured = p.ratio * p.standardMilliOhm;
    const leadResidual = Math.abs(p.ratio - 1) < 0.05 ? p.leadMilliOhm * 0.18 : p.leadMilliOhm * 0.72;
    const effectiveMeasured = idealMeasured + leadResidual;
    const deltaMilliOhm = effectiveMeasured - p.unknownMilliOhm;
    const galvanometerUv = deltaMilliOhm * 85;
    return {
      idealMeasured,
      effectiveMeasured,
      deltaMilliOhm,
      galvanometerUv,
      compensatedLeadMilliOhm: leadResidual,
    };
  }

  function drawDoubleArmBridge() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params["double-arm-bridge"];
    const calc = computeDoubleArmBridgeState(p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(9, 18, 36, 1)");
    bg.addColorStop(1, "rgba(4, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const left = w * 0.14;
    const right = w * 0.74;
    const top = h * 0.22;
    const bottom = h * 0.72;
    const midY = (top + bottom) / 2;

    simCtx.strokeStyle = "rgba(198, 222, 255, 0.82)";
    simCtx.lineWidth = 3;
    simCtx.beginPath();
    simCtx.moveTo(left, top);
    simCtx.lineTo(right, top);
    simCtx.lineTo(right, bottom);
    simCtx.lineTo(left, bottom);
    simCtx.closePath();
    simCtx.stroke();

    drawWheatstoneResistor(left, top, right, top, "R1/R2", "rgba(136, 201, 255, 0.95)");
    drawWheatstoneResistor(right, top, right, bottom, "Rs", "rgba(129, 236, 190, 0.95)");
    drawWheatstoneResistor(left, bottom, right, bottom, "Rx", "rgba(255, 201, 105, 0.95)");

    simCtx.strokeStyle = "rgba(255, 181, 181, 0.72)";
    simCtx.lineWidth = 2;
    simCtx.setLineDash([8, 8]);
    simCtx.beginPath();
    simCtx.moveTo(left, top);
    simCtx.lineTo(left, bottom);
    simCtx.stroke();
    simCtx.setLineDash([]);

    simCtx.strokeStyle = "rgba(187, 226, 255, 0.9)";
    simCtx.lineWidth = 2.2;
    simCtx.beginPath();
    simCtx.moveTo((left + right) / 2, top);
    simCtx.lineTo((left + right) / 2, bottom);
    simCtx.stroke();

    const meterCx = w * 0.86;
    const meterCy = midY;
    const meterR = Math.min(w, h) * 0.12;
    roundRect(simCtx, meterCx - meterR - 18, meterCy - meterR - 16, meterR * 2 + 36, meterR * 1.5 + 28, 18);
    simCtx.fillStyle = "rgba(248, 251, 255, 0.08)";
    simCtx.fill();
    simCtx.strokeStyle = "rgba(212, 230, 255, 0.38)";
    simCtx.stroke();

    simCtx.fillStyle = "rgba(240, 247, 255, 0.92)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.textAlign = "center";
    simCtx.fillText("检流计", meterCx, meterCy - meterR * 0.9);

    simCtx.beginPath();
    simCtx.arc(meterCx, meterCy, meterR, Math.PI, TWO_PI);
    simCtx.strokeStyle = "rgba(232, 244, 255, 0.85)";
    simCtx.lineWidth = 2;
    simCtx.stroke();

    const maxNeedle = degToRad(68);
    const needleAngle = clamp(calc.galvanometerUv / 240, -1, 1) * maxNeedle - Math.PI / 2;
    simCtx.strokeStyle = "rgba(255, 110, 110, 0.98)";
    simCtx.lineWidth = 3;
    simCtx.beginPath();
    simCtx.moveTo(meterCx, meterCy);
    simCtx.lineTo(meterCx + Math.cos(needleAngle) * meterR * 0.82, meterCy + Math.sin(needleAngle) * meterR * 0.82);
    simCtx.stroke();

    simCtx.fillStyle = "rgba(255, 110, 110, 0.98)";
    simCtx.beginPath();
    simCtx.arc(meterCx, meterCy, 4.5, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(208, 229, 255, 0.84)";
    simCtx.textAlign = "left";
    simCtx.fillText(`Rs=${p.standardMilliOhm.toFixed(2)} mΩ`, left, top - 22);
    simCtx.fillText(`R1/R2=${p.ratio.toFixed(2)}`, left, bottom + 28);
    simCtx.fillText(`补偿后引线残差≈${calc.compensatedLeadMilliOhm.toFixed(3)} mΩ`, left, bottom + 48);

    els.simReadout.textContent = `Rx≈${calc.effectiveMeasured.toFixed(3)} mΩ · ΔR=${calc.deltaMilliOhm >= 0 ? "+" : ""}${calc.deltaMilliOhm.toFixed(3)} mΩ · 检流计=${calc.galvanometerUv.toFixed(1)} μV`;
  }

  function drawOscilloscope() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params.oscilloscope;

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(8, 16, 30, 1)");
    bg.addColorStop(1, "rgba(2, 8, 20, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const pad = 24;
    const chartX = pad;
    const chartY = pad;
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;
    roundRect(simCtx, chartX, chartY, chartW, chartH, 22);
    simCtx.fillStyle = "rgba(7, 25, 16, 0.82)";
    simCtx.fill();
    simCtx.strokeStyle = "rgba(142, 255, 194, 0.18)";
    simCtx.lineWidth = 1.4;
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(142, 255, 194, 0.13)";
    simCtx.lineWidth = 1;
    for (let i = 1; i < 10; i += 1) {
      const x = chartX + (chartW / 10) * i;
      simCtx.beginPath();
      simCtx.moveTo(x, chartY);
      simCtx.lineTo(x, chartY + chartH);
      simCtx.stroke();
    }
    for (let i = 1; i < 8; i += 1) {
      const y = chartY + (chartH / 8) * i;
      simCtx.beginPath();
      simCtx.moveTo(chartX, y);
      simCtx.lineTo(chartX + chartW, y);
      simCtx.stroke();
    }

    const centerY = chartY + chartH * 0.5;
    const ampPx = chartH * 0.11 * p.amplitudeV;
    const visiblePeriods = 2.2;
    const phase = SIM.timeSec * p.freqHz * TWO_PI * 0.15;

    simCtx.strokeStyle = "rgba(93, 255, 166, 0.96)";
    simCtx.lineWidth = 3;
    simCtx.beginPath();
    for (let i = 0; i <= 320; i += 1) {
      const t = i / 320;
      const x = chartX + chartW * t;
      const y = centerY - ampPx * Math.sin(t * visiblePeriods * TWO_PI + phase);
      if (i === 0) simCtx.moveTo(x, y);
      else simCtx.lineTo(x, y);
    }
    simCtx.stroke();

    simCtx.fillStyle = "rgba(190, 255, 219, 0.92)";
    simCtx.font = "12px 'Segoe UI', sans-serif";
    simCtx.textAlign = "left";
    simCtx.fillText(`CH1  ${p.freqHz.toFixed(0)} Hz`, chartX + 14, chartY + 20);
    simCtx.fillText(`Vpp ${(2 * p.amplitudeV).toFixed(2)} V`, chartX + 14, chartY + 40);
    simCtx.fillText(`触发：边沿稳定`, chartX + 14, chartY + 60);

    els.simReadout.textContent = `f=${p.freqHz.toFixed(0)} Hz · U_m=${p.amplitudeV.toFixed(2)} V · Vpp=${(2 * p.amplitudeV).toFixed(2)} V`;
  }

  function effectiveDielectricEpsilon(p) {
    return 1 + p.fillRatio * (p.epsilonR - 1);
  }

  function drawDielectricConstant() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params["dielectric-constant"];
    const eff = effectiveDielectricEpsilon(p);
    const capPf = p.baseCapPf * eff;

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(8, 17, 35, 1)");
    bg.addColorStop(1, "rgba(4, 10, 22, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const plateX0 = w * 0.28;
    const plateX1 = w * 0.72;
    const plateY0 = h * 0.2;
    const plateY1 = h * 0.8;
    simCtx.fillStyle = "rgba(220, 231, 249, 0.86)";
    simCtx.fillRect(plateX0 - 9, plateY0, 18, plateY1 - plateY0);
    simCtx.fillRect(plateX1 - 9, plateY0, 18, plateY1 - plateY0);

    const slabWidth = (plateX1 - plateX0) * p.fillRatio;
    if (slabWidth > 1) {
      const grad = simCtx.createLinearGradient(plateX0, plateY0, plateX0 + slabWidth, plateY1);
      grad.addColorStop(0, "rgba(112, 165, 255, 0.26)");
      grad.addColorStop(1, "rgba(134, 233, 207, 0.28)");
      simCtx.fillStyle = grad;
      simCtx.fillRect(plateX0, plateY0 + 8, slabWidth, plateY1 - plateY0 - 16);
    }

    for (let i = 0; i < 7; i += 1) {
      const y = plateY0 + ((plateY1 - plateY0) / 6) * i;
      simCtx.strokeStyle = "rgba(142, 218, 255, 0.42)";
      simCtx.lineWidth = 1.8;
      simCtx.beginPath();
      simCtx.moveTo(plateX0 + 10, y);
      simCtx.lineTo(plateX1 - 10, y);
      simCtx.stroke();
    }

    simCtx.fillStyle = "rgba(216, 231, 255, 0.92)";
    simCtx.font = "14px 'Segoe UI', sans-serif";
    simCtx.fillText(`εr=${p.epsilonR.toFixed(2)}`, 28, 36);
    simCtx.fillText(`插入比例=${(p.fillRatio * 100).toFixed(0)}%`, 28, 58);
    simCtx.fillText(`C≈${capPf.toFixed(2)} pF`, 28, 80);

    els.simReadout.textContent = `ε_eff=${eff.toFixed(2)} · C=${capPf.toFixed(2)} pF · 相对空气增益=${eff.toFixed(2)} 倍`;
  }

  function franckHertzCurrentAtVoltage(voltage, p) {
    if (voltage <= p.retardingV) return 0;
    const shifted = Math.max(0, voltage - p.retardingV);
    const base = 0.12 + 0.18 * Math.tanh(shifted / 10);
    const oscillation = 0.5 + 0.5 * Math.cos(((shifted / p.excitationV) - 0.15) * TWO_PI);
    return clamp(base + 0.65 * oscillation, 0.02, 1);
  }

  function drawFranckHertz() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params["franck-hertz"];
    const current = franckHertzCurrentAtVoltage(p.acceleratingV, p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(9, 16, 31, 1)");
    bg.addColorStop(1, "rgba(4, 8, 20, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const x0 = 48;
    const y0 = h - 42;
    const x1 = w - 24;
    const y1 = 34;
    simCtx.strokeStyle = "rgba(220, 235, 255, 0.82)";
    simCtx.lineWidth = 1.5;
    simCtx.beginPath();
    simCtx.moveTo(x0, y0);
    simCtx.lineTo(x1, y0);
    simCtx.moveTo(x0, y0);
    simCtx.lineTo(x0, y1);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(114, 222, 255, 0.9)";
    simCtx.lineWidth = 2.5;
    simCtx.beginPath();
    for (let i = 0; i <= 300; i += 1) {
      const u = (i / 300) * 60;
      const xx = x0 + ((x1 - x0) * u) / 60;
      const yy = y0 - franckHertzCurrentAtVoltage(u, p) * (y0 - y1 - 10);
      if (i === 0) simCtx.moveTo(xx, yy);
      else simCtx.lineTo(xx, yy);
    }
    simCtx.stroke();

    const px = x0 + ((x1 - x0) * p.acceleratingV) / 60;
    const py = y0 - current * (y0 - y1 - 10);
    simCtx.fillStyle = "rgba(255, 177, 93, 0.98)";
    simCtx.beginPath();
    simCtx.arc(px, py, 5, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(216, 231, 255, 0.92)";
    simCtx.font = "13px 'Segoe UI', sans-serif";
    simCtx.fillText("I", x0 - 18, y1 + 4);
    simCtx.fillText("U_a", x1 - 8, y0 + 18);
    simCtx.fillText(`ΔU≈${p.excitationV.toFixed(1)} V`, x0 + 14, y1 + 6);
    simCtx.fillText(`当前峰谷点：U_a=${p.acceleratingV.toFixed(1)} V`, x0 + 14, y1 + 26);

    els.simReadout.textContent = `U_a=${p.acceleratingV.toFixed(1)} V · U_r=${p.retardingV.toFixed(1)} V · I≈${current.toFixed(2)} a.u.`;
  }

  function nearestGratingLine(p) {
    const d = 1e-3 / p.linesPerMm;
    let best = null;
    for (const lambdaNm of p.spectralLinesNm) {
      const arg = clamp((lambdaNm * 1e-9) / d, -1, 1);
      const thetaDeg = radToDeg(Math.asin(arg));
      const delta = Math.abs(thetaDeg - p.angleDeg);
      if (!best || delta < best.delta) {
        best = { lambdaNm, thetaDeg, delta };
      }
    }
    return best;
  }

  function drawGratingSpectrum() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params["grating-spectrum"];
    const best = nearestGratingLine(p);
    const profile = getGratingSourceProfile(p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(8, 16, 30, 1)");
    bg.addColorStop(1, "rgba(4, 8, 18, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const centerX = w * 0.5;
    const baseY = h * 0.78;
    const topY = h * 0.18;
    const lampX = w * 0.14;
    const lampY = h * 0.36;
    const gratingX = centerX;
    const gratingY = h * 0.48;

    const lampGlow = simCtx.createRadialGradient(lampX, lampY, 0, lampX, lampY, 56);
    lampGlow.addColorStop(0, "rgba(255,255,255,0.98)");
    lampGlow.addColorStop(0.3, "rgba(176,214,255,0.8)");
    lampGlow.addColorStop(1, "rgba(0,0,0,0)");
    simCtx.fillStyle = lampGlow;
    simCtx.beginPath();
    simCtx.arc(lampX, lampY, 56, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(245,248,255,0.95)";
    simCtx.beginPath();
    simCtx.arc(lampX, lampY, 14, 0, TWO_PI);
    simCtx.fill();

    simCtx.strokeStyle = "rgba(255,255,255,0.28)";
    simCtx.lineWidth = 1.5;
    simCtx.beginPath();
    simCtx.moveTo(lampX + 18, lampY);
    simCtx.lineTo(gratingX - 20, gratingY);
    simCtx.stroke();

    roundRect(simCtx, gratingX - 14, gratingY - 62, 28, 124, 12);
    simCtx.fillStyle = "rgba(218,230,248,0.12)";
    simCtx.fill();
    simCtx.strokeStyle = "rgba(226,236,255,0.85)";
    simCtx.lineWidth = 2;
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(193,214,255,0.68)";
    simCtx.lineWidth = 1;
    for (let i = -8; i <= 8; i += 1) {
      const x = gratingX + i * 2.2;
      simCtx.beginPath();
      simCtx.moveTo(x, gratingY - 52);
      simCtx.lineTo(x, gratingY + 52);
      simCtx.stroke();
    }

    simCtx.strokeStyle = "rgba(214, 230, 255, 0.84)";
    simCtx.lineWidth = 2;
    simCtx.beginPath();
    simCtx.moveTo(centerX - 110, baseY);
    simCtx.lineTo(centerX + 110, baseY);
    simCtx.stroke();

    for (const lambdaNm of p.spectralLinesNm) {
      const d = 1e-3 / p.linesPerMm;
      const theta = Math.asin(clamp((lambdaNm * 1e-9) / d, -1, 1));
      const offset = Math.tan(theta) * h * 0.35;
      const color = wavelengthToRGB(lambdaNm);
      const lineAlpha = best?.lambdaNm === lambdaNm ? 0.98 : 0.82;

      simCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${lineAlpha})`;
      simCtx.lineWidth = best?.lambdaNm === lambdaNm ? 5 : 3;
      simCtx.beginPath();
      simCtx.moveTo(gratingX, gratingY);
      simCtx.lineTo(centerX - offset, topY + 8);
      simCtx.moveTo(gratingX, gratingY);
      simCtx.lineTo(centerX + offset, topY + 8);
      simCtx.stroke();

      simCtx.beginPath();
      simCtx.moveTo(centerX - offset, baseY);
      simCtx.lineTo(centerX - offset, topY);
      simCtx.moveTo(centerX + offset, baseY);
      simCtx.lineTo(centerX + offset, topY);
      simCtx.stroke();

      simCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.96)`;
      simCtx.beginPath();
      simCtx.arc(centerX - offset, topY, best?.lambdaNm === lambdaNm ? 7 : 5, 0, TWO_PI);
      simCtx.arc(centerX + offset, topY, best?.lambdaNm === lambdaNm ? 7 : 5, 0, TWO_PI);
      simCtx.fill();
    }

    simCtx.strokeStyle = "rgba(255,255,255,0.94)";
    simCtx.lineWidth = 4;
    simCtx.beginPath();
    simCtx.moveTo(centerX, baseY);
    simCtx.lineTo(centerX, topY - 4);
    simCtx.stroke();

    const cursorOffset = Math.tan(degToRad(p.angleDeg)) * h * 0.35;
    simCtx.strokeStyle = "rgba(255, 203, 109, 0.9)";
    simCtx.lineWidth = 2;
    simCtx.setLineDash([8, 7]);
    simCtx.beginPath();
    simCtx.moveTo(centerX + cursorOffset, baseY);
    simCtx.lineTo(centerX + cursorOffset, topY - 4);
    simCtx.stroke();
    simCtx.setLineDash([]);

    simCtx.fillStyle = "rgba(228,238,255,0.94)";
    simCtx.font = "14px 'Segoe UI', sans-serif";
    simCtx.textAlign = "left";
    simCtx.fillText(`光源：${profile.label}`, 24, 34);
    simCtx.fillText(`光栅密度：${p.linesPerMm.toFixed(0)} 线/mm`, 24, 56);
    simCtx.fillText(`观察角：${p.angleDeg.toFixed(1)}°`, 24, 78);

    simCtx.textAlign = "right";
    simCtx.fillText("一级谱线观察屏", w - 24, 34);

    if (best) {
      simCtx.textAlign = "center";
      simCtx.fillStyle = "rgba(255, 226, 156, 0.96)";
      simCtx.fillText(`当前最接近：${best.lambdaNm.toFixed(1)} nm，θ≈${best.thetaDeg.toFixed(2)}°`, centerX, h - 18);
    }

    els.simReadout.textContent = `光源=${profile.label} · n=${p.linesPerMm.toFixed(0)} 线/mm · θ=${p.angleDeg.toFixed(1)}° · 邻近谱线≈${best?.lambdaNm.toFixed(1) || "--"} nm`;
  }

  function computeHallVoltageMv(p) {
    return p.hallCoeff * p.magneticT * (p.currentMa / 1000) * 1000;
  }

  function drawHallEffect() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params["hall-effect"];
    const hallMv = computeHallVoltageMv(p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(8, 16, 31, 1)");
    bg.addColorStop(1, "rgba(3, 8, 19, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const plateX = w * 0.22;
    const plateY = h * 0.28;
    const plateW = w * 0.46;
    const plateH = h * 0.34;
    roundRect(simCtx, plateX, plateY, plateW, plateH, 24);
    simCtx.fillStyle = "rgba(104, 158, 236, 0.18)";
    simCtx.fill();
    simCtx.strokeStyle = "rgba(175, 212, 255, 0.88)";
    simCtx.lineWidth = 2;
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(125, 236, 190, 0.96)";
    simCtx.lineWidth = 3;
    simCtx.beginPath();
    simCtx.moveTo(plateX - 54, plateY + plateH / 2);
    simCtx.lineTo(plateX + plateW + 54, plateY + plateH / 2);
    simCtx.stroke();

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const x = plateX + 34 + col * (plateW - 68) / 4;
        const y = plateY + 28 + row * (plateH - 56) / 2;
        const offset = (p.magneticT * p.currentMa / 12) * (row - 1) * 5;
        simCtx.fillStyle = "rgba(255, 214, 102, 0.92)";
        simCtx.beginPath();
        simCtx.arc(x, y - offset, 5, 0, TWO_PI);
        simCtx.fill();
      }
    }

    simCtx.fillStyle = "rgba(220, 235, 255, 0.92)";
    simCtx.font = "14px 'Segoe UI', sans-serif";
    simCtx.fillText(`B=${p.magneticT.toFixed(2)} T`, plateX, plateY - 18);
    simCtx.fillText(`I=${p.currentMa.toFixed(1)} mA`, plateX + 120, plateY - 18);
    simCtx.fillText(`U_H≈${hallMv.toFixed(3)} mV`, plateX + 240, plateY - 18);

    simCtx.textAlign = "center";
    simCtx.fillText("V_H+", plateX + plateW + 66, plateY + 18);
    simCtx.fillText("V_H-", plateX + plateW + 66, plateY + plateH - 10);

    els.simReadout.textContent = `B=${p.magneticT.toFixed(2)} T · I=${p.currentMa.toFixed(1)} mA · U_H=${hallMv.toFixed(3)} mV`;
  }

  function computePotentiometerState(p) {
    const gradient = 0.02;
    const l1 = clamp(p.emfV / gradient, 0, p.totalLengthCm);
    const terminalV = p.emfV * p.loadOhm / (p.loadOhm + p.internalOhm);
    const l2 = clamp(terminalV / gradient, 0, p.totalLengthCm);
    const estimatedR = p.loadOhm * (l1 / Math.max(l2, 1e-6) - 1);
    return { gradient, l1, l2, terminalV, estimatedR };
  }

  function drawPotentiometerEmf() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params["potentiometer-emf"];
    const s = computePotentiometerState(p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(9, 18, 34, 1)");
    bg.addColorStop(1, "rgba(4, 9, 19, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const wireX0 = 60;
    const wireX1 = w - 60;
    const wireY = h * 0.6;
    simCtx.strokeStyle = "rgba(214, 165, 102, 0.96)";
    simCtx.lineWidth = 6;
    simCtx.beginPath();
    simCtx.moveTo(wireX0, wireY);
    simCtx.lineTo(wireX1, wireY);
    simCtx.stroke();

    simCtx.strokeStyle = "rgba(220, 235, 255, 0.78)";
    simCtx.lineWidth = 2;
    for (let i = 0; i <= 10; i += 1) {
      const x = wireX0 + ((wireX1 - wireX0) * i) / 10;
      simCtx.beginPath();
      simCtx.moveTo(x, wireY - 16);
      simCtx.lineTo(x, wireY + 16);
      simCtx.stroke();
    }

    const x1 = wireX0 + ((wireX1 - wireX0) * s.l1) / p.totalLengthCm;
    const x2 = wireX0 + ((wireX1 - wireX0) * s.l2) / p.totalLengthCm;
    simCtx.fillStyle = "rgba(118, 214, 186, 0.96)";
    simCtx.beginPath();
    simCtx.arc(x1, wireY, 6, 0, TWO_PI);
    simCtx.fill();
    simCtx.fillStyle = "rgba(120, 166, 255, 0.96)";
    simCtx.beginPath();
    simCtx.arc(x2, wireY, 6, 0, TWO_PI);
    simCtx.fill();

    simCtx.fillStyle = "rgba(220, 235, 255, 0.92)";
    simCtx.font = "14px 'Segoe UI', sans-serif";
    simCtx.fillText(`开路平衡 l1=${s.l1.toFixed(1)} cm`, 60, h * 0.28);
    simCtx.fillText(`负载平衡 l2=${s.l2.toFixed(1)} cm`, 60, h * 0.34);
    simCtx.fillText(`端电压 U=${s.terminalV.toFixed(3)} V`, 60, h * 0.40);
    simCtx.fillText(`估算内阻 r=${s.estimatedR.toFixed(2)} Ω`, 60, h * 0.46);

    els.simReadout.textContent = `E=${p.emfV.toFixed(2)} V · R=${p.loadOhm.toFixed(1)} Ω · l1/l2=${s.l1.toFixed(1)}/${s.l2.toFixed(1)} cm`;
  }

  function computePhotoelectricState(p) {
    const cutoffV = Math.max(0, (p.freqThz - p.thresholdThz) / 160);
    const current = p.freqThz <= p.thresholdThz ? 0 : clamp((cutoffV - p.reverseV + 0.15) / 1.15, 0, 1) * (0.4 + 0.6 * p.intensity);
    return { cutoffV, current };
  }

  function drawPhotoelectricEffect() {
    const w = SIM.canvasCssW;
    const h = SIM.canvasCssH;
    if (w < 2 || h < 2) return;
    const p = SIM.params["photoelectric-effect"];
    const s = computePhotoelectricState(p);

    simCtx.clearRect(0, 0, w, h);
    const bg = simCtx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "rgba(10, 18, 34, 1)");
    bg.addColorStop(1, "rgba(4, 9, 18, 1)");
    simCtx.fillStyle = bg;
    simCtx.fillRect(0, 0, w, h);

    const cathodeX = w * 0.18;
    const anodeX = w * 0.78;
    const plateY = h * 0.5;

    simCtx.fillStyle = "rgba(198, 213, 239, 0.92)";
    simCtx.fillRect(cathodeX - 6, h * 0.28, 12, h * 0.44);
    simCtx.fillRect(anodeX - 6, h * 0.28, 12, h * 0.44);

    const beamColor = wavelengthToRGB(299792.458 / Math.max(p.freqThz, 1));
    simCtx.strokeStyle = `rgba(${beamColor.r}, ${beamColor.g}, ${beamColor.b}, 0.92)`;
    simCtx.lineWidth = 5;
    for (let i = 0; i < 3; i += 1) {
      simCtx.beginPath();
      simCtx.moveTo(20, h * (0.28 + i * 0.08));
      simCtx.lineTo(cathodeX - 10, plateY - 18 + i * 10);
      simCtx.stroke();
    }

    const electronCount = Math.floor(s.current * 7);
    for (let i = 0; i < electronCount; i += 1) {
      const progress = (((SIM.timeSec * 0.8) + i / 7) % 1);
      const x = cathodeX + 18 + (anodeX - cathodeX - 36) * progress;
      const y = plateY + Math.sin(progress * TWO_PI * 2 + i) * 14;
      simCtx.fillStyle = "rgba(125, 218, 255, 0.96)";
      simCtx.beginPath();
      simCtx.arc(x, y, 4, 0, TWO_PI);
      simCtx.fill();
    }

    simCtx.fillStyle = "rgba(220, 235, 255, 0.92)";
    simCtx.font = "14px 'Segoe UI', sans-serif";
    simCtx.fillText(`ν=${p.freqThz.toFixed(0)} THz`, 32, 36);
    simCtx.fillText(`U_r=${p.reverseV.toFixed(2)} V`, 32, 58);
    simCtx.fillText(`截止电压 U_c≈${s.cutoffV.toFixed(2)} V`, 32, 80);
    simCtx.fillText(s.current > 0 ? "电子能够到达阳极" : "反向电压已阻断光电子", 32, 102);

    els.simReadout.textContent = `ν=${p.freqThz.toFixed(0)} THz · U_c≈${s.cutoffV.toFixed(2)} V · 光电流强度=${s.current.toFixed(2)}`;
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width * 0.5, height * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function forcedAmplitude(freqHz, damping, p) {
    const omega = TWO_PI * freqHz;
    const I = p.inertia;
    const omega0 = TWO_PI * p.naturalFreqHz;
    const k = I * omega0 * omega0;
    const den = Math.sqrt((k - I * omega * omega) ** 2 + (damping * omega) ** 2);
    return den > 1e-12 ? p.drive / den : 0;
  }

  function forcedPhase(freqHz, damping, p) {
    const omega = TWO_PI * freqHz;
    const I = p.inertia;
    const omega0 = TWO_PI * p.naturalFreqHz;
    const k = I * omega0 * omega0;
    return Math.atan2(damping * omega, k - I * omega * omega);
  }

  function resonancePeakFrequencyHz(damping, p) {
    const I = p.inertia;
    const omega0 = TWO_PI * p.naturalFreqHz;
    const term = omega0 * omega0 - (damping * damping) / (2 * I * I);
    return Math.sqrt(Math.max(term, 0)) / TWO_PI;
  }

  function peakAmplitudeForDamping(damping, p) {
    const fPeak = resonancePeakFrequencyHz(damping, p);
    return forcedAmplitude(Math.max(0.2, fPeak), damping, p);
  }

  function estimateNewtonVisibleRingCount(lambdaNm, curvatureMm, centerGapNm = 0) {
    const lambda = lambdaNm * 1e-9;
    const R = curvatureMm / 1000;
    const kVisible = (NEWTON_VIEW_RADIUS_M * NEWTON_VIEW_RADIUS_M) / Math.max(R * lambda, 1e-16);
    const centerOffset = (2 * Math.max(0, centerGapNm) * 1e-9) / Math.max(lambda, 1e-16);
    return Math.max(0, Math.floor(kVisible + centerOffset));
  }

  function updateSimulationPanelUI() {
    const expId = SIM.currentExpId;

    if (expId === "michelson") {
      const p = SIM.params.michelson;
      const color = wavelengthToRGB(p.lambdaNm);
      document.documentElement.style.setProperty("--ring-r", `${color.r}`);
      document.documentElement.style.setProperty("--ring-g", `${color.g}`);
      document.documentElement.style.setProperty("--ring-b", `${color.b}`);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.lambdaNm.toFixed(1)} nm`;
      if (els.simDisplacementValue) {
        const sign = p.displacementUm >= 0 ? "+" : "";
        els.simDisplacementValue.textContent = `${sign}${p.displacementUm.toFixed(3)} μm`;
      }
      if (els.simColorName) els.simColorName.textContent = wavelengthBandName(p.lambdaNm);
      if (els.simOpdValue) {
        const opdNm = p.displacementUm * 2 * 1000;
        const opdSign = opdNm >= 0 ? "+" : "";
        els.simOpdValue.textContent = `${opdSign}${opdNm.toFixed(1)} nm`;
      }
      if (els.simFringeCount) {
        const fringeN = (2 * Math.abs(p.displacementUm) * 1000) / p.lambdaNm;
        els.simFringeCount.textContent = Number.isFinite(fringeN) ? fringeN.toFixed(2) : "0.00";
      }
      return;
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      const color = wavelengthToRGB(p.lambdaNm);
      document.documentElement.style.setProperty("--ring-r", `${color.r}`);
      document.documentElement.style.setProperty("--ring-g", `${color.g}`);
      document.documentElement.style.setProperty("--ring-b", `${color.b}`);

      if (els.simLambdaRange) els.simLambdaRange.value = String(p.lambdaNm);
      if (els.simDisplacementRange) els.simDisplacementRange.value = String(p.curvatureMm);
      syncSimulationNumberInputValue(els.simLambdaNumber, p.lambdaNm);
      syncSimulationNumberInputValue(els.simDisplacementNumber, p.curvatureMm);
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.lambdaNm.toFixed(1)} nm`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.curvatureMm.toFixed(0)} mm`;
      if (els.simColorName) els.simColorName.textContent = `${p.centerGapNm.toFixed(0)} nm`;
      if (els.simOpdValue) els.simOpdValue.textContent = `${(computeNewtonCenterIntensity(p) * 100).toFixed(1)} %`;
      if (els.simFringeCount) {
        els.simFringeCount.textContent = String(estimateNewtonVisibleRingCount(p.lambdaNm, p.curvatureMm, p.centerGapNm));
      }
      syncNewtonPanelFromState();
      return;
    }

    if (expId === "wheatstone-bridge") {
      const p = SIM.params["wheatstone-bridge"];
      const calc = computeWheatstoneBridgeState(p);
      const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);
      const deflect = p.switchPressed ? `${wheatstoneDeflectionText(p.needleAngleDeg)} ${grids} 格` : "开关断开";

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${calc.ratio.toFixed(2)}`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${calc.rs.toFixed(0)} Ω`;
      if (els.simColorName) els.simColorName.textContent = p.switchPressed ? "已闭合" : "已断开";
      if (els.simOpdValue) els.simOpdValue.textContent = `${(calc.deltaV * 1000).toFixed(2)} mV`;
      if (els.simFringeCount) els.simFringeCount.textContent = deflect;
      return;
    }
    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      const amp = forcedAmplitude(p.freqHz, p.damping, p);
      const phase = forcedPhase(p.freqHz, p.damping, p);
      const fRes = resonancePeakFrequencyHz(p.damping, p);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.freqHz.toFixed(2)} Hz`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.damping.toFixed(2)}`;
      if (els.simColorName) els.simColorName.textContent = `${(phase * 180 / Math.PI).toFixed(1)}°`;
      if (els.simOpdValue) els.simOpdValue.textContent = amp.toExponential(2);
      if (els.simFringeCount) els.simFringeCount.textContent = `${fRes.toFixed(2)} Hz`;
      return;
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      const A = p.prismAngleDeg;
      const theta = normalizeDeg(p.telescopeDeg);
      const refs = computeSpectrometerReflections(A);
      const d1 = signedAngleDeltaDeg(theta, refs.refl1Deg);
      const d2 = signedAngleDeltaDeg(theta, refs.refl2Deg);
      const nearest = Math.abs(d1) <= Math.abs(d2) ? d1 : d2;
      const measuredA = measuredPrismAngleFromReadings(p.theta1Deg, p.theta2Deg);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${A.toFixed(2)} °`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${theta.toFixed(2)} °`;
      if (els.simColorName) els.simColorName.textContent = `${refs.phiDeg.toFixed(2)} °`;
      if (els.simOpdValue) {
        const sign = nearest >= 0 ? "+" : "";
        els.simOpdValue.textContent = `${sign}${nearest.toFixed(2)} °`;
      }
      if (els.simFringeCount) {
        els.simFringeCount.textContent = measuredA == null ? "--" : `${measuredA.toFixed(2)} °`;
      }
      return;
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      const T = getTorsionPeriodSec(p);
      const elapsedMs = getTorsionElapsedMs(p);

      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.theta0Deg.toFixed(1)} °`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = "--";
      if (els.simColorName) els.simColorName.textContent = getTorsionObjectLabel(p.objectKey);
      if (els.simOpdValue) els.simOpdValue.textContent = `${T.toFixed(3)} s`;
      if (els.simFringeCount) els.simFringeCount.textContent = formatStopwatchMs(elapsedMs);

      syncTorsionPanelFromState();
      return;
    }

    if (expId === "double-arm-bridge") {
      const p = SIM.params["double-arm-bridge"];
      const calc = computeDoubleArmBridgeState(p);
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.ratio.toFixed(2)}`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.standardMilliOhm.toFixed(2)} mΩ`;
      if (els.simColorName) els.simColorName.textContent = `${calc.compensatedLeadMilliOhm.toFixed(3)} mΩ`;
      if (els.simOpdValue) {
        const sign = calc.deltaMilliOhm >= 0 ? "+" : "";
        els.simOpdValue.textContent = `${sign}${calc.deltaMilliOhm.toFixed(3)} mΩ`;
      }
      if (els.simFringeCount) els.simFringeCount.textContent = `${calc.effectiveMeasured.toFixed(3)} mΩ`;
      return;
    }

    if (expId === "oscilloscope") {
      const p = SIM.params.oscilloscope;
      const periodMs = 1000 / p.freqHz;
      p.timebaseMs = Math.max(0.2, periodMs / 4);
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.freqHz.toFixed(0)} Hz`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.amplitudeV.toFixed(2)} V`;
      if (els.simColorName) els.simColorName.textContent = `触发稳定`;
      if (els.simOpdValue) els.simOpdValue.textContent = `${(2 * p.amplitudeV).toFixed(2)} V`;
      if (els.simFringeCount) els.simFringeCount.textContent = `${periodMs.toFixed(2)} ms`;
      return;
    }

    if (expId === "dielectric-constant") {
      const p = SIM.params["dielectric-constant"];
      const eff = effectiveDielectricEpsilon(p);
      const capPf = p.baseCapPf * eff;
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.epsilonR.toFixed(2)}`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${(p.fillRatio * 100).toFixed(0)} %`;
      if (els.simColorName) els.simColorName.textContent = `${eff.toFixed(2)}`;
      if (els.simOpdValue) els.simOpdValue.textContent = `${capPf.toFixed(2)} pF`;
      if (els.simFringeCount) els.simFringeCount.textContent = `${eff.toFixed(2)} ×`;
      return;
    }

    if (expId === "franck-hertz") {
      const p = SIM.params["franck-hertz"];
      const current = franckHertzCurrentAtVoltage(p.acceleratingV, p);
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.acceleratingV.toFixed(1)} V`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.retardingV.toFixed(1)} V`;
      if (els.simColorName) els.simColorName.textContent = `${p.excitationV.toFixed(1)} V`;
      if (els.simOpdValue) els.simOpdValue.textContent = `${current.toFixed(2)} a.u.`;
      if (els.simFringeCount) els.simFringeCount.textContent = `${p.excitationV.toFixed(2)} eV`;
      return;
    }

    if (expId === "grating-spectrum") {
      const p = SIM.params["grating-spectrum"];
      const best = nearestGratingLine(p);
      const profile = getGratingSourceProfile(p);
      const densityTrend = p.linesPerMm >= 800 ? "分散更强" : p.linesPerMm >= 500 ? "分散适中" : "分散较弱";
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.linesPerMm.toFixed(0)} 线/mm`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.angleDeg.toFixed(1)} °`;
      if (els.simColorName) els.simColorName.textContent = best ? `${profile.label} · ${best.lambdaNm.toFixed(1)} nm` : profile.label;
      if (els.simOpdValue) els.simOpdValue.textContent = best ? `${best.thetaDeg.toFixed(2)} °` : "--";
      if (els.simFringeCount) els.simFringeCount.textContent = densityTrend;
      syncGratingPanelFromState();
      return;
    }

    if (expId === "hall-effect") {
      const p = SIM.params["hall-effect"];
      const hallMv = computeHallVoltageMv(p);
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.magneticT.toFixed(2)} T`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.currentMa.toFixed(1)} mA`;
      if (els.simColorName) els.simColorName.textContent = hallMv >= 0 ? "正电势侧" : "负电势侧";
      if (els.simOpdValue) els.simOpdValue.textContent = `${hallMv.toFixed(3)} mV`;
      if (els.simFringeCount) els.simFringeCount.textContent = hallMv > 0.9 ? "磁场较强" : hallMv > 0.4 ? "磁场中等" : "磁场较弱";
      return;
    }

    if (expId === "potentiometer-emf") {
      const p = SIM.params["potentiometer-emf"];
      const s = computePotentiometerState(p);
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.emfV.toFixed(2)} V`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.loadOhm.toFixed(1)} Ω`;
      if (els.simColorName) els.simColorName.textContent = `${(s.l1 / Math.max(s.l2, 1e-6)).toFixed(2)}`;
      if (els.simOpdValue) els.simOpdValue.textContent = `${s.terminalV.toFixed(3)} V`;
      if (els.simFringeCount) els.simFringeCount.textContent = `${s.estimatedR.toFixed(2)} Ω`;
      return;
    }

    if (expId === "photoelectric-effect") {
      const p = SIM.params["photoelectric-effect"];
      const s = computePhotoelectricState(p);
      if (els.simLambdaValue) els.simLambdaValue.textContent = `${p.freqThz.toFixed(0)} THz`;
      if (els.simDisplacementValue) els.simDisplacementValue.textContent = `${p.reverseV.toFixed(2)} V`;
      if (els.simColorName) els.simColorName.textContent = s.current > 0 ? "有光电子" : "被阻断";
      if (els.simOpdValue) els.simOpdValue.textContent = `${s.cutoffV.toFixed(2)} V`;
      if (els.simFringeCount) els.simFringeCount.textContent = `${s.current.toFixed(2)} a.u.`;
      return;
    }
  }
  function buildSimulationPrompt(expId) {
    if (expId === "michelson") {
      const p = SIM.params.michelson;
      const lambda = p.lambdaNm.toFixed(1);
      const colorName = wavelengthBandName(p.lambdaNm);
      const sign = p.displacementUm >= 0 ? "+" : "";

      let observed = "当前条纹基本保持稳定。";
      let action = "保持微动镜缓慢静止";

      if (SIM.motion === "outward") {
        action = "向前推进微动镜";
        observed = "观察到条纹向外扩展并加快移动。";
      } else if (SIM.motion === "inward") {
        action = "向后回退微动镜";
        observed = "观察到条纹向中心收缩并逐渐变密。";
      }

      return `我正在“迈克耳孙干涉仪测定激光波长”实验中进行观察。当前激光波长为 ${lambda} nm（${colorName}），微动镜相对零位的位移为 ${sign}${p.displacementUm.toFixed(3)} μm，我此刻正在${action}，并且${observed}请结合公式 2d\\cos\\theta = k\\lambda 与 \\Delta d = N\\frac{\\lambda}{2}，解释条纹变化原因，并判断光程差是在增大还是减小。`;
    }

    if (expId === "newton-rings") {
      const p = SIM.params["newton-rings"];
      const lambda = p.lambdaNm.toFixed(1);
      const colorName = wavelengthBandName(p.lambdaNm);
      const R = p.curvatureMm.toFixed(0);
      const centerIntensity = (computeNewtonCenterIntensity(p) * 100).toFixed(1);
      const defectEnabled = p.defectRadiusMm > 0.01 && Math.abs(p.defectDepthNm) > 0.1;
      const defectText = defectEnabled
        ? `局部缺陷位于 (${p.defectXmm >= 0 ? "+" : ""}${p.defectXmm.toFixed(2)}, ${p.defectYmm >= 0 ? "+" : ""}${p.defectYmm.toFixed(2)}) mm，特征尺度约 ${p.defectRadiusMm.toFixed(2)} mm，附加隙厚 Δh_d=${p.defectDepthNm >= 0 ? "+" : ""}${p.defectDepthNm.toFixed(0)} nm；`
        : "当前未加入局部缺陷；";
      const action = describeNewtonAction();

      return `我正在“牛顿环实验”中观察扩展干涉图样。当前入射光波长为 ${lambda} nm（${colorName}），透镜曲率半径 R = ${R} mm，中心空气隙 h₀=${p.centerGapNm.toFixed(0)} nm，倾斜角 α=${p.tiltUrad >= 0 ? "+" : ""}${p.tiltUrad.toFixed(0)} μrad，中心归一化光强约为 ${centerIntensity}%。${defectText}${action}请结合薄膜厚度模型 t=h₀+r²/(2R)+x\\tan\\alpha+\\Delta h_d 与反射光强公式 I\\propto1-\\cos(4\\pi t/\\lambda)，解释为什么中心亮暗状态、环纹偏移以及缺陷附近的局部畸变会随参数改变而变化，并说明图中 h₀-I_c 曲线反映了什么物理关系。`;
    }

    if (expId === "wheatstone-bridge") {
      const p = SIM.params["wheatstone-bridge"];
      const calc = computeWheatstoneBridgeState(p);
      const grids = estimateWheatstoneGridDeflection(p.needleAngleDeg, p.galvanometerMaxDeg);
      const deflect = p.switchPressed ? `${wheatstoneDeflectionText(p.needleAngleDeg)} ${grids} 格` : "开关断开";
      const action = describeWheatstoneAction();

      return `我正在进行“用惠斯通电桥测电阻”实验。当前比例臂 R1/R2 = ${calc.ratio.toFixed(2)}，比较臂 Rs = ${calc.rs.toFixed(0)} Ω，开关状态为${p.switchPressed ? "闭合" : "断开"}，检流计显示为${deflect}。${action}请根据平衡条件 Rx=(R1/R2)Rs 与电势差方向，判断下一步应增大还是减小 Rs，并解释微调依据。`;
    }

    if (expId === "bohr-resonance") {
      const p = SIM.params["bohr-resonance"];
      const f = p.freqHz;
      const c = p.damping;
      const fRes = resonancePeakFrequencyHz(c, p);
      const closeToPeak = Math.abs(f - fRes) <= 0.08;
      const position = closeToPeak ? "恰好处于共振附近" : f < fRes ? "低于共振区" : "高于共振区";
      const dampingLevel = c < 0.2 ? "较小" : c < 0.5 ? "中等" : "较大";
      const action = describeBohrAction();

      return `我目前在“玻尔共振仪研究受迫振动”实验中。当前驱动频率为 ${f.toFixed(2)} Hz，${position}，共振频率约为 f_r=${fRes.toFixed(2)} Hz；阻尼系数为${dampingLevel}，c=${c.toFixed(2)}。${action}请结合稳态振幅公式 A = \\frac{M_0}{\\sqrt{(k-I\\omega^2)^2+(c\\omega)^2}} 与对应微分方程，解释为什么振幅会在某一频率附近达到最大，以及阻尼变化后峰值高度和共振频率会如何变化。`;
    }

    if (expId === "spectrometer-prism") {
      const p = SIM.params["spectrometer-prism"];
      const refs = computeSpectrometerReflections(p.prismAngleDeg);
      const theta1 = Number.isFinite(p.theta1Deg) ? normalizeDeg(p.theta1Deg) : refs.refl1Deg;
      const theta2 = Number.isFinite(p.theta2Deg) ? normalizeDeg(p.theta2Deg) : refs.refl2Deg;
      const measuredA = Math.abs(signedAngleDeltaDeg(theta1, theta2)) / 2;
      const captureHint = Number.isFinite(p.theta1Deg) && Number.isFinite(p.theta2Deg)
        ? `我分别读取了 θ1=${theta1.toFixed(2)}°、θ2=${theta2.toFixed(2)}°，已经记录了两次反射位置。`
        : `我当前望远镜角度为 θ=${normalizeDeg(p.telescopeDeg).toFixed(2)}°，目前只捕捉到一侧反射亮线，还在继续搜索另一侧。`;

      return `我当前正在做“分光计调节和棱镜顶角的测定”实验。待测棱镜顶角设定为 A=${p.prismAngleDeg.toFixed(2)}°，理论反射夹角为 φ=${refs.phiDeg.toFixed(2)}°。${captureHint}请根据反射法公式 A = \\frac{|\\theta_1 - \\theta_2|}{2}，说明如何由两次读数求出棱镜顶角，并解释双侧反射对称出现的原因。同时比较我当前测得的 A_meas=${measuredA.toFixed(2)}° 与设定值是否一致。`;
    }

    if (expId === "torsion-pendulum") {
      const p = SIM.params["torsion-pendulum"];
      const t0 = p.measurements["empty-disk"]?.elapsedMs ?? 10 * getTorsionPeriodSec(p, "empty-disk") * 1000;
      const t1 = p.measurements["standard-cylinder"]?.elapsedMs ?? 10 * getTorsionPeriodSec(p, "standard-cylinder") * 1000;
      const t2 = p.measurements["unknown-cylinder"]?.elapsedMs ?? 10 * getTorsionPeriodSec(p, "unknown-cylinder") * 1000;
      const periodCurrent = getTorsionPeriodSec(p);
      const obj = getTorsionObjectLabel(p.objectKey);

      return `我正在进行“扭摆法测量物体的转动惯量”实验。当前实验对象为${obj}，初始偏转角为 θ0=${p.theta0Deg.toFixed(1)}°，当前周期约为 T=${periodCurrent.toFixed(3)} s。已记录 10 个周期的计时：空载圆盘 ${formatStopwatchMs(t0)}，标准圆柱体 ${formatStopwatchMs(t1)}，未知圆柱体 ${formatStopwatchMs(t2)}。其中标准圆柱体已知转动惯量 I1=${p.knownInertia.toFixed(4)} kg·m^2。请根据周期公式 T = 2π\\sqrt{I/K} 推导扭转常量 K，并进一步求出未知物体的转动惯量。同时说明为什么实验通常测量 10 个周期而不是只测 1 个周期。`;
    }

    if (expId === "double-arm-bridge") {
      const p = SIM.params["double-arm-bridge"];
      const calc = computeDoubleArmBridgeState(p);
      return `我正在进行“双臂电桥测量低电阻”实验。当前比例臂比值 R1/R2=${p.ratio.toFixed(2)}，标准低阻 Rs=${p.standardMilliOhm.toFixed(2)} mΩ，未知低阻约为 Rx=${p.unknownMilliOhm.toFixed(2)} mΩ，引线残余影响约为 ${calc.compensatedLeadMilliOhm.toFixed(3)} mΩ。当前桥路失衡量 ΔR=${calc.deltaMilliOhm >= 0 ? "+" : ""}${calc.deltaMilliOhm.toFixed(3)} mΩ。请说明双臂电桥为什么比惠斯通电桥更适合测低电阻，并判断我下一步应优先调整比例臂还是标准低阻。`;
    }

    if (expId === "oscilloscope") {
      const p = SIM.params.oscilloscope;
      return `我正在进行“数字示波器的调整和使用”实验。当前输入正弦信号频率为 ${p.freqHz.toFixed(0)} Hz，峰值电压为 ${p.amplitudeV.toFixed(2)} V，对应峰峰值约 ${(2 * p.amplitudeV).toFixed(2)} V，周期约 ${(1000 / p.freqHz).toFixed(2)} ms。请根据当前波形说明如何由示波器读出频率与幅值，并解释时基、垂直灵敏度和触发为什么要配合设置。`;
    }

    if (expId === "dielectric-constant") {
      const p = SIM.params["dielectric-constant"];
      const eff = effectiveDielectricEpsilon(p);
      return `我正在进行“电介质电容率的测量”实验。当前相对介电常数设为 εr=${p.epsilonR.toFixed(2)}，介质插入比例为 ${(p.fillRatio * 100).toFixed(0)}%，等效介电常数约为 ${eff.toFixed(2)}，电容约为 ${(p.baseCapPf * eff).toFixed(2)} pF。请解释介质插入后电容为什么会增大，并说明不完全插入时为什么不能简单把系统看成理想均匀介质。`;
    }

    if (expId === "franck-hertz") {
      const p = SIM.params["franck-hertz"];
      const current = franckHertzCurrentAtVoltage(p.acceleratingV, p);
      return `我正在进行“弗兰克-赫兹实验”。当前加速电压 U_a=${p.acceleratingV.toFixed(1)} V，拒斥电压 U_r=${p.retardingV.toFixed(1)} V，曲线上相邻峰谷间距约为 ${p.excitationV.toFixed(1)} V，当前集电极电流约为 ${current.toFixed(2)}（归一化单位）。请结合电子与原子的非弹性碰撞解释为什么电流会周期性起伏，并说明峰谷间隔为何能够反映原子的激发能。`;
    }

    if (expId === "grating-spectrum") {
      const p = SIM.params["grating-spectrum"];
      const best = nearestGratingLine(p);
      const profile = getGratingSourceProfile(p);
      return `我正在进行“光栅原子光谱的定性研究”实验。当前光源为${profile.label}，光栅密度为 ${p.linesPerMm.toFixed(0)} 线/mm，观察角约 ${p.angleDeg.toFixed(1)}°，当前最邻近的一条一级谱线约为 ${best?.lambdaNm.toFixed(1) || "--"} nm，对应衍射角约 ${best?.thetaDeg.toFixed(2) || "--"}°。请根据光栅方程 d\\sin\\theta = k\\lambda 说明为什么不同波长会出现在不同位置，并结合当前谱灯说明如何做定性识别，同时解释光栅密度增大后谱线分离会如何变化。`;
    }

    if (expId === "hall-effect") {
      const p = SIM.params["hall-effect"];
      const hallMv = computeHallVoltageMv(p);
      return `我正在进行“霍尔效应测量磁感应强度”实验。当前磁感应强度 B=${p.magneticT.toFixed(2)} T，工作电流 I=${p.currentMa.toFixed(1)} mA，测得霍尔电压约 U_H=${hallMv.toFixed(3)} mV。请解释载流子在磁场中为什么会形成横向电势差，并说明如果只反转磁场方向而不改变电流方向，霍尔电压的符号和大小会怎样变化。`;
    }

    if (expId === "potentiometer-emf") {
      const p = SIM.params["potentiometer-emf"];
      const s = computePotentiometerState(p);
      return `我正在进行“用电位差计测量电源电动势与内阻”实验。当前开路电动势 E=${p.emfV.toFixed(2)} V，负载电阻 R=${p.loadOhm.toFixed(1)} Ω，平衡长度分别约为 l1=${s.l1.toFixed(1)} cm、l2=${s.l2.toFixed(1)} cm，端电压 U=${s.terminalV.toFixed(3)} V，由此估算内阻 r≈${s.estimatedR.toFixed(2)} Ω。请说明补偿法为什么比直接电压表测量更准确，并根据 l1/l2 的关系推导内阻公式。`;
    }

    if (expId === "photoelectric-effect") {
      const p = SIM.params["photoelectric-effect"];
      const s = computePhotoelectricState(p);
      return `我正在进行“光电效应测定普朗克常量”实验。当前入射频率 ν=${p.freqThz.toFixed(0)} THz，材料阈频约为 ${p.thresholdThz.toFixed(0)} THz，反向电压 U_r=${p.reverseV.toFixed(2)} V，估计截止电压 U_c≈${s.cutoffV.toFixed(2)} V，当前光电流强度约为 ${s.current.toFixed(2)}。请根据爱因斯坦光电方程 eU_c=h\\nu-W 解释为什么截止电压取决于频率而不是光强，并说明我当前是否已经达到截止状态。`;
    }

    return `请讲解【${experimentMap.get(expId)?.name || "该实验"}】的关键现象与参数变化之间的关系。`;
  }

  function describeNewtonAction() {
    const a = SIM.lastControlAction;
    if (a.expId !== "newton-rings") return "目前我保持参数不变，继续观察条纹变化。";

    if (a.key === "lambdaNm") {
      if (a.direction > 0) return "我刚刚增大了波长，圆环间距明显变疏。";
      if (a.direction < 0) return "我刚刚减小了波长，圆环分布变得更密。";
    }

    if (a.key === "curvatureMm") {
      if (a.direction > 0) return "我刚刚增大了曲率半径，圆环整体外扩并变疏。";
      if (a.direction < 0) return "我刚刚减小了曲率半径，圆环向内收缩并变密。";
    }

    if (a.key === "centerGapNm") {
      if (a.direction > 0) return "我刚刚增大了中心空气隙，中心光强随之升高，并且图中的 h₀-I_c 采样点向右移动。";
      if (a.direction < 0) return "我刚刚减小了中心空气隙，中心区域重新趋向暗斑，同时采样点向左回移。";
    }

    if (a.key === "tiltUrad") {
      if (a.direction > 0) return "我刚刚增大了正向倾斜，条纹整体向一侧偏移，圆环逐渐失去严格同心性。";
      if (a.direction < 0) return "我刚刚减小或反转了倾斜，条纹偏移方向发生变化，干涉场重新分布。";
    }

    if (a.key === "defectXmm" || a.key === "defectYmm") {
      return "我刚刚移动了缺陷位置，局部畸变区域也随之平移。";
    }

    if (a.key === "defectRadiusMm") {
      if (a.direction > 0) return "我刚刚增大了缺陷尺度，局部扭曲区域扩大得更明显。";
      if (a.direction < 0) return "我刚刚减小了缺陷尺度，局部扰动收缩，条纹逐渐恢复平滑。";
    }

    if (a.key === "defectDepthNm") {
      if (a.direction > 0) return "我刚刚提高了缺陷附加隙厚，缺陷附近的相位扰动增强。";
      if (a.direction < 0) return "我刚刚降低了缺陷附加隙厚，局部畸变程度有所减弱。";
    }

    if (a.key === "idealReset") {
      return "我刚刚恢复到理想接触模型，中心空气隙、倾斜与缺陷扰动均已清零。";
    }

    return "目前我保持参数不变，继续观察条纹变化。";
  }

  function describeBohrAction() {
    const a = SIM.lastControlAction;
    if (a.expId !== "bohr-resonance") return "我正在观察系统在不同频率与阻尼下的共振响应。";

    if (a.key === "freqHz") {
      if (a.direction > 0) return "我刚刚提高了驱动频率，振幅峰位置似乎向高频侧靠近。";
      if (a.direction < 0) return "我刚刚降低了驱动频率，系统响应正在远离高频一侧。";
    }

    if (a.key === "damping") {
      if (a.direction > 0) return "我刚刚增大了阻尼，峰值降低且共振曲线更平缓。";
      if (a.direction < 0) return "我刚刚减小了阻尼，振幅增大且峰形更尖锐。";
    }

    return "我正在观察系统在不同频率与阻尼下的共振响应。";
  }

  function describeWheatstoneAction() {
    const a = SIM.lastControlAction;
    if (a.expId !== "wheatstone-bridge") return "";

    if (a.key === "ratio") {
      if (a.direction > 0) return "我刚刚增大了 R1/R2。";
      if (a.direction < 0) return "我刚刚减小了 R1/R2。";
    }

    if (a.key === "rsOhm") {
      if (a.direction > 0) return "我刚刚增大了 Rs。";
      if (a.direction < 0) return "我刚刚减小了 Rs。";
    }

    return "";
  }
  function fillAndSendPrompt(prompt) {
    els.chatInput.value = prompt;
    autoResizeTextarea(els.chatInput);
    sendMessage(prompt);
  }

  function buildExperimentPrinciplePrompt(experiment) {
    const outcomes = (experiment.outcomes || []).map((item, index) => `${index + 1}. ${item}`).join("\n");
    return [
      `请围绕课内实验【${experiment.name}】做系统讲解。`,
      "请按“实验背景—核心原理—关键公式—操作提醒—误差分析”五部分展开，公式请尽量使用 LaTeX 表达。",
      `当前实验简介：${experiment.intro}`,
      outcomes ? `本实验的学习重点：\n${outcomes}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function buildExperimentQuizPrompt(experiment) {
    const quiz = (experiment.quiz || []).map((item, index) => `${index + 1}. ${item}`).join("\n");
    return [
      `请解析课内实验【${experiment.name}】的检验题目。`,
      "请逐题给出思路、关键物理依据与常见失分点，必要时补充计算步骤。",
      quiz ? `题目如下：\n${quiz}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  function analyzeDataLab(state) {
    const sourcePoints = Array.isArray(state.points) && state.points.length
      ? state.points
      : parseSimpleDataLabPoints(state.tableText).rows;
    const xBUncertainty = parseDataLabUncertaintyValue(state.xBUncertainty, "横坐标");
    const yBUncertainty = parseDataLabUncertaintyValue(state.yBUncertainty, "纵坐标");
    const xUncertainty = computeDataLabSeriesUncertainty(sourcePoints.map((row) => row.x), xBUncertainty);
    const yUncertainty = computeDataLabSeriesUncertainty(sourcePoints.map((row) => row.y), yBUncertainty);
    const points = sourcePoints.map((row, index) => ({
      index: index + 1,
      x: row.x,
      y: row.y,
      ux: xUncertainty.total,
      uy: yUncertainty.total,
      scope: { x: row.x, y: row.y },
    }));

    if (!points.length) {
      throw new Error("至少需要一组有效数据才能作图。");
    }

    const xMin = Math.min(...points.map((point) => point.x));
    const xMax = Math.max(...points.map((point) => point.x));
    const yMin = Math.min(...points.map((point) => point.y));
    const yMax = Math.max(...points.map((point) => point.y));
    const xExtentMin = Math.min(...points.map((point) => point.x - Math.abs(point.ux || 0)));
    const xExtentMax = Math.max(...points.map((point) => point.x + Math.abs(point.ux || 0)));
    const yExtentMin = Math.min(...points.map((point) => point.y - Math.abs(point.uy || 0)));
    const yExtentMax = Math.max(...points.map((point) => point.y + Math.abs(point.uy || 0)));
    const xPadding = computeDataLabPadding(xExtentMin, xExtentMax);
    const yPadding = computeDataLabPadding(yExtentMin, yExtentMax);
    let fit = null;
    let fitError = "";
    try {
      fit = computeDataLabFit(state.fitType || "linear", points);
    } catch (error) {
      fitError = error?.message || "当前拟合失败";
    }
    return {
      xLabel: "x",
      xUnit: state.xUnit || "",
      xExpression: "x",
      yLabel: "y",
      yUnit: state.yUnit || "",
      yExpression: "y",
      fitType: state.fitType || "linear",
      variables: [],
      headers: ["x", "y"],
      points,
      fit,
      fitError,
      uncertainty: {
        x: xUncertainty,
        y: yUncertainty,
      },
      meanUx: xUncertainty.total,
      meanUy: yUncertainty.total,
      xMin,
      xMax,
      yMin,
      yMax,
      plotXMin: xExtentMin - xPadding,
      plotXMax: xExtentMax + xPadding,
      plotYMin: yExtentMin - yPadding,
      plotYMax: yExtentMax + yPadding,
    };
  }

  function parseDataLabUncertaintyValue(rawValue, axisName) {
    const text = String(rawValue ?? "").trim();
    if (!text) return 0;
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`${axisName} B 类不确定度应为大于等于 0 的数值。`);
    }
    return value;
  }

  function computeDataLabSeriesUncertainty(values, bClass = 0) {
    const samples = (values || []).map((value) => Number(value)).filter((value) => Number.isFinite(value));
    const count = samples.length;
    const mean = count ? samples.reduce((sum, value) => sum + value, 0) / count : 0;
    if (!count) {
      return {
        count: 0,
        mean: 0,
        sampleStd: 0,
        aClass: 0,
        bClass,
        total: Math.abs(Number(bClass || 0)),
      };
    }
    if (count < 2) {
      return {
        count,
        mean,
        sampleStd: 0,
        aClass: 0,
        bClass,
        total: Math.hypot(0, bClass),
      };
    }
    const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1);
    const sampleStd = Math.sqrt(Math.max(variance, 0));
    const aClass = sampleStd / Math.sqrt(count);
    return {
      count,
      mean,
      sampleStd,
      aClass,
      bClass,
      total: Math.hypot(aClass, bClass),
    };
  }

  function inferDataLabVariableNames(state) {
    void state;
    return [];
  }

  function parseSimpleDataLabPoints(rawText) {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      throw new Error("请先输入坐标点。");
    }

    const rows = [];
    lines.forEach((line, index) => {
      const cells = splitDataLabRow(line).map((item) => item.trim()).filter(Boolean);
      if (cells.length !== 2) {
        throw new Error(`第 ${index + 1} 行格式不正确，请按 x,y 输入。`);
      }
      const x = Number(cells[0]);
      const y = Number(cells[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`第 ${index + 1} 行包含无效数值。`);
      }
      rows.push({
        index: index + 1,
        x,
        y,
      });
    });

    return { rows };
  }

  function parseDataLabTable(rawText) {
    const lines = String(rawText || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new Error("数据表至少需要包含 1 行表头和 1 行数值。");
    }

    const headers = splitDataLabRow(lines[0]).map((item) => item.trim()).filter(Boolean);
    if (!headers.length) {
      throw new Error("数据表表头不能为空。");
    }
    headers.forEach((name) => {
      if (!validateDataLabVariableName(name)) {
        throw new Error(`变量名“${name}”无效。请使用字母、数字和下划线，且不能以数字开头。`);
      }
    });
    if (new Set(headers).size !== headers.length) {
      throw new Error("数据表表头中存在重复变量名，请先修改后再计算。");
    }

    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cells = splitDataLabRow(lines[i]).map((item) => item.trim());
      if (!cells.length || cells.every((item) => !item)) continue;
      if (cells.length !== headers.length) {
        throw new Error(`第 ${i} 行数据列数与表头不一致。`);
      }
      const values = {};
      headers.forEach((name, index) => {
        const value = Number(cells[index]);
        if (!Number.isFinite(value)) {
          throw new Error(`第 ${i} 行中的 ${name} 不是有效数值。`);
        }
        values[name] = value;
      });
      rows.push({
        index: rows.length + 1,
        values,
      });
    }
    return { headers, rows };
  }

  function splitDataLabRow(line) {
    const text = String(line || "");
    if (text.includes("\t")) {
      return text.split(/\t+/);
    }
    if (/[，,;；]/.test(text)) {
      return text.split(/[，,;；]+/);
    }
    return text.trim().split(/\s+/);
  }

  function validateDataLabVariableName(name) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name || "").trim());
  }

  function filterDataLabVariableNames(variableNames, headers) {
    return (variableNames || []).filter((name) => {
      if (isDataLabConstantName(name) && !headers.includes(name)) return false;
      return !headers.length || headers.includes(name);
    });
  }

  function isDataLabConstantName(name) {
    const lowered = String(name || "").toLowerCase();
    return lowered === "pi" || lowered === "e";
  }

  function compileMathExpression(expression) {
    const source = String(expression || "").trim();
    if (!source) {
      throw new Error("公式不能为空。");
    }
    const tokens = tokenizeMathExpression(source);
    let index = 0;

    function current() {
      return tokens[index];
    }

    function consume(expectedType) {
      const token = tokens[index];
      if (!token || token.type !== expectedType) {
        throw new Error(`公式在“${token?.value || "结尾"}”附近无法解析。`);
      }
      index += 1;
      return token;
    }

    function parsePrimary() {
      const token = current();
      if (!token) {
        throw new Error("公式意外结束。");
      }
      if (token.type === "number") {
        index += 1;
        return { type: "number", value: token.value };
      }
      if (token.type === "identifier") {
        index += 1;
        const next = current();
        if (next?.type === "(") {
          consume("(");
          const args = [];
          if (current()?.type !== ")") {
            while (true) {
              args.push(parseExpression());
              if (current()?.type === ",") {
                consume(",");
                continue;
              }
              break;
            }
          }
          consume(")");
          return { type: "call", name: token.value, args };
        }
        return { type: "variable", name: token.value };
      }
      if (token.type === "(") {
        consume("(");
        const node = parseExpression();
        consume(")");
        return node;
      }
      throw new Error(`公式中出现了不支持的片段“${token.value || token.type}”。`);
    }

    function parsePower() {
      let node = parsePrimary();
      if (current()?.type === "^") {
        consume("^");
        node = {
          type: "binary",
          op: "^",
          left: node,
          right: parseUnary(),
        };
      }
      return node;
    }

    function parseUnary() {
      const token = current();
      if (token?.type === "+" || token?.type === "-") {
        index += 1;
        return {
          type: "unary",
          op: token.type,
          argument: parseUnary(),
        };
      }
      return parsePower();
    }

    function parseTerm() {
      let node = parseUnary();
      while (current()?.type === "*" || current()?.type === "/") {
        const op = current().type;
        index += 1;
        node = {
          type: "binary",
          op,
          left: node,
          right: parseUnary(),
        };
      }
      return node;
    }

    function parseExpression() {
      let node = parseTerm();
      while (current()?.type === "+" || current()?.type === "-") {
        const op = current().type;
        index += 1;
        node = {
          type: "binary",
          op,
          left: node,
          right: parseTerm(),
        };
      }
      return node;
    }

    const ast = parseExpression();
    if (current()?.type !== "EOF") {
      throw new Error(`公式在“${current()?.value || current()?.type || "结尾"}”附近存在多余内容。`);
    }
    const variableSet = new Set();
    collectAstVariables(ast, variableSet);
    return {
      source,
      ast,
      variables: [...variableSet],
    };
  }

  function tokenizeMathExpression(expression) {
    const tokens = [];
    let index = 0;
    const source = String(expression || "");

    while (index < source.length) {
      const char = source[index];
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }
      const numberMatch = source.slice(index).match(/^(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/);
      if (numberMatch) {
        tokens.push({ type: "number", value: Number(numberMatch[0]) });
        index += numberMatch[0].length;
        continue;
      }
      const identifierMatch = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (identifierMatch) {
        tokens.push({ type: "identifier", value: identifierMatch[0] });
        index += identifierMatch[0].length;
        continue;
      }
      if ("+-*/^(),".includes(char)) {
        tokens.push({ type: char, value: char });
        index += 1;
        continue;
      }
      throw new Error(`公式中包含暂不支持的字符“${char}”。`);
    }

    tokens.push({ type: "EOF", value: "" });
    return tokens;
  }

  function collectAstVariables(node, bucket) {
    if (!node || !bucket) return;
    if (node.type === "variable") {
      bucket.add(node.name);
      return;
    }
    if (node.type === "unary") {
      collectAstVariables(node.argument, bucket);
      return;
    }
    if (node.type === "binary") {
      collectAstVariables(node.left, bucket);
      collectAstVariables(node.right, bucket);
      return;
    }
    if (node.type === "call") {
      node.args.forEach((item) => collectAstVariables(item, bucket));
    }
  }

  function evaluateCompiledExpression(compiled, scope, label) {
    const value = evaluateMathAst(compiled.ast, scope);
    if (!Number.isFinite(value)) {
      throw new Error(`${label}的结果不是有效数值。`);
    }
    return value;
  }

  function evaluateMathAst(node, scope) {
    if (!node) {
      throw new Error("公式节点缺失。");
    }
    if (node.type === "number") {
      return node.value;
    }
    if (node.type === "variable") {
      if (scope && Object.prototype.hasOwnProperty.call(scope, node.name)) {
        return Number(scope[node.name]);
      }
      const lowered = node.name.toLowerCase();
      if (lowered === "pi") return Math.PI;
      if (lowered === "e") return Math.E;
      throw new Error(`变量 ${node.name} 未在数据表中提供。`);
    }
    if (node.type === "unary") {
      const value = evaluateMathAst(node.argument, scope);
      return node.op === "-" ? -value : value;
    }
    if (node.type === "binary") {
      const left = evaluateMathAst(node.left, scope);
      const right = evaluateMathAst(node.right, scope);
      if (node.op === "+") return left + right;
      if (node.op === "-") return left - right;
      if (node.op === "*") return left * right;
      if (node.op === "/") return left / right;
      if (node.op === "^") return left ** right;
      throw new Error(`暂不支持运算符 ${node.op}。`);
    }
    if (node.type === "call") {
      const fnName = node.name.toLowerCase();
      const args = node.args.map((item) => evaluateMathAst(item, scope));
      if (fnName === "sqrt") return Math.sqrt(args[0]);
      if (fnName === "abs") return Math.abs(args[0]);
      if (fnName === "sin") return Math.sin(args[0]);
      if (fnName === "cos") return Math.cos(args[0]);
      if (fnName === "tan") return Math.tan(args[0]);
      if (fnName === "asin") return Math.asin(args[0]);
      if (fnName === "acos") return Math.acos(args[0]);
      if (fnName === "atan") return Math.atan(args[0]);
      if (fnName === "exp") return Math.exp(args[0]);
      if (fnName === "ln") return Math.log(args[0]);
      if (fnName === "log") {
        if (args.length >= 2) {
          return Math.log(args[0]) / Math.log(args[1]);
        }
        return Math.log10 ? Math.log10(args[0]) : Math.log(args[0]) / Math.LN10;
      }
      if (fnName === "pow") return args[0] ** args[1];
      if (fnName === "min") return Math.min(...args);
      if (fnName === "max") return Math.max(...args);
      throw new Error(`函数 ${node.name} 暂不受支持。`);
    }
    throw new Error("未知公式节点。");
  }

  function computeAstCombinedUncertainty(compiled, scope, uncertaintyValues) {
    let sumSquares = 0;
    Object.entries(uncertaintyValues || {}).forEach(([name, uncertainty]) => {
      const u = Math.abs(Number(uncertainty || 0));
      if (!Number.isFinite(u) || u <= 0) return;
      const baseValue = Number(scope?.[name]);
      if (!Number.isFinite(baseValue)) return;
      const step = Math.max(Math.abs(baseValue) * 1e-6, u * 1e-3, 1e-7);
      const derivative = estimateCompiledDerivative(compiled, scope, name, step);
      if (!Number.isFinite(derivative)) return;
      sumSquares += (derivative * u) ** 2;
    });
    return Math.sqrt(Math.max(sumSquares, 0));
  }

  function estimateCompiledDerivative(compiled, scope, variableName, step) {
    const currentValue = Number(scope?.[variableName]);
    const center = safeEvaluateCompiled(compiled, scope);
    if (!Number.isFinite(currentValue) || !Number.isFinite(center)) return NaN;

    const forwardScope = { ...scope, [variableName]: currentValue + step };
    const backwardScope = { ...scope, [variableName]: currentValue - step };
    const forward = safeEvaluateCompiled(compiled, forwardScope);
    const backward = safeEvaluateCompiled(compiled, backwardScope);
    if (Number.isFinite(forward) && Number.isFinite(backward)) {
      return (forward - backward) / (2 * step);
    }
    if (Number.isFinite(forward)) {
      return (forward - center) / step;
    }
    if (Number.isFinite(backward)) {
      return (center - backward) / step;
    }
    return NaN;
  }

  function safeEvaluateCompiled(compiled, scope) {
    try {
      const value = evaluateMathAst(compiled.ast, scope);
      return Number.isFinite(value) ? value : NaN;
    } catch {
      return NaN;
    }
  }

  function computeDataLabFit(fitType, points) {
    const type = String(fitType || "linear").trim().toLowerCase() || "linear";
    if (type === "quadratic") return computeDataLabQuadraticFit(points);
    if (type === "exponential") return computeDataLabExponentialFit(points);
    if (type === "power") return computeDataLabPowerFit(points);
    if (type === "logarithmic") return computeDataLabLogarithmicFit(points);
    return computeDataLabLinearFit(points);
  }

  function computeDataLabLinearFit(points) {
    const line = computeDataLabLeastSquaresLine(points);
    const evaluate = (x) => line.slope * x + line.intercept;
    return {
      type: "linear",
      label: dataLabFitLabel("linear"),
      slope: line.slope,
      intercept: line.intercept,
      r2: computeDataLabR2(points, evaluate),
      formula: `y = ${formatDataLabNumber(line.slope, 6)}x ${formatSignedDataLabNumber(line.intercept, 6)}`,
      evaluate,
    };
  }

  function computeDataLabQuadraticFit(points) {
    if (!points || points.length < 3) {
      throw new Error("二次曲线拟合至少需要 3 个点。");
    }
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumX2 = points.reduce((sum, point) => sum + point.x ** 2, 0);
    const sumX3 = points.reduce((sum, point) => sum + point.x ** 3, 0);
    const sumX4 = points.reduce((sum, point) => sum + point.x ** 4, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumX2Y = points.reduce((sum, point) => sum + point.x * point.x * point.y, 0);
    const solved = solveLinearEquationSystem(
      [
        [sumX4, sumX3, sumX2],
        [sumX3, sumX2, sumX],
        [sumX2, sumX, points.length],
      ],
      [sumX2Y, sumXY, sumY],
    );
    if (!solved) {
      throw new Error("二次曲线拟合失败，请检查横坐标是否存在足够变化。");
    }
    const [a, b, c] = solved;
    const evaluate = (x) => a * x * x + b * x + c;
    return {
      type: "quadratic",
      label: dataLabFitLabel("quadratic"),
      coefficients: { a, b, c },
      r2: computeDataLabR2(points, evaluate),
      formula: `y = ${formatDataLabNumber(a, 6)}x² ${formatSignedDataLabNumber(b, 6)}x ${formatSignedDataLabNumber(c, 6)}`,
      evaluate,
    };
  }

  function computeDataLabExponentialFit(points) {
    const validPoints = points.filter((point) => point.y > 0);
    if (validPoints.length !== points.length) {
      throw new Error("指数曲线拟合要求所有 y 值大于 0。");
    }
    const line = computeDataLabLeastSquaresLine(validPoints.map((point) => ({ x: point.x, y: Math.log(point.y) })));
    const a = Math.exp(line.intercept);
    const b = line.slope;
    const evaluate = (x) => a * Math.exp(b * x);
    return {
      type: "exponential",
      label: dataLabFitLabel("exponential"),
      coefficients: { a, b },
      r2: computeDataLabR2(points, evaluate),
      formula: `y = ${formatDataLabNumber(a, 6)}e^(${formatDataLabNumber(b, 6)}x)`,
      evaluate,
    };
  }

  function computeDataLabPowerFit(points) {
    const validPoints = points.filter((point) => point.x > 0 && point.y > 0);
    if (validPoints.length !== points.length) {
      throw new Error("幂函数拟合要求所有 x、y 值都大于 0。");
    }
    const line = computeDataLabLeastSquaresLine(
      validPoints.map((point) => ({ x: Math.log(point.x), y: Math.log(point.y) })),
    );
    const a = Math.exp(line.intercept);
    const b = line.slope;
    const evaluate = (x) => (x > 0 ? a * x ** b : NaN);
    return {
      type: "power",
      label: dataLabFitLabel("power"),
      coefficients: { a, b },
      r2: computeDataLabR2(points, evaluate),
      formula: `y = ${formatDataLabNumber(a, 6)}x^${formatDataLabNumber(b, 6)}`,
      evaluate,
    };
  }

  function computeDataLabLogarithmicFit(points) {
    const validPoints = points.filter((point) => point.x > 0);
    if (validPoints.length !== points.length) {
      throw new Error("对数曲线拟合要求所有 x 值大于 0。");
    }
    const line = computeDataLabLeastSquaresLine(validPoints.map((point) => ({ x: Math.log(point.x), y: point.y })));
    const a = line.slope;
    const b = line.intercept;
    const evaluate = (x) => (x > 0 ? a * Math.log(x) + b : NaN);
    return {
      type: "logarithmic",
      label: dataLabFitLabel("logarithmic"),
      coefficients: { a, b },
      r2: computeDataLabR2(points, evaluate),
      formula: `y = ${formatDataLabNumber(a, 6)}ln(x) ${formatSignedDataLabNumber(b, 6)}`,
      evaluate,
    };
  }

  function computeDataLabLeastSquaresLine(points) {
    if (!points || points.length < 2) {
      throw new Error("至少需要 2 个点才能拟合。");
    }
    const n = points.length;
    const sumX = points.reduce((sum, point) => sum + point.x, 0);
    const sumY = points.reduce((sum, point) => sum + point.y, 0);
    const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
    const denominator = n * sumXX - sumX * sumX;
    if (Math.abs(denominator) < 1e-12) {
      throw new Error("当前横坐标变化不足，无法完成拟合。");
    }
    const slope = (n * sumXY - sumX * sumY) / denominator;
    return {
      slope,
      intercept: (sumY - slope * sumX) / n,
    };
  }

  function solveLinearEquationSystem(matrix, vector) {
    const size = Array.isArray(matrix) ? matrix.length : 0;
    if (!size || !Array.isArray(vector) || vector.length !== size) return null;
    const augmented = matrix.map((row, rowIndex) => [...row.map((value) => Number(value)), Number(vector[rowIndex])]);

    for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
      let pivotRow = pivotIndex;
      for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
        if (Math.abs(augmented[rowIndex][pivotIndex]) > Math.abs(augmented[pivotRow][pivotIndex])) {
          pivotRow = rowIndex;
        }
      }
      if (Math.abs(augmented[pivotRow][pivotIndex]) < 1e-12) {
        return null;
      }
      if (pivotRow !== pivotIndex) {
        [augmented[pivotIndex], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivotIndex]];
      }
      const pivot = augmented[pivotIndex][pivotIndex];
      for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
        augmented[pivotIndex][columnIndex] /= pivot;
      }
      for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
        if (rowIndex === pivotIndex) continue;
        const factor = augmented[rowIndex][pivotIndex];
        for (let columnIndex = pivotIndex; columnIndex <= size; columnIndex += 1) {
          augmented[rowIndex][columnIndex] -= factor * augmented[pivotIndex][columnIndex];
        }
      }
    }

    return augmented.map((row) => row[size]);
  }

  function computeDataLabR2(points, evaluate) {
    if (!points || !points.length || typeof evaluate !== "function") return NaN;
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const ssTot = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
    const ssRes = points.reduce((sum, point) => {
      const fitted = evaluate(point.x);
      if (!Number.isFinite(fitted)) return sum;
      return sum + (point.y - fitted) ** 2;
    }, 0);
    return ssTot > 1e-12 ? 1 - ssRes / ssTot : 1;
  }

  function buildDataLabPlotSvg(result) {
    const width = 860;
    const height = 420;
    const padLeft = 82;
    const padRight = 28;
    const padTop = 22;
    const padBottom = 62;
    const chartX0 = padLeft;
    const chartX1 = width - padRight;
    const chartY0 = padTop;
    const chartY1 = height - padBottom;
    const xMin = result.plotXMin;
    const xMax = result.plotXMax;
    const yMin = result.plotYMin;
    const yMax = result.plotYMax;
    const scaleX = (value) => chartX0 + ((value - xMin) / Math.max(xMax - xMin, 1e-12)) * (chartX1 - chartX0);
    const scaleY = (value) => chartY1 - ((value - yMin) / Math.max(yMax - yMin, 1e-12)) * (chartY1 - chartY0);
    const xTicks = createDataLabTicks(xMin, xMax, 6);
    const yTicks = createDataLabTicks(yMin, yMax, 6);

    const gridX = xTicks.map((tick) => {
      const x = scaleX(tick);
      return `
        <line x1="${x}" y1="${chartY0}" x2="${x}" y2="${chartY1}" stroke="rgba(72, 96, 132, 0.14)" stroke-width="1" />
        <text x="${x}" y="${chartY1 + 24}" text-anchor="middle" fill="#50627f" font-size="12">${escapeHtml(formatDataLabNumber(tick, 5))}</text>
      `;
    }).join("");

    const gridY = yTicks.map((tick) => {
      const y = scaleY(tick);
      return `
        <line x1="${chartX0}" y1="${y}" x2="${chartX1}" y2="${y}" stroke="rgba(72, 96, 132, 0.14)" stroke-width="1" />
        <text x="${chartX0 - 12}" y="${y + 4}" text-anchor="end" fill="#50627f" font-size="12">${escapeHtml(formatDataLabNumber(tick, 5))}</text>
      `;
    }).join("");

    const fitLine = buildDataLabFitCurvePath(result, scaleX, scaleY, xMin, xMax);

    const pointMarkup = result.points.map((point) => {
      const x = scaleX(point.x);
      const y = scaleY(point.y);
      const ux = Math.abs(Number(point.ux || 0));
      const uy = Math.abs(Number(point.uy || 0));
      const errorParts = [];

      if (ux > 0) {
        const left = scaleX(point.x - ux);
        const right = scaleX(point.x + ux);
        errorParts.push(`
          <line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="rgba(62, 89, 135, 0.72)" stroke-width="1.4" />
          <line x1="${left}" y1="${y - 6}" x2="${left}" y2="${y + 6}" stroke="rgba(62, 89, 135, 0.72)" stroke-width="1.4" />
          <line x1="${right}" y1="${y - 6}" x2="${right}" y2="${y + 6}" stroke="rgba(62, 89, 135, 0.72)" stroke-width="1.4" />
        `);
      }

      if (uy > 0) {
        const top = scaleY(point.y + uy);
        const bottom = scaleY(point.y - uy);
        errorParts.push(`
          <line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="rgba(62, 89, 135, 0.72)" stroke-width="1.4" />
          <line x1="${x - 6}" y1="${top}" x2="${x + 6}" y2="${top}" stroke="rgba(62, 89, 135, 0.72)" stroke-width="1.4" />
          <line x1="${x - 6}" y1="${bottom}" x2="${x + 6}" y2="${bottom}" stroke="rgba(62, 89, 135, 0.72)" stroke-width="1.4" />
        `);
      }

      return `
        <g>
          ${errorParts.join("")}
          <circle cx="${x}" cy="${y}" r="5.5" fill="rgba(79, 114, 255, 0.96)" stroke="rgba(255,255,255,0.92)" stroke-width="2" />
        </g>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="实验数据图像">
        <rect x="0" y="0" width="${width}" height="${height}" fill="transparent"></rect>
        <text x="${chartX0}" y="${height - 16}" fill="#2e415f" font-size="13" font-weight="600">${escapeHtml(formatAxisLabel(result.xLabel, result.xUnit))}</text>
        <text x="26" y="${chartY0}" fill="#2e415f" font-size="13" font-weight="600" transform="rotate(-90 26 ${chartY0})">${escapeHtml(formatAxisLabel(result.yLabel, result.yUnit))}</text>
        <rect x="${chartX0}" y="${chartY0}" width="${chartX1 - chartX0}" height="${chartY1 - chartY0}" rx="22" fill="rgba(255,255,255,0.56)" stroke="rgba(74, 94, 129, 0.12)" />
        ${gridX}
        ${gridY}
        <line x1="${chartX0}" y1="${chartY1}" x2="${chartX1}" y2="${chartY1}" stroke="#425673" stroke-width="1.8" />
        <line x1="${chartX0}" y1="${chartY1}" x2="${chartX0}" y2="${chartY0}" stroke="#425673" stroke-width="1.8" />
        ${fitLine}
        ${pointMarkup}
      </svg>
    `;
  }

  function buildDataLabFitCurvePath(result, scaleX, scaleY, xMin, xMax) {
    if (!result?.fit?.evaluate) return "";
    const stepCount = 120;
    const commands = [];
    for (let index = 0; index <= stepCount; index += 1) {
      const ratio = index / stepCount;
      const x = xMin + (xMax - xMin) * ratio;
      const y = result.fit.evaluate(x);
      if (!Number.isFinite(y) || Math.abs(y) > 1e9) continue;
      const px = scaleX(x);
      const py = scaleY(y);
      commands.push(`${commands.length ? "L" : "M"} ${px} ${py}`);
    }
    if (!commands.length) return "";
    return `
      <path
        d="${commands.join(" ")}"
        fill="none"
        stroke="rgba(226, 109, 130, 0.92)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    `;
  }

  function buildDataLabPlaceholder(message) {
    return `<div class="data-lab-placeholder">${escapeHtml(message)}</div>`;
  }

  function createDataLabTicks(min, max, count = 6) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    if (Math.abs(max - min) < 1e-12) {
      return [min];
    }
    return Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));
  }

  function computeDataLabPadding(min, max) {
    const span = max - min;
    if (Number.isFinite(span) && span > 1e-12) {
      return span * 0.08;
    }
    const fallback = Math.max(Math.abs(max || 0), Math.abs(min || 0), 1);
    return fallback * 0.16;
  }

  function formatAxisLabel(label, unit) {
    const cleanLabel = String(label || "").trim() || "物理量";
    const cleanUnit = String(unit || "").trim();
    return cleanUnit ? `${cleanLabel} (${cleanUnit})` : cleanLabel;
  }

  function formatUncertaintyValue(value, unit, digits = 4) {
    const numberText = formatDataLabNumber(value, digits);
    const cleanUnit = String(unit || "").trim();
    return cleanUnit ? `${numberText} ${cleanUnit}` : numberText;
  }

  function formatDataLabNumber(value, digits = 4) {
    if (!Number.isFinite(value)) return "--";
    const abs = Math.abs(value);
    if (abs < 1e-15) return "0";
    if (abs >= 1e4 || abs < 1e-3) {
      return value.toExponential(Math.max(1, digits - 1)).replace(/(?:\.0+|(\.\d*?[1-9])0+)e/, "$1e");
    }
    const fixedDigits = abs >= 100 ? Math.max(0, digits - 3) : abs >= 10 ? Math.max(1, digits - 3) : digits;
    return value.toFixed(fixedDigits).replace(/\.?0+$/, "");
  }

  function formatSignedDataLabNumber(value, digits = 4) {
    const absText = formatDataLabNumber(Math.abs(value), digits);
    return value < 0 ? `- ${absText}` : `+ ${absText}`;
  }

  function buildDataLabUncertaintySummaryMarkup(title, axisLabel, unit, data) {
    if (!data) return "";
    const axisText = escapeHtml(formatAxisLabel(axisLabel, unit));
    return `
      <section class="data-lab-summary-section">
        <div class="data-lab-summary-section-head">
          <strong>${escapeHtml(title)}</strong>
          <span>${axisText}</span>
        </div>
        <div class="data-lab-summary-grid">
          <div class="data-lab-summary-chip">
            <span>平均值</span>
            <strong>${escapeHtml(formatUncertaintyValue(data.mean, unit))}</strong>
          </div>
          <div class="data-lab-summary-chip">
            <span>A 类</span>
            <strong>${escapeHtml(formatUncertaintyValue(data.aClass, unit))}</strong>
          </div>
          <div class="data-lab-summary-chip">
            <span>B 类</span>
            <strong>${escapeHtml(formatUncertaintyValue(data.bClass, unit))}</strong>
          </div>
          <div class="data-lab-summary-chip is-total">
            <span>总不确定度</span>
            <strong>${escapeHtml(formatUncertaintyValue(data.total, unit))}</strong>
          </div>
        </div>
      </section>
    `;
  }

  async function uploadFiles(files) {
    if (APP.auth.user?.role !== "teacher") {
      showToast("学生端当前不开放外部知识库上传");
      return;
    }
    setUploadStatus(`正在上传 ${files.length} 个文件...`);
    const lastAttachment = [...files]
      .reverse()
      .find((file) => file.type.startsWith("image/") || file.type.startsWith("audio/"));

    const form = new FormData();
    form.append("session_id", APP.sessionId);
    form.append("target_scope", APP.uploadScope || "session");
    files.forEach((file) => form.append("files", file));

    try {
      const response = await fetch("/api/upload", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || `上传失败 (${response.status})`);
      }

      const uploadedDocEntries = Array.isArray(data.uploaded_documents) ? data.uploaded_documents : [];
      const docEntries = Array.isArray(data.documents) ? data.documents : uploadedDocEntries;
      const imgEntries = Array.isArray(data.images) ? data.images : [];
      const audioEntries = Array.isArray(data.audios) ? data.audios : [];
      const skipped = Array.isArray(data.skipped) ? data.skipped : [];

      renderUploadedFileList(docEntries, imgEntries, audioEntries, skipped);

      if (lastAttachment?.type.startsWith("image/") && imgEntries.length > 0) {
        const latest = imgEntries.find((item) => item.name === lastAttachment.name) || imgEntries[imgEntries.length - 1];
        APP.pendingImage = {
          base64: latest.image_base64,
          mime: latest.image_mime || "image/jpeg",
          name: latest.name || "已上传图片",
        };
        APP.pendingAudio = null;
      } else if (lastAttachment?.type.startsWith("audio/") && audioEntries.length > 0) {
        const latest = audioEntries.find((item) => item.name === lastAttachment.name) || audioEntries[audioEntries.length - 1];
        APP.pendingAudio = {
          base64: latest.audio_base64,
          mime: latest.audio_mime || "audio/webm",
          name: latest.name || "已上传音频",
        };
        APP.pendingImage = null;
      }

      updatePendingAttachmentBars();

      const summary = [];
      if (uploadedDocEntries.length) summary.push(`文档 ${uploadedDocEntries.length}`);
      if (imgEntries.length) summary.push(`图片 ${imgEntries.length}`);
      if (audioEntries.length) summary.push(`音频 ${audioEntries.length}`);
      if (skipped.length) summary.push(`跳过 ${skipped.length}`);
      setUploadStatus(
        summary.length
          ? `上传完成：${summary.join("，")}`
          : getDocumentStatusText(Number(data.doc_count || docEntries.length || 0))
      );
    } catch (error) {
      setUploadStatus(`上传失败：${error.message}`);
    }
  }
  function getDocumentStatusText(docCount) {
    if (APP.auth.user?.role === "student") {
      return "学生端不展示教师知识库，当前仅保留学生会话与实验问答";
    }
    if (APP.uploadScope === "teacher_kb" && APP.auth.user?.role === "teacher") {
      return docCount ? `教师知识库已纳入 ${docCount} 份可检索资料` : "教师知识库当前为空，可上传外部资料";
    }
    if (APP.runtime.isLiteBackend) {
      return docCount
        ? `已加载 ${docCount} 份资料；手机轻后端现已支持新增 PDF 入库、拍照与图片分析`
        : "手机轻后端已就绪，可直接上传 PDF、拍照、选择图片或音频";
    }
    return docCount ? `已加载 ${docCount} 份资料` : "未加载资料";
  }

  function renderUploadedFileList(docEntries, imgEntries = [], audioEntries = [], skipped = []) {
    const items = [];

    docEntries.forEach((doc, index) => {
      const name = doc.name || doc.original_name || `文档 ${index + 1}`;
      const chars = Number(doc.chars || doc.char_count || 0);
      const prefix = doc.knowledge_scope === "teacher_kb"
        ? "[教师知识库] "
        : doc.knowledge_scope === "platform_kb" || doc.is_external
          ? "[平台资料] "
          : "";
      items.push(`${prefix}${name}：${chars} 字`);
    });

    imgEntries.forEach((item) => {
      items.push(`${item.name || "图片"}：已就绪（视觉分析）`);
    });

    audioEntries.forEach((item) => {
      items.push(`${item.name || "音频"}：已就绪（语音分析）`);
    });

    skipped.forEach((item) => {
      items.push(`${item.name || "未知文件"}：已跳过（${item.reason || "未知原因"}）`);
    });

    if (!els.uploadedFiles) return;
    els.uploadedFiles.innerHTML = "";
    items.slice(-8).forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      els.uploadedFiles.appendChild(li);
    });
  }
  function setUploadStatus(text) {
    if (els.uploadStatus) {
      els.uploadStatus.textContent = text;
    }
  }

  async function clearDocuments() {
    if (APP.auth.user?.role !== "teacher") {
      showToast("学生端当前不开放资料清理");
      return;
    }
    try {
      const response = await fetch(
        `/api/clear-docs?session_id=${encodeURIComponent(APP.sessionId)}&target_scope=${encodeURIComponent(APP.uploadScope || "session")}`,
        { method: "DELETE" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      APP.pendingImage = null;
      APP.pendingAudio = null;
      updatePendingAttachmentBars();
      renderUploadedFileList(Array.isArray(data.documents) ? data.documents : []);
      setUploadStatus(getDocumentStatusText(Number(data.doc_count || 0)));
      await loadSessionCatalog();
    } catch (error) {
      showToast(`清空文档失败：${error.message}`);
    }
  }

  async function loadTeacherStats({ force = false } = {}) {
    if (APP.auth.user?.role !== "teacher") {
      APP.teacherStats = { loading: false, loaded: false, error: "", data: null };
      renderTeacherStats();
      return;
    }
    if (APP.teacherStats.loading || (APP.teacherStats.loaded && !force)) {
      renderTeacherStats();
      return;
    }
    APP.teacherStats.loading = true;
    APP.teacherStats.error = "";
    renderTeacherStats();
    try {
      const response = await fetch("/api/teacher/student-question-stats?limit=80");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `HTTP ${response.status}`);
      }
      APP.teacherStats = {
        loading: false,
        loaded: true,
        error: "",
        data,
      };
      renderTeacherStats();
    } catch (error) {
      APP.teacherStats.loading = false;
      APP.teacherStats.loaded = true;
      APP.teacherStats.error = error?.message || "统计加载失败";
      renderTeacherStats();
      showToast(`学生问题统计加载失败：${APP.teacherStats.error}`);
    }
  }

  async function exportTeacherStats() {
    if (APP.auth.user?.role !== "teacher") {
      showToast("仅教师端可以导出学生问题统计");
      return;
    }
    const button = els.exportTeacherStatsBtn;
    const oldHtml = button?.innerHTML || "";
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i class="ri-loader-4-line"></i><span>导出中</span>';
    }
    try {
      const response = await fetch("/api/teacher/student-question-stats/export");
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const matched = disposition.match(/filename="?([^"]+)"?/i);
      const filename = matched?.[1] || `student-question-stats-${Date.now()}.csv`;
      downloadBlob(blob, filename);
      showToast(`已开始导出表格：${filename}`);
    } catch (error) {
      showToast(`导出统计失败：${error.message || "未知错误"}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = oldHtml;
      }
    }
  }

  function renderTeacherStats() {
    const state = APP.teacherStats || {};
    const data = state.data || {};
    const summary = data.summary || {};
    const isTeacher = APP.auth.user?.role === "teacher";
    els.teacherStatsSection?.classList.toggle("hidden", !isTeacher);
    if (!isTeacher) return;

    const questionCount = Number(summary.question_count || 0);
    const studentCount = Number(summary.student_count || 0);
    const sessionCount = Number(summary.session_count || 0);
    if (els.teacherStatsQuestionCount) els.teacherStatsQuestionCount.textContent = String(questionCount);
    if (els.teacherStatsStudentCount) els.teacherStatsStudentCount.textContent = String(studentCount);
    if (els.teacherStatsSessionCount) els.teacherStatsSessionCount.textContent = String(sessionCount);
    if (els.teacherStatsMeta) {
      if (state.loading) {
        els.teacherStatsMeta.textContent = "加载中";
      } else if (state.error) {
        els.teacherStatsMeta.textContent = "加载失败";
      } else if (state.loaded) {
        els.teacherStatsMeta.textContent = summary.latest_question_at
          ? `最近 ${formatDateTime(summary.latest_question_at)}`
          : "暂无数据";
      } else {
        els.teacherStatsMeta.textContent = "待加载";
      }
    }
    if (els.refreshTeacherStatsBtn) {
      els.refreshTeacherStatsBtn.disabled = Boolean(state.loading);
    }
    if (els.exportTeacherStatsBtn) {
      els.exportTeacherStatsBtn.disabled = Boolean(state.loading) || !questionCount;
    }

    const topQuestions = Array.isArray(data.top_questions) ? data.top_questions : [];
    if (els.teacherTopQuestions) {
      els.teacherTopQuestions.innerHTML = topQuestions.length
        ? topQuestions.map((item) => `
            <li>
              <span>${escapeHtml(truncateText(item.question || "", 48))}</span>
              <strong>${escapeHtml(String(item.count || 0))} 次</strong>
            </li>
          `).join("")
        : '<li class="teacher-question-empty">暂无高频问题</li>';
    }

    const recentQuestions = Array.isArray(data.recent_questions) ? data.recent_questions : [];
    if (els.teacherRecentQuestions) {
      els.teacherRecentQuestions.innerHTML = recentQuestions.length
        ? recentQuestions.slice(0, 8).map((item) => `
            <li>
              <span>${escapeHtml(truncateText(item.content || "", 54))}</span>
              <small>${escapeHtml(item.student_name || "学生")} · ${escapeHtml(formatDateTime(item.created_at))}</small>
            </li>
          `).join("")
        : '<li class="teacher-question-empty">暂无近期提问</li>';
    }
  }

  function downloadBlob(blob, filename) {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1600);
  }
  function updatePendingAttachmentBars() {
    if (els.pendingImageBar && els.pendingImageText) {
      if (!APP.pendingImage) {
        els.pendingImageBar.classList.add("hidden");
      } else {
        els.pendingImageText.textContent = `图片【${APP.pendingImage.name}】已就绪，下一条消息将调用视觉模型`;
        els.pendingImageBar.classList.remove("hidden");
      }
    }

    if (els.pendingAudioBar && els.pendingAudioText) {
      if (!APP.pendingAudio) {
        els.pendingAudioBar.classList.add("hidden");
      } else {
        els.pendingAudioText.textContent = `语音【${APP.pendingAudio.name}】已就绪，下一条消息将调用音频模型`;
        els.pendingAudioBar.classList.remove("hidden");
      }
    }
  }

  async function hydrateSession() {
    if (APP.auth.enabled && !APP.auth.user) {
      return;
    }
    const response = await fetch(`/api/session?session_id=${encodeURIComponent(APP.sessionId)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    APP.isHydrating = false;
    APP.currentSessionTitle = data.title || "新对话";
    APP.history = buildRecentQuestions(data.messages || []);
    saveHistory(APP.history);
    await loadSessionCatalog();
    renderUploadedFileList(data.documents || []);
    setUploadStatus(getDocumentStatusText(Number(data.doc_count || 0)));
    if (data.last_model && els.modelBadge) {
      els.modelBadge.textContent = data.last_model;
    }
    if (APP.auth.user?.role === "teacher") {
      loadTeacherStats().catch((error) => {
        APP.teacherStats.error = error?.message || "统计加载失败";
        renderTeacherStats();
      });
    }
    renderConversation(data.messages || []);
    if (!Array.isArray(data.messages) || !data.messages.length) {
      return;
    }
  }

  function renderConversation(messages) {
    els.chatMessages.innerHTML = "";
    messages.forEach((message) => {
      if (message.role === "user") {
        appendUserMessage(message.content || "", { rowId: message.id || `user-${Date.now()}` });
        return;
      }
      const content = message.status === "error" ? (message.content || "上次回复已中断") : message.content;
      appendAgentMessage(content || "模型未返回可用结果", { rowId: message.id || `assistant-${Date.now()}` });
    });
    refreshQuickJumpPanel();
  }

  function buildRecentQuestions(messages) {
    return messages
      .filter((message) => message.role === "user")
      .slice(-50)
      .reverse()
      .map((message, index) => ({
        id: message.id || `history-${index}`,
        text: message.content || "",
        at: Date.parse(message.created_at || "") || Date.now(),
      }));
  }

  async function sendMessage(text, options = {}) {
    if (APP.auth.enabled && !APP.auth.user) {
      setAuthGateVisible(true);
      showToast("请先登录后再开始提问");
      return;
    }
    const hiddenImage = options.hiddenImage || null;
    const effectiveImage = hiddenImage || APP.pendingImage;
    const effectiveAudio = hiddenImage ? null : APP.pendingAudio;
    if (shouldRouteToTorsionAnalysis(text, options)) {
      if (!APP.torsion.videoFile) {
        openTorsionLabModal();
        APP.torsion.error = "请先选择扭摆实验视频，再进行自动测量。";
        renderTorsionLab();
        showToast(APP.torsion.error);
        return;
      }
      els.chatInput.value = "";
      autoResizeTextarea(els.chatInput);
      await analyzeTorsionVideo({ prompt: text || "帮我用扭摆法测转动惯量" });
      return;
    }
    if (shouldRouteToPendulumAnalysis(text, options)) {
      if (!APP.pendulum.videoFile) {
        openPendulumLabModal();
        APP.pendulum.error = "请先选择或录制单摆实验视频，再进行自动测量。";
        renderPendulumLab();
        showToast(APP.pendulum.error);
        return;
      }
      els.chatInput.value = "";
      autoResizeTextarea(els.chatInput);
      await analyzePendulumVideo({ prompt: text || "帮我测单摆周期" });
      return;
    }
    if (APP.sending || (!text && !effectiveImage && !effectiveAudio)) return;

    APP.sending = true;
    if (els.sendBtn) els.sendBtn.disabled = true;
    if (els.recordBtn) els.recordBtn.disabled = true;

    const inputText = buildOutgoingDisplayText(text, options);
    appendUserMessage(inputText, { rowId: `temp-user-${Date.now()}` });
    if (text) {
      pushHistory(text);
    }

    els.chatInput.value = "";
    autoResizeTextarea(els.chatInput);

    const loadingRow = appendLoadingMessage();
    let streamingRow = null;
    let fullAnswer = "";
    let sseBuffer = "";

    try {
      const payload = {
        session_id: APP.sessionId,
        message: text,
      };

      if (options.externalLabContext) {
        payload.external_lab_context = options.externalLabContext;
      }

      if (effectiveImage?.base64) {
        payload.image_b64 = effectiveImage.base64;
        payload.image_base64 = effectiveImage.base64;
        payload.image_mime = effectiveImage.mime;
      }

      if (effectiveAudio?.base64) {
        payload.audio_base64 = effectiveAudio.base64;
        payload.audio_mime = effectiveAudio.mime;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `请求失败 (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorMessage;
        } catch {
          if (errorText.trim()) errorMessage = errorText.trim();
        }
        throw new Error(errorMessage);
      }

      if (contentType.includes("application/json")) {
        loadingRow.remove();
        const data = await response.json().catch(() => ({}));
        const answer = (data.answer || "").trim() || "模型未返回可用结果";
        if (data.model && els.modelBadge) {
          els.modelBadge.textContent = data.model;
        }
        await playSyntheticAgentStream(answer, data.model || els.modelBadge?.textContent || "");
        if (!hiddenImage) {
          APP.pendingImage = null;
        }
        if (effectiveAudio?.base64) {
          APP.pendingAudio = null;
        }
        updatePendingAttachmentBars();
        await loadSessionCatalog();
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) {
        throw new Error("浏览器不支持流式响应读取");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const eventBlocks = sseBuffer.split("\n\n");
        sseBuffer = eventBlocks.pop() || "";

        for (const block of eventBlocks) {
          const dataLines = block
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("data:"));

          if (!dataLines.length) continue;

          const payloadText = dataLines.map((line) => line.slice(5).trimStart()).join("\n");

          let eventData;
          try {
            eventData = JSON.parse(payloadText);
          } catch {
            continue;
          }

          if (eventData.type === "model") {
            if (eventData.model && els.modelBadge) {
              els.modelBadge.textContent = eventData.model;
            }
            continue;
          }

          if (eventData.type === "chunk") {
            if (!streamingRow) {
              loadingRow.remove();
              streamingRow = createStreamingAgentMessage(els.modelBadge?.textContent || "");
            }
            fullAnswer += eventData.text || "";
            updateStreamingAgentMessage(streamingRow, fullAnswer);
            continue;
          }

          if (eventData.type === "error") {
            throw new Error(eventData.message || "娴佸紡杈撳嚭澶辫触");
          }
        }
      }

      if (streamingRow) {
        finalizeStreamingAgentMessage(streamingRow, fullAnswer || "模型未返回可用结果");
      } else {
        loadingRow.remove();
        appendAgentMessage(fullAnswer || "模型未返回可用结果");
      }

      if (!hiddenImage) {
        APP.pendingImage = null;
      }
      if (effectiveAudio?.base64) {
        APP.pendingAudio = null;
      }
      updatePendingAttachmentBars();
      await loadSessionCatalog();
    } catch (error) {
      loadingRow.remove();
      if (streamingRow && fullAnswer) {
        finalizeStreamingAgentMessage(streamingRow, `${fullAnswer}\n\n> 请求中断：${error.message}`);
      } else {
        appendAgentMessage(`请求失败：${error.message}`);
      }
    } finally {
      APP.sending = false;
      if (els.sendBtn) els.sendBtn.disabled = false;
      if (els.recordBtn) els.recordBtn.disabled = false;
      scrollChatToBottom();
      refreshQuickJumpPanel();
    }
  }

  function normalizeLabPrefix(text) {
    return String(text || "").replace(/^\[PhET课外实验：/u, "[课外仿真实验：");
  }

  function appendUserMessage(text, { rowId = null } = {}) {
    if (!els.chatMessages) return;
    const normalizedText = normalizeLabPrefix(text);

    const row = document.createElement("div");
    row.className = "message-row user fade-up";
    row.id = rowId || `user-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    row.dataset.jumpRole = "user";
    row.dataset.jumpLabel = truncateText(`提问：${String(normalizedText || "[空消息]").replace(/\s+/g, " ")}`, 22);

    const bubble = document.createElement("div");
    bubble.className = "bubble user";
    bubble.textContent = normalizedText;

    row.appendChild(bubble);
    els.chatMessages.appendChild(row);
    scrollChatToBottom();
    refreshQuickJumpPanel();
  }

  function buildOutgoingDisplayText(text, options = {}) {
    const externalLabContext = options.externalLabContext || null;
    const baseText = text || (APP.pendingAudio ? "[语音提问]" : APP.pendingImage ? "[图片提问]" : "[空消息]");
    if (!externalLabContext?.provider || externalLabContext.provider !== "phet") {
      return baseText;
    }
    const title = externalLabContext.title_zh || externalLabContext.title_en || externalLabContext.slug || "未命名实验";
    return `[课外仿真实验：${title}]\n${baseText}`;
  }

  function appendAgentMessage(rawText, { rowId = null } = {}) {
    if (!els.chatMessages) return;

    const row = document.createElement("div");
    row.className = "message-row agent fade-up";
    row.id = rowId || `assistant-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    row.dataset.jumpRole = "agent";
    row.dataset.jumpLabel = truncateText(`回答：${String(rawText || "模型未返回可用结果").replace(/\s+/g, " ")}`, 22);

    const bubble = document.createElement("div");
    bubble.className = "bubble agent";

    bubble.innerHTML = `<div class="markdown-body">${renderContent(rawText)}</div>`;

    row.appendChild(bubble);
    els.chatMessages.appendChild(row);
    scrollChatToBottom();
  }

  function createStreamingAgentMessage(modelName = "") {
    if (!els.chatMessages) return null;

    const row = document.createElement("div");
    row.className = "message-row agent fade-up";
    row.id = `assistant-stream-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    row.dataset.jumpRole = "agent";
    row.dataset.jumpLabel = "回答：正在生成...";

    const bubble = document.createElement("div");
    bubble.className = "bubble agent";
    bubble.innerHTML = '<div class="markdown-body streaming-active"><span class="streaming-cursor"></span></div>';

    row.appendChild(bubble);
    row._streamText = "";
    row._renderRAF = null;
    els.chatMessages.appendChild(row);

    if (modelName && els.modelBadge) {
      els.modelBadge.textContent = modelName;
    }

    scrollChatToBottom();
    return row;
  }

  function splitPlainStreamSegments(text) {
    const segments = [];
    const parts = String(text || "").split(/(\s+|[，。！？；：,.!?、:\n])/);
    let buffer = "";
    parts.forEach((part) => {
      if (!part) return;
      buffer += part;
      const trimmed = buffer.trimEnd();
      const shouldFlush = trimmed.length >= 18 || /[\n。！？!?]$/.test(trimmed);
      if (shouldFlush) {
        segments.push(buffer);
        buffer = "";
      }
    });
    if (buffer) {
      segments.push(buffer);
    }
    return segments;
  }

  function buildSyntheticStreamSegments(text) {
    const source = String(text || "");
    const segments = [];
    const blockPattern = /(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$(?!\$)(?:[^$\n\\]|\\.)*?\$(?!\$))/g;
    let cursor = 0;

    for (const match of source.matchAll(blockPattern)) {
      const index = match.index || 0;
      if (index > cursor) {
        segments.push(...splitPlainStreamSegments(source.slice(cursor, index)));
      }
      segments.push(match[0]);
      cursor = index + match[0].length;
    }

    if (cursor < source.length) {
      segments.push(...splitPlainStreamSegments(source.slice(cursor)));
    }

    return segments.filter(Boolean);
  }

  function streamSegmentDelay(segment, baseDelay) {
    const clean = String(segment || "").trim();
    if (!clean) return 0;
    if (/^```|^\$\$|^\\\[|^\\\(|^\$/.test(clean)) return baseDelay + 14;
    if (/[。！？!?]$/.test(clean)) return baseDelay + 14;
    if (/[，；、,:]$/.test(clean)) return baseDelay + 6;
    if (/\n/.test(clean)) return baseDelay + 8;
    return baseDelay;
  }

  async function playSyntheticAgentStream(answer, modelName = "") {
    const text = String(answer || "").trim() || "模型未返回可用结果";
    const row = createStreamingAgentMessage(modelName);
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!row) return;
    if (prefersReducedMotion || text.length > 12000) {
      finalizeStreamingAgentMessage(row, text);
      return;
    }

    const segments = buildSyntheticStreamSegments(text);
    const baseDelay = text.length > 1800 ? 10 : text.length > 900 ? 14 : 18;
    let built = "";
    for (const segment of segments) {
      built += segment;
      updateStreamingAgentMessage(row, built);
      const delay = streamSegmentDelay(segment, baseDelay);
      if (delay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
    }
    finalizeStreamingAgentMessage(row, built);
  }

  function updateStreamingAgentMessage(row, text) {
    if (!row) return;
    row._streamText = text;
    if (row._renderRAF) return;
    row._renderRAF = requestAnimationFrame(() => {
      row._renderRAF = null;
      const el = row.querySelector(".markdown-body");
      if (!el) return;
      el.innerHTML = renderContent(row._streamText);
      _appendStreamCursor(el);
      scrollChatToBottom();
    });
  }

  function _appendStreamCursor(container) {
    let target = container;
    while (target.lastElementChild) {
      const last = target.lastElementChild;
      const tag = (last.tagName || "").toLowerCase();
      if (["br", "hr", "img", "svg", "canvas", "table"].includes(tag)) break;
      if (last.classList.contains("katex-display") || last.classList.contains("katex")) break;
      target = last;
    }
    const cursor = document.createElement("span");
    cursor.className = "streaming-cursor";
    target.appendChild(cursor);
  }

  function finalizeStreamingAgentMessage(row, text) {
    if (!row) return;
    if (row._renderRAF) {
      cancelAnimationFrame(row._renderRAF);
      row._renderRAF = null;
    }
    const contentEl = row.querySelector(".markdown-body");
    if (!contentEl) return;
    contentEl.classList.remove("streaming-active");
    contentEl.innerHTML = renderContent(text);
    row.dataset.jumpLabel = truncateText(`回答：${String(text || "模型未返回可用结果").replace(/\s+/g, " ")}`, 22);
    scrollChatToBottom();
    refreshQuickJumpPanel();
  }

  function renderContent(rawText) {
    const source = String(rawText ?? "");
    const mathBlocks = [];

    let protectedText = source
      .replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      });

    protectedText = protectedText
      .replace(/\\\[([\s\S]*?)\\\]/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      })
      .replace(/\\\(([\s\S]*?)\\\)/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      })
      .replace(/\$(?!\$)((?:[^$\n\\]|\\.)*?)\$(?!\$)/g, (match) => {
        const token = `@@MATH_BLOCK_${mathBlocks.length}@@`;
        mathBlocks.push(match);
        return token;
      });

    let html = window.marked ? marked.parse(protectedText) : escapeHtml(protectedText);
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/@@MATH_BLOCK_(\d+)@@/g, (_, index) => mathBlocks[Number(index)] || "");

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    renderMath(wrapper);
    return wrapper.innerHTML;
  }

  function appendLoadingMessage() {
    if (!els.chatMessages) return document.createElement("div");

    const row = document.createElement("div");
    row.className = "message-row agent fade-up";

    const bubble = document.createElement("div");
    bubble.className = "bubble agent loading";
    bubble.textContent = "正在思考中...";

    row.appendChild(bubble);
    els.chatMessages.appendChild(row);
    scrollChatToBottom();
    return row;
  }

  function renderMath(root) {
    if (!window.renderMathInElement || !root) return;

    renderMathInElement(root, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }

  function scrollChatToBottom() {
    if (!els.chatMessages) return;
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    const preservedScrollers = [];
    let parent = textarea.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (/(auto|scroll|overlay)/.test(style.overflowY)) {
        preservedScrollers.push([parent, parent.scrollTop]);
      }
      parent = parent.parentElement;
    }
    const pageScrollTop = window.scrollY;
    const maxHeight = Number(textarea.dataset.maxHeight || 148);
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    preservedScrollers.forEach(([element, top]) => {
      element.scrollTop = top;
    });
    window.scrollTo(window.scrollX, pageScrollTop);
  }

  function pushHistory(text) {
    APP.history.unshift({
      id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      text,
      at: Date.now(),
    });

    APP.history = APP.history.slice(0, 50);
    saveHistory(APP.history);
  }

  function renderSessionCatalog() {
    if (!els.historyList) return;

    els.historyList.innerHTML = "";
    const projects = APP.sessionCatalog.folders || [];
    const sessions = APP.sessionCatalog.sessions || [];
    const rootSessions = sessions.filter((item) => !item.folder_id);

    if (!projects.length && !rootSessions.length) {
      const li = document.createElement("li");
      li.className = "history-empty";
      li.textContent = "开始提问后，对话会出现在这里";
      els.historyList.appendChild(li);
      return;
    }

    projects.forEach((project) => {
      const li = document.createElement("li");
      const projectSessions = sessions.filter((item) => item.folder_id === project.id);
      const isOpen = APP.folderOpenMap[project.id] !== false;
      const menuOpen = APP.openMenuId === `folder:${project.id}`;

      li.className = "history-folder";
      li.innerHTML = `
        <div class="folder-shell" data-drop-folder="${project.id}">
          <div class="folder-header">
            <button type="button" class="folder-info text-btn" data-action="toggle-folder" data-folder-id="${project.id}">
              <span class="folder-chevron"><i class="ri-${isOpen ? "arrow-down-s-line" : "arrow-right-s-line"}"></i></span>
              <span class="folder-leading-icon"><i class="ri-folder-2-line"></i></span>
              <span class="folder-name">${escapeHtml(project.name)}</span>
              <span class="folder-count">${project.session_count ?? projectSessions.length}</span>
            </button>
            <div class="row-hover-actions">
              <button type="button" class="row-menu-trigger" data-action="toggle-folder-menu" data-folder-id="${project.id}" aria-label="项目操作">
                <i class="ri-more-2-fill"></i>
              </button>
              <div class="row-popover-menu${menuOpen ? "" : " hidden"}">
                <button type="button" class="row-popover-item" data-action="new-session-in-folder" data-folder-id="${project.id}">
                  <i class="ri-chat-new-line"></i>
                  <span>新建对话</span>
                </button>
                <button type="button" class="row-popover-item" data-action="rename-folder" data-folder-id="${project.id}">
                  <i class="ri-edit-line"></i>
                  <span>重命名项目</span>
                </button>
                <button type="button" class="row-popover-item danger" data-action="delete-folder" data-folder-id="${project.id}">
                  <i class="ri-delete-bin-6-line"></i>
                  <span>删除项目</span>
                </button>
              </div>
            </div>
          </div>
          <ul class="folder-session-list${isOpen ? "" : " hidden"}">
            ${projectSessions.map((session) => renderSessionRow(session)).join("") || '<li class="history-empty-subtle">把对话拖到这个项目中</li>'}
          </ul>
        </div>
      `;
      els.historyList.appendChild(li);
    });

    if (rootSessions.length) {
      const li = document.createElement("li");
      li.className = "root-session-group";
      li.innerHTML = `
        <div class="root-session-list" data-drop-folder="root">
          ${rootSessions.map((session) => renderSessionRow(session)).join("")}
        </div>
      `;
      els.historyList.appendChild(li);
    }
  }

  function renderSessionRow(session) {
    const updatedAt = formatTime(Date.parse(session.updated_at || "") || Date.now());
    const title = escapeHtml(session.title || "新对话");
    const activeClass = session.session_id === APP.sessionId ? " active" : "";
    const menuOpen = APP.openMenuId === `session:${session.session_id}`;
    const sessionMeta = `${updatedAt}${session.doc_count ? ` · ${session.doc_count} 份资料` : ""}`;

    return `
      <div class="session-row${activeClass}" data-session-id="${session.session_id}" draggable="true">
        <div class="session-row-main">
          <span class="session-row-icon"><i class="ri-message-3-line"></i></span>
          <div class="session-row-body">
            <div class="session-row-title">${title}</div>
            <div class="session-row-meta">${sessionMeta}</div>
          </div>
        </div>
        <div class="row-hover-actions">
          <button type="button" class="row-menu-trigger" data-action="toggle-session-menu" data-session-id="${session.session_id}" aria-label="对话操作">
            <i class="ri-more-2-fill"></i>
          </button>
          <div class="row-popover-menu${menuOpen ? "" : " hidden"}">
            <button type="button" class="row-popover-item" data-action="rename-session" data-session-id="${session.session_id}">
              <i class="ri-edit-line"></i>
              <span>重命名</span>
            </button>
            <button type="button" class="row-popover-item" data-action="move-session-picker" data-session-id="${session.session_id}">
              <i class="ri-folder-transfer-line"></i>
              <span>${session.folder_id ? "移动项目" : "加入项目"}</span>
            </button>
            ${session.folder_id ? `
              <button type="button" class="row-popover-item" data-action="move-session-root" data-session-id="${session.session_id}">
                <i class="ri-link-unlink-m"></i>
                <span>移出项目</span>
              </button>
            ` : ""}
            <button type="button" class="row-popover-item danger" data-action="delete-session" data-session-id="${session.session_id}">
              <i class="ri-delete-bin-6-line"></i>
              <span>删除对话</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHistory() {
    if (!els.historyList) return;
    renderSessionCatalog();
    queueMenuPlacementSync();
  }

  function refreshQuickJumpPanel() {
    if (!els.quickJumpPanel || !els.quickJumpList || !els.chatMessages) return;
    if (APP.dataLab.isOpen || APP.phet.isOpen || APP.phet.detailOpen || APP.courseLab.isOpen || SIM.isOpen) {
      els.quickJumpPanel.classList.add("hidden");
      els.quickJumpList.innerHTML = "";
      return;
    }
    const jumpRows = Array.from(els.chatMessages.querySelectorAll(".message-row[id]"))
      .filter((row) => !row.querySelector(".bubble.loading"));
    const jumpItems = jumpRows
      .map((row, index) => ({
        id: row.id || `jump-${index}`,
        label: row.dataset.jumpLabel || truncateText(row.textContent?.trim() || "对话", 18),
        role: row.dataset.jumpRole || (row.classList.contains("user") ? "user" : "agent"),
      }))
      .slice(-36);

    APP.quickJumpItems = jumpItems;
    if (!jumpItems.length) {
      els.quickJumpPanel.classList.add("hidden");
      els.quickJumpList.innerHTML = "";
      return;
    }

    els.quickJumpPanel.classList.remove("hidden");
    els.quickJumpList.innerHTML = jumpItems
      .map((item) => `
        <button
          type="button"
          class="quick-jump-btn is-${item.role}${item.id === APP.quickJumpActiveId ? " active" : ""}"
          data-target-id="${item.id}"
          data-tooltip="${escapeAttribute(item.label)}"
          aria-label="${escapeAttribute(item.label)}"
        >
          <span class="quick-jump-line"></span>
        </button>
      `)
      .join("");
    updateQuickJumpActive();
  }

  function updateQuickJumpActive() {
    if (!els.quickJumpList || !APP.quickJumpItems.length) return;
    const containerTop = els.chatMessages.getBoundingClientRect().top;
    let activeId = APP.quickJumpItems[APP.quickJumpItems.length - 1]?.id || null;
    for (const item of APP.quickJumpItems) {
      const row = document.getElementById(item.id);
      if (!row) continue;
      const distance = row.getBoundingClientRect().top - containerTop;
      if (distance <= 80) {
        activeId = item.id;
      }
    }
    APP.quickJumpActiveId = activeId;
    Array.from(els.quickJumpList.querySelectorAll(".quick-jump-btn")).forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-target-id") === activeId);
    });
  }

  function toggleFloatingMenu(menuId) {
    APP.openMenuId = APP.openMenuId === menuId ? null : menuId;
    renderHistory();
  }

  function closeFloatingMenus() {
    if (!APP.openMenuId) return;
    APP.openMenuId = null;
    renderHistory();
  }

  function clearDropTargets() {
    els.historyList?.querySelectorAll(".drag-over").forEach((node) => {
      node.classList.remove("drag-over");
    });
  }

  function queueMenuPlacementSync() {
    window.requestAnimationFrame(() => {
      syncOpenMenuPlacement();
    });
  }

  function syncOpenMenuPlacement() {
    const historyList = els.historyList;
    if (!historyList) return;
    historyList.querySelectorAll(".row-hover-actions").forEach((node) => {
      node.classList.remove("menu-open-up");
    });
    const openMenu = historyList.querySelector(".row-popover-menu:not(.hidden)");
    if (!openMenu) return;
    const anchor = openMenu.parentElement;
    if (!anchor) return;
    const listRect = historyList.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const estimatedHeight = Math.max(openMenu.offsetHeight || 0, 156);
    const spaceBelow = listRect.bottom - anchorRect.bottom;
    const spaceAbove = anchorRect.top - listRect.top;
    if (spaceBelow < estimatedHeight + 12 && spaceAbove > spaceBelow) {
      anchor.classList.add("menu-open-up");
    }
  }

  function wavelengthToRGB(wlNm) {
    const wl = clamp(wlNm, 380, 780);
    let r = 0;
    let g = 0;
    let b = 0;

    if (wl >= 380 && wl < 440) {
      r = -(wl - 440) / (440 - 380);
      b = 1;
    } else if (wl < 490) {
      g = (wl - 440) / (490 - 440);
      b = 1;
    } else if (wl < 510) {
      g = 1;
      b = -(wl - 510) / (510 - 490);
    } else if (wl < 580) {
      r = (wl - 510) / (580 - 510);
      g = 1;
    } else if (wl < 645) {
      r = 1;
      g = -(wl - 645) / (645 - 580);
    } else {
      r = 1;
    }

    let attenuation = 1;
    if (wl < 420) {
      attenuation = 0.35 + (0.65 * (wl - 380)) / 40;
    } else if (wl > 700) {
      attenuation = 0.35 + (0.65 * (780 - wl)) / 80;
    }

    const gamma = 0.8;
    return {
      r: Math.round(255 * Math.pow(r * attenuation, gamma)),
      g: Math.round(255 * Math.pow(g * attenuation, gamma)),
      b: Math.round(255 * Math.pow(b * attenuation, gamma)),
    };
  }

  function wavelengthBandName(nm) {
    if (nm < 450) return "紫光";
    if (nm < 495) return "蓝光";
    if (nm < 570) return "绿光";
    if (nm < 590) return "黄光";
    if (nm < 620) return "橙光";
    return "红光";
  }

  function showToast(message) {
    const root = els.toastRoot;
    if (!root) return;

    root.classList.remove("hidden");
    root.style.position = "fixed";
    root.style.right = "18px";
    root.style.bottom = "18px";
    root.style.zIndex = "80";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.gap = "8px";

    const item = document.createElement("div");
    item.textContent = message;
    item.style.maxWidth = "420px";
    item.style.padding = "10px 12px";
    item.style.borderRadius = "10px";
    item.style.border = "1px solid rgba(255,255,255,0.2)";
    item.style.background = "rgba(16, 26, 50, 0.86)";
    item.style.backdropFilter = "blur(12px)";
    item.style.color = "#e8f1ff";
    item.style.fontSize = "13px";
    item.style.boxShadow = "0 10px 30px rgba(0,0,0,0.28)";

    root.appendChild(item);

    setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateY(4px)";
      item.style.transition = "all 0.25s ease";
      setTimeout(() => {
        item.remove();
        if (!root.childElementCount) {
          root.classList.add("hidden");
        }
      }, 260);
    }, 2400);
  }

  function getStoredApiBaseUrl() {
    try {
      return normalizeBaseUrl(localStorage.getItem(API_BASE_URL_STORAGE_KEY));
    } catch {
      return "";
    }
  }

  function setStoredApiBaseUrl(value) {
    const normalized = normalizeBaseUrl(value);
    try {
      if (normalized) {
        localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }

  function getStoredApiBaseUrlVersion() {
    try {
      return String(localStorage.getItem(API_BASE_URL_VERSION_STORAGE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function setStoredApiBaseUrlVersion(value) {
    const normalized = String(value || "").trim();
    try {
      if (normalized) {
        localStorage.setItem(API_BASE_URL_VERSION_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(API_BASE_URL_VERSION_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }

  function getStoredModelApiKey() {
    try {
      return String(localStorage.getItem(MODEL_API_KEY_STORAGE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function setStoredModelApiKey(value) {
    const normalized = String(value || "").trim();
    try {
      if (normalized) {
        localStorage.setItem(MODEL_API_KEY_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(MODEL_API_KEY_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }

  function loadAuthToken() {
    try {
      return String(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
    } catch {
      return "";
    }
  }

  function saveAuthToken(token) {
    try {
      if (token) {
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }

  function clearAuthToken() {
    try {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      return;
    }
  }

  function scopedStorageKey(baseKey) {
    return `${baseKey}:${ACTIVE_USER_STORAGE_SCOPE}`;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(scopedStorageKey("physics_agent_history_v2"))
        || localStorage.getItem("physics_agent_history_v2");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    localStorage.setItem(scopedStorageKey("physics_agent_history_v2"), JSON.stringify(history));
  }

  function loadFolderOpenMap() {
    try {
      const raw = localStorage.getItem("physics_agent_folder_open_map");
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveFolderOpenMap(map) {
    localStorage.setItem("physics_agent_folder_open_map", JSON.stringify(map || {}));
  }

  function generateSessionId() {
    return window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `sid-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

  function getOrCreateSessionId() {
    try {
      const existing = localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
      if (existing) return existing;
    } catch {
      return generateSessionId();
    }
    return generateSessionId();
  }

  function ensureSessionIdForCurrentUser() {
    const key = scopedStorageKey(LEGACY_SESSION_STORAGE_KEY);
    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        APP.sessionId = existing;
        return existing;
      }
      const legacy = localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
      const nextId = legacy || generateSessionId();
      APP.sessionId = nextId;
      localStorage.setItem(key, nextId);
      return nextId;
    } catch {
      const nextId = generateSessionId();
      APP.sessionId = nextId;
      return nextId;
    }
  }

  function setCurrentSessionId(sessionId) {
    APP.sessionId = sessionId;
    try {
      localStorage.setItem(scopedStorageKey(LEGACY_SESSION_STORAGE_KEY), sessionId);
      localStorage.setItem(LEGACY_SESSION_STORAGE_KEY, sessionId);
    } catch {
      return;
    }
  }

  function truncateText(text, max) {
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1)}…`;
  }

  function formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function formatDateTime(ts) {
    const time = new Date(ts).getTime();
    if (!Number.isFinite(time)) return "";
    return new Date(time).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttribute(text) {
    return escapeHtml(text);
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function radToDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  function normalizeDeg(deg) {
    const d = deg % 360;
    return d < 0 ? d + 360 : d;
  }

  function signedAngleDeltaDeg(fromDeg, toDeg) {
    return ((toDeg - fromDeg + 540) % 360) - 180;
  }

  function polarPoint(cx, cy, r, deg) {
    const rad = degToRad(deg);
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }
})();


