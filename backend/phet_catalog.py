from __future__ import annotations

import html
import json
import os
import re
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PHET_BASE_URL = "https://phet.colorado.edu"
PHET_METADATA_URL = PHET_BASE_URL + "/services/metadata/1.3/simulations?format=json&locale={locale}"
PHYSICS_CATEGORY_ID = "4"
DEFAULT_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60
CATALOG_SCHEMA_VERSION = 3

TOPIC_SPECS = [
    {
        "category_id": "5",
        "topic_key": "motion",
        "topic_label_zh": "运动",
        "topic_label_en": "Motion",
        "observation_points": [
            "先确认界面里哪些量是输入变量，哪些量会实时响应变化。",
            "记录位移、速度、加速度或运动轨迹随参数变化的趋势。",
            "比较图像、动画和物理量读数之间是否能互相印证。",
        ],
        "suggested_questions": [
            "这个仿真里最关键的控制变量和观测量分别是什么？",
            "如果逐步改变一个参数，运动状态会怎样变化？",
            "怎样把仿真现象和课堂中的运动公式联系起来？",
        ],
    },
    {
        "category_id": "6",
        "topic_key": "sound-and-waves",
        "topic_label_zh": "声波与振动",
        "topic_label_en": "Sound & Waves",
        "observation_points": [
            "观察频率、振幅、相位或介质变化时波形如何调整。",
            "比较时间域图像和空间分布图像是否一致。",
            "关注共振、干涉、驻波等典型现象出现的条件。",
        ],
        "suggested_questions": [
            "当前仿真最适合验证哪条波动规律？",
            "哪些参数变化会直接影响振幅、频率或波长？",
            "如何利用这个仿真解释共振或干涉现象？",
        ],
    },
    {
        "category_id": "7",
        "topic_key": "work-energy-and-power",
        "topic_label_zh": "功、能量与功率",
        "topic_label_en": "Work, Energy & Power",
        "observation_points": [
            "跟踪动能、势能、内能等能量项的转化过程。",
            "比较守恒量和耗散量在不同条件下的变化。",
            "注意图表和能量条是否能解释实验现象。",
        ],
        "suggested_questions": [
            "这个仿真最适合观察哪几种能量之间的转化？",
            "哪些条件下可以近似看作能量守恒？",
            "如何从仿真结果判断系统功率或做功过程？",
        ],
    },
    {
        "category_id": "8",
        "topic_key": "heat-and-thermodynamics",
        "topic_label_zh": "热学与热力学",
        "topic_label_en": "Heat & Thermodynamics",
        "observation_points": [
            "对比温度、压强、体积、粒子运动状态之间的联系。",
            "关注热传递方向和系统平衡前后的变化。",
            "比较不同模型下宏观量和微观解释是否一致。",
        ],
        "suggested_questions": [
            "这个仿真适合验证哪条热学或热力学规律？",
            "如何从微观动画解释温度、压强或内能变化？",
            "哪些现象能帮助区分热平衡前后系统状态？",
        ],
    },
    {
        "category_id": "9",
        "topic_key": "quantum-phenomena",
        "topic_label_zh": "量子现象",
        "topic_label_en": "Quantum Phenomena",
        "observation_points": [
            "关注测量前后的状态变化，以及概率分布如何更新。",
            "比较经典模型和量子模型在同一问题上的差异。",
            "留意界面中的统计结果、波函数或态叠加表现。",
        ],
        "suggested_questions": [
            "这个仿真里哪些现象体现了量子系统和经典系统的区别？",
            "测量操作会怎样改变系统状态或概率分布？",
            "如何用更通俗的语言解释这里的量子叠加或坍缩？",
        ],
    },
    {
        "category_id": "10",
        "topic_key": "light-and-radiation",
        "topic_label_zh": "光与辐射",
        "topic_label_en": "Light & Radiation",
        "observation_points": [
            "比较光路、频谱、波长或强度变化带来的现象差异。",
            "观察图像变化是否能对应到折射、衍射、发射等机制。",
            "留意不同介质或参数设置对结果的影响。",
        ],
        "suggested_questions": [
            "这个仿真最适合解释哪一种光学或辐射现象？",
            "哪些参数会直接影响波长、频率、强度或成像结果？",
            "如何把这里的现象和实验室中的真实观测对应起来？",
        ],
    },
    {
        "category_id": "11",
        "topic_key": "electricity-magnets-and-circuits",
        "topic_label_zh": "电磁与电路",
        "topic_label_en": "Electricity, Magnets & Circuits",
        "observation_points": [
            "先辨认电源、元件、导线和测量量之间的关系。",
            "跟踪电流、电压、磁场或电荷分布如何随操作变化。",
            "比较稳态与瞬态、串并联或不同边界条件下的结果。",
        ],
        "suggested_questions": [
            "这个仿真里哪些变量决定了电流、电压或磁场变化？",
            "如何用电路或电磁学基本规律解释界面中的现象？",
            "如果改变元件参数，系统响应会出现什么趋势？",
        ],
    },
]

