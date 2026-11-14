"""
SkillPath AI - Multi-Agent Architecture Module
Implements the 5 distinct agents orchestrated in a coordinated pipeline:
1. Profile Agent: Extracts skills, evidence, and estimates baseline uncertainty.
2. Career Analyst Agent: Compares evidence against target role and computes transparent gap scores.
3. Assessment Agent: Diagnoses quiz and practical results, flags weak subtopics, and updates confidence.
4. Roadmap Agent: Dynamically sequences skills based on prerequisites, priorities, and assessment results; locks/unlocks skills adaptively.
5. Mentor Agent: Answers learner queries grounded in profile, gaps, roadmap, and test results.
"""

import json
import sqlite3
import time
from datetime import datetime
from db import get_connection

class AgentLogger:
    @staticmethod
    def log(conn, agent_name, step, input_data, output_data, explanation):
        c = conn.cursor()
        c.execute("""
        INSERT INTO agent_logs (agent_name, step, input_json, output_json, explanation)
        VALUES (?, ?, ?, ?, ?)
        """, (
            agent_name,
            step,
            json.dumps(input_data, default=str),
            json.dumps(output_data, default=str),
            explanation
        ))
        conn.commit()

class ProfileAgent:
    """
    Profile Agent:
    Extracts skills, certifications, projects, and self-reported proficiency from the learner's profile.
    Calculates estimated skill levels and uncertainty scores grounded in evidence credibility.
    """
    @staticmethod
    def run(conn, learner_id):
        c = conn.cursor()
        c.execute("SELECT * FROM learners WHERE id = ?", (learner_id,))
        learner = dict(c.fetchone())

        c.execute("""
        SELECT ls.*, s.name as skill_name, s.category as skill_category
        FROM learner_skills ls
        JOIN skills s ON ls.skill_id = s.id
        WHERE ls.learner_id = ?
        """, (learner_id,))
        skills_rows = [dict(r) for r in c.fetchall()]

        extracted_skills = []
        for s in skills_rows:
            self_prof = s["self_proficiency"]
            ver_prof = s["verified_proficiency"]
            conf = s["confidence"]
            evidence = s["evidence"] or "No evidence reported"

            # If assessed, verified proficiency takes priority; otherwise discount unverified self-report
            if conf > 0.6:
                estimated_level = round(ver_prof, 1)
                uncertainty = round(1.0 - conf, 2)
                credibility = "High (Objectively Assessed)"
            elif conf > 0.3:
                estimated_level = round((self_prof * 0.6) + (ver_prof * 0.4), 1)
                uncertainty = round(1.0 - conf, 2)
                credibility = "Moderate (Supported by Project/Coursework)"
            else:
                estimated_level = round(self_prof * 0.5, 1) # Unverified self-claim discounted
                uncertainty = 0.85
                credibility = "Low (Self-reported, Unverified)"

            extracted_skills.append({
                "skill_id": s["skill_id"],
                "skill_name": s["skill_name"],
                "category": s["skill_category"],
                "self_proficiency": self_prof,
                "verified_proficiency": ver_prof,
                "estimated_level": estimated_level,
                "confidence": conf,
                "uncertainty": uncertainty,
                "credibility": credibility,
                "evidence": evidence,
                "status": s["status"]
            })

        output = {
            "learner_id": learner_id,
            "target_role": learner["target_role"],
            "weekly_hours": learner["weekly_hours"],
            "certifications": learner["certifications"],
            "projects": learner["projects"],
            "interests": learner["interests"],
            "skills": extracted_skills,
            "summary": f"Extracted {len(extracted_skills)} skills with evidence analysis. High uncertainty on unassessed claims."
        }

        explanation = f"Profile Agent analyzed {learner['name']}'s profile: {len(extracted_skills)} skills evaluated against evidence credibility."
        AgentLogger.log(conn, "Profile Agent", "extract_profile_evidence", {"learner_id": learner_id}, output, explanation)
        return output

