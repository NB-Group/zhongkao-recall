import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: '只支持注册请求' }), { status: 405, headers });

  try {
    const body = await request.json();
    const inviteLink = typeof body.inviteLink === 'string' ? body.inviteLink.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : null;

    if (!/^https:\/\/mp\.weixin\.qq\.com\/s\/[A-Za-z0-9_-]+$/.test(inviteLink)) {
      return new Response(JSON.stringify({ error: '请输入班级群复制的有效链接' }), { status: 400, headers });
    }
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || password.length < 8) {
      return new Response(JSON.stringify({ error: '用户名或密码格式不正确' }), { status: 400, headers });
    }

    const expectedHash = Deno.env.get('STUDENT_INVITE_SHA256');
    if (!expectedHash || (await sha256(inviteLink)) !== expectedHash.toLowerCase()) {
      return new Response(JSON.stringify({ error: '邀请码无效，请从班级群重新复制链接' }), { status: 403, headers });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    const email = `${username}@students.invalid`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      return new Response(JSON.stringify({ error: '用户名已存在或账号创建失败' }), { status: 409, headers });
    }

    const { error: profileError } = await admin.from('profiles').insert({ id: data.user.id, username, nickname });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return new Response(JSON.stringify({ error: '用户名已存在或账号创建失败' }), { status: 409, headers });
    }
    const { error: settingsError } = await admin.from('user_settings').insert({ user_id: data.user.id });
    if (settingsError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return new Response(JSON.stringify({ error: '账号初始化失败' }), { status: 500, headers });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers });
  } catch {
    return new Response(JSON.stringify({ error: '注册请求无法处理' }), { status: 400, headers });
  }
});
