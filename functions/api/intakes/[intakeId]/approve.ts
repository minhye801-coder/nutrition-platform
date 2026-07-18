import { isAccessError, requireSchoolWorkspaceAccess } from '../../../_lib/requireInstalledAccess'
import {
  approveIntakeWithStudent,
  getIntake,
  INTAKE_STATUS_REJECTED,
  IntakeSheetSchemaError,
} from '../../../_lib/intakeSheet'
import { findStudentForCaseApproval, createStudent, StudentSheetSchemaError } from '../../../_lib/studentSheet'
import { findCaseByIntakeId, createCase, CaseSheetSchemaError } from '../../../_lib/caseSheet'
import { findConsentByCaseId, createConsentSkeleton, ConsentSheetSchemaError } from '../../../_lib/consentSheet'
import { ensureCaseFolders } from '../../../_lib/caseFolder'
import { getIntakeIdParam } from '../../../_lib/intakeApiHelpers'
import { GoogleApiError } from '../../../_lib/googleApiError'
import type { Env } from '../../../_lib/env'

/**
 * 접수 승인(POST /api/intakes/:intakeId/approve) — legacy `approveIntake` +
 * `createCaseFromIntakeRow_`(counseling-manager/code.gs.txt:2967-3059)를 한 번에
 * 옮긴 것. `신규`/`검토중` 상태에서만 실행되며, 한 번에:
 *   1) 학생정보에서 같은 학생 검색(느슨한 매칭, studentSheet.ts의
 *      findStudentForCaseApproval) → 있으면 연결, 없으면 새로 생성
 *   2) 상담케이스 생성(초기 현재단계='동의 대기') + 케이스 전용 Drive 폴더 생성
 *   3) 보호자동의 골격 레코드 생성(확인상태='미발송', 동의토큰='' — 링크는 아직 안 만듦)
 *   4) 상담접수 행을 status='승인' + studentUuid로 갱신
 * 을 수행한다.
 *
 * 재시도해도 중복 생성되지 않는다 — Google Sheets엔 트랜잭션이 없으므로, 매 단계
 * 시작 전 intakeId/caseId로 기존 레코드를 먼저 찾고 없는 단계만 이어서 완료한다.
 * 이미 `승인`된 접수를 다시 승인 요청하면 아무것도 새로 만들지 않고 기존 결과만
 * 돌려준다. `반려`된 접수는 승인할 수 없다(legacy에는 반려 자체가 없지만, 반려된
 * 건을 다시 승인하는 것은 v1에서도 허용하지 않는다).
 */
export const onRequestPost: PagesFunction<Env, 'intakeId'> = async ({ request, env, params }) => {
  const access = await requireSchoolWorkspaceAccess(request, env)
  if (isAccessError(access)) {
    return Response.json({ error: access.error }, { status: access.status })
  }

  const intakeId = getIntakeIdParam(params)
  if (!intakeId) {
    return Response.json({ error: 'invalid_input' }, { status: 400 })
  }

  const { accessToken, spreadsheetId, installation } = access

  try {
    const intake = await getIntake(accessToken, spreadsheetId, intakeId)
    if (!intake) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    if (intake.status === INTAKE_STATUS_REJECTED) {
      return Response.json(
        { error: 'invalid_transition', currentStatus: intake.status },
        { status: 409 },
      )
    }

    // 1) 케이스가 이미 있으면(재시도) 그대로 재사용 — 학생 매칭도 다시 하지 않는다.
    let caseRecord = await findCaseByIntakeId(accessToken, spreadsheetId, intakeId)
    let studentUuid = intake.studentUuid || caseRecord?.studentUuid || ''

    if (!studentUuid) {
      const matched = await findStudentForCaseApproval(
        accessToken,
        spreadsheetId,
        intake.name,
        intake.schoolYear,
        intake.grade,
        intake.class,
        intake.studentNumber,
      )
      if (matched) {
        studentUuid = matched.studentUuid
      } else {
        const created = await createStudent(accessToken, spreadsheetId, {
          tenantId: installation.schoolPublicId,
          name: intake.name,
          schoolYear: intake.schoolYear,
          grade: intake.grade,
          class: intake.class,
          studentNumber: intake.studentNumber,
        })
        studentUuid = created.studentUuid
      }
    }

    // 2) 케이스 생성(없을 때만) — Drive 폴더도 이 단계에서 함께 만든다.
    if (!caseRecord) {
      if (!installation.rootFolderId) {
        return Response.json({ error: 'installation_incomplete' }, { status: 500 })
      }
      const caseId = crypto.randomUUID()
      const folders = await ensureCaseFolders(accessToken, installation.rootFolderId, intake.schoolYear, caseId)
      caseRecord = await createCase(accessToken, spreadsheetId, {
        caseId,
        tenantId: installation.schoolPublicId,
        studentUuid,
        intakeId,
        schoolYear: intake.schoolYear,
        topic: intake.topic,
        referralType: intake.applicantType,
        managerEmail: access.session.email,
        driveFolderUrl: folders.caseFolderUrl,
        openedAt: intake.submittedAt,
      })
    }

    // 3) 보호자동의 골격 생성(없을 때만) — 동의 링크는 별도 액션(Step C/D)에서 만든다.
    let consentRecord = await findConsentByCaseId(accessToken, spreadsheetId, caseRecord.caseId)
    if (!consentRecord) {
      consentRecord = await createConsentSkeleton(accessToken, spreadsheetId, {
        tenantId: installation.schoolPublicId,
        intakeId,
        caseId: caseRecord.caseId,
        studentUuid,
        guardianContact: intake.contactInfo,
      })
    }

    // 4) 상담접수 행 갱신(이미 승인 상태면 그대로 반환, 다시 쓰지 않음).
    const approveResult = await approveIntakeWithStudent(accessToken, spreadsheetId, intakeId, studentUuid)
    if (!approveResult.ok) {
      if (approveResult.error === 'not_found') {
        return Response.json({ error: 'not_found' }, { status: 404 })
      }
      return Response.json(
        { error: 'invalid_transition', currentStatus: approveResult.currentStatus },
        { status: 409 },
      )
    }

    return Response.json({
      intake: approveResult.intake,
      case: caseRecord,
      consent: consentRecord,
      alreadyApproved: approveResult.alreadyApproved,
    })
  } catch (error) {
    if (
      error instanceof IntakeSheetSchemaError ||
      error instanceof StudentSheetSchemaError ||
      error instanceof CaseSheetSchemaError ||
      error instanceof ConsentSheetSchemaError
    ) {
      console.error('[intakes] approve schema error', error.missingHeaders)
      return Response.json(
        { error: 'intake_sheet_missing_headers', missingHeaders: error.missingHeaders },
        { status: 500 },
      )
    }
    if (error instanceof GoogleApiError) {
      console.error('[intakes] approve failed', error.status, error.detail)
      if (error.status === 400 || error.status === 404) {
        return Response.json({ error: 'intake_sheet_not_found' }, { status: 500 })
      }
      return Response.json({ error: 'sheets_unavailable' }, { status: 502 })
    }
    throw error
  }
}
