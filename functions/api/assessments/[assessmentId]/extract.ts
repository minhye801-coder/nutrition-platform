import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import { applyExtraction, getAssessment } from '../../../_lib/assessmentSheet'
import { getInstallationStore } from '../../../_lib/stores'
import { decryptToken } from '../../../_lib/tokenCipher'
import { extractFromDeidentifiedText, GeminiApiError } from '../../../_lib/geminiClient'
import { getAssessmentIdParam, handleAssessmentSheetError } from '../../../_lib/assessmentApiHelpers'
import type { Env } from '../../../_lib/env'

const MAX_TEXT_LENGTH = 50_000
/** 클라이언트가 만든 CASE-YYYYMMDD-XXXX 형태만 받는다(요구사항 10절) — 형식만 검증하고 값 자체는 저장만 한다. */
const CASE_REQUEST_ID_PATTERN = /^CASE-\d{8}-[A-Z0-9]{4}$/

interface ExtractBody {
  /** 브라우저에서 pdf.js로 추출 후 교사가 식별정보 후보를 제거·확인한 진단결과 텍스트(필수, src/lib/pdfDeidentify.ts). 원본 PDF 바이트는 여기 없다. */
  diagnosisText?: string
  /** 같은 방식으로 비식별화된 응답내역 텍스트(선택 — 원본도 responsePdf가 선택이었다, 요구사항 4절). */
  responseText?: string
  caseRequestId?: string
}

/**
 * "AI로 자동 확인"(POST /api/assessments/:assessmentId/extract). 로그인 필요. 원본 PDF를
 * 서버가 Drive에서 다시 읽어 Gemini에 보내던 이전 방식을 버리고, 프런트가 이미
 * 비식별화 확인 화면(요구사항 9절 "직접 식별정보가 제거되었는지 확인")을 통과시킨
 * 텍스트만 받는다 — 이 텍스트에도 개인정보가 남아 있을 수 있다는 전제하에, 서버는
 * 이 값을 로그로 출력하지 않고 그대로 Gemini에 전달만 한다.
 *
 * 실패해도(Gemini 키 없음/호출 실패) 업로드된 PDF와 assessment 레코드는 그대로 남는다 —
 * 교사는 PATCH(리뷰 저장)로 직접 입력을 이어가면 된다(사용자 확인, "AI는 선택 기능").
 */
export const onRequestPost: PagesFunction<Env, 'assessmentId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const assessmentId = getAssessmentIdParam(params)
  if (!assessmentId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  let body: ExtractBody
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }
  const diagnosisText = typeof body?.diagnosisText === 'string' ? body.diagnosisText.trim() : ''
  const responseText = typeof body?.responseText === 'string' ? body.responseText.trim() : ''
  const caseRequestId = typeof body?.caseRequestId === 'string' ? body.caseRequestId.trim() : ''
  if (
    !diagnosisText ||
    diagnosisText.length > MAX_TEXT_LENGTH ||
    responseText.length > MAX_TEXT_LENGTH ||
    !CASE_REQUEST_ID_PATTERN.test(caseRequestId)
  ) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  try {
    const assessment = await getAssessment(access.accessToken, access.spreadsheetId, assessmentId)
    if (!assessment) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    const encryptedGeminiKey = await getInstallationStore(env).getGeminiApiKey(access.session.googleSub)
    if (!encryptedGeminiKey) {
      return Response.json({ error: 'gemini_key_not_set' }, { status: 400 })
    }

    let apiKey: string
    try {
      apiKey = await decryptToken(env.SESSION_SECRET, encryptedGeminiKey)
    } catch {
      return Response.json({ error: 'gemini_key_not_set' }, { status: 400 })
    }

    let result
    try {
      result = await extractFromDeidentifiedText(apiKey, diagnosisText, responseText || undefined)
    } catch (error) {
      if (error instanceof GeminiApiError) {
        // detail 원문은 Gemini 오류 메시지일 뿐 요청 본문이 아니지만, 혹시라도 입력이
        // 에코백되는 경우까지 대비해 상태 코드만 남긴다(요구사항 10절).
        console.error('[assessments] gemini extraction failed', error.status)
        return Response.json({ error: 'gemini_extraction_failed' }, { status: 502 })
      }
      throw error
    }

    const updateResult = await applyExtraction(access.accessToken, access.spreadsheetId, assessmentId, {
      extracted: result.extracted,
      warnings: result.warnings,
      responseHighlights: result.responseHighlights,
      rawJson: result.rawJson,
      caseRequestId,
    })
    if (!updateResult.ok) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    return Response.json({ assessment: updateResult.assessment })
  } catch (error) {
    return handleAssessmentSheetError('extract', error)
  }
}
