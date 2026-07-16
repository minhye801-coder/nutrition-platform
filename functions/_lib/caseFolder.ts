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
