import type { ValueRange } from './googleSheets'

/** 설치 시 사용자 Drive에 생성하는 루트 폴더명. */
export const ROOT_FOLDER_NAME = '영양상담 AI+'

/**
 * 루트 폴더 바로 아래에 생성하는 하위 폴더 4종. 요구사항 5절의 권장 구조
 * (01_학생식별정보/02_상담데이터/03_보호자동의서/04_비식별_분석결과)를 그대로 쓴다.
 * 01/02는 실제로는 이 폴더 안에 파일을 두지 않는다(학생식별정보/상담데이터는
 * Spreadsheet 자체를 루트에 두므로) — 폴더명은 사용자가 Drive에서 구조를 한눈에
 * 알아볼 수 있게 하기 위한 것이고, 실제 파일이 쌓이는 곳은 03/04다. 기존에 이미
 * 설치된 학교의 예전 폴더명(보호자동의서/상담생성문서/검사파일/맛마을결과/백업)은
 * 그대로 남겨두고 새로 만들지 않는다 — ensureFolder(setupOrchestrator.ts)가
 * 이름으로 찾거나 새로 만드는 방식이라 기존 설치에는 새 폴더가 추가로 생길 뿐,
 * 기존 폴더가 삭제되거나 이동하지 않는다.
 */
export const SUBFOLDER_NAMES = [
  '01_학생식별정보',
  '02_상담데이터',
  '03_보호자동의서',
  '04_비식별_분석결과',
] as const

/** 학생 이름 등 직접 식별정보만 담는 Spreadsheet 파일명. */
export const IDENTITY_SPREADSHEET_TITLE = '영양상담 AI+ 학생식별정보'
/** StudentID로만 연결되는 상담 데이터 Spreadsheet 파일명 — 학생 이름을 저장하지 않는다. */
export const DATA_SPREADSHEET_TITLE = '영양상담 AI+ 상담데이터'

/** 설정 탭에 기록하는 installationVersion 값. 스키마가 바뀌면 함께 올린다. */
export const INSTALLATION_VERSION = '2.0.0'

interface TabDefinition {
  /** 탭(시트) 제목. */
  name: string
  /** 헤더 행. docs/database-schema.md·platform-v1-architecture.md 7절의 기본키/외래키를
   * 기준으로 한 최소 구조이며, legacy 원본 컬럼 전체를 추측으로 복원하지 않는다. */
  headers: string[]
}

/**
 * 학생식별정보 Spreadsheet에 생성할 탭. `학생정보`(이름 원본)와 `상담접수`(신청 시점
 * 신청자가 직접 입력하는 이름 등 식별정보)만 여기 둔다 — 상담접수는 사전동의 이전
 * 단계라 상담 내용이 아니라 "식별정보에 가까운" 신청 데이터로 취급한다(요구사항 5·7절
 * 설계 결정). `설정` 탭은 이 Spreadsheet 자체의 schemaVersion 기록용으로만 쓰고,
 * schoolName 등 대표 설정값은 상담데이터 Spreadsheet의 `설정` 탭에만 둔다(중복 저장 안 함).
 */
export const IDENTITY_TAB_DEFINITIONS: TabDefinition[] = [
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
]

/**
 * 상담데이터 Spreadsheet에 생성할 탭. StudentID로만 학생을 참조하고, 학생 이름을
 * 중복 저장하지 않는다(요구사항 5절). `보호자동의` 탭에서 보호자 이름/연락처/관계
 * 컬럼을 제거했다 — 보호자 정보는 03_보호자동의서 폴더에 생성되는 PDF 안에만
 * 존재한다(functions/api/public/consents/[token]/index.ts). `진단결과` 탭 추출
 * 컬럼에서도 `studentName`/`schoolType`처럼 재식별에 쓰일 수 있는 필드를 뺐다
 * (functions/_lib/geminiClient.ts, assessmentSheet.ts와 함께 갱신).
 */
