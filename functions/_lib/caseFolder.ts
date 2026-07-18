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
 * 보호자동의서 PDF는 케이스별 중첩 폴더가 아니라 루트 바로 아래
 * `03_보호자동의서`(installTemplate.ts의 SUBFOLDER_NAMES) 폴더에 평탄하게 저장한다
 * (요구사항 5·7절 — 폴더 구조를 한눈에 알아볼 수 있게, 파일명은 StudentID 기반).
 * setupOrchestrator.ts가 설치 시 이미 이 폴더를 만들어 두므로 대개는 찾기만 한다.
 */
export async function ensureConsentPdfFolder(accessToken: string, rootFolderId: string): Promise<string> {
  return findOrCreateFolder(accessToken, '03_보호자동의서', rootFolderId)
}

/**
 * AI 분석 결과 중 사람이 다시 확인할 수 있는 형태로 별도 저장하고 싶을 때 쓰는 폴더
 * (요구사항 9·10절 "04_비식별_분석결과") — 원본 PDF나 학생 이름을 포함하지 않는
 * 산출물만 여기 저장한다.
 */
export async function ensureDeidentifiedResultFolder(accessToken: string, rootFolderId: string): Promise<string> {
  return findOrCreateFolder(accessToken, '04_비식별_분석결과', rootFolderId)
}
