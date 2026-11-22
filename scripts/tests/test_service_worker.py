from pathlib import Path


SERVICE_WORKER = Path(__file__).parents[2] / "apps/web/public/sw.js"


def test_service_worker_refreshes_navigation_shell_after_deployments():
    source = SERVICE_WORKER.read_text(encoding="utf-8")

    assert "self.skipWaiting()" in source
    assert "clients.claim()" in source
    assert "event.request.mode === 'navigate'" in source
