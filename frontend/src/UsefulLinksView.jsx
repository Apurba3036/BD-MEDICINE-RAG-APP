import React from 'react';
import { ExternalLink, Globe, Stethoscope, HeartPulse, Hospital } from 'lucide-react';

const USEFUL_LINKS = [
  {
    id: 1,
    title: "World Health Organization (WHO)",
    description: "The United Nations agency that connects nations, partners and people to promote health, keep the world safe and serve the vulnerable.",
    url: "https://www.who.int/",
    icon: <Globe size={40} className="text-emerald-500" />,
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    hoverShadow: "hover:shadow-emerald-100"
  },
  {
    id: 2,
    title: "icddr,b",
    description: "An international health research institute based in Dhaka, Bangladesh. Dedicated to saving lives through research and treatment.",
    url: "https://www.icddrb.org/",
    icon: <Stethoscope size={40} className="text-blue-500" />,
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    hoverShadow: "hover:shadow-blue-100"
  },
  {
    id: 3,
    title: "Directorate General of Drug Administration (DGDA)",
    description: "The DGDA is the Drug Regulatory Authority of the Government of the People's Republic of Bangladesh.",
    url: "https://dgda.gov.bd/",
    icon: <Hospital size={40} className="text-violet-500" />,
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    hoverShadow: "hover:shadow-violet-100"
  },
  {
    id: 4,
    title: "Ministry of Health and Family Welfare",
    description: "Official government portal for health policies, family planning, and public health initiatives in Bangladesh.",
    url: "http://www.mohfw.gov.bd/",
    icon: <HeartPulse size={40} className="text-red-500" />,
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    hoverShadow: "hover:shadow-red-100"
  }
];

export default function UsefulLinksView() {
  return (
    <div className="flex-1 overflow-y-auto p-8 font-sans">
      <header className="mb-12 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center mb-4">
          <ExternalLink size={32} className="text-slate-800" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Useful Health Links</h1>
        <p className="text-slate-500 text-lg font-medium">Access trusted medical resources and organizations</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {USEFUL_LINKS.map((link) => (
          <a 
            key={link.id} 
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group block h-full no-underline"
          >
            <div className={`${link.bgColor} border ${link.borderColor} rounded-3xl p-8 h-full flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${link.hoverShadow}`}>
              <div className="bg-white rounded-2xl w-16 h-16 flex items-center justify-center shadow-sm mb-6 border border-white/50">
                {link.icon}
              </div>
              
              <h2 className="text-xl font-bold text-slate-900 mb-3 leading-tight group-hover:text-indigo-600 transition-colors">
                {link.title}
              </h2>
              
              <p className="text-slate-600 leading-relaxed flex-grow text-sm font-medium">
                {link.description}
              </p>
              
              <div className="mt-6 flex items-center font-bold text-sm tracking-wide text-slate-700 group-hover:text-indigo-600 transition-colors">
                Visit Website <ExternalLink size={16} className="ml-2 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
