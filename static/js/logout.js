async function handleLogout() {
    try {
        // Call backend logout endpoint
        const response = await fetch('/logout', {
            method: 'GET',
            credentials: 'same-origin' // Important for cookies
        });

        // If successful, redirect to login page
        if (response.ok || response.redirected) {
            window.location.href = '/login';
        } else {
            throw new Error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}