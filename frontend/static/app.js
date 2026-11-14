/**
 * SkillPath AI - Frontend Application Core
 * Coordinates UI rendering, real-time agent updates, interactive quizzes,
 * mentor chat, and hackathon demo scenarios.
 */

// Application State
const state = {
  learner: null,
  roles: [],
  gapAnalysis: null,
  roadmap: null,
  currentAssessment: null,
  currentQuizAnswers: {},
  agentTraces: [],
  activeTab: "dashboard",
  allTraces: []
};

// Initialization on DOM Loaded
document.addEventListener("DOMContentLoaded", () => {
  setupNavigationTabs();
  loadInitialData();
});

// Setup tab switching
function setupNavigationTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });

  // Tab-specific refreshes
  if (tabName === "assessment" && !state.currentAssessment) {
    loadSelectedAssessment("javascript");
  } else if (tabName === "inspector") {
    fetchAgentTraces();
  } else if (tabName === "mentor") {
    fetchMentorHistory();
  }
}

// Master Load Data
async function loadInitialData() {
  try {
    await Promise.all([
      fetchLearner(),
      fetchRoles(),
      fetchGapAnalysis(),
      fetchRoadmap(),
      fetchMentorHistory(),
      fetchAgentTraces()
    ]);
    renderAll();
  } catch (err) {
    console.error("Failed to load initial data:", err);
  }
}

// API Calls
async function fetchLearner() {
  const res = await fetch("/api/learner");
  state.learner = await res.json();
}

async function fetchRoles() {
  const res = await fetch("/api/roles");
  state.roles = await res.json();
}

async function fetchGapAnalysis() {
  const res = await fetch("/api/gap-analysis");
  state.gapAnalysis = await res.json();
}

async function fetchRoadmap() {
  const res = await fetch("/api/roadmap");
  state.roadmap = await res.json();
}

async function fetchMentorHistory() {
  const res = await fetch("/api/mentor/history");
  const messages = await res.json();
  renderMentorChat(messages);
}

async function fetchAgentTraces() {
  const res = await fetch("/api/agents/traces?limit=50");
  state.agentTraces = await res.json();
  state.allTraces = state.agentTraces;
  renderAgentTraces(state.agentTraces);
  renderDashboardActivity(state.agentTraces.slice(0, 5));
}

function toggleHeaderPassword() {
  state.headerPwVisible = !state.headerPwVisible;
  const credPw = document.getElementById("headerCredPassword");
  const btn = document.getElementById("btnHeaderPwToggle");
  if (credPw && btn) {
    if (state.headerPwVisible) {
      credPw.innerText = state.learner?.password || "skilldev@2026";
      btn.innerText = "Hide";
    } else {
      credPw.innerText = "••••••••••••";
      btn.innerText = "Show";
    }
  }
}

// Global Re-render
function renderAll() {
  renderHeaderAndMetrics();
  renderDashboard();
  renderProfile();
  renderGapAnalysis();
  renderRoadmap();
  checkAdaptationAlert();
}

// Adaptation Alert Check
function checkAdaptationAlert() {
  const banner = document.getElementById("adaptationAlert");
  const alertTitle = document.getElementById("adaptationAlertTitle");
  const alertDesc = document.getElementById("adaptationAlertDesc");

  if (!state.roadmap || !state.roadmap.items) {
    banner.style.display = "none";
    return;
  }

  const remedialItem = state.roadmap.items.find(i => i.status === "remedial_required" || i.is_remedial);
  const lockedItems = state.roadmap.items.filter(i => i.status === "locked");

  if (remedialItem) {
    banner.style.display = "flex";
    alertTitle.innerText = `⚡ Dynamic Plan Adapted: Remedial Practice Scheduled`;
    alertDesc.innerText = `Assessment results triggered targeted practice for ${remedialItem.skill_name}. Downstream module (${lockedItems.map(i => i.skill_name).join(", ") || "React"}) is safely held back until mastery is verified.`;
  } else if (state.learner && state.learner.target_role === "data_analyst") {
    banner.style.display = "flex";
    alertTitle.innerText = `🔄 Target Career Goal: Data Analyst Calibrated`;
    alertDesc.innerText = `Your roadmap is aligned with Data Analyst requirements: Python and SQL are prioritized, and frontend modules have been filtered out.`;
  } else {
    banner.style.display = "none";
  }
}

