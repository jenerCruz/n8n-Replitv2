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

// Función para hacer peticiones HTTP
function makeRequest(method, url, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': method === 'POST' ? 'return=minimal' : undefined
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(url, options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Función para verificar conectividad con Supabase
async function checkSupabaseConnection() {
  try {
    const response = await makeRequest('GET', `${supabaseUrl}/rest/v1/`);
    if (response.status === 200) {
      console.log('✅ Conexión con Supabase verificada');
      return true;
    }
  } catch (error) {
    console.log('⚠️  Error de conexión con Supabase:', error.message);
  }
  return false;
}

async function importData() {
  console.log('🔄 Iniciando importación de datos...');
  
  try {
    // Ruta donde buscar archivos de backup para importar
    const backupDir = path.join(__dirname, 'backups');
    const n8nDataDir = path.join(__dirname, 'n8n-config');
    
    // Crear directorios si no existen
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log('📁 Directorio de backups creado');
    }

    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️  Supabase no configurado completamente, solo importación local');
      console.log('ℹ️  Se requiere DATABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
      return;
    }

    const connected = await checkSupabaseConnection();
    if (!connected) {
      console.log('⚠️  No se pudo conectar a Supabase, solo importación local');
      return;
    }

    // Verificar si existe archivo de backup de workflows
    const workflowBackupFile = path.join(backupDir, 'workflows_backup.json');
    
    if (fs.existsSync(workflowBackupFile)) {
      console.log('📥 Importando workflows desde backup...');
      
      try {
        const workflowData = JSON.parse(fs.readFileSync(workflowBackupFile, 'utf8'));
        
        // Obtener workflows desde Supabase para restaurar en la app
        try {
          const response = await makeRequest('GET', `${supabaseUrl}/rest/v1/workflows_backup`);
          
          if (response.status === 200 && response.data && response.data.length > 0) {
            console.log(`📥 Restaurando ${response.data.length} workflows desde Supabase...`);
            
            // Crear archivos JSON de workflows para n8n
            for (const workflow of response.data) {
              try {
                const workflowPath = path.join(n8nDataDir, `${workflow.name}.json`);
                fs.writeFileSync(workflowPath, JSON.stringify(workflow.data, null, 2));
                console.log(`✅ Workflow ${workflow.name} restaurado localmente`);
              } catch (error) {
                console.log(`⚠️  Error al restaurar workflow ${workflow.name}:`, error.message);
              }
            }
          } else if (response.status === 404) {
            console.log('ℹ️  No hay workflows en Supabase para restaurar');
          } else {
            console.log('⚠️  Error al obtener workflows de Supabase:', response.status, response.data);
          }
        } catch (error) {
          console.log('⚠️  Error al conectar con Supabase para workflows:', error.message);
        }
        
        console.log(`✅ Procesados ${workflowData.workflows?.length || 0} workflows`);
      } catch (parseError) {
        console.error('❌ Error al parsear archivo de backup:', parseError.message);
      }
    } else {
      console.log('ℹ️  No se encontró archivo de backup de workflows para importar');
    }

    // Verificar si existe archivo de backup de configuraciones
    const configBackupFile = path.join(backupDir, 'config_backup.json');
    
    if (fs.existsSync(configBackupFile)) {
      console.log('📥 Importando configuraciones desde backup...');
      
      try {
        const configData = JSON.parse(fs.readFileSync(configBackupFile, 'utf8'));
        
        // Obtener configuraciones desde Supabase para restaurar
        try {
          const response = await makeRequest('GET', `${supabaseUrl}/rest/v1/config_backup`);
          
          if (response.status === 200 && response.data && response.data.length > 0) {
            console.log(`📥 Restaurando ${response.data.length} configuraciones desde Supabase...`);
            
            for (const config of response.data) {
              try {
                if (config.config_type === 'n8n_config') {
                  const configPath = path.join(n8nDataDir, 'config');
                  fs.writeFileSync(configPath, config.data);
                  console.log(`✅ Configuración ${config.config_type} restaurada`);
                }
              } catch (error) {
                console.log(`⚠️  Error al restaurar configuración ${config.config_type}:`, error.message);
              }
            }
          } else if (response.status === 404) {
            console.log('ℹ️  No hay configuraciones en Supabase para restaurar');
          }
        } catch (error) {
          console.log('⚠️  Error al obtener configuraciones de Supabase:', error.message);
        }
        
        console.log(`✅ Procesadas ${Object.keys(configData).length} configuraciones`);
      } catch (parseError) {
        console.error('❌ Error al parsear archivo de backup de configuraciones:', parseError.message);
      }
    }

    console.log('🎉 Importación completada');
    
  } catch (error) {
    console.error('❌ Error durante la importación:', error.message);
    process.exit(1);
  }
}

// Ejecutar importación si el script es llamado directamente
if (require.main === module) {
  importData();
}

module.exports = { importData };