export const DATA_TAB_DEFINITIONS: TabDefinition[] = [
  { name: '설정', headers: ['키', '값'] },
  {
    name: '보호자동의',
    headers: [
      'consentId',
      'tenantId',
      'intakeId',
      'caseId',
      'studentUuid',
      'consentToken',
      'status',
      'studentAssent',
      'counselingConsent',
      'personalInfoConsent',
      'sensitiveInfoConsent',
      'diagnosisUseConsent',
      'aiNoticeConfirmed',
      'requestedAt',
      'respondedAt',
      'consentedAt',
      'consentPdfFileId',
      'confirmedAt',
      'confirmedBy',
      'note',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: '상담케이스',
    headers: [
      'caseId',
      'tenantId',
      'studentUuid',
      'intakeId',
      'schoolYear',
      'topic',
      'referralType',
      'status',
      'nextScheduledAt',
      'managerEmail',
      'driveFolderUrl',
      'openedAt',
      'closedAt',
      'note',
      'createdAt',
      'updatedAt',
    ],
  },
  {
    name: '진단결과',
    headers: [
      'assessmentId',
      'tenantId',
      'caseId',
      'studentUuid',
      'round',
      'timepoint',
      'fileUrl',
      'fileName',
      'uploadedAt',
      'uploadedBy',
      'status',
      'extractedSummary',
      'reviewNote',
      'reviewedAt',
      'reviewedBy',
      'createdAt',
      'updatedAt',
      'fileId',
      'extractionStatus',
      'extractedAt',
      'extractedRawJson',
      'caseRequestId',
      // 아래부터 functions/_lib/assessmentSheet.ts의 ASSESSMENT_EXTRACTED_FIELDS와 순서를
      // 맞춘 비식별 추출 필드. studentName/schoolType/age/examDate는 재식별 위험이 커서
      // 뺐다(functions/_lib/geminiClient.ts extractFromDeidentifiedText, 요구사항 10절).
      'gradeBand',
      'sex',
      'heightCm',
      'heightPercentile',
      'weightKg',
      'weightPercentile',
      'bmi',
      'bmiPercentile',
      'subjectiveHealth',
      'bodyImage',
      'mealFrequency',
      'regularMealTime',
      'eatingSpeed',
      'mealAmount',
      'totalLevel',
      'totalScore',
      'balanceLevel',
      'balanceScore',
      'moderationLevel',
      'moderationScore',
      'practiceLevel',
      'practiceScore',
      'eatingAttitude',
      'eatingAttitudeScore',
      'allergy',
      'disease',
      'sleepLevel',
      'sleepDuration',
      'mentalHealth',
      'smartphoneUsageLevel',
      'weekdaySmartphoneHours',
      'weekendSmartphoneHours',
      'smartphoneOverdependence',
      'additionalRequest',
      'warnings',
      'responseHighlights',
    ],
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

export const IDENTITY_TAB_TITLES = IDENTITY_TAB_DEFINITIONS.map((tab) => tab.name)
export const DATA_TAB_TITLES = DATA_TAB_DEFINITIONS.map((tab) => tab.name)

function quoteSheetName(name: string): string {
  // Google Sheets A1 표기법에서 시트 이름에 공백/특수문자가 있으면 작은따옴표로 감싼다.
  // 이 프로젝트의 탭 이름은 모두 한글 고정 상수이므로 작은따옴표 자체는 포함되지 않는다.
  return `'${name}'`
}

function buildHeaderRanges(tabs: TabDefinition[]): ValueRange[] {
  return tabs.map((tab) => ({
    range: `${quoteSheetName(tab.name)}!A1`,
    values: [tab.headers],
  }))
}

/** 학생식별정보 Spreadsheet의 헤더 행만 기록한다(대표 설정값은 상담데이터 쪽에만 있음). */
export function buildIdentityValueRanges(): ValueRange[] {
  return buildHeaderRanges(IDENTITY_TAB_DEFINITIONS)
}

/**
 * 상담데이터 Spreadsheet의 헤더 행 + `설정` 탭 초기 키-값을 한 번의 batchUpdate로 기록한다.
 * Gemini API Key는 어떤 값도 포함하지 않는다(요구사항 5절).
 */
export function buildDataValueRanges(settings: {
  schoolName: string
  managerName: string
  schoolPublicId: string
  createdAt: string
}): ValueRange[] {
  const headerRanges = buildHeaderRanges(DATA_TAB_DEFINITIONS)

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