// 1. Header & Quick Stats
function renderHeaderAndMetrics() {
  if (!state.learner) return;

  const roleTitle = state.gapAnalysis?.target_role?.title || state.learner.target_role;
  const readiness = state.gapAnalysis ? `${state.gapAnalysis.readiness_percentage}%` : "--%";
  const weeklyHours = `${state.learner.weekly_hours} hrs/wk`;

  document.getElementById("headerRoleTitle").innerText = roleTitle;
  document.getElementById("headerReadiness").innerText = readiness;
  document.getElementById("headerWeeklyHours").innerText = weeklyHours;

  const credName = document.getElementById("headerCredName");
  if (credName) credName.innerText = state.learner.name || "Alex Chen";
  const credEmail = document.getElementById("headerCredEmail");
  if (credEmail) credEmail.innerText = state.learner.email || "alex.chen@gmail.com";
  const credPw = document.getElementById("headerCredPassword");
  if (credPw && !state.headerPwVisible) credPw.innerText = "••••••••••••";
  else if (credPw) credPw.innerText = state.learner.password || "skilldev@2026";

  document.getElementById("dashRoleTitle").innerText = roleTitle;
  document.getElementById("dashRoleDesc").innerText = state.gapAnalysis?.target_role?.description || "Role description";
  document.getElementById("dashReadinessBadge").innerText = `${readiness} Readiness`;
  document.getElementById("dashReadinessVal").innerText = readiness;

  const readinessNum = state.gapAnalysis ? state.gapAnalysis.readiness_percentage : 0;
  const rBar = document.getElementById("dashReadinessBar");
  rBar.style.width = `${readinessNum}%`;
  rBar.className = readinessNum >= 75 ? "progress-bar-fill success" : readinessNum >= 45 ? "progress-bar-fill primary" : "progress-bar-fill warning";
}

// 2. Dashboard Rendering
function renderDashboard() {
  if (!state.roadmap || !state.gapAnalysis) return;

  const items = state.roadmap.items || [];
  const gaps = state.gapAnalysis.gaps || [];

  // Metrics
  const verifiedCount = (state.learner.skills || []).filter(s => s.verified_proficiency >= 2.5 && s.confidence >= 0.6).length;
  const gapsCount = gaps.filter(g => g.gap_score > 0).length;
  const totalHours = state.roadmap.total_hours || 40;
  const weeks = Math.max(1, Math.round(totalHours / (state.learner.weekly_hours || 12) * 10) / 10);
  const lockedCount = items.filter(i => i.status === "locked" || i.status === "remedial_required").length;

  document.getElementById("dashMetricVerified").innerText = verifiedCount;
  document.getElementById("dashMetricGaps").innerText = gapsCount;
  document.getElementById("dashMetricEffort").innerText = `${Math.round(totalHours)} hrs`;
  document.getElementById("dashMetricWeeks").innerText = `~${weeks} weeks at ${state.learner.weekly_hours} hrs/wk`;
  document.getElementById("dashMetricHolds").innerText = lockedCount;

  // Active step
  const activeStep = items.find(i => ["remedial_required", "in_progress", "verify_evidence", "ready"].includes(i.status)) || items[0];
  if (activeStep) {
    document.getElementById("dashActiveSkillName").innerText = activeStep.skill_name;
    document.getElementById("dashActiveStepNote").innerText = activeStep.notes || activeStep.hold_reason || "Start learning core concepts";

    const badge = document.getElementById("dashActiveStepStatus");
    if (activeStep.status === "remedial_required") {
      badge.className = "badge badge-warning";
      badge.innerText = "Priority Remedial";
    } else if (activeStep.status === "verify_evidence") {
      badge.className = "badge badge-primary";
      badge.innerText = "Verify Skills";
    } else {
      badge.className = "badge badge-primary";
      badge.innerText = "Active Step";
    }
  }
}

