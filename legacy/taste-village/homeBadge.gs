/**
 * 맛마음 탐험소 6단계
 * - 5회기 × 2개 = 핵심 배지 10개
 * - 현재 미션 점검
 * - 자유게임 결과 저장
 * - 디지털 탐험노트
 *
 * 기존 HomeBadge.gs의 내용을 전부 이 코드로 교체합니다.
 * 기존 데이터 시트 구조를 그대로 사용합니다.
 */

const TASTE_MIND_STAGE_PLAN = [
  {
    sessionNo: 1,
    title: '첫 만남과 오늘 급식 이야기',
    shortTitle: '첫걸음',
    goal: '오늘 급식 경험과 내 느낌을 편안하게 말해 봅니다.',
    badges: [
      {
        id: 'CORE-S1-FIRST-STEP',
        name: '첫걸음 탐험가',
        icon: '🧭',
        description: '맛마음 탐험의 첫걸음을 시작했어요.',
        reason: '맛마음 탐험 1회기를 완료함'
      },
      {
        id: 'CORE-S1-MEAL-STORY',
        name: '급식 이야기꾼',
        icon: '💬',
        description: '오늘 급식 경험을 내 말로 표현했어요.',
        reason: '오늘 급식 경험과 몸·마음의 느낌을 자신의 말로 표현함'
      }
    ]
  },
  {
    sessionNo: 2,
    title: '나의 음식생활 지도와 몸 신호',
    shortTitle: '몸 신호',
    goal: '배고픔·배부름·생활리듬이 식사와 어떻게 연결되는지 살펴봅니다.',
    badges: [
      {
        id: 'CORE-S2-LIFE-MAP',
        name: '생활지도 제작자',
        icon: '🗺️',
        description: '나의 식사와 생활리듬을 지도로 연결했어요.',
        reason: '맛마음 탐험 2회기에서 음식생활의 흐름을 살펴봄'
      },
      {
        id: 'CORE-S2-BODY-SIGNAL',
        name: '몸 신호 관찰자',
        icon: '📡',
        description: '배고픔과 배부름 같은 몸의 신호를 알아차렸어요.',
        reason: '맛마음 탐험 2회기에서 몸의 신호를 관찰함'
      }
    ]
  },
  {
    sessionNo: 3,
    title: '먹기 어려운 이유와 숨은 장벽',
    shortTitle: '숨은 장벽',
    goal: '맛·냄새·식감·상황 중 나에게 영향을 주는 단서를 찾습니다.',
    badges: [
      {
        id: 'CORE-S3-DETECTIVE',
        name: '맛마음 탐정',
        icon: '🔎',
        description: '음식 경험에 영향을 주는 단서를 찾았어요.',
        reason: '맛마음 탐험 3회기에서 음식 경험의 핵심 단서를 발견함'
      },
      {
        id: 'CORE-S3-BARRIER',
        name: '숨은 장벽 발견자',
        icon: '🧩',
        description: '나를 어렵게 만드는 숨은 장벽을 알아냈어요.',
        reason: '맛마음 탐험 3회기에서 개인의 어려움과 장벽을 구체화함'
      }
    ]
  },
  {
    sessionNo: 4,
    title: '나에게 맞는 해결방법 찾기',
    shortTitle: '해결 아이템',
    goal: '남이 정한 방법이 아니라 나에게 맞는 작은 해결방법을 만듭니다.',
    badges: [
      {
        id: 'CORE-S4-SOLUTION',
        name: '해결 아이템 제작자',
        icon: '🛠️',
        description: '나에게 맞는 도움방법을 직접 골랐어요.',
        reason: '맛마음 탐험 4회기에서 개인 맞춤 해결전략을 선택함'
      },
      {
        id: 'CORE-S4-SMALL-STEP',
        name: '작은 실천 설계자',
        icon: '🌱',
        description: '다음 급식에서 해볼 작은 행동을 정했어요.',
        reason: '맛마음 탐험 4회기에서 구체적인 작은 실천을 설계함'
      }
    ]
  },
  {
    sessionNo: 5,
    title: '나의 음식생활 설명서 완성',
    shortTitle: '나의 설명서',
    goal: '내 몸의 신호, 어려움, 도움방법과 앞으로의 실천을 설명서로 완성합니다.',
    badges: [
      {
        id: 'CORE-S5-GUIDE',
        name: '나의 설명서 완성',
        icon: '📖',
        description: '나에게 맞는 음식생활 설명서를 완성했어요.',
        reason: '맛마음 탐험 5회기에서 개인 음식생활 설명서를 완성함'
      },
      {
        id: 'CORE-S5-FINISH',
        name: '5회기 완주 탐험가',
        icon: '🏆',
        description: '다섯 번의 핵심 탐험을 끝까지 이어왔어요.',
        reason: '맛마음 탐험 1단계의 5회기를 모두 완료함'
      }
    ]
  }
];

const TASTE_MIND_CORE_BADGES = TASTE_MIND_STAGE_PLAN
  .reduce((all, session) => all.concat(
    session.badges.map(badge => Object.assign(
      { sessionNo: session.sessionNo, sessionTitle: session.title },
      badge
    ))
  ), []);

const TASTE_MIND_OLD_BADGE_IDS = [
  'BADGE-MEAL-TALKER',
  'BADGE-TASTE-DETECTIVE',
  'BADGE-SMALL-STEP',
  'BADGE-RETURNING-EXPLORER'
];

const TASTE_MIND_GAMES = [
  {
    id: 'sense-detective',
    name: '음식 감각 탐정',
    icon: '🔍',
    description: '맛·냄새·식감·모양의 단서를 구분해요.',
    maxScore: 5
  },
  {
    id: 'plate-puzzle',
    name: '식판 친구 찾기',
    icon: '🍱',
    description: '서로 다른 역할을 하는 음식 친구를 찾아요.',
    maxScore: 5
  },
  {
    id: 'rhythm-quest',
    name: '생활리듬 퀘스트',
    icon: '⏰',
    description: '식사·수면·활동을 연결하는 선택을 해요.',
    maxScore: 5
  },
  {
    id: 'safety-signal',
    name: '음식 안전 신호',
    icon: '🛡️',
    description: '헷갈리는 상황에서 안전한 행동을 찾아요.',
    maxScore: 5
  }
];

