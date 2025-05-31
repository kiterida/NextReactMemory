import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://naxezrprcqctfezoxzqz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5heGV6cnByY3FjdGZlem94enF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1ODM5MDksImV4cCI6MjA0NjE1OTkwOX0.nHj8WFODucxb7wKwJ7seyuLJCwUsYKTgjATK3MtzGc8';
export const supabase = createClient(supabaseUrl, supabaseKey);
