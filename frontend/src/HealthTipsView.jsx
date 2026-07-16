import React, { useState, useEffect } from 'react';
import { ShieldPlus, Heart, Leaf, Sun, CalendarDays } from 'lucide-react';
import { healthTips, getDailyTip } from './data/healthTips';

export default function HealthTipsView() {
  const [dailyTip, setDailyTip] = useState(null);

  useEffect(() => {
    setDailyTip(getDailyTip());
  }, []);

  if (!dailyTip) return null;

  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans bg-slate-50">
      <header className="mb-10 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-emerald-200 flex items-center justify-center mb-4">
          <ShieldPlus size={32} className="text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Daily Health Tips</h1>
        <p className="text-slate-500 text-lg font-medium">Practical advice for a healthier lifestyle</p>
      </header>

      <div className="relative bg-gradient-to-br from-emerald-50 to-green-100 rounded-3xl p-8 mb-12 shadow-sm border border-emerald-200 overflow-hidden">
        <div className="relative z-10 flex items-center mb-4">
          <CalendarDays size={24} className="text-emerald-600 mr-3" />
          <h2 className="text-emerald-700 text-xl font-bold m-0">Tip of the Day</h2>
          <span className="ml-auto bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase shadow-sm">
            Source: {dailyTip.source}
          </span>
        </div>
        
        <h3 className="relative z-10 text-2xl text-slate-900 mb-4 font-bold leading-tight">
          {dailyTip.title}
        </h3>
        <p className="relative z-10 text-lg text-slate-700 leading-relaxed font-medium">
          {dailyTip.content}
        </p>
        
        <Sun size={140} className="absolute -right-6 -bottom-6 text-emerald-500 opacity-10 rotate-45 z-0" />
      </div>

      <div>
        <h3 className="text-2xl text-slate-800 mb-6 border-b-2 border-slate-200 pb-3 font-bold">
          More Health Guidelines
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
          {healthTips.filter(t => t.id !== dailyTip.id).map((tip, index) => (
            <div key={tip.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-lg font-bold text-slate-900 m-0 pr-4 group-hover:text-emerald-600 transition-colors">
                  {tip.title}
                </h4>
                {index % 2 === 0 ? <Heart size={20} className="text-pink-500 shrink-0" /> : <Leaf size={20} className="text-emerald-500 shrink-0" />}
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-4 flex-grow">
                {tip.content}
              </p>
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Source: {tip.source}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
