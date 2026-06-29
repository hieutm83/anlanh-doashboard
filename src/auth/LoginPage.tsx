import { useState } from 'react';
import { supabase } from '../database/supabase';

export function LoginPage() {
  const [adminMode, setAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('Đang đăng nhập...');
    const { error } = await supabase.auth.signInWithPassword({ email: adminMode ? email : 'customer@anlanh.local', password });
    setMessage(error ? error.message : 'Đăng nhập thành công.');
  };

  return <main className="login-shell"><form className="login-card" onSubmit={submit}>
    <div className="login-logo">MINHHIEU<small>Dashboard - AnlanhFarm</small></div>
    <h1>Đăng nhập Dashboard</h1>
    <p>{adminMode ? 'Khu vực dành cho quản trị viên.' : 'Nhập mật khẩu khách hàng để xem báo cáo.'}</p>
    {adminMode && <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
    <label>Mật khẩu<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    <button type="submit">Đăng nhập</button>
    {message && <small>{message}</small>}
    <button className="login-mode" type="button" onClick={() => { setAdminMode(!adminMode); setMessage(''); }}>{adminMode ? 'Quay lại trang khách hàng' : 'Đăng nhập quản trị viên'}</button>
  </form></main>;
}
