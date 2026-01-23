-- SQL Command to create the milestones table for Event Horizon feature
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Exam', 'Application', 'Project')),
  priority TEXT NOT NULL CHECK (priority IN ('High', 'Medium', 'Low')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON milestones(due_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);

-- Enable Row Level Security (RLS)
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own milestones
CREATE POLICY "Users can view their own milestones"
  ON milestones FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can insert their own milestones
CREATE POLICY "Users can insert their own milestones"
  ON milestones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own milestones
CREATE POLICY "Users can update their own milestones"
  ON milestones FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can delete their own milestones
CREATE POLICY "Users can delete their own milestones"
  ON milestones FOR DELETE
  USING (auth.uid() = user_id);
