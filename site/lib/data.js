export const stages = [
  { title: '코드의 흐름 읽기', sub: '조건 · 반환값 · 상태 변화', ref: '01–02', goal: '같은 인스턴스의 두 번의 호출과 경계값을 설명한다.' },
  { title: '디버거로 원인 찾기', sub: '중단점 · 변수 · 호출 스택', ref: '12', goal: '예상과 실제가 처음 달라지는 줄을 중단점과 변수 값으로 찾는다.' },
  { title: 'Unity 실행 구조', sub: '생명주기 · Inspector · 물리', ref: '05–06', goal: '코드 결함과 참조·직렬화·레이어 설정 문제를 구분한다.' },
  { title: '이벤트와 UI', sub: '발행 · 구독 · 해제', ref: '07 · 13.2', goal: '현재 값 초기 표시와 변경 표시를 분리하고 중복 구독을 해결한다.' },
  { title: '비동기와 수명', sub: '완료 · 실패 · 취소', ref: '14.7', goal: '중복 실행과 화면 종료, 예외 발생 후의 상태를 검증한다.' },
  { title: '디버깅 실전', sub: '재현 · 가설 · 근거 · 수정', ref: '11–12', goal: '처음 보는 기능을 추적하고 최소 수정 후 회귀 테스트한다.' },
  { title: '측정하고 최적화하기', sub: 'Profiler · CPU · GC Alloc', ref: '14.9–14.10', goal: '동일 조건에서 정확성을 유지하며 CPU와 할당량을 각각 비교한다.' },
  { title: 'NGO 권한과 동기화', sub: 'Owner 입력 · Host 판정 · Client 반영', ref: '09–10 · 13.4', goal: 'RPC 요청과 지속 상태, 로컬 이벤트를 구분하고 늦은 참가를 검증한다.' }
];
export const problems = [
  { id:'pocket', stage:0, title:'나무를 포켓에 담기', sub:'경계값 하나가 만드는 차이', level:'입문', minutes:25, tags:['C#','조건문','상태 변화'], runner:true,
    text:'House Haulers의 파밍 기능을 구현합니다. 나무는 최대 5개까지 보관할 수 있습니다. 같은 포켓에서 집기를 반복해도 한도를 넘지 않도록 만들어 보세요.',
    requirements:['초기 나무 수량은 4개입니다.','성공하면 수량을 1 증가시키고 true를 반환합니다.','이미 5개이면 수량을 유지하고 false를 반환합니다.','WoodCount는 현재 수량을 반환하는 읽기 전용 프로퍼티입니다.'],
    cases:[['첫 번째 집기','초기 수량 4','5 / true'],['가득 찬 포켓','다시 한 번 집기','5 / false'],['반복 요청','100회 호출','성공 1회, 수량 5']],
    code:'public class PocketPractice\n{\n    private int woodCount = 4;\n    private const int MaxWoodCount = 5;\n\n    public int WoodCount => woodCount;\n\n    public bool TryPickUpWood()\n    {\n        // 조건을 확인하고 상태와 반환값을 결정하세요.\n        return false;\n    }\n}\n',
    hint:'return은 현재 함수의 실행을 끝냅니다. count > 5와 count >= 5는 정확히 5개일 때 어떻게 다를까요?',
    feedback:'단일 아이템의 수량만 관리하는 이 문제는 정수 카운터로 충분합니다. 이미 정수만 사용한다면 자료구조를 바꿀 필요가 없습니다. List·Dictionary는 여러 종류의 아이템을 관리하는 별도 요구사항이 생길 때 검토하세요.' },
  { id:'slots', stage:0, title:'고정 슬롯에 아이템 쌓기', sub:'자료구조를 선택하는 이유', level:'기초', minutes:40, tags:['배열','자료구조','경계값'], runner:true,
    text:'4칸 인벤토리에 나무를 넣습니다. 슬롯마다 최대 5개이며 앞 슬롯부터 채웁니다. 같은 인스턴스의 기존 수량을 유지하고 넣지 못한 수량을 반환하세요.',
    requirements:['새 인스턴스의 4개 슬롯은 모두 비어 있습니다.','AddWood(int amount)는 앞 슬롯부터 채우고 남은 수량을 반환합니다.','GetCount(int index)는 해당 슬롯의 수량을 반환합니다.','0 또는 음수 요청은 상태를 바꾸지 않고 0을 반환합니다.'],
    cases:[['묶음 채우기','AddWood(7)','[5, 2, 0, 0], 잔여 0'],['공간 부족','AddWood(23)','[5, 5, 5, 5], 잔여 3'],['반복 추가','AddWood(4), AddWood(3)','[5, 2, 0, 0]']],
    code:'public class SlotPractice\n{\n    private readonly int[] counts = new int[4];\n    public int GetCount(int index) => counts[index];\n\n    public int AddWood(int amount)\n    {\n        // 앞 슬롯부터 최대 5개씩 채우세요.\n        return amount;\n    }\n}\n',
    hint:'남은 수량과 각 슬롯의 남은 공간을 비교해 실제로 넣을 수량을 계산하세요.',
    feedback:'고정 4칸은 배열이나 짧은 순회가 단순합니다. ID 검색이 잦은 대규모 창고를 만들 때 Dictionary의 추가 유지 비용과 조회 이점을 측정해 비교하세요.' },
  { id:'breakpoint',stage:1,title:'집기를 거부한 진짜 이유',sub:'예상과 실제가 달라지는 첫 지점',level:'기초',minutes:30,tags:['Visual Studio','디버깅'],text:'입력은 들어오지만 나무가 추가되지 않습니다. 입력→대상→집기→UI 흐름에서 마지막으로 정상 실행된 지점을 찾으세요.',requirements:['중단점에서 수량·대상·거리 값을 확인합니다.','Locals, Watch, Call Stack으로 호출 경로를 기록합니다.','원인과 관계있는 부분만 수정하고 정상·거부 조건을 재확인합니다.'],cases:[['정상','거리 안 + 공간 있음','집기 성공'],['거부','포켓 가득 참','거부 이유 확인']],hint:'멀티플레이 중단점은 타임아웃에 영향을 줍니다. 플레이어 ID와 거부 사유 로그도 함께 남기세요.',feedback:'로그를 많이 찍기보다 예상과 실제가 달라지는 단계의 값과 호출자를 확인하세요.'},
  { id:'raycast',stage:2,title:'사라진 상호작용 대상',sub:'코드 밖에서 생기는 버그',level:'기초',minutes:30,tags:['Raycast','Inspector'],text:'눈앞의 자원이 Raycast에 감지되지 않습니다. 코드와 Inspector 설정을 나누어 확인해 보세요.',requirements:['원점·방향·최대 거리와 LayerMask를 기록합니다.','Collider 누락과 가리는 벽을 확인합니다.','거리 밖이나 벽 뒤의 자원은 집지 못해야 합니다.'],cases:[['정상','올바른 Layer + 거리 안','감지'],['벽 뒤','가리는 Collider','집기 거부']],hint:'Debug.DrawRay와 실제 Raycast 길이가 같은지 확인하세요.',feedback:'반복 탐색 비용을 줄이기 전에 탐색 조건과 결과 정확성부터 확인하세요.'},
  { id:'events',stage:3,title:'체력 UI가 두 번 갱신된다',sub:'구독에는 시작과 끝이 있다',level:'기초',minutes:35,tags:['event','생명주기'],text:'UI를 다시 열 때마다 콜백 실행 횟수가 증가합니다. 발행자와 구독자의 수명을 추적하세요.',requirements:['OnEnable의 구독과 OnDisable의 해제를 맞춥니다.','활성화 시 현재 체력을 즉시 표시합니다.','세 번 재활성화 후 이벤트당 한 번만 실행됩니다.'],cases:[['초기 표시','HP 70에서 UI 열기','즉시 70 표시'],['재활성화','3회 재활성화 → 피해 1회','변경 콜백 1회']],hint:'새 람다를 만들어 -= 하면 원래 구독을 제거할 수 있을까요?',feedback:'Host에서 발생한 일반 C# event는 Client로 자동 전달되지 않습니다. 로컬 표시와 네트워크 동기화를 분리하세요.'},
  { id:'async',stage:4,title:'중복 로딩 요청 막기',sub:'완료보다 먼저 화면을 닫는다면',level:'중급',minutes:40,tags:['async/await','취소'],text:'로딩 중 버튼을 여러 번 누르거나 화면을 닫아도 데이터와 UI 상태가 꼬이지 않도록 구현하세요.',requirements:['동시 요청을 중복 시작하지 않습니다.','성공·실패·취소 후 로딩 상태를 정리합니다.','화면 종료 후 UI에 늦은 결과를 적용하지 않습니다.'],cases:[['반복 요청','버튼 5회','실행 1회'],['실패','I/O 예외','재시도 가능'],['화면 종료','진행 중 취소','종료 후 UI 갱신 없음']],hint:'CancellationToken의 소유자와 finally에서 정리할 상태를 먼저 정하세요.',feedback:'async는 자동 멀티스레드나 성능 개선을 뜻하지 않습니다. Unity API는 메인 스레드 제약을 확인하세요.'},
  { id:'trace',stage:5,title:'포켓에는 있는데 UI에는 없다',sub:'처음 보는 코드 분석 보고서',level:'중급',minutes:45,tags:['재현','가설','회귀 검증'],text:'데이터는 바뀌었지만 UI에 반영되지 않습니다. 처음 보는 기능이라고 생각하고 재현부터 수정 검증까지 기록하세요.',requirements:['다른 사람이 따라할 수 있는 재현 순서를 씁니다.','상태 변경·이벤트 발행·구독·UI 갱신 경로를 추적합니다.','최소 수정 후 재접속·재활성화 조건도 확인합니다.'],cases:[['집기','상태 증가','UI 수량 증가'],['다시 열기','기존 포켓 표시','현재 값 표시']],hint:'이벤트 구독 전에 상태가 이미 변경됐다면 어떻게 초기 표시를 할까요?',feedback:'반증된 가설도 남겨보세요. 무엇을 보고 원인 범위를 줄였는지 설명하는 것이 중요합니다.'},
  { id:'profiler',stage:6,title:'주변 자원 탐색 비용 줄이기',sub:'추측을 측정으로 바꾸는 연습',level:'중급',minutes:45,tags:['Profiler','GC Alloc'],text:'매 프레임 탐색하는 기능을 측정합니다. 결과를 유지하면서 CPU와 메모리 할당 비용을 각각 비교하세요.',requirements:['대상 수·호출 빈도·씬·빌드·기기를 고정합니다.','CPU ms와 GC Alloc B를 반복 측정합니다.','NonAlloc 버퍼 포화 시 누락 정책을 검증합니다.'],cases:[['소규모','대상 4개','동일 검색 결과'],['대규모','대상 1,000개','수정 전후 측정'],['버퍼 한도','반환 수 = 버퍼 길이','누락 가능성 확인']],hint:'NonAlloc은 새 배열 할당을 줄여도 검색 계산 자체를 없애지는 않습니다.',feedback:'Editor 자체 오버헤드를 구분하고 Development Build에서 다시 측정하세요. 풀링과 주기 조절은 측정 후 선택합니다.'},
  { id:'ngo',stage:7,title:'두 사람이 같은 망치를 집는다면',sub:'요청과 확정 상태의 경계',level:'중급',minutes:50,tags:['NGO','권한','RPC'],text:'두 Client가 같은 망치를 동시에 요청합니다. Host가 보유자를 결정하고 늦게 참가한 Client도 동일한 상태를 보아야 합니다.',requirements:['서버가 RPC의 실제 발신자와 거리·점유를 검증합니다.','보유자 상태는 Host만 확정합니다.','현재 상태 초기 표시와 OnValueChanged 구독·해제를 처리합니다.'],cases:[['동시 요청','A/B가 집기','보유자는 한 명'],['늦은 참가','이미 장착됨','현재 상태 표시']],hint:'RequireOwnership=false는 검증을 생략하라는 뜻이 아닙니다. 설치된 NGO 버전의 RPC 문법을 확인하세요.',feedback:'망치 하나에는 우선 하나의 NetworkObject 상태를 유지하세요. 반복 스폰 병목을 측정한 뒤 풀링을 검토합니다.'}
].map(p=>({...p,runner:!!p.runner,code:p.code||'// Unity 프로젝트에서 구현한 코드와 호출 경로를 기록하세요.\n'}));
export const quiz = [
 {q:'수량이 4개일 때 count >= 5 조건은?',options:['참','거짓','모르겠음'],answer:1,why:'4는 5보다 작으므로 거짓입니다. 이후의 증가 코드가 실행됩니다.'},
 {q:'성공 시 1을 추가합니다. 첫 호출 결과는?',options:['4 / false','5 / true','6 / true','모르겠음'],answer:1,why:'수량은 4에서 5로 증가하고 성공을 뜻하는 true를 반환합니다.'},
 {q:'같은 인스턴스에서 두 번째 호출 결과는?',options:['5 / false','6 / true','4 / true','모르겠음'],answer:0,why:'5 >= 5가 참이므로 false를 반환하며 종료합니다. 증가하지 않습니다.'},
 {q:'조건을 count > 5로 바꾸면 5개에서 집기 시?',options:['5 / false','6 / true','5 / true','모르겠음'],answer:1,why:'5 > 5는 거짓이므로 6개가 됩니다. 경계를 포함하는 >=가 필요합니다.'},
 {q:'Host의 일반 C# event는 어디에 전달되나요?',options:['모든 Client','해당 프로세스의 구독자','모르겠음'],answer:1,why:'프로세스 간 전달에는 RPC 또는 상태 동기화가 필요합니다.'},
 {q:'성능이 개선됐다고 판단할 근거는?',options:['Dictionary로 바꿨다','동일 조건에서 CPU·GC를 비교했다','async를 붙였다','모르겠음'],answer:1,why:'자료구조의 이름이 아니라 동일 조건의 실제 측정값으로 판단합니다.'}
];
