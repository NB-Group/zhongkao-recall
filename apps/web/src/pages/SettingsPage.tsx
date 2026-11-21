import React, { useState } from 'react';
import type { UserSettings } from '../lib/backend';

interface SettingsPageProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => Promise<void>;
}

export function SettingsPage({ settings, onSave }: SettingsPageProps) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(draft);
    setSaved(true);
  }

  return (
    <main className="settings-page">
      <header className="page-heading">
        <p className="page-heading__eyebrow">设置</p>
        <h1>让每天的量合适。</h1>
        <p>数量可以随学习节奏调整，已经完成的记录不会消失。</p>
      </header>
      <form className="settings-form" onSubmit={save}>
        <label>
          每日新学实词
          <input type="number" min="0" max="100" value={draft.dailyNewWords} onChange={(event) => setDraft({ ...draft, dailyNewWords: Number(event.target.value) })} />
        </label>
        <label>
          每日复习上限
          <input type="number" min="1" max="200" value={draft.dailyReviewLimit} onChange={(event) => setDraft({ ...draft, dailyReviewLimit: Number(event.target.value) })} />
        </label>
        <label>
          时区
          <input value={draft.timeZone} onChange={(event) => setDraft({ ...draft, timeZone: event.target.value })} />
        </label>
        <button type="submit" className="primary-button">保存设置</button>
        {saved && <p className="save-note" role="status">设置已保存</p>}
      </form>
    </main>
  );
}
