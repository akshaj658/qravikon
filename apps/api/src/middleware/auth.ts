import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env, features } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  params: Record<string, string>;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!features.supabase) {
    res.status(503).json({
      error: 'Authentication is not configured.',
      hint: 'Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.',
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header.' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const supabase = createClient(env.SUPABASE_URL!, env.SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
    };

    next();
  } catch (_err) {
    res.status(500).json({ error: 'Authentication error.' });
  }
}
