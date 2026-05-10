'use strict';

// ── URL helpers ────────────────────────────────────────────────────────────
const URLS = {
  create: '/tasks/api/create/',
  update: (id) => `/tasks/api/${id}/update/`,
  move:   (id) => `/tasks/api/${id}/move/`,
  delete: (id) => `/tasks/api/${id}/delete/`,
};

// ── CSRF ───────────────────────────────────────────────────────────────────
function getCsrfToken() {
  return document.cookie.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('csrftoken='))
    ?.split('=')[1] ?? '';
}

async function apiFetch(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ── DOM helpers ────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── Modal ──────────────────────────────────────────────────────────────────
const taskModal   = $('#taskModal');
const deleteModal = $('#deleteModal');

function openModal()  { taskModal.classList.add('open'); }
function closeModal() { taskModal.classList.remove('open'); resetForm(); }
function openDeleteModal()  { deleteModal.classList.add('open'); }
function closeDeleteModal() { deleteModal.classList.remove('open'); }

// Close modals when clicking the overlay background
taskModal.addEventListener('click', (e) => { if (e.target === taskModal) closeModal(); });
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) closeDeleteModal(); });

$('#modalClose').addEventListener('click', closeModal);
$('#modalCancelBtn').addEventListener('click', closeModal);
$('#deleteModalClose').addEventListener('click', closeDeleteModal);
$('#deleteCancelBtn').addEventListener('click', closeDeleteModal);

// ── Form state ─────────────────────────────────────────────────────────────
function resetForm() {
  $('#taskId').value = '';
  $('#taskTitle').value = '';
  $('#taskDescription').value = '';
  $('#taskStatus').value = 'todo';
  $('#taskPriority').value = '2';
  $('#taskDueDate').value = '';
  $('#titleError').style.display = 'none';
  $('#modalTitle').textContent = 'Add Task';
}

function populateForm(task) {
  $('#taskId').value = task.dataset.id;
  $('#taskTitle').value = task.dataset.title;
  $('#taskDescription').value = task.dataset.description;
  $('#taskStatus').value = task.dataset.status;
  $('#taskPriority').value = task.dataset.priority;
  $('#taskDueDate').value = task.dataset.due || '';
  $('#modalTitle').textContent = 'Edit Task';
}

// ── Open create modal via "New Task" button ─────────────────────────────────
$('#openCreateModal').addEventListener('click', () => {
  resetForm();
  openModal();
});

// ── Open create modal with pre-selected status from column ─────────────────
$$('.btn-add-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    resetForm();
    $('#taskStatus').value = btn.dataset.status;
    openModal();
  });
});

// ── Edit / Delete buttons (delegated, includes dynamically added cards) ────
document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.edit-btn');
  if (editBtn) {
    const card = editBtn.closest('.task-card');
    populateForm(card);
    openModal();
    return;
  }

  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    pendingDeleteId = deleteBtn.dataset.id;
    openDeleteModal();
    return;
  }
});

// ── Delete confirm ─────────────────────────────────────────────────────────
let pendingDeleteId = null;

$('#deleteConfirmBtn').addEventListener('click', async () => {
  if (!pendingDeleteId) return;
  const data = await apiFetch(URLS.delete(pendingDeleteId), 'DELETE');
  if (data.success) {
    const card = document.querySelector(`.task-card[data-id="${pendingDeleteId}"]`);
    const column = card?.closest('.kanban-column');
    card?.remove();
    if (column) updateCount(column);
    showToast('Task deleted.', 'error');
  } else {
    showToast('Failed to delete task.', 'error');
  }
  pendingDeleteId = null;
  closeDeleteModal();
});

// ── Task form submit (create / update) ────────────────────────────────────
$('#taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#taskId').value;
  const title = $('#taskTitle').value.trim();

  if (!title) {
    $('#titleError').textContent = 'Title is required.';
    $('#titleError').style.display = 'block';
    return;
  }
  $('#titleError').style.display = 'none';

  const payload = {
    title,
    description: $('#taskDescription').value.trim(),
    status: $('#taskStatus').value,
    priority: parseInt($('#taskPriority').value),
    due_date: $('#taskDueDate').value || null,
  };

  const url    = id ? URLS.update(id) : URLS.create;
  const method = id ? 'PUT' : 'POST';

  const data = await apiFetch(url, method, payload);

  if (data.success) {
    closeModal();
    if (id) {
      // Update existing card in DOM
      const card = document.querySelector(`.task-card[data-id="${id}"]`);
      if (card) {
        const oldColumn = card.closest('.kanban-column');
        const newColumnEl = document.querySelector(`.kanban-column[data-status="${payload.status}"]`);
        renderCard(card, data.task);
        if (oldColumn !== newColumnEl) {
          card.remove();
          $('#cards-' + payload.status).appendChild(card);
          updateCount(oldColumn);
          updateCount(newColumnEl);
        }
      }
    } else {
      // Insert new card
      const card = createCardElement(data.task);
      const container = $('#cards-' + payload.status);
      container.appendChild(card);
      updateCount(container.closest('.kanban-column'));
    }
    showToast(id ? 'Task updated.' : 'Task created.', 'success');
  } else {
    showToast('Error saving task.', 'error');
  }
});