/* ==================================================================
 * 공개 함수
 * ================================================================== */

function getExplorerHomeSnapshot(sessionToken) {
  return toClient_(buildExplorerHomeSnapshot_(sessionToken));
}

function getExplorerBadgeBook(sessionToken) {
  const account = getExplorerAccountFromSession_(sessionToken);

  return toClient_({
    ok: true,
    completedSessionCount: getCompletedSessionRows_(account.accountId).length,
    badges: getBadgeBookForAccount_(account.accountId),
    stagePlan: getStageProgressForAccount_(account.accountId)
  });
}

function getExplorerConversationGuide(sessionToken) {
  const account = getExplorerAccountFromSession_(sessionToken);
  const home = buildExplorerHomeSnapshot_(sessionToken);

  return toClient_(
    buildFiveSessionConversationGuide_(
      account.internalArea || 'common',
      home.activeSessionNo
    )
  );
}

function saveStudentMealConversationAndBadges(sessionToken, payload) {
  const account = getExplorerAccountFromSession_(sessionToken);
  payload = payload || {};

  const saveResult = saveStudentMealConversation(sessionToken, payload);
  const sessionNo = getSessionNumberForDate_(
    account.accountId,
    payload.todayDate || new Date()
  );

  const plan = getStagePlan_(sessionNo);

  saveCoreSessionActivity_(account, payload, sessionNo, plan);
  saveOrUpdateMissionFromConversation_(account, payload, sessionNo);

  const newBadges = awardBadgeIdsOnce_(
    account,
    plan.badges.map(item => item.id)
  );

  const home = buildExplorerHomeSnapshot_(sessionToken);

  return toClient_(Object.assign({}, saveResult, {
    sessionNo: sessionNo,
    sessionTitle: plan.title,
    newBadges: newBadges,
    stageComplete: home.stageComplete,
    home: home
  }));
}

function getExplorerMissionSnapshot(sessionToken) {
  const account = getExplorerAccountFromSession_(sessionToken);
  return toClient_(getMissionSnapshotForAccount_(account));
}

function saveExplorerMissionCheck(sessionToken, payload) {
  const account = getExplorerAccountFromSession_(sessionToken);
  payload = payload || {};

  const result = clean_(payload.result);
  if (!result) throw new Error('오늘의 실천결과를 선택하세요.');

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    let mission = getActiveMissionRow_(account.accountId);

    if (!mission) {
      const fallback = clean_(account.currentMission);
      if (!fallback) {
        throw new Error(
          '점검할 현재 미션이 없습니다. 오늘의 탐험을 완료해 미션을 먼저 정하세요.'
        );
      }

      mission = createMissionRow_(
        account,
        fallback,
        0,
        Number(payload.confidence || 7),
        '매니저에서 동기화된 목표'
      );
    }

    const checkSheet = getRequiredExplorerSheet_(
      EXPLORER_CONFIG.SHEETS.CHECKS
    );

    const now = new Date();
    const checkObject = {
      '점검ID':
        'CK-' + Utilities.getUuid().replace(/-/g, '')
          .slice(0, 14).toUpperCase(),
      '미션ID': mission['미션ID'],
      '계정ID': account.accountId,
      '학생코드': account.studentCode,
      '케이스번호': account.caseId,
      '점검일시': now,
      '실천결과': result,
      '실제횟수': numberOrBlank_(payload.actualCount),
      '어려움': clean_(payload.difficulty),
      '도움요인': clean_(payload.helpFactor),
      '학생소감': clean_(payload.reflection),
      '다음결정': clean_(payload.nextDecision) || '계속하기',
      '다음미션': clean_(payload.nextMission),
      '비고': '학생용 탐험소 미션 점검'
    };

    upsertDailyExplorerRow_(
      checkSheet,
      row =>
        clean_(row['미션ID']) === clean_(mission['미션ID']) &&
        explorerDateKey_(row['점검일시']) === explorerDateKey_(now),
      checkObject,
      ['점검ID']
    );

    const nextDecision = clean_(payload.nextDecision) || '계속하기';
    const nextMission = clean_(payload.nextMission);
    const missionSheet = getRequiredExplorerSheet_(
      EXPLORER_CONFIG.SHEETS.MISSIONS
    );

    if (nextDecision === '조금 바꾸기' && nextMission) {
      updateExplorerRowByKey_(
        missionSheet,
        '미션ID',
        mission['미션ID'],
        {
          '미션문장': nextMission,
          '자신감': numberOrBlank_(payload.confidence),
          '비고': appendNote_(mission['비고'], '학생 점검 후 미션 수정')
        }
      );

      updateCellByKey_(
        getRequiredExplorerSheet_(EXPLORER_CONFIG.SHEETS.ACCOUNTS),
        '케이스번호',
        account.caseId,
        '최근실천목표',
        nextMission
      );
    }

    if (nextDecision === '완료하기') {
      updateExplorerRowByKey_(
        missionSheet,
        '미션ID',
        mission['미션ID'],
        {
          '상태': '완료',
          '종료일시': now,
          '비고': appendNote_(mission['비고'], '학생이 미션 완료 선택')
        }
      );

      // 완료한 미션이 다시 현재 미션으로 나타나지 않도록
      // 학생계정의 최근실천목표도 비웁니다.
      updateCellByKey_(
        getRequiredExplorerSheet_(EXPLORER_CONFIG.SHEETS.ACCOUNTS),
        '케이스번호',
        account.caseId,
        '최근실천목표',
        ''
      );
    }

    saveMissionCheckManagerLink_(account, mission, checkObject);

    return toClient_({
      ok: true,
      mission: getMissionSnapshotForAccount_(account),
      home: buildExplorerHomeSnapshot_(sessionToken)
    });
  } finally {
    lock.releaseLock();
  }
}

function getExplorerGameHub(sessionToken) {
  const account = getExplorerAccountFromSession_(sessionToken);
  return toClient_(buildGameHubForAccount_(account));
}

