import React, { useState, useEffect } from 'react';
import { supabase } from './supabase'; 
import { 
  LayoutDashboard, Plus, List, 
  Trash2, Edit2, ExternalLink, Search, 
  CheckCircle2, Clock, AlertCircle, Loader2, X, CalendarDays
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- Utility Functions ---

// Convert seconds to "1.58" decimal format
const formatDecimalHours = (totalSeconds) => {
  if (!totalSeconds) return '0.00';
  const hours = totalSeconds / 3600;
  return hours.toFixed(2); // Returns string like "1.58"
};

// Standard HH:MM:SS format for the table
const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return '0s';
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

// Get current billing cycle (13th to 12th)
const getBillingCycle = () => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let start, end;

  if (currentDay >= 13) {
    // Current cycle started this month on the 13th
    start = new Date(currentYear, currentMonth, 13);
    end = new Date(currentYear, currentMonth + 1, 12);
  } else {
    // Current cycle started last month on the 13th
    start = new Date(currentYear, currentMonth - 1, 13);
    end = new Date(currentYear, currentMonth, 12);
  }
  
  // Format dates for display
  const options = { month: 'short', day: 'numeric' };
  return {
    start: start,
    end: end,
    label: `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
  };
};

// --- Components ---

const BillingCard = ({ label, count, hours }) => (
  <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', borderRadius: '16px', padding: '24px', color: 'white', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
      <div>
        <p style={{ fontSize: '13px', fontWeight: '600', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Billing Cycle</p>
        <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>{label}</p>
      </div>
      <CalendarDays size={24} style={{ opacity: 0.8 }} />
    </div>
    
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div>
        <h3 style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>{count}</h3>
        <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Files Completed</p>
      </div>
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '20px' }}>
        <h3 style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>{hours}</h3>
        <p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Audio Hours</p>
      </div>
    </div>
  </div>
);

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="stat-content">
      <p className="stat-title">{title}</p>
      <h3 className="stat-value">{value}</h3>
    </div>
    <div className="stat-icon" style={{ color: color, backgroundColor: `${color}15` }}>
      <Icon size={24} />
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const colors = {
    'Completed': { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
    'In Progress': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    'Pending QA': { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  };
  const c = colors[status] || { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
  
  return (
    <span style={{ 
      backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase'
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

  // CSS Styles
  const styles = {
    container: { fontFamily: 'Inter, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex' },
    sidebar: { width: '250px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100%', zIndex: 50 },
    main: { flex: 1, marginLeft: '250px', padding: '2rem', overflowY: 'auto' },
    navBtn: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', width: '100%', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s' },
    navBtnActive: { backgroundColor: '#1e293b', color: 'white', borderRight: '3px solid #6366f1' },
    
    // Modal
    overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
    modal: { backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' },
    
    // Inputs
    label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', transition: 'border 0.2s', backgroundColor: '#f8fafc' },
    
    // Table
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    th: { backgroundColor: '#f8fafc', color: '#475569', padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
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

    let h = 0, m = 0, s = 0;
    const parts = formData.timeString.split(':').map(Number);
    if (parts.length === 3) { h = parts[0]; m = parts[1]; s = parts[2]; }
    else if (parts.length === 2) { m = parts[0]; s = parts[1]; }
    else { m = parts[0]; }

    const totalSeconds = (h * 3600) + (m * 60) + s;

    const payload = {
      file_name: formData.file_name, client: formData.client,
      hours: h, minutes: m, seconds: s,
      date: formData.date, link: formData.link, notes: formData.notes, status: formData.status,
      total_seconds: totalSeconds,
      total_minutes: Math.floor(totalSeconds / 60)
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
    let timeStr = job.hours > 0 ? `${padTime(job.hours)}:${padTime(job.minutes)}:${padTime(job.seconds||0)}` : `${padTime(job.minutes)}:${padTime(job.seconds||0)}`;
    setFormData({ ...job, timeString: timeStr });
    setIsEditing(job.id);
    setView('add');
  };

  const handleTimeChange = (e) => setFormData({...formData, timeString: e.target.value.replace(/[^0-9:]/g, '')});

  // --- CALCULATIONS ---
  const billingCycle = getBillingCycle();
  
  // Filter jobs for CURRENT BILLING CYCLE
  const cycleJobs = jobs.filter(job => {
    const jobDate = new Date(job.date);
    return jobDate >= billingCycle.start && jobDate <= billingCycle.end && job.status === 'Completed';
  });

  const cycleFiles = cycleJobs.length;
  const cycleSeconds = cycleJobs.reduce((acc, curr) => acc + (curr.total_seconds || 0), 0);
  
  // Lifetime Stats
  const lifetimeFiles = jobs.filter(j => j.status === 'Completed').length;
  const pendingFiles = jobs.filter(j => j.status === 'Pending QA').length;

  // Chart Data
  const chartData = jobs.reduce((acc, job) => {
    const date = job.date;
    const found = acc.find(item => item.date === date);
    const min = Math.floor((job.total_seconds || 0) / 60);
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
        <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#6366f1', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>T</div>
            TrackScribe
          </h2>
        </div>
        <nav style={{ padding: '20px 0' }}>
          {[{ id: 'dashboard', icon: LayoutDashboard, label: 'Overview' }, { id: 'add', icon: Plus, label: 'New Entry' }, { id: 'list', icon: List, label: 'All Files' }].map((item) => (
            <button key={item.id} onClick={() => { setView(item.id); if(item.id === 'add') setIsEditing(null); }} style={{ ...styles.navBtn, ...(view === item.id ? styles.navBtnActive : {}) }}>
              <item.icon size={18} /> {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ ...styles.main, marginLeft: window.innerWidth < 768 ? '0' : '250px' }}>
        
        {/* Mobile Header */}
        <div style={{ display: window.innerWidth < 768 ? 'flex' : 'none', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
           <h2 style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#1e1b4b' }}>TrackScribe</h2>
           <button onClick={() => setView('add')} style={{backgroundColor:'#6366f1', color:'white', border:'none', padding:'6px 12px', borderRadius:'6px'}}>+ Add</button>
        </div>

        {loading && jobs.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '50px' }}><Loader2 className="animate-spin text-indigo-500" /></div>
        ) : (
          <>
            {view === 'dashboard' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px', color: '#0f172a' }}>Dashboard</h2>
                
                {/* --- NEW BILLING CYCLE CARD --- */}
                <div style={{ marginBottom: '30px' }}>
                  <BillingCard 
                    label={billingCycle.label} 
                    count={cycleFiles} 
                    hours={formatDecimalHours(cycleSeconds)} 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                  <StatCard title="Total Lifetime Files" value={lifetimeFiles} icon={CheckCircle2} color="#10b981" />
                  <StatCard title="Pending Review" value={pendingFiles} icon={AlertCircle} color="#f59e0b" />
                </div>

                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                   <h3 style={{ fontWeight: 'bold', marginBottom: '20px', fontSize: '14px', textTransform:'uppercase', color:'#64748b' }}>Weekly Output (Minutes)</h3>
                   <div style={{ height: '250px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} />
                          <YAxis axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: 'transparent'}} />
                          <Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 4, 4]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              </div>
            )}

            {view === 'add' && (
              <div style={styles.overlay}>
                <div style={styles.modal}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
                    <button onClick={() => setView('dashboard')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20}/></button>
                  </div>
                  
                  <form onSubmit={handleSave} style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>File Name</label>
                      <input required style={styles.input} placeholder="e.g. Meeting_Audio_01" value={formData.file_name} onChange={e => setFormData({...formData, file_name: e.target.value})} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>Client Name</label>
                      <input style={styles.input} placeholder="Optional" value={formData.client} onChange={e => setFormData({...formData, client: e.target.value})} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div>
                        <label style={styles.label}>Duration (HH:MM:SS)</label>
                        <input style={{...styles.input, fontFamily: 'monospace'}} placeholder="00:00:00" maxLength={8} value={formData.timeString} onChange={handleTimeChange} />
                      </div>
                      <div>
                         <label style={styles.label}>Date</label>
                         <input type="date" style={styles.input} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>Link / URL</label>
                      <input type="url" style={styles.input} placeholder="https://..." value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                      <label style={styles.label}>Status</label>
                      <select style={styles.input} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option>In Progress</option>
                        <option>Pending QA</option>
                        <option>Completed</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                      <button type="button" onClick={() => setView('dashboard')} style={{ padding: '10px 16px', border: 'none', background: 'transparent', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" style={{ padding: '10px 20px', border: 'none', background: '#4f46e5', color: 'white', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}>{loading ? 'Saving...' : 'Save Entry'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {view === 'list' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>File History</h2>
                  <input style={{...styles.input, width: '250px', backgroundColor: 'white'}} placeholder="Search records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                
                <div style={{ overflowX: 'auto', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
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
                          <td style={{...styles.td, fontWeight: '600', color: '#0f172a'}}>{job.file_name}</td>
                          <td style={styles.td}>{job.client || '-'}</td>
                          <td style={{...styles.td, fontFamily: 'monospace', color: '#6366f1'}}>
                            {formatDuration(job.total_seconds || (job.total_minutes * 60))}
                          </td>
                          <td style={styles.td}><StatusBadge status={job.status} /></td>
                          <td style={styles.td}>
                             {job.link && <a href={job.link} target="_blank" style={{ color: '#4f46e5', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>Open <ExternalLink size={12}/></a>}
                          </td>
                          <td style={{...styles.td, textAlign: 'right'}}>
                            <button onClick={() => handleEdit(job)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', marginRight: '8px' }}><Edit2 size={16}/></button>
                            <button onClick={() => handleDelete(job.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16}/></button>
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
      
      <style>{`
        .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
        .stat-value { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
        .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
}