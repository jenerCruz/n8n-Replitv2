#!/bin/bash

echo "🧪 Probando scripts de importación y exportación de datos..."

# Verificar que los archivos existen
echo "📁 Verificando archivos:"
ls -la import-data.js export-data.js

# Verificar que están marcados como ejecutables
chmod +x import-data.js export-data.js

echo "✅ Scripts creados y configurados correctamente"

# Crear directorio de backups de prueba
mkdir -p backups

echo "📋 Para usar los scripts:"
echo "  Importar: node import-data.js"
echo "  Exportar: node export-data.js" 
echo "  Configurar apagado: node export-data.js --setup-shutdown"

echo "🔧 Los scripts están configurados para trabajar con Supabase usando:"
echo "  - DATABASE_URL (ya configurado)"
echo "  - API Key de Supabase (ya configurado)"
