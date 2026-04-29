const nowPlayingStatus = document.querySelector('[data-now-playing-status]');
const nowPlayingRoot = document.querySelector('[data-now-playing-card]');
const trackTitle = document.querySelector('[data-track-title]');
const trackArtist = document.querySelector('[data-track-artist]');
const trackAlbum = document.querySelector('[data-track-album]');
const trackArtwork = document.querySelector('[data-track-artwork]');
const trackProgressFill = document.querySelector('[data-track-progress-fill]');
const trackProgressLabel = document.querySelector('[data-track-progress-label]');
const listenButton = document.querySelector('[data-listen-button]');
const openTrackButton = document.querySelector('[data-open-track-button]');
const suggestionForm = document.querySelector('[data-music-suggestion-form]');
const suggestionStatus = document.querySelector('[data-suggestion-status]');
const suggestionList = document.querySelector('[data-suggestion-list]');

const POLL_MS = 15000;
const ENDPOINTS = {
	nowPlaying: ['/api/spotify-now-playing'],
	suggestions: ['/api/music-suggestions'],
};

function escapeHtml(text) {
	return String(text || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function formatDuration(ms) {
	if (!Number.isFinite(ms) || ms < 0) return '0:00';
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function setNowPlayingStatus(text, isError = false) {
	if (!nowPlayingStatus) return;
	nowPlayingStatus.textContent = text;
	nowPlayingStatus.dataset.state = isError ? 'error' : 'ok';
}

function setSuggestionStatus(text, isError = false) {
	if (!suggestionStatus) return;
	suggestionStatus.textContent = text;
	suggestionStatus.dataset.state = isError ? 'error' : 'ok';
}

async function fetchWithFallback(paths, options = {}) {
	let lastError = null;
	for (const path of paths) {
		const response = await fetch(path, options);
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			lastError = new Error(payload.error || `Request failed with status ${response.status}`);
			continue;
		}
		return payload;
	}
	if (lastError) throw lastError;
	throw new Error('No available endpoint.');
}

function renderNowPlaying(data) {
	if (!nowPlayingRoot) return;
	nowPlayingRoot.classList.remove('music-mini-card--loading');

	const title = data.track || 'Nothing is playing right now';
	const artist = data.artist || 'Spotify idle';
	const album = data.album || 'Start a track and refresh in a moment.';
	const artwork = data.artworkUrl || '../images/owenminercs-logo.png';
	const progress = Number.isFinite(data.progressMs) ? data.progressMs : 0;
	const duration = Number.isFinite(data.durationMs) ? data.durationMs : 0;
	const progressPct = duration > 0 ? Math.max(0, Math.min(100, (progress / duration) * 100)) : 0;
	const destination = data.jamUrl || data.spotifyUrl || 'https://open.spotify.com/';

	if (trackTitle) trackTitle.textContent = title;
	if (trackArtist) trackArtist.textContent = artist;
	if (trackAlbum) trackAlbum.textContent = album;
	if (trackArtwork) {
		trackArtwork.src = artwork;
		trackArtwork.alt = data.track ? `Album art for ${title}` : 'Spotify artwork placeholder';
	}

	if (trackProgressFill) {
		trackProgressFill.style.width = `${progressPct.toFixed(2)}%`;
	}
	if (trackProgressLabel) {
		trackProgressLabel.textContent = `${formatDuration(progress)} / ${formatDuration(duration)}`;
	}

	if (listenButton) {
		listenButton.href = destination;
		listenButton.textContent = data.jamUrl ? 'Join my Spotify Jam' : 'Listen along in Spotify';
	}

	if (openTrackButton) {
		openTrackButton.href = data.spotifyUrl || 'https://open.spotify.com/';
	}

	const statusText = data.isPlaying
		? 'Live now playing'
		: 'Spotify connected - waiting for next track';
	setNowPlayingStatus(statusText, false);
}

async function loadNowPlaying() {
	setNowPlayingStatus('Loading now playing...', false);
	try {
		const payload = await fetchWithFallback(ENDPOINTS.nowPlaying, { cache: 'no-store' });
		renderNowPlaying(payload);
	} catch (error) {
		setNowPlayingStatus(`Could not load now playing: ${String(error.message || error)}`, true);
	}
}

function unlockSuggestionForm() {
	if (!suggestionForm) return;
	suggestionForm.querySelectorAll('input, textarea').forEach((field) => {
		field.disabled = false;
		if ('readOnly' in field) field.readOnly = false;
		field.removeAttribute('aria-disabled');
		if (field.dataset.placeholder) {
			field.placeholder = field.dataset.placeholder;
		}
		field.dataset.inputDisabledForNow = '1';
	});
}

function renderSuggestions(items) {
	if (!suggestionList) return;
	if (!items.length) {
		suggestionList.innerHTML =
			'<li class="music-suggestions__empty">No suggestions yet. Be the first one.</li>';
		return;
	}

	suggestionList.innerHTML = items
		.map((item) => {
			const title = escapeHtml(item.songTitle || 'Unknown song');
			const artist = escapeHtml(item.artistName || 'Unknown artist');
			const by = escapeHtml(item.viewerName || 'Anonymous');
			const note = escapeHtml(item.note || '');
			const noteMarkup = note ? `<p class="music-suggestions__note">${note}</p>` : '';
			return `
        <li class="music-suggestion">
          <p><strong>${title}</strong> - ${artist}</p>
          <p class="music-suggestions__meta">Suggested by ${by}</p>
          ${noteMarkup}
        </li>
      `;
		})
		.join('');
}

async function loadSuggestions() {
	try {
		const payload = await fetchWithFallback(
			ENDPOINTS.suggestions.map((base) => `${base}?limit=15`),
			{ cache: 'no-store' }
		);
		const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
		renderSuggestions(suggestions);
	} catch (error) {
		renderSuggestions([]);
		setSuggestionStatus(`Could not load suggestions: ${String(error.message || error)}`, true);
	}
}

async function onSuggestionSubmit(event) {
	if (!suggestionForm) return;
	event.preventDefault();

	const formData = new FormData(suggestionForm);
	const payload = {
		songTitle: String(formData.get('songTitle') || '').trim(),
		artistName: String(formData.get('artistName') || '').trim(),
		viewerName: String(formData.get('viewerName') || '').trim(),
		note: String(formData.get('note') || '').trim(),
		website: String(formData.get('website') || '').trim(),
	};

	const submitButton = suggestionForm.querySelector('button[type="submit"]');
	if (submitButton) submitButton.disabled = true;
	setSuggestionStatus('Submitting suggestion...', false);

	try {
		await fetchWithFallback(ENDPOINTS.suggestions, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		suggestionForm.reset();
		setSuggestionStatus('Suggestion sent. Thank you.', false);
		await loadSuggestions();
	} catch (error) {
		setSuggestionStatus(String(error.message || error), true);
	} finally {
		if (submitButton) submitButton.disabled = false;
	}
}

function init() {
	loadNowPlaying();
	setInterval(loadNowPlaying, POLL_MS);

	unlockSuggestionForm();
	loadSuggestions();
	if (suggestionForm) {
		suggestionForm.addEventListener('submit', onSuggestionSubmit);
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
