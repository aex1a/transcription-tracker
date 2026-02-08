import React, { useState, useEffect } from 'react';
import { supabase } from './supabase'; 
import { 
  LayoutDashboard, Plus, List, 
  Trash2, Edit2, ExternalLink, Search, Moon, Sun,
  CheckCircle2, Clock, AlertCircle, Loader2, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- Utility Functions ---

const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
};

// --- Components ---

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-1 h-full ${colorClass}`}></div>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-extrabold text-slate-800 dark:text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg bg-opacity-10 ${colorClass.replace('bg-', 'bg-opacity-10 text-')}`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const styles = {
    'Completed': 'bg-emerald-100 text-emerald-800 border border-emerald-300',
    'In Progress': 'bg-blue-100 text-blue-800 border border-blue-300',
    'Pending QA': 'bg-amber-100 text-amber-800 border border-amber-300',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${styles[status] || 'bg-slate-100 text-slate-600 border border-slate-300'}`}>
      {status}
    </span>
  );
};

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    file_name: '', client: '', 
    timeString: '', 
    date: new Date().toISOString().split('T')[0], 
    link: '', notes: '', status: 'In Progress'
  });
  const [isEditing, setIsEditing] = useState(null);

  // --- 1. Fetch Data from Supabase ---
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    let { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching:', error);
    else setJobs(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // --- Handlers ---
  
  const padTime = (num) => num.toString().padStart(2, '0');

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    let hours = 0;
    let minutes = 0;
    
    if (formData.timeString.includes(':')) {
      const parts = formData.timeString.split(':');
      hours = parseInt(parts[0]) || 0;
      minutes = parseInt(parts[1]) || 0;
    } else {
      minutes = parseInt(formData.timeString) || 0;
    }

    const totalMinutes = (hours * 60) + minutes;
    
    const payload = {
      file_name: formData.file_name,
      client: formData.client,
      hours: hours,
      minutes: minutes,
      date: formData.date,
      link: formData.link,
      notes: formData.notes,
      status: formData.status,
      total_minutes: totalMinutes
    };

    if (isEditing) {
      const { error } = await supabase.from('jobs').update(payload).eq('id', isEditing);
      if (error) alert('Error updating!');
    } else {
      const { error } = await supabase.from('jobs').insert([payload]);
      if (error) alert('Error adding!');
    }
    
    await fetchJobs();
    
    setFormData({ file_name: '', client: '', timeString: '', date: new Date().toISOString().split('T')[0], link: '', notes: '', status: 'In Progress' });
    setIsEditing(null);
    setView('list');
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this record permanently?')) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) alert('Error deleting!');
      else fetchJobs(); 
    }
  };

  const handleEdit = (job) => {
    const timeStr = `${padTime(job.hours)}:${padTime(job.minutes)}`;

    setFormData({ 
      file_name: job.file_name, 
      client: job.client, 
      timeString: timeStr,
      date: job.date, 
      link: job.link, 
      notes: job.notes, 
      status: job.status 
    });
    setIsEditing(job.id);
    setView('add');
  };

  const handleTimeChange = (e) => {
    const val = e.target.value.replace(/[^0-9:]/g, '');
    setFormData({...formData, timeString: val});
  };

  // --- Calculations ---
  const totalFiles = jobs.filter(j => j.status === 'Completed').length;
  const totalMinutes = jobs.reduce((acc, curr) => acc + (curr.status === 'Completed' ? curr.total_minutes : 0), 0);
  
  const chartData = jobs.reduce((acc, job) => {
    const date = job.date;
    const found = acc.find(item => item.date === date);
    if (found) found.minutes += job.total_minutes;
    else acc.push({ date, minutes: job.total_minutes });
    return acc;
  }, []).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);

  const filteredJobs = jobs.filter(job => 
    job.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (job.client && job.client.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans antialiased`}>
      
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col fixed h-full z-20 hidden md:flex shadow-xl">
        <div className="p-8 border-b border-indigo-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white text-indigo-900 rounded-lg flex items-center justify-center font-bold">T</div>
            <span className="text-xl font-bold tracking-tight">TrackScribe</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
            { id: 'add', icon: Plus, label: 'New Entry' },
            { id: 'list', icon: List, label: 'History Table' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { setView(item.id); if(item.id === 'add') setIsEditing(null); }} 
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${view === item.id 
                  ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-900/50' 
                  : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-8 md:p-12 overflow-y-auto bg-slate-100 dark:bg-slate-950">
        
        {/* Mobile Header */}
        <div className="md:hidden flex justify-between items-center mb-8 pb-4 bg-indigo-900 text-white p-4 -m-8 mb-8 rounded-b-xl shadow-md">
          <span className="text-lg font-bold">TrackScribe</span>
          <button onClick={() => setDarkMode(!darkMode)}>{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </div>

        {loading && jobs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : (
          <>
            {/* --- VIEW: DASHBOARD --- */}
            {view === 'dashboard' && (
              <div className="space-y-8 max-w-7xl mx-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard</h2>
                    <p className="text-slate-500 mt-1">Real-time sync active.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard title="Total Completed" value={totalFiles} icon={CheckCircle2} colorClass="bg-emerald-500" />
                  <StatCard title="Hours Logged" value={formatDuration(totalMinutes)} icon={Clock} colorClass="bg-blue-500" />
                  <StatCard title="Pending Review" value={jobs.filter(j => j.status === 'Pending QA').length} icon={AlertCircle} colorClass="bg-amber-500" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Chart */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-white mb-6">Weekly Volume</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="minutes" fill="#4f46e5" radius={[4, 4, 4, 4]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recent Files Table (Updated) */}
                  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                       <h3 className="font-bold text-slate-800 dark:text-white">Recent Activity</h3>
                    </div>
                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-indigo-600 text-white border-b border-indigo-700">
                          <tr>
                            <th className="px-5 py-3 border-r border-indigo-500">File</th>
                            <th className="px-5 py-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {jobs.slice(0, 5).map(job => (
                            <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                              <td className="px-5 py-3 border-r border-slate-200 dark:border-slate-700">
                                <p className="font-medium text-slate-900 dark:text-white truncate max-w-[120px]">{job.file_name}</p>
                                <p className="text-xs text-slate-400">{formatDate(job.date)}</p>
                              </td>
                              <td className="px-5 py-3 text-right"><StatusBadge status={job.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- VIEW: ADD (Redesigned) --- */}
            {view === 'add' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in duration-300">
                  
                  {/* Header */}
                  <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">
                      {isEditing ? 'Edit Entry' : 'New Entry'}
                    </h2>
                    <button onClick={() => setView('dashboard')} className="text-indigo-100 hover:text-white transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <form onSubmit={handleSave} className="p-6 space-y-5">
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">File Name</label>
                      <input 
                        required 
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                        placeholder="e.g. Meeting_Recording_01.mp3"
                        value={formData.file_name} 
                        onChange={e => setFormData({...formData, file_name: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Client Name</label>
                      <input 
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                        placeholder="Optional"
                        value={formData.client} 
                        onChange={e => setFormData({...formData, client: e.target.value})} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                         <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration (HH:MM)</label>
                         <input 
                          type="text"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600 dark:text-white font-mono" 
                          placeholder="00:00"
                          maxLength={5}
                          value={formData.timeString} 
                          onChange={handleTimeChange} 
                        />
                        <p className="text-xs text-slate-400 mt-1">Ex: 01:30 for 1h 30m</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                          value={formData.date} 
                          onChange={e => setFormData({...formData, date: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Link / URL</label>
                      <input 
                        type="url" 
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                        placeholder="https://..."
                        value={formData.link} 
                        onChange={e => setFormData({...formData, link: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                        value={formData.status} 
                        onChange={e => setFormData({...formData, status: e.target.value})}
                      >
                        <option>In Progress</option>
                        <option>Pending QA</option>
                        <option>Completed</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                      <button type="button" onClick={() => setView('dashboard')} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button>
                      <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md shadow-indigo-200 transition-all">
                        {loading ? 'Saving...' : 'Save Entry'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* --- VIEW: LIST (Updated with Borders & Colors) --- */}
            {view === 'list' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">File History</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input type="text" placeholder="Search records..." className="pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 w-full md:w-80 focus:ring-2 focus:ring-indigo-500 outline-none dark:bg-slate-800 dark:border-slate-700"
                      value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border border-slate-300 dark:border-slate-700">
                      <thead className="bg-indigo-600 text-white">
                        <tr>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider border border-indigo-500">Date</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider border border-indigo-500">File Name</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider border border-indigo-500">Client</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider border border-indigo-500">Duration</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider border border-indigo-500">Status</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider border border-indigo-500">Link</th>
                          <th className="p-4 text-xs font-bold uppercase tracking-wider text-right border border-indigo-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredJobs.map(job => (
                          <tr key={job.id} className="group hover:bg-indigo-50 dark:hover:bg-slate-700/50 transition-colors even:bg-slate-50 dark:even:bg-slate-800/50">
                            <td className="p-4 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap border border-slate-200 dark:border-slate-700">{formatDate(job.date)}</td>
                            <td className="p-4 font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">{job.file_name}</td>
                            <td className="p-4 text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{job.client || '—'}</td>
                            <td className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{formatDuration(job.total_minutes)}</td>
                            <td className="p-4 border border-slate-200 dark:border-slate-700"><StatusBadge status={job.status} /></td>
                            <td className="p-4 border border-slate-200 dark:border-slate-700">
                              {job.link ? (
                                <a href={job.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-sm font-bold">
                                  Open <ExternalLink size={14} />
                                </a>
                              ) : <span className="text-slate-300 text-sm">—</span>}
                            </td>
                            <td className="p-4 text-right border border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-end space-x-2">
                                <button onClick={() => handleEdit(job)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"><Edit2 size={18} /></button>
                                <button onClick={() => handleDelete(job.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"><Trash2 size={18} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}