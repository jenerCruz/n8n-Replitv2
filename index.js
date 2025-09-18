const path = require('path');
const fs = require('fs');

// Set n8n environment variables
process.env.N8N_BASIC_AUTH_ACTIVE = 'true';
process.env.N8N_BASIC_AUTH_USER = 'admin';
process.env.N8N_BASIC_AUTH_PASSWORD = '789456qr';
process.env.N8N_HOST = '0.0.0.0';
process.env.N8N_PORT = '5678';
process.env.N8N_PROTOCOL = 'http';

// ✅ Configuración para Supabase (PostgreSQL)
process.env.DB_TYPE = 'postgresdb';
process.env.DB_POSTGRESDB_HOST = 'db.supabase.co'; // cambia por tu host real
process.env.DB_POSTGRESDB_PORT = '5432';
process.env.DB_POSTGRESDB_DATABASE = 'nombre_de_tu_db';
process.env.DB_POSTGRESDB_USER = 'usuario';
process.env.DB_POSTGRESDB_PASSWORD = 'contraseña';

// Carpeta de usuario (opcional)
process.env.N8N_USER_FOLDER = path.join(__dirname, 'n8n-config');

// Crear carpeta si no existe
const configDir = path.join(__dirname, 'n8n-config');
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

async function startN8n() {
  try {
    console.log('🚀 Iniciando servidor n8n...');
    console.log(`📡 Servidor disponible en puerto ${process.env.N8N_PORT}`);
    console.log(`🔐 Usuario: ${process.env.N8N_BASIC_AUTH_USER}`);
    console.log(`🔑 Contraseña: ${process.env.N8N_BASIC_AUTH_PASSWORD}`);
    
    const { exec } = require('child_process');
    const n8nProcess = exec('npx n8n start', {
      env: process.env,
      cwd: __dirname
    });

    n8nProcess.stdout.on('data', (data) => {
      console.log(data.toString());
    });

    n8nProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    n8nProcess.on('close', (code) => {
      console.log(`n8n process exited with code ${code}`);
    });

    console.log('✅ n8n está iniciando...');
    console.log(`🌐 Accede al editor en: http://${process.env.N8N_HOST}:${process.env.N8N_PORT}`);
    
  } catch (error) {
    console.error('❌ Error al iniciar n8n:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('🛑 Deteniendo servidor n8n...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Deteniendo servidor n8n...');
  process.exit(0);
});

startN8n();