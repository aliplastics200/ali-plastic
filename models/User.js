const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAuthorized: { type: Boolean, default: false } // The lock
});

module.exports = mongoose.model('User', userSchema);