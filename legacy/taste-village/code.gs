/**
 * 맛마음 탐험소 1단계
 * - 전용 데이터 시트 자동 설치
 * - AI 영양상담 매니저 연결
 * - 학생/상담케이스 자동 동기화
 * - 학생별 4자리 탐험코드 자동 발급
 *
 * 이 코드는 다음 스프레드시트에 바인딩하여 사용합니다.
 * https://docs.google.com/spreadsheets/d/1ZpjQDdLz0t6UtIAQlDmMg6RMNf9E7TALxRndM5NITus/
 */

const EXPLORER_CONFIG = {
  VERSION: '7.0.0',
  EXPECTED_SPREADSHEET_ID: '1ZpjQDdLz0t6UtIAQlDmMg6RMNf9E7TALxRndM5NITus',
  TIMEZONE: 'Asia/Seoul',
  MANAGER_ID_PROPERTY: 'MANAGER_SPREADSHEET_ID',
  SHEETS: {
    SETTINGS: '설정',
    ACCOUNTS: '학생계정',
    ACTIVITIES: '회기활동',
    MEALS: '급식성찰',
    MISSIONS: '실천미션',
    CHECKS: '미션점검',
    STICKERS: '스티커북',
    LINK: '매니저연계'
  }
};

const EXPLORER_HEADERS = {
  '설정': [
    '설정키','설정값','설명','수정일'
  ],
  '학생계정': [
    '계정ID','학생코드','케이스번호','학년도','학년','반','번호','학생명',
    '탐험가별명','탐험코드','접속토큰',
    '내부상담영역','학생표시활동','현재탐험',
    '매니저현재단계','최근실천목표','최근동기화',
    '계정상태','코드발급일','코드재발급일','최근접속','비고'
  ],
  '회기활동': [
    '활동ID','계정ID','학생코드','케이스번호','탐험번호','활동일시',
    '활동구분','활동명','선택카드','학생주요발언','핵심장벽',
    '선택전략','학생소감','교사메모','완료상태','비고'
  ],
  '급식성찰': [
    '급식성찰ID','계정ID','학생코드','케이스번호','기록일시','급식일',
    '구분','메뉴','메뉴별경험','영향요인','배고픔점수','배부름점수',
    '선택메뉴','선택행동','학생약속문장','학생발언','교사메모','비고'
  ],
  '실천미션': [
    '미션ID','계정ID','학생코드','케이스번호','탐험번호','생성일',
    '미션문장','언제','어디서','목표횟수','도움받을사람','확인방법',
    '자신감','시작일','종료일','상태','종료일시','비고'
  ],
  '미션점검': [
    '점검ID','미션ID','계정ID','학생코드','케이스번호','점검일시',
    '실천결과','실제횟수','어려움','도움요인','학생소감',
    '다음결정','다음미션','비고'
  ],
  '스티커북': [
    '획득ID','계정ID','학생코드','케이스번호','스티커ID','스티커명',
    '획득일시','획득이유','비고'
  ],
  '매니저연계': [
    '연계ID','계정ID','학생코드','케이스번호','탐험번호','전송일시',
    '활동명','선택카드','학생주요발언','핵심장벽','선택전략',
    '실천미션','자신감','학생소감','다음추천','반영상태','반영일시','비고'
  ]
};

const STUDENT_ACTIVITY_LABELS = {
  rhythm: '내 몸의 생활 리듬 찾기',
  strength: '잘 먹고 힘 키우기',
  picky: '음식과 천천히 친해지기',
  allergy: '내 몸을 지키는 음식 안전',
  growth: '나의 성장 루틴 만들기',
  common: '나의 맛마음 알아보기'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('맛마음 탐험소 설정')
    .addItem('1. 초기 설치', 'installTasteMindExplorer')
    .addSeparator()
    .addItem('2. AI 영양상담 매니저 연결', 'registerManagerSpreadsheet')
    .addItem('3. 매니저 연결 확인', 'testManagerConnection')
    .addItem('4. 학생 자동 동기화', 'syncManagerStudents')
    .addSeparator()
    .addItem('탐험코드 재발급', 'regenerateExplorerCodePrompt')
    .addItem('연결정보 확인', 'showExplorerConnectionInfo')
    .addToUi();
}

/**
 * 1단계: 탐험소 데이터 시트를 자동으로 만듭니다.
 */