function saveExplorerGameResult(sessionToken, payload) {
  const account = getExplorerAccountFromSession_(sessionToken);
  payload = payload || {};

  const gameId = clean_(payload.gameId);
  const game = TASTE_MIND_GAMES.find(item => item.id === gameId);

  if (!game) throw new Error('게임 정보를 찾지 못했습니다.');

  const score = Math.max(
    0,
    Math.min(Number(payload.score || 0), Number(game.maxScore || 5))
  );

  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.ACTIVITIES
  );

  const now = new Date();
  const activityObject = {
    '활동ID':
      'AC-' + Utilities.getUuid().replace(/-/g, '')
        .slice(0, 14).toUpperCase(),
    '계정ID': account.accountId,
    '학생코드': account.studentCode,
    '케이스번호': account.caseId,
    '탐험번호': getCompletedSessionRows_(account.accountId).length,
    '활동일시': now,
    '활동구분': '자유게임',
    '활동명': game.name,
    '선택카드': score + '/' + game.maxScore,
    '학생주요발언': clean_(payload.summary),
    '핵심장벽': '',
    '선택전략': clean_(payload.learned),
    '학생소감': clean_(payload.reflection),
    '교사메모': '',
    '완료상태': '완료',
    '비고': 'GAME_ID=' + game.id
  };

  upsertDailyExplorerRow_(
    sheet,
    row =>
      clean_(row['계정ID']) === clean_(account.accountId) &&
      clean_(row['활동구분']) === '자유게임' &&
      clean_(row['활동명']) === game.name &&
      explorerDateKey_(row['활동일시']) === explorerDateKey_(now),
    activityObject,
    ['활동ID']
  );

  return toClient_({
    ok: true,
    game: game,
    score: score,
    hub: buildGameHubForAccount_(account),
    home: buildExplorerHomeSnapshot_(sessionToken)
  });
}

function getExplorerNotebook(sessionToken) {
  const account = getExplorerAccountFromSession_(sessionToken);
  return toClient_(buildNotebookForAccount_(account));
}

/**
 * 기존 4개 시험 배지를 지우고,
 * 현재 저장된 서로 다른 급식일 수에 맞추어 5회기 배지를 다시 지급합니다.
 * 한 번만 실행하면 됩니다.
 */
function migrateExplorerToFiveSessionBadges() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const stickerSheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.STICKERS
  );
  const accountSheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.ACCOUNTS
  );

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const values = stickerSheet.getDataRange().getValues();
    const headers = values[0].map(clean_);
    const stickerIdCol = headers.indexOf('스티커ID');
    let removed = 0;

    for (let index = values.length - 1; index >= 1; index -= 1) {
      if (TASTE_MIND_OLD_BADGE_IDS.includes(clean_(values[index][stickerIdCol]))) {
        stickerSheet.deleteRow(index + 1);
        removed += 1;
      }
    }

    const accountRows = getObjects_(accountSheet);
    let awarded = 0;

    accountRows.forEach(row => {
      const account = rawAccountToClient_(row);
      const completed = Math.min(
        5,
        getCompletedSessionRows_(account.accountId).length
      );

      for (let sessionNo = 1; sessionNo <= completed; sessionNo += 1) {
        const plan = getStagePlan_(sessionNo);
        awarded += awardBadgeIdsWithoutLock_(
          account,
          plan.badges.map(item => item.id)
        ).length;
      }
    });

    setSetting_(
      'BADGE_SYSTEM_VERSION',
      '5SESSION-10BADGES',
      '5회기·10개 핵심 배지 체계'
    );

    SpreadsheetApp.getUi().alert(
      '5회기·10개 배지 전환 완료',
      [
        '기존 시험 배지 삭제: ' + removed + '건',
        '현재 기록 기준 재지급: ' + awarded + '건',
        '',
        '같은 날 기록은 한 회기로 계산하며,',
        '5회기까지 총 10개의 핵심 배지를 모읍니다.'
      ].join('\n'),
      SpreadsheetApp.getUi().ButtonSet.OK
    );

    return { ok: true, removed: removed, awarded: awarded };
  } finally {
    lock.releaseLock();
  }
}

