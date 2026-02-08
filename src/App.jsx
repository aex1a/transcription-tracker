import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase'; 
import { Analytics } from "@vercel/analytics/react"; 
import { 
  LayoutDashboard, Plus, List, Timer, 
  Trash2, Edit2, ExternalLink, Search, 
  CheckCircle2, Clock, AlertCircle, Loader2, X, CalendarDays, Settings,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, RotateCcw, GripVertical,
  Play, Pause, Square, ArrowRight, Check
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- Utility Functions ---

const getDeviceId = () => {
  let id = localStorage.getItem('trackscribe_device_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('trackscribe_device_id', id);
  }
  return id;
};

const formatDecimalHours = (totalSeconds) => {
  if (!totalSeconds) return '0.000';
  const hours = totalSeconds / 3600;
  return hours.toFixed(3); 
};

const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  let parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  
  return parts.join(' ');
};

const parseDurationStringToSeconds = (timeString) => {
  if (!timeString) return 0;
  const parts = timeString.split(':').map(Number);
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) { h = parts[0]; m = parts[1]; s = parts[2]; }
  else if (parts.length === 2) { m = parts[0]; s = parts[1]; }
  else if (parts.length === 1) { m = parts[0]; }
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
};

// --- Components ---

const BillingCard = ({ label, count, hours, onEdit }) => (
  <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)', borderRadius: '16px', padding: '24px', color: 'white', boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)', position: 'relative' }}>
    <button onClick={onEdit} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }} title="Edit Billing Cycle">
      <Settings size={16} />
    </button>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
      <div><p style={{ fontSize: '13px', fontWeight: '600', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Billing Cycle</p><p style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', color: '#e0e7ff' }}>{label}</p></div>
      <CalendarDays size={24} style={{ opacity: 0.8, marginRight: '40px' }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      <div><h3 style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>{count}</h3><p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Files Completed</p></div>
      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '20px' }}><h3 style={{ fontSize: '32px', fontWeight: '800', lineHeight: '1' }}>{hours}</h3><p style={{ fontSize: '13px', opacity: 0.8, marginTop: '4px' }}>Audio Hours</p></div>
    </div>
  </div>
);

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="stat-card" style={{ borderLeft: `4px solid ${color}` }}>
    <div className="stat-content"><p className="stat-title">{title}</p><h3 className="stat-value">{value}</h3></div>
    <div className="stat-icon" style={{ color: color, backgroundColor: `${color}15` }}><Icon size={24} /></div>
  </div>
);

