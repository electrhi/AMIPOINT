# 실적관리 사이트

Supabase에 연결된 실적관리 앱입니다. 계정 권한은 `관리자`와 `작업자`로 나뉩니다.

## 현재 연결 정보

- Supabase URL: `https://blbmdnygvoqyrovvlrrh.supabase.co`
- Publishable Key: `config.js`와 Render 빌드 스크립트에 반영됨

Render의 Build Command는 `npm run build`, Publish Directory는 프로젝트 루트(`.`)로 설정합니다.

## 계정 권한

- 관리자: 전체 날짜/전체 조 실적 조회, 기간별 엑셀 다운로드, 조 수량 설정
- 작업자: 담당 권역/조만 확인, 날짜 선택, 해당 날짜 수량 입력, 이전 날짜 수량 확인, 저장

## 기본 생성 계정

- 관리자/작업자 계정은 Supabase `work_users`에 일괄 추가되어 있습니다.
- 계정별 `password`, `team_no`, `region_no`, `worker_type`을 Table Editor에서 확인할 수 있습니다.
- `team_no`가 비어 있는 작업자는 로그인은 가능하지만 입력 표가 표시되지 않습니다.

비밀번호는 Supabase `work_users.password`에 숫자/문자 그대로 저장됩니다.

## 사용자 추가 예시

```sql
insert into public.work_users (login_id, password, display_name, role, team_no, region_no, worker_type)
values ('worker02', '1002', '작업자02', 'worker', 2, 1, '모뎀작업자');
```

관리자 계정 예시:

```sql
insert into public.work_users (login_id, password, display_name, role, team_no, region_no, worker_type)
values ('admin2', '9998', '관리자2', 'admin', 0, 0, '관리자');
```

## 기능

- 로그인 후 권한별 화면 자동 분기
- 관리자 전용 전체 실적 현황
- 작업자 전용 담당 조 일일 수량 입력
- 관리자 표는 `권역`과 `조`를 분리해서 표시하고, 조는 숫자 순서로 정렬
- 표 구성: 조별 오전/오후, 합동/이전/기존, 합계
