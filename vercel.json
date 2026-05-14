// lib/auth.js - JWT helper สำหรับ admin auth
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

// Middleware: ตรวจสอบว่าเป็น admin
function requireAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  return verifyToken(token);
}

// CORS helper
function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Response helper
function ok(res, data) {
  setCORS(res);
  return res.status(200).json({ success: true, ...data });
}

function fail(res, error, status = 400) {
  setCORS(res);
  return res.status(status).json({ success: false, error });
}

function handleOptions(res) {
  setCORS(res);
  res.status(204).end();
}

module.exports = { signToken, verifyToken, requireAdmin, setCORS, ok, fail, handleOptions };