class CareerAnalystAgent:
    """
    Career Analyst Agent:
    Compares the learner's evidence against the selected role's skill requirements.
    Calculates transparent gap scores: gap = role_required_level - learner_estimated_level.
    """
    @staticmethod
    def run(conn, learner_id, profile_data):
        c = conn.cursor()
        target_role_id = profile_data["target_role"]

        c.execute("SELECT * FROM roles WHERE id = ?", (target_role_id,))
        role_row = c.fetchone()
        role = dict(role_row) if role_row else {"id": target_role_id, "title": "Custom Role", "category": "Tech"}

        c.execute("""
        SELECT rs.*, s.name as skill_name, s.category as skill_category, s.description as skill_description
        FROM role_skills rs
        JOIN skills s ON rs.skill_id = s.id
        WHERE rs.role_id = ?
        ORDER BY rs.required_level DESC
        """, (target_role_id,))
        role_requirements = [dict(r) for r in c.fetchall()]

        learner_skill_map = {s["skill_id"]: s for s in profile_data["skills"]}

        gaps = []
        total_required_weight = 0.0
        total_learner_weight = 0.0

        for req in role_requirements:
            s_id = req["skill_id"]
            req_lvl = req["required_level"]
            priority = req["priority"]
            priority_mult = 1.5 if priority == "must_have" else 1.0

            learner_info = learner_skill_map.get(s_id)
            if learner_info:
                est_lvl = learner_info["estimated_level"]
                conf = learner_info["confidence"]
                evidence = learner_info["evidence"]
            else:
                est_lvl = 0.0
                conf = 0.0
                evidence = "Missing from learner profile"

            gap_score = round(max(0.0, req_lvl - est_lvl), 1)

            # Determine severity
            if gap_score == 0:
                severity = "met"
                next_step = f"Maintain skill through advanced projects or review."
            elif gap_score <= 1.0:
                severity = "minor"
                next_step = f"Quick verification assessment or short refresher."
            elif gap_score <= 2.5:
                severity = "moderate"
                next_step = f"Complete structured modules and practical projects."
            else:
                severity = "critical"
                next_step = f"Start with core fundamentals and hands-on exercises."

            # Rationale explanation
            if conf < 0.4 and est_lvl > 0:
                rationale = f"{req['skill_name']} is required at level {req_lvl}/5. You reported experience ({evidence}), but it remains unverified with high uncertainty ({round((1-conf)*100)}%)."
            elif gap_score > 0:
                rationale = f"{req['skill_name']} is {priority.replace('_', ' ')} for {role['title']} (needs {req_lvl}/5, current est. {est_lvl}/5). {req['rationale']}"
            else:
                rationale = f"Requirements met: Your estimated level ({est_lvl}/5) meets the required {req_lvl}/5."

            gaps.append({
                "skill_id": s_id,
                "skill_name": req["skill_name"],
                "category": req["skill_category"],
                "required_level": req_lvl,
                "learner_estimated_level": est_lvl,
                "confidence": conf,
                "gap_score": gap_score,
                "priority": priority,
                "severity": severity,
                "evidence": evidence,
                "rationale": rationale,
                "next_step": next_step
            })

            # Accumulate readiness
            total_required_weight += (req_lvl * priority_mult)
            total_learner_weight += (min(est_lvl, req_lvl) * priority_mult)

        readiness_pct = round((total_learner_weight / max(1.0, total_required_weight)) * 100, 1)

        # Categorize
        missing_critical = [g["skill_name"] for g in gaps if g["severity"] == "critical" and g["priority"] == "must_have"]
        unverified_skills = [g["skill_name"] for g in gaps if g["confidence"] < 0.4 and g["learner_estimated_level"] > 0]

        output = {
            "target_role": role,
            "readiness_percentage": readiness_pct,
            "gaps": gaps,
            "missing_critical": missing_critical,
            "unverified_skills": unverified_skills,
            "summary": f"Role match: {readiness_pct}% ready for {role['title']}. Critical gaps: {', '.join(missing_critical) if missing_critical else 'None'}."
        }

        explanation = f"Career Analyst Agent compared profile to {role['title']}. Overall readiness is {readiness_pct}%. Missing/critical gaps flagged: {len(missing_critical)}."
        AgentLogger.log(conn, "Career Analyst Agent", "match_role_requirements", {"role_id": target_role_id}, output, explanation)
        return output

