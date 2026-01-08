
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://stgeaxgvvayxkwufkfkx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z2VheGd2dmF5eGt3dWZrZmt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTQ0ODIsImV4cCI6MjA4MzQ3MDQ4Mn0.-73iE8v2yPBRPmdyCiH0C5r4C3dG6DdIaMG4ISeGOww'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
})