function installTasteMindExplorer() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (ss.getId() !== EXPLORER_CONFIG.EXPECTED_SPREADSHEET_ID) {
    throw new Error(
      '이 코드는 지정된 “맛마음 탐험소 데이터” 스프레드시트에서 실행해야 합니다.\n' +
      '현재 문서 ID: ' + ss.getId()
    );
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    Object.keys(EXPLORER_HEADERS).forEach(sheetName => {
      ensureSheet_(ss, sheetName, EXPLORER_HEADERS[sheetName]);
    });

    setSetting_('SYSTEM_VERSION', EXPLORER_CONFIG.VERSION, '맛마음 탐험소 데이터 구조 버전');
    setSetting_('EXPLORER_SPREADSHEET_ID', ss.getId(), '탐험소 전용 스프레드시트 ID');
    setSetting_('SCHOOL_NAME', '구미봉곡초등학교', '학교명');
    setSetting_('SYNC_STATUS', '설치 완료 · 매니저 연결 필요', '최근 동기화 상태');
    setSetting_('LAST_SYNC_AT', '', '최근 학생 동기화 일시');
    setSetting_('EXPLORER_WEB_APP_URL', '', '학생용 웹앱 배포주소 · 추후 입력');
    setSetting_('NEIS_OFFICE_CODE', '', '나이스 교육청 코드 · 급식연계 단계에서 입력');
    setSetting_('NEIS_SCHOOL_CODE', '', '나이스 학교코드 · 급식연계 단계에서 입력');

    removeBlankDefaultSheet_(ss);
    organizeSheets_(ss);

    ui.alert(
      '맛마음 탐험소 초기 설치 완료',
      [
        '다음 시트가 준비되었습니다.',
        '',
        '설정 · 학생계정 · 회기활동 · 급식성찰',
        '실천미션 · 미션점검 · 스티커북 · 매니저연계',
        '',
        '다음으로 메뉴에서',
        '“2. AI 영양상담 매니저 연결”을 실행하세요.'
      ].join('\n'),
      ui.ButtonSet.OK
    );

    return { ok: true, spreadsheetId: ss.getId() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 기존 AI 영양상담 매니저 스프레드시트 URL 또는 ID를 등록합니다.
 */
function registerManagerSpreadsheet() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    'AI 영양상담 매니저 연결',
    [
      '현재 사용 중인 AI 영양상담 매니저의',
      '구글 스프레드시트 주소 전체 또는 문서 ID를 붙여넣으세요.',
      '',
      '웹앱 실행주소(script.google.com)가 아니라',
      '데이터가 저장된 docs.google.com/spreadsheets 주소입니다.'
    ].join('\n'),
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const managerId = extractSpreadsheetId_(response.getResponseText());
  if (!managerId) {
    ui.alert('스프레드시트 ID를 찾지 못했습니다. 주소를 다시 확인하세요.');
    return;
  }

  const check = validateManagerSpreadsheet_(managerId);

  PropertiesService.getScriptProperties()
    .setProperty(EXPLORER_CONFIG.MANAGER_ID_PROPERTY, managerId);

  setSetting_('MANAGER_SPREADSHEET_ID', managerId, 'AI 영양상담 매니저 스프레드시트 ID');
  setSetting_('MANAGER_SPREADSHEET_NAME', check.name, '연결된 매니저 문서명');
  setSetting_('SYNC_STATUS', '매니저 연결 완료 · 학생 동기화 필요', '최근 동기화 상태');

  ui.alert(
    '매니저 연결 완료',
    [
      '문서명: ' + check.name,
      '학생정보: ' + check.studentCount + '명',
      '상담케이스: ' + check.caseCount + '건',
      '',
      '이제 메뉴에서',
      '“4. 학생 자동 동기화”를 실행하세요.'
    ].join('\n'),
    ui.ButtonSet.OK
  );
}

/**
 * 매니저 문서 접근과 필수 시트를 확인합니다.
 */
function testManagerConnection() {
  const ui = SpreadsheetApp.getUi();
  const managerId = getManagerSpreadsheetId_();
  const result = validateManagerSpreadsheet_(managerId);

  ui.alert(
    '연결 확인 완료',
    [
      '문서명: ' + result.name,
      '학생정보: ' + result.studentCount + '명',
      '상담케이스: ' + result.caseCount + '건',
      '필수 시트: 정상',
      '',
      '탐험소에서 매니저 학생정보를 읽을 수 있습니다.'
    ].join('\n'),
    ui.ButtonSet.OK
  );

  return result;
}

/**
 * 매니저의 학생·케이스·최근 목표를 탐험소 학생계정으로 자동 동기화합니다.
 */
function syncManagerStudents() {
  const ui = SpreadsheetApp.getUi();
  const explorerSS = SpreadsheetApp.getActiveSpreadsheet();
  const managerSS = SpreadsheetApp.openById(getManagerSpreadsheetId_());

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const students = getObjectsFromSpreadsheet_(managerSS, '학생정보');
    const cases = getObjectsFromSpreadsheet_(managerSS, '상담케이스');
    const consents = getObjectsFromSpreadsheetOptional_(managerSS, '보호자동의');
    const diagnoses = getObjectsFromSpreadsheetOptional_(managerSS, '진단결과');
    const goals = getObjectsFromSpreadsheetOptional_(managerSS, '실천목표');
    const preps = getObjectsFromSpreadsheetOptional_(managerSS, '다음회기준비');

    const studentMap = {};
    students.forEach(row => {
      const key = clean_(row['학생코드']);
      if (key) studentMap[key] = row;
    });

    const consentMap = {};
    consents.forEach(row => {
      const key = clean_(row['케이스번호']);
      if (key) consentMap[key] = row;
    });

    const latestDiagnosis = latestByCase_(diagnoses, ['검사일', '검사차수']);
    const latestGoal = latestByCase_(goals, ['시작일', '목표ID']);
    const latestPrep = latestByCase_(preps, ['생성일', '준비회기']);

    const accountSheet = explorerSS.getSheetByName(EXPLORER_CONFIG.SHEETS.ACCOUNTS);
    const mealSheet = explorerSS.getSheetByName(EXPLORER_CONFIG.SHEETS.MEALS);
    const missionSheet = explorerSS.getSheetByName(EXPLORER_CONFIG.SHEETS.MISSIONS);

    if (!accountSheet || !mealSheet || !missionSheet) {
      throw new Error('먼저 “1. 초기 설치”를 실행하세요.');
    }

    const existingRows = getObjects_(accountSheet);
    const existingByCase = {};
    existingRows.forEach(row => {
      const caseId = clean_(row['케이스번호']);
      if (caseId) existingByCase[caseId] = row;
    });

    const existingCodes = new Set(
      existingRows.map(row => clean_(row['탐험코드'])).filter(Boolean)
    );

    const completedByCase = countCompletedMealSessionsByCase_(
      getObjects_(mealSheet)
    );

    const now = new Date();
    let created = 0;
    let updated = 0;
    let closed = 0;
    let skipped = 0;

    cases.forEach(caseRow => {
      const caseId = clean_(caseRow['케이스번호']);
      const studentCode = clean_(caseRow['학생코드']);

      if (!caseId || !studentCode) {
        skipped += 1;
        return;
      }

      const student = studentMap[studentCode];
      if (!student) {
        skipped += 1;
        return;
      }

      const consent = consentMap[caseId] || {};
      const existing = existingByCase[caseId] || null;
      const managerStatus = clean_(caseRow['현재단계']);
      const assent = clean_(consent['학생참여의사']);
      const consentComplete = clean_(consent['확인상태']) === '동의 완료';
      const shouldClose = managerStatus === '종결' || assent === '참여하지 않음';
      const eligible = consentComplete && assent === '참여 희망' && !shouldClose;

      if (!existing && !eligible) {
        skipped += 1;
        return;
      }

      const diagnosis = latestDiagnosis[caseId] || {};
      const goal = latestGoal[caseId] || {};
      const prep = latestPrep[caseId] || {};

      const managerTopic =
        clean_(prep['상담영역']) ||
        clean_(caseRow['주상담주제']) ||
        inferTopicFromDiagnosis_(diagnosis);

      const area = normalizeInternalArea_(managerTopic, diagnosis);

      let explorerCode = existing ? clean_(existing['탐험코드']) : '';
      if (!explorerCode) {
        explorerCode = generateUniqueExplorerCode_(existingCodes);
        existingCodes.add(explorerCode);
      }

      const accountId = existing && clean_(existing['계정ID'])
        ? clean_(existing['계정ID'])
        : 'EX-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();

      const alias = existing && clean_(existing['탐험가별명'])
        ? clean_(existing['탐험가별명'])
        : makeExplorerAlias_(studentCode + '|' + caseId);

      const token = existing && clean_(existing['접속토큰'])
        ? clean_(existing['접속토큰'])
        : Utilities.getUuid().replace(/-/g, '');

      const completed = Math.min(5, Number(completedByCase[caseId] || 0));
      const journey = completed >= 5 ? 5 : completed + 1;
      const managerGoal = clean_(goal['목표문장']);
      const missionText = managerGoal ||
        (existing ? clean_(existing['최근실천목표']) : '');

      const accountStatus = shouldClose ? '종결' : '사용 중';

      upsertObjectByKey_(accountSheet, '케이스번호', caseId, {
        '계정ID': accountId,
        '학생코드': studentCode,
        '케이스번호': caseId,
        '학년도': student['학년도'] || '',
        '학년': student['학년'] || '',
        '반': student['반'] || '',
        '번호': student['번호'] || '',
        '학생명': student['학생명'] || '',
        '탐험가별명': alias,
        '탐험코드': explorerCode,
        '접속토큰': token,
        '내부상담영역': area,
        '학생표시활동': STUDENT_ACTIVITY_LABELS[area] || STUDENT_ACTIVITY_LABELS.common,
        '현재탐험': journey,
        '매니저현재단계': managerStatus,
        '최근실천목표': missionText,
        '최근동기화': now,
        '계정상태': accountStatus,
        '코드발급일': existing ? existing['코드발급일'] : now,
        '코드재발급일': existing ? existing['코드재발급일'] : '',
        '최근접속': existing ? existing['최근접속'] : '',
        '비고': existing ? existing['비고'] : '매니저 동기화 생성'
      });

      if (managerGoal && accountStatus === '사용 중') {
        syncManagerGoalToExplorerMissionLocal_(missionSheet, {
          accountId: accountId,
          studentCode: studentCode,
          caseId: caseId,
          journey: journey,
          text: managerGoal,
          targetCount: goal['목표횟수'] || '',
          startDate: goal['시작일'] || now,
          endDate: goal['종료일'] || '',
          checkMethod: goal['확인방법'] || '다음 상담에서 확인'
        });
      }

      if (shouldClose) {
        closeExplorerMissionsLocal_(missionSheet, caseId);
        closed += 1;
      }

      if (existing) updated += 1;
      else created += 1;
    });

    setSetting_(
      'LAST_SYNC_AT',
      formatDateTime_(now),
      '최근 학생 동기화 일시'
    );

    setSetting_(
      'SYNC_STATUS',
      '완료 · 신규 ' + created +
      '명 / 갱신 ' + updated +
      '명 / 종결 ' + closed +
      '명 / 제외 ' + skipped + '건',
      '최근 동기화 상태'
    );

    sortAccountSheet_(accountSheet);

    ui.alert(
      '학생 자동 동기화 완료',
      [
        '새 계정 생성: ' + created + '명',
        '기존 계정 갱신: ' + updated + '명',
        '종결 처리: ' + closed + '명',
        '조건 미충족·자료 부족 제외: ' + skipped + '건',
        '',
        '새 계정은 보호자 동의 완료 + 학생 참여 희망인 경우에만 생성됩니다.',
        '현재탐험은 탐험소의 실제 급식성찰 완료일 수를 기준으로 계산됩니다.'
      ].join('\n'),
      ui.ButtonSet.OK
    );

    return {
      ok: true,
      created: created,
      updated: updated,
      closed: closed,
      skipped: skipped
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 특정 상담케이스의 탐험코드를 교사가 재발급합니다.
 */
function regenerateExplorerCodePrompt() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '탐험코드 재발급',
    '코드를 다시 발급할 상담케이스번호를 입력하세요.\n예: NC-2026-0001',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const caseId = clean_(response.getResponseText());
  if (!caseId) return;

  const result = regenerateExplorerCode(caseId);

  ui.alert(
    '탐험코드 재발급 완료',
    [
      '학생: ' + result.studentName,
      '케이스번호: ' + result.caseId,
      '새 탐험코드: ' + result.explorerCode,
      '',
      '기존 코드는 더 이상 사용할 수 없습니다.'
    ].join('\n'),
    ui.ButtonSet.OK
  );
}

function regenerateExplorerCode(caseId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(EXPLORER_CONFIG.SHEETS.ACCOUNTS);
  if (!sheet) throw new Error('학생계정 시트가 없습니다.');

  const rows = getObjects_(sheet);
  const target = rows.find(row => clean_(row['케이스번호']) === clean_(caseId));
  if (!target) throw new Error('해당 상담케이스의 탐험소 계정을 찾지 못했습니다.');

  const used = new Set(
    rows
      .filter(row => clean_(row['케이스번호']) !== clean_(caseId))
      .map(row => clean_(row['탐험코드']))
      .filter(Boolean)
  );

  const newCode = generateUniqueExplorerCode_(used);

  upsertObjectByKey_(sheet, '케이스번호', caseId, {
    '탐험코드': newCode,
    '접속토큰': Utilities.getUuid().replace(/-/g, ''),
    '코드재발급일': new Date()
  });

  return {
    ok: true,
    caseId,
    studentName: target['학생명'] || '',
    explorerCode: newCode
  };
}

function showExplorerConnectionInfo() {
  const ui = SpreadsheetApp.getUi();
  const settings = getSettingsMap_();
  const managerId =
    PropertiesService.getScriptProperties()
      .getProperty(EXPLORER_CONFIG.MANAGER_ID_PROPERTY) || '';

  ui.alert(
    '맛마음 탐험소 연결정보',
    [
      '탐험소 문서 ID',
      SpreadsheetApp.getActiveSpreadsheet().getId(),
      '',
      '매니저 문서 ID',
      managerId || '아직 등록하지 않음',
      '',
      '최근 동기화',
      settings.LAST_SYNC_AT || '아직 실행하지 않음',
      '',
      '상태',
      settings.SYNC_STATUS || ''
    ].join('\n'),
    ui.ButtonSet.OK
  );
}

/* ------------------------------------------------------------------
 * 아래 함수는 다음 단계의 학생용 웹앱과 매니저 화면에서 함께 사용합니다.
 * ------------------------------------------------------------------ */

function getExplorerAccountByCaseId(caseId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(EXPLORER_CONFIG.SHEETS.ACCOUNTS);
  if (!sheet) throw new Error('학생계정 시트가 없습니다.');

  const row = getObjects_(sheet)
    .find(item => clean_(item['케이스번호']) === clean_(caseId));

  if (!row) return null;

  return toClient_({
    accountId: row['계정ID'] || '',
    studentCode: row['학생코드'] || '',
    caseId: row['케이스번호'] || '',
    grade: row['학년'] || '',
    classNo: row['반'] || '',
    studentNo: row['번호'] || '',
    studentName: row['학생명'] || '',
    alias: row['탐험가별명'] || '',
    explorerCode: row['탐험코드'] || '',
    internalArea: row['내부상담영역'] || 'common',
    studentActivityLabel: row['학생표시활동'] || STUDENT_ACTIVITY_LABELS.common,
    currentJourney: row['현재탐험'] || 1,
    managerStatus: row['매니저현재단계'] || '',
    currentMission: row['최근실천목표'] || '',
    accountStatus: row['계정상태'] || '',
    lastSyncAt: formatDateTime_(row['최근동기화']),
    lastAccessAt: formatDateTime_(row['최근접속'])
  });
}

function verifyStudentExplorerLogin(payload) {
  payload = payload || {};
  const grade = clean_(payload.grade);
  const classNo = clean_(payload.classNo);
  const name = normalizeName_(payload.studentName);
  const code = clean_(payload.explorerCode);

  if (!grade || !classNo || !name || !code) {
    throw new Error('학년·반·이름·탐험코드를 모두 입력하세요.');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(EXPLORER_CONFIG.SHEETS.ACCOUNTS);
  const rows = getObjects_(sheet);

  const matched = rows.find(row =>
    clean_(row['학년']) === grade &&
    clean_(row['반']) === classNo &&
    normalizeName_(row['학생명']) === name &&
    clean_(row['탐험코드']) === code &&
    clean_(row['계정상태']) !== '종결'
  );

  if (!matched) {
    return { ok: false, message: '입력한 정보나 탐험코드를 다시 확인해 주세요.' };
  }

  updateCellByKey_(sheet, '케이스번호', matched['케이스번호'], '최근접속', new Date());

  return {
    ok: true,
    account: getExplorerAccountByCaseId(matched['케이스번호'])
  };
}

/* ------------------------------------------------------------------
 * 내부 도우미
 * ------------------------------------------------------------------ */

function validateManagerSpreadsheet_(managerId) {
  let ss;
  try {
    ss = SpreadsheetApp.openById(managerId);
  } catch (error) {
    throw new Error(
      'AI 영양상담 매니저 스프레드시트를 열 수 없습니다.\n' +
      '현재 Google 계정에 해당 문서의 편집 권한이 있는지 확인하세요.\n\n' +
      error.message
    );
  }

  const required = ['학생정보', '상담케이스'];
  const missing = required.filter(name => !ss.getSheetByName(name));
  if (missing.length) {
    throw new Error('매니저 문서에서 필수 시트를 찾지 못했습니다: ' + missing.join(', '));
  }

  return {
    ok: true,
    id: ss.getId(),
    name: ss.getName(),
    studentCount: getObjectsFromSpreadsheet_(ss, '학생정보').length,
    caseCount: getObjectsFromSpreadsheet_(ss, '상담케이스').length
  };
}

function getManagerSpreadsheetId_() {
  const value = PropertiesService.getScriptProperties()
    .getProperty(EXPLORER_CONFIG.MANAGER_ID_PROPERTY);

  if (!value) {
    throw new Error(
      'AI 영양상담 매니저가 아직 연결되지 않았습니다.\n' +
      '상단 메뉴 “맛마음 탐험소 설정 → 2. AI 영양상담 매니저 연결”을 먼저 실행하세요.'
    );
  }
  return value;
}

function ensureSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(value => clean_(value));

  if (existing.every(value => !value)) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    let nextCol = existing.length + 1;
    headers.forEach(header => {
      if (!existing.includes(header)) {
        sheet.getRange(1, nextCol).setValue(header);
        existing.push(header);
        nextCol += 1;
      }
    });
  }

  styleSheet_(sheet);
  return sheet;
}

function styleSheet_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const maxRows = Math.max(sheet.getMaxRows(), 2);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastCol)
    .setBackground('#1F4E78')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  sheet.setRowHeight(1, 36);
  sheet.getRange(2, 1, maxRows - 1, lastCol)
    .setVerticalAlignment('middle');

  sheet.autoResizeColumns(1, lastCol);

  for (let col = 1; col <= lastCol; col += 1) {
    const width = sheet.getColumnWidth(col);
    sheet.setColumnWidth(col, Math.min(Math.max(width, 90), 240));
  }

  if (sheet.getFilter()) sheet.getFilter().remove();
  if (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), sheet.getLastColumn())
      .createFilter();
  }
}

