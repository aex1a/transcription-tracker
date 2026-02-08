import React, { useState, useEffect } from 'react';
import { supabase } from './supabase'; 
import { 
  LayoutDashboard, Plus, List, 
  Trash2, Edit2, ExternalLink, Search, Moon, Sun,
  CheckCircle2, Clock, AlertCircle, Loader2, X
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- Utility Functions ---
const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return '0m 0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
};

// --- Components ---
const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="stat-content">
      <p className="stat-title">{title}</p>
      <h3 className="stat-value">{value}</h3>
    </div>
    <div className="stat-icon" style={{ color: color, backgroundColor: `${color}20` }}>
      <Icon size={24} />
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const colors = {
    'Completed': { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
    'In Progress': { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
    'Pending QA': { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  };
  const c = colors[status] || { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  
  return (
    <span style={{ 
      backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold'
    }}>
      {status}
    </span>
  );
};

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    file_name: '', client: '', timeString: '', 
    date: new Date().toISOString().split('T')[0], 
    link: '', notes: '', status: 'In Progress'
  });
  const [isEditing, setIsEditing] = useState(null);

  // --- Styles Object ---
  const styles = {
    container: { fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex' },
    sidebar: { width: '250px', backgroundColor: '#1e1b4b', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100%', left: 0, top: 0 },
    main: { flex: 1, marginLeft: '250px', padding: '2rem', overflowY: 'auto' },
    navButton: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#c7d2fe', cursor: 'pointer', fontSize: '14px', transition: '0.2s' },
    navButtonActive: { backgroundColor: '#312e81', color: 'white', borderRight: '4px solid #6366f1' },
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
    modalBox: { backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '500px', overflow: 'hidden', animation: 'fadeIn 0.3s ease-out' },
    modalHeader: { backgroundColor: '#4f46e5', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' },
    modalBody: { padding: '24px' },
    label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
    input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px', outline: 'none', transition: 'border 0.2s', boxSizing: 'border-box' },
    row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' },
    formGroup: { marginBottom: '16px' },
    btnPrimary: { backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' },
    btnSecondary: { backgroundColor: 'transparent', color: '#64748b', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', marginRight: '10px' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
    th: { backgroundColor: '#4f46e5', color: 'white', padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' },
    td: { padding: '14px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#334155' }
  };

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    setLoading(true);
    let { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (!error) setJobs(data || []);
    setLoading(false);
  };

  const padTime = (num) => num.toString().padStart(2, '0');

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Parsing Logic: Handles HH:MM:SS or MM:SS
    let h = 0, m = 0, s = 0;
    const parts = formData.timeString.split(':').map(Number);
    
    if (parts.length === 3) {
      h = parts[0] || 0; m = parts[1] || 0; s = parts[2] || 0;
    } else if (parts.length === 2) {
      m = parts[0] || 0; s = parts[1] || 0;
    } else {
      m = parts[0] || 0;
    }

    const totalSeconds = (h * 3600) + (m * 60) + s;

    const payload = {
      file_name: formData.file_name,
      client: formData.client,
      hours: h, minutes: m, seconds: s, // New field
      date: formData.date,
      link: formData.link,
      notes: formData.notes,
      status: formData.status,
      total_seconds: totalSeconds, // New calculation
      total_minutes: Math.floor(totalSeconds / 60) // Keep for backup
    };

    if (isEditing) await supabase.from('jobs').update(payload).eq('id', isEditing);
    else await supabase.from('jobs').insert([payload]);
    
    await fetchJobs();
    setFormData({ file_name: '', client: '', timeString: '', date: new Date().toISOString().split('T')[0], link: '', notes: '', status: 'In Progress' });
    setIsEditing(null);
    setView('list');
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this record?')) {
      await supabase.from('jobs').delete().eq('id', id);
      fetchJobs();
    }
  };

  const handleEdit = (job) => {
    // Reconstruct time string properly based on what exists
    let timeStr = '';
    if (job.hours > 0) {
      timeStr = `${padTime(job.hours)}:${padTime(job.minutes)}:${padTime(job.seconds || 0)}`;
    } else {
      timeStr = `${padTime(job.minutes)}:${padTime(job.seconds || 0)}`;
    }

    setFormData({ ...job, timeString: timeStr });
    setIsEditing(job.id);
    setView('add');
  };

  const handleTimeChange = (e) => {
    // Allow digits and colons only
    setFormData({...formData, timeString: e.target.value.replace(/[^0-9:]/g, '')});
  };

  // Stats
  const totalFiles = jobs.filter(j => j.status === 'Completed').length;
  // Summing up Total Seconds for accuracy
  const totalSecondsAll = jobs.reduce((acc, curr) => {
    if (curr.status !== 'Completed') return acc;
    // Fallback to total_minutes * 60 if total_seconds is missing (old data)
    const sec = curr.total_seconds !== undefined ? curr.total_seconds : (curr.total_minutes * 60);
    return acc + sec;
  }, 0);

  const chartData = jobs.reduce((acc, job) => {
    const date = job.date;
    const found = acc.find(item => item.date === date);
    const min = job.total_minutes || Math.floor((job.total_seconds || 0) / 60);
    if (found) found.minutes += min;
    else acc.push({ date, minutes: min });
    return acc;
  }, []).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);

  const filteredJobs = jobs.filter(job => 
    job.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (job.client && job.client.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar} className="hidden-on-mobile">
        <div style={{ padding: '24px', borderBottom: '1px solid #312e81' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'white', color: '#1e1b4b', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>T</div>
            TrackScribe
          </h2>
        </div>
        <nav style={{ padding: '20px 10px' }}>
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Overview' },
            { id: 'add', icon: Plus, label: 'New Entry' },
            { id: 'list', icon: List, label: 'History Table' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => { setView(item.id); if(item.id === 'add') setIsEditing(null); }} 
              style={{ ...styles.navButton, ...(view === item.id ? styles.navButtonActive : {}) }}
            >
              <item.icon size={20} /> {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ ...styles.main, marginLeft: window.innerWidth < 768 ? '0' : '250px' }}>
        
        {/* Mobile Header (Simple) */}
        <div style={{ display: window.innerWidth < 768 ? 'flex' : 'none', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
           <h2 style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#1e1b4b' }}>TrackScribe</h2>
           <button onClick={() => setView('add')} style={{...styles.btnPrimary, padding: '8px'}}>+ Add</button>
        </div>

        {loading && jobs.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '50px' }}><Loader2 className="animate-spin" /></div>
        ) : (
          <>
            {/* --- DASHBOARD --- */}
            {view === 'dashboard' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#0f172a' }}>Dashboard</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                  <StatCard title="Files Completed" value={totalFiles} icon={CheckCircle2} color="#10b981" />
                  <StatCard title="Total Audio Time" value={formatDuration(totalSecondsAll)} icon={Clock} color="#3b82f6" />
                  <StatCard title="Pending QA" value={jobs.filter(j => j.status === 'Pending QA').length} icon={AlertCircle} color="#f59e0b" />
                </div>

                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                   <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>Weekly Activity (Minutes)</h3>
                   <div style={{ height: '300px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="minutes" fill="#4f46e5" radius={[4, 4, 4, 4]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              </div>
            )}

            {/* --- NEW ENTRY MODAL --- */}
            {view === 'add' && (
              <div style={styles.overlay}>
                <div style={styles.modalBox}>
                  <div style={styles.modalHeader}>
                    <h2 style={{ margin: 0, fontSize: '18px' }}>{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
                    <button onClick={() => setView('dashboard')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X /></button>
                  </div>
                  
                  <form onSubmit={handleSave} style={styles.modalBody}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>File Name</label>
                      <input required style={styles.input} placeholder="e.g. Meeting_Audio_01" value={formData.file_name} onChange={e => setFormData({...formData, file_name: e.target.value})} />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Client Name</label>
                      <input style={styles.input} placeholder="Optional" value={formData.client} onChange={e => setFormData({...formData, client: e.target.value})} />
                    </div>

                    <div style={styles.row}>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Duration (HH:MM:SS)</label>
                        <input 
                          style={{...styles.input, fontFamily: 'monospace'}} 
                          placeholder="00:00:00" 
                          maxLength={8} 
                          value={formData.timeString} 
                          onChange={handleTimeChange} 
                        />
                        <p style={{fontSize: '11px', color: '#64748b', marginTop: '4px'}}>
                          Format: <strong>01:30:05</strong> (1h 30m 5s) or <strong>45:30</strong> (45m 30s)
                        </p>
                      </div>
                      <div style={styles.formGroup}>
                         <label style={styles.label}>Date</label>
                         <input type="date" style={styles.input} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                      </div>
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Link / URL</label>
                      <input type="url" style={styles.input} placeholder="https://..." value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} />
                    </div>

                    <div style={{...styles.formGroup, marginBottom: '30px'}}>
                      <label style={styles.label}>Status</label>
                      <select style={styles.input} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option>In Progress</option>
                        <option>Pending QA</option>
                        <option>Completed</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => setView('dashboard')} style={styles.btnSecondary}>Cancel</button>
                      <button type="submit" style={styles.btnPrimary}>{loading ? 'Saving...' : 'Save Entry'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* --- LIST VIEW --- */}
            {view === 'list' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>File History</h2>
                  <input style={{...styles.input, width: '250px'}} placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div style={{ overflowX: 'auto', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Date</th>
                        <th style={styles.th}>File Name</th>
                        <th style={styles.th}>Client</th>
                        <th style={styles.th}>Duration</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Link</th>
                        <th style={{...styles.th, textAlign: 'right'}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map(job => (
                        <tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={styles.td}>{formatDate(job.date)}</td>
                          <td style={{...styles.td, fontWeight: 'bold'}}>{job.file_name}</td>
                          <td style={styles.td}>{job.client || '-'}</td>
                          <td style={{...styles.td, fontFamily: 'monospace'}}>
                            {formatDuration(job.total_seconds || (job.total_minutes * 60))}
                          </td>
                          <td style={styles.td}><StatusBadge status={job.status} /></td>
                          <td style={styles.td}>
                             {job.link && <a href={job.link} target="_blank" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>Open <ExternalLink size={12}/></a>}
                          </td>
                          <td style={{...styles.td, textAlign: 'right'}}>
                            <button onClick={() => handleEdit(job)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', marginRight: '8px' }}><Edit2 size={18}/></button>
                            <button onClick={() => handleDelete(job.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={18}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      
      {/* Inject Global Styles */}
      <style>{`
        .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: space-between; }
        .stat-title { font-size: 12px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .stat-value { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
        .stat-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        /* Hide scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}