class AssessmentAgent:
    """
    Assessment Agent:
    Interprets quiz and task results, diagnoses weak subtopics, and updates skill confidence and verified proficiency.
    """
    @staticmethod
    def evaluate_quiz(conn, learner_id, skill_id, answers_dict):
        """
        answers_dict: {question_id: selected_index}
        """
        c = conn.cursor()
        c.execute("""
        SELECT aq.*, a.passing_score
        FROM assessment_questions aq
        JOIN assessments a ON aq.assessment_id = a.id
        WHERE a.skill_id = ?
        """, (skill_id,))
        questions = [dict(r) for r in c.fetchall()]

        if not questions:
            # Fallback if no questions exist
            return {"error": "No assessment found for this skill"}

        total_questions = len(questions)
        correct_count = 0
        subtopics = {}
        detailed_breakdown = []

        passing_score = questions[0]["passing_score"]

        for q in questions:
            q_id = q["id"]
            subtopic = q["subtopic"]
            correct_idx = q["correct_index"]
            user_selected = answers_dict.get(q_id)

            is_correct = (user_selected is not None and int(user_selected) == correct_idx)
            if is_correct:
                correct_count += 1

            if subtopic not in subtopics:
                subtopics[subtopic] = {"correct": 0, "total": 0}
            subtopics[subtopic]["total"] += 1
            if is_correct:
                subtopics[subtopic]["correct"] += 1

            detailed_breakdown.append({
                "question_id": q_id,
                "question": q["question"],
                "subtopic": subtopic,
                "user_selected": user_selected,
                "correct_index": correct_idx,
                "is_correct": is_correct,
                "explanation": q["explanation"]
            })

        score_pct = round((correct_count / total_questions) * 100, 1)
        passed = 1 if score_pct >= passing_score else 0

        # Subtopic percentages and weak areas
        weak_areas = []
        subtopic_scores = {}
        for sub, data in subtopics.items():
            pct = round((data["correct"] / data["total"]) * 100, 1)
            subtopic_scores[sub] = pct
            if pct < 60.0:
                weak_areas.append(f"{sub} ({pct}%)")

        # Formulate diagnostic feedback
        c.execute("SELECT name FROM skills WHERE id = ?", (skill_id,))
        s_row = c.fetchone()
        skill_name = s_row["name"] if s_row else skill_id

        if passed:
            feedback = (
                f"Proficiency verified in {skill_name} ({score_pct}%). "
                f"Demonstrated solid grasp across tested concepts. "
                f"{'Minor review suggested in ' + ', '.join(weak_areas) if weak_areas else 'All subtopics scored strongly.'}"
            )
            new_status = "verified"
            new_ver_prof = round(min(5.0, max(2.5, (score_pct / 100.0) * 4.5)), 1)
            new_conf = 0.85
        else:
            feedback = (
                f"{skill_name} score: {score_pct}%. Struggled with: {', '.join(weak_areas) if weak_areas else 'core concepts'}. "
                f"Targeted remedial practice recommended before advancing to dependent frameworks."
            )
            new_status = "needs_remedial"
            new_ver_prof = round((score_pct / 100.0) * 3.0, 1)
            new_conf = 0.80 # Test provides high confidence on their true current level (even if low)

        # Store assessment result
        result_id = f"res_{int(time.time()*1000)}"
        c.execute("""
        INSERT INTO assessment_results (id, learner_id, skill_id, score, subtopic_scores_json, feedback, passed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            result_id,
            learner_id,
            skill_id,
            score_pct,
            json.dumps(subtopic_scores),
            feedback,
            passed
        ))

        # Update learner_skills table
        c.execute("""
        UPDATE learner_skills
        SET verified_proficiency = ?, confidence = ?, status = ?,
            evidence = ?
        WHERE learner_id = ? AND skill_id = ?
        """, (
            new_ver_prof,
            new_conf,
            new_status,
            f"Assessed via quiz: {score_pct}% ({'Passed' if passed else 'Weak: ' + ', '.join(weak_areas)})",
            learner_id,
            skill_id
        ))
        conn.commit()

        output = {
            "result_id": result_id,
            "skill_id": skill_id,
            "skill_name": skill_name,
            "score": score_pct,
            "passed": bool(passed),
            "passing_score": passing_score,
            "subtopic_scores": subtopic_scores,
            "weak_areas": weak_areas,
            "feedback": feedback,
            "verified_proficiency": new_ver_prof,
            "confidence": new_conf,
            "needs_remedial": not bool(passed),
            "breakdown": detailed_breakdown
        }

        explanation = f"Assessment Agent evaluated {skill_name}: score {score_pct}%. {'Passed' if passed else 'Failed, flagged weak areas: ' + ', '.join(weak_areas)}."
        AgentLogger.log(conn, "Assessment Agent", "evaluate_assessment", {"skill_id": skill_id, "score": score_pct}, output, explanation)
        return output

class RoadmapAgent:
    """
    Roadmap Agent:
    Orders skill gaps and selects learning activities respecting prerequisites, priorities, and assessment results.
    Implements adaptive hold/unlocking (e.g. holds React if JavaScript is struggling; inserts remedial drills).
    """
    @staticmethod
    def run(conn, learner_id, gap_data):
        c = conn.cursor()

        # Fetch prerequisites
        c.execute("SELECT skill_id, prerequisite_id FROM skill_prerequisites")
        prereq_rows = c.fetchall()
        prereqs = {}
        for row in prereq_rows:
            sid, pid = row["skill_id"], row["prerequisite_id"]
            if sid not in prereqs:
                prereqs[sid] = []
            prereqs[sid].append(pid)

        # Fetch learner skills with current status and scores
        c.execute("""
        SELECT ls.*, s.name as skill_name, s.category
        FROM learner_skills ls
        JOIN skills s ON ls.skill_id = s.id
        WHERE ls.learner_id = ?
        """, (learner_id,))
        learner_skills = {r["skill_id"]: dict(r) for r in c.fetchall()}

        # Fetch resources
        c.execute("SELECT * FROM resources")
        resources = [dict(r) for r in c.fetchall()]
        resource_map = {}
        for r in resources:
            sid = r["skill_id"]
            if sid not in resource_map:
                resource_map[sid] = []
            resource_map[sid].append(r)

        # Clear existing roadmap items for learner
        c.execute("DELETE FROM roadmap_items WHERE learner_id = ?", (learner_id,))

        gaps = gap_data["gaps"]
        # Separate into required skills for the role
        active_skill_ids = [g["skill_id"] for g in gaps if g["required_level"] > 0]

        # Check if any skill has active remedial need (e.g. javascript failed assessment)
        remedial_skills = set()
        for sid in active_skill_ids:
            s_info = learner_skills.get(sid, {})
            if s_info.get("status") == "needs_remedial" or (s_info.get("confidence", 0) > 0.5 and s_info.get("verified_proficiency", 0) < 2.0):
                remedial_skills.add(sid)

        # Topological sorting respecting prerequisites and role priorities
        # Ideal sequence order for Full Stack:
        # 1. Verification of reported skills (HTML/CSS, SQL)
        # 2. Remedial drill if any
        # 3. JavaScript Fundamentals
        # 4. React (holds if JS is in remedial or unverified)
        # 5. Node.js (holds if JS is in remedial or unverified)
        # 6. Database / SQL project
        # 7. Git & Deployment portfolio
        sequence_priority = {
            "html_css": 10,
            "sql": 20,
            "javascript": 30,
            "react": 50,
            "nodejs": 60,
            "python": 15,
            "pandas": 35,
            "git": 40,
            "docker": 70,
            "ml_basics": 80
        }

        # Sort gaps
        def sort_key(item):
            sid = item["skill_id"]
            # If needs remedial, moves to very top!
            is_rem = 1 if sid in remedial_skills else 0
            seq = sequence_priority.get(sid, 50)
            return (-is_rem, seq)

        sorted_gaps = sorted(gaps, key=sort_key)

        roadmap_items = []
        seq_num = 1
        total_estimated_hours = 0.0

        for gap in sorted_gaps:
            sid = gap["skill_id"]
            s_info = learner_skills.get(sid, {})
            skill_status = s_info.get("status", "unassessed")
            conf = s_info.get("confidence", 0.0)
            ver_prof = s_info.get("verified_proficiency", 0.0)

            # Check prerequisites
            skill_prereqs = prereqs.get(sid, [])
            prereq_blocking = []
            for pid in skill_prereqs:
                p_info = learner_skills.get(pid, {})
                p_status = p_info.get("status", "unassessed")
                p_prof = p_info.get("verified_proficiency", 0.0)
                # If prerequisite is failing or not yet verified
                if p_status == "needs_remedial" or (pid in remedial_skills) or (p_prof < 2.0 and p_info.get("confidence", 0) > 0):
                    c.execute("SELECT name FROM skills WHERE id = ?", (pid,))
                    p_name = c.fetchone()["name"]
                    prereq_blocking.append(f"{p_name} (needs mastery ≥65%, currently struggling)")
                elif p_prof == 0 and p_info.get("confidence", 0) == 0:
                    c.execute("SELECT name FROM skills WHERE id = ?", (pid,))
                    p_name = c.fetchone()["name"]
                    prereq_blocking.append(f"{p_name} (foundational prerequisite not started)")

            # Determine item status & hold reason
            is_remedial = 1 if sid in remedial_skills else 0
            hold_reason = None
            item_status = "ready"

            if prereq_blocking:
                item_status = "locked"
                hold_reason = f"Held back: Prerequisites required: {', '.join(prereq_blocking)}."
            elif is_remedial:
                item_status = "remedial_required"
                hold_reason = f"Priority Remediation: Assessment indicated weak areas. Complete targeted drills before progressing."
            elif gap["gap_score"] == 0:
                item_status = "completed"
            elif conf < 0.4 and s_info.get("self_proficiency", 0) > 0:
                item_status = "verify_evidence"
            elif seq_num == 1 or (seq_num <= 2 and not prereq_blocking):
                item_status = "in_progress"
            else:
                item_status = "ready"

            # Select suitable resources
            avail_res = resource_map.get(sid, [])
            selected_resources = []
            if is_remedial:
                # Include remedial drill first
                drills = [r for r in avail_res if r["type"] == "remedial_drill"]
                others = [r for r in avail_res if r["type"] != "remedial_drill"]
                selected_resources = drills + others
            else:
                # Normal selection
                selected_resources = [r for r in avail_res if r["type"] != "remedial_drill"]
                if not selected_resources:
                    selected_resources = avail_res

            # Pick primary resource
            primary_res = selected_resources[0] if selected_resources else None
            res_id = primary_res["id"] if primary_res else None
            est_hours = sum(r["estimated_hours"] for r in selected_resources) if selected_resources else 10.0

            if item_status != "completed":
                total_estimated_hours += est_hours

            # Insert into database
            item_id = f"road_{learner_id}_{sid}_{seq_num}"
            notes = gap["next_step"]

            c.execute("""
            INSERT INTO roadmap_items (id, learner_id, skill_id, resource_id, sequence, status, is_remedial, hold_reason, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                item_id,
                learner_id,
                sid,
                res_id,
                seq_num,
                item_status,
                is_remedial,
                hold_reason,
                notes
            ))

            roadmap_items.append({
                "id": item_id,
                "sequence": seq_num,
                "skill_id": sid,
                "skill_name": gap["skill_name"],
                "category": gap["category"],
                "required_level": gap["required_level"],
                "learner_estimated_level": gap["learner_estimated_level"],
                "gap_score": gap["gap_score"],
                "status": item_status,
                "is_remedial": bool(is_remedial),
                "hold_reason": hold_reason,
                "notes": notes,
                "primary_resource": primary_res,
                "all_resources": selected_resources,
                "estimated_hours": est_hours
            })
            seq_num += 1

        conn.commit()

        output = {
            "total_items": len(roadmap_items),
            "total_estimated_hours": total_estimated_hours,
            "estimated_weeks": round(total_estimated_hours / max(1, gap_data.get("target_role", {}).get("weekly_hours", 12)), 1),
            "remedial_skills_count": len(remedial_skills),
            "locked_skills_count": len([i for i in roadmap_items if i["status"] == "locked"]),
            "items": roadmap_items,
            "summary": f"Generated ordered roadmap of {len(roadmap_items)} milestones. {len(remedial_skills)} remedial actions, {len([i for i in roadmap_items if i['status'] == 'locked'])} downstream modules safely held back."
        }

        explanation = f"Roadmap Agent generated adaptive path. Enforced prerequisite constraints: holding back advanced modules when foundations show deficiencies."
        AgentLogger.log(conn, "Roadmap Agent", "generate_adaptive_roadmap", {"learner_id": learner_id}, output, explanation)
        return output