function organizeSheets_(ss) {
  const order = Object.values(EXPLORER_CONFIG.SHEETS);
  order.forEach((name, index) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(index + 1);
  });

  const colors = {
    '설정': '#7F8C8D',
    '학생계정': '#4F81BD',
    '회기활동': '#2E75B6',
    '급식성찰': '#2E75B6',
    '실천미션': '#70AD47',
    '미션점검': '#70AD47',
    '스티커북': '#8064A2',
    '매니저연계': '#ED7D31'
  };

  order.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && colors[name]) sheet.setTabColor(colors[name]);
  });

  const accountSheet = ss.getSheetByName(EXPLORER_CONFIG.SHEETS.ACCOUNTS);
  if (accountSheet) ss.setActiveSheet(accountSheet);
}

function removeBlankDefaultSheet_(ss) {
  const sheet = ss.getSheetByName('시트1');
  if (!sheet || ss.getSheets().length <= 1) return;

  const values = sheet.getDataRange().getDisplayValues();
  const hasValue = values.some(row => row.some(value => clean_(value)));
  if (!hasValue) ss.deleteSheet(sheet);
}

function setSetting_(key, value, description) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(EXPLORER_CONFIG.SHEETS.SETTINGS);
  if (!sheet) throw new Error('설정 시트가 없습니다.');

  upsertObjectByKey_(sheet, '설정키', key, {
    '설정키': key,
    '설정값': value,
    '설명': description || '',
    '수정일': new Date()
  });
}

