"""
SkillPath AI - Backend REST API Server
Built with Python standard library (http.server.ThreadingHTTPServer).
Zero external pip dependencies needed, runs reliably anywhere.
"""

import json
import os
import sys
import mimetypes
from urllib.parse import urlparse, parse_qs
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

# Import database and agent modules
from db import get_connection, init_db, seed_db
from agents import (
    ProfileAgent,
    CareerAnalystAgent,
    AssessmentAgent,
    RoadmapAgent,
    MentorAgent,
    AgentOrchestrator
)

STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")

class SkillPathHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_cors_headers()
        self.end_headers()
        payload = json.dumps(data, indent=2, default=str)
        self.wfile.write(payload.encode("utf-8"))

    def parse_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length > 0:
            raw_body = self.rfile.read(content_length).decode("utf-8")
            try:
                return json.loads(raw_body)
            except Exception:
                return {}
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        conn = get_connection()
        learner_id = "learner_1"

        try:
            # API Routes
            if path == "/api/learner":
                c = conn.cursor()
                c.execute("SELECT * FROM learners WHERE id = ?", (learner_id,))
                learner = dict(c.fetchone())

                # Get learner skills
                c.execute("""
                SELECT ls.*, s.name as skill_name, s.category, s.description as skill_desc, s.icon
                FROM learner_skills ls
                JOIN skills s ON ls.skill_id = s.id
                WHERE ls.learner_id = ?
                ORDER BY ls.verified_proficiency DESC, ls.self_proficiency DESC
                """, (learner_id,))
                skills = [dict(r) for r in c.fetchall()]
                learner["skills"] = skills

                # Also include current role details
                c.execute("SELECT * FROM roles WHERE id = ?", (learner["target_role"],))
                role_row = c.fetchone()
                learner["role_details"] = dict(role_row) if role_row else None

                self.send_json(200, learner)

            elif path == "/api/roles":
                c = conn.cursor()
                c.execute("SELECT * FROM roles")
                roles = [dict(r) for r in c.fetchall()]
                for role in roles:
                    c.execute("""
                    SELECT rs.*, s.name as skill_name, s.category
                    FROM role_skills rs
                    JOIN skills s ON rs.skill_id = s.id
                    WHERE rs.role_id = ?
                    ORDER BY rs.required_level DESC
                    """, (role["id"],))
                    role["required_skills"] = [dict(r) for r in c.fetchall()]
                self.send_json(200, roles)

            elif path == "/api/gap-analysis":
                # Run profile + career analyst
                profile_data = ProfileAgent.run(conn, learner_id)
                gap_data = CareerAnalystAgent.run(conn, learner_id, profile_data)
                self.send_json(200, gap_data)

            elif path == "/api/roadmap":
                # Fetch roadmap items
                c = conn.cursor()
                c.execute("""
                SELECT ri.*, s.name as skill_name, s.category as skill_category,
                       r.title as resource_title, r.type as resource_type,
                       r.url as resource_url, r.estimated_hours as resource_hours,
                       r.difficulty as resource_difficulty, r.description as resource_desc
                FROM roadmap_items ri
                JOIN skills s ON ri.skill_id = s.id
                LEFT JOIN resources r ON ri.resource_id = r.id
                WHERE ri.learner_id = ?
                ORDER BY ri.sequence ASC
                """, (learner_id,))
                items = [dict(r) for r in c.fetchall()]

                # If no roadmap exists yet, generate it
                if not items:
                    pipeline_res = AgentOrchestrator.run_full_pipeline(conn, learner_id)
                    items = pipeline_res["roadmap"]["items"]
                else:
                    # Enrich with all available resources for each skill
                    for item in items:
                        c.execute("SELECT * FROM resources WHERE skill_id = ?", (item["skill_id"],))
                        item["all_resources"] = [dict(r) for r in c.fetchall()]

                # Also get target role and readiness summary
                profile_data = ProfileAgent.run(conn, learner_id)
                gap_data = CareerAnalystAgent.run(conn, learner_id, profile_data)

                total_hours = sum(i.get("resource_hours") or 8.0 for i in items if i.get("status") != "completed")

                self.send_json(200, {
                    "learner_id": learner_id,
                    "target_role": gap_data["target_role"],
                    "readiness_percentage": gap_data["readiness_percentage"],
                    "total_hours": total_hours,
                    "items": items
                })

            elif path == "/api/assessments":
                c = conn.cursor()
                c.execute("""
                SELECT a.*, s.name as skill_name, s.category as skill_category,
                       (SELECT COUNT(*) FROM assessment_questions aq WHERE aq.assessment_id = a.id) as question_count
                FROM assessments a
                JOIN skills s ON a.skill_id = s.id
                """)
                assessments = [dict(r) for r in c.fetchall()]

                # Add learner status for each assessment
                for a in assessments:
                    c.execute("""
                    SELECT * FROM assessment_results
                    WHERE learner_id = ? AND skill_id = ?
                    ORDER BY created_at DESC LIMIT 1
                    """, (learner_id, a["skill_id"]))
                    latest = c.fetchone()
                    a["latest_result"] = dict(latest) if latest else None

                self.send_json(200, assessments)

            elif path.startswith("/api/assessments/"):
                skill_id = path.replace("/api/assessments/", "").strip()
                c = conn.cursor()
                c.execute("""
                SELECT a.*, s.name as skill_name
                FROM assessments a
                JOIN skills s ON a.skill_id = s.id
                WHERE a.skill_id = ?
                """, (skill_id,))
                assessment_row = c.fetchone()
                if not assessment_row:
                    self.send_json(404, {"error": "Assessment not found for skill"})
                    return

                assessment = dict(assessment_row)
                c.execute("""
                SELECT id, assessment_id, subtopic, question, code_snippet, options_json
                FROM assessment_questions
                WHERE assessment_id = ?
                """, (assessment["id"],))
                questions = []
                for row in c.fetchall():
                    q = dict(row)
                    q["options"] = json.loads(q["options_json"])
                    del q["options_json"]
                    questions.append(q)

                assessment["questions"] = questions
                self.send_json(200, assessment)

            elif path == "/api/mentor/history":
                c = conn.cursor()
                c.execute("""
                SELECT * FROM mentor_messages
                WHERE learner_id = ?
                ORDER BY created_at ASC
                """, (learner_id,))
                messages = []
                for row in c.fetchall():
                    m = dict(row)
                    m["metadata"] = json.loads(m["metadata_json"] or "{}")
                    messages.append(m)
                self.send_json(200, messages)

            elif path == "/api/agents/traces":
                limit = int(query.get("limit", [50])[0])
                c = conn.cursor()
                c.execute("""
                SELECT * FROM agent_logs
                ORDER BY id DESC LIMIT ?
                """, (limit,))
                traces = []
                for row in c.fetchall():
                    t = dict(row)
                    t["input"] = json.loads(t["input_json"] or "{}")
                    t["output"] = json.loads(t["output_json"] or "{}")
                    traces.append(t)
                self.send_json(200, traces)

            else:
                # Serve static files
                self.serve_static_file(path)

        except Exception as e:
            self.send_json(500, {"error": str(e), "path": path})
        finally:
            conn.close()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_body()

        conn = get_connection()
        learner_id = "learner_1"

        try:
            if path == "/api/pipeline/run":
                res = AgentOrchestrator.run_full_pipeline(conn, learner_id)
                self.send_json(200, res)

            elif path == "/api/learner/target-role":
                role_id = body.get("role_id")
                if not role_id:
                    self.send_json(400, {"error": "Missing role_id"})
                    return
                res = AgentOrchestrator.switch_target_role(conn, learner_id, role_id)
                self.send_json(200, res)

            elif path == "/api/learner":
                # Update learner info
                name = body.get("name")
                target_role = body.get("target_role")
                weekly_hours = body.get("weekly_hours")
                bio = body.get("bio")
                certifications = body.get("certifications")
                projects = body.get("projects")
                interests = body.get("interests")

                c = conn.cursor()
                c.execute("""
                UPDATE learners
                SET name = COALESCE(?, name),
                    target_role = COALESCE(?, target_role),
                    weekly_hours = COALESCE(?, weekly_hours),
                    bio = COALESCE(?, bio),
                    certifications = COALESCE(?, certifications),
                    projects = COALESCE(?, projects),
                    interests = COALESCE(?, interests)
                WHERE id = ?
                """, (name, target_role, weekly_hours, bio, certifications, projects, interests, learner_id))
                conn.commit()

                # Re-run pipeline to incorporate updates
                res = AgentOrchestrator.run_full_pipeline(conn, learner_id)
                self.send_json(200, res)

            elif path == "/api/learner/skills":
                skill_id = body.get("skill_id")
                self_proficiency = body.get("self_proficiency", 1.0)
                evidence = body.get("evidence", "Learner added skill")

                c = conn.cursor()
                c.execute("""
                INSERT INTO learner_skills (learner_id, skill_id, self_proficiency, verified_proficiency, confidence, evidence, status)
                VALUES (?, ?, ?, 0.0, 0.25, ?, 'unassessed')
                ON CONFLICT(learner_id, skill_id) DO UPDATE SET
                    self_proficiency = excluded.self_proficiency,
                    evidence = excluded.evidence
                """, (learner_id, skill_id, self_proficiency, evidence))
                conn.commit()

                res = AgentOrchestrator.run_full_pipeline(conn, learner_id)
                self.send_json(200, res)

            elif path.startswith("/api/assessments/") and path.endswith("/submit"):
                # URL pattern: /api/assessments/<skill_id>/submit
                parts = path.split("/")
                skill_id = parts[3]
                answers = body.get("answers", {})

                res = AgentOrchestrator.handle_assessment_submission(conn, learner_id, skill_id, answers)
                self.send_json(200, res)

            elif path == "/api/roadmap/item/status":
                item_id = body.get("item_id")
                new_status = body.get("status")
                c = conn.cursor()
                c.execute("UPDATE roadmap_items SET status = ? WHERE id = ?", (new_status, item_id))
                conn.commit()

                self.send_json(200, {"success": True, "item_id": item_id, "status": new_status})

            elif path == "/api/mentor/chat":
                user_msg = body.get("message", "")
                if not user_msg:
                    self.send_json(400, {"error": "Empty message"})
                    return
                res = MentorAgent.answer_query(conn, learner_id, user_msg)
                self.send_json(200, res)

            elif path == "/api/demo/scenario":
                scenario = body.get("scenario")
                c = conn.cursor()

                if scenario == "load_sample" or scenario == "reset":
                    seed_db()
                    AgentOrchestrator.run_full_pipeline(conn, learner_id)
                    self.send_json(200, {"scenario": scenario, "message": "Loaded Sample Scenario (Alex Chen - Full Stack Developer)"})

                elif scenario == "simulate_fail_js":
                    # Struggle on JS: score 25%, weak in closures and scope
                    answers = {"q_js_1": 0, "q_js_2": 0, "q_js_3": 0, "q_js_4": 1}
                    res = AgentOrchestrator.handle_assessment_submission(conn, learner_id, "javascript", answers)
                    self.send_json(200, {
                        "scenario": scenario,
                        "message": "Simulated JS assessment struggle (25%). JavaScript marked remedial, React placed on HOLD.",
                        "result": res
                    })

                elif scenario == "simulate_pass_js":
                    # Pass JS: score 100%
                    answers = {"q_js_1": 0, "q_js_2": 1, "q_js_3": 1, "q_js_4": 0}
                    res = AgentOrchestrator.handle_assessment_submission(conn, learner_id, "javascript", answers)
                    self.send_json(200, {
                        "scenario": scenario,
                        "message": "Simulated JS assessment mastery (100%). JavaScript verified, React unlocked!",
                        "result": res
                    })

                elif scenario == "switch_data_analyst":
                    res = AgentOrchestrator.switch_target_role(conn, learner_id, "data_analyst")
                    self.send_json(200, {
                        "scenario": scenario,
                        "message": "Switched target role to Data Analyst. Re-ran Career Analyst and regenerated adaptive roadmap.",
                        "result": res
                    })

                elif scenario == "switch_full_stack":
                    res = AgentOrchestrator.switch_target_role(conn, learner_id, "full_stack_dev")
                    self.send_json(200, {
                        "scenario": scenario,
                        "message": "Switched target role back to Full Stack Developer.",
                        "result": res
                    })

                else:
                    self.send_json(400, {"error": f"Unknown scenario: {scenario}"})

            else:
                self.send_json(404, {"error": "Not found", "path": path})

        except Exception as e:
            self.send_json(500, {"error": str(e), "path": path})
        finally:
            conn.close()

    def serve_static_file(self, req_path):
        if req_path == "/" or req_path == "":
            req_path = "/index.html"

        # Sanitize path
        rel_path = req_path.lstrip("/")
        full_path = os.path.join(STATIC_DIR, rel_path)

        if os.path.exists(full_path) and os.path.isfile(full_path):
            mime_type, _ = mimetypes.guess_type(full_path)
            if not mime_type:
                mime_type = "text/plain"

            self.send_response(200)
            self.send_header("Content-Type", f"{mime_type}; charset=utf-8")
            self.send_cors_headers()
            self.end_headers()

            with open(full_path, "rb") as f:
                self.wfile.write(f.read())
        else:
            # Fallback to index.html for SPA routing
            index_path = os.path.join(STATIC_DIR, "index.html")
            if os.path.exists(index_path):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_cors_headers()
                self.end_headers()
                with open(index_path, "rb") as f:
                    self.wfile.write(f.read())
            else:
                self.send_json(404, {"error": "File not found", "path": req_path})

def run_server(port=8000):
    init_db()
    # Seed db if empty
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM learners")
    if c.fetchone()[0] == 0:
        seed_db()
        AgentOrchestrator.run_full_pipeline(conn, "learner_1")
    else:
        # Ensure roadmap is generated
        AgentOrchestrator.run_full_pipeline(conn, "learner_1")
    conn.close()

    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, SkillPathHandler)
    print(f"SkillPath AI Server listening at http://localhost:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    run_server(port)