function testExplorerStageMissionGameNotebook() {
  const required = [
    EXPLORER_CONFIG.SHEETS.ACCOUNTS,
    EXPLORER_CONFIG.SHEETS.ACTIVITIES,
    EXPLORER_CONFIG.SHEETS.MEALS,
    EXPLORER_CONFIG.SHEETS.MISSIONS,
    EXPLORER_CONFIG.SHEETS.CHECKS,
    EXPLORER_CONFIG.SHEETS.STICKERS,
    EXPLORER_CONFIG.SHEETS.LINK
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const missing = required.filter(name => !ss.getSheetByName(name));

  if (missing.length) {
    throw new Error('필수 시트가 없습니다: ' + missing.join(', '));
  }

  SpreadsheetApp.getUi().alert(
    '6단계 연결 확인 완료',
    [
      '5회기 배지: 10개',
      '자유게임: ' + TASTE_MIND_GAMES.length + '종',
      '현재 미션: 실천미션·미션점검 연결',
      '탐험노트: 급식성찰·회기활동·배지 연결',
      '',
      '필수 시트가 모두 정상입니다.'
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return { ok: true };
}

/* ==================================================================
 * 5회기 대화 안내
 * ================================================================== */

function buildFiveSessionConversationGuide_(internalArea, sessionNo) {
  const base = getMealConversationGuide_(internalArea || 'common');
  const plan = getStagePlan_(sessionNo);

  const sessions = {
    1: {
      coreChoices: [
        '오늘 가장 편했던 순간',
        '조금 어려웠던 순간',
        '먹기 전 내 마음',
        '먹은 뒤 몸의 느낌',
        '선생님에게 알려주고 싶은 것'
      ],
      coreQuestions: [
        '오늘 급식에서 가장 먼저 떠오르는 장면은 무엇인가요?',
        '편하게 먹을 수 있었던 순간에는 무엇이 도움이 되었나요?',
        '조금 어려웠던 순간에는 어떤 느낌이나 생각이 있었나요?',
        '급식 전과 후에 몸의 느낌은 어떻게 달라졌나요?',
        '선생님이 앞으로 꼭 알아주었으면 하는 것은 무엇인가요?',
        '다음 급식에서 다시 관찰해 보고 싶은 것은 무엇인가요?'
      ]
    },
    2: {
      coreChoices: [
        '아침식사와 점심의 연결',
        '배고픔이 커지는 시간',
        '배부름을 알아차리는 순간',
        '먹는 속도와 급식시간',
        '잠·활동과 식사의 연결'
      ],
      coreQuestions: [
        '오늘 처음 배고프다고 느낀 시간은 언제였나요?',
        '아침을 먹은 날과 먹지 않은 날 점심 느낌은 어떻게 다른가요?',
        '배가 차기 시작했다는 신호는 몸의 어디에서 느껴지나요?',
        '먹는 속도에 영향을 주는 사람이나 상황이 있나요?',
        '잠을 잔 시간이나 활동량이 오늘 식사에 영향을 주었나요?',
        '내 음식생활 지도를 바꿀 수 있는 가장 작은 지점은 어디인가요?'
      ]
    },
    3: {
      coreChoices: base.coreChoices,
      coreQuestions: base.coreQuestions
    },
    4: {
      coreChoices: [
        '양을 내가 정하기',
        '먹는 순서를 바꾸기',
        '작은 단계로 경험하기',
        '도움을 요청하기',
        '자리·시간·방법을 바꾸기'
      ],
      coreQuestions: [
        '지난번에 찾은 어려움을 조금 줄일 수 있는 방법은 무엇인가요?',
        '완전히 먹기와 아무것도 하지 않기 사이에는 어떤 작은 단계가 있나요?',
        '양·순서·도구·자리 중 바꾸면 도움이 될 것은 무엇인가요?',
        '예전에 우연히 잘됐던 날에는 무엇이 달랐나요?',
        '누구의 어떤 도움이 있으면 더 해볼 만할까요?',
        '이번 주에 가장 쉽게 시험해 볼 해결 아이템은 무엇인가요?'
      ]
    },
    5: {
      coreChoices: [
        '내가 편하게 먹는 조건',
        '내 몸이 보내는 신호',
        '나를 어렵게 하는 단서',
        '나에게 맞는 도움방법',
        '앞으로 이어갈 작은 실천'
      ],
      coreQuestions: [
        '다섯 번의 탐험에서 새롭게 알게 된 내 모습은 무엇인가요?',
        '나는 어떤 조건에서 더 편안하게 먹을 수 있나요?',
        '내 몸은 배고픔과 배부름을 어떻게 알려주나요?',
        '나를 어렵게 하는 단서가 나타나면 어떤 방법이 도움이 되나요?',
        '선생님과 가족에게 알려주고 싶은 나의 사용설명은 무엇인가요?',
        '앞으로 계속 이어가고 싶은 작은 실천은 무엇인가요?'
      ],
      nextActions: [
        '내 설명서에서 가장 중요한 한 문장을 정하기',
        '나에게 도움이 되는 방법을 어른에게 말하기',
        '몸의 신호를 하루 한 번 확인하기',
        '어려운 상황에서 내가 정한 작은 단계를 사용하기',
        '잘되지 않은 날에도 다시 시작하기'
      ]
    }
  };

  const sessionGuide = sessions[plan.sessionNo] || sessions[5];

  return Object.assign({}, base, {
    sessionNo: plan.sessionNo,
    sessionTitle: plan.title,
    sessionGoal: plan.goal,
    studentTitle: plan.title,
    coreChoices: sessionGuide.coreChoices || base.coreChoices,
    coreQuestions: sessionGuide.coreQuestions || base.coreQuestions,
    nextActions: sessionGuide.nextActions || base.nextActions
  });
}

/* ==================================================================
 * 탐험 홈·배지
 * ================================================================== */

function buildExplorerHomeSnapshot_(sessionToken) {
  const account = getExplorerAccountFromSession_(sessionToken);
  const completedRows = getCompletedSessionRows_(account.accountId);
  const completedCount = Math.min(5, completedRows.length);

  const todayKey = explorerDateKey_(new Date());
  const todayDone = completedRows.some(row =>
    explorerDateKey_(row['급식일']) === todayKey
  );

  const activeSessionNo = completedCount >= 5
    ? 5
    : (todayDone
      ? Math.max(1, completedCount)
      : Math.min(5, completedCount + 1));

  const latestMeal = completedRows.length
    ? completedRows[completedRows.length - 1]
    : {};

  const badgeBook = getBadgeBookForAccount_(account.accountId);
  const earnedBadges = badgeBook.filter(item => item.earned);
  const mission = getMissionSnapshotForAccount_(account);
  const gameHub = buildGameHubForAccount_(account);

  return {
    ok: true,
    account: {
      alias: account.alias || '새싹',
      grade: account.grade || '',
      classNo: account.classNo || '',
      studentName: account.studentName || '',
      studentActivityLabel:
        account.studentActivityLabel || '나의 맛마음 알아보기',
      currentMission:
        mission.active && mission.active.statement
          ? mission.active.statement
          : account.currentMission || ''
    },
    todayDone: todayDone,
    activeSessionNo: activeSessionNo,
    activeSession: getStagePlan_(activeSessionNo),
    completedSessionCount: completedCount,
    completedExplorationCount: completedCount,
    latestPromise: clean_(latestMeal['학생약속문장']),
    earnedBadgeCount: earnedBadges.length,
    totalBadgeCount: TASTE_MIND_CORE_BADGES.length,
    stageComplete:
      completedCount >= 5 &&
      earnedBadges.length >= TASTE_MIND_CORE_BADGES.length,
    stagePlan: getStageProgressForAccount_(account.accountId),
    badges: badgeBook,
    currentMission: mission.active,
    missionCheckCount: mission.checkCount || 0,
    gamePlayCount: gameHub.totalPlayCount || 0,
    gameCompletedCount: gameHub.completedGameCount || 0
  };
}

function getStageProgressForAccount_(accountId) {
  const completedCount = Math.min(
    5,
    getCompletedSessionRows_(accountId).length
  );

  const badges = getBadgeBookForAccount_(accountId);
  const earnedIds = new Set(
    badges.filter(item => item.earned).map(item => item.id)
  );

  return TASTE_MIND_STAGE_PLAN.map(plan => ({
    sessionNo: plan.sessionNo,
    title: plan.title,
    shortTitle: plan.shortTitle,
    goal: plan.goal,
    completed: plan.sessionNo <= completedCount,
    badges: plan.badges.map(badge => ({
      id: badge.id,
      name: badge.name,
      icon: badge.icon,
      earned: earnedIds.has(badge.id)
    }))
  }));
}

function getBadgeBookForAccount_(accountId) {
  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.STICKERS
  );

  const earnedRows = getObjects_(sheet)
    .filter(row => clean_(row['계정ID']) === clean_(accountId));

  const earnedById = {};

  earnedRows.forEach(row => {
    const stickerId = clean_(row['스티커ID']);
    if (!stickerId) return;

    const previous = earnedById[stickerId];

    if (
      !previous ||
      explorerTimeValue_(row['획득일시']) >
        explorerTimeValue_(previous['획득일시'])
    ) {
      earnedById[stickerId] = row;
    }
  });

  return TASTE_MIND_CORE_BADGES.map(definition => {
    const row = earnedById[definition.id] || null;

    return {
      id: definition.id,
      sessionNo: definition.sessionNo,
      sessionTitle: definition.sessionTitle,
      name: definition.name,
      icon: definition.icon,
      description: definition.description,
      earned: Boolean(row),
      earnedAt: row
        ? explorerDisplayDateTime_(row['획득일시'])
        : '',
      earnedAtValue: row
        ? explorerTimeValue_(row['획득일시'])
        : 0,
      reason: row
        ? clean_(row['획득이유']) || definition.reason
        : definition.reason
    };
  });
}

function awardBadgeIdsOnce_(account, badgeIds) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    return awardBadgeIdsWithoutLock_(account, badgeIds);
  } finally {
    lock.releaseLock();
  }
}

