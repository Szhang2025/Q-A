const API_URL = "https://script.google.com/macros/s/AKfycbyr-Er3ENHSOO4sFKrnGWMFm_RHGXtoxBLWWspLamvQdgBUwbDED57t13UHtRi8kBCr7g/exec";
const $ = id => document.getElementById(id);

function showResult(el, html, error = false) {
  el.innerHTML = html;
  el.classList.remove("hidden");
  el.classList.toggle("error", error);
}

async function callApi(action, payload) {
  if (API_URL.includes("PASTE_YOUR")) throw new Error("Set API_URL in app.js to your Google Apps Script Web App URL.");
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

// Student Question Submission
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
    showResult(out, `<strong>Submitted successfully.</strong><br>Your Submission ID is <strong>${esc(d.submissionId)}</strong>.<br>Save this ID to check feedback.`);
    e.target.reset();
  } catch (err) {
    showResult(out, esc(err.message), true);
  } finally {
    b.disabled = false;
  }
});

// Student Feedback Check
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
    if (d.feedback) h += `<hr><strong>Instructor feedback:</strong><br>${esc(d.feedback).replace(/\n/g, "<br>")}`;
    if (d.feedbackFileUrl && /^https:\/\/drive\.google\.com\//i.test(d.feedbackFileUrl)) {
      h += `<br><br><a href="${d.feedbackFileUrl}" target="_blank" rel="noopener">Open feedback file</a>`;
    }
    showResult(out, h);
  } catch (err) {
    showResult(out, esc(err.message), true);
  }
});

// ==================== INSTRUCTOR FUNCTIONS ====================

let currentPassword = '';

function loginInstructor() {
  const password = document.getElementById('instructorPassword').value;
  const errorEl = document.getElementById('loginError');
  
  if (password.length < 1) {
    showResult(errorEl, "❌ Please enter a password.", true);
    return;
  }
  
  currentPassword = password;
  document.getElementById('instructorLogin').classList.add('hidden');
  document.getElementById('instructorContent').classList.remove('hidden');
  showResult(errorEl, "", false);
  loadSubmissions();
}

async function loadSubmissions() {
  const listEl = document.getElementById('submissionsList');
  listEl.innerHTML = '<div style="text-align:center;padding:20px;">Loading submissions...</div>';
  
  try {
    const data = await callApi('getAllSubmissions', { password: currentPassword });
    
    if (data.submissions && data.submissions.length > 0) {
      let html = `<table>
        <thead><tr>
          <th>ID</th>
          <th>Student</th>
          <th>Course</th>
          <th>Question</th>
          <th>Status</th>
          <th>Date</th>
        </tr></thead><tbody>`;
      
      data.submissions.forEach((sub, index) => {
        const statusClass = sub.Status === 'Answered' ? 'status-answered' : 'status-submitted';
        const statusText = sub.Status || 'Submitted';
        html += `<tr onclick="selectSubmission(${index})" data-index="${index}">
          <td><strong>${esc(sub.SubmissionID)}</strong></td>
          <td>${esc(sub.StudentName)}<br><small>${esc(sub.StudentID)}</small></td>
          <td>${esc(sub.Course)}</td>
          <td class="submission-question" title="${esc(sub.Question)}">${esc(sub.Question)}</td>
          <td><span class="submission-status ${statusClass}">${esc(statusText)}</span></td>
          <td><small>${esc(sub.Timestamp ? sub.Timestamp.split(' ')[0] : '')}</small></td>
        </tr>`;
      });
      
      html += '</tbody></table>';
      listEl.innerHTML = html;
    } else {
      listEl.innerHTML = '<div class="no-submissions">📭 No submissions yet.</div>';
    }
  } catch (err) {
    if (err.message.includes('Unauthorized') || err.message.includes('password')) {
      document.getElementById('instructorLogin').classList.remove('hidden');
      document.getElementById('instructorContent').classList.add('hidden');
      const errorEl = document.getElementById('loginError');
      showResult(errorEl, "❌ Incorrect password. Please try again.", true);
    } else {
      listEl.innerHTML = `<div class="result error">❌ ${esc(err.message)}</div>`;
    }
  }
}

