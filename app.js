var express = require('express');
var path = require('path');
var mongoose = require('mongoose');
var cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();

var app = express();

app.set('trust proxy', 1); // ✅ REQUIRED FOR HEROKU

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  name: 'ali-plastic-pos',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(flash());

require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.error = req.flash('error');
  res.locals.success_msg = req.flash('success_msg');
  res.locals.user = req.user || null;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/inventory', require('./routes/inventory'));

app.get('/', (req, res) => res.redirect('/login'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
