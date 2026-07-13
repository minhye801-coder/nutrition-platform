/**
 * 맛마음 탐험소 3단계: 구미봉곡초등학교 급식 연결
 *
 * 새 스크립트 파일 "MealApi.gs"를 만들어 붙여넣습니다.
 * 기존 Code.gs는 그대로 둡니다.
 */

const MEAL_CONFIG = {
  SCHOOL_NAME: '구미봉곡초등학교',
  OFFICE_CODE: 'R10',
  SCHOOL_CODE: '8801088',
  API_KEY_PROPERTY: 'NEIS_API_KEY',
  TIMEZONE: 'Asia/Seoul',
  SEARCH_DAYS: 14
};

/**
 * 선택 기능: 나이스 인증키를 Script Properties에 저장합니다.
 * 함수 목록에서 직접 실행할 수 있습니다.
 */
function registerNeisApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '나이스 급식 API 인증키 등록',
    [
      '나이스 교육정보 개방 포털에서 발급받은 인증키를 입력하세요.',
      '인증키는 코드나 시트가 아니라 Script Properties에 저장됩니다.',
      '',
      '인증키가 아직 없다면 취소하고 급식 연결 시험부터 실행해도 됩니다.'
    ].join('\n'),
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const key = clean_(response.getResponseText());
  if (!key) {
    ui.alert('인증키가 입력되지 않았습니다.');
    return;
  }

  PropertiesService.getScriptProperties()
    .setProperty(MEAL_CONFIG.API_KEY_PROPERTY, key);

  setSetting_('NEIS_API_KEY_STATUS', '등록됨', '실제 인증키는 Script Properties에만 저장');
  setSetting_('NEIS_OFFICE_CODE', MEAL_CONFIG.OFFICE_CODE, '경상북도교육청 코드');
  setSetting_('NEIS_SCHOOL_CODE', MEAL_CONFIG.SCHOOL_CODE, '구미봉곡초등학교 급식 학교코드');

  ui.alert('나이스 인증키가 안전하게 등록되었습니다.');
}

/**
 * Apps Script 함수 목록에서 실행해 급식 연결 상태를 확인합니다.
 */
function testSchoolMealConnection() {
  const ui = SpreadsheetApp.getUi();
  const data = getMealJourneyData_(new Date());

  const todayText = data.today
    ? data.today.dateLabel + '\n' + data.today.menu.join('\n')
    : '오늘 등록된 급식이 없습니다.';

  const nextText = data.next
    ? data.next.dateLabel + '\n' + data.next.menu.join('\n')
    : '앞으로 ' + MEAL_CONFIG.SEARCH_DAYS + '일 이내 등록된 급식이 없습니다.';

  ui.alert(
    '구미봉곡초등학교 급식 연결 확인',
    [
      '[오늘 또는 기준일 급식]',
      todayText,
      '',
      '[다음 급식일]',
      nextText
    ].join('\n'),
    ui.ButtonSet.OK
  );

  return data;
}

/**
 * 로그인 세션에 연결된 오늘·다음 급식 및 맞춤 질문을 반환합니다.
 */
function getStudentMealConversation(sessionToken) {
  const session = getExplorerSession_(sessionToken);
  const account = getExplorerAccountByCaseId(session.caseId);

  if (!account) throw new Error('학생계정을 찾지 못했습니다.');

  const meals = getMealJourneyData_(new Date());
  const conversation = getMealConversationGuide_(account.internalArea || 'common');

  return {
    ok: true,
    meals: meals,
    conversation: conversation
  };
}

/**
 * 학생이 오늘 급식 경험과 다음 급식 약속을 저장합니다.
 */
