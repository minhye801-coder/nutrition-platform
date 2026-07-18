import {
  listAssessments,
  ASSESSMENT_EXTRACTED_FIELDS,
  EXTRACTION_STATUS_AI,
  ASSESSMENT_STATUS_CONFIRMED,
  type AssessmentRecord,
} from './assessmentSheet'
import { getFileMetadata } from './googleDrive'
import { maskStudentId } from './maskId'

/**
 * 개인정보 보호 구조 확정(원본 진단검사 PDF는 Drive에 올리지 않음) 이전에 만들어진
 * 레코드는 `진단결과` 시트의 fileId가 채워져 있다 — 그 값이 남아 있는 레코드만 "원본
 * PDF가 Drive에 남아 있을 가능성이 있는 레코드"로 취급한다. 자동 삭제는 절대 하지 않고
 * (기존 데이터를 임의로 삭제하지 않는다는 원칙), 관리자가 목록을 보고 직접 선택한
 * 파일만 별도 액션(POST .../trash)으로 휴지통에 옮길 수 있게 한다.
 */
export interface LegacyPdfAuditItem {
  assessmentId: string
  caseId: string
  fileId: string
  /** Drive에서 조회한 실제 파일명(조회 실패 시 시트에 저장된 값으로 대체). */
  fileName: string
  createdAt: string
  studentIdMasked: string
  driveLocation: string
  /** Drive에서 열어 백업/다운로드할 수 있는 링크. 조회 실패 시 빈 문자열. */
  webViewLink: string
  /** 이 검사에 대해 구조화된 진단 결과(AI 분석 또는 교사 확인 완료)가 이미 존재하는지. */
  hasStructuredResult: boolean
  /** Drive 조회 결과 — found: 정상 조회, trashed: 이미 휴지통, not_found: 삭제/권한 없음, error: 기타 오류. */
  driveStatus: 'found' | 'trashed' | 'not_found' | 'error'
}

function hasAnyExtractedValue(record: AssessmentRecord): boolean {
  return ASSESSMENT_EXTRACTED_FIELDS.some((key) => record[key])
}

export async function auditLegacyAssessmentPdfs(
  accessToken: string,
  spreadsheetId: string,
): Promise<LegacyPdfAuditItem[]> {
  const assessments = await listAssessments(accessToken, spreadsheetId)
  const legacyRecords = assessments.filter((record) => record.fileId)

  const items = await Promise.all(
    legacyRecords.map(async (record): Promise<LegacyPdfAuditItem> => {
      const hasStructuredResult =
        record.status === ASSESSMENT_STATUS_CONFIRMED ||
        record.extractionStatus === EXTRACTION_STATUS_AI ||
        hasAnyExtractedValue(record)

      const base = {
        assessmentId: record.assessmentId,
        caseId: record.caseId,
        fileId: record.fileId,
        fileName: record.fileName,
        createdAt: record.uploadedAt,
        studentIdMasked: maskStudentId(record.studentUuid),
        driveLocation: '(케이스 폴더)/03_공식진단',
        webViewLink: record.fileUrl,
        hasStructuredResult,
      }

      try {
        const metadata = await getFileMetadata(accessToken, record.fileId)
        return {
          ...base,
          fileName: metadata.name || base.fileName,
          createdAt: metadata.createdTime || base.createdAt,
          webViewLink: metadata.webViewLink || base.webViewLink,
          driveStatus: metadata.trashed ? 'trashed' : 'found',
        }
      } catch {
        return { ...base, driveStatus: 'not_found' }
      }
    }),
  )

  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
