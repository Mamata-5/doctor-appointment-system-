// db.js
// Usage:
//   node db.js --init   -> creates database file `data.db` and seeds sample data
// This uses better-sqlite3 for simplicity & transactional safety.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.resolve(__dirname, 'data.db');

function connect() {
  // create dir if needed
  return new Database(DB_FILE);
}

function init() {
  // remove existing file (for demo)
  if (fs.existsSync(DB_FILE)) {
    console.log('Removing existing DB file:', DB_FILE);
    fs.unlinkSync(DB_FILE);
  }
  const db = connect();

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      speciality TEXT,
      room TEXT
    );

    CREATE TABLE slots (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL,
      date TEXT NOT NULL,      -- YYYY-MM-DD
      time TEXT NOT NULL,      -- HH:MM
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    );

    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL UNIQUE,  -- unique to prevent double-booking
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'Confirmed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
    );
  `);

  // sample data
  const insertDoctor = db.prepare(`INSERT INTO doctors (id,name,speciality,room) VALUES (?, ?, ?, ?)`);
  insertDoctor.run('D001', 'Dr. Asha Mehta', 'General Physician', '101');
  insertDoctor.run('D002', 'Dr. Rajesh Singh', 'Cardiologist', '201');

  const insertSlot = db.prepare(`INSERT INTO slots (id,doctor_id,date,time) VALUES (?, ?, ?, ?)`);
  const today = new Date().toISOString().slice(0,10);
  insertSlot.run('SL1', 'D001', today, '09:00');
  insertSlot.run('SL2', 'D001', today, '09:30');
  insertSlot.run('SL3', 'D002', today, '10:00');

  console.log('Database initialized with sample data at', DB_FILE);
  db.close();
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--init')) init();
  else console.log('Run with --init to create DB: node db.js --init');
}

module.exports = {
  connect,
  DB_FILE
};