function getSettingsMap_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(EXPLORER_CONFIG.SHEETS.SETTINGS);
  if (!sheet) return {};

  const result = {};
  getObjects_(sheet).forEach(row => {
    result[clean_(row['설정키'])] = row['설정값'];
  });
  return result;
}

function getObjectsFromSpreadsheet_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('필수 시트가 없습니다: ' + sheetName);
  return getObjects_(sheet);
}

function getObjectsFromSpreadsheetOptional_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  return sheet ? getObjects_(sheet) : [];
}

function getObjects_(sheet) {
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(value => clean_(value));

  return values.slice(1)
    .filter(row => row.some(value => value !== '' && value !== null))
    .map(row => {
      const object = {};
      headers.forEach((header, index) => {
        if (header) object[header] = row[index];
      });
      return object;
    });
}

function upsertObjectByKey_(sheet, keyHeader, keyValue, patch) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(value => clean_(value));
  const keyCol = headers.indexOf(keyHeader);

  if (keyCol < 0) {
    throw new Error(sheet.getName() + ' 시트에 키 열이 없습니다: ' + keyHeader);
  }

  let targetRow = -1;
  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (clean_(data[rowIndex][keyCol]) === clean_(keyValue)) {
      targetRow = rowIndex + 1;
      break;
    }
  }

  const oldRow = targetRow > 0 ? data[targetRow - 1] : [];
  const nextRow = headers.map((header, index) => {
    return Object.prototype.hasOwnProperty.call(patch, header)
      ? patch[header]
      : (targetRow > 0 ? oldRow[index] : '');
  });

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([nextRow]);
  } else {
    sheet.appendRow(nextRow);
  }
}

