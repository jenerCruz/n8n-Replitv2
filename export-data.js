process.env.SUPABASE_SERVICE_ROLE_KEY;
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

async function exportData() {
  console.log('🔄 Iniciando exportación de datos...');
  
  try {
    // Directorios para backup
    const backupDir = path.join(__dirname, 'backups');
    const n8nDataDir = path.join(__dirname, 'n8n-config');
    
    // Crear directorio de backups si no existe
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    if (!supabaseUrl || !supabaseKey) {
      console.log('⚠️  Supabase no configurado, solo backup local');
    } else {
      console.log('✅ Conectado a Supabase para exportación');
    }

    // 1. Exportar archivos de configuración locales de n8n
    const workflowsToExport = [];
    const configurationsToExport = {};
    
    // Leer base de datos SQLite local de n8n si existe
    const dbPath = path.join(n8nDataDir, 'database.sqlite');
    if (fs.existsSync(dbPath)) {
      console.log('📤 Detectada base de datos local de n8n');
      
      // Leer archivos de configuración de n8n
      const configPath = path.join(n8nDataDir, 'config');
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf8');
          configurationsToExport['n8n_config'] = configContent;
        } catch (err) {
          console.log('⚠️  No se pudo leer archivo de configuración:', err.message);
        }
      }
    }

    // Buscar archivos JSON de workflows en el directorio de n8n
    function searchWorkflowFiles(dir) {
      if (!fs.existsSync(dir)) return;
      
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          searchWorkflowFiles(fullPath);
        } else if (file.endsWith('.json')) {
          try {
            const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            if (content.nodes || content.connections) {
              workflowsToExport.push({
                name: file.replace('.json', ''),
                file: fullPath,
                data: content,
                exported_at: new Date().toISOString()
              });
            }
          } catch (err) {
            console.log(`⚠️  No se pudo leer ${file}:`, err.message);
          }
        }
      }
    }

    searchWorkflowFiles(n8nDataDir);

    // 2. Guardar workflows en Supabase (si está configurado)
    if (supabaseUrl && supabaseKey && workflowsToExport.length > 0) {
      console.log(`📤 Exportando ${workflowsToExport.length} workflows a Supabase...`);
      
      for (const workflow of workflowsToExport) {
        try {
          const response = await makeRequest('POST', `${supabaseUrl}/rest/v1/workflows_backup`, {
            name: workflow.name,
            data: workflow.data,
            updated_at: new Date().toISOString()
          });
          
          if (response.status >= 200 && response.status < 300) {
            console.log(`✅ Workflow ${workflow.name} exportado`);
          } else if (response.status === 409) {
            // Conflicto - actualizar el existente
            const updateResponse = await makeRequest('PATCH', 
              `${supabaseUrl}/rest/v1/workflows_backup?name=eq.${encodeURIComponent(workflow.name)}`, {
              data: workflow.data,
              updated_at: new Date().toISOString()
            });
            console.log(`🔄 Workflow ${workflow.name} actualizado`);
          } else {
            console.log(`⚠️  Error al exportar workflow ${workflow.name}:`, response.status, response.data);
          }
        } catch (error) {
          console.log(`⚠️  Error al exportar workflow ${workflow.name}:`, error.message);
        }
      }
    }

    // 3. Guardar configuraciones en Supabase (si está configurado)
    if (supabaseUrl && supabaseKey && Object.keys(configurationsToExport).length > 0) {
      console.log(`📤 Exportando configuraciones a Supabase...`);
      
      for (const [configType, configData] of Object.entries(configurationsToExport)) {
        try {
          const response = await makeRequest('POST', `${supabaseUrl}/rest/v1/config_backup`, {
            config_type: configType,
            data: configData,
            updated_at: new Date().toISOString()
          });
          
          if (response.status >= 200 && response.status < 300) {
            console.log(`✅ Configuración ${configType} exportada`);
          } else if (response.status === 409) {
            // Conflicto - actualizar la existente
            const updateResponse = await makeRequest('PATCH', 
              `${supabaseUrl}/rest/v1/config_backup?config_type=eq.${encodeURIComponent(configType)}`, {
              data: configData,
              updated_at: new Date().toISOString()
            });
            console.log(`🔄 Configuración ${configType} actualizada`);
          } else {
            console.log(`⚠️  Error al exportar configuración ${configType}:`, response.status, response.data);
          }
        } catch (error) {
          console.log(`⚠️  Error al exportar configuración ${configType}:`, error.message);
        }
      }
    }

    // 4. Crear backup local también (por seguridad)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup de workflows
    if (workflowsToExport.length > 0) {
      const workflowBackup = {
        exported_at: new Date().toISOString(),
        workflows: workflowsToExport
      };
      fs.writeFileSync(
        path.join(backupDir, `workflows_backup_${timestamp}.json`),
        JSON.stringify(workflowBackup, null, 2)
      );
      
      // También crear un archivo sin timestamp para la importación
      fs.writeFileSync(
        path.join(backupDir, 'workflows_backup.json'),
        JSON.stringify(workflowBackup, null, 2)
      );
    }

    // Backup de configuraciones
    if (Object.keys(configurationsToExport).length > 0) {
      fs.writeFileSync(
        path.join(backupDir, `config_backup_${timestamp}.json`),
        JSON.stringify(configurationsToExport, null, 2)
      );
      
      // También crear un archivo sin timestamp para la importación
      fs.writeFileSync(
        path.join(backupDir, 'config_backup.json'),
        JSON.stringify(configurationsToExport, null, 2)
      );
    }

    console.log(`🎉 Exportación completada exitosamente`);
    console.log(`📁 Workflows exportados: ${workflowsToExport.length}`);
    console.log(`⚙️  Configuraciones exportadas: ${Object.keys(configurationsToExport).length}`);
    console.log(`💾 Backups guardados en: ${backupDir}`);
    if (supabaseUrl && supabaseKey) {
      console.log(`☁️  Datos sincronizados con Supabase`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la exportación:', error.message);
    // No salir con error para permitir que la aplicación se cierre correctamente
  }
}

// Manejo de señales para exportar antes del apagado
function setupGracefulShutdown() {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`\n🛑 Señal ${signal} recibida, iniciando exportación de datos...`);
      
      try {
        await exportData();
        console.log('✅ Exportación completada, cerrando aplicación...');
      } catch (error) {
        console.error('❌ Error en exportación final:', error.message);
      }
      
      process.exit(0);
    });
  });
}

// Ejecutar exportación si el script es llamado directamente
if (require.main === module) {
  // Si se ejecuta con parámetro --setup-shutdown, configurar el manejo de señales
  if (process.argv.includes('--setup-shutdown')) {
    console.log('🔧 Configurando manejo de señales para exportación en apagado...');
    setupGracefulShutdown();
    
    // Mantener el proceso activo
    setInterval(() => {}, 1000);
  } else {
    exportData();
  }
}

module.exports = { exportData, setupGracefulShutdown };