export interface Installation {
  schoolName: string
  managerName: string
  schoolPublicId: string
  /** 완성된 Google Drive 폴더 URL. 서버가 root_folder_id로 만들어 내려준다(원본 ID는 노출하지 않음). */
  driveFolderUrl: string | null
  /** 완성된 Google Sheets URL. 서버가 spreadsheet_id로 만들어 내려준다(원본 ID는 노출하지 않음). */
  spreadsheetUrl: string | null
}
