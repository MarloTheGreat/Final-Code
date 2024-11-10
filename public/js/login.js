// Password visibility toggle
document.getElementById('togglePassword').addEventListener('click', function () {
    const passwordInput = document.getElementById('password');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁' : '🙈';
});

// Client-side validation and form submission
document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const formError = document.getElementById('formError');
    formError.textContent = ''; // Clear previous error messages

    // Check if the email is in a valid format
    const emailPattern = /^[^@]+@[^@]+\.[^@]+$/;
    if (!emailPattern.test(email)) {
        const message = 'Please enter a valid email address.';
        formError.textContent = message;
        return;
    }
    
    // Basic validation
    if (!email || !password) {
        formError.textContent = 'Email and password are required.';
        return;
    }


    // Submit form data via AJAX
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (result.success) {
            localStorage.setItem('userEmail', email); // Store email in localStorage
            window.location.href = '/dashboard.html'; // Redirect to dashboard
        } else {
            formError.textContent = result.message; // Display error message from server
        }
    } catch (error) {
        formError.textContent = 'Error connecting to the server.';
    }
});
