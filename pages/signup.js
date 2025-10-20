const DEFAULT_API_ENDPOINT = null;

function resolveApiEndpoint() {
  const explicit = window.OPTIONS_INSIGHT_API_URL || document.body.dataset.apiEndpoint;
  if (!explicit) {
    console.error('API endpoint not configured. Set OPTIONS_INSIGHT_API_URL or data-api-endpoint attribute.');
  }
  return explicit || DEFAULT_API_ENDPOINT;
}

function isValidEmail(value) {
  const email = (value || '').trim();
  if (!email || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setMessage(element, text, mode = 'info') {
  element.textContent = text;
  element.className = '';
  element.classList.add('message', mode);
}

function initCurrentYear() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear().toString();
  }
}

function initForm() {
  const form = document.getElementById('signup-form');
  const message = document.getElementById('form-message');
  if (!form || !message) return;

  const button = form.querySelector('button[type="submit"]');
  const endpoint = resolveApiEndpoint();

  setMessage(message, '', 'info');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const firstName = String(formData.get('firstName') || '').trim();

    if (!isValidEmail(email)) {
      setMessage(message, 'Please enter a valid email address.', 'error');
      return;
    }

    setMessage(message, 'Adding you to the list…', 'info');
    button.disabled = true;
    button.classList.add('loading');

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, source: 'options-insight-pages' })
      });

      const data = await response.json().catch(() => ({ success: false }));

      if (!response.ok || !data.success) {
        const error = data?.error || 'Something went wrong. Please try again later.';
        setMessage(message, error, 'error');
        button.disabled = false;
        button.classList.remove('loading');
        return;
      }

      form.reset();
      setMessage(message, data.message || 'You are on the list. Watch your inbox!', 'success');
      button.disabled = false;
      button.classList.remove('loading');
    } catch (error) {
      console.error('Signup error', error);
      setMessage(message, 'Network error. Please check your connection and try again.', 'error');
      button.disabled = false;
      button.classList.remove('loading');
    }
  });
}

initCurrentYear();
window.addEventListener('DOMContentLoaded', initForm);
