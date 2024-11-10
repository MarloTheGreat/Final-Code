require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const mailgun = require('mailgun-js');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(helmet());

// Mailgun setup
const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN
});

// MongoDB setup
const mongoUri = process.env.MONGO_URI;
const client = new MongoClient(mongoUri);
let usersCollection;
async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const database = client.db('myDatabase');
        usersCollection = database.collection('tblUser');
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
}
connectToDatabase();

// Session setup
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUri }),
    cookie: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 30 * 60 * 1000 }
}));

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again after 30 minutes.'
});

// Sign-up route
app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (!validator.isEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    const existingUser = await usersCollection.findOne({ emaildb: email });
    if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email is already in use.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store the new user in the database
    await usersCollection.insertOne({
        emaildb: email,
        password: hashedPassword,
        invalidLoginAttempts: 0,
        lastLoginTime: null,
        accountLockedUntil: null // Initialize accountLockedUntil
    });

    res.json({ success: true, message: 'User registered successfully!' });
});

// Login route
app.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    if (!validator.isEmail(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
    }

    const user = await usersCollection.findOne({ emaildb: email });
    if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    // Account lockout check
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        const remainingTime = Math.ceil((user.accountLockedUntil - new Date()) / 60000);
        return res.status(403).json({ success: false, message: `Account is locked. Try again in ${remainingTime} minutes.` });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        // Increment invalid login attempts
        await usersCollection.updateOne({ _id: user._id }, {
            $inc: { invalidLoginAttempts: 1 }
        });

        // Check if invalid attempts exceed a limit (optional)
        const maxAttempts = 3; // Define the max number of invalid attempts
        if (user.invalidLoginAttempts >= maxAttempts) {
            const lockDuration = 30 * 60 * 1000; // Lock account for 30 minutes
            await usersCollection.updateOne({ _id: user._id }, {
                $set: {
                    accountLockedUntil: new Date(Date.now() + lockDuration) // Set lockout time
                }
            });
            return res.status(403).json({ success: false, message: 'Account locked due to too many invalid login attempts.' });
        }

        return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    // Reset invalid login attempts upon successful login
    await usersCollection.updateOne(
        { _id: user._id },
        {
            $set: {
                invalidLoginAttempts: 0,
                accountLockedUntil: null,
                lastLoginTime: new Date() // Store current time in UTC
            }
        }
    );
    req.session.userId = user._id; // Store user ID in session
    res.json({ success: true, message: 'Login successful!' });
});

// Forgot password route (sends reset email)
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    const user = await usersCollection.findOne({ emaildb: email });
    if (!user) {
        return res.status(400).json('Email not found.');
    }

    const resetToken = Math.random().toString(36).substring(2, 15); // Generate a simple token
    const resetUrl = `http://localhost:${PORT}/reset-password.html`;

    // Store token temporarily in the database for validation
    await usersCollection.updateOne({ _id: user._id }, { $set: { resetToken: resetToken } });
    
    // Send the reset password email
    const data = {
        from: 'Anime@Sakalam.com',
        to: email,
        subject: 'Password Reset Request',
        html: `
            You have requested to reset your password.<br>
            Click the link to reset your password: <a href="${resetUrl}">${resetUrl}</a><br>
            Reset Token at MongoDB Compass...
        `
    };
    
    mg.messages().send(data, function (error, body) {
        if (error) {
            return res.status(500).json({ success: false, message: 'Failed to send reset email.' });
        }
        res.json({ success: true, message: 'Password reset email sent.' });
    });
});

// Reset password route (verifies token and updates password)
app.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json('Please fill up all fields!');
    }

    const user = await usersCollection.findOne({ resetToken: token });
    if (!user) {
        return res.status(400).json('Invalid or expired token.');
    }

    if (newPassword.length < 7) {  
        return res.status(400).json('Password must be at least 7 characters long.' );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and remove the reset token
    await usersCollection.updateOne(
        { _id: user._id },
        {
            $set: { password: hashedPassword, resetToken: null }
        }
    );
    // Send a message that will be handled by frontend JS
    res.send('Password updated successfully.');
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ success: false, message: 'Logout failed.' });
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully.' });
    });
});

// Starting server
const PORT = process.env.PORT || 1000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}/signup.html`);
});
