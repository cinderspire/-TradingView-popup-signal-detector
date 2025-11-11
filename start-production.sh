#!/bin/bash

##############################################################################
# AutomatedTradeBot - Production Startup Script
# Starts both backend and frontend services
##############################################################################

echo "======================================================================"
echo "  AutomatedTradeBot - Production Startup"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base directory
BASE_DIR="/home/automatedtradebot"

# Function to check if service is running
check_service() {
    local service_name=$1
    local port=$2

    if curl -s "http://localhost:${port}/health" > /dev/null 2>&1 || \
       curl -s "http://localhost:${port}" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_wait=30
    local count=0

    echo -n "Waiting for ${service_name} to start..."
    while [ $count -lt $max_wait ]; do
        if check_service "$service_name" "$port"; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 1
        ((count++))
    done
    echo -e " ${RED}✗${NC}"
    return 1
}

echo "Step 1: Checking prerequisites..."
echo "----------------------------------------"

# Check if PostgreSQL is running
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓${NC} PostgreSQL is running"
else
    echo -e "${YELLOW}!${NC} PostgreSQL is not running. Starting..."
    sudo systemctl start postgresql
    sleep 2
    if systemctl is-active --quiet postgresql; then
        echo -e "${GREEN}✓${NC} PostgreSQL started successfully"
    else
        echo -e "${RED}✗${NC} Failed to start PostgreSQL"
        exit 1
    fi
fi

# Check database connection
if PGPASSWORD=changeme123 psql -h localhost -U automatedtradebot -d automatedtradebot -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Database connection successful"
else
    echo -e "${RED}✗${NC} Database connection failed"
    exit 1
fi

echo ""
echo "Step 2: Starting Backend..."
echo "----------------------------------------"

# Check if backend is already running
if check_service "backend" "6864"; then
    echo -e "${YELLOW}!${NC} Backend is already running on port 6864"
    read -p "Do you want to restart it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing backend..."
        pkill -f "node.*server.js" || true
        sleep 2
    else
        echo "Keeping existing backend running"
        BACKEND_STARTED=true
    fi
fi

if [ -z "$BACKEND_STARTED" ]; then
    cd "$BASE_DIR/backend/src"

    # Start backend in background
    nohup node server.js > "$BASE_DIR/backend/logs/server.log" 2>&1 &
    BACKEND_PID=$!

    echo "Backend started with PID: $BACKEND_PID"

    # Wait for backend to be ready
    if wait_for_service "backend" "6864"; then
        echo -e "${GREEN}✓${NC} Backend is ready on http://localhost:6864"

        # Show backend status
        echo ""
        echo "Backend Status:"
        curl -s http://localhost:6864/api/status | python3 -m json.tool | head -20
    else
        echo -e "${RED}✗${NC} Backend failed to start"
        echo "Check logs at: $BASE_DIR/backend/logs/server.log"
        exit 1
    fi
fi

echo ""
echo "Step 3: Starting Frontend..."
echo "----------------------------------------"

# Check if frontend is already running
if check_service "frontend" "3000"; then
    echo -e "${YELLOW}!${NC} Frontend is already running on port 3000"
    read -p "Do you want to restart it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Stopping existing frontend..."
        pkill -f "next.*start" || true
        sleep 2
    else
        echo "Keeping existing frontend running"
        FRONTEND_STARTED=true
    fi
fi

if [ -z "$FRONTEND_STARTED" ]; then
    cd "$BASE_DIR/frontend"

    # Check if build exists
    if [ ! -d ".next" ]; then
        echo -e "${YELLOW}!${NC} Build not found. Building frontend..."
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗${NC} Frontend build failed"
            exit 1
        fi
    fi

    # Start frontend in background
    nohup npm start > "$BASE_DIR/frontend/logs/frontend.log" 2>&1 &
    FRONTEND_PID=$!

    echo "Frontend started with PID: $FRONTEND_PID"

    # Wait for frontend to be ready
    if wait_for_service "frontend" "3000"; then
        echo -e "${GREEN}✓${NC} Frontend is ready on http://localhost:3000"
    else
        echo -e "${RED}✗${NC} Frontend failed to start"
        echo "Check logs at: $BASE_DIR/frontend/logs/frontend.log"
        exit 1
    fi
fi

echo ""
echo "======================================================================"
echo "  AutomatedTradeBot - All Services Started Successfully!"
echo "======================================================================"
echo ""
echo "Access Points:"
echo "  Frontend:   http://localhost:3000"
echo "  Backend:    http://localhost:6864"
echo "  API Status: http://localhost:6864/api/status"
echo "  Health:     http://localhost:6864/health"
echo "  WebSocket:  ws://localhost:6864/ws"
echo ""
echo "Logs:"
echo "  Backend:    tail -f $BASE_DIR/backend/logs/server.log"
echo "  Frontend:   tail -f $BASE_DIR/frontend/logs/frontend.log"
echo ""
echo "To stop services:"
echo "  $BASE_DIR/stop-production.sh"
echo ""
echo "======================================================================"