function saveStudentMealConversation(sessionToken, payload) {
  const session = getExplorerSession_(sessionToken);
  const account = getExplorerAccountByCaseId(session.caseId);

  if (!account) throw new Error('학생계정을 찾지 못했습니다.');

  payload = payload || {};

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const mealSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(EXPLORER_CONFIG.SHEETS.MEALS);

    if (!mealSheet) throw new Error('급식성찰 시트가 없습니다.');

    const linkSheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(EXPLORER_CONFIG.SHEETS.LINK);

    const now = new Date();
    const recordDate =
      clean_(payload.todayDate) ||
      Utilities.formatDate(now, MEAL_CONFIG.TIMEZONE, 'yyyy-MM-dd');

    const combinedStudentStatement = [
      clean_(payload.studentStatement),
      clean_(payload.coreStatement)
    ].filter(Boolean).join('\n');

    const combinedFactors = [
      arrayText_(payload.influenceFactors),
      clean_(payload.coreChoice)
    ].filter(Boolean).join(' / ');

    const combinedTeacherMemo = [
      clean_(payload.teacherMemo),
      clean_(payload.coreTeacherMemo)
    ].filter(Boolean).join('\n');

    const activityName =
      clean_(payload.activityName) ||
      '오늘 급식 돌아보기와 맞춤 탐험';

    const requestId =
      clean_(payload.requestId) ||
      Utilities.getUuid().replace(/-/g, '');

    /*
     * 같은 학생·같은 급식일의 기록은 새 행을 계속 만들지 않고
     * 기존 행을 찾아 수정합니다.
     */
    const mealResult = upsertObjectByFields_(
      mealSheet,
      {
        '계정ID': account.accountId,
        '급식일': recordDate,
        '구분': '오늘 급식 성찰'
      },
      {
        '급식성찰ID':
          'MR-' + Utilities.getUuid().replace(/-/g, '')
            .slice(0, 14).toUpperCase(),
        '계정ID': account.accountId,
        '학생코드': account.studentCode,
        '케이스번호': account.caseId,
        '기록일시': now,
        '급식일': recordDate,
        '구분': '오늘 급식 성찰',
        '메뉴': arrayText_(payload.todayMenu),
        '메뉴별경험': clean_(payload.memorableMenu),
        '영향요인': combinedFactors,
        '배고픔점수': numberOrBlank_(payload.hungerBefore),
        '배부름점수': numberOrBlank_(payload.fullnessAfter),
        '선택메뉴': clean_(payload.nextMenuChoice),
        '선택행동': clean_(payload.nextAction),
        '학생약속문장': clean_(payload.promiseSentence),
        '학생발언': combinedStudentStatement,
        '교사메모': combinedTeacherMemo,
        '비고': [
          payload.nextDate
            ? '다음 급식일: ' + clean_(payload.nextDate)
            : '',
          '요청ID: ' + requestId
        ].filter(Boolean).join(' | ')
      },
      ['급식성찰ID']
    );

    let linkResult = null;

    if (linkSheet) {
      linkResult = upsertObjectByFields_(
        linkSheet,
        {
          '계정ID': account.accountId,
          '탐험번호': account.currentJourney,
          '활동명': activityName
        },
        {
          '연계ID':
            'LK-' + Utilities.getUuid().replace(/-/g, '')
              .slice(0, 14).toUpperCase(),
          '계정ID': account.accountId,
          '학생코드': account.studentCode,
          '케이스번호': account.caseId,
          '탐험번호': account.currentJourney,
          '전송일시': now,
          '활동명': activityName,
          '선택카드': [
            clean_(payload.memorableMenu),
            clean_(payload.coreChoice)
          ].filter(Boolean).join(' / '),
          '학생주요발언': combinedStudentStatement,
          '핵심장벽': combinedFactors,
          '선택전략': clean_(payload.nextAction),
          '실천미션': clean_(payload.promiseSentence),
          '자신감': numberOrBlank_(payload.confidence),
          '학생소감': clean_(payload.reflection),
          '다음추천':
            '다음 상담에서 급식 약속의 실행 경험과 몸의 느낌 확인',
          '반영상태': '미반영',
          '반영일시': '',
          '비고': '요청ID: ' + requestId
        },
        ['연계ID']
      );
    }

    return {
      ok: true,
      savedAt: Utilities.formatDate(
        now,
        MEAL_CONFIG.TIMEZONE,
        'yyyy-MM-dd HH:mm:ss'
      ),
      saveMode:
        mealResult.created ? '신규 저장' : '기존 기록 수정',
      duplicatePrevented: !mealResult.created,
      mealRow: mealResult.row,
      linkRow: linkResult ? linkResult.row : ''
    };
  } finally {
    lock.releaseLock();
  }
}
/* ------------------------------------------------------------------
 * 급식 API 내부 함수
 * ------------------------------------------------------------------ */

