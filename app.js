const API_URL = "https://script.google.com/macros/s/AKfycbyxW4heiKhXVEcyh-DJ-CXE_fkAR3CMD2Gei9QU0b9v8Jh7HsxS4P2C1zAwWWT7JGtBBg/exec";

function showResult(el, html, error = false) {
  el.innerHTML = html;
  el.classList.remove("hidden");
  el.classList.toggle("error", error);
}

async function callApi(action, payload) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || "Request failed.");
  return d;
}

function fileToBase64(f) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[c]);
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
}

// Load public stats on page load
async function loadPublicStats() {
  try {
    const data = await callApi('getStats', {});
    document.getElementById('publicTotal').textContent = data.total || 0;
    document.getElementById('publicPending').textContent = data.pending || 0;
  } catch(e) {
    console.log('Stats load error:', e);
  }
}

document.getElementById("questionForm").addEventListener("submit", async e => {
  e.preventDefault();
  const b = document.getElementById("submitBtn");
  const out = document.getElementById("submitResult");
  b.disabled = true;
  showResult(out, "Submitting...");
  try {
    const files = [];
    for (const f of document.getElementById("files").files) {
      if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is larger than 10 MB.`);
      files.push({ name: f.name, mimeType: f.type || "application/octet-stream", data: await fileToBase64(f) });
    }
    const d = await callApi("submit", {
      studentName: document.getElementById("studentName").value.trim(),
      studentId: document.getElementById("studentId").value.trim(),
      studentEmail: document.getElementById("studentEmail").value.trim(),
      course: document.getElementById("course").value.trim(),
      question: document.getElementById("question").value.trim(),
      files
    });
    showResult(out, `✅ Submitted!<br><strong>Your ID:</strong> ${esc(d.submissionId)}<br><small>Save this ID to check feedback.</small>`);
    e.target.reset();
    loadPublicStats(); // Refresh stats
  } catch (err) {
    showResult(out, `❌ ${esc(err.message)}`, true);
  } finally {
    b.disabled = false;
  }
});

document.getElementById("feedbackForm").addEventListener("submit", async e => {
  e.preventDefault();
  const out = document.getElementById("feedbackResult");
  showResult(out, "Checking...");
  try {
    const d = await callApi("feedback", {
      submissionId: document.getElementById("feedbackId").value.trim(),
      studentEmail: document.getElementById("feedbackEmail").value.trim()
    });
    let h = `<strong>Status:</strong> ${esc(d.status)}<br><strong>Question:</strong><br>${esc(d.question).replace(/\n/g, "<br>")}`;
    if (d.feedback) h += `<hr><strong>Feedback:</strong><br>${esc(d.feedback).replace(/\n/g, "<br>")}`;
    if (d.feedbackFileUrl && /^https:\/\/drive\.google\.com\//i.test(d.feedbackFileUrl)) {
      h += `<br><a href="${d.feedbackFileUrl}" target="_blank">📎 Open feedback file</a>`;
    }
    showResult(out, h);
  } catch (err) {
    showResult(out, `❌ ${esc(err.message)}`, true);
  }
});

let currentPassword = '';

function loginInstructor() {
  const password = document.getElementById('instructorPassword').value;
  const errorEl = document.getElementById('loginError');
  if (!password) { showResult(errorEl, "❌ Please enter a password.", true); return; }
  currentPassword = password;
  document.getElementById('instructorLogin').classList.add('hidden');
  document.getElementById('instructorContent').classList.remove('hidden');
  showResult(errorEl, "", false);
  loadSubmissions();
}

async function loadSubmissions() {
  const listEl = document.getElementById('submissionsList');
  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:#6b7280;">Loading...</div>';
  try {
    const data = await callApi('getAllSubmissions', { password: currentPassword });
    updateStatistics(data.submissions);
    if (data.submissions && data.submissions.length > 0) {
      let html = `<table><thead><tr><th>ID</th><th>Student</th><th>Status</th></tr></thead><tbody>`;
      data.submissions.forEach((sub, index) => {
        const statusClass = sub.Status === 'Answered' ? 'status-answered' : 'status-submitted';
        const statusText = sub.Status || 'Submitted';
        html += `<tr onclick="selectSubmission(${index})">
          <td><strong style="font-size:12px;">${esc(sub.SubmissionID)}</strong></td>
          <td><div style="font-weight:500;">${esc(sub.StudentName)}</div><div style="font-size:11px;color:#6b7280;">${esc(sub.Course)}</div></td>
          <td><span class="submission-status ${statusClass}">${esc(statusText)}</span></td>
        </tr>`;
      });
      html += '</tbody></table>';
      listEl.innerHTML = html;
    } else {
      listEl.innerHTML = '<div class="no-submissions">📭 No submissions yet</div>';
    }
  } catch (err) {
    if (err.message.includes('Unauthorized') || err.message.includes('password')) {
      document.getElementById('instructorLogin').classList.remove('hidden');
      document.getElementById('instructorContent').classList.add('hidden');
      showResult(document.getElementById('loginError'), "❌ Incorrect password", true);
    } else {
      listEl.innerHTML = `<div class="result error">❌ ${esc(err.message)}</div>`;
    }
  }
}

function updateStatistics(submissions) {
  const total = submissions ? submissions.length : 0;
  const pending = submissions ? submissions.filter(s => s.Status !== 'Answered').length : 0;
  const answered = total - pending;
  document.getElementById('totalSubmissions').textContent = total;
  document.getElementById('pendingSubmissions').textContent = pending;
  document.getElementById('answeredSubmissions').textContent = answered;
}

function selectSubmission(index) {
  const rows = document.querySelectorAll('#submissionsList tbody tr');
  rows.forEach(row => row.classList.remove('selected'));
  rows[index].classList.add('selected');
  const submissionId = rows[index].querySelector('td:first-child strong').textContent;
  loadSubmissionForFeedback(submissionId);
}

function showFindSubmission() {
  document.getElementById('findSubmissionBox').classList.toggle('hidden');
}

async function loadSubmissionById() {
  const id = document.getElementById('instructorSubmissionId').value.trim();
  if (!id) { alert('Please enter a Submission ID'); return; }
  loadSubmissionForFeedback(id);
}

async function loadSubmissionForFeedback(submissionId) {
  try {
    const data = await callApi('getSubmission', {
      submissionId: submissionId,
      password: currentPassword
    });
    document.getElementById('feedbackFormContainer').classList.remove('hidden');
    document.getElementById('feedbackSubmissionId').value = submissionId;
    document.getElementById('displayQuestion').textContent = data.Question || 'No question provided';
    document.getElementById('instructorFeedback').value = data.InstructorFeedback || '';
    document.getElementById('feedbackFormContainer').scrollIntoView({ behavior: 'smooth' });
    showResult(document.getElementById('feedbackSubmitResult'), `📝 Feedback for: <strong>${esc(submissionId)}</strong>`, false);
  } catch (err) {
    showResult(document.getElementById('feedbackSubmitResult'), `❌ ${esc(err.message)}`, true);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Load public stats
  loadPublicStats();
  
  const feedbackForm = document.getElementById('instructorFeedbackForm');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      const resultEl = document.getElementById('feedbackSubmitResult');
      submitBtn.disabled = true;
      showResult(resultEl, 'Submitting...', false);
      try {
        const submissionId = document.getElementById('feedbackSubmissionId').value;
        const feedback = document.getElementById('instructorFeedback').value.trim();
        const fileInput = document.getElementById('feedbackFile');
        let fileData = null;
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds 10 MB');
          fileData = { name: file.name, mimeType: file.type || 'application/octet-stream', data: await fileToBase64(file) };
        }
        await callApi('submitFeedback', { submissionId, feedback, file: fileData, password: currentPassword });
        showResult(resultEl, '✅ Feedback submitted! Email sent to student.', false);
        fileInput.value = '';
        loadSubmissions();
        loadPublicStats(); // Refresh stats
      } catch (err) {
        showResult(resultEl, `❌ ${esc(err.message)}`, true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  const changeForm = document.getElementById('changePasswordFormSubmit');
  if (changeForm) {
    changeForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const resultEl = document.getElementById('passwordChangeResult');
      const submitBtn = this.querySelector('button[type="submit"]');
      const currentPwd = document.getElementById('currentPassword').value;
      const newPwd = document.getElementById('newPassword').value;
      const confirmPwd = document.getElementById('confirmPassword').value;
      if (newPwd !== confirmPwd) { showResult(resultEl, "❌ Passwords don't match", true); return; }
      if (newPwd.length < 6) { showResult(resultEl, "❌ Minimum 6 characters", true); return; }
      submitBtn.disabled = true;
      showResult(resultEl, 'Changing...', false);
      try {
        await callApi('changePassword', { currentPassword: currentPwd, newPassword: newPwd });
        currentPassword = newPwd;
        showResult(resultEl, '✅ Password changed! Logging out...', false);
        this.reset();
        setTimeout(() => {
          document.getElementById('instructorContent').classList.add('hidden');
          document.getElementById('instructorLogin').classList.remove('hidden');
          document.getElementById('instructorPassword').value = '';
          document.getElementById('loginError').classList.add('hidden');
          document.getElementById('passwordChangeResult').classList.add('hidden');
          document.getElementById('changePasswordForm').classList.add('hidden');
          currentPassword = '';
        }, 2000);
      } catch (err) {
        showResult(resultEl, `❌ ${esc(err.message)}`, true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
});

function togglePasswordForm() {
  document.getElementById('changePasswordForm').classList.toggle('hidden');
}
