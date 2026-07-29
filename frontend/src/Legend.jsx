import React from 'react';

export const DIVISION_COLORS = {
  'Dhaka': '#4f46e5',
  'Chittagong': '#0284c7',
  'Chattogram': '#0284c7',
  'Rajshahi': '#059669',
  'Khulna': '#d97706',
  'Barisal': '#dc2626',
  'Barishal': '#dc2626',
  'Sylhet': '#9333ea',
  'Rangpur': '#0d9488',
  'Mymensingh': '#e11d48',
};

export const DEFAULT_COLOR = '#64748b';

export default function Legend({ activeDivision, onSelectDivision, stats }) {
  const divisions = [
    { name: 'Dhaka', color: '#4f46e5' },
    { name: 'Chittagong', color: '#0284c7' },
    { name: 'Rajshahi', color: '#059669' },
    { name: 'Khulna', color: '#d97706' },
    { name: 'Barisal', color: '#dc2626' },
    { name: 'Sylhet', color: '#9333ea' },
    { name: 'Rangpur', color: '#0d9488' },
    { name: 'Mymensingh', color: '#e11d48' },
  ];

  return (
    <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-100 max-w-xs transition-all">
      <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
        <h4 className="text-sm font-bold tracking-wide uppercase text-indigo-600 dark:text-indigo-400">
          Divisions of Bangladesh
        </h4>
        {activeDivision && (
          <button
            onClick={() => onSelectDivision(null)}
            className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 underline"
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {divisions.map((div) => {
          const isSelected = activeDivision === div.name || (activeDivision === 'Barishal' && div.name === 'Barisal') || (activeDivision === 'Chattogram' && div.name === 'Chittagong');
          return (
            <button
              key={div.name}
              onClick={() => onSelectDivision(isSelected ? null : div.name)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                isSelected
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 ring-2 ring-indigo-500 font-bold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: div.color }}
              />
              <span className="truncate">{div.name}</span>
            </button>
          );
        })}
      </div>

      {stats && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between font-mono">
          <span>Districts Loaded:</span>
          <span className="font-bold text-slate-700 dark:text-slate-200">{stats.count || 64}</span>
        </div>
      )}
    </div>
  );
}
