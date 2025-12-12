// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const { body, param, validationResult, query } = require('express-validator');
const { connect } = require('./db');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// open DB
const db = connect();
db.pragma('foreign_keys = ON');

// Simple helper to send validation errors
function handleValidation(req, res) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) {
    return res.status(400).json({ errors: errs.array() });
  }
  return null;
}

/*
  DOCTORS
*/
app.get('/doctors', (req, res) => {
  const rows = db.prepare('SELECT * FROM doctors ORDER BY name').all();
  res.json(rows);
});

app.post('/doctors',
  body('id').isString().trim().notEmpty(),
  body('name').isString().trim().notEmpty(),
  body('speciality').optional().isString(),
  body('room').optional().isString(),
  (req, res) => {
    if (handleValidation(req, res)) return;
    const { id, name, speciality, room } = req.body;
    try {
      const stmt = db.prepare('INSERT INTO doctors (id,name,speciality,room) VALUES (?, ?, ?, ?)');
      stmt.run(id, name, speciality || null, room || null);
      return res.status(201).json({ id, name, speciality, room });
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return res.status(409).json({ error: 'Doctor ID already exists' });
      console.error(err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });

app.put('/doctors/:id',
  param('id').isString(),
  body('name').optional().isString(),
  body('speciality').optional().isString(),
  body('room').optional().isString(),
  (req, res) => {
    if (handleValidation(req, res)) return;
    const id = req.params.id;
    const doc = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    const { name = doc.name, speciality = doc.speciality, room = doc.room } = req.body;
    db.prepare('UPDATE doctors SET name = ?, speciality = ?, room = ? WHERE id = ?').run(name, speciality, room, id);
    res.json({ id, name, speciality, room });
  });

app.delete('/doctors/:id', param('id').isString(), (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM doctors WHERE id = ?').run(id);
  res.status(204).send();
});

/*
  SLOTS
*/
app.get('/slots',
  // optional query filters: doctorId, date
  query('doctorId').optional().isString(),
  query('date').optional().isISO8601(),
  (req, res) => {
    const { doctorId, date } = req.query;
    let sql = 'SELECT s.*, d.name as doctor_name, d.speciality FROM slots s JOIN doctors d ON d.id = s.doctor_id';
    const where = [];
    const vals = [];
    if (doctorId) { where.push('s.doctor_id = ?'); vals.push(doctorId); }
    if (date) { where.push('s.date = ?'); vals.push(date); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY s.date, s.time';
    const rows = db.prepare(sql).all(...vals);
    res.json(rows);
  });

app.post('/slots',
  body('doctorId').isString().notEmpty(),
  body('date').isISO8601(),
  body('time').matches(/^([0-1]\d|2[0-3]):([0-5]\d)$/),
  (req, res) => {
    if (handleValidation(req, res)) return;
    const { doctorId, date, time } = req.body;
    // ensure doctor exists
    const doc = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);
    if (!doc) return res.status(400).json({ error: 'Doctor not found' });

    const id = uuidv4();
    try {
      db.prepare('INSERT INTO slots (id, doctor_id, date, time) VALUES (?, ?, ?, ?)').run(id, doctorId, date, time);
      res.status(201).json({ id, doctorId, date, time });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal error' });
    }
  });

app.put('/slots/:id',
  param('id').isString(),
  body('doctorId').optional().isString(),
  body('date').optional().isISO8601(),
  body('time').optional().matches(/^([0-1]\d|2[0-3]):([0-5]\d)$/),
  (req, res) => {
    if (handleValidation(req, res)) return;
    const id = req.params.id;
    const s = db.prepare('SELECT * FROM slots WHERE id = ?').get(id);
    if (!s) return res.status(404).json({ error: 'Slot not found' });

    // if slot has appointment -> prevent changing basic identity (optional)
    const appt = db.prepare('SELECT * FROM appointments WHERE slot_id = ?').get(id);
    if (appt) return res.status(409).json({ error: 'Cannot edit slot with an existing appointment' });

    const doctorId = req.body.doctorId || s.doctor_id;
    const date = req.body.date || s.date;
    const time = req.body.time || s.time;
    db.prepare('UPDATE slots SET doctor_id = ?, date = ?, time = ? WHERE id = ?').run(doctorId, date, time, id);
    res.json({ id, doctorId, date, time });
  });

app.delete('/slots/:id', param('id').isString(), (req, res) => {
  const id = req.params.id;
  // deleting slot will cascade-delete appointment (foreign key ON DELETE CASCADE)
  db.prepare('DELETE FROM slots WHERE id = ?').run(id);
  res.status(204).send();
});

/*
  APPOINTMENTS (booking)
  Important: prevent double-booking using a transaction and a UNIQUE constraint on slot_id
*/
app.get('/appointments', (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, s.date, s.time, s.doctor_id, d.name as doctor_name, d.speciality
    FROM appointments a
    LEFT JOIN slots s ON s.id = a.slot_id
    LEFT JOIN doctors d ON d.id = s.doctor_id
    ORDER BY a.created_at DESC
  `).all();
  res.json(rows);
});

app.get('/appointments/:id', param('id').isString(), (req, res) => {
  const id = req.params.id;
  const a = db.prepare(`
    SELECT a.*, s.date, s.time, s.doctor_id, d.name as doctor_name, d.speciality
    FROM appointments a
    LEFT JOIN slots s ON s.id = a.slot_id
    LEFT JOIN doctors d ON d.id = s.doctor_id
    WHERE a.id = ?
  `).get(id);
  if (!a) return res.status(404).json({ error: 'Appointment not found' });
  res.json(a);
});

app.post('/appointments',
  body('slotId').isString().notEmpty(),
  body('patientName').isString().trim().notEmpty(),
  body('patientPhone').optional().isString(),
  body('reason').optional().isString(),
  async (req, res) => {
    if (handleValidation(req, res)) return;
    const { slotId, patientName, patientPhone, reason } = req.body;

    // ensure slot exists
    const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slotId);
    if (!slot) return res.status(400).json({ error: 'Slot not found' });

    // Try to insert appointment in a transaction; UNIQUE(slot_id) prevents double-booking
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const insert = db.prepare(`INSERT INTO appointments (id, slot_id, patient_name, patient_phone, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const txn = db.transaction(() => {
      insert.run(id, slotId, patientName, patientPhone || null, reason || null, 'Confirmed', createdAt);
    });

    try {
      txn();
      const inserted = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
      return res.status(201).json(inserted);
    } catch (err) {
      // If the slot_id unique constraint failed, it's a double-book
      if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
        return res.status(409).json({ error: 'Slot already booked' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Internal error' });
    }
  });

app.delete('/appointments/:id', param('id').isString(), (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM appointments WHERE id = ?').run(id);
  res.status(204).send();
});

/*
  Health check
*/
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// start server
app.listen(PORT, () => {
  console.log(`Doctor Booking API listening on http://localhost:${PORT}`);
});
