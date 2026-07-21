import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'YOUR_SUPABASE_URL');
};

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface UserProfile {
  id: string;
  username: string;
  high_score: number;
  max_level: number;
  puzzle_high_score?: number;
  puzzle_max_level?: number;
  total_games: number;
  total_correct: number;
  total_trials: number;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  user_email?: string;
  score: number;
  level_reached: number;
  accuracy: number;
  mode?: 'RECALL' | 'PUZZLE';
  created_at: string;
}

export const isSecretKeyDetected = () => {
  return supabaseAnonKey.startsWith('sb_secret_') || supabaseAnonKey.includes('secret');
};

// Fetch current logged in user from local session storage
export async function getCurrentUserSession() {
  const localSession = localStorage.getItem('pinball_user_session');
  if (localSession) {
    try {
      return JSON.parse(localSession) as { id: string; username: string };
    } catch (e) {
      localStorage.removeItem('pinball_user_session');
    }
  }
  return null;
}

// Sign up new user directly into Supabase database (100% Username & Password, 0 Email)
export async function signUpUser(username: string, pass: string) {
  if (!supabase) throw new Error("Supabase credentials not configured in environment.");
  
  const cleanUser = username.trim();
  if (!cleanUser) throw new Error("Please enter a valid username.");
  if (!pass || pass.length < 3) throw new Error("Password must be at least 3 characters.");

  // 1. Check if username already exists in profiles table
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', cleanUser)
    .maybeSingle();

  if (existingUser) {
    throw new Error("Username already taken. Please choose another username or sign in.");
  }

  // 2. Insert new profile into Supabase database
  const newUserId = crypto.randomUUID();
  const { data: newProfile, error } = await supabase
    .from('profiles')
    .insert({
      id: newUserId,
      username: cleanUser,
      password_hash: pass,
      high_score: 0,
      max_level: 1,
      puzzle_high_score: 0,
      puzzle_max_level: 1,
      total_games: 0,
      total_correct: 0,
      total_trials: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("SignUp Error:", error);
    throw new Error(`Database error: ${error.message}. Make sure SQL table script has been run in Supabase.`);
  }

  const session = { id: newProfile.id, username: newProfile.username };
  localStorage.setItem('pinball_user_session', JSON.stringify(session));
  return session;
}

// Sign in existing user directly from Supabase database (100% Username & Password, 0 Email)
export async function signInUser(username: string, pass: string) {
  if (!supabase) throw new Error("Supabase credentials not configured in environment.");

  const cleanUser = username.trim();
  if (!cleanUser) throw new Error("Please enter your username.");

  // Query profiles for matching username and password
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', cleanUser)
    .eq('password_hash', pass)
    .maybeSingle();

  if (error || !profile) {
    throw new Error("Invalid username or password.");
  }

  const session = { id: profile.id, username: profile.username };
  localStorage.setItem('pinball_user_session', JSON.stringify(session));
  return session;
}

// Sign out
export async function signOutUser() {
  localStorage.removeItem('pinball_user_session');
}

// Fetch user profile stats
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      // Fallback query without puzzle columns if schema not migrated
      const { data: fallbackData } = await supabase
        .from('profiles')
        .select('id, username, high_score, max_level, total_games, total_correct, total_trials')
        .eq('id', userId)
        .maybeSingle();

      if (!fallbackData) return null;
      return {
        id: fallbackData.id,
        username: fallbackData.username || '',
        high_score: fallbackData.high_score || 0,
        max_level: fallbackData.max_level || 1,
        puzzle_high_score: 0,
        puzzle_max_level: 1,
        total_games: fallbackData.total_games || 0,
        total_correct: fallbackData.total_correct || 0,
        total_trials: fallbackData.total_trials || 0,
      };
    }

    return {
      id: data.id,
      username: data.username || '',
      high_score: data.high_score || 0,
      max_level: data.max_level || 1,
      puzzle_high_score: data.puzzle_high_score || 0,
      puzzle_max_level: data.puzzle_max_level || 1,
      total_games: data.total_games || 0,
      total_correct: data.total_correct || 0,
      total_trials: data.total_trials || 0,
    };
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
}