// ── Card DOM helpers ───────────────────────────────────────────────────────
function priorityLabel(p) {
  return p === 3 ? 'High' : p === 2 ? 'Medium' : 'Low';
}
function priorityClass(p) {
  return p === 3 ? 'badge-high' : p === 2 ? 'badge-medium' : 'badge-low';
}

function renderCard(el, task) {
  el.dataset.id          = task.id;
  el.dataset.title       = task.title;
  el.dataset.description = task.description;
  el.dataset.status      = task.status;
  el.dataset.priority    = task.priority;
  el.dataset.due         = task.due_date || '';

  el.querySelector('.task-card-title').textContent = task.title;

  const descEl = el.querySelector('.task-card-desc');
  if (task.description) {
    if (descEl) { descEl.textContent = task.description; }
    else {
      const d = document.createElement('div');
      d.className = 'task-card-desc';
      d.textContent = task.description;
      el.insertBefore(d, el.querySelector('.task-card-meta'));
    }
  } else if (descEl) {
    descEl.remove();
  }

  const badge = el.querySelector('.badge');
  if (badge) {
    badge.className = `badge ${priorityClass(task.priority)}`;
    badge.textContent = priorityLabel(task.priority);
  }

  const dateEl = el.querySelector('.task-card-date');
  if (task.due_date) {
    if (dateEl) {
      dateEl.textContent = task.due_date;
      dateEl.classList.toggle('overdue', task.is_overdue);
    }
  } else if (dateEl) {
    dateEl.remove();
  }
}

function createCardElement(task) {
  const div = document.createElement('div');
  div.className = 'task-card';
  div.draggable = true;
  div.dataset.id          = task.id;
  div.dataset.title       = task.title;
  div.dataset.description = task.description;
  div.dataset.status      = task.status;
  div.dataset.priority    = task.priority;
  div.dataset.due         = task.due_date || '';
  div.innerHTML = `
    <div class="task-card-title">${escHtml(task.title)}</div>
    ${task.description ? `<div class="task-card-desc">${escHtml(task.description)}</div>` : ''}
    <div class="task-card-meta">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <span class="badge ${priorityClass(task.priority)}">${priorityLabel(task.priority)}</span>
        ${task.due_date ? `<span class="task-card-date ${task.is_overdue ? 'overdue' : ''}">${escHtml(task.due_date)}</span>` : ''}
      </div>
      <div class="task-card-actions">
        <button class="icon-btn edit-btn" title="Edit" data-id="${task.id}">✏️</button>
        <button class="icon-btn danger delete-btn" title="Delete" data-id="${task.id}">🗑️</button>
      </div>
    </div>`;
  return div;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateCount(columnEl) {
  if (!columnEl) return;
  const key = columnEl.dataset.status;
  const count = columnEl.querySelectorAll('.task-card').length;
  const el = document.getElementById(`count-${key}`);
  if (el) el.textContent = count;
}

// ── SortableJS drag-and-drop ───────────────────────────────────────────────
$$('.kanban-cards').forEach((container) => {
  Sortable.create(container, {
    group: 'kanban',
    animation: 150,
    ghostClass: 'dragging',
    onEnd({ item, to, newIndex }) {
      const taskId    = item.dataset.id;
      const newStatus = to.closest('.kanban-column').dataset.status;
      item.dataset.status = newStatus;

      // Persist to server
      apiFetch(URLS.move(taskId), 'POST', { status: newStatus, position: newIndex })
        .then((d) => {
          if (!d.success) showToast('Failed to move task.', 'error');
          // Recount all columns
          $$('.kanban-column').forEach(updateCount);
        });
    },
  });
});