function renderDashboardActivity(recentLogs) {
  const container = document.getElementById("dashAgentActivityList");
  container.innerHTML = "";

  if (!recentLogs || recentLogs.length === 0) {
    container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-dim);">No agent activity recorded yet.</div>`;
    return;
  }

  recentLogs.forEach(log => {
    const el = document.createElement("div");
    el.style.background = "rgba(255,255,255,0.02)";
    el.style.border = "1px solid var(--border)";
    el.style.borderRadius = "8px";
    el.style.padding = "10px 14px";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "space-between";
    el.style.gap = "12px";

    const time = new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    el.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="badge badge-primary" style="font-size: 0.7rem;">${log.agent_name}</span>
        <span style="font-size: 0.85rem; color: #e2e8f0;">${log.explanation || log.step}</span>
      </div>
      <span style="font-size: 0.72rem; color: var(--text-dim); white-space: nowrap;">${time}</span>
    `;
    container.appendChild(el);
  });
}

// 3. Profile & Skills Rendering
function renderProfile() {
  if (!state.learner) return;

  document.getElementById("profName").value = state.learner.name || "Alex Chen";
  document.getElementById("profWeeklyHours").value = state.learner.weekly_hours || 12;
  document.getElementById("profBio").value = state.learner.bio || "";
  document.getElementById("profCerts").value = state.learner.certifications || "";
  document.getElementById("profProjects").value = state.learner.projects || "";
  document.getElementById("profInterests").value = state.learner.interests || "";

  // Render role dropdown options
  const roleSelect = document.getElementById("profTargetRole");
  roleSelect.innerHTML = "";
  state.roles.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.innerText = r.title;
    if (r.id === state.learner.target_role) opt.selected = true;
    roleSelect.appendChild(opt);
  });

  // Render skills table
  const tbody = document.getElementById("profileSkillsTableBody");
  tbody.innerHTML = "";

  (state.learner.skills || []).forEach(s => {
    const tr = document.createElement("tr");

    const confPct = Math.round((s.confidence || 0) * 100);
    const uncertaintyPct = Math.round((1 - (s.confidence || 0)) * 100);

    let credBadge = "badge-neutral";
    let credText = "Self-reported";
    if (confPct >= 70) {
      credBadge = "badge-success";
      credText = "Verified (Quiz/Task)";
    } else if (confPct >= 40) {
      credBadge = "badge-primary";
      credText = "Project Evidence";
    } else {
      credBadge = "badge-warning";
      credText = "Unverified Claim";
    }

    tr.innerHTML = `
      <td><strong>${s.skill_name}</strong></td>
      <td><span class="badge badge-neutral">${s.category || "General"}</span></td>
      <td>${s.self_proficiency > 0 ? s.self_proficiency + '/5' : 'None'}</td>
      <td><strong style="color: ${s.verified_proficiency > 0 ? '#10b981' : 'var(--text-dim)'};">${s.verified_proficiency > 0 ? s.verified_proficiency + '/5' : 'Unassessed'}</strong></td>
      <td style="min-width: 130px;">
        <div style="font-size: 0.78rem; display: flex; justify-content: space-between;">
          <span>Confidence: ${confPct}%</span>
          <span style="color: var(--text-dim);">Uncert: ${uncertaintyPct}%</span>
        </div>
        <div class="progress-bar-wrap" style="height: 6px;">
          <div class="progress-bar-fill ${confPct >= 70 ? 'success' : confPct >= 40 ? 'primary' : 'warning'}" style="width: ${confPct}%;"></div>
        </div>
      </td>
      <td>
        <span class="badge ${credBadge}" style="font-size: 0.68rem; margin-bottom: 4px; display: inline-block;">${credText}</span>
        <div style="font-size: 0.78rem; color: var(--text-muted);">${s.evidence || 'No evidence provided'}</div>
      </td>
      <td>
        <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;" onclick="triggerSkillAssessment('${s.skill_id}')">
          Assess Skill
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function saveLearnerProfile() {
  const payload = {
    name: document.getElementById("profName").value,
    weekly_hours: parseInt(document.getElementById("profWeeklyHours").value) || 12,
    target_role: document.getElementById("profTargetRole").value,
    bio: document.getElementById("profBio").value,
    certifications: document.getElementById("profCerts").value,
    projects: document.getElementById("profProjects").value,
    interests: document.getElementById("profInterests").value
  };

  try {
    const res = await fetch("/api/learner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await res.json();
    await loadInitialData();
    alert("Profile saved! Agents have re-analyzed your plan.");
  } catch (e) {
    alert("Error saving profile: " + e.message);
  }
}

// 4. Gap Analysis Rendering
function renderGapAnalysis() {
  if (!state.gapAnalysis) return;

  const gaps = state.gapAnalysis.gaps || [];
  const tbody = document.getElementById("gapTableBody");
  tbody.innerHTML = "";

  document.getElementById("gapRoleSubtitle").innerHTML = `
    Target Role: <strong>${state.gapAnalysis.target_role?.title || "Role"}</strong> | 
    Formula: <code>gap = role_required_level - learner_estimated_level</code>
  `;

  gaps.forEach(g => {
    const tr = document.createElement("tr");

    let sevBadge = "badge-success";
    if (g.severity === "critical") sevBadge = "badge-danger";
    else if (g.severity === "moderate") sevBadge = "badge-warning";
    else if (g.severity === "minor") sevBadge = "badge-primary";

    const gapColor = g.gap_score >= 2.5 ? "#ef4444" : g.gap_score >= 1.0 ? "#f59e0b" : g.gap_score > 0 ? "#6366f1" : "#10b981";

    tr.innerHTML = `
      <td><strong>${g.skill_name}</strong></td>
      <td><span class="badge badge-neutral">${g.category}</span></td>
      <td><strong>${g.required_level}/5</strong></td>
      <td>${g.learner_estimated_level}/5</td>
      <td>
        <span style="font-weight: 800; color: ${gapColor}; font-size: 0.95rem;">${g.gap_score}</span>
      </td>
      <td>
        <span class="badge ${g.priority === 'must_have' ? 'badge-primary' : 'badge-neutral'}">
          ${g.priority.replace('_', ' ')}
        </span>
      </td>
      <td>
        <span class="badge ${sevBadge}">${g.severity}</span>
      </td>
      <td style="max-width: 320px; font-size: 0.82rem; color: #e2e8f0; line-height: 1.4;">
        ${g.rationale}
      </td>
      <td style="max-width: 220px; font-size: 0.8rem; color: #a5b4fc;">
        ${g.next_step}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 5. Learning Roadmap Rendering
function renderRoadmap() {
  if (!state.roadmap) return;

  const items = state.roadmap.items || [];
  const timeline = document.getElementById("roadmapTimeline");
  timeline.innerHTML = "";

  document.getElementById("roadTotalCount").innerText = items.length;
  document.getElementById("roadTotalHours").innerText = `${Math.round(state.roadmap.total_hours || 0)} hrs`;
  const weeks = Math.max(1, Math.round((state.roadmap.total_hours || 0) / (state.learner?.weekly_hours || 12) * 10) / 10);
  document.getElementById("roadTotalWeeks").innerText = `~${weeks} weeks`;
  const lockedCount = items.filter(i => i.status === "locked").length;
  document.getElementById("roadLockedCount").innerText = lockedCount;

  items.forEach(item => {
    const el = document.createElement("div");
    el.className = "timeline-item";

    const isRemedial = item.status === "remedial_required" || item.is_remedial;
    const isLocked = item.status === "locked";
    const isCompleted = item.status === "completed";
    const isInProgress = item.status === "in_progress" || item.status === "verify_evidence";

    let dotClass = "ready";
    if (isCompleted) dotClass = "completed";
    else if (isRemedial) dotClass = "remedial_required";
    else if (isLocked) dotClass = "locked";
    else if (isInProgress) dotClass = "in_progress";

    let cardExtraClass = isRemedial ? "remedial" : isLocked ? "locked" : "";

    let statusBadge = `<span class="badge badge-neutral">Ready</span>`;
    if (isRemedial) statusBadge = `<span class="badge badge-warning">⚠️ Remedial Practice Required</span>`;
    else if (isLocked) statusBadge = `<span class="badge badge-danger">🔒 Held Back (Prerequisite Gap)</span>`;
    else if (isCompleted) statusBadge = `<span class="badge badge-success">✅ Completed / Mastered</span>`;
    else if (isInProgress) statusBadge = `<span class="badge badge-primary">🚀 In Progress</span>`;

    // Resources list
    const resources = item.all_resources || (item.resource_title ? [{
      id: item.resource_id,
      title: item.resource_title,
      type: item.resource_type,
      url: item.resource_url,
      estimated_hours: item.resource_hours,
      description: item.resource_desc
    }] : []);

    let resourcesHtml = "";
    resources.forEach(r => {
      let typeBadge = "badge-neutral";
      if (r.type === "remedial_drill") typeBadge = "badge-warning";
      else if (r.type === "interactive") typeBadge = "badge-primary";
      else if (r.type === "project") typeBadge = "badge-cyan";

      resourcesHtml += `
        <div class="resource-pill">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${typeBadge}" style="font-size: 0.65rem;">${r.type.replace('_', ' ')}</span>
              <a href="${r.url}" target="_blank" style="color: #67e8f9; font-weight: 600; text-decoration: none; font-size: 0.88rem;">
                ${r.title} ↗
              </a>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px;">${r.description || ''}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; white-space: nowrap;">
            <span style="font-size: 0.75rem; color: var(--text-dim);">${r.estimated_hours} hrs</span>
            <button class="btn btn-secondary" style="font-size: 0.72rem; padding: 4px 8px;" onclick="toggleRoadmapStatus('${item.id}', '${isCompleted ? 'in_progress' : 'completed'}')">
              ${isCompleted ? 'Mark Undone' : 'Mark Done'}
            </button>
          </div>
        </div>
      `;
    });

    el.innerHTML = `
      <div class="timeline-dot ${dotClass}"></div>
      <div class="milestone-card ${cardExtraClass}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 0.8rem; font-weight: 800; color: var(--text-dim);">#${item.sequence}</span>
            <h3 style="font-size: 1.1rem; color: #fff; font-weight: 700;">${item.skill_name}</h3>
            <span class="badge badge-neutral" style="font-size: 0.68rem;">${item.category || item.skill_category}</span>
          </div>
          <div>${statusBadge}</div>
        </div>

        ${item.hold_reason ? `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 0.82rem; color: #fca5a5;">
            <strong>Reason:</strong> ${item.hold_reason}
          </div>
        ` : ''}

        <p style="font-size: 0.85rem; color: #d1d5db; margin-bottom: 10px;">
          ${item.notes || 'Master target competency requirements through guided learning.'}
        </p>

        <div style="margin-top: 10px;">
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 600;">Learning Activities & Resources:</div>
          ${resourcesHtml || '<div style="font-size: 0.8rem; color: var(--text-dim);">No specific resources attached.</div>'}
        </div>

        <div style="margin-top: 14px; display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;" onclick="triggerSkillAssessment('${item.skill_id}')">
            Take Assessment Quiz
          </button>
        </div>
      </div>
    `;

    timeline.appendChild(el);
  });
}

async function toggleRoadmapStatus(itemId, newStatus) {
  try {
    await fetch("/api/roadmap/item/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, status: newStatus })
    });
    await fetchRoadmap();
    renderRoadmap();
    renderDashboard();
  } catch (err) {
    console.error("Error toggling roadmap item:", err);
  }
}

// 6. Skill Assessment Studio
async function loadSelectedAssessment(skillId) {
  try {
    const res = await fetch(`/api/assessments/${skillId}`);
    if (!res.ok) {
      alert("No assessment questions configured for " + skillId);
      return;
    }
    const assessment = await res.json();
    state.currentAssessment = assessment;
    state.currentQuizAnswers = {};

    document.getElementById("assessmentMetaTitle").innerText = assessment.title;
    document.getElementById("assessmentMetaPassScore").innerText = `Pass: ${assessment.passing_score}%`;
    document.getElementById("assessmentMetaDesc").innerText = assessment.description;

    renderQuizQuestions(assessment.questions);
    document.getElementById("quizSubmitRow").style.display = "block";
  } catch (e) {
    console.error("Failed to load assessment:", e);
  }
}

function renderQuizQuestions(questions) {
  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "quiz-card";

    let optionsHtml = "";
    q.options.forEach((optText, optIdx) => {
      optionsHtml += `
        <label class="quiz-option" id="label_${q.id}_${optIdx}">
          <input type="radio" name="question_${q.id}" value="${optIdx}" onchange="recordQuizAnswer('${q.id}', ${optIdx})">
          <span style="font-size: 0.88rem; color: #e2e8f0;">${escapeHtml(optText)}</span>
        </label>
      `;
    });

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
        <span class="badge badge-primary" style="font-size: 0.7rem;">Question ${idx + 1} of ${questions.length}</span>
        <span class="badge badge-neutral" style="font-size: 0.7rem;">${q.subtopic}</span>
      </div>
      <div class="quiz-question-title">${escapeHtml(q.question)}</div>
      ${q.code_snippet ? `<pre class="code-snippet"><code>${escapeHtml(q.code_snippet)}</code></pre>` : ''}
      <div style="margin-top: 12px;">
        ${optionsHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

function recordQuizAnswer(questionId, optionIndex) {
  state.currentQuizAnswers[questionId] = optionIndex;
}

async function submitQuizAnswers() {
  if (!state.currentAssessment) return;
  const skillId = state.currentAssessment.skill_id;

  const totalQ = (state.currentAssessment.questions || []).length;
  const answeredQ = Object.keys(state.currentQuizAnswers).length;

  if (answeredQ < totalQ) {
    if (!confirm(`You have only answered ${answeredQ} of ${totalQ} questions. Submit anyway?`)) {
      return;
    }
  }

  try {
    const res = await fetch(`/api/assessments/${skillId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: state.currentQuizAnswers })
    });
    const result = await res.json();
    showAssessmentResultModal(result.evaluation);
    await loadInitialData();
  } catch (err) {
    alert("Error submitting assessment: " + err.message);
  }
}

function showAssessmentResultModal(evalResult) {
  document.getElementById("resModalTitle").innerText = `${evalResult.skill_name} Assessment Result`;

  const scoreBadge = document.getElementById("resModalScoreBadge");
  scoreBadge.innerText = `${evalResult.score}%`;
  scoreBadge.style.color = evalResult.passed ? "#10b981" : "#ef4444";

  const passStatus = document.getElementById("resModalPassStatus");
  passStatus.className = evalResult.passed ? "badge badge-success" : "badge badge-danger";
  passStatus.innerText = evalResult.passed ? "PASSED (Proficiency Verified)" : "STRUGGLED (Remedial Action Triggered)";

  document.getElementById("resModalFeedback").innerText = evalResult.feedback;

  const subtopicsList = document.getElementById("resModalSubtopicsList");
  subtopicsList.innerHTML = "";
  for (const [sub, pct] of Object.entries(evalResult.subtopic_scores || {})) {
    const row = document.createElement("div");
    row.style.fontSize = "0.82rem";
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>${sub}</span>
        <strong style="color: ${pct >= 65 ? '#10b981' : '#ef4444'};">${pct}%</strong>
      </div>
      <div class="progress-bar-wrap" style="height: 5px;">
        <div class="progress-bar-fill ${pct >= 65 ? 'success' : 'danger'}" style="width: ${pct}%;"></div>
      </div>
    `;
    subtopicsList.appendChild(row);
  }

  document.getElementById("assessmentResultModal").classList.add("active");
}

function closeResultModal() {
  document.getElementById("assessmentResultModal").classList.remove("active");
}

function triggerSkillAssessment(skillId) {
  switchTab("assessment");
  const sel = document.getElementById("assessmentSkillSelect");
  if (sel) {
    sel.value = skillId;
  }
  loadSelectedAssessment(skillId);
}

function openAssessmentForCurrentSkill() {
  const activeStep = (state.roadmap?.items || []).find(i => ["remedial_required", "in_progress", "verify_evidence", "ready"].includes(i.status));
  if (activeStep) {
    triggerSkillAssessment(activeStep.skill_id);
  } else {
    triggerSkillAssessment("javascript");
  }
}

// 7. AI Mentor Chat
function renderMentorChat(messages) {
  const container = document.getElementById("mentorChatMessages");
  container.innerHTML = "";

  messages.forEach(msg => {
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${msg.sender === 'learner' ? 'learner' : 'mentor'}`;

    // Simple markdown-to-html conversion
    let formatted = escapeHtml(msg.message)
      .replace(/### (.*?)\n/g, '<h3 style="color: #a5b4fc; margin-bottom: 6px;">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n- /g, '<br>• ');

    bubble.innerHTML = formatted;
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

async function sendMentorMessage() {
  const input = document.getElementById("mentorInput");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  // Append user bubble immediately
  const container = document.getElementById("mentorChatMessages");
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble learner";
  userBubble.innerText = text;
  container.appendChild(userBubble);
  container.scrollTop = container.scrollHeight;

  try {
    const res = await fetch("/api/mentor/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });
    await res.json();
    await fetchMentorHistory();
  } catch (err) {
    console.error("Mentor chat failed:", err);
  }
}

function sendQuickPrompt(promptText) {
  document.getElementById("mentorInput").value = promptText;
  sendMentorMessage();
}

// 8. Agent Pipeline Inspector
function renderAgentTraces(traces) {
  const tbody = document.getElementById("agentTracesTableBody");
  tbody.innerHTML = "";

  traces.forEach(t => {
    const tr = document.createElement("tr");
    const time = new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    tr.innerHTML = `
      <td><span class="badge badge-primary" style="font-size: 0.72rem;">${t.agent_name}</span></td>
      <td><code>${t.step}</code></td>
      <td style="font-size: 0.78rem; color: var(--text-dim); white-space: nowrap;">${time}</td>
      <td style="font-size: 0.82rem; color: #e2e8f0; max-width: 320px;">${t.explanation || '-'}</td>
      <td>
        <button class="btn btn-secondary" style="font-size: 0.72rem; padding: 3px 8px;" onclick='openJsonModal(${JSON.stringify(t.step)}, ${JSON.stringify(t.input)}, ${JSON.stringify(t.output)})'>
          View JSON
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterAgentTraces(agentName) {
  if (!agentName) {
    renderAgentTraces(state.allTraces);
  } else {
    const filtered = state.allTraces.filter(t => t.agent_name === agentName);
    renderAgentTraces(filtered);
  }
}

async function reorchestratePipeline() {
  try {
    const res = await fetch("/api/pipeline/run", { method: "POST" });
    await res.json();
    await loadInitialData();
    alert("Pipeline successfully orchestrated across all 5 agents!");
  } catch (e) {
    alert("Orchestration failed: " + e.message);
  }
}

// 9. Demo Presets
async function triggerScenario(scenarioName) {
  try {
    const res = await fetch("/api/demo/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: scenarioName })
    });
    const data = await res.json();
    await loadInitialData();

    // Auto navigate to the most relevant view
    if (scenarioName === "simulate_fail_js" || scenarioName === "simulate_pass_js") {
      switchTab("roadmap");
    } else if (scenarioName === "switch_data_analyst" || scenarioName === "switch_full_stack") {
      switchTab("gap-analysis");
    } else {
      switchTab("dashboard");
    }

    // Flash visual feedback
    const banner = document.getElementById("adaptationAlert");
    if (banner) {
      banner.scrollIntoView({ behavior: "smooth" });
    }
  } catch (err) {
    alert("Error executing demo preset: " + err.message);
  }
}

// Role Switcher Modal
function openRoleModal() {
  const container = document.getElementById("roleListContainer");
  container.innerHTML = "";

  state.roles.forEach(r => {
    const isCurrent = state.learner?.target_role === r.id;
    const card = document.createElement("div");
    card.className = "card";
    card.style.cursor = "pointer";
    card.style.background = isCurrent ? "rgba(99, 102, 241, 0.15)" : "var(--bg-card)";
    card.style.borderColor = isCurrent ? "var(--primary)" : "var(--border)";
    card.onclick = () => selectTargetRole(r.id);

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong style="color: #fff; font-size: 1rem;">${r.title}</strong>
        ${isCurrent ? '<span class="badge badge-success">Current Goal</span>' : '<span class="badge badge-neutral">Switch</span>'}
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted);">${r.description}</p>
    `;

    container.appendChild(card);
  });

  document.getElementById("roleModal").classList.add("active");
}

function closeRoleModal() {
  document.getElementById("roleModal").classList.remove("active");
}

async function selectTargetRole(roleId) {
  closeRoleModal();
  try {
    await fetch("/api/learner/target-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_id: roleId })
    });
    await loadInitialData();
  } catch (err) {
    alert("Failed to switch role: " + err.message);
  }
}

function handleRoleSelectChange(newRole) {
  selectTargetRole(newRole);
}

// Add Skill Modal
function openAddSkillModal() {
  document.getElementById("addSkillModal").classList.add("active");
}

function closeAddSkillModal() {
  document.getElementById("addSkillModal").classList.remove("active");
}

async function submitNewSkill() {
  const skillId = document.getElementById("newSkillId").value;
  const prof = parseFloat(document.getElementById("newSkillProf").value);
  const evidence = document.getElementById("newSkillEvidence").value || "Learner reported skill";

  try {
    await fetch("/api/learner/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id: skillId, self_proficiency: prof, evidence: evidence })
    });
    closeAddSkillModal();
    await loadInitialData();
  } catch (e) {
    alert("Error adding skill: " + e.message);
  }
}

// JSON Payload Modal
function openJsonModal(stepTitle, inputData, outputData) {
  document.getElementById("jsonModalTitle").innerText = `Agent Trace: ${stepTitle}`;
  const jsonText = JSON.stringify({ input: inputData, output: outputData }, null, 2);
  document.getElementById("jsonModalContent").innerText = jsonText;
  document.getElementById("jsonModal").classList.add("active");
}

function closeJsonModal() {
  document.getElementById("jsonModal").classList.remove("active");
}

// Helper: escape html
function escapeHtml(str) {
  if (!str) return "";
  return str.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
