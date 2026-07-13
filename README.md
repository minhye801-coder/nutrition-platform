# nutrition-platform

여러 학교의 영양교사가 하나의 공용 사이트에서 각자의 Google 계정으로 로그인하여, 각자의 Google Sheets/Drive에 데이터를 저장하고, 본인의 Gemini API Key를 등록해 사용하는 범용 AI 영양 플랫폼입니다.

## 주요 모듈

1. **AI 영양상담 매니저** (`/app`)
2. **맛마을 탐험소** (`/explore`)
3. **상담신청 페이지** (`/intake`)
4. **보호자동의 페이지** (`/consent`)
5. **관리자 설정** (`/setup`)
6. **Google OAuth 연결**
7. **학교별 Google Sheets/Drive 자동 생성**
8. **Gemini API 사용자별 설정**

## 기술 스택

- **버전 관리**: GitHub
- **개발 환경**: GitHub Codespaces
- **배포**: Cloudflare Pages / Functions
- **데이터 저장소**: Google Sheets (학교별 데이터), Google Drive (학교별 문서/PDF)
- **백엔드 보조**: Google Apps Script (초기 단계, 문서/PDF 생성 및 기존 기능 연동용)

## 개발 원칙

- 학생 개인정보는 플랫폼 운영자 계정이 아닌 **학교별 Google Sheets/Drive**에 저장한다.
- API Key 등 민감정보는 GitHub나 브라우저에 저장하지 않고, 서버 측 안전한 저장소/환경변수로 관리한다.
- 공개 페이지(상담신청, 보호자동의)는 내부 리소스 ID를 노출하지 않고 `schoolPublicId`/token 기반으로 연결한다.
- 자세한 내용은 [`docs/security-principles.md`](docs/security-principles.md) 참고.

## 현재 개발 단계

**1단계 — 현재 구조 분석 및 초기 구조/문서화** 진행 중. 아직 실제 기능 코드(프레임워크, Cloudflare 설정, Google OAuth/API 연동)는 작성되지 않았습니다. 전체 단계는 [`docs/development-roadmap.md`](docs/development-roadmap.md) 참고.

## 폴더 구조

```
apps/
  app/           # AI 영양상담 매니저 모듈 (/app)
  explorer/      # 맛마을 탐험소 모듈 (/explore)
  intake/        # 상담신청 모듈 (/intake)
  consent/       # 보호자동의 모듈 (/consent)
  setup/         # 관리자 설정 모듈 (/setup)

functions/       # Cloudflare Functions (API 레이어)

google-apps-script/
  backend/         # Apps Script 백엔드 로직
  public-forms/    # Apps Script 기반 공개 폼 연동

packages/
  shared-ui/       # 모듈 간 공유 UI 컴포넌트
  shared-types/    # 모듈 간 공유 타입 정의
  sheet-schema/    # Google Sheets 스키마 정의/유틸

docs/            # 프로젝트 문서
```

## 문서

- [아키텍처](docs/architecture.md)
- [데이터베이스(Google Sheets) 스키마](docs/database-schema.md)
- [개발 로드맵](docs/development-roadmap.md)
- [보안 원칙](docs/security-principles.md)
- [기존 시스템 분석 (예정)](docs/current-system-analysis.md)

## 다음 작업

- 기존 AI 영양상담 매니저 / 맛마을 탐험소 / 상담신청·보호자동의 코드를 저장소에 반입하고 `docs/current-system-analysis.md` 기준으로 분석
- 2단계: Google OAuth 로그인 및 최초 설치 플로우 설계
- 3단계: 학교별 Google Sheets/Drive 자동 생성 로직 설계
