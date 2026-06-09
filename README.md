# 실적관리 사이트

Render 환경변수에 Supabase URL과 publishable key를 두고, 사용자는 아이디/패스워드로 로그인해 날짜별 수량을 입력합니다.

## 현재 연결 정보

- Supabase URL: `https://blbmdnygvoqyrovvlrrh.supabase.co`
- Publishable Key: 아직 입력 필요

브라우저에서 Supabase를 사용하려면 publishable key 또는 anon public key가 반드시 필요합니다. Render에서는 아래 환경변수를 설정하세요.

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Render의 Build Command는 `npm run build`, Publish Directory는 프로젝트 루트(`.`)로 설정하면 `config.js`가 환경변수 값으로 생성됩니다.

## Supabase 설정

1. Supabase Dashboard의 SQL Editor에서 `supabase-schema.sql`을 실행합니다.
2. `work_users` 테이블에 사용자를 추가합니다.
3. 앱에 접속해 `login_id`와 패스워드로 로그인합니다.

사용자 생성 예시:

```sql
insert into public.work_users (login_id, password_hash, display_name, role)
values ('worker01', crypt('1234', gen_salt('bf')), '작업자01', 'user');
```

## 기능

- 일반 사용자: 날짜 선택, 이전 날짜 수량 조회, 수량 입력, 저장
- 관리자: 조 수량 설정, 엑셀 다운로드
- 표 구성: 조별 오전/오후, 합동/이전/기존, 합계
