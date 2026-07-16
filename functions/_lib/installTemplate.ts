import type { ValueRange } from './googleSheets'

/** 설치 시 사용자 Drive에 생성하는 루트 폴더명. */
export const ROOT_FOLDER_NAME = '영양상담 AI+'

/**
 * 루트 폴더 바로 아래에 생성하는 하위 폴더 5종. 사용자에게 의미가 없는
 * "임시파일" 폴더(NEIS 업로드 등 내부 작업용으로 legacy에서만 쓰이던 폴더)는
 * 만들지 않는다 — 이미 설치된 기존 학교의 임시파일 폴더는 그대로 두고, 새 설치
 * 부터만 제외한다.
 */
export const SUBFOLDER_NAMES = [
  '보호자동의서',
  '상담생성문서',
  '검사파일',
  '맛마을결과',
  '백업',
] as const

/** 루트 폴더 안에 생성하는 데이터 Spreadsheet 파일명. */
export const SPREADSHEET_TITLE = '영양상담 AI+ 데이터'

/** 설정 탭에 기록하는 installationVersion 값. 스키마가 바뀌면 함께 올린다. */
export const INSTALLATION_VERSION = '1.0.0'

interface TabDefinition {
  /** 탭(시트) 제목. */
  name: string
  /** 헤더 행. docs/database-schema.md·platform-v1-architecture.md 7절의 기본키/외래키를
   * 기준으로 한 최소 구조이며, legacy 원본 컬럼 전체를 추측으로 복원하지 않는다. */
  headers: string[]
}

/**
 * 데이터 Spreadsheet에 생성할 18개 탭과 각 탭의 최소 헤더.
 * 순서는 docs/platform-v1-architecture.md 7절 표와 동일하다.
 */
export const TAB_DEFINITIONS: TabDefinition[] = [
  { name: '설정', headers: ['키', '값'] },
  {
    name: '학생정보',
    headers: [
      'studentUuid',
      'tenantId',
      'schoolYear',
      'name',
      'grade',
      'class',
      'studentNumber',
      'enrollmentStatus',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: '상담접수',
    headers: [
      'intakeId',
      'tenantId',
      'applicantType',
      'applicantName',
      'relationToStudent',
      'schoolYear',
      'grade',
      'class',
      'studentNumber',
      'name',
      'topic',
      'content',
      'preferredTime',
      'urgency',
      'contactInfo',
      'privacyConsent',
      'note',
      'studentUuid',
      'status',
      'submittedAt',
      'updatedAt',
    ],
  },
  {
    name: '보호자동의',
    headers: [
      'consentId',
      'tenantId',
      'intakeId',
      'caseId',
      'consentToken',
      'status',
      'requestedAt',
      'respondedAt',
    ],
  },
  {
    name: '상담케이스',
    headers: ['caseId', 'tenantId', 'studentUuid', 'status', 'openedAt', 'closedAt'],
  },
  {
    name: '진단결과',
    headers: ['assessmentId', 'tenantId', 'caseId', 'round', 'timepoint', 'createdAt'],
  },
  {
    name: '상담회기',
    headers: ['sessionId', 'tenantId', 'caseId', 'sessionDate', 'summary', 'createdAt'],
  },
  {
    name: '실천목표',
    headers: ['goalId', 'tenantId', 'caseId', 'sessionId', 'content', 'createdAt'],
  },
  {
    name: '목표점검',
    headers: ['checkId', 'tenantId', 'goalId', 'checkedAt', 'result'],
  },
  {
    name: '효과평가',
    headers: ['evaluationId', 'tenantId', 'caseId', 'timepoint', 'createdAt'],
  },
  {
    name: '성장측정',
    headers: ['measurementId', 'tenantId', 'caseId', 'measuredAt', 'height', 'weight'],
  },
  {
    name: '다음회기준비',
    headers: ['preparationId', 'tenantId', 'caseId', 'sessionId', 'content', 'createdAt'],
  },
  {
    name: '맛마을검사',
    headers: ['assessmentId', 'tenantId', 'studentUuid', 'submittedAt'],
  },
  {
    name: '맛마을결과',
    headers: [
      'resultId',
      'tenantId',
      'assessmentId',
      'studentUuid',
      'summary',
      'createdAt',
    ],
  },
  {
    name: '생성문서',
    headers: ['docId', 'tenantId', 'caseId', 'fileName', 'driveFileId', 'createdAt'],
  },
  {
    name: '일정관리',
    headers: ['scheduleId', 'tenantId', 'caseId', 'scheduledAt', 'title'],
  },
  {
    name: '일정완료',
    headers: ['completionId', 'tenantId', 'scheduleId', 'completedAt'],
  },
  {
    name: '변경이력',
    headers: ['logId', 'tenantId', 'actor', 'action', 'targetId', 'timestamp'],
  },
]

export const TAB_TITLES = TAB_DEFINITIONS.map((tab) => tab.name)

function quoteSheetName(name: string): string {
  // Google Sheets A1 표기법에서 시트 이름에 공백/특수문자가 있으면 작은따옴표로 감싼다.
  // 이 프로젝트의 탭 이름은 모두 한글 고정 상수이므로 작은따옴표 자체는 포함되지 않는다.
  return `'${name}'`
}

/**
 * 18개 탭의 헤더 행 + 설정 탭의 초기 키-값 데이터를 한 번의 batchUpdate 요청으로
 * 기록하기 위한 ValueRange 목록을 만든다(18.3절 "batchGet/batchUpdate 우선").
 * Gemini API Key는 어떤 값도 포함하지 않는다(요구사항 5절).
 */
export function buildInitialValueRanges(settings: {
  schoolName: string
  managerName: string
  schoolPublicId: string
  createdAt: string
}): ValueRange[] {
  const headerRanges = TAB_DEFINITIONS.map((tab) => ({
    range: `${quoteSheetName(tab.name)}!A1`,
    values: [tab.headers],
  }))

  const settingsRange: ValueRange = {
    range: `${quoteSheetName('설정')}!A2`,
    values: [
      ['schoolName', settings.schoolName],
      ['managerName', settings.managerName],
      ['schoolPublicId', settings.schoolPublicId],
      ['installationVersion', INSTALLATION_VERSION],
      ['createdAt', settings.createdAt],
    ],
  }

  return [...headerRanges, settingsRange]
}
