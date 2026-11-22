import React, { useState } from 'react';

interface AuthPageProps {
  onSignIn: (username: string, password: string) => Promise<void>;
  onSignUp: (inviteLink: string, username: string, password: string, nickname?: string) => Promise<void>;
  onDemo?: () => Promise<void>;
}

export function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message === 'Invalid login credentials') return '用户名或密码不正确。首次使用请切换到“注册”。';
  if (message === 'Email not confirmed') return '账号还没有完成确认，请重新注册。';
  return message || '操作失败，请稍后重试';
}

export function AuthPage({ onSignIn, onSignUp, onDemo }: AuthPageProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [inviteLink, setInviteLink] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      if (mode === 'sign-in') await onSignIn(username, password);
      else await onSignUp(inviteLink, username, password, nickname || undefined);
    } catch (submissionError) {
      setError(formatAuthError(submissionError));
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
          <>
            <div className="invite-help">
              <strong>先获取注册邀请码</strong>
              <ol>
                <li>在班级钉钉群里打开“第十三周营养食谱问卷”。</li>
                <li>点击问卷页面右上角的三个点。</li>
                <li>在下方菜单选择“复制链接”。</li>
                <li>把复制的完整链接粘贴到下面。</li>
              </ol>
            </div>
            <label>
              班级群邀请码链接
              <input type="url" required value={inviteLink} onChange={(event) => setInviteLink(event.target.value)} placeholder="粘贴群里复制的链接" />
            </label>
          </>
        )}
        {mode === 'sign-up' && (
          <label>
            昵称
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={40} />
          </label>
        )}
        <label>
          用户名
          <input required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如 xiaoming" />
        </label>
        <label>
          密码
          <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '处理中…' : mode === 'sign-in' ? '进入今日任务' : '创建学生账号'}
        </button>
        {onDemo && <button type="button" className="outline-button auth-form__demo" onClick={() => void onDemo()}>直接体验演示</button>}
        <p className="auth-form__note">邀请码只用于注册，登录时只需要用户名和密码。</p>
      </form>
    </main>
  );
}
