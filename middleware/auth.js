module.exports = {
    // Check if logged in
    ensureAuthenticated: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/login');
    },
    
    // Check if Admin has approved them
    ensureAuthorized: (req, res, next) => {
        if (req.user && req.user.isAuthorized) {
            return next();
        }
        res.render('unauthorized', { user: req.user }); // Show a "Please wait for approval" page
    }
};