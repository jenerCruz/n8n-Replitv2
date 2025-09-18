#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuración para Supabase REST API
const DATABASE_URL = process.env.DATABASE_URL;
let supabaseUrl, supabaseKey;

// Extraer configuración de Supabase desde DATABASE_URL
if (DATABASE_URL && DATABASE_URL.includes('supabase')) {
  const url = new URL(DATABASE_URL);
  const hostParts = url.hostname.split('.');
  if (hostParts.length >= 3 && hostParts[1] && hostParts[2] === 'supabase') {
    const projectId = hostParts[1]; // Usar el segundo elemento: db.PROJECT_ID.supabase.co
    supabaseUrl = `https://${projectId}.supabase.co`;
    supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}
