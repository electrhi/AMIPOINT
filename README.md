# 실적관리 사이트

Supabase에 연결된 실적관리 앱입니다. 사용자는 아이디/패스워드로 로그인해 날짜별 수량을 입력합니다.

## 현재 연결 정보

- Supabase URL: `https://blbmdnygvoqyrovvlrrh.supabase.co`
- Publishable Key: `config.js`와 Render 빌드 스크립트에 반영됨

Render에서는 아래 환경변수를 설정하면 해당 값이 우선 적용됩니다. 환경변수가 없어도 현재 Supabase 프로젝트 기본값으로 `config.js`가 생성됩니다.

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Render의 Build Command는 `npm run build`, Publish Directory는 프로젝트 루트(`.`)로 설정합니다.

## Supabase 설정

현재 프로젝트에는 앱에서 필요한 `work_settings`, `work_users`, `work_records` 테이블과 `work_login` 함수가 생성되어 있습니다.

사용자를 추가하려면 Supabase SQL Editor에서 실행하세요.

```sql
insert into public.work_users (login_id, password_hash, display_name, role)
values ('worker01', extensions.crypt('1234', extensions.gen_salt('bf')), '작업자01', 'user');
```

관리자 계정 예시:

```sql
insert into public.work_users (login_id, password_hash, display_name, role)
values ('admin', extensions.crypt('admin1234', extensions.gen_salt('bf')), '관리자', 'admin');
```

## 기능

- 일반 사용자: 날짜 선택, 이전 날짜 수량 조회, 수량 입력, 저장
- 관리자: 조 수량 설정, 엑셀 다운로드
- 표 구성: 조별 오전/오후, 합동/이전/기존, 합계
