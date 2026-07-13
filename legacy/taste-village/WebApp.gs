/**
 * 맛마음 탐험소 6단계 WebApp.gs
 * 기존 WebApp.gs의 내용을 전부 이 코드로 교체합니다.
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('맛마음 탐험소')
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
    );
}

function getExplorerPublicConfig() {
  const settings = getSettingsMap_();

  return {
    schoolName: settings.SCHOOL_NAME || '구미봉곡초등학교',
    systemName: '맛마음 탐험소',
    notice: '학년·반·이름과 개인 탐험코드를 입력하세요.'
  };
}

function loginTasteMindExplorer(payload) {
  const result = verifyStudentExplorerLogin(payload);

  if (!result || !result.ok) {
    return result || {
      ok: false,
      message: '로그인 정보를 확인해 주세요.'
    };
  }

  const account = result.account || {};
  const sessionToken = createExplorerSession_(
    account.caseId,
    account.accountId
  );

  let mealData = null;
  let mealError = '';

  try {
    mealData = getMealJourneyData_(new Date());
  } catch (error) {
    mealError = error && error.message
      ? error.message
      : '급식정보를 불러오지 못했습니다.';
  }

  const home = buildExplorerHomeSnapshot_(sessionToken);

  return {
    ok: true,
    sessionToken: sessionToken,
    account: {
      alias: account.alias || '새싹',
      grade: account.grade || '',
      classNo: account.classNo || '',
      studentName: account.studentName || '',
      studentActivityLabel:
        account.studentActivityLabel || '나의 맛마음 알아보기',
      currentMission: account.currentMission || ''
    },
    home: home,
    meals: mealData,
    mealError: mealError,
    conversation: buildFiveSessionConversationGuide_(
      account.internalArea || 'common',
      home.activeSessionNo
    )
  };
}