TOPIC_SPECS_BY_CATEGORY = {item["category_id"]: item for item in TOPIC_SPECS}

TITLE_REPLACEMENTS = [
    ("Kepler's Laws", "开普勒定律"),
    ("Coulomb's Law", "库仑定律"),
    ("Quantum Coin Toss", "量子抛硬币"),
    ("Quantum Measurement", "量子测量"),
    ("Blackbody Spectrum", "黑体辐射光谱"),
    ("Atomic Interactions", "原子相互作用"),
    ("Balancing Act", "平衡探究实验"),
    ("Balloons and Static Electricity", "气球与静电"),
    ("Bending Light", "光的折射"),
    ("Build a Nucleus", "构建原子核"),
    ("Build an Atom", "构建原子模型"),
    ("Buoyancy: Basics", "浮力基础"),
    ("Buoyancy", "浮力"),
    ("Calculus Grapher", "微积分绘图器"),
    ("Capacitor Lab: Basics", "电容器实验基础"),
    ("Charges and Fields", "电荷与电场"),
    ("Circuit Construction Kit: AC - Virtual Lab", "交流电路搭建虚拟实验室"),
    ("Circuit Construction Kit: AC", "交流电路搭建实验"),
    ("Circuit Construction Kit: DC - Virtual Lab", "直流电路搭建虚拟实验室"),
    ("Circuit Construction Kit: DC", "直流电路搭建实验"),
    ("Collision Lab", "碰撞实验室"),
    ("Color Vision", "色觉与光的混合"),
    ("Curve Fitting", "曲线拟合"),
    ("Energy Forms and Changes", "能量形式与转化"),
    ("Energy Skate Park: Basics", "能量滑板公园基础"),
    ("Energy Skate Park", "能量滑板公园"),
    ("Faraday's Law", "法拉第电磁感应定律"),
    ("Forces and Motion: Basics", "力与运动基础"),
    ("Gas Properties", "气体性质"),
    ("Gravity and Orbits", "引力与轨道"),
    ("Gravity Force Lab: Basics", "引力实验基础"),
    ("Gravity Force Lab", "引力实验室"),
    ("Projectile Data Lab", "抛体数据实验"),
    ("Hooke's Law", "胡克定律"),
    ("Isotopes and Atomic Mass", "同位素与原子质量"),
    ("Masses and Springs: Basics", "质量与弹簧基础"),
    ("Masses and Springs", "质量与弹簧"),
    ("Fourier: Making Waves", "傅里叶波形合成"),
    ("Faraday's Electromagnetic Lab", "法拉第电磁实验"),
    ("Model of the Hydrogen Atom", "氢原子模型"),
    ("Models of the Hydrogen Atom", "氢原子模型"),
    ("Geometric Optics: Basics", "几何光学基础"),
    ("Ohm's Law", "欧姆定律"),
    ("Pendulum Lab", "单摆实验"),
    ("Projectile Motion", "抛体运动"),
    ("Resonance", "共振"),
    ("Wave on a String", "弦上的波"),
]

