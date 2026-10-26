import { useEffect } from 'react';
import { ArrowRight, Image, MonitorPlay, Music2, Play, Theater } from 'lucide-react';
import { Link } from 'react-router-dom';
import './PublicInfo.css';

type PublicInfoKind = 'about' | 'privacy' | 'terms';
const contact = 'junhwangang35@gmail.com';
const titles: Record<PublicInfoKind, string> = { about: '큐 스튜디오 소개', privacy: '개인정보 처리방침', terms: '이용약관' };

function PublicFooter() {
  return <footer className="public-footer"><span>큐 스튜디오</span><nav aria-label="서비스 안내"><Link to="/about">서비스 소개</Link><Link to="/privacy">개인정보 처리방침</Link><Link to="/terms">이용약관</Link><a href={`mailto:${contact}`}>문의</a></nav></footer>;
}

function AboutContent() {
  return <>
    <section className="public-hero" aria-labelledby="public-title">
      <div className="public-hero-copy"><h1 id="public-title">공연의 배경과 음향을<br/>한곳에서 준비하세요.</h1><p>큐 스튜디오는 연극과 학교 공연을 위한 웹 프레젠테이션 제작 도구입니다. 장면을 만들고, 음악을 연결하고, 별도의 공연 화면으로 무대를 진행할 수 있습니다.</p><div className="public-actions"><Link className="public-button public-button-primary" to="/demo"><Play size={15} fill="currentColor"/>로그인 없이 체험하기</Link><Link className="public-button" to="/login">로그인<ArrowRight size={16}/></Link></div></div>
      <figure className="public-hero-scene"><img src="/templates/pokemon/backgrounds/07-lake-gold.png" alt="큐 스튜디오의 공연 예시: 숲과 산을 배경으로 한 황금빛 호수"/><figcaption><span>공연 배경 미리보기</span><span>16:9</span></figcaption></figure>
    </section>
    <section className="public-features" aria-label="주요 기능">
      <article><Image size={23} strokeWidth={1.7}/><h2>장면 구성</h2><p>배경 이미지와 운영 메모를 넣고, 장면을 추가·복제·정렬하세요. 암전과 장면 전환도 설정할 수 있습니다.</p></article>
      <article><Music2 size={23} strokeWidth={1.7}/><h2>장면에 맞춘 음향</h2><p>음원을 올리고 각 장면에 재생·정지 큐를 연결하세요. 음량, 반복 재생, 페이드도 조절할 수 있습니다.</p></article>
      <article><MonitorPlay size={23} strokeWidth={1.7}/><h2>제어창과 공연 화면</h2><p>운영자는 제어창에서 진행하고, 관객에게는 배경 화면을 보여 주세요. 같은 브라우저에서 공연 화면을 별도로 열 수 있습니다.</p></article>
    </section>
    <section className="public-save-note"><div><h2>체험부터 내 작품 저장까지</h2><p>로그인 없는 체험은 같은 브라우저에 저장됩니다. 로그인하면 내 작품과 업로드한 이미지·음원을 계정별로 저장하고 다시 편집할 수 있습니다.</p></div><Link to="/signup">계정 만들기<ArrowRight size={16}/></Link></section>
    <p className="public-data-note">Google 로그인은 기본 프로필과 이메일을 사용합니다. 자세한 정보는 <Link to="/privacy">개인정보 처리방침</Link>과 <Link to="/terms">이용약관</Link>에서 확인하세요.</p>
  </>;
}

