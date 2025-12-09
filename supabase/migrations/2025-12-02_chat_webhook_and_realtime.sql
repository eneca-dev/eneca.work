-- Migration: Setup webhook trigger for Python agent and RLS policies
-- Date: 2025-12-02
-- Description: Configure database to trigger Python agent webhook on new user messages

-- Enable http extension for webhooks
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create function to notify Python agent via webhook
CREATE OR REPLACE FUNCTION notify_python_agent()
RETURNS trigger AS $$
DECLARE
  webhook_url text := 'https://ai-bot.eneca.work/webhook';
BEGIN
  -- Call webhook asynchronously (fire and forget)
  PERFORM extensions.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'user_id', NEW.user_id,
      'content', NEW.content,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on chat_messages for user messages
DROP TRIGGER IF EXISTS on_user_message_insert ON chat_messages;

CREATE TRIGGER on_user_message_insert
AFTER INSERT ON chat_messages
FOR EACH ROW
WHEN (NEW.role = 'user' AND NEW.kind = 'message')
EXECUTE FUNCTION notify_python_agent();

-- Enable Row Level Security on chat_conversations
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON chat_conversations;

-- Create RLS policies for chat_conversations
CREATE POLICY "Users can read own conversations"
ON chat_conversations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
ON chat_conversations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
ON chat_conversations FOR UPDATE
USING (auth.uid() = user_id);

-- Enable Row Level Security on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON chat_messages;

-- Create RLS policies for chat_messages
CREATE POLICY "Users can read own messages"
ON chat_messages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
ON chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster conversation lookups
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_status
ON chat_conversations(user_id, status, created_at DESC);

-- Create index for faster message lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
ON chat_messages(conversation_id, created_at ASC);

-- Create index for realtime subscriptions
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_kind
ON chat_messages(conversation_id, kind);

COMMENT ON FUNCTION notify_python_agent() IS
'Triggers webhook to Python agent when user sends a message. Python agent will process and insert response back to DB.';

COMMENT ON TRIGGER on_user_message_insert ON chat_messages IS
'Fires webhook to Python agent for each new user message (role=user, kind=message)';
