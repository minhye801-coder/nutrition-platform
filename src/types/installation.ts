export interface Installation {
  schoolName: string
  managerName: string
  schoolPublicId: string
  /** 완성된 Google Drive 폴더 URL. 서버가 root_folder_id로 만들어 내려준다(원본 ID는 노출하지 않음). */
  driveFolderUrl: string | null
  /** 완성된 상담데이터 Google Sheets URL(학생 이름 없음). 서버가 spreadsheet_id로 만들어 내려준다(원본 ID는 노출하지 않음). */
  spreadsheetUrl: string | null
  /** 완성된 학생식별정보 Google Sheets URL(이름 포함). 아직 분리 전(마이그레이션 전) 설치는 null. */
  identitySpreadsheetUrl: string | null
}
