// Standardized Navigation Component for AutomatedTradeBot
// Include this script on all pages for consistent navigation

function renderNavigation(activePage) {
    activePage = activePage || '';
    const nav = document.querySelector('nav .nav-container');
    if (!nav) return;

    const token = localStorage.getItem('token');
    const isLoggedIn = !!token;
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isAdmin = user && user.role === 'ADMIN';

    let menuHTML = '<a href="/" class="nav-link ' + (activePage === 'home' ? 'active' : '') + '">Home</a>';

    if (isLoggedIn) {
        menuHTML += '<a href="/dashboard" class="nav-link ' + (activePage === 'dashboard' ? 'active' : '') + '">Dashboard</a>';
        menuHTML += '<a href="/marketplace" class="nav-link ' + (activePage === 'marketplace' ? 'active' : '') + '">Marketplace</a>';
        menuHTML += '<a href="/subscriptions" class="nav-link ' + (activePage === 'subscriptions' ? 'active' : '') + '">My Subscriptions</a>';
        menuHTML += '<a href="/signals" class="nav-link ' + (activePage === 'signals' ? 'active' : '') + '">Signals</a>';
        menuHTML += '<a href="/completed-trades" class="nav-link ' + (activePage === 'trades' ? 'active' : '') + '">Trades</a>';
        menuHTML += '<a href="/active-positions" class="nav-link ' + (activePage === 'active' ? 'active' : '') + '">Active</a>';

        // Show Admin link only for admin users
        if (isAdmin) {
            menuHTML += '<a href="/admin" class="nav-link ' + (activePage === 'admin' ? 'active' : '') + '" style="color: #ffaa00;"><i class="fas fa-shield-alt"></i> Admin</a>';
        }
    } else {
        menuHTML += '<a href="/marketplace" class="nav-link ' + (activePage === 'marketplace' ? 'active' : '') + '">Marketplace</a>';
        menuHTML += '<a href="/signals" class="nav-link ' + (activePage === 'signals' ? 'active' : '') + '">Signals</a>';
        menuHTML += '<a href="/completed-trades" class="nav-link ' + (activePage === 'trades' ? 'active' : '') + '">Trades</a>';
        menuHTML += '<a href="/active-positions" class="nav-link ' + (activePage === 'active' ? 'active' : '') + '">Active</a>';
    }

    let authHTML = '';
    if (isLoggedIn) {
        authHTML = '<a href="/profile" class="btn btn-profile" style="margin-right: 0.5rem;"><i class="fas fa-user-circle"></i> Profile</a>';
        authHTML += '<a href="#" class="btn btn-logout" onclick="logout(); return false;"><i class="fas fa-sign-out-alt"></i> Logout</a>';
    } else {
        authHTML = '<a href="/login" class="btn btn-login">Login</a><a href="/register" class="btn btn-register">Get Started</a>';
    }

    const navHTML = '<a href="/" class="logo"><i class="fas fa-chart-line"></i>AutomatedTradeBot</a><div class="nav-menu">' + menuHTML + '</div><div class="nav-auth">' + authHTML + '</div>';

    nav.innerHTML = navHTML;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Auto-render navigation on page load
document.addEventListener('DOMContentLoaded', function() {
    const activePage = document.body.dataset.page || '';
    renderNavigation(activePage);
});
