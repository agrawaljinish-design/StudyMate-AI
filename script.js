/**
 * StudyMate AI – Personal AI Study Assistant (script.js)
 * Clean, beginner-friendly Vanilla JavaScript for college assignment.
 */

// Google Gemini API endpoint using official gemini-3.8-flash model
const GEMINI_API_URL =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
let currentSummary = '';
let currentQuestions = [];
let currentFlashcards = [];

// --- 1. INITIALIZATION & EVENT LISTENERS ---
window.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading-message');
  if (loading) loading.classList.add('hidden');

  loadTheme();
  loadApiKey();
  loadHistory();

  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
  document.getElementById('save-key-btn').addEventListener('click', saveApiKey);
  document.getElementById('generate-btn').addEventListener('click', generateStudyMaterial);
  document.getElementById('copy-summary-btn').addEventListener('click', copySummary);
  document.getElementById('download-summary-btn').addEventListener('click', downloadSummary);
  document.getElementById('submit-quiz-btn').addEventListener('click', submitQuiz);
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
});

// --- 2. THEME TOGGLE (DARK / LIGHT MODE) ---
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('studymate_theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
  if (localStorage.getItem('studymate_theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }
}

// --- 3. API KEY MANAGEMENT ---
// Note: localStorage is used for demonstration; production apps use secure backend servers.
function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return alert('Please enter a valid Gemini API key.');
  localStorage.setItem('studymate_api_key', key);
  alert('API Key saved successfully!');
}

function loadApiKey() {
  const savedKey = localStorage.getItem('studymate_api_key');
  if (savedKey) document.getElementById('api-key-input').value = savedKey;
}

// --- 4. GENERATION WORKFLOW & VALIDATION ---
async function generateStudyMaterial() {
  const notesInput = document.getElementById('notes-input');
  const notes = notesInput.value.trim();
  const apiKey = localStorage.getItem('studymate_api_key') || document.getElementById('api-key-input').value.trim();

  if (!notes) {
    alert('Please enter your study notes before generating.');
    return notesInput.focus();
  }
  if (!apiKey) {
    alert('Please enter and save your Gemini API key in Settings first.');
    return document.getElementById('api-key-input').focus();
  }

  const loading = document.getElementById('loading-message');
  const generateBtn = document.getElementById('generate-btn');

  loading.classList.remove('hidden');
  generateBtn.disabled = true;

  try {
    const data = await callGeminiAPI(notes, apiKey);
    currentSummary = data.summary;
    currentQuestions = data.questions;
    currentFlashcards = data.flashcards;

    displaySummary(currentSummary);
    displayQuiz(currentQuestions);
    displayFlashcards(currentFlashcards);

    saveToHistory(notes, data);
    loadHistory();
  } catch (error) {
    alert('Error: ' + error.message);
  } finally {
    loading.classList.add('hidden');
    generateBtn.disabled = false;
  }
}

// --- 5. GEMINI API CALL & VALIDATION ---
async function callGeminiAPI(notes, apiKey) {
  const prompt = `You are a study assistant. Analyze these student notes:
"""
${notes}
"""
Respond ONLY with a JSON object following this exact structure:
{
  "summary": "Clear, simple summary text.",
  "questions": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of the answer."
    }
  ],
  "flashcards": [
    { "front": "Term or concept", "back": "Definition or explanation" }
  ]
}
Requirements:
1. Provide a simple, clear summary.
2. Provide EXACTLY 5 questions with EXACTLY 4 options each.
3. correctAnswer must be an integer (0, 1, 2, or 3).
4. Provide AT LEAST 5 flashcards with front and back.
5. Return raw JSON without markdown code fences.`;

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, responseMimeType: 'application/json' }
  };

  let response;
  try {
    // API key passed securely via header instead of URL query parameter
    response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });
  } catch (netErr) {
    throw new Error('Network error: Unable to connect to Gemini API. Check your internet connection.');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Invalid API key (${response.status}). Please check your key in Settings.`);
    } else if (response.status === 429) {
      throw new Error('Rate limit reached (429). Please wait 30 seconds and try again.');
    } else {
      throw new Error(`API error (HTTP ${response.status}). Please try again.`);
    }
  }

  const result = await response.json();
  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('AI returned an empty response. Try providing longer notes.');

  let cleanText = rawText.trim();
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let data;
  try {
    data = JSON.parse(cleanText);
  } catch (parseErr) {
    throw new Error('AI returned an invalid JSON response. Please try again.');
  }

  validateResponse(data);
  return data;
}

function validateResponse(data) {
  if (!data || typeof data !== 'object') throw new Error('AI response is not an object.');

  // Validate non-empty summary string
  if (typeof data.summary !== 'string' || data.summary.trim() === '') {
    throw new Error('AI response is missing valid summary text.');
  }

  // Validate exactly 5 questions
  if (!Array.isArray(data.questions) || data.questions.length !== 5) {
    throw new Error('AI must return exactly 5 quiz questions.');
  }

  data.questions.forEach((q, i) => {
    const qNum = i + 1;
    if (!q || typeof q.question !== 'string' || q.question.trim() === '') {
      throw new Error(`Question #${qNum} is missing valid question text.`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question #${qNum} must have exactly 4 options.`);
    }
    q.options.forEach((opt, optIndex) => {
      if (typeof opt !== 'string' || opt.trim() === '') {
        throw new Error(`Question #${qNum}, option #${optIndex + 1} must be non-empty text.`);
      }
    });

    const ans = Number(q.correctAnswer);
    if (!Number.isInteger(ans) || ans < 0 || ans > 3) {
      throw new Error(`Question #${qNum} has an invalid correctAnswer index (must be 0, 1, 2, or 3).`);
    }
    q.correctAnswer = ans;
    if (typeof q.explanation !== 'string') q.explanation = '';
  });

  // Validate at least 5 flashcards
  if (!Array.isArray(data.flashcards) || data.flashcards.length < 5) {
    throw new Error('AI must return at least 5 flashcards.');
  }

  data.flashcards.forEach((card, i) => {
    const cardNum = i + 1;
    if (!card || typeof card.front !== 'string' || card.front.trim() === '') {
      throw new Error(`Flashcard #${cardNum} is missing valid front text.`);
    }
    if (typeof card.back !== 'string' || card.back.trim() === '') {
      throw new Error(`Flashcard #${cardNum} is missing valid back text.`);
    }
  });
}

