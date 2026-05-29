import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hagseiwqouapirtlbume.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ3NlaXdxb3VhcGlydGxidW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNjIzMzYsImV4cCI6MjA5NTYzODMzNn0.9dy-1MyzPtLU86MLLwRGqYO5BwzDywsLgYg0QKRZ2o0';
export const supabase = createClient(supabaseUrl, supabaseKey);
