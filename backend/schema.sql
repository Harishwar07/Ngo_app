-- #############################################################################
-- I. CORE TABLES (Users)
-- #############################################################################

-- A central table to manage users who can log in and modify records.
-- This is crucial for tracking `created_by` and `modified_by` fields.
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    -- In a real system, this would store a hash from bcrypt or Argon2
    password_hash VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (user_role IN ('member', 'admin', 'finance', 'super_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- #############################################################################
-- II. FRF ENTITY TABLES
-- #############################################################################

-- --------------
-- 1. STUDENTS
-- --------------
CREATE TABLE students (
    id VARCHAR(50) PRIMARY KEY,
    student_frf_name VARCHAR(255) NOT NULL,
    student_frf_owner INT REFERENCES users(user_id),
    email VARCHAR(255) NOT NULL UNIQUE,
    secondary_email VARCHAR(255),
    email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by_user_id INT REFERENCES users(user_id),
    modified_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Personal Info
    date_of_birth DATE,
    father_name VARCHAR(255),
    blood_group VARCHAR(10),
    mother_name VARCHAR(255),
    parents_contact_number VARCHAR(20),
    address TEXT,
    monthly_income DECIMAL(10, 2),
    permanent_address TEXT,

    -- Education
    "class" VARCHAR(50), -- "class" is a reserved keyword, so it's quoted
    section VARCHAR(10),
    medium VARCHAR(50),
    school VARCHAR(255)
);

CREATE TABLE student_session_logs (
    session_log_id SERIAL PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    course VARCHAR(100),
    topic_covered VARCHAR(255),
    interest_level VARCHAR(50),
    challenges_faced TEXT,
    understanding_level INT CHECK (understanding_level BETWEEN 1 AND 5),
    overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
    remarks TEXT,
    feedback TEXT,
    home_work TEXT
);

-- --------------
-- 2. VOLUNTEERS
-- --------------
CREATE TABLE volunteers (
    id VARCHAR(50) PRIMARY KEY,
    volunteer_frf_name VARCHAR(255) NOT NULL,
    volunteer_frf_owner INT REFERENCES users(user_id),
    volunteer_id VARCHAR(50) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    secondary_email VARCHAR(255),
    email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by_user_id INT REFERENCES users(user_id),
    modified_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Personal Info
    gender VARCHAR(10),
    date_of_birth DATE,
    father_name VARCHAR(255),
    mother_name VARCHAR(255),
    contact_number VARCHAR(20),
    emergency_contact_number VARCHAR(20),
    address TEXT,
    blood_group VARCHAR(10),

    -- Work Info
    company_name VARCHAR(255),
    experience TEXT,
    skill VARCHAR(100),

    -- Proof Details
    id_proof_type VARCHAR(100),
    id_number VARCHAR(100),
    joining_date DATE,
    proof_file_upload TEXT -- URL to file
);

CREATE TABLE volunteer_attendance (
    attendance_id SERIAL PRIMARY KEY,
    volunteer_id VARCHAR(50) NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    attendance_status VARCHAR(20) NOT NULL CHECK (attendance_status IN ('Present', 'Absent')),
    performance TEXT,
    remarks TEXT
);

-- --------------
-- 3. DONORS
-- --------------
CREATE TABLE donors (
    id VARCHAR(50) PRIMARY KEY,
    donor_frf_name VARCHAR(255) NOT NULL,
    donor_frf_owner INT REFERENCES users(user_id),
    donor_id VARCHAR(50) UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    secondary_email VARCHAR(255),
    email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by_user_id INT REFERENCES users(user_id),
    modified_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Donor Details
    donor_type VARCHAR(20) NOT NULL CHECK (donor_type IN ('Individual', 'Corporate')),
    contact_person VARCHAR(255),
    contact_number VARCHAR(20),
    address TEXT
);

CREATE TABLE donations (
    donation_id SERIAL PRIMARY KEY,
    donor_id VARCHAR(50) NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    donation_date DATE NOT NULL,
    transaction_id VARCHAR(100) UNIQUE,
    purpose TEXT,
    receipt_number VARCHAR(100) UNIQUE,
    "80g_receipt_issued" BOOLEAN NOT NULL DEFAULT FALSE,
    acknowledgment_sent BOOLEAN NOT NULL DEFAULT FALSE,
    donor_feedback TEXT,
    remarks TEXT,
    amount DECIMAL(12, 2) NOT NULL
);

-- --------------
-- 4. BOARD OF TRUSTEES
-- --------------
CREATE TABLE board_members (
    id VARCHAR(50) PRIMARY KEY,
    board_frf_name VARCHAR(255) NOT NULL,
    board_frf_owner INT REFERENCES users(user_id),
    email VARCHAR(255) NOT NULL UNIQUE,
    secondary_email VARCHAR(255),
    email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by_user_id INT REFERENCES users(user_id),
    modified_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Personal Info
    gender VARCHAR(10),
    date_of_birth DATE,
    contact_number VARCHAR(20),
    emergency_contact_number VARCHAR(20),
    blood_group VARCHAR(10),
    father_name VARCHAR(255),
    mother_name VARCHAR(255),
    address TEXT,

    -- Proof Details
    id_proof_type VARCHAR(100),
    id_number VARCHAR(100),
    joining_date DATE,
    proof_file_upload TEXT, -- URL to file

    -- Role
    designation VARCHAR(100),
    role_description TEXT,
    tenure_end DATE
);

-- --------------
-- 5. PROJECTS
-- --------------
CREATE TABLE projects (
    id VARCHAR(50) PRIMARY KEY,
    project_frf_name VARCHAR(255) NOT NULL,
    project_frf_owner INT REFERENCES users(user_id),
    project_id VARCHAR(50) UNIQUE,
    email VARCHAR(255),
    secondary_email VARCHAR(255),
    email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by_user_id INT REFERENCES users(user_id),
    modified_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Project Details
    start_date DATE,
    duration VARCHAR(100),
    objective TEXT,
    budget DECIMAL(15, 2),
    budget_utilized DECIMAL(15, 2),
    impact_summary TEXT,
    end_date DATE,
    location VARCHAR(255),
    target_group VARCHAR(255),
    responsible_officer_user_id INT REFERENCES users(user_id),
    status VARCHAR(50) CHECK (status IN ('Planning', 'Ongoing', 'Completed', 'On-Hold'))
);

CREATE TABLE project_attendance_logs (
    project_attendance_log_id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    attent_list TEXT,
    absent_list TEXT,
    overall TEXT,
    remarks TEXT
);

-- --------------
-- 6. FINANCE REPORTS
-- --------------
CREATE TABLE finance_reports (
    id VARCHAR(50) PRIMARY KEY,
    finance_report_frf_name VARCHAR(255) NOT NULL,
    finance_report_frf_owner INT REFERENCES users(user_id),
    project_name VARCHAR(255),
    email VARCHAR(255),
    secondary_email VARCHAR(255),
    email_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modified_by_user_id INT REFERENCES users(user_id),
    modified_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finance_transactions (
    transaction_id SERIAL PRIMARY KEY,
    finance_report_id VARCHAR(50) NOT NULL REFERENCES finance_reports(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    name VARCHAR(255),
    income_amount DECIMAL(12, 2) DEFAULT 0,
    expense_amount DECIMAL(12, 2) DEFAULT 0,
    bill_transaction_id VARCHAR(100),
    gst DECIMAL(5, 2),
    remarks TEXT,
    other_details TEXT
);