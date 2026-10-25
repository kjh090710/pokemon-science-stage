# StageCue Studio Supabase 설정

이 앱은 전용 프로젝트 `stagecue-studio` (`aquukitoomlzyoabrywb`)를 사용합니다. 기존 공연 사이트나 다른 Supabase 프로젝트의 테이블을 변경하지 않습니다.

## 환경 변수

`.env.local` 또는 배포 플랫폼에 아래 두 공개 환경 변수를 설정합니다.

```env
VITE_SUPABASE_URL=https://aquukitoomlzyoabrywb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=대시보드의_publishable_key
```

브라우저에는 publishable key만 사용합니다. `service_role`·secret key·데이터베이스 비밀번호는 이 앱에 넣지 않습니다. 키만으로는 데이터에 접근할 수 없으며 로그인 세션과 RLS가 소유권을 검사합니다.

## 데이터베이스와 파일

`supabase/migrations/20261025093504_stagecue_core.sql`, `20261025095120_stagecue_document_checks.sql`, `20261025101316_stagecue_resumable_deletion.sql`을 순서대로 전용 프로젝트에 적용합니다. 모든 마이그레이션 파일은 CLI `supabase migration new`로 생성했으며, 적용 후 원격 `list_migrations`에서 확인한 실제 버전과 파일명을 맞췄습니다. SQL 본문은 변경하지 않았습니다. 첫 파일의 적용 이력을 바꾸지 않고 두 번째 파일에서 문서 구조 검사를 강화하며 세 번째 파일에서 재시도 가능한 삭제 상태를 추가합니다.

- `stage_shows`: 사용자별 공연 문서, 제목, 설명, 변경 버전. 저장은 조회한 `revision`과 일치할 때만 진행하며 서버 트리거가 버전을 올립니다.
- `stage_assets`: 공연별 업로드 파일 정보. `(show_id, owner_id)` 복합 외래 키로 다른 사용자의 공연에 파일 정보를 연결할 수 없습니다.
- `stage-assets`: 비공개 버킷. 파일 경로는 `사용자 UUID/공연 UUID/고유 파일명`이며 이미지 JPG·PNG·WebP·GIF와 음원 MP3·WAV·OGG·M4A만, 파일당 50MiB까지 받습니다. SVG·HTML은 받지 않습니다.
- 두 테이블 및 `storage.objects`의 읽기·추가·수정·삭제는 로그인한 소유자만 허용합니다. UPDATE에는 `USING`과 `WITH CHECK`가 모두 있습니다.
- 공연 복제는 파일도 새 공연 경로로 복사합니다. 다른 공연이 원본 경로를 직접 참조하는 경우 삭제를 막아 참조가 끊어지지 않도록 합니다.
- 공연 삭제는 먼저 `deletion_pending=true`로 표시하여 목록·편집에서 숨긴 다음 파일과 행을 지웁니다. 파일 또는 행 정리가 실패해도 삭제한 공연이 깨진 채 다시 나타나지 않습니다. 다음 목록 조회 때 자신의 대기 중 파일 정리를 백그라운드에서 재시도합니다. 삭제 요청 결과의 `cleanupPending=true`는 공연이 이미 목록에서 삭제되었고 남은 파일을 자동으로 정리할 예정이라는 뜻입니다.
- 미디어 URL은 12시간짜리 서명 URL로 만듭니다. 12시간 이상 계속 열어 둔 공연은 다시 열어 URL을 갱신합니다. JSON 내보내기에는 서명 URL이나 로그인 토큰이 포함되지 않습니다. 업로드 미디어의 저장 경로는 같은 계정과 프로젝트 안에서만 유효하며 JSON 파일에 실제 음원·이미지는 포함되지 않습니다.

