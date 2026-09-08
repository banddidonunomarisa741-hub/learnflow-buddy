/* Human-readable strategy guides. Examples are authored illustrations, never model output. */
(() => {
  'use strict';

  const guides = {
    evidence: {
      fits: '做完一道六级阅读题，想弄清自己为什么选它，以及错在定位、理解还是推断。先准备原文、题干、选项和自己的理由。',
      limits: '手里只有答案字母，没有原文或题目时，先补材料。这张卡也不负责自动分析没有提供的听力录音。',
      steps: [
        ['先留住你的判断', '把自己的选择和理由发来，参考答案先不展开。答对也可以复盘，猜对和找到了依据是两回事。'],
        ['一项一项对照原文', '标出支持选项的句子，再检查其他选项有没有扩大范围、颠倒因果或替换概念。找不到依据的判断要单独留下。'],
        ['换一道题再判断', '用一句话解释自己的依据，再做一道原创变式题。原题来源与新编练习分开标明。']
      ],
      example: [
        ['学习者', '示例原文说：“Students who studied in groups reported higher confidence. The survey did not measure test scores.” 我选了“分组学习提高了考试成绩”，因为信心提高了。'],
        ['学习助手', '先看你用到的那一步推断：原文实际测量了信心，还是考试成绩？'],
        ['学习者', '是信心。没有测成绩，不能直接把两件事等同起来。'],
        ['学习助手', '对。你的依据是第二句：调查没有测量考试成绩。换个例子：受访者说某课程“很有帮助”，但研究没检查他们的作品质量。能据此说作品质量提高了吗？']
      ],
      controls: ['可以先只拆一个干扰项，减少一次要看的内容。', '可以要求先给原文位置，再自己解释；也可以直接查看完整讲解。', '是否保留错因笔记，由你确认。'],
      evidence: '这是一套整理证据和检查推断的流程，不能揭示官方命题内幕。是否有用，要看你能否独立解释选项、处理新题；一次答对不够。'
    },
    roots: {
      fits: '背词时总觉得每个词都互不相关，想试着利用词缀、同根词和语境建立联系。一次拿出少量目标词就能开始。',
      limits: '并不是每个词都适合拆分。模型找不到可靠词源时，应改用语境或明确标注为个人联想，不能把猜测当词源。',
      steps: [
        ['先给一个小词表', '发来自己要学的词，告诉助手哪些已经认识。先猜词义，别一开始就把整张答案表摊开。'],
        ['把线索和意思连起来', '用紧凑表格记录单词、可核验的构词线索、例句和易混处。相似拼写不自动等于相同词根。'],
        ['离开表格再回忆', '遮住释义，用新句子解释词义。喜欢这个表格格式，可以确认保存偏好，下次继续用。']
      ],
      example: [
        ['学习者', '我认识 predictable，但 unpredictable 总记不住。先别告诉我完整意思。'],
        ['学习助手', '先看你已经认识的部分：predictable 是“可预测的”。un- 加在这里，会怎样改变它的意思？'],
        ['学习者', '变成“不可预测的”？'],
        ['学习助手', '是。试着放回句子：“The weather here is unpredictable.” 这句话说天气有什么特点？先自己解释，再看释义。']
      ],
      controls: ['词量、是否先猜、表格列数都能改。', '觉得词源负担太重，可以改成例句和近义词辨析。', '输出格式只有在你确认后才保存为偏好。'],
      evidence: '构词线索只能帮一部分词建立联系，不能替代语境、读音和实际使用。检查是否记住时，要离开原表格，再用一次新语境。'
    },
    feynman: {
      fits: '刚学过一个概念，照着教材能点头，但离开原文就讲不清楚。适合拿一个小概念开始。',
      limits: '完全没接触过的内容，可以先让助手简短讲一遍。公式、证明和专业定义也不能只靠日常类比判断对错。',
      steps: [
        ['你先讲一次', '用自己的话说明概念，不必追求漂亮。卡住的地方可以直接说“这里我不确定”。'],
        ['只补眼前的缺口', '助手从你的解释里找一个具体问题。先补这一处，再继续；用类比时也说清类比到哪里就不合适了。'],
        ['再讲一次，换例子试试', '重写自己的解释，再回答一个新情境。能不能使用这个概念，比讲得流不流畅更值得看。']
      ],
      example: [
        ['学习者', '我理解的速率，就是总路程除以总时间。'],
        ['学习助手', '这个算法得到平均速率。如果车在红灯前停住了，车此刻的速率也等于整段路程的平均速率吗？'],
        ['学习者', '不等于。停住时是零，整段路程的平均速率可能不是零。'],
        ['学习助手', '那就用你刚才这个例子，重新解释“平均速率”和“瞬时速率”的区别。再想想：仪表盘通常显示哪一种？']
      ],
      controls: ['你可以选“当我是初学者”或指定已有基础。', '不喜欢类比，可以只用定义、图示或一个具体例题。', '觉得追问太慢，随时说“直接解释这一处”。'],
      evidence: '“费曼法”这个名字不保证效果。语言顺畅可能掩盖理解缺口，还需要新例子、独立作答或可核验的推导来检查。'
    },
    retrieval: {
      fits: '已经读过材料，想知道离开资料后还能想起什么。适合章节复习、课程笔记和需要反复调用的基础知识。',
      limits: '还没有学过的内容，先读或听一遍。资料不完整、答案来源不清时，先补依据，再把问题放进复习。',
      steps: [
        ['从你的资料里挑三点', '提交想复习的材料，助手逐题提问。回答前不提前给关键提示；想不起来也可以如实说。'],
        ['回答后再看反馈', '对照资料核验回答，分清答对、漏了一部分和暂时不会。只记具体遗漏，不给自己贴能力标签。'],
        ['隔一段时间再试', '可先尝试次日和一周后复习，再根据表现调整。日期建议本身不会自动创建提醒。']
      ],
      example: [
        ['学习者', '我刚读了笔记：论点是作者的主张，证据用来支持主张，反例用来检验主张的边界。请让我合上笔记自测。'],
        ['学习助手', '第一个问题：如果一句话在说明“为什么应该相信这个主张”，它更可能承担什么作用？'],
        ['学习者', '是在提供证据。'],
        ['学习助手', '符合你这份笔记的区分。下一题：一个例子与原先的概括不一致，我们可以用它检查什么？']
      ],
      controls: ['每轮题数、难度和反馈详略可以改。', '你可以请求一点提示，也可以坚持先独立回忆。', '复习间隔按你的时间调整；需要消息提醒时，还要单独设置提醒。'],
      evidence: '这张卡把提问、反馈和延迟再测连起来，但不能精确预测你的遗忘时间。需要观察隔天、隔周还能否独立回答，而不是只看本轮正确率。'
    },
    socratic: {
      fits: '已经有一个观点或方案，愿意检查理由、隐含假设和反例。适合讨论题、阅读思辨和做决定前的论证。',
      limits: '只是想查一个明确事实，或已经累得不想被追问时，直接讲解通常更合适。提问不是为了把人问倒。',
      steps: [
        ['先说观点和理由', '不用一开始就给完整论证。把自己为什么这样想也说出来，助手才能找到值得检验的地方。'],
        ['一次检验一个点', '从定义、证据、假设或反例里选一个薄弱处。每次只推进一个问题，避免连珠炮式盘问。'],
        ['写下修正后的观点', '保留仍有依据的部分，把过强的说法收窄，标出还需要找的证据。也可能发现原来的观点仍站得住。']
      ],
      example: [
        ['学习者', '我觉得用 AI 学习一定会让人变懒，因为它能直接给答案。'],
        ['学习助手', '如果有人先独立作答，再让 AI 检查依据，这个例子也符合你说的“一定”吗？'],
        ['学习者', '好像不符合。我想批评的是直接复制答案、不再自己想。'],
        ['学习助手', '那试着把观点改写成一句更准确的话，把“什么用法、可能带来什么后果”说清楚。']
      ],
      controls: ['你可以指定只检查证据，不讨论措辞。', '随时暂停追问、要求例子，或切换成直接讲解。', '助手可以提出反例，但最终立场由你决定。'],
      evidence: '追问能帮助暴露论证缺口，却不自动证明结论正确。事实仍要核查，反例是否相关也需要判断；对话轮数不是思考深度。'
    },
    pbl: {
      fits: '想做出一个作品，或者团队已经有主题却不知道怎么分工。先明确要交付什么，再倒推需要学什么。',
      limits: '只有一个零散知识点要弄懂时，不必先搭完整项目。当前本机任务看板也不能替代实时多人协作服务。',
      steps: [
        ['把想法变成可检查的作品', '说清驱动问题、面向谁、最终产出和已有条件。例如“做校园地图”还需要具体到地图要帮助谁解决什么事。'],
        ['拆出第一份可交付成果', '给里程碑列负责人、依赖和完成标准，补上所需的先修知识。第一步要小到今天就能开始。'],
        ['拿作品回来复盘', '展示阶段产出，让团队和使用者检查它是否解决问题。助手可以整理反馈，不能代替组员完成所有学习与判断。']
      ],
      example: [
        ['学习者', '我们三个人想做一张校园无障碍通行地图，现在只有这个想法。'],
        ['学习助手', '先缩小到一条路线：从校门到图书馆。你们希望第一次使用的人，靠这张图完成什么？'],
        ['学习者', '能找到不用走台阶的路线，并知道入口在哪里。'],
        ['学习助手', '第一份成果可以是一张可核验的路线草图。一人记录入口与坡道，一人绘图，一人照图走一遍并标出看不懂的地方。完成标准是第三个人能按图到达，不只是在图上画出一条线。']
      ],
      controls: ['项目范围、截止时间、角色和完成标准都可以重写。', '需要直接示范一个小步骤时可以提出，剩下的工作仍由你决定。', '是否分享作品、给谁看，由团队自己选择。'],
      evidence: '项目地图提供过程支架，不能保证作品质量。要靠真实产出、试用反馈和阶段检查验证进展；本地任务记录不等于队友已经同步收到。'
    },
    plain: {
      fits: '觉得助手的套话、夸奖或长篇铺垫妨碍阅读，想先听到答案，再看必要解释。可以和其他学习方法一起用。',
      limits: '推导、概念边界和关键证据不能为了短而省掉。它只改变表达偏好，不替代核验，也不会提高模型本身的能力。',
      steps: [
        ['先讲眼前的问题', '直接说结论或指出哪里还缺信息，不先写一段空泛的鼓励和背景介绍。'],
        ['留下有用的理由', '按问题的难度补必要依据。你具体做对了什么，就说那一点；有错误也明确指出。'],
        ['把下一步交给你', '需要继续时给一个能操作的选项，你也可以自己提问。想看详细版，随时展开。']
      ],
      example: [
        ['学习者', '梯度下降是什么？先讲短一点。'],
        ['学习助手', '它是一种逐步调参数、让误差变小的方法。每次看看往哪个方向调整更容易减小误差，再走一小步。步子太大，可能越过低点。'],
        ['学习者', '给我一个只有一个参数的例子。'],
        ['学习助手', '假设误差是 (w − 3)²，目标是让 w 靠近 3。现在 w = 0，先向增大的方向移动一点。你想继续看数值变化，还是想看它为什么朝这个方向走？']
      ],
      controls: ['可以指定“先结论”“多举例”“保留推导”或“不要夸奖”。', '口语或正式语气都能选；简短不等于冷淡。', '同一个问题也可以随时改要详细版。'],
      evidence: '这是交流风格偏好，没有据此证明学习效果提高。短答案是否够用，要看它有没有回答问题、保留必要条件，并让你能继续操作。'
    },
    teacher: {
      fits: '学习者愿意拿出草稿、修改稿或项目产出，让教师更快看清做了什么、卡在哪里。适合整理过程反馈与下一步教学建议。',
      limits: '没有实际作品时，只能列待补证据，不能凭聊天次数、Token 用量或自述生成能力分。正式评价仍需教师核验。',
      steps: [
        ['由学习者选出材料', '先确认目标，再选择愿意分享的作品和过程记录。没有主动提供的学习数据不默认纳入。'],
        ['分开事实与解释', '列出能直接看到的变化，再写可能的困难和待核验推测。每条反馈尽量对应到具体作品。'],
        ['教师看过，再形成评价', '助手整理草稿和下一步建议，教师补充专业判断，也可以否决草稿。学生能看到修改依据。']
      ],
      example: [
        ['学习者', '我愿意给老师看这两稿阅读复盘。初稿只写了答案，修改稿给两道题补了原文句子，但第三题还没找到依据。'],
        ['学习助手', '可以整理为：已提供的变化——两题新增了原文依据；待补证据——第三题尚未定位。仅凭这两稿，还不能判断你能否独立处理新题。'],
        ['教师', '下一步评价怎么做？'],
        ['学习助手', '可请学生当面解释第三题的判断，再独立处理一道相近新题。把实际表现补进反馈后，再作评价。这里先保留为草稿。']
      ],
      controls: ['分享哪些材料、隐藏哪些部分，由学习者先选。', '教师可以改评价维度和反馈措辞，保留最后判断。', '学生可以补充证据或说明与草稿不一致的地方。'],
      evidence: '草稿只是对授权材料的整理，不代表正式成绩，也不证明个人能力已经提升。需要教师查看作品、核对证据，并结合独立表现判断。'
    }
  };

  function view(card, { esc, icon }) {
    const guide = Object.hasOwn(guides, card.id) ? guides[card.id] : null;
    const ownCard = String(card.id || '').startsWith('custom-');
    const section = (title, content, className = '') => `<section class="lf-guide-section ${className}"><h3>${esc(title)}</h3>${content}</section>`;
    const paragraph = value => `<p>${esc(value)}</p>`;
    const list = values => `<ul>${values.map(value => `<li>${esc(value)}</li>`).join('')}</ul>`;
    const numbered = steps => `<ol class="lf-guide-steps">${steps.map(([title, detail], index) => `<li><span class="lf-guide-step-number">${String(index + 1).padStart(2, '0')}</span><div><h4>${esc(title)}</h4>${paragraph(detail)}</div></li>`).join('')}</ol>`;
    const sourceInstructions = typeof card.instructions === 'string' ? card.instructions : '';
    const source = section('这张卡会给模型的指令', `<p class="lf-guide-hint">启用后，这段指令会随你的问题发送。</p><pre class="lf-guide-source">${esc(sourceInstructions || '尚未填写指令。')}</pre>`, 'lf-guide-source-section');
    const action = ownCard
      ? `<button class="secondary lf-guide-adapt" data-edit-card="${esc(card.id)}">编辑我的方法 ${icon('arrow')}</button>`
      : `<button class="secondary lf-guide-adapt" data-copy-card="${esc(card.id)}">复制一张，改成自己的 ${icon('arrow')}</button>`;
    const intro = `<div class="lf-guide-intro"><span class="lf-guide-kicker">${guide ? '方法说明' : '作者提供的策略'}</span>${paragraph(card.description || '这张卡没有填写一句话介绍。')}</div>`;
    let content;

    if (guide) {
      const fit = `<div class="lf-guide-fit"><section><h3>什么时候用</h3>${paragraph(guide.fits)}</section><section><h3>先别急着用</h3>${paragraph(guide.limits)}</section></div>`;
      const example = `<div class="lf-guide-example-note">以下对话为说明用法编写，不是本次模型的真实回复。</div><div class="lf-guide-dialogue">${guide.example.map(([speaker, words]) => `<div class="lf-guide-turn ${speaker === '学习助手' ? 'is-assistant' : ''}"><span class="lf-guide-speaker">${esc(speaker)}</span>${paragraph(words)}</div>`).join('')}</div>`;
      content = fit + section('一次学习，具体怎么走', numbered(guide.steps)) + section('看一个例子', example) + source + section('你可以怎么改', list(guide.controls) + action) + section('怎么判断它有没有用', paragraph(guide.evidence), 'lf-guide-evidence');
    } else {
      const suppliedSteps = Array.isArray(card.steps) ? card.steps.filter(step => typeof step === 'string' && step.trim()).slice(0, 12) : [];
      const suppliedExamples = Array.isArray(card.examples) ? card.examples.filter(example => typeof example === 'string' && example.trim()).slice(0, 12) : [];
      const suppliedLimits = typeof card.limits === 'string' ? card.limits.trim() : '';
      const suppliedEvidence = typeof card.evidence === 'string' ? card.evidence.trim() : '';
      const preservedParagraph = value => `<p style="white-space:pre-wrap">${esc(value)}</p>`;
      content = section('适用边界', preservedParagraph(suppliedLimits || '作者暂未补充适用边界。'))
        + (suppliedSteps.length ? section('具体步骤', `<ol class="lf-guide-author-steps">${suppliedSteps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>`) : '')
        + section('使用示例', suppliedExamples.length
          ? `<div class="lf-guide-dialogue">${suppliedExamples.map((example, index) => `<div class="lf-guide-turn"><span class="lf-guide-speaker">作者示例 ${index + 1}</span>${preservedParagraph(example)}</div>`).join('')}</div>`
          : paragraph('还没有示例，可以试用后补一条。'))
        + source
        + section('改成适合自己的方法', action)
        + section('方法依据', preservedParagraph(suppliedEvidence || '作者暂未提供方法依据。'), 'lf-guide-evidence');
    }

    return `<div class="lf-strategy-guide" data-strategy-guide="${esc(card.id)}">${intro}${content}</div>`;
  }

  window.LearnFlowStrategyGuide = Object.freeze({ view });
})();
