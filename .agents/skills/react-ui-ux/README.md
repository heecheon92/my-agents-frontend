# React UI/UX Workflow

`react-ui-ux`는 제가 React/Next.js 화면을 설계, 구현 또는 검토할 때 일관된 비동기 UI/UX 원칙을 적용하도록 돕는 Skill입니다. 사용자의 동작에는 즉시 반응하면서도 서버에서 아직 확인되지 않은 값을 사실처럼 보여 주거나 중요한 변경을 허용하지 않는 화면을 만드는 데 초점을 둡니다.

이 문서는 사람을 위한 사용 안내입니다. 에이전트가 따르는 정확한 동작 규칙은 [SKILL.md](SKILL.md)와 `references/`의 영어 문서에 정의되어 있습니다.

## 적용 범위

개인적인 UI/UX 원칙을 대상 프로젝트의 실제 instruction, design, data contract와 기존 convention에 맞춰 적용합니다. 예제의 component, service, query key, copy와 cache 시간은 프로젝트 기본값이 아닙니다. TanStack Query 예제는 v5 형태의 API를 사용하므로 설치된 버전과 검증된 project helper를 먼저 확인합니다. Next.js 지침은 사용하는 router와 버전에 맞을 때만 적용하고, 검증은 요청에서 허용한 범위 안에서 수행하며 실행하지 못한 항목은 명시합니다.

## 어떤 요청에 사용하는가

다음과 같은 React 작업에 사용할 수 있습니다.

- 페이지, 목록, table, card 또는 master-detail 화면을 새로 구현할 때
- loading 중 화면 전체가 사라지거나 layout이 흔들리는 문제를 개선할 때
- Skeleton의 크기와 최종 content의 크기를 맞추고 싶을 때
- sheet나 drawer가 늦게 열리거나 detail fetch와 지나치게 결합된 문제를 고칠 때
- TanStack Query의 cache, freshness, retention 또는 invalidation 정책을 검토할 때
- 편집 form이 background refresh로 덮어써지는 문제를 방지할 때
- Save, Delete, credential, permission 같은 mutation을 안전하게 제한할 때
- error, Retry, keyboard interaction, localization과 accessibility를 검토할 때
- Next.js 기반 React 화면의 Server/Client Component 경계를 점검할 때
- 구현된 화면을 실제 browser에서 동작과 시각 상태까지 검증할 때

## 어떻게 요청하는가

Skill 이름을 명시하거나 대상 React 화면과 원하는 결과를 구체적으로 설명하면 됩니다.

예시:

```text
react-ui-ux를 사용해서 사용자 목록에서 행을 선택하면 drawer가 즉시 열리고,
detail을 불러오는 동안 필드별 Skeleton이 보이도록 구현해 줘.
```

```text
이 React 설정 화면을 검토해 줘. background refetch가 진행 중일 때 사용자가 수정한 form 값이
덮어써질 가능성과 cached data로 Save가 활성화되는 문제가 있는지 확인해 줘.
```

```text
이 Next.js route의 loading, error, Retry, keyboard submit 동작을 개선하고 browser에서 검증해 줘.
```

검토만 원하는 경우에는 “검토해 줘” 또는 “문제를 찾아 줘”라고 요청하고, 실제 변경까지 원한다면 “구현해 줘” 또는 “고쳐 줘”라고 명확히 말하는 것이 좋습니다.

## 요청을 받으면 무엇을 하는가

에이전트는 먼저 대상 프로젝트의 실제 구조와 data flow를 조사합니다.

- 가까운 repository instruction, PRD와 design source를 확인합니다.
- layout 또는 provider부터 화면의 leaf component까지 ownership을 추적합니다.
- query key와 query ownership, list DTO와 detail DTO의 차이를 확인합니다.
- mutation payload, invalidation, localization, 공용 Skeleton과 class convention을 살펴봅니다.
- 즉시 알 수 있는 값과 authoritative detail fetch가 필요한 값을 구분합니다.

그 다음 요청과 관련된 reference만 선택하여 다음 원칙을 적용합니다.

### 안정적인 initial paint와 loading

page shell, navigation, list, tab, selection과 scroll context는 가능한 한 계속 유지합니다. 아직 모르는 값만 최종 content와 크기가 맞는 Skeleton으로 대체하여 loading 때문에 화면 전체가 사라지거나 크게 흔들리지 않도록 합니다.

### 정직한 server state와 안전한 mutation

summary data, 오래된 cache, paused request 또는 fetch 중인 값은 완전한 authoritative detail로 간주하지 않습니다. Save, Delete, Replace All, credential 또는 permission 변경은 UI control과 mutation function 양쪽에서 fresh data를 확인하고, 조건이 불충분하면 실행을 막습니다.

### 편집 내용 보호

fresh authoritative detail을 현재 항목의 draft에 한 번만 반영합니다. 사용자가 편집을 시작한 뒤 발생하는 background refresh가 입력 내용을 덮어쓰지 않도록 identity와 hydration 시점을 관리합니다.

### 좁은 error boundary와 접근성

실패한 영역 안에서 error와 Retry를 제공하고 주변 화면의 context는 유지합니다. native form, 연결된 label, keyboard submit, 접근 가능한 error message, pending control 비활성화와 localization을 함께 확인합니다.

### 실제 동작 검증

변경 범위에 맞는 lint, type check, test 또는 build를 실행하고, 의미 있는 UI 변경은 browser에서 pending, error, Retry와 success 상태를 확인합니다. live data나 특정 시각 상태를 재현할 수 없다면 그 한계를 결과에 명시합니다.

## 기대할 수 있는 결과

구현 요청에서는 기존 프로젝트 convention을 따르는 최소 범위의 코드 변경과 검증 결과를 받게 됩니다. 검토 요청에서는 다음과 같은 형태의 근거 기반 결과를 받게 됩니다.

- 어떤 component 또는 query boundary에 문제가 있는지
- 사용자가 실제로 겪는 영향과 mutation safety 위험
- 가장 가까운 source of truth에서 어떻게 개선할 수 있는지
- 어떤 자동 검증과 browser scenario를 확인했는지
- live data, 시각 비교 또는 client behavior 중 아직 확인하지 못한 항목

## 핵심 경계

- 빠른 화면을 만들기 위해 확인되지 않은 server value를 낙관적으로 조작하지 않습니다.
- list 또는 summary data가 complete detail이라고 가정하지 않습니다.
- background refresh가 active edit나 현재 context를 파괴하도록 두지 않습니다.
- 프로젝트에 없는 product behavior, dimension 또는 design rule을 임의로 만들지 않습니다.
- Next.js 지침은 대상 프로젝트가 실제로 Next.js를 사용하거나 framework boundary가 요청 범위일 때만 적용합니다.