function updateCellByKey_(sheet, keyHeader, keyValue, targetHeader, value) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(item => clean_(item));
  const keyCol = headers.indexOf(keyHeader);
  const targetCol = headers.indexOf(targetHeader);

  if (keyCol < 0 || targetCol < 0) {
    throw new Error('학생계정 시트의 열 구조를 확인하세요.');
  }

  for (let rowIndex = 1; rowIndex < data.length; rowIndex += 1) {
    if (clean_(data[rowIndex][keyCol]) === clean_(keyValue)) {
      sheet.getRange(rowIndex + 1, targetCol + 1).setValue(value);
      return;
    }
  }
}

function latestByCase_(rows, sortHeaders) {
  const grouped = {};

  rows.forEach(row => {
    const caseId = clean_(row['케이스번호']);
    if (!caseId) return;

    if (!grouped[caseId]) {
      grouped[caseId] = row;
      return;
    }

    if (compareRows_(row, grouped[caseId], sortHeaders) > 0) {
      grouped[caseId] = row;
    }
  });

  return grouped;
}

function compareRows_(a, b, headers) {
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const av = comparableValue_(a[header]);
    const bv = comparableValue_(b[header]);
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

function comparableValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? 0 : value.getTime();
  }

  const date = new Date(value);
  if (value && !isNaN(date.getTime()) && /[-/.]/.test(String(value))) {
    return date.getTime();
  }

  const number = Number(value);
  if (value !== '' && isFinite(number)) return number;

  return String(value || '');
}