const StatusBadge = ({ status }) => {
  const c = { 'Completed': {bg:'#ecfdf5', t:'#047857', b:'#a7f3d0'}, 'In Progress': {bg:'#eff6ff', t:'#1d4ed8', b:'#bfdbfe'}, 'Pending QA': {bg:'#fffbeb', t:'#b45309', b:'#fde68a'} }[status] || {bg:'#f3f4f6', t:'#374151', b:'#e5e7eb'};
  return <span style={{ backgroundColor: c.bg, color: c.t, border: `1px solid ${c.b}`, padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>{status}</span>;
};

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  
  // FILTERS
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('All'); 

  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [colWidth, setColWidth] = useState(250); 
  const resizingRef = useRef(false);

  const [billingStartDay, setBillingStartDay] = useState(() => parseInt(localStorage.getItem('billingStart') || '13'));
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [tempBillingDay, setTempBillingDay] = useState(billingStartDay);

  const [formData, setFormData] = useState({ 
    file_name: '', client: 'Mantis', timeString: '', 
    date: new Date().toISOString().split('T')[0], 
    link: '', notes: '', status: 'In Progress' 
  });
  const [isEditing, setIsEditing] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false); 

  // --- TIMER LOGIC STATE ---
  const [timerData, setTimerData] = useState({
    file_name: '', client: 'Mantis', durationString: '', 
    link: ''
  });
  const [timerStage, setTimerStage] = useState('FR'); // 'FR' -> 'SV'
  const [activeJobId, setActiveJobId] = useState(null); // ID of the job created in FR
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); 
  const [totalTat, setTotalTat] = useState(0); 
  const timerIntervalRef = useRef(null);

  // --- Data Fetching ---
  useEffect(() => { fetchJobs(); }, []);
  useEffect(() => { localStorage.setItem('billingStart', billingStartDay); }, [billingStartDay]);

  // --- TIMER EFFECT ---
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prevTime) => Math.max(0, prevTime - 1));
      }, 1000);
    } else if (timeLeft === 0 && timerRunning) {
      setTimerRunning(false);
      clearInterval(timerIntervalRef.current);
      alert("Time's up for this stage!");
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [timerRunning, timeLeft]);

  // --- TAT CALCULATOR ---
  const calculateTatForStage = (stage) => {
    const audioSeconds = parseDurationStringToSeconds(timerData.durationString);
    if (audioSeconds === 0) {
      setTotalTat(0);
      if (!timerRunning) setTimeLeft(0);
      return;
    }
    // FR = 0.5x, SV = 1.5x
    const multiplier = stage === 'FR' ? 0.5 : 1.5;
    const calculatedTat = Math.round(audioSeconds * multiplier);
    setTotalTat(calculatedTat);
    if (!timerRunning) {
        setTimeLeft(calculatedTat);
    }
  };

  // Recalculate when input changes (only if not running)
  useEffect(() => {
    if (!timerRunning) {
        calculateTatForStage(timerStage);
    }
  }, [timerData.durationString, timerStage]);

  // --- RESIZE LOGIC ---
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (resizingRef.current) setColWidth((prevWidth) => Math.max(100, prevWidth + e.movementX));
    };
    const handleMouseUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = 'default';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e) => {
    e.preventDefault();
    resizingRef.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const fetchJobs = async () => {
    setLoading(true);
    const deviceId = getDeviceId(); 
    let { data, error } = await supabase.from('jobs').select('*').eq('user_id', deviceId).order('created_at', { ascending: false });
    if (!error) setJobs(data || []);
    setLoading(false);
  };

  // --- TIMER ACTION HANDLERS ---
  
  const handleTimerStartPause = () => {
    if (totalTat === 0) {
        calculateTatForStage(timerStage);
        if (totalTat === 0) return alert("Please enter a valid audio duration first.");
    }
    setTimerRunning(!timerRunning);
  };

  // STEP 1: FINISH FR (Save as In Progress -> Move to SV)
  const handleFinishFR = async () => {
    if (totalTat === 0) return;
    setTimerRunning(false);
    clearInterval(timerIntervalRef.current);

    setLoading(true);
    const deviceId = getDeviceId();
    
    const audioSeconds = parseDurationStringToSeconds(timerData.durationString);
    const h = Math.floor(audioSeconds / 3600);
    const m = Math.floor((audioSeconds % 3600) / 60);
    const s = audioSeconds % 60;

    const payload = { 
      file_name: timerData.file_name || 'Untitled Timer Entry', 
      client: timerData.client, 
      hours: h, minutes: m, seconds: s, 
      date: new Date().toISOString().split('T')[0], 
      link: timerData.link, 
      status: 'In Progress', // Stage 1 is just In Progress
      notes: 'First Review Completed',
      total_seconds: audioSeconds, 
      total_minutes: Math.floor(audioSeconds / 60),
      user_id: deviceId 
    };

    // Create the job
    const { data, error } = await supabase.from('jobs').insert([payload]).select();
    
    if (error) {
        alert("Error saving: " + error.message);
    } else {
        await fetchJobs();
        // MOVE TO NEXT STAGE
        setActiveJobId(data[0].id); // Remember this job ID
        setTimerStage('SV'); // Switch mode to SV
        // Recalculate time happens automatically via useEffect
    }
    setLoading(false);
  };

  // STEP 2: FINISH SV (Update to Completed -> Reset)
  const handleFinishSV = async () => {
    if (!activeJobId) return alert("Error: No active job found.");
    setTimerRunning(false);
    clearInterval(timerIntervalRef.current);

    if(!confirm("Mark this file as fully COMPLETED?")) return;

    setLoading(true);
    
    // Update the existing job to Completed
    const { error } = await supabase
      .from('jobs')
      .update({ status: 'Completed', notes: 'Speaker Verification Completed' })
      .eq('id', activeJobId);

    if (error) {
        alert("Error updating: " + error.message);
    } else {
        await fetchJobs();
        // Reset Timer completely for next file
        setTimerData({ file_name: '', client: 'Mantis', durationString: '', link: '' });
        setTimerStage('FR');
        setActiveJobId(null);
        setTimeLeft(0);
        setView('list'); // Go to list to see success
    }
    setLoading(false);
  };

  // --- MODAL HANDLERS ---
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    const deviceId = getDeviceId();
    let h = 0, m = 0, s = 0;
    const parts = formData.timeString.split(':').map(Number);
    if (parts.length === 3) { h = parts[0]; m = parts[1]; s = parts[2]; }
    else if (parts.length === 2) { m = parts[0]; s = parts[1]; }
    else { m = parts[0]; }
    const totalSeconds = (h * 3600) + (m * 60) + s;
    const payload = { file_name: formData.file_name, client: formData.client, hours: h, minutes: m, seconds: s, date: formData.date, link: formData.link, notes: formData.notes, status: formData.status, total_seconds: totalSeconds, total_minutes: Math.floor(totalSeconds / 60), user_id: deviceId };
    if (isEditing) await supabase.from('jobs').update(payload).eq('id', isEditing);
    else await supabase.from('jobs').insert([payload]);
    await fetchJobs();
    setFormData({ file_name: '', client: 'Mantis', timeString: '', date: new Date().toISOString().split('T')[0], link: '', notes: '', status: 'In Progress' });
    setIsEditing(null);
    setShowEntryModal(false);
  };

  const handleDelete = async (id) => { if (confirm('Delete this record?')) { await supabase.from('jobs').delete().eq('id', id); fetchJobs(); } };
  const handleEdit = (job) => { const pad = (n) => n.toString().padStart(2, '0'); let timeStr = job.hours > 0 ? `${pad(job.hours)}:${pad(job.minutes)}:${pad(job.seconds||0)}` : `${pad(job.minutes)}:${pad(job.seconds||0)}`; setFormData({ ...job, timeString: timeStr }); setIsEditing(job.id); setShowEntryModal(true); };
  const openNewEntry = () => { setIsEditing(null); setFormData({ file_name: '', client: 'Mantis', timeString: '', date: new Date().toISOString().split('T')[0], link: '', notes: '', status: 'In Progress' }); setShowEntryModal(true); };
  const handleTimeChange = (e) => setFormData({...formData, timeString: e.target.value.replace(/[^0-9:]/g, '')});
  const clearAllFilters = () => { setSearchTerm(''); setFilterDate(''); setFilterType('All'); };
  const hasActiveFilters = searchTerm || filterDate || filterType !== 'All';
  const requestSort = (key) => { let direction = 'asc'; if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const SortIcon = ({ column }) => { if (sortConfig.key !== column) return <ArrowUpDown size={14} style={{opacity:0.3}} />; return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />; };

  const getBillingCycle = () => { const today = new Date(); const d = today.getDate(), m = today.getMonth(), y = today.getFullYear(); const s = billingStartDay; let start, end; if (d >= s) { start = new Date(y, m, s); end = new Date(y, m + 1, s - 1); } else { start = new Date(y, m - 1, s); end = new Date(y, m, s - 1); } const opt = { month: 'short', day: 'numeric' }; return { start, end, label: `${start.toLocaleDateString('en-US', opt)} - ${end.toLocaleDateString('en-US', opt)}` }; };
  const cycle = getBillingCycle();
  const cycleJobs = jobs.filter(j => { const d = new Date(j.date); return d >= cycle.start && d <= cycle.end && j.status === 'Completed'; });
  const cycleSecs = cycleJobs.reduce((acc, curr) => acc + (curr.total_seconds || 0), 0);
  const filteredJobs = jobs.filter(j => { const matchesSearch = j.file_name.toLowerCase().includes(searchTerm.toLowerCase()); const matchesDate = filterDate ? j.date === filterDate : true; const matchesType = filterType === 'All' ? true : (j.client === filterType); return matchesSearch && matchesDate && matchesType; });
  const listTotalSeconds = filteredJobs.reduce((acc, job) => acc + (job.total_seconds || 0), 0);
  const sortedJobs = [...filteredJobs].sort((a, b) => { if (sortConfig.key === 'date') { return sortConfig.direction === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date); } if (sortConfig.key === 'client') { const valA = (a.client || '').toLowerCase(); const valB = (b.client || '').toLowerCase(); if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; } if (sortConfig.key === 'status') { const statusOrder = { 'In Progress': 1, 'Pending QA': 2, 'Completed': 3 }; const valA = statusOrder[a.status] || 99; const valB = statusOrder[b.status] || 99; return sortConfig.direction === 'asc' ? valA - valB : valB - valA; } return 0; });
  const chartData = jobs.reduce((acc, job) => { const d = job.date; const f = acc.find(i => i.date === d); const m = Math.floor((job.total_seconds || 0) / 60); if (f) f.minutes += m; else acc.push({ date: d, minutes: m }); return acc; }, []).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);

  const styles = {
    container: { fontFamily: 'Inter, sans-serif', backgroundColor: '#f1f5f9', minHeight: '100vh', display: 'flex' },
    sidebar: { width: '250px', backgroundColor: '#0f172a', color: 'white', display: 'flex', flexDirection: 'column', position: 'fixed', height: '100%', zIndex: 50 },
    main: { flex: 1, marginLeft: '250px', padding: '2rem', overflowY: 'auto' },
    navBtn: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', width: '100%', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s' },
    navBtnActive: { backgroundColor: '#1e293b', color: 'white', borderRight: '3px solid #6366f1' },
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: '#f8fafc', boxSizing:'border-box' },
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    th: { backgroundColor: '#f8fafc', color: '#475569', padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' },
    thClickable: { cursor: 'pointer', userSelect: 'none', display:'flex', alignItems:'center', gap:'6px' },
    td: { padding: '14px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#334155' },
    tdWrapper: { width: '100%', height: '100%', whiteSpace: 'nowrap', overflowX: 'auto', overflowY: 'hidden', display: 'block' },
    radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
    radioActive: { backgroundColor: '#e0e7ff', borderColor: '#6366f1', color: '#4338ca', fontWeight: '600' },
    primaryBtn: { backgroundColor: '#4f46e5', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
    
    // TIMER STYLES
    timerDisplay: { fontSize: '48px', fontWeight: 'bold', fontFamily: 'monospace', color: '#4f46e5', textAlign: 'center', margin: '20px 0' },
    timerControls: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' },
    controlBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
    startBtn: { backgroundColor: '#10b981', color: 'white' },
    pauseBtn: { backgroundColor: '#f59e0b', color: 'white' },
    stopBtn: { backgroundColor: '#ef4444', color: 'white' },
    stageOption: { display: 'flex', flexDirection: 'column', padding: '15px', borderRadius: '8px', border: '2px solid #e2e8f0', flex: 1, textAlign:'center' },
    stageActive: { borderColor: '#6366f1', backgroundColor: '#e0e7ff' },
    stageTitle: { fontWeight: 'bold', marginBottom: '4px', color: '#0f172a' },
    stageDesc: { fontSize: '12px', color: '#64748b' }
  };

  return (
    <div style={styles.container}>
      <style>{` .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } `}</style>

      <aside style={styles.sidebar} className="hidden-on-mobile">
        <div style={{ padding: '24px', borderBottom: '1px solid #1e293b' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#6366f1', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>T</div>
            TrackScribe
          </h2>
        </div>
        <nav style={{ padding: '20px 0', flex: 1 }}>
          <button onClick={() => setView('dashboard')} style={{ ...styles.navBtn, ...(view === 'dashboard' ? styles.navBtnActive : {}) }}><LayoutDashboard size={18} /> Overview</button>
          <button onClick={() => setView('timer')} style={{ ...styles.navBtn, ...(view === 'timer' ? styles.navBtnActive : {}) }}><Timer size={18} /> Timer</button>
          <button onClick={() => setView('list')} style={{ ...styles.navBtn, ...(view === 'list' ? styles.navBtnActive : {}) }}><List size={18} /> All Files</button>
        </nav>
      </aside>

      <main style={{ ...styles.main, marginLeft: window.innerWidth < 768 ? '0' : '250px' }}>
        <div style={{ display: window.innerWidth < 768 ? 'flex' : 'none', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
           <h2 style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#1e1b4b' }}>TrackScribe</h2>
           <button onClick={openNewEntry} style={{backgroundColor:'#6366f1', color:'white', border:'none', padding:'6px 12px', borderRadius:'6px'}}>+ Add</button>
        </div>

        {loading ? <div style={{display:'flex', justifyContent:'center', marginTop:'50px'}}><Loader2 className="animate-spin text-indigo-500" /></div> : (
          <>
            {view === 'dashboard' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Dashboard</h2>
                  <button onClick={openNewEntry} style={styles.primaryBtn}><Plus size={16} /> Add New Entry</button>
                </div>
                <div style={{ marginBottom: '30px' }}><BillingCard label={cycle.label} count={cycleJobs.length} hours={formatDecimalHours(cycleSecs)} onEdit={() => { setTempBillingDay(billingStartDay); setShowBillingModal(true); }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}><StatCard title="Total Lifetime Files" value={jobs.filter(j => j.status === 'Completed').length} icon={CheckCircle2} color="#10b981" /><StatCard title="Pending Review" value={jobs.filter(j => j.status === 'Pending QA').length} icon={AlertCircle} color="#f59e0b" /></div>
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}><h3 style={{ fontWeight: 'bold', marginBottom: '20px', fontSize: '14px', textTransform:'uppercase', color:'#64748b' }}>Weekly Output (Minutes)</h3><div style={{ height: '250px' }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} /><YAxis axisLine={false} tickLine={false} /><Tooltip cursor={{fill: 'transparent'}} /><Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 4, 4]} barSize={32} /></BarChart></ResponsiveContainer></div></div>
              </div>
            )}

            {/* --- NEW TIMER VIEW (2-STAGE WORKFLOW) --- */}
            {view === 'timer' && (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', marginBottom: '24px' }}>TAT Timer</h2>
                
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  
                  {/* VISUAL STAGE INDICATOR */}
                  <div style={{display:'flex', gap:'10px', marginBottom:'24px'}}>
                    <div style={{...styles.stageOption, ...(timerStage === 'FR' ? styles.stageActive : {})}}>
                        <div style={{fontSize:'12px', fontWeight:'bold', color: timerStage === 'FR' ? '#4f46e5' : '#94a3b8'}}>STEP 1</div>
                        <div style={{fontWeight:'bold'}}>First Review</div>
                        <div style={{fontSize:'11px', color:'#64748b'}}>0.5x Audio Time</div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', color:'#94a3b8'}}><ArrowRight size={20}/></div>
                    <div style={{...styles.stageOption, ...(timerStage === 'SV' ? styles.stageActive : {})}}>
                        <div style={{fontSize:'12px', fontWeight:'bold', color: timerStage === 'SV' ? '#4f46e5' : '#94a3b8'}}>STEP 2</div>
                        <div style={{fontWeight:'bold'}}>Speaker Verification</div>
                        <div style={{fontSize:'11px', color:'#64748b'}}>1.5x Audio Time</div>
                    </div>
                  </div>

                  {/* FORM FIELDS (Disabled during SV stage to prevent changing core file info) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={styles.label}>File Name</label>
                      <input style={styles.input} placeholder="e.g. Meeting_Audio_01" value={timerData.file_name} onChange={e => setTimerData({...timerData, file_name: e.target.value})} disabled={timerRunning || timerStage === 'SV'} />
                    </div>
                    <div>
                        <label style={styles.label}>Audio Duration (HH:MM:SS)</label>
                        <input style={{...styles.input, fontFamily: 'monospace'}} placeholder="00:00:00" maxLength={8} value={timerData.durationString} onChange={(e) => setTimerData({...timerData, durationString: e.target.value.replace(/[^0-9:]/g, '')})} disabled={timerRunning || timerStage === 'SV'} />
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                      <label style={styles.label}>File Type</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {['Mantis', 'Cricket'].map(type => (
                          <div key={type} onClick={() => (!timerRunning && timerStage === 'FR') && setTimerData({...timerData, client: type})} style={{...styles.radioLabel, ...(timerData.client === type ? styles.radioActive : {}), cursor: (timerRunning || timerStage === 'SV') ? 'not-allowed' : 'pointer', opacity: (timerRunning || timerStage === 'SV') ? 0.7 : 1}}>
                            <div style={{width:'16px', height:'16px', borderRadius:'50%', border:'2px solid', borderColor: timerData.client === type ? '#6366f1' : '#cbd5e1', display:'flex', alignItems:'center', justifyContent:'center'}}>
                              {timerData.client === type && <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#6366f1'}} />}
                            </div>
                            {type}
                          </div>
                        ))}
                      </div>
                  </div>

                  {/* TIMER DISPLAY */}
                  <div style={{textAlign:'center', marginBottom:'20px'}}>
                    <div style={{fontSize:'14px', color:'#64748b', marginBottom:'4px'}}>
                        {timerStage === 'FR' ? 'Target TAT: First Review' : 'Target TAT: Speaker Verification'}
                    </div>
                    <div style={styles.timerDisplay}>
                        {formatDuration(timeLeft)}
                    </div>
                  </div>

                  {/* TIMER CONTROLS - DYNAMIC BASED ON STAGE */}
                  <div style={styles.timerControls}>
                    {!timerRunning ? (
                        <button onClick={handleTimerStartPause} style={{...styles.controlBtn, ...styles.startBtn}} disabled={totalTat === 0}>
                            <Play size={16} fill="white" /> Start Timer
                        </button>
                    ) : (
                        <button onClick={handleTimerStartPause} style={{...styles.controlBtn, ...styles.pauseBtn}}>
                            <Pause size={16} fill="white" /> Pause
                        </button>
                    )}

                    {/* DYNAMIC ACTION BUTTON */}
                    {timerStage === 'FR' ? (
                        <button onClick={handleFinishFR} style={{...styles.controlBtn, backgroundColor:'#4f46e5', color:'white'}} disabled={totalTat === 0}>
                            <ArrowRight size={16} /> Finish FR & Go to SV
                        </button>
                    ) : (
                        <button onClick={handleFinishSV} style={{...styles.controlBtn, ...styles.startBtn}} disabled={totalTat === 0}>
                            <Check size={16} /> Finish All & Complete
                        </button>
                    )}
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>Link (Optional)</label>
                      <input type="url" style={styles.input} placeholder="https://..." value={timerData.link} onChange={e => setTimerData({...timerData, link: e.target.value})} disabled={timerStage === 'SV'} />
                  </div>
                </div>
              </div>
            )}

            {/* ENTRY MODAL & OTHER COMPONENTS REMAIN UNCHANGED */}
            {showEntryModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
                    <button onClick={() => setShowEntryModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSave} style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>File Name</label>
                      <input required style={styles.input} placeholder="e.g. Meeting_Audio_01" value={formData.file_name} onChange={e => setFormData({...formData, file_name: e.target.value})} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>File Type</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div onClick={() => setFormData({...formData, client: 'Mantis'})} style={{...styles.radioLabel, ...(formData.client === 'Mantis' ? styles.radioActive : {})}}><div style={{width:'16px', height:'16px', borderRadius:'50%', border:'2px solid', borderColor: formData.client === 'Mantis' ? '#6366f1' : '#cbd5e1', display:'flex', alignItems:'center', justifyContent:'center'}}>{formData.client === 'Mantis' && <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#6366f1'}} />}</div>Mantis</div>
                        <div onClick={() => setFormData({...formData, client: 'Cricket'})} style={{...styles.radioLabel, ...(formData.client === 'Cricket' ? styles.radioActive : {})}}><div style={{width:'16px', height:'16px', borderRadius:'50%', border:'2px solid', borderColor: formData.client === 'Cricket' ? '#6366f1' : '#cbd5e1', display:'flex', alignItems:'center', justifyContent:'center'}}>{formData.client === 'Cricket' && <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#6366f1'}} />}</div>Cricket</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div><label style={styles.label}>Duration (HH:MM:SS)</label><input style={{...styles.input, fontFamily: 'monospace'}} placeholder="00:00:00" maxLength={8} value={formData.timeString} onChange={handleTimeChange} /></div>
                      <div><label style={styles.label}>Date</label><input type="date" style={styles.input} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                    </div>
                    <div style={{ marginBottom: '16px' }}><label style={styles.label}>Link</label><input type="url" style={styles.input} placeholder="https://..." value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} /></div>
                    <div style={{ marginBottom: '24px' }}><label style={styles.label}>Status</label><select style={styles.input} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option>In Progress</option><option>Pending QA</option><option>Completed</option></select></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}><button type="button" onClick={() => setShowEntryModal(false)} style={{ padding: '10px 16px', border: 'none', background: 'transparent', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>Cancel</button><button type="submit" style={{ padding: '10px 20px', border: 'none', background: '#4f46e5', color: 'white', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)' }}>{loading ? 'Saving...' : 'Save Entry'}</button></div>
                  </form>
                </div>
              </div>
            )}

            {showBillingModal && (<div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}><div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '350px', padding: '24px' }}><h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold' }}>Billing Settings</h3><label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Start Day</label><input type="number" min="1" max="31" value={tempBillingDay} onChange={(e) => setTempBillingDay(parseInt(e.target.value))} style={styles.input} /><p style={{fontSize:'12px', color:'#64748b', marginTop:'8px'}}>Example: <strong>13</strong> means cycle runs from 13th to 12th.</p><button onClick={() => { setBillingStartDay(tempBillingDay); setShowBillingModal(false); }} style={{ width: '100%', marginTop: '20px', padding: '10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Save Changes</button><button onClick={() => setShowBillingModal(false)} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'transparent', color: '#64748b', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button></div></div>)}
            
            {view === 'list' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', flexWrap:'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap:'10px' }}>
                  <div style={{display:'flex', alignItems:'center', gap:'16px'}}><h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a', margin: '0' }}>File History</h2><button onClick={openNewEntry} style={styles.primaryBtn}><Plus size={16} /> Add New</button></div>
                  <div style={{ display: 'flex', flexDirection:'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ background: '#e0e7ff', color: '#4338ca', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', border:'1px solid #c7d2fe', display:'flex', gap:'8px' }}><span>Total: {formatDecimalHours(listTotalSeconds)}</span><span style={{opacity:0.6}}>|</span><span>{formatDuration(listTotalSeconds)}</span></div>
                    <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
                        {hasActiveFilters && (<button onClick={clearAllFilters} style={{display:'flex', alignItems:'center', gap:'4px', border:'none', background:'#fee2e2', color:'#ef4444', borderRadius:'8px', padding:'0 10px', height:'34px', cursor:'pointer', fontSize:'12px', fontWeight:'bold'}}><RotateCcw size={12} /> Clear</button>)}
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', cursor:'pointer', backgroundColor:'white', height:'34px'}}><option value="All">All Types</option><option value="Mantis">Mantis</option><option value="Cricket">Cricket</option></select>
                        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor:'white', height:'34px', boxSizing:'border-box'}} />
                        <div style={{position:'relative'}}><Search size={16} style={{position:'absolute', left:'10px', top:'9px', opacity:0.4}} /><input style={{...styles.input, width: '200px', backgroundColor: 'white', paddingLeft:'32px', height:'34px'}} placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th} onClick={() => requestSort('date')}><div style={styles.thClickable}>Date <SortIcon column="date" /></div></th>
                        <th style={{...styles.th, width: `${colWidth}px`, position: 'relative'}}><div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>File Name<GripVertical size={14} style={{color:'#94a3b8', marginRight:'4px'}} /></div><div onMouseDown={startResizing} style={{position:'absolute', right:0, top:0, bottom:0, width:'8px', cursor:'col-resize', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{width:'2px', height:'100%', backgroundColor:'#0f172a', opacity: 0.3}} /></div></th>
                        <th style={styles.th} onClick={() => requestSort('client')}><div style={styles.thClickable}>Type <SortIcon column="client" /></div></th>
                        <th style={styles.th}>Duration</th>
                        <th style={styles.th} onClick={() => requestSort('status')}><div style={styles.thClickable}>Status <SortIcon column="status" /></div></th>
                        <th style={styles.th}>Link</th>
                        <th style={{...styles.th, textAlign: 'right'}}>EDIT/DELETE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedJobs.length > 0 ? sortedJobs.map(job => (<tr key={job.id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={styles.td}>{formatDate(job.date)}</td><td style={{...styles.td, width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px`}}><div style={styles.tdWrapper} className="no-scrollbar" title={job.file_name}>{job.file_name}</div></td><td style={styles.td}>{job.client||'-'}</td><td style={{...styles.td, fontFamily: 'monospace', color:'#6366f1'}}>{formatDuration(job.total_seconds)}</td><td style={styles.td}><StatusBadge status={job.status} /></td><td style={styles.td}>{job.link && <a href={job.link} target="_blank"><ExternalLink size={12}/></a>}</td><td style={{...styles.td, textAlign: 'right'}}><button onClick={() => handleEdit(job)} style={{background:'none', border:'none', cursor:'pointer', marginRight:'8px'}}><Edit2 size={16}/></button><button onClick={() => handleDelete(job.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444'}}><Trash2 size={16}/></button></td></tr>)) : (<tr><td colSpan="7" style={{padding:'24px', textAlign:'center', color:'#94a3b8'}}>No files match your filters.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      
      <Analytics />
      <style>{` .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between; transition: transform 0.2s; } .stat-card:hover { transform: translateY(-2px); } .stat-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; } .stat-value { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; } .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: #f1f5f9; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } `}</style>
    </div>
  );
}