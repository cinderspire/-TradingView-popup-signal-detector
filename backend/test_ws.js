const WebSocket = require('ws');

console.log('Testing WebSocket connection to ws://127.0.0.1:6864/ws/signals');
const ws = new WebSocket('ws://127.0.0.1:6864/ws/signals');

ws.on('open', () => {
    console.log('✅ WebSocket CONNECTED!');
});

ws.on('message', (data) => {
    console.log('📩 Received message:', data.toString().substring(0, 300));
});

ws.on('error', (error) => {
    console.log('❌ WebSocket ERROR:', error.message);
});

ws.on('close', () => {
    console.log('🔌 WebSocket CLOSED');
    process.exit(0);
});

setTimeout(() => {
    console.log('⏱️ Test completed - closing');
    ws.close();
}, 8000);
