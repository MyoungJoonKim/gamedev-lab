# 개발 지침

이 저장소의 목적은 특정 게임의 개발이 아니라, 여러 장르에 공통인 기능을 풀고 검증하는 개인 학습 기록이다. 사용자 지시를 우선하며 기존 작업과 풀이를 보존한다.

## 저장소 역할

- `solutions/`: GitHub에서 보여 줄 문제·본인 풀이 Markdown. 학습 결과의 중심이다.
- `tools/learning-site/`: 로컬 학습 웹사이트, 채점기, 테스트, 개발 문서.
- `unity/`: Unity 실습 프로젝트. Unity Hub에서는 저장소 루트가 아닌 이 폴더를 연다.
- `README.md`: 학습 기록의 목적과 과정만 소개한다. 설치·개발 지침을 늘리지 않는다.
- `AGENTS.md`: 개발 환경·규칙·검증 절차를 관리한다.

각 클라우드 작업은 이미 격리되어 있다. 사용자가 요청하지 않으면 Git worktree를 만들지 않는다.

## 로컬 실행

Node.js 24 이상, C# 채점에는 .NET SDK 8 이상이 필요하다. 외부 npm 패키지는 없다. 저장소 루트에서 실행한다:

```powershell
npm.cmd start
```

포트는 기본 3000, 바인딩은 127.0.0.1이다. `PORT`로 포트를 바꿀 수 있다. 사이트 이용 중 PowerShell 창을 유지하며 최소화는 가능하다. Ctrl+C 또는 창 종료 시 서버가 꺼진다. 업데이트는 서버를 멈추고 `git pull origin main` 후 다시 시작한다.

Linux x86_64의 SDK 설치는 `bash tools/learning-site/tooling/install-dotnet.sh`를 사용한다. 공식 체크섬과 TLS 검증을 유지한다. SDK는 저장소 밖의 상위 `.tools/dotnet`에 저장되며 `GAMEDEV_DOTNET_DIR` 또는 시스템 PATH의 SDK도 사용할 수 있다.

## 학습 데이터와 일일 목표

한국 시간(Asia/Seoul)으로 날짜를 구분한다. 초기 문제 라이브러리는 유지한다. 일일 문제는 별도 버전 고정 생성기로 입문·초급·중급 각 1개를 할당한다. 기능별 규칙과 날짜별 조건을 조합하며 외부 AI 실시간 창작으로 설명하지 않는다. 미완료 일일 문제는 ID와 초안을 유지해 다음 방문일에도 이어주고, 완료된 난이도만 다음 날 새 ID로 생성한다. 같은 날에는 통과해도 교체하지 않는다. 기존 날짜의 초기 문제 할당은 보존하되 새 날짜에는 재사용하지 않는다. 실제 채점 통과만 당일 달성에 반영하고 같은 문제의 중복 통과는 한 개로 센다. 기존 날짜의 할당을 임의로 재계산하거나 과거 완료를 꾸며내지 않는다.

로컬 기록은 브라우저 localStorage에 저장한다. 기기·브라우저·포트가 달라지거나 데이터를 지우기 전 JSON 백업이 필요하다. 개별 기록 삭제는 초안·일일 달성·이미 게시한 Git 파일을 삭제하지 않는다. 복원은 기록 ID 중복을 제거하고 일일 할당을 보존하여 병합한다.

## 일자별 Git 기록 규칙

