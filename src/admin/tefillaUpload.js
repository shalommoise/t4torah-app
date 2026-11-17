// The Time4Tefilla upload page. The browser already holds the admin token
// (from its Basic auth prompt) and sends it with these same-origin requests.
(() => {
  const BASE = '/admin/time4tefilla';
  const form = document.getElementById('upload');
  const submit = document.getElementById('submit');
  const status = document.getElementById('status');
  const result = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultBody = document.getElementById('result-body');

  const notice = (text, kind) => {
    status.textContent = text;
    status.className = `notice ${kind}`;
    status.hidden = false;
  };

  const show = (title, body, bad) => {
    resultTitle.textContent = title;
    resultBody.textContent = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    result.className = bad ? 'bad' : '';
    result.hidden = false;
  };

  const loadStatus = async () => {
    try {
      const response = await fetch(`${BASE}/status`, { credentials: 'same-origin' });
      const data = await response.json();
      if (data.configError) {
        notice(`Server config problem: ${data.configError}`, 'bad');
      } else if (!data.ffmpeg.ok) {
        notice(`ffmpeg is not available on the server, so uploads will fail: ${data.ffmpeg.error}`, 'bad');
      }
      document.querySelectorAll('input[name=mode]').forEach((input) => {
        if (!data.modes.includes(input.value)) {
          input.disabled = true;
          input.parentElement.title = 'Not allowed on this server (TEFILLA_SEND_MODE)';
        }
      });
    } catch (error) {
      notice(`Could not read the server status: ${error.message}`, 'warn');
    }
  };

  const summarise = (data) => {
    if (data.status === 'dry-run') {
      return `Dry run done: nothing was created. Preview files:\n${Object.values(data.outbox).join('\n')}`;
    }
    const when = data.status === 'scheduled' ? `scheduled for ${data.plan.email.at}` : 'sent now';
    return [
      `Email ${when} (campaign ${data.campaignId}, audience ${data.audience}).`,
      `Castos episode ${data.castos.episodeId}${data.castos.reused ? ' (existing episode reused)' : ''}: ${data.castos.audioUrl}`,
      data.logError ? `WARNING: ${data.logError}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const mode = data.get('mode');
    const title = String(data.get('title') || '').trim();
    if (mode === 'live' && !window.confirm(`Send "${title}" to the Time4Tefilla audience?`)) {
      return;
    }
    submit.disabled = true;
    show('Working…', 'Converting, uploading to Castos, checking the audio and creating the campaign. This can take a minute or two.');
    try {
      const response = await fetch(`${BASE}/uploads`, { method: 'POST', body: data, credentials: 'same-origin' });
      const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      if (response.ok && body.ok) {
        show(`Done (${body.mode})`, `${summarise(body)}\n\n${JSON.stringify(body, null, 2)}`, false);
      } else {
        show(`Failed (HTTP ${response.status}${body.stage ? `, ${body.stage}` : ''})`, body.error || body, true);
      }
    } catch (error) {
      show('Failed', error.message, true);
    } finally {
      submit.disabled = false;
    }
  });

  loadStatus();
})();
