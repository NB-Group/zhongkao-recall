import React, { useState } from 'react';

interface AuthPageProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, nickname?: string) => Promise<void>;
}

export function AuthPage({ onSignIn, onSignUp }: AuthPageProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'sign-in') await onSignIn(email, password);
      else await onSignUp(email, password, nickname || undefined);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : '操作失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__intro">
        <p className="page-heading__eyebrow">中考背诵</p>
        <h1>每天背一点，到了考试不慌。</h1>
        <p>新学实词，复习已学诗文。每次回忆都留下下一次出现的时间。</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form__tabs">
          <button type="button" className={mode === 'sign-in' ? 'is-active' : ''} onClick={() => setMode('sign-in')}>
            登录
          </button>
          <button type="button" className={mode === 'sign-up' ? 'is-active' : ''} onClick={() => setMode('sign-up')}>
            注册
          </button>
        </div>
        {mode === 'sign-up' && (
          <label>
            昵称
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={40} />
          </label>
        )}
        <label>
          邮箱
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '处理中…' : mode === 'sign-in' ? '进入今日任务' : '创建学生账号'}
        </button>
        <p className="auth-form__note">不收集真实姓名、学校、班级或手机号。</p>
      </form>
    </main>
  );
}