function PrivacyContent() {
  return <article className="public-document" aria-labelledby="public-title">
    <header className="public-document-heading"><h1 id="public-title">개인정보 처리방침</h1><p>큐 스튜디오에서 사용하는 정보와 저장 방식을 안내합니다.</p><time dateTime="2026-10-26">적용일: 2026년 10월 26일</time></header>
    <section><h2>1. 서비스와 문의처</h2><p>큐 스튜디오는 공연의 장면·배경·음향을 제작하고 진행하는 웹 도구입니다. 개인정보 관련 문의, 정보 수정 및 계정 삭제 요청은 운영자 이메일 <a href={`mailto:${contact}`}>{contact}</a>로 보내 주세요.</p></section>
    <section><h2>2. 사용하는 정보</h2><div className="public-table-scroll"><table><thead><tr><th scope="col">이용 기능</th><th scope="col">정보</th><th scope="col">사용 목적</th></tr></thead><tbody><tr><th scope="row">Google 로그인</th><td>Google 기본 프로필의 이름·이메일·프로필 이미지, 로그인 계정 식별자와 Supabase Auth 사용자 ID</td><td>로그인, 계정 식별, 기본 프로필 표시 및 내 작품 접근</td></tr><tr><th scope="row">이메일 가입·로그인</th><td>이름, 이메일, Supabase Auth에서 처리하는 비밀번호 인증 정보와 사용자 ID</td><td>이메일 인증, 로그인, 비밀번호 재설정</td></tr><tr><th scope="row">작품 편집·저장</th><td>작품 제목·설명, 장면·운영 메모·전환·음향 설정, 업로드한 이미지·음원 및 파일 이름·유형·크기</td><td>작품 저장·불러오기·복제, 미디어 표시와 공연 진행</td></tr><tr><th scope="row">브라우저 저장</th><td>로그인 세션, 저장한 체험 작품, 음량·페이드·음향 패널 등 제어 설정</td><td>로그인 유지, 같은 브라우저에서 체험 내용과 제어 설정 복원</td></tr></tbody></table></div><p>Google 정보는 로그인과 기본 프로필 제공에 사용합니다. Gmail 메일이나 Google Drive 파일에 접근하는 권한은 요청하지 않습니다.</p></section>
    <section><h2>3. 저장 위치와 서비스 제공 업체</h2><ul><li><strong>Supabase:</strong> 로그인 인증, 사용자 계정, 작품 데이터 및 업로드 파일을 처리합니다. 현재 프로젝트는 서울 리전을 사용합니다. 작품과 업로드 파일은 계정 소유자를 기준으로 접근을 제한합니다.</li><li><strong>Vercel:</strong> 웹사이트와 기본 템플릿을 호스팅하고 페이지를 제공합니다.</li><li><strong>Google:</strong> 사용자가 Google 로그인을 선택했을 때 계정 인증과 기본 프로필 제공을 처리합니다.</li></ul><p>로그인 세션과 체험 작품·제어 설정은 사용하는 브라우저의 로컬 저장소에도 저장됩니다. 체험 작품은 계정의 클라우드 작품과 별개입니다.</p></section>
    <section><h2>4. 보관과 삭제</h2><p>계정 정보와 저장한 작품·업로드 파일은 해당 정보의 삭제가 이루어질 때까지 서비스에 보관됩니다. 저장한 작품은 내 작품 화면에서 삭제할 수 있습니다. 삭제된 작품은 목록에서 숨겨지고 관련 업로드 파일과 데이터의 정리가 진행됩니다. 파일 정리가 실패하면 다음 작품 목록 접속 때 다시 시도할 수 있습니다.</p><p>현재 서비스에는 자동 회원 탈퇴 화면이 없습니다. 계정 및 계정에 연결된 정보의 삭제는 <a href={`mailto:${contact}`}>{contact}</a>로 요청해 주세요. 요청 확인과 처리 진행은 해당 문의를 통해 안내합니다.</p><p>체험 작품과 브라우저 설정은 해당 브라우저의 사이트 데이터가 삭제될 때까지 보관되며, 브라우저의 사이트 데이터 삭제 기능으로 지울 수 있습니다. 사이트 데이터를 지우면 로그인 세션과 저장한 체험 내용도 함께 사라질 수 있습니다. 로그아웃은 클라우드 작품을 삭제하지 않습니다.</p></section>
    <section><h2>5. 접근과 공유 시 주의사항</h2><p>업로드한 파일은 공연 화면에서 사용할 수 있도록 유효 시간이 있는 링크로 불러옵니다. 링크를 전달받은 사람은 유효 기간 동안 해당 파일에 접근할 수 있으므로 링크와 계정 정보를 공유할 때 주의해 주세요. 기본 제공 템플릿은 공개 웹 자료로 제공됩니다.</p></section>
    <section><h2>6. 안내 변경</h2><p>서비스의 정보 사용 방식이 바뀌면 이 페이지의 내용과 적용일을 업데이트합니다. 개인정보에 관한 질문이나 요청은 위 문의처로 보내 주세요.</p></section>
  </article>;
}

