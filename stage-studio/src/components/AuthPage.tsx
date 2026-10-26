import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Mail, Play, Theater } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import './AuthPage.css';

type AuthMode = 'login'|'signup'|'forgot'|'reset';
type AuthSuccess = 'confirmation'|'email-sent'|'password-updated'|null;
const routeMode = (path:string):AuthMode => path === '/signup' ? 'signup' : path === '/forgot-password' ? 'forgot' : path === '/reset-password' ? 'reset' : 'login';

function errorMessage(cause:unknown, mode:AuthMode, google = false):string {
  const record = typeof cause === 'object' && cause !== null ? cause as {code?:string;message?:string;status?:number} : {};
  const code = record.code || '';
  const message = record.message || (typeof cause === 'string' ? cause : '');
  const text = `${code} ${message}`.toLowerCase();
  if (/provider.*(disabled|not enabled|not supported)|unsupported provider|oauth_provider_not_supported|provider_disabled/.test(text)) return 'Google 로그인 설정을 확인해 주세요. 이메일로 로그인하거나 운영자에게 문의해 주세요.';
  if (/invalid_credentials|invalid login credentials|invalid_grant/.test(text)) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (/email_not_confirmed|email not confirmed/.test(text)) return '이메일 인증이 필요합니다. 가입할 때 받은 메일의 인증 링크를 눌러 주세요.';
  if (/user_already_exists|email_exists|already registered|already been registered/.test(text)) return '이미 가입한 이메일입니다. 로그인하거나 비밀번호를 재설정해 주세요.';
  if (/weak_password|password.*(at least|minimum|too short)/.test(text)) return '비밀번호를 8자 이상으로 입력해 주세요. 영문, 숫자, 특수문자를 함께 사용하면 좋아요.';
  if (/same_password|different from the old password/.test(text)) return '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.';
  if (/rate_limit|too many requests|security purposes|email rate limit/.test(text) || record.status === 429) return '요청이 많아 잠시 기다려야 합니다. 잠시 후 다시 시도해 주세요.';
  if (/session.*(missing|not found)|auth_session_missing|otp_expired|token.*(expired|invalid)|link.*(expired|invalid)/.test(text)) return mode === 'reset' ? '재설정 링크가 만료되었거나 유효하지 않습니다. 새 링크를 요청해 주세요.' : '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.';
  if (/signup_disabled|signups not allowed|signups are disabled/.test(text)) return '현재 이메일 회원가입을 이용할 수 없습니다. 운영자에게 문의해 주세요.';
  if (/email_address_invalid|invalid email|valid email/.test(text)) return '올바른 이메일 주소를 입력해 주세요.';
  if (/captcha/.test(text)) return '보안 확인에 실패했습니다. 페이지를 새로고침하고 다시 시도해 주세요.';
  if (/fetch|network|failed to fetch|load failed|timeout/.test(text)) return '서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  if (/supabase|연결 정보|환경 설정/.test(text)) return google ? 'Google 로그인 설정을 확인해 주세요. 로그인 서비스 연결이 준비되지 않았습니다.' : '로그인 서비스 연결 설정을 확인해 주세요. 잠시 후 다시 시도해 주세요.';
  if (/[가-힣]/.test(message)) return message.slice(0,240);
  return google ? 'Google 로그인을 시작하지 못했습니다. 다시 시도하거나 이메일로 로그인해 주세요.' : '요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function GoogleMark() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.3c1.9-1.8 3-4.4 3-7.6Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2.1 1-3.4 1a6 6 0 0 1-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.3 13.8a6 6 0 0 1 0-3.6V7.5H2.9a10 10 0 0 0 0 9l3.4-2.7Z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9.1 5.5l3.4 2.7A6 6 0 0 1 12 6Z"/></svg>;
}

