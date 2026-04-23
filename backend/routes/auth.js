const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Warn early if mail credentials are missing (common cause of live-site SMTP failures)
if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
  console.warn('[mail] WARNING: MAIL_USER or MAIL_PASS env vars are not set. Email sending will fail.');
}

// Port 587 + STARTTLS works on virtually all cloud hosts.
// Port 465 (SSL) is frequently blocked by cloud providers (Render, Railway, Fly, etc.).
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // STARTTLS — required for port 587
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // avoids SNI/cert issues on some VPS environments
  },
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('[mail] SMTP Connection Error:', error.message);
  } else {
    console.log('[mail] SMTP Server is ready to send emails');
  }
});
const router = express.Router();

// Register
router.post('/register', [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one symbol'),
  body('role').optional().isIn(['user', 'owner']).withMessage('Role must be user or owner')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, role = 'user' } = req.body;
    const dbInstance = db.getDb();

    // Check if user exists
    dbInstance.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (user) {
        return res.status(400).json({ error: 'User already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user
      dbInstance.run(
        'INSERT INTO users (username, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?)',
        [username, email, hashedPassword, role, role === 'user' ? 1 : 0],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Error creating user' });
          }

          const token = jwt.sign(
            { id: this.lastID, username, email, role, is_verified: role === 'user' ? 1 : 0 },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          // Fetch the full user record to get created_at
          dbInstance.get('SELECT id, username, email, role, is_verified, created_at FROM users WHERE id = ?', [this.lastID], (err2, newUser) => {
            res.status(201).json({
              message: 'User registered successfully',
              token,
              user: newUser || { id: this.lastID, username, email, role, is_verified: role === 'user' ? 1 : 0 }
            });
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const dbInstance = db.getDb();

    dbInstance.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email, role: user.role, is_verified: user.is_verified },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          is_verified: user.is_verified,
          created_at: user.created_at
        }
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', authenticate, (req, res) => {
  const dbInstance = db.getDb();
  dbInstance.get('SELECT id, username, email, role, is_verified, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  });
});

// Forgot Password
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) {
      return res.json({ message: 'If that email is registered, a password reset token has been sent.' });
    }

    // Generate a 6-character OTP style token for easier typing
    const token = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    dbInstance.run('DELETE FROM password_resets WHERE email = ?', [email], (err) => {
      if (err) console.error(err);
      
      dbInstance.run('INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)', [email, token, expiresAt], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const mailOptions = {
          from: process.env.MAIL_USER,
          to: email,
          subject: 'EV Assistant - Password Reset',
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #4a90e2; text-align: center;">Reset Your Password</h2>
              <p>Hello,</p>
              <p>You recently requested to reset the password for your EV Smart Route & Charging Assistant account.</p>
              <p>Please use the following 6-character code to reset your password:</p>
              <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${token}
              </div>
              <p>If you didn't request a password reset, you can safely ignore this email. This code will expire in 1 hour.</p>
            </div>
          `
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ error: 'Failed to send email' });
          }
          res.json({ message: 'If that email is registered, a password reset token has been sent.' });
        });
      });
    });
  });
});

// Reset Password
router.post('/reset-password', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one symbol')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, token, newPassword } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get('SELECT * FROM password_resets WHERE email = ? AND token = ?', [email, token], async (err, record) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!record) {
      return res.status(400).json({ error: 'Invalid reset token or email' });
    }

    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    dbInstance.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], (err) => {
      if (err) return res.status(500).json({ error: 'Error updating password' });
      
      dbInstance.run('DELETE FROM password_resets WHERE email = ?', [email], () => {
        res.json({ message: 'Password has been successfully reset' });
      });
    });
  });
});

// Request Password Change (Generates and sends OTP)
router.post('/request-password-change', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { currentPassword } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Incorrect current password' });

    // Generate a 6-character OTP
    const otp = crypto.randomBytes(3).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60000); // 15 minutes

    // Clear any pending requests for this user
    dbInstance.run('DELETE FROM password_change_otps WHERE user_id = ?', [req.user.id], (err) => {
      if (err) console.error('Error clearing old password OTPs:', err);

      // Insert new OTP request
      dbInstance.run(
        'INSERT INTO password_change_otps (user_id, otp, expires_at) VALUES (?, ?, ?)',
        [req.user.id, otp, expiresAt],
        (err) => {
          if (err) return res.status(500).json({ error: 'Failed to create OTP request' });

          // Send email to current email
          // Send email to current email
          const mailOptions = {
            from: process.env.MAIL_USER,
            to: user.email,
            subject: 'EV Assistant - Verify Password Change',
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #4a90e2; text-align: center;">Verify Password Change</h2>
                <p>Hello ${user.username},</p>
                <p>We received a request to change your account password.</p>
                <p>To authorize this change, please enter the following 6-character code:</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                  ${otp}
                </div>
                <p>If you did not request this, please ignore this email. This code will expire in 15 minutes.</p>
              </div>
            `
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Error sending OTP email:', error);
              return res.status(500).json({ error: 'Failed to send OTP email' });
            }
            res.json({ message: 'OTP sent to your registered email address.' });
          });
        }
      );
    });
  });
});

// Verify OTP & Change Password
router.post('/verify-password-change', authenticate, [
  body('otp').notEmpty().withMessage('OTP is required'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one symbol')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { otp, newPassword } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get(
    'SELECT * FROM password_change_otps WHERE user_id = ? AND otp = ?',
    [req.user.id, otp],
    async (err, record) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!record) return res.status(400).json({ error: 'Invalid OTP' });

      if (new Date() > new Date(record.expires_at)) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }

      // Valid OTP. Update password.
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      dbInstance.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update password' });

        // Clean up OTP record
        dbInstance.run('DELETE FROM password_change_otps WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'Password updated successfully!' });
      });
    }
  );
});

