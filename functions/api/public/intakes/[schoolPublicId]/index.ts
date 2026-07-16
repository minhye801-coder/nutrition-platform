import { ensurePublicSpreadsheetAccess, isPublicAccessError } from '../../../../_lib/publicSpreadsheetAccess'
import {
  APPLICANT_TYPE_VALUES,
  createIntake,
  PREFERRED_TIME_VALUES,
  RELATION_TO_STUDENT_VALUES,
  TOPIC_VALUES,
  URGENCY_VALUES,
} from '../../../../_lib/intakeSheet'
import { getSchoolPublicIdParam, handleIntakeSheetError } from '../../../../_lib/intakeApiHelpers'
import type { Env } from '../../../../_lib/env'

interface SubmitIntakeBody {
  /** 허니팟 필드 — 값이 채워져 있으면 스팸으로 간주한다(docs/public-intake-auth-design.md 3.5절). */
  website?: string
  applicantType?: string
  applicantName?: string
  relationToStudent?: string
  schoolYear?: string
  grade?: string
  class?: string
  studentNumber?: string
  name?: string
  topic?: string
  content?: string
  preferredTime?: string
  urgency?: string
  contactInfo?: string
  privacyConsent?: boolean
  note?: string
}

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 신청자에게 내려주는 오류는 학교 존재 여부와 무관하게 항상 같은 문구로 통일한다
 * (docs/public-intake-auth-design.md 3.5절 — `schoolPublicId` 열거 방지). 실제 원인은
 * `ensurePublicSpreadsheetAccess` 호출부에서 서버 로그로만 남긴다.
 */
function unavailableResponse(): Response {
  return Response.json({ error: 'unavailable' }, { status: 503 })
}

/** 공개 상담신청 제출(POST /api/public/intakes/:schoolPublicId). 로그인 불필요. */
export const onRequestPost: PagesFunction<Env, 'schoolPublicId'> = async ({ request, env, params }) => {
  const schoolPublicId = getSchoolPublicIdParam(params)
  if (!schoolPublicId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  let body: SubmitIntakeBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  // 허니팟: 사람 사용자에게는 보이지 않는 필드라 값이 있으면 봇으로 간주한다.
  if (toTrimmedString(body.website)) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const applicantType = toTrimmedString(body.applicantType)
  const applicantName = toTrimmedString(body.applicantName)
  const relationToStudent = toTrimmedString(body.relationToStudent)
  const schoolYear = toTrimmedString(body.schoolYear)
  const grade = toTrimmedString(body.grade)
  const studentClass = toTrimmedString(body.class)
  const studentNumber = toTrimmedString(body.studentNumber)
  const name = toTrimmedString(body.name)
  const topic = toTrimmedString(body.topic)
  const content = toTrimmedString(body.content)
  const preferredTime = toTrimmedString(body.preferredTime) || PREFERRED_TIME_VALUES[0]
  const urgency = toTrimmedString(body.urgency) || URGENCY_VALUES[0]
  const contactInfo = toTrimmedString(body.contactInfo)
  const note = toTrimmedString(body.note)

  if (
    !applicantType ||
    !applicantName ||
    !relationToStudent ||
    !schoolYear ||
    !grade ||
    !studentClass ||
    !name ||
    !topic ||
    !content ||
    !contactInfo
  ) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (body.privacyConsent !== true) {
    return Response.json({ error: 'privacy_consent_required' }, { status: 400 })
  }
  if (!(APPLICANT_TYPE_VALUES as readonly string[]).includes(applicantType)) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!(RELATION_TO_STUDENT_VALUES as readonly string[]).includes(relationToStudent)) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!(TOPIC_VALUES as readonly string[]).includes(topic)) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!(PREFERRED_TIME_VALUES as readonly string[]).includes(preferredTime)) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  if (!(URGENCY_VALUES as readonly string[]).includes(urgency)) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const access = await ensurePublicSpreadsheetAccess(env, schoolPublicId)
  if (isPublicAccessError(access)) {
    console.error(`[public intakes] access denied`, access.error)
    return unavailableResponse()
  }

  try {
    const intake = await createIntake(access.accessToken, access.spreadsheetId, {
      tenantId: access.installation.schoolPublicId,
      applicantType,
      applicantName,
      relationToStudent,
      schoolYear,
      grade,
      class: studentClass,
      studentNumber,
      name,
      topic,
      content,
      preferredTime,
      urgency,
      contactInfo,
      privacyConsent: '동의',
      note,
    })
    return Response.json({ intakeId: intake.intakeId }, { status: 201 })
  } catch (error) {
    // handleIntakeSheetError는 로깅만 위해 호출한다 — 신청자에게는 시트 스키마 등
    // 내부 상세를 노출하지 않고 항상 동일한 일반 응답만 돌려준다(위 unavailableResponse 주석 참고).
    handleIntakeSheetError('public create', error)
    return unavailableResponse()
  }
}