WORD_REPLACEMENTS = {
    "atomic": "原子",
    "interactions": "相互作用",
    "balancing": "平衡",
    "act": "探究",
    "balloons": "气球",
    "static": "静电",
    "electricity": "电学",
    "bending": "折射",
    "light": "光",
    "blackbody": "黑体",
    "spectrum": "光谱",
    "build": "构建",
    "nucleus": "原子核",
    "atom": "原子",
    "buoyancy": "浮力",
    "calculus": "微积分",
    "grapher": "绘图器",
    "capacitor": "电容器",
    "lab": "实验",
    "charges": "电荷",
    "fields": "电场",
    "circuit": "电路",
    "construction": "搭建",
    "kit": "套件",
    "virtual": "虚拟",
    "collision": "碰撞",
    "color": "颜色",
    "vision": "视觉",
    "curve": "曲线",
    "fitting": "拟合",
    "energy": "能量",
    "forms": "形式",
    "changes": "变化",
    "faraday": "法拉第",
    "electromagnetic": "电磁",
    "kepler's": "开普勒",
    "keplers": "开普勒",
    "fourier": "傅里叶",
    "data": "数据",
    "geometric": "几何",
    "optics": "光学",
    "models": "模型",
    "making": "生成",
    "forces": "力",
    "motion": "运动",
    "gas": "气体",
    "properties": "性质",
    "gravity": "重力",
    "orbits": "轨道",
    "hooke": "胡克",
    "law": "定律",
    "isotopes": "同位素",
    "mass": "质量",
    "masses": "质量",
    "springs": "弹簧",
    "model": "模型",
    "hydrogen": "氢",
    "ohm": "欧姆",
    "pendulum": "摆",
    "projectile": "抛体",
    "quantum": "量子",
    "coin": "硬币",
    "toss": "抛掷",
    "resonance": "共振",
    "wave": "波",
    "string": "弦",
    "basics": "基础",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_text(raw: Any) -> str:
    if raw is None:
        return ""
    text = str(raw)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
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


def translate_title_fallback(title_en: str) -> str:
    title = title_en.strip()
    if not title:
        return "课外仿真实验"
    for source, target in TITLE_REPLACEMENTS:
        if title == source:
            return target

    normalized = title
    for source, target in TITLE_REPLACEMENTS:
        normalized = normalized.replace(source, target)

    tokens = re.split(r"([ :&()\-])", normalized)
    translated_tokens: list[str] = []
    for token in tokens:
        token_lower = token.lower()
        translated_tokens.append(WORD_REPLACEMENTS.get(token_lower, token))
    translated = "".join(translated_tokens).strip()
    translated = re.sub(r"\s+", " ", translated)
    translated = translated.replace(" :", "：").replace(": ", "：")
    translated = re.sub(r"\s*-\s*", " ", translated)
    translated = re.sub(r"\s+", " ", translated).strip(" ：-")
    if re.search(r"[A-Za-z]{3,}", translated):
        cleaned = re.sub(r"[A-Za-z]{2,}", "", translated)
        cleaned = re.sub(r"\s+", " ", cleaned).strip(" ：-()")
        if cleaned:
            return cleaned
        return "课外仿真实验"
    return translated or "课外仿真实验"


def contains_english_words(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]{2,}", text or ""))


def needs_generated_chinese(text: str, *, min_chinese_chars: int = 12) -> bool:
    if not text:
        return True
    english_words = re.findall(r"[A-Za-z]{3,}", text)
    chinese_chars = re.findall(r"[\u4e00-\u9fff]", text)
    return len(english_words) >= 3 and len(chinese_chars) < min_chinese_chars


def build_generated_intro(title_zh: str, topic_label_zh: str) -> str:
    return (
        f"“{title_zh}”属于{topic_label_zh}主题，可用于分析关键物理量之间的定性与定量关系。"
        "建议先辨认界面中的可控变量、观测量与图像反馈，再逐步改变参数，比较现象变化、数值读数与理论规律是否一致。"
        "进一步讨论时，可围绕实验对象、变量控制、结果趋势、规律解释与误差来源展开。"
    ).strip()


def build_generated_goals(topic_label_zh: str) -> str:
    return (
        f"通过该{topic_label_zh}实验，理解主要物理量之间的关联，"
        "能够说明关键参数变化引起的现象差异，并将仿真结果与课堂中的公式、图像和实验方法对应起来。"
    )


def build_research_focus(topic_key: str) -> str:
    mapping = {
        "motion": "适合轨迹分析与变量控制",
        "sound-and-waves": "适合波形分析与相位比较",
        "work-energy-and-power": "适合能量转化与守恒辨析",
        "heat-and-thermodynamics": "适合状态变化与热过程分析",
        "quantum-phenomena": "适合概率解释与测量讨论",
        "light-and-radiation": "适合光路分析与成像讨论",
        "electricity-magnets-and-circuits": "适合电路分析与场量比较",
    }
    return mapping.get(topic_key, "适合参数分析与现象观察")


def build_interface_guidance(topic_key: str) -> list[str]:
    common = [
        "参数调节区（Controls / Sliders）用于连续改变关键变量，并比较系统响应是否随之发生规律性变化。",
        "图像或读数区（Display / Graph / Readout）用于核对动态图像、数值读数与理论判断是否一致。",
        "开始与暂停（Play / Pause）可用于观察瞬态过程、逐步比较参数改变前后的状态差异。",
        "重置（Reset All）适合在完成一组变量控制后回到初始状态，重新组织实验步骤。",
    ]
    topic_specific = {
        "motion": [
            "位置与速度（Position / Velocity）常用于判断轨迹、方向与运动状态的变化。",
            "加速度或力（Acceleration / Force）适合与运动图像对照分析因果关系。",
        ],
        "sound-and-waves": [
            "频率与振幅（Frequency / Amplitude）通常决定波形的周期特征与能量表现。",
            "相位或波长（Phase / Wavelength）适合用于比较干涉、驻波和传播特征。",
        ],
        "work-energy-and-power": [
            "能量条或能量图（Energy Bars / Energy Graph）适合观察能量守恒与转化路径。",
            "功率或做功（Power / Work）可用于分析过程快慢与能量转移效率。",
        ],
        "heat-and-thermodynamics": [
            "温度与压强（Temperature / Pressure）适合结合粒子运动解释宏观状态变化。",
            "热流或粒子图像（Heat Flow / Particles）有助于讨论热平衡与传热方向。",
        ],
        "quantum-phenomena": [
            "测量（Measure）常用于比较测量前后状态、统计分布与结果更新。",
            "概率或态（Probability / State）适合观察叠加、坍缩与统计结果之间的联系。",
        ],
        "light-and-radiation": [
            "光源与介质（Light Source / Medium）适合分析入射条件变化后的传播效果。",
            "波长与强度（Wavelength / Intensity）可用于讨论颜色、亮度与成像差异。",
        ],
        "electricity-magnets-and-circuits": [
            "电压与电流（Voltage / Current）常用于分析元件两端状态与回路响应。",
            "磁场与电荷（Magnetic Field / Charge）适合讨论场量分布与受力关系。",
        ],
    }
    return common + topic_specific.get(topic_key, [])


def pick_topic_spec(sim_id: int, metadata: dict[str, Any]) -> dict[str, Any]:
    categories = metadata.get("categories", {})
    for spec in TOPIC_SPECS:
        category = categories.get(spec["category_id"], {})
        simulation_ids = {int(value) for value in category.get("simulationIds", [])}
        if sim_id in simulation_ids:
            return spec
    return TOPIC_SPECS[0]


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
            headers={
                "User-Agent": "PhysicsAgent/1.0",
                "Accept": "application/json",
            },
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
                title_zh = raw_title_zh if raw_title_zh and not contains_english_words(raw_title_zh) else translate_title_fallback(title_en)
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

                groups[topic_spec["topic_key"]]["sims"].append(
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
                        "research_focus_zh": build_research_focus(topic_spec["topic_key"]),
                        "observation_points": topic_spec["observation_points"],
                        "suggested_questions": topic_spec["suggested_questions"],
                        "interface_guidance_zh": build_interface_guidance(topic_spec["topic_key"]),
                    }
                )

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
            "updated_at": utc_now_iso(),
            "total": total,
            "groups": ordered_groups,
        }

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
                return isinstance(sim.get("interface_guidance_zh"), list)
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