function getMealJourneyData_(baseDate) {
  const base = startOfDay_(baseDate || new Date());

  // 브라우저에서 성공한 요청과 동일하게 하루씩 조회합니다.
  const todayRows = fetchMealRowsForDate_(base);
  const todayMeals = todayRows.map(normalizeMealRow_).filter(Boolean);
  const today = chooseLunchMeal_(todayMeals);

  let next = null;

  for (let offset = 1; offset <= MEAL_CONFIG.SEARCH_DAYS; offset += 1) {
    const date = new Date(base);
    date.setDate(date.getDate() + offset);

    const rows = fetchMealRowsForDate_(date);
    const normalized = rows.map(normalizeMealRow_).filter(Boolean);
    const meal = chooseLunchMeal_(normalized);

    if (meal) {
      next = meal;
      break;
    }
  }

  return {
    schoolName: MEAL_CONFIG.SCHOOL_NAME,
    baseDate: formatYmd_(base),
    today: today,
    next: next,
    nextLabel: next
      ? (isTomorrow_(base, next.dateKey) ? '내일 급식' : '다음 급식일')
      : '다음 급식일',
    source: 'NEIS mealServiceDietInfo · 단일 날짜 조회'
  };
}

/**
 * 브라우저 주소창에서 성공한 주소와 동일한 인자·순서로 하루만 조회합니다.
 */
function fetchMealRowsForDate_(date) {
  const apiKey = clean_(
    PropertiesService.getScriptProperties()
      .getProperty(MEAL_CONFIG.API_KEY_PROPERTY)
  );

  if (!apiKey) {
    throw new Error(
      '나이스 인증키가 등록되지 않았습니다.\n' +
      'registerNeisApiKey 함수를 실행해 인증키를 등록하세요.'
    );
  }

  const dateKey = Utilities.formatDate(
    date,
    MEAL_CONFIG.TIMEZONE,
    'yyyyMMdd'
  );

  const cache = CacheService.getScriptCache();
  const cacheKey = 'NEIS_MEAL_' + MEAL_CONFIG.SCHOOL_CODE + '_' + dateKey;
  const cached = cache.get(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {}
  }

  /*
   * 사용자가 크롬 주소창에서 성공한 URL 구조와 순서를 그대로 사용합니다.
   * 날짜 범위(MLSV_FROM_YMD / MLSV_TO_YMD)는 사용하지 않습니다.
   */
  const url =
    'https://open.neis.go.kr/hub/mealServiceDietInfo' +
    '?KEY=' + encodeURIComponent(apiKey) +
    '&Type=json' +
    '&pIndex=1' +
    '&pSize=5' +
    '&ATPT_OFCDC_SC_CODE=' + encodeURIComponent(MEAL_CONFIG.OFFICE_CODE) +
    '&SD_SCHUL_CODE=' + encodeURIComponent(MEAL_CONFIG.SCHOOL_CODE) +
    '&MLSV_YMD=' + encodeURIComponent(dateKey);

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      // 나이스가 Google Apps Script 기본 User-Agent를 다르게 처리하는 경우를 대비합니다.
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0 Safari/537.36',
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
    }
  });

  const status = response.getResponseCode();
  const body = response.getContentText('UTF-8');

  if (status < 200 || status >= 300) {
    throw new Error(
      '나이스 급식 단일 날짜 조회에 실패했습니다. HTTP ' + status +
      '\n조회일: ' + dateKey +
      '\n브라우저에서는 성공했지만 Apps Script 요청이 거부되었습니다.' +
      '\n응답: ' + body.slice(0, 260)
    );
  }

  let json;
  try {
    json = JSON.parse(body);
  } catch (error) {
    throw new Error(
      '나이스 응답을 JSON으로 읽지 못했습니다.' +
      '\n조회일: ' + dateKey +
      '\n응답: ' + body.slice(0, 260)
    );
  }

  if (json.RESULT) {
    const code = clean_(json.RESULT.CODE);

    if (code === 'INFO-200') {
      cache.put(cacheKey, JSON.stringify([]), 21600);
      return [];
    }

    throw new Error(
      '나이스 급식 조회 오류: ' +
      clean_(json.RESULT.MESSAGE || json.RESULT.CODE)
    );
  }

  const blocks = json.mealServiceDietInfo || [];
  const rowBlock = blocks.find(block => Array.isArray(block.row));
  const rows = rowBlock ? rowBlock.row : [];

  cache.put(cacheKey, JSON.stringify(rows), 21600);
  return rows;
}

function chooseLunchMeal_(meals) {
  if (!meals || !meals.length) return null;
  return meals.find(item => /중식/.test(item.mealName || '')) || meals[0];
}

