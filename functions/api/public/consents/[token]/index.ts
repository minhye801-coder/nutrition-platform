import { ensurePublicSpreadsheetAccess, isPublicAccessError } from '../../../../_lib/publicSpreadsheetAccess'
import {
  CONSENT_DECISION_AGREE,
  CONSENT_DECISION_DECLINE,
  CONSENT_STATUS_REQUESTED,
  findConsentByToken,
  setConsentPdfFileId,
  submitConsent,
} from '../../../../_lib/consentSheet'
import { getCase } from '../../../../_lib/caseSheet'
import { getStudentByUuid } from '../../../../_lib/studentSheet'
import { ensureConsentPdfFolder } from '../../../../_lib/caseFolder'
import { createTextPdf } from '../../../../_lib/googleDocs'
import { getConsentTokenParam, handleConsentSheetError, parseConsentToken } from '../../../../_lib/consentApiHelpers'
import type { Env } from '../../../../_lib/env'

/** `STU-K7P4-Q9XM-2R8D_보호자동의서_20260718.pdf`처럼 StudentID 기반 파일명을 만든다(요구사항 7절). */
function consentPdfFileName(studentUuid: string): string {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${studentUuid}_보호자동의서_${y}${m}${d}`
}

/** legacy Consent.html/maskName_이 학생 이름을 "홍○동"처럼 가운데만 가려 보여주던 것과 동일. */
function maskStudentName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 1) return trimmed
  if (trimmed.length === 2) return `${trimmed[0]}○`
  return `${trimmed[0]}○${trimmed[trimmed.length - 1]}`
}

/** 학교 존재 여부·토큰 유효성을 신청자에게 구분해 노출하지 않기 위해 항상 같은 응답을 준다. */
function unavailableResponse(): Response {
  return Response.json({ error: 'unavailable' }, { status: 503 })
}

interface SubmitConsentBody {
  guardianName?: string
  relationToStudent?: string
  guardianContact?: string
  decision?: string
  signatureName?: string
  counselingConsent?: boolean
  personalInfoConsent?: boolean
  sensitiveInfoConsent?: boolean
  diagnosisUseConsent?: boolean
  aiNoticeConfirmed?: boolean
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 공개 보호자동의 페이지 데이터 조회(GET /api/public/consents/:token). 로그인 불필요.
 * legacy `getConsentPageData`(intake-consent/code.gs.txt:82-108)와 동일하게 상태와 무관하게
 * 조회는 항상 되고, 이미 제출된 경우엔 `alreadySubmitted`로만 구분한다(제출 폼 자체는
 * `submitConsent`가 상태로 막는다). 토큰이 아예 발급되지 않은 경우(아직 미발송)만 404.
 */
export const onRequestGet: PagesFunction<Env, 'token'> = async ({ params, env }) => {
  const token = getConsentTokenParam(params)
  const parsed = token ? parseConsentToken(token) : null
  if (!token || !parsed) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  const access = await ensurePublicSpreadsheetAccess(env, parsed.schoolPublicId)
  if (isPublicAccessError(access)) {
    console.error('[public consents] access denied', access.error)
    return unavailableResponse()
  }

  try {
    const consent = await findConsentByToken(access.accessToken, access.spreadsheetId, token)
    if (!consent) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    const caseRecord = await getCase(access.accessToken, access.spreadsheetId, consent.caseId)
    const student = await getStudentByUuid(access.accessToken, access.identitySpreadsheetId, consent.studentUuid)

    return Response.json({
      studentName: maskStudentName(student?.name ?? ''),
      topic: caseRecord?.topic ?? '',
      status: consent.status,
      alreadySubmitted: consent.status !== CONSENT_STATUS_REQUESTED,
    })
  } catch (error) {
    handleConsentSheetError('public get', error)
    return unavailableResponse()
  }
}

/** 보호자 제출(POST /api/public/consents/:token). 로그인 불필요. */
export const onRequestPost: PagesFunction<Env, 'token'> = async ({ request, params, env }) => {
  const token = getConsentTokenParam(params)
  const parsed = token ? parseConsentToken(token) : null
  if (!token || !parsed) {
    return Response.json({ error: 'not_found' }, { status: 404 })
  }

  let body: SubmitConsentBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const guardianName = toTrimmedString(body.guardianName)
  const relationToStudent = toTrimmedString(body.relationToStudent)
  const guardianContact = toTrimmedString(body.guardianContact)
  const decision = toTrimmedString(body.decision)
  const signatureName = toTrimmedString(body.signatureName)

  if (!guardianName || !relationToStudent || !guardianContact || !signatureName) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (decision !== CONSENT_DECISION_AGREE && decision !== CONSENT_DECISION_DECLINE) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const access = await ensurePublicSpreadsheetAccess(env, parsed.schoolPublicId)
  if (isPublicAccessError(access)) {
    console.error('[public consents] access denied', access.error)
    return unavailableResponse()
  }

  try {
    const result = await submitConsent(access.accessToken, access.spreadsheetId, token, {
      guardianName,
      relationToStudent,
      guardianContact,
      decision,
      signatureName,
      counselingConsent: body.counselingConsent === true,
      personalInfoConsent: body.personalInfoConsent === true,
      sensitiveInfoConsent: body.sensitiveInfoConsent === true,
      diagnosisUseConsent: body.diagnosisUseConsent === true,
      aiNoticeConfirmed: body.aiNoticeConfirmed === true,
    })
    if (!result.ok) {
      if (result.error === 'not_found') {
        return Response.json({ error: 'not_found' }, { status: 404 })
      }
      if (result.error === 'already_submitted') {
        return Response.json({ error: result.error }, { status: 409 })
      }
      // signature_mismatch / items_incomplete — 입력값 문제이지 상태 충돌이 아니다.
      return Response.json({ error: result.error }, { status: 400 })
    }

    // PDF 생성은 best-effort다(legacy도 동일 — intake-consent/code.gs.txt:160-168).
    // 실패해도 위에서 이미 저장된 동의 데이터에는 영향이 없다.
    try {
      const caseRecord = await getCase(access.accessToken, access.spreadsheetId, result.consent.caseId)
      const student = await getStudentByUuid(access.accessToken, access.identitySpreadsheetId, result.consent.studentUuid)
      // 보호자동의서 PDF는 SCHOOL_WORKSPACE 소유 학교의 03_보호자동의서 폴더에만 저장한다
      // (요구사항 7절) — 케이스별 중첩 폴더가 아니라 루트 바로 아래 평탄한 폴더다.
      if (caseRecord && access.installation.rootFolderId) {
        const consentFolderId = await ensureConsentPdfFolder(access.accessToken, access.installation.rootFolderId)
        const { fileId } = await createTextPdf(
          access.accessToken,
          consentFolderId,
          consentPdfFileName(result.consent.studentUuid),
          [
            '학교 영양상담 보호자 동의 전자제출 기록',
            '※ 본 문서는 공개 웹페이지에서 제출된 동의 내용을 학교 내부 보관용으로 기록한 것입니다.',
            `학생: ${student?.name ?? ''} (${student?.grade ?? ''}학년 ${student?.class ?? ''}반)`,
            `상담 주제: ${caseRecord.topic}`,
            `보호자: ${guardianName} / 관계: ${relationToStudent}`,
            `연락처: ${guardianContact}`,
            `상담 참여 동의: ${result.consent.counselingConsent}`,
            `개인정보 수집·이용 동의: ${result.consent.personalInfoConsent}`,
            `건강·식생활 민감정보 처리 동의: ${result.consent.sensitiveInfoConsent}`,
            `교육부 식생활·생활습관 진단결과 활용 동의: ${result.consent.diagnosisUseConsent}`,
            `AI 보조도구 활용 안내 확인: ${result.consent.aiNoticeConfirmed}`,
            `제출일시: ${result.consent.respondedAt}`,
            `전자서명(이름 입력): ${signatureName}`,
          ],
        )
        // 학생 이름/보호자 정보는 PDF 본문에만 있고, 시트에는 fileId(비공개 Drive 참조)만 남는다.
        await setConsentPdfFileId(access.accessToken, access.spreadsheetId, result.consent.caseId, fileId)
      }
    } catch (error) {
      console.error('[public consents] consent pdf generation failed(무시하고 계속 진행)', error)
    }

    return Response.json({ ok: true })
  } catch (error) {
    handleConsentSheetError('public submit', error)
    return unavailableResponse()
  }
}