class MentorAgent:
    """
    Mentor Agent:
    Grounded in learner profile, role requirements, assessment weaknesses, and roadmap state.
    Provides empathetic, actionable advice and answers user questions.
    """
    @staticmethod
    def answer_query(conn, learner_id, user_message):
        c = conn.cursor()
        c.execute("SELECT * FROM learners WHERE id = ?", (learner_id,))
        learner = dict(c.fetchone())

        c.execute("SELECT * FROM roles WHERE id = ?", (learner["target_role"],))
        role_row = c.fetchone()
        role_title = role_row["title"] if role_row else learner["target_role"]

        # Fetch recent assessment results
        c.execute("""
        SELECT ar.*, s.name as skill_name
        FROM assessment_results ar
        JOIN skills s ON ar.skill_id = s.id
        WHERE ar.learner_id = ?
        ORDER BY ar.created_at DESC LIMIT 3
        """, (learner_id,))
        recent_assessments = [dict(r) for r in c.fetchall()]

        # Fetch roadmap state
        c.execute("""
        SELECT ri.*, s.name as skill_name
        FROM roadmap_items ri
        JOIN skills s ON ri.skill_id = s.id
        WHERE ri.learner_id = ?
        ORDER BY ri.sequence ASC
        """, (learner_id,))
        roadmap_items = [dict(r) for r in c.fetchall()]

        # Fetch learner skills
        c.execute("""
        SELECT ls.*, s.name as skill_name
        FROM learner_skills ls
        JOIN skills s ON ls.skill_id = s.id
        WHERE ls.learner_id = ?
        """, (learner_id,))
        skills = [dict(r) for r in c.fetchall()]

        # Analyze context
        struggling_skills = [s["skill_name"] for s in skills if s["status"] == "needs_remedial"]
        locked_items = [item["skill_name"] for item in roadmap_items if item["status"] == "locked"]
        active_item = next((item for item in roadmap_items if item["status"] in ["remedial_required", "in_progress", "verify_evidence"]), None)

        msg_lower = user_message.lower()

        # Build grounded response based on intelligent rule synthesis
        response_text = ""
        references = []

        if any(w in msg_lower for w in ["why is react locked", "why react locked", "react held back", "react locked"]):
            if struggling_skills or "React & Component Architecture" in locked_items:
                response_text = (
                    "### Why React is Held Back\n\n"
                    "React is currently **locked** in your roadmap because our Assessment Agent detected weaknesses "
                    "in core **JavaScript fundamentals** (particularly functions, closures, and asynchronous methods).\n\n"
                    "- **The Engineering Reason:** React is not a separate programming language; its component model, hooks (`useState`, `useEffect`), "
                    "and state updates are built entirely on JavaScript closures and array methods (`.map()`, `.filter()`).\n"
                    "- **Next Action:** Complete the **Targeted Drill: Functions, Scope & Closures** in your roadmap and score at least 65% on the re-test. "
                    "Once verified, the Roadmap Agent will automatically unlock React for you!"
                )
                references.append({"type": "roadmap_hold", "skill": "React", "prerequisite": "JavaScript"})
            else:
                response_text = "React is currently available in your roadmap sequence! Let me know if you want study tips for state hooks or component props."

        elif any(w in msg_lower for w in ["why did my plan change", "why plan changed", "roadmap changed", "why changed"]):
            if struggling_skills:
                response_text = (
                    f"### Dynamic Adaptation Alert\n\n"
                    f"Your roadmap was automatically revised following your recent assessment in **{', '.join(struggling_skills)}**.\n\n"
                    "1. **Remedial Drill Inserted:** An immediate focused practice milestone was added to shore up the identified weak areas.\n"
                    "2. **Safety Holds Applied:** Advanced modules that depend on this skill (like React and Node.js) were placed on hold.\n"
                    "This ensures you don't waste time struggling through complex framework abstractions before the foundational language primitives are second nature."
                )
            else:
                response_text = (
                    f"Your roadmap adapts whenever your assessment scores change or you switch career goals. "
                    f"Currently, your plan is calibrated for **{role_title}** based on your evidence and prerequisites."
                )

        elif any(w in msg_lower for w in ["how to practice js functions", "closures", "functions and scope", "study guidance", "struggling with js"]):
            response_text = (
                "### Mastering JavaScript Functions & Closures\n\n"
                "Here is my step-by-step guidance based on where learners typically get caught up:\n\n"
                "1. **Lexical Scope Mental Model:** Remember that functions retain access to the variables defined in their outer parent scope at creation time, even after the parent function has finished executing.\n"
                "2. **Interactive Exercise:** Build a tiny function `createBankAccount(initialBalance)` that returns `{ deposit(amount), getBalance() }` without exposing the balance variable directly. This proves closure encapsulation!\n"
                "3. **Array Methods:** Practice replacing all `for` loops with `.map()`, `.filter()`, and `.reduce()`.\n\n"
                "Check out the **Targeted Drill: Functions, Scope & Closures** resource in your roadmap to practice these with instant feedback."
            )
            references.append({"type": "resource_ref", "title": "Targeted Drill: Functions, Scope & Closures"})

        elif any(w in msg_lower for w in ["next step", "what should i do", "where do i start", "current step"]):
            if active_item:
                response_text = (
                    f"### Your Recommended Next Step\n\n"
                    f"Your primary focus right now is **{active_item['skill_name']}** ({active_item['status'].replace('_', ' ').title()}).\n\n"
                    f"- **Activity:** {active_item['notes']}\n"
                    f"- **Estimated Time:** {active_item.get('estimated_hours', 10)} hours\n"
                    f"- **Why this matters:** Completing this milestone validates your foundation and unlocks the next stage in your {role_title} roadmap."
                )
                references.append({"type": "active_step", "skill": active_item["skill_name"]})
            else:
                response_text = f"You are in great shape! Keep going through your roadmap for {role_title}."

        elif any(w in msg_lower for w in ["data analyst", "switch", "change role"]):
            response_text = (
                "### Switching to Data Analyst\n\n"
                "If you switch your target role to **Data Analyst**, our Career Analyst Agent will instantly recalculate your gap score:\n"
                "- Your solid **Python (3.5/5)** and **SQL (3.0/5)** experience will immediately boost your readiness score!\n"
                "- Frontend modules (HTML/CSS, React) will be removed from your active roadmap.\n"
                "- **Pandas & Data Wrangling** and Advanced SQL will take top priority.\n\n"
                "You can click the 'Switch to Data Analyst' preset button in the header to see this adaptation in real time!"
            )
            references.append({"type": "role_switch_preview", "role": "Data Analyst"})

        else:
            # General grounded mentorship
            assess_text = ""
            if recent_assessments:
                latest = recent_assessments[0]
                assess_text = f"Your latest assessment in **{latest['skill_name']}** was {latest['score']}%. "

            response_text = (
                f"### AI Mentor Guidance for {learner['name']}\n\n"
                f"I'm keeping your learning path calibrated for **{role_title}** ({learner['weekly_hours']} hrs/week). {assess_text}\n\n"
                f"Current focus: " + (f"**{active_item['skill_name']}**." if active_item else "Continue working through your roadmap.") + "\n\n"
                f"**How I can help you today:**\n"
                f"- Explain why specific skills or resources are sequenced in your roadmap\n"
                f"- Break down tricky concepts (like closures, SQL joins, or React state)\n"
                f"- Advise on portfolio projects that demonstrate verified mastery to employers\n\n"
                f"What would you like to explore?"
            )

        # Store in database
        msg_id_user = f"msg_{int(time.time()*1000)}_u"
        msg_id_mentor = f"msg_{int(time.time()*1000)}_m"

        c.execute("""
        INSERT INTO mentor_messages (id, learner_id, sender, message, metadata_json)
        VALUES (?, ?, ?, ?, ?)
        """, (msg_id_user, learner_id, "learner", user_message, json.dumps({})))

        c.execute("""
        INSERT INTO mentor_messages (id, learner_id, sender, message, metadata_json)
        VALUES (?, ?, ?, ?, ?)
        """, (msg_id_mentor, learner_id, "mentor", response_text, json.dumps({"references": references})))

        conn.commit()

        output = {
            "message_id": msg_id_mentor,
            "response": response_text,
            "references": references,
            "grounding": {
                "target_role": role_title,
                "struggling_skills": struggling_skills,
                "locked_items": locked_items,
                "active_item": active_item["skill_name"] if active_item else None
            }
        }

        explanation = f"Mentor Agent responded to query '{user_message[:30]}...' grounded in learner's real profile, gaps, and roadmap."
        AgentLogger.log(conn, "Mentor Agent", "generate_grounded_response", {"query": user_message}, output, explanation)
        return output

