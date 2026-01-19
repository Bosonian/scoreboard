import { useState } from 'react';

const getConfidenceColor = (prob, cutoff) => {
  if (prob >= cutoff) return { bg: 'from-emerald-500 to-emerald-600', text: 'text-emerald-400', ring: 'ring-emerald-500/30', label: 'Positive' };
  return { bg: 'from-sky-500 to-sky-600', text: 'text-sky-400', ring: 'ring-sky-500/30', label: 'Negative' };
};

const getPrediction = (prob, cutoff) => prob >= cutoff ? 'positive' : 'negative';

const calculateMatch = (prob, ctResult, cutoff) => {
  if (ctResult === null) return { status: 'pending', icon: '○', color: 'text-gray-500' };
  const prediction = getPrediction(prob, cutoff);
  if (prediction === 'positive' && ctResult === 'confirmed') return { status: 'match', icon: '✓', color: 'text-emerald-400' };
  if (prediction === 'negative' && ctResult === 'ruled_out') return { status: 'match', icon: '✓', color: 'text-emerald-400' };
  return { status: 'mismatch', icon: '✗', color: 'text-red-400' };
};

const getDateOnly = (timestamp) => timestamp.split(' ')[0];

const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${className}`}>
    {children}
  </div>
);

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (username === 'research' && password === 'igfap2025') {
      onLogin(true);
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 flex items-center justify-center p-6">
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30 border border-white/20">
              <span className="text-white font-bold text-2xl">i</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white">iGFAP Research Portal</h1>
          <p className="text-white/50 mt-2">CT Befund Entry System</p>
        </div>

        <GlassCard className="rounded-3xl p-8">
          <div className="space-y-5">
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-white/70 text-sm font-medium mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-400 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/25 border border-white/10 cursor-pointer"
            >
              Login
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-white/[0.05] text-center">
            <p className="text-white/30 text-xs">Demo: research / igfap2025</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

const SettingsPanel = ({ settings, setSettings, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
      <GlassCard className="rounded-3xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl transition-colors">&times;</button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-white/80 font-medium mb-3">Prediction Cutoff Threshold</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="50"
                max="90"
                value={settings.cutoff}
                onChange={(e) => setSettings({ ...settings, cutoff: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
              <div className="w-16 px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-lg text-center">
                <span className="text-white font-bold">{settings.cutoff}%</span>
              </div>
            </div>
            <p className="text-white/40 text-sm mt-2">≥{settings.cutoff}% = Positive, &lt;{settings.cutoff}% = Negative</p>
          </div>

          <div>
            <label className="block text-white/80 font-medium mb-3">Display Options</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.showTimestamp}
                  onChange={(e) => setSettings({ ...settings, showTimestamp: e.target.checked })}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-violet-500 focus:ring-violet-500/50"
                />
                <span className="text-white/70 group-hover:text-white transition-colors">Show date on scoreboard</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.showRettungswache}
                  onChange={(e) => setSettings({ ...settings, showRettungswache: e.target.checked })}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-violet-500 focus:ring-violet-500/50"
                />
                <span className="text-white/70 group-hover:text-white transition-colors">Show Rettungswache on scoreboard</span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.05]">
            <label className="block text-red-400/80 font-medium mb-3">Danger Zone</label>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset all CT results?')) {
                  setSettings({ ...settings, resetResults: true });
                  onClose();
                }
              }}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
            >
              Reset All Results
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-white/[0.05] bg-white/[0.02]">
          <button onClick={onClose} className="w-full py-3 bg-violet-500 text-white font-semibold rounded-xl hover:bg-violet-400 transition-colors">
            Save & Close
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

const ResearchPortal = ({ cases, setCases, results, setResults, selectedCase, setSelectedCase, settings, setSettings, onLogout }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAddCase, setShowAddCase] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newCase, setNewCase] = useState({ id: '', ichProb: 50, lvoProb: 50, rettungswache: '' });

  const selectedCaseData = cases.find(c => c.id === selectedCase);
  const cutoff = settings.cutoff;

  const handleResultChange = (caseId, type, value) => {
    setResults(prev => ({ ...prev, [caseId]: { ...prev[caseId], [type]: value } }));
  };

  const clearResult = (caseId) => {
    setResults(prev => {
      const newResults = { ...prev };
      delete newResults[caseId];
      return newResults;
    });
  };

  const handleAddCase = () => {
    if (!newCase.id.trim()) return;
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    setCases(prev => [...prev, {
      id: newCase.id.trim().toUpperCase(),
      timestamp,
      rettungswache: newCase.rettungswache || 'Unknown',
      ichProb: newCase.ichProb,
      lvoProb: newCase.lvoProb
    }]);
    setNewCase({ id: '', ichProb: 50, lvoProb: 50, rettungswache: '' });
    setShowAddCase(false);
  };

  const handleEditCaseId = (oldId, newId) => {
    if (!newId.trim() || oldId === newId.trim().toUpperCase()) {
      setEditingCaseId(null);
      return;
    }
    const formattedNewId = newId.trim().toUpperCase();
    setCases(prev => prev.map(c => c.id === oldId ? { ...c, id: formattedNewId } : c));
    if (results[oldId]) {
      setResults(prev => {
        const newResults = { ...prev };
        newResults[formattedNewId] = newResults[oldId];
        delete newResults[oldId];
        return newResults;
      });
    }
    if (selectedCase === oldId) setSelectedCase(formattedNewId);
    setEditingCaseId(null);
  };

  const handleDeleteCase = (caseId) => {
    if (!confirm(`Delete case ${caseId}?`)) return;
    setCases(prev => prev.filter(c => c.id !== caseId));
    setResults(prev => {
      const newResults = { ...prev };
      delete newResults[caseId];
      return newResults;
    });
    if (selectedCase === caseId) setSelectedCase(null);
  };

  const handleUpdateProbs = (caseId, field, value) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, [field]: parseInt(value) || 0 } : c));
  };

  const stats = cases.reduce((acc, c) => {
    const r = results[c.id] || {};
    if (r.ich) {
      acc.total++;
      const ichMatch = calculateMatch(c.ichProb, r.ich, cutoff);
      if (ichMatch.status === 'match') acc.correct++;
    }
    if (r.lvo) {
      acc.total++;
      const lvoMatch = calculateMatch(c.lvoProb, r.lvo, cutoff);
      if (lvoMatch.status === 'match') acc.correct++;
    }
    return acc;
  }, { total: 0, correct: 0 });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 pt-16">
      <div className="fixed top-0 right-1/4 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="fixed bottom-0 left-1/4 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none"></div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          setSettings={(newSettings) => {
            if (newSettings.resetResults) {
              setResults({});
              setSettings({ ...settings, resetResults: false });
            } else {
              setSettings(newSettings);
            }
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAddCase && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <GlassCard className="rounded-3xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Add New Case</h2>
              <button onClick={() => setShowAddCase(false)} className="text-white/50 hover:text-white text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">Case ID *</label>
                <input
                  type="text"
                  value={newCase.id}
                  onChange={(e) => setNewCase({ ...newCase, id: e.target.value })}
                  placeholder="e.g., DRKLB018"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">Rettungswache</label>
                <input
                  type="text"
                  value={newCase.rettungswache}
                  onChange={(e) => setNewCase({ ...newCase, rettungswache: e.target.value })}
                  placeholder="e.g., DRK Ludwigsburg"
                  className="w-full px-4 py-3 bg-slate-800 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">ICH Probability: {newCase.ichProb}%</label>
                <input
                  type="range" min="0" max="100" value={newCase.ichProb}
                  onChange={(e) => setNewCase({ ...newCase, ichProb: parseInt(e.target.value) })}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">LVO Probability: {newCase.lvoProb}%</label>
                <input
                  type="range" min="0" max="100" value={newCase.lvoProb}
                  onChange={(e) => setNewCase({ ...newCase, lvoProb: parseInt(e.target.value) })}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>

            <div className="p-5 border-t border-white/[0.05] bg-white/[0.02] flex gap-3">
              <button onClick={() => setShowAddCase(false)} className="flex-1 py-3 bg-white/[0.05] border border-white/[0.1] text-white/70 font-semibold rounded-xl hover:bg-white/[0.1] transition-colors">Cancel</button>
              <button onClick={handleAddCase} disabled={!newCase.id.trim()} className="flex-1 py-3 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50">Add Case</button>
            </div>
          </GlassCard>
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center border border-white/20">
              <span className="text-white font-bold text-lg">i</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">iGFAP Research Portal</h1>
              <p className="text-white/40 text-sm">CT Befund Entry System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm">Cutoff: {cutoff}%</div>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button onClick={onLogout} className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-colors text-sm">Logout</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <GlassCard className="xl:col-span-3 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Cases</h2>
                <p className="text-white/40 text-sm mt-1">{cases.filter(c => !results[c.id]?.ich || !results[c.id]?.lvo).length} pending</p>
              </div>
              <button onClick={() => setShowAddCase(true)} className="px-4 py-2 bg-emerald-500/90 text-white rounded-xl hover:bg-emerald-400 transition-colors text-sm font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/20 border border-white/10">
                <span>+</span> Add Case
              </button>
            </div>
            <div className="divide-y divide-white/[0.03] max-h-[600px] overflow-y-auto">
              {cases.map(c => {
                const r = results[c.id] || {};
                const ichColor = getConfidenceColor(c.ichProb, cutoff);
                const lvoColor = getConfidenceColor(c.lvoProb, cutoff);
                const ichMatch = calculateMatch(c.ichProb, r.ich || null, cutoff);
                const lvoMatch = calculateMatch(c.lvoProb, r.lvo || null, cutoff);
                const isSelected = selectedCase === c.id;
                const isEditing = editingCaseId === c.id;

                return (
                  <div key={c.id} onClick={() => !isEditing && setSelectedCase(c.id)} className={`p-4 cursor-pointer transition-all ${isSelected ? 'bg-violet-500/10 border-l-2 border-l-violet-500' : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          {isEditing ? (
                            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleEditCaseId(c.id, editValue)} onKeyDown={(e) => e.key === 'Enter' && handleEditCaseId(c.id, editValue)} onClick={(e) => e.stopPropagation()} autoFocus className="font-mono font-semibold text-white bg-white/10 border border-violet-500 rounded px-2 py-1 w-32 focus:outline-none" />
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-white">{c.id}</span>
                              <button onClick={(e) => { e.stopPropagation(); setEditingCaseId(c.id); setEditValue(c.id); }} className="p-1 text-white/30 hover:text-violet-400 hover:bg-violet-500/10 rounded transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                          )}
                          <div className="text-white/30 text-xs">{c.timestamp}</div>
                          <div className="text-white/20 text-xs">{c.rettungswache}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-white/30 text-xs w-8">ICH</span>
                          <div className={`w-14 h-7 rounded-lg bg-gradient-to-r ${ichColor.bg} flex items-center justify-center shadow-lg border border-white/10`}>
                            <span className="text-white font-bold text-xs">{c.ichProb}%</span>
                          </div>
                          <span className={`text-lg w-6 ${ichMatch.color}`}>{ichMatch.icon}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-white/30 text-xs w-8">LVO</span>
                          <div className={`w-14 h-7 rounded-lg bg-gradient-to-r ${lvoColor.bg} flex items-center justify-center shadow-lg border border-white/10`}>
                            <span className="text-white font-bold text-xs">{c.lvoProb}%</span>
                          </div>
                          <span className={`text-lg w-6 ${lvoMatch.color}`}>{lvoMatch.icon}</span>
                        </div>

                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${r.ich && r.lvo ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20'}`}>
                          {r.ich && r.lvo ? 'Complete' : 'Pending'}
                        </div>

                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCase(c.id); }} className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="rounded-2xl p-5 h-fit sticky top-20">
            <h2 className="text-lg font-semibold text-white mb-4">CT Befund</h2>

            {selectedCaseData ? (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20">
                  <div className="font-mono text-xl font-bold text-white">{selectedCaseData.id}</div>
                  <div className="text-white/40 text-sm mt-1">{selectedCaseData.timestamp}</div>
                  <div className="text-white/30 text-xs mt-1">{selectedCaseData.rettungswache}</div>
                </div>

                <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">ICH</span>
                    <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getConfidenceColor(selectedCaseData.ichProb, cutoff).bg} border border-white/10`}>
                      <span className="text-white text-sm font-bold">{selectedCaseData.ichProb}%</span>
                    </div>
                  </div>
                  <input type="range" min="0" max="100" value={selectedCaseData.ichProb} onChange={(e) => handleUpdateProbs(selectedCaseData.id, 'ichProb', e.target.value)} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'ich', 'confirmed')} className={`py-3 rounded-xl font-medium transition-all cursor-pointer border ${results[selectedCaseData.id]?.ich === 'confirmed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border-emerald-400/50' : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1] border-white/[0.1]'}`}>✓ Confirmed</button>
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'ich', 'ruled_out')} className={`py-3 rounded-xl font-medium transition-all cursor-pointer border ${results[selectedCaseData.id]?.ich === 'ruled_out' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 border-red-400/50' : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1] border-white/[0.1]'}`}>✗ Ruled Out</button>
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">LVO</span>
                    <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${getConfidenceColor(selectedCaseData.lvoProb, cutoff).bg} border border-white/10`}>
                      <span className="text-white text-sm font-bold">{selectedCaseData.lvoProb}%</span>
                    </div>
                  </div>
                  <input type="range" min="0" max="100" value={selectedCaseData.lvoProb} onChange={(e) => handleUpdateProbs(selectedCaseData.id, 'lvoProb', e.target.value)} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'lvo', 'confirmed')} className={`py-3 rounded-xl font-medium transition-all cursor-pointer border ${results[selectedCaseData.id]?.lvo === 'confirmed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border-emerald-400/50' : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1] border-white/[0.1]'}`}>✓ Confirmed</button>
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'lvo', 'ruled_out')} className={`py-3 rounded-xl font-medium transition-all cursor-pointer border ${results[selectedCaseData.id]?.lvo === 'ruled_out' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 border-red-400/50' : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1] border-white/[0.1]'}`}>✗ Ruled Out</button>
                  </div>
                </div>

                {(results[selectedCaseData.id]?.ich || results[selectedCaseData.id]?.lvo) && (
                  <button type="button" onClick={() => clearResult(selectedCaseData.id)} className="w-full py-2 text-white/40 hover:text-red-400 text-sm transition-colors">Clear this case</button>
                )}

                <div className="pt-5 border-t border-white/[0.05]">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{stats.total > 0 ? `${Math.round(stats.correct/stats.total*100)}%` : '—'}</div>
                    <div className="text-white/40 text-sm">Overall Accuracy</div>
                    <div className="text-white/30 text-xs">{stats.correct}/{stats.total} predictions</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-white/30">
                <div className="w-16 h-16 rounded-full bg-white/[0.05] flex items-center justify-center mb-4"><span className="text-2xl">←</span></div>
                <p className="text-center">Select a case to enter CT results</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