function awardBadgeIdsWithoutLock_(account, badgeIds) {
  const uniqueIds = Array.from(new Set(badgeIds || []));
  if (!uniqueIds.length) return [];

  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.STICKERS
  );

  const existing = new Set(
    getObjects_(sheet)
      .filter(row =>
        clean_(row['계정ID']) === clean_(account.accountId)
      )
      .map(row => clean_(row['스티커ID']))
      .filter(Boolean)
  );

  const now = new Date();
  const awarded = [];

  uniqueIds.forEach(id => {
    if (existing.has(id)) return;

    const definition = TASTE_MIND_CORE_BADGES
      .find(item => item.id === id);

    if (!definition) return;

    appendExplorerObject_(sheet, {
      '획득ID':
        'ST-' + Utilities.getUuid().replace(/-/g, '')
          .slice(0, 14).toUpperCase(),
      '계정ID': account.accountId,
      '학생코드': account.studentCode,
      '케이스번호': account.caseId,
      '스티커ID': definition.id,
      '스티커명': definition.name,
      '획득일시': now,
      '획득이유': definition.reason,
      '비고': '5회기 핵심배지 자동 지급'
    });

    existing.add(id);

    awarded.push({
      id: definition.id,
      sessionNo: definition.sessionNo,
      name: definition.name,
      icon: definition.icon,
      description: definition.description,
      earned: true,
      earnedAt: explorerDisplayDateTime_(now),
      reason: definition.reason
    });
  });

  return awarded;
}

/* ==================================================================
 * 핵심 회기·미션
 * ================================================================== */

function saveCoreSessionActivity_(account, payload, sessionNo, plan) {
  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.ACTIVITIES
  );

  const now = new Date();

  upsertObjectByFields_(
    sheet,
    {
      '계정ID': account.accountId,
      '탐험번호': sessionNo,
      '활동구분': '핵심탐험'
    },
    {
      '활동ID':
        'AC-' + Utilities.getUuid().replace(/-/g, '')
          .slice(0, 14).toUpperCase(),
      '계정ID': account.accountId,
      '학생코드': account.studentCode,
      '케이스번호': account.caseId,
      '탐험번호': sessionNo,
      '활동일시': now,
      '활동구분': '핵심탐험',
      '활동명': plan.title,
      '선택카드': clean_(payload.coreChoice),
      '학생주요발언': [
        clean_(payload.studentStatement),
        clean_(payload.coreStatement)
      ].filter(Boolean).join('\n'),
      '핵심장벽': [
        arrayText_(payload.influenceFactors),
        clean_(payload.coreChoice)
      ].filter(Boolean).join(' / '),
      '선택전략': clean_(payload.nextAction),
      '학생소감': clean_(payload.reflection),
      '교사메모': [
        clean_(payload.teacherMemo),
        clean_(payload.coreTeacherMemo)
      ].filter(Boolean).join('\n'),
      '완료상태': '완료',
      '비고':
        '급식일=' + explorerDateKey_(payload.todayDate || now)
    },
    ['활동ID']
  );
}