function countByCase_(rows) {
  const result = {};
  rows.forEach(row => {
    const caseId = clean_(row['케이스번호']);
    if (!caseId) return;
    result[caseId] = (result[caseId] || 0) + 1;
  });
  return result;
}

function countCompletedMealSessionsByCase_(rows) {
  const sets = {};

  (rows || []).forEach(row => {
    const caseId = clean_(row['케이스번호']);
    const dateKey = explorerLocalDateKey_(row['급식일'] || row['기록일시']);
    if (!caseId || !dateKey) return;

    if (!sets[caseId]) sets[caseId] = new Set();
    sets[caseId].add(dateKey);
  });

  const result = {};
  Object.keys(sets).forEach(caseId => {
    result[caseId] = Math.min(5, sets[caseId].size);
  });
  return result;
}

function explorerLocalDateKey_(value) {
  if (!value) return '';

  const date = Object.prototype.toString.call(value) === '[object Date]'
    ? value
    : new Date(value);

  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, EXPLORER_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  const digits = clean_(value).replace(/[^0-9]/g, '');
  return digits.length >= 8
    ? digits.slice(0, 4) + '-' + digits.slice(4, 6) + '-' + digits.slice(6, 8)
    : '';
}

function syncManagerGoalToExplorerMissionLocal_(sheet, payload) {
  const rows = getObjects_(sheet);
  const active = rows.filter(row =>
    clean_(row['케이스번호']) === clean_(payload.caseId) &&
    clean_(row['상태']) === '진행 중'
  );

  const same = active.find(row =>
    clean_(row['미션문장']) === clean_(payload.text)
  );

  if (same) {
    upsertObjectByKey_(sheet, '미션ID', same['미션ID'], {
      '미션ID': same['미션ID'],
      '탐험번호': payload.journey,
      '목표횟수': payload.targetCount,
      '확인방법': payload.checkMethod,
      '시작일': payload.startDate,
      '종료일': payload.endDate,
      '비고': [
        clean_(same['비고']),
        '매니저 목표 동기화'
      ].filter(Boolean).join(' | ')
    });
    return same['미션ID'];
  }

  const now = new Date();

  active.forEach(row => {
    upsertObjectByKey_(sheet, '미션ID', row['미션ID'], {
      '미션ID': row['미션ID'],
      '상태': '교체됨',
      '종료일시': now,
      '비고': [
        clean_(row['비고']),
        '매니저의 새 목표로 교체'
      ].filter(Boolean).join(' | ')
    });
  });

  const id = 'MS-' + Utilities.getUuid().replace(/-/g, '').slice(0, 14).toUpperCase();

  upsertObjectByKey_(sheet, '미션ID', id, {
    '미션ID': id,
    '계정ID': payload.accountId,
    '학생코드': payload.studentCode,
    '케이스번호': payload.caseId,
    '탐험번호': payload.journey,
    '생성일': now,
    '미션문장': payload.text,
    '언제': '다음 급식시간 또는 일상에서',
    '어디서': '학교 또는 가정',
    '목표횟수': payload.targetCount,
    '도움받을사람': '영양선생님·담임선생님·보호자',
    '확인방법': payload.checkMethod,
    '자신감': '',
    '시작일': payload.startDate || now,
    '종료일': payload.endDate || '',
    '상태': '진행 중',
    '종료일시': '',
    '비고': 'AI 영양상담 매니저에서 동기화'
  });

  return id;
}