적용 후 실제 로그인 사용자 두 명으로 교차 읽기·쓰기·삭제가 거부되는지, 비로그인 조회가 차단되는지, 자신의 파일 업로드·서명 URL 발급이 가능한지 확인합니다. Supabase Advisors의 보안 결과도 확인합니다. `supabase/tests/rls_rollback.sql`은 임시 사용자와 저장 메타데이터를 전체 `BEGIN`/`ROLLBACK` 안에서 검사하는 SQL입니다. 실행 도구가 오류에서 중단하면 같은 연결에 `ROLLBACK`을 보내며, 영구 테스트 계정을 만들지 않습니다. `storage.objects`의 직접 SQL DELETE 보호 트리거는 우회하지 않습니다. 이 부분은 실제 DELETE 정책의 소유권 식만 SQL에서 평가하며, 파일 삭제 자체는 로그인한 사용자의 Storage API로 별도 확인해야 합니다.

## 이메일 가입과 비밀번호 재설정

Supabase Authentication → URL Configuration에 운영 사이트를 Site URL로 설정하고 Redirect URLs에 다음을 추가합니다.

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
http://127.0.0.1:5173/auth/callback
http://127.0.0.1:5173/reset-password
https://운영도메인/auth/callback
https://운영도메인/reset-password
```

이메일 확인이 켜져 있으면 가입 후 확인 메일을 클릭해야 로그인할 수 있습니다. 실제 사용자에게 이메일을 보내려면 프로젝트의 이메일 발송 한도와 SMTP 설정을 확인합니다. 비밀번호 재설정은 `/reset-password`로 돌아오며 새 비밀번호를 저장하는 화면에서 `updatePassword`를 호출합니다.

## Google 로그인

1. Google Cloud Console에서 OAuth 동의 화면을 구성하고 웹 애플리케이션 OAuth 클라이언트를 생성합니다.
2. 승인된 JavaScript 원본에 개발 주소와 운영 사이트 원본을 등록합니다.
3. 승인된 리디렉션 URI에 **Supabase의 콜백** `https://aquukitoomlzyoabrywb.supabase.co/auth/v1/callback`을 등록합니다.
4. Supabase Authentication → Sign In / Providers → Google에 해당 Client ID와 Client Secret을 저장하고 Google 공급자를 활성화합니다. Client Secret은 프런트엔드 환경 변수에 넣지 않습니다.
5. Supabase Redirect URLs에는 위의 앱 `/auth/callback` 주소도 등록합니다. Google → Supabase → 앱 순서로 돌아오기 때문에 두 콜백은 서로 다른 주소입니다.
6. OAuth 앱이 Testing 상태이면 테스트 사용자를 추가합니다. 운영 공개 전에는 Google의 게시·검증 요구 사항을 확인합니다.

클라이언트는 PKCE, 세션 자동 갱신, URL 콜백 감지를 사용합니다. 로그인 요청을 시작한 브라우저에서 콜백을 열어야 저장된 PKCE 검증자를 사용할 수 있습니다. `onAuthStateChange`는 동기 콜백으로 세션 상태만 갱신하며 구독을 해제합니다.

## 참고한 공식 문서

- [PKCE 흐름](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Google 로그인](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Auth 초기화](https://supabase.com/docs/reference/javascript/auth-initialize)
- [Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control)
- [비공개 버킷](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 확인한 실행 결과

2026-10-25에 전용 프로젝트 `aquukitoomlzyoabrywb`에서 세 마이그레이션 적용을 확인했습니다. `deletion_pending`은 boolean·NOT NULL·기본 false입니다. 전체 롤백 RLS 검증은 46개 모두 통과했고, 별도 사후 쿼리에서 테스트 사용자·공연·asset·storage object가 각각 0개 남은 것을 확인했습니다. Supabase Security Advisor 결과는 `lints: []`였습니다.

이 검증은 테이블 RLS와 Storage 정책을 확인합니다. Google OAuth 로그인과 실제 파일의 업로드·삭제는 브라우저/Storage API로 별도 확인해야 합니다. Storage의 직접 SQL DELETE 보호 트리거는 변경하지 않았습니다. 배포 완료 여부는 배포 실행 결과로 확인합니다.

같은 날 변경 내역과 공식 문서도 확인했습니다.