function TermsContent() {
  return <article className="public-document" aria-labelledby="public-title">
    <header className="public-document-heading"><h1 id="public-title">이용약관</h1><p>큐 스튜디오의 기능과 이용 시 확인할 사항을 안내합니다.</p><time dateTime="2026-10-26">적용일: 2026년 10월 26일</time></header>
    <section><h2>1. 제공하는 기능</h2><p>큐 스튜디오는 장면별 배경·음향·암전·전환과 운영 메모를 구성하고, 제어창과 별도의 공연 화면으로 진행하는 도구입니다. 로그인 없는 체험과 로그인 후 계정별 작품 저장을 제공합니다.</p></section>
    <section><h2>2. 계정과 저장</h2><p>계정과 비밀번호는 본인이 관리해 주세요. 로그인한 작품은 저장을 완료한 뒤 다른 기기에서 다시 불러올 수 있습니다. 저장하지 않은 변경은 창을 닫거나 새로고침하면 사라질 수 있습니다. 저장되지 않은 클라우드 편집본은 나가기 확인 창에서 JSON으로 내보낼 수 있습니다. 내보낸 JSON에는 작품 구성과 파일 참조가 포함되며, 업로드 파일 자체가 모두 묶이는 것은 아닙니다.</p><p>로그인 없는 체험의 저장 내용은 같은 브라우저의 사이트 데이터에 남습니다. 다른 기기로 자동 동기화되지 않으며, 브라우저 데이터 삭제나 비공개 모드의 종료 등으로 없어질 수 있습니다.</p></section>
    <section><h2>3. 이미지·음원의 이용</h2><p>직접 올리는 이미지·음원과 공연 자료는 사용할 권한이 있는 자료로 준비해 주세요. 다른 사람의 저작권·초상권·개인정보를 침해하는 자료를 업로드하거나 배포하지 마세요. 템플릿 제공이 해당 소재의 모든 이용 권리를 부여한다는 뜻은 아닙니다.</p></section>
    <section><h2>4. 공연 전 확인</h2><p>제어창과 공연 화면은 같은 브라우저·같은 웹사이트에서 연결됩니다. 별도의 기기에서 원격으로 제어하는 기능은 제공하지 않습니다. 빔 프로젝터를 사용할 때는 디스플레이 확장과 공연 화면의 전체 화면 설정을 준비해 주세요.</p><p>브라우저의 음향 재생 허용, 네트워크, 화면 연결 상태에 따라 동작이 달라질 수 있으므로 공연 전에 실제 장비로 장면과 소리를 확인해 주세요. 업로드 파일을 불러오는 링크는 발급 후 12시간 동안 유효합니다. 오래 열린 화면에서 파일을 불러오지 못하면 저장 상태를 확인한 뒤 작품과 공연 화면을 다시 열어 주세요.</p></section>
    <section><h2>5. 삭제와 문의</h2><p>작품은 내 작품 화면에서 삭제할 수 있습니다. 파일 정리 실패 시 다음 접속에서 정리를 다시 시도할 수 있습니다. 계정 삭제나 이용 중 발생한 문제는 <a href={`mailto:${contact}`}>{contact}</a>로 문의해 주세요. 정보 처리 방식은 <Link to="/privacy">개인정보 처리방침</Link>에서 확인할 수 있습니다.</p></section>
  </article>;
}

export function PublicInfo({ kind }: { kind: PublicInfoKind }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${titles[kind]} · 큐 스튜디오`;
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, [kind]);
  return <div className={`public-page public-page-${kind}`}><a href="#public-content" className="public-skip">본문으로 건너뛰기</a><header className="public-header"><Link to="/about" className="public-brand" aria-label="큐 스튜디오 소개"><Theater size={29} strokeWidth={1.7}/><span>큐 스튜디오</span></Link><nav aria-label="주요 메뉴"><Link to="/about" aria-current={kind === 'about' ? 'page' : undefined}>서비스 소개</Link><Link className="public-header-login" to="/login">로그인<ArrowRight size={14}/></Link></nav></header><main id="public-content" className="public-content" tabIndex={-1}>{kind === 'about' ? <AboutContent/> : kind === 'privacy' ? <PrivacyContent/> : <TermsContent/>}</main><PublicFooter/></div>;
}
