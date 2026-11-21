import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

interface AppShellProps {
  onSignOut: () => void;
}

export function AppShell({ onSignOut }: AppShellProps) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/today">
          <span className="brand__mark">背</span>
          <span>一日一页</span>
        </NavLink>
        <button type="button" className="text-button" onClick={onSignOut}>
          退出
        </button>
      </header>
      <div className="app-shell__body">
        <aside className="sidebar" aria-label="主导航">
          <NavLink to="/today">今天</NavLink>
          <NavLink to="/content">内容</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </aside>
        <section className="app-shell__content">
          <Outlet />
        </section>
      </div>
      <nav className="mobile-nav" aria-label="主导航">
        <NavLink to="/today">今天</NavLink>
        <NavLink to="/content">内容</NavLink>
        <NavLink to="/settings">设置</NavLink>
      </nav>
    </div>
  );
}
