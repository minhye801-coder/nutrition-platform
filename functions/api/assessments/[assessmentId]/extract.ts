import { isAccessError, requireInstalledAccess } from '../../../_lib/requireInstalledAccess'
import { applyExtraction, getAssessment } from '../../../_lib/assessmentSheet'
import { getStudentByUuid } from '../../../_lib/studentSheet'
import { downloadFile } from '../../../_lib/googleDrive'
import { getInstallationStore } from '../../../_lib/stores'
import { decryptToken } from '../../../_lib/tokenCipher'
import { extractAssessmentData, GeminiApiError } from '../../../_lib/geminiClient'
import { getAssessmentIdParam, handleAssessmentSheetError } from '../../../_lib/assessmentApiHelpers'
import type { Env } from '../../../_lib/env'

/**
 * "AI로 자동 확인"(POST /api/assessments/:assessmentId/extract). 로그인 필요. 이미
 * 업로드된 PDF(Drive fileId)를 다시 읽어 Gemini에 보낸다 — 프런트가 이 버튼을 누르기
 * 전에 "PDF가 Gemini로 전송되며 개인정보가 포함될 수 있다"는 안내를 교사에게 보여주고
 * 확인받은 뒤에만 이 엔드포인트를 호출해야 한다(그 확인은 여기서 강제하지 않는다 — UI 책임).
 *
 * 실패해도(Gemini 키 없음/호출 실패) 업로드된 PDF와 assessment 레코드는 그대로 남는다 —
 * 교사는 PATCH(리뷰 저장)로 직접 입력을 이어가면 된다(사용자 확인, "AI는 선택 기능").
 */
export const onRequestPost: PagesFunction<Env, 'assessmentId'> = async ({ request, env, params }) => {
  const access = await requireInstalledAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const assessmentId = getAssessmentIdParam(params)
  if (!assessmentId) {
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

    const fileBytes = await downloadFile(access.accessToken, assessment.fileId)

    let result
    try {
      result = await extractAssessmentData(apiKey, fileBytes)
    } catch (error) {
      if (error instanceof GeminiApiError) {
        console.error('[assessments] gemini extraction failed', error.status, error.detail)
        return Response.json({ error: 'gemini_extraction_failed' }, { status: 502 })
      }
      throw error
    }

    // 서버 쪽 학생정보 대조(legacy 학생명/학년 불일치 경고와 동일한 목적) — Gemini 호출
    // 자체에는 학생 식별 정보를 보내지 않았으므로, 응답을 받은 뒤 여기서 비교한다.
    const student = await getStudentByUuid(access.accessToken, access.spreadsheetId, assessment.studentUuid)
    const warnings = [...result.warnings]
    if (student) {
      const extractedName = result.extracted.studentName.trim()
      if (extractedName && extractedName !== student.name) {
        warnings.push(`PDF 학생명(${extractedName})과 선택한 학생명(${student.name})이 다릅니다.`)
      }
      const extractedGrade = result.extracted.grade.replace(/[^0-9]/g, '')
      if (extractedGrade && student.grade && extractedGrade !== student.grade) {
        warnings.push(`PDF 학년(${result.extracted.grade})과 선택한 학생 학년(${student.grade})이 다릅니다.`)
      }
    }

    const updateResult = await applyExtraction(access.accessToken, access.spreadsheetId, assessmentId, {
      extracted: result.extracted,
      warnings,
      responseHighlights: result.responseHighlights,
      rawJson: result.rawJson,
    })
    if (!updateResult.ok) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }

    return Response.json({ assessment: updateResult.assessment })
  } catch (error) {
    return handleAssessmentSheetError('extract', error)
  }
}