function saveOrUpdateMissionFromConversation_(account, payload, sessionNo) {
  const promise = clean_(payload.promiseSentence);
  if (!promise) return null;

  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.MISSIONS
  );
  const rows = getObjects_(sheet);
  const now = new Date();

  rows.forEach(row => {
    if (
      clean_(row['계정ID']) === clean_(account.accountId) &&
      clean_(row['상태']) === '진행 중' &&
      Number(row['탐험번호'] || 0) !== Number(sessionNo)
    ) {
      updateExplorerRowByKey_(
        sheet,
        '미션ID',
        row['미션ID'],
        {
          '상태': '교체됨',
          '종료일시': now,
          '비고': appendNote_(row['비고'], '새 회기 미션으로 교체')
        }
      );
    }
  });

  const result = upsertObjectByFields_(
    sheet,
    {
      '계정ID': account.accountId,
      '탐험번호': sessionNo
    },
    {
      '미션ID':
        'MS-' + Utilities.getUuid().replace(/-/g, '')
          .slice(0, 14).toUpperCase(),
      '계정ID': account.accountId,
      '학생코드': account.studentCode,
      '케이스번호': account.caseId,
      '탐험번호': sessionNo,
      '생성일': now,
      '미션문장': promise,
      '언제': clean_(payload.nextDate)
        ? explorerDateKey_(payload.nextDate) + ' 급식시간'
        : '다음 급식시간',
      '어디서': '학교 급식실',
      '목표횟수': 1,
      '도움받을사람': '영양선생님 또는 담임선생님',
      '확인방법': '다음 탐험에서 돌아보기',
      '자신감': numberOrBlank_(payload.confidence),
      '시작일': now,
      '종료일': clean_(payload.nextDate),
      '상태': '진행 중',
      '종료일시': '',
      '비고': '급식 탐험에서 학생이 선택한 미션'
    },
    ['미션ID', '생성일', '시작일']
  );

  updateCellByKey_(
    getRequiredExplorerSheet_(EXPLORER_CONFIG.SHEETS.ACCOUNTS),
    '케이스번호',
    account.caseId,
    '최근실천목표',
    promise
  );

  return result;
}

function getMissionSnapshotForAccount_(account) {
  const missionSheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.MISSIONS
  );
  const checkSheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.CHECKS
  );

  const missions = getObjects_(missionSheet)
    .filter(row =>
      clean_(row['계정ID']) === clean_(account.accountId)
    )
    .sort((a, b) =>
      explorerTimeValue_(b['생성일']) -
      explorerTimeValue_(a['생성일'])
    );

  const activeRow = missions.find(row =>
    clean_(row['상태']) === '진행 중'
  ) || null;

  const active = activeRow
    ? missionRowToClient_(activeRow)
    : (clean_(account.currentMission)
      ? {
          missionId: '',
          sessionNo: 0,
          statement: clean_(account.currentMission),
          confidence: '',
          status: '진행 중',
          createdAt: '',
          source: '매니저 최근 목표'
        }
      : null);

  const checks = getObjects_(checkSheet)
    .filter(row =>
      clean_(row['계정ID']) === clean_(account.accountId) &&
      (!active || !active.missionId ||
        clean_(row['미션ID']) === clean_(active.missionId))
    )
    .sort((a, b) =>
      explorerTimeValue_(b['점검일시']) -
      explorerTimeValue_(a['점검일시'])
    );

  return {
    ok: true,
    active: active,
    checkCount: checks.length,
    latestCheck: checks.length
      ? missionCheckRowToClient_(checks[0])
      : null,
    recentChecks: checks.slice(0, 5)
      .map(missionCheckRowToClient_),
    history: missions.slice(0, 8)
      .map(missionRowToClient_)
  };
}

function getActiveMissionRow_(accountId) {
  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.MISSIONS
  );

  return getObjects_(sheet)
    .filter(row =>
      clean_(row['계정ID']) === clean_(accountId) &&
      clean_(row['상태']) === '진행 중'
    )
    .sort((a, b) =>
      explorerTimeValue_(b['생성일']) -
      explorerTimeValue_(a['생성일'])
    )[0] || null;
}

function createMissionRow_(account, statement, sessionNo, confidence, note) {
  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.MISSIONS
  );
  const now = new Date();
  const missionId =
    'MS-' + Utilities.getUuid().replace(/-/g, '')
      .slice(0, 14).toUpperCase();

  const object = {
    '미션ID': missionId,
    '계정ID': account.accountId,
    '학생코드': account.studentCode,
    '케이스번호': account.caseId,
    '탐험번호': sessionNo,
    '생성일': now,
    '미션문장': statement,
    '언제': '다음 급식시간',
    '어디서': '학교 급식실',
    '목표횟수': 1,
    '도움받을사람': '영양선생님 또는 담임선생님',
    '확인방법': '다음 탐험에서 돌아보기',
    '자신감': confidence,
    '시작일': now,
    '종료일': '',
    '상태': '진행 중',
    '종료일시': '',
    '비고': note || ''
  };

  appendExplorerObject_(sheet, object);
  return object;
}

function saveMissionCheckManagerLink_(account, mission, check) {
  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.LINK
  );

  const now = new Date();

  upsertDailyExplorerRow_(
    sheet,
    row =>
      clean_(row['계정ID']) === clean_(account.accountId) &&
      clean_(row['활동명']) === '현재 미션 점검' &&
      explorerDateKey_(row['전송일시']) === explorerDateKey_(now),
    {
      '연계ID':
        'LK-' + Utilities.getUuid().replace(/-/g, '')
          .slice(0, 14).toUpperCase(),
      '계정ID': account.accountId,
      '학생코드': account.studentCode,
      '케이스번호': account.caseId,
      '탐험번호': mission['탐험번호'] || '',
      '전송일시': now,
      '활동명': '현재 미션 점검',
      '선택카드': check['실천결과'],
      '학생주요발언': check['학생소감'],
      '핵심장벽': check['어려움'],
      '선택전략': check['도움요인'],
      '실천미션': check['다음미션'] || mission['미션문장'],
      '자신감': '',
      '학생소감': check['학생소감'],
      '다음추천':
        '다음 상담에서 미션 실천결과와 어려움·도움요인을 확인',
      '반영상태': '미반영',
      '반영일시': '',
      '비고': '학생용 탐험소 미션 점검'
    },
    ['연계ID']
  );
}

/* ==================================================================
 * 게임
 * ================================================================== */

function buildGameHubForAccount_(account) {
  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.ACTIVITIES
  );

  const rows = getObjects_(sheet)
    .filter(row =>
      clean_(row['계정ID']) === clean_(account.accountId) &&
      clean_(row['활동구분']) === '자유게임'
    );

  const games = TASTE_MIND_GAMES.map(game => {
    const plays = rows.filter(row =>
      clean_(row['활동명']) === game.name
    );

    const bestScore = plays.reduce((best, row) => {
      const match = clean_(row['선택카드']).match(/^(\d+)/);
      return Math.max(best, match ? Number(match[1]) : 0);
    }, 0);

    const latest = plays
      .slice()
      .sort((a, b) =>
        explorerTimeValue_(b['활동일시']) -
        explorerTimeValue_(a['활동일시'])
      )[0] || {};

    return Object.assign({}, game, {
      playCount: plays.length,
      bestScore: bestScore,
      lastPlayedAt: explorerDisplayDateTime_(latest['활동일시'])
    });
  });

  return {
    ok: true,
    games: games,
    totalPlayCount: rows.length,
    completedGameCount: games.filter(item => item.playCount > 0).length
  };
}