const RettungsdienstScoreboard = ({ cases, results, settings }) => {
  const cutoff = settings.cutoff;

  const getCaseOverallStatus = (c) => {
    const r = results[c.id] || {};
    const ichMatch = calculateMatch(c.ichProb, r.ich || null, cutoff);
    const lvoMatch = calculateMatch(c.lvoProb, r.lvo || null, cutoff);

    if (ichMatch.status === 'pending' || lvoMatch.status === 'pending') return { bg: 'bg-white', shadow: 'shadow-white/50', status: 'pending' };
    if (ichMatch.status === 'mismatch' || lvoMatch.status === 'mismatch') return { bg: 'bg-red-500', shadow: 'shadow-red-500/50', status: 'mismatch' };
    return { bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/50', status: 'match' };
  };

  const stats = cases.reduce((acc, c) => {
    const r = results[c.id] || {};
    const ichMatch = calculateMatch(c.ichProb, r.ich || null, cutoff);
    const lvoMatch = calculateMatch(c.lvoProb, r.lvo || null, cutoff);
    if (r.ich && r.lvo) {
      acc.totalCases++;
      if (ichMatch.status === 'match' && lvoMatch.status === 'match') acc.correctCases++;
    }
    return acc;
  }, { totalCases: 0, correctCases: 0 });

  const accuracy = stats.totalCases > 0 ? Math.round(stats.correctCases/stats.totalCases*100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-6 pt-16">
      <div className="fixed top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="fixed bottom-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 border border-white/20">
              <span className="text-white font-bold text-xl">i</span>
            </div>
            <h1 className="text-3xl font-bold text-white">iGFAP Scoreboard</h1>
          </div>
          <p className="text-white/40">Vorhersage-Feedback</p>
        </div>

        <GlassCard className="rounded-3xl p-8 mb-6">
          <div className="text-center">
            <div className="text-7xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{accuracy}%</div>
            <div className="text-white/50 text-lg mt-2">Gesamtgenauigkeit</div>
            <div className="flex justify-center gap-8 mt-6">
              <div className="text-center"><div className="text-2xl font-bold text-emerald-400">{stats.correctCases}</div><div className="text-white/40 text-sm">Korrekt</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-white/60">{stats.totalCases}</div><div className="text-white/40 text-sm">Ausgewertet</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-cyan-400">{cases.length}</div><div className="text-white/40 text-sm">Gesamt</div></div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Ihre Einsätze</h2>
            <div className="flex items-center gap-3 text-xs text-white/40"><span>App</span><span>CT</span></div>
          </div>

          <div className="divide-y divide-white/[0.03]">
            {cases.map(c => {
              const ctStatus = getCaseOverallStatus(c);
              return (
                <div key={c.id} className="p-5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-white text-lg">{c.id}</div>
                      {settings.showTimestamp && <div className="text-white/30 text-sm">{getDateOnly(c.timestamp)}</div>}
                      {settings.showRettungswache && <div className="text-white/20 text-xs">{c.rettungswache}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 border border-white/20"></div>
                      <div className={`w-6 h-6 rounded-full ${ctStatus.bg} shadow-lg ${ctStatus.shadow} border border-white/20`}></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="mt-6 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Legende</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 border border-white/20"></div>
                <div className="w-6 h-6 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 border border-white/20"></div>
              </div>
              <span className="text-white/60 text-sm">App-Vorhersage korrekt</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 border border-white/20"></div>
                <div className="w-6 h-6 rounded-full bg-red-500 shadow-lg shadow-red-500/50 border border-white/20"></div>
              </div>
              <span className="text-white/60 text-sm">App-Vorhersage inkorrekt</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50 border border-white/20"></div>
                <div className="w-6 h-6 rounded-full bg-white shadow-lg shadow-white/50 border border-white/20"></div>
              </div>
              <span className="text-white/60 text-sm">CT-Ergebnis ausstehend</span>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('research');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cases, setCases] = useState([
    { id: 'DRKLB013', timestamp: '2025-01-13 08:32', rettungswache: 'DRK Ludwigsburg', ichProb: 78, lvoProb: 34 },
    { id: 'DRKLB014', timestamp: '2025-01-13 11:15', rettungswache: 'DRK Ludwigsburg', ichProb: 45, lvoProb: 82 },
    { id: 'DRKLB015', timestamp: '2025-01-13 14:22', rettungswache: 'DRK Ludwigsburg', ichProb: 62, lvoProb: 58 },
    { id: 'DRKLB016', timestamp: '2025-01-12 19:45', rettungswache: 'DRK Ludwigsburg', ichProb: 23, lvoProb: 91 },
    { id: 'BRKM087', timestamp: '2025-01-12 22:10', rettungswache: 'BRK München', ichProb: 88, lvoProb: 15 },
    { id: 'BRKM088', timestamp: '2025-01-11 06:33', rettungswache: 'BRK München', ichProb: 31, lvoProb: 28 },
    { id: 'BRKM089', timestamp: '2025-01-10 15:20', rettungswache: 'BRK München', ichProb: 94, lvoProb: 67 },
    { id: 'DRKLB017', timestamp: '2025-01-10 03:45', rettungswache: 'DRK Ludwigsburg', ichProb: 12, lvoProb: 73 },
  ]);
  const [results, setResults] = useState({
    'BRKM087': { ich: 'confirmed', lvo: 'ruled_out' },
    'BRKM088': { ich: 'ruled_out', lvo: 'ruled_out' },
    'BRKM089': { ich: 'confirmed', lvo: 'confirmed' },
  });
  const [selectedCase, setSelectedCase] = useState(null);
  const [settings, setSettings] = useState({ cutoff: 65, showTimestamp: true, showRettungswache: false });

  if (view === 'research' && !isLoggedIn) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50 flex bg-white/[0.05] backdrop-blur-xl rounded-full p-1 border border-white/[0.1] shadow-lg">
          <button onClick={() => setView('research')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${view === 'research' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30' : 'text-white/50 hover:text-white'}`}>Research Portal</button>
          <button onClick={() => setView('scoreboard')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${view === 'scoreboard' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-white/50 hover:text-white'}`}>RD Scoreboard</button>
        </div>
        <LoginScreen onLogin={setIsLoggedIn} />
      </>
    );
  }

  return (
    <div>
      <div className="fixed top-4 right-4 z-50 flex bg-white/[0.05] backdrop-blur-xl rounded-full p-1 border border-white/[0.1] shadow-lg">
        <button onClick={() => setView('research')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${view === 'research' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30' : 'text-white/50 hover:text-white'}`}>Research Portal</button>
        <button onClick={() => setView('scoreboard')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${view === 'scoreboard' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-white/50 hover:text-white'}`}>RD Scoreboard</button>
      </div>

      {view === 'research' ? (
        <ResearchPortal cases={cases} setCases={setCases} results={results} setResults={setResults} selectedCase={selectedCase} setSelectedCase={setSelectedCase} settings={settings} setSettings={setSettings} onLogout={() => setIsLoggedIn(false)} />
      ) : (
        <RettungsdienstScoreboard cases={cases} results={results} settings={settings} />
      )}
    </div>
  );
}
