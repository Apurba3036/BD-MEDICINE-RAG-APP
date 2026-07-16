import { useState, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { fetchDocsConfig } from "./api";
import { useAuth } from "./AuthContext";
import { Lock, LayoutDashboard, RefreshCcw, Book, FileText, Users } from "lucide-react";
import DocsAdminPanel from "./DocsAdminPanel";
import { HARDCODED_SECTIONS, HARDCODED_TEAM } from "./docsContent";

// Mermaid component for rendering diagrams
const MermaidRenderer = ({ chart }) => {
  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: 'base' });
    mermaid.contentLoaded();
  }, [chart]);
  
  return <div className="mermaid bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex justify-center my-6 overflow-x-auto">{chart}</div>;
};

export default function DocsPage() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [activeSection, setActiveSection] = useState("pitch-deck");

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetchDocsConfig(user?.email)
      .then((data) => {
        if (data.config && (data.config.sections || data.config.team)) {
          setConfig(data);
        } else if (data.sections || data.team) {
          setConfig({ config: data });
        } else {
          const transformedSections = HARDCODED_SECTIONS.map(sec => ({
            section_id: sec.id,
            title: sec.title,
            content: sec.content
          }));
          setConfig({ config: { sections: transformedSections, team: HARDCODED_TEAM } });
        }
      })
      .catch((err) => {
        console.warn("Falling back to hardcoded docs due to error:", err);
        const transformedSections = HARDCODED_SECTIONS.map(sec => ({
          section_id: sec.id,
          title: sec.title,
          content: sec.content
        }));
        setConfig({ config: { sections: transformedSections, team: HARDCODED_TEAM } });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-indigo-600 gap-4">
        <RefreshCcw className="animate-spin" size={40} />
        <p className="font-bold text-lg text-slate-700">Loading Documentation...</p>
      </div>
    );
  }

  if (error === "403") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-6 p-8 text-center">
        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
          <Lock size={48} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Not Available</h2>
        <p className="text-lg text-slate-600 max-w-md">This presentation is currently unavailable or outside the scheduled viewing window.</p>
        <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-colors" onClick={() => window.location.href = '/'}>Return Home</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-6 p-8 text-center">
        <h2 className="text-3xl font-bold text-slate-800">Something went wrong</h2>
        <p className="text-lg text-red-500 max-w-md">{error}</p>
        <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-colors" onClick={() => window.location.href = '/'}>Return Home</button>
      </div>
    );
  }

  if (!config || !config.config) {
    return null;
  }

  if (isAdminView) {
    return (
      <DocsAdminPanel 
        config={config.config} 
        userEmail={user?.email}
        onBack={() => { setIsAdminView(false); loadData(); }} 
      />
    );
  }

  const MarkdownComponents = {
    code({node, inline, className, children, ...props}) {
      const match = /language-(\w+)/.exec(className || '');
      if (!inline && match && match[1] === 'mermaid') {
        return <MermaidRenderer chart={String(children).replace(/\n$/, '')} />;
      }
      return <code className={`${inline ? 'bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-sm font-mono' : 'block bg-slate-800 text-slate-50 p-4 rounded-xl overflow-x-auto text-sm my-4 font-mono shadow-sm'}`} {...props}>{children}</code>;
    },
    h1: ({node, ...props}) => <h1 className="text-4xl font-bold text-slate-900 mt-12 mb-6 pb-4 border-b border-slate-200" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-slate-800 mt-10 mb-4" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-xl font-bold text-slate-800 mt-8 mb-3" {...props} />,
    p: ({node, ...props}) => <p className="text-lg text-slate-600 leading-relaxed mb-6" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-6 text-lg text-slate-600 space-y-2" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-6 text-lg text-slate-600 space-y-2" {...props} />,
    li: ({node, ...props}) => <li className="pl-1" {...props} />,
    a: ({node, ...props}) => <a className="text-indigo-600 font-semibold hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 bg-indigo-50 pl-6 py-4 pr-4 rounded-r-xl my-6 text-indigo-900 italic shadow-sm" {...props} />
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="px-8 py-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.location.href = '/'}>
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            <Book size={20} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
            BD Medicine AI <span className="text-indigo-600 font-black tracking-wide ml-1">DOCS</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {config?.is_admin && (
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 rounded-xl font-semibold text-sm transition-all shadow-sm" 
              onClick={() => setIsAdminView(true)}
            >
              <LayoutDashboard size={16} /> Admin Panel
            </button>
          )}
          <a href="/" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-md">
            Go to App
          </a>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        {/* Sidebar Navigation */}
        <aside className="w-64 shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto py-8 pr-6 hidden md:block">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-3">Contents</h3>
          <ul className="flex flex-col gap-1">
            {config.config?.sections?.map(sec => (
              <li 
                key={sec.section_id} 
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all ${
                  activeSection === sec.section_id 
                    ? 'bg-indigo-100 text-indigo-700 font-bold' 
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                onClick={() => {
                  setActiveSection(sec.section_id);
                  document.getElementById(sec.section_id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <FileText size={16} className={activeSection === sec.section_id ? 'text-indigo-600' : 'text-slate-400'} />
                {sec.title}
              </li>
            ))}
            {config.config?.team?.length > 0 && (
              <li 
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all mt-4 ${
                  activeSection === 'team' 
                    ? 'bg-indigo-100 text-indigo-700 font-bold' 
                    : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
                onClick={() => {
                  setActiveSection('team');
                  document.getElementById('team')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Users size={16} className={activeSection === 'team' ? 'text-indigo-600' : 'text-slate-400'} />
                Team
              </li>
            )}
          </ul>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-white shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.02)]">
          <div className="max-w-3xl mx-auto px-8 py-12">
            {config.config?.sections?.map(sec => (
              <section key={sec.section_id} id={sec.section_id} className="mb-20 scroll-mt-24">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]} 
                  rehypePlugins={[rehypeRaw]}
                  components={MarkdownComponents}
                >
                  {sec.content}
                </ReactMarkdown>
              </section>
            ))}

            {config.config?.team?.length > 0 && (
              <section id="team" className="mb-20 scroll-mt-24">
                <h2 className="text-4xl font-bold text-slate-900 mt-12 mb-10 pb-4 border-b border-slate-200">The Team</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {config.config?.team?.map(member => (
                    <div key={member.id} className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-white shadow-sm">
                        <img src={member.image_url} alt={member.name} className="w-full h-full object-cover" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">{member.name}</h3>
                      <p className="text-indigo-600 font-bold text-sm tracking-wide uppercase mb-3">{member.role}</p>
                      {member.email && (
                        <a href={`mailto:${member.email}`} className="text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors">
                          {member.email}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
