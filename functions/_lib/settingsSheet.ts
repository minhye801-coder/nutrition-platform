import { appendValues, getValues, updateValues } from './googleSheets'

export const SETTINGS_SHEET_NAME = '설정'

/** docs/database-schema.md 2.1절 — 학생정보 탭이 studentUuid/studentNumber/enrollmentStatus를 갖는 구조의 버전. */
export const STUDENT_SCHEMA_VERSION = '2'

function quoteSheetName(name: string): string {
  return `'${name}'`
}

/**
 * "설정" 탭의 schemaVersion/updatedAt 키를 갱신한다. 실패해도 학생 API 자체의
 * 성공/실패에는 영향을 주지 않는다(호출부에서 best-effort로 감싸 쓴다) — 이건
 * 감사(audit) 기록이지, 학생정보 탭 접근을 좌우하는 게이트가 아니다. 실제
 * 호환 여부 판단은 항상 학생정보 탭의 헤더를 직접 읽어 확인한다(studentSheet.ts의
 * `ensureHeaders`) — 여기 값이 최신이라고 해서 그걸 믿고 헤더 확인을 건너뛰지 않는다.
 */
export async function recordSchemaVersion(
  accessToken: string,
  spreadsheetId: string,
  version: string,
): Promise<void> {
  const range = `${quoteSheetName(SETTINGS_SHEET_NAME)}!A1:B500`
  const values = await getValues(accessToken, spreadsheetId, range)
  const rows = values.slice(1)
  const now = new Date().toISOString()

  const versionRowOffset = rows.findIndex((row) => row[0] === 'schemaVersion')
  const updatedAtRowOffset = rows.findIndex((row) => row[0] === 'updatedAt')

  if (versionRowOffset === -1) {
    await appendValues(accessToken, spreadsheetId, `${quoteSheetName(SETTINGS_SHEET_NAME)}!A1`, [
      ['schemaVersion', version],
    ])
  } else {
    const sheetRow = versionRowOffset + 2
    await updateValues(accessToken, spreadsheetId, `${quoteSheetName(SETTINGS_SHEET_NAME)}!A${sheetRow}:B${sheetRow}`, [
      ['schemaVersion', version],
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
