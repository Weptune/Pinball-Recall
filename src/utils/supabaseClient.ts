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

    // Insert into score_history tagging the game mode in user_email
    await supabase.from('score_history').insert({
      user_id: userId,
      user_email: mode,
      score: sessionScore,
      level_reached: endingLevel,
      accuracy: accuracyPercent,
    });
  } catch (err) {
    console.error("Failed to sync progress to Supabase:", err);
  }
}

// Fetch Global Leaderboard Top Scores (Ranks logged-in users by their max level per mode)
export async function fetchGlobalLeaderboard(mode: 'RECALL' | 'PUZZLE' = 'RECALL'): Promise<LeaderboardEntry[]> {
  const localEntries: LeaderboardEntry[] = [];
  
  // 1. Current logged-in user local entry
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

  const map = new Map<string, LeaderboardEntry>();

  try {
    // 2. Fetch profiles table
    const { data: profileData } = await supabase
      .from('profiles')
      .select(`id, username, max_level, updated_at`);

    const profileIdToUsername = new Map<string, string>();

    if (profileData && profileData.length > 0) {
      profileData
        .filter((profile: any) => Boolean(profile.username))
        .forEach((profile: any) => {
          profileIdToUsername.set(profile.id, profile.username);

          const uLower = profile.username.toLowerCase();
          const isWeptune = uLower === 'weptune';
          const isAri = uLower === 'ari';
          let levelVal = 1;

          if (mode === 'PUZZLE') {
            if (isWeptune) levelVal = 23;
            else if (isAri) levelVal = 9;
            else levelVal = profile.puzzle_max_level || 1;
          } else {
            // RECALL MODE
            if (isWeptune) levelVal = Math.max(27, profile.max_level || 27);
            else if (isAri) levelVal = Math.max(13, profile.max_level || 13);
            else levelVal = profile.max_level || 1;
          }

          map.set(uLower, {
            id: profile.id,
            user_id: profile.id,
            username: profile.username,
            score: levelVal * 100,
            level_reached: levelVal,
            accuracy: 100,
            mode: mode,
            created_at: profile.updated_at || new Date().toISOString()
          });
        });
    }

    // 3. Query score_history and aggregate mode-matching session entries
    const { data: historyData } = await supabase
      .from('score_history')
      .select('id, user_id, user_email, level_reached, score, created_at');

    if (historyData && historyData.length > 0) {
      historyData.forEach((row: any) => {
        // Exclude synthetic test insertion row
        if (row.id === 'c62728a3-5fd1-4d38-b498-0d65dbd17017') return;

        const username = profileIdToUsername.get(row.user_id);
        if (!username) return;

        const isWeptune = username.toLowerCase() === 'weptune';
        if (isWeptune) return; // weptune uses fixed defaults

        // Match mode tag in user_email
        const rowMode = row.user_email ? row.user_email : 'RECALL';
        if (rowMode !== mode) return;

        const key = username.toLowerCase();
        const existing = map.get(key);
        const rowLvl = row.level_reached || 1;

        if (!existing || existing.level_reached < rowLvl) {
          map.set(key, {
            id: `history-${key}`,
            user_id: row.user_id,
            username: username,
            score: rowLvl * 100,
            level_reached: rowLvl,
            accuracy: 100,
            mode: mode,
            created_at: row.created_at || new Date().toISOString()
          });
        }
      });
    }
  } catch (err) {
    console.error("Error fetching global leaderboard:", err);
  }

  // 4. Merge localEntries for current device if higher
  localEntries.forEach((entry) => {
    const key = entry.username.toLowerCase();
    if (!map.has(key) || (map.get(key)?.level_reached || 0) < entry.level_reached) {
      map.set(key, entry);
    }
  });

  const merged = Array.from(map.values()).sort((a, b) => b.level_reached - a.level_reached);
  return merged;
}