/* ==================================================================
 * 탐험노트
 * ================================================================== */

function buildNotebookForAccount_(account) {
  const sessionRows = getCompletedSessionRows_(account.accountId);
  const mission = getMissionSnapshotForAccount_(account);
  const gameHub = buildGameHubForAccount_(account);
  const badges = getBadgeBookForAccount_(account.accountId);
  const activitySheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.ACTIVITIES
  );

  const gameRows = getObjects_(activitySheet)
    .filter(row =>
      clean_(row['계정ID']) === clean_(account.accountId) &&
      clean_(row['활동구분']) === '자유게임'
    )
    .sort((a, b) =>
      explorerTimeValue_(b['활동일시']) -
      explorerTimeValue_(a['활동일시'])
    );

  const chapters = TASTE_MIND_STAGE_PLAN.map((plan, index) => {
    const row = sessionRows[index] || null;

    return {
      sessionNo: plan.sessionNo,
      title: plan.title,
      goal: plan.goal,
      completed: Boolean(row),
      date: row ? explorerDateKey_(row['급식일']) : '',
      memorableMenu: row ? clean_(row['메뉴별경험']) : '',
      studentStatement: row ? clean_(row['학생발언']) : '',
      bodySignal: row
        ? [
            row['배고픔점수'] !== ''
              ? '급식 전 배고픔 ' + row['배고픔점수'] + '/10'
              : '',
            row['배부름점수'] !== ''
              ? '급식 후 배부름 ' + row['배부름점수'] + '/10'
              : ''
          ].filter(Boolean).join(' · ')
        : '',
      barrier: row ? clean_(row['영향요인']) : '',
      strategy: row ? clean_(row['선택행동']) : '',
      promise: row ? clean_(row['학생약속문장']) : ''
    };
  });

  const timeline = [];

  sessionRows.forEach((row, index) => {
    timeline.push({
      timeValue: explorerTimeValue_(row['기록일시']),
      date: explorerDisplayDateTime_(row['기록일시']),
      icon: '🍽️',
      title:
        (index + 1) + '회기 · ' +
        getStagePlan_(index + 1).shortTitle,
      text:
        clean_(row['학생약속문장']) ||
        clean_(row['학생발언']) ||
        clean_(row['메뉴별경험'])
    });
  });

  mission.recentChecks.forEach(check => {
    timeline.push({
      timeValue: check.timeValue,
      date: check.checkedAt,
      icon: '🌱',
      title: '현재 미션 점검 · ' + check.result,
      text: check.reflection || check.difficulty || check.helpFactor
    });
  });

  gameRows.forEach(row => {
    timeline.push({
      timeValue: explorerTimeValue_(row['활동일시']),
      date: explorerDisplayDateTime_(row['활동일시']),
      icon: '🎮',
      title: row['활동명'] + ' · ' + clean_(row['선택카드']),
      text: clean_(row['학생소감']) || clean_(row['학생주요발언'])
    });
  });

  badges.filter(item => item.earned).forEach(item => {
    timeline.push({
      timeValue: item.earnedAtValue,
      date: item.earnedAt,
      icon: item.icon,
      title: '배지 획득 · ' + item.name,
      text: item.description
    });
  });

  timeline.sort((a, b) => b.timeValue - a.timeValue);

  const completedCount = Math.min(5, sessionRows.length);

  return {
    ok: true,
    completedSessionCount: completedCount,
    stageComplete:
      completedCount >= 5 &&
      badges.filter(item => item.earned).length >= 10,
    chapters: chapters,
    currentMission: mission.active,
    missionChecks: mission.recentChecks,
    games: gameHub.games,
    badges: badges,
    timeline: timeline.slice(0, 30),
    finalGuide: completedCount >= 5
      ? buildFinalGuide_(chapters)
      : null
  };
}

function buildFinalGuide_(chapters) {
  const completed = chapters.filter(item => item.completed);

  return {
    title: '나의 음식생활 설명서',
    comfortable:
      firstNonBlank_(completed.map(item => item.studentStatement)) ||
      '나는 내 몸과 마음의 신호를 천천히 살펴볼 수 있어요.',
    bodySignals:
      completed.map(item => item.bodySignal).filter(Boolean).join(' / '),
    barriers:
      uniqueText_(
        completed.map(item => item.barrier).filter(Boolean)
      ).join(' / '),
    helpfulStrategies:
      uniqueText_(
        completed.map(item => item.strategy).filter(Boolean)
      ).join(' / '),
    nextPromise:
      lastNonBlank_(completed.map(item => item.promise)) ||
      '잘되지 않은 날에도 다시 시작해요.'
  };
}

/* ==================================================================
 * 공통 데이터 도우미
 * ================================================================== */

function getExplorerAccountFromSession_(sessionToken) {
  const session = getExplorerSession_(sessionToken);
  const account = getExplorerAccountByCaseId(session.caseId);

  if (!account) throw new Error('학생계정을 찾지 못했습니다.');
  return account;
}

function getCompletedSessionRows_(accountId) {
  const sheet = getRequiredExplorerSheet_(
    EXPLORER_CONFIG.SHEETS.MEALS
  );

  const rows = getObjects_(sheet)
    .filter(row =>
      clean_(row['계정ID']) === clean_(accountId)
    )
    .sort((a, b) =>
      explorerTimeValue_(a['기록일시']) -
      explorerTimeValue_(b['기록일시'])
    );

  const byDate = {};

  rows.forEach(row => {
    const dateKey = explorerDateKey_(row['급식일']);
    if (!dateKey) return;

    const previous = byDate[dateKey];

    if (
      !previous ||
      explorerTimeValue_(row['기록일시']) >
        explorerTimeValue_(previous['기록일시'])
    ) {
      byDate[dateKey] = row;
    }
  });

  return Object.keys(byDate)
    .sort()
    .map(key => byDate[key])
    .slice(0, 5);
}

