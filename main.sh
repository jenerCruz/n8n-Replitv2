#!/bin/bash

# Añadir node_modules al PATH y buscar node en varias ubicaciones
export PATH=$PATH:$(pwd)/node_modules/.bin:/usr/local/bin

# Buscar Node.js en varias ubicaciones
FOUND_NODE=""
if command -v node &> /dev/null; then
    FOUND_NODE="node"
elif [[ -f "./node_modules/.bin/node" ]]; then
    FOUND_NODE="./node_modules/.bin/node"
elif [[ -x "/usr/bin/node" ]]; then
    FOUND_NODE="/usr/bin/node"
fi

echo "🚀 Iniciando aplicación n8n con gestión automática de datos..."

# Configurar datos de inicio
bash persistent.sh

# Función para exportar datos antes del apagado
cleanup_and_export() {
    echo ""
    echo "🛑 Señal de apagado recibida, exportando datos..."
    if [[ -n "$FOUND_NODE" ]]; then
        timeout 30 $FOUND_NODE export-data.js || echo "⚠️  Error o timeout en exportación"
    else
        echo "⚠️  Node.js no disponible para exportación"
    fi
    echo "✅ Proceso de apagado completado"
    exit 0
}

# Registrar manejador de señales para exportación automática
trap cleanup_and_export SIGTERM SIGINT

# Importar datos al inicio si Node.js está disponible
if [[ -n "$FOUND_NODE" ]]; then
    echo "📥 Importando datos de arranque..."
    echo "🔧 Usando Node.js en: $FOUND_NODE"
    timeout 30 $FOUND_NODE import-data.js || echo "⚠️  Error o timeout en importación, continuando..."
else
    echo "⚠️  Node.js no disponible para importación"
    echo "📋 Scripts disponibles para uso manual:"
    echo "  - import-data.js: Para importar datos"
    echo "  - export-data.js: Para exportar datos"
fi

# Buscar n8n executable
N8N_CMD=""
if command -v n8n &> /dev/null; then
    N8N_CMD="n8n"
elif [[ -x "./node_modules/.bin/n8n" ]]; then
    N8N_CMD="./node_modules/.bin/n8n"
elif [[ -n "$FOUND_NODE" && -f "./node_modules/n8n/bin/n8n" ]]; then
    N8N_CMD="$FOUND_NODE ./node_modules/n8n/bin/n8n"
fi

# Iniciar n8n
if [[ -n "$N8N_CMD" ]]; then
    echo "🚀 Iniciando n8n en puerto 5000..."
    echo "✨ Gestión automática de datos habilitada"
    echo "🔧 Usando n8n: $N8N_CMD"
    N8N_PORT=5000 $N8N_CMD
else
    echo "❌ n8n no encontrado. Instalando..."
    npm install n8n
    echo "🚀 Iniciando n8n en puerto 5000..."
    N8N_PORT=5000 npx n8n
fi
