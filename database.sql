-- LegalPro Elite Database Schema
-- Run this SQL in your PostgreSQL database

-- Create enum types
CREATE TYPE role AS ENUM ('admin', 'lawyer', 'admin_staff', 'accountant', 'limited');
CREATE TYPE case_status AS ENUM ('new', 'active', 'on_hold', 'closed', 'appeal');
CREATE TYPE hearing_status AS ENUM ('scheduled', 'completed', 'postponed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE finance_type AS ENUM ('invoice', 'payment', 'expense');
CREATE TYPE finance_status AS ENUM ('draft', 'pending', 'paid', 'partial', 'overdue', 'approved');

-- Create tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(40) NOT NULL,
  role role NOT NULL DEFAULT 'limited',
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role role NOT NULL,
  module VARCHAR(60) NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_print BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(180) NOT NULL,
  identity_number VARCHAR(60) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(190),
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE legal_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(80) NOT NULL,
  case_name VARCHAR(180) NOT NULL,
  case_type VARCHAR(120) NOT NULL,
  court VARCHAR(160) NOT NULL,
  circuit VARCHAR(160) NOT NULL,
  status case_status NOT NULL DEFAULT 'new',
  start_date DATE NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  opponent VARCHAR(180) NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE case_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  action_title VARCHAR(180) NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  action_date DATE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE hearings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_date DATE NOT NULL,
  hearing_time TIME NOT NULL,
  court VARCHAR(160) NOT NULL,
  hall VARCHAR(120) NOT NULL DEFAULT '',
  case_id UUID NOT NULL REFERENCES legal_cases(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  result TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  reminder_minutes INTEGER NOT NULL DEFAULT 60,
  status hearing_status NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date TIMESTAMPTZ NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  alert_before_minutes INTEGER NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size INTEGER NOT NULL,
  category VARCHAR(120) NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type finance_type NOT NULL,
  title VARCHAR(190) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_id UUID REFERENCES legal_cases(id) ON DELETE SET NULL,
  status finance_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  approved BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  entity_type VARCHAR(120) NOT NULL,
  entity_id VARCHAR(120) NOT NULL DEFAULT '-',
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_legal_cases_client_id ON legal_cases(client_id);
CREATE INDEX idx_legal_cases_lawyer_id ON legal_cases(lawyer_id);
CREATE INDEX idx_case_actions_case_id ON case_actions(case_id);
CREATE INDEX idx_hearings_case_id ON hearings(case_id);
CREATE INDEX idx_hearings_status ON hearings(status);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_documents_client_id ON documents(client_id);
CREATE INDEX idx_documents_case_id ON documents(case_id);
CREATE INDEX idx_finance_entries_client_id ON finance_entries(client_id);
CREATE INDEX idx_finance_entries_case_id ON finance_entries(case_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
