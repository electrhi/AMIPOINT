# 실적관리 사이트

Supabase에 연결된 실적관리 앱입니다. 계정 권한은 `관리자`와 `작업자`로 나뉩니다.

## 현재 연결 정보

- Supabase URL: `https://blbmdnygvoqyrovvlrrh.supabase.co`
- Publishable Key: `config.js`와 Render 빌드 스크립트에 반영됨

Render의 Build Command는 `npm run build`, Publish Directory는 프로젝트 루트(`.`)로 설정합니다.

## 계정 권한

- 관리자: 전체 날짜/전체 조 실적 조회, 기간별 엑셀 다운로드, 조 수량 설정
- 작업자: 날짜 선택, 해당 날짜 수량 입력, 이전 날짜 수량 확인, 저장

## 기본 생성 계정

- 관리자: `admin` / `admin1234`
- 작업자: `worker01` / `worker1234`

비밀번호는 Supabase `work_users.password_hash`에 해시로 저장되므로 원문은 조회되지 않습니다.

## 사용자 추가 예시

```sql
insert into public.work_users (login_id, password_hash, display_name, role)
values ('worker02', extensions.crypt('worker1234', extensions.gen_salt('bf')), '작업자02', 'worker');
```

관리자 계정 예시:

```sql
insert into public.work_users (login_id, password_hash, display_name, role)
values ('admin2', extensions.crypt('admin1234', extensions.gen_salt('bf')), '관리자2', 'admin');
```

## 기능

- 로그인 후 권한별 화면 자동 분기
- 관리자 전용 전체 실적 현황
- 작업자 전용 일일 수량 입력
- 표 구성: 조별 오전/오후, 합동/이전/기존, 합계