function selectSubmission(index) {
  const rows = document.querySelectorAll('#submissionsList tbody tr');
  rows.forEach(row => row.classList.remove('selected'));
  rows[index].classList.add('selected');
  
  const submissionId = rows[index].querySelector('td:first-child strong').textContent;
  loadSubmissionForFeedback(submissionId);
}

async function loadSubmissionById() {
  const id = document.getElementById('instructorSubmissionId').value.trim();
  if (!id) {
    alert('Please enter a Submission ID');
    return;
  }
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
    
    showResult(document.getElementById('feedbackSubmitResult'), 
      `📝 Providing feedback for submission: <strong>${esc(submissionId)}</strong>`, 
      false
    );
  } catch (err) {
    showResult(document.getElementById('feedbackSubmitResult'), `❌ ${esc(err.message)}`, true);
  }
}

// Handle instructor feedback submission
document.addEventListener('DOMContentLoaded', function() {
  const feedbackForm = document.getElementById('instructorFeedbackForm');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      const resultEl = document.getElementById('feedbackSubmitResult');
      
      submitBtn.disabled = true;
      showResult(resultEl, 'Submitting feedback...', false);
      
      try {
        const submissionId = document.getElementById('feedbackSubmissionId').value;
        const feedback = document.getElementById('instructorFeedback').value.trim();
        const fileInput = document.getElementById('feedbackFile');
        
        let fileData = null;
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          if (file.size > 10 * 1024 * 1024) {
            throw new Error('File is larger than 10 MB');
          }
          fileData = {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: await fileToBase64(file)
          };
        }
        
        await callApi('submitFeedback', {
          submissionId: submissionId,
          feedback: feedback,
          file: fileData,
          password: currentPassword
        });
        
        showResult(resultEl, 
          `✅ Feedback submitted successfully!<br><small>Submission ID: ${esc(submissionId)}</small>`,
          false
        );
        
        fileInput.value = '';
        loadSubmissions();
        
      } catch (err) {
        showResult(resultEl, `❌ ${esc(err.message)}`, true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Change Password Form
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const resultEl = document.getElementById('passwordChangeResult');
      const submitBtn = this.querySelector('button[type="submit"]');
      
      const currentPwd = document.getElementById('currentPassword').value;
      const newPwd = document.getElementById('newPassword').value;
      const confirmPwd = document.getElementById('confirmPassword').value;
      
      // Validate passwords match
      if (newPwd !== confirmPwd) {
        showResult(resultEl, "❌ New passwords do not match.", true);
        return;
      }
      
      if (newPwd.length < 6) {
        showResult(resultEl, "❌ New password must be at least 6 characters.", true);
        return;
      }
      
      submitBtn.disabled = true;
      showResult(resultEl, 'Changing password...', false);
      
      try {
        await callApi('changePassword', {
          currentPassword: currentPwd,
          newPassword: newPwd
        });
        
        // Update current password
        currentPassword = newPwd;
        
        showResult(resultEl, 
          '✅ Password changed successfully! You will be logged out in 3 seconds.', 
          false
        );
        
        this.reset();
        
        // Logout after 3 seconds
        setTimeout(() => {
          document.getElementById('instructorContent').classList.add('hidden');
          document.getElementById('instructorLogin').classList.remove('hidden');
          document.getElementById('instructorPassword').value = '';
          document.getElementById('loginError').classList.add('hidden');
          document.getElementById('passwordChangeResult').classList.add('hidden');
          currentPassword = '';
        }, 3000);
        
      } catch (err) {
        showResult(resultEl, `❌ ${esc(err.message)}`, true);
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
});
