-- Fix RLS policy to allow Realtime to deliver bot messages
-- Date: 2025-12-03
-- Issue: CHANNEL_ERROR because users can't see bot messages in their conversations

-- Drop restrictive policy that only allows users to see messages where they are the author
DROP POLICY IF EXISTS "Users can read own messages" ON chat_messages;
DROP POLICY IF EXISTS "Users can read messages in own conversations" ON chat_messages;

-- Create new policy that checks conversation ownership instead of message authorship
-- This allows users to see ALL messages (user, assistant, system) in conversations they own
CREATE POLICY "Users can read messages in own conversations"
ON chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_conversations
    WHERE chat_conversations.id = chat_messages.conversation_id
    AND chat_conversations.user_id = auth.uid()
  )
);

COMMENT ON POLICY "Users can read messages in own conversations" ON chat_messages IS
'Allows users to see all messages (user, assistant, system) in their own conversations. Required for Realtime to deliver bot messages.';

-- Allow users to delete messages in their own conversations
DROP POLICY IF EXISTS "Users can delete messages in own conversations" ON chat_messages;

CREATE POLICY "Users can delete messages in own conversations"
ON chat_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM chat_conversations
    WHERE chat_conversations.id = chat_messages.conversation_id
    AND chat_conversations.user_id = auth.uid()
  )
);

COMMENT ON POLICY "Users can delete messages in own conversations" ON chat_messages IS
'Allows users to delete all messages in their own conversations. Used by the clear chat button.';
