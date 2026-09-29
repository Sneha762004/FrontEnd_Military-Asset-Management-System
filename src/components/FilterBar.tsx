import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { api, rowsOf } from '../lib/api';
import { daysFromNow, today } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Icon } from './ui';
import type { Base, EquipmentCategory, EquipmentType, ReportFilters } from '../types';

export const DEFAULT_FILTERS: ReportFilters = {
  dateFrom: daysFromNow(-90),
  dateTo: today(),
  baseId: null,
  equipmentTypeId: null,
  category: null,
};

const CATEGORIES: EquipmentCategory[] = ['WEAPON', 'VEHICLE', 'AMMUNITION', 'EQUIPMENT', 'SPARES', 'FUEL'];

const PRESETS: { label: string; days: number | 'ytd' | 'all' }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'YTD', days: 'ytd' },
  { label: 'All', days: 'all' },
];

interface FilterBarProps {
  value: ReportFilters;
  onChange: (next: ReportFilters) => void;
  /** Hides the base picker for screens that are already base-locked. */
  hideBase?: boolean;
  hideEquipment?: boolean;
  hideCategory?: boolean;
  className?: string;
}

export function FilterBar({ value, onChange, hideBase = false, hideEquipment = false, hideCategory = false, className }: FilterBarProps) {
  const { isGlobal, baseId } = useAuth();
  const [showAll, setShowAll] = useState(false);

  const bases = useQuery({
    queryKey: ['bases', 'all'],
    queryFn: () => api.get<Base[]>('/catalogue/bases'),
    staleTime: 5 * 60 * 1000,
  });

  const equipment = useQuery({
    queryKey: ['equipment-types', 'all'],
    queryFn: () => api.get<EquipmentType[]>('/catalogue/equipment'),
    staleTime: 5 * 60 * 1000,
  });

  // A base-scoped user is locked to their own base: force the filter to agree
  // with the token so the UI never implies they can look at another base.
  useEffect(() => {
    if (!isGlobal && value.baseId !== baseId) onChange({ ...value, baseId });
  }, [isGlobal, baseId, value, onChange]);

  const set = <K extends keyof ReportFilters>(key: K, next: ReportFilters[K]) => onChange({ ...value, [key]: next });

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    if (preset.days === 'all') {
      setShowAll(true);
      onChange({ ...value, dateFrom: '2000-01-01', dateTo: today() });
      return;
    }
    if (preset.days === 'ytd') {
      onChange({ ...value, dateFrom: `${today().slice(0, 4)}-01-01`, dateTo: today() });
      return;
    }
    onChange({ ...value, dateFrom: daysFromNow(-preset.days), dateTo: today() });
  };

  const activePreset = PRESETS.find((preset) => {
    if (preset.days === 'all') return value.dateFrom === '2000-01-01';
    if (preset.days === 'ytd') return value.dateFrom === `${today().slice(0, 4)}-01-01`;
    return value.dateFrom === daysFromNow(-preset.days) && value.dateTo === today();
  });

  const invalidRange = value.dateFrom > value.dateTo;
  const hasFilters = value.baseId !== null || value.equipmentTypeId !== null || value.category !== null;

  return (
    <div className={clsx('card mb-4', className)}>
      <div className="flex flex-wrap items-end gap-3 p-3.5">
        {!hideBase ? (
          <div className="min-w-[11rem] flex-1 sm:max-w-[13rem]">
            <label className="label" htmlFor="filter-base">
              Base
            </label>
            <select
              id="filter-base"
              className={clsx('input', !isGlobal && 'opacity-60')}
              value={value.baseId ?? ''}
              onChange={(event) => set('baseId', event.target.value ? Number(event.target.value) : null)}
              disabled={!isGlobal}
            >
              <option value="">{isGlobal ? 'All bases' : `${baseId ? '' : 'My base'}`}</option>
              {(rowsOf(bases)).map((base) => (
                <option key={base.id} value={base.id}>
                  {base.code} &middot; {base.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="min-w-[9rem] flex-1 sm:max-w-[11rem]">
          <label className="label" htmlFor="filter-from">
            From
          </label>
          <input
            id="filter-from"
            type="date"
            className={clsx('input', invalidRange && 'input-error')}
            value={value.dateFrom}
            max={value.dateTo}
            onChange={(event) => set('dateFrom', event.target.value)}
          />
        </div>

        <div className="min-w-[9rem] flex-1 sm:max-w-[11rem]">
          <label className="label" htmlFor="filter-to">
            To
          </label>
          <input
            id="filter-to"
            type="date"
            className={clsx('input', invalidRange && 'input-error')}
            value={value.dateTo}
            min={value.dateFrom}
            max={showAll ? undefined : today()}
            onChange={(event) => set('dateTo', event.target.value)}
          />
        </div>

        {!hideEquipment ? (
          <div className="min-w-[11rem] flex-1 sm:max-w-[14rem]">
            <label className="label" htmlFor="filter-equipment">
              Equipment type
            </label>
            <select
              id="filter-equipment"
              className="input"
              value={value.equipmentTypeId ?? ''}
              onChange={(event) => set('equipmentTypeId', event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">All equipment</option>
              {(rowsOf(equipment)).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} &middot; {item.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {!hideCategory ? (
          <div className="min-w-[9rem] flex-1 sm:max-w-[11rem]">
            <label className="label" htmlFor="filter-category">
              Category
            </label>
            <select
              id="filter-category"
              className="input"
              value={value.category ?? ''}
              onChange={(event) => set('category', event.target.value || null)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0) + category.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex items-center gap-1.5" role="group" aria-label="Date range presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={clsx(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                activePreset?.label === preset.label
                  ? 'bg-accent-500/15 text-accent-400 ring-1 ring-inset ring-accent-500/30'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200',
              )}
            >
              {preset.label}
            </button>
          ))}
          {hasFilters ? (
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => onChange({ ...DEFAULT_FILTERS, baseId: isGlobal ? null : baseId })}
              title="Clear equipment and category filters"
            >
              <Icon.Close className="h-3.5 w-3.5" />
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {invalidRange ? (
        <p role="alert" className="border-t border-rose-500/20 bg-rose-500/10 px-3.5 py-2 text-xs text-rose-300">
          <Icon.Alert className="mr-1 inline h-3.5 w-3.5" />
          The start date is after the end date. Reporting will be empty until this is corrected.
        </p>
      ) : null}
    </div>
  );
}