function closeExplorerMissionsLocal_(sheet, caseId) {
  const now = new Date();

  getObjects_(sheet)
    .filter(row =>
      clean_(row['케이스번호']) === clean_(caseId) &&
      clean_(row['상태']) === '진행 중'
    )
    .forEach(row => {
      upsertObjectByKey_(sheet, '미션ID', row['미션ID'], {
        '미션ID': row['미션ID'],
        '상태': '완료',
        '종료일시': now,
        '비고': [
          clean_(row['비고']),
          '매니저 종결 또는 학생 참여하지 않음'
        ].filter(Boolean).join(' | ')
      });
    });
}

function inferTopicFromDiagnosis_(diagnosis) {
  const allergy = clean_(diagnosis['알레르기']);
  if (allergy && !/없음|해당없음|무/.test(allergy)) return '알레르기';

  const eatingAttitude = clean_(diagnosis['섭식태도']);
  if (/저체중|섭취부족|소식/.test(eatingAttitude)) return '저체중';
  if (/편식|감각|새음식/.test(eatingAttitude)) return '편식';

  return '';
}

function normalizeInternalArea_(topic, diagnosis) {
  const text = [
    topic,
    diagnosis['종합등급'],
    diagnosis['섭식태도'],
    diagnosis['체형인식'],
    diagnosis['알레르기'],
    diagnosis['추가상담요청사항']
  ].map(clean_).join(' ');

  if (/알레르기|알러지/.test(text)) return 'allergy';
  if (/편식|감각|새음식|음식거부|선택적/.test(text)) return 'picky';
  if (/저체중|섭취부족|소식|체중증가|먹는양부족/.test(text)) return 'strength';
  if (/성장|키|성장부진/.test(text)) return 'growth';
  if (/비만|과체중|체중조절|생활리듬|과식|빠른식사/.test(text)) return 'rhythm';
  return 'common';
}

