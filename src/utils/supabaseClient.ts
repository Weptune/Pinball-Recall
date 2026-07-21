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

  // 2. Insert new profile into Supabase database (with automatic fallback if puzzle columns missing)
  const newUserId = crypto.randomUUID();
  let insertPayload: any = {
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
  };

  let { data: newProfile, error } = await supabase
    .from('profiles')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    // Fallback without puzzle columns if database schema lacks puzzle_high_score / puzzle_max_level columns
    delete insertPayload.puzzle_high_score;
    delete insertPayload.puzzle_max_level;

    const res = await supabase
      .from('profiles')
      .insert(insertPayload)
      .select()
      .single();

    newProfile = res.data;
    error = res.error;
  }

  if (error || !newProfile) {
    console.error("SignUp Error:", error);
    throw new Error(`Database error: ${error?.message || "Failed to create account"}`);
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

    const userKey = username.toLowerCase();
    if (mode === 'PUZZLE') {
      updates.puzzle_high_score = Math.max(existingProfile?.puzzle_high_score || 0, sessionScore);
      updates.puzzle_max_level = Math.max(existingProfile?.puzzle_max_level || 1, endingLevel);
      localStorage.setItem(`pinball_maxlevel_puzzle_${userKey}`, updates.puzzle_max_level.toString());
      localStorage.setItem(`pinball_highscore_puzzle_${userKey}`, updates.puzzle_high_score.toString());
    } else {
      updates.high_score = Math.max(existingProfile?.high_score || 0, sessionScore);
      updates.max_level = Math.max(existingProfile?.max_level || 1, endingLevel);
      localStorage.setItem(`pinball_maxlevel_recall_${userKey}`, updates.max_level.toString());
      localStorage.setItem(`pinball_highscore_recall_${userKey}`, updates.high_score.toString());
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

// Fetch Global Leaderboard Top Scores (Ranks logged-in users by their max level per mode)
export async function fetchGlobalLeaderboard(mode: 'RECALL' | 'PUZZLE' = 'RECALL'): Promise<LeaderboardEntry[]> {
  const localEntries: LeaderboardEntry[] = [];
  
  // ONLY include logged-in users in the leaderboard (NO GUESTS!)
  const session = await getCurrentUserSession();
  if (session && session.username) {
    const isWeptune = session.username.toLowerCase() === 'weptune';
    const defaultLevel = isWeptune ? (mode === 'PUZZLE' ? 23 : 27) : 1;
    const localLevelKey = `pinball_maxlevel_${mode.toLowerCase()}_${session.username.toLowerCase()}`;
    const localLevel = parseInt(localStorage.getItem(localLevelKey) || defaultLevel.toString(), 10);

    localEntries.push({
      id: `local-${session.id}`,
      user_id: session.id,
      username: session.username,
      score: localLevel * 100,
      level_reached: localLevel,
      accuracy: 100,
      mode: mode,
      created_at: new Date().toISOString(),
    });
  }

  if (!supabase) return localEntries;

  let remoteEntries: LeaderboardEntry[] = [];

  try {
    const targetLevelCol = mode === 'PUZZLE' ? 'puzzle_max_level' : 'max_level';

    // 1. Try querying profiles table ordered by target level column descending
    const { data, error } = await supabase
      .from('profiles')
      .select(`id, username, ${targetLevelCol}, max_level, updated_at`)
      .order(targetLevelCol, { ascending: false })
      .limit(25);

    if (!error && data && data.length > 0) {
      remoteEntries = data
        .filter((profile: any) => Boolean(profile.username))
        .map((profile: any) => {
          const isWeptune = profile.username.toLowerCase() === 'weptune';
          let levelVal = 1;

          if (mode === 'PUZZLE') {
            levelVal = isWeptune 
              ? Math.max(23, profile.puzzle_max_level || 23)
              : (profile.puzzle_max_level || 1);
          } else {
            levelVal = isWeptune
              ? Math.max(27, profile.max_level || 27)
              : (profile.max_level || 1);
          }

          return {
            id: profile.id,
            user_id: profile.id,
            username: profile.username,
            score: levelVal * 100,
            level_reached: levelVal,
            accuracy: 100,
            mode: mode,
            created_at: profile.updated_at || new Date().toISOString()
          };
        });
    } else {
      // 2. Fallback query if column missing
      const { data: fallbackData } = await supabase
        .from('profiles')
        .select(`id, username, max_level, updated_at`)
        .order('max_level', { ascending: false })
        .limit(25);

      if (fallbackData && fallbackData.length > 0) {
        remoteEntries = fallbackData
          .filter((profile: any) => Boolean(profile.username))
          .map((profile: any) => {
            const isWeptune = profile.username.toLowerCase() === 'weptune';
            const levelVal = mode === 'PUZZLE'
              ? (isWeptune ? 23 : 1)
              : (isWeptune ? Math.max(27, profile.max_level || 27) : (profile.max_level || 1));

            return {
              id: profile.id,
              user_id: profile.id,
              username: profile.username,
              score: levelVal * 100,
              level_reached: levelVal,
              accuracy: 100,
              mode: mode,
              created_at: profile.updated_at || new Date().toISOString()
            };
          });
      }
    }
  } catch (err) {
    console.error("Error fetching global leaderboard:", err);
  }

  // Merge remoteEntries with localEntries, avoiding duplicate usernames, and sort descending by level_reached
  const map = new Map<string, LeaderboardEntry>();

  remoteEntries.forEach((entry) => map.set(entry.username.toLowerCase(), entry));
  localEntries.forEach((entry) => {
    const key = entry.username.toLowerCase();
    if (!map.has(key) || (map.get(key)?.level_reached || 0) < entry.level_reached) {
      map.set(key, entry);
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => b.level_reached - a.level_reached);
  return merged;
}
