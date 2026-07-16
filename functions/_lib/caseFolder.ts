import { findOrCreateFolder } from './googleDrive'

/**
 * legacy `createCaseFolder_`(counseling-manager/code.gs.txt:5815)와 동일한 폴더 트리를
 * 만든다: 루트폴더/{학년도}학년도/{caseId}/02_보호자동의. legacy는 케이스 폴더 아래
 * 6개 하위폴더(01_접수~06_상담결과)를 한 번에 만들지만, 이번 마일스톤(상담접수→
 * 보호자동의)에 실제로 필요한 하위폴더는 "02_보호자동의" 하나뿐이라 그것만 만든다
 * — 나머지는 각 기능이 실제로 필요해지는 시점에 같은 방식(findOrCreateFolder)으로
 * 자가치유하듯 만들면 된다(설치 오케스트레이터의 최상위 폴더 생성 로직과는 무관).
 */
export interface CaseFolders {
  caseFolderId: string
  caseFolderUrl: string
  consentFolderId: string
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

/**
 * `상담케이스.driveFolderUrl`(`driveFolderUrl()`이 만든 형태)에서 폴더 ID를 다시
 * 뽑아낸다 — legacy `extractDriveId_`(intake-consent 쪽이 `상담케이스.Drive폴더URL`만
 * 보고 하위 폴더를 찾아가던 것과 동일한 패턴, docs/google-data-inventory.md 60번 줄
 * 참고). 케이스 생성 이후에는 caseFolderId를 별도로 저장하지 않으므로, 이후 단계
 * (검사결과 업로드 등)에서 하위 폴더가 필요할 때마다 URL에서 역산한다.
 */
export function extractFolderIdFromUrl(url: string): string | null {
  const match = url.match(/\/folders\/([^/?]+)/)
  return match ? match[1] : null
}

export async function ensureCaseFolders(
  accessToken: string,
  rootFolderId: string,
  schoolYear: string,
  caseId: string,
): Promise<CaseFolders> {
  const yearFolderId = await findOrCreateFolder(accessToken, `${schoolYear}학년도`, rootFolderId)
  const caseFolderId = await findOrCreateFolder(accessToken, caseId, yearFolderId)
  const consentFolderId = await findOrCreateFolder(accessToken, '02_보호자동의', caseFolderId)
  return { caseFolderId, caseFolderUrl: driveFolderUrl(caseFolderId), consentFolderId }
}

/**
 * legacy 6개 하위폴더 중 "03_공식진단"(uploadCaseFile()이 검사결과 원본 PDF를 올리던
 * 폴더, docs/google-data-inventory.md 53번 줄)에 해당한다. caseFolderUrl은 호출부가
 * 이미 CaseRecord.driveFolderUrl로 갖고 있으므로 extractFolderIdFromUrl로 ID만 뽑아
 * 넘겨준다.
 */
export async function ensureAssessmentFolder(accessToken: string, caseFolderId: string): Promise<string> {
  return findOrCreateFolder(accessToken, '03_공식진단', caseFolderId)
}

/**
 * 케이스 생성 시 `ensureCaseFolders`가 이미 만들어 두는 "02_보호자동의" 폴더를 다시
 * 찾는다(같은 이름을 findOrCreateFolder에 다시 넘기면 기존 폴더를 그대로 재사용) —
 * 보호자 제출 시점엔 caseFolderId만 갖고 있으므로(consentFolderId는 별도 저장하지
 * 않음) 매번 이렇게 다시 찾아간다. legacy `createConsentPdf_`(intake-consent/
 * code.gs.txt:188)와 동일한 폴더.
 */
export async function ensureConsentFolder(accessToken: string, caseFolderId: string): Promise<string> {
  return findOrCreateFolder(accessToken, '02_보호자동의', caseFolderId)
}
