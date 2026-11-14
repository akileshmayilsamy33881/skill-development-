# SkillPath AI — Hackathon Solution

An intelligent, multi-agent web application that transforms a learner's current skills and career aspirations into an adaptive, measurable learning plan. It explains why each skill is missing, recommends personalized next steps, and dynamically revises the roadmap when learners change goals or struggle on assessments.

---

## 🌟 Key Features

1. **Profile & Evidence Ingestion**:
   - Captures self-reported skills, projects, certifications, interests, and weekly study hours.
   - Calculates **uncertainty** and discounts unverified self-ratings until backed by objective evidence or assessments.

2. **Transparent Gap Analysis**:
   - Uses the deterministic formula:
     $$\text{gap} = \text{role\_required\_level} - \text{learner\_estimated\_level}$$
   - Displays clear severity ratings (Critical, Moderate, Minor, Met) and natural language explanations for every gap.

3. **Prerequisite-Aware & Adaptive Roadmap**:
   - Orders milestones respecting prerequisite dependencies (e.g. JavaScript before React and Node.js).
   - Maps curated real-world learning resources (freeCodeCamp, MDN, Odin Project, Kaggle).
   - **Dynamic Safety Holds:** If a learner struggles on an assessment (e.g., scoring < 65% on JavaScript functions), the Roadmap Agent automatically locks downstream dependent modules (like React) and injects an immediate remedial drill + retest.
   - **Dynamic Role Adaptation:** Switching goals (e.g., to Data Analyst) immediately reruns the gap comparison and rebuilds a data-focused plan.

4. **Skill Assessment Studio**:
   - Interactive diagnostic quizzes with code snippets and subtopic-level diagnostics (e.g., Functions & Scope, Closures, DOM, Async).
   - Instant feedback and automatic skill confidence updates.

5. **Grounded AI Mentor**:
   - Conversational AI tutor grounded in the learner's actual profile, assessment scores, and active roadmap.
   - Answers queries like *"Why is React locked in my plan?"*, *"How should I practice JavaScript functions?"*, and *"What is my recommended next step?"*.

6. **Multi-Agent Pipeline Visualizer & Inspector**:
   - Visual flow diagram of all 5 autonomous agents:
     $$\text{Profile Agent} \longrightarrow \text{Career Analyst Agent} \longrightarrow \text{Assessment Agent} \longrightarrow \text{Roadmap Agent} \longrightarrow \text{Mentor Agent}$$
   - Real-time audit log with clickable JSON payload inspector for judges.

7. **One-Click Demo Presets**:
   - `1. Load Sample Scenario`: Alex Chen, aspiring Full Stack Developer with Python, SQL, and basic HTML.
   - `2. Fail JS (<50%) [Adaptive Hold]`: Simulates struggling on closures, triggering remedial practice and locking React.
   - `3. Pass JS (100%) [Unlock]`: Verifies mastery, unlocks React, and boosts career readiness.
   - `4. Switch: Data Analyst`: Re-calibrates roadmap for data analysis, filtering out frontend tools.
   - `5. Switch: Full Stack`: Re-calibrates back to full-stack engineering.
   - `Reset DB`: Resets database to clean initial state.

---

## 🏗️ Architecture & Technology Stack

- **Backend**: Python 3 standard library (`http.server.ThreadingHTTPServer`, `sqlite3`, `json`). Zero external pip dependencies required.
- **Database**: SQLite with relational foreign keys and complete audit trail.
- **Frontend**: Clean single-page application (SPA) with responsive design, glassmorphic dark theme, progress meters, interactive quizzes, and chat interface.
- **Multi-Agent Engine**:
  - `ProfileAgent`: Ingests profile, assesses evidence credibility, computes uncertainty.
  - `CareerAnalystAgent`: Matches profile against role requirements, calculates transparent gap scores.
  - `AssessmentAgent`: Evaluates quiz submissions, diagnoses weak subtopics, updates verified proficiency.
  - `RoadmapAgent`: Orders milestones, enforces prerequisite hierarchy, handles safety holds and remedial drills.
  - `MentorAgent`: Synthesizes grounded mentorship advice and technical explanations.
  - `AgentOrchestrator`: Coordinates the full pipeline and logs timestamped execution traces.

---

## 🚀 Quick Start Guide

### 1. Launch the Server
```bash
cd /Users/akileshm/.gemini/antigravity/scratch/skillpath-ai/backend
python3 server.py 8000
```

### 2. Access the Application
Open your browser and navigate to:
```
http://localhost:8000
```

### 3. Demo Walkthrough for Judges
1. **Explore the Dashboard**: Notice Alex Chen's profile with **26.4% Readiness** for Full Stack Developer.
2. **Review Career Match & Gaps**: Note that JavaScript, React, and Node.js are flagged as critical gaps.
3. **Trigger Adaptive Failure**: Click **`2. ⚠️ Fail JS (<50%) [Adaptive Hold]`** in the top demo bar.
4. **Inspect the Roadmap**: Notice milestone #1 is now **Priority Remedial Practice** for JavaScript, and React is **Held Back** with the warning: *"Requires mastery (≥65%) on prerequisite JavaScript fundamentals."*
5. **Ask the AI Mentor**: Switch to the **AI Mentor** tab and click **"Why is React locked in my plan?"**. Read the grounded explanation.
6. **Trigger Success**: Click **`3. ✅ Pass JS (100%) [Unlock]`** and observe React unlock and career readiness jump to **45.2%**.
7. **Switch Role**: Click **`4. 🔄 Switch: Data Analyst`** and watch the roadmap update to Python, SQL, and Pandas.
8. **Inspect Agent Traces**: Switch to the **Agent Inspector** tab to view the live JSON inputs and outputs of each agent.