- `학습 기록 → 일자별 커밋 자동 작성`에서 날짜별 summary·description을 생성한다.
- 각 날짜는 별도 커밋이며 같은 날짜·같은 문제는 마지막 기록의 코드만 사용한다.
- 폴더는 `solutions/01_집기_인벤토리_체력/`처럼 순번과 기능을 사용한다. 최초 정한 폴더·파일 번호는 유지하며 과거 날짜를 추가해도 기존 번호를 바꾸지 않는다.
- `solutions/.learning-days.json`은 날짜·폴더·파일 해시를 관리한다. 자동 생성 도구 외에서 변경하면 충돌을 확인해야 한다.
- Markdown에는 문제·요구사항과 본인 풀이 코드만 넣는다. 날짜는 문제 항목에 표시한다. 분석 노트·피드백·테스트 결과·AI 도움 기록을 Markdown에 추가하지 않는다.
- 커밋 형식은 `.gitmessage`와 `tools/learning-site/docs/commit-convention.md`를 따른다. summary의 날짜와 description의 이유·변경·검증을 유지한다. 검증되지 않은 결과를 통과라고 쓰지 않는다.
- 생성 내용과 origin·브랜치를 검토한 뒤 사용자가 버튼을 눌러야 커밋·푸시한다. 저장만으로 자동 업로드하지 않는다.
- 기존 작업·스테이징을 보존한다. 선택 날짜의 풀이와 폴더 정보 파일만 커밋하며 관련 없는 미업로드 커밋을 함께 푸시하지 않는다. force push·자동 reset/rebase·Git 인증정보 저장은 하지 않는다.
- 같은 날 추가 풀이가 생기면 같은 폴더를 업데이트하는 추가 커밋을 만든다. 이미 게시된 커밋을 amend하지 않는다.
- 푸시 실패 시 로컬 커밋을 유지하고 재시도한다. 처음 한 번 Git 작성자와 GitHub 인증을 로컬 Git에 설정해야 할 수 있다. 비밀 키는 채팅·코드·커밋에 넣지 않는다.

## 편집기와 채점기

C# 색상 표시와 괄호·따옴표 자동 닫기, Enter 들여쓰기, Tab/Shift+Tab, 선택 영역 감싸기, 되돌리기를 지원한다. 코드 원문·IME 조합·커서·스크롤을 보존한다. 주석·문자열 안에서 코드용 자동 삽입이 발생하지 않도록 한다. 전체 C# 컴파일러의 의미 분석 기능으로 설명하지 않는다.

12개 기초 문제는 실제 .NET으로 테스트한다. Unity 실습은 로컬 Test Runner 결과 XML을 가져온다. 외부 보고서는 사용자가 제공한 증거이며 진위와 코드 대응을 독립적으로 인증하지 않는다. 코드 변경 시 기존 결과는 재검증이 필요하다. 문제별 학습 가이드는 실제 자동 코드 리뷰·성능 측정 결과와 구분한다.

로컬 C# 실행기는 사용자 본인 코드용이며 파일·네트워크 접근을 격리하지 않는다. 공개 서비스로 노출하지 않는다. 선택적 hosted 모드는 GitHub 본인 로그인·영구 디스크·관리형 격리 채점 서비스가 필요하며 로컬 Git 커밋 기능을 제공하지 않는다. 자세한 선택 설정은 `tools/learning-site/docs/hosting.md`에 있다. 현재 기본은 로컬 이용이며 호스팅 계정이나 API 키는 필요 없다.

## Unity

에디터 버전은 `unity/ProjectSettings/ProjectVersion.txt`를 따른다 (2022.3.62f3). 패키지는 `unity/Packages/manifest.json`을 확인한다. Unity MCP 패키지 등록과 실행 중인 MCP 연결을 혼동하지 않는다. 실제 에디터를 실행하지 않았다면 Unity 테스트 통과를 주장하지 않는다. 에셋 이동 시 `.meta`를 함께 보존하고 Library·Temp·개인 설정은 커밋하지 않는다.

## 검증

저장소 루트에서:

```sh
npm run check
npm test
npm run test:learning
npm run test:editor
npm run test:hosted
```

실행 중인 로컬 서버와 Python Playwright, `/usr/bin/chromium`이 있는 경우:

```sh
python3 tools/learning-site/tests/browser_smoke.py
python3 tools/learning-site/tests/editor_browser.py
python3 tools/learning-site/tests/editor_input_browser.py
python3 tools/learning-site/tests/learning_browser.py
```

Git 통합 검사는 임시 저장소와 로컬 bare remote를 사용한다. 실제 사용자 저장소에 테스트 풀이를 푸시하지 않는다. 변경에 맞는 검증을 실행하고 통과·실패·미실행을 구분한다. 사용자 풀이를 만들었다고 가장하거나 완료 기록을 발명하지 않는다.
