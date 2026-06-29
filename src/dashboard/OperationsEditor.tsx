import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../database/supabase';

export function OperationsEditor({ section }: { section: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [budget, setBudget] = useState('0');
  const [message, setMessage] = useState('');

  if (!['planner', 'weekly', 'booking'].includes(section)) return null;

  const save = async () => {
    setMessage('Đang lưu...');
    const { data: org, error: orgError } = await supabase.rpc('current_organization_id');
    if (orgError) {
      setMessage(orgError.message);
      return;
    }
    const result = section === 'booking'
      ? await supabase.from('booking_campaigns').insert({ organization_id: org, name: title, start_date: date, budget: Number(budget) || 0, status: 'draft' })
      : await supabase.from('planner_tasks').insert({ organization_id: org, title, task_date: date, status: 'todo' });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage('Đã lưu.');
    setTitle('');
    setOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['dashboard', section] });
  };

  return <>
    <button className="operation-add" onClick={() => setOpen(true)}>+ {section === 'booking' ? 'Tạo chiến dịch' : 'Thêm công việc'}</button>
    {open && <div className="legacy-modal" onClick={() => setOpen(false)}>
      <article className="operation-modal" onClick={(event) => event.stopPropagation()}>
        <header><h2>{section === 'booking' ? 'Tạo chiến dịch Book KOC' : 'Thêm công việc mới'}</h2><button onClick={() => setOpen(false)}>×</button></header>
        <div className="operation-form">
          <label>Tên<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Ngày<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          {section === 'booking' && <label>Ngân sách<input type="number" min="0" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>}
          <button disabled={!title.trim()} onClick={save}>Lưu</button>
          {message && <small>{message}</small>}
        </div>
      </article>
    </div>}
  </>;
}
