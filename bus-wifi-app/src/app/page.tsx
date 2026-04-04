"use client";

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { PackageType, Duration, calculateOrder } from '@/lib/pricing';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import * as xlsx from 'xlsx';

// --- CUSTOMER DB TYPE ---
export type Customer = {
  id?: string;
  ownerName?: string;
  address?: string;
  contactNo?: string;
  companyName?: string;
  installedBy?: string;
  busType?: string;
  busRoute?: string;
  ktmParking?: string;
  destParking?: string;
  ezvizUsername?: string;
  ezvizPassword?: string;
  busNo?: string;
  cameraSn?: string;
  verificationCode?: string;
  wifiSn?: string;
  isp?: string;
  simSn?: string;
  simNo?: string;
  puk1?: string;
  puk2?: string;
  installDate?: string;
  expiryDate?: string;
  packageApplied?: string;
  status?: string;
  ssidName?: string;
  ssidPassword?: string;
  gpsUsername?: string;
  gpsPassword?: string;
  imeiNo?: string;
  remarks?: string;
  staffNo?: string;
  simValidity?: string;
  
  // Custom Analytics Fields
  totalCharged?: number;
  pendingDue?: number;
  equipment?: string;
  cameraCount?: number;
};

export default function OrderManagement() {
  const [activeTab, setActiveTab] = useState<'overview' | 'order' | 'dashboard' | 'crm' | 'renewal'>('crm');
  
  // Order Configuration State
  const [packageType, setPackageType] = useState<PackageType>('basic');
  const [duration, setDuration] = useState<Duration>('6_months');
  const isRenewal = activeTab === 'renewal';
  const [cameraCount, setCameraCount] = useState<number>(2);

  const [formData, setFormData] = useState<Partial<Customer>>({});

  // UI State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Search & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'installDate' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Renewal Mode Active Setup
  const [renewalSearch, setRenewalSearch] = useState('');
  const [renewalSelected, setRenewalSelected] = useState<Customer | null>(null);

  // Admin Enquiry Modal State
  const [viewingProfile, setViewingProfile] = useState<Customer | null>(null);
  const [isModalEditing, setIsModalEditing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load Customers on Mount
  useEffect(() => {
    fetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(err => console.error("Could not load local DB", err));
  }, []);

  const orderData = useMemo(() => {
    return calculateOrder({ packageType, duration, isRenewal, cameraCount });
  }, [packageType, duration, isRenewal, cameraCount]);

  /* ANALYTICS LOGIC */
  const topValueCustomers = useMemo(() => {
      return [...customers]
         .filter(c => c.totalCharged !== undefined && c.totalCharged > 0)
         .sort((a, b) => (b.totalCharged || 0) - (a.totalCharged || 0))
         .slice(0, 5);
  }, [customers]);

  const topExpiringCustomers = useMemo(() => {
      const today = new Date().getTime();
      return [...customers]
         .filter(c => c.status?.toLowerCase() === 'active' && c.expiryDate)
         .sort((a, b) => new Date(a.expiryDate || 0).getTime() - new Date(b.expiryDate || 0).getTime())
         .filter(c => new Date(c.expiryDate || 0).getTime() > today)
         .slice(0, 5);
  }, [customers]);

  const pendingCustomers = useMemo(() => {
      return [...customers]
         .filter(c => c.pendingDue !== undefined && c.pendingDue > 0)
         .sort((a, b) => (b.pendingDue || 0) - (a.pendingDue || 0));
  }, [customers]);

  const sortedCustomers = useMemo(() => {
      let result = [...customers];
      
      if (searchQuery.trim().length > 0) {
          const query = searchQuery.toLowerCase();
          result = result.filter(c => 
              (c.busNo || '').toLowerCase().includes(query) || 
              (c.contactNo || '').toLowerCase().includes(query) || 
              (c.ownerName || '').toLowerCase().includes(query)
          );
      } else {
          // If no search, auto-sort by newest and limit to 10 unless header sorting is explicitly toggled by user
          if (!sortField) {
              result.sort((a,b) => new Date(b.installDate||0).getTime() - new Date(a.installDate||0).getTime());
              return result.slice(0, 10);
          }
      }

      if (sortField) {
          result.sort((a, b) => {
              if (sortField === 'installDate') {
                  const dateA = new Date(a.installDate || 0).getTime();
                  const dateB = new Date(b.installDate || 0).getTime();
                  return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
              }
              return 0;
          });
      }
      return result;
  }, [customers, sortField, sortOrder, searchQuery]);

  const handleSort = () => {
      if (sortField === 'installDate') {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField('installDate');
          setSortOrder('desc');
      }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleModalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!viewingProfile) return;
      setViewingProfile({ ...viewingProfile, [e.target.name]: e.target.value });
  };

  const handleSaveModal = async () => {
      if (!viewingProfile) return;
      try {
          const res = await fetch('/api/customers', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(viewingProfile)
          });
          if (res.ok) {
              const { customer } = await res.json();
              setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
              setIsModalEditing(false);
          }
      } catch (err) {
          console.error("Failed to update database record", err);
      }
  };

  const handleAutomatedImport = async () => {
       setIsImporting(true);
       try {
           const TargetExcelPath = `c:\\Users\\Hp\\Desktop\\BUS MANAGEMNET SYSTEM\\bus-wifi-app\\customer data sheet.xlsx`;
           
           const fileRes = await fetch('/api/read-local-excel', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ targetPath: TargetExcelPath })
           });

           if (!fileRes.ok) {
               const errData = await fileRes.json();
               alert(`File Link Error: ${errData.error || 'Could not find customer data sheet on Desktop'}`);
               setIsImporting(false);
               return;
           }

           const { fileData } = await fileRes.json();
           
           const wb = xlsx.read(fileData, { type: 'base64', cellDates: true });
           const wsname = wb.SheetNames[0];
           const ws = wb.Sheets[wsname];
           const data = xlsx.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });
           
           const formatOptDate = (d: any) => {
               if (!d) return '';
               if (typeof d === 'string' && /^\d+$/.test(d)) {
                   const serial = parseInt(d, 10);
                   const date = new Date((serial - 25569) * 86400 * 1000);
                   return date.toISOString().split('T')[0];
               }
               if (d instanceof Date) return d.toISOString().split('T')[0];
               try {
                   const parsed = new Date(d);
                   if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
               } catch(e){}
               return String(d);
           };
           
           const mappedImport = data.map((row: any) => ({
               id: Math.random().toString(36).substr(2, 9),
               ownerName: String(row['Bus Owner Name'] || row['Name'] || ''),
               address: String(row['Address'] || ''),
               contactNo: String(row['Contact No.'] || row['Contact'] || ''),
               companyName: String(row['Company Name'] || ''),
               installedBy: String(row['Installed by'] || ''),
               busType: String(row['TYPE'] || ''),
               busRoute: String(row['Bus Route'] || ''),
               ktmParking: String(row['kathmandu parking'] || ''),
               destParking: String(row['destination parking'] || ''),
               ezvizUsername: String(row['Ezviz Username'] || ''),
               ezvizPassword: String(row['Ezviz Password'] || ''),
               busNo: String(row['V. No.'] || row['Bus No'] || ''),
               cameraSn: String(row['Camera Serial No.'] || ''),
               verificationCode: String(row['Verification Code'] || ''),
               wifiSn: String(row['Device Serial No.'] || ''),
               isp: String(row['ISP'] || ''),
               simSn: String(row['Sim Serial No.'] || ''),
               simNo: String(row['sim no.'] || ''),
               puk1: String(row['PUK 1'] || row['PUK1'] || ''),
               puk2: String(row['PUK 2'] || row['PUK2'] || ''),
               installDate: formatOptDate(row['Internet Activation Date'] || row['Internet \nActivation Date']),
               expiryDate: formatOptDate(row['Internet Expiry Date'] || row['Internet \nExpiry Date'] || row['INTERNET EXPIRY']),
               packageApplied: String(row['Internet Package Type'] || row['Internet \nPackage Type'] || ''),
               status: String(row['STATUS'] || 'Active'),
               ssidName: String(row['SSID Name'] || ''),
               ssidPassword: String(row['SSID Password'] || ''),
               gpsUsername: String(row['GPS Username'] || ''),
               gpsPassword: String(row['GPS Password'] || ''),
               imeiNo: String(row['imei no.'] || ''),
               remarks: String(row['Remarks'] || ''),
               staffNo: String(row['staff number'] || ''),
               simValidity: String(row['sim validity expiry date'] || '')
           })).filter(c => c.busNo || c.ownerName || c.contactNo); // Must have at least basic identifier

           if (window.confirm(`File successfully reached and parsed! Found ${mappedImport.length} valid records. \n\nDo you want to force an update to the Master Database now? (A backup of your previous database will be automatically copied safely)`)) {
               const res = await fetch('/api/customers/import', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(mappedImport)
               });

               if (res.ok) {
                   setCustomers(mappedImport);
                   alert(`Database Updated! Local JSON backed up successfully.`);
               } else {
                   alert("Failed to reach save route logic on database API.");
               }
           }
       } catch(err) {
           console.error("Automated Import Failed", err);
           alert("Import script crashed reading the target path. Check error logging.");
       } finally {
           setIsImporting(false);
       }
  };

  const handleDownloadPdfAndSave = async () => {
    if (isRenewal && !renewalSelected) {
        setSaveMessage('Error: Customer Required!');
        setTimeout(() => setSaveMessage(null), 3000);
        return;
    }
    if (!isRenewal && (!formData.busNo || !formData.contactNo)) {
        setSaveMessage('Error: Required Fields!');
        setTimeout(() => setSaveMessage(null), 3000);
        return;
    }

    const element = document.getElementById('invoice-capture');
    if (!element) return;
    setIsGeneratingPdf(true);
    
    try {
        const imgData = await htmlToImage.toPng(element, { backgroundColor: '#161e2e', pixelRatio: 2 });
        const rect = element.getBoundingClientRect();
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: 'a4'
        });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (rect.height * pdfWidth) / rect.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        const base64Pdf = pdf.output('datauristring');
        
        const safeBusNo = isRenewal && renewalSelected ? renewalSelected.busNo : formData.busNo;
        
        await fetch('/api/invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: `Bus_${(safeBusNo || 'Unknown').replace(/[^a-zA-Z0-9]/g, '')}_Invoice_${Math.floor(Date.now() / 1000)}.pdf`,
                fileData: base64Pdf
            })
        });

        const today = new Date();
        const installDateStr = today.toISOString().split('T')[0];
        
        const expiry = new Date(today);
        if (duration === '1_month') expiry.setMonth(expiry.getMonth() + 1);
        if (duration === '6_months') expiry.setMonth(expiry.getMonth() + 6);
        if (duration === '1_year') expiry.setFullYear(expiry.getFullYear() + 1);
        const expiryDateStr = expiry.toISOString().split('T')[0];

        const pkgCap = packageType.charAt(0).toUpperCase() + packageType.slice(1);
        const addedCams = isRenewal && cameraCount > 0 ? ` + ${cameraCount} New Cameras` : '';
        const equipString = isRenewal ? `Renewal (${pkgCap})${addedCams}` : `${cameraCount > 0 ? cameraCount + ' Cameras, ' : ''}Router & Antenna`;

        if (isRenewal && renewalSelected) {
            const updatedCustomer: Customer = {
                ...renewalSelected,
                packageApplied: `${duration.replace('_', ' ')} ${packageType}`,
                expiryDate: expiryDateStr,
                totalCharged: (renewalSelected.totalCharged || 0) + orderData.revenue.total,
                status: 'Active',
                equipment: renewalSelected.equipment ? renewalSelected.equipment + addedCams : equipString,
                cameraCount: (renewalSelected.cameraCount || 0) + (isRenewal ? cameraCount : 0)
            };
            const res = await fetch('/api/customers', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCustomer)
            });
            if (res.ok) {
                const { customer } = await res.json();
                setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
                setSaveMessage('Renewal Registered!');
                setRenewalSelected(null);
                setFormData({});
            } else {
                setSaveMessage('DB Failed');
            }
        } else {
            const newCustomerData = {
               ...formData,
               packageApplied: `${duration.replace('_', ' ')} ${packageType}`,
               installDate: installDateStr,
               expiryDate: expiryDateStr,
               status: 'Active',
               totalCharged: orderData.revenue.total,
               equipment: equipString,
               cameraCount: cameraCount
            };
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCustomerData)
            });
            if (res.ok) {
                const saved = await res.json();
                setCustomers(prev => [saved.customer, ...prev]); 
                setSaveMessage('Profile Registered!');
                setFormData({});
            } else {
                setSaveMessage('DB Failed');
            }
        }

        setTimeout(() => setSaveMessage(null), 4000);
    } catch (error) {
        setSaveMessage('Failed Action');
        setTimeout(() => setSaveMessage(null), 4000);
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const renderTabNavigation = () => (
    <div className="flex flex-col lg:flex-row gap-4 border-b border-slate-800 pb-4 mb-6 lg:items-center justify-between">
        <div className="flex flex-wrap gap-4">
           <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 font-mono text-xs uppercase tracking-widest rounded transition ${activeTab === 'overview' ? 'bg-[#ff6b35] text-white shadow-[0_0_15px_rgba(255,107,53,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}>System Overview</button>
           <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 font-mono text-xs uppercase tracking-widest rounded transition ${activeTab === 'dashboard' ? 'bg-[#00ff88] text-black font-bold shadow-[0_0_15px_rgba(0,255,136,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}>Analytics Dashboard</button>
           <button onClick={() => { setActiveTab('order'); setRenewalSelected(null); setFormData({}); setRenewalSearch(''); }} className={`px-4 py-2 font-mono text-xs uppercase tracking-widest rounded transition ${activeTab === 'order' ? 'bg-[#00d4ff] text-[#0b0f1a] font-bold shadow-[0_0_15px_rgba(0,212,255,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}>Customer Order</button>
           <button onClick={() => { setActiveTab('renewal'); setFormData({}); }} className={`px-4 py-2 font-mono text-xs uppercase tracking-widest rounded transition ${activeTab === 'renewal' ? 'bg-[#ff6b35] text-white font-bold shadow-[0_0_15px_rgba(255,107,53,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}>Renewal Node</button>
           <button onClick={() => setActiveTab('crm')} className={`px-4 py-2 font-mono text-xs uppercase tracking-widest rounded transition ${activeTab === 'crm' ? 'bg-[#8b5cf6] text-white font-bold shadow-[0_0_15px_rgba(139,92,246,0.4)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'}`}>Customer Information</button>
       </div>
    </div>
  );

  const CrmInput = ({ label, name, placeholder = '' }: {label:string, name:keyof Customer, placeholder?:string}) => (
      <div>
          <label className="block text-[9px] font-mono text-slate-400 uppercase mb-1">{label}</label>
          <input type="text" name={name} value={formData[name] as string || ''} onChange={handleFormChange} placeholder={placeholder} className="w-full bg-slate-800/80 border border-slate-700 text-xs rounded px-2 py-1.5 text-white outline-none focus:border-[#8b5cf6] transition" />
      </div>
  );

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 font-sans pb-20">
       <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
       
       {/* ADMIN FULL PROFILE MODAL */}
       {viewingProfile && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex justify-center items-center backdrop-blur-sm p-6 overflow-y-auto">
             <div className="bg-[#111827] border border-[#8b5cf6] w-full max-w-5xl rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.2)] p-8 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-widest uppercase">Admin Database Enquiry</h2>
                        <p className="text-xs text-slate-400 font-mono">Profile ID: {viewingProfile.id}</p>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => isModalEditing ? handleSaveModal() : setIsModalEditing(true)} className={`px-6 py-2 rounded text-xs font-bold uppercase tracking-widest transition ${isModalEditing ? 'bg-[#00ff88] text-black shadow-[0_0_15px_rgba(0,255,136,0.4)]' : 'bg-[#00d4ff]/20 text-[#00d4ff] hover:bg-[#00d4ff]/40'}`}>
                           {isModalEditing ? 'Save Profile' : 'Edit Mode'}
                        </button>
                        <button onClick={() => { setViewingProfile(null); setIsModalEditing(false); }} className="px-4 py-2 bg-slate-800 text-white rounded text-xs hover:bg-red-500">Close</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                      { l: 'Owner Name', k: 'ownerName' }, { l: 'Address', k: 'address' }, { l: 'Contact No', k: 'contactNo' }, { l: 'Company Name', k: 'companyName' },
                      { l: 'Bus (V.No)', k: 'busNo' }, { l: 'Bus Route', k: 'busRoute' }, { l: 'Bus Type', k: 'busType' }, { l: 'Installed By', k: 'installedBy' },
                      { l: 'KTM Parking', k: 'ktmParking' }, { l: 'Destination Parking', k: 'destParking' }, { l: 'WiFi S/N (Device)', k: 'wifiSn' }, { l: 'Camera S/N', k: 'cameraSn' },
                      { l: 'Ezviz User', k: 'ezvizUsername' }, { l: 'Ezviz Pass', k: 'ezvizPassword' }, { l: 'Verif Code', k: 'verificationCode' }, { l: 'ISP', k: 'isp' },
                      { l: 'SIM S/N', k: 'simSn' }, { l: 'SIM Number', k: 'simNo' }, { l: 'PUK 1', k: 'puk1' }, { l: 'PUK 2', k: 'puk2' },
                      { l: 'SSID Name', k: 'ssidName' }, { l: 'SSID Password', k: 'ssidPassword' }, { l: 'GPS User', k: 'gpsUsername' }, { l: 'GPS Pass', k: 'gpsPassword' },
                      { l: 'IMEI No', k: 'imeiNo' }, { l: 'Sim Validity', k: 'simValidity' }, { l: 'Staff Number', k: 'staffNo' }, { l: 'Remarks', k: 'remarks' },
                      { l: 'Total Charged', k: 'totalCharged' }, { l: 'Camera Count', k: 'cameraCount' }, { l: 'Install Date', k: 'installDate' }, { l: 'Expiry Date', k: 'expiryDate' }
                    ].map((field) => (
                       <div key={field.k} className="bg-slate-800/40 p-3 rounded border border-slate-700/50">
                           <div className="text-[10px] text-slate-500 uppercase font-mono mb-1">{field.l}</div>
                           {isModalEditing ? (
                               <input type="text" name={field.k} value={viewingProfile[field.k as keyof Customer] || ''} onChange={handleModalChange} className="w-full bg-slate-900 border-b border-[#8b5cf6] outline-none text-white text-xs py-1" />
                           ) : (
                               <div className="text-sm font-semibold text-slate-200 truncate" title={String(viewingProfile[field.k as keyof Customer] || 'N/A')}>{viewingProfile[field.k as keyof Customer] || 'N/A'}</div>
                           )}
                       </div>
                    ))}
                </div>
             </div>
          </div>
       )}

       <header className="sticky top-0 z-50 bg-[#0b0f1a]/90 backdrop-blur-xl border-b border-slate-800 h-20 px-8 flex items-center gap-4">
          <div className="relative w-12 h-12 rounded overflow-hidden shadow-lg border border-[#00d4ff]/20">
            <Image src="/logo.png" alt="Bus WiFi Logo" fill className="object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide">BusWiFi Manager</h1>
            <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Operations & Sales Engine</p>
          </div>
       </header>

       <main className="relative z-10 max-w-[90rem] mx-auto px-6 mt-10">
          {renderTabNavigation()}

          {activeTab === 'overview' && (
             <div className="w-full h-[80vh] border border-[#1e2d47] rounded-xl overflow-hidden bg-white/5">
                <iframe src="/overview.html" className="w-full h-full border-none" title="Original System Architecture"></iframe>
             </div>
          )}

          {/* TAB 2 & 3: CUSTOMER ORDER AND RENEWAL NODE */}
          {(activeTab === 'order' || activeTab === 'renewal') && (
            <>
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
               <div className="xl:col-span-8 space-y-6">
                  {/* EXPANDED CRM PROFILING REGISTRY */}
                  {isRenewal ? (
                    <div className="bg-[#111827] border border-[#ff6b35] rounded-2xl shadow-[0_0_20px_rgba(255,107,53,0.15)] overflow-hidden">
                       <div className="bg-slate-800/80 px-6 py-4 border-b border-[#ff6b35]/30">
                           <h2 className="text-[#ff6b35] font-bold uppercase tracking-widest text-sm">Intelligent Renewal Node</h2>
                       </div>
                       <div className="p-6">
                           <input type="text" placeholder="Lookup Bus Number or Phone to Renew..." value={renewalSearch} onChange={e => setRenewalSearch(e.target.value)} className="w-full bg-slate-900 border border-[#ff6b35] text-sm focus:border-[#00d4ff] text-white px-4 py-3 rounded-lg outline-none transition placeholder-slate-600 mb-4" />
                           {renewalSearch.trim().length > 0 && !renewalSelected && (
                               <div className="space-y-2 border border-slate-700 bg-slate-900 rounded p-2 max-h-[300px] overflow-y-auto w-full">
                                   {customers.filter(c => (c.busNo||'').toLowerCase().includes(renewalSearch.toLowerCase()) || (c.contactNo||'').includes(renewalSearch)).slice(0, 5).map(c => (
                                       <div key={c.id} onClick={() => { setRenewalSelected(c); setRenewalSearch(''); setFormData({...c}); }} className="p-3 bg-slate-800 hover:bg-slate-700 cursor-pointer rounded flex justify-between items-center transition border border-transparent hover:border-[#00d4ff]">
                                            <div className="font-bold text-slate-200">{c.ownerName} <span className="text-[#00ff88] text-xs ml-2 uppercase font-mono">{c.busNo}</span></div>
                                            <div className="text-xs text-slate-400 font-mono">Exp: {c.expiryDate}</div>
                                       </div>
                                   ))}
                                   {customers.filter(c => (c.busNo||'').toLowerCase().includes(renewalSearch.toLowerCase()) || (c.contactNo||'').includes(renewalSearch)).length === 0 && <div className="p-3 text-slate-500 font-mono text-center">No matching entities found.</div>}
                               </div>
                           )}
                           {renewalSelected && (
                               <div className="p-6 bg-[#00d4ff]/10 border border-[#00d4ff]/30 rounded-lg relative mt-2">
                                   <button onClick={() => { setRenewalSelected(null); setFormData({}); }} className="absolute top-2 right-2 text-[10px] uppercase font-bold tracking-widest bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 px-3 py-1.5 rounded transition">Disconnect</button>
                                   <div className="text-[#00d4ff] text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse"></span> Customer Selected</div>
                                   <div className="text-2xl font-bold text-white mb-2">{renewalSelected.ownerName || 'Unknown Entity'}</div>
                                   <div className="text-sm text-slate-300 font-mono tracking-wide uppercase flex items-center gap-4">
                                      <span>🚌 {renewalSelected.busNo || 'N/A'}</span>
                                      <span className="text-slate-600">|</span>
                                      <span>📞 {renewalSelected.contactNo || 'N/A'}</span>
                                   </div>
                                   <div className="mt-5 pt-5 border-t border-[#00d4ff]/20 grid grid-cols-2 gap-4">
                                       <div className="bg-slate-900/50 p-3 rounded border border-slate-800">
                                           <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Current Package</div>
                                           <div className="text-sm font-bold text-slate-200">{renewalSelected.packageApplied || 'None Found'}</div>
                                       </div>
                                       <div className="bg-slate-900/50 p-3 rounded border border-red-500/20">
                                           <div className="text-[10px] text-red-400 uppercase tracking-widest mb-1">Expiration Deadline</div>
                                           <div className="text-sm font-bold text-red-500">{renewalSelected.expiryDate || 'N/A'}</div>
                                       </div>
                                   </div>
                               </div>
                           )}
                       </div>
                    </div>
                  ) : (
                  <div className="bg-[#111827] border border-[#1e2d47] rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-slate-800/80 px-6 py-4 border-b border-[#1e2d47]">
                        <h2 className="text-[#8b5cf6] font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                           Global CRM Registration Protocol
                        </h2>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">Fill out the complete customer data matrix before generating the invoice.</p>
                    </div>
                    
                    <div className="p-6 space-y-8">
                        <div>
                           <h3 className="text-[#00d4ff] text-xs font-bold uppercase border-b border-slate-700/50 pb-2 mb-4">I. Ownership & Route Configuration</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <CrmInput label="Owner Name" name="ownerName" placeholder="Full Name" />
                              <CrmInput label="Contact No." name="contactNo" placeholder="98XXXXXXXX" />
                              <CrmInput label="Address" name="address" placeholder="Location" />
                              <CrmInput label="Company Name" name="companyName" placeholder="Transport Corp" />
                              <CrmInput label="Bus (V. No)" name="busNo" placeholder="e.g. BA 1 KHA 1234" />
                              <CrmInput label="Bus Route" name="busRoute" placeholder="e.g. KTM - PKR" />
                              <CrmInput label="Bus Type" name="busType" placeholder="Deluxe / AC" />
                              <CrmInput label="Installed By" name="installedBy" placeholder="Technician Name" />
                              <CrmInput label="KTM Parking" name="ktmParking" placeholder="Location" />
                              <CrmInput label="Destination Parking" name="destParking" placeholder="Location" />
                           </div>
                        </div>
                        <div>
                           <h3 className="text-[#ff6b35] text-xs font-bold uppercase border-b border-slate-700/50 pb-2 mb-4">II. Hardware Serialization</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <CrmInput label="Device S/N (Namaste)" name="wifiSn" placeholder="SN12345678" />
                              <CrmInput label="Camera S/N" name="cameraSn" placeholder="Cam Serial" />
                              <CrmInput label="Verification Code" name="verificationCode" placeholder="Code" />
                              <CrmInput label="IMEI Number" name="imeiNo" placeholder="15 Digit IMEI" />
                           </div>
                        </div>
                        <div>
                           <h3 className="text-[#00ff88] text-xs font-bold uppercase border-b border-slate-700/50 pb-2 mb-4">III. Telematics & Network Data</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <CrmInput label="ISP" name="isp" placeholder="NTC/NCELL" />
                              <CrmInput label="SIM Serial Number" name="simSn" placeholder="SIM Block SN" />
                              <CrmInput label="SIM Number" name="simNo" placeholder="Phone Number" />
                              <CrmInput label="SIM Validity Expiry" name="simValidity" placeholder="Date" />
                              <CrmInput label="PUK 1" name="puk1" placeholder="Code" />
                              <CrmInput label="PUK 2" name="puk2" placeholder="Code" />
                           </div>
                        </div>
                        <div>
                           <h3 className="text-[#e2e8f0] text-xs font-bold uppercase border-b border-slate-700/50 pb-2 mb-4">IV. Security & Administrative</h3>
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <CrmInput label="Ezviz Username" name="ezvizUsername" placeholder="User" />
                              <CrmInput label="Ezviz Password" name="ezvizPassword" placeholder="Pass" />
                              <CrmInput label="SSID Name" name="ssidName" placeholder="WiFi Name" />
                              <CrmInput label="SSID Password" name="ssidPassword" placeholder="WiFi Pass" />
                              <CrmInput label="GPS Username" name="gpsUsername" placeholder="User" />
                              <CrmInput label="GPS Password" name="gpsPassword" placeholder="Pass" />
                              <CrmInput label="Staff Number" name="staffNo" placeholder="ID" />
                              <CrmInput label="Remarks" name="remarks" placeholder="Special Note" />
                           </div>
                        </div>
                    </div>
                  </div>
                  )}
               </div>

               <div className="xl:col-span-4 space-y-6">
                 <div className="bg-[#111827] border border-[#1e2d47] rounded-2xl p-6 shadow-xl sticky top-24">
                   <h2 className="text-[#00d4ff] font-bold uppercase tracking-widest text-sm mb-6 flex items-center gap-2">
                     Billing Configuration
                   </h2>
                   <div className="space-y-5">
                     <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-2">Package Type</label>
                        <div className="flex gap-2">
                          <button onClick={() => setPackageType('basic')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition ${packageType === 'basic' ? 'bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/40' : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-800'}`}>Basic</button>
                          <button onClick={() => setPackageType('premium')} className={`flex-1 py-3 px-4 rounded-lg text-sm font-semibold transition ${packageType === 'premium' ? 'bg-[#ff6b35]/10 text-[#ff6b35] border border-[#ff6b35]/40' : 'bg-slate-800/50 text-slate-400 border border-transparent hover:bg-slate-800'}`}>Premium</button>
                        </div>
                     </div>
                     <div>
                         <label className="block text-xs font-mono text-slate-400 uppercase mb-2">Duration</label>
                          <div className="flex flex-col gap-2">
                           <div className="flex gap-2">
                               <button onClick={() => setDuration('1_month')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${duration === '1_month' ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-800/30 text-slate-400 border-transparent'}`}>1 Month</button>
                               <button onClick={() => setDuration('6_months')} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${duration === '6_months' ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-800/30 text-slate-400 border-transparent'}`}>6 Months</button>
                           </div>
                           <button onClick={() => setDuration('1_year')} className={`w-full py-2 rounded-lg text-sm font-medium border ${duration === '1_year' ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-800/30 text-slate-400 border-transparent'}`}>1 Year</button>
                         </div>
                     </div>
                     <div>
                        <label className="block text-xs font-mono text-slate-400 uppercase mb-2">Cameras: {cameraCount}</label>
                        <input type="range" min="0" max="8" value={cameraCount} onChange={(e) => setCameraCount(parseInt(e.target.value))} className="w-full accent-[#00ff88]" />
                     </div>

                     <div className="pt-4 border-t border-slate-700">
                        <div className="text-slate-400 text-xs font-mono mb-2 uppercase tracking-widest text-center">Invoice Summary Preview</div>
                        <div className="flex justify-between items-end mb-4 bg-slate-800/50 p-4 rounded border border-slate-700">
                            <div>
                                <div className="text-white font-bold">{formData.busNo || 'V.No Pending'}</div>
                                <div className="text-xs text-slate-400">{cameraCount} Cam | {packageType}</div>
                            </div>
                            <div className="text-2xl font-bold text-[#00d4ff] text-right">
                                Rs. {orderData.revenue.total.toLocaleString()}
                            </div>
                        </div>

                        <button 
                           onClick={handleDownloadPdfAndSave}
                           disabled={isGeneratingPdf || !!saveMessage}
                           className={`w-full ${saveMessage ? (saveMessage.includes('Error') ? 'bg-red-500' : 'bg-[#8b5cf6]') : 'bg-[#00d4ff] hover:bg-[#00b3d6]'} disabled:opacity-80 text-[#0b0f1a] font-bold uppercase tracking-widest py-4 rounded transition shadow-[0_0_15px_rgba(0,212,255,0.3)] hover:shadow-[0_0_25px_rgba(0,212,255,0.5)]`}>
                           {saveMessage ? saveMessage : (isGeneratingPdf ? 'Processing...' : 'Save Profile & Gen PDF')}
                        </button>
                     </div>
                   </div>
                 </div>

                 {/* HIDDEN INVOICE CAPTURE DIV */}
                 <div className="absolute -left-[10000px]">
                     <div id="invoice-capture" className="bg-[#161e2e] border border-[#1e2d47] p-8 shadow-2xl relative w-[800px] h-auto">
                         <div className="absolute top-0 right-0 bg-gradient-to-l from-[#00d4ff]/10 to-transparent w-full h-[200px] pointer-events-none"></div>
                         <h2 className="text-white font-bold uppercase tracking-widest text-sm mb-6 pb-4 border-b border-slate-800 flex justify-between items-center relative z-10">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 relative rounded overflow-hidden">
                                  <Image src="/logo.png" alt="Logo" fill className="object-cover" />
                              </div>
                              <span>Official Customer Invoice</span>
                           </div>
                           <span className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] px-3 py-1 rounded w-fit text-xs font-mono">Billed to Customer</span>
                         </h2>
                         <div className="relative z-10">
                             <div className="grid grid-cols-2 text-slate-400 text-sm mb-6 bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                                <div>
                                   <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Customer Details</div>
                                   <div className="font-semibold text-white">{formData.busNo || 'Bus Number N/A'}</div>
                                   <div>{formData.contactNo || 'Contact N/A'}</div>
                                   <div className="text-xs mt-1">S/N: {formData.wifiSn || 'Pending'}</div>
                                </div>
                                <div className="text-right">
                                   <div className="text-xs text-slate-500 uppercase tracking-widest mb-1">Hardware / Plan Configuration</div>
                                   <div className="font-semibold text-white">{packageType.toUpperCase()} Package | {cameraCount} Cameras</div>
                                   <div>{duration.replace('_', ' ')}</div>
                                   <div className="text-xs mt-1 text-[#00ff88]">{isRenewal ? 'Renewal Phase' : 'Initial Setup + Installation'}</div>
                                </div>
                             </div>
                             
                             <table className="w-full text-left text-sm border-collapse mt-4">
                                <thead>
                                   <tr className="text-slate-400 font-mono text-xs uppercase tracking-wider border-b border-slate-700">
                                      <th className="py-4 px-2 w-[45%]">Detailed Description</th>
                                      <th className="py-4 px-2 text-center w-[18%]">Unit Price</th>
                                      <th className="py-4 px-2 text-center w-[12%]">Qty</th>
                                      <th className="py-4 px-2 text-right w-[25%]">Line Total</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                   {isRenewal ? (
                                      <tr className="hover:bg-slate-800/20 transition duration-150">
                                          <td className="py-5 px-2">
                                             <div className="font-semibold text-slate-200 text-base">Renewal Subscription</div>
                                             <div className="text-xs text-slate-500 mt-1">Monthly recurring {packageType} data plan</div>
                                          </td>
                                          <td className="py-5 px-2 text-slate-400 text-center font-mono">Rs. {orderData.revenue.wifi.toLocaleString()}</td>
                                          <td className="py-5 px-2 text-slate-400 text-center font-mono">1</td>
                                          <td className="py-5 px-2 text-white text-right font-bold text-base">Rs. {orderData.revenue.wifi.toLocaleString()}</td>
                                      </tr>
                                   ) : (
                                      duration === '1_month' ? (
                                         <>
                                            <tr className="hover:bg-slate-800/20 transition duration-150">
                                                <td className="py-5 px-2">
                                                   <div className="font-semibold text-slate-200 text-base">1-Month Data Sub</div>
                                                   <div className="text-xs text-slate-500 mt-1">High-speed primary {packageType} bandwidth</div>
                                                </td>
                                                <td className="py-5 px-2 text-slate-400 text-center font-mono">Rs. {packageType === 'basic' ? '2,000' : '3,000'}</td>
                                                <td className="py-5 px-2 text-slate-400 text-center font-mono">1</td>
                                                <td className="py-5 px-2 text-white text-right font-bold text-base">Rs. {packageType === 'basic' ? '2,000' : '3,000'}</td>
                                            </tr>
                                            <tr className="hover:bg-slate-800/20 transition duration-150">
                                                <td className="py-5 px-2">
                                                   <div className="font-semibold text-slate-200 text-base">Hardware & Setup Fee</div>
                                                   <div className="text-xs text-[#ff6b35] mt-1">Unbundled router deployment + Antenna</div>
                                                </td>
                                                <td className="py-5 px-2 text-slate-400 text-center font-mono">Rs. 5,000</td>
                                                <td className="py-5 px-2 text-slate-400 text-center font-mono">1</td>
                                                <td className="py-5 px-2 text-white text-right font-bold text-base">Rs. 5,000</td>
                                            </tr>
                                         </>
                                      ) : (
                                         <>
                                            <tr className="hover:bg-slate-800/20 transition duration-150">
                                                <td className="py-5 px-2">
                                                   <div className="font-semibold text-slate-200 text-base">{duration.replace('_', ' ')} Data Sub</div>
                                                   <div className="text-xs text-slate-500 mt-1">High-speed primary {packageType} bandwidth</div>
                                                </td>
                                                <td className="py-5 px-2 text-slate-400 text-center font-mono">Rs. {orderData.revenue.wifi.toLocaleString()}</td>
                                                <td className="py-5 px-2 text-slate-400 text-center font-mono">1</td>
                                                <td className="py-5 px-2 text-white text-right font-bold text-base">Rs. {orderData.revenue.wifi.toLocaleString()}</td>
                                            </tr>
                                            <tr className="bg-[#00ff88]/5">
                                                <td className="py-5 px-2">
                                                   <div className="font-semibold text-[#00ff88] text-base">Hardware & Setup Fee</div>
                                                   <div className="text-xs text-[#00ff88]/70 mt-1">Special promo: Router + Antenna bundled free</div>
                                                </td>
                                                <td className="py-5 px-2 text-[#00ff88] text-center font-mono">Rs. 0</td>
                                                <td className="py-5 px-2 text-[#00ff88] text-center font-mono">1</td>
                                                <td className="py-5 px-2 text-[#00ff88] text-right font-bold text-base">Rs. 0</td>
                                            </tr>
                                         </>
                                      )
                                   )}
                                   {!isRenewal && cameraCount > 0 && (
                                      <>
                                         <tr className="hover:bg-slate-800/20 transition duration-150">
                                             <td className="py-5 px-2">
                                                <div className="font-semibold text-slate-200 text-base">HD CCTV Camera Unit</div>
                                             </td>
                                             <td className="py-5 px-2 text-slate-400 text-center font-mono">Rs. 3,000</td>
                                             <td className="py-5 px-2 text-slate-400 text-center font-mono">{cameraCount}</td>
                                             <td className="py-5 px-2 text-white text-right font-bold text-base">Rs. {(cameraCount * 3000).toLocaleString()}</td>
                                         </tr>
                                         <tr className="hover:bg-slate-800/20 transition duration-150">
                                             <td className="py-5 px-2">
                                                <div className="font-semibold text-slate-200 text-base">64GB Memory Card & Install</div>
                                             </td>
                                             <td className="py-5 px-2 text-slate-400 text-center font-mono">Rs. 3,000</td>
                                             <td className="py-5 px-2 text-slate-400 text-center font-mono">{cameraCount}</td>
                                             <td className="py-5 px-2 text-white text-right font-bold text-base">Rs. {(cameraCount * 3000).toLocaleString()}</td>
                                         </tr>
                                      </>
                                   )}
                                </tbody>
                             </table>
                             <div className="flex justify-between items-end pt-6 mt-4">
                                <div className="text-slate-500 text-xs italic">Thank you for your business.</div>
                                <div className="text-right">
                                   <div className="text-slate-400 uppercase text-xs font-mono tracking-widest mb-1">Total Amount Due</div>
                                   <div className="text-4xl font-bold text-[#00d4ff]">Rs. {orderData.revenue.total.toLocaleString()}</div>
                                </div>
                             </div>
                         </div>
                     </div>
                 </div>
               </div>
            </div>
            <div className="w-full mt-10">
                 {/* REVENUE LEDGER CONSOLIDATED UNDER ORDER FORM */}
                 <div className="bg-[#111827] border border-[#ff6b35]/30 rounded-2xl p-8 shadow-2xl relative">
                   <div className="absolute top-0 left-0 w-2 h-full bg-[#ff6b35] rounded-l-2xl"></div>
                   <h2 className="text-[#ff6b35] font-bold uppercase tracking-widest text-lg mb-2">
                     Profit & Loss Database Ledger
                   </h2>
                   <div className="text-slate-400 text-xs font-mono uppercase tracking-widest mb-8">Live internal cost routing map</div>
                   {/* Full Revenue Ledger UI mapped directly into Flow */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                       <div className="bg-[#1a0b0f] border border-red-500/20 rounded-xl p-6 shadow-inner">
                           <h3 className="text-red-400 text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)]"></span> Cost Breakdown (Ref: Overview)</h3>
                           <div className="space-y-4">
                               <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2"><span className="text-slate-400">CCTV Hardware (Cam+Mem)</span><span className="font-mono text-red-300">- Rs {(orderData.cost.cameraPurchase + orderData.cost.memoryPurchase).toLocaleString()}</span></div>
                               <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2"><span className="text-slate-400">Telecom Pkt & Accessories</span><span className="font-mono text-red-300">- Rs {(orderData.cost.telecom + orderData.cost.accessories).toLocaleString()}</span></div>
                               <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2"><span className="text-slate-400">Installation Labor</span><span className="font-mono text-red-300">- Rs {orderData.cost.labor.toLocaleString()}</span></div>
                               <div className="flex justify-between items-center font-bold pt-2"><span className="text-red-400">Total Capital Cost</span><span className="font-mono text-red-500">- Rs {orderData.cost.total.toLocaleString()}</span></div>
                           </div>
                       </div>
                       <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-6 shadow-inner">
                           <h3 className="text-[#00ff88] text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] shadow-[0_0_8px_rgba(0,255,136,1)]"></span> Revenue Stream</h3>
                           <div className="space-y-4">
                               <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2"><span className="text-slate-400">Internet Package</span><span className="font-mono text-[#00ff88]/70">+ Rs {orderData.revenue.wifi.toLocaleString()}</span></div>
                               <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2"><span className="text-slate-400">CCTV Hardware Upsell</span><span className="font-mono text-[#00ff88]/70">+ Rs {orderData.revenue.cctv.toLocaleString()}</span></div>
                               <div className="flex justify-between items-center text-sm border-b border-transparent pb-2 opacity-0"><span className="text-slate-400">Spacer</span><span className="font-mono text-[#00ff88]/70">+ Rs 0</span></div>
                               <div className="flex justify-between items-center font-bold pt-2"><span className="text-[#00ff88] drop-shadow-[0_0_5px_rgba(0,255,136,0.3)]">Total Gross Revenue</span><span className="font-mono text-[#00ff88]">+ Rs {orderData.revenue.total.toLocaleString()}</span></div>
                           </div>
                       </div>
                   </div>
                   <div className="bg-slate-900 border-t border-[#00ff88]/20 bg-gradient-to-r from-transparent via-[#00ff88]/5 to-transparent flex flex-col md:flex-row justify-between items-center p-6 rounded-xl">
                       <div className="text-xs text-[#00ff88] uppercase tracking-widest font-bold mb-2 md:mb-0 text-center md:text-left">Net Operating Profit</div>
                       <div className="text-3xl font-bold text-white drop-shadow-[0_0_15px_rgba(0,255,136,0.3)]">Rs {orderData.profit.toLocaleString()}</div>
                   </div>
                 </div>
            </div>
            </>
          )}

          {/* TAB 4: ANALYTICS DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-[#111827] border border-[#00d4ff]/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d4ff]/10 blur-3xl rounded-full pointer-events-none"></div>
                     <h3 className="text-[#00d4ff] font-bold uppercase tracking-widest text-base mb-6 flex items-center gap-3">
                        <span className="text-2xl drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]">🏆</span> Top 5 High-Value Accounts
                     </h3>
                     {topValueCustomers.length === 0 ? (
                         <p className="text-slate-500 text-sm font-mono italic p-4 bg-slate-800/20 rounded border border-slate-700/50">No revenue records found.</p>
                     ) : (
                         <div className="space-y-4 relative z-10">
                             {topValueCustomers.map((c, i) => (
                                 <div key={'topval'+i} className="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700 hover:border-[#00d4ff]/50 transition duration-300 shadow-sm">
                                     <div className="flex items-center gap-4">
                                         <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00d4ff] to-[#0077ff] text-white text-sm flex items-center justify-center font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]">{i+1}</div>
                                         <span className="text-white font-bold tracking-wide">{c.busNo || c.ownerName}</span>
                                     </div>
                                     <div className="text-[#00ff88] font-mono font-bold text-lg drop-shadow-[0_0_5px_rgba(0,255,136,0.2)]">Rs. {c.totalCharged?.toLocaleString()}</div>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>

                 <div className="bg-[#111827] border border-[#ff6b35]/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff6b35]/10 blur-3xl rounded-full pointer-events-none"></div>
                     <h3 className="text-[#ff6b35] font-bold uppercase tracking-widest text-base mb-6 flex items-center gap-3">
                        <span className="text-2xl drop-shadow-[0_0_8px_rgba(255,107,53,0.5)]">⏳</span> Urgent Renewals (Top 5)
                     </h3>
                     {topExpiringCustomers.length === 0 ? (
                         <p className="text-slate-500 text-sm font-mono italic p-4 bg-slate-800/20 rounded border border-slate-700/50">No upcoming expirations found.</p>
                     ) : (
                         <div className="space-y-4 relative z-10">
                             {topExpiringCustomers.map((c, i) => (
                                 <div key={'topexp'+i} className="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700 hover:border-[#ff6b35]/50 transition duration-300 shadow-sm border-l-4 border-l-[#ff6b35]">
                                     <div className="flex flex-col gap-1.5">
                                         <span className="text-white font-bold text-base tracking-wide">{c.ownerName || <span className="text-slate-500 italic">Unknown</span>}</span>
                                         <span className="text-slate-400 font-mono text-xs uppercase flex items-center gap-2">
                                             <span>📞 {c.contactNo || 'N/A'}</span> <span className="text-slate-600">|</span> <span className="text-[#00d4ff]">🚌 {c.busNo || 'N/A'}</span>
                                         </span>
                                     </div>
                                     <div className="text-right">
                                         <div className="text-[#ff6b35] font-mono font-bold text-base drop-shadow-[0_0_5px_rgba(255,107,53,0.2)]">{c.expiryDate}</div>
                                         <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Deadline</div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             </div>

             {/* PENDING RECEIVABLES TRACKER */}
             <div className="bg-[#111827] border border-red-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-3xl rounded-full pointer-events-none"></div>
                 <h3 className="text-red-400 font-bold uppercase tracking-widest text-lg mb-6 flex items-center gap-3 border-b border-red-500/20 pb-4">
                    <span className="text-2xl drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">🔴</span> Pending Accounts Receivable
                 </h3>
                 {pendingCustomers.length === 0 ? (
                     <p className="text-[#00ff88] text-sm font-bold uppercase tracking-widest p-4 bg-[#00ff88]/10 rounded border border-[#00ff88]/30 flex items-center gap-2">
                         <span>✓</span> All verified payments have been successfully cleared.
                     </p>
                 ) : (
                     <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-500 font-mono text-[10px] uppercase tracking-widest border-b border-slate-700">
                                    <th className="py-3 px-4">Client Identity</th>
                                    <th className="py-3 px-4 text-center">Contact Data</th>
                                    <th className="py-3 px-4 text-right">Resolved Cash</th>
                                    <th className="py-3 px-4 text-right text-red-400">Total Pending Due</th>
                                    <th className="py-3 px-4 text-center">Enforcement Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {pendingCustomers.map((c, i) => (
                                    <tr key={'pending'+i} className="hover:bg-slate-800/30 transition">
                                        <td className="py-4 px-4">
                                            <div className="text-white font-bold">{c.ownerName || 'Unknown'}</div>
                                            <div className="text-xs text-slate-500 font-mono mt-0.5">V.No: {c.busNo || 'N/A'}</div>
                                        </td>
                                        <td className="py-4 px-4 text-center font-mono text-sm text-slate-400">{c.contactNo || 'N/A'}</td>
                                        <td className="py-4 px-4 text-right text-[#00ff88] font-bold font-mono">Rs. {(c.totalCharged || 0).toLocaleString()}</td>
                                        <td className="py-4 px-4 text-right font-bold text-lg text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.3)]">Rs. {c.pendingDue?.toLocaleString()}</td>
                                        <td className="py-4 px-4 text-center">
                                            <button onClick={() => {
                                                const updated = { ...c, totalCharged: (c.totalCharged || 0) + (c.pendingDue || 0), pendingDue: 0 };
                                                fetch('/api/customers', {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify(updated)
                                                }).then(() => {
                                                    setCustomers(prev => prev.map(old => old.id === c.id ? updated : old));
                                                });
                                            }} className="bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white transition px-4 py-2 rounded font-bold uppercase tracking-widest text-[10px] shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                                Mark Cash Cleared
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                 )}
             </div>
            </div>
          )}

          {/* TAB 5: CUSTOMER INFORMATION */}
          {activeTab === 'crm' && (
             <div className="space-y-6">

                <div className="bg-[#111827] border border-[#8b5cf6]/30 rounded-2xl p-8 shadow-2xl relative">
                   <div className="absolute top-0 left-0 w-2 h-full bg-[#8b5cf6] rounded-l-2xl"></div>
                   
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                      <div>
                          <h2 className="text-[#8b5cf6] font-bold uppercase tracking-widest text-lg">
                            Global Customer Directory
                          </h2>
                          <div className="flex flex-wrap gap-3 mt-2 h-auto text-xs items-center">
                              <span className="bg-slate-800 px-3 py-1.5 rounded text-slate-400 font-mono">
                                 Active Entities: {customers.length}
                              </span>
                              
                              <button onClick={handleAutomatedImport} disabled={isImporting} className={`cursor-pointer transition px-3 py-1.5 border rounded font-bold uppercase tracking-widest shadow-lg ${isImporting ? 'bg-[#ff6b35]/20 text-[#ff6b35] border-[#ff6b35]/30' : 'bg-[#00ff88]/20 text-[#00ff88] border-[#00ff88]/30 hover:bg-[#00ff88] hover:text-black'}`}>
                                 {isImporting ? 'Auto Syncing...' : 'Automated Sync Import'}
                              </button>
                          </div>
                      </div>
                      <div className="w-full md:w-[400px]">
                          <input 
                             type="text" 
                             placeholder="Search Directory: Bus No, Contact, or Name..." 
                             value={searchQuery}
                             onChange={e => setSearchQuery(e.target.value)}
                             className="w-full bg-slate-900/80 border border-slate-700 text-sm focus:border-[#8b5cf6] text-white px-4 py-3 rounded-xl outline-none transition placeholder-slate-500 shadow-inner"
                          />
                      </div>
                   </div>

                   <div className="overflow-x-auto text-sm bg-slate-900 rounded-xl border border-slate-700">
                      <table className="w-full text-left border-collapse min-w-[900px]">
                          <thead>
                              <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700 select-none">
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px]">Owner Name</th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700">Contact #</th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700 text-center">Cams</th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700">Bus (V.No)</th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700">Hardware Profile</th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700">Package</th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700 text-[#00ff88]">Total Paid</th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700 cursor-pointer hover:bg-slate-700 transition" onClick={handleSort}>
                                      Timeline {sortField === 'installDate' ? (sortOrder === 'desc' ? '⬇' : '⬆') : ''}
                                  </th>
                                  <th className="p-4 font-mono uppercase tracking-wider text-[10px] border-l border-slate-700 text-center text-[#00d4ff]">Admin Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700/50">
                              {sortedCustomers.length === 0 ? (
                                  <tr><td colSpan={8} className="p-8 text-center text-slate-500 font-mono">No matching database records found...</td></tr>
                              ) : sortedCustomers.map((c, idx) => {
                                  const isExpired = c.status?.toLowerCase().includes('expire') || (c.expiryDate && new Date(c.expiryDate).getTime() < new Date().getTime());
                                  return (
                                  <tr key={c.id || idx} className={`transition ${isExpired ? 'hover:bg-red-900/10' : 'hover:bg-slate-800/50'}`}>
                                      <td className="p-4 font-semibold text-slate-200">{c.ownerName || <span className="text-slate-500 italic">Unknown</span>}</td>
                                      <td className="p-4 border-l border-slate-700/50 font-mono text-xs">{c.contactNo || '-'}</td>
                                      <td className="p-4 border-l border-slate-700/50 text-center font-mono text-xs">{(c.cameraCount !== undefined && c.cameraCount > 0) ? c.cameraCount : (c.equipment?.includes('Cam') ? 'Yes' : '0')}</td>
                                      <td className={`p-4 border-l border-slate-700/50 font-bold ${isExpired ? 'text-red-500' : 'text-[#00ff88]'}`}>{c.busNo || 'N/A'}</td>
                                      
                                      <td className="p-4 border-l border-slate-700/50">
                                          <div className="text-slate-300 text-xs text-nowrap">
                                              <div>W-SN: <span className="font-mono text-white">{c.wifiSn || '-'}</span></div>
                                              <div>SIM No: <span className="font-mono text-white">{c.simNo || '-'}</span></div>
                                          </div>
                                      </td>
                                      
                                      <td className="p-4 border-l border-slate-700/50">
                                          <div className="text-xs uppercase font-bold text-slate-300">{c.packageApplied || 'N/A'}</div>
                                          <div className={`text-[10px] px-1.5 py-0.5 w-fit rounded mt-1 border font-bold uppercase tracking-widest ${isExpired ? 'bg-red-500/20 border-red-500/50 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>
                                              {isExpired ? 'Expired' : (c.status || 'Active')}
                                          </div>
                                      </td>
                                      
                                      <td className="p-4 border-l border-slate-700/50">
                                          <div className="text-[#00ff88] font-bold text-sm drop-shadow-[0_0_5px_rgba(0,255,136,0.3)]">Rs. {(c.totalCharged || 0).toLocaleString()}</div>
                                      </td>
                                      
                                      <td className="p-4 border-l border-slate-700/50">
                                          <div className="text-slate-400 text-xs font-mono">
                                            <div>A: <span className="text-slate-300">{c.installDate || '-'}</span></div>
                                            <div>E: <span className="text-red-400">{c.expiryDate || '-'}</span></div>
                                          </div>
                                      </td>

                                      <td className="p-4 border-l border-slate-700/50 text-center">
                                          <button onClick={() => setViewingProfile(c)} className="bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] hover:bg-[#00d4ff] hover:text-black transition px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(0,212,255,0.2)]">Enquiry</button>
                                      </td>
                                  </tr>
                              )})}
                          </tbody>
                      </table>
                   </div>
                </div>
             </div>
          )}

          {/* ADMIN ENQUIRY & BILLING CONFIG MODAL */}
          {viewingProfile && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                 <div className="bg-[#111827] border border-[#00d4ff]/30 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-[0_0_50px_rgba(0,212,255,0.15)] flex flex-col">
                     <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#111827]/90 backdrop-blur z-10">
                         <h2 className="text-[#00d4ff] font-bold text-xl uppercase tracking-widest flex items-center gap-3">
                             <span className="text-2xl">⚙️</span> Profile Operations <span className="text-white">| {viewingProfile.busNo || viewingProfile.ownerName}</span>
                         </h2>
                         <button onClick={() => setViewingProfile(null)} className="text-slate-400 hover:text-[#ff6b35] transition text-3xl leading-none">&times;</button>
                     </div>
                     <div className="p-6 space-y-8">
                         
                         {/* Customer Identity Block */}
                         <div>
                             <h3 className="text-slate-300 uppercase text-xs font-bold tracking-widest border-b border-slate-700 pb-2 mb-4">Core Identity Protocol</h3>
                             <div className="grid grid-cols-2 gap-4">
                                 <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                     <div className="text-[10px] text-slate-500 uppercase font-mono">Owner Name</div>
                                     <div className="text-sm text-white font-bold">{viewingProfile.ownerName || 'N/A'}</div>
                                 </div>
                                 <div className="bg-slate-800/50 p-3 rounded border border-slate-700">
                                     <div className="text-[10px] text-slate-500 uppercase font-mono">Contact No</div>
                                     <div className="text-sm text-white font-bold">{viewingProfile.contactNo || 'N/A'}</div>
                                 </div>
                             </div>
                         </div>

                         {/* Billing Control Block */}
                         <div>
                             <h3 className="text-[#00ff88] uppercase text-xs font-bold tracking-widest border-b border-[#00ff88]/30 pb-2 mb-4">Financial & Billing Adjustments</h3>
                             <div className="space-y-4">
                                 <div className="grid grid-cols-2 gap-4">
                                     <div>
                                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Total Billed Ledger (Rs)</label>
                                        <input 
                                            type="number" 
                                            value={viewingProfile.totalCharged || 0} 
                                            onChange={(e) => setViewingProfile({...viewingProfile, totalCharged: parseInt(e.target.value) || 0})} 
                                            className="w-full bg-slate-900 border border-slate-700 text-[#00ff88] text-lg font-bold px-4 py-3 rounded-lg outline-none focus:border-[#00ff88] transition" 
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1 italic leading-tight">Amount actually tracked & collected physically.</p>
                                     </div>
                                     <div>
                                        <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Pending Debt (Rs)</label>
                                        <input 
                                            type="number" 
                                            value={viewingProfile.pendingDue || 0} 
                                            onChange={(e) => setViewingProfile({...viewingProfile, pendingDue: parseInt(e.target.value) || 0})} 
                                            className="w-full bg-slate-900 border border-slate-700 text-red-500 text-lg font-bold px-4 py-3 rounded-lg outline-none focus:border-red-500 transition" 
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1 italic leading-tight">Amount outstanding remaining to be paid.</p>
                                     </div>
                                 </div>
                                 <div>
                                    <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-1">Assigned Package Tier</label>
                                    <input 
                                        type="text" 
                                        value={viewingProfile.packageApplied || ''} 
                                        onChange={(e) => setViewingProfile({...viewingProfile, packageApplied: e.target.value})} 
                                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm font-bold px-4 py-3 rounded-lg outline-none focus:border-[#00d4ff] transition uppercase" 
                                    />
                                 </div>
                                 
                                 <button onClick={() => {
                                     fetch('/api/customers', {
                                         method: 'PUT',
                                         headers: { 'Content-Type': 'application/json' },
                                         body: JSON.stringify(viewingProfile)
                                     }).then(() => {
                                         setCustomers(prev => prev.map(c => c.id === viewingProfile.id ? viewingProfile : c));
                                         setViewingProfile(null);
                                     }).catch(err => alert("Database update failed."));
                                 }} className="w-full bg-gradient-to-r from-[#00ff88] to-[#00cc66] hover:scale-[1.02] active:scale-[0.98] transition-all text-black py-4 font-bold uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(0,255,136,0.4)] mt-4">
                                     Update Financial Database
                                 </button>
                             </div>
                         </div>

                     </div>
                 </div>
             </div>
          )}
       </main>
    </div>
  );
}
