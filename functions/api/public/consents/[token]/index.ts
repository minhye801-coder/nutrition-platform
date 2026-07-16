import { ensurePublicSpreadsheetAccess, isPublicAccessError } from '../../../../_lib/publicSpreadsheetAccess'
import {
  CONSENT_DECISION_AGREE,
  CONSENT_DECISION_DECLINE,
  CONSENT_STATUS_REQUESTED,
  findConsentByToken,
  submitConsent,
} from '../../../../_lib/consentSheet'
import { getCase } from '../../../../_lib/caseSheet'
import { getStudentByUuid } from '../../../../_lib/studentSheet'
import { getConsentTokenParam, handleConsentSheetError, parseConsentToken } from '../../../../_lib/consentApiHelpers'
import type { Env } from '../../../../_lib/env'

/** legacy Consent.html이 학생 이름을 "홍○동"처럼 가운데만 가려 보여주던 것과 동일. */
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

/** 공개 보호자동의 페이지 데이터 조회(GET /api/public/consents/:token). 로그인 불필요. */
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
    // 아직 발송 전(토큰 없음)이거나 이미 제출된 토큰은 유효하지 않은 것과 동일하게 취급한다
    // (intake-migration-spec.md 11.4절 "유효하지 않거나 이미 제출된 토큰으로는 조회 불가").
    if (!consent || consent.status !== CONSENT_STATUS_REQUESTED) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    const caseRecord = await getCase(access.accessToken, access.spreadsheetId, consent.caseId)
    const student = await getStudentByUuid(access.accessToken, access.spreadsheetId, consent.studentUuid)

    return Response.json({
      studentName: maskStudentName(student?.name ?? ''),
      topic: caseRecord?.topic ?? '',
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
    return Response.json({ ok: true })
  } catch (error) {
    handleConsentSheetError('public submit', error)
    return unavailableResponse()
  }
}