/**
 * Apps Script에서 오늘 하루 URL 하나만 정확히 시험합니다.
 */
function testExactDailyMealRequest() {
  const ui = SpreadsheetApp.getUi();
  const today = startOfDay_(new Date());
  const rows = fetchMealRowsForDate_(today);
  const meals = rows.map(normalizeMealRow_).filter(Boolean);
  const meal = chooseLunchMeal_(meals);

  if (!meal) {
    ui.alert(
      '단일 날짜 조회 성공',
      formatYmd_(today) + '\n오늘 등록된 급식이 없습니다.',
      ui.ButtonSet.OK
    );
    return { ok: true, meal: null };
  }

  ui.alert(
    '단일 날짜 조회 성공',
    [
      meal.dateLabel,
      meal.menu.join('\n'),
      meal.calories || ''
    ].join('\n'),
    ui.ButtonSet.OK
  );

  return { ok: true, meal: meal };
}

function normalizeMealRow_(row) {
  const dateKey = clean_(row.MLSV_YMD);
  if (!/^\d{8}$/.test(dateKey)) return null;

  return {
    dateKey: dateKey,
    date: dateKey.slice(0, 4) + '-' + dateKey.slice(4, 6) + '-' + dateKey.slice(6, 8),
    dateLabel: formatKoreanDateKey_(dateKey),
    mealName: clean_(row.MMEAL_SC_NM || '중식'),
    menu: parseMenu_(row.DDISH_NM),
    calories: clean_(row.CAL_INFO),
    nutrition: cleanHtml_(row.NTR_INFO),
    origin: cleanHtml_(row.ORPLC_INFO)
  };
}

function parseMenu_(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .split(/\n+/)
    .map(item => item
      .replace(/\([^)]*\d[^)]*\)/g, '')
      .replace(/\s*\d+(?:\.\d+)*\.?\s*$/g, '')
      .trim())
    .filter(Boolean);
}

function cleanHtml_(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/gi, '&')
    .trim();
}

function formatKoreanDateKey_(key) {
  const date = new Date(
    Number(key.slice(0, 4)),
    Number(key.slice(4, 6)) - 1,
    Number(key.slice(6, 8))
  );

  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return Number(key.slice(4, 6)) + '월 ' +
    Number(key.slice(6, 8)) + '일 (' + weekday + ')';
}

