# 큐 스튜디오 · StageCue Studio

연극의 배경과 음향을 장면 순서로 만들고, 별도 공연 화면과 제어창으로 진행하는 React · Vite · TypeScript 앱입니다.

이 폴더는 기존 공연 사이트와 별도 프로젝트입니다. 상위 폴더의 `index.html`, `control.html`, 음원·배경과 기존 GitHub Pages 공연은 그대로 유지하며, 새 앱은 `stage-studio/`에서 빌드·배포합니다. 포켓몬 공연의 28개 장면과 음향은 `public/templates/pokemon/`의 사본으로 제공합니다.

## 실행

Node.js는 `^20.19.0` 또는 `>=22.12.0`이 필요합니다. Windows PowerShell에서는 `npm.cmd`를 사용합니다.

```powershell
cd 'C:\Users\강준환\OneDrive\문서\ChatGPT\엠베서더 PPT\stage-studio'
npm.cmd ci
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev
```

기본 개발 주소는 `http://127.0.0.1:5173`입니다. 포트가 사용 중이면 터미널에 표시된 주소로 접속합니다. `.env.local`을 변경한 뒤에는 개발 서버를 다시 시작합니다.

다음 두 환경 변수를 `.env.local`과 배포 환경에 설정합니다. 이름은 `.env.example`에도 있습니다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

브라우저용 Supabase publishable key를 사용합니다. Google Client Secret, Supabase secret/service-role key와 DB 비밀번호는 프런트엔드 환경 변수·소스·Git에 넣지 않습니다. 환경 파일과 `.vercel/`은 Git에서 제외됩니다.

Supabase 연결 전에도 `/demo`에서 템플릿 편집과 공연 진행을 체험할 수 있습니다. 체험 저장은 해당 브라우저의 로컬 저장소를 사용하며, 파일 업로드와 계정별 작품 저장에는 로그인이 필요합니다.

## 기능과 운영

- Google·이메일 로그인, 회원가입, 이메일 확인, 비밀번호 재설정
- 계정별 작품 생성·검색·정렬·복제·삭제, 빈 공연 또는 포켓몬 템플릿으로 시작
- 장면 추가·복제·순서 이동·삭제, 배경·암전·전환·진행 메모 편집
- 이미지·음원 업로드와 장면별 `재생 / 정지 / 유지` 설정
- 음원별 음량·반복·페이드인, 전체 음량·페이드아웃 설정
- 노트북 제어창과 빔용 공연 창, 큰 미리보기와 접을 수 있는 음향 패널
- 작품 JSON 가져오기·내보내기, 변경 버전이 충돌할 때 저장 오류 표시

이미지는 JPG·PNG·WebP·GIF, 음원은 MP3·WAV·OGG·M4A를 받습니다. 파일당 최대 50MiB, 공연당 최대 500개 장면·100개 음원을 지원합니다. JSON 내보내기는 장면·설정과 파일 참조를 보관하며 실제 이미지·음원 파일은 포함하지 않습니다. 저장소 참조가 있는 JSON은 원래 계정과 Supabase 프로젝트의 파일에 접근할 수 있어야 합니다.

### 공연 진행

1. 편집한 작품을 저장하고 **공연 시작**을 누릅니다.
2. 제어창의 **공연 화면 열기**로 별도 창을 열어 빔 화면으로 옮깁니다. 팝업이 차단되면 이 사이트의 팝업을 허용합니다.
3. 공연 창에서 `F`로 전체 화면을 켭니다. 제어창은 노트북에 둡니다.
4. 제어창의 큰 다음 버튼, 또는 공연 창 클릭·`→`·`Space`로 진행합니다. `←`는 이전, `B`는 긴급 암전입니다.

두 창은 **같은 브라우저·프로필·사이트 주소**에서 열어야 연결됩니다. 실행마다 별도 세션을 사용하므로 다른 공연 제어창과 섞이지 않습니다. 공연 창에는 배경만 표시되며 마우스와 진행 메모가 나오지 않습니다. 제어창을 닫으면 장면 진행과 음향 제어를 이어갈 수 없으므로 공연 중에는 열어 둡니다.

음향의 `유지`는 재생 위치를 초기화하지 않습니다. 수동으로 정지·일시정지한 뒤 유지 장면으로 넘어가도 다시 재생하지 않습니다. `재생`을 지정한 장면은 같은 음원을 다시 선택해도 새로 재생합니다. 수동 음향 버튼은 별도로 사용할 수 있으며, 제어창의 개별 음량·전체 음량·페이드아웃·패널 접기 설정은 작품별로 이 브라우저에 저장됩니다.

포켓몬 템플릿의 문은 이미지와 효과음 준비 후 공통 시작 시각에 맞춰 4초 동안 열립니다. 다음 장면이나 긴급 암전으로 이동하면 진행 중인 효과음이 취소됩니다. 5장 귀환부터는 작은 음량의 반복곡을 시작하고, 이후 세 장면의 `유지` 설정으로 재생을 이어갑니다.

