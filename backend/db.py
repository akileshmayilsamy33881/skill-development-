"""
SkillPath AI - Database and Seed Module
SQLite database with relational schema matching hackathon requirements.
"""

import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skillpath.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()

    # Create tables
    c.execute("""
    CREATE TABLE IF NOT EXISTS learners (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        password TEXT DEFAULT 'skilldev@2026',
        target_role TEXT NOT NULL,
        weekly_hours INTEGER DEFAULT 10,
        bio TEXT,
        certifications TEXT,
        projects TEXT,
        interests TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        icon TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS skill_prerequisites (
        skill_id TEXT NOT NULL,
        prerequisite_id TEXT NOT NULL,
        PRIMARY KEY (skill_id, prerequisite_id),
        FOREIGN KEY (skill_id) REFERENCES skills(id),
        FOREIGN KEY (prerequisite_id) REFERENCES skills(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS learner_skills (
        learner_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        self_proficiency REAL DEFAULT 0.0,
        verified_proficiency REAL DEFAULT 0.0,
        confidence REAL DEFAULT 0.0,
        evidence TEXT,
        status TEXT DEFAULT 'unassessed',
        PRIMARY KEY (learner_id, skill_id),
        FOREIGN KEY (learner_id) REFERENCES learners(id),
        FOREIGN KEY (skill_id) REFERENCES skills(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        icon TEXT
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS role_skills (
        role_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        required_level REAL NOT NULL,
        priority TEXT DEFAULT 'must_have',
        rationale TEXT,
        PRIMARY KEY (role_id, skill_id),
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (skill_id) REFERENCES skills(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        estimated_hours REAL NOT NULL,
        difficulty TEXT DEFAULT 'intermediate',
        description TEXT,
        FOREIGN KEY (skill_id) REFERENCES skills(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS roadmap_items (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        resource_id TEXT,
        sequence INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        is_remedial INTEGER DEFAULT 0,
        hold_reason TEXT,
        notes TEXT,
        FOREIGN KEY (learner_id) REFERENCES learners(id),
        FOREIGN KEY (skill_id) REFERENCES skills(id),
        FOREIGN KEY (resource_id) REFERENCES resources(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS assessments (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL,
        title TEXT NOT NULL,
        passing_score INTEGER DEFAULT 65,
        description TEXT,
        FOREIGN KEY (skill_id) REFERENCES skills(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS assessment_questions (
        id TEXT PRIMARY KEY,
        assessment_id TEXT NOT NULL,
        subtopic TEXT NOT NULL,
        question TEXT NOT NULL,
        code_snippet TEXT,
        options_json TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation TEXT,
        FOREIGN KEY (assessment_id) REFERENCES assessments(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS assessment_results (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        score REAL NOT NULL,
        subtopic_scores_json TEXT,
        feedback TEXT,
        passed INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (learner_id) REFERENCES learners(id),
        FOREIGN KEY (skill_id) REFERENCES skills(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS mentor_messages (
        id TEXT PRIMARY KEY,
        learner_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (learner_id) REFERENCES learners(id)
    )
    """)

    c.execute("""
    CREATE TABLE IF NOT EXISTS agent_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        step TEXT NOT NULL,
        input_json TEXT,
        output_json TEXT,
        explanation TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()

def seed_db():
    conn = get_connection()
    c = conn.cursor()

    # Clear existing data
    tables = [
        "agent_logs", "mentor_messages", "assessment_results", "assessment_questions",
        "assessments", "roadmap_items", "resources", "role_skills", "roles",
        "learner_skills", "skill_prerequisites", "skills", "learners"
    ]
    for table in tables:
        c.execute(f"DELETE FROM {table}")

    # Seed Skills
    skills = [
        ("html_css", "HTML & CSS", "Frontend", "Semantic web structures, responsive layout with Flexbox & Grid, accessible UI components.", "Globe"),
        ("javascript", "JavaScript Fundamentals", "Frontend", "Modern ES6+ syntax, asynchronous programming, DOM manipulation, closures, and events.", "FileCode"),
        ("react", "React & Component Architecture", "Frontend", "Declarative UI, component lifecycle, hooks, state management, and SPA architecture.", "Layers"),
        ("nodejs", "Node.js & Express REST APIs", "Backend", "Event loop, asynchronous server runtime, Express routing, middleware, and HTTP APIs.", "Server"),
        ("python", "Python Programming", "Backend/Data", "General-purpose language for scripting, backend services, data pipelines, and automation.", "Terminal"),
        ("sql", "SQL & Relational Databases", "Database", "Schema design, complex queries, joins, indexes, ACID transactions, and normalization.", "Database"),
        ("git", "Git & Version Control", "DevOps", "Distributed version control, branch workflows, merge resolution, and collaborative PRs.", "GitBranch"),
        ("docker", "Docker & Containerization", "DevOps", "Container images, multi-stage Dockerfiles, networking, and microservices orchestration.", "Box"),
        ("pandas", "Pandas & Data Wrangling", "Data", "DataFrames, data cleaning, aggregation, exploratory data analysis, and feature prep.", "Table"),
        ("ml_basics", "Machine Learning Fundamentals", "AI/Data", "Supervised and unsupervised algorithms, model evaluation, cross-validation, and metrics.", "Cpu")
    ]
    c.executemany("INSERT INTO skills (id, name, category, description, icon) VALUES (?, ?, ?, ?, ?)", skills)

    # Seed Prerequisites
    prereqs = [
        ("react", "javascript"),
        ("nodejs", "javascript"),
        ("docker", "git"),
        ("pandas", "python"),
        ("ml_basics", "python"),
        ("ml_basics", "pandas"),
        ("ml_basics", "sql")
    ]
    c.executemany("INSERT INTO skill_prerequisites (skill_id, prerequisite_id) VALUES (?, ?)", prereqs)

    # Seed Roles
    roles = [
        ("full_stack_dev", "Full Stack Developer", "Software Engineering", "Builds end-to-end web applications across responsive frontends, server APIs, and relational databases.", "Code2"),
        ("data_analyst", "Data Analyst", "Data & Analytics", "Transforms raw corporate data into actionable business intelligence using SQL, Python, and visualizations.", "BarChart3"),
        ("ml_engineer", "Machine Learning Engineer", "Artificial Intelligence", "Designs and trains production-grade machine learning models and data pipelines at scale.", "Brain"),
        ("devops_engineer", "DevOps / Cloud Engineer", "Infrastructure", "Automates CI/CD deployments, manages cloud infrastructure, and monitors containerized microservices.", "Cloud")
    ]
    c.executemany("INSERT INTO roles (id, title, category, description, icon) VALUES (?, ?, ?, ?, ?)", roles)

    # Seed Role Skills (Required level 1-5, priority, rationale)
    role_skills = [
        # Full Stack Developer
        ("full_stack_dev", "html_css", 3.0, "must_have", "Essential for building accessible, responsive user interfaces and styling web components."),
        ("full_stack_dev", "javascript", 4.0, "must_have", "The foundational language of both browser client logic and Node.js backend runtimes."),
        ("full_stack_dev", "react", 3.5, "must_have", "Standard component framework for interactive, dynamic frontend web applications."),
        ("full_stack_dev", "nodejs", 3.5, "must_have", "Powers backend server logic, RESTful API endpoints, and database connectivity."),
        ("full_stack_dev", "sql", 3.0, "must_have", "Critical for relational database schema design, querying, and persistent data storage."),
        ("full_stack_dev", "git", 3.0, "must_have", "Required for code versioning, team collaboration, and deploying production branches."),
        ("full_stack_dev", "python", 2.0, "recommended", "Helpful for backend utilities, data scripting, and automation tasks."),

        # Data Analyst
        ("data_analyst", "sql", 4.5, "must_have", "Core daily tool for querying data warehouses, joins, window functions, and analytics."),
        ("data_analyst", "python", 4.0, "must_have", "Indispensable for scripting, data wrangling, automation, and statistical analysis."),
        ("data_analyst", "pandas", 4.5, "must_have", "The primary library for tabular data cleaning, grouping, filtering, and metric calculation."),
        ("data_analyst", "git", 2.5, "recommended", "Ensures version control and reproducibility for analytics scripts and reporting notebooks."),
        ("data_analyst", "ml_basics", 2.0, "optional", "Beneficial for predictive forecasting and automated trend detection."),

        # Machine Learning Engineer
        ("ml_engineer", "python", 5.0, "must_have", "Mastery required for writing performant model training code, pipelines, and tests."),
        ("ml_engineer", "pandas", 4.0, "must_have", "Used for feature engineering, data preprocessing, and dataset validation."),
        ("ml_engineer", "ml_basics", 4.5, "must_have", "In-depth understanding of loss functions, gradient descent, overfitting, and validation."),
        ("ml_engineer", "sql", 3.5, "must_have", "Retrieves training samples and feature tables from enterprise data lakes."),
        ("ml_engineer", "docker", 3.5, "must_have", "Packages training environments and model inference containers for cloud serving."),
        ("ml_engineer", "git", 3.5, "must_have", "Maintains reproducible code, model configs, and CI/CD pipeline triggers."),

        # DevOps Engineer
        ("devops_engineer", "git", 4.5, "must_have", "Foundational for GitOps, code branching strategies, and CI/CD webhook integrations."),
        ("devops_engineer", "docker", 4.5, "must_have", "Core container runtime for building, testing, and deploying microservice environments."),
        ("devops_engineer", "python", 3.5, "must_have", "Essential for infrastructure automation, custom CLI tooling, and cloud scripting."),
        ("devops_engineer", "sql", 2.5, "recommended", "Needed for database migrations, automated backups, and health monitoring.")
    ]
    c.executemany("INSERT INTO role_skills (role_id, skill_id, required_level, priority, rationale) VALUES (?, ?, ?, ?, ?)", role_skills)

    # Seed Resources
    resources = [
        # HTML/CSS
        ("res_html_css_1", "html_css", "Responsive Web Design Certification", "interactive", "https://www.freecodecamp.org/learn/2022/responsive-web-design/", 15.0, "beginner", "Hands-on project-based course building responsive web pages with Flexbox and CSS Grid."),
        ("res_html_css_2", "html_css", "Build a Personal Developer Portfolio", "project", "https://developer.mozilla.org/en-US/docs/Learn/Getting_started_with_the_web", 8.0, "beginner", "Create a responsive multi-page portfolio website showcasing your projects, skills, and contact form."),
        ("res_html_css_3", "html_css", "CSS Flexbox & Grid Deep Dive", "article", "https://css-tricks.com/snippets/css/a-guide-to-flexbox/", 4.0, "beginner", "Visual guide mastering alignment, wrapping, gap, and responsive 2D grid layouts."),

        # JavaScript
        ("res_js_1", "javascript", "JavaScript Fundamentals & ES6+ Mastery", "interactive", "https://javascript.info/", 20.0, "beginner", "Comprehensive deep dive into variables, closures, arrow functions, promises, and the event loop."),
        ("res_js_2", "javascript", "Targeted Drill: Functions, Scope & Closures", "remedial_drill", "https://frontendmasters.com/courses/javascript-hard-parts-v2/", 6.0, "intermediate", "Targeted practice on call stacks, execution contexts, lexical scoping, and array reduction."),
        ("res_js_3", "javascript", "Build an Interactive Task & Filter App", "project", "https://www.theodinproject.com/lessons/node-path-javascript-todo-list", 12.0, "intermediate", "Pure vanilla JavaScript application with dynamic DOM rendering, local storage, and event delegation."),

        # React
        ("res_react_1", "react", "React Official Documentation: Quick Start & Hooks", "article", "https://react.dev/learn", 14.0, "intermediate", "Learn component state, props, effect lifecycles, and interactive form handling."),
        ("res_react_2", "react", "Build a Multi-Step Dashboard with State", "project", "https://github.com/tastejs/todomvc/tree/gh-pages/examples/react", 12.0, "intermediate", "Create a feature-rich dashboard with filtering, search, modal dialogs, and reusable component library."),

        # Node.js
        ("res_node_1", "nodejs", "Building RESTful APIs with Node.js & Express", "interactive", "https://expressjs.com/en/starter/installing.html", 15.0, "intermediate", "Design clean REST endpoints, request validation, middleware, error handling, and JSON payloads."),
        ("res_node_2", "nodejs", "Full-Stack API Integration with PostgreSQL/SQLite", "project", "https://fullstackopen.com/en/part3", 14.0, "intermediate", "Connect Express controllers to a database with CRUD queries, parameter binding, and auth headers."),

        # SQL
        ("res_sql_1", "sql", "SQL Murder Mystery & Interactive Drills", "interactive", "https://mystery.knightlab.com/", 6.0, "beginner", "Engaging interactive scenario solving a crime using complex JOINs, GROUP BY, and subqueries."),
        ("res_sql_2", "sql", "Advanced SQL Joins & Schema Design Lab", "project", "https://mode.com/sql-tutorial/", 10.0, "intermediate", "Hands-on data modeling: primary keys, foreign keys, indexing strategies, and aggregation performance."),

        # Python
        ("res_py_1", "python", "Python for Everybody & Data Structures", "interactive", "https://www.py4e.com/", 12.0, "beginner", "Foundations of Python syntax, dictionaries, lists, file handling, and modular code design."),
        ("res_py_2", "python", "Automate Data Pipelines & CLI Tools", "project", "https://automatetheboringstuff.com/", 10.0, "intermediate", "Build production command-line scripts to parse CSV/JSON, automate workflows, and handle exceptions."),

        # Git
        ("res_git_1", "git", "Version Control with Git & GitHub", "interactive", "https://learngitbranching.js.org/", 5.0, "beginner", "Visual interactive branching, commit rebasing, cherry-picking, and remote push/pull workflow."),
        ("res_git_2", "git", "Deploy a Full-Stack Portfolio to Cloud", "project", "https://render.com/docs", 6.0, "intermediate", "Configure Git hooks, automated GitHub Actions testing, and deployment to cloud hosts."),

        # Pandas
        ("res_pandas_1", "pandas", "Pandas Data Analysis & Transformation Bootcamp", "interactive", "https://pandas.pydata.org/docs/user_guide/index.html", 14.0, "intermediate", "Indexing, filtering, grouping, merging DataFrames, and handling missing values."),
        ("res_pandas_2", "pandas", "End-to-End Business KPI Analytics Project", "project", "https://www.kaggle.com/learn/pandas", 12.0, "intermediate", "Analyze real-world sales records, build automated cohort retention tables, and export reports."),

        # Docker
        ("res_docker_1", "docker", "Docker for Developers: From Scratch to Compose", "interactive", "https://docker-curriculum.com/", 10.0, "intermediate", "Containerization fundamentals, multi-stage builds, port mapping, and docker-compose orchestration."),

        # ML Basics
        ("res_ml_1", "ml_basics", "Machine Learning Crash Course with Scikit-Learn", "interactive", "https://scikit-learn.org/stable/tutorial/index.html", 18.0, "advanced", "Supervised classification, regression, train/test split, hyperparameter tuning, and ROC-AUC metrics.")
    ]
    c.executemany("INSERT INTO resources (id, skill_id, title, type, url, estimated_hours, difficulty, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", resources)

    # Seed Assessments
    assessments = [
        ("assess_js", "javascript", "JavaScript Core Competency Assessment", 65, "Validates foundational ES6 syntax, functions & lexical scope, array mutations, and asynchronous execution."),
        ("assess_html_css", "html_css", "HTML5 & Modern CSS Layout Assessment", 65, "Evaluates semantic elements, responsive design patterns with Flexbox and Grid, and the CSS box model."),
        ("assess_sql", "sql", "SQL Querying & Relational Modeling Assessment", 65, "Tests relational database retrieval, multi-table JOIN mechanics, aggregation filtering, and index awareness."),
        ("assess_python", "python", "Python Syntax & Core Idioms Assessment", 65, "Assesses list comprehensions, dictionary operations, exception handling, and modular function design."),
        ("assess_react", "react", "React Fundamentals & Hook Patterns Assessment", 65, "Checks component breakdown, state isolation, useEffect dependencies, and parent-child prop flow.")
    ]
    c.executemany("INSERT INTO assessments (id, skill_id, title, passing_score, description) VALUES (?, ?, ?, ?, ?)", assessments)

    # Seed Assessment Questions
    questions = [
        # JavaScript Questions
        ("q_js_1", "assess_js", "Variables & Hoisting", "What is logged to the console when executing this snippet?",
         "console.log(a);\nvar a = 10;\nconsole.log(b);\nlet b = 20;",
         json.dumps(["undefined, then ReferenceError for b", "10, then 20", "ReferenceError for a, then undefined", "undefined, then undefined"]),
         0, "Variables declared with `var` are hoisted and initialized to `undefined`, whereas `let` is hoisted in a Temporal Dead Zone causing a ReferenceError."),

        ("q_js_2", "assess_js", "Functions & Scope", "What does the outer function call return in this closure example?",
         "function createCounter() {\n  let count = 0;\n  return function() {\n    count += 1;\n    return count;\n  };\n}\nconst c1 = createCounter();\nc1();\nconsole.log(c1());",
         json.dumps(["1", "2", "undefined", "NaN"]),
         1, "The returned inner function maintains a lexical closure over the variable `count`. The first invocation increments it to 1, and the second to 2."),

        ("q_js_3", "assess_js", "Arrays & Functional Methods", "Which method returns a new array containing only elements that satisfy a predicate condition without mutating the original array?",
         "const numbers = [1, 2, 3, 4, 5];\n// Desired: [2, 4]",
         json.dumps(["numbers.map(n => n % 2 === 0)", "numbers.filter(n => n % 2 === 0)", "numbers.forEach(n => n % 2 === 0)", "numbers.splice(n => n % 2 === 0)"]),
         1, "`.filter()` returns a new shallow array copy with elements that pass the truth test. `.map()` transforms each item, `.forEach()` returns undefined, and `.splice()` mutates in-place."),

        ("q_js_4", "assess_js", "Asynchronous Execution", "In what order will numbers be printed?",
         "console.log(1);\nsetTimeout(() => console.log(2), 0);\nPromise.resolve().then(() => console.log(3));\nconsole.log(4);",
         json.dumps(["1, 4, 3, 2", "1, 2, 3, 4", "1, 4, 2, 3", "1, 3, 4, 2"]),
         0, "Synchronous code runs first (1, 4). Microtasks from Promise resolution run next (3). Macrotasks from setTimeout run in the next event loop tick (2)."),

        # HTML/CSS Questions
        ("q_hc_1", "assess_html_css", "Semantic HTML", "Which HTML5 tag is most appropriate for the primary navigation block of a web page?",
         None,
         json.dumps(["<div class='menu'>", "<nav>", "<section id='links'>", "<header>"]),
         1, "<nav> is the standard semantic tag for major navigation blocks, enabling assistive screen readers to recognize navigation landmarks."),

        ("q_hc_2", "assess_html_css", "CSS Flexbox", "Which Flexbox property aligns items along the cross axis (perpendicular to flex-direction)?",
         None,
         json.dumps(["justify-content", "align-items", "flex-wrap", "align-self"]),
         1, "`align-items` controls alignment along the cross axis, whereas `justify-content` distributes items along the main axis."),

        ("q_hc_3", "assess_html_css", "CSS Box Model", "If an element has `width: 200px`, `padding: 20px`, and `border: 5px solid black`, what is its total rendered width when `box-sizing: border-box` is set?",
         None,
         json.dumps(["250px", "200px", "225px", "240px"]),
         1, "Under `box-sizing: border-box`, padding and border are included inside the specified width, maintaining the total rendered width at 200px."),

        # SQL Questions
        ("q_sql_1", "assess_sql", "Multi-Table JOINs", "Which JOIN returns all rows from the left table even if there are no matching rows in the right table?",
         None,
         json.dumps(["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "FULL OUTER JOIN"]),
         1, "LEFT JOIN (or LEFT OUTER JOIN) preserves every record from the left table, filling NULL values for right table columns when no match exists."),

        ("q_sql_2", "assess_sql", "Aggregation Filtering", "Which clause is used to filter aggregated results produced by a `GROUP BY` clause?",
         "SELECT department, COUNT(*) \nFROM employees \nGROUP BY department \n/* WHERE or HAVING? */ COUNT(*) > 5;",
         json.dumps(["WHERE", "HAVING", "LIMIT", "FILTER"]),
         1, "The `HAVING` clause filters aggregated data post-grouping, whereas `WHERE` filters rows prior to aggregation."),

        ("q_sql_3", "assess_sql", "Indexing & Optimization", "What is the primary trade-off of adding indexes to multiple columns in a relational table?",
         None,
         json.dumps(["Faster SELECT queries, but slower INSERT/UPDATE/DELETE and increased storage", "Slower SELECT queries, but faster writes", "Prevents duplicate rows entirely", "Eliminates the need for foreign keys"]),
         0, "Indexes create B-tree structures that accelerate reads, but each write operation requires updating the index trees, increasing overhead and storage."),

        # Python Questions
        ("q_py_1", "assess_python", "List Comprehensions", "What will the following comprehension evaluate to?",
         "squares = [x**2 for x in range(5) if x % 2 == 1]",
         json.dumps(["[1, 9]", "[0, 1, 4, 9, 16]", "[1, 4, 9]", "[0, 4, 16]"]),
         0, "range(5) produces 0, 1, 2, 3, 4. The odd numbers are 1 and 3, whose squares are 1 and 9."),

        ("q_py_2", "assess_python", "Dictionary & Default Handling", "Which dictionary method safely retrieves a value without raising a KeyError if the key is missing?",
         None,
         json.dumps(["dict[key]", "dict.get(key, default)", "dict.find(key)", "dict.lookup(key)"]),
         1, "`.get(key, default)` returns the provided default (or None) if the key is missing, avoiding a KeyError.")
    ]
    c.executemany("INSERT INTO assessment_questions (id, assessment_id, subtopic, question, code_snippet, options_json, correct_index, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", questions)

    # Seed Default Learner Profile: Alex Chen (Exact Sample Scenario from Hackathon brief)
    # Goal: Full Stack Developer
    # Starting skills: Python, SQL, basic HTML
    c.execute("""
    INSERT INTO learners (id, name, email, password, target_role, weekly_hours, bio, certifications, projects, interests)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "learner_1",
        "Alex Chen",
        "alex.chen@gmail.com",
        "skilldev@2026",
        "full_stack_dev",
        12,
        "Aspiring full-stack engineer transitioning from data scripting into full-stack product development.",
        "Python for Everybody (Coursera Specialization), Database Foundations Certificate",
        "Automated CSV Invoice Cleaner (Python script), Student Grades Portal (CLI + SQLite)",
        "Modern web apps, full-stack architectures, interactive dashboards, cloud deployment"
    ))

    # Learner Starting Skills matching Section 3 scenario
    learner_skills = [
        # HTML/CSS: Basic HTML reported; CSS unverified
        ("learner_1", "html_css", 2.0, 1.2, 0.35, "Self-reported basic HTML tags; CSS styling unverified", "unassessed"),
        # JavaScript: Gap
        ("learner_1", "javascript", 0.0, 0.0, 0.0, "No prior experience reported", "gap"),
        # React: Gap
        ("learner_1", "react", 0.0, 0.0, 0.0, "No prior experience reported", "gap"),
        # Node.js / Express: Gap
        ("learner_1", "nodejs", 0.0, 0.0, 0.0, "No prior experience reported", "gap"),
        # SQL: Reported skill; proficiency unverified
        ("learner_1", "sql", 3.0, 2.0, 0.50, "Coursework project with SQLite; basic SELECT and JOIN queries", "unassessed"),
        # Git: Not provided
        ("learner_1", "git", 0.0, 0.0, 0.0, "No version control experience provided", "gap"),
        # Python: Strong background from prior projects
        ("learner_1", "python", 3.5, 3.0, 0.70, "Data analysis scripts in college, automated invoice cleaner", "verified")
    ]
    c.executemany("INSERT INTO learner_skills (learner_id, skill_id, self_proficiency, verified_proficiency, confidence, evidence, status) VALUES (?, ?, ?, ?, ?, ?, ?)", learner_skills)

    # Seed initial welcome mentor message
    initial_mentor_msg = (
        "Welcome Alex! I've analyzed your profile and target goal of **Full Stack Developer**. "
        "You bring solid foundations in Python and SQL, but full-stack roles require proven mastery of "
        "HTML/CSS, modern JavaScript, React, and Node.js. "
        "Our roadmap prioritizes verifying your HTML/CSS and SQL fundamentals first, before advancing to "
        "JavaScript and React. Feel free to ask me anything about your roadmap or assessment results!"
    )
    c.execute("""
    INSERT INTO mentor_messages (id, learner_id, sender, message, metadata_json)
    VALUES (?, ?, ?, ?, ?)
    """, ("msg_init_1", "learner_1", "mentor", initial_mentor_msg, json.dumps({"source": "system_init"})))

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    seed_db()
    print("Database initialized and seeded successfully at:", DB_PATH)
