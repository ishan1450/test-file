import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Share2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  RotateCcw,
  DownloadCloud,
  ExternalLink,
  Sliders,
  Copy,
  Check,
  HelpCircle,
  Unlink,
  Link as LinkIcon,
  X,
  ShieldAlert,
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bot,
  UserCheck,
} from 'lucide-react';
import { metaService } from '../services/metaService';
import {
  MetaIntegration,
  MetaForm,
  MetaSyncLog,
  MetaImportResult,
  MetaConnectionPayload,
  MetaHistoricalImportPayload,
  MetaSimulateResult,
} from '../types/meta';

export const MetaSettings: React.FC = () => {
  const [integration, setIntegration] = useState<MetaIntegration | null>(null);
  const [logs, setLogs] = useState<MetaSyncLog[]>([]);
  const [forms, setForms] = useState<MetaForm[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Action loading
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [importResult, setImportResult] = useState<MetaImportResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Accordion for advanced developer configuration
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Connect form state
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [instagramId, setInstagramId] = useState('');
  const [instagramUser, setInstagramUser] = useState('');

  // Field mappings state
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [isSavingMappings, setIsSavingMappings] = useState(false);

  // Historical import state
  const [selectedFormId, setSelectedFormId] = useState<string>('');
  const [sinceDate, setSinceDate] = useState<string>('');
  const [untilDate, setUntilDate] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<MetaSimulateResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);

  const fetchStatusAndLogs = async () => {
    setIsLoading(true);
    try {
      const statusData = await metaService.getStatus();
      setIntegration(statusData);
      setMappings(statusData.field_mappings || {});

      const logsData = await metaService.getLogs(30);
      setLogs(logsData);

      if (statusData.is_connected) {
        const formsRes = await metaService.getForms();
        setForms(formsRes.forms || []);
      }
    } catch (err: any) {
      console.error('Failed to load Meta settings status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndLogs();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: MetaConnectionPayload = {
        page_id: pageId,
        page_name: pageName || undefined,
        access_token: accessToken,
        instagram_account_id: instagramId || undefined,
        instagram_username: instagramUser || undefined,
      };
      await metaService.connectMeta(payload);
      setIsConnectModalOpen(false);
      setAccessToken('');
      await fetchStatusAndLogs();
    } catch (err: any) {
      alert(err.message || 'Failed to connect Meta account');
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect Meta Lead Ads? Automatic ingestion will pause.')) {
      try {
        await metaService.disconnectMeta();
        await fetchStatusAndLogs();
      } catch (err: any) {
        alert(err.message || 'Failed to disconnect');
      }
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await metaService.syncNow();
      setImportResult(res);
      await fetchStatusAndLogs();
    } catch (err: any) {
      alert(err.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      const res = await metaService.retryFailed();
      alert(`Retried ${res.retried} entries. Successfully resolved: ${res.successfully_resolved}`);
      await fetchStatusAndLogs();
    } catch (err: any) {
      alert(err.message || 'Retry failed');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveMappings = async () => {
    setIsSavingMappings(true);
    try {
      await metaService.updateFieldMappings(mappings);
      alert('Field mappings saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save mappings');
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleHistoricalImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsImporting(true);
    try {
      const payload: MetaHistoricalImportPayload = {
        form_ids: selectedFormId ? [selectedFormId] : undefined,
        since_date: sinceDate || undefined,
        until_date: untilDate || undefined,
      };
      const res = await metaService.importHistorical(payload);
      setImportResult(res);
      setIsImportModalOpen(false);
      await fetchStatusAndLogs();
    } catch (err: any) {
      alert(err.message || 'Historical import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSimulateLead = async (preset: 'instagram_villa' | 'facebook_penthouse' | 'custom' = 'instagram_villa') => {
    setIsSimulating(true);
    setSimulationError(null);
    setSimulationResult(null);

    const presets = {
      instagram_villa: {
        full_name: 'Sophia Martinez',
        phone: '+1 (555) 234-5678',
        email: 'sophia.martinez@example.com',
        property_type: 'Luxury Villa',
        preferred_location: 'Beverly Hills / Westside',
        max_budget: 1450000,
        platform: 'Instagram',
        campaign_name: 'Summer 2026 Luxury Estates Campaign',
        ad_name: 'Reel Video Ad - Private Pool Villa',
      },
      facebook_penthouse: {
        full_name: 'Daniel Harrison',
        phone: '+1 (555) 890-1234',
        email: 'daniel.harrison@horizoncap.io',
        property_type: 'Penthouse Apartment',
        preferred_location: 'Downtown Financial District',
        max_budget: 920000,
        platform: 'Facebook',
        campaign_name: 'Urban High-Rise Living Ads',
        ad_name: 'Carousel Ad - Skyline Views',
      },
      custom: {
        full_name: 'Elena Rostova',
        phone: '+1 (555) 678-9012',
        email: 'elena.rostova@globalinvest.com',
        property_type: 'Waterfront Estate',
        preferred_location: 'Miami Coastal / Beachfront',
        max_budget: 2100000,
        platform: 'Instagram',
        campaign_name: 'Waterfront Collection Campaign',
        ad_name: 'Instant Form - Oceanfront Access',
      },
    };

    try {
      const result: MetaSimulateResult = await metaService.simulateLead(presets[preset]);
      setSimulationResult(result);
      await fetchStatusAndLogs();
    } catch (err: any) {
      setSimulationError(err.message || 'Failed to simulate Meta lead');
    } finally {
      setIsSimulating(false);
    }
  };

  const copyToClipboard = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
        <span className="text-xs font-medium">Checking Meta Lead Ads connection status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Protection Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-400/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Administrator Only • Hidden From CRM Users & Agents
            </h2>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Agents only receive assigned leads in their dashboard. All technical Meta credentials, tokens, and webhook URLs are strictly restricted to Administrators.
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 rounded-full">
          Strict Role Guard Active
        </span>
      </div>

      {/* Hero Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                Meta Ads Automatic Lead Engine
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Connect your Facebook & Instagram Ads once. New leads are automatically ingested 24/7 and distributed to agents via Round-Robin rotation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {integration?.is_connected ? (
            <>
              <button
                disabled={isSyncing}
                onClick={handleSyncNow}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronizing...' : 'Sync Now'}</span>
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <DownloadCloud className="w-3.5 h-3.5" /> Import Past Leads
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" /> Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <LinkIcon className="w-4 h-4" /> Connect Meta Account (1-Step)
            </button>
          )}
        </div>
      </div>

      {/* Live Automation Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Status */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Connection State
          </span>
          <div className="mt-2 flex items-center justify-between">
            {integration?.is_connected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Autopilot Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Not Connected
              </span>
            )}
            <Bot className={`w-4 h-4 ${integration?.is_connected ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            {integration?.is_connected ? 'Connected to Graph API v22.0' : 'Connect once to enable continuous sync'}
          </p>
        </div>

        {/* Connected Page */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Connected Page / Brand
          </span>
          <p className="text-sm font-bold text-slate-900 mt-2 truncate">
            {integration?.page_name || (integration?.is_connected ? 'Connected Facebook Page' : 'None')}
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">
            {integration?.page_id ? `Page ID: ${integration.page_id}` : 'Page not linked'}
          </p>
        </div>

        {/* Ingestion Engine */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Ingestion Engine
          </span>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-xs font-bold text-slate-800">Webhook + Poller</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Instant push events + 3-min recurring check
          </p>
        </div>

        {/* Leads Ingested */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Auto-Ingested Leads
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-blue-600">
              {integration?.imported_count || 0}
            </span>
            <span className="text-[10px] text-slate-400">Round-Robin Assigned</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Last sync: {integration?.last_sync_at ? new Date(integration.last_sync_at).toLocaleTimeString() : 'Never'}
          </p>
        </div>
      </div>

      {/* Interactive Simulation & Test Section */}
      <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white p-6 rounded-xl border border-blue-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Live Demonstration & Verification
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Test Instant Automated Lead Capture & Round-Robin Routing
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Verify the entire automated engine without waiting for a real customer. Click below to simulate a potential buyer submitting a Meta Instant Form on Facebook or Instagram. The lead will be captured, deduplicated, and assigned to the next eligible agent in the round-robin sequence!
            </p>
          </div>
        </div>

        {/* Simulation Buttons */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            disabled={isSimulating}
            onClick={() => handleSimulateLead('instagram_villa')}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-bounce' : ''}`} />
            <span>Simulate Instagram Villa Lead ($1.45M)</span>
          </button>

          <button
            disabled={isSimulating}
            onClick={() => handleSimulateLead('facebook_penthouse')}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5 text-blue-600" />
            <span>Simulate Facebook Penthouse Lead ($920K)</span>
          </button>

          <button
            disabled={isSimulating}
            onClick={() => handleSimulateLead('custom')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Simulate Waterfront Estate ($2.1M)
          </button>
        </div>

        {/* Simulation Result Card */}
        {simulationResult && (
          <div className="mt-5 p-4 bg-emerald-50/90 border border-emerald-300 rounded-xl shadow-xs transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-emerald-900">
                    Lead Automatically Ingested & Assigned!
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    <strong>{simulationResult.full_name}</strong> submitted an ad form via{' '}
                    <strong>{simulationResult.source}</strong> ({simulationResult.campaign_name}).
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-emerald-200 font-semibold text-slate-800">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      Assigned Agent: {simulationResult.assigned_agent.full_name}
                    </span>
                    <span className="bg-emerald-100/80 text-emerald-900 px-2.5 py-1 rounded-md font-mono text-[11px]">
                      Phone: {simulationResult.phone}
                    </span>
                    <span className="bg-emerald-100/80 text-emerald-900 px-2.5 py-1 rounded-md font-mono text-[11px]">
                      Status: New
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/leads/${simulationResult.lead_id}`}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs"
                >
                  <span>View Lead Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={() => setSimulationResult(null)}
                  className="p-1 text-emerald-700 hover:text-emerald-900 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {simulationError && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
            <span>{simulationError}</span>
            <button onClick={() => setSimulationError(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Advanced Technical Settings Accordion */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-5 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Sliders className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Advanced Developer Configuration & Webhook Endpoints (Optional)
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Inspect webhook endpoints, verify tokens, custom field mappings, and raw sync audit logs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
            <span>{showAdvanced ? 'Hide Technical Details' : 'Show Technical Details'}</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-slate-200 bg-slate-50/30 space-y-6">
            {/* Webhook Configuration Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Webhook Details (For Meta for Developers Dashboard)
                </span>
                <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-semibold">
                  Live Endpoint Ready
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Callback URL (Webhook)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={integration?.webhook_url || ''}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                    <button
                      onClick={() => copyToClipboard(integration?.webhook_url || '', 'url')}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Verify Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={integration?.verify_token || ''}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-800"
                    />
                    <button
                      onClick={() => copyToClipboard(integration?.verify_token || '', 'token')}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Field Mappings & Forms Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Field Mapping Editor */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Question Field Mapping
                    </h3>
                    <p className="text-[11px] text-slate-500">Maps incoming Meta question names to CRM lead attributes</p>
                  </div>
                  <button
                    onClick={handleSaveMappings}
                    disabled={isSavingMappings}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {isSavingMappings ? 'Saving...' : 'Save Mappings'}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Full Name Question Name', key: 'full_name', placeholder: 'full_name' },
                    { label: 'Phone Number Question Name', key: 'phone_number', placeholder: 'phone_number' },
                    { label: 'Email Address Question Name', key: 'email', placeholder: 'email' },
                    { label: 'Property Type Question Name', key: 'property_type', placeholder: 'property_type' },
                    { label: 'Preferred Location Question Name', key: 'preferred_location', placeholder: 'location' },
                    { label: 'Budget Question Name', key: 'budget', placeholder: 'budget' },
                  ].map((f) => (
                    <div key={f.key} className="flex items-center gap-3 text-xs">
                      <span className="w-1/2 text-slate-600 font-medium">{f.label}</span>
                      <input
                        type="text"
                        value={mappings[f.key] || ''}
                        onChange={(e) => setMappings({ ...mappings, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className="w-1/2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono text-xs focus:bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Lead Ads Forms on Page */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Detected Meta Lead Forms
                    </h3>
                    <p className="text-[11px] text-slate-500">Instant Forms connected to your Facebook page</p>
                  </div>
                </div>

                {forms.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    {integration?.is_connected
                      ? 'No Instant Forms detected on this page yet, or default form is active.'
                      : 'Connect your Facebook Page to automatically discover lead forms.'}
                  </div>
                ) : (
                  <div className="space-y-2 overflow-y-auto max-h-56">
                    {forms.map((f) => (
                      <div
                        key={f.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{f.name}</p>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {f.id}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Active Form
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Recent Synchronization & Webhook Audit Logs
                  </h3>
                  <p className="text-[11px] text-slate-500">Live trail of incoming lead events and deduplication checks</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={isRetrying}
                    onClick={handleRetryFailed}
                    className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                    <span>Retry Failed</span>
                  </button>
                  <button
                    onClick={fetchStatusAndLogs}
                    className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-2 font-semibold">Timestamp</th>
                      <th className="pb-2 font-semibold">Type</th>
                      <th className="pb-2 font-semibold">Lead ID</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">Details / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No sync logs recorded yet
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 font-mono text-[11px]">
                          <td className="py-2.5 text-slate-600">
                            {new Date(log.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 uppercase text-slate-700 font-sans font-semibold text-[10px]">
                            {log.event_type}
                          </td>
                          <td className="py-2.5 text-slate-800">{log.external_lead_id || '—'}</td>
                          <td className="py-2.5">
                            {log.status === 'success' && (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-sans font-semibold text-[10px]">
                                Success
                              </span>
                            )}
                            {log.status === 'skipped_duplicate' && (
                              <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-sans font-semibold text-[10px]">
                                Duplicate Skipped
                              </span>
                            )}
                            {log.status === 'failed' && (
                              <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-sans font-semibold text-[10px]">
                                Failed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-500 font-sans max-w-xs truncate">
                            {log.error_message || 'Lead ingested & assigned to round-robin sequence'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Connect Facebook Page Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-blue-600" /> Connect Meta Ads Account (1-Step)
              </h2>
              <button onClick={() => setIsConnectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnect} className="mt-4 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                Connect your business Facebook Page once. All incoming leads from Facebook and Instagram Lead Ads will automatically flow directly into your CRM.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Facebook Page ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="e.g. 109823471029482"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">Found in your Facebook Page &gt; About &gt; Page Transparency</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Page Name (Display Name)</label>
                <input
                  type="text"
                  value={pageName}
                  onChange={(e) => setPageName(e.target.value)}
                  placeholder="e.g. Real One Luxury Real Estate"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Meta Access Token (System User or Page Token) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAA..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Requires <code>leads_retrieval</code> and <code>pages_manage_ads</code> permissions.
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
                💡 <strong>Tip:</strong> If you don't have live Meta developer credentials right now, you can also test the automatic lead ingestion engine instantly using the "Simulate Lead" demonstration tool on the settings page!
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Connect & Activate Autopilot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historical Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Import Past Meta Leads</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleHistoricalImport} className="mt-4 space-y-3.5 text-xs">
              <p className="text-slate-600">
                Import past form submissions from Meta. Unique leads will be transactionally imported and distributed across active agents in stable chronological sequence.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lead Form</label>
                <select
                  value={selectedFormId}
                  onChange={(e) => setSelectedFormId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="">All Configured Forms</option>
                  {forms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} (ID: {f.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Since Date (Optional)</label>
                  <input
                    type="date"
                    value={sinceDate}
                    onChange={(e) => setSinceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Until Date (Optional)</label>
                  <input
                    type="date"
                    value={untilDate}
                    onChange={(e) => setUntilDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isImporting ? 'Importing Leads...' : 'Start Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