function isTomorrow_(baseDate, dateKey) {
  const tomorrow = new Date(baseDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return Utilities.formatDate(tomorrow, MEAL_CONFIG.TIMEZONE, 'yyyyMMdd') === dateKey;
}

function startOfDay_(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatYmd_(value) {
  return Utilities.formatDate(value, MEAL_CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

/* ------------------------------------------------------------------
 * 학생별 대화 질문과 다음 급식 행동
 * 학생 화면에는 내부 분류명을 전달하지 않습니다.
 * ------------------------------------------------------------------ */

function getMealConversationGuide_(internalArea) {
  const guides = {
    rhythm: {
      studentTitle: '내 몸의 생활 리듬 살펴보기',
      openingQuestions: [
        '급식 전에 배고픔이 0~10 중 어느 정도였나요?',
        '오늘 가장 먼저 먹은 메뉴는 무엇이었나요?',
        '먹는 중간에 배가 차는 느낌을 언제 알아차렸나요?',
        '오늘 오후에 다시 배고플 것 같은 시간은 언제인가요?'
      ],
      coreChoices: [
        '배고픔이 너무 커지는 시간',
        '빨리 먹게 되는 상황',
        '먹는 중간 몸의 느낌',
        '간식과 급식의 연결',
        '영상·친구·시간의 영향'
      ],
      coreQuestions: [
        '가장 최근에 비슷한 일이 있었던 날을 떠올려볼까요?',
        '그날 급식 전에는 언제, 무엇을 먹었나요?',
        '천천히 먹을 수 있었던 날은 무엇이 달랐나요?',
        '배고픔이 너무 커지기 전에 할 수 있는 방법은 무엇일까요?',
        '친구, 시간, 자리, 메뉴 중 가장 큰 영향을 주는 것은 무엇인가요?',
        '선생님이나 가족이 어떤 도움을 주면 더 쉬워질까요?'
      ],
      nextActions: [
        '먹기 전 배고픔 정도를 확인하기',
        '급식 중간에 한 번 수저를 내려놓기',
        '먹는 중간에 몸의 느낌을 확인하기',
        '내가 먹을 양을 먼저 생각해보기',
        '좋아하는 메뉴와 다른 메뉴를 번갈아 살펴보기'
      ]
    },
    strength: {
      studentTitle: '잘 먹고 힘을 내는 방법 찾기',
      openingQuestions: [
        '오늘 가장 편하게 먹은 메뉴는 무엇이었나요?',
        '먹고 싶었지만 시간이나 양 때문에 놓친 메뉴가 있었나요?',
        '처음 받은 양이 부담스럽거나 너무 많지는 않았나요?',
        '오후에 힘이 부족하거나 배고픈 시간은 언제인가요?'
      ],
      coreChoices: [
        '먹을 시간이 부족함',
        '조금만 먹어도 배부름',
        '편하게 먹을 수 있는 음식',
        '급식 전 간식의 영향',
        '냄새·온도·긴장의 영향'
      ],
      coreQuestions: [
        '오늘 가장 편했던 메뉴는 어떤 점 때문에 편했나요?',
        '양을 내가 정할 수 있다면 어느 정도가 부담이 적을까요?',
        '먹을 시간이 조금 더 있었다면 무엇을 더 먹을 수 있었나요?',
        '급식 전에 먹은 음식이나 음료가 점심에 영향을 주었나요?',
        '몸에 힘이 가장 부족하다고 느끼는 시간은 언제인가요?',
        '먹을 기회를 놓치지 않도록 누가 무엇을 도와주면 좋을까요?'
      ],
      nextActions: [
        '가장 편한 메뉴부터 먹기',
        '먹을 수 있는 메뉴 한 가지를 놓치지 않기',
        '부담되지 않는 양으로 시작하고 필요하면 더 받기',
        '급식시간에 먹을 시간을 충분히 사용하기',
        '먹기 어려운 이유를 선생님께 말하기'
      ]
    },
    picky: {
      studentTitle: '음식과 천천히 친해지는 방법 찾기',
      openingQuestions: [
        '오늘 조금 어려웠던 메뉴는 무엇이었나요?',
        '맛·냄새·모양·식감 중 무엇이 가장 영향을 주었나요?',
        '먹기 전부터 어려웠나요, 입에 넣은 뒤 어려웠나요?',
        '보기·도구로 만지기·냄새 맡기 중 어디까지 가능했나요?'
      ],
      coreChoices: [
        '냄새가 강해서 어려움',
        '물컹하거나 질긴 식감',
        '재료가 섞여 있어 불안함',
        '처음 보는 음식이 낯섦',
        '먹으라는 말이 부담됨'
      ],
      coreQuestions: [
        '그 음식은 보기 전부터 어려웠나요, 입안에서 어려웠나요?',
        '같은 재료라도 다른 모양이나 조리법이면 괜찮을까요?',
        '오늘 먹지 않아도 된다면 어디까지 살펴볼 수 있을까요?',
        '예전에 비슷한 음식을 편하게 경험한 적이 있나요?',
        '음식을 따로 놓거나 양을 줄이면 느낌이 달라질까요?',
        '선생님이 어떤 말이나 도움을 주면 부담이 줄어들까요?'
      ],
      nextActions: [
        '어려운 메뉴를 5초 동안 바라보기',
        '숟가락이나 젓가락으로 살짝 건드려보기',
        '냄새까지만 천천히 경험하기',
        '다른 메뉴와 섞지 않고 따로 살펴보기',
        '내가 정한 만큼만 아주 조금 경험하기'
      ]
    },
    allergy: {
      studentTitle: '내 몸을 지키는 음식 안전 확인하기',
      openingQuestions: [
        '오늘 메뉴에서 확인이 필요했던 음식은 무엇이었나요?',
        '알레르기 표시는 어디에서 확인했나요?',
        '먹어도 되는지 헷갈릴 때 누구에게 물었나요?',
        '급식 후 몸에 평소와 다른 느낌은 없었나요?'
      ],
      coreChoices: [
        '알레르기 표시 확인',
        '양념·가공식품 성분 확인',
        '친구 음식과 바꾸어 먹는 상황',
        '교차접촉이 걱정되는 상황',
        '증상을 바로 알리는 방법'
      ],
      coreQuestions: [
        '오늘 확인이 필요했던 메뉴와 알레르기 번호는 무엇이었나요?',
        '먹어도 되는지 확실하지 않을 때 어떤 순서로 확인하나요?',
        '친구가 음식을 나누어 주면 어떤 말로 거절할 수 있을까요?',
        '피부, 입술, 목, 배에 이상한 느낌이 생기면 누구에게 먼저 말하나요?',
        '체험학습이나 학교 밖에서는 무엇을 더 준비해야 할까요?',
        '선생님이 미리 알아야 할 안전정보는 무엇인가요?'
      ],
      nextActions: [
        '먹기 전에 알레르기 표시 확인하기',
        '헷갈리는 메뉴는 먹기 전에 선생님께 묻기',
        '친구와 음식을 바꾸어 먹지 않기',
        '몸이 이상하면 즉시 어른에게 알리기',
        '대체식과 조리도구 구분을 확인하기'
      ]
    },
    growth: {
      studentTitle: '나의 성장 루틴 살펴보기',
      openingQuestions: [
        '오늘 급식에서 몸을 만드는 데 도움을 주는 메뉴는 무엇이었나요?',
        '에너지를 주는 메뉴와 몸을 만드는 메뉴를 찾아볼까요?',
        '오늘 먹기 어려웠거나 놓친 음식 종류가 있었나요?',
        '어제 수면과 오늘 아침식사가 점심 배고픔에 어떤 영향을 주었나요?'
      ],
      coreChoices: [
        '아침식사와 점심의 연결',
        '단백질·칼슘 음식',
        '여러 음식 종류 경험',
        '수면시간과 피로',
        '몸을 움직이는 시간'
      ],
      coreQuestions: [
        '오늘 급식에서 에너지를 주는 음식과 몸을 만드는 음식은 무엇인가요?',
        '아침을 먹은 날과 먹지 않은 날 점심 배고픔은 어떻게 다른가요?',
        '어제 잠든 시간과 오늘 피곤함은 어떤 관계가 있었나요?',
        '키에 좋은 특별한 음식 하나보다 중요한 생활습관은 무엇일까요?',
        '먹기 편한 음식 외에 오늘 살펴본 다른 음식은 무엇인가요?',
        '이번 주에 식사·수면·활동 중 가장 바꾸기 쉬운 것은 무엇인가요?'
      ],
      nextActions: [
        '몸을 만드는 단백질 메뉴 한 가지 찾아보기',
        '칼슘을 주는 음식이 있는지 확인하기',
        '서로 다른 식품 종류를 네 가지 이상 찾아보기',
        '먹기 편한 메뉴 외의 다른 메뉴도 살펴보기',
        '급식과 아침식사·수면을 함께 떠올려보기'
      ]
    },
    common: {
      studentTitle: '오늘의 맛마음 알아보기',
      openingQuestions: [
        '오늘 가장 기억에 남은 메뉴는 무엇이었나요?',
        '먹기 편했던 메뉴와 조금 어려웠던 메뉴는 무엇이었나요?',
        '급식 전과 후에 몸의 느낌이 어떻게 달라졌나요?',
        '오늘 급식에서 다시 해보고 싶은 것은 무엇인가요?'
      ],
      coreChoices: [
        '맛과 냄새',
        '식감과 모양',
        '배고픔과 배부름',
        '먹는 시간과 분위기',
        '도움이 필요한 상황'
      ],
      coreQuestions: [
        '오늘 급식에서 가장 편안했던 순간은 언제였나요?',
        '조금 어려웠던 순간에는 어떤 일이 있었나요?',
        '다른 날에는 같은 메뉴가 더 편했던 적이 있나요?',
        '내 몸의 느낌을 잘 알아차린 순간은 언제였나요?',
        '다음에는 무엇을 다르게 해보고 싶나요?',
        '누가 어떤 도움을 주면 더 쉬워질까요?'
      ],
      nextActions: [
        '가장 기억에 남는 메뉴의 느낌 말해보기',
        '먹는 중간에 내 몸의 느낌 확인하기',
        '궁금한 메뉴 한 가지를 자세히 살펴보기',
        '먹기 어려우면 그 이유를 선생님께 말하기',
        '내가 할 수 있는 작은 행동 한 가지 정하기'
      ]
    }
  };

  return guides[internalArea] || guides.common;
}
/* ------------------------------------------------------------------
 * 로그인 세션
 * ------------------------------------------------------------------ */

function createExplorerSession_(caseId, accountId) {
  const token = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(
    'EXPLORER_SESSION_' + token,
    JSON.stringify({ caseId: caseId, accountId: accountId, createdAt: Date.now() }),
    7200
  );
  return token;
}

function getExplorerSession_(token) {
  const cleanToken = clean_(token);
  if (!cleanToken) throw new Error('로그인 시간이 만료되었습니다. 다시 입장하세요.');

  const raw = CacheService.getScriptCache().get('EXPLORER_SESSION_' + cleanToken);
  if (!raw) throw new Error('로그인 시간이 만료되었습니다. 다시 입장하세요.');

  return JSON.parse(raw);
}

/* ------------------------------------------------------------------
 * 저장 도우미
 * ------------------------------------------------------------------ */

/**
 * 여러 기준값이 모두 같은 행을 찾아 갱신하고, 없으면 새 행을 추가합니다.
 */
function upsertObjectByFields_(sheet, criteria, patch, preserveHeaders) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(clean_);
  const preserve = new Set(preserveHeaders || []);

  let targetRow = -1;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const matched = Object.keys(criteria).every(header => {
      const colIndex = headers.indexOf(header);
      if (colIndex < 0) return false;

      return comparableCell_(values[rowIndex][colIndex]) ===
        comparableCell_(criteria[header]);
    });

    if (matched) {
      targetRow = rowIndex + 1;
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

  const newRow = headers.map(header =>
    Object.prototype.hasOwnProperty.call(patch, header)
      ? patch[header]
      : ''
  );

  sheet.appendRow(newRow);

  return { created: true, row: sheet.getLastRow() };
}

function comparableCell_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(
      value,
      MEAL_CONFIG.TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  return clean_(value);
}

/**
 * 기존 시험 중 생긴 중복행을 한 번 정리합니다.
 * 같은 학생·같은 급식일 기록은 가장 아래의 최신 행 하나만 남깁니다.
 */
function cleanupDuplicateMealConversationRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mealSheet = ss.getSheetByName(EXPLORER_CONFIG.SHEETS.MEALS);
  const linkSheet = ss.getSheetByName(EXPLORER_CONFIG.SHEETS.LINK);

  const mealRemoved = mealSheet
    ? removeDuplicateRowsByHeaders_(
        mealSheet,
        ['계정ID', '급식일', '구분']
      )
    : 0;

  const linkRemoved = linkSheet
    ? removeDuplicateRowsByHeaders_(
        linkSheet,
        ['계정ID', '탐험번호', '활동명']
      )
    : 0;

  SpreadsheetApp.getUi().alert(
    '중복 기록 정리 완료',
    [
      '급식성찰 삭제: ' + mealRemoved + '행',
      '매니저연계 삭제: ' + linkRemoved + '행',
      '',
      '각 기록의 가장 아래 최신 행은 유지했습니다.'
    ].join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return {
    ok: true,
    mealRemoved: mealRemoved,
    linkRemoved: linkRemoved
  };
}

function removeDuplicateRowsByHeaders_(sheet, keyHeaders) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 2) return 0;

  const headers = values[0].map(clean_);
  const keyIndexes = keyHeaders.map(header => headers.indexOf(header));

  if (keyIndexes.some(index => index < 0)) {
    throw new Error(
      sheet.getName() +
      ' 시트에서 중복 확인 열을 찾지 못했습니다.'
    );
  }

  const seen = new Set();
  const deleteRows = [];

  // 아래쪽 최신 행을 남기기 위해 끝에서부터 확인합니다.
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const key = keyIndexes
      .map(index => comparableCell_(values[rowIndex][index]))
      .join('||');

    if (!key.replace(/\|/g, '')) continue;

    if (seen.has(key)) deleteRows.push(rowIndex + 1);
    else seen.add(key);
  }

  deleteRows
    .sort((a, b) => b - a)
    .forEach(row => sheet.deleteRow(row));

  return deleteRows.length;
}

function appendObject_(sheet, object) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(clean_);

  const row = headers.map(header =>
    Object.prototype.hasOwnProperty.call(object, header) ? object[header] : ''
  );

  sheet.appendRow(row);
}

function arrayText_(value) {
  if (Array.isArray(value)) return value.map(clean_).filter(Boolean).join(' / ');
  return clean_(value);
}

function numberOrBlank_(value) {
  const number = Number(value);
  return value === '' || value === null || value === undefined || !isFinite(number)
    ? ''
    : number;
}
