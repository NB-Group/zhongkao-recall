import React, { useEffect, useMemo, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import type { Card, ContentPack, LearningState, Piece } from '@zhongkao-recall/domain';
import { AppShell } from './components/AppShell';
import { AuthPage } from './pages/AuthPage';
import { ContentPage } from './pages/ContentPage';
import { ReviewSessionPage } from './pages/ReviewSessionPage';
import { SettingsPage } from './pages/SettingsPage';
import { TodayPage } from './pages/TodayPage';
import { createBackendClient, type BackendClient, type UserSettings } from './lib/backend';
import { createSupabaseBackend } from './lib/supabase';
import { useSync } from './hooks/useSync';

import cards from '../../../content/packs/zhongkao-2024/cards.json';
import pieces from '../../../content/packs/zhongkao-2024/pieces.json';

const contentPack: Pick<ContentPack, 'cards' | 'pieces'> = {
  cards: cards as Card[],
  pieces: pieces as unknown as Piece[],
};

function createLocalBackend(): BackendClient {
  return createBackendClient({
    appendReviewEvent: async (event) => ({ eventId: event.eventId }),
  });
}

function createConfiguredBackend(): BackendClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && anonKey ? createSupabaseBackend(url, anonKey) : createLocalBackend();
}

function AppRoutes({ backend }: { backend: BackendClient }) {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({ dailyNewWords: 5, dailyReviewLimit: 30, timeZone: 'Asia/Shanghai' });
  const [states, setStates] = useState<Record<string, LearningState>>({});
  const [progress, setProgress] = useState<Record<string, string>>({});
  useSync(backend);

  useEffect(() => {
    void backend.getSession().then((session) => setAuthenticated(Boolean(session))).catch(() => setAuthenticated(false));
  }, [backend]);

  useEffect(() => {
    if (!authenticated) return;
    void Promise.all([backend.getSettings(), backend.getLearningStates(), backend.getPieceProgress()]).then(
      ([nextSettings, nextStates, nextProgress]) => {
        setSettings(nextSettings);
        setStates(nextStates);
        setProgress(nextProgress);
      },
    );
  }, [authenticated, backend]);

  async function signIn(email: string, password: string) {
    await backend.signIn(email, password);
    setAuthenticated(true);
    navigate('/today');
  }

  async function signUp(email: string, password: string, nickname?: string) {
    await backend.signUp(email, password, nickname);
    if (!(await backend.getSession())) {
      throw new Error('注册邮件已发送，请先完成邮箱确认后再登录');
    }
    setAuthenticated(true);
    navigate('/today');
  }

  async function signOut() {
    await backend.signOut();
    setAuthenticated(false);
    navigate('/auth');
  }

  if (!authenticated) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />;
  }

  function ReviewRoute() {
    const { queueKind } = useParams();
    return (
      <ReviewSessionPage
        queueKind={queueKind === 'prose' ? 'prose' : 'vocabulary'}
        cards={contentPack.cards}
        activePieceIds={Object.entries(progress).filter(([, status]) => status !== 'locked').map(([pieceId]) => pieceId)}
        initialStates={states}
        dailyNewTarget={settings.dailyNewWords}
        reviewLimit={settings.dailyReviewLimit}
        timeZone={settings.timeZone}
        backend={backend}
        onStateChange={setStates}
        onDone={() => navigate('/today')}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppShell onSignOut={() => void signOut()} />}>
        <Route
          path="/today"
          element={
            <TodayPage
              summary={{ newWords: settings.dailyNewWords, reviews: Object.values(states).filter((state) => state.status === 'review').length, proseReviews: 0, estimatedMinutes: 18 }}
              onStartVocabulary={() => navigate('/review/vocabulary')}
              onStartProse={() => navigate('/review/prose')}
            />
          }
        />
        <Route path="/content" element={<ContentPage pieces={contentPack.pieces} progress={progress} onUnlock={(pieceId) => { setProgress({ ...progress, [pieceId]: 'learning' }); void backend.setPieceProgress(pieceId, 'learning'); }} onSetStatus={(pieceId, status) => { setProgress({ ...progress, [pieceId]: status }); void backend.setPieceProgress(pieceId, status); }} />} />
        <Route path="/settings" element={<SettingsPage settings={settings} onSave={async (next) => { setSettings(next); await backend.updateSettings(next); }} />} />
        <Route path="/review/:queueKind" element={<ReviewRoute />} />
      </Route>
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

export function App() {
  const backend = useMemo(createConfiguredBackend, []);
  return (
    <HashRouter>
      <AppRoutes backend={backend} />
    </HashRouter>
  );
}
