import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import { AuthProvider } from './auth/AuthProvider';
import { DateFilterProvider } from './app/DateFilterContext';
import './styles/global.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } } });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><AuthProvider><DateFilterProvider><App /></DateFilterProvider></AuthProvider></QueryClientProvider></React.StrictMode>);
