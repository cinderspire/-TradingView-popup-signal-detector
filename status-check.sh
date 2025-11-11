#!/bin/bash

##############################################################################
# AutomatedTradeBot - Status Check Script
# Checks the status of all services
##############################################################################

echo "======================================================================"
echo "  AutomatedTradeBot - System Status"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check service
check_service() {
    local name=$1
    local url=$2

    echo -n "Checking $name... "
    if curl -s "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ONLINE${NC}"
        return 0
    else
        echo -e "${RED}✗ OFFLINE${NC}"
        return 1
    fi
}

# Check Backend
check_service "Backend" "http://localhost:6864/health"
BACKEND_STATUS=$?

# Check Frontend
check_service "Frontend" "http://localhost:3000"
FRONTEND_STATUS=$?

# Check Database
echo -n "Checking Database... "
if systemctl is-active --quiet postgresql; then
    if PGPASSWORD=changeme123 psql -h localhost -U automatedtradebot -d automatedtradebot -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ONLINE${NC}"
        DB_STATUS=0
    else
        echo -e "${YELLOW}! RUNNING but connection failed${NC}"
        DB_STATUS=1
    fi
else
    echo -e "${RED}✗ OFFLINE${NC}"
    DB_STATUS=1
fi

echo ""

# Show detailed backend status if online
if [ $BACKEND_STATUS -eq 0 ]; then
    echo "Backend Details:"
    echo "----------------------------------------"
    curl -s http://localhost:6864/api/status | python3 -m json.tool 2>/dev/null || echo "Failed to get detailed status"
    echo ""
fi

# Show running processes
echo "Running Processes:"
echo "----------------------------------------"
echo "Backend:"
ps aux | grep "node.*server.js" | grep -v grep || echo "  No backend process found"

echo ""
echo "Frontend:"
ps aux | grep "next.*start" | grep -v grep || echo "  No frontend process found"

echo ""
echo "======================================================================"

# Exit with error if any service is down
if [ $BACKEND_STATUS -ne 0 ] || [ $FRONTEND_STATUS -ne 0 ] || [ $DB_STATUS -ne 0 ]; then
    echo -e "${RED}Some services are not running!${NC}"
    echo "Run: /home/automatedtradebot/start-production.sh"
    exit 1
else
    echo -e "${GREEN}All services are running!${NC}"
    exit 0
fi
