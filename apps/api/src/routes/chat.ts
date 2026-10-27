import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { requireSupabase } from '../config/supabase';
import { ApiError } from '../utils/errors';
import { features } from '../config/env';
import { runCopilot, ProjectContext } from '../services/stages.service';
import { ChatMessage } from '../services/ai.service';

const router = Router({ mergeParams: true });

const ChatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

const ConversationTitleSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

const PAGE_SIZE = 500;
const CONVERSATION_LIMIT = 100;

export function getConversationTitle(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'New conversation';
  return normalized.length > 120 ? `${normalized.slice(0, 117).trimEnd()}…` : normalized;
}

function getPreview(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157).trimEnd()}…` : normalized;
}

async function verifyProject(projectId: string, userId: string) {
  const { data: project, error } = await requireSupabase()
    .from('projects')
    .select('id, name, original_idea, current_stage')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new ApiError(500, `Failed to verify project ownership: ${error.message}`);
  if (!project) throw new ApiError(404, 'Project not found or access denied.');
  return project;
}

async function verifyConversation(projectId: string, conversationId: string, userId: string) {
  const { data: conversation, error } = await requireSupabase()
    .from('copilot_conversations')
    .select('id, project_id, user_id, title, last_message_preview, created_at, updated_at')
    .eq('id', conversationId)
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new ApiError(500, `Failed to load Copilot conversation: ${error.message}`);
  if (!conversation) throw new ApiError(404, 'Conversation not found or access denied.');
  return conversation;
}

async function loadConversationMessages(conversationId: string) {
  const db = requireSupabase();
  const messages: Array<{
    id: string;
    project_id: string;
    user_id: string;
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
  }> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from('messages')
      .select('id, project_id, user_id, conversation_id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new ApiError(500, `Failed to load Copilot messages: ${error.message}`);
    messages.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return messages;
  }
}

router.get('/conversations', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await verifyProject(req.params.projectId, req.user!.id);
    const { data: conversations, error } = await requireSupabase()
      .from('copilot_conversations')
      .select('id, project_id, user_id, title, last_message_preview, created_at, updated_at')
      .eq('project_id', req.params.projectId)
      .eq('user_id', req.user!.id)
      .order('updated_at', { ascending: false })
      .limit(CONVERSATION_LIMIT);
    if (error) throw new ApiError(500, `Failed to list Copilot conversations: ${error.message}`);
    res.json({ conversations: conversations ?? [], hasMore: (conversations?.length ?? 0) === CONVERSATION_LIMIT });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const project = await verifyProject(req.params.projectId, req.user!.id);
    const { data: conversation, error } = await requireSupabase()
      .from('copilot_conversations')
      .insert({
        project_id: project.id,
        user_id: req.user!.id,
        title: 'New conversation',
      })
      .select('id, project_id, user_id, title, last_message_preview, created_at, updated_at')
      .single();
    if (error) throw new ApiError(500, `Failed to create Copilot conversation: ${error.message}`);
    res.status(201).json({ conversation });
  } catch (err) {
    next(err);
  }
});

router.get('/conversations/:conversationId', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await verifyProject(req.params.projectId, req.user!.id);
    const conversation = await verifyConversation(req.params.projectId, req.params.conversationId, req.user!.id);
    const messages = await loadConversationMessages(conversation.id);
    res.json({ conversation, messages });
  } catch (err) {
    next(err);
  }
});

router.patch('/conversations/:conversationId', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await verifyProject(req.params.projectId, req.user!.id);
    const body = ConversationTitleSchema.parse(req.body);
    await verifyConversation(req.params.projectId, req.params.conversationId, req.user!.id);
    const { data: conversation, error } = await requireSupabase()
      .from('copilot_conversations')
      .update({ title: body.title, updated_at: new Date().toISOString() })
      .eq('id', req.params.conversationId)
      .eq('project_id', req.params.projectId)
      .eq('user_id', req.user!.id)
      .select('id, project_id, user_id, title, last_message_preview, created_at, updated_at')
      .single();
    if (error) throw new ApiError(500, `Failed to rename Copilot conversation: ${error.message}`);
    res.json({ conversation });
  } catch (err) {
    next(err);
  }
});

router.delete('/conversations/:conversationId', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await verifyProject(req.params.projectId, req.user!.id);
    await verifyConversation(req.params.projectId, req.params.conversationId, req.user!.id);
    const { data, error } = await requireSupabase()
      .from('copilot_conversations')
      .delete()
      .eq('id', req.params.conversationId)
      .eq('project_id', req.params.projectId)
      .eq('user_id', req.user!.id)
      .select('id')
      .single();
    if (error) throw new ApiError(500, `Failed to delete Copilot conversation: ${error.message}`);
    if (!data) throw new ApiError(404, 'Conversation no longer exists.');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/conversations/:conversationId/messages', authenticate, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (!features.ai) {
      res.status(503).json({
        error: 'AI not configured.',
        hint: 'Set AI_API_KEY to enable the copilot.',
        demo: true,
      });
      return;
    }

    const body = ChatSchema.parse(req.body);
    const project = await verifyProject(req.params.projectId, req.user!.id);
    const conversation = await verifyConversation(req.params.projectId, req.params.conversationId, req.user!.id);
    const db = requireSupabase();

    const [
      { data: stagesData, error: stagesError },
      { data: sourcesData, error: sourcesError },
      { data: historyData, error: historyError },
    ] = await Promise.all([
      db.from('workflow_stages')
        .select('stage_key, status, result_data')
        .eq('project_id', project.id),
      db.from('sources')
        .select('title, url, evidence_summary')
        .eq('project_id', project.id)
        .limit(10),
      db.from('messages')
        .select('role, content')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(10),
    ]);
    if (stagesError) throw new ApiError(500, `Failed to load project findings: ${stagesError.message}`);
    if (sourcesError) throw new ApiError(500, `Failed to load project sources: ${sourcesError.message}`);
    if (historyError) throw new ApiError(500, `Failed to load conversation history: ${historyError.message}`);

    const approvedFindings: Record<string, unknown> = {};
    for (const stage of stagesData ?? []) {
      if (stage.status === 'approved' || stage.status === 'completed') {
        approvedFindings[stage.stage_key] = stage.result_data;
      }
    }

    const context: ProjectContext = {
      projectName: project.name,
      idea: project.original_idea,
      currentStage: project.current_stage || 0,
      approvedFindings,
      sources: (sourcesData ?? []).map(source => ({
        title: source.title,
        url: source.url,
        summary: source.evidence_summary,
      })),
    };
    const history: ChatMessage[] = (historyData ?? [])
      .reverse()
      .map(message => ({ role: message.role as 'user' | 'assistant', content: message.content }));

    const { error: saveUserError } = await db.from('messages').insert({
      project_id: project.id,
      user_id: req.user!.id,
      conversation_id: conversation.id,
      role: 'user',
      content: body.message,
    });
    if (saveUserError) throw new ApiError(500, `Failed to save your Copilot message: ${saveUserError.message}`);

    const updatedAt = new Date().toISOString();
    const conversationUpdate = db.from('copilot_conversations')
      .update({
        last_message_preview: getPreview(body.message),
        updated_at: updatedAt,
      })
      .eq('id', conversation.id)
      .eq('project_id', project.id)
      .eq('user_id', req.user!.id);
    const [titleUpdate, previewUpdate] = await Promise.all([
      conversation.title === 'New conversation'
        ? db.from('copilot_conversations')
            .update({ title: getConversationTitle(body.message) })
            .eq('id', conversation.id)
            .eq('project_id', project.id)
            .eq('user_id', req.user!.id)
            .eq('title', 'New conversation')
        : Promise.resolve({ error: null }),
      conversationUpdate,
    ]);
    if (titleUpdate.error || previewUpdate.error) {
      throw new ApiError(500, `Message saved, but failed to update conversation details: ${(titleUpdate.error ?? previewUpdate.error)?.message}`);
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    let fullResponse = '';

    try {
      for await (const chunk of runCopilot(body.message, context, history, features.research)) {
        fullResponse += chunk;
        if (!res.destroyed) res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    } catch (streamError) {
      const message = streamError instanceof Error ? streamError.message : 'Copilot generation failed.';
      if (!res.destroyed) res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    }

    if (fullResponse) {
      const { error: saveAssistantError } = await db.from('messages').insert({
        project_id: project.id,
        user_id: req.user!.id,
        conversation_id: conversation.id,
        role: 'assistant',
        content: fullResponse,
      });
      if (saveAssistantError) {
        if (!res.destroyed) res.write(`data: ${JSON.stringify({ error: `Response generated but could not be saved: ${saveAssistantError.message}` })}\n\n`);
      } else {
        const { error: previewError } = await db.from('copilot_conversations')
          .update({
            last_message_preview: getPreview(fullResponse),
            updated_at: new Date().toISOString(),
          })
          .eq('id', conversation.id)
          .eq('project_id', project.id)
          .eq('user_id', req.user!.id);
        if (previewError && !res.destroyed) {
          res.write(`data: ${JSON.stringify({ error: `Response saved but conversation preview could not be updated: ${previewError.message}` })}\n\n`);
        }
      }
    }

    if (!res.destroyed) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    next(err);
  }
});

export default router;
