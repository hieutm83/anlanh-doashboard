import { useState } from 'react';
import { supabase } from '../database/supabase';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('Đang đăng nhập…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : 'Đăng nhập thành công.');
  };
  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <div className="brand-mark">D</div><h1>Data Dashboard</h1><p>Đăng nhập để truy cập dữ liệu doanh nghiệp.</p>
    <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label>Mật khẩu<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    <button type="submit">Đăng nhập</button>{message && <small>{message}</small>}
  </form></main>;
}