// Save session progress to Supabase
export async function saveUserProgress(
  userId: string,
  username: string,
  sessionScore: number,
  endingLevel: number,
  accuracyPercent: number,
  correctCount: number,
  totalTrialsCount: number,
  mode: 'RECALL' | 'PUZZLE' = 'RECALL'
) {
  if (!supabase) return;

  try {
    const existingProfile = await fetchUserProfile(userId);
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (mode === 'PUZZLE') {
      updates.puzzle_high_score = Math.max(existingProfile?.puzzle_high_score || 0, sessionScore);
      updates.puzzle_max_level = Math.max(existingProfile?.puzzle_max_level || 1, endingLevel);
    } else {
      updates.high_score = Math.max(existingProfile?.high_score || 0, sessionScore);
      updates.max_level = Math.max(existingProfile?.max_level || 1, endingLevel);
    }

    updates.total_games = (existingProfile?.total_games || 0) + 1;
    updates.total_correct = (existingProfile?.total_correct || 0) + correctCount;
    updates.total_trials = (existingProfile?.total_trials || 0) + totalTrialsCount;

    // Try updating profiles with full payload
    const { error: profileErr } = await supabase.from('profiles').update(updates).eq('id', userId);
    if (profileErr) {
      // Fallback if puzzle columns missing in database
      const fallbackUpdates = {
        high_score: Math.max(existingProfile?.high_score || 0, mode === 'RECALL' ? sessionScore : 0),
        max_level: Math.max(existingProfile?.max_level || 1, mode === 'RECALL' ? endingLevel : 1),
        total_games: updates.total_games,
        total_correct: updates.total_correct,
        total_trials: updates.total_trials,
        updated_at: updates.updated_at,
      };
      await supabase.from('profiles').update(fallbackUpdates).eq('id', userId);
    }

    // Try inserting into score_history
    const { error: historyErr } = await supabase.from('score_history').insert({
      user_id: userId,
      username: username,
      score: sessionScore,
      level_reached: endingLevel,
      accuracy: accuracyPercent,
      game_mode: mode,
    });

    if (historyErr) {
      await supabase.from('score_history').insert({
        user_id: userId,
        username: username,
        score: sessionScore,
        level_reached: endingLevel,
        accuracy: accuracyPercent,
      });
    }
  } catch (err) {
    console.error("Failed to sync progress to Supabase:", err);
  }
}

// Fetch Global Leaderboard Top Scores (Ranks users by their personal top high score per mode)
export async function fetchGlobalLeaderboard(mode: 'RECALL' | 'PUZZLE' = 'RECALL'): Promise<LeaderboardEntry[]> {
  const localEntries: LeaderboardEntry[] = [];
  
  // Get current logged-in user & local highscore
  const session = await getCurrentUserSession();
  const localScoreKey = mode === 'PUZZLE' ? 'pinball_highscore_puzzle' : 'pinball_highscore_recall';
  const localLevelKey = mode === 'PUZZLE' ? 'pinball_maxlevel_puzzle' : 'pinball_maxlevel_recall';
  const localScore = parseInt(localStorage.getItem(localScoreKey) || (mode === 'RECALL' ? localStorage.getItem('pinball_highscore') || '0' : '0'), 10);
  const localLevel = parseInt(localStorage.getItem(localLevelKey) || (mode === 'RECALL' ? localStorage.getItem('pinball_maxlevel') || '1' : '1'), 10);

  if (session && session.username && localScore > 0) {
    localEntries.push({
      id: `local-${session.id}`,
      user_id: session.id,
      username: session.username,
      score: localScore,
      level_reached: localLevel,
      accuracy: 100,
      mode: mode,
      created_at: new Date().toISOString(),
    });
  }

  if (!supabase) return localEntries;

  let remoteEntries: LeaderboardEntry[] = [];

  try {
    const targetScoreCol = mode === 'PUZZLE' ? 'puzzle_high_score' : 'high_score';
    const targetLevelCol = mode === 'PUZZLE' ? 'puzzle_max_level' : 'max_level';

    // 1. Try querying profiles table ordered by target score column descending
    const { data, error } = await supabase
      .from('profiles')
      .select(`id, username, ${targetScoreCol}, ${targetLevelCol}, updated_at`)
      .order(targetScoreCol, { ascending: false })
      .limit(25);

    if (!error && data && data.length > 0) {
      remoteEntries = data
        .filter((profile: any) => (profile[targetScoreCol] || 0) > 0)
        .map((profile: any) => ({
          id: profile.id,
          user_id: profile.id,
          username: profile.username || 'Player',
          score: profile[targetScoreCol] || 0,
          level_reached: profile[targetLevelCol] || 1,
          accuracy: 100,
          mode: mode,
          created_at: profile.updated_at || new Date().toISOString()
        }));
    } else {
      // 2. Fallback query score_history
      const { data: historyData, error: historyErr } = await supabase
        .from('score_history')
        .select('*')
        .eq('game_mode', mode)
        .order('score', { ascending: false })
        .limit(25);

      if (!historyErr && historyData && historyData.length > 0) {
        remoteEntries = historyData.map((item: any) => ({
          id: item.id,
          user_id: item.user_id || item.id,
          username: item.username || item.user_email || 'Player',
          score: item.score,
          level_reached: item.level_reached,
          accuracy: item.accuracy || 100,
          mode: mode,
          created_at: item.created_at
        }));
      }
    }
  } catch (err) {
    console.error("Error fetching global leaderboard:", err);
  }

  // Merge remoteEntries with localEntries, avoiding duplicate usernames, and sort descending by score
  const map = new Map<string, LeaderboardEntry>();

  remoteEntries.forEach(entry => {
    map.set(entry.username.toLowerCase(), entry);
  });

  localEntries.forEach(entry => {
    const existing = map.get(entry.username.toLowerCase());
    if (!existing || entry.score > existing.score) {
      map.set(entry.username.toLowerCase(), entry);
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => b.score - a.score);
  return merged;
}
