const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient('https://hagseiwqouapirtlbume.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZ3NlaXdxb3VhcGlydGxidW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNjIzMzYsImV4cCI6MjA5NTYzODMzNn0.9dy-1MyzPtLU86MLLwRGqYO5BwzDywsLgYg0QKRZ2o0');

async function upload() {
  const { data, error } = await supabase.storage.from('screenshots').upload('test.txt', 'hello world', {
    contentType: 'text/plain',
    upsert: true
  });
  console.log(data, error);
}
upload();