// --- 6. SUMMARY SECTION ---
function displaySummary(summaryText) {
  const container = document.getElementById('summary-output');
  if (!container) return;
  const paragraphs = summaryText.split('\n\n');
  container.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
}

function copySummary() {
  if (!currentSummary) return alert('No summary available to copy.');
  navigator.clipboard.writeText(currentSummary)
    .then(() => alert('Summary copied to clipboard!'))
    .catch(() => alert('Failed to copy summary to clipboard.'));
}

function downloadSummary() {
  if (!currentSummary) return alert('No summary available to download.');
  try {
    const blob = new Blob([currentSummary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Study_Summary.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Summary downloaded successfully!');
  } catch (e) {
    alert('Failed to download summary.');
  }
}

// --- 7. QUIZ SECTION ---
function displayQuiz(questions) {
  const container = document.getElementById('quiz-output');
  const scoreEl = document.getElementById('quiz-score');
  if (!container) return;
  if (scoreEl) scoreEl.textContent = '';

  let html = '';
  questions.forEach((q, qIndex) => {
    html += `<div class="quiz-item">
      <p><strong>Q${qIndex + 1}: ${escapeHtml(q.question)}</strong></p>`;
    q.options.forEach((opt, optIndex) => {
      const radioId = `q${qIndex}_opt${optIndex}`;
      html += `<div class="quiz-option">
        <input type="radio" id="${radioId}" name="question_${qIndex}" value="${optIndex}">
        <label for="${radioId}">${escapeHtml(opt)}</label>
      </div>`;
    });
    html += `<div id="quiz-exp-${qIndex}" class="quiz-explanation hidden">
        <p><strong>Correct Answer:</strong> Option ${String.fromCharCode(65 + q.correctAnswer)} (${escapeHtml(q.options[q.correctAnswer])})</p>
        <p><strong>Explanation:</strong> ${escapeHtml(q.explanation || 'None')}</p>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function submitQuiz() {
  if (!currentQuestions.length) return alert('Please generate study material first.');
  let score = 0;
  for (let i = 0; i < currentQuestions.length; i++) {
    const selected = document.querySelector(`input[name="question_${i}"]:checked`);
    if (selected && parseInt(selected.value, 10) === currentQuestions[i].correctAnswer) {
      score++;
    }
    const exp = document.getElementById(`quiz-exp-${i}`);
    if (exp) exp.classList.remove('hidden');
  }
  const scoreEl = document.getElementById('quiz-score');
  if (scoreEl) scoreEl.textContent = `Your Score: ${score} / 5 (${score * 20}%)`;
  alert(`Quiz submitted! You scored ${score} out of 5.`);
}

// --- 8. FLASHCARDS SECTION ---
function displayFlashcards(flashcards) {
  const container = document.getElementById('flashcards-output');
  if (!container) return;
  container.innerHTML = '';

  flashcards.forEach((card, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'flashcard';

    let isFlipped = false;
    const updateCard = () => {
      cardDiv.innerHTML = isFlipped
        ? `<div class="card-label">CARD ${index + 1} (BACK - ANSWER)</div>
           <p class="card-text"><strong>${escapeHtml(card.back)}</strong></p>
           <span class="card-hint">(Click to view question)</span>`
        : `<div class="card-label">CARD ${index + 1} (FRONT - QUESTION)</div>
           <p class="card-text">${escapeHtml(card.front)}</p>
           <span class="card-hint">(Click to reveal answer)</span>`;
    };
    updateCard();
    cardDiv.addEventListener('click', () => {
      isFlipped = !isFlipped;
      updateCard();
    });
    container.appendChild(cardDiv);
  });
}

// --- 9. HISTORY SECTION (LOCALSTORAGE SAFE HANDLING) ---
function getStoredHistory() {
  try {
    const raw = localStorage.getItem('studymate_history');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Corrupted study history detected. Defaulting to empty list.');
    return [];
  }
}

function saveToHistory(notes, data) {
  try {
    const history = getStoredHistory();
    history.unshift({
      date: new Date().toLocaleString(),
      preview: notes.slice(0, 40) + (notes.length > 40 ? '...' : ''),
      notes: notes,
      summary: data.summary,
      questions: data.questions,
      flashcards: data.flashcards
    });
    if (history.length > 15) history.length = 15;
    localStorage.setItem('studymate_history', JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

function loadHistory() {
  const container = document.getElementById('history-output');
  if (!container) return;
  const history = getStoredHistory();

  if (!history.length) {
    container.innerHTML = '<p class="history-empty">No previous study generations saved yet.</p>';
    return;
  }

  let html = '<ul class="history-list">';
  history.forEach((item, index) => {
    html += `<li class="history-item">
      <div>
        <strong>${escapeHtml(item.preview)}</strong><br>
        <span class="history-date">${escapeHtml(item.date)}</span>
      </div>
      <button type="button" class="history-restore-btn" data-index="${index}">Restore</button>
    </li>`;
  });
  html += '</ul>';
  container.innerHTML = html;

  container.querySelectorAll('.history-restore-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const idx = parseInt(this.getAttribute('data-index'), 10);
      restoreHistoryItem(history[idx]);
    });
  });
}

function restoreHistoryItem(item) {
  if (!item || typeof item !== 'object' || !item.summary || !Array.isArray(item.questions) || !Array.isArray(item.flashcards)) {
    return alert('Unable to restore: This history record is incomplete or corrupted.');
  }

  currentSummary = item.summary;
  currentQuestions = item.questions;
  currentFlashcards = item.flashcards;

  const notesInput = document.getElementById('notes-input');
  if (notesInput && item.notes) notesInput.value = item.notes;

  displaySummary(currentSummary);
  displayQuiz(currentQuestions);
  displayFlashcards(currentFlashcards);
  alert(`Restored study session from: ${item.date || 'Saved History'}`);
}

function clearHistory() {
  const history = getStoredHistory();
  if (!history.length) return alert('History is already empty.');

  if (confirm('Are you sure you want to clear all saved study history?')) {
    localStorage.removeItem('studymate_history');
    loadHistory();
    alert('All study history cleared.');
  }
}

// --- 10. HELPER UTILITY ---
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
