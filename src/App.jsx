import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase'; 
import { Analytics } from "@vercel/analytics/react"; 
import XLSX from 'xlsx-js-style'; 
import { 
  LayoutDashboard, Plus, List, Timer, 
  Trash2, Edit2, ExternalLink, Search, 
  CheckCircle2, AlertCircle, Loader2, X, CalendarDays, Settings,
  ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, GripVertical,
  Play, Pause, ArrowRight, Check, Menu, Download, Moon, Sun,
  StickyNote, Save // Added Save icon
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

// UPDATED: Format Date + Time (PHT & EST)
const formatDateWithTime = (dateString, timestamp) => {
  if (!dateString) return '';
  
  const datePart = new Date(dateString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  if (!timestamp) return datePart; // Fallback for old entries

  const dateObj = new Date(timestamp);
  
  // Format PHT (UTC+8)
  const phtTime = dateObj.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Format EST (UTC-5)
  const estTime = dateObj.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div>
      <div style={{fontWeight: 'bold'}}>{datePart}</div>
      <div style={{fontSize: '10px', opacity: 0.8, marginTop: '2px'}}>PHT: {phtTime}</div>
      <div style={{fontSize: '10px', opacity: 0.6}}>EST: {estTime}</div>
    </div>
  );
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
};

// --- Typewriter Effect ---
const TypewriterText = ({ text, speed = 10 }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let index = 0;
    // Safety check if text is null/undefined
    const safeText = text || ''; 
    if (safeText.length === 0) return;

    const intervalId = setInterval(() => {
      setDisplayedText((prev) => prev + safeText.charAt(index));
      index++;
      if (index === safeText.length) {
        clearInterval(intervalId);
      }
    }, speed); 

    return () => clearInterval(intervalId);
  }, [text, speed]);

  return <p style={{whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0}}>{displayedText}</p>;
};


// --- Color Themes ---
const themes = {
  light: {
    bg: '#191414',            
    text: '#ffffff',          
    mutedText: '#b3b3b3',
    sidebarBg: '#ffffff',     
    sidebarText: '#191414',
    sidebarActiveBg: '#f0f0f0', 
    sidebarActiveText: '#191414',
    cardBg: '#212121',        
    border: '#535353',        
    accent: '#1db954',        
    accentSec: '#ffffff',
    tableHeaderBg: '#1db954',
    tableHeaderText: '#ffffff',
    unnamedRowBg: '#450a0a', 
    statCardShadow: '0 4px 12px rgba(0,0,0,0.5)'
  },
  dark: {
    bg: '#141e2d',            
    text: '#ffffff',          
    mutedText: '#9ca3af',
    sidebarBg: '#ffffff',     
    sidebarText: '#212529',   
    sidebarActiveBg: '#79c142', 
    sidebarActiveText: '#ffffff', 
    cardBg: '#212529',        
    border: '#79c142',        
    accent: '#79c142',        
    accentSec: '#ffffff',
    tableHeaderBg: '#212529', 
    tableHeaderText: '#79c142', 
    unnamedRowBg: '#3f1a1a', 
    statCardShadow: '0 4px 6px -1px rgba(0,0,0,0.5)'
  }
};

// --- Components ---

