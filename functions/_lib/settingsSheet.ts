import { appendValues, getValues, updateValues } from './googleSheets'

export const SETTINGS_SHEET_NAME = '설정'

/** docs/database-schema.md 2.1절 — 학생정보 탭이 studentUuid/studentNumber/enrollmentStatus/schoolYear를 갖는 구조의 버전. */
export const STUDENT_SCHEMA_VERSION = '3'

/** docs/database-schema.md 2.3절 — 상담접수 탭이 신청자/학생/상담 요청 필드를 전부 갖춘 Milestone 2A 구조의 버전. */
export const INTAKE_SCHEMA_VERSION = '2'

/** 상담케이스 탭이 legacy 케이스 필드(신청경로/주상담주제/다음일정/담당자/Drive폴더URL 등)를 갖춘 구조의 버전. */
export const CASE_SCHEMA_VERSION = '1'

/** 보호자동의 탭이 legacy 21개 필드(보호자명/동의 항목별 상태/제출·확인 일시 등)를 갖춘 구조의 버전. */
export const CONSENT_SCHEMA_VERSION = '1'

/** 진단결과 탭이 PDF 업로드+상태관리 필드(파일 URL/검토상태/Gemini 추출요약 등)를 갖춘 구조의 버전. */
export const ASSESSMENT_SCHEMA_VERSION = '1'

function quoteSheetName(name: string): string {
  return `'${name}'`
}

/**
 * "설정" 탭의 `{key}`/`updatedAt` 키를 갱신한다. 실패해도 각 API 자체의 성공/실패에는
 * 영향을 주지 않는다(호출부에서 best-effort로 감싸 쓴다) — 이건 감사(audit) 기록이지,
 * 데이터 탭 접근을 좌우하는 게이트가 아니다. 실제 호환 여부 판단은 항상 해당 탭의
 * 헤더를 직접 읽어 확인한다(studentSheet.ts/intakeSheet.ts의 `ensureHeaders`) — 여기
 * 값이 최신이라고 해서 그걸 믿고 헤더 확인을 건너뛰지 않는다. 탭마다 별도 진화 속도를
 * 가지므로 키를 공유하지 않는다(`schemaVersion` = 학생정보, `intakeSchemaVersion` = 상담접수).
 */
export async function recordSchemaVersion(
  accessToken: string,
  spreadsheetId: string,
  version: string,
  key = 'schemaVersion',
): Promise<void> {
  const range = `${quoteSheetName(SETTINGS_SHEET_NAME)}!A1:B500`
  const values = await getValues(accessToken, spreadsheetId, range)
  const rows = values.slice(1)
  const now = new Date().toISOString()

  const versionRowOffset = rows.findIndex((row) => row[0] === key)
  const updatedAtRowOffset = rows.findIndex((row) => row[0] === 'updatedAt')

  if (versionRowOffset === -1) {
    await appendValues(accessToken, spreadsheetId, `${quoteSheetName(SETTINGS_SHEET_NAME)}!A1`, [
      [key, version],
    ])
  } else {
    const sheetRow = versionRowOffset + 2
    await updateValues(accessToken, spreadsheetId, `${quoteSheetName(SETTINGS_SHEET_NAME)}!A${sheetRow}:B${sheetRow}`, [
      [key, version],
    ])
  }

  if (updatedAtRowOffset === -1) {
    await appendValues(accessToken, spreadsheetId, `${quoteSheetName(SETTINGS_SHEET_NAME)}!A1`, [['updatedAt', now]])
  } else {
    const sheetRow = updatedAtRowOffset + 2
    await updateValues(accessToken, spreadsheetId, `${quoteSheetName(SETTINGS_SHEET_NAME)}!A${sheetRow}:B${sheetRow}`, [
      ['updatedAt', now],
    ])
  }
}