비공개 업로드 파일은 12시간짜리 서명 URL로 읽습니다. 오랫동안 열어 둔 공연은 다시 열어 URL을 갱신합니다. 로그인·업로드 파일 로딩에는 인터넷 연결이 필요합니다.

## Supabase 설정

대상 프로젝트는 `aquukitoomlzyoabrywb`입니다. 아래 마이그레이션을 번호 순서대로 한 번씩 적용합니다.

1. `supabase/migrations/20261025093504_stagecue_core.sql`
2. `supabase/migrations/20261025095120_stagecue_document_checks.sql`
3. `supabase/migrations/20261025101316_stagecue_resumable_deletion.sql`

Supabase Dashboard의 SQL Editor에서 순서대로 실행하거나, Supabase CLI 프로젝트를 초기화·연결한 뒤 적용할 수 있습니다.

```powershell
# config.toml이 없는 새 로컬 환경에서 한 번 실행
npx.cmd supabase init
npx.cmd supabase login
npx.cmd supabase link --project-ref aquukitoomlzyoabrywb
npx.cmd supabase db push
```

마이그레이션은 `stage_shows`, `stage_assets`, 비공개 `stage-assets` 버킷과 소유자 RLS를 만듭니다. 삭제는 파일 정리에 실패해도 재시도할 수 있도록 `deletion_pending` 상태를 사용합니다. 적용 이력이 있는 마이그레이션을 다시 실행하거나 과거 파일을 덮어쓰지 않습니다.

`supabase/tests/rls_rollback.sql`은 관리자 SQL 연결에서 소유권 정책을 검사하고 전체 변경을 롤백하는 테스트입니다. 오류로 중단되면 같은 연결에서 `ROLLBACK`을 실행합니다. 실제 파일 업로드·서명 URL·삭제는 로그인한 사용자로 별도 확인합니다. 자세한 구조와 인증 설정은 [Supabase 설정 문서](docs/supabase-setup.md)를 참고하세요.

### 인증 콜백

Supabase **Authentication → URL Configuration**에서 Site URL은 실제 운영 사이트 원본으로 설정하고 다음 앱 주소를 Redirect URLs에 등록합니다.

```text
http://127.0.0.1:5173/auth/callback
http://127.0.0.1:5173/reset-password
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
https://운영도메인/auth/callback
https://운영도메인/reset-password
```

Google Cloud의 OAuth 클라이언트는 **웹 애플리케이션**으로 만들며, 승인된 리디렉션 URI는 앱 주소가 아니라 다음 **Supabase 콜백**입니다.

```text
https://aquukitoomlzyoabrywb.supabase.co/auth/v1/callback
```

Google Client ID·Client Secret은 Supabase의 Google 공급자 설정에만 저장합니다. Google 공급자를 활성화하고 기본 `openid`, `email`, `profile` 범위로 로그인합니다. OAuth 앱이 Testing 상태이면 테스트 사용자를 등록해야 하며, 운영 공개 시 Google의 게시 상태를 확인합니다. Google → Supabase 콜백 → 앱 `/auth/callback`의 순서로 돌아오므로 두 종류의 콜백을 구분합니다. 이메일 확인·비밀번호 재설정 메일은 Supabase의 발송 설정과 한도에도 영향을 받습니다.

## 빌드·Vercel 배포

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run preview
```

빌드 결과는 `dist/`입니다. Vercel의 프로젝트 루트는 이 **`stage-studio/` 폴더**, 프레임워크는 Vite, 빌드 명령은 `npm run build`, 출력 폴더는 `dist`로 설정합니다. `vercel.json`이 `/screen/...`, `/control/...`, 인증 콜백 등 직접 접속 경로를 앱으로 연결합니다.

Vercel 팀 범위는 `nnhs1`, 프로젝트 이름은 `stagecue-studio`입니다. 아래 명령은 이 폴더에서 실행합니다.

```powershell
npx.cmd vercel login
npx.cmd vercel link --scope nnhs1 --project stagecue-studio
npx.cmd vercel env add VITE_SUPABASE_URL production --scope nnhs1
npx.cmd vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production --scope nnhs1
npx.cmd vercel --prod --scope nnhs1
```

환경 변수가 이미 등록되어 있으면 `env add`를 반복하지 않고 대시보드에서 값을 확인합니다. 미리보기 배포에서도 로그인을 확인하려면 Preview 환경 변수와 해당 사이트의 Supabase Redirect URL도 별도로 설정합니다. 프런트엔드 환경 변수는 빌드 때 포함되므로 변경 후 재배포가 필요합니다.

배포 완료 주소를 Supabase Site URL·Redirect URLs에 반영한 뒤 이메일·Google 로그인, 작품 저장·새로고침, 파일 업로드, 별도 공연 창 연결과 음향을 실제 브라우저에서 확인합니다. 빌드 성공만으로 인증 공급자나 원격 데이터베이스 설정 완료를 의미하지는 않습니다.