const BillingCard = ({ label, count, hours, onEdit, onExport, theme, darkMode }) => (
  <div className="billing-card" style={{ 
    background: darkMode ? 'linear-gradient(135deg, #141e2d 0%, #212529 100%)' : 'linear-gradient(135deg, #191414 0%, #1db954 100%)', 
    borderRadius: '16px', 
    padding: '24px', 
    color: '#ffffff', 
    boxShadow: theme.statCardShadow, 
    position: 'relative', 
    border: `1px solid ${theme.border}` 
  }}>
    <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px' }}>
      <button onClick={onExport} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff' }} title="Export Excel">
        <Download size={16} />
      </button>
      <button onClick={onEdit} style={{ background: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff' }} title="Edit Billing Cycle">
        <Settings size={16} />
      </button>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
      <div><p style={{ fontSize: '13px', fontWeight: '700', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff' }}>Current Billing Cycle</p><p style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '4px', color: '#ffffff' }}>{label}</p></div>
      <CalendarDays size={24} style={{ opacity: 0.9, color: '#ffffff', marginRight: '80px' }} />
    </div>
    <div className="billing-stats-grid">
      <div><h3 style={{ fontSize: '32px', fontWeight: '900', lineHeight: '1' }}>{count}</h3><p style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px', color: '#ffffff' }}>Files Completed</p></div>
      <div className="billing-separator"><h3 style={{ fontSize: '32px', fontWeight: '900', lineHeight: '1' }}>{hours}</h3><p style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px', color: '#ffffff' }}>Audio Hours</p></div>
    </div>
  </div>
);

const StatCard = ({ title, value, icon: Icon, color, theme }) => (
  <div className="stat-card" style={{ 
    borderLeft: `4px solid ${color}`, 
    backgroundColor: theme.cardBg, 
    boxShadow: theme.statCardShadow,
    border: `1px solid ${theme.border}`,
    borderLeftWidth: '4px' 
  }}>
    <div className="stat-content">
      <p className="stat-title" style={{ color: theme.mutedText }}>{title}</p>
      <h3 className="stat-value" style={{ color: theme.text }}>{value}</h3>
    </div>
    <div className="stat-icon" style={{ color: color, backgroundColor: 'rgba(255,255,255,0.05)' }}>
      <Icon size={24} />
    </div>
  </div>
);

const StatusBadge = ({ status, darkMode }) => {
  const c = { 
    'Completed': {
        bg: darkMode ? '#79c142' : 'rgba(29, 185, 84, 0.2)', 
        t: darkMode ? '#141e2d' : '#ffffff', 
        b: darkMode ? '#79c142' : '#1db954'
    }, 
    'In Progress': {
        bg: '#ffffff', 
        t: '#212529', 
        b: '#ffffff'
    }, 
    'Pending QA': {
        bg: 'rgba(255, 255, 255, 0.1)', 
        t: '#ffffff', 
        b: '#b3b3b3'
    } 
  }[status] || {bg:'#f3f4f6', t:'#374151', b:'#e5e7eb'};
  
  return <span style={{ backgroundColor: c.bg, color: c.t, border: `1px solid ${c.b}`, padding: '4px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing:'0.5px' }}>{status}</span>;
};

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('trackscribe_theme') === 'dark');
  const currentTheme = darkMode ? themes.dark : themes.light;

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterType, setFilterType] = useState('All'); 

  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [colWidth, setColWidth] = useState(250); 
  const resizingRef = useRef(false);

  const [billingStartDate, setBillingStartDate] = useState(() => localStorage.getItem('billingStartDate') || new Date().toISOString().split('T')[0]);
  const [billingEndDate, setBillingEndDate] = useState(() => {
    const saved = localStorage.getItem('billingEndDate');
    if (saved) return saved;
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [tempBillingStart, setTempBillingStart] = useState(billingStartDate);
  const [tempBillingEnd, setTempBillingEnd] = useState(billingEndDate);

  const [formData, setFormData] = useState({ 
    file_name: '', client: 'Mantis', timeString: '', 
    date: new Date().toISOString().split('T')[0], 
    link: '', notes: '', status: 'In Progress' 
  });
  const [isEditing, setIsEditing] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false); 

  // --- STATE for Note Modal ---
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [isEditingNoteModal, setIsEditingNoteModal] = useState(false); // New: track if editing in modal
  const [viewNoteContent, setViewNoteContent] = useState('');
  const [tempNoteContent, setTempNoteContent] = useState(''); // New: hold edits
  const [viewNoteTitle, setViewNoteTitle] = useState('');
  const [noteModalJobId, setNoteModalJobId] = useState(null); // New: track ID for saving

  const [timerData, setTimerData] = useState({
    file_name: '', 
    client: 'Mantis', durationString: '', link: ''
  });
  const [timerStage, setTimerStage] = useState('FR'); 
  const [activeJobId, setActiveJobId] = useState(null); 
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); 
  const [totalTat, setTotalTat] = useState(0); 
  const timerIntervalRef = useRef(null);

  useEffect(() => { fetchJobs(); }, []);
  
  useEffect(() => { 
    localStorage.setItem('billingStartDate', billingStartDate); 
    localStorage.setItem('billingEndDate', billingEndDate); 
  }, [billingStartDate, billingEndDate]);

  useEffect(() => {
    localStorage.setItem('trackscribe_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const calculateTatForStage = (stage) => {
    const audioSeconds = parseDurationStringToSeconds(timerData.durationString);
    if (audioSeconds === 0) {
      setTotalTat(0);
      if (!timerRunning) setTimeLeft(0);
      return;
    }
    const multiplier = stage === 'FR' ? 0.5 : 1.5;
    const calculatedTat = Math.round(audioSeconds * multiplier);
    setTotalTat(calculatedTat);
    
    if (!timerRunning) {
        setTimeLeft(calculatedTat);
    }
  };

  useEffect(() => {
    if (!timerRunning) calculateTatForStage(timerStage);
    if (timerStage === 'FR' && timerData.durationString.length === 8 && !timerRunning) {
        const secs = parseDurationStringToSeconds(timerData.durationString);
        if (secs > 0) setTimerRunning(true);
    }
    if (timerStage === 'SV' && !timerRunning && totalTat > 0) {
        setTimerRunning(true);
    }
  }, [timerData.durationString, timerStage, totalTat]);

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

  const generateAutoName = (existingJobs) => {
    const unnamedDocs = existingJobs.filter(j => j.file_name && j.file_name.startsWith("Unnamed File"));
    if (unnamedDocs.length === 0) return "Unnamed File 1";
    
    const nums = unnamedDocs.map(j => {
        const match = j.file_name.match(/Unnamed File (\d+)/);
        if (match) return parseInt(match[1]);
        if (j.file_name === "Unnamed File") return 1;
        return 0; 
    });
    
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    return `Unnamed File ${maxNum + 1}`;
  };

  const downloadBillingXLSX = () => {
    const cycle = getBillingCycle();
    const cycleJobs = jobs.filter(j => { 
        const d = new Date(j.date); 
        d.setHours(0,0,0,0);
        const s = new Date(cycle.start); s.setHours(0,0,0,0);
        const e = new Date(cycle.end); e.setHours(23,59,59,999);
        return d >= s && d <= e && j.status === 'Completed'; 
    });

    if (cycleJobs.length === 0) {
        alert("No completed files found for this billing cycle.");
        return;
    }

    const totalHoursSum = cycleJobs.reduce((acc, job) => acc + (job.total_seconds / 3600), 0);

    const exportData = cycleJobs.map(job => ({
        "Date": job.date,
        "File Name": job.file_name,
        "Client": job.client,
        "Duration": formatDuration(job.total_seconds),
        "Total Hours (Decimal)": parseFloat((job.total_seconds / 3600).toFixed(4)),
        "Status": job.status,
        "Link": job.link || ""
    }));

    exportData.push({
        "Date": "", 
        "File Name": "TOTAL", 
        "Client": "",
        "Duration": "",
        "Total Hours (Decimal)": parseFloat(totalHoursSum.toFixed(4)), 
        "Status": "",
        "Link": ""
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(ws['!ref']);
    const borderStyle = {
        top: { style: "thin", color: { auto: 1 } },
        bottom: { style: "thin", color: { auto: 1 } },
        left: { style: "thin", color: { auto: 1 } },
        right: { style: "thin", color: { auto: 1 } }
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({r: R, c: C});
            if (!ws[cell_address]) continue;
            if (!ws[cell_address].s) ws[cell_address].s = {};
            ws[cell_address].s.border = borderStyle;
            if (R === 0) {
                ws[cell_address].s.font = { bold: true };
                ws[cell_address].s.alignment = { horizontal: "center" };
            }
            if (R === range.e.r) {
                ws[cell_address].s.font = { bold: true };
            }
        }
    }

    const wscols = [{wch: 12}, {wch: 40}, {wch: 10}, {wch: 10}, {wch: 22}, {wch: 12}, {wch: 30}];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Billing Cycle");
    const fileName = `Billing_${billingStartDate}_to_${billingEndDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const handleTimerStartPause = () => {
    if (totalTat === 0) {
        calculateTatForStage(timerStage);
        if (totalTat === 0) return alert("Please enter a valid audio duration first.");
    }
    setTimerRunning(!timerRunning);
  };

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

    let finalName = timerData.file_name.trim();
    if (!finalName) {
        finalName = generateAutoName(jobs);
    }
    
    // UPDATED: Save completion timestamp
    const payload = { 
      file_name: finalName, 
      client: timerData.client, 
      hours: h, minutes: m, seconds: s, 
      date: new Date().toISOString().split('T')[0], 
      created_at: new Date().toISOString(), // TIMESTAMP ADDED
      link: timerData.link, 
      status: 'In Progress', 
      notes: 'First Review Completed',
      total_seconds: audioSeconds, 
      total_minutes: Math.floor(audioSeconds / 60),
      user_id: deviceId 
    };

    const { data, error } = await supabase.from('jobs').insert([payload]).select();
    if (error) { alert("Error saving: " + error.message); } else { await fetchJobs(); setActiveJobId(data[0].id); setTimerStage('SV'); }
    setLoading(false);
  };

  const handleFinishSV = async () => {
    if (!activeJobId) return alert("Error: No active job found.");
    setTimerRunning(false);
    clearInterval(timerIntervalRef.current);
    if(!confirm("Mark this file as fully COMPLETED?")) return;
    setLoading(true);
    const { error } = await supabase.from('jobs').update({ status: 'Completed', notes: 'Speaker Verification Completed' }).eq('id', activeJobId);
    if (error) { alert("Error updating: " + error.message); } else { await fetchJobs(); setTimerData({ file_name: '', client: 'Mantis', durationString: '', link: '' }); setTimerStage('FR'); setActiveJobId(null); setTimeLeft(0); setView('list'); }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    const deviceId = getDeviceId();
    let h = 0, m = 0, s = 0;
    
    if (formData.timeString) {
      const parts = formData.timeString.split(':').map(Number);
      if (parts.length === 3) { h = parts[0]; m = parts[1]; s = parts[2]; }
      else if (parts.length === 2) { m = parts[0]; s = parts[1]; }
      else { m = parts[0]; }
    }
    
    const totalSeconds = (h * 3600) + (m * 60) + s;
    let finalName = formData.file_name ? formData.file_name.trim() : '';
    
    if (!finalName) {
        finalName = generateAutoName(jobs);
    }
    
    // UPDATED: Save completion timestamp for Manual Entry too
    const payload = { 
      file_name: finalName, 
      client: formData.client, 
      hours: h, minutes: m, seconds: s, 
      date: formData.date, 
      created_at: new Date().toISOString(), // TIMESTAMP ADDED
      link: formData.link, 
      notes: formData.notes, 
      status: formData.status, 
      total_seconds: totalSeconds, 
      total_minutes: Math.floor(totalSeconds / 60), 
      user_id: deviceId 
    };
    
    let error;
    if (isEditing) {
       const res = await supabase.from('jobs').update(payload).eq('id', isEditing);
       error = res.error;
    } else {
       const res = await supabase.from('jobs').insert([payload]);
       error = res.error;
    }
    
    if (error) {
        alert("Failed to save entry: " + error.message);
    } else {
        await fetchJobs();
        setFormData({ file_name: '', client: 'Mantis', timeString: '', date: new Date().toISOString().split('T')[0], link: '', notes: '', status: 'In Progress' });
        setIsEditing(null);
        setShowEntryModal(false);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => { if (confirm('Delete this record?')) { await supabase.from('jobs').delete().eq('id', id); fetchJobs(); } };
  const handleEdit = (job) => { const pad = (n) => n.toString().padStart(2, '0'); let timeStr = job.hours > 0 ? `${pad(job.hours)}:${pad(job.minutes)}:${pad(job.seconds||0)}` : `${pad(job.minutes)}:${pad(job.seconds||0)}`; setFormData({ ...job, timeString: timeStr }); setIsEditing(job.id); setShowEntryModal(true); };
  const openNewEntry = () => { setIsEditing(null); setFormData({ file_name: '', client: 'Mantis', timeString: '', date: new Date().toISOString().split('T')[0], link: '', notes: '', status: 'In Progress' }); setShowEntryModal(true); };
  const handleTimeChange = (e) => setFormData({...formData, timeString: e.target.value.replace(/[^0-9:]/g, '')});
  const clearAllFilters = () => { setSearchTerm(''); setFilterDate(''); setFilterType('All'); };
  const hasActiveFilters = searchTerm || filterDate || filterType !== 'All';
  const requestSort = (key) => { let direction = 'asc'; if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc'; setSortConfig({ key, direction }); };
  const SortIcon = ({ column }) => { if (sortConfig.key !== column) return <ArrowUpDown size={14} style={{opacity:0.3}} />; return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />; };

  // --- New function to open note modal ---
  const handleOpenNoteModal = (job) => {
      setViewNoteContent(job.notes);
      setTempNoteContent(job.notes); // Initialize temp content
      setViewNoteTitle(job.file_name);
      setNoteModalJobId(job.id);
      setIsEditingNoteModal(false); // Always start in view mode
      setShowNoteModal(true);
  }

  // --- New function to save edited note from modal ---
  const handleSaveNoteFromModal = async () => {
      setLoading(true);
      const { error } = await supabase
          .from('jobs')
          .update({ notes: tempNoteContent })
          .eq('id', noteModalJobId);

      if (error) {
          alert('Error saving note: ' + error.message);
      } else {
          await fetchJobs(); // Refresh data
          setViewNoteContent(tempNoteContent); // Update view content
          setIsEditingNoteModal(false); // Go back to view mode
      }
      setLoading(false);
  };

  const getBillingCycle = () => { 
    if (!billingStartDate || !billingEndDate) return { start: new Date(), end: new Date(), label: '' };
    const start = new Date(billingStartDate);
    const end = new Date(billingEndDate);
    const opt = { month: 'short', day: 'numeric', year: 'numeric' };
    return { start, end, label: `${start.toLocaleDateString('en-US', opt)} - ${end.toLocaleDateString('en-US', opt)}` }; 
  };
  
  const cycle = getBillingCycle();
  const cycleJobs = jobs.filter(j => { 
    const d = new Date(j.date); 
    d.setHours(0,0,0,0);
    const s = new Date(billingStartDate); s.setHours(0,0,0,0);
    const e = new Date(billingEndDate); e.setHours(23,59,59,999);
    return d >= s && d <= e && j.status === 'Completed'; 
  });
  
  const cycleSecs = cycleJobs.reduce((acc, curr) => acc + (curr.total_seconds || 0), 0);

  // --- MODIFIED: FILTER LOGIC TO RESPECT BILLING DATES BY DEFAULT ---
  const filteredJobs = jobs.filter(j => { 
    const matchesSearch = j.file_name.toLowerCase().includes(searchTerm.toLowerCase()); 
    const matchesType = filterType === 'All' ? true : (j.client === filterType); 
    
    // New Logic: If no specific date selected in list view, use Billing Cycle Range
    let matchesDate = true;
    if (filterDate) {
        matchesDate = j.date === filterDate;
    } else {
        // Fallback to billing cycle
        const d = new Date(j.date); d.setHours(0,0,0,0);
        const s = new Date(billingStartDate); s.setHours(0,0,0,0);
        const e = new Date(billingEndDate); e.setHours(23,59,59,999);
        matchesDate = d >= s && d <= e;
    }

    return matchesSearch && matchesDate && matchesType; 
  });
  // ------------------------------------------------------------------

  const listTotalSeconds = filteredJobs.reduce((acc, job) => acc + (job.total_seconds || 0), 0);
  const sortedJobs = [...filteredJobs].sort((a, b) => { if (sortConfig.key === 'date') { return sortConfig.direction === 'asc' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date); } if (sortConfig.key === 'client') { const valA = (a.client || '').toLowerCase(); const valB = (b.client || '').toLowerCase(); if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1; if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1; return 0; } if (sortConfig.key === 'status') { const statusOrder = { 'In Progress': 1, 'Pending QA': 2, 'Completed': 3 }; const valA = statusOrder[a.status] || 99; const valB = statusOrder[b.status] || 99; return sortConfig.direction === 'asc' ? valA - valB : valB - valA; } return 0; });
  const chartData = jobs.reduce((acc, job) => { const d = job.date; const f = acc.find(i => i.date === d); const m = Math.floor((job.total_seconds || 0) / 60); if (f) f.minutes += m; else acc.push({ date: d, minutes: m }); return acc; }, []).sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-7);

  const styles = {
    container: { fontFamily: '"Circular", "Helvetica Neue", "Helvetica", "Arial", sans-serif', backgroundColor: currentTheme.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' },
    
    // Sidebar:
    sidebar: { width: '250px', backgroundColor: currentTheme.sidebarBg, borderRight: `1px solid ${currentTheme.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', height: '100%', zIndex: 50, transition: 'transform 0.3s ease', transform: isMobile && !showMobileMenu ? 'translateX(-100%)' : 'translateX(0)' },
    
    main: { flex: 1, marginLeft: isMobile ? '0' : '250px', padding: isMobile ? '1rem' : '2rem', overflowY: 'auto' },
    
    navBtn: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', width: '100%', background: 'transparent', border: 'none', color: currentTheme.sidebarText, cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s', margin: '4px 0', borderRadius: '0 20px 20px 0', opacity: 0.8 },
    navBtnActive: { backgroundColor: currentTheme.sidebarActiveBg, color: currentTheme.sidebarActiveText || currentTheme.sidebarText, fontWeight: '700', opacity: 1, borderLeft: `4px solid ${currentTheme.accent}` },
    
    input: { width: '100%', padding: '10px 14px', borderRadius: '8px', border: `1px solid ${currentTheme.border}`, fontSize: '14px', outline: 'none', backgroundColor: currentTheme.cardBg, boxSizing:'border-box', color: currentTheme.text },
    label: { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '700', color: currentTheme.text },
    
    table: { width: '100%', borderCollapse: 'collapse', backgroundColor: currentTheme.cardBg, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: `1px solid ${currentTheme.border}` },
    th: { backgroundColor: currentTheme.tableHeaderBg, color: currentTheme.tableHeaderText, padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing:'1px', borderBottom: `1px solid ${currentTheme.border}` },
    thClickable: { cursor: 'pointer', userSelect: 'none', display:'flex', alignItems:'center', gap:'6px' },
    td: { padding: '14px 16px', borderBottom: `1px solid ${currentTheme.border}`, fontSize: '14px', color: currentTheme.text },
    // UPDATED: Removed fixed height and display: block to fix spacing issue
    tdWrapper: { width: '100%', whiteSpace: 'nowrap', overflowX: 'auto', overflowY: 'hidden', display: 'flex', alignItems: 'center' }, 
    radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: `1px solid ${currentTheme.border}`, backgroundColor: currentTheme.cardBg, color: currentTheme.text },
    radioActive: { backgroundColor: currentTheme.accent, borderColor: currentTheme.accent, color: darkMode ? '#141e2d' : '#ffffff', fontWeight: '700' },
    primaryBtn: { backgroundColor: currentTheme.accent, color: darkMode ? '#141e2d' : '#ffffff', padding: '8px 16px', borderRadius: '50px', border: 'none', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)', textTransform: 'uppercase', letterSpacing: '1px' },
    
    timerDisplay: { fontSize: '48px', fontWeight: '900', fontFamily: 'monospace', color: currentTheme.accent, textAlign: 'center', margin: '20px 0' },
    timerControls: { display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' },
    controlBtn: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '50px', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '14px', letterSpacing:'0.5px' },
    startBtn: { backgroundColor: currentTheme.accent, color: darkMode ? '#141e2d' : '#ffffff' },
    pauseBtn: { backgroundColor: currentTheme.border, color: currentTheme.text },
    stopBtn: { backgroundColor: '#ef4444', color: 'white' },
    stageOption: { display: 'flex', flexDirection: 'column', padding: '15px', borderRadius: '8px', border: `2px solid ${currentTheme.border}`, flex: 1, textAlign:'center' },
    stageActive: { borderColor: currentTheme.accent, backgroundColor: darkMode ? '#212529' : '#f0fdf4' },
    stageTitle: { fontWeight: 'bold', marginBottom: '4px', color: currentTheme.text },
    stageDesc: { fontSize: '12px', color: currentTheme.mutedText }
  };

  return (
    <div style={styles.container}>
      <style>{` 
        .no-scrollbar::-webkit-scrollbar { display: none; } 
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } 
        .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .billing-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .billing-separator { border-left: 1px solid rgba(255, 255, 255, 0.3); padding-left: 20px; }
        
        .stat-card { padding: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; transition: transform 0.2s; }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-title { font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; }
        .stat-value { font-size: 28px; font-weight: 900; margin: 0; }
        .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }

        /* NEW: Sparkle Animation */
        @keyframes sparkle {
            0% { opacity: 0.7; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.1); filter: brightness(1.3); }
            100% { opacity: 0.7; transform: scale(1); }
        }
        .sparkle-icon { animation: sparkle 3s infinite ease-in-out; }

        @media (max-width: 768px) {
            .billing-stats-grid { grid-template-columns: 1fr; gap: 10px; }
            .billing-separator { border-left: none; padding-left: 0; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.3); }
            .dashboard-grid { grid-template-columns: 1fr; }
            .billing-card { text-align: center; }
            .billing-card h3 { font-size: 28px !important; }
            .hidden-mobile { display: none; }
        }
      `}</style>

      {isMobile && (
        <div style={{ padding: '16px', background: currentTheme.sidebarBg, borderBottom: `1px solid ${currentTheme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 60 }}>
            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                <button onClick={() => setShowMobileMenu(!showMobileMenu)} style={{border:'none', background:'none'}}><Menu size={24} color={currentTheme.text}/></button>
                <span style={{fontWeight:'bold', color: currentTheme.text}}>Tracker</span>
            </div>
            <button onClick={openNewEntry} style={{backgroundColor: currentTheme.accent, color: darkMode ? '#141e2d' : '#ffffff', border:'none', padding:'6px 12px', borderRadius:'6px', fontSize:'12px'}}>+ Add</button>
        </div>
      )}

      <aside style={styles.sidebar}>
        <div style={{ padding: '24px', borderBottom: `1px solid ${currentTheme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <div style={{ background: currentTheme.accent, width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: darkMode ? '#141e2d' : '#ffffff', fontWeight: '900' }}>T</div>
            <span style={{color: currentTheme.sidebarText, fontFamily: 'Circular, sans-serif', fontWeight: '900', letterSpacing:'-0.5px'}}>Tracker</span>
          </h2>
          <button onClick={() => setDarkMode(!darkMode)} style={{background:'transparent', border:'none', cursor:'pointer', color: currentTheme.sidebarText}}>
            {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
          </button>
          {isMobile && <button onClick={() => setShowMobileMenu(false)} style={{background:'none', border:'none', color: currentTheme.sidebarText}}><X size={20}/></button>}
        </div>
        <nav style={{ padding: '20px 0', flex: 1, paddingRight: '12px' }}>
          <button onClick={() => { setView('dashboard'); setShowMobileMenu(false); }} style={{ ...styles.navBtn, ...(view === 'dashboard' ? styles.navBtnActive : {}) }}><LayoutDashboard size={18} /> Overview</button>
          <button onClick={() => { setView('timer'); setShowMobileMenu(false); }} style={{ ...styles.navBtn, ...(view === 'timer' ? styles.navBtnActive : {}) }}><Timer size={18} /> Timer</button>
          <button onClick={() => { setView('list'); setShowMobileMenu(false); }} style={{ ...styles.navBtn, ...(view === 'list' ? styles.navBtnActive : {}) }}><List size={18} /> All Files</button>
        </nav>
      </aside>
      
      {isMobile && showMobileMenu && (
        <div onClick={() => setShowMobileMenu(false)} style={{position:'fixed', inset:0, background:'rgba(20, 30, 45, 0.8)', zIndex:40}} />
      )}

      <main style={styles.main}>
        {loading ? <div style={{display:'flex', justifyContent:'center', marginTop:'50px'}}><Loader2 className="animate-spin" color={currentTheme.text} /></div> : (
          <>
            {view === 'dashboard' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                {!isMobile && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '28px', fontWeight: '900', color: currentTheme.text, margin: 0, letterSpacing:'-1px' }}>Dashboard</h2>
                    <button onClick={openNewEntry} style={styles.primaryBtn}><Plus size={16} /> ADD NEW ENTRY</button>
                    </div>
                )}
                
                <div style={{ marginBottom: '30px' }}>
                    <BillingCard 
                        label={cycle.label} 
                        count={cycleJobs.length} 
                        hours={formatDecimalHours(cycleSecs)} 
                        onEdit={() => { 
                            setTempBillingStart(billingStartDate); 
                            setTempBillingEnd(billingEndDate);
                            setShowBillingModal(true); 
                        }} 
                        onExport={downloadBillingXLSX}
                        theme={currentTheme}
                        darkMode={darkMode}
                    />
                </div>
                
                <div className="dashboard-grid">
                    <StatCard title="Total Lifetime Files" value={jobs.filter(j => j.status === 'Completed').length} icon={CheckCircle2} color={currentTheme.accent} theme={currentTheme} />
                    <StatCard title="Pending Review" value={jobs.filter(j => j.status === 'Pending QA').length} icon={AlertCircle} color={darkMode ? '#79c142' : '#c2410c'} theme={currentTheme} />
                </div>

                <div style={{ background: currentTheme.cardBg, padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: `1px solid ${currentTheme.border}` }}><h3 style={{ fontWeight: '700', marginBottom: '20px', fontSize: '14px', textTransform:'uppercase', color: currentTheme.mutedText, letterSpacing:'1px' }}>Weekly Output (Minutes)</h3><div style={{ height: '250px' }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke={currentTheme.border} /><XAxis dataKey="date" axisLine={false} tickLine={false} tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, {weekday: 'short'})} /><YAxis axisLine={false} tickLine={false} /><Tooltip cursor={{fill: 'transparent'}} /><Bar dataKey="minutes" fill={currentTheme.accent} radius={[4, 4, 4, 4]} barSize={32} /></BarChart></ResponsiveContainer></div></div>
              </div>
            )}

            {showBillingModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div style={{ backgroundColor: currentTheme.cardBg, borderRadius: '8px', width: '100%', maxWidth: '350px', padding: '24px', border: `1px solid ${currentTheme.border}` }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: currentTheme.text }}>Billing Settings</h3>
                  
                  <div style={{marginBottom:'12px'}}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: currentTheme.text, marginBottom: '6px', textTransform: 'uppercase' }}>Start Date</label>
                      <input 
                        type="date" 
                        value={tempBillingStart} 
                        onChange={(e) => setTempBillingStart(e.target.value)} 
                        style={styles.input} 
                      />
                  </div>

                  <div style={{marginBottom:'16px'}}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: currentTheme.text, marginBottom: '6px', textTransform: 'uppercase' }}>End Date</label>
                      <input 
                        type="date" 
                        value={tempBillingEnd} 
                        onChange={(e) => setTempBillingEnd(e.target.value)} 
                        style={styles.input} 
                      />
                  </div>
                  
                  <button onClick={() => { 
                      if(new Date(tempBillingStart) > new Date(tempBillingEnd)) {
                          alert("Start Date cannot be after End Date");
                          return;
                      }
                      setBillingStartDate(tempBillingStart); 
                      setBillingEndDate(tempBillingEnd);
                      setShowBillingModal(false); 
                  }} style={{ width: '100%', marginTop: '10px', padding: '10px', background: currentTheme.accent, color: darkMode ? '#141e2d' : '#ffffff', border: 'none', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer' }}>Save Changes</button>
                  <button onClick={() => setShowBillingModal(false)} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'transparent', color: currentTheme.text, border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {view === 'timer' && (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '900', color: currentTheme.text, marginBottom: '24px', letterSpacing:'-1px' }}>TAT Timer</h2>
                
                <div style={{ backgroundColor: currentTheme.cardBg, padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: `1px solid ${currentTheme.border}` }}>
                  
                  <div style={{display:'flex', gap:'10px', marginBottom:'24px'}}>
                    <div style={{...styles.stageOption, ...(timerStage === 'FR' ? styles.stageActive : {})}}>
                        <div style={{fontSize:'12px', fontWeight:'bold', color: timerStage === 'FR' ? currentTheme.text : currentTheme.border}}>STEP 1</div>
                        <div style={{fontWeight:'bold'}}>First Review</div>
                        <div style={{fontSize:'11px', color: currentTheme.mutedText}}>0.5x Audio Time</div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', color: currentTheme.border}}><ArrowRight size={20}/></div>
                    <div style={{...styles.stageOption, ...(timerStage === 'SV' ? styles.stageActive : {})}}>
                        <div style={{fontSize:'12px', fontWeight:'bold', color: timerStage === 'SV' ? currentTheme.text : currentTheme.border}}>STEP 2</div>
                        <div style={{fontWeight:'bold'}}>Speaker Verification</div>
                        <div style={{fontSize:'11px', color: currentTheme.mutedText}}>1.5x Audio Time</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={styles.label}>File Name (Optional)</label>
                      <input 
                        style={styles.input} 
                        placeholder="Unnamed File (Edit later)" 
                        value={timerData.file_name} 
                        onChange={e => setTimerData({...timerData, file_name: e.target.value})} 
                        disabled={timerRunning || timerStage === 'SV'} 
                      />
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
                            <div style={{width:'16px', height:'16px', borderRadius:'50%', border: `2px solid ${currentTheme.border}`, borderColor: timerData.client === type ? currentTheme.accent : currentTheme.border, display:'flex', alignItems:'center', justifyContent:'center'}}>
                              {timerData.client === type && <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor: currentTheme.accent}} />}
                            </div>
                            {type}
                          </div>
                        ))}
                      </div>
                  </div>

                  <div style={{textAlign:'center', marginBottom:'20px'}}>
                    <div style={{fontSize:'14px', color: currentTheme.accent, marginBottom:'4px'}}>
                        {timerStage === 'FR' ? 'Target TAT: First Review' : 'Target TAT: Speaker Verification'}
                    </div>
                    <div style={styles.timerDisplay}>
                        {formatDuration(timeLeft)}
                    </div>
                  </div>

                  <div style={{...styles.timerControls, flexDirection: isMobile ? 'column' : 'row'}}>
                    {!timerRunning ? (
                        <button onClick={handleTimerStartPause} style={{...styles.controlBtn, ...styles.startBtn}} disabled={totalTat === 0}>
                            <Play size={16} fill={darkMode ? '#141e2d' : '#ffffff'} /> START TIMER
                        </button>
                    ) : (
                        <button onClick={handleTimerStartPause} style={{...styles.controlBtn, ...styles.pauseBtn}}>
                            <Pause size={16} fill={currentTheme.text} /> PAUSE
                        </button>
                    )}

                    {timerStage === 'FR' ? (
                        <button onClick={handleFinishFR} style={{...styles.controlBtn, backgroundColor: currentTheme.text, color: currentTheme.cardBg}} disabled={totalTat === 0}>
                            <ArrowRight size={16} /> FINISH FR & GO TO SV
                        </button>
                    ) : (
                        <button onClick={handleFinishSV} style={{...styles.controlBtn, ...styles.startBtn}} disabled={totalTat === 0}>
                            <Check size={16} /> FINISH ALL & COMPLETE
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

            {showEntryModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                <div style={{ backgroundColor: currentTheme.cardBg, borderRadius: '8px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: `1px solid ${currentTheme.border}` }}>
                  <div style={{ padding: '16px 24px', borderBottom: `1px solid ${currentTheme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: currentTheme.text }}>{isEditing ? 'Edit Entry' : 'New Entry'}</h2>
                    <button onClick={() => setShowEntryModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: currentTheme.text }}><X size={20}/></button>
                  </div>
                  <form onSubmit={handleSave} style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>File Name</label>
                      <input 
                        style={styles.input} 
                        placeholder="e.g. Meeting_Audio_01 (Leave empty for Auto Name)" 
                        value={formData.file_name} 
                        onChange={e => setFormData({...formData, file_name: e.target.value})} 
                      />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={styles.label}>File Type</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div onClick={() => setFormData({...formData, client: 'Mantis'})} style={{...styles.radioLabel, ...(formData.client === 'Mantis' ? styles.radioActive : {})}}><div style={{width:'16px', height:'16px', borderRadius:'50%', border: `2px solid ${currentTheme.border}`, borderColor: formData.client === 'Mantis' ? currentTheme.accent : currentTheme.border, display:'flex', alignItems:'center', justifyContent:'center'}}>{formData.client === 'Mantis' && <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor: currentTheme.accent}} />}</div>Mantis</div>
                        <div onClick={() => setFormData({...formData, client: 'Cricket'})} style={{...styles.radioLabel, ...(formData.client === 'Cricket' ? styles.radioActive : {})}}><div style={{width:'16px', height:'16px', borderRadius:'50%', border: `2px solid ${currentTheme.border}`, borderColor: formData.client === 'Cricket' ? currentTheme.accent : currentTheme.border, display:'flex', alignItems:'center', justifyContent:'center'}}>{formData.client === 'Cricket' && <div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor: currentTheme.accent}} />}</div>Cricket</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <div><label style={styles.label}>Duration (HH:MM:SS)</label><input style={{...styles.input, fontFamily: 'monospace'}} placeholder="00:00:00" maxLength={8} value={formData.timeString} onChange={handleTimeChange} /></div>
                      <div><label style={styles.label}>Date</label><input type="date" style={styles.input} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /></div>
                    </div>
                    <div style={{ marginBottom: '16px' }}><label style={styles.label}>Link</label><input type="url" style={styles.input} placeholder="https://..." value={formData.link} onChange={e => setFormData({...formData, link: e.target.value})} /></div>
                    
                    {/* Notes Field */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={styles.label}>Notes</label>
                        <textarea 
                            style={{...styles.input, minHeight: '80px', resize: 'vertical'}} 
                            placeholder="Details about this file (e.g., audio issues, delays)..." 
                            value={formData.notes || ''} 
                            onChange={e => setFormData({...formData, notes: e.target.value})} 
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}><label style={styles.label}>Status</label><select style={styles.input} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option>In Progress</option><option>Pending QA</option><option>Completed</option></select></div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}><button type="button" onClick={() => setShowEntryModal(false)} style={{ padding: '10px 16px', border: 'none', background: 'transparent', color: currentTheme.text, fontWeight: '600', cursor: 'pointer' }}>Cancel</button><button type="submit" style={{ padding: '10px 20px', border: 'none', background: currentTheme.accent, color: darkMode ? '#141e2d' : '#ffffff', borderRadius: '50px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}>{loading ? 'Saving...' : 'Save Entry'}</button></div>
                  </form>
                </div>
              </div>
            )}

            {/* --- NEW NOTE VIEWING/EDITING MODAL --- */}
            {showNoteModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 101 }}>
                <div style={{ backgroundColor: currentTheme.cardBg, borderRadius: '8px', width: '100%', maxWidth: '400px', border: `1px solid ${currentTheme.border}`, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', backgroundColor: currentTheme.accent, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: darkMode ? '#141e2d' : '#ffffff', fontWeight: 'bold' }}>
                        <StickyNote size={18} />
                        <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>Note: {viewNoteTitle}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {/* Edit Toggle Button */}
                        <button onClick={() => setIsEditingNoteModal(!isEditingNoteModal)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: darkMode ? '#141e2d' : '#ffffff', opacity: isEditingNoteModal ? 1 : 0.7 }} title={isEditingNoteModal ? "View Note" : "Edit Note"}>
                            <Edit2 size={18}/>
                        </button>
                        <button onClick={() => setShowNoteModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: darkMode ? '#141e2d' : '#ffffff' }} title="Close">
                            <X size={18}/>
                        </button>
                      </div>
                  </div>
                  
                  <div style={{ padding: '24px', minHeight: '150px', color: currentTheme.text, fontFamily: 'monospace', fontSize: '14px' }}>
                    {isEditingNoteModal ? (
                        // Editing Mode: Textarea
                        <textarea 
                            style={{...styles.input, minHeight: '150px', resize: 'vertical', fontFamily: 'monospace'}} 
                            value={tempNoteContent} 
                            onChange={(e) => setTempNoteContent(e.target.value)}
                            autoFocus
                        />
                    ) : (
                        // Viewing Mode: Faster Typewriter effect
                        <TypewriterText text={viewNoteContent} speed={3} /> 
                    )}
                  </div>

                  <div style={{ padding: '12px', borderTop: `1px solid ${currentTheme.border}`, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    {isEditingNoteModal && (
                        <button onClick={handleSaveNoteFromModal} style={{ fontSize: '12px', fontWeight: 'bold', background: currentTheme.accent, border: 'none', color: darkMode ? '#141e2d' : '#ffffff', cursor: 'pointer', padding: '8px 16px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Save size={14}/> SAVE
                        </button>
                    )}
                    <button onClick={() => setShowNoteModal(false)} style={{ fontSize: '12px', fontWeight: 'bold', background: 'transparent', border: 'none', color: currentTheme.mutedText, cursor: 'pointer', padding: '8px' }}>CLOSE</button>
                  </div>
                </div>
              </div>
            )}

            {view === 'list' && (
              <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <div style={{ display: 'flex', flexWrap:'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap:'10px' }}>
                  {!isMobile && <div style={{display:'flex', alignItems:'center', gap:'16px'}}><h2 style={{ fontSize: '28px', fontWeight: '900', color: currentTheme.text, margin: '0', letterSpacing:'-1px' }}>File History</h2><button onClick={openNewEntry} style={styles.primaryBtn}><Plus size={16} /> ADD NEW</button></div>}
                  <div style={{ display: 'flex', flexDirection:'column', alignItems: 'flex-end', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                    <div style={{ background: currentTheme.accent, color: darkMode ? '#141e2d' : '#ffffff', padding: '8px 12px', borderRadius: '50px', fontWeight: '700', fontSize: '13px', border: `1px solid ${currentTheme.border}`, display:'flex', gap:'8px', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'center' : 'flex-start' }}><span>Total: {formatDecimalHours(listTotalSeconds)}</span><span style={{opacity:0.6}}>|</span><span>{formatDuration(listTotalSeconds)}</span></div>
                    <div style={{display:'flex', gap:'8px', alignItems:'center', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto'}}>
                        {hasActiveFilters && (<button onClick={clearAllFilters} style={{display:'flex', alignItems:'center', gap:'4px', border:'none', background:'#fee2e2', color:'#ef4444', borderRadius:'50px', padding:'0 10px', height:'34px', cursor:'pointer', fontSize:'12px', fontWeight:'bold'}}><RotateCcw size={12} /> Clear</button>)}
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{padding: '8px', borderRadius: '50px', border: `1px solid ${currentTheme.border}`, fontSize: '13px', cursor:'pointer', backgroundColor: currentTheme.cardBg, height:'34px', flex: isMobile ? 1 : 'unset', color: currentTheme.text}}><option value="All">All Types</option><option value="Mantis">Mantis</option><option value="Cricket">Cricket</option></select>
                        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{padding: '8px', borderRadius: '50px', border: `1px solid ${currentTheme.border}`, fontSize: '13px', backgroundColor: currentTheme.cardBg, height:'34px', boxSizing:'border-box', flex: isMobile ? 1 : 'unset', color: currentTheme.text}} />
                        <div style={{position:'relative', width: isMobile ? '100%' : 'auto'}}><Search size={16} style={{position:'absolute', left:'10px', top:'9px', opacity:0.4}} /><input style={{...styles.input, width: isMobile ? '100%' : '200px', backgroundColor: currentTheme.cardBg, paddingLeft:'32px', height:'34px', color: currentTheme.text, borderRadius:'50px'}} placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: `1px solid ${currentTheme.border}` }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th} onClick={() => requestSort('date')}><div style={styles.thClickable}>Date <SortIcon column="date" /></div></th>
                        <th style={{...styles.th, width: `${colWidth}px`, position: 'relative'}}><div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>File Name<GripVertical size={14} style={{color: currentTheme.text, marginRight:'4px', opacity: 0.7}} /></div><div onMouseDown={startResizing} style={{position:'absolute', right:0, top:0, bottom:0, width:'8px', cursor:'col-resize', zIndex:10, display:'flex', alignItems:'center', justifyContent:'center'}}><div style={{width:'2px', height:'100%', backgroundColor: currentTheme.text, opacity: 0.3}} /></div></th>
                        <th style={{...styles.th, display: isMobile ? 'none' : 'table-cell'}} onClick={() => requestSort('client')}><div style={styles.thClickable}>Type <SortIcon column="client" /></div></th>
                        <th style={{...styles.th, display: isMobile ? 'none' : 'table-cell'}}>Duration</th>
                        <th style={{...styles.th, display: isMobile ? 'none' : 'table-cell'}}>Total Hours (Dec)</th>
                        <th style={styles.th} onClick={() => requestSort('status')}><div style={styles.thClickable}>Status <SortIcon column="status" /></div></th>
                        <th style={{...styles.th, display: isMobile ? 'none' : 'table-cell'}}>Link</th>
                        <th style={{...styles.th, textAlign: 'right'}}>EDIT/DELETE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedJobs.length > 0 ? sortedJobs.map(job => (
                        <tr key={job.id} style={{ borderBottom: `1px solid ${currentTheme.border}`, backgroundColor: job.file_name.startsWith('Unnamed File') ? currentTheme.unnamedRowBg : currentTheme.cardBg }}>
                          <td style={styles.td}>
                            {/* UPDATED: Pass created_at timestamp for time display */}
                            {formatDateWithTime(job.date, job.created_at)}
                          </td>
                          {/* UPDATED: Fixed spacing issue by removing height:100% from wrapper style */}
                          <td style={{...styles.td, width: `${colWidth}px`, minWidth: `${colWidth}px`, maxWidth: `${colWidth}px`}}><div style={styles.tdWrapper} className="no-scrollbar" title={job.file_name}>{job.file_name}</div></td>
                          <td style={{...styles.td, display: isMobile ? 'none' : 'table-cell'}}>{job.client||'-'}</td>
                          <td style={{...styles.td, display: isMobile ? 'none' : 'table-cell', fontFamily: 'monospace', color: currentTheme.accent}}>{formatDuration(job.total_seconds)}</td>
                          <td style={{...styles.td, display: isMobile ? 'none' : 'table-cell', fontFamily: 'monospace', color: currentTheme.text}}>{formatDecimalHours(job.total_seconds)}</td>
                          <td style={styles.td}><StatusBadge status={job.status} darkMode={darkMode} /></td>
                          <td style={{...styles.td, display: isMobile ? 'none' : 'table-cell'}}>{job.link && <a href={job.link} target="_blank"><ExternalLink size={12} color={currentTheme.accent}/></a>}</td>
                          {/* UPDATED: Added flex style for alignment and sparkle class to note icon */}
                          <td style={{...styles.td, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: '100%'}}>
                            {job.notes && job.notes.trim() !== '' && (
                                <button 
                                    title={`You noted: ${job.notes}`} 
                                    onClick={() => handleOpenNoteModal(job)}
                                    style={{background:'none', border:'none', cursor:'pointer', marginRight:'8px', color: currentTheme.text}}
                                >
                                    <StickyNote size={16} className="sparkle-icon"/>
                                </button>
                            )}
                            <button onClick={() => handleEdit(job)} style={{background:'none', border:'none', cursor:'pointer', marginRight:'8px', color: currentTheme.accent}}><Edit2 size={16}/></button>
                            <button onClick={() => handleDelete(job.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444'}}><Trash2 size={16}/></button>
                          </td>
                        </tr>)) : (<tr><td colSpan="7" style={{padding:'24px', textAlign:'center', color:'#94a3b8'}}>No files match your filters.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      
      <Analytics />
    </div>
  );
}