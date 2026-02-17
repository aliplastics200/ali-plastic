const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ensureAuthenticated, ensureAuthorized } = require('../middleware/auth');

// Signup Logic
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        
        res.redirect('/signup');
    }
});

// Login Logic
router.post('/login', passport.authenticate('local', {
    successRedirect: '/inventory/',
    failureRedirect: '/login',
    failureFlash: true // This tells passport to use the message from our Strategy
}));
// Show Login Page
router.get('/login', (req, res) => {
    res.render('login');
});

// Show Signup Page
router.get('/signup', (req, res) => {
    res.render('signup');
});
// Logout
router.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/login'));
});


// Get all users for the dashboard
router.get('/admin/users', ensureAuthenticated, async (req, res) => {
    // Optional: Add a check here to ensure ONLY you (the main admin) can see this
    
    const users = await User.find({});
    res.render('admin-users', { users });
});

// Toggle authorization status
router.post('/admin/authorize/:id', ensureAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.id || req.params.id);
        user.isAuthorized = !user.isAuthorized;
        await user.save();
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).send('Error updating user');
    }
});

module.exports = router;

