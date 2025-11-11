// Toast Notification System
// Usage: showToast('Message', 'success|error|warning|info')

const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
toastContainer.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;';
document.body.appendChild(toastContainer);

function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    const colors = {
        success: '#00ff88',
        error: '#ff3366',
        warning: '#ffaa00',
        info: '#00d4ff'
    };

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    const color = colors[type] || colors.info;
    const icon = icons[type] || icons.info;

    toast.style.cssText = 'background: rgba(10, 14, 26, 0.95); border: 1px solid ' + color + '; border-radius: 8px; padding: 1rem 1.5rem; min-width: 300px; max-width: 500px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1rem; animation: slideIn 0.3s ease; backdrop-filter: blur(10px);';

    toast.innerHTML = '<i class="fas ' + icon + '" style="color: ' + color + '; font-size: 1.2rem;"></i>' +
                      '<div style="flex: 1; color: #ffffff;">' + message + '</div>' +
                      '<i class="fas fa-times" style="color: #8892b0; cursor: pointer; font-size: 0.9rem;" onclick="this.parentElement.remove()"></i>';

    toastContainer.appendChild(toast);

    // Auto remove after duration
    setTimeout(function() {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(function() {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

// Add animations
const style = document.createElement('style');
style.textContent = '@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }';
document.head.appendChild(style);

// Expose globally
window.showToast = showToast;
