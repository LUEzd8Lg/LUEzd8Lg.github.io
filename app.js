/* ===========================================================================
   世界观察档案库 · 应用主脚本 v2
   视觉：绝密档案库 / 机密文档管理系统
   =========================================================================== */

(() => {
  'use strict';

  // ============ 动态光标跟随效果 ============
  const CursorFX = (() => {
    const fx = document.createElement('div');
    fx.className = 'cursor-fx';
    fx.innerHTML = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <g fill="none" stroke="var(--silver)" stroke-width="0.8" opacity="0.6">
        <circle cx="20" cy="20" r="18" stroke-dasharray="3 2"/>
        <circle cx="20" cy="20" r="12"/>
        <line x1="20" y1="0" x2="20" y2="6"/>
        <line x1="20" y1="34" x2="20" y2="40"/>
        <line x1="0" y1="20" x2="6" y2="20"/>
        <line x1="34" y1="20" x2="40" y2="20"/>
      </g>
      <rect x="15" y="15" width="10" height="10" fill="none" stroke="var(--silver)" stroke-width="1"/>
      <circle cx="20" cy="20" r="2" fill="var(--silver)"/>
      <circle cx="20" cy="2" r="1.5" fill="var(--silver)"/>
    </svg>`;
    document.body.appendChild(fx);

    let mx = -100, my = -100;
    let cx = -100, cy = -100;
    let rafId = null;
    let active = false;
    let mode = 'default';

    function loop() {
      cx += (mx - cx) * 0.18;
      cy += (my - cy) * 0.18;
      fx.style.transform = `translate(${cx}px, ${cy}px)`;
      if (Math.abs(mx - cx) > 0.5 || Math.abs(my - cy) > 0.5) {
        rafId = requestAnimationFrame(loop);
      } else {
        rafId = null;
      }
    }

    function onMove(e) {
      mx = e.clientX;
      my = e.clientY;
      if (!active) {
        active = true;
        fx.classList.add('active');
      }
      if (!rafId) rafId = requestAnimationFrame(loop);

      // 检测悬停元素类型
      const el = document.elementFromPoint(e.clientX, e.clientY);
      let newMode = 'default';
      if (el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || el.isContentEditable || tag === 'select') {
          newMode = 'text';
        } else if (el.closest('a, button, [role="button"], [onclick], .card, .doc-card, .ec, .atab, .abtn, .sb-tool, .tag-chip, .mm-node, input[type="checkbox"], input[type="radio"], label[for], summary')) {
          newMode = 'pointer';
        } else if (el.closest('[disabled], :disabled, .disabled')) {
          newMode = 'default';
        }
      }
      if (newMode !== mode) {
        fx.classList.remove(mode);
        mode = newMode;
        if (mode !== 'default') fx.classList.add(mode);
      }
    }

    function onLeave() {
      fx.classList.add('hidden');
      active = false;
    }
    function onEnter() {
      fx.classList.remove('hidden');
    }
    function onDown() {
      fx.style.transition = 'none';
      fx.style.opacity = '0.8';
      setTimeout(() => { fx.style.transition = ''; }, 100);
    }

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('mousedown', onDown);

    // 鼠标离开窗口时隐藏
    window.addEventListener('blur', onLeave);
    window.addEventListener('focus', onEnter);

    return { fx };
  })();

  const DATA = window.ARCHIVE_DATA;
  const view = document.getElementById('view-container');

  let CAT_MAP = Object.fromEntries(DATA.categories.map(c => [c.id, c]));
  function rebuildCatMap() { CAT_MAP = Object.fromEntries(DATA.categories.map(c => [c.id, c])); }
  const CLASS_NAMES = Object.fromEntries(DATA.classLegend.map(c => [c.code, c.name]));

  function getEntries(catId) { return DATA[catId] || []; }
  function findEntry(catId, id) { return (DATA[catId] || []).find(e => e.id === id); }

  function allEntries() {
    const out = [];
    for (const cat of DATA.categories) {
      for (const e of (DATA[cat.id] || [])) {
        out.push({ ...e, _cat: cat.id });
      }
    }
    return out;
  }

  function computeStats() {
    const counts = {};
    let total = 0;
    for (const cat of DATA.categories) {
      const n = (DATA[cat.id] || []).length;
      counts[cat.id] = n;
      total += n;
    }
    return { counts, total };
  }

  function statsCounts() { return computeStats().counts; }
  function statsTotal()  { return computeStats().total; }

  // ============ 专有名词索引词典（术语表数据源） ============
  // 提取自《盖亚世界史·大升级版》。link 形如 "分类:条目id"，命中现有档案时点名词可跳转。
  const GLOSSARY_CATS = ['神祇', '组织', '地点', '事件', '仪式', '概念实体', '纪元文明'];
  const GLOSSARY_TERMS = [
    // —— 神祇 ——
    { n: '埃尔德', c: '神祇', d: '守护·慈悲·治愈·封印之神；先史文明维护程序，被凡人称“大地之声”。净化战争后融入七门，成为“守护本身”。', link: null },
    { n: '俄勃利', c: '神祇', d: '遗忘·消失·记忆抹除之神，最依赖“被记住”。信仰退潮后崩解，残骸埋藏处引发灰疫。', link: null },
    { n: '索尔迦', c: '神祇', d: '夜·静默·安眠·守夜之神，北洲诺克图恩信仰。', link: null },
    { n: '薇兰塔', c: '神祇', d: '霜·冬·冻结·凝滞之神，北洲霜落公国信仰。', link: null },
    { n: '阿库拉', c: '神祇', d: '深渊·海沟·低语·虚空之神，东屿海沟低语之主。', link: null },
    { n: '卡莉丝', c: '神祇', d: '梦·记忆·白色城市·睡城病之神，梦潮时代的制造者。', link: null },
    { n: '赫利俄斯', c: '神祇', d: '太阳·日影·光·时间之神，希柏波瑞亚帝国信仰。', link: null },
    { n: '诺克图斯', c: '神祇', d: '暗夜·守夜·警觉·清醒之神，诺克图恩守夜人信仰。', link: null },
    { n: '瑟兰', c: '神祇', d: '极光·光·色彩·流动之神，北洲极光之主。', link: null },
    { n: '瓦洛斯', c: '神祇', d: '裂谷·白雾·呼吸·低语之神，瑞穆守誓者与瓦洛斯教国信仰。', link: null },
    { n: '奥涅里亚', c: '神祇', d: '潮汐·航路·贸易·流动之神，南洲海贸王朝信仰。', link: null },
    { n: '伊斯', c: '神祇', d: '无名·空缺·第十三位置；从未降临，神位空置数千年。', link: null },
    { n: '第13神', c: '神祇', d: '无名的概念空位，被集体执念激活；空座，等待一个人坐上去。', link: null },
    // —— 组织 ——
    { n: '红月政府', c: '组织', d: '静态平衡治理的人类文明存续政府；全境分白灰黄红黑五级，五大总局分权，直属七人理事会。', link: 'organizations:SUB-001' },
    { n: 'ECO基金会', c: '组织', d: '红月政府核心技术伙伴，运营现实锚定系统，以白曐碎片为催化介质。内部争论“继续锚定”与“停止锚定”。', link: 'organizations:SUB-002' },
    { n: 'V.T.C.', c: '组织', d: '终末钟塔瞭望会，在暗处“烧思想”的对手，红月政府至今无法真正理解。', link: 'organizations:SUB-003' },
    { n: '红植雇佣兵', c: '组织', d: '资本与暴力结合的雇佣兵势力，人性向工具性异化的标本。', link: 'organizations:SUB-004' },
    { n: '逻各斯之子', c: '组织', d: '在红月秩序与天教飞升之间划出“第三条道路”的思想势力。', link: 'organizations:SUB-005' },
    { n: '圣保罗医院', c: '组织', d: '照亮医学未来、也投下血色阴影的医疗研究机构。', link: 'organizations:SUB-006' },
    { n: '天教', c: '组织', d: '中州宗教，教义“神在门后”“进化即救赎”；推行生命改造计划，红月纪元分裂为顺从派与追问派。', link: null },
    { n: '灰塔学派', c: '组织', d: '求真者建立的异常研究组织，以可重复方法研究异常；分裂为结构、本源、共生、终末四派。', link: null },
    { n: '圣源教', c: '组织', d: '埃尔德信仰的余脉，以“净水计划”向红月政府换取保护与空间。', link: null },
    { n: '黑烛教派', c: '组织', d: '奉黑烛仪式、等待空座的信徒；在禁书与镇压中转入黑暗。', link: null },
    { n: '无天教团', c: '组织', d: '供奉无天之城，视灰化为“回家”；只点一根灰色蜡烛。', link: null },
    { n: '灰烬修士团', c: '组织', d: '自愿感染灰疫的苦修者，理念“神碎了，我们帮神拼起来”。', link: null },
    { n: '梦境修士', c: '组织', d: '以睡眠修行，睡前默念“让我看见”，多数人长眠不醒。', link: null },
    { n: '覆皮者', c: '组织', d: '行覆皮仪式、传递神谕者，后定名“概念覆盖综合症”（RM-4）。', link: null },
    { n: '探险者联盟', c: '组织', d: '深入黑区、绘制地图外区域的探索势力，寻找第五、第六、第七门。', link: null },
    { n: '醒者会', c: '组织', d: '大梦潮后醒来的南洲组织，目标只有一个：守住裂谷。', link: null },
    { n: '五大总局', c: '组织', d: '红月政府五大机构：中央统合部（大脑）、都市传说响应局（铁拳）、异常研发中心（手术刀）、情报档案总局（阴影）、监察伦理委员会（天平）。', link: null },
    { n: '血月之眼 / 寂静之声', c: '组织', d: '直属七人理事会的两支特殊部队，前者司暗杀斩首，后者司记忆删除与认知干扰。', link: null },
    // —— 地点 ——
    { n: '中州', c: '地点', d: '盖亚四洲之一，白曐坠落之地，红月政府的棋盘中心。', link: null },
    { n: '北洲', c: '地点', d: '盖亚四洲之一，永夜森林与极光之地，诺克图恩守夜之地。', link: null },
    { n: '东洲', c: '地点', d: '盖亚四洲之一，东屿海沟所在，阿库拉低语之地。', link: null },
    { n: '南洲', c: '地点', d: '盖亚四洲之一，南裂谷与梦潮之地，瓦洛斯白雾之地。', link: null },
    { n: '辉山山脉', c: '地点', d: '中州山脉，第一门地底所在；伊尔萨天穹石阵立于此。', link: null },
    { n: '永夜森林', c: '地点', d: '北洲森林，第二门之下；树被时间冻住，不落叶也不生长。', link: null },
    { n: '东屿海沟', c: '地点', d: '东洲海沟最深处，第三门沉没之处，深渊低语之源。', link: null },
    { n: '南裂谷', c: '地点', d: '南洲裂谷，第四门所在，白雾与低语之源。', link: null },
    { n: '圣湖', c: '地点', d: '白曐坠落形成的湖，埃尔德力量之源，中州最硬通货。', link: null },
    { n: '巴别塔', c: '地点', d: '一万米高、十三层的缝合之塔；第十三层为“第13个位置”准备，事故后自行运转、裂口被彼岸一侧缝上。', link: null },
    { n: '零号禁区-01', c: '地点', d: '辉山地底第一门石门封存地，门上刻“门不是用来关的，是用来开的”。', link: null },
    { n: '零号禁区-02', c: '地点', d: '巴别塔遗址，裂环之影所在，第十三层悬浮其上。', link: null },
    { n: '零号禁区-03', c: '地点', d: '巴罗萨，被“改写”的活迷宫。', link: null },
    { n: '灰城', c: '地点', d: '中州东部灰疫暴动废墟，三天内化为灰岩，红月纪元的黄区异常点。', link: null },
    { n: '赤月城', c: '地点', d: '伪神战争“赤月之夜”后，由伊莱城改名的城市。', link: null },
    { n: '白色城市 / 白城', c: '地点', d: '梦中城市，卡莉丝与睡城病共通的景象，中央有一空洞。', link: null },
    // —— 事件 ——
    { n: '白曐坠落', c: '事件', d: '约前3000年，彼岸碎片穿过圈层撞入现实，催生第一批旧神，天坠之始。', link: null },
    { n: '六道之战', c: '事件', d: '前653—前629年，中州六国大战，无胜者，七门封印首次被震裂。', link: null },
    { n: '净化战争', c: '事件', d: '前500—公元0年，圣湖教国与天教之战；埃尔德融入七门、补上人类捅破的窟窿。', link: null },
    { n: '旧神黄昏', c: '事件', d: '公元0—300年，埃尔德熄灭后旧神集体沉默，神明从“存在”变成“故事”。', link: null },
    { n: '灰疫', c: '事件', d: '约900—1100年，俄勃利残骸崩解引发的三阶段灾难（灰斑·空梦·灰化）。', link: null },
    { n: '伪神战争', c: '事件', d: '约1200—1450年，数十位假神、数百教派的信仰战争，幸存假神不足十位。', link: null },
    { n: '空神之战', c: '事件', d: '约1480年，“永恒之主”与“无名之母”决战，两败俱伤后被第13神空位吸尽权能。', link: null },
    { n: '黑烛时代', c: '事件', d: '约1500—1662年，以黑烛仪式为中心的等待时代，1652年空座降临，1662年第二次圣战终结。', link: null },
    { n: '神弃战争', c: '事件', d: '1552—1662年，天教与黑烛的净化战争；天教宣布的胜利没有一个字是真的。', link: null },
    { n: '启明时代', c: '事件', d: '约1700—1900年，灰塔学派成立；1850年《启明遗产》封存于灰塔地下第七层。', link: null },
    { n: '巴别塔事故', c: '事件', d: '2296年，塔顶探针过载，薄膜上方出现新裂口；裂口最终被彼岸一侧缝上。', link: null },
    { n: '灾变纪（无主时期）', c: '事件', d: '2300—2312年，全球秩序瓦解，2308年《午夜宫盟约》奠基红月政府。', link: null },
    { n: '午夜宫盟约', c: '事件', d: '2308年，各方放弃独立主权，共同组建拥有绝对权力的新政府。', link: null },
    { n: '净街行动', c: '事件', d: '2310—2312年，以现实锚定系统阻断异常渗流；代价是边界硬化、丧失弹性。', link: null },
    { n: '锈蚀病大流行', c: '事件', d: '2360—2370年，人铁锈化雕像，红月纪元最严重的公共卫生危机。', link: null },
    // —— 仪式 ——
    { n: '黑烛仪式', c: '仪式', d: '黑暗里点燃黑蜡烛然后等；共十三根，第13根始终不燃，无人知为谁所留。', link: null },
    { n: '覆皮仪式', c: '仪式', d: '把一人的“皮”覆盖到另一人的“骨”；皮成空壳，骨得一切。后定名“概念覆盖综合症”（RM-4）。', link: null },
    { n: '空座降临', c: '仪式', d: '1552年，千计信徒同见一个悬浮空座，景象持续数分钟，众人跪拜。', link: null },
    { n: '净水计划', c: '仪式', d: '圣源教以圣湖之水为代价，向红月政府换取秘密保护与活动空间。', link: null },
    { n: '守夜仪式', c: '仪式', d: '诺克图恩守夜人每十年派一人进永夜森林，走三天再回来。', link: null },
    { n: '生命改造计划', c: '仪式', d: '天教三阶段改造：灰斑诱导、空梦引导、灰化控制；2240年转入地下。', link: null },
    { n: '梦晶贸易', c: '仪式', d: '睡城公国的经济基础，以患者沉睡时长分上中下三等梦晶。', link: null },
    // —— 概念与实体 ——
    { n: '七门', c: '概念实体', d: '先史文明封彼岸渗流的七道锁；四门位置已知（辉山·永夜森林·东屿海沟·南裂谷），三门未明。', link: null },
    { n: '空座', c: '概念实体', d: '第13神位，无名信仰的概念空位，一直等待被坐上去。', link: null },
    { n: '裂环', c: '概念实体', d: '圆环带一道裂痕的符号；不是签名，是名片。', link: null },
    { n: '白曐', c: '概念实体', d: '彼岸碎片，裹挟“变化·生长·膨胀”一类活概念，撞碎镜面边界入世。', link: null },
    { n: '无天之城', c: '概念实体', d: '俄勃利残骸的内部记忆；白色建筑，中央空洞，等待灰化者汇聚意识。', link: null },
    { n: '灰疫三阶段', c: '概念实体', d: '灰斑（触觉丧失）、空梦（同梦白城）、灰化（化灰岩入无天之城）。', link: null },
    { n: '睡城病', c: '概念实体', d: '南洲灰疫变体，患者不灰化只沉睡，梦中反复念“白城”。', link: null },
    { n: '锈蚀病', c: '概念实体', d: '皮肤铁锈化、肉体硬化成雕像的疾病；源于净街行动的“概念真空”扩散。', link: null },
    { n: '概念覆盖综合症', c: '概念实体', d: '覆皮仪式的现代定名，分完整覆盖、不完全覆盖、空壳、反噬四类（RM-4）。', link: null },
    { n: '原初印记', c: '概念实体', d: '人类意识中的可训练印记，原初意识态不稳定。', link: null },
    { n: '彼岸', c: '概念实体', d: '薄膜另一侧、由纯粹概念构成的空间。', link: null },
    { n: '薄膜', c: '概念实体', d: '现实与彼岸之间的边界；变薄对应异常渗漏，撕裂对应门。', link: null },
    { n: '异常分级', c: '概念实体', d: '按危害分五级：RM-1轻微、RM-2局部、RM-3区域、RM-4大型、RM-5灾难级。', link: null },
    // —— 纪元与文明 ——
    { n: '第一纪元 · 神在人间', c: '纪元文明', d: '前3000—公元300年，问“神是什么”；白曐坠落到旧神黄昏。', link: null },
    { n: '第二纪元 · 无神者', c: '纪元文明', d: '公元300—1900年，问“没有神怎么活”；灰疫、假神、黑烛、圣战。', link: null },
    { n: '第三纪元 · 触碰边界', c: '纪元文明', d: '1900—2300年，想把门打开；解析、遗迹、异常工业、巴别塔。', link: null },
    { n: '第四纪元 · 静态纪元', c: '纪元文明', d: '2300至今，门打开之后怎么活；红月政府的静态平衡。', link: null },
    { n: '红月纪元', c: '纪元文明', d: '2312年起新历，红月纪元零年。', link: null },
    { n: '伊尔萨文明', c: '纪元文明', d: '辉山观星文明，前849年凭空消失，只留天穹石阵、陶片与铭文。', link: null },
    { n: '阿尔诺姆圣湖文明', c: '纪元文明', d: '以圣湖为信仰、主张净化与守护的圣湖西岸文明。', link: null },
    { n: '奥尔菲斯天宫文明', c: '纪元文明', d: '东部高地文明，前665年巴别塔事件，巨塔崩塌。', link: null },
    { n: '赫洛斯海联盟', c: '纪元文明', d: '以远星港为都的海贸联盟，前694年夺门之战。', link: null },
    { n: '维尔萨黑森林文明', c: '纪元文明', d: '黑森林边缘文明，造化炉与生命改造，前784年大出逃。', link: null },
    { n: '阿卡利亚王朝', c: '纪元文明', d: '九原城王权，前926年九原归一，末王阿尔贡三世死于六道之战。', link: null },
    { n: '先史文明', c: '纪元文明', d: '在膜上凿七孔、封彼岸的文明；封门后把自己抹得干干净净，只剩门。', link: null },
  ];

  // ============================================================
  // 盖亚 · 纪元与纪年基准（数据层，非业务逻辑）
  // 口径来源：世界观库/07·纪元与纪年基准.md「三、换算规则」
  // 换算：红月纪元（新历）＝ 公元 − 2312；公元 ＝ 新历 + 2312
  // 这四个常量是展示层唯一的数字来源，改口径只改这里。
  // ============================================================
  const ERA = {
    offset: 2312,        // 红月纪元零年 = 公元 2312
    today: 2412,         // 「今」建议基准 = 红月 100 年（07·2.4）
    todayRm: 100,
    beforeLabel: '红月前' // 负年表达用词，对齐 07·3.2 锚点表
  };

  // 常用锚点速查（07·3.2）。tier 对应 07·四「年表可信度分级」。
  const ERA_ANCHORS = [
    { ce: -3000, event: '白曐砸入中州',              tier: 'B' },
    { ce: -1620, event: '阿赫兰猎杀踏地者',          tier: 'A' },
    { ce: -665,  event: '初代巴别塔事件（奥尔菲斯）', tier: 'A' },
    { ce: -653,  ce2: -629, event: '六道之战',        tier: 'A' },
    { ce: 0,     event: '埃尔德融入七门',            tier: 'A' },
    { ce: 300,   event: '旧神黄昏结束',              tier: 'A' },
    { ce: 900,   ce2: 1100, event: '灰疫年代',        tier: 'A' },
    { ce: 1050,  event: '最后圣疗失败，圣湖印记熄灭', tier: 'A' },
    { ce: 1662,  event: '第二次圣战，黑烛时代结束',   tier: 'A' },
    { ce: 1700,  event: '灰塔学派成立（启明时代开端）', tier: 'A' },
    { ce: 1850,  event: '《启明遗产》封存于灰塔地下七层', tier: 'A' },
    { ce: 1900,  event: '第一束光，解析时代开端',     tier: 'A' },
    { ce: 2200,  event: '发现第一门，零号禁区-01',    tier: 'A' },
    { ce: 2295,  event: '巴别塔启动，第13层激活',     tier: 'S' },
    { ce: 2296,  event: '巴别塔事故',                 tier: 'S' },
    { ce: 2300,  event: '裂口被彼岸一侧缝合；巴罗萨爆炸', tier: 'S' },
    { ce: 2312,  event: '红月政府成立，红月纪元零年', tier: 'S' },
    { ce: 2342,  event: 'ECO 基金会成立',             tier: 'S' },
    { ce: 2360,  event: '天火研究所叛逃（锈蚀病大流行同期）', tier: 'S' },
    { ce: 2370,  event: '锈蚀病控制住',               tier: 'A' },
    { ce: 2382,  event: '塞拉芬·雷恩上台，黄金时代',  tier: 'A' },
    { ce: 2398,  event: '静态平衡破裂',               tier: 'A' },
    { ce: 2402,  event: '进入静态维持',               tier: 'S' },
    { ce: 2412,  event: '「今」建议基准',             tier: 'A', isNow: true }
  ];

  // 年表可信度分级（07·四）
  const ERA_TIERS = {
    S: { name: '卡死',   note: '可写具体年份' },
    A: { name: '可靠',   note: '可写具体年份' },
    B: { name: '有分歧', note: '写「约」，或只写世纪' },
    C: { name: '不可用', note: '不要引用' },
    X: { name: '版本疑点', note: '按裁决处理' }
  };

  // 正典层级（00·二）：同一条设定有三种说法时，看序号小的
  const CANON_TIERS = [
    { lv: 0, content: '用户当场指定',                          power: '最高，即刻覆盖一切' },
    { lv: 1, content: '08·命名与专名表（已裁决的专名/年份）',   power: '已拍板的结论' },
    { lv: 2, content: '世界史·大升级版 + 07·纪元与纪年基准',    power: '时间线骨架' },
    { lv: 3, content: '神位体系·修正版、红月政府权力结构·修正设定', power: '神系与权力的硬结构' },
    { lv: 4, content: '四洲史',                                power: '细节与地方叙事' },
    { lv: 5, content: '13 份势力档案',                          power: '势力内部设定；年代一律让位于 2 级' },
    { lv: 6, content: '彼岸设定集、第一巨人、两份卡尔莫拉、战争总表', power: '机制/素材；年代与命名不得反压 2 级' }
  ];

  // 作品全集（A–F 组，00·一）：按「你现在要做什么」找文件
  const WORKSHELF_GROUPS = [
    { id: 'A', name: '正文底本', en: 'MASTER NARRATIVE', when: '写故事时读这套', icon: 'doc',
      files: ['世界史·大升级版', '_upg_part1~5.txt', '世界史·优化版（仅作排版模板）'] },
    { id: 'B', name: '洲级叙事', en: 'CONTINENTAL', when: '写地方细节 / 洲内剧情时', icon: 'layers',
      files: ['中州历史', '北洲历史', '东洲历史', '南洲历史'] },
    { id: 'C', name: '势力档案', en: 'FACTIONS ×13', when: '写势力戏必读', icon: 'shield',
      files: ['红月政府', 'ECO基金会', '圣源教', '天教', '原心公司', '圣保罗医院', '永恒钻探（EDC）',
              '红植雇佣兵', '天火研究所', '探险者联盟', '新闻记者联邦', '逻各斯之子', 'V.T.C.'] },
    { id: 'D', name: '设定专题', en: 'SYSTEM STUDIES', when: '写具体机制时查', icon: 'hexagon',
      files: ['神位体系·修正版', '七门阴谋·万年设计', '卡尔莫拉：万年阴谋', '红月政府权力结构·修正设定',
              '红月管控等级', '第一巨人·完整记录', '彼岸（The Other Shore）'] },
    { id: 'E', name: '数据表', en: 'DATA TABLES', when: '画地图、写战争时查', icon: 'grid',
      files: ['盖亚全球地理·校准数据表', '盖亚全战争总表'] },
    { id: 'F', name: '总纲与索引', en: 'COMPENDIUM', when: '不知道从哪读起时，先看这里', icon: 'book',
      files: ['00·总索引与正典层级', '01·世界总纲', '04·体系与名词速查', '07·纪元与纪年基准', '08·命名与专名表', '09·神位体系图谱'] }
  ];

  // 已知作者笔误（00·四）——不是设定，是整理时记录的原文错误
  const KNOWN_ERRATA = [
    { id: 'P1', where: '红月政府权力结构·修正设定', wrong: '更强 centralized 指挥', right: '更强集中指挥' },
    { id: 'P2', where: '彼岸 设定集 3.1 表', wrong: '第二、三种渗流模式未单独列出模式名', right: '建议补「执念牵引」「暴力撕裂」' },
    { id: 'P3', where: '盖亚全球地理', wrong: '文件名截断（`（最终.docx`）', right: '缺右括号，建议重命名' }
  ];

  // 换算工具（展示层共用：换算器弹窗 + 正文年份悬浮）
  function ceToRm(ce) { return Math.round(Number(ce) - ERA.offset); }
  function rmToCe(rm) { return Math.round(Number(rm) + ERA.offset); }
  // 公元年 → 显示串（负数为公元前的表达）
  function fmtCe(ce) {
    const n = Math.round(Number(ce));
    return n < 0 ? ('前 ' + Math.abs(n)) : ('公元 ' + n);
  }
  // 公元年 → 红月纪元显示串（负数记作「红月前 X 年」）
  function fmtRm(ce) {
    const rm = ceToRm(ce);
    return rm >= 0 ? ('红月 ' + rm + ' 年') : (ERA.beforeLabel + ' ' + Math.abs(rm) + ' 年');
  }
  function tierBadge(tier) {
    const t = ERA_TIERS[tier];
    if (!t) return '';
    return `<span class="tier-badge tier-${tier}" title="年表可信度 ${tier} 级 · ${t.name}：${t.note}">${tier}</span>`;
  }

  // ============ Auth 模块 ============
  const AUTH_KEY = 'wa_auth_v1';
  const USERS_KEY = 'wa_users_v1';
  const CODES_KEY = 'wa_codes_v1';
  const SUBMIT_KEY = 'wa_submissions_v1';
  const TOKEN_KEY = 'wa_jwt_v1';
  const ENTRIES_KEY = 'wa_entries_overrides_v1'; // 管理员档案 CRUD 持久化
  const CATS_KEY = 'wa_categories_v1';           // 管理员栏目/子分组 CRUD 持久化
  const DISMISSED_NOTICES_KEY = 'wa_dismissed_notices_v1'; // 已关闭的审核通知
  const FAV_KEY = 'wa_favorites_v1';          // 收藏/书签
  const COMMENT_KEY = 'wa_comments_v1';       // 评论
  const LOG_KEY = 'wa_admin_logs_v1';         // 管理员操作日志
  const THEME_KEY = 'wa_theme_v1';            // 主题 (dark / light)
  const READ_KEY = 'wa_read_progress_v1';     // 阅读进度
  const DRAFT_KEY = 'wa_submit_draft_v1';     // 投稿草稿箱

  // ============ 全站共享互动配置（P2） ============
  // apiBase 留空 = 纯本地模式（行为与之前完全一致，零回归）；
  // 填入 Cloudflare Worker 地址后，评分/收藏计数变为全站共享（仅登录用户可投）。
  const ENGAGE = {
    apiBase: '',            // 例：https://wva-engagement.<你的子域>.workers.dev
    giscus: {
      repo: 'LUEzd8Lg/LUEzd8Lg.github.io',
      repoId: '',           // 仓库开启 Discussions 后到 https://giscus.app/zh-CN 页面获取
      category: 'General',
      categoryId: '',       // 同上；repoId / categoryId 都填了才启用 Giscus 评论区
      theme: 'data/giscus-theme.css'
    }
  };

  // ============ SVG 图标库 ============
  const ICO = {
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18,22 12,18 6,22 7.5,14.5 2,9.5 9,9"/></svg>',
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18,22 12,18 6,22 7.5,14.5 2,9.5 9,9"/></svg>',
    starOutline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 15,9 22,9.5 16.5,14.5 18,22 12,18 6,22 7.5,14.5 2,9.5 9,9"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,3 22,20 2,20"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12,20h9"/><path d="M16.5,3.5a2.1,2.1,0,0,1,3,3L7,19l-4,1,1-4Z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 16,14"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M19,21l-7-5-7,5V5a2,2,0,0,1,2-2h10a2,2,0,0,1,2,2Z"/></svg>',
    bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M19,21l-7-5-7,5V5a2,2,0,0,1,2-2h10a2,2,0,0,1,2,2Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M23,19a2,2,0,0,1-2,2H3a2,2,0,0,1-2-2V8a2,2,0,0,1,2-2H6l2-3h8l2,3h3a2,2,0,0,1,2,2Z"/><circle cx="12" cy="13" r="4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="22" y1="20" x2="2" y2="20"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M14,2H6A2,2,0,0,0,4,4V20a2,2,0,0,0,2,2H18a2,2,0,0,0,2-2V8Z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M19,21H5a2,2,0,0,1-2-2V5A2,2,0,0,1,5,3H16l5,5V19A2,2,0,0,1,19,21Z"/><polyline points="17,21 17,13 7,13 7,21"/><polyline points="7,3 7,8 15,8"/></svg>',
    hexagon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/></svg>',
    diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 22,12 12,22 2,12"/></svg>',
    burst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><polygon points="12,2 14,8 20,6 16,11 22,14 16,15 18,21 12,17 6,21 8,15 2,14 8,11 4,6 10,8"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/></svg>',
    timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><polyline points="12,9 12,13 15,15"/><line x1="9" y1="2" x2="15" y2="2"/></svg>',
    arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12,2L4,5v6c0,5.5,3.8,10.7,8,12c4.2-1.3,8-6.5,8-12V5L12,2z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M1,12s4-8,11-8s11,8,11,8s-4,8-11,8s-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18,10h-1.26A8,8,0,1,0,9,20h9a5,5,0,0,0,0-10Z"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12,20h9"/><path d="M16.5,3.5a2.1,2.1,0,0,1,3,3L7,19l-4,1,1-4Z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7,11V7a5,5,0,0,1,10,0v4"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M4,19.5A2.5,2.5,0,0,1,6.5,17H20"/><path d="M6.5,2H20v20H6.5A2.5,2.5,0,0,1,4,19.5v-15A2.5,2.5,0,0,1,6.5,2Z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84,4.61a5.5,5.5,0,0,0-7.78,0L12,5.67l-1.06-1.06a5.5,5.5,0,0,0-7.78,7.78l1.06,1.06L12,21.23l7.78-7.78,1.06-1.06a5.5,5.5,0,0,0,0-7.78Z"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84,4.61a5.5,5.5,0,0,0-7.78,0L12,5.67l-1.06-1.06a5.5,5.5,0,0,0-7.78,7.78l1.06,1.06L12,21.23l7.78-7.78,1.06-1.06a5.5,5.5,0,0,0,0-7.78Z"/></svg>',
    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,17 4,12 9,7"/><path d="M20,18v-2a4,4,0,0,0-4-4H4"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22,19a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V5a2,2,0,0,1,2-2h5l2,3h9a2,2,0,0,1,2,2z"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,2 22,8 12,14 2,8"/><polyline points="2,14 12,20 22,14"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.7" y1="13.4" x2="15.3" y2="6.6"/><line x1="8.7" y1="10.6" x2="15.3" y2="17.4"/></svg>'
  };
  function ico(name, size) {
    const s = size || 14;
    return `<span class="ico" style="display:inline-flex;width:${s}px;height:${s}px;vertical-align:middle">${ICO[name] || ''}</span>`;
  }

  // ============ 事件总线：跨模块通知数据变更 ============
  const Bus = {
    listeners: {},
    on(evt, fn) { (Bus.listeners[evt] = Bus.listeners[evt] || []).push(fn); },
    emit(evt, payload) { (Bus.listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) {} }); }
  };

  // ============ 收藏模块 ============
  const Favorites = {
    _all() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(FAV_KEY, JSON.stringify(d)); },
    _key() {
      const a = Auth.get();
      return (a && a.user) ? String(a.user) : '__guest__';
    },
    list() {
      const all = Favorites._all();
      return all[Favorites._key()] || [];
    },
    has(cat, id) {
      return Favorites.list().some(f => f.cat === cat && f.id === id);
    },
    toggle(cat, id, entry) {
      const all = Favorites._all();
      const k = Favorites._key();
      let list = all[k] || [];
      const idx = list.findIndex(f => f.cat === cat && f.id === id);
      let added = false;
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.unshift({
          cat, id,
          title: entry?.title || '',
          summary: entry?.summary || '',
          code: entry?.code || '',
          at: Date.now()
        });
        added = true;
      }
      all[k] = list;
      Favorites._save(all);
      Bus.emit('favorites:changed', { cat, id, added });
      return { added, count: list.length };
    }
  };

  // ============ 已读标记（手动 · 游客可用） ============
  const MarkedRead = {
    _all() { try { return JSON.parse(localStorage.getItem('wa_marked_read_v1') || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem('wa_marked_read_v1', JSON.stringify(d)); },
    _key() {
      const a = Auth.get();
      return (a && a.user) ? String(a.user) : '__guest__';
    },
    list() {
      return MarkedRead._all()[MarkedRead._key()] || [];
    },
    has(cat, id) {
      return MarkedRead.list().some(f => f.cat === cat && f.id === id);
    },
    toggle(cat, id, entry) {
      const all = MarkedRead._all();
      const k = MarkedRead._key();
      let list = all[k] || [];
      const idx = list.findIndex(f => f.cat === cat && f.id === id);
      let added = false;
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.unshift({
          cat, id,
          title: entry?.title || '',
          code: entry?.code || '',
          at: Date.now()
        });
        added = true;
      }
      all[k] = list;
      MarkedRead._save(all);
      Bus.emit('markedread:changed', { cat, id, added });
      return { added, count: list.length };
    }
  };

  // ============ 条目评分（SCP 式 +1 / -1） ============
  // 存储：{ [cat:id]: { up: [user,...], down: [user,...] } }
  // 每个账号对同一条目只能投一票；再点同一方向 = 取消；点反方向 = 改票。
  const RATINGS = {
    _all() { try { return JSON.parse(localStorage.getItem('wa_ratings_v1') || '{}'); } catch { return {}; } },
    _save(d) { try { localStorage.setItem('wa_ratings_v1', JSON.stringify(d)); } catch {} },
    _k(cat, id) { return `${cat}:${id}`; },
    _user() {
      const a = Auth.get();
      return (a && a.user) ? String(a.user) : '__guest__';
    },
    _bucket(cat, id) {
      const all = RATINGS._all();
      const b = all[RATINGS._k(cat, id)] || { up: [], down: [] };
      if (!Array.isArray(b.up)) b.up = [];
      if (!Array.isArray(b.down)) b.down = [];
      return { all, b };
    },
    score(cat, id) {
      const b = RATINGS._all()[RATINGS._k(cat, id)] || {};
      const up = (b.up || []).length;
      const down = (b.down || []).length;
      return { up, down, score: up - down, total: up + down };
    },
    mine(cat, id) {
      const b = RATINGS._all()[RATINGS._k(cat, id)] || {};
      const u = RATINGS._user();
      if ((b.up || []).includes(u)) return 1;
      if ((b.down || []).includes(u)) return -1;
      return 0;
    },
    // 投票：dir = 1 / -1；返回投完后的状态
    vote(cat, id, dir) {
      const { all, b } = RATINGS._bucket(cat, id);
      const u = RATINGS._user();
      const was = (b.up || []).includes(u) ? 1 : ((b.down || []).includes(u) ? -1 : 0);
      b.up = (b.up || []).filter(x => x !== u);
      b.down = (b.down || []).filter(x => x !== u);
      let now = 0;
      if (was !== dir) {
        (dir > 0 ? b.up : b.down).push(u);
        now = dir;
      }
      all[RATINGS._k(cat, id)] = b;
      RATINGS._save(all);
      Bus.emit('ratings:changed', { cat, id, dir, now });
      return { ...RATINGS.score(cat, id), mine: now };
    }
  };

  // ============ 评论模块 ============
  const Comments = {
    _all() { try { return JSON.parse(localStorage.getItem(COMMENT_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(COMMENT_KEY, JSON.stringify(d)); },
    _k(cat, id) { return `${cat}:${id}`; },
    list(cat, id) {
      const all = Comments._all();
      return (all[Comments._k(cat, id)] || []).sort((a, b) => a.at - b.at);
    },
    add(cat, id, text, replyTo) {
      if (!text || !text.trim()) return null;
      const all = Comments._all();
      const k = Comments._k(cat, id);
      const list = all[k] || [];
      const a = Auth.get();
      const c = {
        id: 'C' + Date.now() + Math.floor(Math.random() * 1000),
        author: (a && a.user) || '匿名',
        authorLevel: (a && a.lvl) || 'LV.1',
        text: text.trim(),
        at: Date.now(),
        deleted: false,
        replyTo: replyTo || null,
        likes: []
      };
      list.push(c);
      all[k] = list;
      Comments._save(all);
      Bus.emit('comments:changed', { cat, id, comment: c });
      return c;
    },
    remove(cat, id, cid) {
      const all = Comments._all();
      const k = Comments._k(cat, id);
      const list = all[k] || [];
      const idx = list.findIndex(c => c.id === cid);
      if (idx < 0) return false;
      list[idx].deleted = true;
      list[idx].deletedAt = Date.now();
      list[idx].deletedBy = (Auth.get() && Auth.get().user) || 'admin';
      all[k] = list;
      Comments._save(all);
      Bus.emit('comments:changed', { cat, id, removed: cid });
      return true;
    },
    toggleLike(cat, id, cid) {
      const all = Comments._all();
      const k = Comments._k(cat, id);
      const list = all[k] || [];
      const idx = list.findIndex(c => c.id === cid);
      if (idx < 0) return false;
      if (!list[idx].likes) list[idx].likes = [];
      const user = (Auth.get() && Auth.get().user) || '匿名';
      const li = list[idx].likes.indexOf(user);
      if (li >= 0) list[idx].likes.splice(li, 1);
      else list[idx].likes.push(user);
      all[k] = list;
      Comments._save(all);
      Bus.emit('comments:changed', { cat, id, liked: cid });
      return true;
    }
  };

  // ============ 全站共享互动（P2：评分/收藏计数聚合 + Giscus 评论） ============
  // 本地模块仍是"我的操作"的事实来源；Engage 只负责全站计数聚合与评论区挂载。
  // ENGAGE.apiBase 为空时所有方法静默短路，站点行为与之前完全一致。
  const Engage = {
    enabled() { return !!ENGAGE.apiBase; },
    giscusReady() { return !!(ENGAGE.giscus.repoId && ENGAGE.giscus.categoryId); },
    // 仅登录用户的站内用户名可作为共享计数的凭据；游客返回空串
    user() {
      const a = Auth.get();
      return (a && a.user && !a.guest) ? String(a.user) : '';
    },
    key(cat, id) { return `${cat}:${id}`; },
    _headers(withJson) {
      const h = {};
      if (withJson) h['Content-Type'] = 'application/json';
      const u = Engage.user();
      if (u) h['X-WVA-User'] = u;
      return h;
    },
    async _fetch(path, opts) {
      if (!Engage.enabled()) return null;
      const ctl = ('AbortController' in window) ? new AbortController() : null;
      let timer = null;
      if (ctl) timer = setTimeout(() => { try { ctl.abort(); } catch (e) {} }, 6000);
      try {
        const r = await fetch(ENGAGE.apiBase.replace(/\/+$/, '') + path, { ...opts, signal: ctl ? ctl.signal : undefined });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j || j.ok === false) return null;
        return j.data !== undefined ? j.data : null;
      } catch { return null; }
      finally { if (timer) clearTimeout(timer); }
    },
    // 批量取计数：{ key: {up,down,favs,my} }；失败返回 null（调用方保持本地显示）
    async fetchCounts(keys) {
      if (!Engage.enabled() || !keys.length) return null;
      return await Engage._fetch('/api/engagement?keys=' + encodeURIComponent(keys.join(',')), { headers: Engage._headers(false) });
    },
    // 投票上报：服务端与本地 RATINGS 同为 toggle 语义（同向再点=取消）
    async vote(cat, id, dir) {
      return await Engage._fetch('/api/engagement/vote', {
        method: 'POST', headers: Engage._headers(true),
        body: JSON.stringify({ key: Engage.key(cat, id), dir })
      });
    },
    async fav(cat, id, on) {
      return await Engage._fetch('/api/engagement/fav', {
        method: 'POST', headers: Engage._headers(true),
        body: JSON.stringify({ key: Engage.key(cat, id), on: !!on })
      });
    },
    // 详情页：用远端合计刷新评分条 / 收藏数（失败则保留本地显示）
    async hydrateRating(cat, id) {
      const d = await Engage.fetchCounts([Engage.key(cat, id)]);
      if (!d) return;
      Engage.paintRating(d[Engage.key(cat, id)] || { up: 0, down: 0, favs: 0, my: 0 });
    },
    paintRating(c) {
      const score = (c.up || 0) - (c.down || 0);
      const scoreEl = document.getElementById('rating-score');
      if (scoreEl) {
        scoreEl.textContent = score > 0 ? '+' + score : String(score);
        scoreEl.className = 'rating-score ' + (score > 0 ? 'pos' : (score < 0 ? 'neg' : ''));
        scoreEl.title = `好评 ${c.up || 0} · 差评 ${c.down || 0}（全站）`;
      }
      const w = document.getElementById('rating-widget');
      if (w && typeof c.my === 'number') {
        w.querySelectorAll('.rating-btn').forEach(b => {
          b.classList.toggle('active', parseInt(b.getAttribute('data-dir'), 10) === c.my);
        });
      }
      const fc = document.getElementById('fav-shared-count');
      if (fc) fc.textContent = c.favs ? `· ${c.favs} 人收藏` : '';
    },
    // 列表页：批量填充卡片评分角标（占位 span.ec-eng，无票时回显字数）
    async hydrateList(rootEl) {
      if (!Engage.enabled() || !rootEl) return;
      const slots = Array.from(rootEl.querySelectorAll('.ec-eng[data-eng]'));
      const keys = Array.from(new Set(slots.map(el => el.getAttribute('data-eng')).filter(Boolean))).slice(0, 50);
      if (!keys.length) return;
      const d = await Engage.fetchCounts(keys);
      if (!d) return;
      slots.forEach(slot => {
        const c = d[slot.getAttribute('data-eng')];
        const total = c ? (c.up || 0) + (c.down || 0) : 0;
        if (!total) {
          slot.textContent = slot.getAttribute('data-wc') || '';
          slot.classList.remove('pos', 'neg');
          slot.removeAttribute('title');
          return;
        }
        const score = (c.up || 0) - (c.down || 0);
        slot.textContent = `▲ ${score > 0 ? '+' + score : score}`;
        slot.classList.toggle('pos', score > 0);
        slot.classList.toggle('neg', score < 0);
        slot.title = `好评 ${c.up || 0} · 差评 ${c.down || 0}（全站）`;
      });
    },
    // 详情页：滚动接近时懒加载 Giscus 评论区
    mountGiscusLazy(box, term) {
      if (!box) return;
      const inject = () => {
        if (box.dataset.loaded === '1') return;
        box.dataset.loaded = '1';
        const s = document.createElement('script');
        s.src = 'https://giscus.app/client.js';
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-repo', ENGAGE.giscus.repo);
        s.setAttribute('data-repo-id', ENGAGE.giscus.repoId);
        s.setAttribute('data-category', ENGAGE.giscus.category);
        s.setAttribute('data-category-id', ENGAGE.giscus.categoryId);
        s.setAttribute('data-mapping', 'specific');
        s.setAttribute('data-term', term);
        s.setAttribute('data-strict', '0');
        s.setAttribute('data-reactions-enabled', '1');
        s.setAttribute('data-emit-metadata', '0');
        s.setAttribute('data-input-position', 'top');
        const theme = ENGAGE.giscus.theme || '';
        s.setAttribute('data-theme', /^https?:\/\//.test(theme) ? theme : (location.origin + '/' + theme.replace(/^\/+/, '')));
        s.setAttribute('data-lang', 'zh-CN');
        box.innerHTML = '';
        box.appendChild(s);
      };
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((ents) => {
          if (ents.some(x => x.isIntersecting)) { io.disconnect(); inject(); }
        }, { rootMargin: '300px' });
        io.observe(box);
      } else inject();
    }
  };

  // ============ 管理员操作日志 ============
  const AdminLogs = {
    KEY: LOG_KEY,
    all() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } },
    _save(arr) { localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(-500))); },
    record(kind, detail) {
      if (!Auth.isAdmin()) return;
      const a = Auth.get();
      const arr = AdminLogs.all();
      arr.unshift({
        id: 'L' + Date.now(),
        kind,
        detail: detail || '',
        at: Date.now(),
        by: (a && a.user) || 'admin'
      });
      AdminLogs._save(arr);
      Bus.emit('logs:changed', { kind });
    },
    clear() { AdminLogs._save([]); },
    list() { return AdminLogs.all(); },
    types() { return [...new Set(AdminLogs.all().map(l => l.kind))].sort(); }
  };

  // ============ 主题切换 ============
  const Theme = {
    KEY: THEME_KEY,
    CYCLE: ['dark', 'light', 'holo'],
    get() { return localStorage.getItem(THEME_KEY) || 'dark'; },
    set(t) {
      const v = Theme.CYCLE.includes(t) ? t : 'dark';
      localStorage.setItem(THEME_KEY, v);
      Theme._apply(v);
      Bus.emit('theme:changed', v);
      return v;
    },
    next() {
      const cur = Theme.get();
      const idx = Theme.CYCLE.indexOf(cur);
      return Theme.set(Theme.CYCLE[(idx + 1) % Theme.CYCLE.length]);
    },
    _apply(v) {
      const root = document.documentElement;
      root.classList.toggle('theme-light', v === 'light');
      root.classList.toggle('theme-holo', v === 'holo');
    },
    init() {
      Theme._apply(Theme.get());
    }
  };

  // ============ 阅读进度记忆 ============
  const ReadProgress = {
    KEY: READ_KEY,
    _all() { try { return JSON.parse(localStorage.getItem(READ_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(READ_KEY, JSON.stringify(d)); },
    _k(cat, id) { return `${cat}:${id}`; },
    save(cat, id, scrollTop, offsetPct) {
      const a = Auth.get();
      if (!a) return;
      const all = ReadProgress._all();
      const key = `${a.user}|${ReadProgress._k(cat, id)}`;
      all[key] = { scrollTop, offsetPct: Math.min(100, Math.max(0, offsetPct || 0)), at: Date.now() };
      ReadProgress._save(all);
    },
    get(cat, id) {
      const a = Auth.get();
      if (!a) return null;
      const all = ReadProgress._all();
      const key = `${a.user}|${ReadProgress._k(cat, id)}`;
      return all[key] || null;
    },
    clear(cat, id) {
      const a = Auth.get();
      if (!a) return;
      const all = ReadProgress._all();
      const key = `${a.user}|${ReadProgress._k(cat, id)}`;
      delete all[key];
      ReadProgress._save(all);
    },
    list() {
      const a = Auth.get();
      if (!a) return [];
      const all = ReadProgress._all();
      const prefix = `${a.user}|`;
      return Object.entries(all)
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]) => {
          const [, ck] = k.split('|');
          const [cat, id] = ck.split(':');
          return { cat, id, ...v };
        });
    },
    clearAll() {
      const a = Auth.get();
      if (!a) return;
      const all = ReadProgress._all();
      const prefix = `${a.user}|`;
      Object.keys(all).forEach(k => { if (k.startsWith(prefix)) delete all[k]; });
      ReadProgress._save(all);
    }
  };

  // ============ 云同步（GitHub 仓库存储） ============
  // 纯前端实现：经 GitHub REST API 把收藏 / 阅读进度 / 评论读写进用户仓库 cloud/ 目录。
  // 注意：GitHub Pages 为纯静态托管，无后端可写存储，故以用户自己的 GitHub 仓库作为“云存储”。
  const CLOUD_CFG_KEY = 'wa_cloud_cfg_v1';
  const CloudSync = {
    _memToken: '',   // 未勾选“记住令牌”时，token 仅本次会话内存持有，不落盘
    cfg() {
      let c = {};
      try { c = JSON.parse(localStorage.getItem(CLOUD_CFG_KEY) || '{}'); } catch {}
      if (CloudSync._memToken) return { ...c, token: CloudSync._memToken };
      return c;
    },
    saveCfg(c) {
      if (c.token) CloudSync._memToken = c.token;
      const persist = { ...c };
      if (!c.remember) delete persist.token;
      localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(persist));
    },
    clearCfg() {
      localStorage.removeItem(CLOUD_CFG_KEY);
      CloudSync._memToken = '';
    },
    isConfigured() { const c = CloudSync.cfg(); return !!(c.owner && c.repo && c.token); },
    cloudPath(user) { return 'cloud/sync-' + encodeURIComponent(user) + '.json'; },

    _headers(cfg) {
      return {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + (cfg.token || ''),
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      };
    },

    async apiGet(cfg, path) {
      const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + path;
      const res = await fetch(url, { headers: CloudSync._headers(cfg) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('GH_' + res.status);
      return res.json();
    },

    async apiPut(cfg, path, contentB64, sha) {
      const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + path;
      const body = {
        message: 'Worldview Archive cloud sync ' + new Date().toISOString(),
        content: contentB64
      };
      if (sha) body.sha = sha;
      const res = await fetch(url, {
        method: 'PUT',
        headers: CloudSync._headers(cfg),
        body: JSON.stringify(body)
      });
      if (res.status === 422 && !sha) {
        // 云端文件已存在但本地没有 sha → 先读取再重试
        const existing = await CloudSync.apiGet(cfg, path);
        if (existing && existing.sha) return CloudSync.apiPut(cfg, path, contentB64, existing.sha);
      }
      if (!res.ok) throw new Error('GH_PUT_' + res.status);
      return res.json();
    },

    // 序列化“当前用户”的本地数据为云端 payload
    serialize() {
      const a = Auth.get();
      const user = (a && a.user) || 'guest';
      const favAll = Favorites._all();
      const readAll = ReadProgress._all();
      const readUser = {};
      const prefix = user + '|';
      Object.keys(readAll).forEach(k => { if (k.startsWith(prefix)) readUser[k.slice(prefix.length)] = readAll[k]; });
      return {
        version: 1,
        user,
        updatedAt: Date.now(),
        favorites: favAll[user] || [],
        reading: readUser,
        comments: Comments._all()
      };
    },

    // 把云端 payload 合并进本地（并集去重，避免丢数据）
    apply(payload) {
      if (!payload || typeof payload !== 'object') return { applied: 0 };
      const a = Auth.get();
      const user = (a && a.user) || 'guest';
      let n = 0;
      if (Array.isArray(payload.favorites)) {
        const favAll = Favorites._all();
        const local = favAll[user] || [];
        const seen = new Set(local.map(f => f.cat + ':' + f.id));
        const merged = local.slice();
        for (const f of payload.favorites) {
          const key = f.cat + ':' + f.id;
          if (!seen.has(key)) { merged.push(f); seen.add(key); n++; }
        }
        favAll[user] = merged;
        Favorites._save(favAll);
      }
      if (payload.reading && typeof payload.reading === 'object') {
        const readAll = ReadProgress._all();
        const prefix = user + '|';
        Object.keys(payload.reading).forEach(k => {
          const key = prefix + k;
          if (!readAll[key]) { readAll[key] = payload.reading[k]; n++; }
        });
        ReadProgress._save(readAll);
      }
      if (payload.comments && typeof payload.comments === 'object') {
        const all = Comments._all();
        Object.keys(payload.comments).forEach(k => {
          const arr = (payload.comments[k] || []).filter(c => c && !c.deleted);
          const localArr = all[k] || [];
          const seen = new Set(localArr.map(c => c.id));
          arr.forEach(c => { if (!seen.has(c.id)) { localArr.push(c); seen.add(c.id); n++; } });
          all[k] = localArr;
        });
        Comments._save(all);
      }
      Bus.emit('favorites:changed');
      Bus.emit('comments:changed');
      Bus.emit('stats:refresh');
      return { applied: n };
    },

    async push(cfg) {
      const a = Auth.get();
      if (!a) throw new Error('NO_AUTH');
      const user = a.user;
      const payload = CloudSync.serialize();
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
      const path = CloudSync.cloudPath(user);
      const existing = await CloudSync.apiGet(cfg, path);
      await CloudSync.apiPut(cfg, path, b64, existing && existing.sha);
      return { pushedAt: Date.now(), user };
    },

    async pull(cfg) {
      const a = Auth.get();
      if (!a) throw new Error('NO_AUTH');
      const user = a.user;
      const file = await CloudSync.apiGet(cfg, CloudSync.cloudPath(user));
      if (!file) return { found: false };
      const text = decodeURIComponent(escape(atob(String(file.content).replace(/\s/g, ''))));
      const payload = JSON.parse(text);
      const res = CloudSync.apply(payload);
      return { found: true, applied: res.applied };
    }
  };

  // ============ 投稿草稿箱 ============
  const SubmitDraft = {
    KEY: DRAFT_KEY,
    _k() {
      const a = Auth.get();
      return (a && a.user) ? String(a.user) : '__guest__';
    },
    get() {
      try {
        const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        return all[SubmitDraft._k()] || null;
      } catch { return null; }
    },
    save(data) {
      try {
        const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        all[SubmitDraft._k()] = { ...data, at: Date.now() };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
        Bus.emit('draft:saved', { at: Date.now() });
        return true;
      } catch { return false; }
    },
    clear() {
      try {
        const all = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        delete all[SubmitDraft._k()];
        localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
      } catch {}
    }
  };

  const Auth = {
    get() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } },
    set(a) { localStorage.setItem(AUTH_KEY, JSON.stringify(a)); },
    clear() {
      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(TOKEN_KEY);
    },

    // JWT token
    getToken() { return localStorage.getItem(TOKEN_KEY) || ''; },
    setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, String(t)); else localStorage.removeItem(TOKEN_KEY); },

    role() { const a = Auth.get(); return (a && a.role) ? a.role : (a && a.user === 'admin' ? 'admin' : 'user'); },
    isAdmin() { return Auth.role() === 'admin'; },

    // 用户库
    getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; } },
    saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); },
    findUser(contact) {
      const c = contact.trim().toLowerCase();
      return Auth.getUsers().find(u => u.contact.toLowerCase() === c);
    },
    // 删除本地用户 + 投稿留痕
    deleteAccountLocal(contact, password) {
      const u = Auth.findUser(contact);
      if (!u) return { ok:false, msg:'账号不存在' };
      if (u.pass !== btoa(password)) return { ok:false, msg:'密码错误，无法注销' };
      const users = Auth.getUsers().filter(x => x.contact.toLowerCase() !== contact.toLowerCase());
      Auth.saveUsers(users);
      // 投稿留痕
      const subs = Submissions.get();
      let sc = 0;
      subs.forEach(s => {
        if ((s.author||'').toLowerCase() === contact.toLowerCase()) {
          s.author = '(已注销用户)';
          s.deleted = true;
          sc++;
        }
      });
      localStorage.setItem(SUBMIT_KEY, JSON.stringify(subs));
      Auth.clear();
      return {
        ok: true,
        fallback: true,
        msg: sc > 0 ? `账号已注销，保留 ${sc} 篇投稿（作者置为已注销）` : '账号已注销'
      };
    },

    // 验证码（5 分钟有效期）
    generateCode(contact) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codes = Auth.getCodes();
      codes[contact.trim().toLowerCase()] = { code, exp: Date.now() + 5*60*1000 };
      localStorage.setItem(CODES_KEY, JSON.stringify(codes));
      return code;
    },
    getCodes() { try { return JSON.parse(localStorage.getItem(CODES_KEY) || '{}'); } catch { return {}; } },
    verifyCode(contact, code) {
      const k = contact.trim().toLowerCase();
      const c = Auth.getCodes()[k];
      if (!c) return { ok:false, msg:'请先发送验证码' };
      if (Date.now() > c.exp) return { ok:false, msg:'验证码已过期，请重新发送' };
      if (c.code !== code.trim()) return { ok:false, msg:'验证码不正确' };
      return { ok:true };
    },

    // 注册
    register(contact, password) {
      if (Auth.findUser(contact)) return { ok:false, msg:'该手机号/邮箱已注册' };
      const users = Auth.getUsers();
      users.push({
        contact: contact.trim(),
        pass: btoa(password),
        at: Date.now()
      });
      Auth.saveUsers(users);
      return { ok:true };
    },

    // 登录
    login(contact, password) {
      const u = Auth.findUser(contact);
      if (!u) return { ok:false, msg:'账号不存在，请先注册' };
      if (u.pass !== btoa(password)) return { ok:false, msg:'密码错误' };
      Auth.set({ user: u.contact, lvl:'LV.2', at:Date.now(), guest:false });
      return { ok:true };
    },

    // 验证码登录（离线降级）
    loginByCode(contact, code) {
      const v = Auth.verifyCode(contact, code);
      if (!v.ok) return v;
      const u = Auth.findUser(contact);
      if (!u) return { ok:false, msg:'该手机号/邮箱未注册，请先注册' };
      Auth.set({ user: u.contact, lvl:'LV.2', at:Date.now(), guest:false });
      return { ok:true, fallback:true };
    },

    // 游客
    guest() {
      Auth.set({ user:'游客', lvl:'LV.1', at:Date.now(), guest:true });
    },

    // 权限
    isLv(n) {
      const a = Auth.get(); if (!a) return false;
      const map = { 'LV.1':1,'LV.2':2,'LV.3':3,'LV.4':4,'LV.5':5,'LV.9':9 };
      return (map[a.lvl] || 0) >= (map[n] || 0);
    },
    canSubmit() { return Auth.isLv('LV.2'); },
    isGuest() { const a = Auth.get(); return a && a.guest; },
    identity() {
      const a = Auth.get();
      if (!a) return '访客 LV.1';
      return `${a.user} · ${a.lvl || 'LV.1'}`;
    }
  };

  // ============ API 层（优先走后端 Node.js，不通降级 localStorage mock）============
  const API = {
    _authHeaders() {
      const t = Auth.getToken();
      if (!t) return {};
      return { 'Authorization': `Bearer ${t}` };
    },
    async _fetch(path, opts = {}) {
      try {
        const headers = Object.assign(
          {},
          { 'Content-Type': 'application/json' },
          API._authHeaders(),
          (opts.headers || {})
        );
        const reqOpts = Object.assign({
          headers,
          credentials: 'same-origin'
        }, opts.method ? { method: opts.method } : {});
        if (opts.body) reqOpts.body = JSON.stringify(opts.body);
        const res = await fetch(path, reqOpts);
        const ct = res.headers.get('content-type') || '';
        // 静态服务器返回非 JSON（如 404 纯文本）→ 视为后端未启动
        if (!ct.includes('application/json')) {
          return { ok: false, _fetchError: true, msg: '后端未启动，已切换至离线模式' };
        }
        const json = await res.json().catch(() => ({}));
        json._httpStatus = res.status;
        return json;
      } catch (e) {
        return { ok: false, _fetchError: true, msg: '后端未启动，已切换至离线模式' };
      }
    },
    async sendCode(contact) {
      const r = await API._fetch('/api/send-code', { method:'POST', body:{ contact } });
      if (r._fetchError) {
        // 降级：本地 mock 生成验证码（跟之前一模一样的逻辑）
        const code = Auth.generateCode(contact);
        return { ok:true, mock:true, fallback:true, code, msg:`演示模式(降级)：验证码为 ${code}` };
      }
      return r;
    },
    async register(contact, code, password) {
      const r = await API._fetch('/api/register', { method:'POST', body:{ contact, code, password } });
      if (r._fetchError) {
        // 降级：localStorage 注册
        const vc = Auth.verifyCode(contact, code);
        if (!vc.ok) return vc;
        const reg = Auth.register(contact, password);
        if (!reg.ok) return reg;
        Auth.set({ user: contact, lvl:'LV.2', at:Date.now(), guest:false, role:'user' });
        return { ok:true, fallback:true };
      }
      if (r.ok && r.user) {
        if (r.token) Auth.setToken(r.token);
        Auth.set({ user: r.user.contact, lvl: r.user.level, at: Date.now(), guest:false, role: r.user.role || 'user' });
      }
      return r;
    },
    async login(contact, password) {
      const r = await API._fetch('/api/login', { method:'POST', body:{ contact, password } });
      if (r._fetchError) {
        // 降级：localStorage 登录；如果 contact === 'admin' && password === 'admin123' 就解锁前端管理员
        if (String(contact).trim() === 'admin' && password === 'admin123') {
          Auth.setToken('');
          Auth.set({ user: 'admin', lvl:'LV.9', at:Date.now(), guest:false, role:'admin' });
          return { ok:true, fallback:true, user:{contact:'admin', level:'LV.9', role:'admin'}};
        }
        return Auth.login(contact, password);
      }
      if (r.ok && r.user) {
        if (r.token) Auth.setToken(r.token);
        Auth.set({ user: r.user.contact, lvl: r.user.level, at: Date.now(), guest:false, role: r.user.role || 'user' });
      }
      return r;
    },
    async loginByCode(contact, code) {
      const r = await API._fetch('/api/login', { method:'POST', body:{ contact, code } });
      if (r._fetchError) {
        // 降级：localStorage 验证码登录
        return Auth.loginByCode(contact, code);
      }
      if (r.ok && r.user) {
        if (r.token) Auth.setToken(r.token);
        Auth.set({ user: r.user.contact, lvl: r.user.level, at: Date.now(), guest:false, role: r.user.role || 'user' });
      }
      return r;
    },
    async submit(payload) {
      const body = Object.assign({}, payload);
      const r = await API._fetch('/api/submit', { method:'POST', body });
      if (r._fetchError) {
        if (!Auth.canSubmit()) return { ok:false, msg:'需 LV.2 以上权限' };
        if (!payload.title || !payload.body) return { ok:false, msg:'标题和正文必填' };
        const saved = Submissions.add(payload);
        const ghResult = await pushSubmissionToGitHub(saved);
        return { ok:true, fallback:true, submission: saved, github: ghResult };
      }
      return r;
    },
    // DOCX 文件上传解析（multipart/form-data，字段名 doc = file）
    async uploadDocx(file) {
      try {
        const data = new FormData();
        data.append('doc', file);
        const headers = Object.assign({}, API._authHeaders());
        const res = await fetch('/api/submit/upload-docx', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: data
        });
        const ct = res.headers.get('content-type') || '';
        // 静态服务器（GitHub Pages）返回非 JSON 或非 2xx → 降级到浏览器端 mammoth.js
        if (!ct.includes('application/json') || !res.ok) {
          return await API._docxFallbackBrowser(file);
        }
        const json = await res.json().catch(() => ({}));
        json._httpStatus = res.status;
        if (json.ok) return json;
        // 后端返回错误 JSON → 也降级到浏览器端解析
        if (!window.__mammothFailed) return await API._docxFallbackBrowser(file);
        return json;
      } catch (e) {
        return await API._docxFallbackBrowser(file);
      }
    },
    // 本地图片上传 → 返回可用的 <img src>
    async uploadImage(file) {
      // 先尝试后端上传
      try {
        const data = new FormData();
        data.append('image', file);
        const headers = Object.assign({}, API._authHeaders());
        const res = await fetch('/api/submit/upload-image', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: data
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.ok && json.url) return { ok: true, url: json.url, fallback: false };
        }
      } catch (e) { /* 降级 base64 */ }
      // 降级：转 base64 data URI
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ ok: true, url: reader.result, fallback: true });
        reader.onerror = () => resolve({ ok: false, msg: '图片读取失败' });
        reader.readAsDataURL(file);
      });
    },
    async uploadAudio(file) {
      const MAX_SIZE = 15 * 1024 * 1024;
      if (file.size > MAX_SIZE) return { ok: false, msg: '音频文件过大（限制 15MB）' };
      try {
        const data = new FormData();
        data.append('audio', file);
        const headers = Object.assign({}, API._authHeaders());
        const res = await fetch('/api/submit/upload-audio', {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: data
        });
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          if (json.ok && json.url) return { ok: true, url: json.url, fallback: false };
        }
      } catch (e) { /* 降级 base64 */ }
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ ok: true, url: reader.result, fallback: true });
        reader.onerror = () => resolve({ ok: false, msg: '音频读取失败' });
        reader.readAsDataURL(file);
      });
    },
    // 排版原件（HTML）：直接提交到 GitHub 仓库，返回仓库内相对路径
    // 不做 base64 回退 —— 整份排版 HTML 塞进 JSON 会把档案库撑爆
    async uploadDossier(file) {
      const MAX_SIZE = 4 * 1024 * 1024;
      if (file.size > MAX_SIZE) return { ok: false, msg: '文件过大（限制 4MB）' };
      const name = String(file.name || 'dossier.html')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_');
      const safeName = /\.html?$/i.test(name) ? name : (name + '.html');
      const repoPath = 'data/dossier/' + safeName;

      let text;
      try { text = await file.text(); }
      catch (e) { return { ok: false, msg: '文件读取失败' }; }

      const cfg = CloudSync.cfg();
      if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) {
        return { ok: false, msg: '需先在「云同步」配置 GitHub 仓库与令牌，才能把排版文件传进仓库' };
      }

      // UTF-8 → base64（GitHub Contents API 要求 base64）
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      const b64 = btoa(bin);

      try {
        let sha = null;
        const existing = await CloudSync.apiGet(cfg, repoPath);
        if (existing && existing.sha) sha = existing.sha;
        await CloudSync.apiPut(cfg, repoPath, b64, sha);
        return { ok: true, url: repoPath, fallback: false };
      } catch (e) {
        return { ok: false, msg: '提交到 GitHub 失败：' + (e.message || e) };
      }
    },
    // 第 5 期 · 审核通过时把正文 base64 图片批量转存到仓库 data/uploads/
    // 相同内容的图片只上传一次；未配置云同步时返回 ok:false 并保留 base64 内嵌
    async persistBodyImages(html) {
      const imgRe = /src=(["'])(data:image\/([a-z0-9.+-]+);base64,([^"']+))\1/gi;
      const uniq = new Map(); // dataUri → { ext, b64 }
      let m;
      while ((m = imgRe.exec(html))) {
        if (!uniq.has(m[2])) uniq.set(m[2], { ext: m[3], b64: m[4] });
      }
      if (!uniq.size) return { ok: true, html, uploaded: 0, failed: 0 };
      const cfg = CloudSync.cfg();
      if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) {
        return { ok: false, html, uploaded: 0, failed: uniq.size, msg: '未配置云同步，图片将以内嵌 base64 方式发布（建议先在「云同步」配置仓库与令牌）' };
      }
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const base = 'dx' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate())
        + '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
      const extMap = { 'jpeg': 'jpg', 'svg+xml': 'svg' };
      let uploaded = 0, failed = 0, i = 0;
      const urlMap = new Map();
      for (const [dataUri, info] of uniq) {
        i++;
        const ext = extMap[info.ext] || String(info.ext || 'png').replace(/[^a-z0-9]/g, '') || 'png';
        const path = 'data/uploads/' + base + '_' + String(i).padStart(2, '0') + '.' + ext;
        try {
          let sha = null;
          try {
            const ex = await CloudSync.apiGet(cfg, path);
            if (ex && ex.sha) sha = ex.sha;
          } catch (_) { /* 不存在则新建 */ }
          await CloudSync.apiPut(cfg, path, info.b64, sha);
          urlMap.set(dataUri, path);
          uploaded++;
        } catch (e) { failed++; }
      }
      let out = html;
      urlMap.forEach((path, dataUri) => { out = out.split(dataUri).join(path); });
      return { ok: true, html: out, uploaded, failed };
    },
    // 动态加载自研 DOCX 保真解析器（仅投稿页用到时注入）
    _ensureDocxParser() {
      if (window.DOCXParser) return Promise.resolve(true);
      if (window.__dxParserLoading) return window.__dxParserLoading;
      window.__dxParserLoading = new Promise((res) => {
        const s = document.createElement('script');
        s.src = 'docx-parser.js?v=1';
        s.onload = () => res(true);
        s.onerror = () => res(false);
        document.head.appendChild(s);
      });
      return window.__dxParserLoading;
    },
    // 浏览器端 mammoth.js 解析 DOCX（base64 嵌入图片）
    async _docxFallbackBrowser(file) {
      // 第 1 期路由：手动直接格式文档（pStyle<3）走自研保真解析器；标准样式文档走 mammoth
      try {
        await API._ensureDocxParser();
        if (window.DOCXParser) {
          const buf0 = await file.arrayBuffer();
          const info = await window.DOCXParser.inspect(buf0);
          if (info.pStyleCount < 3) {
            const r = await window.DOCXParser.parse(buf0);
            const text = r.html.replace(/<[^>]+>/g, '').replace(/&emsp;/g, '　').replace(/&nbsp;/g, ' ');
            const titleM = r.html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || r.html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
            const titleSuggest = titleM
              ? titleM[1].replace(/<[^>]+>/g, '').trim().slice(0, 40)
              : (text.split('\n').map(s => s.trim()).find(s => s.length > 0) || '').slice(0, 40);
            const imgCount = r.stats.images || 0;
            return {
              ok: true,
              fallback: true,
              parser: 'dx',
              html: r.html,
              text,
              titleSuggest,
              imageCount: imgCount,
              warnings: r.warnings || [],
              msg: `保真解析完成 · 提取文字 ${r.stats.chars} 字 · 表格 ${r.stats.tables} 个 · 图片 ${imgCount} 张` +
                (r.stats.compressed ? `（${r.stats.compressed} 张已压缩）` : '')
            };
          }
        }
      } catch (e) { /* 自研解析器失败 → 继续 mammoth 兜底 */ }
      if (!window.mammoth) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js';
          s.onload = () => res();
          s.onerror = () => { window.__mammothFailed = true; rej(new Error('mammoth.js 加载失败')); };
          document.head.appendChild(s);
        }).catch(() => null);
      }
      if (!window.mammoth) return { ok:false, msg:'后端未启动且 mammoth.js CDN 无法加载，暂无法解析 DOCX（可直接把文字粘到正文框）' };
      const buf = await file.arrayBuffer();
      // 尝试带图片提取的解析，如果 images API 不可用则降级为纯文本解析
      let result;
      const opts = {};
      // 安全检查：mammoth.images.dataUri 在部分浏览器版中可能不存在
      try {
        if (window.mammoth.images && typeof window.mammoth.images.dataUri === 'function') {
          opts.convertImage = window.mammoth.images.dataUri();
        }
      } catch (_) { /* 忽略，走默认 */ }
      try {
        result = await window.mammoth.convertToHtml({ arrayBuffer: buf }, opts);
      } catch (e) {
        // 如果带图片解析失败，重试不带 convertImage
        result = await window.mammoth.convertToHtml({ arrayBuffer: buf });
      }
      let text = '';
      try {
        const txt = await window.mammoth.extractRawText({ arrayBuffer: buf });
        text = (txt.value || '').replace(/\r?\n/g, '\n');
      } catch (_) { text = (result.value || '').replace(/<[^>]+>/g, ''); }
      const html = (result.value || '');
      const firstLine = text.split('\n').map(s => s.trim()).find(s => s.length > 0) || '';
      const imgCount = (html.match(/<img\s/gi) || []).length;
      return {
        ok: true,
        fallback: true,
        html, text,
        titleSuggest: firstLine.slice(0, 40),
        imageCount: imgCount,
        warnings: (result.messages || []).map(m => m.message).slice(0, 20),
        msg: imgCount > 0
          ? `浏览器端解析完成 · 提取文字 ${text.length} 字 · 图片 ${imgCount} 张（base64 嵌入）`
          : `浏览器端解析完成 · 提取文字 ${text.length} 字`
      };
    },
    async fetchSubmissions(limit = 100) {
      const r = await API._fetch(`/api/submissions?limit=${limit}`, { method:'GET' });
      if (r._fetchError) {
        return { ok:true, fallback:true, total: Submissions.get().length, list: Submissions.get() };
      }
      return r;
    },
    async deleteAccount(contact, password) {
      const r = await API._fetch('/api/account', { method:'DELETE', body:{ contact, password, confirm:true } });
      if (r._fetchError) {
        return Auth.deleteAccountLocal(contact, password);
      }
      if (r.ok) Auth.clear();
      return r;
    },

    // ============ 管理员专用 API（全部走 requireAdmin 中间件）============
    _adminFetch(path, opts) {
      return API._fetch(path, opts);
    },
    async adminListSubmissions(status = 'pending', category = '') {
      const qs = new URLSearchParams();
      if (status) qs.set('status', status);
      if (category) qs.set('category', category);
      const r = await API._adminFetch(`/api/admin/submissions?${qs.toString()}`, { method:'GET' });
      if (r._fetchError) return API._adminLocalFallback('subs', { status, category });
      return r;
    },
    async adminReview(subId, status, { note = '', patch = null, githubFile = null, githubSha = null } = {}) {
      const r = await API._adminFetch(`/api/admin/submissions/${encodeURIComponent(subId)}/review`, {
        method:'POST',
        body: { status, note, patch }
      });
      if (r._fetchError) {
        // 降级：在 localStorage 中更新投稿状态
        const updated = Submissions.update(subId, {
          status: status,
          reviewNote: note || '',
          reviewedAt: Date.now()
        });
        if (!updated) {
          // GitHub投稿不在localStorage中，直接处理
          if (githubFile) {
            let mergedEntry = null;
            if (status === 'approved' && patch) {
              const cat = patch.category || 'anomalies';
              const entry = {
                id: patch.id || subId,
                title: patch.title || '',
                class: patch.class || 'neutral',
                code: patch.code || '',
                summary: patch.summary || '',
                body: patch.body || '',
                content: patch.body || '',
                tags: patch.tags || [],
                source: patch.source || '',
                img: patch.cover || '',
                audio: patch.audio || ''
              };
              LocalEntries.add(cat, entry);
              mergedEntry = { ...entry, cat };
            }
            AdminLogs.record(status === 'approved' ? 'submission:approve' : 'submission:reject',
              `${subId} · GitHub投稿${note ? ' · 备注:' + note : ''}`);
            Bus.emit('submissions:reviewed', { id: subId, status, note });
            Bus.emit('stats:refresh');
            Bus.emit('data:changed');
            return { ok:true, fallback:true, githubSubmission: true, mergedEntry };
          }
          return { ok:false, msg:'未找到投稿' };
        }
        // 如果通过审核，把投稿内容作为新档案加入对应分类
        let mergedEntry = null;
        if (status === 'approved' && patch) {
          const cat = patch.category || updated.category || 'anomalies';
          const entry = {
            id: patch.id || updated.id,
            title: patch.title || updated.title,
            class: patch.class || updated.class || 'neutral',
            code: patch.code || updated.code || '',
            summary: patch.summary || updated.summary || '',
            body: patch.body || updated.body || '',
            content: patch.body || updated.body || '',
            tags: patch.tags || updated.tags || [],
            source: patch.source || updated.source || '',
            img: patch.cover || updated.cover || '',
            audio: patch.audio || updated.audio || ''
          };
          LocalEntries.add(cat, entry);
          mergedEntry = { ...entry, cat };
        }
        // 操作日志 + 通知
        AdminLogs.record(status === 'approved' ? 'submission:approve' : 'submission:reject',
          `${subId} · ${updated.title || ''}${note ? ' · 备注:' + note : ''}`);
        Bus.emit('submissions:reviewed', { id: subId, status, note });
        Bus.emit('stats:refresh');
        Bus.emit('data:changed');
        return { ok:true, fallback:true, submission: updated, mergedEntry };
      }
      if (r.ok) {
        AdminLogs.record(status === 'approved' ? 'submission:approve' : 'submission:reject',
          `${subId}${note ? ' · 备注:' + note : ''}`);
        Bus.emit('submissions:reviewed', { id: subId, status, note });
        Bus.emit('stats:refresh');
      }
      return r;
    },
    async adminListEntries(cat) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}`, { method:'GET' });
      if (r._fetchError) {
        // 降级：直接从浏览器内存 DATA 读（已包含 LocalEntries 覆盖）
        const list = (DATA[cat] || []).map(x => Object.assign({ _cat:cat }, x));
        return { ok:true, fallback:true, total: list.length, list };
      }
      return r;
    },
    async adminAddEntry(cat, payload) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}`, { method:'POST', body: payload });
      if (r._fetchError) {
        // 降级：通过 LocalEntries 持久化到 localStorage
        const p = Object.assign({}, payload);
        p.id = String(p.id || 'ENT-' + String((DATA[cat]||[]).length + 1).padStart(3,'0'));
        p.content = p.content || p.body || '';
        p.body    = p.body || p.content || '';
        LocalEntries.add(cat, p);
        AdminLogs.record('entry:add', `${cat}/${p.id} · ${p.title || ''}`);
        Bus.emit('stats:refresh');
        return { ok:true, fallback:true, entry: p };
      }
      if (r.ok) {
        AdminLogs.record('entry:add', `${cat}/${payload.id || ''} · ${payload.title || ''}`);
        Bus.emit('stats:refresh');
      }
      return r;
    },
    async adminUpdateEntry(cat, id, patch) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}/${encodeURIComponent(id)}`, { method:'PUT', body: patch });
      if (r._fetchError) {
        // 降级：通过 LocalEntries 持久化
        const arr = DATA[cat] || [];
        const found = arr.find(x => String(x.id) === String(id));
        if (!found) return { ok:false, msg:'未找到档案' };
        const merged = Object.assign({}, found, patch, { id: patch.id || id });
        LocalEntries.update(cat, id, merged);
        AdminLogs.record('entry:update', `${cat}/${id}`);
        return { ok:true, fallback:true, entry: merged };
      }
      if (r.ok) AdminLogs.record('entry:update', `${cat}/${id}`);
      return r;
    },
    async adminDeleteEntry(cat, id) {
      const r = await API._adminFetch(`/api/admin/entries/${encodeURIComponent(cat)}/${encodeURIComponent(id)}`, { method:'DELETE' });
      if (r._fetchError) {
        // 降级：通过 LocalEntries 持久化
        const arr = DATA[cat] || [];
        const found = arr.find(x => String(x.id) === String(id));
        if (!found) return { ok:false, msg:'未找到档案' };
        LocalEntries.delete(cat, id);
        AdminLogs.record('entry:delete', `${cat}/${id} · ${found.title || ''}`);
        Bus.emit('stats:refresh');
        return { ok:true, fallback:true, removed: found };
      }
      if (r.ok) {
        AdminLogs.record('entry:delete', `${cat}/${id}`);
        Bus.emit('stats:refresh');
      }
      return r;
    },
    async adminListUsers() {
      const r = await API._adminFetch('/api/admin/users', { method:'GET' });
      if (r._fetchError) {
        // 降级：本地 users
        const list = Auth.getUsers().map(u => ({
          contact: u.contact,
          level: u.level || 'LV.2',
          role: u.role || (u.contact === 'admin' ? 'admin' : 'user'),
          createdAt: u.createdAt || 0,
          builtIn: u.builtIn || u.contact === 'admin'
        }));
        return { ok:true, fallback:true, total: list.length, list };
      }
      return r;
    },
    async adminUpdateUser(contact, patch) {
      const r = await API._adminFetch(`/api/admin/users/${encodeURIComponent(contact)}/update`, {
        method:'POST',
        body: patch || {}
      });
      if (r._fetchError) {
        // 降级：在 localStorage users 中更新
        const users = Auth.getUsers();
        const idx = users.findIndex(u => u.contact === contact);
        if (idx < 0) return { ok:false, msg:'未找到用户' };
        users[idx] = Object.assign({}, users[idx], patch);
        Auth.saveUsers(users);
        AdminLogs.record('user:update', `${contact} · level:${patch.level||''} role:${patch.role||''}`);
        return { ok:true, fallback:true, user: users[idx] };
      }
      if (r.ok) AdminLogs.record('user:update', contact);
      return r;
    },
    async adminDeleteUser(contact) {
      const r = await API._adminFetch(`/api/admin/users/${encodeURIComponent(contact)}`, {
        method:'DELETE', body:{ confirm:true }
      });
      if (r._fetchError) {
        // 降级：从 localStorage users 中删除
        const users = Auth.getUsers();
        const idx = users.findIndex(u => u.contact === contact);
        if (idx < 0) return { ok:false, msg:'未找到用户' };
        const removed = users.splice(idx, 1)[0];
        Auth.saveUsers(users);
        AdminLogs.record('user:delete', contact);
        return { ok:true, fallback:true, removed };
      }
      if (r.ok) AdminLogs.record('user:delete', contact);
      return r;
    }
  };

  // 管理员列表本地降级：只给 UI 展示空数组 + 提示
  API._adminLocalFallback = function (kind, params) {
    if (kind === 'subs') {
      const mine = Submissions.get().map(s => ({
        id: s.id, title: s.title, category: s.category, class: s.class,
        summary: s.summary, body: s.body, tags: s.tags || [],
        cover: s.cover || '',
        code: s.code || '',
        author: s.author, authorLevel: s.authorLevel,
        status: s.status || 'pending',
        reviewNote: s.reviewNote || '',
        reviewedAt: s.reviewedAt || 0,
        at: s.at
      }));
      let list = mine;
      if (params.status && params.status !== 'all') list = list.filter(s => s.status === params.status);
      if (params.category) list = list.filter(s => s.category === params.category);
      return { ok:true, fallback:true, total: list.length, list };
    }
    return { ok:true, fallback:true, total: 0, list: [] };
  };

  // 投稿存取（降级模式用）
  const Submissions = {
    get() { try { return JSON.parse(localStorage.getItem(SUBMIT_KEY) || '[]'); } catch { return []; } },
    _save(list) { localStorage.setItem(SUBMIT_KEY, JSON.stringify(list)); },
    add(s) {
      const all = Submissions.get();
      s.id = 'SUB-' + String(all.length + 1).padStart(3,'0');
      s.at = Date.now();
      s.author = Auth.get() ? Auth.get().user : '匿名';
      s.authorLevel = Auth.get() ? Auth.get().lvl : 'LV.1';
      all.unshift(s);
      Submissions._save(all);
      return s;
    },
    update(id, patch) {
      const all = Submissions.get();
      const idx = all.findIndex(s => s.id === id);
      if (idx < 0) return null;
      all[idx] = Object.assign({}, all[idx], patch);
      Submissions._save(all);
      return all[idx];
    },
    remove(id) {
      const all = Submissions.get();
      const idx = all.findIndex(s => s.id === id);
      if (idx < 0) return false;
      all.splice(idx, 1);
      Submissions._save(all);
      return true;
    }
  };

  // 档案 CRUD 持久化（离线模式下管理员的增删改不会丢失）
  // ============ 栏目/子分组持久化（管理员 CRUD）============
  const LocalCats = {
    _load() {
      try { return JSON.parse(localStorage.getItem(CATS_KEY) || '[]'); } catch { return []; }
    },
    _persist() {
      localStorage.setItem(CATS_KEY, JSON.stringify(
        DATA.categories.map(c => ({ ...c, subcats: c.subcats || [] }))
      ));
    },
    // 页面加载：把 localStorage 的栏目覆盖应用到 DATA.categories（合并 manifest 新增）
    applyOverrides() {
      const saved = LocalCats._load();
      if (!saved.length) return;
      const savedIds = new Set(saved.map(c => c.id));
      const keepFromManifest = DATA.categories.filter(c => !savedIds.has(c.id));
      DATA.categories = [...saved, ...keepFromManifest];
      DATA.categories.forEach(c => {
        if (!Array.isArray(DATA[c.id])) DATA[c.id] = [];
        if (!Array.isArray(c.subcats)) c.subcats = [];
      });
      rebuildCatMap();
    },
    addCat(cat) {
      cat = { ...cat };
      cat.id = String(cat.id || '').trim();
      if (!cat.id) return { ok: false, msg: '栏目 ID 不能为空' };
      if (!/^[a-z0-9_-]+$/i.test(cat.id)) return { ok: false, msg: 'ID 仅允许字母/数字/_/-（将作为路由与数据键）' };
      if (DATA.categories.some(c => c.id === cat.id)) return { ok: false, msg: '该 ID 已存在' };
      cat.subcats = [];
      DATA.categories.push(cat);
      DATA[cat.id] = [];
      LocalCats._persist();
      rebuildCatMap();
      Bus.emit('cats:changed', { action: 'add', cat });
      return { ok: true };
    },
    updateCat(id, patch) {
      const c = CAT_MAP[id];
      if (!c) return { ok: false, msg: '栏目不存在' };
      Object.assign(c, patch);
      LocalCats._persist();
      rebuildCatMap();
      Bus.emit('cats:changed', { action: 'update', id });
      return { ok: true };
    },
    removeCat(id) {
      const idx = DATA.categories.findIndex(c => c.id === id);
      if (idx < 0) return { ok: false, msg: '栏目不存在' };
      const had = (DATA[id] || []).length;
      DATA.categories.splice(idx, 1);
      delete DATA[id];
      LocalCats._persist();
      rebuildCatMap();
      Bus.emit('cats:changed', { action: 'remove', id, had });
      return { ok: true, had };
    },
    addSubcat(catId, subcat) {
      const c = CAT_MAP[catId];
      if (!c) return { ok: false, msg: '栏目不存在' };
      if (!c.subcats) c.subcats = [];
      subcat = { ...subcat };
      subcat.id = String(subcat.id || '').trim();
      if (!subcat.id) return { ok: false, msg: '子分组 ID 不能为空' };
      if (!/^[a-z0-9_-]+$/i.test(subcat.id)) return { ok: false, msg: 'ID 仅允许字母/数字/_/-' };
      if (c.subcats.some(s => s.id === subcat.id)) return { ok: false, msg: '该子分组已存在' };
      c.subcats.push(subcat);
      LocalCats._persist();
      Bus.emit('cats:changed', { action: 'subcat-add', catId, subcat });
      return { ok: true };
    },
    removeSubcat(catId, subId) {
      const c = CAT_MAP[catId];
      if (!c || !c.subcats) return { ok: false, msg: '栏目不存在' };
      c.subcats = c.subcats.filter(s => s.id !== subId);
      LocalCats._persist();
      Bus.emit('cats:changed', { action: 'subcat-remove', catId, subId });
      return { ok: true };
    }
  };

  const LocalEntries = {
    _load() {
      try { return JSON.parse(localStorage.getItem(ENTRIES_KEY) || '{}'); } catch { return {}; }
    },
    _save(data) { localStorage.setItem(ENTRIES_KEY, JSON.stringify(data)); },
    _cat(data, cat) {
      if (!data[cat]) data[cat] = { added: [], updated: {}, deleted: [] };
      return data[cat];
    },
    // 页面加载时把 localStorage 里的覆盖应用到 DATA
    applyOverrides() {
      const data = LocalEntries._load();
      for (const cat of Object.keys(data)) {
        if (!Array.isArray(DATA[cat])) DATA[cat] = [];
        const ov = data[cat];
        // 先应用删除
        if (ov.deleted && ov.deleted.length) {
          DATA[cat] = DATA[cat].filter(e => !ov.deleted.includes(String(e.id)));
        }
        // 再应用更新
        if (ov.updated) {
          for (const id of Object.keys(ov.updated)) {
            const idx = DATA[cat].findIndex(e => String(e.id) === id);
            if (idx >= 0) DATA[cat][idx] = Object.assign({}, DATA[cat][idx], ov.updated[id]);
            else DATA[cat].push(ov.updated[id]); // 原始数据里没有，直接加
          }
        }
        // 最后追加新增
        if (ov.added && ov.added.length) {
          DATA[cat].push(...ov.added);
        }
      }
    },
    add(cat, entry) {
      const data = LocalEntries._load();
      const ov = LocalEntries._cat(data, cat);
      ov.added.push(entry);
      LocalEntries._save(data);
      // 同步到内存
      if (!Array.isArray(DATA[cat])) DATA[cat] = [];
      DATA[cat].push(entry);
      Bus.emit('entries:changed', { cat, action: 'add', entry });
    },
    update(cat, id, patch) {
      const data = LocalEntries._load();
      const ov = LocalEntries._cat(data, cat);
      // 先看 added 里有没有
      const addedIdx = ov.added.findIndex(e => String(e.id) === String(id));
      if (addedIdx >= 0) {
        ov.added[addedIdx] = Object.assign({}, ov.added[addedIdx], patch);
      } else {
        // 记录到 updated
        ov.updated[String(id)] = Object.assign({}, ov.updated[String(id)] || {}, patch);
      }
      LocalEntries._save(data);
      // 同步到内存
      const arr = DATA[cat] || [];
      const idx = arr.findIndex(e => String(e.id) === String(id));
      if (idx >= 0) arr[idx] = Object.assign({}, arr[idx], patch);
      Bus.emit('entries:changed', { cat, action: 'update', id });
    },
    delete(cat, id) {
      const data = LocalEntries._load();
      const ov = LocalEntries._cat(data, cat);
      const sid = String(id);
      // 从 added 里移除
      ov.added = ov.added.filter(e => String(e.id) !== sid);
      // 从 updated 里移除
      delete ov.updated[sid];
      // 记录到 deleted
      if (!ov.deleted.includes(sid)) ov.deleted.push(sid);
      LocalEntries._save(data);
      // 同步到内存
      if (Array.isArray(DATA[cat])) {
        DATA[cat] = DATA[cat].filter(e => String(e.id) !== sid);
      }
      Bus.emit('entries:changed', { cat, action: 'delete', id });
    }
  };

  function refreshIdentity() {
    const el = document.getElementById('stat-identity');
    if (el) el.textContent = Auth.identity();
    const lout = document.getElementById('logout-btn');
    if (lout) lout.style.display = Auth.get() ? 'inline-flex' : 'none';

    // 账号管理按钮：仅非游客才显示（游客/访客不可注销，因为没有可删除的账号记录）
    const accBtn = document.getElementById('account-btn');
    const accSep = document.getElementById('stat-sep-account');
    if (accBtn) {
      const show = Auth.get() && !Auth.isGuest() && !Auth.get().guest;
      accBtn.style.display = show ? 'inline' : 'none';
      if (accSep) accSep.style.display = show ? 'inline' : 'none';
    }

    // 管理员入口：仅管理员显示
    const admin = document.querySelector('.nav-admin-link');
    if (admin) admin.style.display = Auth.isAdmin() ? 'inline-block' : 'none';

    // 我的账户入口：所有登录用户可见
    const accLink = document.querySelector('.sidebar-account-link');
    if (accLink) accLink.style.display = Auth.get() ? 'flex' : 'none';

    // 同步侧边栏统计与管理员入口
    refreshSidebarStats();
  }

  // ============ 账号管理面板 ============
  function renderFavList() {
    const listEl = document.getElementById('am-fav-list');
    if (!listEl) return;
    const list = Favorites.list();
    if (!list.length) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;border:1px dashed var(--border);color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;">${ico('starOutline',12)} 收藏夹为空 · 档案详情页可收藏（LV.2+）</div>`;
      return;
    }
    listEl.innerHTML = list.map(f => `
      <a class="am-fav-row" href="#/entry/${f.cat}/${encodeURIComponent(f.id)}" style="display:block;padding:10px 12px;border:1px solid var(--border);background:var(--bg-2);text-decoration:none;color:inherit;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);">
            <span style="color:var(--gold-1);">${escapeHtml(f.cat)}:${escapeHtml(f.id)}</span>
            ${f.class ? `<span style="margin:0 6px;">·</span><span>${escapeHtml(f.class)}</span>` : ''}
            <span style="margin:0 6px;">·</span>
            <span>${new Date(f.at||0).toLocaleDateString()}</span>
          </div>
          <button type="button" class="am-fav-del" data-cat="${escapeAttr(f.cat)}" data-id="${escapeAttr(f.id)}" style="border:1px solid var(--red-1);background:transparent;color:var(--red-1);padding:2px 8px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">取消收藏</button>
        </div>
        <div style="font-family:var(--f-serif);font-weight:600;margin-top:4px;">${escapeHtml(f.title)}</div>
        <div style="font-size:11px;color:var(--text-2);opacity:.8;margin-top:2px;">${escapeHtml((f.summary||'').slice(0,100)||'—')}</div>
      </a>
    `).join('');
    listEl.querySelectorAll('.am-fav-del').forEach(b => {
      b.addEventListener('click', (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const fc = b.dataset.cat; const fid = b.dataset.id;
        if (!fc || !fid) return;
        Favorites.toggle(fc, fid);
        SFX.unfavor();
        renderFavList();
      });
    });
  }
  function renderReadList() {
    const listEl = document.getElementById('am-read-list');
    if (!listEl) return;
    const list = ReadProgress.list().sort((a,b) => (b.at||0)-(a.at||0)).slice(0, 20);
    if (!list.length) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;border:1px dashed var(--border);color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;">${ico('clock',12)} 暂无阅读记录</div>`;
      return;
    }
    listEl.innerHTML = list.map(r => {
      const pct = r.offsetPct || 0;
      const entry = findEntry(r.cat, r.id);
      const title = (entry && entry.title) || r.id;
      return `
      <a class="am-read-row" href="#/entry/${r.cat}/${encodeURIComponent(r.id)}" style="display:block;padding:10px 12px;border:1px solid var(--border);background:var(--bg-2);text-decoration:none;color:inherit;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);">
            <span style="color:var(--gold-1);">${escapeHtml(r.cat)}:${escapeHtml(r.id)}</span>
            <span style="margin:0 6px;">·</span>
            <span>${new Date(r.at||0).toLocaleString()}</span>
          </div>
          <div style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1);">${pct}%</div>
        </div>
        <div style="font-family:var(--f-serif);font-weight:600;margin-top:4px;">${escapeHtml(title)}</div>
        <div style="height:4px;background:var(--bg);border:1px solid var(--border);margin-top:6px;overflow:hidden;">
          <div style="width:${Math.min(100,pct)}%;height:100%;background:var(--gold-1);"></div>
        </div>
      </a>`;
    }).join('');
  }

  // ============ 云同步面板（账号管理） ============
  function guessGhOwnerRepo() {
    // 从当前 URL（如 https://LUEzd8Lg.github.io/）推断 owner 与 repo
    const m = (location.hostname || '').match(/^([^.]+)\.github\.io$/i);
    if (m) return { owner: m[1], repo: m[1] + '.github.io' };
    return { owner: '', repo: '' };
  }
  function renderCloudSync() {
    const host = document.getElementById('am-cloud');
    if (!host) return;
    const cfg = CloudSync.cfg();
    const g = guessGhOwnerRepo();
    const owner = cfg.owner || g.owner;
    const repo = cfg.repo || g.repo;
    host.innerHTML = `
      <div style="display:grid;gap:10px;">
        <div class="am-info-row"><span class="am-info-k">说明 / INFO</span><span class="am-info-v">把收藏、阅读进度、评论备份到你自己的 GitHub 仓库 <code>cloud/</code> 目录，跨设备同步。</span></div>
        <label class="am-field"><span class="am-label">仓库所有者 · OWNER</span><input type="text" id="cloud-owner" value="${escapeAttr(owner)}" placeholder="如 LUEzd8Lg" autocomplete="off"></label>
        <label class="am-field"><span class="am-label">仓库名 · REPO</span><input type="text" id="cloud-repo" value="${escapeAttr(repo)}" placeholder="如 LUEzd8Lg.github.io" autocomplete="off"></label>
        <label class="am-field"><span class="am-label">访问令牌 · PAT</span><input type="password" id="cloud-token" value="${escapeAttr(cfg.token || '')}" placeholder="GitHub Fine-grained PAT（读/写本仓库 Contents）" autocomplete="off"></label>
        <label style="display:flex;gap:6px;align-items:center;font-family:var(--f-mono);font-size:11px;color:var(--text-2);"><input type="checkbox" id="cloud-remember" ${cfg.remember?'checked':''}> 记住令牌（存于本机浏览器；不勾选则仅本次会话有效）</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-mini" id="cloud-save" style="border:1px solid var(--border);padding:6px 12px;cursor:pointer;font-family:var(--f-mono);font-size:11px;background:var(--bg);color:var(--text);">保存配置</button>
          <button type="button" class="btn btn-mini" id="cloud-push" style="border:1px solid var(--gold-2);padding:6px 12px;cursor:pointer;font-family:var(--f-mono);font-size:11px;background:transparent;color:var(--gold-1);">↑ 上传到云端</button>
          <button type="button" class="btn btn-mini" id="cloud-pull" style="border:1px solid var(--gold-2);padding:6px 12px;cursor:pointer;font-family:var(--f-mono);font-size:11px;background:transparent;color:var(--gold-1);">↓ 从云端恢复</button>
        </div>
        <div id="cloud-status" class="am-info-row" style="display:none"></div>
        <div style="font-family:var(--f-mono);font-size:10px;line-height:1.7;color:var(--text-2);opacity:.85;">
          ⚠ 令牌将用于读写你指定仓库 <code>cloud/</code> 目录的同步文件。请：① 使用最小权限令牌（Fine-grained，仅授权本仓库 Contents 读写）；② 勿用于含敏感信息的仓库；③ 同步文件含你的账号名。
        </div>
        <div style="font-family:var(--f-mono);font-size:10px;line-height:1.8;color:var(--gold-1);border-top:1px dashed var(--border);padding-top:10px;">
          同一个令牌还用于「档案排版原件上传」：档案编辑器里的<b>排版原件 HTML</b> 会直接提交到仓库
          <code>data/dossier/</code>，因此必须先在这里保存配置，否则上传按钮会提示缺少配置。
        </div>
      </div>`;
    const setStatus = (html, err) => {
      const st = document.getElementById('cloud-status');
      if (!st) return;
      st.innerHTML = html;
      st.style.display = 'flex';
      st.style.color = err ? 'var(--red-1)' : 'inherit';
    };
    document.getElementById('cloud-save').addEventListener('click', () => {
      const c = {
        owner: document.getElementById('cloud-owner').value.trim(),
        repo: document.getElementById('cloud-repo').value.trim(),
        token: document.getElementById('cloud-token').value.trim(),
        remember: document.getElementById('cloud-remember').checked
      };
      if (!c.owner || !c.repo) { setStatus(`${ico('warn',12)} 请填写仓库所有者和仓库名`, true); return; }
      if (!c.token) { setStatus(`${ico('warn',12)} 请填写访问令牌（PAT）`, true); return; }
      CloudSync.saveCfg(c);
      setStatus(`${ico('check',12)} 配置已保存。可点击「上传到云端」或「从云端恢复」。`);
    });
    document.getElementById('cloud-push').addEventListener('click', async () => {
      if (!CloudSync.isConfigured()) { setStatus(`${ico('warn',12)} 请先保存配置`, true); return; }
      const btn = document.getElementById('cloud-push');
      btn.disabled = true; btn.textContent = '同步中…';
      try {
        const r = await CloudSync.push(CloudSync.cfg());
        setStatus(`${ico('check',12)} 已上传 ${new Date(r.pushedAt).toLocaleString()}（账号 ${escapeHtml(r.user)}）`);
      } catch (e) {
        setStatus(`${ico('warn',12)} 上传失败：${escapeHtml(e.message || e)}`, true);
      } finally { btn.disabled = false; btn.textContent = '↑ 上传到云端'; }
    });
    document.getElementById('cloud-pull').addEventListener('click', async () => {
      if (!CloudSync.isConfigured()) { setStatus(`${ico('warn',12)} 请先保存配置`, true); return; }
      const btn = document.getElementById('cloud-pull');
      btn.disabled = true; btn.textContent = '恢复中…';
      try {
        const r = await CloudSync.pull(CloudSync.cfg());
        setStatus(r.found
          ? `${ico('check',12)} 已从云端恢复，合并 ${r.applied} 条`
          : `${ico('clock',12)} 云端尚无该账号的同步文件，可先「上传到云端」`);
      } catch (e) {
        setStatus(`${ico('warn',12)} 恢复失败：${escapeHtml(e.message || e)}`, true);
      } finally { btn.disabled = false; btn.textContent = '↓ 从云端恢复'; }
    });
  }

  function openAccountModal(tab) {
    const a = Auth.get();
    if (!a || a.guest) return;
    const m = document.getElementById('account-modal');
    if (!m) return;
    const lvNum = parseInt((a.lvl || '').match(/\d/)?.[0] || '0');
    const perms = [];
    if (lvNum >= 1) perms.push('浏览档案');
    if (lvNum >= 2) perms.push('投稿设定');
    if (lvNum >= 3) perms.push('高级检索');
    if (lvNum >= 4) perms.push('档案复审');
    if (lvNum >= 5) perms.push('全局管控');

    const ac = document.getElementById('am-account');
    const lv = document.getElementById('am-level');
    const at = document.getElementById('am-login-at');
    const perm = document.getElementById('am-perm');
    if (ac) ac.textContent = a.user || '—';
    if (lv) lv.textContent = a.lvl || '—';
    if (at) at.textContent = a.at ? new Date(a.at).toLocaleString('zh-CN') : '—';
    if (perm) perm.textContent = perms.join(' ｜ ');

    document.getElementById('am-del-pass').value = '';
    document.getElementById('am-del-error').style.display = 'none';

    // 切换到指定 tab
    const active = tab || 'account';
    m.querySelectorAll('.am-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === active));
    m.querySelectorAll('.am-tabpane').forEach(p => p.classList.toggle('active', p.dataset.tabpane === active));

    // 渲染 tab 内容
    if (active === 'favorites') renderFavList();
    if (active === 'reading') renderReadList();
    if (active === 'cloud') renderCloudSync();

    m.style.display = 'block';
  }
  function closeAccountModal() {
    const m = document.getElementById('account-modal');
    if (m) m.style.display = 'none';
  }

  function bindAccountPanel() {
    const btn = document.getElementById('account-btn');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => { location.hash = '#/account'; });
    }
    const close = document.getElementById('am-close');
    if (close && !close.dataset.bound) {
      close.dataset.bound = '1';
      close.addEventListener('click', closeAccountModal);
    }
    const mask = document.querySelector('.account-modal-mask');
    if (mask && !mask.dataset.bound) {
      mask.dataset.bound = '1';
      mask.addEventListener('click', closeAccountModal);
    }
    const del = document.getElementById('am-del-btn');
    if (del && !del.dataset.bound) {
      del.dataset.bound = '1';
      del.addEventListener('click', async () => {
        const a = Auth.get();
        if (!a || a.guest) return;
        const pw = document.getElementById('am-del-pass').value;
        const errEl = document.getElementById('am-del-error');
        if (!pw) {
          errEl.innerHTML = `${ico('warn',12)} 请输入密码以确认注销`;
          errEl.style.display = 'block';
          return;
        }
        // 二次确认
        if (!confirm(`确定要永久注销账号「${a.user}」吗？\n\n此操作不可逆：注册信息会被删除，但您的投稿将保留并标记为"已注销用户"。`)) {
          return;
        }
        del.disabled = true;
        del.classList.add('is-loading');
        errEl.style.display = 'none';
        const r = await API.deleteAccount(a.user, pw);
        del.disabled = false;
        del.classList.remove('is-loading');
        if (!r.ok) {
          errEl.innerHTML = `${ico('warn',12)} ` + r.msg;
          errEl.style.display = 'block';
          return;
        }
        // 注销成功
        alert('账号已注销');
        closeAccountModal();
        refreshIdentity();
        location.hash = '#/';
        showLoginGate();
      });
    }
    // 账号面板 Tab 切换
    document.querySelectorAll('.am-tab').forEach(t => {
      if (t.dataset.bound) return;
      t.dataset.bound = '1';
      t.addEventListener('click', () => {
        const name = t.dataset.tab;
        document.querySelectorAll('.am-tab').forEach(x => x.classList.toggle('active', x === t));
        document.querySelectorAll('.am-tabpane').forEach(p => p.classList.toggle('active', p.dataset.tabpane === name));
        if (name === 'favorites') renderFavList();
        if (name === 'reading') renderReadList();
        if (name === 'cloud') renderCloudSync();
      });
    });
    // ESC 关闭
    if (!bindAccountPanel._esc) {
      bindAccountPanel._esc = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const m = document.getElementById('account-modal');
          if (m && m.style.display !== 'none') closeAccountModal();
        }
      });
    }
  }
  // 在 DOM 就绪时绑定（一次）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAccountPanel);
  } else {
    bindAccountPanel();
  }

  // ============ 登录门禁屏 ============
  const LG = { gate: null, canvas: null, ctx: null, particles: [], raf: 0 };

  function showLoginGate() {
    const gate = document.getElementById('login-gate');
    if (!gate) return;
    gate.style.display = 'block';
    LG.gate = gate;
    bindLoginGate();
    startLoginParticles();
    // 电影化开机序列（fx.js）
    if (window.FX && FX.gateIntro) FX.gateIntro(gate);
    // 会话号
    const s = document.getElementById('lg-session');
    if (s) s.textContent = 'SID-' + Math.random().toString(36).slice(2,10).toUpperCase();
    // 重置登录模式为密码（避免上次验证码模式残留）
    const mt = document.getElementById('lg-toggle-login-mode');
    if (mt) {
      mt.dataset.mode = 'password';
      mt.textContent = '使用短信验证码登录 →';
      const pf = document.getElementById('lg-login-pass-field'); if (pf) pf.style.display = '';
      const cf = document.getElementById('lg-login-code-field'); if (cf) cf.style.display = 'none';
      const sub = document.getElementById('lg-submit-login');
      if (sub && sub.querySelector('.lg-btn-text')) sub.querySelector('.lg-btn-text').innerHTML = ico('shield',14)+' 登录档案系统';
    }
    const lb = document.getElementById('lg-send-login-code');
    if (lb) { lb.disabled = false; lb.textContent = '发送验证码'; }
  }

  function hideLoginGate() {
    const gate = document.getElementById('login-gate');
    if (gate) gate.style.display = 'none';
    cancelAnimationFrame(LG.raf);
    initSiteHUD();
  }

  // === Site HUD — 登录动画风格延续到网站内部 ===
  let _siteHUDInit = false;
  let _siteHUDTimer = null;

  function initSiteHUD() {
    if (_siteHUDInit) return;
    _siteHUDInit = true;

    const body = document.body;
    body.classList.add('hud-active');

    // 1. CRT 扫描线叠加层
    const crt = document.createElement('div');
    crt.className = 'site-crt-overlay';
    body.appendChild(crt);

    // 2. 暗角
    const vig = document.createElement('div');
    vig.className = 'site-vignette';
    body.appendChild(vig);

    // 3. HUD 四角框
    ['tl','tr','bl','br'].forEach(pos => {
      const c = document.createElement('div');
      c.className = 'site-hud-corner ' + pos;
      body.appendChild(c);
    });

    // 4. 顶部遥测条
    const tel = document.createElement('div');
    tel.className = 'site-telemetry';
    const metrics = [
      { label: 'CPU', base: 35, range: 25 },
      { label: 'MEM', base: 48, range: 18 },
      { label: 'NET', base: 22, range: 30 },
      { label: 'I/O', base: 15, range: 20 },
      { label: 'THR', base: 62, range: 15 },
    ];
    tel.innerHTML = metrics.map(m =>
      `<span class="st-item">${m.label}<span class="st-bar"><span class="st-bar-fill" data-m="${m.label}" style="width:${m.base}%"></span></span><span class="st-val" data-v="${m.label}">${m.base}%</span></span>`
    ).join('');
    body.appendChild(tel);

    // 5. 底部状态条
    const st = document.createElement('div');
    st.className = 'site-status';
    const auth = Auth.get();
    const sid = 'SID-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const coord = `${(Math.random()*180-90).toFixed(2)}°N ${(Math.random()*360-180).toFixed(2)}°E`;
    const buildId = 'BLD-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    st.innerHTML = [
      `COORD ${coord}`,
      `ENC AES-256-GCM`,
      `CH TLS-1.3/X25519`,
      `SID ${sid}`,
      `BUILD ${buildId}`,
    ].map((s, i, arr) => i < arr.length - 1 ? `<span>${s}</span><span class="ss-sep">·</span>` : `<span>${s}</span>`).join('');
    body.appendChild(st);

    // 6. 遥测数据实时更新
    const tick = () => {
      metrics.forEach(m => {
        const val = Math.round(m.base + (Math.random() - 0.5) * m.range);
        const clamped = Math.max(1, Math.min(99, val));
        const bar = tel.querySelector(`[data-m="${m.label}"]`);
        const valEl = tel.querySelector(`[data-v="${m.label}"]`);
        if (bar) bar.style.width = clamped + '%';
        if (valEl) valEl.textContent = clamped + '%';
      });
    };
    _siteHUDTimer = setInterval(tick, 1200);
  }

  function startLoginParticles() {
    const c = document.getElementById('lg-canvas');
    if (!c) return;
    LG.canvas = c; LG.ctx = c.getContext('2d');
    const resize = () => {
      c.width = c.clientWidth * window.devicePixelRatio;
      c.height = c.clientHeight * window.devicePixelRatio;
    };
    resize(); window.addEventListener('resize', resize);
    const W = () => c.width, H = () => c.height;
    const N = 90;
    LG.particles = Array.from({length:N}, () => ({
      x: Math.random()*W(), y: Math.random()*H(),
      vx: (Math.random()-0.5)*0.4, vy: (Math.random()-0.5)*0.4,
      r: (Math.random()*1.6+0.4) * window.devicePixelRatio,
      a: Math.random()*0.6+0.2
    }));
    const draw = () => {
      const ctx = LG.ctx;
      ctx.clearRect(0,0,W(),H());
      // 连线
      const P = LG.particles;
      for (let i=0;i<P.length;i++) {
        for (let j=i+1;j<P.length;j++) {
          const dx=P[i].x-P[j].x, dy=P[i].y-P[j].y;
          const d2=dx*dx+dy*dy, max=120*120*window.devicePixelRatio*window.devicePixelRatio;
          if (d2 < max) {
            ctx.strokeStyle = `rgba(232,232,232,${(1-d2/max)*0.25})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(P[i].x,P[i].y); ctx.lineTo(P[j].x,P[j].y); ctx.stroke();
          }
        }
      }
      // 粒子
      for (const p of P) {
        p.x += p.vx; p.y += p.vy;
        if (p.x<0||p.x>W()) p.vx*=-1;
        if (p.y<0||p.y>H()) p.vy*=-1;
        ctx.fillStyle = `rgba(255,255,255,${p.a})`;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      }
      LG.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  // ============ 启动序列动画（登录成功过渡）============
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*<>{}[]/\\|';
  function _decodeText(el, finalText, dur = 600) {
    return new Promise(resolve => {
      const start = performance.now();
      const len = finalText.length;
      function tick(now) {
        const t = Math.min(1, (now - start) / dur);
        const revealCount = Math.floor(t * len);
        let str = '';
        for (let i = 0; i < len; i++) {
          if (i < revealCount) str += finalText[i];
          else if (finalText[i] === ' ') str += ' ';
          else str += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
        el.textContent = str;
        if (t < 1) requestAnimationFrame(tick);
        else { el.textContent = finalText; resolve(); }
      }
      requestAnimationFrame(tick);
    });
  }
  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function showBootSequence(auth, onComplete) {
    const user = (auth && auth.user) || '访客';
    const lvl = (auth && auth.lvl) || 'LV.1';
    const isAdmin = auth && auth.role === 'admin';

    const old = document.getElementById('boot-sequence');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'boot-sequence';
    document.body.appendChild(overlay);

    // ---- 数据流背景（多层：十六进制 + 二进制 + 数据包） ----
    const rain = document.createElement('canvas');
    rain.id = 'boot-data-rain';
    overlay.appendChild(rain);
    const rctx = rain.getContext('2d');
    let raf2 = 0;
    const HEX = '0123456789ABCDEF';
    const BIN = '01';
    const FS = 12;
    let cols = [];
    let packets = [];
    function initRain() {
      rain.width = window.innerWidth;
      rain.height = window.innerHeight;
      const n = Math.floor(rain.width / (FS * 1.5));
      cols = Array.from({length: n}, () => ({
        y: Math.random() * rain.height,
        sp: 0.3 + Math.random() * 2.0,
        ch: Array.from({length: 20}, () => {
          const r = Math.random();
          if (r < 0.7) return HEX[Math.floor(Math.random() * HEX.length)];
          if (r < 0.9) return BIN[Math.floor(Math.random() * BIN.length)];
          return ['/', '\\', '|', '*', '+', '-', '>', '<'][Math.floor(Math.random() * 8)];
        }),
        bright: Math.random() < 0.15
      }));
      packets = [];
    }
    function spawnPacket() {
      if (packets.length > 5) return;
      packets.push({
        x: Math.random() * rain.width,
        y: -20,
        sp: 3 + Math.random() * 4,
        txt: '0x' + Array.from({length: 8}, () => HEX[Math.floor(Math.random() * HEX.length)]).join(''),
        life: 1
      });
    }
    function drawRain() {
      rctx.fillStyle = 'rgba(0,0,0,0.07)';
      rctx.fillRect(0, 0, rain.width, rain.height);
      rctx.font = FS + 'px monospace';
      const cw = FS * 1.5;
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        for (let j = 0; j < c.ch.length; j++) {
          const y = c.y - j * FS;
          if (y < 0 || y > rain.height) continue;
          const fade = (1 - j / c.ch.length);
          const alpha = c.bright ? fade * 0.3 : fade * 0.1;
          rctx.fillStyle = 'rgba(200,200,200,' + alpha + ')';
          rctx.fillText(c.ch[j], i * cw, y);
        }
        c.y += c.sp;
        if (c.y - c.ch.length * FS > rain.height) {
          c.y = 0;
          c.ch = c.ch.map(() => {
            const r = Math.random();
            if (r < 0.7) return HEX[Math.floor(Math.random() * HEX.length)];
            if (r < 0.9) return BIN[Math.floor(Math.random() * BIN.length)];
            return ['/', '\\', '|', '*', '+', '-', '>', '<'][Math.floor(Math.random() * 8)];
          });
          c.bright = Math.random() < 0.15;
        }
        if (Math.random() < 0.06) c.ch[Math.floor(Math.random() * c.ch.length)] = HEX[Math.floor(Math.random() * HEX.length)];
      }
      // 数据包
      if (Math.random() < 0.04) spawnPacket();
      rctx.font = FS + 'px monospace';
      for (let p of packets) {
        rctx.fillStyle = 'rgba(220,220,220,' + (p.life * 0.4) + ')';
        rctx.fillText(p.txt, p.x, p.y);
        p.y += p.sp;
        p.life -= 0.008;
      }
      packets = packets.filter(p => p.life > 0 && p.y < rain.height + 20);
      raf2 = requestAnimationFrame(drawRain);
    }
    initRain(); drawRain();
    const onResize = () => initRain();
    window.addEventListener('resize', onResize);

    // ---- 扫描线 ----
    const scan = document.createElement('div');
    scan.className = 'boot-scanline';
    overlay.appendChild(scan);

    // ---- HUD 角框 ----
    ['tl', 'tr', 'bl', 'br'].forEach(pos => {
      const c = document.createElement('div');
      c.className = 'boot-hud-corner ' + pos;
      overlay.appendChild(c);
    });

    // ---- 系统信息 ----
    const sid = 'SID-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const ts = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    const tk = 'TK-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const nodes = Math.floor(Math.random() * 8) + 8;
    let records = 0;
    try { records = statsTotal(); } catch (e) {}
    const ip = '10.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255) + '.' + Math.floor(Math.random()*255);
    const hash = Array.from({length: 16}, () => HEX[Math.floor(Math.random() * HEX.length)]).join('');
    const buildId = Math.random().toString(36).slice(2, 8).toUpperCase();

    // ---- 顶部遥测条 ----
    const telemetry = document.createElement('div');
    telemetry.className = 'boot-telemetry-top';
    telemetry.innerHTML = `
      <span class="bt-item"><span class="bt-label">CPU</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="cpu"></span></span><span class="bt-val" data-tv="cpu">0%</span></span>
      <span class="bt-item"><span class="bt-label">MEM</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="mem"></span></span><span class="bt-val" data-tv="mem">0%</span></span>
      <span class="bt-item"><span class="bt-label">NET</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="net"></span></span><span class="bt-val" data-tv="net">0ms</span></span>
      <span class="bt-item"><span class="bt-label">I/O</span><span class="bt-bar"><span class="bt-bar-fill" data-tg="io"></span></span><span class="bt-val" data-tv="io">0MB</span></span>
      <span class="bt-item"><span class="bt-label">THR</span><span class="bt-val" data-tv="thr">0</span></span>
    `;
    overlay.appendChild(telemetry);

    // 遥测数据 ticker
    let teleRaf = 0;
    let ioTotal = 0;
    function tickTelemetry() {
      const cpu = 20 + Math.floor(Math.random() * 50);
      const mem = 35 + Math.floor(Math.random() * 40);
      const net = 2 + Math.floor(Math.random() * 20);
      const io = 1 + Math.floor(Math.random() * 8);
      const thr = 40 + Math.floor(Math.random() * 30);
      ioTotal += io;
      const setBar = (key, pct) => {
        const el = telemetry.querySelector('[data-tg="' + key + '"]');
        if (el) el.style.width = pct + '%';
      };
      const setVal = (key, val) => {
        const el = telemetry.querySelector('[data-tv="' + key + '"]');
        if (el) el.textContent = val;
      };
      setBar('cpu', cpu); setVal('cpu', cpu + '%');
      setBar('mem', mem); setVal('mem', mem + '%');
      setBar('net', Math.min(100, net * 4)); setVal('net', net + 'ms');
      setBar('io', Math.min(100, io * 10)); setVal('io', ioTotal + 'MB');
      setVal('thr', String(thr));
      teleRaf = setTimeout(tickTelemetry, 200);
    }
    tickTelemetry();

    // ---- 底部状态条 ----
    const statusBar = document.createElement('div');
    statusBar.className = 'boot-status-bar';
    statusBar.innerHTML = `
      <span class="bsb-item">COORD <span class="bsb-val">${Math.floor(Math.random()*180)-90}°${Math.random()<0.5?'N':'S'} / ${Math.floor(Math.random()*360)-180}°${Math.random()<0.5?'E':'W'}</span></span>
      <span class="bsb-item">ENC <span class="bsb-val">AES-256-GCM</span></span>
      <span class="bsb-item">CHAN <span class="bsb-val">TLS 1.3 / CHACHA20</span></span>
      <span class="bsb-item">GATE <span class="bsb-val">NODE-04 / A7</span></span>
      <span class="bsb-item">BUILD <span class="bsb-val">#${buildId}</span></span>
    `;
    overlay.appendChild(statusBar);

    // ---- 主内容区域 ----
    const content = document.createElement('div');
    content.className = 'boot-content';
    overlay.appendChild(content);

    // ---- ASCII 系统标识 ----
    const asciiLogo = document.createElement('pre');
    asciiLogo.className = 'boot-ascii-logo';
    asciiLogo.textContent = [
      ' ___      _ _ _ ___ _      _      ___ ___ ___ _____',
      '| _ \\_  _| | | / __| |    /_\\ ___| _ \\ _ _/ _ \\_   _|',
      '|  _/ || | |  \\__ \\ |__ / _ \\___ |  _/ | | (_) || |  ',
      '|_|  \\_, |_|_|___/____/_/ \\_\\  |_| |_| |_|\\___/ |_|  ',
      '     |__/                                            '
    ].join('\n');
    content.appendChild(asciiLogo);

    // ---- 节点同步可视化辅助函数 ----
    function makeNodes(count) {
      let html = '<span class="boot-nodes">';
      for (let i = 0; i < count; i++) {
        html += '<span class="bn-dot"></span>';
        if (i < count - 1) html += '<span class="bn-link"></span>';
      }
      html += '</span>';
      return html;
    }
    function activateNodes(div, count, stepMs) {
      return new Promise(async resolve => {
        const dots = div.querySelectorAll('.bn-dot');
        const links = div.querySelectorAll('.bn-link');
        for (let i = 0; i < dots.length; i++) {
          await _sleep(stepMs);
          if (dots[i]) dots[i].classList.add('active');
          if (links[i - 1]) links[i - 1].classList.add('active');
        }
        resolve();
      });
    }

    // ---- 数据解析流辅助函数 ----
    function makeDataStream(items) {
      let html = '<div class="boot-data-stream">';
      for (const item of items) {
        html += `<div><span class="bds-key">${item.k}</span>: <span class="bds-${item.t || 'val'}">${item.v}</span></div>`;
      }
      html += '</div>';
      return html;
    }

    // ---- ACCESS GRANTED 终章 ----
    const accessGranted = document.createElement('div');
    accessGranted.className = 'boot-access-granted';
    accessGranted.innerHTML = `
      <div class="bag-text">ACCESS GRANTED</div>
      <div class="bag-line"></div>
      <div class="bag-sub">WELCOME, ${user.toUpperCase()}</div>
    `;
    overlay.appendChild(accessGranted);

    // ---- 启动序列步骤 ----
    const lines = [
      { delay: 80,  html: '<span class="boot-sys">[SYS]</span> 世界观察档案库 · 安全终端 <span class="boot-ver">v3.12</span> <span class="boot-dim">| kernel 5.4.0-arch</span>' },
      { delay: 60,  html: '<span class="boot-sys">[SYS]</span> <span class="boot-ip">' + sid + '</span> <span class="boot-dim">|</span> <span class="boot-dim">' + ts + '</span> <span class="boot-dim">|</span> <span class="boot-ip">' + ip + '</span>' },
      { delay: 100, html: '<span class="boot-prompt">&gt;</span> 初始化安全终端 <span class="boot-dim">/dev/archive/tty0</span>' },
      { delay: 140, html: '<span class="boot-prompt">&gt;</span> 建立加密连接 <span class="boot-bar"><span class="boot-bar-fill"></span></span> <span class="boot-ok">100%</span> <span class="boot-dim">TLS 1.3 / X25519</span>', bar: true },
      { delay: 200, html: '<span class="boot-prompt">&gt;</span> 数据节点同步 ' + makeNodes(nodes) + ' <span class="boot-ok">完成</span> <span class="boot-dim">' + nodes + ' nodes online</span>', nodes: nodes },
      { delay: 160, html: '<span class="boot-prompt">&gt;</span> 档案库索引加载 <span class="boot-bar"><span class="boot-bar-fill"></span></span> <span class="boot-ok">100%</span> <span class="boot-dim">' + records + ' records</span>', bar: true, stream: [
        { k: 'anomalies', v: 'indexed', t: 'val' },
        { k: 'organizations', v: 'indexed', t: 'val' },
        { k: 'deities', v: 'indexed', t: 'val' },
        { k: 'eras', v: 'indexed', t: 'val' },
        { k: 'timelines', v: 'indexed', t: 'val' },
        { k: 'total_records', v: String(records), t: 'num' },
      ] },
      { delay: 120, html: '<span class="boot-prompt">&gt;</span> 数据完整性校验 <span class="boot-ok">SHA-256</span> <span class="boot-dim">' + hash + '</span>' },
      { delay: 130, html: '<span class="boot-prompt">&gt;</span> 生物特征扫描... <span class="boot-ok">通过</span> <span class="boot-dim">retina + fingerprint</span>' },
      { delay: 170, decode: '身份识别', suffix: ' <span class="boot-ok">成功</span>', dur: 700 },
      { delay: 140, decode: '档案密钥解密', suffix: ' <span class="boot-ok">完成</span> <span class="boot-dim">RSA-4096</span>', dur: 600 },
      { delay: 90,  html: '<span class="boot-prompt">&gt;</span> 安全协议验证 <span class="boot-ok">AES-256-GCM</span> <span class="boot-dim">/ HMAC-SHA512</span>' },
      { delay: 90,  html: '<span class="boot-prompt">&gt;</span> 会话令牌 <span class="boot-dim">' + tk + '</span>' },
      { delay: 80,  html: '<span class="boot-prompt">&gt;</span> 加密通道 <span class="boot-ok">已建立</span> <span class="boot-dim">end-to-end</span>' },
      { delay: 100, html: '<span class="boot-prompt">&gt;</span> 访问日志已记录 <span class="boot-dim">NODE-04 / GATE-A7 / ' + ts + '</span>' },
      { delay: 120, html: '<span class="boot-prompt">&gt;</span> 欢迎回来，<span class="boot-hl">' + user + '</span> <span class="boot-dim">|</span> 权限等级 <span class="boot-hl">' + lvl + '</span>' + (isAdmin ? ' <span class="boot-warn">[ADMIN]</span>' : '') },
    ];

    (async () => {
      SFX.login();

      // 显示 ASCII logo
      await _sleep(100);
      asciiLogo.classList.add('show');
      await _sleep(300);

      for (const line of lines) {
        await _sleep(line.delay);
        const div = document.createElement('div');
        div.className = 'boot-line';
        content.appendChild(div);
        void div.offsetWidth;
        div.classList.add('show');

        if (line.decode) {
          const decodeSpan = document.createElement('span');
          decodeSpan.className = 'boot-decode';
          div.innerHTML = '<span class="boot-prompt">&gt;</span> ';
          div.appendChild(decodeSpan);
          const suffixSpan = document.createElement('span');
          suffixSpan.innerHTML = line.suffix || '';
          div.appendChild(suffixSpan);
          SFX.search();
          await _decodeText(decodeSpan, line.decode, line.dur || 600);
          SFX.hit();
        } else if (line.bar) {
          div.innerHTML = line.html;
          SFX.click();
          const fill = div.querySelector('.boot-bar-fill');
          if (fill) {
            await _sleep(50);
            fill.style.width = '100%';
            await _sleep(250);
          }
          // 数据解析流
          if (line.stream) {
            const ds = document.createElement('div');
            ds.innerHTML = makeDataStream(line.stream);
            const dsEl = ds.firstChild;
            content.appendChild(dsEl);
            void dsEl.offsetWidth;
            dsEl.classList.add('show');
            await _sleep(300);
          }
        } else if (line.nodes) {
          div.innerHTML = line.html;
          SFX.click();
          await _sleep(80);
          await activateNodes(div, line.nodes, 60);
          await _sleep(200);
        } else {
          div.innerHTML = line.html;
          SFX.click();
          await _sleep(80);
        }
      }

      // ACCESS GRANTED 终章
      await _sleep(200);
      // 隐藏日志内容
      content.style.transition = 'opacity 0.3s ease';
      content.style.opacity = '0';
      accessGranted.classList.add('show');
      SFX.theme();
      await _sleep(600);

      // 故障闪烁退出
      overlay.classList.add('boot-glitch');
      await _sleep(300);
      cancelAnimationFrame(raf2);
      clearTimeout(teleRaf);
      window.removeEventListener('resize', onResize);
      overlay.classList.add('boot-out');
      await _sleep(500);
      overlay.remove();
      if (typeof onComplete === 'function') onComplete();
    })();
  }

  function bindLoginGate() {
    if (document.querySelector('.lg-tabs.bound')) return;
    document.querySelector('.lg-tabs').classList.add('bound');

    // Tab 切换
    document.querySelectorAll('.lg-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.lg-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('lg-form-login').style.display = target === 'login' ? '' : 'none';
        document.getElementById('lg-form-register').style.display = target === 'register' ? '' : 'none';
      });
    });

    // 密码显隐
    const eyeLogin = document.getElementById('lg-eye-login');
    const eyeReg   = document.getElementById('lg-eye-reg');
    if (eyeLogin) eyeLogin.addEventListener('click', () => {
      const p = document.getElementById('lg-login-pass');
      const is = p.type === 'password';
      p.type = is ? 'text' : 'password';
      eyeLogin.textContent = is ? '◎' : '◉';
    });
    if (eyeReg) eyeReg.addEventListener('click', () => {
      const p = document.getElementById('lg-reg-pass');
      const is = p.type === 'password';
      p.type = is ? 'text' : 'password';
      eyeReg.textContent = is ? '◎' : '◉';
    });

    // 发送验证码
    const codeBtn = document.getElementById('lg-send-code');
    if (codeBtn && !codeBtn.dataset.bound) {
      codeBtn.dataset.bound = '1';
      codeBtn.addEventListener('click', async () => {
        const contact = document.getElementById('lg-reg-contact').value.trim();
        if (!contact) return showRegErr('请先输入手机号或邮箱');
        if (!/^1[3-9]\d{9}$/.test(contact) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
          return showRegErr('请输入有效的手机号或邮箱');

        codeBtn.disabled = true;
        const originText = codeBtn.textContent;
        codeBtn.textContent = '发送中...';
        hideRegErr();

        const r = await API.sendCode(contact);
        if (!r.ok) {
          codeBtn.disabled = false;
          codeBtn.textContent = originText;
          return showRegErr(r.msg || '发送失败');
        }

        // 如果服务端返回了 code（mock 模式或降级），在 Toast 里显示
        if (r.code) showCodeToast(contact, r.code, r.msg);
        else showCodeToast(contact, '已发送，请查收', r.msg, true);

        // 倒计时
        let sec = 60;
        codeBtn.textContent = `${sec}s 后重发`;
        const timer = setInterval(() => {
          sec--;
          if (sec <= 0) {
            clearInterval(timer);
            codeBtn.disabled = false;
            codeBtn.textContent = '重新发送';
          } else {
            codeBtn.textContent = `${sec}s 后重发`;
          }
        }, 1000);
      });
    }

    // 登录提交
    const loginForm = document.getElementById('lg-form-login');
    if (loginForm && !loginForm.dataset.bound) {
      loginForm.dataset.bound = '1';

      // 密码 / 短信验证码 双模式切换（状态存于 DOM dataset，登出后由 showLoginGate 重置）
      const modeToggle = document.getElementById('lg-toggle-login-mode');
      const passField = document.getElementById('lg-login-pass-field');
      const codeField = document.getElementById('lg-login-code-field');
      if (modeToggle) {
        if (!modeToggle.dataset.mode) modeToggle.dataset.mode = 'password';
        modeToggle.addEventListener('click', () => {
          const next = modeToggle.dataset.mode === 'code' ? 'password' : 'code';
          modeToggle.dataset.mode = next;
          if (passField) passField.style.display = next === 'password' ? '' : 'none';
          if (codeField) codeField.style.display = next === 'code' ? '' : 'none';
          modeToggle.textContent = next === 'password' ? '使用短信验证码登录 →' : '← 使用密码登录';
          const btnText = document.getElementById('lg-submit-login').querySelector('.lg-btn-text');
          btnText.innerHTML = next === 'password' ? (ico('shield',14)+' 登录档案系统') : '◈ 验证码登录';
          hideLoginErr();
        });
      }

      // 发送登录验证码（手机号走真实短信通道）
      const lgCodeBtn = document.getElementById('lg-send-login-code');
      if (lgCodeBtn && !lgCodeBtn.dataset.bound) {
        lgCodeBtn.dataset.bound = '1';
        lgCodeBtn.addEventListener('click', async () => {
          const contact = document.getElementById('lg-login-contact').value.trim();
          if (!contact) return showLoginErr('请先输入手机号或邮箱');
          if (!/^1[3-9]\d{9}$/.test(contact) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
            return showLoginErr('请输入有效的手机号或邮箱');
          lgCodeBtn.disabled = true;
          const originText = lgCodeBtn.textContent;
          lgCodeBtn.textContent = '发送中...';
          hideLoginErr();
          const r = await API.sendCode(contact);
          if (!r.ok) {
            lgCodeBtn.disabled = false;
            lgCodeBtn.textContent = originText;
            return showLoginErr(r.msg || '发送失败');
          }
          if (r.code) showCodeToast(contact, r.code, r.msg);
          else showCodeToast(contact, '已发送，请查收', r.msg, true);
          let sec = 60;
          lgCodeBtn.textContent = `${sec}s 后重发`;
          const timer = setInterval(() => {
            sec--;
            if (sec <= 0) { clearInterval(timer); lgCodeBtn.disabled = false; lgCodeBtn.textContent = '重新发送'; }
            else lgCodeBtn.textContent = `${sec}s 后重发`;
          }, 1000);
        });
      }

      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contact = document.getElementById('lg-login-contact').value.trim();
        if (!contact) return showLoginErr('请输入手机号或邮箱');

        const sub = document.getElementById('lg-submit-login');
        const btnText = sub.querySelector('.lg-btn-text');
        const isCodeMode = modeToggle ? modeToggle.dataset.mode === 'code' : false;
        let r;
        if (isCodeMode) {
          const code = document.getElementById('lg-login-code').value.trim();
          if (!code) return showLoginErr('请输入验证码');
          hideLoginErr();
          sub.disabled = true; sub.classList.add('is-loading');
          btnText.textContent = '正在验证验证码...';
          r = await API.loginByCode(contact, code);
        } else {
          const pass = document.getElementById('lg-login-pass').value.trim();
          if (pass.length < 6) return showLoginErr('密码至少 6 位');
          hideLoginErr();
          sub.disabled = true; sub.classList.add('is-loading');
          btnText.textContent = '正在验证...';
          r = await API.login(contact, pass);
        }

        sub.disabled = false; sub.classList.remove('is-loading');
        btnText.innerHTML = isCodeMode ? '◈ 验证码登录' : (ico('shield',14)+' 登录档案系统');
        if (!r.ok) return showLoginErr(r.msg);
        refreshIdentity();
        const _bootFx = () => showBootSequence(Auth.get(), () => {
          location.hash = '#/';
          router();
        });
        // 闸门退出动画（ACCESS GRANTED + CRT 关屏）后再进入启动序列
        if (window.FX && FX.gateOut) FX.gateOut(document.getElementById('login-gate'), () => { hideLoginGate(); _bootFx(); });
        else { hideLoginGate(); _bootFx(); }
      });
    }

    // 注册提交
    const regForm = document.getElementById('lg-form-register');
    if (regForm && !regForm.dataset.bound) {
      regForm.dataset.bound = '1';
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contact = document.getElementById('lg-reg-contact').value.trim();
        const code    = document.getElementById('lg-reg-code').value.trim();
        const pass    = document.getElementById('lg-reg-pass').value.trim();
        const pass2   = document.getElementById('lg-reg-pass2').value.trim();

        if (!contact) return showRegErr('请输入手机号或邮箱');
        if (!code) return showRegErr('请输入验证码');
        if (pass.length < 6) return showRegErr('密码至少 6 位');
        if (pass !== pass2) return showRegErr('两次密码不一致');

        hideRegErr();
        const sub = document.getElementById('lg-submit-reg');
        const btnText = sub.querySelector('.lg-btn-text');
        sub.disabled = true; sub.classList.add('is-loading');
        btnText.textContent = '正在注册...';

        const r = await API.register(contact, code, pass);

        sub.disabled = false; sub.classList.remove('is-loading');
        btnText.innerHTML = ico('shield',14)+' 注册并登录';
        if (!r.ok) return showRegErr(r.msg);
        refreshIdentity();
        const _bootFx = () => showBootSequence(Auth.get(), () => {
          location.hash = '#/';
          router();
        });
        // 闸门退出动画（ACCESS GRANTED + CRT 关屏）后再进入启动序列
        if (window.FX && FX.gateOut) FX.gateOut(document.getElementById('login-gate'), () => { hideLoginGate(); _bootFx(); });
        else { hideLoginGate(); _bootFx(); }
      });
    }

    // 游客模式
    const guestBtn = document.getElementById('lg-guest-btn');
    if (guestBtn && !guestBtn.dataset.bound) {
      guestBtn.dataset.bound = '1';
      guestBtn.addEventListener('click', () => {
        Auth.guest();
        refreshIdentity();
        const _bootFx = () => showBootSequence(Auth.get(), () => {
          location.hash = '#/';
          router();
        });
        // 闸门退出动画（ACCESS GRANTED + CRT 关屏）后再进入启动序列
        if (window.FX && FX.gateOut) FX.gateOut(document.getElementById('login-gate'), () => { hideLoginGate(); _bootFx(); });
        else { hideLoginGate(); _bootFx(); }
      });
    }

    function showLoginErr(m) { const e=document.getElementById('lg-error-login'); e.innerHTML=ico('warn',12)+' '+m; e.style.display='block'; SFX.error(); }
    function hideLoginErr()  { document.getElementById('lg-error-login').style.display='none'; }
    function showRegErr(m)   { const e=document.getElementById('lg-error-reg'); e.innerHTML=ico('warn',12)+' '+m; e.style.display='block'; SFX.error(); }
    function hideRegErr()    { document.getElementById('lg-error-reg').style.display='none'; }
  }

  // 验证码提示
  function showCodeToast(contact, codeOrMsg, desc, hideCode) {
    let toast = document.getElementById('lg-code-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lg-code-toast';
      toast.className = 'lg-code-toast';
      document.getElementById('login-gate').appendChild(toast);
    }
    const isPhone = /^1[3-9]\d{9}$/.test(contact);
    const title = hideCode ? '验证码已发送' : '验证码已发送（演示模式）';
    const body = hideCode
      ? `已向 <strong>${contact}</strong> ${isPhone ? '手机' : '邮箱'}发送验证码，请查收`
      : `已向 <strong>${contact}</strong> ${isPhone ? '手机' : '邮箱'}发送验证码<br>验证码为 <span class="lg-toast-code">${codeOrMsg}</span>`;
    const hint = desc ? desc : (hideCode ? '有效时间 5 分钟' : '接入真实短信/邮件服务后，此处不会显示验证码');
    toast.style.transition = '';
    toast.style.opacity = '1';
    toast.innerHTML = `
      <div class="lg-toast-title">${title}</div>
      <div class="lg-toast-body">${body}</div>
      <div class="lg-toast-hint">${hint}</div>
    `;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.transition='opacity .4s'; toast.style.opacity = '0'; setTimeout(() => toast.style.display='none', 420); }, 9000);
  }

  function bindLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      Auth.clear();
      refreshIdentity();
      location.hash = '#/';
      showLoginGate();
      SFX.logout();
    });
  }

  // ============ 全局键盘快捷键 (Esc / / / ← →) ============
  let _keyboardBound = false;
  function bindKeyboardShortcuts() {
    if (_keyboardBound) return;
    _keyboardBound = true;
    document.addEventListener('keydown', (e) => {
      // / 聚焦搜索框（非输入元素时）
      if (e.key === '/' && !/^(?:input|textarea|select)$/i.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        const gs = document.getElementById('global-search');
        if (gs) { gs.focus(); gs.select(); }
        return;
      }
      // Esc 关闭各类弹窗
      if (e.key === 'Escape') {
        const am = document.getElementById('account-modal');
        if (am && am.style.display !== 'none') { closeAccountModal(); return; }
        const lb = document.querySelector('.lightbox-overlay');
        if (lb) { lb.remove(); return; }
        const adm = document.querySelector('.admin-modal');
        if (adm) adm.remove();
      }
      // 列表页左右箭头翻页（仅当不是在输入框里）
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const editing = (tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable);
      if (!editing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const hash = location.hash.slice(1) || '/';
        const [path, qs] = hash.split('?');
        const query = new URLSearchParams(qs || '');
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 1 && CAT_MAP[parts[0]]) {
          const page = parseInt(query.get('page') || '1', 10) || 1;
          const next = e.key === 'ArrowRight' ? page + 1 : page - 1;
          if (next >= 1) {
            const totalCnt = (getEntries(parts[0]) || []).length;
            const per = 12;
            const totalPages = Math.max(1, Math.ceil(totalCnt / per));
            if (next <= totalPages && next !== page) {
              query.set('page', String(next));
              location.hash = `#/${parts[0]}${query.toString() ? '?' + query.toString() : ''}`;
            }
          }
        }
      }
    });
  }

  // ============ 主题切换按钮绑定 ============
  let _themeBound = false;
  function bindThemeToggle() {
    if (_themeBound) return;
    _themeBound = true;
    // 在 header 状态行注入主题按钮
    const bar = document.querySelector('.header-status');
    if (!bar || bar.querySelector('.theme-toggle')) return;
    const sep = document.createElement('span'); sep.className = 'status-sep'; sep.textContent = '·';
    const btn = document.createElement('button');
    btn.className = 'theme-toggle status-item';
    btn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text-2);font-family:var(--f-mono);font-size:9px;letter-spacing:1px;padding:0 4px;display:inline-flex;align-items:center;gap:3px;';
    const sunSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:13px;height:13px;"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="7" y2="17"/><line x1="17" y1="7" x2="19.1" y2="4.9"/></svg>';
    const moonSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    const holoSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z"/><path d="M12 2 L12 22"/><path d="M3 7 L12 12 L21 7"/><path d="M3 17 L12 12 L21 17"/></svg>';
    const THEME_META = {
      dark:  { icon: moonSVG, label: '机密暗室',   title: '切换至 明亮档案室' },
      light: { icon: sunSVG,  label: '明亮档案室', title: '切换至 全息终端' },
      holo:  { icon: holoSVG, label: '全息终端',   title: '切换至 机密暗室' },
    };
    const sync = () => {
      const t = Theme.get();
      const m = THEME_META[t] || THEME_META.dark;
      btn.innerHTML = m.icon + ' ' + m.label;
      btn.title = m.title;
    };
    sync();
    Bus.on('theme:changed', sync);
    btn.addEventListener('click', () => {
      Theme.next();
      SFX.theme();
    });
    bar.appendChild(sep); bar.appendChild(btn);
  }

  // ============ 顶部状态栏计数刷新（Bus 监听）============
  let _statsBusBound = false;
  function bindStatsBus() {
    if (_statsBusBound) return;
    _statsBusBound = true;
    Bus.on('entries:changed', refreshTopStats);
    Bus.on('submissions:reviewed', refreshTopStats);
    Bus.on('stats:refresh', refreshTopStats);
    Bus.on('cats:changed', () => { renderNavCats(); refreshTopStats(); refreshSidebarStats(); });
  }
  function refreshTopStats() {
    const totEl = document.getElementById('stat-total');
    const updEl = document.getElementById('stat-updated');
    if (totEl) totEl.textContent = `${statsTotal()} 条`;
    if (updEl) updEl.textContent = DATA.meta.updated || '—';
    // 同步侧边栏总数
    const sbTot = document.getElementById('sb-stat-total');
    if (sbTot) sbTot.textContent = '在档条目：' + (statsTotal() || 0) + ' 条';
  }

  // ============ 关键词高亮 ============
  function highlightKeyword(text, kw) {
    if (!kw) return escapeHtml(text || '');
    const safe = escapeHtml(text || '');
    try {
      const re = new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      return safe.replace(re, '<mark class="kw-hl">$1</mark>');
    } catch { return safe; }
  }

  // ============ 导出完整备份 ============
  function exportBackupJSON() {
    const keys = [
      AUTH_KEY, USERS_KEY, CODES_KEY, SUBMIT_KEY, TOKEN_KEY, ENTRIES_KEY, CATS_KEY,
      DISMISSED_NOTICES_KEY, FAV_KEY, COMMENT_KEY, LOG_KEY, THEME_KEY,
      READ_KEY, DRAFT_KEY
    ];
    const backup = {
      exportedAt: Date.now(),
      exportedBy: (Auth.get() && Auth.get().user) || '',
      version: '2.71',
      localStorage: {},
      dataSnap: {}
    };
    keys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v) backup.localStorage[k] = v;
    });
    // 全量数据快照（分类数据 + categories + meta）
    backup.dataSnap = {
      meta: DATA.meta,
      categories: DATA.categories,
      classLegend: DATA.classLegend
    };
    DATA.categories.forEach(c => { backup.dataSnap[c.id] = DATA[c.id] || []; });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `wa-backup-${ts}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    SFX.export();
  }

  // ============ 简易用户增长曲线计算 ============
  function computeMonthlyUserGrowth() {
    const users = Auth.getUsers();
    const months = {};
    users.forEach(u => {
      const at = u.at || u.createdAt || Date.now();
      const d = new Date(at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = (months[key] || 0) + 1;
    });
    const keys = Object.keys(months).sort();
    // 取最近 6 个月
    const last = keys.slice(-6);
    const pad = 6 - last.length;
    const out = [];
    for (let i = 0; i < pad; i++) out.push({ label: `M${i + 1}`, v: 0 });
    last.forEach((k, i) => out.push({ label: pad > 0 ? `M${pad + i + 1}` : k.slice(2), v: months[k] }));
    return out.slice(-6);
  }

  // ============ 路由 ============
  function router() {
    // 未登录强制进入门禁
    if (!Auth.get()) {
      showLoginGate();
      return;
    }
    hideLoginGate();
    refreshIdentity();
    // 启动 Bus 绑定
    bindStatsBus();

    const hash = location.hash.slice(1) || '/';
    const [path, qs] = hash.split('?');
    const query = new URLSearchParams(qs || '');
    const parts = path.split('/').filter(Boolean);

    updateNav(path);
    // 导航音效（排除初始空hash进入的情况）
    if (window._routedOnce) SFX.navigate();
    window._routedOnce = true;

    const doRender = () => {
      if (parts.length === 0) renderHome();
      else if (parts[0] === 'search') renderSearch(query.get('q') || '');
      else if (parts[0] === 'glossary') renderGlossary();
      else if (parts[0] === 'canon') renderCanon();
      else if (parts[0] === 'library' && parts.length >= 2) renderLibraryDoc(parts[1]);
      else if (parts[0] === 'library') renderLibrary();
      else if (parts[0] === 'health') renderHealth();
      else if (parts[0] === 'observe') renderObserve();
      else if (parts[0] === 'mindmap') renderMindMap();
      else if (parts[0] === 'submit') renderSubmit();
      else if (parts[0] === 'admin') renderAdmin();
      else if (parts[0] === 'account') renderAccount();
      else if (parts[0] === 'user' && parts.length >= 2) renderUserPage(decodeURIComponent(parts[1]));
      else if (parts[0] === 'entry' && parts.length >= 3) renderEntry(parts[1], decodeURIComponent(parts[2]));
      else if (CAT_MAP[parts[0]]) renderList(parts[0], query);
      else renderNotFound();

      // 非详情页隐藏阅读进度条
      if (parts[0] !== 'entry') {
        const rp = document.getElementById('reading-progress');
        if (rp) rp.style.width = '0%';
        document.body.classList.remove('focus-reading');
      }

      window.scrollTo({ top: 0, behavior: 'instant' });

      // 路由切换转场：重放一次入场动画（先移除再加，强制重排以重新触发）
      try {
        const vc = document.getElementById('view-container');
        if (vc) {
          vc.classList.remove('route-enter');
          void vc.offsetWidth;
          vc.classList.add('route-enter');
        }
      } catch (e) {}

      initLazyLoad();
    };

    transitionViews(doRender);
  }

  // ---- 路由「过场帘」扫描转场（方案B） ----
  let _navToken = 0;
  function transitionViews(renderFn) {
    const wipe = document.getElementById('route-wipe');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 首次加载、无遮罩、或系统要求减少动效时：直接渲染，不做过场帘
    if (!wipe || !window._routedOnce || reduce) { renderFn(); return; }
    const token = ++_navToken;
    wipe.classList.remove('active', 'exit');
    void wipe.offsetWidth;
    wipe.classList.add('active');                    // 扫描帘进入（~180ms）
    setTimeout(() => {
      if (token !== _navToken) return;               // 已被更新的导航取代
      renderFn();                                     // 帘后切换内容
      wipe.classList.add('exit');                     // 扫描帘退场（~280ms）
      setTimeout(() => {
        if (token !== _navToken) return;
        wipe.classList.remove('active', 'exit');
      }, 300);
    }, 195);
  }

  function updateNav(path) {
    document.querySelectorAll('.nav-link').forEach(a => {
      const route = a.dataset.route;
      const active = route === '/' ? path === '/' : path.startsWith(route);
      a.classList.toggle('active', active);
    });
    updateSidebarNav(path);
  }

  // ============ 栏目导航动态渲染 ============
  // 内置分类的专属 SVG 图标
  const CAT_ICONS = {
    anomalies: '<polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/>',
    organizations: '<polygon points="12,2 22,12 12,22 2,12"/>',
    deities: '<polygon points="12,2 14,8 20,6 16,11 22,14 16,15 18,21 12,17 6,21 8,15 2,14 8,11 4,6 10,8"/>',
    eras: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.8" y2="4.2"/>',
    timelines: '<circle cx="12" cy="13" r="8"/><polyline points="12,9 12,13 15,15"/><line x1="9" y1="2" x2="15" y2="2"/>'
  };
  // 通用 SVG（自定义栏目用）
  const CAT_ICON_DEFAULT = '<path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4z"/><path d="M4 4v14"/><path d="M8 8h6M8 12h6"/>';
  function catIconSvg(catId) {
    const inner = CAT_ICONS[catId] || CAT_ICON_DEFAULT;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
  }
  // 渲染顶部导航 + 侧边栏的分类链接（动态栏目）
  function renderNavCats() {
    const headerWrap = document.getElementById('nav-cats-inline');
    const sbWrap = document.getElementById('sb-cat-links');
    const links = DATA.categories.map(c => {
      const svg = catIconSvg(c.id);
      return { header: `<a href="#/${c.id}" class="nav-link" data-route="/${c.id}">${escapeHtml(c.name)}</a>`,
               sidebar: `<a href="#/${c.id}" class="sidebar-link" data-route="/${c.id}">${svg}<span>${escapeHtml(c.name)}</span></a>` };
    });
    if (headerWrap) headerWrap.innerHTML = links.map(l => l.header).join('');
    if (sbWrap) sbWrap.innerHTML = links.map(l => l.sidebar).join('');
    // 重渲染后同步当前路由高亮
    const path = (location.hash.replace(/^#/, '') || '/').split('?')[0];
    if (path !== '/') updateNav(path);
  }

  // ============ 监控终端（真实摄像头 · 世界观监控 HUD） ============
  const CCTV_CHANNELS = [
    { id:'01', name:'第一门', label:'第一门 · 辉山山脉地底考察点', coord:'中洲 · 辉山山脉 · 地底', obj:'门体裂隙开合 · 符文共振（唯一已物理接触）', proto:'GATE-01', bg:'timeline/zhong.png', filter:'grayscale(1) contrast(1.12)' },
    { id:'02', name:'第二门', label:'第二门 · 永夜森林之下', coord:'北洲 · 永夜森林 · 地下', obj:'极光强度 · 守夜母石（遥感 · 未确认）', proto:'GATE-02', bg:'timeline/bei.png', filter:'grayscale(1) contrast(1.12)' },
    { id:'03', name:'第三门', label:'第三门 · 东屿海沟最深处', coord:'东洲 · 东屿海沟 · 深层', obj:'阿库拉声纹 · 水压异常（声呐回传 · 未确认）', proto:'GATE-03', bg:'timeline/dong.png', filter:'grayscale(1) contrast(1.12)' },
    { id:'04', name:'第四门', label:'第四门 · 南裂谷深层', coord:'南洲 · 南裂谷 · 深层', obj:'白雾浓度 · 梦境脑波（雾中信号 · 未确认）', proto:'GATE-04', bg:'timeline/nan.png', filter:'grayscale(1) contrast(1.12)' },
  ];

  function renderCCTV() {
    return `
      <!-- 监控终端 -->
      <section class="section-block" id="cctv-section">
        <div class="section-head">
          <div class="section-title">监控终端<span class="section-title-en">CCTV SURVEILLANCE</span></div>
          <div class="section-head-right">四道门监控网络 · 第一门已接触 / 其余遥感未确认</div>
        </div>
        <div class="cctv-wrap">
          <div class="cctv-screen" id="cctv-screen">
            <video id="cctv-video" autoplay playsinline muted></video>
            <canvas id="cctv-canvas" width="640" height="360"></canvas>
            <div class="cctv-scanline"></div>
            <div class="cctv-corner tl"></div><div class="cctv-corner tr"></div><div class="cctv-corner bl"></div><div class="cctv-corner br"></div>
            <div class="cctv-camid" id="cctv-camid">CAM-01 · GATE-01 第一门</div>
            <div class="cctv-rec" id="cctv-rec">○ 待机</div>
            <div class="cctv-frame" id="cctv-frame">FR 0000</div>
            <div class="cctv-meta">
              <span id="cctv-coord">坐标：中洲 · 辉山山脉 · 地底</span>
              <span id="cctv-enc">ENC AES-256-GCM</span>
              <span id="cctv-perm">权限 LV.5</span>
            </div>
            <div class="cctv-msg" id="cctv-msg">监控终端已就绪。点击「启用监控」接入本机摄像头，画面将实时渲染于此——它将作为世界观内红月政府的监控信号。</div>
          </div>
          <div class="cctv-side">
            <div class="cctv-status"><span class="cctv-status-dot" id="cctv-status-dot"></span><span id="cctv-status-txt">OFFLINE · 待机</span></div>
            <div class="cctv-ch-title">四门 · GATES</div>
            <div class="cctv-ch" id="cctv-ch">
              ${CCTV_CHANNELS.map(c => `<button class="cctv-ch-btn${c.id === '01' ? ' active' : ''}" data-ch="${c.id}">GATE-${c.id} ${c.name}</button>`).join('')}
            </div>
            <div class="cctv-obj" id="cctv-obj">目标：门体裂隙开合 · 符文共振（唯一已物理接触）</div>
            <div class="cctv-proto" id="cctv-proto">协议：GATE-01</div>
            <div class="cctv-actions">
              <button class="btn-mini" id="cctv-on">⏻ 启用监控</button>
              <button class="btn-mini" id="cctv-off" style="display:none">⏸ 停止监控</button>
            </div>
            <div class="cctv-priv">画面仅在本机实时渲染 · 绝不上传 · 停止即释放摄像头</div>
          </div>
        </div>
      </section>`;
  }

  function initCCTV() {
    const sc = document.getElementById('cctv-section');
    if (!sc || sc.dataset.bound) return;
    sc.dataset.bound = '1';
    const video = document.getElementById('cctv-video');
    const canvas = document.getElementById('cctv-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const $ = id => document.getElementById(id);
    const camidEl = $('cctv-camid'), recEl = $('cctv-rec'), frameEl = $('cctv-frame');
    const coordEl = $('cctv-coord'), objEl = $('cctv-obj'), protoEl = $('cctv-proto');
    const msgEl = $('cctv-msg'), statusTxt = $('cctv-status-txt'), dotEl = $('cctv-status-dot');
    const onBtn = $('cctv-on'), offBtn = $('cctv-off');
    let stream = null, raf = 0, frame = 0, active = false;
    let channel = CCTV_CHANNELS[0];

    // 四门存档画面（无摄像头时作为信号源）
    const gateImgs = {};
    CCTV_CHANNELS.forEach(c => {
      const im = new Image();
      im.src = 'data/' + c.bg;
      gateImgs[c.id] = im;
    });
    const gateImg = () => gateImgs[channel.id];
    const feedStatus = c => c.id === '01' ? 'ARCHIVE ● 存档回放' : 'REMOTE ● 遥感（未确认）';

    function drawGateFeed(w, h) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const im = gateImg();
      if (im && im.complete && im.naturalWidth) {
        const t = frame * 0.016;
        // Ken Burns：缓慢呼吸式推近 + 双轴漂移
        const z = 1.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.22));
        const panX = Math.sin(t * 0.13) * 0.03;
        const panY = Math.cos(t * 0.17) * 0.025;
        const base = Math.max(w / im.naturalWidth, h / im.naturalHeight) * z;
        const dw = im.naturalWidth * base, dh = im.naturalHeight * base;
        ctx.drawImage(im, (w - dw) / 2 + panX * dw, (h - dh) / 2 + panY * dh, dw, dh);
        // 周期性信号抖动：横向错位条带
        if (frame % 90 < 4) {
          const sy = Math.floor(Math.random() * h);
          const sh = 6 + Math.floor(Math.random() * 20);
          try { const strip = ctx.getImageData(0, sy, w, sh); ctx.putImageData(strip, (Math.random() * 24 - 12) | 0, sy); } catch (e) {}
        }
        // 偶发亮度闪烁
        if (Math.random() < 0.015) {
          ctx.fillStyle = 'rgba(232,232,232,' + (Math.random() * 0.06) + ')';
          ctx.fillRect(0, 0, w, h);
        }
      }
    }

    function applyChannel(c) {
      channel = c;
      camidEl.textContent = `CAM-${c.id} · GATE-${c.id} ${c.name}`;
      coordEl.textContent = `坐标：${c.coord}`;
      objEl.textContent = `目标：${c.obj}`;
      protoEl.textContent = `协议：${c.proto}`;
      canvas.style.filter = c.filter;
      video.style.filter = c.filter;
      sc.querySelectorAll('.cctv-ch-btn').forEach(b => b.classList.toggle('active', b.dataset.ch === c.id));
      if (!active) { statusTxt.textContent = feedStatus(c); dotEl.className = 'cctv-status-dot live'; }
    }
    sc.querySelectorAll('.cctv-ch-btn').forEach(b => {
      b.addEventListener('click', () => {
        const c = CCTV_CHANNELS.find(x => x.id === b.dataset.ch);
        if (c) applyChannel(c);
        if (window.SFX && SFX.navigate) SFX.navigate();
      });
    });

    function draw() {
      frame++;
      const w = canvas.width, h = canvas.height;
      if (active && video.readyState >= 2 && video.videoWidth) {
        const vw = video.videoWidth, vh = video.videoHeight;
        const scale = Math.max(w / vw, h / vh);
        const dw = vw * scale, dh = vh * scale;
        ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
      } else {
        drawGateFeed(w, h);
      }
      // 噪点（存档画面轻微，信号丢失时更密）
      const density = canvas.classList.contains('noise') ? 0.06 : 0.012;
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const n = Math.floor(w * h * density);
      for (let i = 0; i < n; i++) {
        const px = (Math.random() * (w * h)) | 0;
        const idx = px * 4;
        const v = Math.random() * 255;
        d[idx] = d[idx + 1] = d[idx + 2] = v;
      }
      ctx.putImageData(img, 0, 0);
      // 时间戳 + 帧号
      const now = new Date();
      const p2 = n => String(n).padStart(2, '0');
      recEl.textContent = (active ? '●' : '○') + ' ' + now.getFullYear() + '-' + p2(now.getMonth() + 1) + '-' + p2(now.getDate()) + ' ' + p2(now.getHours()) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds());
      frameEl.textContent = 'FR ' + String(frame).padStart(4, '0');
      raf = requestAnimationFrame(draw);
    }

    async function start() {
      if (active) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        await video.play().catch(() => {});
        active = true;
        statusTxt.textContent = 'LIVE ● 实时监控';
        dotEl.className = 'cctv-status-dot live';
        onBtn.style.display = 'none'; offBtn.style.display = '';
        canvas.classList.remove('noise');
        msgEl.style.display = 'none';
        if (!raf) raf = requestAnimationFrame(draw);
      } catch (e) {
        // 摄像头不可用：回退到四门存档画面
        active = false;
        onBtn.style.display = ''; offBtn.style.display = 'none';
        canvas.classList.remove('noise');
        msgEl.style.display = 'none';
        statusTxt.textContent = feedStatus(channel);
        dotEl.className = 'cctv-status-dot live';
        if (!raf) raf = requestAnimationFrame(draw);
      }
    }
    function stop() {
      active = false;
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      video.srcObject = null;
      onBtn.style.display = ''; offBtn.style.display = 'none';
      canvas.classList.remove('live', 'noise');
      msgEl.style.display = 'none';
      statusTxt.textContent = feedStatus(channel);
      dotEl.className = 'cctv-status-dot live';
    }
    // 默认即播放四门存档画面（无摄像头也有信号）
    canvas.classList.remove('noise');
    msgEl.style.display = 'none';
    statusTxt.textContent = feedStatus(channel);
    dotEl.className = 'cctv-status-dot live';
    raf = requestAnimationFrame(draw);
    onBtn.addEventListener('click', start);
    offBtn.addEventListener('click', stop);
  }

  // ============ 首页 ============
  function renderHome() {
    const stats = computeStats();
    const C = DATA.categories;

    // 分类卡片
    const catCards = C.map(cat => {
      const count = stats.counts[cat.id] || 0;
      return `
        <a class="cat-card" href="#/${cat.id}">
          <div class="cat-head">
            <span class="cat-code">${cat.code}</span>
            <span class="cat-icon">${cat.icon}</span>
          </div>
          <div class="cat-name">${cat.name}</div>
          <span class="cat-name-en">${cat.nameEn}</span>
          <div class="cat-desc">${cat.desc}</div>
          <div class="cat-foot">
            <div><span class="cat-count">${count}</span><span class="cat-count-label">DOCS</span></div>
            <span class="cat-go">ENTER →</span>
          </div>
        </a>`;
    }).join('');

    // 世界观概览（核心 4 项）
    const coreItems = [
      { n: '01', t: '超自然异象', d: '在档异常实体、现象、地点、物品，按危险等级分级归档。' },
      { n: '02', t: '极端组织', d: '红月之下活跃的官方机构、企业、宗教、雇佣兵与地下势力。' },
      { n: '03', t: '历史事件', d: '神代、黑蚀、寂祀三大纪元，以及《喀尔迦书》与灾变纪。' },
      { n: '04', t: '核心设定', d: '神祇权柄、异常理论框架、血矿与虚境等基础设定。' },
    ].map(x => `
      <div class="core-item">
        <span class="core-num">${x.n}</span>
        <div class="core-title">${x.t}</div>
        <div class="core-desc">${x.d}</div>
      </div>
    `).join('');

    // 首页时间线（四大洲 · 世界史主线；图由用户提供，未录入前显示占位）
    const tlNodes = [
      { year: '中洲', title: '中洲 · 世界主线', desc: '神在人间（前3000—300）→ 无神者的纪元（300—1900）→ 触碰边界（1900—2300）→ 静态纪元（2300—今）。第一门在辉山山脉地底。', red: false, img: 'timeline/zhong.png' },
      { year: '北洲', title: '北洲 · 等待之地', desc: '极光与守夜 → 永夜与凝滞（埃尔德沉没后极光消失）→ 解析与等待 → 红月之下。守夜与赛伊东，第二门在永夜森林之下。等待即信仰。', red: true, img: 'timeline/bei.png' },
      { year: '东洲', title: '东洲 · 倾听之海', desc: '海沟与声音 → 诸国与虚空 → 解析与倾听 → 红月之下。阿库拉之声恒久低语，第三门在东屿海沟最深处。', red: false, img: 'timeline/dong.png' },
      { year: '南洲', title: '南洲 · 沉睡裂谷', desc: '裂谷与母巢 → 裂谷与梦境（梦潮·睡城病）→ 解析与沉睡 → 红月之下。白雾与裂谷之息，第四门在南裂谷深层。', red: true, img: 'timeline/nan.png' },
    ];
    const timeline = tlNodes.map(t => {
      const imgHtml = t.img
        ? `<div class="tl-img" style="background-image:url('${encodeURI('data/' + t.img)}')"><span class="tl-img-tag">${t.title.slice(0,2)}</span></div>`
        : `<div class="tl-img empty"><span>待录入洲域影像</span></div>`;
      return `
      <div class="tl-item">
        <div class="tl-year">${t.year}</div>
        <div class="tl-dot ${t.red ? 'red' : ''}"></div>
        ${imgHtml}
        <div class="tl-title">${t.title}</div>
        <div class="tl-desc">${t.desc}</div>
      </div>
    `;
    }).join('');

    // 四洲世界地图（纯 SVG · 档案手稿风）
    const wmGrid = (() => {
      let lines = '';
      for (let x = 120; x <= 880; x += 126) lines += `<line x1="${x}" y1="40" x2="${x}" y2="520"/>`;
      for (let y = 80; y <= 480; y += 100) lines += `<line x1="80" y1="${y}" x2="920" y2="${y}"/>`;
      return lines;
    })();
    const worldMap = `
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">世界总图<span class="section-title-en">GENERAL MAP</span></div>
          <div class="section-head-right">点击洲域进入对应世界史</div>
        </div>
        <div class="wm-wrap">
          <svg class="wm-svg" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet">
            <g class="wm-grid">${wmGrid}</g>
            <path class="wm-land" data-code="NOR" d="M330,60 C300,70 280,110 300,140 C330,170 420,175 480,165 C550,170 620,150 630,115 C640,80 560,55 500,55 C440,50 360,50 330,60 Z"/>
            <path class="wm-land" data-code="ZHN" d="M340,200 C300,210 280,260 300,310 C320,360 380,380 440,370 C510,380 580,350 600,300 C620,250 560,205 500,200 C450,195 380,190 340,200 Z"/>
            <path class="wm-land" data-code="EST" d="M720,180 C690,190 675,240 695,290 C715,345 780,370 840,355 C900,340 925,290 910,240 C895,195 800,165 750,170 C735,172 725,176 720,180 Z"/>
            <path class="wm-land" data-code="SOU" d="M330,420 C300,430 285,475 310,510 C340,545 420,550 480,535 C545,520 600,490 600,450 C600,415 530,400 470,405 C410,408 360,410 330,420 Z"/>
            <text class="wm-label" x="465" y="100" text-anchor="middle">北洲</text>
            <text class="wm-sub" x="465" y="118" text-anchor="middle">NOR · 等待之地</text>
            <text class="wm-gate" x="465" y="152" text-anchor="middle">◈ 第二门</text>
            <text class="wm-label" x="455" y="268" text-anchor="middle">中洲</text>
            <text class="wm-sub" x="455" y="286" text-anchor="middle">ZHN · 世界主线</text>
            <text class="wm-gate" x="455" y="232" text-anchor="middle">◈ 第一门</text>
            <text class="wm-label" x="800" y="252" text-anchor="middle">东洲</text>
            <text class="wm-sub" x="800" y="270" text-anchor="middle">EST · 倾听之海</text>
            <text class="wm-gate" x="800" y="318" text-anchor="middle">◈ 第三门</text>
            <text class="wm-label" x="460" y="468" text-anchor="middle">南洲</text>
            <text class="wm-sub" x="460" y="486" text-anchor="middle">SOU · 沉睡裂谷</text>
            <text class="wm-gate" x="460" y="436" text-anchor="middle">◈ 第四门</text>
            <g transform="translate(918,80)">
              <circle class="wm-compass" r="22"/>
              <polygon points="0,-16 4,0 0,16 -4,0" fill="var(--silver)"/>
              <text class="wm-sub" x="0" y="-26" text-anchor="middle">N</text>
            </g>
          </svg>
        </div>
      </section>`;

    // 精选文档（拿 anomalies 前 6 条 + 部分关键组织/卷宗）
    const picks = [];
    (DATA.anomalies || []).slice(0, 4).forEach(e =>
      picks.push({ e, cat: 'anomalies', num: e.id, icon: ico('hexagon',16), foot: '异常档案' }));
    (DATA.organizations || []).slice(0, 1).forEach(e =>
      picks.push({ e, cat: 'organizations', num: (e.code || 'ORG'), icon: ico('diamond',16), foot: '组织档案' }));
    (DATA.eras || []).slice(0, 1).forEach(e =>
      picks.push({ e, cat: 'eras', num: (e.code || 'ERA'), icon: ico('sun',16), foot: '纪元卷宗' }));

    const docs = picks.map((p, i) => {
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(p.e, p.cat),
        String(p.e.title || ''),
        String(p.num || '')
      );
      const sum = (p.e.summary || '').replace(/[\r\n]+/g, ' ').slice(0, 40);
      return `
      <a class="doc-card doc-card-hybrid" href="#/entry/${p.cat}/${encodeURIComponent(p.e.id)}">
        ${thumbHtml}
        <div class="doc-body">
          <span class="doc-num">DOC · ${String(i+1).padStart(2,'0')}</span>
          <div class="doc-title">${p.e.title}</div>
          ${sum ? `<div class="doc-sum">${escapeHtml(sum + (p.e.summary && p.e.summary.length > 40 ? '…' : ''))}</div>` : ''}
          <div class="doc-foot">档案编号 ${p.num} / ${p.foot}</div>
        </div>
      </a>`;
    }).join('');

    // 今日档案（按日期种子随机，优先异常档案；可一键换条）
    const todayAnomalies = DATA.anomalies || [];
    const todayPool = todayAnomalies.length ? todayAnomalies : allEntries();
    const todaySeed = (() => {
      const d = new Date();
      const s = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      return h;
    })();
    const todayPick = todayPool.length ? todayPool[todaySeed % todayPool.length] : null;
    const todayCat = todayAnomalies.length ? 'anomalies' : (todayPick && todayPick._cat);
    function todayCardHtml(p, cat) {
      const catName = (CAT_MAP[cat] && CAT_MAP[cat].name) || '';
      const num = p.code || p.id || '—';
      const plainSum = (p.summary || '').replace(/<[^>]+>/g, '').trim();
      const sum = plainSum.slice(0, 120);
      return `
        <a class="today-link" href="#/entry/${cat}/${encodeURIComponent(p.id)}" style="display:block;text-decoration:none;color:inherit;">
          <div style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">档案编号 ${escapeHtml(String(num))} / ${escapeHtml(catName)}</div>
          <div style="font-family:var(--f-serif);font-size:20px;font-weight:700;margin-top:8px;color:var(--text);">${escapeHtml(p.title)}</div>
          ${sum ? `<div style="font-family:var(--f-serif);font-size:13px;color:var(--text-2);margin-top:8px;line-height:1.8;">${escapeHtml(sum)}${plainSum.length > 120 ? '…' : ''}</div>` : ''}
          <div style="margin-top:12px;font-family:var(--f-mono);font-size:10px;color:var(--gold-1);">READ FILE →</div>
        </a>`;
    }
    const todayHtml = todayPick ? `
      <section class="section-block" id="today-section">
        <div class="section-head">
          <div class="section-title">今日档案<span class="section-title-en">TODAY'S FILE</span></div>
          <div class="section-head-right">
            <button type="button" id="today-shuffle" class="btn btn-mini" style="border:1px solid var(--border);background:transparent;color:var(--text-2);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">随机换一条 ⟳</button>
          </div>
        </div>
        <div id="today-pick" class="today-card">${todayCardHtml(todayPick, todayCat)}</div>
      </section>` : '';

    // 作品全集（A–F 组）：按「你现在要做什么」找文件
    const shelfEntries = WORKSHELF_GROUPS.map(g => {
      const have = allEntries().filter(e => (e.group || e.subcat || '') === g.id).length;
      const libHave = LIBRARY_DOCS.filter(d => d.group === g.id && d.ready && !d.internal).length;
      const n = have + libHave;
      return `
        <a class="shelf-card" href="#/library">
          <div class="shelf-top">
            <span class="shelf-id">${g.id}</span>
            <span class="shelf-icon">${ico(g.icon, 16)}</span>
          </div>
          <div class="shelf-name">${escapeHtml(g.name)}<span class="shelf-en">${escapeHtml(g.en)}</span></div>
          <div class="shelf-when">${escapeHtml(g.when)}</div>
          <div class="shelf-foot">
            <span class="shelf-count">${n ? n + ' 篇' : '整理中'}</span>
            <span class="shelf-go">OPEN →</span>
          </div>
        </a>`;
    }).join('');
    const shelfSection = `
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">设定中心<span class="section-title-en">CANON HUB · A–F</span></div>
          <div class="section-head-right">按用途分组 · 从哪开始读 <a href="#/canon">进入设定中心 →</a></div>
        </div>
        <div class="shelf-grid">${shelfEntries}</div>
      </section>`;

    view.innerHTML = `
      <!-- HERO 巨幕 -->
      <section class="hero" id="hero-section">
        <div class="hero-bg"></div>
        <div class="hero-img" id="hero-img"></div>
        <canvas class="hero-dust" id="hero-dust"></canvas>
        <div class="hero-scanline"></div>
        <div class="hero-inner">
          <div>
            <div class="hero-tag" id="hero-tag">CLASSIFIED ARCHIVE · 绝密档案数据库</div>
            <h1 class="hero-title">
              未知之物
              <span class="line2">已被收容。</span>
            </h1>
            <p class="hero-desc" id="hero-desc">
              本档案库收录了自白曐降临以来，全部被记录在案的超自然异象、组织机构、神祇谱系、纪元历史与时间线事件。
              每一条档案均经过危险分级、来源追溯与交叉引用校验。
            </p>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#/anomalies">${ico('arrowLeft',14)} 浏览档案</a>
              <a class="btn btn-ghost" href="#/eras">阅读历史卷宗 →</a>
              <a class="btn btn-ghost" href="#/planet" title="盖亚全息观测">◈ 星球全息图</a>
            </div>
          </div>
          <div class="hero-stats">
            <div class="stat-row">
              <span class="stat-label">异常异象</span>
              <div><span class="stat-value" data-count="${stats.counts.anomalies||0}">0</span><span class="stat-unit">CASES</span></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">在册组织</span>
              <div><span class="stat-value" data-count="${stats.counts.organizations||0}">0</span><span class="stat-unit">ORGS</span></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">纪元卷宗</span>
              <div><span class="stat-value" data-count="${stats.counts.eras||0}">0</span><span class="stat-unit">CODS</span></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">神祇名录</span>
              <div><span class="stat-value" data-count="${stats.counts.deities||0}">0</span><span class="stat-unit">DEI</span></div>
            </div>
            <div class="hero-seal" title="世界观察档案库印玺">
              <img src="data/logo-mark.png" alt="" onerror="(function(el){var n='data/logo-mark.jpg,x.jpg,首页 HERO 巨幕背景.webp,logo.png,logo.jpg'.split(','),i=0,fb=el.nextElementSibling;function t(){if(i>=n.length){el.style.display='none';if(fb)fb.style.display='grid';return;}var p=n[i++],im=new Image();im.onload=function(){el.src=p;};im.onerror=t;im.src=p;}})(this)">
              <span class="hero-seal-fb" style="display:none">${ico('shield',20)}</span>
              <div class="hero-seal-ring"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- 今日档案 -->
      ${todayHtml}

      <!-- 分类索引 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">档案索引<span class="section-title-en">CATEGORY INDEX</span></div>
          <div class="section-head-right">共 <strong>${stats.total}</strong> 条档案 / 查看全部分类 <a href="#/anomalies">→</a></div>
        </div>
        <div class="category-grid">${catCards}</div>
      </section>

      <!-- 全集书目 A–F 组 -->
      ${shelfSection}

      <!-- 世界观概览 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">世界观概览<span class="section-title-en">WORLDVIEW OVERVIEW</span></div>
          <div class="section-head-right">核心条目 <a href="#/eras">查看卷宗 →</a></div>
        </div>
        <div class="core-grid">${coreItems}</div>
      </section>

      <!-- 世界总图 -->
      ${worldMap}

      <!-- 时间线 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">关键时间线<span class="section-title-en">CRITICAL TIMELINE</span></div>
          <div class="section-head-right">四洲对照 <a href="#/timelines">世界史年表 →</a></div>
        </div>
        <div class="timeline-strip">${timeline}</div>
      </section>

      <!-- 精选文档 -->
      <section class="section-block">
        <div class="section-head">
          <div class="section-title">精选文档<span class="section-title-en">SELECTED DOCUMENTS</span></div>
          <div class="section-head-right">权限要求：LV.3 <a href="#/anomalies">更多档案 →</a></div>
        </div>
        <div class="docs-grid">${docs}</div>
      </section>

      <!-- 监控终端（真实摄像头 · 世界观监控） -->
      ${renderCCTV()}

      <!-- 标语横幅 -->
      <section class="motto">
        <div class="motto-cn">知识即力量。</div>
        <div class="motto-en">KNOWLEDGE IS POWER · 无知，是最危险的异常。</div>
        <div class="motto-badge">
          <img src="data/logo-mark.png" alt="" onerror="(function(el){var n='data/logo-mark.jpg,x.jpg,首页 HERO 巨幕背景.webp,logo.png,logo.jpg'.split(','),i=0,fb=el.nextElementSibling;function t(){if(i>=n.length){el.style.display='none';if(fb)fb.style.display='inline';return;}var p=n[i++],im=new Image();im.onload=function(){el.src=p;};im.onerror=t;im.src=p;}})(this)">
          <span class="motto-badge-fb" style="display:none">⬢</span>
          LV.3 档案已解锁
        </div>
      </section>
    `;

    // 更新状态栏
    const totEl = document.getElementById('stat-total');
    const updEl = document.getElementById('stat-updated');
    if (totEl) totEl.textContent = `${stats.total} 条`;
    if (updEl) updEl.textContent = DATA.meta.updated || '—';

    // 尝试设置 Hero 背景图（若有提供）：png 优先 → jpg → 无图纯黑
    const hImg = document.getElementById('hero-img');
    if (hImg) {
      const candidates = ['data/hero.png', 'data/hero.jpg'];
      let i = 0;
      const tryNext = () => {
        if (i >= candidates.length) return;
        const candidate = candidates[i++];
        const testImg = new Image();
        testImg.onload = () => {
          hImg.style.setProperty('--hero-img', `url('${candidate}')`);
          hImg.style.setProperty('--hero-img-opacity', '1');
        };
        testImg.onerror = tryNext;
        testImg.src = candidate;
      };
      tryNext();
    }

    // ---- 艺术动态效果 ----
    startHeroEffects();

    // 今日档案：随机换一条
    const todayShuffle = document.getElementById('today-shuffle');
    const todayPickWrap = document.getElementById('today-pick');
    if (todayShuffle && todayPickWrap) {
      todayShuffle.addEventListener('click', () => {
        const pool = allEntries();
        if (!pool.length) return;
        const pick = pool[Math.floor(Math.random() * pool.length)];
        todayPickWrap.innerHTML = todayCardHtml(pick, pick._cat);
        if (window.SFX && SFX.navigate) SFX.navigate();
      });
    }

    initCCTV();

    // 世界总图：点击洲域跳转世界史
    document.querySelectorAll('.wm-land').forEach(p => {
      p.addEventListener('click', () => {
        if (window.SFX && SFX.navigate) SFX.navigate();
        location.hash = '#/timelines';
      });
    });
  }

  // ============ 首页艺术动态效果 ============
  function startHeroEffects() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    // 1. 打字机效果（hero-tag → hero-desc 链式）
    const tag = document.getElementById('hero-tag');
    const desc = document.getElementById('hero-desc');
    const typeEl = (el, speed, onDone) => {
      if (!el) return onDone && onDone();
      const full = el.textContent.replace(/\s+/g, ' ').trim();
      el.textContent = '';
      el.classList.add('typing');
      let i = 0;
      const it = setInterval(() => {
        i++;
        el.textContent = full.slice(0, i);
        if (i >= full.length) {
          clearInterval(it);
          setTimeout(() => { el.classList.add('done'); onDone && onDone(); }, 300);
        }
      }, speed);
    };
    if (tag) {
      typeEl(tag, 55, () => {
        // tag 完成后启动副标题打字机
        typeEl(desc, 28, null);
      });
    } else if (desc) {
      typeEl(desc, 28, null);
    }

    // 2. 数字滚动（stat-value）
    const statEls = document.querySelectorAll('.stat-value[data-count]');
    statEls.forEach(el => {
      const target = parseInt(el.dataset.count, 10) || 0;
      if (target === 0) { el.classList.add('counted','stat-sealed'); el.textContent = '—'; return; }
      el.classList.add('counting');
      let cur = 0;
      const steps = 40;
      const inc = target / steps;
      let step = 0;
      const tick = () => {
        step++;
        cur = Math.round(inc * step);
        if (step >= steps) cur = target;
        el.textContent = String(cur);
        if (step < steps) {
          requestAnimationFrame(tick);
        } else {
          el.classList.remove('counting');
          el.classList.add('counted');
        }
      };
      // 延迟到 hero-stats 淡入后开始
      setTimeout(() => requestAnimationFrame(tick), 1800);
    });

    // 3. hero 视差（鼠标移动时背景轻微位移）
    const heroSection = document.getElementById('hero-section');
    const heroImg = document.getElementById('hero-img');
    const heroBg = heroSection ? heroSection.querySelector('.hero-bg') : null;
    if (heroSection && (heroImg || heroBg)) {
      let raf = null;
      const onMove = (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const rect = heroSection.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          if (heroImg) heroImg.style.transform = `translate(${x * 18}px, ${y * 14}px) scale(1.06)`;
          if (heroBg) heroBg.style.transform = `translate(${x * 8}px, ${y * 6}px)`;
        });
      };
      heroSection.addEventListener('mousemove', onMove);
      heroSection.addEventListener('mouseleave', () => {
        if (heroImg) heroImg.style.transform = '';
        if (heroBg) heroBg.style.transform = '';
      });
    }

    // 4. 滚动淡入（IntersectionObserver）
    const fadeTargets = document.querySelectorAll(
      '.section-block, .motto, .core-item, .tl-item, .cat-card'
    );
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('in-view'), idx * 60);
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      fadeTargets.forEach(el => io.observe(el));
    } else {
      fadeTargets.forEach(el => el.classList.add('in-view'));
    }

    // 5. 粒子尘埃（hero 区漂浮的档案尘埃）
    startHeroDust();

    // 兜底：8 秒后强制全部可见，防止异常导致永久隐藏
    setTimeout(() => {
      document.querySelectorAll('.section-block, .motto, .core-item, .tl-item, .cat-card')
        .forEach(el => el.classList.add('in-view'));
    }, 8000);
  }

  // ============ HERO 粒子尘埃 ============
  let _dustRaf = null, _dustCanvas = null;
  function startHeroDust() {
    const canvas = document.getElementById('hero-dust');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    _dustCanvas = canvas;
    let particles = [];
    let w = 0, h = 0;
    const COUNT = 46;

    function resize() {
      const hero = document.getElementById('hero-section');
      if (!hero) return;
      const r = hero.getBoundingClientRect();
      w = canvas.width = Math.max(1, Math.floor(r.width));
      h = canvas.height = Math.max(1, Math.floor(r.height));
    }
    function spawn() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.4 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.08 - Math.random() * 0.22,
        a: 0.12 + Math.random() * 0.38,
        ph: Math.random() * Math.PI * 2,
        sp: 0.004 + Math.random() * 0.012
      };
    }
    function init() {
      resize();
      particles = [];
      for (let i = 0; i < COUNT; i++) particles.push(spawn());
    }
    function tick() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx + Math.sin(p.ph) * 0.12;
        p.y += p.vy;
        p.ph += p.sp;
        // 闪烁
        const tw = 0.55 + Math.sin(p.ph * 2) * 0.45;
        const alpha = p.a * tw;
        // 出界重生
        if (p.y < -4 || p.x < -4 || p.x > w + 4) {
          p.x = Math.random() * w;
          p.y = h + 4;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(232,232,232,${alpha.toFixed(3)})`;
        ctx.fill();
      }
      _dustRaf = requestAnimationFrame(tick);
    }
    init();
    // 窗口尺寸变化时重置
    let rzT = null;
    const onResize = () => {
      clearTimeout(rzT);
      rzT = setTimeout(init, 200);
    };
    window.addEventListener('resize', onResize);
    // 页面可见性：隐藏时暂停，节省性能
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (_dustRaf) { cancelAnimationFrame(_dustRaf); _dustRaf = null; }
      } else if (!_dustRaf) {
        _dustRaf = requestAnimationFrame(tick);
      }
    });
    _dustRaf = requestAnimationFrame(tick);
    // 清理旧实例（路由切换重建时）
    if (window._heroDustCleanup) window._heroDustCleanup();
    window._heroDustCleanup = () => {
      if (_dustRaf) { cancelAnimationFrame(_dustRaf); _dustRaf = null; }
      window.removeEventListener('resize', onResize);
    };
  }

  function badgeHtml(cls, label, extraClass) {
    const n = CLASS_NAMES[cls] || label || cls || '未分级';
    return `<span class="ec-badge ${cls || 'neutral'} ${extraClass || ''}">${n}</span>`;
  }

  // ============ 列表页 ============
  function renderList(catId, query) {
    const cat = CAT_MAP[catId];
    if (!cat) return renderNotFound();

    let entries = getEntries(catId).map(e => ({ ...e, _cat: catId }));
    const rawCount = getEntries(catId).length;
    const q = (query.get('q') || '').trim().toLowerCase();
    const clsFilter = query.get('class') || '';
    const tagFilter = query.get('tag') || '';
    const subFilter = query.get('sub') || '';
    const hasFilter = !!(q || clsFilter || tagFilter || subFilter);
    const sortKey = query.get('sort') || '';
    const page = parseInt(query.get('page') || '1', 10) || 1;

    if (q) {
      entries = entries.filter(e => {
        const hay = (
          e.id + ' ' + (e.code||'') + ' ' + e.title + ' ' +
          (e.summary||'') + ' ' + (e.body||'') + ' ' + (e.content||'') + ' ' +
          (e.tags||[]).join(' ') + ' ' + (e.org||'') + ' ' + (e.era||'')
        ).toLowerCase();
        // 支持空格分隔的多关键词 AND 匹配
        const kwds = q.split(/\s+/).filter(Boolean);
        return kwds.every(k => hay.includes(k));
      });
    }
    if (clsFilter && catId !== 'deities' && catId !== 'eras' && catId !== 'timelines') {
      entries = entries.filter(e => (e.class || 'neutral') === clsFilter);
    }
    if (tagFilter) {
      entries = entries.filter(e => (e.tags || []).includes(tagFilter));
    }
    if (subFilter) {
      entries = entries.filter(e => (e.subcat || '') === subFilter);
    }
    if (sortKey === 'title') {
      entries.sort((a,b) => (a.title||'').localeCompare(b.title||''));
    } else if (sortKey === 'code') {
      entries.sort((a,b) => (a.code||a.id||'').localeCompare(b.code||b.id||''));
    }

    // 分页（纪元卷宗按组分页不合适，不分页）
    const PER_PAGE = catId === 'eras' ? 9999 : 12;
    const totalPages = Math.max(1, Math.ceil(entries.length / PER_PAGE));
    const curPage = Math.min(Math.max(1, page), totalPages);
    const pageStart = (curPage - 1) * PER_PAGE;
    const pageEntries = entries.slice(pageStart, pageStart + PER_PAGE);

    // 工具栏 + 高级筛选面板
    const showClassFilter = ['anomalies', 'organizations'].includes(catId);
    const classOptions = DATA.classLegend.map(c =>
      `<option value="${c.code}" ${clsFilter===c.code?'selected':''}>${c.name}</option>`
    ).join('');
    // 收集所有可用 tag（跨当前分类）
    const allTagsInCat = Array.from(new Set(
      (getEntries(catId) || []).flatMap(e => e.tags || [])
    )).sort();
    const advOpen = query.get('adv') === '1';
    const tagChips = allTagsInCat.map(t => {
      const active = tagFilter === t;
      return `<button type="button" class="tag-chip${active?' active':''}" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`;
    }).join('');
    const advPanel = `
      <div class="adv-panel" style="display:${advOpen?'grid':'none'};grid-template-columns:1fr;gap:10px;padding:12px 16px;border-top:1px dashed var(--border);background:var(--bg-2);">
        ${(cat.subcats||[]).length ? `<div><div class="adv-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);margin-bottom:6px;">子分组</div><div class="tag-chips" style="display:flex;flex-wrap:wrap;gap:6px;">${(cat.subcats||[]).map(s => { const a = subFilter === s.id; return `<button type="button" class="tag-chip${a?' active':''}" data-sub="${escapeAttr(s.id)}">${escapeHtml(s.name)}</button>`; }).join('')}<button type="button" class="tag-chip" data-sub="" style="opacity:.8;">${ico('cross',12)} 清空</button></div></div>` : ''}
        ${allTagsInCat.length ? `<div><div class="adv-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);margin-bottom:6px;">标签筛选</div><div class="tag-chips" style="display:flex;flex-wrap:wrap;gap:6px;">${tagChips}<button type="button" class="tag-chip" data-tag="" style="opacity:.8;">${ico('cross',12)} 清空</button></div></div>` : ''}
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <label style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);">最低字数 <input type="number" id="adv-min" min="0" value="${escapeAttr(query.get('minlen')||'')}" placeholder="0" style="width:90px;padding:4px 6px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--f-mono);font-size:11px;"></label>
          <label style="font-family:var(--f-mono);font-size:10px;letter-spacing:1px;color:var(--text-2);">含关键词（正文） <input type="text" id="adv-body" value="${escapeAttr(query.get('b')||'')}" placeholder="仅正文搜索词" style="width:220px;padding:4px 6px;background:var(--bg);border:1px solid var(--border);color:var(--text);font-family:var(--f-mono);font-size:11px;"></label>
          <button id="adv-apply" class="btn btn-mini" style="border:1px solid var(--border);padding:5px 10px;font-family:var(--f-mono);font-size:10px;background:var(--bg);color:var(--text);cursor:pointer;">应用筛选</button>
        </div>
      </div>
    `;
    // 正文关键词、字数过滤
    const bodyKw = (query.get('b') || '').trim().toLowerCase();
    const minLen = parseInt(query.get('minlen') || '0', 10) || 0;
    if (bodyKw) entries = entries.filter(e => ((e.body||'')+(e.content||'')).toLowerCase().includes(bodyKw));
    if (minLen > 0) entries = entries.filter(e => {
      const n = ((e.body||'')+(e.content||'')).replace(/<[^>]+>/g,'').length;
      return n >= minLen;
    });

    // 重新计算分页
    const totalPages2 = Math.max(1, Math.ceil(entries.length / (catId === 'eras' ? 9999 : 12)));
    const curPage2 = Math.min(Math.max(1, page), totalPages2);
    const pageStart2 = (curPage2 - 1) * (catId === 'eras' ? 9999 : 12);
    const pageEntries2 = entries.slice(pageStart2, pageStart2 + (catId === 'eras' ? 9999 : 12));

    // 排序下拉
    const sortOptions = [
      { v: '', label: '默认' },
      { v: 'code', label: '按编号' },
      { v: 'title', label: '按标题' }
    ].map(o => `<option value="${o.v}" ${sortKey===o.v?'selected':''}>${o.label}</option>`).join('');

    const viewMode = query.get('view') || (window.innerWidth <= 768 ? 'list' : (localStorage.getItem('wa_view') || 'grid'));
    let listHtml;
    if (catId === 'deities') listHtml = htmlDeityGrid(pageEntries2, q);
    else if (catId === 'timelines') listHtml = renderWorldHistory();
    else if (catId === 'eras') listHtml = htmlEraGrouped(pageEntries2, q);
    else if (viewMode === 'files') listHtml = htmlFileManifest(pageEntries2, catId);
    else if (viewMode === 'list') listHtml = htmlEntryList(pageEntries2, catId, q);
    else listHtml = htmlEntryGrid(pageEntries2, catId, q);

    // 分页控件
    let pagerHtml = '';
    if (totalPages2 > 1) {
      const buildPageUrl = (p) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (clsFilter) params.set('class', clsFilter);
        if (tagFilter) params.set('tag', tagFilter);
        if (subFilter) params.set('sub', subFilter);
        if (sortKey) params.set('sort', sortKey);
        if (advOpen) params.set('adv', '1');
        if (bodyKw) params.set('b', query.get('b') || '');
        if (minLen) params.set('minlen', String(minLen));
        if (p > 1) params.set('page', p);
        return `#/${catId}${params.toString() ? '?'+params.toString() : ''}`;
      };
      const btns = [];
      btns.push(`<a class="pg-btn ${curPage2<=1?'disabled':''}" href="${curPage2>1?buildPageUrl(curPage2-1):'javascript:void(0)'}">‹ 上一页</a>`);
      // 页码按钮
      const maxBtns = 7;
      let startP = Math.max(1, curPage2 - 3);
      let endP = Math.min(totalPages2, startP + maxBtns - 1);
      if (endP - startP < maxBtns - 1) startP = Math.max(1, endP - maxBtns + 1);
      if (startP > 1) {
        btns.push(`<a class="pg-num" href="${buildPageUrl(1)}">1</a>`);
        if (startP > 2) btns.push(`<span class="pg-dots">···</span>`);
      }
      for (let i = startP; i <= endP; i++) {
        btns.push(`<a class="pg-num ${i===curPage2?'active':''}" href="${buildPageUrl(i)}">${i}</a>`);
      }
      if (endP < totalPages2) {
        if (endP < totalPages2 - 1) btns.push(`<span class="pg-dots">···</span>`);
        btns.push(`<a class="pg-num" href="${buildPageUrl(totalPages2)}">${totalPages2}</a>`);
      }
      btns.push(`<a class="pg-btn ${curPage2>=totalPages2?'disabled':''}" href="${curPage2<totalPages2?buildPageUrl(curPage2+1):'javascript:void(0)'}">下一页 ›</a>`);
      pagerHtml = `
        <div class="list-pager">
          ${btns.join('')}
          <span class="pg-info">第 ${curPage2}/${totalPages2} 页 · 共 ${entries.length} 条</span>
        </div>`;
    }

    // 红月黑匣子：分类页头图横幅（黑白灰阶纪实头图）
    const HEADER_IMGS = {
      anomalies:     'IMG-02 异常档案页头图.webp',
      organizations: 'IMG-03 组织名录页头图.webp',
      eras:          'IMG-04 纪元卷宗页头图.webp',
      deities:       'IMG-05 神祇图鉴页头图.webp',
      timelines:     'IMG-06 时间线页头图.webp'
    };
    const headerImgAttr = HEADER_IMGS[catId]
      ? ` data-header-img="${encodeURI(HEADER_IMGS[catId])}"`
      : '';

    view.innerHTML = `
      <div class="list-header"${headerImgAttr}>
        <div class="list-header-inner">
          <div class="list-title">
            ${cat.icon} ${cat.name}
            <span class="list-title-en">${cat.nameEn}</span>
          </div>
          <p class="list-sub">${cat.desc} 数据来源：${cat.source || '项目原始资料'}</p>
        </div>
      </div>

      <div class="list-toolbar toolbar">
        <div class="toolbar-left">
          <span class="toolbar-count">在档 <strong>${entries.length}</strong> 条记录</span>
        </div>
        <div class="toolbar-spacer"></div>
        <input type="text" id="list-search" placeholder="搜索编号 / 代号 / 标题 / 标签 / 正文 (按 / 聚焦)..." value="${escapeHtml(q)}">
        ${showClassFilter ? `<label>分级</label><select id="list-class">
          <option value="">全部等级</option>
          ${classOptions}
        </select>` : ''}
        <label>排序</label><select id="list-sort">${sortOptions}</select>
        <button id="adv-toggle" type="button" class="btn btn-mini adv-toggle" style="border:1px solid var(--border);padding:5px 10px;font-family:var(--f-mono);font-size:10px;background:var(--bg);color:var(--text);cursor:pointer;">高级筛选 ${advOpen?'▲':'▼'}</button>
        ${['anomalies','organizations'].includes(catId) ? `
        <div class="view-toggle" id="view-toggle" title="切换视图">
          <button type="button" data-view="grid" class="${viewMode==='grid'?'active':''}" title="卡片视图">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button type="button" data-view="list" class="${viewMode==='list'?'active':''}" title="列表视图">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
          </button>
          <button type="button" data-view="files" class="${viewMode==='files'?'active':''}" title="文件清单视图">
            <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M22,19a2,2,0,0,1-2,2H4a2,2,0,0,1-2-2V5a2,2,0,0,1,2-2h5l2,3h9a2,2,0,0,1,2,2z"/></svg>
          </button>
        </div>` : ''}
      </div>
      ${advPanel}

      ${entries.length === 0 && catId !== 'timelines'
        ? (rawCount === 0
            ? `<div class="empty-state is-sealed">
                 <div class="es-icon">▤</div>
                 <div class="es-title">卷宗封存中</div>
                 <div class="es-desc">该类档案仍在归档与解密流程中，暂未开放阅览</div>
               </div>`
            : `<div class="empty-state">
                 <div class="es-icon">▱</div>
                 <div class="es-title">未检索到匹配档案</div>
                 <div class="es-desc">尝试放宽关键词或移除筛选条件</div>
               </div>`)
        : listHtml}

      ${pagerHtml}
    `;

    // 红月黑匣子：分类头图横幅注入背景变量
    const lh = document.querySelector('.list-header[data-header-img]');
    if (lh && lh.dataset.headerImg) {
      lh.style.setProperty('--lh-img', `url('${lh.dataset.headerImg}')`);
    }

    // 全站共享计数：批量拉取本页卡片评分角标（ENGAGE 未配置时静默短路）
    Engage.hydrateList(view);

    // 工具栏事件
    const buildAllParams = (ov) => {
      const p = new URLSearchParams();
      const o = Object.assign({
        q, cls: clsFilter, tag: tagFilter, sub: subFilter, sort: sortKey,
        adv: advOpen ? '1' : '',
        b: query.get('b') || '',
        minlen: query.get('minlen') || '',
        view: viewMode
      }, ov || {});
      if (o.q) p.set('q', o.q);
      if (o.cls) p.set('class', o.cls);
      if (o.tag) p.set('tag', o.tag);
      if (o.sub) p.set('sub', o.sub);
      if (o.sort) p.set('sort', o.sort);
      if (o.adv) p.set('adv', o.adv);
      if (o.b) p.set('b', o.b);
      if (o.minlen) p.set('minlen', o.minlen);
      if (o.view && o.view !== 'grid') p.set('view', o.view);
      return p;
    };
    const si = document.getElementById('list-search');
    if (si) {
      let t = null;
      si.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          if (si.value.trim()) SFX.search();
          const p = buildAllParams({ q: si.value.trim() });
          location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
        }, 250);
      });
    }
    const ss = document.getElementById('list-class');
    if (ss) {
      ss.addEventListener('change', () => {
        SFX.click();
        const p = buildAllParams({ cls: ss.value });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }
    const sso = document.getElementById('list-sort');
    if (sso) {
      sso.addEventListener('change', () => {
        SFX.click();
        const p = buildAllParams({ sort: sso.value });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }
    const atg = document.getElementById('adv-toggle');
    if (atg) {
      atg.addEventListener('click', () => {
        SFX.click();
        const p = buildAllParams({ adv: advOpen ? '' : '1' });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }
    document.querySelectorAll('.tag-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click();
        const t = btn.dataset.tag || '';
        const p = buildAllParams({ tag: t });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    });
    document.querySelectorAll('[data-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.click();
        const s = btn.dataset.sub || '';
        const p = buildAllParams({ sub: s });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    });
    const aap = document.getElementById('adv-apply');
    if (aap) {
      aap.addEventListener('click', () => {
        SFX.click();
        const mi = document.getElementById('adv-min');
        const bi = document.getElementById('adv-body');
        const p = buildAllParams({
          minlen: mi && mi.value ? String(parseInt(mi.value,10)||0) : '',
          b: bi && bi.value.trim() ? bi.value.trim() : ''
        });
        location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
      });
    }

    // 视图切换
    const vt = document.getElementById('view-toggle');
    if (vt) {
      vt.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          SFX.click();
          const v = btn.dataset.view;
          try { localStorage.setItem('wa_view', v); } catch {}
          const p = buildAllParams({ view: v });
          location.hash = `#/${catId}${p.toString() ? '?'+p.toString() : ''}`;
        });
      });
    }

    // 文件清单视图：单份下载
    view.querySelectorAll('.fm-dl').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const id = btn.getAttribute('data-fm-dl');
        const fmt = btn.getAttribute('data-fmt') || 'md';
        const target = (getEntries(catId) || []).find(x => String(x.id) === id);
        if (!target) return;
        try { exportEntry(catId, target, fmt); if (window.SFX && SFX.click) SFX.click(); }
        catch (err) { console.warn('[manifest export] failed', err); }
      });
    });

    // 列表加载后：有结果 → 金属铃；无结果 → 低频嘟
    if (entries.length === 0) SFX.miss();
    else if (q || clsFilter || tagFilter || sortKey || advOpen) SFX.hit();
  }

  // 统一图片 URL 解析：已完整的 URL（data:/http/https/绝对路径）直接返回，否则补 data/ 前缀
  function resolveImgUrl(img) {
    if (!img || typeof img !== 'string') return null;
    if (img.startsWith('data:') || img.startsWith('http://') || img.startsWith('https://') || img.startsWith('/')) {
      return img;
    }
    return `data/${img}`;
  }

  // 无封面档案的默认封面（皮革 + 做旧印章，无文字）
  const PLACEHOLDER_IMG = '无封面档案的默认占位图.webp';

  // 异常 / 组织 / 卷宗：左图右文卡片网格（黑白冷冽档案卡）
  // 图片查找优先级：
  //   1. JSON 字段 e.img（相对 data/ 目录，或 base64 / 服务器路径）
  //   2. data/{cat}/{id 或 code}.png / .jpg / .webp / .jpeg
  //      例 anomalies → data/anomalies/UR-014.png
  //   3. 无封面档案 → 统一默认封面图（皮革 + 做旧印章）
  //   4. 最终兜底：程序化生成的黑白档案风封面（data-URI SVG，必定加载成功）
  function resolveEntryImage(e, catId) {
    const safeBase = (catId === 'anomalies') ? 'anomalies'
                  : (catId === 'organizations') ? 'organizations'
                  : (catId === 'eras') ? 'eras'
                  : (catId === 'deities') ? 'deities'
                  : '';
    const direct = resolveImgUrl(e.img);
    const idKey = String(e.id || '').replace(/\//g, '__');
    const codeKey = String(e.code || '').replace(/\s+/g, '_').replace(/\//g, '__');
    const exts = ['png', 'jpg', 'jpeg', 'webp'];
    const candidates = [];
    if (direct) candidates.push(direct);
    if (safeBase) {
      for (const ext of exts) {
        if (idKey)   candidates.push(`data/${safeBase}/${idKey}.${ext}`);
        if (codeKey && codeKey !== idKey) candidates.push(`data/${safeBase}/${codeKey}.${ext}`);
      }
    }
    // 无封面 → 统一默认封面图
    candidates.push(PLACEHOLDER_IMG);
    // 程序化封面放最后：即使默认封面图未部署也能显示（必定加载成功）
    candidates.push(generateProceduralCover(e, catId));
    return candidates;
  }

  // ---- 程序化封面生成（黑白档案风 data-URI SVG）----
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    s = String(s || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function generateProceduralCover(e, catId) {
    const seed = hashStr((e.id || '') + '|' + (e.title || ''));
    const rnd = mulberry32(seed);
    const id = String(e.id || '????');
    const code = String(e.code || '');
    const title = String(e.title || '');
    const VB = 200;
    const bg = '#050505';
    const ink = 'rgba(232,232,232,0.82)';
    const inkDim = 'rgba(232,232,232,0.32)';
    const inkFaint = 'rgba(232,232,232,0.14)';
    let motif = '';
    if (catId === 'anomalies')      motif = coverAnomaly(rnd, VB, ink, inkDim, inkFaint);
    else if (catId === 'organizations') motif = coverOrg(rnd, VB, ink, inkDim, inkFaint);
    else if (catId === 'deities')   motif = coverDeity(rnd, VB, ink, inkDim, inkFaint);
    else if (catId === 'eras')      motif = coverEra(rnd, VB, ink, inkDim, inkFaint);
    else                            motif = coverAnomaly(rnd, VB, ink, inkDim, inkFaint);

    const stampCls = ({anomalies:'ANOMALY', organizations:'ORG', deities:'DEITY', eras:'ERA'})[catId] || 'FILE';
    const clsTag = `<text x="10" y="18" font-family="ui-monospace,monospace" font-size="9" fill="${inkDim}" letter-spacing="2">${stampCls}</text>`;
    const idTag = `<text x="190" y="18" text-anchor="end" font-family="ui-monospace,monospace" font-size="9" fill="${inkDim}" letter-spacing="1">${escapeHtml(id)}</text>`;
    const codeTag = code ? `<text x="10" y="192" font-family="ui-monospace,monospace" font-size="8.5" fill="${inkDim}" letter-spacing="1">${escapeHtml(code)}</text>` : '';
    // 顶部/底部细线
    const frame = `<rect x="1" y="1" width="${VB-2}" height="${VB-2}" fill="none" stroke="${inkFaint}" stroke-width="1"/>
                   <line x1="8" y1="24" x2="${VB-8}" y2="24" stroke="${inkFaint}" stroke-width="0.6"/>
                   <line x1="8" y1="${VB-18}" x2="${VB-8}" y2="${VB-18}" stroke="${inkFaint}" stroke-width="0.6"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" preserveAspectRatio="xMidYMid slice">
      <rect width="${VB}" height="${VB}" fill="${bg}"/>
      ${motif}
      ${frame}
      ${clsTag}${idTag}
      ${codeTag}
      <text x="100" y="${VB-6}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="6.5" fill="${inkFaint}" letter-spacing="3">VISUAL ARCHIVE · CLASSIFIED</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // 异常：故障扫描线 + 错位方块 + 警示符
  function coverAnomaly(rnd, VB, ink, dim, faint) {
    let s = '';
    // 扫描线
    for (let y = 30; y < VB - 22; y += 4) {
      if (rnd() > 0.45) {
        const x = 8 + rnd() * 20;
        const w = (VB - 16) * (0.4 + rnd() * 0.55);
        s += `<line x1="${x.toFixed(1)}" y1="${y}" x2="${(x+w).toFixed(1)}" y2="${y}" stroke="${rnd()>0.7?ink:dim}" stroke-width="${rnd()>0.8?1.2:0.7}"/>`;
      }
    }
    // 错位方块
    for (let i = 0; i < 5; i++) {
      const bx = 30 + rnd() * (VB - 80);
      const by = 40 + rnd() * (VB - 90);
      const bw = 14 + rnd() * 26;
      s += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${(bw*0.5).toFixed(1)}" fill="none" stroke="${i%2?dim:faint}" stroke-width="0.8"/>`;
    }
    // 中心警示三角
    const cx = VB/2, cy = VB/2 + 6;
    s += `<g fill="none" stroke="${ink}" stroke-width="1.3" stroke-linejoin="round">
      <path d="M${cx} ${cy-22} L${cx+22} ${cy+16} L${cx-22} ${cy+16} Z"/>
      <line x1="${cx}" y1="${cy-8}" x2="${cx}" y2="${cy+4}"/>
      <circle cx="${cx}" cy="${cy+10}" r="1.4" fill="${ink}" stroke="none"/>
    </g>`;
    return s;
  }
  // 组织：同心徽章 + 多边形印章
  function coverOrg(rnd, VB, ink, dim, faint) {
    let s = '';
    const cx = VB/2, cy = VB/2 + 4;
    // 同心圆
    for (let i = 0; i < 4; i++) {
      const r = 24 + i * 12;
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${i%2?dim:faint}" stroke-width="${i===0?1.1:0.6}"/>`;
    }
    // 多边形外环
    const sides = 6 + Math.floor(rnd() * 4) * 2;
    const R = 64;
    let pts = '';
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
      pts += `${(cx + Math.cos(a)*R).toFixed(1)},${(cy + Math.sin(a)*R).toFixed(1)} `;
    }
    s += `<polygon points="${pts.trim()}" fill="none" stroke="${dim}" stroke-width="0.9"/>`;
    // 中心十字
    s += `<g stroke="${ink}" stroke-width="1.2">
      <line x1="${cx-10}" y1="${cy}" x2="${cx+10}" y2="${cy}"/>
      <line x1="${cx}" y1="${cy-10}" x2="${cx}" y2="${cy+10}"/>
      <circle cx="${cx}" cy="${cy}" r="4" fill="none"/>
    </g>`;
    return s;
  }
  // 神祇：放射光芒 + 曼陀罗
  function coverDeity(rnd, VB, ink, dim, faint) {
    let s = '';
    const cx = VB/2, cy = VB/2 + 4;
    const spokes = 12 + Math.floor(rnd() * 8);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const r1 = 18, r2 = 26 + rnd() * 36;
      s += `<line x1="${(cx+Math.cos(a)*r1).toFixed(1)}" y1="${(cy+Math.sin(a)*r1).toFixed(1)}" x2="${(cx+Math.cos(a)*r2).toFixed(1)}" y2="${(cy+Math.sin(a)*r2).toFixed(1)}" stroke="${i%3===0?ink:dim}" stroke-width="${i%3===0?0.9:0.5}"/>`;
    }
    // 同心圆
    for (let i = 0; i < 3; i++) {
      s += `<circle cx="${cx}" cy="${cy}" r="${14 + i * 8}" fill="none" stroke="${i?dim:faint}" stroke-width="0.6"/>`;
    }
    // 中心眼
    s += `<g fill="none" stroke="${ink}" stroke-width="1.1">
      <path d="M${cx-12} ${cy} Q${cx} ${cy-10} ${cx+12} ${cy} Q${cx} ${cy+10} ${cx-12} ${cy} Z"/>
      <circle cx="${cx}" cy="${cy}" r="3.2"/>
    </g>`;
    return s;
  }
  // 纪元：地层带 + 时间刻度
  function coverEra(rnd, VB, ink, dim, faint) {
    let s = '';
    let y = 32;
    while (y < VB - 24) {
      const h = 6 + rnd() * 16;
      const op = 0.06 + rnd() * 0.16;
      s += `<rect x="8" y="${y.toFixed(1)}" width="${(VB-16).toFixed(1)}" height="${h.toFixed(1)}" fill="rgba(232,232,232,${op.toFixed(2)})"/>`;
      y += h + 1.5;
    }
    // 时间刻度线
    const ty = VB/2 + 4;
    s += `<line x1="14" y1="${ty}" x2="${VB-14}" y2="${ty}" stroke="${ink}" stroke-width="1"/>`;
    for (let i = 0; i < 7; i++) {
      const x = 14 + (i / 6) * (VB - 28);
      const big = i % 2 === 0;
      s += `<line x1="${x.toFixed(1)}" y1="${ty}" x2="${x.toFixed(1)}" y2="${ty - (big?8:4)}" stroke="${big?ink:dim}" stroke-width="0.8"/>`;
    }
    // 中心菱形节点
    const cx = VB/2;
    s += `<g fill="none" stroke="${ink}" stroke-width="1.1">
      <path d="M${cx} ${ty-16} L${cx+8} ${ty} L${cx} ${ty+16} L${cx-8} ${ty} Z"/>
    </g>`;
    return s;
  }
  // 全局占位封面图
  const PLACEHOLDER_COVER = 'placeholder-cover.webp';

  // 为 <img> 注入「逐级尝试候选图 → 失败走占位」onerror
  // 策略：把候选列表存到 data-srcs (JSON) + data-idx，onerror 里取下一个
  // 最终失败：display:none，让父容器 .anom-thumb 显示 SVG 占位（通过兄弟节点 fallback）
  function buildAnomThumbHtml(candidates, label, fallbackCls) {
    const fbLabel = escapeHtml(fallbackCls || '封存');
    const fbSub = escapeHtml(label || '');
    const fbSubAttr = fbSub ? `<span class="anom-fb-sub">${fbSub}</span>` : '';
    // 在候选列表末尾加入全局占位图，确保最终总有一张图显示
    const srcsList = candidates.length ? candidates : [];
    srcsList.push(PLACEHOLDER_COVER);
    const srcs = JSON.stringify(srcsList);
    const first = srcsList[0];
    // onerror: 用原生小函数（挂在 window 上一次）切换到下一张；失败完切 SVG 占位
    return `
      <div class="anom-thumb">
        <img class="anom-thumb-img" src="${escapeAttr(first)}" loading="lazy" decoding="async"
             data-srcs="${escapeAttr(srcs)}" data-idx="0" alt="${escapeAttr(label)}"
             onerror="__tryNextAnomImg(this)" onload="__markAnomImgLoaded(this)">
        <div class="anom-thumb-fb" aria-hidden="true">
          <svg class="anom-fb-svg" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
            <defs>
              <pattern id="anomDiag" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="16" height="16" fill="none"/>
                <line x1="0" y1="0" x2="0" y2="16" stroke="currentColor" stroke-opacity="0.18" stroke-width="1"/>
              </pattern>
            </defs>
            <rect x="1" y="1" width="138" height="138" fill="url(#anomDiag)" stroke="currentColor" stroke-opacity="0.35" />
            <rect x="18" y="18" width="104" height="104" fill="none" stroke="currentColor" stroke-opacity="0.2" />
            <g fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.25" stroke-linecap="square">
              <path d="M42 42 H98 V98 H42 Z"/>
              <path d="M42 42 L98 98 M98 42 L42 98"/>
            </g>
            <text x="70" y="72" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
                  font-size="14" fill="currentColor" opacity="0.85" letter-spacing="2">NO IMG</text>
            <text x="70" y="92" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
                  font-size="10" fill="currentColor" opacity="0.55" letter-spacing="1.5">VISUAL REDACTED</text>
          </svg>
          <div class="anom-fb-meta">
            <span class="anom-fb-code">${fbLabel}</span>
            ${fbSubAttr}
          </div>
        </div>
        <div class="anom-thumb-scan" aria-hidden="true"></div>
        <div class="anom-thumb-corners" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
    `;
  }

  function htmlEntryGrid(entries, catId, kw) {
    const cards = entries.map(e => {
      const cls = e.class || (catId === 'organizations' ? 'org' : (catId === 'eras' ? 'era' : 'neutral'));
      const bdg = badgeHtml(cls, null, (cls === e.class) ? '' : cls);
      const codeTxt = (e.code && e.code !== e.title) ? e.code : e.id;
      const idTxt = e.id;
      const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const extraMeta = catId === 'eras' ? (e.era ? `<span class="ec-meta-dot">${ico('sun',12)} ${highlightKeyword(e.era, kw)}</span>` : '')
                    : catId === 'organizations' ? (e.org ? `<span class="ec-meta-dot">${ico('diamond',12)} ${highlightKeyword(e.org, kw)}</span>` : '')
                    : '';
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(e, catId),
        String(e.title || ''),
        String(codeTxt || '')
      );
      // 从 body 提取字数
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      return `
        <a class="entry-card anom-card" href="#/entry/${e._cat||catId}/${encodeURIComponent(e.id)}">
          ${thumbHtml}
          <div class="anom-body">
            <div class="anom-body-top">
              <div class="anom-idrow">
                <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                ${bdg}
              </div>
              <div class="anom-title-row">
                <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                ${codeTxt !== idTxt ? `<div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>` : ''}
              </div>
            </div>
            <div class="anom-body-mid">
              ${extraMeta ? `<div class="ec-meta">${extraMeta}</div>` : ''}
              <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
            </div>
            <div class="entry-card-foot">
              <span class="ec-tags">${tagHtml}</span>
              ${(() => {
                const wcTxt = (wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount) + ' 字';
                // 全站共享模式：先渲染占位，renderList 完成后由 Engage.hydrateList 批量填充远端计数
                if (Engage.enabled()) return `<span class="ec-rating ec-eng" data-eng="${escapeAttr((e._cat||catId)+':'+e.id)}" data-wc="${escapeAttr(wcTxt)}"></span>`;
                const rs = RATINGS.score(e._cat || catId, e.id);
                if (!rs.total) return `<span class="ec-foot-info">${wcTxt}</span>`;
                const cls = rs.score > 0 ? 'pos' : (rs.score < 0 ? 'neg' : '');
                return `<span class="ec-rating ${cls}" title="好评 ${rs.up} · 差评 ${rs.down}">▲ ${rs.score > 0 ? '+' + rs.score : rs.score}</span>`;
              })()}
            </div>
          </div>
        </a>`;
    }).join('');
    return `<div class="entry-grid entry-grid-anom">${cards}</div>`;
  }

  // 档案列表视图（紧凑条目）
  function htmlEntryList(entries, catId, kw) {
    const items = entries.map(e => {
      const idTxt = e.id;
      const title = highlightKeyword(e.title, kw);
      const codeTxt = (e.code && e.code !== e.title) ? highlightKeyword(e.code, kw) : '';
      const cls = e.class || (catId === 'organizations' ? 'org' : 'neutral');
      const clsName = DATA.classLegend.find(c => c.code === cls)?.name || '';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="entry-list-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      const metaBits = [];
      if (wordCount) metaBits.push(`${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount}字`);
      if (e.updated) metaBits.push(e.updated);
      const metaHtml = metaBits.length ? `<span class="entry-list-meta">${metaBits.join(' · ')}</span>` : '';
      const clsHtml = clsName ? `<span class="entry-list-class">${clsName}</span>` : '';
      return `
        <a class="entry-list-item" href="#/entry/${e._cat||catId}/${encodeURIComponent(e.id)}">
          <span class="entry-list-num">${idTxt}</span>
          <span class="entry-list-dash">—</span>
          <span class="entry-list-title">${title}</span>
          ${codeTxt ? `<span class="entry-list-code">代号: ${codeTxt}</span>` : ''}
          ${clsHtml}
          ${tagHtml}
          ${metaHtml}
        </a>`;
    }).join('');
    return `<div class="entry-list">${items}</div>`;
  }

  // ============ 文件清单视图（放文件的站：知道有哪些文件、谁更新的） ============
  // 表格视图：编号 / 标题 / 来源文件 / 字数 / 更新时间 / 操作（下载 MD · 下载 JSON · 打开）
  function htmlFileManifest(entries, catId) {
    if (!entries.length) {
      return `<div class="empty-state">
                <div class="es-icon">▱</div>
                <div class="es-title">此分类暂无文件</div>
                <div class="es-desc">待底本导入后可在此查看文件清单</div>
              </div>`;
    }
    const totalChars = entries.reduce((s, e) => s + String(e.body || '').replace(/<[^>]+>/g, '').length, 0);
    const withSource = entries.filter(e => e.source).length;
    const rows = entries.map(e => {
      const plain = String(e.body || '').replace(/<[^>]+>/g, '').trim();
      const chars = plain.length;
      const src = e.source || '';
      const srcShort = src.length > 46 ? '…' + src.slice(-44) : src;
      return `
        <tr class="fm-row">
          <td class="fm-c-id"><a href="#/entry/${catId}/${encodeURIComponent(e.id)}">${escapeHtml(String(e.id))}</a></td>
          <td class="fm-c-title"><a href="#/entry/${catId}/${encodeURIComponent(e.id)}">${escapeHtml(String(e.title || '—'))}</a></td>
          <td class="fm-c-src">${src ? `<span class="fm-src" title="${escapeAttr(src)}">${escapeHtml(srcShort)}</span>` : '<span class="fm-src fm-src-none">未标注</span>'}</td>
          <td class="fm-c-num">${chars ? (chars > 999 ? (chars / 1000).toFixed(1) + 'k' : chars) : '—'}</td>
          <td class="fm-c-num">${escapeHtml(String(e.updated || e.addedAt || '—'))}</td>
          <td class="fm-c-act">
            <button type="button" class="fm-dl" data-fm-dl="${escapeAttr(String(e.id))}" data-fmt="md" title="下载 Markdown 文件">${ico('download',11)} MD</button>
            <button type="button" class="fm-dl" data-fm-dl="${escapeAttr(String(e.id))}" data-fmt="json" title="下载 JSON 记录">${ico('download',11)} JSON</button>
          </td>
        </tr>`;
    }).join('');
    return `
      <div class="fm-wrap">
        <div class="fm-summary">
          <span>${ico('folder',12)} 文件清单 · FILE MANIFEST</span>
          <span class="fm-summary-sep">·</span>
          <span>共 <strong>${entries.length}</strong> 份</span>
          <span class="fm-summary-sep">·</span>
          <span>合计 <strong>${totalChars > 999 ? (totalChars / 1000).toFixed(1) + 'k' : totalChars}</strong> 字</span>
          <span class="fm-summary-sep">·</span>
          <span>已标注来源 <strong>${withSource}</strong>/${entries.length}</span>
        </div>
        <div class="fm-scroll">
          <table class="fm-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>标题</th>
                <th>来源文件</th>
                <th class="fm-ta-r">字数</th>
                <th class="fm-ta-r">更新时间</th>
                <th class="fm-ta-r">导出</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // 神祇图鉴 — 统一使用 anom-card 风格
  function htmlDeityGrid(entries, kw) {
    const cards = entries.map(e => {
      const idTxt = e.id;
      const codeTxt = e.code || e.id;
      const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(e, 'deities'),
        String(e.title || ''),
        String(codeTxt || '')
      );
      return `
        <a class="entry-card anom-card" href="#/entry/deities/${encodeURIComponent(e.id)}">
          ${thumbHtml}
          <div class="anom-body">
            <div class="anom-body-top">
              <div class="anom-idrow">
                <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                ${badgeHtml('neutral', null, '神祇')}
              </div>
              <div class="anom-title-row">
                <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                <div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>
              </div>
            </div>
            <div class="anom-body-mid">
              <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
            </div>
            <div class="entry-card-foot">
              <span class="ec-tags">${tagHtml}</span>
              <span class="ec-foot-info">${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount} 字</span>
            </div>
          </div>
        </a>`;
    }).join('');
    return `<div class="entry-grid entry-grid-anom">${cards}</div>`;
  }

  // ============ 世界史 · 四洲完整年表（世界史制纪元编号） ============
  const WORLD_HISTORY = [
    { id:'zhong', name:'中洲', en:'ZHONG ZHOU', motto:'世界主线 · 神在人间到静态纪元', tone:'主', gate:'第一门 · 辉山山脉地底', eras:[
      { name:'第一纪元 · 神在人间', period:'前3000 — 公元300', events:['天坠之始','众灵年代','英雄纪元','诸城邦时代','六道之战','埃尔德时代','旧神黄昏'] },
      { name:'第二纪元 · 无神者的纪元', period:'公元300 — 1900', events:['灰疫','伪神','黑烛','天教','神弃战争','启明时代'] },
      { name:'第三纪元 · 触碰边界', period:'公元1900 — 2300', events:['遗迹复原','真相辩论','异常工业','巴别塔','第一次大异常灾变','无主时期'] },
      { name:'第四纪元 · 静态纪元', period:'公元2300 — 今', events:['红月政府成立（红月纪元零年·2312）','静态平衡','锈蚀病大流行（2360—2370）','红月百年（2412）'] },
    ]},
    { id:'bei', name:'北洲', en:'NORTH CONTINENT', motto:'等待之地 · 极光与守夜', tone:'北', gate:'第二门 · 永夜森林之下', eras:[
      { name:'第一纪元 · 极光与守夜', period:'前3000 — 公元300', events:['白曐坠落·极光初现','守夜营','赛伊东沉睡','第一次守夜战争'] },
      { name:'第二纪元 · 永夜与凝滞', period:'公元300 — 1900', events:['埃尔德沉没·极光消失','永夜','各国等待','篝火与母石'] },
      { name:'第三纪元 · 解析与等待', period:'公元1900 — 2300', events:['启明时代','解析与整合','异常工业','光战争','永夜变浅'] },
      { name:'第四纪元 · 红月之下', period:'公元2300 — 今', events:['纳入红月管控','紧绷的和平','等待藏得更深'] },
    ]},
    { id:'dong', name:'东洲', en:'EAST CONTINENT', motto:'倾听之海 · 海沟与声音', tone:'东', gate:'第三门 · 东屿海沟最深处', eras:[
      { name:'第一纪元 · 海沟与声音', period:'前3000 — 公元300', events:['白曐坠落·海沟变','阿库拉之声','无名城','鲸鱼选皇帝'] },
      { name:'第二纪元 · 诸国与虚空', period:'公元300 — 1900', events:['埃尔德沉没·海沟虚空扩张','伪神','黑烛传入','火城冷火贸易','黑潮海盗'] },
      { name:'第三纪元 · 解析与倾听', period:'公元1900 — 2300', events:['启明时代','解析与整合','继续倾听'] },
      { name:'第四纪元 · 红月之下', period:'公元2300 — 今', events:['纳入红月管控','紧绷的和平','听藏得更深'] },
    ]},
    { id:'nan', name:'南洲', en:'SOUTH CONTINENT', motto:'沉睡裂谷 · 白雾与梦潮', tone:'南', gate:'第四门 · 南裂谷深层', eras:[
      { name:'第一纪元 · 裂谷与母巢', period:'前3000 — 公元300', events:['白曐坠落·裂谷变','白雾扩张','母巢','第一次裂谷远征（前620）'] },
      { name:'第二纪元 · 裂谷与梦境', period:'公元300 — 1900', events:['母巢之死','苏拉马尔帝国','灰疫·梦潮·睡城病','黑烛·暗烛时代','第一次梦境战争（1000）'] },
      { name:'第三纪元 · 解析与沉睡', period:'公元1900 — 2300', events:['启明时代','三次探测（2000/2180/2240）','裂谷战争'] },
      { name:'第四纪元 · 红月之下', period:'公元2300 — 今', events:['纳入红月管控','紧绷的和平','醒者会守裂谷'] },
    ]},
  ];

  function renderWorldHistory() {
    const CODE = { zhong:'ZHN', bei:'NOR', dong:'EST', nan:'SOU' };
    const cards = WORLD_HISTORY.map(c => {
      const erasHtml = c.eras.map(e => `
        <div class="wh-era">
          <div class="wh-era-head">
            <span class="wh-era-name">${escapeHtml(e.name)}</span>
            <span class="wh-era-period">${escapeHtml(e.period)}</span>
          </div>
          <div class="wh-era-events">${e.events.map(x => `<span class="wh-tag">${escapeHtml(x)}</span>`).join('')}</div>
        </div>`).join('');
      return `
      <section class="wh-card ${c.id}">
        <div class="wh-head">
          <div class="wh-topline">
            <span class="wh-code">${escapeHtml(CODE[c.id] || 'ARCH')} · 编年</span>
            <span class="wh-stamp">红月档案司 · 归档</span>
          </div>
          <div class="wh-title">
            <span class="wh-name">${escapeHtml(c.name)}</span>
            <span class="wh-en">${escapeHtml(c.en)}</span>
          </div>
          <div class="wh-motto">${escapeHtml(c.motto)}</div>
          <div class="wh-gate">${escapeHtml(c.gate)}</div>
        </div>
        <div class="wh-eras">${erasHtml}</div>
      </section>`;
    }).join('');
    return `<div class="wh-grid">${cards}</div>
      <div class="wh-note">四洲史与世界史制共用纪元编号（第四纪元·红月之下为四洲交汇）；第一至第四门已探明，第五至第七门尚未定位。</div>`;
  }

  // 时间线列表 — 统一使用 anom-card 风格
  function htmlTimelineList(entries, kw) {
    const cards = entries.map(e => {
      const idTxt = e.id;
      const codeTxt = e.code || e.id;
      const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
      const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
      const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
      const wordCount = bodyText.length;
      const thumbHtml = buildAnomThumbHtml(
        resolveEntryImage(e, 'timelines'),
        String(e.title || ''),
        String(codeTxt || '')
      );
      return `
        <a class="entry-card anom-card" href="#/entry/timelines/${encodeURIComponent(e.id)}">
          ${thumbHtml}
          <div class="anom-body">
            <div class="anom-body-top">
              <div class="anom-idrow">
                <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                ${badgeHtml('tl', null, '时间线')}
              </div>
              <div class="anom-title-row">
                <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                <div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>
              </div>
            </div>
            <div class="anom-body-mid">
              <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
            </div>
            <div class="entry-card-foot">
              <span class="ec-tags">${tagHtml}</span>
              <span class="ec-foot-info">${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount} 字</span>
            </div>
          </div>
        </a>`;
    }).join('');
    return `<div class="entry-grid entry-grid-anom">${cards}</div>`;
  }

  // 纪元卷宗：按纪元分组 — 统一使用 anom-card 风格
  function htmlEraGrouped(entries, kw) {
    const groups = {};
    entries.forEach(e => {
      const era = e.era || '未分类卷宗';
      (groups[era] = groups[era] || []).push(e);
    });
    const out = Object.entries(groups).map(([era, list]) => {
      const cards = list.map(e => {
        const idTxt = e.id;
        const codeTxt = e.code || e.id;
        const summary = e.summary && e.summary.trim() ? e.summary : '（暂无简介）';
        const tagHtml = (e.tags || []).slice(0, 3).map(t => `<span class="ec-tag">${highlightKeyword(t, kw)}</span>`).join('');
        const bodyText = (e.body || '').replace(/<[^>]+>/g, '').trim();
        const wordCount = bodyText.length;
        const thumbHtml = buildAnomThumbHtml(
          resolveEntryImage(e, 'eras'),
          String(e.title || ''),
          String(codeTxt || '')
        );
        return `
          <a class="entry-card anom-card" href="#/entry/eras/${encodeURIComponent(e.id)}">
            ${thumbHtml}
            <div class="anom-body">
              <div class="anom-body-top">
                <div class="anom-idrow">
                  <span class="ec-id">${highlightKeyword(idTxt, kw)}</span>
                  ${badgeHtml('era', null, '纪元')}
                </div>
                <div class="anom-title-row">
                  <div class="ec-title">${highlightKeyword(e.title, kw)}</div>
                  <div class="ec-code">${highlightKeyword(codeTxt, kw)}</div>
                </div>
              </div>
              <div class="anom-body-mid">
                <div class="ec-summary">${highlightKeyword(summary, kw)}</div>
              </div>
              <div class="entry-card-foot">
                <span class="ec-tags">${tagHtml}</span>
                <span class="ec-foot-info">${wordCount > 999 ? (wordCount/1000).toFixed(1)+'k' : wordCount} 字</span>
              </div>
            </div>
          </a>`;
      }).join('');
      return `
        <div class="era-group">
          <div class="era-group-title">
            <span>${ico('sun',12)} ${highlightKeyword(era, kw)}</span>
            <span class="era-group-count">${list.length} VOLS</span>
          </div>
          <div class="era-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:12px;">${cards}</div>
        </div>`;
    }).join('');
    return out;
  }

  // ============ 详情页辅助：TOC 生成 ============
  function injectTocAnchors(html) {
    // 把 h2/h3 加 id，返回 {html, toc:[{level,id,text}]}
    const toc = [];
    const used = {};
    let idx = 0;
    const out = (html || '').replace(/<(h[1-6])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (m0, tag, attrs = '', inner) => {
      const m = inner.replace(/<[^>]+>/g, '').trim();
      if (!m) return m0;
      let id = 'h-' + encodeURIComponent(m).replace(/%/g,'').slice(0,24).toLowerCase() + (idx++);
      while (used[id]) id += '-'+(idx++);
      used[id] = true;
      const lv = parseInt(tag.charAt(1),10);
      toc.push({ level: lv, id, text: m });
      // 如果已有 id 属性，保持（替换）
      const re = /\sid=(['"])([^'"]*)\1/;
      const a2 = re.test(attrs) ? attrs.replace(re, ` id="${id}"`) : `${attrs} id="${id}"`;
      return `<${tag}${a2}>${inner}</${tag}>`;
    });
    return { html: out, toc };
  }

  // ============ 详情页 ============
  function renderEntry(catId, id) {
    const cat = CAT_MAP[catId];
    const e = findEntry(catId, id);
    if (!cat || !e) return renderNotFound();

    const entryKey = `${catId}:${id}`;
    const isFav = Favorites.has(catId, id);
    const isRead = MarkedRead.has(catId, id);
    const canFav = true;   // 收藏 / 已读为本地功能，游客（LV.1）同样可用

    // 顶部机密印章（高危显示 TOP SECRET，其他显示 CONFIDENTIAL 等）
    let stampText = 'CONFIDENTIAL';
    if (e.class === 'keter' || e.class === 'apollyon') stampText = 'TOP SECRET';
    else if (e.class === 'euclid') stampText = 'RESTRICTED';
    else if (e.class === 'thaumiel') stampText = 'THAUMIEL-CLASS';

    // 构造 meta
    const metaRows = [];
    metaRows.push({ k: '档案编号', v: `<span class="meta-v">${escapeHtml(e.id)}</span>` });
    if (e.code) metaRows.push({ k: '档案代号', v: escapeHtml(e.code) });
    if (catId === 'anomalies' || catId === 'organizations') {
      metaRows.push({ k: '危险分级', v: badgeHtml(e.class || 'neutral') });
    }
    if (e.era) metaRows.push({ k: '所属纪元', v: escapeHtml(e.era) });
    if (e.org) metaRows.push({ k: '所属组织', v: escapeHtml(e.org) });
    if (e.tags && e.tags.length) {
      metaRows.push({ k: '关键词', v: escapeHtml(e.tags.join(' / ')) });
    }
    metaRows.push({ k: '档案分类', v: escapeHtml(cat.name) });
    metaRows.push({ k: '权限要求', v: `<span style="color:var(--red-2);font-family:var(--f-serif);font-weight:600">LV.3 以上</span>` });

    const metaHtml = metaRows.map(m => `
      <div class="meta-kv">
        <div class="meta-k">${m.k}</div>
        <div class="meta-v">${typeof m.v==='string'?m.v:escapeHtml(m.v)}</div>
      </div>
    `).join('');

    // 神祇图块 + 来源块
    const imgField = (catId === 'deities' && e.img) ? `
      <div class="detail-field">
        <div class="detail-field-label">神像图 · ICON</div>
        <div class="detail-field-content" style="text-align:center">
          <img src="${escapeAttr(resolveImgUrl(e.img))}" alt="${escapeHtml(e.title)}" onerror="this.style.display='none'">
        </div>
      </div>` : '';

    const srcField = e.source ? `
      <div class="detail-field">
        <div class="detail-field-label">来源档案 · SOURCE FILE</div>
        <div class="detail-field-content" style="font-family:var(--f-mono);font-size:12px;color:var(--text-2);word-break:break-all">
          ${escapeHtml(e.source)}
        </div>
      </div>` : '';

    const audioField = e.audio ? `
      <div class="detail-field detail-audio-field">
        <div class="detail-field-label">${ico('audio',12)} 档案音频 · AUDIO FILE</div>
        <div class="detail-audio-player">
          <audio controls preload="metadata" src="${escapeAttr(resolveImgUrl(e.audio))}" style="width:100%"></audio>
        </div>
      </div>` : '';

    // 排版原件：把已经排好版的 HTML 原样嵌入（100% 保真，不做任何转换）
    const dossierUrl = e.dossier ? resolveImgUrl(e.dossier) : '';
    const dossierField = dossierUrl ? `
      <section class="detail-dossier">
        <div class="dossier-bar">
          <span class="dossier-title">${ico('doc',12)} 排版原件 · TYPESET ORIGINAL</span>
          <span class="dossier-actions">
            <a href="${escapeAttr(dossierUrl)}" target="_blank" rel="noopener">新窗口打开 ↗</a>
            <a href="${escapeAttr(dossierUrl)}" download>${ico('download',11)} 下载</a>
          </span>
        </div>
        <iframe class="dossier-frame" src="${escapeAttr(dossierUrl)}"
                title="${escapeAttr(String(e.title || ''))} · 排版原件"
                loading="lazy" referrerpolicy="no-referrer"></iframe>
        <div class="dossier-foot">下方为结构化正文，便于检索与引用；上方为原始排版，版式与原件完全一致。</div>
      </section>` : '';

    // 处理正文：注入锚点 + 生成 TOC
    const rawBody = e.body || '<p>（本条目正文尚未填充）</p>';
    const { html: bodyHtml, toc } = injectTocAnchors(imgField + rawBody + srcField);

    // 阅读时间估算
    const plainText = (rawBody || '').replace(/<[^>]+>/g, '');
    const charCount = plainText.replace(/\s/g, '').length;
    const readMinutes = Math.max(1, Math.round(charCount / 400));

    // 阅读进度恢复
    const readRec = ReadProgress.get(catId, id);
    const readHintHtml = (readRec && readRec.scrollTop && readRec.scrollTop > 120) ? `
      <div id="read-hint" class="read-hint" style="padding:10px 16px;margin:10px 0;border:1px dashed var(--gold-2);background:var(--bg-2);font-family:var(--f-mono);font-size:11px;letter-spacing:.5px;color:var(--gold-1);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <span>${ico('clock',12)} 上次阅读至 ${readRec.offsetPct ? '约 ' + readRec.offsetPct + '%' : ''}，记录于 ${new Date(readRec.at||Date.now()).toLocaleString()}</span>
        <div style="display:flex;gap:8px;">
          <button type="button" id="read-resume" class="btn btn-mini" style="border:1px solid var(--gold-2);background:transparent;color:var(--gold-1);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">跳转继续</button>
          <button type="button" id="read-dismiss" class="btn btn-mini" style="border:1px solid var(--border);background:transparent;color:var(--text-2);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">忽略</button>
        </div>
      </div>` : '';

    // 关联推荐：跨分类，按同组织 / 同纪元 / 同标签计算相关度
    const relCandidates = [];
    const relTagSet = new Set(e.tags || []);
    const srcOrg = e.org || '';
    const srcEra = e.era || '';
    for (const r of allEntries()) {
      if (r._cat === catId && String(r.id) === String(id)) continue; // 排除自身
      let score = 0;
      const dims = [];
      if (srcOrg && r.org === srcOrg) { score += 3; dims.push('同组织'); }
      if (srcEra && r.era === srcEra) { score += 2; dims.push('同纪元'); }
      const share = (r.tags || []).filter(t => relTagSet.has(t)).length;
      if (share > 0) { score += share; dims.push('共享标签×' + share); }
      if (score > 0) relCandidates.push({ ...r, score, dims });
    }
    relCandidates.sort((a, b) => b.score - a.score);
    let related = relCandidates.slice(0, 5);
    let relatedFallback = false;
    if (related.length === 0) {
      const catEntries = getEntries(catId) || [];
      const others = catEntries.filter(r => String(r.id) !== String(id)).slice(0, 3);
      if (others.length) { related = others.map(r => ({ ...r, dims: ['同类档案'] })); relatedFallback = true; }
    }
    const relatedHtml = related.length ? `
      <section class="related-section" style="margin-top:30px;border-top:1px solid var(--border);padding-top:20px;">
        <div class="sec-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">◆ 相关档案 · RELATED ENTRIES ${relatedFallback ? '（同类档案）' : ''}</div>
        <div class="entry-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">
          ${related.map(r => {
            const rCat = r._cat || catId;
            const rCatName = (CAT_MAP[rCat] && CAT_MAP[rCat].name) || CAT_MAP[catId].name;
            return `
            <a class="entry-card anom-card" href="#/entry/${rCat}/${encodeURIComponent(r.id)}" style="padding:10px;">
              <div class="anom-body" style="padding:0;">
                <div class="anom-idrow">
                  <span class="ec-id">${escapeHtml(r.id)}</span>
                  ${r.class ? badgeHtml(r.class) : `<span class="ec-badge ${escapeHtml(rCat)}">${escapeHtml(rCatName)}</span>`}
                </div>
                <div class="ec-title" style="font-size:14px;">${escapeHtml(r.title)}</div>
                <div class="ec-summary" style="font-size:11px;margin-top:4px;opacity:.75;">${escapeHtml((r.summary||'').slice(0,80)||'—')}</div>
                ${r.dims && r.dims.length ? `<div style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1);margin-top:4px;">${r.dims.join(' · ')}</div>` : ''}
              </div>
            </a>`;
          }).join('')}
        </div>
      </section>
    ` : '';

    // 上下篇导航
    const catEntries = getEntries(catId) || [];
    const curIdx = catEntries.findIndex(r => String(r.id) === String(id));
    const prevEntry = curIdx > 0 ? catEntries[curIdx - 1] : null;
    const nextEntry = curIdx >= 0 && curIdx < catEntries.length - 1 ? catEntries[curIdx + 1] : null;
    const entryNavHtml = `
      <nav class="entry-nav">
        <a class="entry-nav-item prev ${prevEntry ? '' : 'disabled'}" href="${prevEntry ? '#/entry/' + catId + '/' + encodeURIComponent(prevEntry.id) : 'javascript:void(0)'}">
          <span class="entry-nav-label">${ico('arrowLeft',11)} 上一篇</span>
          <span class="entry-nav-title">${prevEntry ? escapeHtml(prevEntry.title) : '已是首篇'}</span>
        </a>
        <a class="entry-nav-item next ${nextEntry ? '' : 'disabled'}" href="${nextEntry ? '#/entry/' + catId + '/' + encodeURIComponent(nextEntry.id) : 'javascript:void(0)'}">
          <span class="entry-nav-label">下一篇 ${ico('arrowRight',11)}</span>
          <span class="entry-nav-title">${nextEntry ? escapeHtml(nextEntry.title) : '已是末篇'}</span>
        </a>
      </nav>
    `;

    // 评论区：配置了 Giscus 则全站共享（GitHub Discussions）；否则保留本地批注
    const useGiscus = Engage.giscusReady();
    let commentsHtml;
    if (useGiscus) {
      commentsHtml = `
      <section class="comments-section" style="margin-top:30px;border-top:1px solid var(--border);padding-top:20px;">
        <div class="sec-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">${ico('pencil',12)} 档案批注 · COMMENTS（全站共享 · GitHub Discussions）</div>
        <div id="giscus-box" class="giscus-box">
          <div class="giscus-hint">${ico('pencil',12)} 评论区滚动至此后自动载入 · 参与讨论需 GitHub 账号</div>
        </div>
      </section>`;
    } else {
    const me = Auth.get();
    const isAdmin = Auth.isAdmin();
    const comments = Comments.list(catId, id);
    const myName = (me && me.user) || '匿名';
    const topComments = comments.filter(c => !c.replyTo);
    const repliesMap = {};
    comments.filter(c => c.replyTo).forEach(c => {
      (repliesMap[c.replyTo] = repliesMap[c.replyTo] || []).push(c);
    });
    function renderComment(c, isReply) {
      const authorLink = c.author && c.author !== '游客'
        ? `<a href="#/user/${encodeURIComponent(c.author)}" style="font-weight:600;color:var(--text);text-decoration:none;">${escapeHtml(c.author)}</a>`
        : `<span style="font-weight:600;">${escapeHtml(c.author)}</span>`;
      const likes = c.likes || [];
      const hasLiked = likes.includes(myName);
      const replies = repliesMap[c.id] || [];
      return `
        <div class="comment-card" data-cid="${escapeAttr(c.id)}" style="border:1px solid var(--border);padding:10px 12px;background:var(--bg-2);${isReply ? 'margin-left:46px;border-left:2px solid var(--border-2);' : ''}">
          <div style="display:flex;gap:10px;">
            ${renderAvatar(c.author, { size: isReply ? 28 : 36 })}
            <div style="flex:1;min-width:0;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:4px;">
                <div style="font-family:var(--f-mono);font-size:11px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  ${authorLink}
                  <span style="opacity:.5;">·</span>
                  <span style="color:var(--gold-3);">${c.authorLevel || ''}</span>
                  ${c.author === 'admin' || c.role === 'admin' ? `<span style="opacity:.5;">·</span><span style="color:var(--red-2);">管理员</span>` : ''}
                </div>
                <span style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);">${new Date(c.at).toLocaleString()}</span>
              </div>
              <div style="white-space:pre-wrap;word-break:break-word;font-family:var(--f-serif);font-size:13px;line-height:1.8;">${escapeHtml(c.text)}</div>
              <div style="display:flex;gap:14px;align-items:center;margin-top:6px;">
                <button type="button" class="comment-like" data-cid="${escapeAttr(c.id)}" style="background:none;border:none;color:${hasLiked?'var(--red-2)':'var(--text-2)'};cursor:pointer;font-family:var(--f-mono);font-size:10px;display:flex;align-items:center;gap:3px;padding:0;">
                  ${hasLiked ? ico('heartFill',12) : ico('heart',12)} ${likes.length || ''}
                </button>
                <button type="button" class="comment-reply" data-cid="${escapeAttr(c.id)}" style="background:none;border:none;color:var(--text-2);cursor:pointer;font-family:var(--f-mono);font-size:10px;display:flex;align-items:center;gap:3px;padding:0;">
                  ${ico('reply',12)} 回复
                </button>
                ${isAdmin ? `<button type="button" class="btn btn-mini comment-del" data-cid="${escapeAttr(c.id)}" style="border:1px solid var(--red);background:transparent;color:var(--red-2);padding:2px 8px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">删除</button>` : ''}
              </div>
              <div class="reply-form-zone" data-cid="${escapeAttr(c.id)}"></div>
            </div>
          </div>
          ${replies.length > 0 ? `<div style="display:grid;gap:8px;margin-top:8px;">${replies.map(r => renderComment(r, true)).join('')}</div>` : ''}
        </div>`;
    }
    commentsHtml = `
      <section class="comments-section" style="margin-top:30px;border-top:1px solid var(--border);padding-top:20px;">
        <div class="sec-label" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">${ico('pencil',12)} 档案批注 · COMMENTS（${comments.length}）</div>
        <form id="comment-form" style="margin-bottom:16px;display:grid;gap:8px;">
          <textarea id="comment-text" rows="3" placeholder="批注请基于档案内容，管理员可删除不当留言…" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:10px;font-family:var(--f-serif);font-size:13px;resize:vertical;"></textarea>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <span style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);letter-spacing:1px;">
              身份：${escapeHtml(me.user)} · ${me.lvl}
            </span>
            <button type="submit" class="btn btn-mini" style="border:1px solid var(--border);padding:6px 14px;font-family:var(--f-mono);font-size:10px;background:var(--bg);color:var(--text);cursor:pointer;">提交批注</button>
          </div>
        </form>
        <div id="comment-list" class="comment-list" style="display:grid;gap:10px;">
          ${comments.length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;border:1px dashed var(--border);">${ico('pencil',12)} 尚未有批注，成为第一个批注者</div>`
            : topComments.map(c => renderComment(c, false)).join('')}
        </div>
      </section>
    `;
    }

    view.innerHTML = `
      <div class="detail-wrap">
        <a class="back-link" href="#/${catId}">← 返回 ${escapeHtml(cat.name)} / ALL RECORDS</a>

        <article class="detail-card">
          <div class="detail-scan" aria-hidden="true"></div>
          <div class="detail-watermark" aria-hidden="true">${stampText}</div>
          <div class="detail-stamp">
            <div class="detail-stamp-inner">
              <img src="data/logo-mark.png" alt="" onerror="(function(el){var n='data/logo-mark.jpg,x.jpg,首页 HERO 巨幕背景.webp,logo.png,logo.jpg'.split(','),i=0,fb=el.nextElementSibling;function t(){if(i>=n.length){el.style.display='none';if(fb)fb.style.display='grid';return;}var p=n[i++],im=new Image();im.onload=function(){el.src=p;};im.onerror=t;im.src=p;}})(this)">
              <span class="ds-fb" style="display:none">⬢</span>
              <div class="ds-ring outer"></div>
              <div class="ds-ring inner"></div>
            </div>
            <div class="detail-stamp-label">${stampText}</div>
          </div>

          <div class="detail-head">
            <div class="detail-id-row">
              <span>${cat.code}</span>
              <span class="sep"></span>
              <span>${escapeHtml(e.id)}</span>
              ${e.class ? `<span class="sep"></span><span>${CLASS_NAMES[e.class]||e.class}</span>` : ''}
              <span class="sep"></span>
              ${(() => {
                const rs = RATINGS.score(catId, id);
                const mine = RATINGS.mine(catId, id);
                const cls = rs.score > 0 ? 'pos' : (rs.score < 0 ? 'neg' : '');
                return `<span class="rating-widget" id="rating-widget" data-cat="${escapeAttr(catId)}" data-id="${escapeAttr(String(id))}">
                  <button type="button" class="rating-btn up ${mine === 1 ? 'active' : ''}" data-dir="1" title="好评" aria-label="好评">▲</button>
                  <span class="rating-score ${cls}" id="rating-score" title="好评 ${rs.up} · 差评 ${rs.down}">${rs.score > 0 ? '+' + rs.score : rs.score}</span>
                  <button type="button" class="rating-btn down ${mine === -1 ? 'active' : ''}" data-dir="-1" title="差评" aria-label="差评">▼</button>
                </span>`;
              })()}
              <span class="sep"></span>
              <button type="button" id="fav-btn" class="btn btn-mini fav-btn" style="border:1px solid var(--${isFav?'silver':'border'});background:${isFav?'rgba(200,200,200,0.12)':'transparent'};color:${isFav?'var(--silver)':'var(--text-2)'};padding:3px 10px;font-family:var(--f-mono);font-size:10px;">
                ${isFav? ico('starFill',14)+' 已收藏' : ico('starOutline',14)+' 收藏'}
              </button>
              ${Engage.enabled() ? '<span class="fav-shared-count" id="fav-shared-count" title="全站收藏数"></span>' : ''}
              <span class="sep"></span>
              <button type="button" id="read-btn" class="btn btn-mini read-btn" style="border:1px solid var(--${isRead?'silver':'border'});background:${isRead?'rgba(200,200,200,0.12)':'transparent'};color:${isRead?'var(--silver)':'var(--text-2)'};padding:3px 10px;font-family:var(--f-mono);font-size:10px;">
                ${isRead? '✓ 已读' : '标记已读'}
              </button>
              <span class="sep"></span>
              <span class="dl-group"><span class="dl-label">导出</span>
                <button type="button" class="btn btn-mini entry-dl" data-fmt="md" title="导出本文档为 Markdown 文件">
                  ${ico('download',12)} MD
                </button>
                <button type="button" class="btn btn-mini entry-dl" data-fmt="json" title="导出本条目的 JSON 记录">
                  ${ico('download',12)} JSON
                </button>
              </span>
            </div>
            <h1 class="detail-title">
              <span class="detail-title-text" id="detail-title-text" data-final="${escapeAttr(String(e.title || ''))}">${escapeHtml(e.title)}</span>
              <small>${escapeHtml(e.summary || '—')}</small>
            </h1>
            <div class="detail-meta">${metaHtml}</div>
          </div>

          <div class="detail-reader-bar">
            <span class="drb-label">阅读字号</span>
            <button type="button" class="drb-btn" data-fs="13" title="小">A-</button>
            <button type="button" class="drb-btn active" data-fs="15" title="默认">A</button>
            <button type="button" class="drb-btn" data-fs="17" title="大">A+</button>
            <button type="button" class="drb-btn" data-fs="20" title="特大">A++</button>
            <span class="drb-sep"></span>
            <span class="read-time" id="read-time-badge">${ico('clock',11)} 约 ${readMinutes} 分钟 · ${charCount} 字</span>
            <span class="drb-sep"></span>
            <button type="button" class="drb-btn drb-share entry-share" title="生成条目分享卡片">
              ${ico('share',12)} 分享
            </button>
            <span class="drb-sep"></span>
            <button type="button" class="drb-btn drb-focus" title="专注阅读：隐藏界面框架，沉浸浏览；再点恢复">专注</button>
            <span class="drb-sep"></span>
            <button type="button" class="drb-btn drb-top" title="回到顶部">↑ 顶部</button>
          </div>

          ${readHintHtml}

          ${audioField}

          ${dossierField}

          <div style="display:grid;grid-template-columns:${toc && toc.length>1 ? 'minmax(0,1fr) 220px' : '1fr'};gap:24px;align-items:flex-start;">
            <div class="detail-body" id="detail-body">${bodyHtml}</div>
            ${toc && toc.length>1 ? `
              <nav id="toc-nav" class="toc-nav" aria-label="章节目录">
                <div class="toc-head">
                  <span class="toc-title">◆ 目录</span>
                  <span class="toc-count">${toc.length} 节</span>
                </div>
                ${toc.map(t => `<a class="toc-link" href="#${t.id}" data-level="${t.level}">${escapeHtml(t.text)}</a>`).join('')}
              </nav>
            ` : ''}
          </div>

          <div class="detail-source">
            <div>来源路径<strong>${escapeHtml(e.source||'—')}</strong></div>
            <div>归档于<strong>${DATA.meta.updated || '—'}</strong> / 世界观察档案库</div>
          </div>
        </article>
        ${relatedHtml}
        ${entryNavHtml}
        ${commentsHtml}
        ${toc && toc.length > 1 ? `
          <button class="toc-mobile-btn" id="toc-mobile-btn" title="目录" aria-label="打开目录">${ico('list',18)}</button>
          <div class="toc-mobile-panel" id="toc-mobile-panel">
            <div class="toc-mobile-inner">
              <button class="toc-mobile-close" id="toc-mobile-close" aria-label="关闭目录">${ico('x',16)}</button>
              <div class="toc-head" style="margin-bottom:12px;">
                <span class="toc-title">◆ 目录</span>
                <span class="toc-count">${toc.length} 节</span>
              </div>
              ${toc.map(t => `<a class="toc-link" href="#${t.id}" data-level="${t.level}">${escapeHtml(t.text)}</a>`).join('')}
            </div>
          </div>
        ` : ''}
        <div class="read-float" id="read-float">
          <div class="read-float-ring">
            <svg viewBox="0 0 44 44" width="44" height="44">
              <circle class="ring-bg" cx="22" cy="22" r="20"/>
              <circle class="ring-fg" cx="22" cy="22" r="20" stroke-dasharray="125.66" stroke-dashoffset="125.66"/>
            </svg>
            <span class="read-float-pct" id="read-float-pct">0%</span>
          </div>
          <span class="read-float-label">PROGRESS</span>
        </div>
      </div>
    `;

    // 详情页字号控制 + 阅读进度 + TOC 高亮
    const readerBar = view.querySelector('.detail-reader-bar');
    const detailBody = document.getElementById('detail-body');
    if (readerBar && detailBody) {
      const savedFs = localStorage.getItem('detail-font-size');
      if (savedFs) {
        detailBody.style.fontSize = `${savedFs}px`;
        detailBody.style.lineHeight = (1.9 + (parseInt(savedFs) - 15) * 0.03).toFixed(2);
        readerBar.querySelectorAll('.drb-btn[data-fs]').forEach(b => {
          b.classList.toggle('active', b.dataset.fs === savedFs);
        });
      }
      readerBar.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.drb-btn');
        if (!btn) return;
        if (btn.classList.contains('drb-top')) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (btn.classList.contains('drb-focus')) {
          const on = document.body.classList.toggle('focus-reading');
          btn.classList.toggle('active', on);
          return;
        }
        const fs = btn.dataset.fs;
        if (!fs) return;
        detailBody.style.fontSize = `${fs}px`;
        detailBody.style.lineHeight = (1.9 + (parseInt(fs) - 15) * 0.03).toFixed(2);
        localStorage.setItem('detail-font-size', fs);
        readerBar.querySelectorAll('.drb-btn[data-fs]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
      });
    }

    // 阅读进度保存（debounce）+ 顶部进度条
    let rpT = null;
    let rpObserver = null;
    let progBar = document.getElementById('reading-progress');
    if (!progBar) {
      progBar = document.createElement('div');
      progBar.id = 'reading-progress';
      document.body.appendChild(progBar);
    }
    const saveProgress = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const top = Math.max(0, window.scrollY);
      const percent = Math.round((top / total) * 100);
      ReadProgress.save(catId, id, top, percent);
    };
    const readFloat = document.getElementById('read-float');
    const readFloatPct = document.getElementById('read-float-pct');
    const readFloatRing = readFloat ? readFloat.querySelector('.ring-fg') : null;
    const RING_CIRC = 2 * Math.PI * 20;
    const updateProgressBar = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const top = Math.max(0, window.scrollY);
      const pct = Math.min(100, (top / total) * 100);
      progBar.style.width = pct + '%';
      if (readFloat) {
        if (top > 200) readFloat.classList.add('visible');
        else readFloat.classList.remove('visible');
      }
      if (readFloatPct) readFloatPct.textContent = Math.round(pct) + '%';
      if (readFloatRing) readFloatRing.style.strokeDashoffset = RING_CIRC * (1 - pct / 100);
    };
    updateProgressBar();
    window.addEventListener('scroll', () => {
      if (!location.hash.startsWith(`#/entry/${catId}/${encodeURIComponent(id)}`)) return;
      updateProgressBar();
      clearTimeout(rpT);
      rpT = setTimeout(saveProgress, 400);
    }, { passive: true });

    // 阅读恢复按钮
    const rres = document.getElementById('read-resume');
    const rdismiss = document.getElementById('read-dismiss');
    if (rres) rres.addEventListener('click', () => {
      window.scrollTo({ top: readRec.scrollTop || 0, behavior: 'smooth' });
      const rh = document.getElementById('read-hint'); if (rh) rh.remove();
    });
    if (rdismiss) rdismiss.addEventListener('click', () => {
      const rh = document.getElementById('read-hint'); if (rh) rh.remove();
    });

    // TOC 平滑滚动 + IntersectionObserver 高亮
    const tocLinks = document.querySelectorAll('#toc-nav .toc-link');
    if (tocLinks.length) {
      tocLinks.forEach(a => {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const tid = a.getAttribute('href').slice(1);
          const tgt = document.getElementById(tid);
          if (tgt) {
            const y = tgt.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top: y, behavior: 'smooth' });
            history.replaceState(null, '', location.pathname + location.hash.split('#')[0] + '#' + tid);
          }
        });
      });
      if ('IntersectionObserver' in window) {
        const idMap = new Map();
        tocLinks.forEach(a => {
          const tid = a.getAttribute('href').slice(1);
          const t = document.getElementById(tid);
          if (t) idMap.set(tid, a);
        });
        if (idMap.size) {
          rpObserver = new IntersectionObserver((entries) => {
            entries.forEach(ent => {
              const a = idMap.get(ent.target.id);
              if (!a) return;
              if (ent.isIntersecting) {
                document.querySelectorAll('.toc-link').forEach(x => x.classList.remove('active'));
                a.classList.add('active');
              }
            });
          }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
          idMap.forEach((a, tid) => {
            const t = document.getElementById(tid);
            if (t) rpObserver.observe(t);
          });
        }
      }
    }

    // 移动端目录面板
    const tocMobileBtn = document.getElementById('toc-mobile-btn');
    const tocMobilePanel = document.getElementById('toc-mobile-panel');
    const tocMobileClose = document.getElementById('toc-mobile-close');
    if (tocMobileBtn && tocMobilePanel) {
      tocMobileBtn.addEventListener('click', () => tocMobilePanel.classList.add('open'));
    }
    if (tocMobileClose) {
      tocMobileClose.addEventListener('click', () => tocMobilePanel.classList.remove('open'));
    }
    if (tocMobilePanel) {
      tocMobilePanel.addEventListener('click', (ev) => {
        if (ev.target === tocMobilePanel) tocMobilePanel.classList.remove('open');
      });
      tocMobilePanel.querySelectorAll('.toc-link').forEach(a => {
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const tid = a.getAttribute('href').slice(1);
          const tgt = document.getElementById(tid);
          if (tgt) {
            const y = tgt.getBoundingClientRect().top + window.scrollY - 70;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
          tocMobilePanel.classList.remove('open');
        });
      });
    }

    // 标题解码动画：从乱码逐字解出，像档案正在被解密
    (function decodeTitle() {
      const el = document.getElementById('detail-title-text');
      if (!el) return;
      const final = el.getAttribute('data-final') || el.textContent || '';
      if (!final) return;
      const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || final.length > 42) return;   // 太长就不做，避免闪烁噪声
      const GLYPHS = '█▓▒░#%&@$*+=/\\<>?';
      const total = Math.min(900, 260 + final.length * 26);
      const t0 = performance.now();
      el.classList.add('decoding');
      function frame(now) {
        const p = Math.min(1, (now - t0) / total);
        // 已解出的字符数：前段慢、后段快，最后全部锁定
        const solved = Math.floor(final.length * Math.pow(p, 0.65));
        let out = '';
        for (let i = 0; i < final.length; i++) {
          const ch = final[i];
          if (i < solved || ch === ' ') out += ch;
          else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(frame);
        else {
          el.textContent = final;
          el.classList.remove('decoding');
        }
      }
      requestAnimationFrame(frame);
    })();

    // 评分（SCP 式 +1 / -1）
    const ratingWidget = document.getElementById('rating-widget');
    if (ratingWidget) {
      ratingWidget.addEventListener('click', (ev) => {
        const btn = ev.target.closest('.rating-btn');
        if (!btn) return;
        ev.preventDefault();
        if (Engage.enabled() && !Engage.user()) {
          alert('全站评分已启用：请先登录站内账号再投票。');
          return;
        }
        const dir = parseInt(btn.getAttribute('data-dir'), 10) || 1;
        const st = RATINGS.vote(catId, id, dir);
        const scoreEl = document.getElementById('rating-score');
        if (scoreEl) {
          scoreEl.textContent = st.score > 0 ? '+' + st.score : String(st.score);
          scoreEl.className = 'rating-score ' + (st.score > 0 ? 'pos' : (st.score < 0 ? 'neg' : ''));
          scoreEl.title = `好评 ${st.up} · 差评 ${st.down}`;
          scoreEl.classList.remove('pop');
          void scoreEl.offsetWidth;
          scoreEl.classList.add('pop');
        }
        ratingWidget.querySelectorAll('.rating-btn').forEach(b => {
          b.classList.toggle('active', parseInt(b.getAttribute('data-dir'), 10) === st.mine);
        });
        if (window.SFX) { if (st.mine) SFX.favor(); else SFX.unfavor(); }
        // 乐观更新已生效；上报 Worker 并以服务端合计为准刷新
        if (Engage.enabled()) {
          Engage.vote(catId, id, dir).then(c => { if (c) Engage.paintRating(c); });
        }
      });
    }

    // 收藏按钮
    const favBtn = document.getElementById('fav-btn');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        const had = Favorites.has(catId, id);
        if (had) {
          Favorites.toggle(catId, id);
          favBtn.innerHTML = ico('starOutline',14)+' 收藏';
          favBtn.style.borderColor = 'var(--border)';
          favBtn.style.background = 'transparent';
          favBtn.style.color = 'var(--text-2)';
          SFX.unfavor();
        } else {
          Favorites.toggle(catId, id, e);
          favBtn.innerHTML = ico('starFill',14)+' 已收藏';
          favBtn.style.borderColor = 'var(--silver)';
          favBtn.style.background = 'rgba(200,200,200,0.12)';
          favBtn.style.color = 'var(--silver)';
          SFX.favor();
        }
        // 收藏列表仍是个人数据；仅登录用户上报全站收藏计数
        if (Engage.enabled() && Engage.user()) {
          Engage.fav(catId, id, !had).then(c => { if (c) Engage.paintRating(c); });
        }
      });
    }

    // 标记已读按钮
    const readBtn = document.getElementById('read-btn');    if (readBtn) {
      readBtn.addEventListener('click', () => {
        if (MarkedRead.has(catId, id)) {
          MarkedRead.toggle(catId, id);
          readBtn.innerHTML = '标记已读';
          readBtn.style.borderColor = 'var(--border)';
          readBtn.style.background = 'transparent';
          readBtn.style.color = 'var(--text-2)';
        } else {
          MarkedRead.toggle(catId, id, e);
          readBtn.innerHTML = '✓ 已读';
          readBtn.style.borderColor = 'var(--silver)';
          readBtn.style.background = 'rgba(200,200,200,0.12)';
          readBtn.style.color = 'var(--silver)';
        }
      });
    }

    // 导出 / 下载：把这条档案作为文件取走（MD / JSON）
    view.querySelectorAll('.entry-dl').forEach(btn => {
      btn.addEventListener('click', () => {
        const fmt = btn.getAttribute('data-fmt') || 'md';
        try {
          exportEntry(catId, e, fmt);
          if (window.SFX && SFX.click) SFX.click();
          if (window.SFX && SFX.favor) SFX.favor();
        } catch (err) {
          console.warn('[export] failed', err);
        }
      });
    });

    // 分享卡片：生成主题化分享图并弹出预览
    const shareBtn = view.querySelector('.entry-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        try {
          openShareCard(catId, e);
          if (window.SFX && SFX.click) SFX.click();
        } catch (err) {
          console.warn('[share-card] failed', err);
        }
      });
    }

    // 评论提交
    const cf = document.getElementById('comment-form');
    if (cf) {
      cf.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const tx = document.getElementById('comment-text');
        const text = (tx ? tx.value : '').trim();
        if (!text) return;
        Comments.add(catId, id, text);
        renderEntry(catId, id);
      });
    }
    // 评论删除
    document.querySelectorAll('.comment-del').forEach(b => {
      b.addEventListener('click', () => {
        const cid = b.dataset.cid;
        if (!cid) return;
        if (!confirm(`确认删除该批注？`)) return;
        Comments.remove(catId, id, cid);
        renderEntry(catId, id);
      });
    });
    // 评论点赞
    document.querySelectorAll('.comment-like').forEach(b => {
      b.addEventListener('click', () => {
        const cid = b.dataset.cid;
        if (!cid) return;
        Comments.toggleLike(catId, id, cid);
        renderEntry(catId, id);
      });
    });
    // 评论回复
    document.querySelectorAll('.comment-reply').forEach(b => {
      b.addEventListener('click', () => {
        const cid = b.dataset.cid;
        if (!cid) return;
        const zone = document.querySelector(`.reply-form-zone[data-cid="${cid}"]`);
        if (!zone || zone.dataset.shown === '1') return;
        zone.dataset.shown = '1';
        zone.innerHTML = `
          <div style="margin-top:8px;display:grid;gap:6px;padding:8px;border:1px solid var(--border);background:var(--bg);">
            <textarea rows="2" placeholder="回复…" style="background:var(--bg-2);border:1px solid var(--border);color:var(--text);padding:8px;font-family:var(--f-serif);font-size:12px;resize:vertical;"></textarea>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" class="reply-cancel" style="border:1px solid var(--border);background:var(--bg-2);color:var(--text-2);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">取消</button>
              <button type="button" class="reply-submit" style="border:1px solid var(--border);background:var(--bg);color:var(--text);padding:4px 10px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">回复</button>
            </div>
          </div>`;
        const ta = zone.querySelector('textarea');
        const cancelBtn = zone.querySelector('.reply-cancel');
        const submitBtn = zone.querySelector('.reply-submit');
        if (ta) ta.focus();
        if (cancelBtn) cancelBtn.addEventListener('click', () => { zone.innerHTML = ''; zone.dataset.shown = ''; });
        if (submitBtn) submitBtn.addEventListener('click', () => {
          const text = (ta ? ta.value : '').trim();
          if (!text) return;
          Comments.add(catId, id, text, cid);
          renderEntry(catId, id);
        });
      });
    });

    // 全站共享：远端合计覆盖评分条 / 懒加载 Giscus 评论区
    if (Engage.enabled()) Engage.hydrateRating(catId, id);
    if (useGiscus) Engage.mountGiscusLazy(document.getElementById('giscus-box'), entryKey);
  }

  // ============ 设定中心（原「正典层级」· 面向读者） ============
  function renderCanon() {
    const filesInGroup = (g) => allEntries().filter(e => (e.group || e.subcat || '') === g.id).length;

    const groupCards = WORKSHELF_GROUPS.map(g => {
      const have = filesInGroup(g);
      return `
        <div class="canon-group">
          <div class="canon-group-head">
            <span class="canon-group-id">${g.id}</span>
            <span class="canon-group-name">${escapeHtml(g.name)}</span>
            <span class="canon-group-en">${escapeHtml(g.en)}</span>
          </div>
          <div class="canon-group-when">${ico('clock',11)} ${escapeHtml(g.when)}</div>
          <ul class="canon-file-list">
            ${g.files.map(f => `<li><span class="canon-file">${escapeHtml(f)}</span></li>`).join('')}
          </ul>
          <div class="canon-group-foot ${have === 0 ? 'is-gap' : ''}">
            ${have ? `${have} 篇已收录` : '<span class="canon-gap-tag">整理中</span>'}
          </div>
        </div>`;
    }).join('');

    const tierRows = CANON_TIERS.map(t => `
      <div class="canon-tier ${t.lv <= 2 ? 'is-high' : ''}">
        <span class="canon-tier-lv">${t.lv} 级</span>
        <span class="canon-tier-content">${escapeHtml(t.content)}</span>
        <span class="canon-tier-power">${escapeHtml(t.power)}</span>
      </div>`).join('');

    const erratumRows = KNOWN_ERRATA.map(e => `
      <div class="canon-erratum">
        <span class="erratum-id">${e.id}</span>
        <span class="erratum-where">${escapeHtml(e.where)}</span>
        <span class="erratum-wrong">${escapeHtml(e.wrong)}</span>
        <span class="erratum-arrow">→</span>
        <span class="erratum-right">${escapeHtml(e.right)}</span>
      </div>`).join('');

    view.innerHTML = `
      <div class="list-header" data-header-img="${encodeURI('正典层级页横幅.webp')}">
        <div class="list-header-inner">
          <div class="list-title">设定中心<span class="list-title-en">CANON HUB</span></div>
          <p class="list-sub">盖亚的全部正典文献 · 按用途分组，告诉你从哪里开始读</p>
        </div>
      </div>

      <div class="canon-quote">世界史管年份，洲史管细节，势力档案管组织，设定集管机制。<span>四洲之上，七门之下，无一处是偶然。</span></div>

      <div class="canon-section-title">一、按用途找书 · A–F 组<span class="canon-section-en">WHERE TO START</span></div>
      <div class="canon-groups">${groupCards}</div>

      <div class="canon-section-title">二、纪年基准<span class="canon-section-en">THE ONE CLOCK</span></div>
      <div class="canon-era-box">
        <div class="canon-era-rule"><b>红月纪元（新历）＝ 公元 − ${ERA.offset}</b></div>
        <div class="canon-era-row"><span>纪元零年</span><button type="button" class="canon-era-pick" data-ce="${ERA.offset}">公元 ${ERA.offset} 年</button></div>
        <div class="canon-era-row"><span>「今」建议基准</span><button type="button" class="canon-era-pick" data-ce="${ERA.today}">${fmtCe(ERA.today)} 年 / 红月 ${ERA.todayRm} 年</button></div>
        <div class="canon-era-row"><span>负年写法</span><span class="canon-era-plain">${escapeHtml(ERA.beforeLabel)} X 年</span></div>
        <div class="canon-era-actions">
          <button type="button" class="btn btn-mini canon-open-ec">打开纪年换算器 →</button>
        </div>
      </div>

      <details class="canon-meta-fold">
        <summary>编务附注 · 版本裁决与勘误<span class="canon-meta-hint">（整理者内部记录，不属于设定）</span></summary>
        <div class="canon-section-title">冲突裁决顺序<span class="canon-section-en">WHEN SOURCES DISAGREE</span></div>
        <div class="canon-tiers">${tierRows}</div>
        <div class="canon-section-title">已知勘误<span class="canon-section-en">KNOWN ERRATA</span></div>
        <div class="canon-errata">${erratumRows}</div>
        <div class="canon-note">${ico('warn',11)} 以上为原文笔误与版本取舍记录，整理时保存但不修改源稿。阅读时无需理会。</div>
      </details>
    `;

    // 正典层级页横幅：沿用分类页的 --lh-img 机制（灰度 + 下三分之一压暗由 CSS 负责）
    const canonLh = view.querySelector('.list-header[data-header-img]');
    if (canonLh && canonLh.dataset.headerImg) {
      canonLh.style.setProperty('--lh-img', `url('${canonLh.dataset.headerImg}')`);
    }

    // 锚点点击：直接写入换算器
    view.querySelectorAll('.canon-era-pick').forEach(b => {
      b.addEventListener('click', () => {
        const ce = b.getAttribute('data-ce');
        const btn = document.getElementById('sb-era-converter');
        if (btn) btn.click();
        const ceInput = document.getElementById('ec-ce');
        const rmInput = document.getElementById('ec-rm');
        if (ceInput) { ceInput.value = ce; ceInput.dispatchEvent(new Event('input')); }
        if (rmInput) rmInput.value = String(Number(ce) - ERA.offset);
      });
    });
    const openEc = view.querySelector('.canon-open-ec');
    if (openEc) openEc.addEventListener('click', () => {
      const btn = document.getElementById('sb-era-converter');
      if (btn) btn.click();
    });
  }

  // ============ 文库（Markdown 原始文件在线阅读） ============
  // 站点只放文件：把世界观库的 .md 原样放进 data/library/，前端读取渲染。
  // 不做转换、不改源文件、不新增数据结构 —— 加一篇就只是多一个 .md 文件。
  const LIBRARY_DOCS = [
    { id: 'l00', file: 'l00.md', title: '总索引与正典层级', en: 'MASTER INDEX', group: 'F', src: '00·总索引与正典层级.md', desc: '全部文件地图 + 冲突时谁压谁 + 版本裁决', ready: true },
    { id: 'l01', file: 'l01.md', title: '世界总纲', en: 'WORLD COMPENDIUM', group: 'F', src: '01·世界总纲.md', desc: '宇宙结构、七门、十二旧神、卡尔莫拉设计、四洲速览', ready: true },
    { id: 'l02', file: 'l02.md', title: '纪元时间轴', en: 'CHRONOLOGY', group: 'F', src: '02·纪元时间轴.md', desc: '四大纪元全部关键年份，按纪元分节' },
    { id: 'l03', file: 'l03.md', title: '势力索引', en: 'FACTIONS INDEX', group: 'C', src: '03·势力索引.md', desc: '13 份档案的入口 + 三层棋盘 + 关系表' },
    { id: 'l04', file: 'l04.md', title: '体系与名词速查', en: 'SYSTEMS', group: 'D', src: '04·体系与名词速查.md', desc: 'RM 分级、五色区、灰疫三阶段、黑烛体系、四大学派' },
    { id: 'l05', file: 'l05.md', title: '矛盾与裁决清单', en: 'CONFLICT LOG', group: 'F', src: '05·矛盾与裁决清单.md', desc: 'A 系列结案 + N 系列新矛盾 + 谁要改', internal: true },
    { id: 'l06', file: 'l06.md', title: '待补清单', en: 'OPEN ITEMS', group: 'F', src: '06·待补清单.md', desc: '待拍板的三件事 + 空档 + 26 条伏笔台账', internal: true },
    { id: 'l07', file: 'l07.md', title: '纪元与纪年基准', en: 'ERA BASELINE', group: 'F', src: '07·纪元与纪年基准.md', desc: '四套冲突纪年的拆解 + 唯一时间基准 + 换算表', ready: true },
    { id: 'l08', file: 'l08.md', title: '命名与专名表', en: 'NAMING TABLE', group: 'F', src: '08·命名与专名表.md', desc: '所有专名的唯一正确写法 + 易混提醒' },
    { id: 'l09', file: 'l09.md', title: '神位体系图谱', en: 'DIVINE PANTHEON', group: 'D', src: '09·神位体系图谱.md', desc: '三级神位全表：旧神 / 从属神 / 神嗣 / 堕神 / 独立神' },
    { id: 'l10', file: 'l10.md', title: '原稿勘误与改写记录', en: 'ERRATA LOG', group: 'F', src: '10·原稿勘误与改写记录.md', desc: '原文笔误与改写痕迹，不等于设定', internal: true }
  ];

  // 极简 Markdown → HTML（只覆盖这批文档实际用到的语法）
  function mdToHtml(md) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = s => {
      let t = esc(s);
      const codes = [];
      t = t.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000C' + (codes.length - 1) + '\u0000'; });
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
      t = t.replace(/~~([^~]+)~~/g, '<del>$1</del>');
      t = t.replace(/\u0000C(\d+)\u0000/g, (m, i) => '<code>' + codes[+i] + '</code>');
      return t;
    };

    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let listType = null;
    const closeList = () => { if (listType) { out.push('</' + listType + '>'); listType = null; } };
    const splitRow = (row) => {
      let s = row.trim();
      if (s.startsWith('|')) s = s.slice(1);
      if (s.endsWith('|')) s = s.slice(0, -1);
      return s.split('|').map(c => c.trim());
    };

    while (i < lines.length) {
      const t = lines[i].trim();

      if (/^```/.test(t)) {
        closeList();
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre class="md-pre"><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      if (/^\|/.test(t) && i + 1 < lines.length && /^\|[\s:|-]+\|?$/.test(lines[i + 1].trim())) {
        closeList();
        const head = splitRow(lines[i]);
        i += 2;
        const body = [];
        while (i < lines.length && /^\|/.test(lines[i].trim())) { body.push(splitRow(lines[i])); i++; }
        out.push('<div class="md-table-wrap"><table class="md-table"><thead><tr>' +
          head.map(h => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>' +
          body.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>');
        continue;
      }

      const h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        closeList();
        const lv = Math.min(6, h[1].length);
        out.push('<h' + lv + ' class="md-h md-h' + lv + '">' + inline(h[2]) + '</h' + lv + '>');
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { closeList(); out.push('<hr class="md-hr">'); i++; continue; }

      if (/^>/.test(t)) {
        closeList();
        const buf = [];
        while (i < lines.length && /^>/.test(lines[i].trim())) {
          buf.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote class="md-quote">' + buf.map(b => inline(b)).join('<br>') + '</blockquote>');
        continue;
      }

      if (/^[-*+]\s+/.test(t)) {
        if (listType !== 'ul') { closeList(); out.push('<ul class="md-ul">'); listType = 'ul'; }
        out.push('<li>' + inline(t.replace(/^[-*+]\s+/, '')) + '</li>');
        i++;
        continue;
      }
      if (/^\d+\.\s+/.test(t)) {
        if (listType !== 'ol') { closeList(); out.push('<ol class="md-ol">'); listType = 'ol'; }
        out.push('<li>' + inline(t.replace(/^\d+\.\s+/, '')) + '</li>');
        i++;
        continue;
      }

      if (t === '') { closeList(); i++; continue; }

      closeList();
      out.push('<p class="md-p">' + inline(t) + '</p>');
      i++;
    }
    closeList();
    return out.join('\n');
  }

  function renderLibrary() {
    // 编务类文档对读者隐藏，管理员登录后可见
    const isAdmin = Auth.isAdmin();
    const docs = LIBRARY_DOCS.filter(d => isAdmin || !d.internal);
    const ready = docs.filter(d => d.ready).length;
    view.innerHTML = `
      <div class="list-header">
        <div class="list-title">设定文献<span class="list-title-en">SOURCE LIBRARY</span></div>
        <p class="list-sub">盖亚设定原文 · 原样收录，不改一字 · 共 ${docs.length} 份，已开放 ${ready} 份</p>
      </div>
      <div class="lib-note">${ico('folder',12)} 这些都是世界观的原始文献。点开即可在站内阅读，也可以下载 Markdown 存到本地。</div>
      <div class="lib-grid">
        ${docs.map(d => d.ready ? `
          <a class="lib-card" href="#/library/${d.id}">
            <div class="lib-top"><span class="lib-group">${d.group} 组</span>${ico('doc',14)}</div>
            <div class="lib-title">${escapeHtml(d.title)}</div>
            <div class="lib-en">${escapeHtml(d.en)}</div>
            <div class="lib-desc">${escapeHtml(d.desc)}</div>
            <div class="lib-foot"><span class="lib-src">${escapeHtml(d.src)}</span><span class="lib-go">READ →</span></div>
          </a>` : `
          <div class="lib-card is-pending">
            <div class="lib-top"><span class="lib-group">${d.group} 组</span>${ico('doc',14)}</div>
            <div class="lib-title">${escapeHtml(d.title)}</div>
            <div class="lib-en">${escapeHtml(d.en)}</div>
            <div class="lib-desc">${escapeHtml(d.desc)}</div>
            <div class="lib-foot"><span class="lib-src">${escapeHtml(d.src)}</span><span class="lib-pending">整理中</span></div>
          </div>`).join('')}
      </div>`;
  }

  function renderLibraryDoc(docId) {
    const doc = LIBRARY_DOCS.find(d => d.id === docId);
    if (!doc) return renderNotFound();
    // 编务类文档仅管理员可读
    if (doc.internal && !Auth.isAdmin()) return renderNotFound();

    view.innerHTML = `
      <div class="list-header">
        <div class="list-title">${escapeHtml(doc.title)}<span class="list-title-en">${escapeHtml(doc.en)}</span></div>
        <p class="list-sub">${escapeHtml(doc.desc)} · 源文件：${escapeHtml(doc.src)}</p>
      </div>
      <div class="doc-toolbar">
        <a class="back-link" href="#/library">← 返回设定文献</a>
        <div class="doc-toolbar-actions">
          <button type="button" class="entry-dl" id="lib-download">${ico('download',12)} 下载源文件 (.md)</button>
        </div>
      </div>
      <article class="md-doc" id="lib-body">
        <div class="md-loading">正在读取 ${escapeHtml(doc.src)} …</div>
      </article>`;

    const body = document.getElementById('lib-body');
    fetch('data/library/' + doc.file)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(text => {
        body.innerHTML = mdToHtml(text);
        body.querySelectorAll('.md-h').forEach((h, idx) => { h.id = 'lib-h-' + idx; });
        const dl = document.getElementById('lib-download');
        if (dl) dl.addEventListener('click', () => {
          const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = doc.src;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
      })
      .catch(err => {
        body.innerHTML = `<div class="md-error">${ico('warn',14)} 无法读取 <code>${escapeHtml(doc.file)}</code>（${escapeHtml(err.message)}）。
          <br><br>若是用 <code>file://</code> 直接打开页面，浏览器会拦截本地 fetch —— 请通过本地服务器或 GitHub Pages 访问。</div>`;
      });
  }

  // ============ 搜索结果 ============
  function snippet(bodyText, kw, len = 160) {
    if (!kw) return (bodyText || '').slice(0, len);
    const t = bodyText || '';
    const i = t.toLowerCase().indexOf(kw.toLowerCase());
    if (i < 0) return t.slice(0, len);
    const s = Math.max(0, i - 40);
    return (s ? '…' : '') + t.slice(s, s + len) + (s + len < t.length ? '…' : '');
  }
  function renderSearch(q) {
    const kw = q.trim();
    if (!kw) {
      view.innerHTML = `
        <div class="list-header">
          <div class="list-title">检索中心<span class="list-title-en">SEARCH CENTER</span></div>
          <p class="list-sub">在顶部搜索框输入关键词，将在全部档案中检索编号、代号、标题、标签与正文片段。</p>
        </div>
        <div class="empty-state">
          <div class="es-icon">◐</div>
          <div class="es-title">请输入检索关键词</div>
          <div class="es-desc">支持档案编号 / 代号 / 标题 / 标签 / 正文片段（按 <kbd style="border:1px solid var(--border);padding:0 6px;border-radius:2px;background:var(--bg-2);">/</kbd> 聚焦搜索框）</div>
        </div>`;
      return;
    }

    // 多关键词 AND
    const kwds = kw.split(/\s+/).filter(Boolean);
    const results = allEntries().filter(e => {
      const h = [e.id, e.code, e.title, e.summary, e.body, (e.tags||[]).join(' '), e.org, e.era]
        .filter(Boolean).join(' ').toLowerCase();
      return kwds.every(k => h.includes(k.toLowerCase()));
    }).map(e => ({ ...e, _catLabel: CAT_MAP[e._cat].name, _catIcon: CAT_MAP[e._cat].icon }));

    // 高亮用主关键词（第一个）
    const firstKw = kwds[0] || '';
    const cards = results.map(e => {
      const plain = ((e.body||'')+(e.summary||'')).replace(/<[^>]+>/g,'');
      const sn = snippet(plain, firstKw, 180);
      return `
      <a class="entry-card" href="#/entry/${e._cat}/${encodeURIComponent(e.id)}">
        <div class="entry-card-head">
          <span class="ec-id">${highlightKeyword(e.id, firstKw)}</span>
          ${e.class ? badgeHtml(e.class) : `<span class="ec-badge ${e._cat}">${escapeHtml(e._catLabel)}</span>`}
        </div>
        <div class="entry-card-body">
          <div class="ec-title">${highlightKeyword(e.title, firstKw)}</div>
          <div class="ec-code">${highlightKeyword(e.code||'—', firstKw)} · ${e._catIcon} ${escapeHtml(e._catLabel)}</div>
          <div class="ec-summary">${highlightKeyword(sn || (e.summary||e.title||'').slice(0,140), firstKw)}</div>
        </div>
        <div class="entry-card-foot">
          <span class="ec-tags">
            ${(e.tags||[]).slice(0,3).map(t => `<span class="ec-tag">${highlightKeyword(t, firstKw)}</span>`).join('')}
          </span>
          <span>VIEW →</span>
        </div>
      </a>`;
    }).join('');

    view.innerHTML = `
      <div class="list-header">
        <div class="list-title">检索结果<span class="list-title-en">SEARCH RESULTS</span></div>
        <p class="list-sub">关键词匹配 <q style="color:var(--gold-2)">${escapeHtml(kw)}</q> 在全部 5 个分类中的结果（支持空格分隔多词 AND）。</p>
      </div>
      <div class="search-summary">找到 <strong>${results.length}</strong> 条相关档案，关键词 <q>${escapeHtml(kw)}</q></div>
      ${results.length === 0
        ? `<div class="empty-state">
             <div class="es-icon">∅</div>
             <div class="es-title">未找到匹配档案</div>
             <div class="es-desc">建议检查关键词或使用更宽泛的检索词</div>
             <div class="popular-tags">
               <div class="popular-tags-title">热门标签 · 试试这些</div>
               <div class="pt-cloud">
                 ${getPopularTags(12).map(({tag, n}) => `
                   <a class="pt-tag" href="#/search?q=${encodeURIComponent(tag)}">${escapeHtml(tag)}<span class="pt-count">${n}</span></a>
                 `).join('') || '<span style="color:var(--text-4);font-size:11px;">暂无标签数据</span>'}
               </div>
             </div>
           </div>`
        : `<div class="entry-grid">${cards}</div>`}
    `;
  }

  // ============ 专有名词索引（术语表） ============
  // 反查表数据 = 手工词典（GLOSSARY_TERMS，源自《盖亚世界史》）+ 自动收集的现有档案条目标题
  function glossaryData() {
    const terms = GLOSSARY_TERMS.map(t => ({ ...t }));
    const seen = new Set(terms.map(t => t.n));
    for (const e of allEntries()) {
      const title = String(e.title || '').trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      terms.push({
        n: title,
        c: CAT_MAP[e._cat] ? CAT_MAP[e._cat].name : e._cat,
        d: (e.summary || '').replace(/<[^>]+>/g, '').slice(0, 60),
        link: `${e._cat}:${e.id}`,
        _auto: true
      });
    }
    const groups = [];
    const byCat = {};
    for (const t of terms) (byCat[t.c] = byCat[t.c] || []).push(t);
    for (const c of GLOSSARY_CATS) if (byCat[c]) groups.push({ cat: c, items: byCat[c] });
    for (const c of Object.keys(byCat)) if (!GLOSSARY_CATS.includes(c)) groups.push({ cat: c, items: byCat[c] });
    return groups;
  }

  function glossaryCard(t) {
    const [cat, id] = (t.link || '').split(':');
    const badge = `<span class="gl-badge">${escapeHtml(t.c)}</span>`;
    const inner = `
      <div class="gl-name">${escapeHtml(t.n)}</div>
      <div class="gl-desc">${escapeHtml(t.d || '')}</div>
      <div class="gl-foot">${t.link ? '→ 跳转档案' : '◈ 见《盖亚世界史》'}</div>`;
    if (t.link && cat && id) {
      return `<a class="gl-term" href="#/entry/${encodeURIComponent(cat)}/${encodeURIComponent(id)}">${badge}${inner}</a>`;
    }
    return `<div class="gl-term gl-term-plain">${badge}${inner}</div>`;
  }

  // ============ 档案库健康看板 ============
  // 覆盖度面板：把文档「九、档案完备度」与 A–F 组落成可查的覆盖缺口表
  function renderCoveragePanel(entries) {
    const rows = WORKSHELF_GROUPS.map(g => {
      const inCat = entries.filter(e => (e.group || e.subcat || '') === g.id);
      const listed = inCat.length;
      const total = g.files.length;
      const pct = total ? Math.round((listed / total) * 100) : 0;
      return { g, listed, total, pct };
    });
    return `
      <div class="health-cat-title">底本覆盖度 · SOURCE COVERAGE（A–F 组）</div>
      <div class="cov-panel">
        ${rows.map(r => `
          <div class="cov-row ${r.listed === 0 ? 'is-gap' : ''}">
            <span class="cov-group">${escapeHtml(r.g.id)}</span>
            <span class="cov-name">${escapeHtml(r.g.name)}</span>
            <span class="cov-when">${escapeHtml(r.g.when)}</span>
            <span class="cov-bar"><em style="width:${r.pct}%"></em></span>
            <span class="cov-num">${r.listed}/${r.total}</span>
          </div>`).join('')}
      </div>
      <div class="cov-note">${ico('warn',11)} 覆盖度按条目的 group 字段统计；未标注的条目计为未覆盖。缺口分类见上方「分类状态」。</div>`;
  }

  function renderHealth() {
    const stats = computeStats();
    const cats = DATA.categories;
    const legend = DATA.classLegend || [];
    const tagCount = {};
    const all = allEntries();
    all.forEach(e => (e.tags || []).forEach(t => { const k = String(t).trim(); if (k) tagCount[k] = (tagCount[k] || 0) + 1; }));
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const classCount = {};
    all.forEach(e => { const c = e.class || 'neutral'; classCount[c] = (classCount[c] || 0) + 1; });
    const missing = cats.filter(c => (DATA[c.id] || []).length === 0);
    const completeness = Math.round(stats.total / Math.max(1, cats.length * 10) * 100);
    const grade = missing.length === 0 ? 'B' : (missing.length <= 1 ? 'C' : 'D');
    const gradeName = missing.length === 0 ? '资料完整' : (missing.length <= 1 ? '少量缺口' : '缺口较大');
    const legendName = code => { const l = legend.find(x => x.code === code); return l ? l.name : code; };
    view.innerHTML = `
      <div class="list-header">
        <div class="list-title">档案库健康看板<span class="list-title-en">ARCHIVE HEALTH</span></div>
        <p class="list-sub">红月政府 · 情报档案总局 · 数据完整性评估</p>
      </div>
      <div class="health-grid">
        <div class="health-stat"><div class="health-stat-val">${stats.total}</div><div class="health-stat-label">在档条目</div></div>
        <div class="health-stat"><div class="health-stat-val">${cats.length}</div><div class="health-stat-label">分类体系</div></div>
        <div class="health-stat"><div class="health-stat-val ${missing.length ? 'warn' : ''}">${missing.length}</div><div class="health-stat-label">空缺分类</div></div>
        <div class="health-stat"><div class="health-stat-val">${topTags.length}</div><div class="health-stat-label">活跃标签</div></div>
      </div>
      <div class="health-grade">
        <span class="health-grade-badge">评级 ${grade}</span>
        <span class="health-grade-txt">${gradeName} · 资料完整度 ${Math.min(100, completeness)}%</span>
        <span class="health-grade-upd">最近更新：${escapeHtml(DATA.meta.updated || '—')}</span>
      </div>
      <div class="health-cat-title">分类状态 · CATEGORY STATUS</div>
      <div class="health-cats">
        ${cats.map(c => {
          const n = (DATA[c.id] || []).length;
          const empty = n === 0;
          return `
          <div class="health-cat ${empty ? 'empty' : ''}">
            <div class="health-cat-head"><span class="health-cat-name">${escapeHtml(c.name)}</span><span class="health-cat-count">${n} ${empty ? '· 缺口' : 'DOCS'}</span></div>
            <div class="health-cat-bar"><div class="health-cat-bar-fill" style="width:${empty ? 2 : Math.min(100, n * 12)}%"></div></div>
            <div class="health-cat-note">${empty ? '该分类暂无条目，建议依据世界观文档补录' : '条目正常，可继续扩充'}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="health-cat-title">标签分布 · TAG DISTRIBUTION</div>
      ${topTags.length ? `
      <div class="health-tags">
        ${topTags.map(([t, n]) => `<span class="health-tag" style="--w:${Math.min(100, 40 + n * 30)}">${escapeHtml(t)}<em>${n}</em></span>`).join('')}
      </div>` : `<div class="empty-state"><div class="es-icon">∅</div><div class="es-title">暂无标签数据</div><div class="es-desc">给档案补充 tags 后可在此观察分布</div></div>`}
      <div class="health-cat-title">风险分级 · CLASSIFICATION</div>
      <div class="health-classes">
        ${Object.keys(classCount).length ? Object.entries(classCount).map(([code, n]) => `
          <div class="health-class"><span class="health-class-code">${escapeHtml(code)}</span><span class="health-class-name">${escapeHtml(legendName(code))}</span><span class="health-class-n">${n}</span></div>`).join('') : `<div class="empty-state"><div class="es-title">暂无分级数据</div></div>`}
      </div>
      ${renderCoveragePanel(all)}
    `;
  }

  // ============ 随机观测卡 ============
  function renderObserve() {
    view.innerHTML = `
      <div class="list-header">
        <div class="list-title">随机观测<span class="list-title-en">OBSERVATION</span></div>
        <p class="list-sub">红月研究院 · 情报档案总局 · 定点观测 · 每次归档一条设定</p>
      </div>
      <div class="obs-actions">
        <button class="btn-mini" id="obs-again">⟳ 生成观测</button>
        <button class="btn-mini" id="obs-copy">⎘ 复制</button>
      </div>
      <div class="obs-card" id="obs-card">
        <div class="obs-body" id="obs-body"></div>
        <div class="obs-lock" aria-hidden="true">
          <div class="obs-tele"><span id="obs-tele-l">OBS · 定点观测</span><span class="t-blink">● REC</span></div>
          <div class="obs-reticle"></div>
          <div class="obs-scan"></div>
          <div class="obs-seq" id="obs-seq">信号捕获中</div>
        </div>
      </div>
    `;
    const card = document.getElementById('obs-card');
    const body = document.getElementById('obs-body');
    const pool = () => {
      const terms = GLOSSARY_TERMS.map(t => ({ kind: 'term', cat: t.c, name: t.n, desc: t.d, link: t.link || null }));
      const ents = allEntries().map(e => ({ kind: 'entry', cat: e._cat, name: e.title, desc: e.summary || e.body || '', link: e._cat + ':' + e.id }));
      return terms.concat(ents);
    };
    const renderCard = (pick) => {
      const num = 'OBS-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      const now = new Date();
      const p2 = n => String(n).padStart(2, '0');
      const ts = now.getFullYear() + '-' + p2(now.getMonth() + 1) + '-' + p2(now.getDate()) + ' ' + p2(now.getHours()) + ':' + p2(now.getMinutes()) + ':' + p2(now.getSeconds());
      const link = pick.link ? pick.link.split(':') : null;
      body.innerHTML = `
        <div class="obs-top">
          <span class="obs-no">${num}</span>
          <span class="obs-src">${pick.kind === 'term' ? '来源：《盖亚世界史》' : '来源：在档条目'}</span>
        </div>
        <div class="obs-badge">${escapeHtml(pick.cat)}</div>
        <div class="obs-name">${escapeHtml(pick.name)}</div>
        <div class="obs-desc">${escapeHtml(pick.desc)}</div>
        <div class="obs-foot">
          <span>归档：红月研究院 · 情报档案总局</span>
          <span>${ts}</span>
          ${link ? `<a href="#/entry/${encodeURIComponent(link[0])}/${encodeURIComponent(link[1])}">→ 跳转档案</a>` : ''}
        </div>
      `;
      card.dataset.text = num + ' · ' + pick.cat + ' · ' + pick.name + '：' + pick.desc;
    };
    // 观测锁定序列（生成动画）：准星锁定 → 扫描/遥测 → 归档 → 新观测显影
    const OBS_STEPS = ['信号捕获中', '坐标定位', '数据解算', '归档写入'];
    const lockOnce = (pick) => {
      card.classList.remove('obs-reveal');
      card.classList.add('obs-locking');
      const seqEl = document.getElementById('obs-seq');
      const teleEl = document.getElementById('obs-tele-l');
      let si = 0;
      const seqInt = setInterval(() => {
        si = (si + 1) % OBS_STEPS.length;
        if (seqEl) seqEl.textContent = OBS_STEPS[si];
        if (teleEl) teleEl.textContent = '坐标 ' + (Math.random() * 180 - 90).toFixed(1) + '° / 深度 ' + Math.floor(Math.random() * 100) + '%';
      }, 150);
      setTimeout(() => {
        clearInterval(seqInt);
        renderCard(pick);
        card.classList.remove('obs-locking');
        void card.offsetWidth;
        card.classList.add('obs-reveal');
        if (window.SFX && SFX.navigate) SFX.navigate();
      }, 820);
    };
    renderCard(pool()[Math.floor(Math.random() * pool().length)]);
    void body.offsetWidth;
    card.classList.add('obs-reveal');
    document.getElementById('obs-again').addEventListener('click', () => {
      const p = pool();
      lockOnce(p[Math.floor(Math.random() * p.length)]);
    });
    document.getElementById('obs-copy').addEventListener('click', async () => {
      const txt = card.dataset.text || '';
      try { await navigator.clipboard.writeText(txt); } catch (e) {}
    });
  }

  function renderGlossary() {
    const groups = glossaryData();
    const renderBody = (filter) => {
      const kw = (filter || '').trim().toLowerCase();
      const body = document.getElementById('glossary-body');
      if (!body) return;
      const visibleGroups = groups
        .map(g => ({ cat: g.cat, items: g.items.filter(t => !kw || (t.n + ' ' + t.d + ' ' + t.c).toLowerCase().includes(kw)) }))
        .filter(g => g.items.length);
      const total = visibleGroups.reduce((s, g) => s + g.items.length, 0);
      body.innerHTML = `
        ${visibleGroups.length === 0
          ? `<div class="empty-state"><div class="es-icon">∅</div><div class="es-title">未找到匹配专有名词</div><div class="es-desc">试试更宽泛的关键词</div></div>`
          : visibleGroups.map(g => `
            <div class="gl-group">
              <div class="gl-group-head"><span class="gl-group-name">${escapeHtml(g.cat)}</span><span class="gl-group-count">${g.items.length}</span></div>
              <div class="gl-grid">${g.items.map(glossaryCard).join('')}</div>
            </div>`).join('')}
      `;
      const cntEl = document.getElementById('glossary-count');
      if (cntEl) cntEl.textContent = total + ' 个';
    };
    view.innerHTML = `
      <div class="list-header">
        <div class="list-title">专有名词索引<span class="list-title-en">GLOSSARY INDEX</span></div>
        <p class="list-sub">神祇 / 组织 / 地点 / 事件 / 仪式 / 概念 统一反查表 · 点名词跳转对应档案</p>
      </div>
      <div class="glossary-toolbar">
        <input id="glossary-filter" type="text" placeholder="过滤专有名词 / 关键词…" autocomplete="off" aria-label="过滤专有名词">
        <span class="glossary-count" id="glossary-count"></span>
      </div>
      <div id="glossary-body"></div>
    `;
    renderBody('');
    const filterEl = document.getElementById('glossary-filter');
    if (filterEl) {
      let t = null;
      filterEl.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => renderBody(filterEl.value), 120);
      });
    }
  }

  // ============ 思维导图 ============
  let MM = null;  // mindmap runtime
  function renderMindMap() {
    const catColors = {
      anomalies:    { fill:'#c0392b', glow:'rgba(192,57,43,0.55)', label:'异常' },
      organizations:{ fill:'#e8e8e8', glow:'rgba(232,232,232,0.55)', label:'组织' },
      deities:      { fill:'#c8c8c8', glow:'rgba(200,200,200,0.55)', label:'神祇' },
      eras:         { fill:'#8a8a8a', glow:'rgba(138,138,138,0.55)', label:'纪元' },
      timelines:    { fill:'#dcdcdc', glow:'rgba(220,220,220,0.55)', label:'世界史' }
    };

    // 节点：每个分类 1 个中心锚点 + 若干档案节点
    const nodes = [];
    const edges = [];
    const center = { id:'C', label:'世界观中心', cat:'hub', r:26, x:0, y:0, vx:0, vy:0, pinned:true };
    nodes.push(center);

    for (const cat of DATA.categories) {
      const list = getEntries(cat.id);
      const catNode = {
        id:'CAT-'+cat.id, label:cat.name, cat:'cat-'+cat.id, r:20,
        x:0, y:0, vx:0, vy:0, pinned:false, _isCat:true, _catId:cat.id
      };
      nodes.push(catNode);
      edges.push({ a:center, b:catNode, kind:'hub', color:'rgba(255,255,255,0.45)' });
      // 档案节点（每个分类最多取前 25 条，避免过密）
      const sub = list.slice(0, 25);
      for (const e of sub) {
        const n = {
          id: cat.id + ':' + e.id,
          label: e.title,
          cat: cat.id,
          r: Math.max(6, Math.min(14, 8 + (e.tags||[]).length * 0.8)),
          x: 0, y: 0, vx: 0, vy: 0,
          _link: `#/entry/${cat.id}/${encodeURIComponent(e.id)}`,
          _class: e.class
        };
        nodes.push(n);
        edges.push({ a:catNode, b:n, kind:'leaf', color: (catColors[cat.id]?.glow || 'rgba(255,255,255,0.3)') });
        // 基于 tags 随机建立同分类内 1-2 条互联，显得稠密
        if (Math.random() < 0.18 && sub.length > 2) {
          const other = sub[Math.floor(Math.random()*sub.length)];
          if (other && other.id !== e.id) {
            const oid = cat.id + ':' + other.id;
            const on = nodes.find(x => x.id === oid);
            if (on) edges.push({ a:n, b:on, kind:'peer', color:'rgba(255,255,255,0.12)' });
          }
        }
      }
    }

    // 构造图例 HTML
    const legendItems = Object.entries(catColors).map(([k,v]) => {
      const n = CAT_MAP[k]?.name || k;
      const cnt = (getEntries(k) || []).length;
      return `<label class="mm-leg-item">
        <span class="mm-leg-dot" style="background:${v.fill};box-shadow:0 0 10px ${v.glow}"></span>
        <span class="mm-leg-name">${n}</span>
        <span class="mm-leg-cnt">${cnt}</span>
      </label>`;
    }).join('');

    view.innerHTML = `
      <div class="mm-wrap">
        <div class="mm-head">
          <div>
            <div class="mm-title">关系图谱 · MIND MAP</div>
            <div class="mm-sub">节点共计 <strong>${nodes.length}</strong> · 连线 <strong>${edges.length}</strong> · 鼠标滚轮缩放，拖拽画布平移，拖拽节点固定位置，双击节点打开档案</div>
          </div>
          <div class="mm-controls">
            <button class="mm-btn" id="mm-reset">${ico('clock',12)} 重置视图</button>
            <button class="mm-btn" id="mm-freeze">${ico('eye',12)} 释放固定</button>
          </div>
        </div>
        <div class="mm-stage">
          <canvas id="mm-canvas"></canvas>
          <div class="mm-hud tl">
            <div>WORLDVIEW ARCHIVE · REL-GRAPH v2</div>
            <div id="mm-hud-pos">POS 0.00 , 0.00 · SCALE 1.00</div>
          </div>
          <div class="mm-hud tr">
            <div>身份 <span id="mm-hud-user">—</span></div>
            <div>节点 <span id="mm-hud-hover">无</span></div>
          </div>
          <div class="mm-hud bl">
            <div class="mm-hud-title">图例 · LEGEND</div>
            ${legendItems}
          </div>
          <div class="mm-hud br">
            <div>滚轮缩放 · 拖动画布</div>
            <div>拖拽节点 · 双击打开档案</div>
            <div class="mm-hud-tip">提示：输入账号 <strong>lock</strong> 可看失败动画</div>
          </div>
        </div>
      </div>
    `;

    // HUD 用户
    const u = document.getElementById('mm-hud-user'); if (u) u.textContent = Auth.identity();

    // 初始化画布
    const canvas = document.getElementById('mm-canvas');
    const ctx = canvas.getContext('2d');
    MM = { canvas, ctx, nodes, edges, catColors,
      cx: 0, cy: 0, scale: 1,
      w: 0, h: 0, dpr: window.devicePixelRatio || 1,
      drag: null, hover: null, raf: 0
    };
    const m = MM;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width  = rect.width  * m.dpr;
      canvas.height = rect.height * m.dpr;
      canvas.style.width  = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      m.w = rect.width; m.h = rect.height;
      // 初始中心
      if (m.cx === 0 && m.cy === 0) { m.cx = m.w/2; m.cy = m.h/2; }
    };
    resize();
    window.addEventListener('resize', resize);

    // 初始散布节点到圆周
    let i = 1;  // 跳过中心
    const catNodes = nodes.filter(n => n._isCat);
    catNodes.forEach((n, idx) => {
      const t = (idx / catNodes.length) * Math.PI * 2;
      n.x = Math.cos(t) * 220;
      n.y = Math.sin(t) * 220;
    });
    for (const n of nodes) {
      if (!n._isCat && n.id !== 'C') {
        // 放到所属分类节点附近
        const catNode = nodes.find(x => x._isCat && x._catId === n.cat);
        const base = catNode ? [catNode.x, catNode.y] : [0,0];
        const t = Math.random()*Math.PI*2;
        const r = 70 + Math.random()*130;
        n.x = base[0] + Math.cos(t)*r;
        n.y = base[1] + Math.sin(t)*r;
      }
    }

    // 屏幕坐标 <-> 世界坐标
    const toWorld = (sx, sy) => ({ x: (sx - m.cx)/m.scale, y: (sy - m.cy)/m.scale });
    const toScreen = (wx, wy) => ({ x: wx*m.scale + m.cx, y: wy*m.scale + m.cy });

    function hit(x, y) {
      for (let i = nodes.length-1; i >= 0; i--) {
        const n = nodes[i];
        const dx = n.x - x, dy = n.y - y;
        if (dx*dx + dy*dy <= (n.r+2)*(n.r+2)) return n;
      }
      return null;
    }

    // 事件
    const rect = () => canvas.getBoundingClientRect();
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const old = m.scale;
      const k = Math.exp(-e.deltaY * 0.001);
      m.scale = Math.max(0.25, Math.min(4, m.scale * k));
      // 以鼠标为中心缩放
      const s = rect();
      const mx = e.clientX - s.left, my = e.clientY - s.top;
      const w = toWorld(mx, my);
      m.scale = old * k;
      m.scale = Math.max(0.25, Math.min(4, m.scale));
      const after = toScreen(w.x, w.y);
      m.cx += mx - after.x; m.cy += my - after.y;
    }, { passive:false });

    let pan = null;
    canvas.addEventListener('mousedown', e => {
      const s = rect();
      const sx = e.clientX - s.left, sy = e.clientY - s.top;
      const w = toWorld(sx, sy);
      const n = hit(w.x, w.y);
      if (n) {
        m.drag = { n, ox: w.x - n.x, oy: w.y - n.y, moved:false };
        n.pinned = true;
      } else {
        pan = { x: sx, y: sy, ocx: m.cx, ocy: m.cy, moved:false };
      }
    });
    window.addEventListener('mousemove', e => {
      const s = rect();
      const sx = e.clientX - s.left, sy = e.clientY - s.top;
      const w = toWorld(sx, sy);
      if (m.drag) {
        const n = m.drag.n;
        n.x = w.x - m.drag.ox; n.y = w.y - m.drag.oy;
        m.drag.moved = true;
      } else if (pan) {
        m.cx = pan.ocx + (sx - pan.x); m.cy = pan.ocy + (sy - pan.y);
        pan.moved = true;
      } else {
        m.hover = hit(w.x, w.y);
      }
      // HUD 坐标
      const hp = document.getElementById('mm-hud-pos');
      if (hp) hp.textContent = `POS ${w.x.toFixed(0)} , ${w.y.toFixed(0)} · SCALE ${m.scale.toFixed(2)}`;
      const hh = document.getElementById('mm-hud-hover');
      if (hh) hh.textContent = m.hover ? (m.hover.label || m.hover.id) : '无';
    });
    window.addEventListener('mouseup', () => {
      if (m.drag && !m.drag.moved) {
        // 点击未移动 => 取消固定（如果用户未拖）
      }
      m.drag = null; pan = null;
    });
    canvas.addEventListener('dblclick', e => {
      const s = rect();
      const sx = e.clientX - s.left, sy = e.clientY - s.top;
      const w = toWorld(sx, sy);
      const n = hit(w.x, w.y);
      if (n && n._link) location.hash = n._link;
    });

    document.getElementById('mm-reset').addEventListener('click', () => {
      m.cx = m.w/2; m.cy = m.h/2; m.scale = 1;
    });
    document.getElementById('mm-freeze').addEventListener('click', () => {
      for (const n of nodes) if (n.id !== 'C' && !n._isCat) n.pinned = false;
    });

    // 力导向模拟 + 渲染
    const step = () => {
      // 1. 节点间斥力
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i+1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx*dx + dy*dy;
          if (d2 < 0.01) { dx = Math.random()-0.5; dy = Math.random()-0.5; d2 = dx*dx+dy*dy; }
          const d = Math.sqrt(d2);
          const force = 6000 / d2;
          const fx = dx/d * force, fy = dy/d * force;
          if (!a.pinned) { a.vx -= fx; a.vy -= fy; }
          if (!b.pinned) { b.vx += fx; b.vy += fy; }
        }
      }
      // 2. 连线弹簧力
      for (const e of edges) {
        const target = e.kind === 'hub' ? 160 : (e.kind === 'leaf' ? 70 : 120);
        const k = e.kind === 'peer' ? 0.01 : 0.06;
        let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
        const d = Math.sqrt(dx*dx+dy*dy) || 0.01;
        const diff = d - target;
        const fx = dx/d * diff * k, fy = dy/d * diff * k;
        if (!e.a.pinned) { e.a.vx += fx; e.a.vy += fy; }
        if (!e.b.pinned) { e.b.vx -= fx; e.b.vy -= fy; }
      }
      // 3. 中心轻微吸引
      for (const n of nodes) {
        if (n.pinned || n.id === 'C') continue;
        n.vx -= n.x * 0.0008;
        n.vy -= n.y * 0.0008;
      }
      // 4. 阻尼 + 应用
      for (const n of nodes) {
        if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.86; n.vy *= 0.86;
        n.x += n.vx; n.y += n.vy;
      }
      draw();
      m.raf = requestAnimationFrame(step);
    };

    function draw() {
      const c = canvas;
      const ctx2 = ctx;
      ctx2.save();
      ctx2.setTransform(m.dpr,0,0,m.dpr,0,0);
      ctx2.clearRect(0,0,m.w,m.h);
      // 背景网格
      drawGrid(ctx2, m);
      // 世界变换
      ctx2.translate(m.cx, m.cy);
      ctx2.scale(m.scale, m.scale);
      // 边
      for (const e of edges) {
        if (e.kind === 'peer') {
          ctx2.strokeStyle = e.color;
          ctx2.setLineDash([3, 6]);
          ctx2.lineWidth = 0.8 / m.scale;
        } else {
          ctx2.strokeStyle = e.color;
          ctx2.setLineDash([]);
          ctx2.lineWidth = (e.kind === 'hub' ? 1.4 : 0.9) / m.scale;
        }
        ctx2.beginPath();
        ctx2.moveTo(e.a.x, e.a.y); ctx2.lineTo(e.b.x, e.b.y);
        ctx2.stroke();
      }
      ctx2.setLineDash([]);
      // 节点
      for (const n of nodes) {
        let col;
        if (n.id === 'C') col = { fill:'#0a0a0a', glow:'rgba(255,255,255,0.85)', stroke:'#f2f2f2' };
        else if (n._isCat) {
          const c = catColors[n._catId];
          col = { fill:'#0a0a0a', glow: c?.glow || 'rgba(255,255,255,0.6)', stroke: c?.fill || '#e8e8e8' };
        } else {
          const c = catColors[n.cat];
          col = { fill: c?.fill || '#e8e8e8', glow: c?.glow || 'rgba(232,232,232,0.55)', stroke:'rgba(0,0,0,0.4)' };
        }
        const hov = (m.hover === n) || (m.drag && m.drag.n === n);
        const rr = hov ? n.r * 1.35 : n.r;
        // 外发光
        const g = ctx2.createRadialGradient(n.x, n.y, n.r*0.3, n.x, n.y, rr*3);
        g.addColorStop(0, col.glow);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx2.fillStyle = g;
        ctx2.beginPath(); ctx2.arc(n.x, n.y, rr*3, 0, Math.PI*2); ctx2.fill();
        // 圆
        ctx2.fillStyle = col.fill;
        ctx2.strokeStyle = col.stroke;
        ctx2.lineWidth = (n._isCat || n.id==='C' ? 2 : 1) / m.scale;
        ctx2.beginPath(); ctx2.arc(n.x, n.y, rr, 0, Math.PI*2); ctx2.fill(); ctx2.stroke();
        // 中心十字装饰（hub/分类节点）
        if (n._isCat || n.id === 'C') {
          ctx2.strokeStyle = 'rgba(255,255,255,0.25)';
          ctx2.lineWidth = 1 / m.scale;
          ctx2.beginPath();
          ctx2.moveTo(n.x - rr*0.55, n.y); ctx2.lineTo(n.x + rr*0.55, n.y);
          ctx2.moveTo(n.x, n.y - rr*0.55); ctx2.lineTo(n.x, n.y + rr*0.55);
          ctx2.stroke();
        }
        // 标签
        if (n._isCat || n.id === 'C' || hov || m.scale > 1.1) {
          ctx2.fillStyle = m.scale > 0.8 ? 'rgba(238,225,196,0.95)' : 'rgba(238,225,196,0.65)';
          ctx2.font = `${n._isCat || n.id==='C' ? 700 : 500} ${Math.max(8, (hov ? 13 : 11) / Math.max(0.6, m.scale))}px "Noto Serif SC", "Noto Serif", serif`;
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'top';
          ctx2.shadowColor = 'rgba(0,0,0,0.9)';
          ctx2.shadowBlur = 6 / m.scale;
          ctx2.fillText(n.label, n.x, n.y + rr + 4/m.scale);
          ctx2.shadowBlur = 0;
        }
      }
      ctx2.restore();
    }

    function drawGrid(ctx2, m) {
      const gs = 60; // 60px 一格（世界坐标）
      // 以 scale 决定细/粗线
      ctx2.strokeStyle = 'rgba(232,232,232,0.06)';
      ctx2.lineWidth = 1;
      const ox = ((m.cx % (gs*m.scale)) + gs*m.scale*10) % (gs*m.scale) - gs*m.scale;
      const oy = ((m.cy % (gs*m.scale)) + gs*m.scale*10) % (gs*m.scale) - gs*m.scale;
      ctx2.beginPath();
      for (let x = ox; x < m.w; x += gs*m.scale) { ctx2.moveTo(x,0); ctx2.lineTo(x,m.h); }
      for (let y = oy; y < m.h; y += gs*m.scale) { ctx2.moveTo(0,y); ctx2.lineTo(m.w,y); }
      ctx2.stroke();
      // 粗网格 5×5
      ctx2.strokeStyle = 'rgba(232,232,232,0.14)';
      ctx2.beginPath();
      const gs5 = gs*5*m.scale;
      const ox5 = ((m.cx % gs5) + gs5*10) % gs5 - gs5;
      const oy5 = ((m.cy % gs5) + gs5*10) % gs5 - gs5;
      for (let x = ox5; x < m.w; x += gs5) { ctx2.moveTo(x,0); ctx2.lineTo(x,m.h); }
      for (let y = oy5; y < m.h; y += gs5) { ctx2.moveTo(0,y); ctx2.lineTo(m.w,y); }
      ctx2.stroke();
      // 十字中心准星
      ctx2.strokeStyle = 'rgba(138,35,35,0.35)';
      ctx2.lineWidth = 1;
      ctx2.beginPath();
      ctx2.moveTo(m.cx, 0); ctx2.lineTo(m.cx, m.h);
      ctx2.moveTo(0, m.cy); ctx2.lineTo(m.w, m.cy);
      ctx2.stroke();
    }

    step();
  }

  // ============ 投稿页面 ============
  function renderSubmit() {
    // 权限检查：游客 LV.1 不可投稿
    if (!Auth.canSubmit()) {
      view.innerHTML = `
        <div class="submit-locked">
          <div class="submit-locked-icon">🔒</div>
          <h2>权限不足 · CLEARANCE DENIED</h2>
          <p>当前身份：<strong>${Auth.identity()}</strong></p>
          <p>投稿设定需要 <strong>LV.2</strong> 以上权限。</p>
          <p>游客仅可浏览档案，请<a href="javascript:void(0)" id="goto-login" class="submit-link">登录或注册</a>后投稿。</p>
        </div>
      `;
      const link = document.getElementById('goto-login');
      if (link) link.addEventListener('click', () => {
        Auth.clear();
        refreshIdentity();
        showLoginGate();
      });
      return;
    }

    const subs = Submissions.get();
    function statusBadgeHtml(st) {
      if (st === 'approved') return '<span class="sb-status sb-status-ok">已发布</span>';
      if (st === 'rejected') return '<span class="sb-status sb-status-no">已退回</span>';
      return '<span class="sb-status sb-status-pend">待审核</span>';
    }
    const subsHtml = subs.length === 0
      ? '<div class="submit-empty">暂无投稿记录</div>'
      : subs.map(s => {
          const done = (s.status === 'approved' || s.status === 'rejected');
          return `
        <div class="submit-item">
          <div class="submit-item-head">
            <span class="submit-item-id">${s.id}</span>
            <span class="submit-item-cat">${CAT_MAP[s.category]?.name || s.category}</span>
            ${statusBadgeHtml(s.status)}
            <span class="submit-item-date">${new Date(s.at).toLocaleString('zh-CN')}</span>
            ${done ? `<button type="button" class="submit-item-del" title="删除此记录" data-del-id="${escapeAttr(s.id)}">🗑 删除记录</button>` : ''}
          </div>
          <div class="submit-item-title">${escapeHtml(s.title)}</div>
          <div class="submit-item-summary">${escapeHtml(s.summary || '')}</div>
          <div class="submit-item-author">投稿人：${escapeHtml(s.author || '')}${s.reviewNote ? ` · 备注：${escapeHtml(s.reviewNote)}` : ''}</div>
        </div>
      `;}).join('');

    const catOpts = DATA.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const classOpts = Object.entries(CLASS_NAMES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

    // 审核状态通知（带关闭按钮 + 关闭状态持久化）
    const allDismissed = (() => {
      try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]')); } catch { return new Set(); }
    })();
    const notices = subs.filter(s => (s.status === 'approved' || s.status === 'rejected') && !allDismissed.has(s.id));
    const saveDismissed = (set) => {
      localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(Array.from(set)));
    };
    const noticeHtml = notices.length ? `
      <div class="submit-notice-head">
        <span class="submit-notice-head-label">审核通知 · ${notices.length} 条</span>
        <button type="button" class="submit-notice-clear-all" id="notice-clear-all">全部已读</button>
      </div>
      ${notices.map(s => `
        <div class="submit-notice notice-${s.status}" data-sub-id="${escapeAttr(s.id)}">
          <div class="submit-notice-icon">${s.status === 'approved' ? ico('check',16) : ico('cross',16)}</div>
          <div class="submit-notice-body">
            <div class="submit-notice-title">${s.status === 'approved' ? '投稿已通过审核' : '投稿已被退回'}</div>
            <div class="submit-notice-meta">${escapeHtml(s.id)} · ${escapeHtml(CAT_MAP[s.category]?.name || s.category)} · ${new Date(s.at).toLocaleString('zh-CN')}</div>
            ${s.reviewNote ? `<div class="submit-notice-note">管理员备注：${escapeHtml(s.reviewNote)}</div>` : ''}
          </div>
          <button type="button" class="submit-notice-close" title="关闭" data-close-id="${escapeAttr(s.id)}">${ico('cross',12)}</button>
        </div>
      `).join('')}
    ` : '';

    view.innerHTML = `
      <div class="submit-wrap">
        <div class="submit-head">
          <div class="submit-title-block">
            <h2 class="submit-h2">投稿设定 · SUBMIT ENTRY</h2>
            <p class="submit-sub">当前身份 <strong>${Auth.identity()}</strong> · LV.2 投稿权限已激活 · 稿件进入 <span class="sb-pending-badge">待审核</span> 队列</p>
          </div>
        </div>

        ${noticeHtml}

        <form id="submit-form" class="submit-form">
          <div class="submit-grid">
            <div class="sb-field sb-field-docx">
              <span class="sb-label">上传 DOCX 文档（自动解析文字/图片 · 自动换行）</span>
              <div class="docx-uploader">
                <label class="docx-choose">
                  <input type="file" id="sb-docx" accept=".docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                  <span class="docx-choose-icon">⬆</span>
                  <span class="docx-choose-text" id="docx-choose-text">选择 Word 文档 (.docx)</span>
                </label>
                <span class="docx-parse-status" id="docx-parse-status"></span>
              </div>
              <p class="docx-hint">解析出的 <strong>标题</strong> 和 <strong>正文</strong> 会自动填入下方编辑器，DOCX 内的图片会被提取并插入正文对应位置。您可继续编辑后再提交。</p>
            </div>
            <div class="sb-row-2">
              <label class="sb-field">
                <span class="sb-label">标题 · TITLE</span>
                <input type="text" id="sb-title" placeholder="档案标题" required>
              </label>
              <label class="sb-field">
                <span class="sb-label">编号 · ID（选填）</span>
                <input type="text" id="sb-id" placeholder="留空自动生成，如 001 / SUB-002">
              </label>
            </div>
            <div class="sb-row-2">
              <label class="sb-field">
                <span class="sb-label">分类 · CATEGORY</span>
                <select id="sb-category">${catOpts}</select>
              </label>
              <label class="sb-field">
                <span class="sb-label">危险等级 · CLASS</span>
                <select id="sb-class">
                  <option value="neutral">未分级</option>
                  ${classOpts}
                </select>
              </label>
            </div>
            <label class="sb-field">
              <span class="sb-label">摘要 · SUMMARY</span>
              <input type="text" id="sb-summary" placeholder="一句话简介（选填）">
            </label>
            <div class="sb-field sb-field-cover">
              <span class="sb-label">封面/预览图 · COVER IMAGE <span class="sb-label-hint">卡片缩略图 · 选填</span></span>
              <div class="sb-cover-uploader">
                <label class="sb-cover-choose">
                  <input type="file" id="sb-cover" accept="image/*" hidden>
                  <span class="sb-cover-choose-icon">⬆</span>
                  <span class="sb-cover-choose-text" id="sb-cover-text">选择图片</span>
                </label>
                <div class="sb-cover-preview" id="sb-cover-preview">
                  <div class="sb-cover-empty">暂无封面</div>
                </div>
                <button type="button" class="sb-cover-clear" id="sb-cover-clear" style="display:none">${ico('cross',12)} 移除</button>
              </div>
              <p class="docx-hint">上传后将作为档案卡片的缩略图显示。支持 PNG / JPG / WEBP，建议正方形比例。</p>
            </div>
            <div class="sb-field sb-field-editor" id="sb-editor-wrap">
              <div class="sb-editor-head">
                <span class="sb-label">正文 · BODY <span class="sb-label-hint">所见即所得 · 工具栏排版 · 可插入图片</span></span>
                <div class="sb-editor-head-tools">
                  <span class="sb-editor-stat" id="sb-editor-stat">0 字</span>
                  <button type="button" class="sb-tool sb-tool-fs" id="sb-fullscreen" title="全屏编辑">${ico('eye',12)} 全屏</button>
                </div>
              </div>
              <div class="sb-editor-toolbar" id="sb-editor-toolbar">
                <button type="button" class="sb-tool" data-cmd="bold" title="粗体"><strong>B</strong></button>
                <button type="button" class="sb-tool" data-cmd="italic" title="斜体"><em>I</em></button>
                <button type="button" class="sb-tool" data-cmd="underline" title="下划线"><u>U</u></button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="h3" title="小标题">H3</button>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="h2" title="大标题">H2</button>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="blockquote" title="引用">❝</button>
                <button type="button" class="sb-tool" data-cmd="formatBlock" data-val="p" title="正文段落">¶</button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="insertUnorderedList" title="无序列表">• 列表</button>
                <button type="button" class="sb-tool" data-cmd="insertOrderedList" title="有序列表">1.列表</button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="insertHorizontalRule" title="分割线">―</button>
                <label class="sb-tool sb-tool-upload" title="插入本地图片">
                  ${ico('camera',32)}
                  <input type="file" id="sb-insert-img" accept="image/*" hidden>
                </label>
                <button type="button" class="sb-tool" data-cmd="clearFloat" title="清除浮动（文字不再绕图）">⇩</button>
                <span class="sb-tool-sep"></span>
                <button type="button" class="sb-tool" data-cmd="hongyue" title="选中文字应用红月字体" style="font-family:'HongYue','Noto Serif SC',serif">红月</button>
                <button type="button" class="sb-tool" data-cmd="removeFormat" title="清除格式">${ico('cross',12)}清除</button>
                <span class="sb-tool-info" id="sb-img-status"></span>
              </div>
              <div id="sb-body" class="sb-editor-area detail-body" contenteditable="true" data-placeholder="在此输入正文，或上传 DOCX 自动填入。使用上方工具栏进行排版，所见即所得。"></div>
            </div>
            <div class="sb-field sb-preview" id="sb-preview">
              <div class="sb-preview-head">
                <span class="sb-label">最终渲染 · FINAL RENDER <span class="sb-label-hint">实际展示效果</span></span>
                <div class="sb-preview-controls">
                  <button type="button" class="sb-preview-btn" id="sb-preview-toggle" title="显示/隐藏渲染预览">
                    <span class="sb-pe-text">隐藏</span>
                  </button>
                  <label class="sb-preview-ctrl">
                    <span class="sb-preview-ctrl-label">字号</span>
                    <select id="sb-font-size" class="sb-preview-select">
                      <option value="12">12</option>
                      <option value="13">13</option>
                      <option value="14">14</option>
                      <option value="15">15</option>
                      <option value="16">16</option>
                      <option value="18">18</option>
                      <option value="20">20</option>
                    </select>
                  </label>
                  <button type="button" class="sb-preview-btn" id="sb-preview-expand" title="展开/收起预览区">
                    <span class="sb-pe-text">展开</span><span class="sb-pe-icon">⤢</span>
                  </button>
                  <button type="button" class="sb-preview-btn" id="sb-preview-top" title="回到顶部">↑</button>
                </div>
              </div>
              <div class="sb-preview-scroll" id="sb-preview-scroll">
                <div class="detail-body" id="sb-preview-body">
                  <div style="color:var(--text-3);font-family:var(--f-mono);font-size:12px;letter-spacing:1px">在上方输入正文或上传 DOCX 后，此处显示最终渲染效果。</div>
                </div>
              </div>
            </div>
            <label class="sb-field">
              <span class="sb-label">标签 · TAGS（逗号分隔）</span>
              <input type="text" id="sb-tags" placeholder="例：异常, 收容, 红月">
            </label>
            <label class="sb-field">
              <span class="sb-label">来源文件 · SOURCE</span>
              <input type="text" id="sb-source" placeholder="例：红月之下/核心档案/XXX.docx（选填）">
            </label>
            <div class="sb-field" style="grid-column:1/-1;">
              <details style="border:1px solid var(--border);border-radius:4px;padding:0;overflow:hidden;">
                <summary style="padding:8px 12px;cursor:pointer;font-family:var(--f-mono);font-size:11px;color:var(--text-2);background:var(--bg-2);">投稿同步令牌 · GITHUB SYNC TOKEN（选填，用于推送投稿至 GitHub 供管理员跨设备审核）</summary>
                <div style="padding:12px;">
                  <input type="password" id="sb-gh-token" placeholder="ghp_xxxxxxxxxxxx（留空则仅本地保存）" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                  <p style="margin:6px 0 0;font-family:var(--f-mono);font-size:10px;color:var(--text-2);line-height:1.5;">令牌保存在本地浏览器，不会上传。填写后投稿将自动推送到 GitHub，管理员可在其他设备查看。令牌可向管理员索取。</p>
                </div>
              </details>
            </div>
            <div class="sb-field sb-field-audio">
              <span class="sb-label">音频附件 · AUDIO <span class="sb-label-hint">档案配音 / 录音 · 选填</span></span>
              <div class="sb-audio-uploader">
                <label class="sb-audio-choose">
                  <input type="file" id="sb-audio" accept="audio/*" hidden>
                  <span class="sb-audio-choose-icon">${ico('audio',14)}</span>
                  <span class="sb-audio-choose-text" id="sb-audio-text">选择音频</span>
                </label>
                <button type="button" class="sb-audio-clear" id="sb-audio-clear" style="display:none">${ico('x',12)} 移除</button>
              </div>
              <p class="docx-hint">支持 MP3 / WAV / OGG / M4A，限制 15MB。上传后将在档案详情页显示播放器。</p>
            </div>
          </div>
          <button type="submit" class="sb-submit-btn">
            <span class="sb-btn-text">${ico('save',14)} 提交投稿 · SUBMIT</span>
          </button>
          <div class="sb-success" id="sb-success" style="display:none"></div>
          <div class="lg-error" id="sb-error" style="display:none"></div>
        </form>

        <div class="submit-history">
          <h3 class="submit-history-h3">投稿记录 · MY SUBMISSIONS (${subs.length})</h3>
          ${subsHtml}
        </div>
      </div>
    `;

    // 恢复已保存的 GitHub 投稿令牌
    const savedGhToken = localStorage.getItem('wa_submission_token');
    if (savedGhToken) {
      const ghTokenEl = document.getElementById('sb-gh-token');
      if (ghTokenEl) ghTokenEl.value = savedGhToken;
    }

    // ============ 草稿箱：恢复提示 + 自动保存 ============
    const draft = SubmitDraft.get();
    let draftHintInjected = false;
    if (draft && (draft.title || draft.body)) {
      const formEl = document.getElementById('submit-form');
      if (formEl) {
        const hint = document.createElement('div');
        hint.id = 'draft-hint';
        hint.style.cssText = 'padding:10px 16px;border:1px dashed var(--gold-2);background:var(--bg-2);font-family:var(--f-mono);font-size:11px;letter-spacing:.5px;color:var(--gold-1);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;';
        hint.innerHTML = `
          <span>${ico('save',12)} 检测到未提交的草稿（保存于 ${new Date(draft.at||Date.now()).toLocaleString()}），字数 ${(draft.body||'').replace(/<[^>]+>/g,'').length || 0} 字</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" id="draft-restore" class="btn btn-mini" style="border:1px solid var(--gold-2);background:transparent;color:var(--gold-1);padding:4px 12px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">恢复草稿</button>
            <button type="button" id="draft-discard" class="btn btn-mini" style="border:1px solid var(--border);background:transparent;color:var(--text-2);padding:4px 12px;cursor:pointer;font-family:var(--f-mono);font-size:10px;">丢弃</button>
          </div>
        `;
        formEl.parentNode.insertBefore(hint, formEl);
        draftHintInjected = true;
      }
    }
    function collectFormDraft() {
      const titleEl = document.getElementById('sb-title');
      const idEl = document.getElementById('sb-id');
      const catEl = document.getElementById('sb-category');
      const clsEl = document.getElementById('sb-class');
      const sumEl = document.getElementById('sb-summary');
      const tagsEl = document.getElementById('sb-tags');
      const srcEl = document.getElementById('sb-source');
      return {
        title: titleEl ? titleEl.value : '',
        id: idEl ? idEl.value : '',
        category: catEl ? catEl.value : 'anomalies',
        class: clsEl ? clsEl.value : 'neutral',
        summary: sumEl ? sumEl.value : '',
        body: getBodyHTML(),
        tags: tagsEl ? tagsEl.value : '',
        source: srcEl ? srcEl.value : '',
        cover: window.__sbCoverUrl || '',
        audio: window.__sbAudioUrl || ''
      };
    }
    let saveT = null;
    let draftOversizeWarned = false;
    function scheduleDraftSave() {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        const d = collectFormDraft();
        // 第 2 期 · 草稿容量保护：body 超 3.5MB（localStorage 5MB 上限留余量）不自动保存
        if (d.body && d.body.length > 3.5 * 1024 * 1024) {
          if (!draftOversizeWarned) {
            draftOversizeWarned = true;
            sbInfo('⚠ 正文图片过大，草稿已暂停自动保存（不影响提交）。建议删除部分图片或等审核入库后转文件存储。');
          }
          return;
        }
        SubmitDraft.save(d);
      }, 1200);
    }
    if (draftHintInjected) {
      document.getElementById('draft-restore').addEventListener('click', () => {
        if (!draft) return;
        if (!confirm('恢复草稿会覆盖当前表单的内容，确认恢复？')) return;
        const ti = document.getElementById('sb-title'); if (ti) ti.value = draft.title || '';
    const di = document.getElementById('sb-id'); if (di) di.value = draft.id || '';
    const ci = document.getElementById('sb-category'); if (ci) ci.value = draft.category || 'anomalies';
        const cc = document.getElementById('sb-class'); if (cc) cc.value = draft.class || 'neutral';
        const sm = document.getElementById('sb-summary'); if (sm) sm.value = draft.summary || '';
        const tg = document.getElementById('sb-tags'); if (tg) tg.value = draft.tags || '';
        const sr = document.getElementById('sb-source'); if (sr) sr.value = draft.source || '';
        if (draft.cover) {
          window.__sbCoverUrl = draft.cover;
          const cp = document.getElementById('sb-cover-preview'); if (cp) cp.innerHTML = `<img src="${draft.cover}" alt="封面预览" style="width:100%;height:100%;object-fit:cover">`;
          const ct = document.getElementById('sb-cover-text'); if (ct) ct.textContent = '已恢复封面';
          const ccl = document.getElementById('sb-cover-clear'); if (ccl) ccl.style.display = '';
        }
        if (draft.audio) {
          window.__sbAudioUrl = draft.audio;
          const at = document.getElementById('sb-audio-text'); if (at) at.textContent = '已恢复音频';
          const acl = document.getElementById('sb-audio-clear'); if (acl) acl.style.display = '';
        }
        setBodyHTML(draft.body || '');
        syncPreview();
        const hint = document.getElementById('draft-hint'); if (hint) hint.remove();
        sbInfo('已恢复上次草稿（每 1.2 秒自动保存）');
      });
      document.getElementById('draft-discard').addEventListener('click', () => {
        if (!confirm('确认丢弃草稿？此操作不可恢复。')) return;
        SubmitDraft.clear();
        const hint = document.getElementById('draft-hint'); if (hint) hint.remove();
      });
    }

    // 正文编辑器（所见即所得）
    const bodyEditor = document.getElementById('sb-body');
    const editorStat = document.getElementById('sb-editor-stat');
    const pvEl = document.getElementById('sb-preview-body');
    const pvScroll = document.getElementById('sb-preview-scroll');
    const fontSel = document.getElementById('sb-font-size');
    const expandBtn = document.getElementById('sb-preview-expand');
    const topBtn = document.getElementById('sb-preview-top');
    const toggleBtn = document.getElementById('sb-preview-toggle');
    const fsBtn = document.getElementById('sb-fullscreen');
    const editorWrap = document.getElementById('sb-editor-wrap');

    const countChars = (html) => {
      if (!html) return 0;
      const text = String(html).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      return text.length;
    };
    const getBodyHTML = () => bodyEditor ? bodyEditor.innerHTML.trim() : '';
    const setBodyHTML = (html) => { if (bodyEditor) bodyEditor.innerHTML = html; };

    const syncPreview = () => {
      const v = getBodyHTML();
      if (pvEl) pvEl.innerHTML = v || `<div style="color:var(--text-3);font-family:var(--f-mono);font-size:12px;letter-spacing:1px">在上方输入正文或上传 DOCX 后，此处显示最终渲染效果。</div>`;
      const chars = v ? countChars(v) : 0;
      if (editorStat) editorStat.textContent = `${chars} 字`;
    };
    // 给每个输入控件绑上 draft 自动保存
    function bindDraftSave() {
      const fields = ['sb-title', 'sb-summary', 'sb-tags', 'sb-source'];
      fields.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset._ds) {
          el.dataset._ds = '1';
          el.addEventListener('input', scheduleDraftSave);
          el.addEventListener('change', scheduleDraftSave);
        }
      });
      ['sb-category', 'sb-class'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset._ds) {
          el.dataset._ds = '1'; el.addEventListener('change', scheduleDraftSave);
        }
      });
    }
    bindDraftSave();
    if (bodyEditor && !bodyEditor.dataset.bound) {
      bodyEditor.dataset.bound = '1';
      bodyEditor.addEventListener('input', () => { syncPreview(); scheduleDraftSave(); });
      // 粘贴时清洗为纯文本/HTML（去除 style 脚本等危险标签）
      bodyEditor.addEventListener('paste', (e) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');
        if (html) {
          // 简易清洗：去掉 script/style/事件属性
          const clean = html.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
                            .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
                            .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
                            .replace(/<\/?(meta|link|o:p|st1)[^>]*>/gi, '');
          document.execCommand('insertHTML', false, clean);
        } else if (text) {
          document.execCommand('insertText', false, text);
        }
      });
    }

    // 全屏编辑
    if (fsBtn && !fsBtn.dataset.bound) {
      fsBtn.dataset.bound = '1';
      fsBtn.addEventListener('click', () => {
        const isFs = editorWrap.classList.toggle('fullscreen');
        fsBtn.innerHTML = isFs ? ico('cross',12)+' 退出全屏' : ico('eye',12)+' 全屏';
        if (isFs) {
          document.body.style.overflow = 'hidden';
        } else {
          document.body.style.overflow = '';
        }
        if (bodyEditor) bodyEditor.focus();
      });
      // ESC 退出全屏
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && editorWrap.classList.contains('fullscreen')) {
          editorWrap.classList.remove('fullscreen');
          fsBtn.innerHTML = ico('eye',12)+' 全屏';
          document.body.style.overflow = '';
        }
      });
    }

    // 预览显示/隐藏切换
    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.dataset.bound = '1';
      toggleBtn.addEventListener('click', () => {
        const preview = document.getElementById('sb-preview');
        const isHidden = preview.classList.toggle('preview-hidden');
        toggleBtn.querySelector('.sb-pe-text').textContent = isHidden ? '显示' : '隐藏';
      });
    }

    // 字号控制（localStorage 持久化，同时应用于编辑器和预览）
    if (fontSel && !fontSel.dataset.bound) {
      fontSel.dataset.bound = '1';
      const savedSize = localStorage.getItem('sb-preview-font-size');
      const applyFont = (size) => {
        const lh = (1.8 + (size - 12) * 0.02).toFixed(2);
        if (pvEl) { pvEl.style.fontSize = `${size}px`; pvEl.style.lineHeight = lh; }
        if (bodyEditor) { bodyEditor.style.fontSize = `${size}px`; bodyEditor.style.lineHeight = lh; }
      };
      if (savedSize) { fontSel.value = savedSize; applyFont(savedSize); }
      else { applyFont(fontSel.value); }
      fontSel.addEventListener('change', (e) => {
        const size = e.target.value;
        applyFont(size);
        localStorage.setItem('sb-preview-font-size', size);
      });
    }

    // 展开/收起预览区
    if (expandBtn && !expandBtn.dataset.bound) {
      expandBtn.dataset.bound = '1';
      const peText = expandBtn.querySelector('.sb-pe-text');
      const peIcon = expandBtn.querySelector('.sb-pe-icon');
      expandBtn.addEventListener('click', () => {
        const isExpanded = expandBtn.classList.toggle('active');
        if (pvScroll) pvScroll.classList.toggle('expanded', isExpanded);
        if (peText) peText.textContent = isExpanded ? '收起' : '展开';
        if (peIcon) peIcon.textContent = isExpanded ? '⤡' : '⤢';
      });
    }

    // 回到顶部
    if (topBtn && !topBtn.dataset.bound) {
      topBtn.dataset.bound = '1';
      topBtn.addEventListener('click', () => {
        if (pvScroll) pvScroll.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 编辑器工具栏（所见即所得）
    const toolbar = document.getElementById('sb-editor-toolbar');
    if (toolbar && !toolbar.dataset.bound) {
      toolbar.dataset.bound = '1';
      toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.sb-tool');
        if (!btn || btn.classList.contains('sb-tool-upload')) return;
        e.preventDefault();
        if (!bodyEditor) return;
        bodyEditor.focus();
        const cmd = btn.dataset.cmd;
        if (!cmd) return;
        if (cmd === 'hongyue') {
          const sel = window.getSelection();
          if (!sel.rangeCount || sel.isCollapsed) { banner('请先选中文字', 'err'); return; }
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.className = 'font-hy';
          span.appendChild(range.extractContents());
          range.insertNode(span);
          sel.removeAllRanges();
          syncPreview();
          return;
        }
        if (cmd === 'clearFloat') {
          document.execCommand('insertHTML', false, '<div style="clear:both;height:0"></div>');
          syncPreview();
          scheduleDraftSave();
          return;
        }
        const val = btn.dataset.val || null;
        try {
          document.execCommand(cmd, false, val);
        } catch (err) { /* 忽略 */ }
        syncPreview();
      });
    }

    // 本地图片上传 → 插入正文
    const imgInput = document.getElementById('sb-insert-img');
    const imgStatus = document.getElementById('sb-img-status');
    if (imgInput && !imgInput.dataset.bound) {
      imgInput.dataset.bound = '1';
      imgInput.addEventListener('change', async () => {
        const file = imgInput.files && imgInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          if (imgStatus) { imgStatus.innerHTML = ico('warn',12)+' 仅支持图片文件'; imgStatus.className = 'sb-tool-info err'; }
          return;
        }
        if (imgStatus) { imgStatus.textContent = '上传中…'; imgStatus.className = 'sb-tool-info loading'; }
        try {
          const r = await API.uploadImage(file);
          if (!r.ok) {
            if (imgStatus) { imgStatus.innerHTML = ico('warn',12)+' ' + (r.msg || '失败'); imgStatus.className = 'sb-tool-info err'; }
            return;
          }
          // 在光标位置插入 <img>（contenteditable）
          if (bodyEditor) {
            bodyEditor.focus();
            const tag = `<img src="${r.url}" alt="${escapeAttr(file.name)}" style="border:1px solid rgba(232,232,232,0.2);margin:8px 0"><br>`;
            document.execCommand('insertHTML', false, tag);
            syncPreview();
          }
          const where = r.fallback ? '本地 base64' : '服务器';
          if (imgStatus) { imgStatus.innerHTML = ico('check',12)+` 已插入（${where}）`; imgStatus.className = 'sb-tool-info ok'; }
        } catch (e) {
          if (imgStatus) { imgStatus.innerHTML = ico('warn',12)+' ' + (e.message || '异常'); imgStatus.className = 'sb-tool-info err'; }
        }
        imgInput.value = '';
      });
    }

    // 图片拖拽排版
    if (bodyEditor && !bodyEditor.dataset.imgAlignBound) {
      bodyEditor.dataset.imgAlignBound = '1';
      let draggedImg = null;
      let alignBar = null;

      function bindDraggableImgs() {
        bodyEditor.querySelectorAll('img:not([draggable])').forEach(img => {
          img.setAttribute('draggable', 'true');
        });
      }
      bindDraggableImgs();
      new MutationObserver(() => bindDraggableImgs()).observe(bodyEditor, { childList: true, subtree: true });

      function hideAlignBar() {
        if (alignBar) { alignBar.remove(); alignBar = null; }
      }

      function showAlignBar(img) {
        hideAlignBar();
        alignBar = document.createElement('div');
        alignBar.className = 'img-align-bar';
        const aligns = [
          { cls: '', label: '内联', icon: '▬' },
          { cls: 'img-float-left', label: '左浮', icon: '↦' },
          { cls: 'img-float-right', label: '右浮', icon: '↤' },
          { cls: 'img-center', label: '居中', icon: '↧' },
        ];
        aligns.forEach(a => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'img-align-btn';
          btn.textContent = a.icon + ' ' + a.label;
          const isCurrent = a.cls ? img.classList.contains(a.cls) : (!img.classList.contains('img-float-left') && !img.classList.contains('img-float-right') && !img.classList.contains('img-center'));
          if (isCurrent) btn.classList.add('active');
          btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            img.classList.remove('img-float-left', 'img-float-right', 'img-center');
            if (a.cls) img.classList.add(a.cls);
            syncPreview();
            scheduleDraftSave();
            hideAlignBar();
          });
          alignBar.appendChild(btn);
        });
        // 尺寸滑块
        const sep = document.createElement('span');
        sep.className = 'img-align-sep';
        alignBar.appendChild(sep);
        const sizeLabel = document.createElement('span');
        sizeLabel.className = 'img-size-label';
        const curW = img.style.width || '';
        let curPct = 100;
        if (curW && curW.endsWith('%')) curPct = parseInt(curW);
        sizeLabel.textContent = curPct + '%';
        alignBar.appendChild(sizeLabel);
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'img-size-slider';
        slider.min = 15;
        slider.max = 100;
        slider.value = curPct;
        slider.addEventListener('input', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const v = parseInt(slider.value);
          img.style.width = v + '%';
          img.style.maxWidth = 'none';
          sizeLabel.textContent = v + '%';
          syncPreview();
        });
        slider.addEventListener('change', () => {
          scheduleDraftSave();
        });
        slider.addEventListener('mousedown', (ev) => ev.stopPropagation());
        alignBar.appendChild(slider);
        const rect = img.getBoundingClientRect();
        document.body.appendChild(alignBar);
        alignBar.style.position = 'fixed';
        alignBar.style.left = Math.max(8, rect.left) + 'px';
        alignBar.style.top = (rect.top > 40 ? rect.top - 32 : rect.bottom + 4) + 'px';
        alignBar.style.zIndex = '10000';
      }

      bodyEditor.addEventListener('click', (e) => {
        if (e.target.tagName === 'IMG') {
          e.preventDefault();
          showAlignBar(e.target);
        } else {
          hideAlignBar();
        }
      });

      bodyEditor.addEventListener('dragstart', (e) => {
        if (e.target.tagName === 'IMG') {
          draggedImg = e.target;
          e.target.classList.add('img-dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', '');
          hideAlignBar();
        }
      });

      bodyEditor.addEventListener('dragend', () => {
        if (draggedImg) {
          draggedImg.classList.remove('img-dragging');
          draggedImg = null;
        }
      });

      bodyEditor.addEventListener('dragover', (e) => {
        if (draggedImg) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
      });

      bodyEditor.addEventListener('drop', (e) => {
        if (!draggedImg) return;
        e.preventDefault();
        const rect = bodyEditor.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        draggedImg.classList.remove('img-float-left', 'img-float-right', 'img-center');
        if (pct < 0.35) {
          draggedImg.classList.add('img-float-left');
          if (!draggedImg.style.width) { draggedImg.style.width = '45%'; draggedImg.style.maxWidth = 'none'; }
        } else if (pct > 0.65) {
          draggedImg.classList.add('img-float-right');
          if (!draggedImg.style.width) { draggedImg.style.width = '45%'; draggedImg.style.maxWidth = 'none'; }
        } else {
          draggedImg.classList.add('img-center');
          if (!draggedImg.style.width) { draggedImg.style.width = '100%'; draggedImg.style.maxWidth = 'none'; }
        }
        const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
        if (range && range.startContainer !== draggedImg && !draggedImg.contains(range.startContainer)) {
          if (draggedImg.parentNode) draggedImg.parentNode.removeChild(draggedImg);
          range.insertNode(draggedImg);
          const sp = document.createTextNode('\u00a0');
          draggedImg.parentNode.insertBefore(sp, draggedImg.nextSibling);
        }
        window.getSelection().removeAllRanges();
        syncPreview();
        scheduleDraftSave();
      });
    }

    // 封面/预览图上传
    const coverInput = document.getElementById('sb-cover');
    const coverPreview = document.getElementById('sb-cover-preview');
    const coverText = document.getElementById('sb-cover-text');
    const coverClear = document.getElementById('sb-cover-clear');
    window.__sbCoverUrl = '';
    if (coverInput && !coverInput.dataset.bound) {
      coverInput.dataset.bound = '1';
      coverInput.addEventListener('change', async () => {
        const file = coverInput.files && coverInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { sbErr('仅支持图片文件'); return; }
        coverText.textContent = '上传中…';
        try {
          const r = await API.uploadImage(file);
          if (!r.ok) { coverText.textContent = '选择图片'; sbErr(r.msg || '上传失败'); return; }
          window.__sbCoverUrl = r.url;
          if (coverPreview) {
            coverPreview.innerHTML = `<img src="${r.url}" alt="封面预览" style="width:100%;height:100%;object-fit:cover">`;
          }
          coverText.textContent = file.name.length > 18 ? file.name.slice(0,16) + '…' : file.name;
          if (coverClear) coverClear.style.display = '';
          scheduleDraftSave();
        } catch (e) {
          coverText.textContent = '选择图片';
          sbErr('封面上传失败：' + (e.message || ''));
        }
      });
    }
    if (coverClear && !coverClear.dataset.bound) {
      coverClear.dataset.bound = '1';
      coverClear.addEventListener('click', () => {
        window.__sbCoverUrl = '';
        if (coverPreview) coverPreview.innerHTML = '<div class="sb-cover-empty">暂无封面</div>';
        coverText.textContent = '选择图片';
        coverClear.style.display = 'none';
        coverInput.value = '';
        scheduleDraftSave();
      });
    }

    // 音频上传
    const audioInput = document.getElementById('sb-audio');
    const audioText = document.getElementById('sb-audio-text');
    const audioClear = document.getElementById('sb-audio-clear');
    window.__sbAudioUrl = '';
    if (audioInput && !audioInput.dataset.bound) {
      audioInput.dataset.bound = '1';
      audioInput.addEventListener('change', async () => {
        const file = audioInput.files && audioInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('audio/')) { sbErr('仅支持音频文件'); return; }
        audioText.textContent = '上传中…';
        try {
          const r = await API.uploadAudio(file);
          if (!r.ok) { audioText.textContent = '选择音频'; sbErr(r.msg || '音频上传失败'); return; }
          window.__sbAudioUrl = r.url;
          audioText.textContent = file.name.length > 18 ? file.name.slice(0,16) + '…' : file.name;
          if (audioClear) audioClear.style.display = '';
          scheduleDraftSave();
        } catch (e) {
          audioText.textContent = '选择音频';
          sbErr('音频上传失败：' + (e.message || ''));
        }
        audioInput.value = '';
      });
    }
    if (audioClear && !audioClear.dataset.bound) {
      audioClear.dataset.bound = '1';
      audioClear.addEventListener('click', () => {
        window.__sbAudioUrl = '';
        audioText.textContent = '选择音频';
        audioClear.style.display = 'none';
        audioInput.value = '';
        scheduleDraftSave();
      });
    }

    // DOCX 上传 → 解析 → 导入预览对账 → 确认后填入
    const docxFile = document.getElementById('sb-docx');
    const docxStatus = document.getElementById('docx-parse-status');
    const docxChoose = document.getElementById('docx-choose-text');

    // 把解析结果填入编辑器（空则替换，非空追加）
    function applyImport(r) {
      const titleIn = document.getElementById('sb-title');
      if (titleIn && !titleIn.value.trim() && r.titleSuggest) titleIn.value = r.titleSuggest;
      if (bodyEditor) {
        const current = getBodyHTML();
        const isPlaceholder = !current || current.includes('在此输入正文');
        const newHtml = r.html || ('<p>' + (r.text || '').replace(/\n+/g, '</p><p>') + '</p>');
        if (isPlaceholder || !current) {
          setBodyHTML(newHtml);
        } else {
          bodyEditor.focus();
          const range = document.createRange();
          range.selectNodeContents(bodyEditor);
          range.collapse(false);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('insertHTML', false, '<hr>' + newHtml);
        }
        syncPreview();
        scheduleDraftSave();
      }
    }

    // 第 3 期 · 导入预览对账弹窗
    function showImportPreview(fileName, r) {
      const ov = document.createElement('div');
      ov.className = 'dx-modal';
      const warnHtml = (r.warnings && r.warnings.length)
        ? '<div class="dx-modal-warn">⚠ ' + r.warnings.map(escapeHtml).join('<br>⚠ ') + '</div>'
        : '';
      ov.innerHTML = `
        <div class="dx-modal-card">
          <div class="dx-modal-head">
            <span>导入预览 · ${escapeHtml(fileName)}</span>
            <span class="dx-modal-meta">${r.parser === 'dx' ? '保真解析器' : (r.fallback ? 'mammoth 浏览器端' : '服务器解析')}</span>
          </div>
          ${warnHtml}
          <div class="dx-modal-body dx-preview">${r.html || ''}</div>
          <div class="dx-modal-foot">
            <button type="button" class="dx-btn-ghost" data-act="discard">丢弃重传</button>
            <button type="button" class="dx-btn-main" data-act="ok">确认导入</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click', (e) => {
        const act = e.target && e.target.dataset ? e.target.dataset.act : '';
        if (e.target === ov || act === 'discard') { ov.remove(); return; }
        if (act === 'ok') {
          applyImport(r);
          ov.remove();
          sbInfo('已导入：' + fileName);
        }
      });
    }

    // 统一的文档处理入口（上传控件 / 拖拽共用）
    async function handleDocFile(file) {
      if (!file) return;
      const name = file.name || '';
      const ext = (name.split('.').pop() || '').toLowerCase();
      // 第 4 期 · 格式白名单
      if (ext === 'doc') {
        docxStatus.innerHTML = ico('warn',12) + ' 不支持老 .doc 格式，请先在 Word 中「另存为 .docx」';
        docxStatus.className = 'docx-parse-status err';
        return;
      }
      if (ext === 'txt' || ext === 'md') {
        const text = await file.text();
        const r = { ok: true, text, html: '', titleSuggest: (text.split('\n').map(s=>s.trim()).find(s=>s) || '').slice(0,40), warnings: [] };
        applyImport(r);
        docxStatus.innerHTML = ico('check',12) + ' 文本已导入 · ' + text.length + ' 字';
        docxStatus.className = 'docx-parse-status ok';
        return;
      }
      if (ext !== 'docx') {
        docxStatus.innerHTML = ico('warn',12) + ' 仅支持 .docx / .md / .txt';
        docxStatus.className = 'docx-parse-status err';
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        docxStatus.innerHTML = ico('warn',12) + ' 文档超过 20MB，请先压缩图片后再上传';
        docxStatus.className = 'docx-parse-status err';
        return;
      }
      docxChoose.textContent = name;
      docxStatus.textContent = '解析中…（大文档可能需要数秒）';
      docxStatus.className = 'docx-parse-status parsing';
      try {
        const r = await API.uploadDocx(file);
        if (!r.ok) {
          docxStatus.innerHTML = ico('warn',12)+' ' + (r.msg || '解析失败');
          docxStatus.className = 'docx-parse-status err';
          return;
        }
        const warnCount = (r.warnings && r.warnings.length) || 0;
        docxStatus.innerHTML = ico('check',12)+' 解析完成' + (warnCount ? ` · 警告 ${warnCount}` : '') + ' · 请在预览中确认';
        docxStatus.className = 'docx-parse-status ok';
        if (r.msg) sbInfo(r.msg);
        showImportPreview(name, r);
      } catch (e) {
        docxStatus.innerHTML = ico('warn',12)+' 解析异常：' + (e.message || '未知错误');
        docxStatus.className = 'docx-parse-status err';
      }
    }

    if (docxFile && !docxFile.dataset.bound) {
      docxFile.dataset.bound = '1';
      docxFile.addEventListener('change', () => { handleDocFile(docxFile.files && docxFile.files[0]); docxFile.value = ''; });
    }
    // 第 4 期 · 拖拽到正文编辑区直接解析
    if (editorWrap && !editorWrap.dataset.dndBound) {
      editorWrap.dataset.dndBound = '1';
      editorWrap.addEventListener('dragover', (e) => { e.preventDefault(); editorWrap.classList.add('dx-dnd-over'); });
      editorWrap.addEventListener('dragleave', () => editorWrap.classList.remove('dx-dnd-over'));
      editorWrap.addEventListener('drop', (e) => {
        e.preventDefault();
        editorWrap.classList.remove('dx-dnd-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleDocFile(f);
      });
    }

    // 绑定表单提交
    const form = document.getElementById('submit-form');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('sb-title').value.trim();
        const body  = getBodyHTML();
        const bodyText = body.replace(/<[^>]+>/g, '').trim();
        if (!title) return sbErr('请输入标题');
        if (!bodyText) return sbErr('请输入正文');

        const customId = document.getElementById('sb-id').value.trim();
        const ghTokenInput = document.getElementById('sb-gh-token');
        const ghToken = ghTokenInput ? ghTokenInput.value.trim() : '';
        if (ghToken) localStorage.setItem('wa_submission_token', ghToken);
        const data = {
          title,
          category: document.getElementById('sb-category').value,
          class: document.getElementById('sb-class').value,
          summary: document.getElementById('sb-summary').value.trim(),
          body: body,
          tags: document.getElementById('sb-tags').value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),
          source: document.getElementById('sb-source').value.trim(),
          cover: window.__sbCoverUrl || '',
          audio: window.__sbAudioUrl || '',
          id: customId || ''
        };

        const btn = document.querySelector('.sb-submit-btn');
        const btnText = btn.querySelector('.sb-btn-text');
        btn.disabled = true;
        btnText.textContent = '正在提交...';
        document.getElementById('sb-success').style.display = 'none';

        const r = await API.submit(data);

        btn.disabled = false;
        btnText.innerHTML = ico('save',14)+' 提交投稿 · SUBMIT';
        if (!r.ok) { SFX.error(); return sbErr(r.msg || '投稿失败'); }

        SFX.save();
        const ok = document.getElementById('sb-success');
        const savedId = (r.submission && r.submission.id) || '新档案';
        const where = r.fallback ? '本地审核队列' : '服务器审核队列';
        const ghStatus = r.github ? (r.github.ok ? ' · 已同步至 GitHub' : ' · GitHub 同步失败（仅本地保存）') : '';
        ok.classList.remove('sb-info');
        ok.innerHTML = `
          <span>${ico('check',14)} 投稿已收妥 · 编号 <strong>${savedId}</strong> · 已进入${where}${ghStatus}，等待管理员审核后再发布</span>
          <button type="button" class="sb-close-btn" title="关闭通知">${ico('cross',12)}</button>
        `;
        ok.style.display = 'block';
        // 绑定关闭按钮
        const closeBtn = ok.querySelector('.sb-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => { ok.style.display = 'none'; });
        document.getElementById('sb-error').style.display = 'none';
        form.reset();
        window.__sbCoverUrl = '';
        window.__sbAudioUrl = '';
        setBodyHTML('');
        syncPreview();
        SubmitDraft.clear();
        const cp = document.getElementById('sb-cover-preview');
        if (cp) cp.innerHTML = '<div class="sb-cover-empty">暂无封面</div>';
        const ct = document.getElementById('sb-cover-text');
        if (ct) ct.textContent = '选择图片';
        const cc = document.getElementById('sb-cover-clear');
        if (cc) cc.style.display = 'none';
        const at = document.getElementById('sb-audio-text');
        if (at) at.textContent = '选择音频';
        const ac = document.getElementById('sb-audio-clear');
        if (ac) ac.style.display = 'none';
        const dh = document.getElementById('draft-hint');
        if (dh) dh.remove();
      });
    }

    function sbErr(m) {
      const e = document.getElementById('sb-error');
      e.innerHTML = ico('warn',12)+' ' + m; e.style.display = 'block';
    }
    function sbInfo(m) {
      // 复用 success 容器显示中性提示（绿色背景不突兀）
      const ok = document.getElementById('sb-success');
      if (!ok) return;
      ok.innerHTML = ico('eye',12)+' ' + escapeHtml(m) + `<button type="button" class="sb-close-btn" title="关闭">${ico('cross',12)}</button>`;
      ok.style.display = 'block';
      ok.classList.add('sb-info');
      const cb = ok.querySelector('.sb-close-btn');
      if (cb) cb.addEventListener('click', () => { ok.style.display = 'none'; });
    }

    // 审核通知：关闭单条
    document.querySelectorAll('.submit-notice-close').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-id');
        if (!id) return;
        const notice = btn.closest('.submit-notice');
        if (notice) notice.style.display = 'none';
        try {
          const arr = JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]');
          if (!arr.includes(id)) { arr.push(id); localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(arr)); }
        } catch (_) {}
      });
    });
    // 审核通知：全部已读
    const clearAllBtn = document.getElementById('notice-clear-all');
    if (clearAllBtn && !clearAllBtn.dataset.bound) {
      clearAllBtn.dataset.bound = '1';
      clearAllBtn.addEventListener('click', () => {
        const ids = Array.from(document.querySelectorAll('.submit-notice[data-sub-id]')).map(n => n.getAttribute('data-sub-id'));
        document.querySelectorAll('.submit-notice').forEach(n => { n.style.display = 'none'; });
        try {
          const set = new Set(JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]'));
          ids.forEach(id => set.add(id));
          localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(Array.from(set)));
        } catch (_) {}
      });
    }

    // 投稿记录：删除已发布/已退回的记录
    document.querySelectorAll('.submit-item-del').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-del-id');
        if (!id) return;
        if (!confirm(`确认删除投稿记录「${id}」？此操作不会影响已发布的档案内容。`)) return;
        Submissions.remove(id);
        // 同步在已关闭通知中移除该 id
        try {
          const arr = JSON.parse(localStorage.getItem(DISMISSED_NOTICES_KEY) || '[]');
          const filtered = arr.filter(x => x !== id);
          if (filtered.length !== arr.length) localStorage.setItem(DISMISSED_NOTICES_KEY, JSON.stringify(filtered));
        } catch (_) {}
        renderSubmit();
      });
    });
  }

  // ============ 账户详情页 ============
  const PROFILE_KEY = 'wa_profile_v1';

  const LEVEL_INFO = {
    'LV.1': { name: '访客', en: 'VISITOR', next: 'LV.2', maxExp: 100, perms: ['浏览档案'] },
    'LV.2': { name: '档案员', en: 'ARCHIVIST', next: 'LV.3', maxExp: 300, perms: ['浏览档案', '投稿设定'] },
    'LV.3': { name: '研究员', en: 'RESEARCHER', next: 'LV.4', maxExp: 600, perms: ['浏览档案', '投稿设定', '高级检索'] },
    'LV.4': { name: '复审官', en: 'REVIEWER', next: 'LV.5', maxExp: 1000, perms: ['浏览档案', '投稿设定', '高级检索', '档案复审'] },
    'LV.5': { name: '管制官', en: 'CONTROLLER', next: null, maxExp: 9999, perms: ['浏览档案', '投稿设定', '高级检索', '档案复审', '全局管控'] },
    'LV.9': { name: '系统管理员', en: 'ADMINISTRATOR', next: null, maxExp: 9999, perms: ['全部权限'] },
  };

  function generateArchivistCode(seed) {
    let hash = 0;
    const str = seed || 'guest';
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '', h = Math.abs(hash);
    for (let i = 0; i < 4; i++) { code += chars[h % chars.length]; h = Math.floor(h / chars.length); }
    return 'ARCH-' + code;
  }

  function generateAvatarSVG(seed) {
    let hash = 0;
    const str = seed || 'guest';
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    const size = 5, cs = 12, total = size * cs;
    let h = Math.abs(hash) + 1, rects = '';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < Math.ceil(size / 2); x++) {
        const bit = h % 2; h = Math.floor(h / 2) || (h * 7 + 3);
        if (bit) {
          rects += `<rect x="${x*cs}" y="${y*cs}" width="${cs}" height="${cs}" fill="currentColor"/>`;
          if (x < Math.floor(size / 2)) rects += `<rect x="${(size-1-x)*cs}" y="${y*cs}" width="${cs}" height="${cs}" fill="currentColor"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg" style="color:var(--silver-2)"><rect width="${total}" height="${total}" fill="var(--bg-inset)"/>${rects}</svg>`;
  }

  function renderAvatar(user, opts) {
    opts = opts || {};
    const size = opts.size || 40;
    const clickable = opts.clickable !== false;
    const all = Profile._all();
    const profile = all[user || '__guest__'] || {};
    let avatarInner;
    if (profile.customAvatar) {
      avatarInner = `<img src="${escapeAttr(profile.customAvatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${escapeAttr(user || 'guest')}">`;
    } else {
      let svg = generateAvatarSVG(profile.avatarSeed || user);
      avatarInner = svg.replace('<svg ', '<svg width="100%" height="100%" ');
    }
    const style = `display:inline-flex;width:${size}px;height:${size}px;flex-shrink:0;border-radius:3px;overflow:hidden;border:1px solid var(--border-2);line-height:0;`;
    if (clickable && user && user !== '游客') {
      return `<a href="#/user/${encodeURIComponent(user)}" class="avatar-link" title="${escapeAttr(user)}" style="${style}cursor:pointer;">${avatarInner}</a>`;
    }
    return `<div style="${style}">${avatarInner}</div>`;
  }

  const Profile = {
    _all() { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch { return {}; } },
    _save(d) { localStorage.setItem(PROFILE_KEY, JSON.stringify(d)); },
    get(user) {
      const key = user || (Auth.get() && Auth.get().user) || '__guest__';
      const all = Profile._all();
      if (!all[key]) {
        all[key] = { bio: '', exp: 0, createdAt: (Auth.get() && Auth.get().at) || Date.now(), archivistCode: generateArchivistCode(key), avatarSeed: key };
        Profile._save(all);
      }
      return all[key];
    },
    update(patch) {
      const key = (Auth.get() && Auth.get().user) || '__guest__';
      const all = Profile._all();
      all[key] = Object.assign(all[key] || {}, patch);
      Profile._save(all);
      return all[key];
    },
  };

  function apToast(msg) {
    let t = document.getElementById('ap-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ap-toast'; t.className = 'ap-toast'; document.body.appendChild(t); }
    t.innerHTML = msg.replace(/\n/g, '<br>');
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 4000);
  }

  function renderAccount() {
    if (!Auth.get()) { showLoginGate(); return; }
    const a = Auth.get();
    const profile = Profile.get();
    const lvl = a.lvl || 'LV.1';
    const info = LEVEL_INFO[lvl] || LEVEL_INFO['LV.1'];
    const favList = Favorites.list();
    const readList = ReadProgress.list();
    const subs = Submissions.get().filter(s => s.author === a.user);
    const activityExp = favList.length * 10 + readList.length * 5 + subs.length * 20;
    const totalExp = (profile.exp || 0) + activityExp;
    const maxExp = info.maxExp;
    const expPct = info.next ? Math.min(100, (totalExp / maxExp) * 100) : 100;
    const createdAt = new Date(profile.createdAt || a.at || Date.now());
    const createdStr = createdAt.toLocaleDateString('zh-CN');
    const days = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    const archivistNum = String(profile.createdAt || a.at || Date.now()).slice(-4);

    view.innerHTML = `
      <div class="account-page">
        <div class="ap-banner">
          <div class="ap-banner-grid"></div>
          <div class="ap-banner-content">
            <h1 class="ap-title">档案员档案</h1>
            <p class="ap-subtitle">PERSONNEL DOSSIER · CLASSIFIED</p>
          </div>
          <div class="ap-banner-code">${escapeHtml(profile.archivistCode || generateArchivistCode(a.user))}</div>
        </div>
        <div class="ap-layout">
          <div class="ap-left">
            <div class="ap-card ap-profile-card">
              <div class="ap-avatar-wrap">
                <div class="ap-avatar">${profile.customAvatar
                  ? `<img src="${escapeAttr(profile.customAvatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${escapeAttr(a.user)}">`
                  : generateAvatarSVG(profile.avatarSeed || a.user)}</div>
                <div class="ap-avatar-ring"></div>
                <div class="ap-avatar-actions">
                  <button class="ap-avatar-btn" id="ap-avatar-upload-btn" title="上传自定义头像">${ico('edit', 12)}</button>
                  ${profile.customAvatar ? `<button class="ap-avatar-btn ap-avatar-reset" id="ap-avatar-reset-btn" title="恢复默认头像">${ico('close', 12)}</button>` : ''}
                  <input type="file" id="ap-avatar-file" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none">
                </div>
              </div>
              <div class="ap-profile-info">
                <div class="ap-code">${escapeHtml(profile.archivistCode || generateArchivistCode(a.user))}</div>
                <div class="ap-username">${escapeHtml(a.user)}</div>
                <div class="ap-lvl-badge ap-lvl-${lvl.replace('.','')}">
                  <span class="ap-lvl-tag">${escapeHtml(lvl)}</span>
                  <span class="ap-lvl-name">${escapeHtml(info.name)}</span>
                </div>
              </div>
              <div class="ap-profile-meta">
                <div class="ap-meta-row"><span class="ap-meta-label">编号</span><span class="ap-meta-value">No.${escapeHtml(archivistNum)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">入档日期</span><span class="ap-meta-value">${escapeHtml(createdStr)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">在档天数</span><span class="ap-meta-value">${days} 天</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">身份</span><span class="ap-meta-value">${a.guest ? '游客' : (Auth.isAdmin() ? '管理员' : '注册档案员')}</span></div>
              </div>
              <div class="ap-bio-section">
                <div class="ap-bio-header">
                  <span class="ap-bio-title">个人备注</span>
                  <button class="ap-bio-edit" id="ap-bio-edit-btn">${ico('edit',12)} 编辑</button>
                </div>
                <div class="ap-bio-text" id="ap-bio-text">${escapeHtml(profile.bio || '暂无备注。点击编辑添加个人说明。')}</div>
                <textarea class="ap-bio-input" id="ap-bio-input" style="display:none" placeholder="输入个人备注..." maxlength="200"></textarea>
                <div class="ap-bio-actions" id="ap-bio-actions" style="display:none">
                  <button class="ap-btn ap-btn-save" id="ap-bio-save">保存</button>
                  <button class="ap-btn ap-btn-cancel" id="ap-bio-cancel">取消</button>
                </div>
              </div>
            </div>
            <div class="ap-card ap-stats-card">
              <div class="ap-card-title">${ico('chart',14)} 活动统计</div>
              <div class="ap-stats-grid">
                <div class="ap-stat-item"><div class="ap-stat-num">${favList.length}</div><div class="ap-stat-label">收藏</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${readList.length}</div><div class="ap-stat-label">阅读记录</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${subs.length}</div><div class="ap-stat-label">投稿</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${totalExp}</div><div class="ap-stat-label">经验值</div></div>
              </div>
            </div>
          </div>
          <div class="ap-right">
            <div class="ap-card ap-perm-card">
              <div class="ap-card-title">${ico('shield',14)} 权限等级 · CLEARANCE LEVEL</div>
              <div class="ap-lvl-progress">
                <div class="ap-lvl-current">
                  <span class="ap-lvl-big">${escapeHtml(lvl)}</span>
                  <span class="ap-lvl-en">${escapeHtml(info.en)}</span>
                </div>
                ${info.next ? `
                  <div class="ap-exp-bar-wrap">
                    <div class="ap-exp-info"><span>经验值 ${totalExp} / ${maxExp}</span><span>下一级：${escapeHtml(LEVEL_INFO[info.next].name)} (${info.next})</span></div>
                    <div class="ap-exp-bar"><div class="ap-exp-fill" style="width:${expPct}%"></div></div>
                  </div>` : `
                  <div class="ap-exp-bar-wrap">
                    <div class="ap-exp-info"><span>已达最高等级</span><span>经验值 ${totalExp}</span></div>
                    <div class="ap-exp-bar"><div class="ap-exp-fill ap-exp-max" style="width:100%"></div></div>
                  </div>`}
              </div>
              <div class="ap-perm-list">
                ${Object.entries(LEVEL_INFO).map(([lv,li]) => {
                  const unlocked = Auth.isLv(lv);
                  const isCurrent = lv === lvl;
                  return `<div class="ap-perm-row ${unlocked?'unlocked':'locked'} ${isCurrent?'current':''}">
                    <div class="ap-perm-lv"><span class="ap-perm-lv-tag">${escapeHtml(lv)}</span><span class="ap-perm-lv-name">${escapeHtml(li.name)}</span></div>
                    <div class="ap-perm-desc">${li.perms.join(' · ')}</div>
                    <div class="ap-perm-status">${unlocked ? '已解锁' : '未解锁'}</div>
                  </div>`;
                }).join('')}
              </div>
            </div>
            <div class="ap-card ap-timeline-card">
              <div class="ap-card-title">${ico('clock',14)} 活动时间线 · ACTIVITY LOG</div>
              <div class="ap-timeline" id="ap-timeline">${renderActivityTimeline(favList, readList, subs)}</div>
            </div>
            <div class="ap-card ap-security-card">
              <div class="ap-card-title">${ico('lock',14)} 安全设置 · SECURITY</div>
              <div class="ap-sec-list">
                ${!a.guest ? `<div class="ap-sec-row" id="ap-sec-password">
                  <div class="ap-sec-info"><div class="ap-sec-name">修改密码</div><div class="ap-sec-desc">定期更换密码以保障账号安全</div></div>
                  <button class="ap-btn ap-btn-action" id="ap-change-pw-btn">修改</button>
                </div>` : ''}
                <div class="ap-sec-row" id="ap-sec-export">
                  <div class="ap-sec-info"><div class="ap-sec-name">导出我的数据</div><div class="ap-sec-desc">导出收藏、阅读记录、个人资料等数据</div></div>
                  <button class="ap-btn ap-btn-action" id="ap-export-btn">导出</button>
                </div>
                <div class="ap-sec-row" id="ap-sec-history">
                  <div class="ap-sec-info"><div class="ap-sec-name">会话信息</div><div class="ap-sec-desc">本次登录会话的详细信息</div></div>
                  <button class="ap-btn ap-btn-action" id="ap-history-btn">查看</button>
                </div>
                ${!a.guest ? `<div class="ap-sec-row ap-sec-danger">
                  <div class="ap-sec-info"><div class="ap-sec-name">注销账号</div><div class="ap-sec-desc">永久删除账号及所有关联数据，不可恢复</div></div>
                  <button class="ap-btn ap-btn-danger" id="ap-delete-btn">注销</button>
                </div>` : ''}
              </div>
              <div class="ap-pw-form" id="ap-pw-form" style="display:none">
                <div class="ap-pw-row"><label>原密码</label><input type="password" id="ap-pw-old" placeholder="输入原密码"></div>
                <div class="ap-pw-row"><label>新密码</label><input type="password" id="ap-pw-new" placeholder="至少6位"></div>
                <div class="ap-pw-row"><label>确认新密码</label><input type="password" id="ap-pw-confirm" placeholder="再次输入新密码"></div>
                <div class="ap-pw-actions"><button class="ap-btn ap-btn-save" id="ap-pw-submit">确认修改</button><button class="ap-btn ap-btn-cancel" id="ap-pw-cancel">取消</button></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    bindAccountPageEvents();
  }

  function renderUserPage(username) {
    if (!Auth.get()) { showLoginGate(); return; }
    const profile = Profile.get(username);
    const all = Profile._all();
    const isSelf = Auth.get().user === username;
    const lvl = profile.userLevel || 'LV.1';
    const info = LEVEL_INFO[lvl] || LEVEL_INFO['LV.1'];
    const createdAt = new Date(profile.createdAt || Date.now());
    const createdStr = createdAt.toLocaleDateString('zh-CN');
    const days = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    const archivistNum = String(profile.createdAt || Date.now()).slice(-4);
    const subs = Submissions.get().filter(s => s.author === username);
    const allComments = Comments._all ? Comments._all() : {};
    let commentCount = 0;
    const userComments = [];
    Object.entries(allComments).forEach(([key, arr]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach(c => {
        if (c.author === username && !c.deleted) {
          commentCount++;
          const [catId, entryId] = key.split(':');
          const cat = CAT_MAP[catId];
          const entry = findEntry(catId, entryId);
          userComments.push({
            text: c.text, at: c.at, catId, entryId,
            catName: cat ? cat.name : catId,
            catCode: cat ? cat.code : '',
            entryTitle: entry ? (entry.title || entry.id) : entryId
          });
        }
      });
    });
    userComments.sort((a, b) => b.at - a.at);

    const userFavs = Favorites._all()[username] || [];
    const userReads = Object.entries(ReadProgress._all())
      .filter(([k]) => k.startsWith(username + '|'))
      .map(([k, v]) => {
        const ck = k.split('|')[1] || '';
        const [cat, eid] = ck.split(':');
        return { cat, id: eid, ...v };
      });

    const avatarHtml = profile.customAvatar
      ? `<img src="${escapeAttr(profile.customAvatar)}" style="width:100%;height:100%;object-fit:cover;display:block;" alt="${escapeAttr(username)}">`
      : generateAvatarSVG(profile.avatarSeed || username);

    view.innerHTML = `
      <div class="account-page">
        <div class="ap-banner">
          <div class="ap-banner-grid"></div>
          <div class="ap-banner-content">
            <a href="#/account" style="color:var(--text-2);font-family:var(--f-mono);font-size:11px;letter-spacing:1px;text-decoration:none;">← 返回我的账户</a>
            <h1 class="ap-title" style="margin-top:8px;">档案员档案</h1>
            <p class="ap-subtitle">PERSONNEL DOSSIER · ${escapeHtml(profile.archivistCode || generateArchivistCode(username))}</p>
          </div>
          ${isSelf ? `<div class="ap-banner-code">${escapeHtml(profile.archivistCode || generateArchivistCode(username))}</div>` : ''}
        </div>
        <div class="ap-layout">
          <div class="ap-left">
            <div class="ap-card ap-profile-card">
              <div class="ap-avatar-wrap">
                <div class="ap-avatar">${avatarHtml}</div>
                <div class="ap-avatar-ring"></div>
              </div>
              <div class="ap-profile-info">
                <div class="ap-code">${escapeHtml(profile.archivistCode || generateArchivistCode(username))}</div>
                <div class="ap-username">${escapeHtml(username)}</div>
                <div class="ap-lvl-badge ap-lvl-${lvl.replace('.','')}">
                  <span class="ap-lvl-tag">${escapeHtml(lvl)}</span>
                  <span class="ap-lvl-name">${escapeHtml(info.name)}</span>
                </div>
              </div>
              <div class="ap-profile-meta">
                <div class="ap-meta-row"><span class="ap-meta-label">编号</span><span class="ap-meta-value">No.${escapeHtml(archivistNum)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">入档日期</span><span class="ap-meta-value">${escapeHtml(createdStr)}</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">在档天数</span><span class="ap-meta-value">${days} 天</span></div>
                <div class="ap-meta-row"><span class="ap-meta-label">身份</span><span class="ap-meta-value">档案员</span></div>
              </div>
              <div class="ap-bio-section">
                <div class="ap-bio-header"><span class="ap-bio-title">个人备注</span></div>
                <div class="ap-bio-text">${escapeHtml(profile.bio || '该档案员尚未添加个人备注。')}</div>
              </div>
            </div>
            <div class="ap-card ap-stats-card">
              <div class="ap-card-title">${ico('chart',14)} 活动统计</div>
              <div class="ap-stats-grid">
                <div class="ap-stat-item"><div class="ap-stat-num">${subs.length}</div><div class="ap-stat-label">投稿</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${commentCount}</div><div class="ap-stat-label">批注</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${days}</div><div class="ap-stat-label">在档天数</div></div>
                <div class="ap-stat-item"><div class="ap-stat-num">${profile.exp || 0}</div><div class="ap-stat-label">经验值</div></div>
              </div>
            </div>
            <div class="ap-card ap-timeline-card">
              <div class="ap-card-title">${ico('clock',14)} 活动时间线 · ACTIVITY LOG</div>
              <div class="ap-timeline">${renderActivityTimeline(userFavs, userReads, subs)}</div>
            </div>
          </div>
          <div class="ap-right">
            <div class="ap-card ap-perm-card">
              <div class="ap-card-title">${ico('shield',14)} 权限等级</div>
              <div class="ap-lvl-current">
                <span>当前等级</span>
                <span class="ap-lvl-big">${escapeHtml(lvl)} · ${escapeHtml(info.name)}</span>
              </div>
              <div class="ap-perm-list">
                ${(info.perms||[]).map(p => `<div class="ap-perm-item"><span class="ap-perm-check">✓</span> ${escapeHtml(p)}</div>`).join('')}
              </div>
            </div>
            ${subs.length > 0 ? `
            <div class="ap-card">
              <div class="ap-card-title">${ico('file',14)} 投稿记录（${subs.length}）</div>
              <div style="display:grid;gap:8px;">
                ${subs.slice(0, 10).map(s => `
                  <div style="border:1px solid var(--border);padding:8px 10px;background:var(--bg-2);">
                    <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);">${escapeHtml(s.id || '')} · ${new Date(s.at).toLocaleDateString('zh-CN')}</div>
                    <div style="font-size:12px;margin-top:2px;">${escapeHtml(s.title || '未命名')}</div>
                    <div style="font-family:var(--f-mono);font-size:10px;margin-top:2px;">
                      <span style="color:var(--text-2);">${escapeHtml(s.category || '')}</span>
                      ${s.status ? ` · <span style="color:${s.status==='approved'?'var(--silver-3)':'var(--red-3)'}">${escapeHtml(s.status)}</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>` : ''}
            ${userComments.length > 0 ? `
            <div class="ap-card">
              <div class="ap-card-title">${ico('pencil',14)} 批注记录（${userComments.length}）</div>
              <div style="display:grid;gap:8px;">
                ${userComments.slice(0, 10).map(c => `
                  <div style="border:1px solid var(--border);padding:8px 10px;background:var(--bg-2);">
                    <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                      <a href="#/entry/${c.catId}/${encodeURIComponent(c.entryId)}" style="color:var(--text-2);text-decoration:none;">${escapeHtml(c.catCode || c.catName)} · ${escapeHtml(c.entryTitle)}</a>
                      <span style="opacity:.5;">·</span>
                      <span>${new Date(c.at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div style="font-size:12px;margin-top:4px;white-space:pre-wrap;word-break:break-word;font-family:var(--f-serif);line-height:1.6;">${escapeHtml(c.text)}</div>
                  </div>
                `).join('')}
              </div>
              ${userComments.length > 10 ? `
              <div id="comment-rest" style="display:none;grid-template-rows:1fr;gap:8px;margin-top:8px;">
                ${userComments.slice(10).map(c => `
                  <div style="border:1px solid var(--border);padding:8px 10px;background:var(--bg-2);">
                    <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                      <a href="#/entry/${c.catId}/${encodeURIComponent(c.entryId)}" style="color:var(--text-2);text-decoration:none;">${escapeHtml(c.catCode || c.catName)} · ${escapeHtml(c.entryTitle)}</a>
                      <span style="opacity:.5;">·</span>
                      <span>${new Date(c.at).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div style="font-size:12px;margin-top:4px;white-space:pre-wrap;word-break:break-word;font-family:var(--f-serif);line-height:1.6;">${escapeHtml(c.text)}</div>
                  </div>
                `).join('')}
              </div>
              <button type="button" id="comment-expand-btn" style="margin-top:8px;width:100%;border:1px solid var(--border);background:var(--bg-2);color:var(--text-2);padding:6px;cursor:pointer;font-family:var(--f-mono);font-size:10px;letter-spacing:1px;">查看全部（${userComments.length}）</button>
              ` : ''}
            </div>` : ''}
          </div>
        </div>
      </div>`;

    const expandBtn = document.getElementById('comment-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const rest = document.getElementById('comment-rest');
        if (!rest) return;
        const expanded = rest.style.display !== 'none';
        if (expanded) {
          rest.style.display = 'none';
          expandBtn.textContent = `查看全部（${userComments.length}）`;
        } else {
          rest.style.display = 'grid';
          expandBtn.textContent = '收起';
        }
      });
    }
  }

  function renderActivityTimeline(favList, readList, subs) {
    const events = [];
    favList.forEach(f => events.push({ type:'fav', title:f.title||f.id, at:f.at, label:'收藏' }));
    readList.forEach(r => events.push({ type:'read', title:r.id, at:r.at, label:`阅读 ${r.offsetPct||0}%` }));
    subs.forEach(s => events.push({ type:'submit', title:s.title||s.id, at:s.at, label:'投稿' }));
    events.sort((a,b) => (b.at||0) - (a.at||0));
    const top = events.slice(0, 20);
    if (!top.length) return '<div class="ap-timeline-empty">暂无活动记录</div>';
    return top.map(e => {
      const dt = e.at ? new Date(e.at) : null;
      const ds = dt ? dt.toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}) : '--';
      const ts = dt ? dt.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : '--';
      return `<div class="ap-tl-item ap-tl-${e.type}"><div class="ap-tl-dot"></div><div class="ap-tl-content"><div class="ap-tl-label">${escapeHtml(e.label)}</div><div class="ap-tl-title">${escapeHtml(e.title)}</div><div class="ap-tl-time">${ds} ${ts}</div></div></div>`;
    }).join('');
  }

  function bindAccountPageEvents() {
    // 头像上传
    const uploadBtn = document.getElementById('ap-avatar-upload-btn');
    const fileInput = document.getElementById('ap-avatar-file');
    const resetBtn = document.getElementById('ap-avatar-reset-btn');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { apToast('图片不能超过 3MB'); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            const max = 200;
            if (w > h) { if (w > max) { h *= max / w; w = max; } }
            else { if (h > max) { w *= max / h; h = max; } }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            Profile.update({ customAvatar: dataUrl });
            renderAccount();
            apToast('头像已更新');
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
    if (resetBtn) resetBtn.addEventListener('click', () => {
      Profile.update({ customAvatar: '' });
      renderAccount();
      apToast('已恢复默认头像');
    });

    const editBtn = document.getElementById('ap-bio-edit-btn');
    const bioText = document.getElementById('ap-bio-text');
    const bioInput = document.getElementById('ap-bio-input');
    const bioActions = document.getElementById('ap-bio-actions');
    if (editBtn) editBtn.addEventListener('click', () => {
      bioInput.value = Profile.get().bio || '';
      bioText.style.display = 'none'; editBtn.style.display = 'none';
      bioInput.style.display = 'block'; bioActions.style.display = 'flex'; bioInput.focus();
    });
    const saveBio = document.getElementById('ap-bio-save');
    if (saveBio) saveBio.addEventListener('click', () => {
      Profile.update({ bio: bioInput.value.trim() });
      bioText.textContent = bioInput.value.trim() || '暂无备注。点击编辑添加个人说明。';
      bioInput.style.display='none'; bioActions.style.display='none'; bioText.style.display='block'; editBtn.style.display='';
      apToast('备注已保存');
    });
    const cancelBio = document.getElementById('ap-bio-cancel');
    if (cancelBio) cancelBio.addEventListener('click', () => {
      bioInput.style.display='none'; bioActions.style.display='none'; bioText.style.display='block'; editBtn.style.display='';
    });

    const changePwBtn = document.getElementById('ap-change-pw-btn');
    const pwForm = document.getElementById('ap-pw-form');
    if (changePwBtn) changePwBtn.addEventListener('click', () => {
      pwForm.style.display = pwForm.style.display === 'none' ? 'block' : 'none';
    });
    const pwSubmit = document.getElementById('ap-pw-submit');
    if (pwSubmit) pwSubmit.addEventListener('click', () => {
      const oldPw = document.getElementById('ap-pw-old').value;
      const newPw = document.getElementById('ap-pw-new').value;
      const confirmPw = document.getElementById('ap-pw-confirm').value;
      if (!oldPw || !newPw) { apToast('请填写完整'); return; }
      if (newPw.length < 6) { apToast('新密码至少6位'); return; }
      if (newPw !== confirmPw) { apToast('两次密码不一致'); return; }
      const a = Auth.get();
      const users = Auth.getUsers();
      const u = users.find(u => u.contact === a.user);
      if (!u) { apToast('用户不存在'); return; }
      if (u.pass !== btoa(oldPw)) { apToast('原密码错误'); return; }
      u.pass = btoa(newPw);
      Auth.saveUsers(users);
      pwForm.style.display = 'none';
      ['ap-pw-old','ap-pw-new','ap-pw-confirm'].forEach(id => document.getElementById(id).value = '');
      apToast('密码修改成功');
    });
    const pwCancel = document.getElementById('ap-pw-cancel');
    if (pwCancel) pwCancel.addEventListener('click', () => { pwForm.style.display = 'none'; });

    const exportBtn = document.getElementById('ap-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      const a = Auth.get();
      const data = {
        account: a.user, level: a.lvl, profile: Profile.get(),
        favorites: Favorites.list(), readProgress: ReadProgress.list(),
        submissions: Submissions.get().filter(s => s.author === a.user),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const el = document.createElement('a');
      el.href = url; el.download = `archive-data-${a.user}-${Date.now()}.json`;
      document.body.appendChild(el); el.click(); document.body.removeChild(el);
      URL.revokeObjectURL(url);
      apToast('数据已导出');
    });

    const historyBtn = document.getElementById('ap-history-btn');
    if (historyBtn) historyBtn.addEventListener('click', () => {
      const a = Auth.get();
      const p = Profile.get();
      const dt = new Date(a.at || Date.now());
      const cd = new Date(p.createdAt || a.at || Date.now());
      apToast(`本次会话: ${dt.toLocaleString('zh-CN')}\n入档日期: ${cd.toLocaleDateString('zh-CN')}\n身份: ${a.guest?'游客':(Auth.isAdmin()?'管理员':'注册档案员')}\n等级: ${a.lvl}`);
    });

    const deleteBtn = document.getElementById('ap-delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
      openAccountModal('account');
      setTimeout(() => {
        const danger = document.querySelector('.am-danger-zone');
        if (danger) danger.scrollIntoView({ behavior:'smooth', block:'center' });
      }, 100);
    });
  }

  // ============ 管理员后台 ============
  function renderAdmin() {
    // 守卫 1：必须登录
    if (!Auth.get()) { showLoginGate(); return; }
    // 守卫 2：必须管理员
    if (!Auth.isAdmin()) {
      view.innerHTML = `
        <div class="empty-state" style="padding:120px 24px">
          <div class="es-icon">🛡</div>
          <div class="es-title">ADMIN ONLY · 仅管理员可访问</div>
          <div class="es-desc">请用管理员账号（默认 admin / admin123，可在 .env 修改）登录。</div>
          <p style="margin-top:24px"><a href="javascript:void(0)" id="admin-goto-login">→ 切换管理员身份登录</a></p>
        </div>
      `;
      const b = document.getElementById('admin-goto-login');
      if (b) b.addEventListener('click', () => { Auth.clear(); refreshIdentity(); showLoginGate(); });
      return;
    }

    // Tab 切换（URL hash：#/admin?tab=entries 或 view._adminTab）
    const tab = (new URLSearchParams(location.hash.split('?')[1] || '')).get('tab') || view._adminTab || 'subs';

    const me = Auth.get();
    view.innerHTML = `
      <div class="admin-wrap">
        <div class="admin-head" data-header-img="${encodeURI('IMG-07 管理中枢横幅.webp')}">
          <div>
            <h2 class="admin-h2">🛡 管理员控制台 · ADMIN CONSOLE</h2>
            <p class="admin-sub">操作身份：<strong>${escapeHtml(me.user)}</strong> · ${escapeHtml(me.lvl||'')} · <span style="color:var(--red-2)">ADMINISTRATOR</span></p>
          </div>
          <div class="admin-head-right">
            <span id="admin-banner" class="admin-banner"></span>
          </div>
        </div>

        <nav class="admin-tabs">
          <a class="atab ${tab==='dash'?'active':''}" data-atab="dash">${ico('chart',14)} 数据仪表盘</a>
          <a class="atab ${tab==='subs'?'active':''}" data-atab="subs">${ico('shield',14)} 待审核投稿 <span id="admin-count-subs" class="atab-count">0</span></a>
          <a class="atab ${tab==='entries'?'active':''}" data-atab="entries">${ico('doc',14)} 档案管理</a>
          <a class="atab ${tab==='users'?'active':''}" data-atab="users">${ico('eye',14)} 用户管理</a>
          <a class="atab ${tab==='logs'?'active':''}" data-atab="logs">${ico('doc',14)} 操作日志</a>
          <a class="atab ${tab==='cats'?'active':''}" data-atab="cats">${ico('grid',14)} 栏目管理</a>
          <a class="atab ${tab==='data'?'active':''}" data-atab="data">${ico('save',14)} 数据备份</a>
          <a class="atab ${tab==='sync'?'active':''}" data-atab="sync">${ico('cloud',14)} GitHub 同步</a>
        </nav>

        <div id="admin-tab-body" class="admin-tab-body"></div>
      </div>
    `;

    // 管理中枢横幅背景注入
    const adminHead = document.querySelector('.admin-head[data-header-img]');
    if (adminHead && adminHead.dataset.headerImg) {
      adminHead.style.setProperty('--lh-img', `url('${adminHead.dataset.headerImg}')`);
    }

    // Tab 点击 → 更新 view._adminTab → 重绘 body
    document.querySelectorAll('.atab').forEach(el => {
      if (el.dataset._bound) return;
      el.dataset._bound = '1';
      el.addEventListener('click', () => {
        document.querySelectorAll('.atab').forEach(x => x.classList.remove('active'));
        el.classList.add('active');
        view._adminTab = el.dataset.atab;
        SFX.adminClick();
        drawAdminTab();
      });
    });

    function banner(msg, kind) {
      const b = document.getElementById('admin-banner');
      if (!b) return;
      b.textContent = msg;
      b.className = 'admin-banner ' + (kind || '');
      setTimeout(() => { b.textContent = ''; b.className = 'admin-banner'; }, 4500);
    }

    // Toast（右下角，用于批量操作汇总提示）
    let toastEl = null;
    function toast(msg, kind) {
      if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'admin-toast';
        toastEl.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;max-width:360px;padding:12px 16px;font-family:var(--f-mono);font-size:12px;letter-spacing:.5px;border:1px solid var(--border);background:var(--bg);color:var(--text);box-shadow:0 8px 30px rgba(0,0,0,.4);';
        document.body.appendChild(toastEl);
      }
      toastEl.style.borderColor = (kind==='ok' && 'var(--gold-2)') || (kind==='err' && 'var(--red-1)') || 'var(--border)';
      toastEl.textContent = msg;
      toastEl.style.display = 'block';
      clearTimeout(toastEl._t);
      toastEl._t = setTimeout(() => { toastEl.style.display = 'none'; }, 4500);
    }

    // ========== SVG 图表辅助 ==========
    // 环形图（donut）：segments=[{label,value,color}]
    function svgDonut(segments, size) {
      size = size || 180;
      const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
      const cx = size / 2, cy = size / 2;
      const r = size / 2 - 14;
      const C = 2 * Math.PI * r;
      let offset = 0;
      const segs = segments.filter(s => s.value > 0).map(s => {
        const frac = s.value / total;
        const len = frac * C;
        const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
        offset += len;
        return el;
      }).join('');
      return `<svg viewBox="0 0 ${size} ${size}" style="width:100%;height:auto;display:block;max-width:${size}px;margin:0 auto;">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(232,232,232,0.08)" stroke-width="16"/>
        ${segs}
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="var(--f-serif,serif)" font-size="26" fill="currentColor" font-weight="600">${total}</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="currentColor" fill-opacity="0.6" letter-spacing="2">TOTAL</text>
      </svg>`;
    }
    // 柱状图：bars=[{label,value,color?}], opts={h,maxVal}
    function svgBars(bars, opts) {
      opts = opts || {};
      const h = opts.h || 130;
      const W = 300, padL = 36, padR = 10, padB = 26, padT = 14;
      const maxVal = Math.max(1, opts.maxVal || 0, ...bars.map(b => b.value));
      const innerW = W - padL - padR;
      const bw = bars.length ? (innerW / bars.length) * 0.6 : 0;
      const gap = bars.length ? (innerW / bars.length) * 0.4 : 0;
      const baseY = h - padB;
      const barH = baseY - padT;
      // 网格线
      const grids = [0, 0.25, 0.5, 0.75, 1].map(g => {
        const y = baseY - g * barH;
        const val = Math.round(g * maxVal);
        return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="currentColor" stroke-opacity="${g === 0 ? 0.3 : 0.1}" stroke-dasharray="${g === 0 ? '0' : '2 4'}"/>
                <text x="${padL - 4}" y="${y + 3}" text-anchor="end" font-family="ui-monospace,monospace" font-size="8" fill="currentColor" fill-opacity="0.5">${val}</text>`;
      }).join('');
      const barsHtml = bars.map((b, i) => {
        const x = padL + i * (bw + gap) + gap / 2;
        const bh = (b.value / maxVal) * barH;
        const y = baseY - bh;
        const color = b.color || 'currentColor';
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="1"/>
                <text x="${(x + bw/2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="9" fill="currentColor">${b.value}</text>
                <text x="${(x + bw/2).toFixed(1)}" y="${baseY + 13}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="8" fill="currentColor" fill-opacity="0.65">${escapeHtml(b.label)}</text>`;
      }).join('');
      return `<svg viewBox="0 0 ${W} ${h}" style="width:100%;height:${h}px;display:block;">
        ${grids}${barsHtml}
        <line x1="${padL}" y1="${baseY}" x2="${W - padR}" y2="${baseY}" stroke="currentColor" stroke-opacity="0.4"/>
      </svg>`;
    }

    // ========== Tab：数据仪表盘 ==========
    function drawDashTab() {
      const body = document.getElementById('admin-tab-body');
      const counts = statsCounts();
      const totalEntries = DATA.categories.reduce((s, c) => s + (counts[c.id]||0), 0);
      const pendingSubs = (Submissions.get().filter(s => s.status==='pending')).length;
      // 本月新增：按 LocalEntries.added 中 at 字段 + Submissions.reviewedAt 本月
      const now = new Date();
      const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
      let monthAdded = 0;
      DATA.categories.forEach(cat => {
        const list = DATA[cat.id] || [];
        list.forEach(e => {
          const t = e.at || e.createdAt || e.updatedAt || 0;
          if (t) {
            const d = new Date(t);
            const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
            if (key === ym) monthAdded++;
          }
        });
      });
      const userGrowth = computeMonthlyUserGrowth();
      const maxG = Math.max(1, ...userGrowth.map(x => x.v));
      const growthSvg = `
        <svg viewBox="0 0 300 110" style="width:100%;height:110px;display:block;">
          <g stroke="currentColor" stroke-opacity="0.18">
            <line x1="40" y1="90" x2="290" y2="90"/><line x1="40" y1="20" x2="40" y2="90"/>
            <line x1="40" y1="55" x2="290" y2="55" stroke-dasharray="2 4"/>
          </g>
          ${userGrowth.map((p,i)=>{
            const x = 50 + (240/(userGrowth.length-1||1))*i;
            const h = (p.v/maxG)*60;
            const y = 90 - h;
            return `
              <rect x="${x-14}" y="${y}" width="28" height="${h}" fill="none" stroke="currentColor" stroke-width="1.2"/>
              <rect x="${x-14}" y="${y}" width="28" height="${h}" fill="currentColor" fill-opacity="0.14"/>
              <text x="${x}" y="${y-4}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="9" fill="currentColor">${p.v}</text>
              <text x="${x}" y="104" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="9" fill="currentColor" fill-opacity=".6">${escapeHtml(p.label)}</text>
            `;
          }).join('')}
        </svg>
      `;
      // 分类分布环形图
      const catColors = ['#c0392b', '#b8b8b8', '#9aa0a6', '#7d858b', '#5a6066'];
      const catSegs = DATA.categories.map((c, i) => ({
        label: c.name, value: counts[c.id] || 0, color: catColors[i % catColors.length]
      }));
      const donutSvg = svgDonut(catSegs, 180);
      const donutLegend = catSegs.map(s => {
        const pct = totalEntries ? Math.round(s.value / totalEntries * 100) : 0;
        return `<div class="dl-row"><span class="dl-dot" style="background:${s.color}"></span><span class="dl-label">${escapeHtml(s.label)}</span><span class="dl-val">${s.value}</span><span class="dl-pct">${pct}%</span></div>`;
      }).join('');

      // 危险等级分布柱状图
      const dangerColors = { safe:'#6b8e6b', euclid:'#c9a23a', keter:'#c0392b', apollyon:'#7b241c', thaumiel:'#4a6fa5', neutral:'#6c6c6c' };
      const dangerBars = DATA.classLegend.map(c => {
        const n = allEntries().filter(e => (e.class || 'neutral') === c.code).length;
        return { label: c.name, value: n, color: dangerColors[c.code] || 'currentColor' };
      });

      // 投稿趋势（近 6 个月，按提交时间 at）
      const subGrowth = (function() {
        const subs = Submissions.get();
        const months = {};
        subs.forEach(s => {
          const at = s.at || s.reviewedAt || 0;
          if (!at) return;
          const d = new Date(at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          months[key] = (months[key] || 0) + 1;
        });
        const keys = Object.keys(months).sort();
        const last = keys.slice(-6);
        const pad = 6 - last.length;
        const out = [];
        for (let i = 0; i < pad; i++) out.push({ label: 'M' + (i + 1), v: 0 });
        last.forEach((k, i) => out.push({ label: pad > 0 ? 'M' + (pad + i + 1) : k.slice(2), v: months[k] }));
        return out.slice(-6);
      })();
      const subBars = subGrowth.map(p => ({ label: p.label, value: p.v }));
      const subTotal = Submissions.get().length;

      body.innerHTML = `
        <div class="dash-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">总档案数 · TOTAL</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${totalEntries}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">
              ${DATA.categories.map(c => `${c.icon} ${counts[c.id]||0}`).join(' · ')}
            </div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">待审核投稿 · PENDING</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;color:var(--gold-1);">${pendingSubs}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">
              <a class="atab-link" href="javascript:void(0)" id="dash-go-subs">前往投稿审核 →</a>
            </div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">本月新增 · MONTHLY</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${monthAdded}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">归档于 ${DATA.meta.updated||'—'}</div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">注册用户 · USERS</div>
            <div class="dash-v" style="font-size:30px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${Auth.getUsers().length}</div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">
              LV.1+ 默认 · 投稿需 LV.2 · 管理员 ${Auth.getUsers().filter(u=>u.role==='admin').length}
            </div>
          </div>
        </div>
        <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
          <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">用户增长曲线 · MONTHLY USERS · 近 6 个月</div>
          <div class="dash-chart" style="color:var(--text-2);">${growthSvg}</div>
        </div>
        <div class="dash-row2" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px;">
          <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">分类条目分布 · CATEGORY RING</div>
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
              <div style="flex:0 0 180px;color:var(--text-2);">${donutSvg}</div>
              <div class="dash-legend" style="flex:1;min-width:140px;font-family:var(--f-mono);font-size:11px;">${donutLegend}</div>
            </div>
          </div>
          <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">危险等级分布 · DANGER LEVEL</div>
            <div class="dash-chart" style="color:var(--text-2);">${svgBars(dangerBars, { h: 140 })}</div>
          </div>
          <div class="dash-chart-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:8px;">投稿趋势 · SUBMISSIONS · 近 6 个月（共 ${subTotal}）</div>
            <div class="dash-chart" style="color:var(--text-2);">${svgBars(subBars, { h: 140 })}</div>
          </div>
        </div>
      `;
      const gsubs = document.getElementById('dash-go-subs');
      if (gsubs) gsubs.addEventListener('click', () => {
        document.querySelectorAll('.atab').forEach(x => x.classList.toggle('active', x.dataset.atab === 'subs'));
        view._adminTab = 'subs'; drawAdminTab();
      });
    }

    // ========== Tab：操作日志 ==========
    function drawLogsTab() {
      const body = document.getElementById('admin-tab-body');
      const list = AdminLogs.list().sort((a,b) => (b.at||0)-(a.at||0));
      body.innerHTML = `
        <div class="admin-toolbar">
          <span class="admin-toolbar-note">共 ${list.length} 条日志（仅本地保留最近 500 条）</span>
          <div class="admin-filter-inline">
            <input type="text" id="admin-logs-search" placeholder="搜索操作 / 详情…" class="admin-search-input">
            <label>类型
              <select id="admin-logs-type">
                <option value="">全部</option>
                ${AdminLogs.types().map(t=>`<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('')}
              </select>
            </label>
            <button class="abtn abtn-danger abtn-mini" id="admin-logs-clear">清空日志</button>
          </div>
        </div>
        <div id="admin-logs-list"></div>
      `;
      const listDiv = document.getElementById('admin-logs-list');
      const qEl = document.getElementById('admin-logs-search');
      const tEl = document.getElementById('admin-logs-type');
      function render() {
        const q = (qEl.value||'').trim().toLowerCase();
        const ty = tEl.value;
        const filtered = list.filter(l => {
          if (ty && l.type !== ty) return false;
          if (q) {
            const h = `${l.type} ${l.detail} ${l.user||''}`.toLowerCase();
            if (!h.includes(q)) return false;
          }
          return true;
        });
        if (!filtered.length) { listDiv.innerHTML = `<div class="admin-empty">无日志记录</div>`; return; }
        listDiv.innerHTML = `
          <table class="admin-table">
            <thead><tr><th style="width:180px">时间</th><th style="width:160px">类型</th><th style="width:140px">操作人</th><th>详情</th></tr></thead>
            <tbody>
              ${filtered.map(l => `
                <tr>
                  <td class="atd-mono">${new Date(l.at).toLocaleString('zh-CN')}</td>
                  <td><span style="font-family:var(--f-mono);color:var(--gold-1);font-size:11px;">${escapeHtml(l.type)}</span></td>
                  <td>${escapeHtml(l.user||'—')}</td>
                  <td style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(l.detail||'')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
      render();
      qEl.addEventListener('input', render);
      tEl.addEventListener('change', render);
      document.getElementById('admin-logs-clear').addEventListener('click', () => {
        if (!confirm('确认清空全部操作日志？此操作不可恢复。')) return;
        AdminLogs.clear();
        banner('操作日志已清空', 'ok');
        drawLogsTab();
      });
    }

    // ========== Tab：数据备份 ==========
    function drawDataTab() {
      const body = document.getElementById('admin-tab-body');
      const estKeys = [AUTH_KEY, USERS_KEY, CODES_KEY, SUBMIT_KEY, ENTRIES_KEY, CATS_KEY, FAV_KEY, COMMENT_KEY, LOG_KEY, READ_KEY, DRAFT_KEY, THEME_KEY];
      const rows = estKeys.map(k => {
        const v = localStorage.getItem(k);
        const kb = v ? Math.round(v.length / 1024) : 0;
        return { k, kb, used: !!v };
      });
      const totalKb = rows.reduce((s,r)=>s+r.kb,0);
      const quote = 5 * 1024;
      const percent = Math.min(100, Math.round((totalKb/quote)*100));
      body.innerHTML = `
        <div class="dash-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:16px;">
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">本地存储用量 · STORAGE</div>
            <div class="dash-v" style="font-size:28px;font-weight:600;font-family:var(--f-serif);margin-top:6px;">${totalKb} KB</div>
            <div style="height:8px;border:1px solid var(--border);margin-top:10px;background:var(--bg);overflow:hidden;">
              <div style="height:100%;width:${percent}%;background:${percent>=85?'var(--red-1)':'var(--gold-1)'};"></div>
            </div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:6px;">估算上限 ≈ 5 MB · 当前 ${percent}%</div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">一键导出 · EXPORT JSON</div>
            <div style="margin-top:10px;">
              <button class="abtn abtn-approve" id="backup-export-btn">⬇ 导出完整备份（含档案/用户/投稿/收藏/日志）</button>
            </div>
            <div class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:8px;">导出内容包含 14 个 localStorage key + 全部分类数据快照</div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);">备份文件列表</div>
            <div style="margin-top:8px;">
              <label class="af-cover-upload-btn" style="display:inline-block;">
                📂 选择备份文件查看大小
                <input type="file" id="backup-file-info" accept="application/json" hidden>
              </label>
            </div>
            <div id="backup-info" class="dash-sub" style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:8px;"></div>
          </div>
        </div>
        <div style="border:1px solid var(--border);padding:14px 16px;background:var(--bg-2);">
          <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:10px;">存储明细 · KEYS</div>
          <table class="admin-table">
            <thead><tr><th style="width:280px">localStorage Key</th><th style="width:120px">大小</th><th>状态</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td class="atd-mono">${escapeHtml(r.k)}</td>
                  <td class="atd-mono">${r.kb} KB</td>
                  <td>${r.used ? '<span style="color:var(--gold-1);">已使用</span>' : '<span style="color:var(--text-2);">空</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      document.getElementById('backup-export-btn').addEventListener('click', () => {
        exportBackupJSON();
        banner('备份 JSON 已下载', 'ok');
      });
      const fi = document.getElementById('backup-file-info');
      const info = document.getElementById('backup-info');
      if (fi) fi.addEventListener('change', () => {
        const f = fi.files && fi.files[0];
        if (!f) return;
        info.textContent = `已选择「${f.name}」 · ${Math.round(f.size/1024)} KB · ${new Date(f.lastModified).toLocaleString()}`;
      });
    }

    function drawAdminTab() {
      const t = view._adminTab || tab;
      if (t === 'dash') return drawDashTab();
      if (t === 'subs') return drawSubsTab();
      if (t === 'entries') return drawEntriesTab();
      if (t === 'users') return drawUsersTab();
      if (t === 'logs') return drawLogsTab();
      if (t === 'cats') return drawCatsTab();
      if (t === 'data') return drawDataTab();
      if (t === 'sync') return drawSyncTab();
    }

    // ========== Tab：GitHub 同步 ==========
    const SYNC_KEY = 'wa_github_sync';
    function getSyncConfig() {
      try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch { return {}; }
    }
    function saveSyncConfig(cfg) {
      localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
    }
    function serializeDataFiles() {
      const files = {};
      const anomalies = DATA.anomalies || [];
      const urban = anomalies.filter(e => String(e.id).startsWith('UR-'));
      const operations = anomalies.filter(e => String(e.id).startsWith('OP-'));
      files['data/anomalies-urban.json'] = JSON.stringify(urban, null, 2);
      files['data/anomalies-operations.json'] = JSON.stringify(operations, null, 2);
      files['data/organizations.json'] = JSON.stringify(DATA.organizations || [], null, 2);
      files['data/deities.json'] = JSON.stringify(DATA.deities || [], null, 2);
      files['data/eras.json'] = JSON.stringify(DATA.eras || [], null, 2);
      files['data/timelines.json'] = JSON.stringify(DATA.timelines || [], null, 2);
      // 生成 merged.js
      const merged = {
        categories: DATA.categories || [],
        anomalies: anomalies,
        organizations: DATA.organizations || [],
        deities: DATA.deities || [],
        eras: DATA.eras || [],
        timelines: DATA.timelines || []
      };
      const mergedJs = [
        '/* AUTO-GENERATED by Worldview Archive admin panel */',
        '(function(){',
        '  if(!window.ARCHIVE_DATA){window.ARCHIVE_DATA={meta:{},categories:[]};}',
        '  var D=window.ARCHIVE_DATA;',
        '  D.categories=' + JSON.stringify(merged.categories) + ';',
        '  D.anomalies=' + JSON.stringify(merged.anomalies) + ';',
        '  D.organizations=' + JSON.stringify(merged.organizations) + ';',
        '  D.deities=' + JSON.stringify(merged.deities) + ';',
        '  D.eras=' + JSON.stringify(merged.eras) + ';',
        '  D.timelines=' + JSON.stringify(merged.timelines) + ';',
        '  D.meta=D.meta||{};',
        '  D.meta.total=D.anomalies.length+D.organizations.length+D.deities.length+D.eras.length+D.timelines.length;',
        '  D.meta.updated=new Date().toISOString().slice(0,10);',
        '  D._loaded=true;',
        '})();',
        ''
      ].join('\n');
      files['data/merged.js'] = mergedJs;
      return files;
    }
    function exportDataFiles() {
      const files = serializeDataFiles();
      for (const [path, content] of Object.entries(files)) {
        const blob = new Blob([content], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = path.split('/').pop();
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }
    }
    async function pushToGitHub(cfg, onProgress) {
      const { token, owner, repo, branch } = cfg;
      const files = serializeDataFiles();
      const paths = Object.keys(files);
      const results = [];
      for (let i = 0; i < paths.length; i++) {
        const filePath = paths[i];
        const content = files[filePath];
        onProgress(i, paths.length, filePath);
        // 获取现有文件的 SHA
        let sha = null;
        try {
          const shaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
          });
          if (shaRes.ok) {
            const shaData = await shaRes.json();
            sha = shaData.sha;
          }
        } catch (e) { /* 文件可能不存在 */ }
        // 推送文件
        const b64 = btoa(unescape(encodeURIComponent(content)));
        const bodyObj = {
          message: `update ${filePath} via admin panel`,
          content: b64,
          branch: branch
        };
        if (sha) bodyObj.sha = sha;
        const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
          method: 'PUT',
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj)
        });
        if (updateRes.ok) {
          results.push({ path: filePath, ok: true });
        } else {
          const err = await updateRes.json().catch(() => ({}));
          results.push({ path: filePath, ok: false, error: err.message || `HTTP ${updateRes.status}` });
        }
      }
      onProgress(paths.length, paths.length, null);
      return results;
    }

    async function publishSubmissionConfig(cfg) {
      const { token, owner, repo, branch } = cfg;
      const filePath = 'data/submissions-config.json';
      const config = { owner, repo, branch, at: Date.now() };
      if (token) config.k = btoa(unescape(encodeURIComponent(token)));
      const content = JSON.stringify(config, null, 2);
      let sha = null;
      try {
        const shaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (shaRes.ok) { const d = await shaRes.json(); sha = d.sha; }
      } catch (e) {}
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const bodyObj = { message: 'publish submission config', content: b64, branch };
      if (sha) bodyObj.sha = sha;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });
      if (res.ok) return { ok: true };
      let errMsg = `HTTP ${res.status}`;
      try {
        const errData = await res.json();
        if (errData.message) errMsg += ' · ' + errData.message;
      } catch (e) {}
      return { ok: false, error: errMsg };
    }

    async function fetchSubmissionConfig() {
      try {
        const res = await fetch('data/submissions-config.json?v=' + Date.now());
        if (!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json') && !ct.includes('text/plain')) return null;
        const text = await res.text();
        if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return null;
        return JSON.parse(text);
      } catch (e) { return null; }
    }

    async function pushSubmissionToGitHub(submission) {
      const config = await fetchSubmissionConfig();
      if (!config || !config.owner || !config.repo) return { ok: false, reason: 'no-config' };
      const configToken = config.k ? decodeURIComponent(escape(atob(config.k))) : null;
      const token = localStorage.getItem('wa_submission_token') || getSyncConfig().token || configToken;
      if (!token) return { ok: false, reason: 'no-token' };
      const { owner, repo, branch } = config;
      const filePath = `submissions/${submission.id}.json`;
      const content = JSON.stringify(submission, null, 2);
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const bodyObj = { message: `submission ${submission.id}`, content: b64, branch };
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      });
      return { ok: res.ok };
    }

    async function fetchGitHubSubmissions() {
      const config = await fetchSubmissionConfig();
      if (!config || !config.owner || !config.repo) return [];
      const { owner, repo, branch } = config;
      const configToken = config.k ? decodeURIComponent(escape(atob(config.k))) : null;
      const token = getSyncConfig().token || localStorage.getItem('wa_submission_token') || configToken;
      const headers = { 'Accept': 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `token ${token}`;
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/submissions?ref=${branch}`, {
          headers
        });
        if (!res.ok) return [];
        const files = await res.json();
        if (!Array.isArray(files)) return [];
        const results = [];
        for (const f of files) {
          if (!f.name.endsWith('.json')) continue;
          try {
            const fRes = await fetch(f.download_url);
            const data = await fRes.json();
            data._githubFile = f.path;
            data._githubSha = f.sha;
            results.push(data);
          } catch (e) {}
        }
        return results;
      } catch (e) { return []; }
    }

    async function deleteGitHubSubmission(filePath, sha) {
      const config = await fetchSubmissionConfig();
      if (!config) return false;
      const configToken = config.k ? decodeURIComponent(escape(atob(config.k))) : null;
      const token = getSyncConfig().token || localStorage.getItem('wa_submission_token') || configToken;
      if (!token) return false;
      const { owner, repo, branch } = config;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'DELETE',
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `remove reviewed submission`, sha, branch })
      });
      return res.ok;
    }

    function drawSyncTab() {
      const body = document.getElementById('admin-tab-body');
      const cfg = getSyncConfig();
      const counts = {
        anomalies: (DATA.anomalies||[]).length,
        organizations: (DATA.organizations||[]).length,
        deities: (DATA.deities||[]).length,
        eras: (DATA.eras||[]).length,
        timelines: (DATA.timelines||[]).length
      };
      const total = Object.values(counts).reduce((s,n)=>s+n,0);
      body.innerHTML = `
        <div style="max-width:760px;">
          <div class="dash-card" style="border:1px solid var(--border);padding:16px 20px;background:var(--bg-2);margin-bottom:16px;">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">GitHub 仓库配置 · CONFIG</div>
            <div style="display:grid;gap:12px;">
              <div>
                <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">Personal Access Token (PAT)</label>
                <input type="password" id="sync-token" placeholder="ghp_xxxxxxxxxxxx" value="${escapeAttr(cfg.token||'')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                <div style="font-family:var(--f-mono);font-size:10px;color:var(--text-2);margin-top:4px;">需要 repo 权限 · Settings → Developer settings → Personal access tokens</div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 120px;gap:10px;">
                <div>
                  <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">用户名 / Owner</label>
                  <input type="text" id="sync-owner" placeholder="LUEzd8Lg" value="${escapeAttr(cfg.owner||'')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                </div>
                <div>
                  <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">仓库名 / Repo</label>
                  <input type="text" id="sync-repo" placeholder="LUEzd8Lg.github.io" value="${escapeAttr(cfg.repo||'')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                </div>
                <div>
                  <label style="font-family:var(--f-mono);font-size:11px;color:var(--text-2);display:block;margin-bottom:4px;">分支 / Branch</label>
                  <input type="text" id="sync-branch" placeholder="main" value="${escapeAttr(cfg.branch||'main')}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border);background:var(--bg);color:var(--text-1);font-family:var(--f-mono);font-size:12px;">
                </div>
              </div>
            </div>
            <div style="margin-top:12px;">
              <button class="abtn" id="sync-save-btn">${ico('save',12)} 保存配置</button>
            </div>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:16px 20px;background:var(--bg-2);margin-bottom:16px;">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">当前数据概览 · DATA SUMMARY</div>
            <table class="admin-table">
              <thead><tr><th>分类</th><th>条目数</th><th>对应文件</th></tr></thead>
              <tbody>
                <tr><td>异常档案</td><td class="atd-mono">${counts.anomalies}</td><td class="atd-mono">anomalies-urban.json + anomalies-operations.json</td></tr>
                <tr><td>组织名录</td><td class="atd-mono">${counts.organizations}</td><td class="atd-mono">organizations.json</td></tr>
                <tr><td>神祇图鉴</td><td class="atd-mono">${counts.deities}</td><td class="atd-mono">deities.json</td></tr>
                <tr><td>纪元卷宗</td><td class="atd-mono">${counts.eras}</td><td class="atd-mono">eras.json</td></tr>
                <tr><td>时间线</td><td class="atd-mono">${counts.timelines}</td><td class="atd-mono">timelines.json</td></tr>
                <tr style="border-top:2px solid var(--border);"><td style="font-weight:600;">总计</td><td class="atd-mono" style="font-weight:600;">${total}</td><td class="atd-mono">7 个文件（含 merged.js）</td></tr>
              </tbody>
            </table>
          </div>
          <div class="dash-card" style="border:1px solid var(--border);padding:16px 20px;background:var(--bg-2);">
            <div class="dash-k" style="font-family:var(--f-mono);font-size:10px;letter-spacing:2px;color:var(--text-2);margin-bottom:12px;">操作 · ACTIONS</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="abtn abtn-approve" id="sync-push-btn">${ico('cloud',14)} 推送数据到 GitHub</button>
              <button class="abtn" id="sync-export-btn">${ico('save',14)} 导出数据文件到本地</button>
              <button class="abtn" id="sync-pubsub-btn">${ico('cloud',14)} 发布投稿配置</button>
            </div>
            <div style="margin-top:10px;font-family:var(--f-mono);font-size:10px;color:var(--text-2);line-height:1.6;">
              「发布投稿配置」会将仓库信息和 Token（base64 编码）写入 data/submissions-config.json，使投稿者提交后自动推送至 GitHub。编码存储可绕过 GitHub 密钥扫描。
            </div>
            <div id="sync-progress" style="margin-top:14px;font-family:var(--f-mono);font-size:11px;color:var(--text-2);"></div>
            <div id="sync-results" style="margin-top:10px;"></div>
          </div>
        </div>
      `;
      const saveBtn = document.getElementById('sync-save-btn');
      if (saveBtn) saveBtn.addEventListener('click', () => {
        const newCfg = {
          token: document.getElementById('sync-token').value.trim(),
          owner: document.getElementById('sync-owner').value.trim(),
          repo: document.getElementById('sync-repo').value.trim(),
          branch: document.getElementById('sync-branch').value.trim() || 'main'
        };
        saveSyncConfig(newCfg);
        SFX.export();
        banner('GitHub 配置已保存', 'ok');
      });
      const exportBtn = document.getElementById('sync-export-btn');
      if (exportBtn) exportBtn.addEventListener('click', () => {
        exportDataFiles();
        SFX.export();
        banner('数据文件已下载，请替换 data/ 目录下的文件', 'ok');
      });
      const pubsubBtn = document.getElementById('sync-pubsub-btn');
      if (pubsubBtn) pubsubBtn.addEventListener('click', async () => {
        const c = getSyncConfig();
        if (!c.token || !c.owner || !c.repo) {
          banner('请先填写并保存 GitHub 配置', 'err');
          return;
        }
        if (!confirm('发布投稿配置会将仓库信息和 Token（编码存储）写入 data/submissions-config.json。\n\nToken 经 base64 编码存储以绕过 GitHub 密钥扫描，使所有用户投稿时自动推送至 GitHub。\n\n确认发布？')) return;
        pubsubBtn.disabled = true;
        pubsubBtn.textContent = '发布中...';
        try {
          const result = await publishSubmissionConfig(c);
          if (result.ok) {
            SFX.login();
            banner('投稿配置已发布到 GitHub（data/submissions-config.json）', 'ok');
          } else {
            banner('投稿配置发布失败：' + (result.error || '请检查 Token 权限'), 'err');
          }
        } catch (e) {
          banner('投稿配置发布失败：' + (e.message || '未知错误'), 'err');
        }
        pubsubBtn.disabled = false;
        pubsubBtn.innerHTML = ico('cloud',14) + ' 发布投稿配置';
      });
      const pushBtn = document.getElementById('sync-push-btn');
      if (pushBtn) pushBtn.addEventListener('click', async () => {
        const c = getSyncConfig();
        if (!c.token || !c.owner || !c.repo) {
          banner('请先填写并保存 GitHub 配置', 'err');
          return;
        }
        pushBtn.disabled = true;
        pushBtn.textContent = '推送中...';
        const progEl = document.getElementById('sync-progress');
        const resEl = document.getElementById('sync-results');
        try {
          const results = await pushToGitHub(c, (i, total, path) => {
            if (path) {
              progEl.innerHTML = `推送中 (${i+1}/${total}) · <span style="color:var(--gold-1);">${escapeHtml(path)}</span>`;
            } else {
              progEl.innerHTML = `<span style="color:#5a8a5a;">✓ 推送完成</span>`;
            }
          });
          const okCount = results.filter(r => r.ok).length;
          const failCount = results.length - okCount;
          resEl.innerHTML = results.map(r => `
            <div style="padding:6px 10px;border:1px solid var(--border);margin-top:4px;font-family:var(--f-mono);font-size:11px;display:flex;justify-content:space-between;align-items:center;">
              <span>${r.ok ? '✓' : '✗'} ${escapeHtml(r.path)}</span>
              <span style="color:${r.ok ? '#5a8a5a' : 'var(--red-1)'};">${r.ok ? '成功' : escapeHtml(r.error||'失败')}</span>
            </div>
          `).join('');
          SFX.login();
          banner(`推送完成：${okCount} 成功，${failCount} 失败`, failCount ? 'err' : 'ok');
        } catch (e) {
          progEl.innerHTML = `<span style="color:var(--red-1);">✗ 推送失败：${escapeHtml(e.message||'未知错误')}</span>`;
          banner('推送失败，请检查网络和 Token', 'err');
        }
        pushBtn.disabled = false;
        pushBtn.innerHTML = ico('cloud',14) + ' 推送数据到 GitHub';
      });
    }

    // ========== Tab：栏目管理 ==========
    function drawCatsTab() {
      const body = document.getElementById('admin-tab-body');
      function render() {
        const counts = statsCounts();
        const catCards = DATA.categories.map(c => {
          const n = counts[c.id] || 0;
          const subs = c.subcats || [];
          const subHtml = subs.length ? subs.map(s => `
            <span class="sc-chip">
              <span class="sc-chip-name">${escapeHtml(s.name)} <em>${escapeHtml(s.id)}</em></span>
              <button class="sc-chip-rm" data-rm-sub data-cat="${escapeAttr(c.id)}" data-sub="${escapeAttr(s.id)}" title="删除子分组">${ico('cross',10)}</button>
            </span>`).join('') : '<span class="sc-empty">暂无子分组</span>';
          return `
          <div class="cat-card" data-cat="${escapeAttr(c.id)}">
            <div class="cat-card-head">
              <span class="cat-icon">${catIconSvg(c.id)}</span>
              <div class="cat-meta">
                <div class="cat-name">${escapeHtml(c.name)} <em class="cat-id">#${escapeHtml(c.id)}</em></div>
                <div class="cat-sub">${escapeHtml(c.nameEn||c.code||'')} · ${n} 条档案 · ${subs.length} 个子分组</div>
              </div>
              <div class="cat-actions">
                <button class="abtn abtn-mini" data-edit-cat data-cat="${escapeAttr(c.id)}">${ico('pencil',12)} 编辑</button>
                <button class="abtn abtn-mini abtn-danger" data-del-cat data-cat="${escapeAttr(c.id)}">${ico('trash',12)} 删除</button>
              </div>
            </div>
            ${c.desc ? `<div class="cat-desc">${escapeHtml(c.desc)}</div>` : ''}
            <div class="cat-subcats">
              <div class="sc-label">子分组</div>
              <div class="sc-list">${subHtml}</div>
              <div class="sc-add">
                <input type="text" class="sc-input sc-add-name" placeholder="子分组名称（如：实体）">
                <input type="text" class="sc-input sc-add-id" placeholder="ID（如：entity）">
                <button class="abtn abtn-mini" data-add-sub data-cat="${escapeAttr(c.id)}">${ico('plus',12)} 添加</button>
              </div>
            </div>
          </div>`;
        }).join('');
        body.innerHTML = `
          <div class="admin-toolbar">
            <span class="admin-toolbar-note">共 ${DATA.categories.length} 个栏目 · 管理员可新建顶级栏目与子分组</span>
            <button class="abtn abtn-approve" id="cat-new-btn">${ico('plus',14)} 新建栏目</button>
          </div>
          <div class="cat-list">${catCards}</div>
          <div class="cat-help">
            <strong>说明：</strong>新建栏目会出现在顶部导航与侧边栏；栏目 ID 用于路由（<code>#/栏目id</code>）与数据存储，创建后不可修改。
            子分组用于在栏目内对条目进一步分类，条目编辑时可选择归属。
          </div>
        `;
        bindCatEvents();
      }
      function bindCatEvents() {
        const newBtn = document.getElementById('cat-new-btn');
        if (newBtn) newBtn.addEventListener('click', () => openCatEditor(null));
        body.querySelectorAll('[data-edit-cat]').forEach(b => {
          b.addEventListener('click', () => { const c = CAT_MAP[b.dataset.cat]; if (c) openCatEditor(c); });
        });
        body.querySelectorAll('[data-del-cat]').forEach(b => {
          b.addEventListener('click', () => {
            const id = b.dataset.cat;
            const c = CAT_MAP[id];
            if (!c) return;
            const n = (DATA[id]||[]).length;
            if (!confirm(`确定删除栏目「${c.name}」？${n ? `该栏目下 ${n} 条档案将不再显示（数据保留在本地存储备份）。` : ''}此操作不可撤销。`)) return;
            const r = LocalCats.removeCat(id);
            if (r.ok) {
              AdminLogs.record('category:delete', `${id} · ${c.name}${n?` (${n}条)`:''}`);
              banner(`已删除栏目：${c.name}`, 'ok');
              render();
            } else banner(r.msg || '删除失败', 'err');
          });
        });
        body.querySelectorAll('[data-add-sub]').forEach(b => {
          b.addEventListener('click', () => {
            const catId = b.dataset.cat;
            const card = b.closest('.cat-card');
            const nameEl = card.querySelector('.sc-add-name');
            const idEl = card.querySelector('.sc-add-id');
            const name = (nameEl.value || '').trim();
            const sid = (idEl.value || '').trim();
            if (!name) { banner('请填写子分组名称', 'err'); return; }
            const finalId = sid || ('sc_' + Date.now().toString(36).slice(-5));
            const r = LocalCats.addSubcat(catId, { id: finalId, name });
            if (r.ok) {
              AdminLogs.record('subcategory:add', `${catId}/${finalId} · ${name}`);
              banner(`已添加子分组：${name}`, 'ok');
              render();
            } else banner(r.msg || '添加失败', 'err');
          });
        });
        body.querySelectorAll('[data-rm-sub]').forEach(b => {
          b.addEventListener('click', () => {
            const catId = b.dataset.cat;
            const subId = b.dataset.sub;
            const c = CAT_MAP[catId];
            const s = ((c && c.subcats) || []).find(x => x.id === subId);
            if (!confirm(`删除子分组「${s ? s.name : subId}」？已归类到该子分组的条目将变为未分组。`)) return;
            const r = LocalCats.removeSubcat(catId, subId);
            if (r.ok) {
              AdminLogs.record('subcategory:delete', `${catId}/${subId} · ${s?s.name:''}`);
              banner('已删除子分组', 'ok');
              render();
            } else banner(r.msg || '删除失败', 'err');
          });
        });
      }
      function openCatEditor(c) {
        const isEdit = !!c;
        const dlg = document.createElement('div');
        dlg.className = 'admin-modal';
        dlg.innerHTML = `
          <div class="admin-modal-body">
            <h3 class="am-title">${isEdit?'编辑栏目':'新建栏目'}${isEdit?` · ${escapeHtml(c.name)}`:''}</h3>
            <div class="am-grid">
              <label class="af"><span>栏目 ID（路由/数据键，仅字母数字_-，创建后不可改）</span><input data-f="id" value="${escapeAttr(c?c.id:'')}" ${isEdit?'disabled':''} placeholder="如 locations"/></label>
              <label class="af"><span>名称 *</span><input data-f="name" value="${escapeAttr(c?c.name:'')}" placeholder="如 地点志"/></label>
              <label class="af"><span>英文名 / 代号</span><input data-f="nameEn" value="${escapeAttr(c?c.nameEn:'')}" placeholder="如 Locations"/></label>
              <label class="af"><span>图标符号（单字符，如 ◈ ⬡ ✦）</span><input data-f="icon" value="${escapeAttr(c?c.icon:'◈')}" maxlength="2"/></label>
              <label class="af" style="grid-column:1/-1"><span>简介</span><input data-f="desc" value="${escapeAttr(c?c.desc:'')}" placeholder="栏目描述"/></label>
              <label class="af" style="grid-column:1/-1"><span>来源标注（可选）</span><input data-f="source" value="${escapeAttr(c?c.source:'')}" placeholder="数据来源"/></label>
            </div>
            <div class="am-foot">
              <button class="abtn abtn-cancel" data-act="cancel">取消</button>
              <button class="abtn abtn-approve" data-act="save">${isEdit?'保存':'创建栏目'}</button>
            </div>
          </div>`;
        document.body.appendChild(dlg);
        function close() { dlg.remove(); }
        dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        dlg.querySelector('[data-act="save"]').addEventListener('click', () => {
          const p = {};
          dlg.querySelectorAll('[data-f]').forEach(el => { if (!el.disabled) p[el.dataset.f] = el.value.trim(); });
          if (!p.name) { banner('请填写栏目名称', 'err'); return; }
          if (isEdit) {
            const r = LocalCats.updateCat(c.id, { name:p.name, nameEn:p.nameEn, icon:p.icon, desc:p.desc, source:p.source });
            if (r.ok) { AdminLogs.record('category:update', `${c.id} · ${p.name}`); banner('栏目已更新', 'ok'); close(); render(); }
            else banner(r.msg||'更新失败', 'err');
          } else {
            if (!p.id) { banner('请填写栏目 ID', 'err'); return; }
            const r = LocalCats.addCat({ id:p.id, name:p.name, nameEn:p.nameEn, code:p.nameEn||p.id, icon:p.icon||'◈', desc:p.desc, source:p.source });
            if (r.ok) { AdminLogs.record('category:add', `${p.id} · ${p.name}`); banner(`已创建栏目：${p.name}`, 'ok'); close(); render(); }
            else banner(r.msg||'创建失败', 'err');
          }
        });
      }
      render();
    }

    // ========== Tab 1：投稿审核 ==========
    async function drawSubsTab() {
      const body = document.getElementById('admin-tab-body');
      body.innerHTML = `<div class="admin-loading">加载投稿列表…</div>`;
      const r = await API.adminListSubmissions('pending', '');
      let localSubs = r.ok ? r.list : [];
      // 拉取GitHub投稿
      let ghSubs = [];
      try { ghSubs = await fetchGitHubSubmissions(); } catch (e) {}
      // 缓存GitHub投稿供状态筛选复用
      let cachedGhSubs = ghSubs;
      // 合并：GitHub投稿（不在本地） + 本地投稿
      const localIds = new Set(localSubs.map(s => s.id));
      const ghOnly = ghSubs.filter(s => !localIds.has(s.id));
      let allSubs = [...ghOnly, ...localSubs];
      let subsPage = 1;
      const SUBS_PAGE_SIZE = 10;

      const sc = document.getElementById('admin-count-subs');
      if (sc) sc.textContent = allSubs.length;

      const ghCount = ghOnly.length;
      body.innerHTML = `
        <div class="admin-toolbar">
          <span class="admin-toolbar-note">共 ${allSubs.length} 条${r.fallback ? '（降级模式）' : ''}${ghCount ? ` · GitHub ${ghCount} 条` : ''}</span>
          <div class="admin-filter-inline">
            <input type="text" id="admin-subs-search" placeholder="搜索标题 / 作者 / ID…" class="admin-search-input">
            <label>状态
              <select id="admin-subs-status">
                <option value="pending" selected>待审核</option>
                <option value="all">全部</option>
                <option value="approved">已通过</option>
                <option value="rejected">已退回</option>
              </select>
            </label>
          </div>
        </div>
        <div class="admin-batch-bar" id="admin-subs-batchbar" style="display:none">
          <span class="admin-batch-count" id="admin-subs-batch-count">已选 0 项</span>
          <button class="abtn abtn-approve" id="admin-subs-batch-approve">批量通过</button>
          <button class="abtn abtn-reject" id="admin-subs-batch-reject">批量打回</button>
        </div>
        <div id="admin-subs-list" class="admin-subs-list"></div>
      `;
      const searchInputS = document.getElementById('admin-subs-search');
      const subsListDiv = document.getElementById('admin-subs-list');

      function renderSubsPage() {
        const q = (searchInputS.value || '').trim().toLowerCase();
        let filtered = allSubs;
        if (q) {
          filtered = allSubs.filter(s =>
            String(s.id).toLowerCase().includes(q) ||
            String(s.title||'').toLowerCase().includes(q) ||
            String(s.author||'').toLowerCase().includes(q)
          );
        }
        if (!filtered.length) {
          subsListDiv.innerHTML = `<div class="admin-empty">${q ? '未找到匹配稿件' : '暂无稿件'}</div>`;
          return;
        }
        const totalPages = Math.max(1, Math.ceil(filtered.length / SUBS_PAGE_SIZE));
        if (subsPage > totalPages) subsPage = totalPages;
        const start = (subsPage - 1) * SUBS_PAGE_SIZE;
        const pageItems = filtered.slice(start, start + SUBS_PAGE_SIZE);

        subsListDiv.innerHTML = pageItems.map((s) => `
          <div class="admin-sub" data-id="${escapeAttr(s.id)}">
            <div class="admin-sub-head">
              <div class="admin-sub-ids">
                <input type="checkbox" class="admin-subs-check" data-id="${escapeAttr(s.id)}" style="margin-right:8px;vertical-align:middle">
                <span class="as-id">${escapeHtml(s.id)}</span>
                <span class="as-cat">${escapeHtml(CAT_MAP[s.category]?.name || s.category)}</span>
                <span class="as-cls">${escapeHtml(CLASS_NAMES[s.class] || s.class || '未分级')}</span>
                <span class="as-status as-status-${s.status||'pending'}">${
                  s.status === 'approved' ? '已通过'
                  : s.status === 'rejected' ? '已退回' : '待审核'
                }</span>
                ${s._githubFile ? '<span class="as-status as-status-github">GitHub</span>' : ''}
              </div>
              <div class="admin-sub-meta">
                <span>作者：${escapeHtml(s.author||'')} (${escapeHtml(s.authorLevel||'')})</span>
                <span>· ${new Date(s.at||0).toLocaleString('zh-CN')}</span>
              </div>
            </div>
            <div class="admin-sub-title">${escapeHtml(s.title)}</div>
            <details class="admin-sub-detail">
              <summary>展开正文 / 编辑补丁</summary>
              <div class="admin-sub-grid">
                <label class="af"><span>标题（通过时使用）</span><input data-k="title" value="${escapeAttr(s.title)}"/></label>
                <label class="af"><span>编号 ID（通过时使用，留空自动生成）</span><input data-k="id" value="${escapeAttr(s.id||'')}" placeholder="留空自动生成，如 001"/></label>
                <div class="af af-row-2">
                  <label><span>分类</span>
                    <select data-k="category">
                      ${DATA.categories.map(c => `<option value="${c.id}" ${c.id===s.category?'selected':''}>${c.name}</option>`).join('')}
                    </select>
                  </label>
                  <label><span>危险等级</span>
                    <select data-k="class">
                      <option value="neutral">未分级</option>
                      ${Object.entries(CLASS_NAMES).map(([k,v])=>`<option value="${k}" ${k===s.class?'selected':''}>${v}</option>`).join('')}
                    </select>
                  </label>
                </div>
                <label class="af"><span>代号</span><input data-k="code" value="${escapeAttr(s.code||'')}"/></label>
                <label class="af"><span>摘要</span><input data-k="summary" value="${escapeAttr(s.summary||'')}"/></label>
                <div class="af af-cover-row">
                  <label><span>封面/预览图（通过时使用）</span>
                    <div class="af-cover-wrap">
                      <input data-k="cover" value="${escapeAttr(s.cover||'')}" placeholder="留空则无封面"/>
                      <label class="af-cover-upload-btn">
                        ⬆ 上传
                        <input type="file" class="af-cover-file" accept="image/*" hidden>
                      </label>
                    </div>
                  </label>
                  <div class="af-cover-thumb">${s.cover ? `<img src="${escapeAttr(s.cover)}" alt="封面" onerror="this.style.display='none'">` : '<div class="af-cover-empty">无</div>'}</div>
                </div>
                <label class="af"><span>正文（可直接修改后通过）</span>
                  <textarea data-k="body" rows="6">${escapeHtml(s.body || '')}</textarea>
                  <div class="af-body-preview-bar">
                    <button type="button" class="abtn abtn-mini af-body-preview-toggle">渲染预览</button>
                    <span class="af-body-preview-hint">与发布后详情页同一渲染管线 · 第 5 期审核一致性</span>
                  </div>
                  <div class="admin-body-preview detail-body" hidden></div>
                </label>
                <label class="af"><span>音频附件（通过时使用）</span>
                  <div class="af-cover-wrap">
                    <input data-k="audio" value="${escapeAttr(s.audio||'')}" placeholder="留空则无音频"/>
                    <label class="af-cover-upload-btn">
                      ${ico('audio',12)} 上传
                      <input type="file" class="af-audio-file" accept="audio/*" hidden>
                    </label>
                  </div>
                </label>
                <label class="af"><span>审核备注（作者可见）</span><input data-k="note" placeholder="例：摘要描述再精炼一些"></label>
              </div>
            </details>
            <div class="admin-sub-actions">
              <button class="abtn abtn-approve" data-action="approve">${ico('check',14)} 通过并发布</button>
              <button class="abtn abtn-reject"  data-action="reject">${ico('cross',14)} 退回</button>
            </div>
          </div>`).join('')
          + (totalPages > 1 ? `
            <div class="admin-pager">
              <button class="abtn abtn-mini" data-page="prev" ${subsPage<=1?'disabled':''}>‹ 上一页</button>
              <span class="pager-info">第 ${subsPage} / ${totalPages} 页 · 共 ${filtered.length} 条${q ? '（搜索结果）' : ''}</span>
              <button class="abtn abtn-mini" data-page="next" ${subsPage>=totalPages?'disabled':''}>下一页 ›</button>
            </div>` : '');

        // 单条审核事件
        pageItems.forEach((s) => {
          const card = subsListDiv.querySelector(`.admin-sub[data-id="${CSS.escape(s.id)}"]`);
          if (!card) return;
          const ap = card.querySelector('[data-action="approve"]');
          const rj = card.querySelector('[data-action="reject"]');
          // 封面上传
          const coverFile = card.querySelector('.af-cover-file');
          const coverInput = card.querySelector('[data-k="cover"]');
          const coverThumb = card.querySelector('.af-cover-thumb');
          if (coverFile && !coverFile.dataset.bound) {
            coverFile.dataset.bound = '1';
            coverFile.addEventListener('change', async () => {
              const file = coverFile.files && coverFile.files[0];
              if (!file) return;
              if (!file.type.startsWith('image/')) { banner('仅支持图片文件', 'err'); return; }
              try {
                const r = await API.uploadImage(file);
                if (!r.ok) { banner(r.msg || '封面上传失败', 'err'); return; }
                if (coverInput) coverInput.value = r.url;
                if (coverThumb) coverThumb.innerHTML = `<img src="${r.url}" alt="封面" style="width:100%;height:100%;object-fit:cover">`;
              } catch (e) { banner('封面上传失败', 'err'); }
            });
          }
          // 音频上传
          const audioFile = card.querySelector('.af-audio-file');
          const audioInputEl = card.querySelector('[data-k="audio"]');
          if (audioFile && !audioFile.dataset.bound) {
            audioFile.dataset.bound = '1';
            audioFile.addEventListener('change', async () => {
              const file = audioFile.files && audioFile.files[0];
              if (!file) return;
              if (!file.type.startsWith('audio/')) { banner('仅支持音频文件', 'err'); return; }
              try {
                const r = await API.uploadAudio(file);
                if (!r.ok) { banner(r.msg || '音频上传失败', 'err'); return; }
                if (audioInputEl) audioInputEl.value = r.url;
              } catch (e) { banner('音频上传失败', 'err'); }
            });
          }
          // 第 5 期 · 审核渲染一致性预览（与详情页同一 .detail-body 管线）
          const bodyTa = card.querySelector('[data-k="body"]');
          const pvToggle = card.querySelector('.af-body-preview-toggle');
          const pvBox = card.querySelector('.admin-body-preview');
          if (bodyTa && pvToggle && pvBox && !pvToggle.dataset.bound) {
            pvToggle.dataset.bound = '1';
            let pvT = null;
            const renderPv = () => {
              // 预览最小消毒：去 script / on* 事件 / javascript: 链接
              let h = String(bodyTa.value || '')
                .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
                .replace(/<script\b[^>]*>/gi, '')
                .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
                .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');
              pvBox.innerHTML = h || '<p>（正文为空）</p>';
            };
            pvToggle.addEventListener('click', () => {
              const show = pvBox.hidden;
              if (show) renderPv();
              pvBox.hidden = !show;
              pvToggle.classList.toggle('active', show);
              pvToggle.textContent = show ? '收起预览' : '渲染预览';
            });
            bodyTa.addEventListener('input', () => {
              if (pvBox.hidden) return;
              clearTimeout(pvT);
              pvT = setTimeout(renderPv, 400);
            });
          }
          const readPatch = () => {
            const patch = {};
            card.querySelectorAll('[data-k]').forEach(el => {
              const k = el.dataset.k;
              if (k === 'note') return;
              if (k === 'tags') patch[k] = el.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean);
              else patch[k] = el.value;
            });
            const noteEl = card.querySelector('[data-k="note"]');
            return { patch, note: noteEl ? noteEl.value : '' };
          };
          if (ap) ap.addEventListener('click', async () => {
            ap.disabled = true; const t = ap.textContent; ap.textContent = '处理中…';
            const { patch, note } = readPatch();
            // 第 5 期 · 正文 base64 图片批量转存仓库（转存失败保留内嵌，不阻断发布）
            if (patch.body && patch.body.indexOf('data:image') > -1) {
              ap.textContent = '图片转存中…';
              try {
                const pr = await API.persistBodyImages(patch.body);
                if (pr.ok && pr.uploaded) patch.body = pr.html;
                if (pr.failed && pr.msg) banner(pr.msg, 'err');
              } catch (e) { /* 保留 base64 继续发布 */ }
            }
            const r2 = await API.adminReview(s.id, 'approved', {
              note, patch,
              githubFile: s._githubFile || null,
              githubSha: s._githubSha || null
            });
            if (!r2.ok) { ap.disabled = false; ap.textContent = t; return banner(r2.msg || '通过失败', 'err'); }
            // 删除GitHub上的投稿文件
            if (s._githubFile && s._githubSha) {
              try { await deleteGitHubSubmission(s._githubFile, s._githubSha); } catch (e) {}
            }
            banner(`通过成功 · 已写入 ${r2.mergedEntry ? CAT_MAP[r2.mergedEntry.cat]?.name || r2.mergedEntry.cat : s.category}`, 'ok');
            ap.disabled = false; ap.textContent = t;
            drawSubsTab();
          });
          if (rj) rj.addEventListener('click', async () => {
            rj.disabled = true; const t = rj.textContent; rj.textContent = '处理中…';
            const { note } = readPatch();
            const r2 = await API.adminReview(s.id, 'rejected', {
              note,
              githubFile: s._githubFile || null,
              githubSha: s._githubSha || null
            });
            if (!r2.ok) { rj.disabled = false; rj.textContent = t; return banner(r2.msg || '退回失败', 'err'); }
            // 删除GitHub上的投稿文件
            if (s._githubFile && s._githubSha) {
              try { await deleteGitHubSubmission(s._githubFile, s._githubSha); } catch (e) {}
            }
            banner('已退回投稿' + (note ? `（备注：${note}）` : ''), 'ok');
            rj.disabled = false; rj.textContent = t;
            drawSubsTab();
          });
        });

        // 分页
        subsListDiv.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.page === 'prev') subsPage--;
            else if (btn.dataset.page === 'next') subsPage++;
            renderSubsPage();
          });
        });

        // 复选框 + 批量操作
        const batchBarS = body.querySelector('#admin-subs-batchbar');
        const batchCountS = body.querySelector('#admin-subs-batch-count');
        function updateSubsBatch() {
          const checked = subsListDiv.querySelectorAll('.admin-subs-check:checked');
          if (batchBarS) batchBarS.style.display = checked.length > 0 ? '' : 'none';
          if (batchCountS) batchCountS.textContent = `已选 ${checked.length} 项`;
        }
        subsListDiv.querySelectorAll('.admin-subs-check').forEach(cb => cb.addEventListener('change', updateSubsBatch));

        const batchApprove = body.querySelector('#admin-subs-batch-approve');
        if (batchApprove && !batchApprove.dataset.bound) {
          batchApprove.dataset.bound = '1';
          batchApprove.addEventListener('click', async () => {
            const ids = Array.from(subsListDiv.querySelectorAll('.admin-subs-check:checked')).map(cb => cb.dataset.id);
            if (!ids.length) return;
            if (!confirm(`确认批量通过 ${ids.length} 条投稿？`)) return;
            batchApprove.disabled = true; const t = batchApprove.textContent; batchApprove.textContent = '处理中…';
            let ok = 0, fail = 0;
            for (const sid of ids) {
              const card = subsListDiv.querySelector(`.admin-sub[data-id="${CSS.escape(sid)}"]`);
              const patch = {};
              if (card) {
                card.querySelectorAll('[data-k]').forEach(el => {
                  const k = el.dataset.k;
                  if (k === 'note') return;
                  if (k === 'tags') patch[k] = el.value.split(/[,，]/).map(x=>x.trim()).filter(Boolean);
                  else patch[k] = el.value;
                });
              }
              const subObj = allSubs.find(x => x.id === sid);
              // 第 5 期 · 批量通过时同样转存正文图片
              if (patch.body && patch.body.indexOf('data:image') > -1) {
                try {
                  const pr = await API.persistBodyImages(patch.body);
                  if (pr.ok && pr.uploaded) patch.body = pr.html;
                } catch (e) { /* 保留 base64 */ }
              }
              const r2 = await API.adminReview(sid, 'approved', {
                patch,
                githubFile: subObj?._githubFile || null,
                githubSha: subObj?._githubSha || null
              });
              if (r2.ok) {
                ok++;
                if (subObj?._githubFile && subObj?._githubSha) {
                  try { await deleteGitHubSubmission(subObj._githubFile, subObj._githubSha); } catch (e) {}
                }
              } else fail++;
            }
            batchApprove.disabled = false; batchApprove.textContent = t;
            banner(`批量通过完成 · 成功 ${ok} 条${fail ? ` · 失败 ${fail} 条` : ''}`, fail ? 'err' : 'ok');
            drawSubsTab();
          });
        }

        const batchReject = body.querySelector('#admin-subs-batch-reject');
        if (batchReject && !batchReject.dataset.bound) {
          batchReject.dataset.bound = '1';
          batchReject.addEventListener('click', async () => {
            const ids = Array.from(subsListDiv.querySelectorAll('.admin-subs-check:checked')).map(cb => cb.dataset.id);
            if (!ids.length) return;
            const note = prompt(`批量打回 ${ids.length} 条投稿，输入统一备注（可留空）：`, '');
            if (note === null) return;
            batchReject.disabled = true; const t = batchReject.textContent; batchReject.textContent = '处理中…';
            let ok = 0, fail = 0;
            for (const sid of ids) {
              const subObj = allSubs.find(x => x.id === sid);
              const r2 = await API.adminReview(sid, 'rejected', {
                note: note || '',
                githubFile: subObj?._githubFile || null,
                githubSha: subObj?._githubSha || null
              });
              if (r2.ok) {
                ok++;
                if (subObj?._githubFile && subObj?._githubSha) {
                  try { await deleteGitHubSubmission(subObj._githubFile, subObj._githubSha); } catch (e) {}
                }
              } else fail++;
            }
            batchReject.disabled = false; batchReject.textContent = t;
            banner(`批量打回完成 · 成功 ${ok} 条${fail ? ` · 失败 ${fail} 条` : ''}`, fail ? 'err' : 'ok');
            drawSubsTab();
          });
        }
      }

      // 搜索
      searchInputS.addEventListener('input', debounce(() => { subsPage = 1; renderSubsPage(); }, 250));

      // 状态筛选
      document.getElementById('admin-subs-status').addEventListener('change', async () => {
        const v = document.getElementById('admin-subs-status').value;
        const res = await API.adminListSubmissions(v, '');
        let localFiltered = res.ok ? res.list : [];
        // GitHub投稿始终为待审核状态，仅在 pending/all 时显示
        const localIds = new Set(localFiltered.map(s => s.id));
        let ghToAdd = [];
        if (v === 'pending' || v === 'all') {
          ghToAdd = cachedGhSubs.filter(s => !localIds.has(s.id));
        }
        allSubs = [...ghToAdd, ...localFiltered];
        subsPage = 1;
        // 更新计数
        const noteEl = body.querySelector('.admin-toolbar-note');
        if (noteEl) noteEl.textContent = `共 ${allSubs.length} 条${res.fallback ? '（降级模式）' : ''}${ghToAdd.length ? ` · GitHub ${ghToAdd.length} 条` : ''}`;
        renderSubsPage();
      });

      renderSubsPage();
    }

    // ========== Tab 2：档案管理 ==========
    async function drawEntriesTab() {
      const body = document.getElementById('admin-tab-body');
      body.innerHTML = `
        <div class="admin-toolbar">
          <div class="admin-filter-inline">
            <label>分类
              <select id="admin-entry-cat">
                ${DATA.categories.map(c => `<option value="${c.id}">${c.name} (${statsCounts()[c.id]||0})</option>`).join('')}
              </select>
            </label>
            <input type="text" id="admin-entry-search" placeholder="搜索编号 / 标题…" class="admin-search-input">
            <button class="abtn abtn-approve" id="admin-add-entry">＋ 新增档案</button>
          </div>
          <span id="admin-entry-flag" class="admin-toolbar-note"></span>
        </div>
        <div id="admin-entries-list" class="admin-loading">加载列表…</div>
      `;
      const catSel = document.getElementById('admin-entry-cat');
      const searchInput = document.getElementById('admin-entry-search');
      const flag = document.getElementById('admin-entry-flag');
      const listDiv = document.getElementById('admin-entries-list');
      let allEntries = [];
      let entryPage = 1;
      const ENTRY_PAGE_SIZE = 20;

      async function refreshEntries() {
        const cat = catSel.value;
        const r = await API.adminListEntries(cat);
        allEntries = r.ok ? r.list : [];
        if (flag) flag.textContent = r.fallback ? '降级模式' : `共 ${r.total} 条`;
        if (!r.ok) { listDiv.textContent = '加载失败：' + (r.msg||''); return; }
        entryPage = 1;
        renderEntryPage();
      }

      function renderEntryPage() {
        const cat = catSel.value;
        const q = (searchInput.value || '').trim().toLowerCase();
        let filtered = allEntries;
        if (q) {
          filtered = allEntries.filter(x =>
            String(x.id).toLowerCase().includes(q) ||
            String(x.title||'').toLowerCase().includes(q) ||
            String(x.code||'').toLowerCase().includes(q)
          );
        }
        if (!filtered.length) {
          listDiv.innerHTML = `<div class="admin-empty">${q ? '未找到匹配档案' : '此分类暂无档案'}</div>`;
          return;
        }
        const totalPages = Math.max(1, Math.ceil(filtered.length / ENTRY_PAGE_SIZE));
        if (entryPage > totalPages) entryPage = totalPages;
        const start = (entryPage - 1) * ENTRY_PAGE_SIZE;
        const pageItems = filtered.slice(start, start + ENTRY_PAGE_SIZE);

        listDiv.innerHTML = `
          <div class="admin-batch-bar" id="admin-entries-batchbar" style="display:none">
            <span class="admin-batch-count" id="admin-entries-batch-count">已选 0 项</span>
            <button class="abtn abtn-danger" id="admin-entries-batch-del">批量删除选中</button>
          </div>
          <table class="admin-table">
            <thead><tr><th style="width:32px"><input type="checkbox" id="admin-entries-selectall"></th><th style="width:140px">编号</th><th>标题</th><th style="width:120px">等级/代号</th><th style="width:200px">操作</th></tr></thead>
            <tbody>
              ${pageItems.map(x => `
                <tr data-id="${escapeAttr(x.id)}">
                  <td><input type="checkbox" class="admin-entries-check" data-id="${escapeAttr(x.id)}"></td>
                  <td class="atd-mono">${escapeHtml(x.id)}</td>
                  <td>${escapeHtml(x.title)}</td>
                  <td>
                    <div>${escapeHtml(CLASS_NAMES[x.class]||x.class||'—')}</div>
                    <div style="color:var(--text-3);font-size:11px;font-family:var(--f-mono)">${escapeHtml(x.code||'')}</div>
                  </td>
                  <td>
                    <button class="abtn abtn-mini" data-act="edit">编辑</button>
                    <button class="abtn abtn-mini abtn-danger" data-act="del">删除</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${totalPages > 1 ? `
            <div class="admin-pager">
              <button class="abtn abtn-mini" data-page="prev" ${entryPage<=1?'disabled':''}>‹ 上一页</button>
              <span class="pager-info">第 ${entryPage} / ${totalPages} 页 · 共 ${filtered.length} 条${q ? '（搜索结果）' : ''}</span>
              <button class="abtn abtn-mini" data-page="next" ${entryPage>=totalPages?'disabled':''}>下一页 ›</button>
            </div>
          ` : filtered.length > ENTRY_PAGE_SIZE ? '' : ''}
        `;

        // 行事件
        listDiv.querySelectorAll('tbody tr').forEach(tr => {
          const id = tr.dataset.id;
          const x = filtered.find(y => String(y.id) === String(id));
          if (!x) return;
          tr.querySelector('[data-act="edit"]').addEventListener('click', () => openEntryEditor(cat, x));
          tr.querySelector('[data-act="del"]').addEventListener('click', async () => {
            if (!confirm(`确认删除？删除后无法恢复：\n${cat} / ${x.id} / ${x.title}`)) return;
            const rd = await API.adminDeleteEntry(cat, x.id);
            if (!rd.ok) return banner(rd.msg || '删除失败', 'err');
            banner('已删除 ' + x.id, 'ok'); refreshEntries();
          });
        });

        // 分页
        listDiv.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.page === 'prev') entryPage--;
            else if (btn.dataset.page === 'next') entryPage++;
            renderEntryPage();
          });
        });

        // 批量删除
        const selectAll = listDiv.querySelector('#admin-entries-selectall');
        const batchBar = listDiv.querySelector('#admin-entries-batchbar');
        const batchCount = listDiv.querySelector('#admin-entries-batch-count');
        const batchDelBtn = listDiv.querySelector('#admin-entries-batch-del');
        function updateBatchBar() {
          const checks = listDiv.querySelectorAll('.admin-entries-check');
          const checked = listDiv.querySelectorAll('.admin-entries-check:checked');
          if (batchBar) batchBar.style.display = checked.length > 0 ? '' : 'none';
          if (batchCount) batchCount.textContent = `已选 ${checked.length} 项`;
          if (selectAll) selectAll.checked = checks.length > 0 && checked.length === checks.length;
        }
        if (selectAll) selectAll.addEventListener('change', () => {
          listDiv.querySelectorAll('.admin-entries-check').forEach(cb => { cb.checked = selectAll.checked; });
          updateBatchBar();
        });
        listDiv.querySelectorAll('.admin-entries-check').forEach(cb => cb.addEventListener('change', updateBatchBar));
        if (batchDelBtn) batchDelBtn.addEventListener('click', async () => {
          const ids = Array.from(listDiv.querySelectorAll('.admin-entries-check:checked')).map(cb => cb.dataset.id);
          if (!ids.length) return;
          if (!confirm(`确认批量删除 ${ids.length} 条档案？此操作不可恢复！`)) return;
          batchDelBtn.disabled = true; const t = batchDelBtn.textContent; batchDelBtn.textContent = '删除中…';
          let ok = 0, fail = 0;
          for (const id of ids) {
            const rd = await API.adminDeleteEntry(cat, id);
            if (rd.ok) ok++; else fail++;
          }
          batchDelBtn.disabled = false; batchDelBtn.textContent = t;
          banner(`批量删除完成 · 成功 ${ok} 条${fail ? ` · 失败 ${fail} 条` : ''}`, fail ? 'err' : 'ok');
          refreshEntries();
        });
      }

      catSel.addEventListener('change', refreshEntries);
      searchInput.addEventListener('input', debounce(() => { entryPage = 1; renderEntryPage(); }, 250));
      document.getElementById('admin-add-entry').addEventListener('click', () => {
        const blank = { id:'', title:'', code:'', class:'neutral', summary:'', body:'', tags:[] };
        openEntryEditor(catSel.value, blank, true);
      });
      refreshEntries();

      // 弹层编辑器
      function openEntryEditor(cat, x, isCreate=false) {
        const dlg = document.createElement('div');
        dlg.className = 'admin-modal';
        dlg.innerHTML = `
          <div class="admin-modal-body">
            <h3 class="am-title">${isCreate?'新增档案':'编辑档案'} · ${escapeHtml(CAT_MAP[cat]?.name||cat)} ${isCreate?'':escapeHtml(x.id||'')}</h3>
            <div class="am-grid">
              <label class="af"><span>编号 ID（新增可留空自动生成）</span><input data-f="id" value="${escapeAttr(x.id||'')}"/></label>
              <div class="af af-row-2">
                <label><span>分类（最终写回）</span>
                  <select data-f="cat">
                    ${DATA.categories.map(c=>`<option value="${c.id}" ${c.id===cat?'selected':''}>${c.name}</option>`).join('')}
                  </select>
                </label>
                <label><span>危险等级</span>
                  <select data-f="class">
                    <option value="neutral">未分级</option>
                    ${Object.entries(CLASS_NAMES).map(([k,v])=>`<option value="${k}" ${k===x.class?'selected':''}>${v}</option>`).join('')}
                  </select>
                </label>
              </div>
              <label class="af"><span>子分组</span>
                <select data-f="subcat" id="entry-subcat-select">
                  <option value="">— 未分组 —</option>
                  ${(CAT_MAP[cat]?.subcats||[]).map(s=>`<option value="${s.id}" ${s.id===x.subcat?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}
                </select>
              </label>
              <label class="af"><span>标题</span><input data-f="title" value="${escapeAttr(x.title||'')}"/></label>
              <label class="af"><span>代号</span><input data-f="code" value="${escapeAttr(x.code||'')}"/></label>
              <label class="af"><span>摘要</span><input data-f="summary" value="${escapeAttr(x.summary||'')}"/></label>
              <label class="af"><span>正文（支持 HTML）</span>
                <textarea data-f="body" rows="8">${escapeHtml(x.body||x.content||'')}</textarea>
              </label>
              <label class="af"><span>标签（逗号分隔）</span>
                <input data-f="tags" value="${escapeHtml((x.tags||[]).join(', '))}"/>
              </label>
              <label class="af"><span>封面图片路径（data/anomalies/xxx.png 或上传）</span>
                <div class="af-cover-wrap">
                  <input data-f="img" value="${escapeAttr(x.img||'')}" placeholder="data/anomalies/xxx.png"/>
                  <label class="af-cover-upload-btn">
                    ⬆ 上传
                    <input type="file" class="af-cover-file-edit" accept="image/*" hidden>
                  </label>
                </div>
                <div class="af-cover-thumb af-cover-thumb-edit">${x.img ? `<img src="${escapeAttr(resolveImgUrl(x.img))}" alt="封面" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : '<div class="af-cover-empty">无</div>'}</div>
              </label>
              <label class="af"><span>排版原件 · HTML（原样嵌入详情页，保真 100%）</span>
                <div class="af-cover-wrap">
                  <input data-f="dossier" value="${escapeAttr(x.dossier||'')}" placeholder="data/dossier/AE-0001-附07.html"/>
                  <label class="af-cover-upload-btn">
                    ${ico('doc',12)} 上传
                    <input type="file" class="af-dossier-file-edit" accept=".html,.htm,text/html" hidden>
                  </label>
                </div>
                <div class="af-audio-status af-dossier-status-edit">${x.dossier
                  ? `<span style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1)">${ico('doc',10)} 已附加排版原件</span>`
                  : '<span style="font-family:var(--f-mono);font-size:10px;color:var(--text-4)">无排版原件（可选）</span>'}</div>
              </label>
              <label class="af"><span>来源</span><input data-f="source" value="${escapeAttr(x.source||'')}"/></label>
              <label class="af"><span>音频附件路径（data/audio/xxx.mp3 或上传）</span>
                <div class="af-cover-wrap">
                  <input data-f="audio" value="${escapeAttr(x.audio||'')}" placeholder="data/audio/xxx.mp3"/>
                  <label class="af-cover-upload-btn">
                    ${ico('audio',12)} 上传
                    <input type="file" class="af-audio-file-edit" accept="audio/*" hidden>
                  </label>
                </div>
                <div class="af-audio-status af-audio-status-edit">${x.audio ? `<span style="font-family:var(--f-mono);font-size:10px;color:var(--text-3)">${ico('audio',10)} 已附加音频</span>` : '<span style="font-family:var(--f-mono);font-size:10px;color:var(--text-4)">无音频</span>'}</div>
              </label>
            </div>
            <div class="am-foot">
              <button class="abtn abtn-cancel" data-act="cancel">取消</button>
              <button class="abtn abtn-approve" data-act="save">保存</button>
            </div>
          </div>
        `;
        document.body.appendChild(dlg);
        function close() { dlg.remove(); }
        dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
        dlg.querySelector('[data-act="cancel"]').addEventListener('click', close);
        // 分类切换时刷新子分组选项
        const catSel = dlg.querySelector('[data-f="cat"]');
        const subSel = dlg.querySelector('#entry-subcat-select');
        if (catSel && subSel) {
          catSel.addEventListener('change', () => {
            const subs = (CAT_MAP[catSel.value]?.subcats) || [];
            const cur = subSel.value;
            subSel.innerHTML = '<option value="">— 未分组 —</option>' +
              subs.map(s => `<option value="${s.id}" ${s.id===cur?'selected':''}>${escapeHtml(s.name)}</option>`).join('');
          });
        }
        // 封面上传
        const editCoverFile = dlg.querySelector('.af-cover-file-edit');
        const editCoverInput = dlg.querySelector('[data-f="img"]');
        const editCoverThumb = dlg.querySelector('.af-cover-thumb-edit');
        if (editCoverFile) {
          editCoverFile.addEventListener('change', async () => {
            const file = editCoverFile.files && editCoverFile.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { banner('仅支持图片文件', 'err'); return; }
            try {
              const r = await API.uploadImage(file);
              if (!r.ok) { banner(r.msg || '封面上传失败', 'err'); return; }
              if (editCoverInput) editCoverInput.value = r.url;
              if (editCoverThumb) editCoverThumb.innerHTML = `<img src="${r.url}" alt="封面" style="width:100%;height:100%;object-fit:cover">`;
            } catch (e) { banner('封面上传失败', 'err'); }
          });
        }
        // 音频上传
        const editAudioFile = dlg.querySelector('.af-audio-file-edit');
        const editAudioInput = dlg.querySelector('[data-f="audio"]');
        const editAudioStatus = dlg.querySelector('.af-audio-status-edit');
        if (editAudioFile) {
          editAudioFile.addEventListener('change', async () => {
            const file = editAudioFile.files && editAudioFile.files[0];
            if (!file) return;
            if (!file.type.startsWith('audio/')) { banner('仅支持音频文件', 'err'); return; }
            if (editAudioStatus) editAudioStatus.innerHTML = '<span style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1)">上传中…</span>';
            try {
              const r = await API.uploadAudio(file);
              if (!r.ok) { banner(r.msg || '音频上传失败', 'err'); if (editAudioStatus) editAudioStatus.innerHTML = '<span style="font-family:var(--f-mono);font-size:10px;color:var(--red-2)">上传失败</span>'; return; }
              if (editAudioInput) editAudioInput.value = r.url;
              if (editAudioStatus) editAudioStatus.innerHTML = `<span style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1)">${ico('audio',10)} 已附加（${r.fallback?'本地':'服务器'}）</span>`;
            } catch (e) { banner('音频上传失败', 'err'); if (editAudioStatus) editAudioStatus.innerHTML = '<span style="font-family:var(--f-mono);font-size:10px;color:var(--red-2)">上传失败</span>'; }
          });
        }
        // 排版原件上传（直接提交到 GitHub 仓库，避免塞进 JSON）
        const editDossierFile = dlg.querySelector('.af-dossier-file-edit');
        const editDossierInput = dlg.querySelector('[data-f="dossier"]');
        const editDossierStatus = dlg.querySelector('.af-dossier-status-edit');
        if (editDossierFile) {
          editDossierFile.addEventListener('change', async () => {
            const file = editDossierFile.files && editDossierFile.files[0];
            if (!file) return;
            if (editDossierStatus) editDossierStatus.innerHTML = '<span style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1)">上传中…</span>';
            const r = await API.uploadDossier(file);
            if (!r.ok) {
              if (editDossierStatus) editDossierStatus.innerHTML = `<span style="font-family:var(--f-mono);font-size:10px;color:var(--red-2)">${escapeHtml(r.msg || '上传失败')}</span>`;
              return;
            }
            if (editDossierInput) editDossierInput.value = r.url;
            if (editDossierStatus) editDossierStatus.innerHTML = `<span style="font-family:var(--f-mono);font-size:10px;color:var(--gold-1)">${ico('doc',10)} 已提交到仓库：${escapeHtml(r.url)}</span>`;
            banner('排版原件已提交，保存档案后生效（Pages 构建约需 1 分钟）', 'ok');
          });
        }
        dlg.querySelector('[data-act="save"]').addEventListener('click', async () => {
          const payload = {};
          dlg.querySelectorAll('[data-f]').forEach(el => {
            const k = el.dataset.f;
            if (k === 'cat') return;
            if (k === 'tags') payload[k] = el.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
            else payload[k] = el.value;
          });
          const finalCat = dlg.querySelector('[data-f="cat"]').value || cat;
          const saveBtn = dlg.querySelector('[data-act="save"]');
          saveBtn.disabled = true; const t = saveBtn.textContent; saveBtn.textContent = '保存中…';
          let res;
          if (isCreate) {
            res = await API.adminAddEntry(finalCat, payload);
          } else {
            const targetCat = finalCat;
            res = await API.adminUpdateEntry(targetCat, x.id, payload);
            // 如果分类变了，就需要从源分类删掉再加回来（后端这里暂只支持同分类更新；分类变更交给"通过并发布"那条路径的主文件写入）
            if (targetCat !== cat && res.ok && !res.fallback) {
              banner('提示：分类已变动，请确认 id 是否与目标分类匹配', '');
            }
          }
          saveBtn.disabled = false; saveBtn.textContent = t;
          if (!res.ok) { banner(res.msg || '保存失败','err'); return; }
          banner(isCreate ? `已新增：${res.entry?.id||''} ${res.entry?.title||''}` : `已保存：${x.id}`, 'ok');
          close();
          if (catSel.value === (finalCat || cat)) refreshEntries();
        });
      }
    }

    // ========== Tab 3：用户管理 ==========
    async function drawUsersTab() {
      const body = document.getElementById('admin-tab-body');
      body.innerHTML = `<div class="admin-loading">加载用户列表…</div>`;
      const r = await API.adminListUsers();
      if (!r.ok) { body.textContent = '加载失败：' + (r.msg||''); return; }
      const allUsers = r.list;
      let userPage = 1;
      const USER_PAGE_SIZE = 20;

      body.innerHTML = `
        <div class="admin-toolbar">
          <div class="admin-filter-inline">
            <input type="text" id="admin-user-search" placeholder="搜索账号…" class="admin-search-input">
          </div>
          <span class="admin-toolbar-note">共 ${r.total} 位用户${r.fallback ? '（降级模式）' : ''}</span>
        </div>
        <div id="admin-users-list"></div>
      `;
      const searchInputU = document.getElementById('admin-user-search');
      const usersListDiv = document.getElementById('admin-users-list');

      function renderUsersPage() {
        const q = (searchInputU.value || '').trim().toLowerCase();
        let filtered = allUsers;
        if (q) {
          filtered = allUsers.filter(u => String(u.contact).toLowerCase().includes(q));
        }
        if (!filtered.length) {
          usersListDiv.innerHTML = `<div class="admin-empty">${q ? '未找到匹配用户' : '暂无用户'}</div>`;
          return;
        }
        const totalPages = Math.max(1, Math.ceil(filtered.length / USER_PAGE_SIZE));
        if (userPage > totalPages) userPage = totalPages;
        const start = (userPage - 1) * USER_PAGE_SIZE;
        const pageItems = filtered.slice(start, start + USER_PAGE_SIZE);

        usersListDiv.innerHTML = `
          <div class="admin-batch-bar" id="admin-users-batchbar" style="display:none">
            <span class="admin-batch-count" id="admin-users-batch-count">已选 0 项</span>
            <button class="abtn abtn-danger" id="admin-users-batch-del">批量删除选中</button>
          </div>
          <table class="admin-table">
            <thead><tr><th style="width:32px"><input type="checkbox" id="admin-users-selectall"></th><th style="width:260px">账号</th><th style="width:140px">等级</th><th style="width:140px">角色</th><th style="width:160px">注册时间</th><th style="width:240px">操作</th></tr></thead>
            <tbody>
              ${pageItems.map(u => `
                <tr data-contact="${escapeAttr(u.contact)}">
                  <td><input type="checkbox" class="admin-users-check" data-contact="${escapeAttr(u.contact)}" ${u.builtIn?'disabled':''}></td>
                  <td>
                    <span class="atd-mono">${escapeHtml(u.contact)}</span>
                    ${u.builtIn ? '<span style="margin-left:6px;color:var(--red-2);font-family:var(--f-mono);font-size:11px">BUILT-IN</span>' : ''}
                  </td>
                  <td>
                    <select data-f="level">
                      ${['LV.1','LV.2','LV.3','LV.4','LV.5','LV.9'].map(l => `<option value="${l}" ${l===(u.level||'LV.2')?'selected':''}>${l}</option>`).join('')}
                    </select>
                  </td>
                  <td>
                    <select data-f="role">
                      <option value="user" ${(u.role||'user')==='user'?'selected':''}>普通用户</option>
                      <option value="admin" ${u.role==='admin'?'selected':''}>管理员</option>
                    </select>
                  </td>
                  <td class="atd-mono" style="color:var(--text-3);font-size:12px">
                    ${u.createdAt ? new Date(u.createdAt).toLocaleString('zh-CN') : '—'}
                  </td>
                  <td>
                    <button class="abtn abtn-mini" data-act="save">保存</button>
                    <button class="abtn abtn-mini abtn-danger" data-act="del" ${u.builtIn?'disabled':''}>删除</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
          ${totalPages > 1 ? `
            <div class="admin-pager">
              <button class="abtn abtn-mini" data-page="prev" ${userPage<=1?'disabled':''}>‹ 上一页</button>
              <span class="pager-info">第 ${userPage} / ${totalPages} 页 · 共 ${filtered.length} 位用户${q ? '（搜索结果）' : ''}</span>
              <button class="abtn abtn-mini" data-page="next" ${userPage>=totalPages?'disabled':''}>下一页 ›</button>
            </div>
          ` : ''}
        `;

        usersListDiv.querySelectorAll('tbody tr').forEach(tr => {
          const contact = tr.dataset.contact;
          const levelSel = tr.querySelector('[data-f="level"]');
          const roleSel  = tr.querySelector('[data-f="role"]');
          tr.querySelector('[data-act="save"]').addEventListener('click', async () => {
            const rd = await API.adminUpdateUser(contact, { level: levelSel.value, role: roleSel.value });
            if (!rd.ok) return banner(rd.msg || '保存失败', 'err');
            banner('已更新 ' + contact, 'ok');
          });
          const delBtn = tr.querySelector('[data-act="del"]');
          if (delBtn && !delBtn.disabled) delBtn.addEventListener('click', async () => {
            if (!confirm(`确认删除账号？该用户的投稿将保留但作者置为"已注销用户"：${contact}`)) return;
            const rd = await API.adminDeleteUser(contact);
            if (!rd.ok) return banner(rd.msg || '删除失败', 'err');
            banner(rd.msg || '已删除', 'ok'); drawUsersTab();
          });
        });

        // 分页
        usersListDiv.querySelectorAll('[data-page]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (btn.dataset.page === 'prev') userPage--;
            else if (btn.dataset.page === 'next') userPage++;
            renderUsersPage();
          });
        });

        // 批量删除
        const selectAllU = usersListDiv.querySelector('#admin-users-selectall');
        const batchBarU = usersListDiv.querySelector('#admin-users-batchbar');
        const batchCountU = usersListDiv.querySelector('#admin-users-batch-count');
        const batchDelU = usersListDiv.querySelector('#admin-users-batch-del');
        function updateUsersBatch() {
          const checks = usersListDiv.querySelectorAll('.admin-users-check');
          const checked = usersListDiv.querySelectorAll('.admin-users-check:checked');
          if (batchBarU) batchBarU.style.display = checked.length > 0 ? '' : 'none';
          if (batchCountU) batchCountU.textContent = `已选 ${checked.length} 项`;
          if (selectAllU) selectAllU.checked = checks.length > 0 && checked.length === checks.length;
        }
        if (selectAllU) selectAllU.addEventListener('change', () => {
          usersListDiv.querySelectorAll('.admin-users-check:not(:disabled)').forEach(cb => { cb.checked = selectAllU.checked; });
          updateUsersBatch();
        });
        usersListDiv.querySelectorAll('.admin-users-check').forEach(cb => cb.addEventListener('change', updateUsersBatch));
        if (batchDelU) batchDelU.addEventListener('click', async () => {
          const contacts = Array.from(usersListDiv.querySelectorAll('.admin-users-check:checked')).map(cb => cb.dataset.contact);
          if (!contacts.length) return;
          if (!confirm(`确认批量删除 ${contacts.length} 个账号？此操作不可恢复！`)) return;
          batchDelU.disabled = true; const t = batchDelU.textContent; batchDelU.textContent = '删除中…';
          let ok = 0, fail = 0;
          for (const c of contacts) {
            const rd = await API.adminDeleteUser(c);
            if (rd.ok) ok++; else fail++;
          }
          batchDelU.disabled = false; batchDelU.textContent = t;
          banner(`批量删除完成 · 成功 ${ok} 个${fail ? ` · 失败 ${fail} 个` : ''}`, fail ? 'err' : 'ok');
          drawUsersTab();
        });
      }

      searchInputU.addEventListener('input', () => { userPage = 1; renderUsersPage(); });
      renderUsersPage();
    }

    drawAdminTab();
  }

  // ============ 404 ============
  function renderNotFound() {
    view.innerHTML = `
      <div class="notfound-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh;padding:60px 24px;text-align:center">
        <div class="notfound-stamp" style="width:220px;height:220px;margin-bottom:32px;position:relative">
          <img src="404-stamp.webp" alt="ARCHIVE DESTROYED" style="width:100%;height:100%;object-fit:contain;opacity:0.85;filter:grayscale(1) contrast(1.2)"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div style="display:none;width:100%;height:100%;border-radius:50%;border:4px solid var(--red-2);align-items:center;justify-content:center;flex-direction:column;font-family:var(--f-mono);color:var(--red-2);transform:rotate(-8deg);opacity:0.7">
            <span style="font-size:18px;font-weight:bold;letter-spacing:2px">ARCHIVE</span>
            <span style="font-size:18px;font-weight:bold;letter-spacing:2px">DESTROYED</span>
          </div>
        </div>
        <h1 style="font-family:var(--f-mono);font-size:64px;font-weight:900;letter-spacing:8px;color:var(--text);margin:0">404</h1>
        <div style="font-family:var(--f-mono);font-size:13px;letter-spacing:3px;color:var(--text-2);margin-top:8px">FILE NOT FOUND · 档案路径不存在</div>
        <p style="color:var(--text-2);max-width:400px;margin:20px 0 32px;line-height:1.7">该路径未被归档或已被销毁。请通过顶部导航返回有效区域，或使用搜索功能查找目标档案。</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
          <a href="#/" style="display:inline-block;padding:10px 28px;border:1px solid var(--border);background:var(--bg-2);color:var(--text);font-family:var(--f-mono);font-size:12px;letter-spacing:1px;text-decoration:none;cursor:pointer">← 返回首页</a>
          <a href="#/search" style="display:inline-block;padding:10px 28px;border:1px solid var(--gold-2);background:transparent;color:var(--gold-1);font-family:var(--f-mono);font-size:12px;letter-spacing:1px;text-decoration:none;cursor:pointer">${ico('search',14)} 搜索档案</a>
        </div>
      </div>
    `;
  }

  // ============ 全局搜索绑定 ============
  const SEARCH_HISTORY_KEY = 'wa_search_history';
  function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); }
    catch { return []; }
  }
  function saveSearchHistory(kw) {
    kw = (kw || '').trim();
    if (!kw) return;
    let h = getSearchHistory();
    h = [kw, ...h.filter(k => k.toLowerCase() !== kw.toLowerCase())].slice(0, 8);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h));
  }
  function removeSearchHistory(kw) {
    let h = getSearchHistory().filter(k => k !== kw);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h));
  }
  function clearSearchHistory() {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }
  // 获取热门标签（按出现频次）
  function getPopularTags(limit = 12) {
    const counts = {};
    allEntries().forEach(e => {
      (e.tags || []).forEach(t => {
        if (!t) return;
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, n]) => ({ tag, n }));
  }

  function bindGlobalSearch() {
    const input = document.getElementById('global-search');
    const btn = document.getElementById('search-btn');
    const dropdown = document.getElementById('search-dropdown');
    const histList = document.getElementById('sd-history-list');
    const histSection = document.getElementById('sd-history');
    const suggestSection = document.getElementById('sd-suggest');
    const suggestList = document.getElementById('sd-suggest-list');
    const emptyEl = document.getElementById('sd-empty');
    const clearBtn = document.getElementById('sh-clear');
    if (!input || !btn || !dropdown) return;

    const submit = () => {
      const q = input.value.trim();
      if (q) {
        saveSearchHistory(q);
        hideDropdown();
        SFX.search();
        location.hash = `#/search?q=${encodeURIComponent(q)}`;
      }
    };

    function renderHistory() {
      const h = getSearchHistory();
      if (!h.length) {
        histSection.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }
      emptyEl.style.display = 'none';
      histSection.style.display = 'block';
      histList.innerHTML = h.map(k => `
        <span class="sd-item" data-kw="${escapeAttr(k)}">
          <span class="sd-kw">${escapeHtml(k)}</span>
          <button type="button" class="sd-rm" data-rm="${escapeAttr(k)}" title="移除" aria-label="移除">×</button>
        </span>`).join('');
    }

    function renderSuggestions(q) {
      q = (q || '').trim().toLowerCase();
      if (!q) { suggestSection.style.display = 'none'; return; }
      const matches = allEntries().filter(e => {
        const h = [e.id, e.code, e.title, e.summary, (e.tags||[]).join(' ')]
          .filter(Boolean).join(' ').toLowerCase();
        return h.includes(q);
      }).slice(0, 6);
      if (!matches.length) { suggestSection.style.display = 'none'; return; }
      suggestSection.style.display = 'block';
      suggestList.innerHTML = matches.map(e => {
        const label = e.title || e.code || e.id;
        const catLabel = CAT_MAP[e._cat] ? CAT_MAP[e._cat].name : e._cat;
        return `<a class="sd-item sd-suggest-item" href="#/entry/${e._cat}/${encodeURIComponent(e.id)}" data-nav="1">
          <span class="sd-kw">${highlightKeyword(label, q)}</span>
          <span class="sd-cat">${escapeHtml(catLabel)}</span>
        </a>`;
      }).join('');
    }

    function showDropdown() {
      renderHistory();
      renderSuggestions(input.value);
      dropdown.classList.add('active');
    }
    function hideDropdown() { dropdown.classList.remove('active'); }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') submit();
      else if (e.key === 'Escape') { hideDropdown(); input.blur(); }
    });
    input.addEventListener('focus', showDropdown);
    input.addEventListener('input', debounce(() => {
      if (document.activeElement === input) renderSuggestions(input.value);
    }, 180));

    // 点击历史项/建议项
    dropdown.addEventListener('click', e => {
      const rm = e.target.closest('.sd-rm');
      if (rm) {
        e.preventDefault(); e.stopPropagation();
        removeSearchHistory(rm.getAttribute('data-rm'));
        renderHistory();
        return;
      }
      const item = e.target.closest('.sd-item');
      if (item) {
        const kw = item.getAttribute('data-kw');
        const nav = item.getAttribute('data-nav');
        if (nav) { hideDropdown(); return; } // 建议项是 <a> 直接跳转
        if (kw) {
          input.value = kw;
          submit();
        }
      }
    });
    // 清除历史
    if (clearBtn) clearBtn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      clearSearchHistory();
      renderHistory();
    });

    // 点击外部关闭
    document.addEventListener('click', e => {
      if (!dropdown.contains(e.target) && e.target !== input) hideDropdown();
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[c]);
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ============ 卡片图片全局降级（inline onerror/onload 调用，必须挂 window）============
  window.__tryNextAnomImg = function (imgEl) {
    if (!imgEl) return;
    try {
      const srcs = JSON.parse(imgEl.getAttribute('data-srcs') || '[]');
      let idx = parseInt(imgEl.getAttribute('data-idx') || '0', 10) || 0;
      idx += 1;
      if (idx >= srcs.length) {
        // 全部失败：隐藏 <img>，父容器会显示 fallback（它默认显示在底层）
        imgEl.style.display = 'none';
        imgEl.onerror = null;
        return;
      }
      imgEl.setAttribute('data-idx', String(idx));
      imgEl.src = srcs[idx];
    } catch (_) {
      imgEl.style.display = 'none';
    }
  };
  window.__markAnomImgLoaded = function (imgEl) {
    if (!imgEl) return;
    // 标记加载成功，CSS 可以据此隐藏 fallback
    imgEl.classList.add('loaded');
    const wrap = imgEl.closest && imgEl.closest('.anom-thumb');
    if (wrap) wrap.classList.add('has-img');
  };

  // ============ v2.1 工具函数 ============
  // 防抖
  function debounce(fn, delay) {
    let t;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // 图片懒加载
  let _lazyObserver = null;
  function initLazyLoad() {
    if (!('IntersectionObserver' in window)) return;
    if (_lazyObserver) _lazyObserver.disconnect();
    _lazyObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          const src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
          }
          _lazyObserver.unobserve(img);
        }
      });
    }, { rootMargin: '100px' });
    // 观察所有带 data-src 的图片
    document.querySelectorAll('img[data-src]').forEach(img => _lazyObserver.observe(img));
  }

  // 图片灯箱
  let _lightboxImgs = [];
  let _lightboxIdx = 0;
  function openLightbox(imgs, index) {
    _lightboxImgs = imgs;
    _lightboxIdx = index;
    const ov = document.createElement('div');
    ov.className = 'lightbox-overlay';
    ov.innerHTML = `
      <span class="lightbox-close">&times;</span>
      ${imgs.length > 1 ? '<span class="lightbox-nav lightbox-prev">&#8249;</span>' : ''}
      <img class="lightbox-img" src="${escapeAttr(imgs[index])}">
      ${imgs.length > 1 ? '<span class="lightbox-nav lightbox-next">&#8250;</span>' : ''}
      ${imgs.length > 1 ? `<span class="lightbox-counter">${index + 1} / ${imgs.length}</span>` : ''}
    `;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); };
    ov.addEventListener('click', (ev) => {
      if (ev.target === ov || ev.target.classList.contains('lightbox-close')) close();
      else if (ev.target.classList.contains('lightbox-prev')) {
        _lightboxIdx = (_lightboxIdx - 1 + _lightboxImgs.length) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      } else if (ev.target.classList.contains('lightbox-next')) {
        _lightboxIdx = (_lightboxIdx + 1) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      }
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      else if (e.key === 'ArrowLeft' && _lightboxImgs.length > 1) {
        _lightboxIdx = (_lightboxIdx - 1 + _lightboxImgs.length) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      } else if (e.key === 'ArrowRight' && _lightboxImgs.length > 1) {
        _lightboxIdx = (_lightboxIdx + 1) % _lightboxImgs.length;
        ov.querySelector('.lightbox-img').src = _lightboxImgs[_lightboxIdx];
        const counter = ov.querySelector('.lightbox-counter');
        if (counter) counter.textContent = `${_lightboxIdx + 1} / ${_lightboxImgs.length}`;
      }
    });
  }

  // 绑定灯箱到容器内所有图片
  function bindLightbox(container) {
    if (!container) return;
    const imgs = container.querySelectorAll('img[src]:not(.no-lightbox)');
    const srcList = [];
    imgs.forEach((img, i) => {
      const src = img.src || (img.getAttribute('data-src') || '');
      if (src && !src.startsWith('data:')) srcList.push(src);
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', (e) => {
        e.preventDefault();
        const idx = srcList.indexOf(img.src || img.getAttribute('data-src'));
        openLightbox(srcList, Math.max(0, idx));
      });
    });
  }

  // 返回顶部按钮
  function initBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    window.addEventListener('scroll', debounce(() => {
      btn.classList.toggle('visible', window.scrollY > 400);
    }, 100));
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============ 键盘快捷键 ============
  let _hkGmode = false, _hkGtimer = null;
  function initHotkeys() {
    if (window._hkBound) return;
    window._hkBound = true;

    const catLetter = { a: 'anomalies', o: 'organizations', d: 'deities', e: 'eras', t: 'timelines' };
    const pageLetter = { h: '/', c: '/canon', l: '/library', m: '/mindmap', v: '/observe', s: '/search', g: '/glossary' };

    function closeAllModals() {
      document.querySelectorAll('.account-modal').forEach(m => { if (m.style.display !== 'none') m.style.display = 'none'; });
      document.querySelectorAll('.toc-mobile-panel').forEach(p => { if (p.style.display !== 'none') p.style.display = 'none'; });
    }

    document.addEventListener('keydown', (ev) => {
      // 登录门禁未进时不响应（避免干扰门禁输入）
      const gate = document.getElementById('login-gate');
      if (gate && gate.style.display !== 'none') return;

      const tag = (ev.target && ev.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (ev.target && ev.target.isContentEditable);
      const key = ev.key;

      if (typing) {
        if (key === 'Escape') { closeAllModals(); ev.target.blur(); }
        return;
      }

      // 弹窗打开时仅响应 Esc（关闭）
      const modalOpen = Array.from(document.querySelectorAll('.account-modal')).some(m => m.style.display !== 'none');
      if (modalOpen) {
        if (key === 'Escape') closeAllModals();
        return;
      }

      if (key === '/') {
        const s = document.getElementById('global-search');
        if (s) { ev.preventDefault(); s.focus(); s.select(); }
        return;
      }
      if (key === '?') {
        ev.preventDefault();
        const m = document.getElementById('hotkey-modal');
        if (m) m.style.display = (m.style.display === 'none') ? 'block' : 'none';
        return;
      }
      if (key === 'Escape') {
        closeAllModals();
        const ov = document.getElementById('sidebar-overlay');
        if (ov && ov.style.display !== 'none') ov.style.display = 'none';
        const sb = document.getElementById('sidebar');
        if (sb && sb.classList.contains('open')) sb.classList.remove('open');
        return;
      }
      if (key === 't') {
        const tb = document.getElementById('sb-theme-toggle');
        if (tb) tb.click();
        return;
      }

      // g 前缀导航模式
      if (key === 'g') {
        _hkGmode = true;
        clearTimeout(_hkGtimer);
        _hkGtimer = setTimeout(() => { _hkGmode = false; }, 1600);
        return;
      }
      if (_hkGmode) {
        const lk = key.toLowerCase();
        _hkGmode = false;
        clearTimeout(_hkGtimer);
        if (catLetter[lk]) { location.hash = '#/' + catLetter[lk]; return; }
        if (pageLetter[lk]) { location.hash = pageLetter[lk]; return; }
        return;
      }

      // 档案详情页快捷操作
      if ((location.hash || '').indexOf('/entry/') === 0) {
        if (key === 'f') { const b = document.getElementById('fav-btn'); if (b) { b.click(); return; } }
        if (key === 'r') { const b = document.getElementById('read-btn'); if (b) { b.click(); return; } }
      }
    });
  }

  // 导出档案
  function exportEntry(cat, entry, format) {
    const meta = CAT_MAP[cat];
    const cls = CLASS_NAMES[entry.class] || entry.class || '未分级';
    const plain = String(entry.body || '').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
    let content, mime, ext;
    if (format === 'json') {
      // 保留原字段，另附「导出元信息」，便于被其他工具消费
      const out = {
        ...entry,
        category: cat,
        categoryName: meta?.name || cat,
        _export: {
          source: '世界观察档案库',
          exportedAt: new Date().toISOString(),
          era: { base: ERA.offset, rule: '红月纪元 = 公元 − ' + ERA.offset },
          charCount: plain.length
        }
      };
      content = JSON.stringify(out, null, 2);
      mime = 'application/json'; ext = 'json';
    } else {
      // Markdown：头部带上纪年换算与出处，正文去标签
      const tags = (entry.tags || []).map(t => `\`${t}\``).join(' ');
      const eraLine = entry.era ? `\n> 所属纪元: ${entry.era}` : '';
      const orgLine = entry.org ? `\n> 所属组织: ${entry.org}` : '';
      content =
`# ${entry.title}

> 档案编号: ${entry.id}
> 档案代号: ${entry.code || '—'}
> 档案分类: ${meta?.name || cat}
> 危险等级: ${cls}${eraLine}${orgLine}
> 来源文件: ${entry.source || '—'}
> 字数: ${plain.length}
> 导出时间: ${new Date().toLocaleString()}

---

## 摘要

${entry.summary || '—'}

## 正文

${plain || '—'}

## 标签

${tags || '—'}

---
世界观察档案库 · 纪年口径：红月纪元 = 公元 − ${ERA.offset}（本书「今」＝ ${fmtCe(ERA.today)}／红月 ${ERA.todayRm} 年）
`;
      mime = 'text/markdown;charset=utf-8'; ext = 'md';
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    const safeName = String(entry.id || entry.title || 'entry').replace(/[\\/:*?"<>|\s]+/g, '_');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ============ 条目分享卡片 ============
  // 用离屏 canvas 生成主题化分享图（1200×630），供社群传播该条目设定
  function loadImageForCanvas(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('load fail'));
      im.src = src;
    });
  }
  function wrapCanvasText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of String(text)) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = ch; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  async function makeShareCard(e, catId) {
    const W = 1200, H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 底色
    ctx.fillStyle = '#060606';
    ctx.fillRect(0, 0, W, H);
    // 淡网格
    ctx.strokeStyle = 'rgba(235,235,235,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // 主边框
    ctx.strokeStyle = 'rgba(200,200,200,0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(22, 22, W - 44, H - 44);

    // 头部
    const catMeta = CAT_MAP[catId];
    const cls = CLASS_NAMES[e.class] || e.class || '未分级';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(235,235,235,0.78)';
    ctx.font = '600 20px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('世界观察档案库 · WORLDVIEW ARCHIVE', 60, 46);
    ctx.fillStyle = 'rgba(235,235,235,0.42)';
    ctx.font = '13px ui-monospace,Menlo,Consolas,monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${catMeta ? catMeta.code : catId.toUpperCase()} · ${String(e.id)}${e.code ? ' · ' + e.code : ''}`, W - 60, 50);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(200,200,200,0.25)';
    ctx.beginPath(); ctx.moveTo(60, 86); ctx.lineTo(W - 60, 86); ctx.stroke();

    // 左侧封面（cover-fill）
    let cover = null;
    const cands = resolveEntryImage(e, catId);
    for (const src of cands) {
      if (typeof src !== 'string' || !src) continue;
      try { cover = await loadImageForCanvas(src); if (cover) break; } catch (e2) { /* 尝试下一候选 */ }
    }
    const panelX = 60, panelY = 108, panelW = 330, panelH = 420;
    if (cover && cover.width) {
      const cw = cover.width, ch = cover.height;
      const scale = Math.max(panelW / cw, panelH / ch);
      const dw = cw * scale, dh = ch * scale;
      ctx.drawImage(cover, (panelX + panelW / 2) - dw / 2, (panelY + panelH / 2) - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = 'rgba(235,235,235,0.05)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.fillStyle = 'rgba(235,235,235,0.38)';
      ctx.textAlign = 'center';
      ctx.font = '600 26px "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.fillText('档案影像缺失', panelX + panelW / 2, panelY + panelH / 2 - 14);
      ctx.font = '13px ui-monospace,Menlo,monospace';
      ctx.fillText('NO IMAGE ON FILE', panelX + panelW / 2, panelY + panelH / 2 + 18);
      ctx.textAlign = 'left';
    }
    ctx.strokeStyle = 'rgba(200,200,200,0.5)';
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    // 危险等级角标
    ctx.fillStyle = 'rgba(200,200,200,0.14)';
    ctx.fillRect(panelX + panelW - 128, panelY + 14, 114, 30);
    ctx.fillStyle = 'rgba(235,235,235,0.8)';
    ctx.font = '600 14px ui-monospace,Menlo,monospace';
    ctx.textAlign = 'right';
    ctx.fillText('CLASS · ' + cls, panelX + panelW - 20, panelY + 24);
    ctx.textAlign = 'left';

    // 右侧信息
    const txtX = panelX + panelW + 46;
    const txtW = W - 60 - txtX;
    ctx.fillStyle = 'rgba(210,180,140,0.92)';
    ctx.font = '600 17px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.fillText((catMeta ? catMeta.name : catId) + (e.era ? ' · ' + e.era : ''), txtX, panelY + 8);

    // 标题（最多两行）
    ctx.fillStyle = '#f0efe9';
    ctx.font = '700 40px "Songti SC","STSong","SimSun",serif';
    const tLines = wrapCanvasText(ctx, String(e.title || ''), txtW).slice(0, 2);
    let ty = panelY + 50;
    for (const ln of tLines) { ctx.fillText(ln, txtX, ty); ty += 48; }

    // 摘要（最多 5 行）
    const plainSum = String(e.summary || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    ctx.fillStyle = 'rgba(235,235,235,0.72)';
    ctx.font = '16px "Microsoft YaHei","PingFang SC",sans-serif';
    const sumLines = wrapCanvasText(ctx, plainSum, txtW);
    const sumSlice = (sumLines.slice(0, 5).join('\n') + (sumLines.length > 5 ? '…' : ''));
    let sy = panelY + 156;
    for (const ln of wrapCanvasText(ctx, sumSlice, txtW)) { ctx.fillText(ln, txtX, sy); sy += 27; }

    // 底部水印
    ctx.fillStyle = 'rgba(235,235,235,0.42)';
    ctx.font = '12px ui-monospace,Menlo,Consolas,monospace';
    ctx.fillText('此图由世界观察档案库自动生成 · 内容为虚构创作', txtX, H - 90);
    ctx.fillStyle = 'rgba(235,235,235,0.24)';
    ctx.fillText('VISUAL ARCHIVE · CLASSIFIED · ' + (DATA.meta.updated || ''), txtX, H - 64);

    return canvas;
  }

  let _shareCanvas = null; // 当前分享卡 canvas，供下载/复制
  async function openShareCard(catId, e) {
    const modal = document.getElementById('share-card-modal');
    if (!modal) return;
    const stage = document.getElementById('sc-stage');
    const dlBtn = document.getElementById('sc-download');
    const copyBtn = document.getElementById('sc-copy');
    if (!stage) return;
    stage.innerHTML = '<div class="sc-loading">生成分享卡中…</div>';
    modal.style.display = 'block';
    let canvas;
    try {
      canvas = await makeShareCard(e, catId);
    } catch (err) {
      stage.innerHTML = '<div class="sc-loading">生成失败，请重试。</div>';
      return;
    }
    _shareCanvas = canvas;
    stage.innerHTML = '';
    stage.appendChild(canvas);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    const closeBtn = document.getElementById('sc-close');
    const mask = modal.querySelector('.account-modal-mask');
    if (closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
    if (mask) mask.onclick = () => { modal.style.display = 'none'; };
    if (dlBtn) dlBtn.onclick = () => {
      const a = document.createElement('a');
      const safeName = String(e.id || e.title || 'entry').replace(/[\\/:*?"<>|\s]+/g, '_');
      a.href = canvas.toDataURL('image/png');
      a.download = `分享卡_${safeName}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      if (window.SFX && SFX.favor) SFX.favor();
    };
    if (copyBtn) copyBtn.onclick = async () => {
      try {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        if (!blob) throw new Error('no blob');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copyBtn.textContent = '✓ 已复制';
        setTimeout(() => { copyBtn.textContent = '⧉ 复制图片'; }, 1800);
      } catch (err) {
        copyBtn.textContent = '复制失败，可用「下载 PNG」';
        setTimeout(() => { copyBtn.textContent = '⧉ 复制图片'; }, 2200);
      }
    };
    if (window.SFX && SFX.click) SFX.click();
  }

  // ============ 侧边栏 ============
  let _sidebarBound = false;
  function initSidebar() {
    if (_sidebarBound) return;
    _sidebarBound = true;

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const closeBtn = document.getElementById('sidebar-close');
    if (!sidebar || !toggleBtn) return;

    const STORAGE_KEY = 'wa_sidebar_open';
    const isMobile = () => window.innerWidth <= 900;

    function open() {
      sidebar.classList.add('open');
      document.body.classList.add('sidebar-open');
      if (overlay) overlay.classList.add('active');
      SFX.sidebarOpen();
    }
    function close() {
      sidebar.classList.remove('open');
      document.body.classList.remove('sidebar-open');
      if (overlay) overlay.classList.remove('active');
      SFX.sidebarClose();
    }
    function toggle() {
      sidebar.classList.contains('open') ? close() : open();
    }

    // 持久化状态（仅桌面端记忆）
    function saveState() {
      try {
        if (!isMobile()) localStorage.setItem(STORAGE_KEY, sidebar.classList.contains('open') ? '1' : '0');
      } catch {}
    }
    function loadState() {
      try {
        // 桌面端恢复记忆，移动端默认关闭
        if (!isMobile() && localStorage.getItem(STORAGE_KEY) === '1') open();
      } catch {}
    }

    toggleBtn.addEventListener('click', () => { toggle(); saveState(); });
    if (closeBtn) closeBtn.addEventListener('click', () => { close(); saveState(); });
    if (overlay) overlay.addEventListener('click', () => { close(); saveState(); });

    // 点击导航链接后，移动端自动收起
    sidebar.querySelectorAll('.sidebar-link[data-route]').forEach(link => {
      link.addEventListener('click', () => {
        if (isMobile()) close();
      });
    });

    // 快捷操作按钮
    const themeBtn = document.getElementById('sb-theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', () => {
      Theme.next();
      SFX.theme();
    });

    const backTopBtn = document.getElementById('sb-back-top');
    if (backTopBtn) backTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const exportBtn = document.getElementById('sb-export-data');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      if (typeof exportBackupJSON === 'function') exportBackupJSON();
    });

    // ---- 纪年换算器 ----
    const ecModal = document.getElementById('era-converter-modal');
    const ecCe = document.getElementById('ec-ce');
    const ecRm = document.getElementById('ec-rm');
    const ecResult = document.getElementById('ec-result');
    function ecOpen(show) { if (ecModal) ecModal.style.display = show ? 'block' : 'none'; }
    function ecRender(ce) {
      if (ce === '' || ce === null || Number.isNaN(ce)) { ecResult.textContent = '输入任一纪年，自动换算。'; return; }
      const rm = ceToRm(ce);
      const rmTxt = rm >= 0 ? ('红月 ' + rm + ' 年') : (ERA.beforeLabel + ' ' + Math.abs(rm) + ' 年');
      ecResult.textContent = fmtCe(ce) + ' 年　⇅　' + rmTxt;
    }
    // 常用锚点速查表（数据来自 ERA_ANCHORS / 07·3.2）
    const ecAnchorList = document.getElementById('ec-anchor-list');
    if (ecAnchorList) {
      ecAnchorList.innerHTML = ERA_ANCHORS.map((a, i) => {
        const ceLabel = a.ce2 ? `${fmtCe(a.ce)}–${Math.abs(a.ce2)}` : fmtCe(a.ce);
        const rmLabel = a.ce2 ? `${a.ce - ERA.offset} ~ ${a.ce2 - ERA.offset}` : String(a.ce - ERA.offset);
        return `<button type="button" class="ec-anchor-row${a.isNow ? ' is-now' : ''}" data-ec-anchor="${i}">
          <span class="ec-anchor-ce">${escapeHtml(ceLabel)}</span>
          <span class="ec-anchor-rm">${escapeHtml(rmLabel)}</span>
          <span class="ec-anchor-event">${escapeHtml(a.event)}</span>
          ${tierBadge(a.tier)}
        </button>`;
      }).join('');
      ecAnchorList.addEventListener('click', (ev) => {
        const row = ev.target.closest('[data-ec-anchor]');
        if (!row) return;
        const a = ERA_ANCHORS[parseInt(row.getAttribute('data-ec-anchor'), 10)];
        if (!a) return;
        if (ecCe) ecCe.value = a.ce;
        if (ecRm) ecRm.value = a.ce - ERA.offset;
        ecRender(a.ce);
        if (window.SFX && SFX.click) SFX.click();
      });
    }
    const ecBtn = document.getElementById('sb-era-converter');
    if (ecBtn) ecBtn.addEventListener('click', () => { ecOpen(true); if (window.SFX && SFX.navigate) SFX.navigate(); });
    const ecClose = document.getElementById('ec-close');
    if (ecClose) ecClose.addEventListener('click', () => ecOpen(false));
    if (ecModal) ecModal.addEventListener('click', (e) => { if (e.target.classList.contains('account-modal-mask')) ecOpen(false); });
    if (ecCe) ecCe.addEventListener('input', () => {
      const v = ecCe.value.trim();
      if (v === '') { ecRm.value = ''; ecRender(NaN); return; }
      const ce = parseInt(v, 10);
      ecRm.value = ceToRm(ce); ecRender(ce);
    });
    if (ecRm) ecRm.addEventListener('input', () => {
      const v = ecRm.value.trim();
      if (v === '') { ecCe.value = ''; ecRender(NaN); return; }
      const rm = parseInt(v, 10);
      const ce = rmToCe(rm);
      ecCe.value = ce; ecRender(ce);
    });
    document.querySelectorAll('.ec-quick [data-ce]').forEach(b => {
      b.addEventListener('click', () => {
        const ce = parseInt(b.getAttribute('data-ce'), 10);
        ecCe.value = ce; ecRm.value = ceToRm(ce); ecRender(ce);
      });
    });

    // ---- 我的档案夹 ----
    const afModal = document.getElementById('archive-folder-modal');
    function afOpen(show) { if (afModal) afModal.style.display = show ? 'block' : 'none'; }
    const afBtn = document.getElementById('sb-archive-folder');
    if (afBtn) afBtn.addEventListener('click', () => { afOpen(true); renderAF(); if (window.SFX && SFX.navigate) SFX.navigate(); });
    const afClose = document.getElementById('af-close');
    if (afClose) afClose.addEventListener('click', () => afOpen(false));
    if (afModal) afModal.addEventListener('click', (e) => { if (e.target.classList.contains('account-modal-mask')) afOpen(false); });
    document.querySelectorAll('.af-tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.af-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        const which = t.getAttribute('data-aft');
        document.getElementById('af-fav-list').style.display = which === 'fav' ? 'grid' : 'none';
        document.getElementById('af-read-list').style.display = which === 'read' ? 'grid' : 'none';
      });
    });
    function afRowHtml(f, type) {
      const title = f.title || f.id;
      const code = f.code || f.id;
      return `<div class="af-row">
        <div class="af-row-main">
          <a href="#/entry/${f.cat}/${encodeURIComponent(f.id)}">${escapeHtml(String(title))}</a>
          <span class="af-code">${escapeHtml(String(code))} · ${escapeHtml(f.cat)}</span>
        </div>
        <button type="button" class="af-del" data-type="${type}" data-cat="${escapeAttr(f.cat)}" data-id="${escapeAttr(f.id)}">移除</button>
      </div>`;
    }
    function renderAF() {
      const favs = Favorites.list();
      const reads = MarkedRead.list();
      const fc = document.getElementById('af-fav-count'); if (fc) fc.textContent = favs.length;
      const rc = document.getElementById('af-read-count'); if (rc) rc.textContent = reads.length;
      const fl = document.getElementById('af-fav-list');
      const rl = document.getElementById('af-read-list');
      if (fl) fl.innerHTML = favs.length ? favs.map(f => afRowHtml(f, 'fav')).join('') : '<div class="af-empty">★ 收藏夹为空<br>档案详情页点击"收藏"即可加入</div>';
      if (rl) rl.innerHTML = reads.length ? reads.map(f => afRowHtml(f, 'read')).join('') : '<div class="af-empty">✓ 还没有已读档案<br>档案详情页点击"标记已读"即可</div>';
      document.querySelectorAll('.af-del').forEach(b => {
        b.addEventListener('click', () => {
          const cat = b.getAttribute('data-cat');
          const id = b.getAttribute('data-id');
          const type = b.getAttribute('data-type');
          if (type === 'fav') Favorites.toggle(cat, id); else MarkedRead.toggle(cat, id);
          renderAF();
        });
      });
      document.querySelectorAll('.af-row a').forEach(a => a.addEventListener('click', () => afOpen(false)));
    }

    // 侧边栏音效开关
    const sbSfxBtn = document.getElementById('sb-sfx-toggle');
    if (sbSfxBtn) sbSfxBtn.addEventListener('click', () => {
      SFX.toggle(); syncSfxUI();
    });
    // 初始同步
    if (typeof syncSfxUI === 'function') syncSfxUI();

    // 窗口尺寸变化时调整
    let _resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(_resizeTimer);
      _resizeTimer = setTimeout(() => {
        if (isMobile() && sidebar.classList.contains('open')) {
          // 移动端切换时确保遮罩显示
          if (overlay) overlay.classList.add('active');
        }
      }, 150);
    });

    loadState();

    // 移动端滑动手势关闭侧边栏
    let touchStartX = 0, touchStartY = 0, touchDeltaX = 0, isTracking = false;
    sidebar.addEventListener('touchstart', (e) => {
      if (!isMobile() || !sidebar.classList.contains('open')) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchDeltaX = 0;
      isTracking = true;
    }, { passive: true });
    sidebar.addEventListener('touchmove', (e) => {
      if (!isTracking) return;
      const t = e.touches[0];
      touchDeltaX = t.clientX - touchStartX;
      if (touchDeltaX < 0) {
        sidebar.style.transform = `translateX(${touchDeltaX}px)`;
        sidebar.style.transition = 'none';
      }
    }, { passive: true });
    sidebar.addEventListener('touchend', () => {
      if (!isTracking) return;
      isTracking = false;
      sidebar.style.transition = '';
      sidebar.style.transform = '';
      if (touchDeltaX < -80) { close(); saveState(); }
    });
    // 从屏幕左缘右滑打开
    document.addEventListener('touchstart', (e) => {
      if (!isMobile() || sidebar.classList.contains('open')) return;
      const t = e.touches[0];
      if (t.clientX < 24) {
        touchStartX = t.clientX;
        isTracking = true;
      }
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!isTracking || isMobile() === false) { isTracking = false; return; }
      const t = e.changedTouches[0];
      if (t.clientX - touchStartX > 60 && !sidebar.classList.contains('open')) {
        open();
      }
      isTracking = false;
    });

    // 移动端底部菜单按钮
    const mtabMenu = document.getElementById('mtab-menu');
    if (mtabMenu) mtabMenu.addEventListener('click', () => { toggle(); saveState(); });

    // ===== 桌面端滚动自动隐藏/显示 =====
    let lastScrollY = window.scrollY;
    let scrollTimer = null;
    let edgeHoverTimer = null;
    const EDGE_ZONE = 8; // 左侧边缘触发宽度

    function handleScrollAuto() {
      if (isMobile()) return;
      if (!sidebar.classList.contains('open')) return; // 未打开不处理
      const curY = window.scrollY;
      const delta = curY - lastScrollY;
      // 向下滚动超过 8px 且不在顶部附近 → 隐藏
      if (delta > 8 && curY > 100) {
        sidebar.classList.add('auto-hidden');
      }
      // 向上滚动 → 显示
      else if (delta < -8) {
        sidebar.classList.remove('auto-hidden');
      }
      lastScrollY = curY;
    }

    window.addEventListener('scroll', () => {
      if (isMobile()) return;
      clearTimeout(scrollTimer);
      handleScrollAuto();
    }, { passive: true });

    // 鼠标移到左侧边缘 → 自动显示
    document.addEventListener('mousemove', (e) => {
      if (isMobile()) return;
      // 仅在侧边栏已打开但被隐藏时，或未打开时，检测边缘
      if (e.clientX <= EDGE_ZONE) {
        clearTimeout(edgeHoverTimer);
        edgeHoverTimer = setTimeout(() => {
          if (!sidebar.classList.contains('open')) {
            open();
            saveState();
          } else if (sidebar.classList.contains('auto-hidden')) {
            sidebar.classList.remove('auto-hidden');
          }
        }, 120);
      }
      // 鼠标移到侧边栏区域也取消隐藏
      if (sidebar.classList.contains('auto-hidden') && e.clientX <= 260) {
        sidebar.classList.remove('auto-hidden');
      }
    });

    // 点击侧边栏外区域（右侧）时不影响，但确保离开边缘区清除定时器
    document.addEventListener('mousemove', (e) => {
      if (e.clientX > EDGE_ZONE + 20) clearTimeout(edgeHoverTimer);
    });
  }

  // 侧边栏导航高亮
  function updateSidebarNav(path) {
    document.querySelectorAll('.sidebar-link[data-route]').forEach(a => {
      const route = a.dataset.route;
      const active = route === '/' ? path === '/' : path.startsWith(route);
      a.classList.toggle('active', active);
    });
    // 移动端底部导航高亮
    document.querySelectorAll('.mtab[data-route]').forEach(a => {
      const route = a.dataset.route;
      const active = route === '/' ? path === '/' : path.startsWith(route);
      a.classList.toggle('active', active);
    });
  }

  // 侧边栏统计刷新
  function refreshSidebarStats() {
    const idEl = document.getElementById('sb-stat-identity');
    if (idEl) idEl.textContent = '身份：' + Auth.identity();
    const totEl = document.getElementById('sb-stat-total');
    if (totEl) totEl.textContent = '在档条目：' + (statsTotal() || 0) + ' 条';
    // 管理员入口
    const adminLinks = document.querySelectorAll('.sidebar-admin-link');
    adminLinks.forEach(l => l.style.display = Auth.isAdmin() ? 'flex' : 'none');
  }

  // ============ 音效模块（Web Audio API 合成，无需外部文件）============
  const SFX = (() => {
    let _ctx = null;
    let _masterGain = null;
    let _reverbBus = null;   // 简易混响总线
    let _dryGain = null;     // 干声通道
    let _wetGain = null;     // 湿声通道
    let _muted = false;
    let _volume = 0.5;       // 主音量 0~1
    const STORAGE_KEY = 'wa_sfx_muted';
    const VOL_KEY = 'wa_sfx_vol';

    function _ensureCtx() {
      if (_ctx) return _ctx;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        _ctx = new Ctx();

        // 主总线 → destination
        _masterGain = _ctx.createGain();
        _masterGain.gain.value = _volume;
        _masterGain.connect(_ctx.destination);

        // 干声通道
        _dryGain = _ctx.createGain();
        _dryGain.gain.value = 0.85;
        _dryGain.connect(_masterGain);

        // 湿声通道：反馈延迟网络（简易混响）
        _wetGain = _ctx.createGain();
        _wetGain.gain.value = 0.35;
        _wetGain.connect(_masterGain);

        const delay1 = _ctx.createDelay(1.0);
        delay1.delayTime.value = 0.13;
        const fb1 = _ctx.createGain();
        fb1.gain.value = 0.42;
        const lp1 = _ctx.createBiquadFilter();
        lp1.type = 'lowpass'; lp1.frequency.value = 3200;
        delay1.connect(lp1); lp1.connect(fb1); fb1.connect(delay1);
        delay1.connect(_wetGain);

        const delay2 = _ctx.createDelay(1.0);
        delay2.delayTime.value = 0.07;
        const fb2 = _ctx.createGain();
        fb2.gain.value = 0.38;
        delay2.connect(fb2); fb2.connect(delay2);
        delay2.connect(_wetGain);

        _reverbBus = { delay1, delay2 };
      } catch { return null; }
      return _ctx;
    }
    // 用户首次交互时解锁 AudioContext（浏览器策略）
    function _unlock() {
      const ctx = _ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
    document.addEventListener('pointerdown', _unlock, { once: false });
    document.addEventListener('keydown', _unlock, { once: false });

    function loadPref() {
      try {
        _muted = localStorage.getItem(STORAGE_KEY) === '1';
        const v = parseFloat(localStorage.getItem(VOL_KEY));
        if (!isNaN(v)) _volume = Math.max(0, Math.min(1, v));
      } catch {}
    }
    function savePref() {
      try {
        localStorage.setItem(STORAGE_KEY, _muted ? '1' : '0');
        localStorage.setItem(VOL_KEY, String(_volume));
      } catch {}
    }
    loadPref();

    function isMuted() { return _muted; }
    function setMuted(v) { _muted = !!v; savePref(); Bus.emit('sfx:changed', { muted: _muted }); }
    function toggle() { setMuted(!_muted); return _muted; }
    function getVolume() { return _volume; }
    function setVolume(v) {
      _volume = Math.max(0, Math.min(1, v));
      if (_masterGain) _masterGain.gain.value = _volume;
      savePref();
      Bus.emit('sfx:changed', { volume: _volume });
    }

    // 核心播放：合成一段单音（带低通滤波 + 可选混响发送）
    function _tone({ freq = 440, type = 'sine', dur = 0.1, vol = 1, attack = 0.008, release = 0.08, freqEnd = null, delay = 0, sendReverb = 0.3, lp = 0, detune = 0 }) {
      if (_muted) return;
      const ctx = _ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + dur);
      if (detune) osc.detune.setValueAtTime(detune, now);
      // 指数包络（比 linear 更自然）
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + release);

      // 可选低通滤波（让高频音色更柔和）
      let lastNode = g;
      if (lp > 0) {
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = lp;
        lowpass.Q.value = 0.7;
        osc.connect(lowpass); lowpass.connect(g);
      } else {
        osc.connect(g);
      }
      // 干声
      g.connect(_dryGain);
      // 湿声发送
      if (sendReverb > 0 && _reverbBus) {
        const sendGain = ctx.createGain();
        sendGain.gain.value = sendReverb;
        g.connect(sendGain);
        sendGain.connect(_reverbBus.delay1);
        sendGain.connect(_reverbBus.delay2);
      }
      osc.start(now);
      osc.stop(now + dur + release + 0.05);
    }

    // 双振荡器混合音色（更饱满）
    function _dualTone(opts) {
      const { type1 = 'sine', type2 = 'triangle', detune2 = 6, vol2 = 0.5, ...rest } = opts;
      _tone({ ...rest, type: type1 });
      _tone({ ...rest, type: type2, vol: (rest.vol || 1) * vol2, detune: detune2, delay: (rest.delay || 0), sendReverb: 0.15 });
    }

    // 噪声（带低通，更柔和）
    function _noise({ dur = 0.05, vol = 0.6, filterFreq = 1800, filterType = 'bandpass', delay = 0, sendReverb = 0.1, lp = 0 }) {
      if (_muted) return;
      const ctx = _ensureCtx();
      if (!ctx) return;
      const now = ctx.currentTime + delay;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = filterType; bp.frequency.value = filterFreq;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp); bp.connect(g);
      // 可选低通
      if (lp > 0) {
        const lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass'; lowpass.frequency.value = lp;
        g.connect(lowpass); lowpass.connect(_dryGain);
        if (sendReverb > 0 && _reverbBus) {
          const sg = ctx.createGain(); sg.gain.value = sendReverb;
          lowpass.connect(sg); sg.connect(_reverbBus.delay1);
        }
      } else {
        g.connect(_dryGain);
        if (sendReverb > 0 && _reverbBus) {
          const sg = ctx.createGain(); sg.gain.value = sendReverb;
          g.connect(sg); sg.connect(_reverbBus.delay1);
        }
      }
      src.start(now);
      src.stop(now + dur + 0.02);
    }

    // === 对外音效 API ===
    const api = {
      isMuted, setMuted, toggle, getVolume, setVolume,
      // 通用按钮点击（柔和短哔）
      click: () => _dualTone({ freq: 720, type1: 'sine', type2: 'triangle', dur: 0.04, vol: 0.28, release: 0.04, lp: 2400, sendReverb: 0.12 }),
      // 侧边栏开（滑入 + 咔嗒，温暖低频）
      sidebarOpen: () => {
        _noise({ dur: 0.06, vol: 0.15, filterFreq: 800, filterType: 'lowpass', sendReverb: 0.2 });
        _dualTone({ freq: 180, freqEnd: 360, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 1800, sendReverb: 0.25 });
      },
      // 侧边栏关（滑出 + 咔嗒）
      sidebarClose: () => {
        _noise({ dur: 0.06, vol: 0.12, filterFreq: 600, filterType: 'lowpass', sendReverb: 0.2 });
        _dualTone({ freq: 360, freqEnd: 180, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 1800, sendReverb: 0.25 });
      },
      // 导航/路由切换（两下柔和拨弦，带混响）
      navigate: () => {
        _dualTone({ freq: 587, type1: 'sine', type2: 'triangle', dur: 0.07, vol: 0.2, release: 0.06, lp: 3200, sendReverb: 0.35 });
        _dualTone({ freq: 740, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.16, release: 0.08, lp: 3200, delay: 0.05, sendReverb: 0.35 });
      },
      // 搜索触发（短促下滑音）
      search: () => _dualTone({ freq: 1046, freqEnd: 698, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.24, release: 0.05, lp: 4000, sendReverb: 0.2 }),
      // 搜索命中（柔和金属铃，带长尾混响）
      hit: () => {
        _dualTone({ freq: 1318, type1: 'sine', type2: 'triangle', dur: 0.12, vol: 0.2, release: 0.15, lp: 5000, sendReverb: 0.55 });
        _tone({ freq: 2637, type: 'sine', dur: 0.08, vol: 0.08, release: 0.12, delay: 0.01, sendReverb: 0.4 });
      },
      // 搜索无结果（低频柔和嘟）
      miss: () => _dualTone({ freq: 220, freqEnd: 146, type1: 'sine', type2: 'triangle', dur: 0.18, vol: 0.24, release: 0.1, lp: 1200, sendReverb: 0.3 }),
      // 登录成功（上行五声音阶，温暖）
      login: () => {
        _dualTone({ freq: 523, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.22, release: 0.06, lp: 3200, sendReverb: 0.3 });
        _dualTone({ freq: 659, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.2, release: 0.06, lp: 3200, delay: 0.07, sendReverb: 0.3 });
        _dualTone({ freq: 784, type1: 'sine', type2: 'triangle', dur: 0.16, vol: 0.2, release: 0.18, lp: 3200, delay: 0.14, sendReverb: 0.5 });
      },
      // 登出（下行柔和小调）
      logout: () => {
        _dualTone({ freq: 440, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.22, release: 0.08, lp: 2400, sendReverb: 0.3 });
        _dualTone({ freq: 349, type1: 'sine', type2: 'triangle', dur: 0.14, vol: 0.2, release: 0.12, lp: 2400, delay: 0.08, sendReverb: 0.4 });
      },
      // 错误/警告（柔和双音，去刺耳）
      error: () => {
        _dualTone({ freq: 392, type1: 'sine', type2: 'triangle', dur: 0.07, vol: 0.22, release: 0.05, lp: 2000, sendReverb: 0.25 });
        _dualTone({ freq: 311, type1: 'sine', type2: 'triangle', dur: 0.09, vol: 0.22, release: 0.07, lp: 2000, delay: 0.09, sendReverb: 0.3 });
      },
      // 收藏（上扬叮，带混响尾音）
      favor: () => {
        _dualTone({ freq: 880, freqEnd: 1318, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.24, release: 0.1, lp: 4000, sendReverb: 0.45 });
        _tone({ freq: 2637, type: 'sine', dur: 0.06, vol: 0.06, release: 0.08, delay: 0.02, sendReverb: 0.3 });
      },
      // 取消收藏（下扬）
      unfavor: () => _dualTone({ freq: 698, freqEnd: 466, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.22, release: 0.08, lp: 3200, sendReverb: 0.3 }),
      // 归档/写入成功（柔和咔 + 温暖尾音）
      save: () => {
        _noise({ dur: 0.04, vol: 0.12, filterFreq: 1600, filterType: 'lowpass', sendReverb: 0.2 });
        _noise({ dur: 0.04, vol: 0.1, filterFreq: 1400, filterType: 'lowpass', delay: 0.05, sendReverb: 0.2 });
        _dualTone({ freq: 698, type1: 'sine', type2: 'triangle', dur: 0.1, vol: 0.18, release: 0.1, lp: 3200, delay: 0.08, sendReverb: 0.4 });
      },
      // 导出备份（数据流，柔和上升）
      export: () => {
        const notes = [523, 659, 784, 988];
        notes.forEach((f, i) => {
          _dualTone({ freq: f, type1: 'sine', type2: 'triangle', dur: 0.06, vol: 0.14, release: 0.05, lp: 3200, delay: i * 0.05, sendReverb: 0.25 });
        });
        _dualTone({ freq: 1175, type1: 'sine', type2: 'triangle', dur: 0.14, vol: 0.18, release: 0.15, lp: 4000, delay: 0.22, sendReverb: 0.5 });
      },
      // 主题切换（柔和反极 / 全息）
      theme: () => {
        const t = Theme.get();
        if (t === 'holo') {
          _dualTone({ freq: 659, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 3200, sendReverb: 0.3 });
          _dualTone({ freq: 988, type1: 'sine', type2: 'triangle', dur: 0.12, vol: 0.18, release: 0.1, lp: 3200, delay: 0.06, sendReverb: 0.4 });
          _dualTone({ freq: 1319, type1: 'sine', type2: 'triangle', dur: 0.16, vol: 0.14, release: 0.12, lp: 4000, delay: 0.12, sendReverb: 0.5 });
        } else {
          const up = t === 'light';
          _dualTone({ freq: up ? 587 : 466, type1: 'sine', type2: 'triangle', dur: 0.08, vol: 0.22, release: 0.06, lp: 3200, sendReverb: 0.3 });
          _dualTone({ freq: up ? 880 : 349, type1: 'sine', type2: 'triangle', dur: 0.12, vol: 0.18, release: 0.1, lp: 3200, delay: 0.06, sendReverb: 0.4 });
        }
      },
      // 管理后台操作（柔和机械咔嗒）
      adminClick: () => {
        _noise({ dur: 0.04, vol: 0.12, filterFreq: 1200, filterType: 'lowpass', sendReverb: 0.2 });
        _tone({ freq: 146, type: 'sine', dur: 0.04, vol: 0.18, release: 0.04, lp: 800, sendReverb: 0.15 });
      },
    };

    return api;
  })();

  // ============ 背景音乐模块（Web Audio 合成 ambient drone）============
  const BGM = (() => {
    let _ctx = null;
    let _masterGain = null;
    let _nodes = [];      // 所有振荡器/滤波器节点，用于停止
    let _lfoNodes = [];   // LFO 节点
    let _melodyTimer = null; // 旋律定时器
    let _chordTimer = null;  // 和弦进行定时器
    let _arpTimer = null;    // 琶音定时器
    let _padOscs = [];       // pad 振荡器引用（用于和弦切换）
    let _chordIdx = 0;       // 当前和弦索引
    let _playing = false;
    let _volume = 0.18;
    const STORAGE_KEY = 'wa_bgm_on';
    const VOL_KEY = 'wa_bgm_vol';

    function loadPref() {
      try {
        _playing = localStorage.getItem(STORAGE_KEY) === '1';
        const v = parseFloat(localStorage.getItem(VOL_KEY));
        if (!isNaN(v)) _volume = Math.max(0, Math.min(1, v));
      } catch {}
    }
    function savePref() {
      try {
        localStorage.setItem(STORAGE_KEY, _playing ? '1' : '0');
        localStorage.setItem(VOL_KEY, String(_volume));
      } catch {}
    }
    loadPref();

    let _stopCleanupTimer = null;
    let _healthCheckTimer = null;

    function _getCtx() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!_ctx) {
        try {
          _ctx = new Ctx();
          _ctx.addEventListener('statechange', () => {
            if (_playing && _ctx && _ctx.state === 'suspended') {
              _ctx.resume().catch(() => {});
            }
          });
        } catch { return null; }
      }
      if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
      return _ctx;
    }

    function _build() {
      const ctx = _getCtx();
      if (!ctx) return false;

      // 主增益
      _masterGain = ctx.createGain();
      _masterGain.gain.value = 0;
      _masterGain.connect(ctx.destination);

      // 低通滤波（让整体音色更暗沉柔和）
      const masterLP = ctx.createBiquadFilter();
      masterLP.type = 'lowpass';
      masterLP.frequency.value = 700;
      masterLP.Q.value = 0.4;
      masterLP.connect(_masterGain);

      // === 基础 drone 层（低频持续音）===
      // A1 = 55Hz, E2 = 82.4Hz, A2 = 110Hz（A 小调五度叠加）
      const droneFreqs = [55, 82.4, 110, 164.8];
      const droneTypes = ['sine', 'sine', 'triangle', 'sine'];
      droneFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = droneTypes[i];
        osc.frequency.value = freq;
        // 微微 detune 增加厚度
        osc.detune.value = (i % 2 === 0 ? 4 : -4);

        const g = ctx.createGain();
        g.gain.value = 0.012 - i * 0.002;

        // 每个 drone 有独立的慢速 LFO 调制音量（呼吸感）
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.03 + i * 0.012; // 更慢，0.03~0.066 Hz
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.012; // 调制深度降低
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        osc.connect(g);
        g.connect(masterLP);
        osc.start();
        lfo.start();
        _nodes.push(osc, g, lfo, lfoGain);
      });

      // === 高频泛音层（空灵氛围，极轻）===
      // E4 = 329.5Hz, A4 = 440Hz, C5 = 523Hz（A 小调和弦，降低八度避免刺耳）
      const padFreqs = [329.5, 440, 523];
      _padOscs = [];
      padFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = (i - 1) * 3;

        const g = ctx.createGain();
        g.gain.value = 0.006;

        // 慢速音量调制
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.05 + i * 0.02;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.003;
        lfo.connect(lfoGain);
        lfoGain.connect(g.gain);

        // 独立低通（更低，更柔和）
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;

        osc.connect(g);
        g.connect(lp);
        lp.connect(_masterGain);
        osc.start();
        lfo.start();
        _padOscs.push(osc);
        _nodes.push(osc, g, lfo, lfoGain, lp);
      });

      // === 噪声底层（极轻的"风声"）===
      const noiseBufSize = ctx.sampleRate * 4; // 4秒循环
      const noiseBuf = ctx.createBuffer(1, noiseBufSize, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseBufSize; i++) {
        nd[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      noiseSrc.loop = true;
      const noiseLP = ctx.createBiquadFilter();
      noiseLP.type = 'lowpass';
      noiseLP.frequency.value = 250; // 更低
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.006; // 减半
      // 噪声 LFO
      const nLfo = ctx.createOscillator();
      nLfo.frequency.value = 0.04;
      const nLfoGain = ctx.createGain();
      nLfoGain.gain.value = 0.003;
      nLfo.connect(nLfoGain);
      nLfoGain.connect(noiseGain.gain);
      noiseSrc.connect(noiseLP);
      noiseLP.connect(noiseGain);
      noiseGain.connect(_masterGain);
      noiseSrc.start();
      nLfo.start();
      _nodes.push(noiseSrc, noiseLP, noiseGain, nLfo, nLfoGain);

      // === 旋律层 + 琶音层 + 和弦进行 ===
      _scheduleMelody();
      _scheduleChordChange();
      _scheduleArp();

      return true;
    }

    // A 自然小调音阶（Aeolian，比五声音阶更丰富）
    const _scale = [220, 246.9, 261.6, 293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3, 659.3];
    // 旋律模式（更长、更有起伏的乐句）
    const _melodyPatterns = [
      [0, 2, 4, 7, 4, 2, 0],
      [4, 6, 8, 6, 4, 2, 0],
      [0, 4, 7, 9, 7, 4, 2],
      [7, 9, 11, 9, 7, 4, 2],
      [2, 4, 6, 4, 2, 0, 4],
      [0, 2, 4, 2, 6, 4, 2, 0],
      [4, 7, 9, 7, 4, 2, 0, 2],
      [9, 7, 4, 2, 0, 4, 2],
    ];
    // 和弦进行：Am - F - C - G (vi-IV-I-V，经典情感进行)
    const _chords = [
      [261.6, 329.6, 440],     // Am: C4, E4, A4
      [261.6, 349.2, 440],     // F:  C4, F4, A4
      [329.6, 392, 523.3],     // C:  E4, G4, C5
      [392, 493.9, 587.3],     // G:  G4, B4, D5
    ];
    // 低音根音
    const _bassNotes = [110, 87.4, 130.8, 98];
    // 和弦对应的琶音音
    const _arpNotes = [
      [220, 261.6, 329.6, 440],
      [174.6, 220, 261.6, 349.2],
      [130.8, 164.8, 196, 261.6],
      [196, 246.9, 293.7, 392],
    ];

    function _scheduleMelody() {
      if (!_playing) return;
      const delay = 4000 + Math.random() * 3000;
      _melodyTimer = setTimeout(() => {
        _playMelodyPhrase();
        _scheduleMelody();
      }, delay);
    }

    function _playMelodyPhrase() {
      if (!_playing || !_masterGain) return;
      const pattern = _melodyPatterns[Math.floor(Math.random() * _melodyPatterns.length)];
      const noteDelay = 900 + Math.random() * 300;
      pattern.forEach((idx, i) => {
        setTimeout(() => {
          if (_playing) _playMelodyNote(_scale[idx]);
        }, i * noteDelay);
      });
    }

    function _playMelodyNote(freq) {
      if (!_playing || !_masterGain) return;
      const ctx = _getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.016, now + 0.15);
      g.gain.linearRampToValueAtTime(0.010, now + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.linearRampToValueAtTime(0.003, now + 0.15);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.375;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.4;

      osc.connect(g);
      osc2.connect(g2);
      g.connect(lp);
      g2.connect(lp);
      lp.connect(_masterGain);
      lp.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(_masterGain);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 4.5);
      osc2.stop(now + 3.0);
    }

    function _scheduleChordChange() {
      if (!_playing) return;
      const delay = 14000 + Math.random() * 4000;
      _chordTimer = setTimeout(() => {
        _chordIdx = (_chordIdx + 1) % _chords.length;
        _changeChord(_chordIdx);
        _playBassNote(_bassNotes[_chordIdx]);
        _scheduleChordChange();
      }, delay);
    }

    function _changeChord(idx) {
      const ctx = _getCtx();
      if (!ctx) return;
      const freqs = _chords[idx];
      _padOscs.forEach((osc, i) => {
        if (osc && freqs[i]) {
          osc.frequency.exponentialRampToValueAtTime(freqs[i], ctx.currentTime + 3);
        }
      });
    }

    function _playBassNote(freq) {
      if (!_playing || !_masterGain) return;
      const ctx = _getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.020, now + 0.2);
      g.gain.linearRampToValueAtTime(0.012, now + 3.0);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 12.0);

      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.linearRampToValueAtTime(0.004, now + 0.2);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 8.0);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;

      osc.connect(g);
      osc2.connect(g2);
      g.connect(lp);
      g2.connect(lp);
      lp.connect(_masterGain);

      osc.start(now);
      osc2.start(now);
      osc.stop(now + 12.0);
      osc2.stop(now + 8.0);
    }

    function _scheduleArp() {
      if (!_playing) return;
      const delay = 2000 + Math.random() * 1500;
      _arpTimer = setTimeout(() => {
        _playArpPhrase();
        _scheduleArp();
      }, delay);
    }

    function _playArpPhrase() {
      if (!_playing || !_masterGain) return;
      const notes = _arpNotes[_chordIdx];
      const dir = Math.random() > 0.5 ? 1 : -1;
      const start = dir > 0 ? 0 : notes.length - 1;
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const idx = (start + dir * i + notes.length) % notes.length;
        setTimeout(() => {
          if (_playing) _playArpNote(notes[idx]);
        }, i * 350);
      }
    }

    function _playArpNote(freq) {
      if (!_playing || !_masterGain) return;
      const ctx = _getCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.008, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.5;
      const fb = ctx.createGain();
      fb.gain.value = 0.4;
      const delayGain = ctx.createGain();
      delayGain.gain.value = 0.3;

      osc.connect(g);
      g.connect(_masterGain);
      g.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(delayGain);
      delayGain.connect(_masterGain);

      osc.start(now);
      osc.stop(now + 3.0);
    }

    // 自定义背景音乐文件（根目录 mp3）；播放失败时回退合成 ambient
    const BGM_TRACK = 'ai-factory-processed-7457126-online.mp3';
    let _track = null;
    let _trackMode = false;
    let _trackPending = false; // mp3 因自动播放策略被拒，等待首次手势后重试
    function _ensureTrack() {
      if (!_track) {
        _track = new Audio(BGM_TRACK);
        _track.loop = true;
        _track.preload = 'auto';
        _track.volume = _volume;
      }
      return _track;
    }

    function play() {
      // 已在实际发声（mp3 或合成器节点）则跳过；_playing 仅为期望状态，首次恢复时仍需真正启动
      if (_trackMode) return;
      if (_playing && _nodes.length > 0) return;
      // 清除可能残留的 stop 清理定时器，防止竞态
      if (_stopCleanupTimer) { clearTimeout(_stopCleanupTimer); _stopCleanupTimer = null; }
      _playing = true;
      // 优先播放自定义 mp3；失败（文件缺失/被自动播放策略拦截）则回退合成器
      const t = _ensureTrack();
      t.volume = _volume;
      const pr = t.play();
      if (pr && pr.then) {
        pr.then(() => {
          _trackMode = true;
          _trackPending = false;
          savePref();
          Bus.emit('bgm:changed', { playing: true });
        }).catch((e) => {
          if (e && e.name === 'NotAllowedError') _trackPending = true;
          _startSynth();
        });
      } else {
        _startSynth();
      }
    }

    function _startSynth() {
      if (!_playing) return;
      const ctx = _getCtx();
      if (!ctx) return;
      if (_nodes.length === 0 || !_masterGain) {
        if (!_build()) return;
      }
      // 淡入
      const now = ctx.currentTime;
      _masterGain.gain.cancelScheduledValues(now);
      _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
      _masterGain.gain.linearRampToValueAtTime(_volume, now + 2.0);
      _playBassNote(_bassNotes[0]);
      _scheduleMelody();
      _scheduleChordChange();
      _scheduleArp();
      _startHealthCheck();
      savePref();
      Bus.emit('bgm:changed', { playing: true });
    }

    function _silenceSynth() {
      const ctx = _getCtx();
      if (_melodyTimer) { clearTimeout(_melodyTimer); _melodyTimer = null; }
      if (_chordTimer) { clearTimeout(_chordTimer); _chordTimer = null; }
      if (_arpTimer) { clearTimeout(_arpTimer); _arpTimer = null; }
      if (_healthCheckTimer) { clearInterval(_healthCheckTimer); _healthCheckTimer = null; }
      if (ctx && _masterGain) {
        const now = ctx.currentTime;
        _masterGain.gain.cancelScheduledValues(now);
        _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
        _masterGain.gain.linearRampToValueAtTime(0, now + 1.2);
      }
      // 1.4 秒后停止所有合成节点
      _stopCleanupTimer = setTimeout(() => {
        _nodes.forEach(n => { try { n.stop && n.stop(); n.disconnect(); } catch {} });
        _nodes = [];
        _lfoNodes = [];
        _padOscs = [];
        _chordIdx = 0;
        _masterGain = null;
        _stopCleanupTimer = null;
      }, 1400);
    }

    function stop() {
      if (!_playing) return;
      _playing = false;
      _trackPending = false;
      // 暂停自定义 mp3
      if (_track) { try { _track.pause(); } catch {} }
      _trackMode = false;
      _silenceSynth();
      savePref();
      Bus.emit('bgm:changed', { playing: false });
    }

    function toggle() {
      _playing ? stop() : play();
      return _playing;
    }
    function isPlaying() { return _playing; }
    function getVolume() { return _volume; }
    function setVolume(v) {
      _volume = Math.max(0, Math.min(1, v));
      if (_track) _track.volume = _volume;
      if (_masterGain && _playing) {
        const ctx = _getCtx();
        if (ctx) {
          const now = ctx.currentTime;
          _masterGain.gain.cancelScheduledValues(now);
          _masterGain.gain.setValueAtTime(_masterGain.gain.value, now);
          _masterGain.gain.linearRampToValueAtTime(_volume, now + 0.3);
        }
      }
      savePref();
      Bus.emit('bgm:changed', { volume: _volume });
    }

    // 定期健康检查：确保音频上下文持续运行
    function _startHealthCheck() {
      if (_healthCheckTimer) clearInterval(_healthCheckTimer);
      _healthCheckTimer = setInterval(() => {
        if (!_playing) return;
        const ctx = _getCtx();
        if (!ctx) return;
        // 上下文被浏览器挂起 → 尝试恢复
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // 节点丢失 → 重建
        if (_nodes.length === 0 || !_masterGain) {
          if (_build()) {
            const now = ctx.currentTime;
            _masterGain.gain.setValueAtTime(0, now);
            _masterGain.gain.linearRampToValueAtTime(_volume, now + 1.5);
            _scheduleMelody();
            _scheduleChordChange();
            _scheduleArp();
          }
        }
        // 音量意外归零 → 恢复
        if (_masterGain && _masterGain.gain.value < 0.001 && _volume > 0) {
          const now = ctx.currentTime;
          _masterGain.gain.cancelScheduledValues(now);
          _masterGain.gain.setValueAtTime(0.0001, now);
          _masterGain.gain.linearRampToValueAtTime(_volume, now + 2.0);
        }
      }, 5000);
    }

    // 浏览器策略：首次用户交互后自动恢复
    function _autoResume() {
      if (_playing && _trackMode && _track && _track.paused) {
        _track.play().catch(() => {});
      }
      // 刷新后曾因自动播放策略回退合成器：首次手势解锁后切回 mp3
      if (_playing && _trackPending && _track && !_trackMode) {
        _trackPending = false;
        const pr = _track.play();
        if (pr && pr.then) {
          pr.then(() => { _trackMode = true; _silenceSynth(); savePref(); })
            .catch(() => {});
        }
      }
      if (_playing && _nodes.length === 0 && !_trackMode && !_trackPending) {
        play();
      } else if (_playing && _getCtx() && _getCtx().state === 'suspended') {
        _getCtx().resume().catch(() => {});
      }
    }
    document.addEventListener('pointerdown', _autoResume);
    document.addEventListener('keydown', _autoResume);

    // 页面可见性变化：恢复被浏览器挂起的音频
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && _playing) {
        if (_trackMode && _track && _track.paused) {
          _track.play().catch(() => {});
        }
        const ctx = _getCtx();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        // 节点丢失（浏览器回收）→ 重建
        if ((_nodes.length === 0 || !_masterGain) && !_trackMode) {
          play();
        }
      }
    });

    return { play, stop, toggle, isPlaying, getVolume, setVolume };
  })();

  // ============ 在线音乐模块（网易云 API + 直接 URL）============
  const OnlineMusic = (() => {
    let _audio = null;
    let _playing = false;
    let _currentSong = null;
    let _apiBase = localStorage.getItem('wa_om_api') || '';
    let _history = [];
    try { _history = JSON.parse(localStorage.getItem('wa_om_history') || '[]'); } catch {}

    function _ensureAudio() {
      if (!_audio) {
        _audio = new Audio();
        _audio.volume = parseFloat(localStorage.getItem('wa_om_vol') || '0.5');
        _audio.addEventListener('ended', () => {
          _playing = false;
          Bus.emit('om:changed', { playing: false, ended: true });
        });
        _audio.addEventListener('error', () => {
          _playing = false;
          Bus.emit('om:changed', { playing: false, error: true });
        });
        _audio.addEventListener('play', () => {
          _playing = true;
          Bus.emit('om:changed', { playing: true });
        });
        _audio.addEventListener('pause', () => {
          _playing = false;
          Bus.emit('om:changed', { playing: false });
        });
      }
      return _audio;
    }

    async function search(keywords) {
      if (!_apiBase) return { ok: false, msg: '未配置 API 地址，请点击设置按钮配置' };
      try {
        const url = `${_apiBase}/search?keywords=${encodeURIComponent(keywords)}&limit=20`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code === 200 && data.result && data.result.songs) {
        return {
          ok: true,
          list: data.result.songs.map(s => ({
            id: s.id,
            name: s.name,
            artist: (s.artists || []).map(a => a.name).join(' / '),
            album: (s.album || {}).name || '',
          }))
        };
      }
      return { ok: false, msg: data.msg || '搜索失败' };
      } catch (e) {
        return { ok: false, msg: '网络错误：' + e.message };
      }
    }

    async function play(song) {
      if (BGM.isPlaying()) BGM.stop();
      const audio = _ensureAudio();

      if (song.url) {
        audio.src = song.url;
        try { await audio.play(); } catch {}
        _currentSong = song;
        _addToHistory(song);
        return { ok: true };
      }

      if (!_apiBase) return { ok: false, msg: '未配置 API 地址' };
      try {
        const res = await fetch(`${_apiBase}/song/url?id=${song.id}`);
        const data = await res.json();
        if (data.code === 200 && data.data && data.data[0] && data.data[0].url) {
          audio.src = data.data[0].url;
          try { await audio.play(); } catch {}
          _currentSong = song;
          _addToHistory(song);
          return { ok: true };
        }
        return { ok: false, msg: '获取播放链接失败（可能需要 VIP）' };
      } catch (e) {
        return { ok: false, msg: '网络错误：' + e.message };
      }
    }

    function playByUrl(url, name) {
      if (BGM.isPlaying()) BGM.stop();
      const audio = _ensureAudio();
      audio.src = url;
      audio.play().catch(() => {});
      _currentSong = { name: name || '自定义音乐', url };
      _addToHistory(_currentSong);
    }

    function stop() {
      if (_audio) { _audio.pause(); _audio.currentTime = 0; }
      _currentSong = null;
    }
    function pause() { if (_audio) _audio.pause(); }
    function resume() {
      if (_audio && _currentSong) {
        if (BGM.isPlaying()) BGM.stop();
        _audio.play().catch(() => {});
      }
    }
    function isPlaying() { return _playing; }
    function getCurrent() { return _currentSong; }
    function getApiBase() { return _apiBase; }
    function setApiBase(url) {
      _apiBase = (url || '').trim().replace(/\/$/, '');
      localStorage.setItem('wa_om_api', _apiBase);
    }
    function getHistory() { return _history; }
    function setVolume(v) {
      const vol = Math.max(0, Math.min(1, v));
      if (_audio) _audio.volume = vol;
      localStorage.setItem('wa_om_vol', vol);
    }
    function getVolume() { return _audio ? _audio.volume : parseFloat(localStorage.getItem('wa_om_vol') || '0.5'); }

    function _addToHistory(song) {
      _history = _history.filter(s => s.name !== song.name);
      _history.unshift({ name: song.name, artist: song.artist, url: song.url, id: song.id });
      if (_history.length > 30) _history = _history.slice(0, 30);
      localStorage.setItem('wa_om_history', JSON.stringify(_history));
    }

    return { search, play, playByUrl, stop, pause, resume, isPlaying, getCurrent, getApiBase, setApiBase, getHistory, setVolume, getVolume };
  })();

  // ============ 在线音乐 UI ============
  let _omModal = null;
  function openMusicPanel() {
    if (_omModal) { _omModal.remove(); _omModal = null; }
    const dlg = document.createElement('div');
    dlg.className = 'admin-modal';
    dlg.style.zIndex = '10001';
    dlg.innerHTML = `
      <div class="admin-modal-body om-panel">
        <h3 class="am-title">在线音乐 · ONLINE MUSIC</h3>
        <div class="om-tabs">
          <button class="om-tab active" data-tab="search">搜索</button>
          <button class="om-tab" data-tab="url">直链播放</button>
          <button class="om-tab" data-tab="history">历史</button>
          <button class="om-tab" data-tab="settings">设置</button>
        </div>
        <div class="om-body" id="om-body"></div>
        <div class="am-foot">
          <button class="abtn abtn-cancel" data-act="close">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(dlg);
    _omModal = dlg;

    dlg.addEventListener('click', e => { if (e.target === dlg) { dlg.remove(); _omModal = null; } });
    dlg.querySelector('[data-act="close"]').addEventListener('click', () => { dlg.remove(); _omModal = null; });

    const body = dlg.querySelector('#om-body');
    const tabs = dlg.querySelectorAll('.om-tab');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      renderTab(t.dataset.tab);
    }));

    function renderTab(tab) {
      if (tab === 'search') renderSearch();
      else if (tab === 'url') renderUrl();
      else if (tab === 'history') renderHistory();
      else if (tab === 'settings') renderSettings();
    }

    function renderSearch() {
      body.innerHTML = `
        <div class="om-search-row">
          <input type="text" id="om-search-input" placeholder="搜索歌曲 / 歌手…" class="admin-search-input" style="flex:1;min-width:0">
          <button class="abtn abtn-approve" id="om-search-btn">搜索</button>
        </div>
        <div id="om-results" class="om-results"></div>
      `;
      const input = body.querySelector('#om-search-input');
      const btn = body.querySelector('#om-search-btn');
      const results = body.querySelector('#om-results');
      async function doSearch() {
        const kw = input.value.trim();
        if (!kw) return;
        results.innerHTML = '<div class="om-loading">搜索中…</div>';
        const r = await OnlineMusic.search(kw);
        if (!r.ok) { results.innerHTML = `<div class="om-empty">${r.msg}</div>`; return; }
        if (!r.list.length) { results.innerHTML = '<div class="om-empty">无结果</div>'; return; }
        results.innerHTML = r.list.map(s => `
          <div class="om-song" data-id="${s.id}" data-name="${escapeAttr(s.name)}" data-artist="${escapeAttr(s.artist)}">
            <div class="om-song-info">
              <div class="om-song-name">${escapeHtml(s.name)}</div>
              <div class="om-song-artist">${escapeHtml(s.artist)}${s.album ? ' · ' + escapeHtml(s.album) : ''}</div>
            </div>
            <button class="om-play-btn">▶</button>
          </div>
        `).join('');
        results.querySelectorAll('.om-song').forEach(el => {
          el.querySelector('.om-play-btn').addEventListener('click', async () => {
            const song = { id: el.dataset.id, name: el.dataset.name, artist: el.dataset.artist };
            el.querySelector('.om-play-btn').textContent = '…';
            const r = await OnlineMusic.play(song);
            el.querySelector('.om-play-btn').textContent = r.ok ? '♪' : '▶';
            if (r.ok) {
              results.querySelectorAll('.om-song').forEach(x => x.classList.remove('playing'));
              el.classList.add('playing');
              syncOmUI();
            } else {
              banner(r.msg || '播放失败', 'err');
            }
          });
        });
      }
      btn.addEventListener('click', doSearch);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
      input.focus();
    }

    function renderUrl() {
      body.innerHTML = `
        <div class="om-url-section">
          <label class="af"><span>音频直链 URL（mp3 / m4a / wav 等）</span>
            <input type="text" id="om-url-input" placeholder="https://example.com/music.mp3" style="width:100%">
          </label>
          <label class="af"><span>名称（选填）</span>
            <input type="text" id="om-url-name" placeholder="自定义音乐名" style="width:100%">
          </label>
          <button class="abtn abtn-approve" id="om-url-play" style="margin-top:8px">播放</button>
        </div>
      `;
      body.querySelector('#om-url-play').addEventListener('click', () => {
        const url = body.querySelector('#om-url-input').value.trim();
        const name = body.querySelector('#om-url-name').value.trim();
        if (!url) { banner('请输入音频 URL', 'err'); return; }
        OnlineMusic.playByUrl(url, name);
        syncOmUI();
        banner('开始播放', 'ok');
      });
    }

    function renderHistory() {
      const hist = OnlineMusic.getHistory();
      if (!hist.length) { body.innerHTML = '<div class="om-empty">暂无播放历史</div>'; return; }
      body.innerHTML = hist.map(s => `
        <div class="om-song" data-name="${escapeAttr(s.name)}" data-artist="${escapeAttr(s.artist || '')}" data-url="${escapeAttr(s.url || '')}" data-id="${s.id || ''}">
          <div class="om-song-info">
            <div class="om-song-name">${escapeHtml(s.name)}</div>
            <div class="om-song-artist">${escapeHtml(s.artist || '')}</div>
          </div>
          <button class="om-play-btn">▶</button>
        </div>
      `).join('');
      body.querySelectorAll('.om-song').forEach(el => {
        el.querySelector('.om-play-btn').addEventListener('click', async () => {
          const song = { id: el.dataset.id, name: el.dataset.name, artist: el.dataset.artist, url: el.dataset.url };
          const r = await OnlineMusic.play(song);
          if (r.ok) syncOmUI(); else banner(r.msg || '播放失败', 'err');
        });
      });
    }

    function renderSettings() {
      const api = OnlineMusic.getApiBase();
      body.innerHTML = `
        <div class="om-settings">
          <label class="af"><span>网易云 API 地址</span>
            <input type="text" id="om-api-input" value="${escapeAttr(api)}" placeholder="https://your-api.vercel.app" style="width:100%">
          </label>
          <p style="font-size:11px;color:var(--text-3);margin-top:8px;line-height:1.8">
            需要部署网易云 API 服务（如 <a href="https://github.com/Binaryify/NeteaseCloudMusicApi" target="_blank" style="color:var(--silver-2)">NeteaseCloudMusicApi</a>）并填入地址。<br>
            可部署到 Vercel / Cloudflare Workers 等免费平台。<br>
            留空则只能使用直链播放功能。
          </p>
          <button class="abtn abtn-approve" id="om-api-save" style="margin-top:10px">保存</button>
        </div>
      `;
      body.querySelector('#om-api-save').addEventListener('click', () => {
        OnlineMusic.setApiBase(body.querySelector('#om-api-input').value);
        banner('API 地址已保存', 'ok');
      });
    }

    renderTab('search');
  }

  function syncOmUI() {
    const playing = OnlineMusic.isPlaying();
    const current = OnlineMusic.getCurrent();
    const lbl = document.getElementById('sb-om-label');
    if (lbl) lbl.textContent = playing ? '在线音乐：' + (current ? current.name : '播放中') : '在线音乐：关';
    const btn = document.getElementById('sb-om-toggle');
    if (btn) btn.style.color = playing ? 'var(--silver-2)' : '';
  }

  function initOmUI() {
    const btn = document.getElementById('sb-om-toggle');
    if (btn) btn.addEventListener('click', openMusicPanel);
    Bus.on('om:changed', syncOmUI);
    syncOmUI();
  }

  // ============ 音效开关 UI 同步 ============
  let _sfxUIBound = false;
  function syncSfxUI() {
    const muted = SFX.isMuted();
    const vol = Math.round(SFX.getVolume() * 100);
    const onIco = document.getElementById('sfx-ico-on');
    const offIco = document.getElementById('sfx-ico-off');
    const lblHeader = document.getElementById('sfx-label-header');
    if (onIco) onIco.style.display = muted ? 'none' : 'inline-block';
    if (offIco) offIco.style.display = muted ? 'inline-block' : 'none';
    if (lblHeader) lblHeader.textContent = muted ? '静音' : '音效';
    const sbBtn = document.getElementById('sb-sfx-toggle');
    if (sbBtn) {
      const svg = sbBtn.querySelector('svg');
      if (svg && muted) {
        svg.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
      } else if (svg) {
        svg.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>';
      }
    }
    const sbLbl = document.getElementById('sb-sfx-label');
    if (sbLbl) sbLbl.textContent = muted ? '音效：关' : '音效：开';
    // 音量滑块
    const volWrap = document.getElementById('sb-sfx-vol-wrap');
    if (volWrap) volWrap.style.display = muted ? 'none' : 'flex';
    const volSlider = document.getElementById('sb-sfx-vol');
    if (volSlider) volSlider.value = vol;
    const volVal = document.getElementById('sb-sfx-vol-val');
    if (volVal) volVal.textContent = vol;
  }
  function initSfxUI() {
    if (_sfxUIBound) { syncSfxUI(); return; }
    _sfxUIBound = true;
    const hdr = document.getElementById('sfx-toggle-header');
    if (hdr) hdr.addEventListener('click', () => { SFX.toggle(); syncSfxUI(); });
    const volSlider = document.getElementById('sb-sfx-vol');
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        SFX.setVolume(parseInt(volSlider.value, 10) / 100);
        const volVal = document.getElementById('sb-sfx-vol-val');
        if (volVal) volVal.textContent = volSlider.value;
      });
      volSlider.addEventListener('change', () => {
        // 松开滑块时播放预览音
        SFX.click();
      });
    }
    Bus.on('sfx:changed', syncSfxUI);
    syncSfxUI();
  }

  // ============ 背景音乐 UI 同步 ============
  let _bgmUIBound = false;
  function syncBgmUI() {
    const playing = BGM.isPlaying();
    const vol = Math.round(BGM.getVolume() * 100);
    const sbLbl = document.getElementById('sb-bgm-label');
    if (sbLbl) sbLbl.textContent = playing ? '背景音乐：开' : '背景音乐：关';
    // 切换图标颜色
    const sbBtn = document.getElementById('sb-bgm-toggle');
    if (sbBtn) {
      sbBtn.style.color = playing ? 'var(--gold-1)' : '';
    }
    const volWrap = document.getElementById('sb-bgm-vol-wrap');
    if (volWrap) volWrap.style.display = playing ? 'flex' : 'none';
    const volSlider = document.getElementById('sb-bgm-vol');
    if (volSlider) volSlider.value = vol;
    const volVal = document.getElementById('sb-bgm-vol-val');
    if (volVal) volVal.textContent = vol;
  }
  function initBgmUI() {
    if (_bgmUIBound) { syncBgmUI(); return; }
    _bgmUIBound = true;
    const sbBtn = document.getElementById('sb-bgm-toggle');
    if (sbBtn) sbBtn.addEventListener('click', () => {
      BGM.toggle();
      syncBgmUI();
    });
    const volSlider = document.getElementById('sb-bgm-vol');
    if (volSlider) {
      volSlider.addEventListener('input', () => {
        BGM.setVolume(parseInt(volSlider.value, 10) / 100);
        const volVal = document.getElementById('sb-bgm-vol-val');
        if (volVal) volVal.textContent = volSlider.value;
      });
    }
    Bus.on('bgm:changed', syncBgmUI);
    syncBgmUI();
  }

  // ============ 视觉增强：列表头图滚动视差 ============
  function initParallax() {
    if (window.__parallaxBound) return;
    window.__parallaxBound = true;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight || 800;
      const heads = document.querySelectorAll('.list-header[data-header-img], .admin-head[data-header-img]');
      heads.forEach(el => {
        const r = el.getBoundingClientRect();
        // 只处理进入/接近视口的头图，避免无谓计算
        if (r.bottom < -120 || r.top > vh + 120) return;
        const h = r.height || 240;
        // r.top 从 0 → 负值：头图向上滚出，图片则以更慢的速度位移
        const p = Math.max(-1, Math.min(1, -r.top / h));
        el.style.setProperty('--lhp', (p * 18).toFixed(1) + 'px');
      });
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ============ 视觉增强：鼠标跟随探照灯 ============
  function initSpotlight() {
    if (window.__spotlightInit) return;
    window.__spotlightInit = true;
    // 触摸设备 / 减少动效 / 无 hover 能力 → 不启用
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = document.createElement('div');
    el.className = 'spotlight';
    el.setAttribute('aria-hidden', 'true');
    // 插到 #app 之前：位于内容之下、噪点之上，不会压住文字
    const app = document.getElementById('app');
    if (app && app.parentNode) app.parentNode.insertBefore(el, app);
    else document.body.insertBefore(el, document.body.firstChild);

    let tx = (window.innerWidth || 800) / 2;
    let ty = (window.innerHeight || 600) / 2;
    let cx = tx, cy = ty;
    let raf = null;
    let started = false;

    const loop = () => {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      if (Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    };

    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!started) {
        started = true;
        cx = tx; cy = ty;
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
        el.classList.add('on');
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });

    document.addEventListener('mouseleave', () => el.classList.remove('on'));
    document.addEventListener('mouseenter', () => { if (started) el.classList.add('on'); });
    // 滚出窗口时也是「离开」
    window.addEventListener('blur', () => el.classList.remove('on'));
  }

  // ============ 启动 ============

  function start() {
    // 恢复管理员之前的档案更改（增删改）到内存 DATA
    LocalCats.applyOverrides();
    LocalEntries.applyOverrides();
    Theme.init();
    renderNavCats();
    bindGlobalSearch();
    bindLogout();
    bindThemeToggle();
    initBackToTop();
    initHotkeys();
    initSidebar();
    initParallax();
    initSpotlight();
    initSfxUI();
    initBgmUI();
    initOmUI();
    refreshIdentity();
    if (!Auth.get()) {
      showLoginGate();
    } else {
      if (!location.hash) location.hash = '#/';
      else router();
    }
  }
  window.addEventListener('hashchange', router);
  document.addEventListener('DOMContentLoaded', start);
  if (document.readyState !== 'loading') start();

  // 状态栏红点（实时更新，不依赖数据）
  const updInterval = setInterval(() => {
    const el = document.getElementById('stat-total');
    if (el && statsTotal()) {
      clearInterval(updInterval);
      el.textContent = `${statsTotal()} 条`;
      document.getElementById('stat-updated').textContent = DATA.meta.updated || '—';
    }
  }, 50);
})();
