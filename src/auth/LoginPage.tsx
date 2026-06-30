import { useState } from 'react';
import { supabase } from '../database/supabase';

export function LoginPage() {
  const [adminMode, setAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('Đang đăng nhập…');
    const { error } = await supabase.auth.signInWithPassword({ email: adminMode ? email : 'customer@anlanh.local', password });
    setMessage(error ? error.message : 'Đăng nhập thành công.');
  };
  return <main className="grid min-h-screen place-items-center bg-[#f6f7f9] p-5"><form className="card w-full max-w-[390px] p-8" onSubmit={submit}>
    <div className="font-display text-2xl font-extrabold leading-none text-brand">MINHHIEU<small className="mt-1.5 block font-sans text-[9px] font-normal text-slate-500">Dashboard · AnlanhFarm</small></div><h1 className="mb-1 mt-7 font-display text-2xl font-bold">Đăng nhập Dashboard</h1><p className="mb-6 text-sm text-slate-500">{adminMode ? 'Khu vực dành cho quản trị viên.' : 'Nhập mật khẩu khách hàng để xem báo cáo.'}</p>
    {adminMode && <label className="mt-3 grid gap-1.5 text-xs font-semibold text-slate-600">Email<input className="rounded-lg border border-[#e8e8e8] px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
    <label className="mt-3 grid gap-1.5 text-xs font-semibold text-slate-600">Mật khẩu<input className="rounded-lg border border-[#e8e8e8] px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    <button className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 font-bold text-white hover:bg-rose-600" type="submit">Đăng nhập</button>{message && <small className="mt-3 block text-slate-500">{message}</small>}
    <button className="mt-3 w-full rounded-lg px-4 py-2 text-xs text-slate-500 hover:bg-brand-soft hover:text-brand" type="button" onClick={() => { setAdminMode(!adminMode); setMessage(''); }}>{adminMode ? 'Quay lại trang khách hàng' : 'Đăng nhập quản trị viên'}</button>
  </form></main>;
}
