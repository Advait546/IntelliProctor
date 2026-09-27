import { supabase } from '../config/supabaseClient.js';
import { ApiError } from '../middleware/errorHandler.js';

function toApiQuestion(row) {
  const options = Array.isArray(row.options) ? row.options : [];
  return {
    id: row.id,
    type: row.type,
    text: row.text,
    optionA: options[0] ?? '',
    optionB: options[1] ?? '',
    optionC: options[2] ?? '',
    optionD: options[3] ?? '',
    correctAnswer: row.correct_answer,
    marks: row.marks,
    difficulty: row.difficulty,
    subject: row.subject,
    topic: row.topic,
    explanation: row.explanation,
  };
}

// GET /api/v1/question-bank  (admin)
export async function getQuestionBank(req, res, next) {
  try {
    const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data.map(toApiQuestion));
  } catch (err) {
    next(err);
  }
}

// --- CSV import --------------------------------------------------------
// Minimal, dependency-free CSV parser: handles quoted fields (including
// embedded commas and escaped "" quotes), since question text routinely
// contains commas. Not full RFC 4180, but covers a spreadsheet exported from
// Excel/Google Sheets, which is what QuestionBankPage's "Import CSV" is for.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

// Expected header (case-insensitive, order-independent):
// text, type, optionA, optionB, optionC, optionD, correctAnswer, marks, difficulty, topic
function rowsToQuestions(rows) {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name.toLowerCase());

  const col = {
    text: idx('text'),
    type: idx('type'),
    optionA: idx('optiona'),
    optionB: idx('optionb'),
    optionC: idx('optionc'),
    optionD: idx('optiond'),
    correctAnswer: idx('correctanswer'),
    marks: idx('marks'),
    difficulty: idx('difficulty'),
    topic: idx('topic'),
  };
  if (col.text === -1) {
    throw new ApiError(400, 'CSV must have a "text" column');
  }

  return rows.slice(1).map((cells) => ({
    text: cells[col.text] || '',
    type: col.type >= 0 ? cells[col.type] || 'MCQ' : 'MCQ',
    optionA: col.optionA >= 0 ? cells[col.optionA] : undefined,
    optionB: col.optionB >= 0 ? cells[col.optionB] : undefined,
    optionC: col.optionC >= 0 ? cells[col.optionC] : undefined,
    optionD: col.optionD >= 0 ? cells[col.optionD] : undefined,
    correctAnswer: col.correctAnswer >= 0 ? cells[col.correctAnswer] : undefined,
    marks: col.marks >= 0 ? Number(cells[col.marks]) || 2 : 2,
    difficulty: col.difficulty >= 0 ? cells[col.difficulty] || 'Medium' : 'Medium',
    topic: col.topic >= 0 ? cells[col.topic] : undefined,
  }));
}

// POST /api/v1/question-bank/import-csv  (admin) -- multipart/form-data, field "file"
export async function importCSV(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'No file uploaded (expected multipart field "file")');

    const text = req.file.buffer.toString('utf-8');
    const rows = parseCSV(text);
    const questions = rowsToQuestions(rows);
    if (questions.length === 0) {
      return res.json({ success: true, importedCount: 0 });
    }

    const dbRows = questions.map((q) => ({
      type: q.type,
      text: q.text,
      options: [q.optionA, q.optionB, q.optionC, q.optionD].filter((o) => o !== undefined),
      correct_answer: q.correctAnswer ?? null,
      marks: q.marks,
      difficulty: q.difficulty,
      topic: q.topic || null,
    }));

    const { data, error } = await supabase.from('questions').insert(dbRows).select('id');
    if (error) throw error;

    res.json({ success: true, importedCount: data.length });
  } catch (err) {
    next(err);
  }
}
