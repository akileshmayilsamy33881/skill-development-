import React, { useState, useEffect } from 'react';

export default function App() {
  const [learner, setLearner] = useState(null);
  const [roles, setRoles] = useState([]);
  const [gapAnalysis, setGapAnalysis] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mentorHistory, setMentorHistory] = useState([]);
  const [mentorInput, setMentorInput] = useState('');
  const [agentTraces, setAgentTraces] = useState([]);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('');
  const [jsonModalData, setJsonModalData] = useState(null);

  // Modals
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState(null);

  // Assessment state
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [selectedSkillId, setSelectedSkillId] = useState('javascript');
  const [quizAnswers, setQuizAnswers] = useState({});

  // New Skill form state
  const [newSkillId, setNewSkillId] = useState('html_css');
  const [newSkillProf, setNewSkillProf] = useState(3);
  const [newSkillEvidence, setNewSkillEvidence] = useState('');

  // Fetch all initial data
  const loadAllData = async () => {
    try {
      const [lRes, rRes, gRes, roadRes, mRes, tRes] = await Promise.all([
        fetch('/api/learner').then(r => r.json()),
        fetch('/api/roles').then(r => r.json()),
        fetch('/api/gap-analysis').then(r => r.json()),
        fetch('/api/roadmap').then(r => r.json()),
        fetch('/api/mentor/history').then(r => r.json()),
        fetch('/api/agents/traces?limit=50').then(r => r.json())
      ]);
      setLearner(lRes);
      setRoles(rRes);
      setGapAnalysis(gRes);
      setRoadmap(roadRes);
      setMentorHistory(mRes);
      setAgentTraces(tRes);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Load assessment when switching to assessment tab
  useEffect(() => {
    if (activeTab === 'assessment') {
      loadAssessment(selectedSkillId);
    }
  }, [activeTab, selectedSkillId]);

  const loadAssessment = async (skillId) => {
    try {
      const res = await fetch(`/api/assessments/${skillId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentAssessment(data);
        setQuizAnswers({});
      }
    } catch (e) {
      console.error('Failed to load assessment:', e);
    }
  };

  // Demo presets
  const triggerScenario = async (scenarioName) => {
    try {
      await fetch('/api/demo/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioName })
      });
      await loadAllData();

      if (scenarioName === 'simulate_fail_js' || scenarioName === 'simulate_pass_js') {
        setActiveTab('roadmap');
      } else if (scenarioName === 'switch_data_analyst' || scenarioName === 'switch_full_stack') {
        setActiveTab('gap-analysis');
      } else {
        setActiveTab('dashboard');
      }
    } catch (e) {
      alert('Error triggering scenario: ' + e.message);
    }
  };

  // Role Switch
  const switchTargetRole = async (roleId) => {
    setShowRoleModal(false);
    try {
      await fetch('/api/learner/target-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_id: roleId })
      });
      await loadAllData();
    } catch (e) {
      alert('Failed to switch role: ' + e.message);
    }
  };

  // Save profile
  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/learner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(learner)
      });
      await loadAllData();
      alert('Profile saved and pipeline re-run!');
    } catch (e) {
      alert('Failed to save profile: ' + e.message);
    }
  };

  // Add skill
  const handleAddSkill = async () => {
    try {
      await fetch('/api/learner/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skill_id: newSkillId,
          self_proficiency: parseFloat(newSkillProf),
          evidence: newSkillEvidence || 'Learner reported skill'
        })
      });
      setShowAddSkillModal(false);
      setNewSkillEvidence('');
      await loadAllData();
    } catch (e) {
      alert('Failed to add skill: ' + e.message);
    }
  };

  // Toggle roadmap item status
  const toggleRoadmapItem = async (itemId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'in_progress' : 'completed';
    try {
      await fetch('/api/roadmap/item/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, status: newStatus })
      });
      await loadAllData();
    } catch (e) {
      console.error(e);
    }
  };

  // Submit Quiz
  const handleQuizSubmit = async () => {
    if (!currentAssessment) return;
    try {
      const res = await fetch(`/api/assessments/${currentAssessment.skill_id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: quizAnswers })
      });
      const data = await res.json();
      setAssessmentResult(data.evaluation);
      setShowResultModal(true);
      await loadAllData();
    } catch (e) {
      alert('Failed to submit quiz: ' + e.message);
    }
  };

  // Send mentor message
  const handleSendMentor = async (msgText) => {
    const text = msgText || mentorInput;
    if (!text.trim()) return;
    setMentorInput('');

    // Optimistic UI
    setMentorHistory(prev => [...prev, { sender: 'learner', message: text }]);

    try {
      await fetch('/api/mentor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const updated = await fetch('/api/mentor/history').then(r => r.json());
      setMentorHistory(updated);
    } catch (e) {
      console.error('Mentor failed:', e);
    }
  };

  const roleTitle = gapAnalysis?.target_role?.title || learner?.target_role || 'Full Stack Developer';
  const readiness = gapAnalysis?.readiness_percentage ?? 0;
  const isRemedialActive = roadmap?.items?.some(i => i.status === 'remedial_required' || i.is_remedial);
  const lockedItems = roadmap?.items?.filter(i => i.status === 'locked') || [];

  return (
    <div>
      {/* 1. DEMO CONTROL BAR */}
      <aside className="demo-bar">
        <div className="demo-title">
          <span>🏆 Hackathon Demo Presets</span>
        </div>
        <div className="demo-btn-group">
          <button className="btn-demo" onClick={() => triggerScenario('load_sample')}>
            <span>1. 👤 Load Sample Scenario</span>
          </button>
          <button className="btn-demo" onClick={() => triggerScenario('simulate_fail_js')}>
            <span>2. ⚠️ Fail JS (&lt;50%) [Adaptive Hold]</span>
          </button>
          <button className="btn-demo" onClick={() => triggerScenario('simulate_pass_js')}>
            <span>3. ✅ Pass JS (100%) [Unlock]</span>
          </button>
          <button className="btn-demo" onClick={() => triggerScenario('switch_data_analyst')}>
            <span>4. 🔄 Switch: Data Analyst</span>
          </button>
          <button className="btn-demo" onClick={() => triggerScenario('switch_full_stack')}>
            <span>5. 🔄 Switch: Full Stack</span>
          </button>
          <button className="btn-demo danger" onClick={() => triggerScenario('reset')}>
            <span>🔁 Reset DB</span>
          </button>
        </div>
      </aside>

      {/* 2. APP HEADER */}
      <header className="app-header">
        <div className="logo-area">
          <div className="logo-icon">⚡</div>
          <div className="logo-text">
            <h1>SkillPath AI</h1>
            <p>React + Vite Architecture · Multi-Agent Orchestration</p>
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-pill" style={{ cursor: 'pointer' }} onClick={() => setShowRoleModal(true)}>
            <span style={{ color: 'var(--text-muted)' }}>Target:</span>
            <strong>{roleTitle}</strong>
            <span className="badge badge-primary" style={{ fontSize: '0.68rem', marginLeft: '4px' }}>Change ▾</span>
          </div>

          <div className="stat-pill">
            <span style={{ color: 'var(--text-muted)' }}>Career Readiness:</span>
            <strong>{readiness}%</strong>
          </div>

          <div className="stat-pill">
            <span style={{ color: 'var(--text-muted)' }}>Weekly Pace:</span>
            <strong>{learner?.weekly_hours || 12} hrs/wk</strong>
          </div>
        </div>
      </header>

      {/* 3. TABS NAVIGATION */}
      <nav className="tabs-nav">
        {[
          { id: 'dashboard', label: '📊 Dashboard' },
          { id: 'profile', label: '👤 Profile & Evidence' },
          { id: 'gap-analysis', label: '🎯 Career Match & Gaps' },
          { id: 'roadmap', label: '🗺️ Learning Roadmap' },
          { id: 'assessment', label: '📝 Skill Assessment' },
          { id: 'mentor', label: '🤖 AI Mentor' },
          { id: 'inspector', label: '🔬 Agent Inspector' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 4. MAIN CONTENT */}
      <main className="main-content">
        {/* Dynamic Adaptation Banner */}
        {isRemedialActive ? (
          <div className="adaptation-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="pulse-indicator" />
              <div>
                <strong style={{ color: '#fbbf24' }}>Adaptive Plan Revision Active</strong>
                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '2px' }}>
                  Assessment results triggered targeted remedial practice for JavaScript. Downstream module ({lockedItems.map(i => i.skill_name).join(', ') || 'React'}) is safely held back until mastery threshold (≥65%) is verified.
                </p>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setActiveTab('roadmap')}>
              View Adapted Roadmap →
            </button>
          </div>
        ) : learner?.target_role === 'data_analyst' ? (
          <div className="adaptation-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="pulse-indicator" />
              <div>
                <strong style={{ color: '#60a5fa' }}>Target Career Goal: Data Analyst Calibrated</strong>
                <p style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: '2px' }}>
                  Roadmap re-sequenced for Data Analyst: Python & SQL prioritized; frontend web technologies removed.
                </p>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => setActiveTab('gap-analysis')}>
              View Gap Analysis →
            </button>
          </div>
        ) : null}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">🎯 Target Career Goal</div>
                  <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setShowRoleModal(true)}>
                    Switch Goal
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{roleTitle}</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {gapAnalysis?.target_role?.description || 'Builds scalable modern systems.'}
                    </p>
                  </div>
                  <span className={`badge ${readiness >= 70 ? 'badge-success' : readiness >= 40 ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                    {readiness}% Readiness
                  </span>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span>Role Competency Progress</span>
                    <span>{readiness}%</span>
                  </div>
                  <div className="progress-bar-wrap">
                    <div
                      className={`progress-bar-fill ${readiness >= 70 ? 'success' : readiness >= 40 ? 'primary' : 'warning'}`}
                      style={{ width: `${readiness}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Active Learning Step */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">⚡ Active Learning Focus</div>
                  <span className={`badge ${isRemedialActive ? 'badge-warning' : 'badge-primary'}`}>
                    {isRemedialActive ? 'Priority Remedial' : 'In Progress'}
                  </span>
                </div>
                {roadmap?.items?.[0] && (
                  <div>
                    <h3 style={{ fontSize: '1.2rem', color: '#a5b4fc', fontWeight: 700 }}>
                      {roadmap.items[0].skill_name}
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: '#d1d5db', margin: '8px 0 16px 0' }}>
                      {roadmap.items[0].notes || roadmap.items[0].hold_reason}
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn btn-success" onClick={() => setActiveTab('roadmap')}>
                        Continue Activity →
                      </button>
                      <button className="btn btn-secondary" onClick={() => { setSelectedSkillId(roadmap.items[0].skill_id); setActiveTab('assessment'); }}>
                        Assess Skill Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid-4" style={{ marginBottom: '24px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified Skills</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                  {learner?.skills?.filter(s => s.verified_proficiency >= 2.5 && s.confidence >= 0.6).length || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>Supported by objective tests</div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Skill Gaps Remaining</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                  {gapAnalysis?.gaps?.filter(g => g.gap_score > 0).length || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>Role requirements unmet</div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Estimated Effort</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>
                  {Math.round(roadmap?.total_hours || 0)} hrs
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  ~{Math.round((roadmap?.total_hours || 0) / (learner?.weekly_hours || 12) * 10) / 10} weeks at {learner?.weekly_hours || 12} hrs/wk
                </div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Active Holds / Remedial</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                  {roadmap?.items?.filter(i => i.status === 'locked' || i.status === 'remedial_required').length || 0}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>Prerequisite safety holds</div>
              </div>
            </div>

            {/* Agent Activity Stream */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">🤖 Recent Agent Reasoning & Orchestration</div>
                <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={() => setActiveTab('inspector')}>
                  Open Pipeline Inspector
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {agentTraces.slice(0, 5).map(t => (
                  <div key={t.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{t.agent_name}</span>
                      <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>{t.explanation}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      {new Date(t.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PROFILE & EVIDENCE */}
        {activeTab === 'profile' && learner && (
          <div>
            <div className="grid-2" style={{ marginBottom: '24px' }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">👤 Learner Identity & Goals</div>
                  <button className="btn btn-primary" onClick={saveProfile}>Save Profile</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Full Name</label>
                    <input
                      type="text"
                      className="chat-input"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={learner.name || ''}
                      onChange={e => setLearner({ ...learner, name: e.target.value })}
                    />
                  </div>
                  <div className="grid-2" style={{ gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Weekly Study Hours</label>
                      <input
                        type="number"
                        className="chat-input"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={learner.weekly_hours || 12}
                        onChange={e => setLearner({ ...learner, weekly_hours: parseInt(e.target.value) || 10 })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Career Goal</label>
                      <select
                        className="chat-input"
                        style={{ width: '100%', marginTop: '4px' }}
                        value={learner.target_role}
                        onChange={e => switchTargetRole(e.target.value)}
                      >
                        {roles.map(r => (
                          <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Bio & Background</label>
                    <textarea
                      className="chat-input"
                      rows="3"
                      style={{ width: '100%', marginTop: '4px', resize: 'vertical' }}
                      value={learner.bio || ''}
                      onChange={e => setLearner({ ...learner, bio: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">📜 Certifications & Evidence Portfolio</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Certifications</label>
                    <textarea
                      className="chat-input"
                      rows="2"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={learner.certifications || ''}
                      onChange={e => setLearner({ ...learner, certifications: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Projects Portfolio</label>
                    <textarea
                      className="chat-input"
                      rows="2"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={learner.projects || ''}
                      onChange={e => setLearner({ ...learner, projects: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Interests</label>
                    <input
                      type="text"
                      className="chat-input"
                      style={{ width: '100%', marginTop: '4px' }}
                      value={learner.interests || ''}
                      onChange={e => setLearner({ ...learner, interests: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Skills Table */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">💼 Current Skills & Evidence Confidence</div>
                <button className="btn btn-secondary" onClick={() => setShowAddSkillModal(true)}>+ Add / Claim Skill</button>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Note: SkillPath AI discounts unverified self-ratings until supported by practical projects or assessment tests.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Category</th>
                      <th>Self Rating</th>
                      <th>Verified Level</th>
                      <th>Confidence & Uncertainty</th>
                      <th>Evidence Record</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(learner.skills || []).map(s => {
                      const confPct = Math.round((s.confidence || 0) * 100);
                      const uncertPct = 100 - confPct;
                      return (
                        <tr key={s.skill_id}>
                          <td><strong>{s.skill_name}</strong></td>
                          <td><span className="badge badge-neutral">{s.category}</span></td>
                          <td>{s.self_proficiency > 0 ? `${s.self_proficiency}/5` : 'None'}</td>
                          <td>
                            <strong style={{ color: s.verified_proficiency > 0 ? '#10b981' : 'var(--text-dim)' }}>
                              {s.verified_proficiency > 0 ? `${s.verified_proficiency}/5` : 'Unassessed'}
                            </strong>
                          </td>
                          <td style={{ minWidth: '140px' }}>
                            <div style={{ fontSize: '0.78rem', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Confidence: {confPct}%</span>
                              <span style={{ color: 'var(--text-dim)' }}>Uncert: {uncertPct}%</span>
                            </div>
                            <div className="progress-bar-wrap" style={{ height: '6px' }}>
                              <div
                                className={`progress-bar-fill ${confPct >= 70 ? 'success' : confPct >= 40 ? 'primary' : 'warning'}`}
                                style={{ width: `${confPct}%` }}
                              />
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${confPct >= 70 ? 'badge-success' : confPct >= 40 ? 'badge-primary' : 'badge-warning'}`} style={{ fontSize: '0.68rem', marginBottom: '4px' }}>
                              {confPct >= 70 ? 'Verified' : confPct >= 40 ? 'Project Evidence' : 'Unverified Claim'}
                            </span>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{s.evidence || 'No evidence provided'}</div>
                          </td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                              onClick={() => { setSelectedSkillId(s.skill_id); setActiveTab('assessment'); }}
                            >
                              Assess Skill
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAREER MATCH & GAP ANALYSIS */}
        {activeTab === 'gap-analysis' && gapAnalysis && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">🎯 Gap Analysis: Target Role Requirements vs Current Evidence</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Target Role: <strong>{roleTitle}</strong> | Formula: <code>gap = role_required_level - learner_estimated_level</code>
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowRoleModal(true)}>Switch Target Role</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Required Skill</th>
                    <th>Category</th>
                    <th>Target Level</th>
                    <th>Learner Level</th>
                    <th>Gap Score</th>
                    <th>Priority</th>
                    <th>Severity</th>
                    <th>Agent Rationale ("Why is this missing/required?")</th>
                    <th>Next Step</th>
                  </tr>
                </thead>
                <tbody>
                  {(gapAnalysis.gaps || []).map(g => {
                    const gapColor = g.gap_score >= 2.5 ? '#ef4444' : g.gap_score >= 1.0 ? '#f59e0b' : g.gap_score > 0 ? '#6366f1' : '#10b981';
                    return (
                      <tr key={g.skill_id}>
                        <td><strong>{g.skill_name}</strong></td>
                        <td><span className="badge badge-neutral">{g.category}</span></td>
                        <td><strong>{g.required_level}/5</strong></td>
                        <td>{g.learner_estimated_level}/5</td>
                        <td><strong style={{ color: gapColor, fontSize: '1rem' }}>{g.gap_score}</strong></td>
                        <td>
                          <span className={`badge ${g.priority === 'must_have' ? 'badge-primary' : 'badge-neutral'}`}>
                            {g.priority.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${g.severity === 'critical' ? 'badge-danger' : g.severity === 'moderate' ? 'badge-warning' : 'badge-success'}`}>
                            {g.severity}
                          </span>
                        </td>
                        <td style={{ maxWidth: '320px', fontSize: '0.82rem', color: '#e2e8f0' }}>{g.rationale}</td>
                        <td style={{ maxWidth: '220px', fontSize: '0.8rem', color: '#a5b4fc' }}>{g.next_step}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: LEARNING ROADMAP */}
        {activeTab === 'roadmap' && roadmap && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">🗺️ Personalized Adaptive Roadmap</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Ordered by prerequisite dependencies and role priorities. Automatically injects remedial drills and holds downstream modules upon failure.
                </p>
              </div>
              <button className="btn btn-secondary" onClick={loadAllData}>⚡ Regenerate</button>
            </div>

            <div style={{ display: 'flex', gap: '20px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 18px', marginBottom: '20px' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Total Milestones:</span> <strong>{roadmap.items?.length || 0}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Estimated Effort:</span> <strong>{Math.round(roadmap.total_hours || 0)} hrs</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Held Back Modules:</span> <strong style={{ color: '#ef4444' }}>{lockedItems.length}</strong></div>
            </div>

            <div className="timeline">
              {(roadmap.items || []).map(item => {
                const isRemedial = item.status === 'remedial_required' || item.is_remedial;
                const isLocked = item.status === 'locked';
                const isCompleted = item.status === 'completed';
                const isInProgress = item.status === 'in_progress' || item.status === 'verify_evidence';

                let dotClass = 'ready';
                if (isCompleted) dotClass = 'completed';
                else if (isRemedial) dotClass = 'remedial_required';
                else if (isLocked) dotClass = 'locked';
                else if (isInProgress) dotClass = 'in_progress';

                return (
                  <div key={item.id} className="timeline-item">
                    <div className={`timeline-dot ${dotClass}`} />
                    <div className={`milestone-card ${isRemedial ? 'remedial' : isLocked ? 'locked' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dim)' }}>#{item.sequence}</span>
                          <h3 style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>{item.skill_name}</h3>
                          <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>{item.category || item.skill_category}</span>
                        </div>
                        <div>
                          {isRemedial && <span className="badge badge-warning">⚠️ Remedial Practice Required</span>}
                          {isLocked && <span className="badge badge-danger">🔒 Held Back (Prerequisite Gap)</span>}
                          {isCompleted && <span className="badge badge-success">✅ Completed / Mastered</span>}
                          {isInProgress && <span className="badge badge-primary">🚀 In Progress</span>}
                        </div>
                      </div>

                      {item.hold_reason && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px', fontSize: '0.82rem', color: '#fca5a5' }}>
                          <strong>Reason:</strong> {item.hold_reason}
                        </div>
                      )}

                      <p style={{ fontSize: '0.85rem', color: '#d1d5db', marginBottom: '10px' }}>
                        {item.notes || 'Master target competencies through guided practice.'}
                      </p>

                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Learning Resources:</div>
                        {(item.all_resources || []).map((r, rIdx) => (
                          <div key={rIdx} className="resource-pill">
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`badge ${r.type === 'remedial_drill' ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: '0.65rem' }}>
                                  {r.type.replace('_', ' ')}
                                </span>
                                <a href={r.url} target="_blank" rel="noreferrer" style={{ color: '#67e8f9', fontWeight: 600, textDecoration: 'none', fontSize: '0.88rem' }}>
                                  {r.title} ↗
                                </a>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>{r.description}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{r.estimated_hours} hrs</span>
                              <button
                                className="btn btn-secondary"
                                style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                                onClick={() => toggleRoadmapItem(item.id, item.status)}
                              >
                                {isCompleted ? 'Mark Undone' : 'Mark Done'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => { setSelectedSkillId(item.skill_id); setActiveTab('assessment'); }}
                        >
                          Take Assessment Quiz
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: SKILL ASSESSMENT STUDIO */}
        {activeTab === 'assessment' && (
          <div>
            <div className="grid-2" style={{ marginBottom: '20px' }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">📝 Assessment Selector</div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Objective quizzes evaluate true competency. Scores directly update verified proficiency and trigger adaptive holds or unlocks.
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    className="chat-input"
                    style={{ flexGrow: 1 }}
                    value={selectedSkillId}
                    onChange={e => setSelectedSkillId(e.target.value)}
                  >
                    <option value="javascript">JavaScript Core Competency</option>
                    <option value="html_css">HTML5 & Modern CSS Layout</option>
                    <option value="sql">SQL Querying & Relational Modeling</option>
                    <option value="python">Python Syntax & Core Idioms</option>
                    <option value="react">React Fundamentals & Hooks</option>
                  </select>
                  <button className="btn btn-primary" onClick={() => loadAssessment(selectedSkillId)}>Load Test</button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <div className="card-title">{currentAssessment?.title || 'Assessment Details'}</div>
                  <span className="badge badge-primary">Pass: {currentAssessment?.passing_score || 65}%</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db' }}>{currentAssessment?.description}</p>
              </div>
            </div>

            {/* Questions list */}
            <div>
              {currentAssessment?.questions?.map((q, idx) => (
                <div key={q.id} className="quiz-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>Question {idx + 1} of {currentAssessment.questions.length}</span>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{q.subtopic}</span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px' }}>{q.question}</div>
                  {q.code_snippet && (
                    <pre className="code-snippet"><code>{q.code_snippet}</code></pre>
                  )}
                  <div>
                    {q.options.map((opt, optIdx) => (
                      <label key={optIdx} className="quiz-option">
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          value={optIdx}
                          checked={quizAnswers[q.id] === optIdx}
                          onChange={() => setQuizAnswers({ ...quizAnswers, [q.id]: optIdx })}
                        />
                        <span style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'right', marginTop: '20px' }}>
              <button className="btn btn-success" style={{ fontSize: '1rem', padding: '10px 24px' }} onClick={handleQuizSubmit}>
                Submit Assessment for AI Evaluation ➔
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: AI MENTOR */}
        {activeTab === 'mentor' && (
          <div className="chat-window">
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                <div>
                  <strong style={{ fontSize: '0.95rem', color: '#fff' }}>SkillPath AI Mentor</strong>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Grounded in learner profile, role requirements & active roadmap</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>● Profile Connected</span>
                <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>● Roadmap Synced</span>
              </div>
            </div>

            <div className="chat-messages">
              {mentorHistory.map((m, idx) => (
                <div key={idx} className={`chat-bubble ${m.sender === 'learner' ? 'learner' : 'mentor'}`}>
                  <div dangerouslySetInnerHTML={{
                    __html: m.message
                      .replace(/### (.*?)\n/g, '<h3 style="color: #a5b4fc; margin-bottom: 6px;">$1</h3>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/`([^`]+)`/g, '<code>$1</code>')
                      .replace(/\n\n/g, '<br><br>')
                      .replace(/\n- /g, '<br>• ')
                  }} />
                </div>
              ))}
            </div>

            <div className="quick-prompts">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>Quick asks:</span>
              <button className="prompt-pill" onClick={() => handleSendMentor('Why is React locked in my plan?')}>Why is React locked?</button>
              <button className="prompt-pill" onClick={() => handleSendMentor('Why did my learning plan change?')}>Why did my plan change?</button>
              <button className="prompt-pill" onClick={() => handleSendMentor('How should I practice JavaScript functions and closures?')}>How to practice JS functions?</button>
              <button className="prompt-pill" onClick={() => handleSendMentor('What is my recommended next step?')}>What is my next step?</button>
              <button className="prompt-pill" onClick={() => handleSendMentor('What happens if I switch to Data Analyst?')}>Switch to Data Analyst?</button>
            </div>

            <div className="chat-input-row">
              <input
                type="text"
                className="chat-input"
                placeholder="Ask your AI mentor anything..."
                value={mentorInput}
                onChange={e => setMentorInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMentor()}
              />
              <button className="btn btn-primary" onClick={() => handleSendMentor()}>Send</button>
            </div>
          </div>
        )}

        {/* TAB 7: AGENT PIPELINE INSPECTOR */}
        {activeTab === 'inspector' && (
          <div>
            <div className="card" style={{ marginBottom: '24px' }}>
              <div className="card-header">
                <div>
                  <div className="card-title">🔬 Multi-Agent Pipeline Visualizer</div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Inspect each autonomous agent's inputs, structured outputs, and reasoning steps.
                  </p>
                </div>
                <button className="btn btn-primary" onClick={loadAllData}>Run Full Pipeline Now</button>
              </div>

              <div className="agent-flow">
                {[
                  { name: 'Profile Agent', desc: 'Evidence & Uncertainty' },
                  { name: 'Career Analyst Agent', desc: 'Gap Scoring & Role Matching' },
                  { name: 'Assessment Agent', desc: 'Diagnostics & Weak Area Flags' },
                  { name: 'Roadmap Agent', desc: 'Prerequisites & Adaptive Holds' },
                  { name: 'Mentor Agent', desc: 'Grounded Advisory & Guidance' }
                ].map((a, i) => (
                  <React.Fragment key={a.name}>
                    <div
                      className={`agent-node ${selectedAgentFilter === a.name ? 'active' : ''}`}
                      onClick={() => setSelectedAgentFilter(selectedAgentFilter === a.name ? '' : a.name)}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '4px' }}>{i + 1}. {a.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.desc}</div>
                    </div>
                    {i < 4 && <div style={{ color: 'var(--text-dim)', fontSize: '1.2rem' }}>➔</div>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div className="card-title">📜 Live Agent Trace Log</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time database audit log</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Action Step</th>
                      <th>Timestamp</th>
                      <th>Natural Language Explanation</th>
                      <th>Payloads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentTraces
                      .filter(t => !selectedAgentFilter || t.agent_name === selectedAgentFilter)
                      .map(t => (
                        <tr key={t.id}>
                          <td><span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>{t.agent_name}</span></td>
                          <td><code>{t.step}</code></td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                            {new Date(t.created_at).toLocaleTimeString()}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: '#e2e8f0', maxWidth: '320px' }}>{t.explanation}</td>
                          <td>
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                              onClick={() => setJsonModalData({ step: t.step, input: t.input, output: t.output })}
                            >
                              View JSON
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: ROLE SWITCHER */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>Switch Target Career Goal</h3>
              <button className="modal-close" onClick={() => setShowRoleModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {roles.map(r => (
                <div
                  key={r.id}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    background: learner?.target_role === r.id ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                    borderColor: learner?.target_role === r.id ? 'var(--primary)' : 'var(--border)'
                  }}
                  onClick={() => switchTargetRole(r.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong style={{ color: '#fff' }}>{r.title}</strong>
                    {learner?.target_role === r.id ? (
                      <span className="badge badge-success">Current Goal</span>
                    ) : (
                      <span className="badge badge-neutral">Select</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD SKILL */}
      {showAddSkillModal && (
        <div className="modal-overlay" onClick={() => setShowAddSkillModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>Add or Report Skill</h3>
              <button className="modal-close" onClick={() => setShowAddSkillModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select Skill</label>
                <select className="chat-input" style={{ width: '100%', marginTop: '4px' }} value={newSkillId} onChange={e => setNewSkillId(e.target.value)}>
                  <option value="html_css">HTML & CSS</option>
                  <option value="javascript">JavaScript Fundamentals</option>
                  <option value="react">React & Component Architecture</option>
                  <option value="nodejs">Node.js & Express REST APIs</option>
                  <option value="python">Python Programming</option>
                  <option value="sql">SQL & Relational Databases</option>
                  <option value="git">Git & Version Control</option>
                  <option value="docker">Docker & Containerization</option>
                  <option value="pandas">Pandas & Data Wrangling</option>
                  <option value="ml_basics">Machine Learning Fundamentals</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Self-Reported Proficiency: {newSkillProf}/5</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={newSkillProf}
                  style={{ width: '100%', accentColor: 'var(--primary)', marginTop: '6px' }}
                  onChange={e => setNewSkillProf(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Evidence / Verification Notes</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', marginTop: '4px' }}
                  placeholder="e.g. Completed college course; built CLI tool..."
                  value={newSkillEvidence}
                  onChange={e => setNewSkillEvidence(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setShowAddSkillModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleAddSkill}>Save & Analyze</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSESSMENT RESULTS */}
      {showResultModal && assessmentResult && (
        <div className="modal-overlay" onClick={() => setShowResultModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.2rem', color: '#fff' }}>{assessmentResult.skill_name} Results</h3>
              <button className="modal-close" onClick={() => setShowResultModal(false)}>✕</button>
            </div>
            <div style={{ textAlign: 'center', margin: '16px 0' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: assessmentResult.passed ? '#10b981' : '#ef4444' }}>
                {assessmentResult.score}%
              </div>
              <div className={`badge ${assessmentResult.passed ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                {assessmentResult.passed ? 'PASSED (Proficiency Verified)' : 'STRUGGLED (Remedial Action Triggered)'}
              </div>
            </div>
            <div className="card" style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.25)' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#c7d2fe', marginBottom: '6px' }}>Assessment Agent Diagnostic Feedback:</h4>
              <p style={{ fontSize: '0.88rem', color: '#e2e8f0', lineHeight: 1.5 }}>{assessmentResult.feedback}</p>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Subtopic Breakdown:</h4>
              {Object.entries(assessmentResult.subtopic_scores || {}).map(([sub, pct]) => (
                <div key={sub} style={{ fontSize: '0.82rem', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>{sub}</span>
                    <strong style={{ color: pct >= 65 ? '#10b981' : '#ef4444' }}>{pct}%</strong>
                  </div>
                  <div className="progress-bar-wrap" style={{ height: '5px' }}>
                    <div className={`progress-bar-fill ${pct >= 65 ? 'success' : 'danger'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setShowResultModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => { setShowResultModal(false); setActiveTab('roadmap'); }}>
                ⚡ View Roadmap Impact →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: JSON INSPECTOR */}
      {jsonModalData && (
        <div className="modal-overlay" onClick={() => setJsonModalData(null)}>
          <div className="modal-box" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>Agent Trace: {jsonModalData.step}</h3>
              <button className="modal-close" onClick={() => setJsonModalData(null)}>✕</button>
            </div>
            <pre className="code-snippet" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {JSON.stringify({ input: jsonModalData.input, output: jsonModalData.output }, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
