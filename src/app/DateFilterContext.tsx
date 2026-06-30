import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { defaultRange } from '../components/DateFilter';
import type { DashboardFilters } from '../types/dashboard';

type DateFilterState={filters:DashboardFilters;setFilters:Dispatch<SetStateAction<DashboardFilters>>};
const DateFilterContext=createContext<DateFilterState|null>(null);
export function DateFilterProvider({children}:{children:ReactNode}){const [filters,setFilters]=useState<DashboardFilters>(defaultRange);return <DateFilterContext.Provider value={{filters,setFilters}}>{children}</DateFilterContext.Provider>}
export function useGlobalDateFilter(){const value=useContext(DateFilterContext);if(!value)throw new Error('useGlobalDateFilter must be used inside DateFilterProvider');return value}
