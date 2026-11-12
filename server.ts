import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHIFT_START = '09:30';
const PUNCTUALITY_WEIGHT = 0.3;
const PRODUCTIVITY_WEIGHT = 0.7;
const STANDARD_WORKDAY_HOURS = 8;
const POINTS_PER_ERROR = 2;
const MAX_ERROR_PENALTY = 30;

const db = new Database(path.join(__dirname, 'bim_bytes_v2.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    joiningDate TEXT DEFAULT '',
    emergencyContact TEXT DEFAULT '',
    address TEXT DEFAULT '',
    weekOff TEXT DEFAULT 'Sunday',
    altSatOff INTEGER DEFAULT 1,
    photo TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS active_sessions (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    project TEXT NOT NULL,
    task TEXT NOT NULL,
    subtask TEXT NOT NULL,
    startStatus TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    comment TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'running',
    startTimeMs INTEGER NOT NULL,
    startDisplay TEXT NOT NULL,
    breakTotalSec INTEGER DEFAULT 0,
    currentBreakStartMs INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    project TEXT NOT NULL,
    task TEXT NOT NULL,
    subtask TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    workHours REAL NOT NULL,
    breakMinutes INTEGER NOT NULL,
    startStatus TEXT NOT NULL,
    endStatus TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    comment TEXT DEFAULT '',
    punctuality TEXT DEFAULT 'On Time'
  );

  CREATE TABLE IF NOT EXISTS qc_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    employee TEXT NOT NULL,
    project TEXT NOT NULL,
    discipline TEXT NOT NULL,
    workType TEXT NOT NULL,
    subtask TEXT NOT NULL,
    errorCount INTEGER NOT NULL,
    comment TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending',
    reviewedBy TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS circulars (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    postedBy TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    imageUrl TEXT DEFAULT '',
    posterUrl TEXT DEFAULT '',
    likesJson TEXT DEFAULT '[]',
    reactionsJson TEXT DEFAULT '{}',
    commentsJson TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    addedBy TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    date TEXT NOT NULL,
    leaveType TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    appliedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    date TEXT NOT NULL,
    fromTime TEXT NOT NULL,
    toTime TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    appliedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    employee TEXT NOT NULL,
    type TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    sentBy TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    reply TEXT DEFAULT '',
    replyTime TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS chat_groups (
    groupId TEXT PRIMARY KEY,
    groupName TEXT NOT NULL,
    creator TEXT NOT NULL,
    membersJson TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    message TEXT DEFAULT '',
    photoUrl TEXT DEFAULT '',
    isGroup INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL,
    readByJson TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    target TEXT NOT NULL,
    message TEXT NOT NULL,
    project TEXT DEFAULT '',
    task TEXT DEFAULT '',
    subtask TEXT DEFAULT '',
    extra TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    dismissed INTEGER DEFAULT 0,
    readByJson TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS project_milestones (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    milestoneName TEXT NOT NULL,
    discipline TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'In Progress',
    progress INTEGER NOT NULL DEFAULT 0,
    lead TEXT NOT NULL,
    deliverable TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'High'
  );

  CREATE TABLE IF NOT EXISTS role_rates (
    role TEXT PRIMARY KEY,
    hourlyRate REAL NOT NULL,
    currency TEXT DEFAULT 'USD'
  );

  CREATE TABLE IF NOT EXISTS project_budgets (
    project TEXT PRIMARY KEY,
    allocatedBudget REAL NOT NULL
  );
`);

function fmtDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function fmtClockShort(d = new Date()): string {
  return d.toTimeString().slice(0, 5);
}

function fmtTimestamp(d = new Date()): string {
  return `${fmtDate(d)} ${fmtClockShort(d)}`;
}

// Ensure priority column exists on existing SQLite tables
try {
  db.exec(`ALTER TABLE active_sessions ADD COLUMN priority TEXT DEFAULT 'Medium'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN priority TEXT DEFAULT 'Medium'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE qc_logs ADD COLUMN status TEXT DEFAULT 'Pending'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE qc_logs ADD COLUMN reviewedBy TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN dailyFocus TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN dailyFocusDate TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN dailyFocusProject TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN employmentStatus TEXT DEFAULT 'Active'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN reportsTo TEXT DEFAULT 'Rebecca Mary'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN hourlySalary REAL DEFAULT 45`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN lunchBreakStart TEXT DEFAULT '13:00'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN lunchBreakEnd TEXT DEFAULT '13:45'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN teaBreakStart TEXT DEFAULT '17:00'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN teaBreakEnd TEXT DEFAULT '17:15'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN autoBreakEnabled INTEGER DEFAULT 1`);
} catch {
  // column already exists
}
for (const colDef of [
  `empCode TEXT DEFAULT ''`,
  `department TEXT DEFAULT 'MEP-BIM'`,
  `designation TEXT DEFAULT 'BIM MODELER-MECHANICAL'`,
  `shiftIn TEXT DEFAULT '9:00 AM'`,
  `workingHours REAL DEFAULT 9`,
  `shiftOut TEXT DEFAULT '6:00 PM'`,
  `allSaturdaysOff INTEGER DEFAULT 0`,
  `monthlySalary REAL DEFAULT 23500`,
  `uanNumber TEXT DEFAULT '-'`,
  `workLocation TEXT DEFAULT 'BIM BYTES SOLUTIONS'`,
  `bankName TEXT DEFAULT '-'`,
  `bankAccountNo TEXT DEFAULT '-'`,
  `ifscCode TEXT DEFAULT '-'`,
  `branchName TEXT DEFAULT '-'`,
  `pfNumber TEXT DEFAULT '-'`,
  `esicNumber TEXT DEFAULT '-'`,
  `screenTimeHours REAL DEFAULT 0`,
]) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${colDef}`);
  } catch {
    // column already exists
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS job_assignments (
    id TEXT PRIMARY KEY,
    employee TEXT NOT NULL,
    project TEXT NOT NULL,
    task TEXT NOT NULL,
    subtask TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    assignedBy TEXT NOT NULL,
    assignedByRole TEXT NOT NULL,
    allocatedHours REAL DEFAULT 8,
    assignDate TEXT DEFAULT '',
    parentJobId TEXT DEFAULT '',
    mainHandover TEXT DEFAULT '',
    assignmentStage TEXT DEFAULT 'direct',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'Assigned',
    updatedAt TEXT NOT NULL
  );
`);

for (const jobCol of [
  `allocatedHours REAL DEFAULT 8`,
  `assignDate TEXT DEFAULT ''`,
  `parentJobId TEXT DEFAULT ''`,
  `mainHandover TEXT DEFAULT ''`,
  `assignmentStage TEXT DEFAULT 'direct'`,
]) {
  try {
    db.exec(`ALTER TABLE job_assignments ADD COLUMN ${jobCol}`);
  } catch {
    // column already exists
  }
}

// Seed the official BIM Bytes Solutions Employee Roster & Purge any legacy example/demo records
function purgeAllExampleData(keepUsername?: string) {
  const exampleNames = [
    'Rebecca Mary',
    'Arun Kumar',
    'Karthik S',
    'Priya Nair',
    'Vignesh R',
    'Deepak M',
    'Anitha V',
    'Surya Prakash',
    'Raghavan K',
    'Arjun Mehta',
    'Anitha K',
    'Suresh Babu',
    'Divya P',
    'Meenakshi N',
    'Aravind Kumar',
    'Priya Darshini',
  ].filter((n) => n !== keepUsername);

  const delUser = db.prepare(`DELETE FROM users WHERE username = ?`);
  const delAct = db.prepare(`DELETE FROM active_sessions WHERE username = ?`);
  const delAssign = db.prepare(`DELETE FROM job_assignments WHERE employee = ? OR assignedBy = ? OR mainHandover = ?`);
  const delSession = db.prepare(`DELETE FROM sessions WHERE username = ?`);
  const delQc = db.prepare(`DELETE FROM qc_logs WHERE employee = ? OR reviewer = ?`);
  const delMemo = db.prepare(`DELETE FROM memos WHERE employee = ? OR sentBy = ?`);

  for (const name of exampleNames) {
    delUser.run(name);
    delAct.run(name);
    delAssign.run(name, name, name);
    delSession.run(name);
    delQc.run(name, name);
    delMemo.run(name, name);
  }

  // Also remove any user row matching 'Rebecca Mary' (case-insensitive) that is not 'REBECCA MARY REETHU P', or any row with empCode = '1034' named Rebecca
  db.prepare(`
    DELETE FROM users
    WHERE (LOWER(TRIM(username)) = 'rebecca mary')
       OR (empCode = '1034' AND LOWER(username) LIKE '%rebecca%')
  `).run();

  // Delete pre-seeded example milestones (ms_1 .. ms_6)
  db.prepare(`DELETE FROM project_milestones WHERE id IN ('ms_1', 'ms_2', 'ms_3', 'ms_4', 'ms_5', 'ms_6')`).run();

  // Delete pre-seeded example job pools & splits
  db.prepare(`
    DELETE FROM job_assignments
    WHERE id IN (
      'pool_cmrl_hvac',
      'split_cmrl_mari',
      'split_cmrl_thanzeeler',
      'split_cmrl_gokulnath',
      'pool_cmrl_ff',
      'job_1',
      'job_2'
    )
  `).run();

  // Delete pre-seeded example active session for Rebecca Mary
  db.prepare(`
    DELETE FROM active_sessions
    WHERE username = 'Rebecca Mary'
      AND comment = 'Station Level-2 federated model priority review'
  `).run();

  // Delete pre-seeded example session for Rebecca Mary
  db.prepare(`
    DELETE FROM sessions
    WHERE username = 'Rebecca Mary'
      AND comment = 'Model audit and client federated review'
  `).run();

  // Delete pre-seeded example QC logs
  db.prepare(`
    DELETE FROM qc_logs
    WHERE comment IN (
      'Invert level annotation missing on Podium RWP riser sheet',
      'Emergency luminaire family circuit parameter mismatch',
      'Zero-error signoff on Zone A sprinkler main',
      'Fire damper sleeve elevation mismatch at Grid C-04',
      'Missing clearance tag on 600mm ladder tray'
    )
  `).run();

  // Delete pre-seeded example circulars, memos, chat groups, chat messages, and notifications
  db.prepare(`DELETE FROM circulars WHERE id IN ('circ_1', 'circ_2')`).run();
  db.prepare(`DELETE FROM memos WHERE id = 'memo_1'`).run();
  db.prepare(`DELETE FROM chat_groups WHERE groupId = 'grp_mep_core'`).run();
  db.prepare(`DELETE FROM chat_messages WHERE id IN ('msg_1', 'msg_2', 'msg_3', 'msg_4_img')`).run();
  db.prepare(`DELETE FROM notifications WHERE id IN ('notif_1', 'notif_2', 'notif_3', 'notif_4', 'notif_5')`).run();

  // Clear pre-seeded example dailyFocus text from Rebecca Mary if still set to demo string
  db.prepare(`
    UPDATE users
    SET dailyFocus = '', dailyFocusDate = '', dailyFocusProject = ''
    WHERE dailyFocus = 'Federated MEP model review & Q4 milestone signoff for Station Level-2'
  `).run();

  return exampleNames.length;
}

{
  const rosterEmployees: Array<{
    username: string;
    empCode: string;
    department: string;
    designation: string;
    role: string;
    shiftIn: string;
    workingHours: number;
    shiftOut: string;
    allSaturdaysOff: number;
    monthlySalary: number;
    hourlySalary: number;
    screenTimeHours: number;
    reportsTo: string;
  }> = [
    { username: 'SONAIMUTHU V', empCode: '1001', department: 'CO-ORDINATOR', designation: 'SENIOR BIM MODELER-MECHANICAL', role: 'Coordinator', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 32000, hourlySalary: 140, screenTimeHours: 168.5, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'KARTHI M', empCode: '1013', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 52.4, reportsTo: 'SONAIMUTHU V' },
    { username: 'THANZEELER RAHMAN', empCode: '1017', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 25000, hourlySalary: 110, screenTimeHours: 171.2, reportsTo: 'SONAIMUTHU V' },
    { username: 'MARI SELVAM', empCode: '1018', department: 'MEP-BIM', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 142.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'JANARTHANAN', empCode: '1020', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 25000, hourlySalary: 110, screenTimeHours: 172.8, reportsTo: 'SONAIMUTHU V' },
    { username: 'DEEPAK', empCode: '1021', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24500, hourlySalary: 108, screenTimeHours: 163.5, reportsTo: 'SONAIMUTHU V' },
    { username: 'SIVAKUMAR', empCode: '1022', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 160.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'AGATHIYAN EZHIL ADHAN', empCode: '1024', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 158.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'GOKULNATH', empCode: '1025', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19500, hourlySalary: 85, screenTimeHours: 174.2, reportsTo: 'SONAIMUTHU V' },
    { username: 'TAMIZHARASAN', empCode: '1029', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19500, hourlySalary: 85, screenTimeHours: 160.4, reportsTo: 'SONAIMUTHU V' },
    { username: 'SIRIKI VEERA SATISH', empCode: '1030', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 155.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'REBECCA MARY REETHU P', empCode: '1031', department: 'BIM-HR/ADMIN', designation: 'BIM-HR/ADMIN', role: 'HR', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 1, monthlySalary: 35000, hourlySalary: 155, screenTimeHours: 85.5, reportsTo: 'Founder' },
    { username: 'KIRI PAVAN', empCode: '1034', department: 'MEP-ELECTRICAL', designation: 'Jr.BIM MODELER -ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19000, hourlySalary: 82, screenTimeHours: 102.3, reportsTo: 'SONAIMUTHU V' },
    { username: 'MAJHARULLA', empCode: '1035', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 152.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'KARTHICK P', empCode: '1036', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'QC', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 26000, hourlySalary: 115, screenTimeHours: 164.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SURYA PRAKASH', empCode: '1037', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19000, hourlySalary: 82, screenTimeHours: 88.6, reportsTo: 'SONAIMUTHU V' },
    { username: 'RANJITHA D', empCode: '1038', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 159.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'J MOHAMED HASIK', empCode: '1039', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 166.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'G AKASH', empCode: '1040', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 18500, hourlySalary: 80, screenTimeHours: 140.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'KARTHI G', empCode: '1041', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 170.5, reportsTo: 'SONAIMUTHU V' },
    { username: 'THASLEEMA A', empCode: '1042', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 8, shiftOut: '5:00 PM', allSaturdaysOff: 1, monthlySalary: 22500, hourlySalary: 105, screenTimeHours: 154.0, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'KATTU BAVA K', empCode: '1043', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24500, hourlySalary: 108, screenTimeHours: 173.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SARAVANA KUMAR BP', empCode: '1044', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24500, hourlySalary: 108, screenTimeHours: 167.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SANJAY D', empCode: '1045', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 18500, hourlySalary: 80, screenTimeHours: 138.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'MOHANAKRISHNAN', empCode: '1046', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 145.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SELVAN A', empCode: '1047', department: 'MEP-MECHANICAL', designation: 'SENIOR BIM MODELER-MECHANICAL', role: 'Main Handover', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 30000, hourlySalary: 132, screenTimeHours: 175.5, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'HASAN FAMEERDEEN S', empCode: '1048', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 172.0, reportsTo: 'SELVAN A' },
    { username: 'SENTHIL KUMAR G', empCode: '1049', department: 'MEP-MECHANICAL', designation: 'SENIOR BIM COORDINATOR', role: 'Main Handover', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 31000, hourlySalary: 135, screenTimeHours: 169.0, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'SARAN BALAJI S', empCode: '1050', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 161.0, reportsTo: 'SELVAN A' },
    { username: 'NAGOOR MEERAN MALIK SK', empCode: '1051', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 163.0, reportsTo: 'SELVAN A' },
    { username: 'SURYA B', empCode: '1052', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 171.0, reportsTo: 'SELVAN A' },
    { username: 'ABHISHEK V', empCode: '1053', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 172.5, reportsTo: 'SELVAN A' },
    { username: 'SABARISH D', empCode: '1054', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 160.0, reportsTo: 'SELVAN A' },
  ];

  const insRosterUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      username, password, role, empCode, department, designation,
      shiftIn, workingHours, shiftOut, allSaturdaysOff,
      monthlySalary, hourlySalary, screenTimeHours, reportsTo,
      joiningDate, address, weekOff, altSatOff, employmentStatus,
      workLocation, uanNumber, bankName, bankAccountNo, ifscCode, branchName, pfNumber, esicNumber,
      lunchBreakStart, lunchBreakEnd, teaBreakStart, teaBreakEnd, autoBreakEnabled
    ) VALUES (?, '1234', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2024-01-10', 'Avadi, Chennai', 'Sunday', 1, 'Active', 'BIM BYTES SOLUTIONS', '-', '-', '-', '-', '-', '-', '-', '13:00', '13:45', '17:00', '17:15', 1)
  `);
  const updRosterMeta = db.prepare(`
    UPDATE users
    SET empCode = CASE WHEN empCode IS NULL OR empCode = '' THEN ? ELSE empCode END,
        department = CASE WHEN department IS NULL OR department = '' THEN ? ELSE department END,
        designation = CASE WHEN designation IS NULL OR designation = '' THEN ? ELSE designation END,
        shiftIn = CASE WHEN shiftIn IS NULL OR shiftIn = '' THEN ? ELSE shiftIn END,
        workingHours = CASE WHEN workingHours IS NULL OR workingHours = 0 THEN ? ELSE workingHours END,
        shiftOut = CASE WHEN shiftOut IS NULL OR shiftOut = '' THEN ? ELSE shiftOut END,
        monthlySalary = CASE WHEN monthlySalary IS NULL OR monthlySalary = 0 THEN ? ELSE monthlySalary END,
        screenTimeHours = CASE WHEN screenTimeHours IS NULL OR screenTimeHours = 0 THEN ? ELSE screenTimeHours END
    WHERE username = ?
  `);
  for (const emp of rosterEmployees) {
    insRosterUser.run(
      emp.username,
      emp.role,
      emp.empCode,
      emp.department,
      emp.designation,
      emp.shiftIn,
      emp.workingHours,
      emp.shiftOut,
      emp.allSaturdaysOff,
      emp.monthlySalary,
      emp.hourlySalary,
      emp.screenTimeHours,
      emp.reportsTo
    );
    updRosterMeta.run(
      emp.empCode,
      emp.department,
      emp.designation,
      emp.shiftIn,
      emp.workingHours,
      emp.shiftOut,
      emp.monthlySalary,
      emp.screenTimeHours,
      emp.username
    );
  }

  // Purge all example users & demo records from the SQLite database on startup
  purgeAllExampleData();
}

const rateCount = (db.prepare('SELECT COUNT(*) as c FROM role_rates').get() as { c: number }).c;
if (rateCount === 0) {
  const insRate = db.prepare(`INSERT INTO role_rates (role, hourlyRate, currency) VALUES (?, ?, ?)`);
  insRate.run('Management', 85, 'USD');
  insRate.run('QC', 60, 'USD');
  insRate.run('Production', 42, 'USD');

  const insBudget = db.prepare(`INSERT INTO project_budgets (project, allocatedBudget) VALUES (?, ?)`);
  insBudget.run('CMRL', 15000);
  insBudget.run('Data Center', 12000);
  insBudget.run('MBS-IR2', 18000);
  insBudget.run('SPA RITZ AND ADDRESS', 14000);
  insBudget.run('Tanglin Shopping Center', 10000);
  insBudget.run('RSRM Hospital', 9500);
}

// ============================================================================
// WEBSOCKET CONNECTION REGISTRY & HELPERS
// ============================================================================
interface WsClient {
  ws: WebSocket;
  username: string;
  role: string;
}

const wsClients = new Set<WsClient>();

function getEmployeesList() {
  const rows = db.prepare(`SELECT * FROM users ORDER BY CASE WHEN empCode != '' AND empCode IS NOT NULL THEN CAST(empCode AS INTEGER) ELSE 9999 END ASC, username ASC`).all() as any[];
  return rows.map((r, idx) => ({
    username: r.username,
    role: r.role,
    empCode: r.empCode || String(1001 + idx),
    department: r.department || 'MEP-BIM',
    designation: r.designation || (r.role === 'HR' || r.role === 'Management' ? 'BIM-HR/ADMIN' : 'BIM MODELER-MECHANICAL'),
    shiftIn: r.shiftIn || '9:00 AM',
    workingHours: Number(r.workingHours ?? 9),
    shiftOut: r.shiftOut || '6:00 PM',
    allSaturdaysOff: Boolean(r.allSaturdaysOff),
    monthlySalary: Number(r.monthlySalary ?? 23500),
    uanNumber: r.uanNumber || '-',
    workLocation: r.workLocation || 'BIM BYTES SOLUTIONS',
    bankName: r.bankName || '-',
    bankAccountNo: r.bankAccountNo || '-',
    ifscCode: r.ifscCode || '-',
    branchName: r.branchName || '-',
    pfNumber: r.pfNumber || '-',
    esicNumber: r.esicNumber || '-',
    screenTimeHours: Number(r.screenTimeHours ?? 156),
    joiningDate: r.joiningDate || '',
    emergencyContact: r.emergencyContact || '',
    address: r.address || 'Avadi, Chennai',
    weekOff: r.weekOff || 'Sunday',
    altSatOff: Boolean(r.altSatOff),
    photo: r.photo || '',
    dailyFocus: r.dailyFocus || '',
    dailyFocusDate: r.dailyFocusDate || '',
    dailyFocusProject: r.dailyFocusProject || '',
    employmentStatus: r.employmentStatus || 'Active',
    reportsTo: r.reportsTo || 'Rebecca Mary',
    hourlySalary: Number(r.hourlySalary ?? 102),
    lunchBreakStart: r.lunchBreakStart || '13:00',
    lunchBreakEnd: r.lunchBreakEnd || '13:45',
    teaBreakStart: r.teaBreakStart || '17:00',
    teaBreakEnd: r.teaBreakEnd || '17:15',
    autoBreakEnabled: r.autoBreakEnabled === undefined ? true : Boolean(r.autoBreakEnabled),
  }));
}

function getPresenceArray() {
  const users = getEmployeesList();
  const activeRows = db.prepare(`SELECT * FROM active_sessions`).all() as any[];
  const activeMap = new Map<string, any>();
  for (const a of activeRows) activeMap.set(a.username, a);

  const deviceCounts = new Map<string, number>();
  for (const c of wsClients) {
    if (c.username) {
      deviceCounts.set(c.username, (deviceCounts.get(c.username) || 0) + 1);
    }
  }

  return users.map((u) => {
    const act = activeMap.get(u.username);
    const devCount = deviceCounts.get(u.username) || (act ? 1 : 0);
    return {
      username: u.username,
      role: u.role,
      online: devCount > 0 || Boolean(act),
      devices: devCount,
      dailyFocus: u.dailyFocus || '',
      dailyFocusDate: u.dailyFocusDate || '',
      dailyFocusProject: u.dailyFocusProject || '',
      session: act
        ? {
            status: act.status as 'running' | 'on_break',
            project: act.project,
            task: act.task,
            subtask: act.subtask,
            priority: act.priority || 'Medium',
            startTimeMs: Number(act.startTimeMs),
            startDisplay: String(act.startDisplay || ''),
            breakTotalSec: Number(act.breakTotalSec || 0),
            currentBreakStartMs: act.currentBreakStartMs ? Number(act.currentBreakStartMs) : null,
          }
        : null,
    };
  });
}

function broadcastWs(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

function broadcastPresence() {
  broadcastWs({
    type: 'presence:updated',
    presence: getPresenceArray(),
  });
}

function createAndBroadcastNotification(params: {
  type: string;
  actor: string;
  target: string;
  message: string;
  project?: string;
  task?: string;
  subtask?: string;
  extra?: string;
}) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = fmtTimestamp();
  db.prepare(`
    INSERT INTO notifications (id, type, actor, target, message, project, task, subtask, extra, timestamp, dismissed, readByJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]')
  `).run(
    id,
    params.type,
    params.actor,
    params.target,
    params.message,
    params.project || '',
    params.task || '',
    params.subtask || '',
    params.extra || '',
    timestamp
  );

  const notification = {
    id,
    type: params.type,
    actor: params.actor,
    target: params.target,
    message: params.message,
    project: params.project || '',
    task: params.task || '',
    subtask: params.subtask || '',
    extra: params.extra || '',
    timestamp,
    dismissed: false,
    readBy: [] as string[],
  };

  broadcastWs({
    type: 'notification:created',
    notification,
  });

  return notification;
}

function computeUserPerformance(username: string) {
  const rows = db.prepare(`SELECT * FROM sessions WHERE username = ?`).all(username) as any[];
  const daysMap = new Map<string, { workHours: number; breakMinutes: number; onTime: boolean }>();

  let totalWorkHrs = 0;
  let totalBreakMin = 0;

  for (const r of rows) {
    const hrs = Number(r.workHours || 0);
    const brk = Number(r.breakMinutes || 0);
    totalWorkHrs += hrs;
    totalBreakMin += brk;
    const prev = daysMap.get(r.date) || { workHours: 0, breakMinutes: 0, onTime: r.punctuality !== 'Late' };
    prev.workHours += hrs;
    prev.breakMinutes += brk;
    daysMap.set(r.date, prev);
  }

  const totalDays = daysMap.size;
  let onTimeDays = 0;
  let lateDays = 0;
  daysMap.forEach((v) => {
    if (v.onTime) onTimeDays++;
    else lateDays++;
  });

  const punctuality = totalDays > 0 ? Math.round((onTimeDays / totalDays) * 100) : 0;
  const avgWorkHrs = totalDays > 0 ? Math.round((totalWorkHrs / totalDays) * 10) / 10 : 0;
  const rawProd = totalDays > 0 ? Math.min(100, Math.round((avgWorkHrs / STANDARD_WORKDAY_HOURS) * 100)) : 0;

  const qcMarkedRows = db.prepare(`SELECT errorCount FROM qc_logs WHERE employee = ?`).all(username) as { errorCount: number }[];
  const qcErrors = qcMarkedRows.reduce((s, r) => s + Number(r.errorCount || 0), 0);
  const qcDeduction = Math.min(MAX_ERROR_PENALTY, qcErrors * POINTS_PER_ERROR);

  const qcReviewed = (db.prepare(`SELECT COUNT(*) as c FROM qc_logs WHERE reviewer = ?`).get(username) as { c: number }).c;
  const qcPoints = qcReviewed - qcErrors * POINTS_PER_ERROR;

  const productivity = totalDays > 0 ? Math.max(0, rawProd - qcDeduction) : 0;
  const total = totalDays > 0 ? Math.round(punctuality * PUNCTUALITY_WEIGHT + productivity * PRODUCTIVITY_WEIGHT) : 0;

  return {
    punctuality,
    productivity,
    total,
    avgWorkHrs,
    totalWorkHrs: Math.round(totalWorkHrs * 10) / 10,
    totalBreakMin,
    onTimeDays,
    lateDays,
    totalDays,
    qcErrors,
    qcReviewed,
    qcPoints,
  };
}

function getMyQcErrors(username: string) {
  const rows = db.prepare(`SELECT * FROM qc_logs WHERE employee = ? ORDER BY id DESC`).all(username) as any[];
  let totalDeduction = 0;
  const errors = rows.map((r) => {
    const pts = Number(r.errorCount || 0) * POINTS_PER_ERROR;
    totalDeduction += pts;
    return {
      id: r.id,
      timestamp: r.timestamp,
      reviewer: r.reviewer,
      project: r.project,
      discipline: r.discipline,
      workType: r.workType,
      subtask: r.subtask,
      errorCount: r.errorCount,
      pointsDeducted: pts,
      comment: r.comment,
    };
  });
  return {
    errors,
    totalDeduction: Math.min(MAX_ERROR_PENALTY, totalDeduction),
  };
}

// ============================================================================
// START EXPRESS + VITE + WEBSOCKET SERVER
// ============================================================================
async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '25mb' }));

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const client: WsClient = { ws, username: '', role: '' };
    wsClients.add(client);

    ws.send(
      JSON.stringify({
        type: 'presence:updated',
        presence: getPresenceArray(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'auth' || msg.type === 'IDENTIFY') {
          client.username = String(msg.username || msg.userName || '').trim();
          client.role = String(msg.role || '').trim();
          broadcastPresence();
        }
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      wsClients.delete(client);
      broadcastPresence();
    });
  });

  // 1. Employees list & Auth
  app.get('/api/employees', (_req, res) => {
    res.json({ employees: getEmployeesList() });
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const rawName = String(username || '').trim();
    const resolvedName =
      rawName.toLowerCase() === 'rebecca mary' ? 'REBECCA MARY REETHU P' : rawName;
    const row = db
      .prepare(`SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) AND TRIM(password) = TRIM(?)`)
      .get(resolvedName, String(password || '')) as any;
    if (!row) {
      return res.json({
        success: false,
        message: 'Invalid employee name or security PIN. (Demo PIN: 1234)',
      });
    }
    const user = getEmployeesList().find((u) => u.username === row.username) || {
      username: row.username,
      role: row.role,
      empCode: row.empCode || '1031',
      joiningDate: row.joiningDate || '',
      emergencyContact: row.emergencyContact || '',
      address: row.address || '',
      weekOff: row.weekOff || 'Sunday',
      altSatOff: Boolean(row.altSatOff),
      photo: row.photo || '',
      dailyFocus: row.dailyFocus || '',
      dailyFocusDate: row.dailyFocusDate || '',
      dailyFocusProject: row.dailyFocusProject || '',
      employmentStatus: row.employmentStatus || 'Active',
      reportsTo: row.reportsTo || 'Founder',
      hourlySalary: Number(row.hourlySalary ?? 155),
      lunchBreakStart: row.lunchBreakStart || '13:00',
      lunchBreakEnd: row.lunchBreakEnd || '13:45',
      teaBreakStart: row.teaBreakStart || '17:00',
      teaBreakEnd: row.teaBreakEnd || '17:15',
      autoBreakEnabled: row.autoBreakEnabled === undefined ? true : Boolean(row.autoBreakEnabled),
    };
    res.json({ success: true, user });
  });

  // 2. Bootstrap Full Workspace State
  app.get('/api/bootstrap', (req, res) => {
    const rawUser = String(req.query.username || '').trim();
    const username =
      rawUser.toLowerCase() === 'rebecca mary' ? 'REBECCA MARY REETHU P' : rawUser;
    const employees = getEmployeesList();
    const presence = getPresenceArray();

    const activeRow = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    const activeSession = activeRow
      ? {
          username: activeRow.username,
          role: activeRow.role,
          project: activeRow.project,
          task: activeRow.task,
          subtask: activeRow.subtask,
          startStatus: activeRow.startStatus,
          priority: activeRow.priority || 'Medium',
          comment: activeRow.comment || '',
          status: activeRow.status as 'running' | 'on_break',
          startTimeMs: Number(activeRow.startTimeMs),
          startDisplay: activeRow.startDisplay,
          breakTotalSec: Number(activeRow.breakTotalSec || 0),
          currentBreakStartMs: activeRow.currentBreakStartMs ? Number(activeRow.currentBreakStartMs) : null,
        }
      : null;

    const myPerformance = computeUserPerformance(username);
    const leaderboard = employees
      .map((e) => ({
        username: e.username,
        role: e.role,
        ...computeUserPerformance(e.username),
      }))
      .sort((a, b) => b.total - a.total);

    const mySessions = db.prepare(`SELECT * FROM sessions WHERE username = ? ORDER BY id DESC LIMIT 40`).all(username);
    const allSessions = db.prepare(`SELECT * FROM sessions ORDER BY id DESC LIMIT 200`).all();
    const qcRecent = db.prepare(`SELECT * FROM qc_logs ORDER BY id DESC LIMIT 50`).all();
    const myQcErrors = getMyQcErrors(username);

    const rawNotifs = db.prepare(`SELECT * FROM notifications WHERE dismissed = 0 ORDER BY rowid DESC LIMIT 60`).all() as any[];
    const notifications = rawNotifs.map((n) => ({
      id: n.id,
      type: n.type,
      actor: n.actor,
      target: n.target,
      message: n.message,
      project: n.project || '',
      task: n.task || '',
      subtask: n.subtask || '',
      extra: n.extra || '',
      timestamp: n.timestamp,
      dismissed: Boolean(n.dismissed),
      readBy: JSON.parse(n.readByJson || '[]'),
    }));

    const today = fmtDate();
    const startedTodaySet = new Set<string>();
    (db.prepare(`SELECT DISTINCT username FROM sessions WHERE date = ?`).all(today) as any[]).forEach((r) =>
      startedTodaySet.add(r.username)
    );
    (db.prepare(`SELECT DISTINCT username FROM active_sessions`).all() as any[]).forEach((r) =>
      startedTodaySet.add(r.username)
    );
    const notStarted = employees.filter(
      (e) =>
        !['Management', 'Founder', 'HR', 'Manager', 'Main Handover', 'Coordinator'].includes(e.role) &&
        e.employmentStatus === 'Active' &&
        !startedTodaySet.has(e.username)
    );
    const milestones = db.prepare(`SELECT * FROM project_milestones ORDER BY dueDate ASC`).all();
    const jobAssignments = db.prepare(`SELECT * FROM job_assignments ORDER BY rowid DESC`).all();

    res.json({
      employees,
      presence,
      activeSession,
      myPerformance,
      leaderboard,
      mySessions,
      allSessions,
      qcRecent,
      myQcErrors,
      notifications,
      notStarted,
      milestones,
      jobAssignments,
    });
  });

  // 2b. Project Milestones Endpoints
  app.post('/api/milestones/add', (req, res) => {
    const { project, milestoneName, discipline, dueDate, status, progress, lead, deliverable, priority, actor } = req.body;
    const id = `ms_${Date.now()}`;
    db.prepare(`
      INSERT INTO project_milestones (id, project, milestoneName, discipline, dueDate, status, progress, lead, deliverable, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      project,
      milestoneName,
      discipline || 'Mechanical',
      dueDate,
      status || 'In Progress',
      Number(progress ?? 25),
      lead || actor || 'Rebecca Mary',
      deliverable || 'LOD 350 Coordinated Deliverable',
      priority || 'High'
    );

    createAndBroadcastNotification({
      type: 'circular_posted',
      actor: actor || 'Management',
      target: 'ALL',
      message: `scheduled milestone "${milestoneName}" due ${dueDate}`,
      project,
      task: discipline,
      extra: `Lead: ${lead} · Priority: ${priority}`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, id });
  });

  app.post('/api/milestones/update', (req, res) => {
    const { id, progress, status, dueDate, actor } = req.body;
    const row = db.prepare(`SELECT * FROM project_milestones WHERE id = ?`).get(id) as any;
    if (!row) return res.json({ success: false });

    db.prepare(`UPDATE project_milestones SET progress = ?, status = ?, dueDate = ? WHERE id = ?`).run(
      Number(progress ?? row.progress),
      status || row.status,
      dueDate || row.dueDate,
      id
    );

    createAndBroadcastNotification({
      type: 'session_end',
      actor: actor || row.lead,
      target: 'ALL',
      message: `updated milestone "${row.milestoneName}" to ${progress}% (${status})`,
      project: row.project,
      task: row.discipline,
      extra: `Target Due: ${dueDate || row.dueDate}`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/milestones/delete', (req, res) => {
    const { id } = req.body;
    db.prepare(`DELETE FROM project_milestones WHERE id = ?`).run(id);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // Helper: Check if a username or role belongs to HR, Management, or Founder
  const isHrManagementFounderUser = (username?: string, fallbackRole?: string): boolean => {
    let roleToCheck = fallbackRole || '';
    if (username) {
      const u = db.prepare(`SELECT role FROM users WHERE username = ?`).get(username) as { role?: string } | undefined;
      if (u?.role) roleToCheck = u.role;
    }
    const r = String(roleToCheck || '').trim().toLowerCase();
    return ['hr', 'management', 'founder'].includes(r);
  };

  // 3. Synchronized Time Tracker Controls
  app.post('/api/session/start', (req, res) => {
    const { username, role, project, task, subtask, startStatus, priority, comment, customStartTime, customStartTimeMs, customBreakMinutes, startedBy } = req.body;
    const sessionPriority = priority || 'Medium';
    const now = new Date();
    let startTimeMs = now.getTime();
    let startDisplay = now.toTimeString().slice(0, 8);

    const canBackdate = isHrManagementFounderUser(startedBy || username, role);

    if (canBackdate) {
      if (customStartTimeMs && Number(customStartTimeMs) > 0) {
        startTimeMs = Number(customStartTimeMs);
        if (customStartTime && typeof customStartTime === 'string') {
          startDisplay = `${customStartTime.trim().slice(0, 5)}:00`;
        }
      } else if (customStartTime && typeof customStartTime === 'string' && /^\d{2}:\d{2}/.test(customStartTime.trim())) {
        const [hhStr, mmStr] = customStartTime.trim().split(':');
        const hh = Number(hhStr);
        const mm = Number(mmStr);
        if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
          startDisplay = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
          const backdated = new Date(now);
          backdated.setHours(hh, mm, 0, 0);
          if (backdated.getTime() > now.getTime() + 1000 * 60 * 15) {
            backdated.setDate(backdated.getDate() - 1);
          }
          startTimeMs = backdated.getTime();
        }
      }
    }

    const initialBreakSec = canBackdate ? Math.max(0, Math.round(Number(customBreakMinutes || 0) * 60)) : 0;

    // Check if this is the user's first daily session (0 completed sessions logged today)
    const todayStr = fmtDate(now);
    const completedTodayCount = (
      db
        .prepare(`SELECT COUNT(*) as c FROM sessions WHERE username = ? AND date = ?`)
        .get(username, todayStr) as { c: number }
    ).c;
    const isFirstDailySession = completedTodayCount === 0;

    const userRow = db.prepare(`SELECT role FROM users WHERE username = ?`).get(username) as { role?: string } | undefined;
    const resolvedRole = role || userRow?.role || 'Production';

    db.prepare(`
      INSERT OR REPLACE INTO active_sessions (username, role, project, task, subtask, startStatus, priority, comment, status, startTimeMs, startDisplay, breakTotalSec, currentBreakStartMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, ?, NULL)
    `).run(username, resolvedRole, project, task, subtask, startStatus, sessionPriority, comment || '', startTimeMs, startDisplay, initialBreakSec);

    const activeSession = {
      username,
      role: resolvedRole,
      project,
      task,
      subtask,
      startStatus,
      priority: sessionPriority,
      comment: comment || '',
      status: 'running' as const,
      startTimeMs,
      startDisplay,
      breakTotalSec: initialBreakSec,
      currentBreakStartMs: null,
    };

    createAndBroadcastNotification({
      type: 'session_start',
      actor: username,
      target: 'ALL',
      message: canBackdate && customStartTime
        ? `started backdated [${sessionPriority}] timer from ${startDisplay.slice(0, 5)} on ${project} (${task} / ${subtask})`
        : `started [${sessionPriority}] priority timer on ${project} (${task} / ${subtask})`,
      project,
      task,
      subtask,
      extra: `Start: ${startStatus} · Clock: ${startDisplay.slice(0, 5)} · Priority: ${sessionPriority}`,
    });

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession, isFirstDailySession });
  });

  // 3a. Adjust Active Running Timer Start Time / Break Backup (HR, Management & Founder Only)
  app.post('/api/session/adjust-active', (req, res) => {
    const { username, targetUsername, newStartTime, newStartTimeMs, newBreakMinutes, adjustedBy } = req.body;
    const effectiveTarget = String(targetUsername || username || adjustedBy || '').trim();
    if (!isHrManagementFounderUser(adjustedBy || username)) {
      return res.json({
        success: false,
        message: 'Access restricted: Only HR, Management, and Founder can edit or backdate session timings.',
      });
    }
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(effectiveTarget) as any;
    if (!row) {
      return res.json({
        success: false,
        message: `No active session found for ${effectiveTarget || 'the selected employee'}.`,
      });
    }

    const now = new Date();
    let startTimeMs = Number(row.startTimeMs);
    let startDisplay = String(row.startDisplay || '09:00:00');

    if (newStartTimeMs && Number(newStartTimeMs) > 0) {
      startTimeMs = Number(newStartTimeMs);
      if (newStartTime && typeof newStartTime === 'string') {
        startDisplay = `${newStartTime.trim().slice(0, 5)}:00`;
      }
    } else if (newStartTime && typeof newStartTime === 'string' && /^\d{2}:\d{2}/.test(newStartTime.trim())) {
      const [hhStr, mmStr] = newStartTime.trim().split(':');
      const hh = Number(hhStr);
      const mm = Number(mmStr);
      if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
        startDisplay = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
        const backdated = new Date(now);
        backdated.setHours(hh, mm, 0, 0);
        if (backdated.getTime() > now.getTime() + 1000 * 60 * 15) {
          backdated.setDate(backdated.getDate() - 1);
        }
        startTimeMs = backdated.getTime();
      }
    }

    const breakTotalSec =
      newBreakMinutes !== undefined && newBreakMinutes !== null && newBreakMinutes !== ''
        ? Math.max(0, Math.round(Number(newBreakMinutes) * 60))
        : Number(row.breakTotalSec || 0);

    db.prepare(`
      UPDATE active_sessions
      SET startTimeMs = ?, startDisplay = ?, breakTotalSec = ?
      WHERE username = ?
    `).run(startTimeMs, startDisplay, breakTotalSec, effectiveTarget);

    const activeSession = {
      ...row,
      username: effectiveTarget,
      priority: row.priority || 'Medium',
      status: row.status as 'running' | 'on_break',
      startTimeMs,
      startDisplay,
      breakTotalSec,
      currentBreakStartMs: row.currentBreakStartMs ? Number(row.currentBreakStartMs) : null,
    };

    createAndBroadcastNotification({
      type: 'comment_updated',
      actor: adjustedBy || effectiveTarget,
      target: 'MANAGEMENT',
      message: `adjusted live timer start time for ${effectiveTarget} to ${startDisplay.slice(0, 5)} (Break: ${Math.round(breakTotalSec / 60)}m)`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
    });

    broadcastWs({ type: 'session:updated', username: effectiveTarget, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession });
  });

  // 3b. Daily Huddle Primary Focus Endpoint
  app.post('/api/profile/daily-huddle', (req, res) => {
    const { username, dailyFocus, dailyFocusProject } = req.body;
    if (!username) {
      return res.json({ success: false, message: 'Missing username' });
    }
    const todayStr = fmtDate();
    const cleanFocus = String(dailyFocus || '').trim();
    const cleanProject = String(dailyFocusProject || '').trim();

    db.prepare(`
      UPDATE users
      SET dailyFocus = ?, dailyFocusDate = ?, dailyFocusProject = ?
      WHERE username = ?
    `).run(cleanFocus, todayStr, cleanProject, username);

    const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
    const updatedUser = row
      ? {
          username: row.username,
          role: row.role,
          joiningDate: row.joiningDate || '',
          emergencyContact: row.emergencyContact || '',
          address: row.address || '',
          weekOff: row.weekOff || 'Sunday',
          altSatOff: Boolean(row.altSatOff),
          photo: row.photo || '',
          dailyFocus: row.dailyFocus || '',
          dailyFocusDate: row.dailyFocusDate || '',
          dailyFocusProject: row.dailyFocusProject || '',
        }
      : null;

    if (cleanFocus) {
      createAndBroadcastNotification({
        type: 'session_start',
        actor: username,
        target: 'ALL',
        message: `logged Daily Huddle Focus: "${cleanFocus}"`,
        project: cleanProject,
        extra: `Daily Huddle (${todayStr})`,
      });
    }

    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, user: updatedUser });
  });

  app.post('/api/session/priority', (req, res) => {
    const { username, priority } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const nextPriority = priority || 'Medium';
    db.prepare(`UPDATE active_sessions SET priority = ? WHERE username = ?`).run(nextPriority, username);

    const activeSession = {
      ...row,
      priority: nextPriority,
      status: row.status as 'running' | 'on_break',
      startTimeMs: Number(row.startTimeMs),
      breakTotalSec: Number(row.breakTotalSec || 0),
      currentBreakStartMs: row.currentBreakStartMs ? Number(row.currentBreakStartMs) : null,
    };

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession });
  });

  app.post('/api/session/break', (req, res) => {
    const { username } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const nowMs = Date.now();
    db.prepare(`UPDATE active_sessions SET status = 'on_break', currentBreakStartMs = ? WHERE username = ?`).run(nowMs, username);

    const activeSession = {
      ...row,
      priority: row.priority || 'Medium',
      status: 'on_break',
      startTimeMs: Number(row.startTimeMs),
      breakTotalSec: Number(row.breakTotalSec || 0),
      currentBreakStartMs: nowMs,
    };

    createAndBroadcastNotification({
      type: 'break_start',
      actor: username,
      target: 'ALL',
      message: `paused on break (${row.project})`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
    });

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession });
  });

  app.post('/api/session/resume', (req, res) => {
    const { username } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const nowMs = Date.now();
    const addedBreakSec = row.currentBreakStartMs ? Math.max(0, Math.floor((nowMs - Number(row.currentBreakStartMs)) / 1000)) : 0;
    const newBreakTotalSec = Number(row.breakTotalSec || 0) + addedBreakSec;

    db.prepare(`UPDATE active_sessions SET status = 'running', breakTotalSec = ?, currentBreakStartMs = NULL WHERE username = ?`).run(
      newBreakTotalSec,
      username
    );

    const activeSession = {
      ...row,
      priority: row.priority || 'Medium',
      status: 'running',
      startTimeMs: Number(row.startTimeMs),
      breakTotalSec: newBreakTotalSec,
      currentBreakStartMs: null,
    };

    createAndBroadcastNotification({
      type: 'break_end',
      actor: username,
      target: 'ALL',
      message: `resumed production work on ${row.project}`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
    });

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession });
  });

  app.post('/api/session/end', (req, res) => {
    const { username, endStatus, priority, comment } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const now = new Date();
    const nowMs = now.getTime();
    const totalElapsedSec = Math.max(1, Math.floor((nowMs - Number(row.startTimeMs)) / 1000));
    let totalBreakSec = Number(row.breakTotalSec || 0);
    if (row.status === 'on_break' && row.currentBreakStartMs) {
      totalBreakSec += Math.max(0, Math.floor((nowMs - Number(row.currentBreakStartMs)) / 1000));
    }
    const netWorkSec = Math.max(0, totalElapsedSec - totalBreakSec);
    const workHours = Math.max(0.1, Math.round((netWorkSec / 3600) * 100) / 100);
    const breakMinutes = Math.round(totalBreakSec / 60);

    const startClock = String(row.startDisplay).slice(0, 5);
    const endClock = fmtClockShort(now);
    const punctuality = startClock <= SHIFT_START ? 'On Time' : 'Late';
    const finalPriority = priority || row.priority || 'Medium';

    db.prepare(`
      INSERT INTO sessions (date, username, role, project, task, subtask, startTime, endTime, workHours, breakMinutes, startStatus, endStatus, priority, comment, punctuality)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fmtDate(now),
      username,
      row.role,
      row.project,
      row.task,
      row.subtask,
      startClock,
      endClock,
      workHours,
      breakMinutes,
      row.startStatus,
      endStatus,
      finalPriority,
      comment || row.comment || '',
      punctuality
    );

    db.prepare(`DELETE FROM active_sessions WHERE username = ?`).run(username);

    createAndBroadcastNotification({
      type: 'session_end',
      actor: username,
      target: 'ALL',
      message: `completed [${finalPriority}] session on ${row.project} (${row.startStatus} → ${endStatus})`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
      extra: `Net: ${workHours}h · Break: ${breakMinutes}m · Priority: ${finalPriority}`,
    });

    broadcastWs({ type: 'session:updated', username, activeSession: null });
    broadcastPresence();
    res.json({ success: true, workHours, breakMinutes, priority: finalPriority });
  });

  app.post('/api/session/update-comment', (req, res) => {
    const { sessionId, username, newComment } = req.body;
    const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as any;
    if (!row) return res.json({ success: false });
    db.prepare(`UPDATE sessions SET comment = ? WHERE id = ?`).run(String(newComment || ''), sessionId);

    createAndBroadcastNotification({
      type: 'comment_updated',
      actor: username,
      target: 'MANAGEMENT',
      message: `updated session deliverable notes for ${row.project} (${row.date})`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
      extra: String(newComment || ''),
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // Helper to calculate net work hours from HH:MM start, HH:MM end, and breakMinutes
  const calcHoursFromClock = (startHHMM: string, endHHMM: string, breakMins: number, fallbackHours?: number): number => {
    if (fallbackHours !== undefined && fallbackHours !== null && Number(fallbackHours) > 0 && (!startHHMM || !endHHMM)) {
      return Math.round(Number(fallbackHours) * 100) / 100;
    }
    const [sH, sM] = String(startHHMM || '09:00').split(':').map(Number);
    const [eH, eM] = String(endHHMM || '18:00').split(':').map(Number);
    if (Number.isNaN(sH) || Number.isNaN(sM) || Number.isNaN(eH) || Number.isNaN(eM)) {
      return Math.max(0.1, Math.round(Number(fallbackHours || 8) * 100) / 100);
    }
    let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins <= 0) diffMins += 24 * 60; // handle overnight shift if needed
    const netMins = Math.max(6, diffMins - Math.max(0, Number(breakMins || 0)));
    return Math.round((netMins / 60) * 100) / 100;
  };

  // 3c. Manual Timing Backup — Log Missed / Forgotten Start Session (HR, Management & Founder Only)
  app.post('/api/session/manual-add', (req, res) => {
    const {
      username,
      role,
      date,
      project,
      task,
      subtask,
      startTime,
      endTime,
      breakMinutes,
      workHours,
      startStatus,
      endStatus,
      priority,
      comment,
      addedBy,
    } = req.body;

    if (!isHrManagementFounderUser(addedBy)) {
      return res.json({
        success: false,
        message: 'Access restricted: Only HR, Management, and Founder can log manual backup sessions.',
      });
    }

    if (!username || !project || !task || !subtask) {
      return res.json({ success: false, message: 'Employee, Project, Task, and Subtask are required.' });
    }

    const userRow = db.prepare(`SELECT role FROM users WHERE username = ?`).get(username) as { role?: string } | undefined;
    const resolvedRole = role || userRow?.role || 'Production';
    const sessionDate = date || fmtDate();
    const sClock = String(startTime || '09:00').slice(0, 5);
    const eClock = String(endTime || '18:00').slice(0, 5);
    const bMins = Math.max(0, Math.round(Number(breakMinutes || 0)));
    const computedHours =
      workHours !== undefined && workHours !== '' && Number(workHours) > 0
        ? Math.round(Number(workHours) * 100) / 100
        : calcHoursFromClock(sClock, eClock, bMins);
    const sStatus = startStatus || '0%';
    const eStatus = endStatus || '100%';
    const finalPriority = priority || 'Medium';
    const punctuality = sClock <= SHIFT_START ? 'On Time' : 'Late';

    const info = db.prepare(`
      INSERT INTO sessions (date, username, role, project, task, subtask, startTime, endTime, workHours, breakMinutes, startStatus, endStatus, priority, comment, punctuality)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sessionDate,
      username,
      resolvedRole,
      project,
      task,
      subtask,
      sClock,
      eClock,
      computedHours,
      bMins,
      sStatus,
      eStatus,
      finalPriority,
      comment || `Manual timing backup logged by ${addedBy || username}`,
      punctuality
    );

    createAndBroadcastNotification({
      type: 'session_end',
      actor: addedBy || username,
      target: 'ALL',
      message: `logged manual backup session for ${username} on ${project} (${sClock}–${eClock}, ${computedHours}h)`,
      project,
      task,
      subtask,
      extra: `Date: ${sessionDate} · Net: ${computedHours}h · Break: ${bMins}m`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({
      success: true,
      sessionId: info.lastInsertRowid,
      workHours: computedHours,
      breakMinutes: bMins,
      punctuality,
    });
  });

  // 3d. Full Session Timing & Details Edit Endpoint (HR, Management & Founder Only)
  app.post('/api/session/edit', (req, res) => {
    const {
      sessionId,
      date,
      username,
      project,
      task,
      subtask,
      startTime,
      endTime,
      breakMinutes,
      workHours,
      startStatus,
      endStatus,
      priority,
      comment,
      editedBy,
    } = req.body;

    if (!isHrManagementFounderUser(editedBy)) {
      return res.json({
        success: false,
        message: 'Access restricted: Only HR, Management, and Founder can edit session timings.',
      });
    }

    const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as any;
    if (!row) return res.json({ success: false, message: 'Session record not found.' });

    const nextDate = date || row.date;
    const nextUsername = username || row.username;
    const userRow = db.prepare(`SELECT role FROM users WHERE username = ?`).get(nextUsername) as { role?: string } | undefined;
    const nextRole = userRow?.role || row.role || 'Production';
    const nextProject = project || row.project;
    const nextTask = task || row.task;
    const nextSubtask = subtask || row.subtask;
    const nextStart = String(startTime || row.startTime || '09:00').slice(0, 5);
    const nextEnd = String(endTime || row.endTime || '18:00').slice(0, 5);
    const nextBreak =
      breakMinutes !== undefined && breakMinutes !== null && breakMinutes !== ''
        ? Math.max(0, Math.round(Number(breakMinutes)))
        : Number(row.breakMinutes || 0);

    // If startTime, endTime, or breakMinutes changed and workHours wasn't manually overridden to a different custom number, recalculate
    const timesChanged =
      nextStart !== row.startTime ||
      nextEnd !== row.endTime ||
      nextBreak !== Number(row.breakMinutes || 0);

    let nextWorkHours = Number(row.workHours || 0);
    if (workHours !== undefined && workHours !== null && workHours !== '' && !timesChanged) {
      nextWorkHours = Math.max(0.1, Math.round(Number(workHours) * 100) / 100);
    } else if (timesChanged) {
      nextWorkHours =
        workHours !== undefined && workHours !== null && workHours !== '' && Number(workHours) !== Number(row.workHours)
          ? Math.max(0.1, Math.round(Number(workHours) * 100) / 100)
          : calcHoursFromClock(nextStart, nextEnd, nextBreak, row.workHours);
    }

    const nextStartStatus = startStatus || row.startStatus || '0%';
    const nextEndStatus = endStatus || row.endStatus || '100%';
    const nextPriority = priority || row.priority || 'Medium';
    const nextComment = comment !== undefined ? String(comment) : String(row.comment || '');
    const nextPunctuality = nextStart <= SHIFT_START ? 'On Time' : 'Late';

    db.prepare(`
      UPDATE sessions
      SET date = ?, username = ?, role = ?, project = ?, task = ?, subtask = ?,
          startTime = ?, endTime = ?, workHours = ?, breakMinutes = ?,
          startStatus = ?, endStatus = ?, priority = ?, comment = ?, punctuality = ?
      WHERE id = ?
    `).run(
      nextDate,
      nextUsername,
      nextRole,
      nextProject,
      nextTask,
      nextSubtask,
      nextStart,
      nextEnd,
      nextWorkHours,
      nextBreak,
      nextStartStatus,
      nextEndStatus,
      nextPriority,
      nextComment,
      nextPunctuality,
      sessionId
    );

    createAndBroadcastNotification({
      type: 'comment_updated',
      actor: editedBy || nextUsername,
      target: 'MANAGEMENT',
      message: `updated session timing for ${nextUsername} on ${nextProject} (${nextDate}: ${nextStart}–${nextEnd}, ${nextWorkHours}h)`,
      project: nextProject,
      task: nextTask,
      subtask: nextSubtask,
      extra: nextComment || `Timing adjusted to ${nextStart}–${nextEnd} (${nextWorkHours}h)`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({
      success: true,
      workHours: nextWorkHours,
      breakMinutes: nextBreak,
      punctuality: nextPunctuality,
    });
  });

  // 3e. Delete Session Log Endpoint (HR, Management & Founder Only)
  app.post('/api/session/delete', (req, res) => {
    const { sessionId, deletedBy } = req.body;
    if (!isHrManagementFounderUser(deletedBy)) {
      return res.json({
        success: false,
        message: 'Access restricted: Only HR, Management, and Founder can delete session logs.',
      });
    }
    if (!sessionId) return res.json({ success: false, message: 'Missing sessionId' });
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 4. QC Error Submit & Employee Inspection
  app.post('/api/qc/submit', (req, res) => {
    const { reviewer, employee, project, discipline, workType, subtask, errorCount, comment } = req.body;
    const ts = fmtTimestamp();
    const errs = Number(errorCount || 0);

    db.prepare(`
      INSERT INTO qc_logs (timestamp, reviewer, employee, project, discipline, workType, subtask, errorCount, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ts, reviewer, employee, project, discipline, workType, subtask, errs, comment || '');

    createAndBroadcastNotification({
      type: 'qc_error',
      actor: reviewer,
      target: employee,
      message: `logged ${errs} QC error(s) on your ${discipline} deliverable (-${errs * POINTS_PER_ERROR} pts)`,
      project,
      task: workType,
      subtask,
      extra: comment || 'Inspect QC log for details',
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.get('/api/qc/employee-errors', (req, res) => {
    const username = String(req.query.username || '');
    res.json(getMyQcErrors(username));
  });

  app.post('/api/qc/bulk-review', (req, res) => {
    const { ids, actor } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, message: 'No QC logs selected' });
    }
    const reviewerName = String(actor || 'Management');
    const stmt = db.prepare(`UPDATE qc_logs SET status = 'Reviewed', reviewedBy = ? WHERE id = ?`);
    let updatedCount = 0;
    for (const id of ids) {
      const info = stmt.run(reviewerName, Number(id));
      updatedCount += info.changes;
    }

    createAndBroadcastNotification({
      type: 'session_end',
      actor: reviewerName,
      target: 'ALL',
      message: `marked ${ids.length} QC inspection log(s) as Reviewed`,
      extra: `Bulk QC Verification · ${updatedCount} record(s) updated`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, updatedCount });
  });

  // 5. Notifications Actions
  app.post('/api/notifications/read-all', (req, res) => {
    const { username } = req.body;
    const rows = db.prepare(`SELECT id, readByJson FROM notifications WHERE dismissed = 0`).all() as any[];
    const upd = db.prepare(`UPDATE notifications SET readByJson = ? WHERE id = ?`);
    for (const r of rows) {
      const arr: string[] = JSON.parse(r.readByJson || '[]');
      if (!arr.includes(username)) {
        arr.push(username);
        upd.run(JSON.stringify(arr), r.id);
      }
    }
    res.json({ success: true });
  });

  app.post('/api/notifications/dismiss', (req, res) => {
    const { id } = req.body;
    db.prepare(`UPDATE notifications SET dismissed = 1 WHERE id = ?`).run(id);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/notifications/test', (req, res) => {
    const { username, project } = req.body;
    const notif = createAndBroadcastNotification({
      type: 'qc_error',
      actor: username || 'System',
      target: 'ALL',
      message: `broadcasted a live multi-device notification check across all open sessions!`,
      project: project || 'MBS-IR2',
      task: 'Coordination',
      subtask: 'HVAC',
      extra: 'Real-Time WebSocket + Sound Chime Active',
    });
    res.json({ success: true, notification: notif });
  });

  // 6. Circulars & Posters
  app.get('/api/circulars', (_req, res) => {
    const rows = db.prepare(`SELECT * FROM circulars ORDER BY rowid DESC`).all() as any[];
    const circulars = rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      postedBy: r.postedBy,
      timestamp: r.timestamp,
      imageUrl: r.imageUrl || '',
      posterUrl: r.posterUrl || '',
      likes: JSON.parse(r.likesJson || '[]'),
      reactions: JSON.parse(r.reactionsJson || '{}'),
      comments: JSON.parse(r.commentsJson || '[]'),
    }));
    res.json({ circulars });
  });

  app.post('/api/circulars', (req, res) => {
    const { username, title, message, imageUrl, posterUrl } = req.body;
    const id = `circ_${Date.now()}`;
    const timestamp = fmtTimestamp();
    db.prepare(`
      INSERT INTO circulars (id, title, message, postedBy, timestamp, imageUrl, posterUrl, likesJson, reactionsJson, commentsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '{}', '[]')
    `).run(id, title, message, username, timestamp, imageUrl || '', posterUrl || '');

    createAndBroadcastNotification({
      type: 'circular_posted',
      actor: username,
      target: 'ALL',
      message: `published a new company circular: "${title}"`,
      extra: message.slice(0, 80),
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/circulars/edit', (req, res) => {
    const { id, title, message, imageUrl, posterUrl } = req.body;
    db.prepare(`UPDATE circulars SET title = ?, message = ?, imageUrl = ?, posterUrl = ? WHERE id = ?`).run(
      title,
      message,
      imageUrl || '',
      posterUrl || '',
      id
    );
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/circulars/delete', (req, res) => {
    const { id } = req.body;
    db.prepare(`DELETE FROM circulars WHERE id = ?`).run(id);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/circulars/react', (req, res) => {
    const { id, username, emoji } = req.body;
    const row = db.prepare(`SELECT reactionsJson FROM circulars WHERE id = ?`).get(id) as any;
    if (row) {
      const reactions = JSON.parse(row.reactionsJson || '{}');
      const list: string[] = reactions[emoji] || [];
      if (list.includes(username)) {
        reactions[emoji] = list.filter((u) => u !== username);
      } else {
        reactions[emoji] = [...list, username];
      }
      db.prepare(`UPDATE circulars SET reactionsJson = ? WHERE id = ?`).run(JSON.stringify(reactions), id);
      broadcastWs({ type: 'state:updated' });
    }
    res.json({ success: true });
  });

  app.post('/api/circulars/comment', (req, res) => {
    const { id, username, comment } = req.body;
    const row = db.prepare(`SELECT commentsJson FROM circulars WHERE id = ?`).get(id) as any;
    if (row) {
      const comments = JSON.parse(row.commentsJson || '[]');
      comments.push({
        id: `cm_${Date.now()}`,
        username,
        comment,
        timestamp: fmtClockShort(),
      });
      db.prepare(`UPDATE circulars SET commentsJson = ? WHERE id = ?`).run(JSON.stringify(comments), id);
      broadcastWs({ type: 'state:updated' });
    }
    res.json({ success: true });
  });

  // 7. Calendar, Holidays, Leave & Permission
  app.get('/api/calendar', (req, res) => {
    const username = String(req.query.username || '');
    const holidays = db.prepare(`SELECT * FROM holidays ORDER BY date ASC`).all();
    const leaves = db.prepare(`SELECT * FROM leaves WHERE username = ? ORDER BY date DESC`).all(username);
    const permissions = db.prepare(`SELECT * FROM permissions WHERE username = ? ORDER BY date DESC`).all(username);

    const sessionRows = db.prepare(`SELECT date, workHours FROM sessions WHERE username = ?`).all(username) as any[];
    const workDays: Record<string, number> = {};
    for (const s of sessionRows) {
      workDays[s.date] = (workDays[s.date] || 0) + Number(s.workHours || 0);
    }

    const userRow = db.prepare(`SELECT weekOff, altSatOff FROM users WHERE username = ?`).get(username) as any;
    res.json({
      holidays,
      leaves,
      permissions,
      workDays,
      weekOff: userRow?.weekOff || 'Sunday',
      altSatOff: Boolean(userRow?.altSatOff),
    });
  });

  app.post('/api/holidays/add', (req, res) => {
    const { date, name, addedBy } = req.body;
    db.prepare(`INSERT INTO holidays (id, date, name, addedBy) VALUES (?, ?, ?, ?)`).run(
      `hol_${Date.now()}`,
      date,
      name,
      addedBy
    );
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/leaves/apply', (req, res) => {
    const { username, date, leaveType, reason } = req.body;
    db.prepare(`
      INSERT INTO leaves (id, username, date, leaveType, reason, status, appliedAt)
      VALUES (?, ?, ?, ?, ?, 'Pending', ?)
    `).run(`lv_${Date.now()}`, username, date, leaveType, reason, fmtTimestamp());

    createAndBroadcastNotification({
      type: 'leave_request',
      actor: username,
      target: 'MANAGEMENT',
      message: `applied for ${leaveType} on ${date}`,
      extra: reason,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/permissions/apply', (req, res) => {
    const { username, date, fromTime, toTime, reason } = req.body;
    db.prepare(`
      INSERT INTO permissions (id, username, date, fromTime, toTime, reason, status, appliedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
    `).run(`pm_${Date.now()}`, username, date, fromTime, toTime, reason, fmtTimestamp());

    createAndBroadcastNotification({
      type: 'permission_request',
      actor: username,
      target: 'MANAGEMENT',
      message: `requested permission (${fromTime}–${toTime}) on ${date}`,
      extra: reason,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 8. Project Dashboard & Drilldown
  app.get('/api/dashboard', (req, res) => {
    const fromDate = String(req.query.fromDate || '');
    const toDate = String(req.query.toDate || '');
    let rows = db.prepare(`SELECT * FROM sessions ORDER BY id DESC`).all() as any[];

    if (fromDate) rows = rows.filter((r) => r.date >= fromDate);
    if (toDate) rows = rows.filter((r) => r.date <= toDate);

    let totalWorkHours = 0;
    let totalBreakMinutes = 0;
    const empSet = new Set<string>();
    const projMap = new Map<string, { workHours: number; breakMinutes: number; sessions: number; employees: Set<string> }>();
    const employeesByProject: Record<string, Record<string, { username: string; role: string; workHours: number; breakMinutes: number; sessions: number }>> = {};
    const sessionsByProjectEmployee: Record<string, any[]> = {};

    for (const r of rows) {
      const wh = Number(r.workHours || 0);
      const bm = Number(r.breakMinutes || 0);
      totalWorkHours += wh;
      totalBreakMinutes += bm;
      empSet.add(r.username);

      const p = projMap.get(r.project) || { workHours: 0, breakMinutes: 0, sessions: 0, employees: new Set<string>() };
      p.workHours += wh;
      p.breakMinutes += bm;
      p.sessions += 1;
      p.employees.add(r.username);
      projMap.set(r.project, p);

      if (!employeesByProject[r.project]) employeesByProject[r.project] = {};
      if (!employeesByProject[r.project][r.username]) {
        employeesByProject[r.project][r.username] = {
          username: r.username,
          role: r.role,
          workHours: 0,
          breakMinutes: 0,
          sessions: 0,
        };
      }
      employeesByProject[r.project][r.username].workHours =
        Math.round((employeesByProject[r.project][r.username].workHours + wh) * 10) / 10;
      employeesByProject[r.project][r.username].breakMinutes += bm;
      employeesByProject[r.project][r.username].sessions += 1;

      const key = `${r.project}||${r.username}`;
      if (!sessionsByProjectEmployee[key]) sessionsByProjectEmployee[key] = [];
      sessionsByProjectEmployee[key].push(r);
    }

    const projects = Array.from(projMap.entries()).map(([project, d]) => ({
      project,
      workHours: Math.round(d.workHours * 10) / 10,
      breakMinutes: d.breakMinutes,
      sessions: d.sessions,
      employeeCount: d.employees.size,
    }));

    const formattedEmployeesByProject: Record<string, any[]> = {};
    for (const [proj, mapObj] of Object.entries(employeesByProject)) {
      formattedEmployeesByProject[proj] = Object.values(mapObj);
    }

    const rateRows = db.prepare(`SELECT role, hourlyRate, currency FROM role_rates`).all() as any[];
    const roleRates: Record<string, number> = { Management: 85, QC: 60, Production: 42 };
    let currency = 'USD';
    for (const r of rateRows) {
      roleRates[r.role] = Number(r.hourlyRate);
      if (r.currency) currency = r.currency;
    }

    const budgetRows = db.prepare(`SELECT project, allocatedBudget FROM project_budgets`).all() as any[];
    const projectBudgets: Record<string, number> = {};
    for (const b of budgetRows) {
      projectBudgets[b.project] = Number(b.allocatedBudget);
    }

    res.json({
      summary: {
        totalWorkHours: Math.round(totalWorkHours * 10) / 10,
        totalBreakMinutes,
        totalSessions: rows.length,
        totalEmployees: empSet.size,
        totalProjects: projects.length,
      },
      projects,
      employeesByProject: formattedEmployeesByProject,
      sessionsByProjectEmployee,
      roleRates,
      projectBudgets,
      currency,
    });
  });

  app.post('/api/financials/rates', (req, res) => {
    const { roleRates, currency, projectBudgets, actor } = req.body;
    if (roleRates && typeof roleRates === 'object') {
      const updRate = db.prepare(`INSERT OR REPLACE INTO role_rates (role, hourlyRate, currency) VALUES (?, ?, ?)`);
      for (const [role, rate] of Object.entries(roleRates)) {
        updRate.run(role, Number(rate), currency || 'USD');
      }
    }
    if (projectBudgets && typeof projectBudgets === 'object') {
      const updBudget = db.prepare(`INSERT OR REPLACE INTO project_budgets (project, allocatedBudget) VALUES (?, ?)`);
      for (const [proj, amt] of Object.entries(projectBudgets)) {
        updBudget.run(proj, Number(amt));
      }
    }

    createAndBroadcastNotification({
      type: 'circular_posted',
      actor: actor || 'Management',
      target: 'ALL',
      message: `updated Project Financial hourly role rates (${currency || 'USD'})`,
      extra: `Mgmt: ${roleRates?.Management ?? 85} · QC: ${roleRates?.QC ?? 60} · Prod: ${roleRates?.Production ?? 42}`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 9. Chat & Group Messages
  app.get('/api/chat/users', (req, res) => {
    const username = String(req.query.username || '');
    const allUsers = getEmployeesList().filter((u) => u.username !== username);
    const allMsgs = db.prepare(`SELECT * FROM chat_messages ORDER BY rowid ASC`).all() as any[];

    const users = allUsers.map((u) => {
      const thread = allMsgs.filter(
        (m) =>
          !m.isGroup &&
          ((m.sender === username && m.receiver === u.username) ||
            (m.sender === u.username && m.receiver === username))
      );
      const last = thread[thread.length - 1];
      const unread = thread.filter(
        (m) => m.sender === u.username && !JSON.parse(m.readByJson || '[]').includes(username)
      ).length;
      return {
        ...u,
        lastMessage: last ? last.message || (last.photoUrl ? '📷 Photo / Sticker' : '') : '',
        unread,
      };
    });

    const rawGroups = db.prepare(`SELECT * FROM chat_groups`).all() as any[];
    const groups = rawGroups
      .map((g) => {
        const members: string[] = JSON.parse(g.membersJson || '[]');
        const thread = allMsgs.filter((m) => m.isGroup && m.receiver === g.groupId);
        const last = thread[thread.length - 1];
        const unread = thread.filter(
          (m) => m.sender !== username && !JSON.parse(m.readByJson || '[]').includes(username)
        ).length;
        return {
          groupId: g.groupId,
          groupName: g.groupName,
          members,
          lastMessage: last ? `${last.sender}: ${last.message || '📷 Media'}` : '',
          unread,
        };
      })
      .filter((g) => g.members.includes(username));

    res.json({ users, groups });
  });

  app.get('/api/chat/messages', (req, res) => {
    const username = String(req.query.username || '');
    const partner = String(req.query.partner || '');
    const isGroup = req.query.isGroup === 'true';

    let rows: any[] = [];
    if (isGroup) {
      rows = db.prepare(`SELECT * FROM chat_messages WHERE isGroup = 1 AND receiver = ? ORDER BY rowid ASC`).all(partner) as any[];
    } else {
      rows = db
        .prepare(
          `SELECT * FROM chat_messages WHERE isGroup = 0 AND ((sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)) ORDER BY rowid ASC`
        )
        .all(username, partner, partner, username) as any[];
    }

    const upd = db.prepare(`UPDATE chat_messages SET readByJson = ? WHERE id = ?`);
    for (const r of rows) {
      const readBy: string[] = JSON.parse(r.readByJson || '[]');
      if (!readBy.includes(username)) {
        readBy.push(username);
        upd.run(JSON.stringify(readBy), r.id);
      }
    }

    res.json({ messages: rows });
  });

  app.post('/api/chat/send', (req, res) => {
    const { sender, receiver, message, photoUrl, isGroup } = req.body;
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = fmtClockShort();
    db.prepare(`
      INSERT INTO chat_messages (id, sender, receiver, message, photoUrl, isGroup, timestamp, readByJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sender, receiver, message || '', photoUrl || '', isGroup ? 1 : 0, timestamp, JSON.stringify([sender]));

    const msgObj = {
      id,
      sender,
      receiver,
      message: message || '',
      photoUrl: photoUrl || '',
      isGroup: Boolean(isGroup),
      timestamp,
    };

    createAndBroadcastNotification({
      type: 'chat_message',
      actor: sender,
      target: isGroup ? 'ALL' : receiver,
      message: `sent ${isGroup ? 'a group message' : 'you a message'}: "${(message || '📷 Media').slice(0, 50)}"`,
    });

    broadcastWs({ type: 'chat:message', message: msgObj });
    res.json({ success: true, message: msgObj });
  });

  app.post('/api/chat/groups/create', (req, res) => {
    const { groupName, creator, members } = req.body;
    const allMembers = Array.from(new Set([creator, ...(members || [])]));
    db.prepare(`INSERT INTO chat_groups (groupId, groupName, creator, membersJson, createdAt) VALUES (?, ?, ?, ?, ?)`).run(
      `grp_${Date.now()}`,
      groupName,
      creator,
      JSON.stringify(allMembers),
      fmtDate()
    );
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 10. Memos & Warnings
  app.get('/api/memos', (req, res) => {
    const username = String(req.query.username || '');
    const myMemos = db.prepare(`SELECT * FROM memos WHERE employee = ? ORDER BY rowid DESC`).all(username);
    const allMemos = db.prepare(`SELECT * FROM memos ORDER BY rowid DESC`).all();
    res.json({ myMemos, allMemos });
  });

  app.post('/api/memos/send', (req, res) => {
    const { employee, type, subject, message, sentBy } = req.body;
    db.prepare(`
      INSERT INTO memos (id, employee, type, subject, message, sentBy, timestamp, reply, replyTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, '', '')
    `).run(`memo_${Date.now()}`, employee, type, subject, message, sentBy, fmtTimestamp());

    createAndBroadcastNotification({
      type: 'memo_issued',
      actor: sentBy,
      target: employee,
      message: `issued an official ${type}: "${subject}"`,
      extra: message.slice(0, 80),
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/memos/reply', (req, res) => {
    const { id, username, reply } = req.body;
    db.prepare(`UPDATE memos SET reply = ?, replyTime = ? WHERE id = ?`).run(reply, fmtTimestamp(), id);

    createAndBroadcastNotification({
      type: 'memo_reply',
      actor: username,
      target: 'MANAGEMENT',
      message: `replied to memo: "${reply.slice(0, 60)}"`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 11. Profile & Management Settings
  app.post('/api/profile/photo', (req, res) => {
    const { username, photoDataUrl } = req.body;
    db.prepare(`UPDATE users SET photo = ? WHERE username = ?`).run(photoDataUrl, username);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/profile/address', (req, res) => {
    const { username, address } = req.body;
    db.prepare(`UPDATE users SET address = ? WHERE username = ?`).run(address, username);
    res.json({ success: true });
  });

  app.post('/api/profile/password', (req, res) => {
    const { username, oldPass, newPass } = req.body;
    const row = db.prepare(`SELECT password FROM users WHERE username = ?`).get(username) as any;
    if (!row || row.password !== oldPass) {
      return res.json({ success: false, message: 'Incorrect current password.' });
    }
    db.prepare(`UPDATE users SET password = ? WHERE username = ?`).run(newPass, username);
    res.json({ success: true });
  });

  app.post('/api/profile/auto-break', (req, res) => {
    const {
      username,
      lunchBreakStart,
      lunchBreakEnd,
      teaBreakStart,
      teaBreakEnd,
      autoBreakEnabled,
    } = req.body;
    if (!username) return res.json({ success: false, message: 'Missing username' });

    const enabledInt =
      autoBreakEnabled === false || autoBreakEnabled === 0 || autoBreakEnabled === 'false' ? 0 : 1;

    db.prepare(`
      UPDATE users
      SET lunchBreakStart = ?,
          lunchBreakEnd = ?,
          teaBreakStart = ?,
          teaBreakEnd = ?,
          autoBreakEnabled = ?
      WHERE username = ?
    `).run(
      lunchBreakStart || '13:00',
      lunchBreakEnd || '13:45',
      teaBreakStart || '17:00',
      teaBreakEnd || '17:15',
      enabledInt,
      username
    );

    const updatedUser = getEmployeesList().find((u) => u.username === username) || null;
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, user: updatedUser });
  });

  // Job Assignments Endpoints (Per-Day Fixed Session Parameters & Main Handover Time Splitting)
  app.post('/api/assignments/assign', (req, res) => {
    const {
      id,
      employee,
      project,
      task,
      subtask,
      priority,
      assignedBy,
      assignedByRole,
      allocatedHours,
      assignDate,
      parentJobId,
      mainHandover,
      assignmentStage,
      notes,
      status,
    } = req.body;
    if (!employee || !project || !task || !subtask) {
      return res.json({
        success: false,
        message: 'Employee, Project Name, Task Type, and Subtask are required.',
      });
    }

    const jobId = id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const updatedAt = fmtTimestamp();
    const hoursNum = Number(allocatedHours ?? 8);
    const dayStr = assignDate || fmtDate();
    const stageStr = assignmentStage || 'direct';
    const handoverStr = mainHandover || (stageStr === 'handover_pool' ? employee : '');

    db.prepare(`
      INSERT OR REPLACE INTO job_assignments (
        id, employee, project, task, subtask, priority, assignedBy, assignedByRole,
        allocatedHours, assignDate, parentJobId, mainHandover, assignmentStage, notes, status, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      jobId,
      employee,
      project,
      task,
      subtask,
      priority || 'Medium',
      assignedBy || 'Management',
      assignedByRole || 'Manager',
      hoursNum,
      dayStr,
      parentJobId || '',
      handoverStr,
      stageStr,
      notes || '',
      status || 'Assigned',
      updatedAt
    );

    createAndBroadcastNotification({
      type: 'session_start',
      actor: `${assignedBy} (${assignedByRole || 'Manager'})`,
      target: employee,
      message:
        stageStr === 'handover_pool'
          ? `assigned Main Handover Time Pool (${hoursNum}h/day) for ${project} → ${task} / ${subtask}`
          : `assigned ${hoursNum}h/day fixed job: ${project} → ${task} / ${subtask}`,
      project,
      task,
      subtask,
      extra: notes ? `Note: ${notes}` : `Allocated: ${hoursNum} hrs/day · Date: ${dayStr}`,
    });

    broadcastWs({ type: 'state:updated' });
    const assignments = db.prepare(`SELECT * FROM job_assignments ORDER BY rowid DESC`).all();
    res.json({ success: true, id: jobId, assignments });
  });

  // Main Handover Splits Per-Day Time Pool to Multiple Employees
  app.post('/api/assignments/split', (req, res) => {
    const {
      parentJobId,
      mainHandover,
      mainHandoverRole,
      project,
      task,
      subtask,
      priority,
      assignDate,
      splits,
    } = req.body;

    if (!project || !task || !subtask || !Array.isArray(splits) || splits.length === 0) {
      return res.json({
        success: false,
        message: 'Provide project, task, subtask, and at least one employee time split.',
      });
    }

    const updatedAt = fmtTimestamp();
    const dayStr = assignDate || fmtDate();
    const handoverName = mainHandover || 'Main Handover';
    const handoverRole = mainHandoverRole || 'Main Handover';

    const insSplit = db.prepare(`
      INSERT OR REPLACE INTO job_assignments (
        id, employee, project, task, subtask, priority, assignedBy, assignedByRole,
        allocatedHours, assignDate, parentJobId, mainHandover, assignmentStage, notes, status, updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'split_member', ?, 'Assigned', ?)
    `);

    const tx = db.transaction((rows: any[]) => {
      for (const sp of rows) {
        if (!sp.employee || Number(sp.allocatedHours) <= 0) continue;
        const splitId =
          sp.id ||
          `split_${parentJobId || 'pool'}_${sp.employee.replace(/\s+/g, '_')}_${dayStr}`;
        insSplit.run(
          splitId,
          sp.employee,
          project,
          task,
          subtask,
          sp.priority || priority || 'High',
          handoverName,
          handoverRole,
          Number(sp.allocatedHours),
          dayStr,
          parentJobId || '',
          handoverName,
          sp.notes ||
            `Split (${sp.allocatedHours}h/day) by Main Handover ${handoverName} for ${dayStr}`,
          updatedAt
        );
      }
    });

    tx(splits);

    createAndBroadcastNotification({
      type: 'session_start',
      actor: `${handoverName} (${handoverRole})`,
      target: 'ALL',
      message: `split per-day work time across ${splits.length} team member(s) for ${project} → ${task} / ${subtask}`,
      project,
      task,
      subtask,
      extra: splits.map((s: any) => `${s.employee}: ${s.allocatedHours}h`).join(' · '),
    });

    broadcastWs({ type: 'state:updated' });
    const assignments = db.prepare(`SELECT * FROM job_assignments ORDER BY rowid DESC`).all();
    res.json({ success: true, assignments });
  });

  // Update Allocated Hours / Date / Notes on an Existing Job Assignment
  app.post('/api/assignments/update', (req, res) => {
    const { id, allocatedHours, assignDate, priority, notes, status } = req.body;
    const row = db.prepare(`SELECT * FROM job_assignments WHERE id = ?`).get(id) as any;
    if (!row) return res.json({ success: false, message: 'Assignment not found.' });

    const updatedAt = fmtTimestamp();
    db.prepare(`
      UPDATE job_assignments
      SET allocatedHours = ?,
          assignDate = ?,
          priority = ?,
          notes = ?,
          status = ?,
          updatedAt = ?
      WHERE id = ?
    `).run(
      allocatedHours !== undefined ? Number(allocatedHours) : Number(row.allocatedHours ?? 8),
      assignDate !== undefined ? assignDate : row.assignDate || fmtDate(),
      priority || row.priority,
      notes !== undefined ? notes : row.notes,
      status || row.status,
      updatedAt,
      id
    );

    broadcastWs({ type: 'state:updated' });
    const assignments = db.prepare(`SELECT * FROM job_assignments ORDER BY rowid DESC`).all();
    res.json({ success: true, assignments });
  });

  app.post('/api/assignments/delete', (req, res) => {
    const { id } = req.body;
    db.prepare(`DELETE FROM job_assignments WHERE id = ? OR parentJobId = ?`).run(id, id);
    broadcastWs({ type: 'state:updated' });
    const assignments = db.prepare(`SELECT * FROM job_assignments ORDER BY rowid DESC`).all();
    res.json({ success: true, assignments });
  });

  app.post('/api/employees/add', (req, res) => {
    const {
      username,
      password,
      role,
      empCode,
      department,
      designation,
      shiftIn,
      workingHours,
      shiftOut,
      allSaturdaysOff,
      monthlySalary,
      uanNumber,
      workLocation,
      bankName,
      bankAccountNo,
      ifscCode,
      branchName,
      pfNumber,
      esicNumber,
      screenTimeHours,
      employmentStatus,
      reportsTo,
      hourlySalary,
      joiningDate,
    } = req.body;
    if (!username || !password) {
      return res.json({ success: false, message: 'Username and password are required.' });
    }
    const autoCode = empCode || String(1000 + Math.floor(Math.random() * 900));
    db.prepare(`
      INSERT OR REPLACE INTO users (
        username, password, role, empCode, department, designation,
        shiftIn, workingHours, shiftOut, allSaturdaysOff,
        monthlySalary, uanNumber, workLocation, bankName, bankAccountNo, ifscCode, branchName, pfNumber, esicNumber, screenTimeHours,
        joiningDate, weekOff, altSatOff, employmentStatus, reportsTo, hourlySalary,
        lunchBreakStart, lunchBreakEnd, teaBreakStart, teaBreakEnd, autoBreakEnabled
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Sunday', 1, ?, ?, ?, '13:00', '13:45', '17:00', '17:15', 1)
    `).run(
      username.trim(),
      password.trim(),
      role || 'Production',
      String(autoCode).trim(),
      department || 'MEP-BIM',
      designation || 'BIM MODELER-MECHANICAL',
      shiftIn || '9:00 AM',
      Number(workingHours ?? 9),
      shiftOut || '6:00 PM',
      allSaturdaysOff ? 1 : 0,
      Number(monthlySalary ?? 23500),
      uanNumber || '-',
      workLocation || 'BIM BYTES SOLUTIONS',
      bankName || '-',
      bankAccountNo || '-',
      ifscCode || '-',
      branchName || '-',
      pfNumber || '-',
      esicNumber || '-',
      Number(screenTimeHours ?? 160),
      joiningDate || fmtDate(),
      employmentStatus || 'Active',
      reportsTo || 'Rebecca Mary',
      Number(hourlySalary ?? 102)
    );
    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/employees/update-details', (req, res) => {
    const {
      username,
      role,
      empCode,
      department,
      designation,
      shiftIn,
      workingHours,
      shiftOut,
      allSaturdaysOff,
      monthlySalary,
      uanNumber,
      workLocation,
      bankName,
      bankAccountNo,
      ifscCode,
      branchName,
      pfNumber,
      esicNumber,
      screenTimeHours,
      employmentStatus,
      reportsTo,
      hourlySalary,
      joiningDate,
      emergencyContact,
      weekOff,
      altSatOff,
    } = req.body;
    const existing = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
    if (!existing) {
      return res.json({ success: false, message: 'Employee not found.' });
    }

    db.prepare(`
      UPDATE users
      SET role = ?,
          empCode = ?,
          department = ?,
          designation = ?,
          shiftIn = ?,
          workingHours = ?,
          shiftOut = ?,
          allSaturdaysOff = ?,
          monthlySalary = ?,
          uanNumber = ?,
          workLocation = ?,
          bankName = ?,
          bankAccountNo = ?,
          ifscCode = ?,
          branchName = ?,
          pfNumber = ?,
          esicNumber = ?,
          screenTimeHours = ?,
          employmentStatus = ?,
          reportsTo = ?,
          hourlySalary = ?,
          joiningDate = ?,
          emergencyContact = ?,
          weekOff = ?,
          altSatOff = ?
      WHERE username = ?
    `).run(
      role !== undefined ? role : existing.role || 'Production',
      empCode !== undefined ? String(empCode) : existing.empCode || '',
      department !== undefined ? department : existing.department || 'MEP-BIM',
      designation !== undefined ? designation : existing.designation || 'BIM MODELER-MECHANICAL',
      shiftIn !== undefined ? shiftIn : existing.shiftIn || '9:00 AM',
      workingHours !== undefined ? Number(workingHours) : Number(existing.workingHours ?? 9),
      shiftOut !== undefined ? shiftOut : existing.shiftOut || '6:00 PM',
      allSaturdaysOff !== undefined ? (allSaturdaysOff ? 1 : 0) : Number(existing.allSaturdaysOff ?? 0),
      monthlySalary !== undefined ? Number(monthlySalary) : Number(existing.monthlySalary ?? 23500),
      uanNumber !== undefined ? uanNumber : existing.uanNumber || '-',
      workLocation !== undefined ? workLocation : existing.workLocation || 'BIM BYTES SOLUTIONS',
      bankName !== undefined ? bankName : existing.bankName || '-',
      bankAccountNo !== undefined ? bankAccountNo : existing.bankAccountNo || '-',
      ifscCode !== undefined ? ifscCode : existing.ifscCode || '-',
      branchName !== undefined ? branchName : existing.branchName || '-',
      pfNumber !== undefined ? pfNumber : existing.pfNumber || '-',
      esicNumber !== undefined ? esicNumber : existing.esicNumber || '-',
      screenTimeHours !== undefined ? Number(screenTimeHours) : Number(existing.screenTimeHours ?? 156),
      employmentStatus || existing.employmentStatus || 'Active',
      reportsTo !== undefined ? reportsTo : existing.reportsTo || 'Rebecca Mary',
      hourlySalary !== undefined ? Number(hourlySalary) : Number(existing.hourlySalary ?? 102),
      joiningDate !== undefined ? joiningDate : existing.joiningDate || '',
      emergencyContact !== undefined ? emergencyContact : existing.emergencyContact || '',
      weekOff || existing.weekOff || 'Sunday',
      altSatOff !== undefined ? (altSatOff ? 1 : 0) : existing.altSatOff,
      username
    );

    if (employmentStatus && employmentStatus !== 'Active') {
      db.prepare(`DELETE FROM active_sessions WHERE username = ?`).run(username);
    }

    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/employees/delete', (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: 'Missing username' });
    db.prepare(`DELETE FROM users WHERE username = ?`).run(username);
    db.prepare(`DELETE FROM active_sessions WHERE username = ?`).run(username);
    db.prepare(`DELETE FROM job_assignments WHERE employee = ?`).run(username);
    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/employees/remove-examples', (req, res) => {
    const { keepUsername } = req.body;
    const removedCount = purgeAllExampleData(keepUsername);

    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, removedCount });
  });

  app.post('/api/management/direct-leave-perm', (req, res) => {
    const { employee, actionType, date, leaveType, fromTime, toTime, reason, markedBy } = req.body;
    if (actionType === 'Leave') {
      db.prepare(`
        INSERT INTO leaves (id, username, date, leaveType, reason, status, appliedAt)
        VALUES (?, ?, ?, ?, ?, 'Approved', ?)
      `).run(`lv_${Date.now()}`, employee, date, leaveType || 'Casual Leave', reason || 'Marked by Management', fmtTimestamp());
      createAndBroadcastNotification({
        type: 'leave_status',
        actor: markedBy,
        target: employee,
        message: `marked Approved ${leaveType || 'Leave'} for ${date}`,
        extra: reason,
      });
    } else {
      db.prepare(`
        INSERT INTO permissions (id, username, date, fromTime, toTime, reason, status, appliedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'Approved', ?)
      `).run(`pm_${Date.now()}`, employee, date, fromTime || '10:00', toTime || '12:00', reason || 'Marked by Management', fmtTimestamp());
      createAndBroadcastNotification({
        type: 'permission_status',
        actor: markedBy,
        target: employee,
        message: `marked Approved Permission (${fromTime}–${toTime}) for ${date}`,
        extra: reason,
      });
    }
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // Vite Dev Middleware or Static Production Build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BIM Bytes Enterprise Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
