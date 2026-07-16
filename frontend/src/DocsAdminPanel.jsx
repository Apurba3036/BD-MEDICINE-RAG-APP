import { useState } from "react";
import { format } from "date-fns";
import { adminUpdateConfig, adminUpdateSection, adminUploadTeamMember } from "./api";
import { Save, ArrowLeft, Upload, Plus, Edit3 } from "lucide-react";

export default function DocsAdminPanel({ config, content, userEmail, onBack }) {
  const [isPublic, setIsPublic] = useState(config.is_public);
  const [startDate, setStartDate] = useState(config.scheduled_start ? format(new Date(config.scheduled_start), "yyyy-MM-dd'T'HH:mm") : "");
  const [endDate, setEndDate] = useState(config.scheduled_end ? format(new Date(config.scheduled_end), "yyyy-MM-dd'T'HH:mm") : "");
  const [savingConfig, setSavingConfig] = useState(false);

  // Section Editing
  const [editingSection, setEditingSection] = useState(null);
  const [sectionContent, setSectionContent] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  // Team Upload
  const [teamName, setTeamName] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [teamEmail, setTeamEmail] = useState("");
  const [teamFile, setTeamFile] = useState(null);
  const [uploadingTeam, setUploadingTeam] = useState(false);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await adminUpdateConfig({
        is_public: isPublic,
        scheduled_start: startDate ? new Date(startDate).toISOString() : "",
        scheduled_end: endDate ? new Date(endDate).toISOString() : "",
        admin_email: userEmail
      });
      alert("Config saved successfully");
    } catch (err) {
      alert("Failed to save config: " + err.message);
    }
    setSavingConfig(false);
  };

  const handleSaveSection = async () => {
    if (!editingSection) return;
    setSavingSection(true);
    try {
      await adminUpdateSection({
        section_id: editingSection.section_id,
        title: editingSection.title,
        content: sectionContent,
        admin_email: userEmail
      });
      alert("Section updated");
      setEditingSection(null);
    } catch (err) {
      alert("Failed to save section: " + err.message);
    }
    setSavingSection(false);
  };

  const handleAddTeamMember = async (e) => {
    e.preventDefault();
    if (!teamFile) return alert("Please select an image");
    
    setUploadingTeam(true);
    try {
      await adminUploadTeamMember({
        name: teamName,
        role: teamRole,
        email: teamEmail,
        adminEmail: userEmail,
        file: teamFile
      });
      alert("Team member added");
      setTeamName(""); setTeamRole(""); setTeamEmail(""); setTeamFile(null);
    } catch (err) {
      alert("Failed to add team member: " + err.message);
    }
    setUploadingTeam(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      <header className="flex items-center gap-6 px-8 py-4 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-colors" 
          onClick={onBack}
        >
          <ArrowLeft size={16} /> Back to Docs
        </button>
        <h2 className="text-2xl font-bold text-slate-800">Docs Admin Panel</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Visibility Controls */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">
              <Edit3 size={20} className="text-indigo-500" /> Access Control & Scheduling
            </h3>
            <div className="flex flex-col gap-5">
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
                <input 
                  type="checkbox" 
                  checked={isPublic} 
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-semibold text-slate-700">Publicly Accessible</span>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-600">Schedule Start (Optional)</span>
                <input 
                  type="datetime-local" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-700"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-600">Schedule End (Optional)</span>
                <input 
                  type="datetime-local" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-700"
                />
              </label>
              <button 
                className="mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-all" 
                onClick={handleSaveConfig} 
                disabled={savingConfig}
              >
                <Save size={18} /> {savingConfig ? "Saving..." : "Save Config"}
              </button>
            </div>
          </div>

          {/* Add Team Member */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">
              <Plus size={20} className="text-emerald-500" /> Add Team Member
            </h3>
            <form className="flex flex-col gap-4" onSubmit={handleAddTeamMember}>
              <input 
                placeholder="Full Name" 
                value={teamName} 
                onChange={e => setTeamName(e.target.value)} 
                required 
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-700"
              />
              <input 
                placeholder="Role" 
                value={teamRole} 
                onChange={e => setTeamRole(e.target.value)} 
                required 
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-700"
              />
              <input 
                type="email" 
                placeholder="Email (optional)" 
                value={teamEmail} 
                onChange={e => setTeamEmail(e.target.value)} 
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-slate-700"
              />
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl border-dashed">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => setTeamFile(e.target.files[0])} 
                  required 
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all cursor-pointer"
                />
              </div>
              <button 
                className="mt-2 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-all" 
                type="submit" 
                disabled={uploadingTeam}
              >
                <Upload size={18} /> {uploadingTeam ? "Uploading..." : "Add Member"}
              </button>
            </form>
          </div>

          {/* Section Editor */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-200 mb-8">
            <h3 className="text-lg font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">Edit Sections</h3>
            
            <div className="flex flex-wrap gap-3 mb-8">
              {content?.sections?.map(sec => (
                <button 
                  key={sec.section_id} 
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                    editingSection?.section_id === sec.section_id 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' 
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                  onClick={() => {
                    setEditingSection(sec);
                    setSectionContent(sec.content);
                  }}
                >
                  {sec.title}
                </button>
              ))}
            </div>

            {editingSection && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="bg-slate-800 rounded-xl p-1 shadow-inner">
                  <textarea 
                    value={sectionContent} 
                    onChange={(e) => setSectionContent(e.target.value)}
                    rows={16}
                    className="w-full p-4 bg-slate-900 text-slate-100 font-mono text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y leading-relaxed"
                    placeholder="Markdown content..."
                    spellCheck="false"
                  />
                </div>
                <button 
                  className="self-end flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-all" 
                  onClick={handleSaveSection} 
                  disabled={savingSection}
                >
                  <Save size={18} /> {savingSection ? "Saving..." : "Save Section"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