// Request Email Change (Generates and sends OTP)
router.post('/request-email-change', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newEmail').isEmail().withMessage('Please provide a valid new email address')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { currentPassword, newEmail } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Incorrect current password' });

    // Check if new email is already in use
    dbInstance.get('SELECT id FROM users WHERE email = ?', [newEmail], (err, existingUser) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ error: 'Email is already taken by another account' });
      }

      // Generate a 6-character OTP
      const otp = crypto.randomBytes(3).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + 15 * 60000); // 15 minutes as actual Date object

      // Clear any pending requests for this user
      dbInstance.run('DELETE FROM email_change_otps WHERE user_id = ?', [req.user.id], (err) => {
        if (err) console.error('Error clearing old email OTPs:', err);

        // Insert new OTP request
        dbInstance.run(
          'INSERT INTO email_change_otps (user_id, new_email, otp, expires_at) VALUES (?, ?, ?, ?)',
          [req.user.id, newEmail, otp, expiresAt],
          (err) => {
            if (err) return res.status(500).json({ error: 'Failed to create OTP request' });

            // Send email to the *current* registered email
            // Send email to the *current* registered email
            const mailOptions = {
              from: process.env.MAIL_USER,
              to: user.email, // Sent to current email!
              subject: 'EV Assistant - Verify Email Change',
              html: `
                <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                  <h2 style="color: #4a90e2; text-align: center;">Verify Email Change</h2>
                  <p>Hello ${user.username},</p>
                  <p>We received a request to change your account's email address to <strong>${newEmail}</strong>.</p>
                  <p>To authorize this change, please enter the following 6-character code:</p>
                  <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                    ${otp}
                  </div>
                  <p>If you did not request this, please ignore this email and your account will remain secure. This code will expire in 15 minutes.</p>
                </div>
              `
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error('Error sending OTP email:', error);
                return res.status(500).json({ error: 'Failed to send OTP email' });
              }
              res.json({ message: 'OTP sent to your current email address.' });
            });
          }
        );
      });
    });
  });
});

// Verify OTP & Change Email
router.post('/verify-email-change', authenticate, [
  body('otp').notEmpty().withMessage('OTP is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { otp } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get(
    'SELECT * FROM email_change_otps WHERE user_id = ? AND otp = ?',
    [req.user.id, otp],
    (err, record) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!record) return res.status(400).json({ error: 'Invalid OTP' });

      if (new Date() > new Date(record.expires_at)) {
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
      }

      // Valid OTP. Proceed to update the users table.
      const newEmail = record.new_email;

      dbInstance.run('UPDATE users SET email = ? WHERE id = ?', [newEmail, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update email' });

        // Clean up OTP record
        dbInstance.run('DELETE FROM email_change_otps WHERE user_id = ?', [req.user.id]);

        // Need the user object to generate a new token
        dbInstance.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, user) => {
           if(err || !user) return res.status(500).json({error: 'Failed to load user info'});

           const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role, is_verified: user.is_verified },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({ 
            message: 'Email updated successfully!',
            token,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
              is_verified: user.is_verified
            }
          });
        });
      });
    }
  );
});

// Direct Password Change (Admin & Owner bypass OTP)
router.post('/direct-password-change', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one symbol')
], async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Unauthorized to bypass OTP' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { currentPassword, newPassword } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Incorrect current password' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    dbInstance.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update password' });
      res.json({ message: 'Password updated successfully!' });
    });
  });
});

// Direct Email Change (Admin & Owner bypass OTP)
router.post('/direct-email-change', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newEmail').isEmail().withMessage('Please provide a valid new email address')
], async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'owner') {
    return res.status(403).json({ error: 'Unauthorized to bypass OTP' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { currentPassword, newEmail } = req.body;
  const dbInstance = db.getDb();

  dbInstance.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(400).json({ error: 'Incorrect current password' });
    
    dbInstance.get('SELECT id FROM users WHERE email = ?', [newEmail], (err, existingUser) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (existingUser && existingUser.id !== req.user.id) {
        return res.status(400).json({ error: 'Email is already taken by another account' });
      }

      dbInstance.run('UPDATE users SET email = ? WHERE id = ?', [newEmail, req.user.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to update email' });
        
        dbInstance.get('SELECT * FROM users WHERE id = ?', [req.user.id], (err, updatedUser) => {
           if(err || !updatedUser) return res.status(500).json({error: 'Failed to load user info'});

           const token = jwt.sign(
            { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, role: updatedUser.role, is_verified: updatedUser.is_verified },
            JWT_SECRET,
            { expiresIn: '7d' }
          );

          res.json({ 
            message: 'Email updated successfully!',
            token,
            user: {
              id: updatedUser.id,
              username: updatedUser.username,
              email: updatedUser.email,
              role: updatedUser.role,
              is_verified: updatedUser.is_verified
            }
          });
        });
      });
    });
  });
});


// Delete own account
router.delete('/delete-account', authenticate, (req, res) => {
  const dbInstance = db.getDb();
  const userId = req.user.id;
  const userRole = req.user.role;

  const performDelete = () => {
    dbInstance.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to delete account' });
      res.json({ message: 'Account deleted successfully' });
    });
  };

  if (userRole === 'owner') {
    // If owner, delete their stations first
    dbInstance.run('DELETE FROM charging_stations WHERE owner_id = ?', [userId], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to delete owner stations' });
      performDelete();
    });
  } else {
    performDelete();
  }
});

module.exports = router;