export function AuthPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mode = routeMode(location.pathname);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [name,setName] = useState('');
  const [confirmation,setConfirmation] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [busy,setBusy] = useState<'email'|'google'|null>(null);
  const [error,setError] = useState<string|null>(null);
  const [success,setSuccess] = useState<AuthSuccess>(null);
  const [googleNotice,setGoogleNotice] = useState(false);
  const operation = useRef(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLInputElement>(null);
  const unavailableReset = mode === 'reset' && !auth.loading && !auth.user;

  useEffect(() => {
    ++operation.current;
    setPassword(''); setConfirmation(''); setShowPassword(false);
    setBusy(null); setError(null); setSuccess(null); setGoogleNotice(false);
    const params = new URLSearchParams(location.search);
    const routeError = (location.state as {error?:unknown}|null)?.error;
    const callbackError = params.get('error_description') || params.get('error');
    if (typeof routeError === 'string') setError(errorMessage(routeError,mode));
    else if (callbackError) setError(errorMessage(callbackError,mode,callbackError.toLowerCase().includes('provider')));
  }, [location.pathname,location.search,location.state,mode]);

  useEffect(() => {
    if (!auth.loading && auth.user && mode !== 'reset') navigate('/shows',{replace:true});
  }, [auth.loading,auth.user,mode,navigate]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function continueWithGoogle() {
    const current = ++operation.current;
    setBusy('google'); setError(null); setGoogleNotice(false);
    try {
      await auth.signInWithGoogle();
      if (operation.current === current) setGoogleNotice(true);
    } catch (cause) {
      if (operation.current === current) setError(errorMessage(cause,mode,true));
    } finally { if (operation.current === current) setBusy(null); }
  }

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || auth.loading || unavailableReset) return;
    setError(null); setGoogleNotice(false);
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('올바른 이메일 주소를 입력해 주세요.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('이름을 입력해 주세요.'); return; }
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) { setError('비밀번호를 8자 이상으로 입력해 주세요.'); return; }
    if (mode === 'reset' && password !== confirmation) { setError('새 비밀번호가 서로 다릅니다. 다시 확인해 주세요.'); confirmationRef.current?.focus(); return; }
    const current = ++operation.current;
    setBusy('email');
    try {
      if (mode === 'login') {
        await auth.signIn(email.trim(),password);
        if (operation.current === current) navigate('/shows',{replace:true});
      } else if (mode === 'signup') {
        const result = await auth.signUp(email.trim(),password,name.trim());
        if (operation.current !== current) return;
        if (result.needsConfirmation) { setSuccess('confirmation'); setPassword(''); }
        else navigate('/shows',{replace:true});
      } else if (mode === 'forgot') {
        await auth.requestPasswordReset(email.trim());
        if (operation.current === current) setSuccess('email-sent');
      } else {
        await auth.updatePassword(password);
        if (operation.current === current) { setSuccess('password-updated'); setPassword(''); setConfirmation(''); }
      }
    } catch (cause) {
      if (operation.current === current) setError(errorMessage(cause,mode));
    } finally { if (operation.current === current) setBusy(null); }
  }

  const heading = mode === 'signup' ? '큐 스튜디오 시작하기' : mode === 'forgot' ? '비밀번호를 잊으셨나요?' : mode === 'reset' ? '새 비밀번호 설정' : '다시 만나 반가워요';
  const description = mode === 'signup' ? '새로운 공연을 함께 준비해 보세요.' : mode === 'forgot' ? '가입한 이메일로 재설정 링크를 보내드려요.' : mode === 'reset' ? '새로 사용할 비밀번호를 입력해 주세요.' : '이메일 또는 Google 계정으로 로그인하세요.';
  const submitText = mode === 'signup' ? '회원가입' : mode === 'forgot' ? '재설정 링크 보내기' : mode === 'reset' ? '비밀번호 변경' : '로그인';
  const disabled = !!busy || auth.loading;

  return <main className="auth-page">
    <aside className="auth-story">
      <Link to="/" className="auth-brand" aria-label="큐 스튜디오 홈"><Theater size={31} strokeWidth={1.7}/><span>큐 스튜디오</span></Link>
      <div className="auth-story-content"><h1>공연에만<br/>집중할 수 있도록.</h1><p className="auth-story-description">배경과 음향은 한곳에서 준비하고,<br/>무대에서는 클릭 한 번으로.</p><figure className="auth-scene"><img src="/templates/pokemon/backgrounds/07-lake-gold.png" alt="푸른 숲과 산 아래 펼쳐진 황금빛 호수의 공연 배경"/><figcaption><span className="auth-scene-play"><Play size={12} fill="currentColor"/></span><span>장면 제작부터 무대 진행까지</span></figcaption></figure></div>
    </aside>
    <section className="auth-form-side" aria-label={heading}>
      <div className="auth-form-wrap">
        {(mode==='forgot'||mode==='reset')&&<Link className="auth-back-link" to="/login"><ArrowLeft size={14}/>로그인으로 돌아가기</Link>}
        <header className="auth-form-heading"><h2>{heading}</h2><p>{description}</p></header>
        {auth.loading&&<div className="auth-loading" role="status"><Loader2 className="auth-spin" size={15}/>로그인 상태를 확인하고 있어요.</div>}
        {error&&<div className="auth-message auth-message-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
        {googleNotice&&<div className="auth-message auth-message-notice" role="status">Google 로그인 페이지로 이동합니다. 이동하지 않으면 다시 시도해 주세요.</div>}
        {unavailableReset&&!success&&<div className="auth-message auth-message-error" role="alert">유효한 재설정 링크가 필요합니다. 이메일에 있는 최신 링크로 다시 열어 주세요.<Link to="/forgot-password">재설정 링크 다시 받기<ArrowRight size={13}/></Link></div>}
        {success?<div className="auth-success" role="status">
          <span className="auth-success-icon">{success==='password-updated'?<CheckCircle2 size={29}/>:<Mail size={28}/>}</span>
          <h3>{success==='confirmation'?'이메일을 확인해 주세요':success==='email-sent'?'재설정 안내를 요청했어요':'비밀번호를 변경했어요'}</h3>
          {success==='confirmation'?<p><strong>{email.trim()}</strong> 주소로 보낸 인증 메일을 확인해 주세요. 메일의 링크를 누르면 회원가입을 마칠 수 있어요.</p>:success==='email-sent'?<p><strong>{email.trim()}</strong> 주소로 재설정 안내를 요청했습니다. 가입된 계정이라면 메일이 도착해요. 메일함과 스팸함을 확인해 주세요.</p>:<p>새 비밀번호가 적용되었습니다.<br/>내 작품에서 공연 준비를 이어가세요.</p>}
          <Link className="auth-primary auth-success-action" to={success==='password-updated'?'/shows':'/login'}>{success==='password-updated'?'내 작품으로':'로그인으로 돌아가기'}<ArrowRight size={15}/></Link>
          {success==='email-sent'&&<button className="auth-secondary-link" onClick={()=>{setSuccess(null);setError(null);}}>다른 이메일로 요청하기</button>}
        </div>:<>
          {(mode==='login'||mode==='signup')&&<><button className="auth-google" disabled={disabled} onClick={()=>void continueWithGoogle()}>{busy==='google'?<Loader2 size={18} className="auth-spin"/>:<GoogleMark/>}<span>Google로 계속하기</span></button><div className="auth-divider"><span>또는 이메일로</span></div></>}
          <form className="auth-form" onSubmit={event=>void submit(event)}>
            {mode==='signup'&&<label className="auth-field"><span>이름</span><input type="text" autoComplete="name" value={name} onChange={event=>setName(event.target.value)} placeholder="이름을 입력해 주세요" required maxLength={80} disabled={disabled}/></label>}
            {mode!=='reset'&&<label className="auth-field"><span>이메일</span><input type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" required maxLength={254} disabled={disabled}/></label>}
            {mode!=='forgot'&&<div className="auth-field"><div className="auth-password-label"><label htmlFor="auth-password">{mode==='reset'?'새 비밀번호':'비밀번호'}</label>{mode==='login'&&<Link to="/forgot-password">비밀번호 찾기</Link>}</div><div className="auth-password-input"><input id="auth-password" type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={event=>setPassword(event.target.value)} placeholder={mode==='login'?'비밀번호를 입력해 주세요':'8자 이상 입력해 주세요'} required minLength={mode==='login'?1:8} maxLength={128} disabled={disabled||unavailableReset}/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?'비밀번호 숨기기':'비밀번호 보기'} aria-pressed={showPassword} disabled={disabled||unavailableReset}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div>{mode==='signup'&&<small>8자 이상 입력해 주세요.</small>}</div>}
            {mode==='reset'&&<label className="auth-field"><span>새 비밀번호 확인</span><input ref={confirmationRef} type={showPassword?'text':'password'} autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} placeholder="새 비밀번호를 한 번 더 입력해 주세요" required minLength={8} maxLength={128} disabled={disabled||unavailableReset}/></label>}
            <button className="auth-primary auth-submit" type="submit" disabled={disabled||unavailableReset}>{busy==='email'?<><Loader2 size={17} className="auth-spin"/>처리 중…</>:<>{submitText}<ArrowRight size={16}/></>}</button>
          </form>
          {(mode==='login'||mode==='signup')&&<p className="auth-switch">{mode==='login'?'처음 오셨나요?':'이미 계정이 있나요?'} <Link to={mode==='login'?'/signup':'/login'}>{mode==='login'?'회원가입':'로그인'}</Link></p>}
        </>}
        <div className="auth-demo"><Link to="/demo"><Play size={12} fill="currentColor"/>로그인 없이 체험하기<ArrowRight size={14}/></Link></div>
        <nav className="auth-public-links" aria-label="서비스 안내"><Link to="/about">서비스 소개</Link><Link to="/privacy">개인정보 처리방침</Link><Link to="/terms">이용약관</Link></nav>
      </div>
    </section>
  </main>;
}