function getSessionNumberForDate_(accountId, value) {
  const dateKey = explorerDateKey_(value);
  const rows = getCompletedSessionRows_(accountId);
  const index = rows.findIndex(row =>
    explorerDateKey_(row['급식일']) === dateKey
  );

  if (index >= 0) return Math.min(5, index + 1);
  return Math.min(5, rows.length + 1);
}

function getStagePlan_(sessionNo) {
  const normalized = Math.max(
    1,
    Math.min(5, Number(sessionNo || 1))
  );

  return TASTE_MIND_STAGE_PLAN[normalized - 1];
}

function getRequiredExplorerSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(sheetName);

  if (!sheet) throw new Error(sheetName + ' 시트가 없습니다.');
  return sheet;
}

function appendExplorerObject_(sheet, object) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(clean_);

  const row = headers.map(header =>
    Object.prototype.hasOwnProperty.call(object, header)
      ? object[header]
      : ''
  );

  sheet.appendRow(row);
}

function upsertDailyExplorerRow_(
  sheet,
  predicate,
  patch,
  preserveHeaders
) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(clean_);
  const preserve = new Set(preserveHeaders || []);
  let targetRow = -1;

  for (let index = 1; index < values.length; index += 1) {
    const object = {};
    headers.forEach((header, col) => {
      if (header) object[header] = values[index][col];
    });

    if (predicate(object)) {
      targetRow = index + 1;
      break;
    }
  }

  if (targetRow > 0) {
    const oldRow = values[targetRow - 1];

    const nextRow = headers.map((header, index) => {
      if (preserve.has(header) && oldRow[index]) return oldRow[index];

      return Object.prototype.hasOwnProperty.call(patch, header)
        ? patch[header]
        : oldRow[index];
    });

    sheet.getRange(targetRow, 1, 1, headers.length)
      .setValues([nextRow]);

    return { created: false, row: targetRow };
  }

  appendExplorerObject_(sheet, patch);
  return { created: true, row: sheet.getLastRow() };
}

function updateExplorerRowByKey_(sheet, keyHeader, keyValue, patch) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(clean_);
  const keyIndex = headers.indexOf(keyHeader);

  if (keyIndex < 0) {
    throw new Error(sheet.getName() + ' 시트에 ' + keyHeader + ' 열이 없습니다.');
  }

  for (let index = 1; index < values.length; index += 1) {
    if (clean_(values[index][keyIndex]) !== clean_(keyValue)) continue;

    const nextRow = headers.map((header, col) =>
      Object.prototype.hasOwnProperty.call(patch, header)
        ? patch[header]
        : values[index][col]
    );

    sheet.getRange(index + 1, 1, 1, headers.length)
      .setValues([nextRow]);

    return true;
  }

  return false;
}

function rawAccountToClient_(row) {
  return {
    accountId: row['계정ID'] || '',
    studentCode: row['학생코드'] || '',
    caseId: row['케이스번호'] || '',
    grade: row['학년'] || '',
    classNo: row['반'] || '',
    studentName: row['학생명'] || '',
    alias: row['탐험가별명'] || '',
    internalArea: row['내부상담영역'] || 'common',
    studentActivityLabel:
      row['학생표시활동'] || STUDENT_ACTIVITY_LABELS.common,
    currentMission: row['최근실천목표'] || ''
  };
}

function missionRowToClient_(row) {
  return {
    missionId: row['미션ID'] || '',
    sessionNo: Number(row['탐험번호'] || 0),
    statement: row['미션문장'] || '',
    when: row['언제'] || '',
    where: row['어디서'] || '',
    targetCount: row['목표횟수'] || '',
    helper: row['도움받을사람'] || '',
    checkMethod: row['확인방법'] || '',
    confidence: row['자신감'] || '',
    status: row['상태'] || '',
    createdAt: explorerDisplayDateTime_(row['생성일']),
    source: '탐험소 미션'
  };
}

function missionCheckRowToClient_(row) {
  return {
    checkId: row['점검ID'] || '',
    checkedAt: explorerDisplayDateTime_(row['점검일시']),
    timeValue: explorerTimeValue_(row['점검일시']),
    result: row['실천결과'] || '',
    actualCount: row['실제횟수'] || '',
    difficulty: row['어려움'] || '',
    helpFactor: row['도움요인'] || '',
    reflection: row['학생소감'] || '',
    nextDecision: row['다음결정'] || '',
    nextMission: row['다음미션'] || ''
  };
}

function appendNote_(original, note) {
  return [clean_(original), clean_(note)]
    .filter(Boolean)
    .join(' | ');
}

function firstNonBlank_(values) {
  return (values || []).find(value => clean_(value)) || '';
}

function lastNonBlank_(values) {
  const filtered = (values || []).filter(value => clean_(value));
  return filtered.length ? filtered[filtered.length - 1] : '';
}

function uniqueText_(values) {
  return Array.from(new Set(
    (values || []).map(clean_).filter(Boolean)
  ));
}

function explorerDateKey_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      EXPLORER_CONFIG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  const text = clean_(value);
  const digits = text.replace(/[^0-9]/g, '');

  if (digits.length >= 8) {
    return (
      digits.slice(0, 4) + '-' +
      digits.slice(4, 6) + '-' +
      digits.slice(6, 8)
    );
  }

  return text;
}

function explorerTimeValue_(value) {
  if (!value) return 0;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? 0 : value.getTime();
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

function explorerDisplayDateTime_(value) {
  if (!value) return '';

  const date = Object.prototype.toString.call(value) === '[object Date]'
    ? value
    : new Date(value);

  if (isNaN(date.getTime())) return clean_(value);

  return Utilities.formatDate(
    date,
    EXPLORER_CONFIG.TIMEZONE,
    'yyyy-MM-dd HH:mm'
  );
}
