# 브라우저만으로 사용하는 서버 배포

개인 PC를 계속 켜두거나 직접 서버를 소유할 필요는 없습니다. **Render 같은 관리형 웹 호스팅 + 관리형 Judge0 C# 실행 서비스**를 사용합니다. 접속하는 PC에는 브라우저만 있으면 됩니다. Unity 에디터가 필요한 실습은 별도입니다.

현재 저장소에는 배포 코드가 준비되어 있습니다. 실제 인터넷 서비스가 생성된 상태는 아닙니다. 이 작업 환경에는 호스팅 계정·GitHub OAuth App·Judge0 키가 연결되어 있지 않습니다. 이 값들은 각 서비스 설정 화면에 입력하고, 채팅이나 Git에 올리지 마세요.

## 가장 먼저 할 일

1. [Render](https://dashboard.render.com/)에 GitHub 계정으로 로그인합니다.
2. Render의 새 Web Service 생성 화면을 엽니다.
3. `tools/learning-site/render.yaml`의 웹 서비스와 영구 디스크를 확인합니다. **Starter 서비스·디스크·채점 API는 선택한 요금제와 사용량에 따라 비용이 발생합니다. 생성 화면의 현재 금액을 확인한 후 진행하세요.** 이 문서만으로 결제나 서비스 생성은 이루어지지 않습니다.

Blueprint 대신 수동으로 Web Service를 만들면 GitHub 저장소 `MyoungJoonKim/gamedev-lab`, Dockerfile `tools/learning-site/deploy/Dockerfile.web`, 헬스 체크 `/healthz`, 영구 디스크 `/app/data`를 사용합니다. 서비스 URL이 정해지면 아래 설정을 마치고 배포하세요. 값이 비어 있는 동안 시작이 실패하는 것은 공개 로컬 채점기를 실수로 실행하지 않기 위한 동작입니다.

## GitHub 본인 로그인 설정

[GitHub OAuth Apps](https://github.com/settings/developers)에서 New OAuth App을 만듭니다.

- Homepage URL: Render가 발급한 `https://서비스이름.onrender.com`
- Authorization callback URL: `https://서비스이름.onrender.com/auth/github/callback`
- Client ID와 새 Client Secret을 Render의 Environment에 각각 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`으로 입력
- `ALLOWED_GITHUB_LOGIN=MyoungJoonKim` 유지. 계정명이 다르면 본인 계정명으로 변경
- 가능하면 `ALLOWED_GITHUB_ID`에 본인 숫자 사용자 ID도 설정. 없으면 첫 정상 로그인에서 계정 ID를 DB에 고정하여 이후 이름 변경·이름 재사용으로 다른 계정이 들어오지 못하게 함

Render에서는 `RENDER_EXTERNAL_URL`이 공개 주소로 자동 사용됩니다. 커스텀 도메인이나 다른 호스팅에서는 `PUBLIC_BASE_URL`을 HTTPS 주소로 설정하고 OAuth callback도 같은 주소로 변경하세요. GitHub OAuth는 프로필 확인만 요청하며 저장소 접근·자동 push 권한을 요청하지 않습니다.

## 관리형 C# 채점 서비스 설정

Judge0를 제공하는 호스팅/API 서비스에 가입해 API 접근을 준비합니다. 예를 들어 RapidAPI의 Judge0 CE 제공 서비스를 사용할 수 있습니다. 공급자 요금·쿼터·격리 정책·소스 보관 정책을 확인하세요. 채점할 때 **풀이 코드와 공개된 테스트 코드가 해당 서비스로 전송**됩니다. 이 사이트의 로그인 토큰·DB·OAuth 비밀 키는 제출 프로그램에 포함되지 않습니다.

Render Environment에 다음을 설정합니다.

| 이름 | 값 |
|---|---|
| `GRADER_BACKEND` | `judge0` |
| `JUDGE0_URL` | 계약한 서비스의 HTTPS API 기본 주소. RapidAPI 예: `https://judge0-ce.p.rapidapi.com` |
| `JUDGE0_LANGUAGE_ID` | 해당 서비스 `/languages` 목록의 C# ID. 예시 51은 Mono C#이며 공급자별 목록을 먼저 확인 |
| `JUDGE0_RAPIDAPI_KEY` | RapidAPI 사용 시 서비스 키. 서비스 설정에만 보관 |
| `JUDGE0_AUTH_TOKEN` | RapidAPI가 아닌 일반 Judge0가 이 헤더 인증을 요구할 때만 사용 |

일부 서비스의 C#은 Mono 기반으로 최신 .NET과 지원 문법/API가 다릅니다. 포켓·슬롯 실습의 기본 문법에 맞춰 제공되며, 최신 .NET 기능은 공급자의 지원 런타임을 확인하세요. 앱은 `/languages`에서 C# 런타임인지 확인하고 요청에 네트워크 비활성화, CPU·시간·메모리·출력 제한을 지정합니다. 실제 격리는 공급자 서비스가 수행하므로 운영자가 신뢰할 수 있는 공급자를 선택해야 합니다.

공개 서버 모드에서는 이 연결이 없을 때 로컬 프로세스로 코드를 실행하는 우회 경로가 없습니다.

## 기록 저장과 배포 확인

- `APP_MODE=hosted`, `NODE_ENV=production`, `DATA_DIR=/app/data`를 유지합니다.
- `/app/data`는 **영구 디스크**여야 합니다. 임시 파일시스템에서는 재배포 시 기록과 소유자 고정 정보가 사라집니다.
- 같은 서비스는 단일 인스턴스로 운영합니다. 여러 독립 디스크를 가진 인스턴스로 수평 확장하지 않습니다.
- 배포 후 `/healthz`가 응답하고 첫 화면에 GitHub 로그인이 표시되는지 확인합니다.
- 본인 계정만 로그인 가능한지 확인하고, 첫 포켓 풀이의 정상/경계 버그를 실제 채점합니다.
- 다른 PC/시크릿 창에서 동일 계정으로 로그인해 같은 코드와 기록이 나타나는지 확인합니다.
- 다른 PC에서 먼저 수정한 상태로 오래된 탭에서 저장하면 충돌 안내가 표시됩니다. 현재 PC 기록을 백업한 후 최신 서버 기록을 불러오세요.
- 네트워크 실패 시 미전송 변경은 해당 브라우저에 임시 보관합니다. 저장 재시도 또는 JSON 백업으로 보호하세요. ‘서버에 저장됨’이 표시되기 전에는 브라우저를 닫지 않는 것이 좋습니다.
- 기존 로컬 기록은 로컬 사이트에서 JSON 백업한 뒤 배포 사이트의 ‘학습 기록 → 백업 복원’으로 옮길 수 있습니다. 브라우저 기록을 자동 업로드하지 않습니다.
- DB가 영구 저장되어도 정기적으로 JSON 백업을 보관하세요. 서비스를 삭제할 때 디스크 삭제 여부를 확인하세요.

## 검증 범위

이 개발 환경에서는 실제 SQLite·HTTP 서버에서 OAuth state·세션·허용 계정·CSRF·기록 공유·충돌 처리를 검증했습니다. 브라우저의 두 독립 세션으로 서버 저장과 재시도를 테스트했습니다. GitHub 공급자 응답과 채점 API는 테스트에서 대체했으며, 실제 GitHub OAuth/유료 호스팅/관리형 채점 API 연결은 아직 수행하지 않았습니다. 원격으로 보낼 C# 테스트 프로그램은 로컬 .NET에서 실제 컴파일·실행했습니다.

라이브 접속 주소와 온라인 자동 채점 완료 여부는 위 계정 설정과 실제 배포 후에 확인할 수 있습니다.