function generateUniqueExplorerCode_(usedCodes) {
  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!usedCodes.has(code)) return code;
  }
  throw new Error('사용 가능한 4자리 탐험코드를 생성하지 못했습니다.');
}

function makeExplorerAlias_(seed) {
  const first = ['민트','햇살','초록','구름','별빛','바람','푸른','도토리','새싹','달빛'];
  const second = ['별','콩','새','곰','토끼','나무','여우','고래','씨앗','나비'];

  let hash = 0;
  const text = String(seed || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }

  const a = Math.abs(hash) % first.length;
  const b = Math.abs(Math.floor(hash / first.length)) % second.length;
  return first[a] + second[b];
}

function sortAccountSheet_(sheet) {
  if (sheet.getLastRow() <= 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0].map(value => clean_(value));

  const yearCol = headers.indexOf('학년도') + 1;
  const gradeCol = headers.indexOf('학년') + 1;
  const classCol = headers.indexOf('반') + 1;
  const noCol = headers.indexOf('번호') + 1;

  const specs = [];
  if (yearCol > 0) specs.push({ column: yearCol, ascending: false });
  if (gradeCol > 0) specs.push({ column: gradeCol, ascending: true });
  if (classCol > 0) specs.push({ column: classCol, ascending: true });
  if (noCol > 0) specs.push({ column: noCol, ascending: true });

  if (specs.length) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
      .sort(specs);
  }
}

function extractSpreadsheetId_(input) {
  const match = String(input || '').match(/[-\w]{25,}/);
  return match ? match[0] : '';
}

function clean_(value) {
  return String(value === null || value === undefined ? '' : value).trim();
}

function normalizeName_(value) {
  return clean_(value).replace(/\s+/g, '').toLowerCase();
}

function formatDateTime_(value) {
  if (!value) return '';
  const date = Object.prototype.toString.call(value) === '[object Date]'
    ? value
    : new Date(value);
  if (isNaN(date.getTime())) return '';
  return Utilities.formatDate(date, EXPLORER_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function toClient_(value) {
  if (value === null || value === undefined) return value;

  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, EXPLORER_CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }

  if (Array.isArray(value)) return value.map(toClient_);

  if (typeof value === 'number') return isFinite(value) ? value : '';

  if (typeof value === 'object') {
    const output = {};
    Object.keys(value).forEach(key => {
      output[key] = toClient_(value[key]);
    });
    return output;
  }

  return value;
}
