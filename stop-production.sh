#!/bin/bash

##############################################################################
# AutomatedTradeBot - Production Stop Script
# Stops both backend and frontend services
##############################################################################

echo "======================================================================"
echo "  AutomatedTradeBot - Stopping Services"
echo "======================================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "Stopping Backend..."
pkill -f "node.*server.js"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Backend stopped"
else
    echo -e "${GREEN}✓${NC} No backend process found"
fi

echo "Stopping Frontend..."
pkill -f "next.*start"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Frontend stopped"
else
    echo -e "${GREEN}✓${NC} No frontend process found"
fi

echo ""
echo "All services stopped."
echo ""