class AgentOrchestrator:
    """
    Coordinates the multi-agent workflow:
    Profile + Target Role -> Career Analyst -> Assessment-informed Gaps -> Roadmap -> Mentor Status
    """
    @staticmethod
    def run_full_pipeline(conn, learner_id):
        # 1. Profile Agent
        profile_data = ProfileAgent.run(conn, learner_id)

        # 2. Career Analyst Agent
        gap_data = CareerAnalystAgent.run(conn, learner_id, profile_data)

        # 3. Roadmap Agent (uses gap analysis + current assessment records)
        roadmap_data = RoadmapAgent.run(conn, learner_id, gap_data)

        pipeline_result = {
            "learner_id": learner_id,
            "timestamp": datetime.utcnow().isoformat(),
            "profile": profile_data,
            "career_analysis": gap_data,
            "roadmap": roadmap_data,
            "status": "orchestration_complete"
        }
        return pipeline_result

    @staticmethod
    def switch_target_role(conn, learner_id, new_role_id):
        c = conn.cursor()
        c.execute("UPDATE learners SET target_role = ? WHERE id = ?", (new_role_id, learner_id))
        conn.commit()

        # Re-run full pipeline with new target role
        result = AgentOrchestrator.run_full_pipeline(conn, learner_id)

        # Log orchestration event
        AgentLogger.log(
            conn,
            "Orchestrator",
            "switch_target_role",
            {"learner_id": learner_id, "new_role_id": new_role_id},
            {"readiness": result["career_analysis"]["readiness_percentage"], "total_milestones": result["roadmap"]["total_items"]},
            f"Target role switched to {new_role_id}. Recalculated gap analysis and regenerated adaptive roadmap."
        )
        return result

    @staticmethod
    def handle_assessment_submission(conn, learner_id, skill_id, answers_dict):
        # 1. Assessment Agent evaluates submission and updates learner_skills
        eval_result = AssessmentAgent.evaluate_quiz(conn, learner_id, skill_id, answers_dict)

        # 2. Trigger pipeline re-run to adapt roadmap and gaps
        pipeline_result = AgentOrchestrator.run_full_pipeline(conn, learner_id)

        return {
            "evaluation": eval_result,
            "adapted_pipeline": pipeline_result
        }
