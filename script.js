// ===== настройки — меняй под себя =====
const CONFIG = {
    discordId: '000000000000000000', // твой Discord ID (и вступи на сервер Lanyard: discord.gg/lanyard)
    utcOffset: 3,                    // твой часовой пояс, часы от UTC
    sleepFrom: 1,                    // с какого часа ты обычно спишь
    sleepTo: 9,                      // до какого
    hexText: 'nickname // your status.', // строка для hexdump (до 32 символов)
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===== тема =====
const themeBtn = $('[data-theme-toggle]');
const themeLabel = $('[data-theme-label]');
const syncTheme = () => {
    const light = document.body.classList.contains('light');
    themeLabel.textContent = light ? 'dark' : 'light';
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    $('meta[name="theme-color"]').content = light ? '#e7e4ef' : '#08080b';
};
syncTheme();
themeBtn.addEventListener('click', () => {
    const flip = () => {
        const light = document.body.classList.toggle('light');
        try {
            localStorage.setItem('site-theme', light ? 'light' : 'dark');
        } catch (e) {
        }
        syncTheme();
    };
    if (!document.startViewTransition || reduced) return flip();
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(flip).ready.then(() => {
        document.documentElement.animate(
            {clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`]},
            {duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)'}
        );
    });
});

// ===== блик за курсором + параллакс баннера =====
if (matchMedia('(hover: hover)').matches) {
    $$('.glass, .fill, .chip').forEach(el => {
        el.addEventListener('pointermove', e => {
            const r = el.getBoundingClientRect();
            el.style.setProperty('--mx', `${e.clientX - r.left}px`);
            el.style.setProperty('--my', `${e.clientY - r.top}px`);
            el.style.setProperty('--lit-o', 1);
        });
        el.addEventListener('pointerleave', () => el.style.setProperty('--lit-o', 0));
    });
    const banner = $('.banner');
    addEventListener('pointermove', e => {
        banner.style.setProperty('--nx', (e.clientX / innerWidth - .5) * 2);
        banner.style.setProperty('--ny', (e.clientY / innerHeight - .5) * 2);
    });
}

// ===== блик по баннеру время от времени =====
const glint = $('.glint');
const sweep = () => {
    glint.classList.remove('run');
    glint.style.transform = 'translateX(-100%)';
    void glint.offsetWidth;
    glint.classList.add('run');
    glint.style.transform = '';
    setTimeout(sweep, 7000 + Math.random() * 6000);
};
if (!reduced) setTimeout(sweep, 1800);

// ===== кольцо-сигнал вокруг аватарки =====
const signal = $('[data-signal]');
signal.innerHTML = Array.from({length: 36}, (_, i) => {
    const len = 4.6 + Math.sin(i * .9) * 1.4 + Math.cos(i * .37) * .8;
    return `<g transform="rotate(${i * 10} 40 40)"><line x1="40" y1="10.5" x2="40" y2="${(10.5 - len).toFixed(1)}" style="animation-delay:${(-i * .13).toFixed(2)}s"/></g>`;
}).join('');

// ===== Discord через Lanyard =====
const STATUS_TEXT = {
    online: 'в сети',
    idle: 'отошёл',
    dnd: 'не беспокоить',
    offline: 'не в сети',
    streaming: 'стримит'
};
const presence = $('[data-presence]');
const statusWrap = $('[data-status-wrap]');
const statusText = $('[data-status-text]');
const statusDot = $('[data-status-dot]');
let richTimer = null;

const fmt = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
    return (h ? `${h}:${String(m).padStart(2, '0')}` : m) + ':' + String(sec).padStart(2, '0');
};

const assetUrl = (appId, key) => {
    if (!key) return '';
    if (key.startsWith('mp:external/')) return `https://media.discordapp.net/external/${key.slice(12)}`;
    if (key.startsWith('spotify:')) return `https://i.scdn.co/image/${key.slice(8)}`;
    return `https://cdn.discordapp.com/app-assets/${appId}/${key}.png`;
};

function renderPresence(d) {
    const streaming = d.activities.some(a => a.type === 1);
    const state = streaming ? 'streaming' : d.discord_status;
    const u = d.discord_user;

    presence.hidden = false;
    presence.dataset.state = state;
    statusWrap.dataset.state = state === 'streaming' ? 'online' : state;
    statusDot.dataset.state = state === 'streaming' ? 'online' : state;
    statusText.textContent = `Discord: ${STATUS_TEXT[state]}`;

    $('[data-p-name]').textContent = u.global_name || u.username;
    if (u.avatar) $('[data-p-avatar]').src = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`;

    const custom = d.activities.find(a => a.type === 4);
    const act = d.activities.find(a => a.type !== 4);
    const devices = ['desktop', 'mobile', 'web'].filter(k => d[`active_on_discord_${k}`]);

    $('[data-p-activity]').textContent = custom?.state
        || (state === 'offline' ? 'Сейчас не в сети' : `В сети${devices.length ? ' · ' + devices.join(', ') : ''}`);
    $('[data-p-detail]').textContent = custom?.state && state !== 'offline' ? STATUS_TEXT[state] : '';

    const rich = $('[data-rich]');
    clearInterval(richTimer);
    if (!act) {
        rich.hidden = true;
        return;
    }
    rich.hidden = false;

    const art = $('[data-rich-art]');
    const bar = $('[data-rich-bar]');
    const time = $('[data-rich-time]');
    const isSpotify = d.listening_to_spotify && d.spotify;

    if (isSpotify) {
        $('[data-rich-title]').textContent = d.spotify.song;
        $('[data-rich-sub]').textContent = d.spotify.artist.replace(/;/g, ',');
        art.src = d.spotify.album_art_url;
        art.hidden = false;
    } else {
        const verb = ['Играет в', 'Стримит', 'Слушает', 'Смотрит', '', 'Соревнуется в'][act.type] || '';
        $('[data-rich-title]').textContent = `${verb} ${act.name}`.trim();
        $('[data-rich-sub]').textContent = [act.details, act.state].filter(Boolean).join(' · ');
        const src = assetUrl(act.application_id, act.assets?.large_image);
        art.hidden = !src;
        if (src) art.src = src;
    }

    const ts = isSpotify ? d.spotify.timestamps : act.timestamps;
    const tick = () => {
        const now = Date.now();
        if (ts?.start && ts?.end) {
            bar.hidden = false;
            bar.firstElementChild.style.width = `${Math.min(100, (now - ts.start) / (ts.end - ts.start) * 100)}%`;
            time.textContent = `${fmt(now - ts.start)} / ${fmt(ts.end - ts.start)}`;
        } else if (ts?.start) {
            bar.hidden = true;
            time.textContent = fmt(now - ts.start);
        } else {
            bar.hidden = true;
            time.textContent = '';
        }
    };
    tick();
    richTimer = setInterval(tick, 1000);
}

async function loadPresence() {
    try {
        const res = await fetch(`https://api.lanyard.rest/v1/users/${CONFIG.discordId}`, {cache: 'no-store'});
        const json = await res.json();
        if (!json.success) throw new Error(json.error?.message || 'Lanyard ответил ошибкой');
        renderPresence(json.data);
    } catch (err) {
        console.warn('Не удалось получить статус Discord:', err.message);
        statusWrap.dataset.state = 'offline';
        statusText.textContent = 'Discord недоступен';
    }
}

loadPresence();
setInterval(loadPresence, 30000);

// ===== просмотры (локальный счётчик; для настоящего нужен бэкенд) =====
(() => {
    const out = $('[data-views]');
    try {
        let n = +localStorage.getItem('site-views') || 0;
        if (!sessionStorage.getItem('site-counted')) {
            n++;
            sessionStorage.setItem('site-counted', '1');
            localStorage.setItem('site-views', n);
        }
        out.textContent = n.toLocaleString('ru-RU');
    } catch (e) {
        out.textContent = '—';
    }
})();

// ===== плеер =====
const player = $('[data-player]');
const audio = $('audio', player);
const playBtn = $('[data-play]');
const stateEl = $('[data-player-state]');
const elapsed = $('[data-elapsed]');
const remaining = $('[data-remaining]');
const scrub = $('[data-scrub]');
const vol = $('[data-volume]');
const muteBtn = $('[data-mute]');
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const setPlaying = on => {
    player.classList.toggle('playing', on);
    document.body.classList.toggle('is-playing', on);
    playBtn.setAttribute('aria-label', on ? 'Пауза' : 'Играть');
    stateEl.textContent = on ? 'играет' : 'на паузе';
};

playBtn.addEventListener('click', async () => {
    if (audio.paused) {
        try {
            await audio.play();
        } catch (e) {
            stateEl.textContent = 'не удалось включить трек';
            console.error('Ошибка воспроизведения:', e);
        }
    } else audio.pause();
});
audio.addEventListener('play', () => {
    setPlaying(true);
    muteBtn.hidden = vol.hidden = false;
});
audio.addEventListener('pause', () => setPlaying(false));
audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 0;
    elapsed.textContent = mmss(audio.currentTime);
    remaining.textContent = '-' + mmss(Math.max(0, d - audio.currentTime));
    if (!scrub.classList.contains('drag')) $('.fill-bar', scrub).style.width = d ? `${audio.currentTime / d * 100}%` : '0';
});

function bindSlider(el, onChange) {
    const set = e => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        $('.fill-bar', el).style.width = `${p * 100}%`;
        onChange(p);
    };
    el.addEventListener('pointerdown', e => {
        el.setPointerCapture(e.pointerId);
        el.classList.add('drag');
        set(e);
    });
    el.addEventListener('pointermove', e => {
        if (el.classList.contains('drag')) set(e);
    });
    el.addEventListener('pointerup', () => el.classList.remove('drag'));
    el.addEventListener('pointercancel', () => el.classList.remove('drag'));
}

bindSlider(scrub, p => {
    if (audio.duration) audio.currentTime = p * audio.duration;
});
bindSlider(vol, p => {
    audio.volume = p;
    audio.muted = p === 0;
    muteBtn.classList.toggle('muted', audio.muted);
});
$('.fill-bar', vol).style.width = '100%';

scrub.addEventListener('keydown', e => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
});
muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    muteBtn.classList.toggle('muted', audio.muted);
    $('.fill-bar', vol).style.width = audio.muted ? '0' : `${audio.volume * 100}%`;
});
document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !/input|textarea|button/i.test(e.target.tagName)) {
        e.preventDefault();
        playBtn.click();
    }
});

// ===== hexdump =====
(() => {
    const box = $('[data-hexdump]');
    const bytes = [...new TextEncoder().encode(CONFIG.hexText)].slice(0, 32);
    while (bytes.length < 32) bytes.push(0);
    let html = `<div class="hex-head"><span>static.bin</span><span>32 bytes</span></div>`;
    for (let row = 0; row < 4; row++) {
        let hex = '', asc = '';
        for (let c = 0; c < 8; c++) {
            const i = row * 8 + c, b = bytes[i];
            const printable = b >= 32 && b < 127;
            hex += `<span data-i="${i}">${b.toString(16).padStart(2, '0')}</span>`;
            asc += `<span data-i="${i}"${printable ? '' : ' class="dim"'}>${b === 32 ? '&nbsp;' : printable ? String.fromCharCode(b).replace('<', '&lt;') : '.'}</span>`;
        }
        html += `<div class="hex-row"><span class="hex-off">${(row * 8).toString(16).padStart(8, '0')}</span><span class="hex-bytes">${hex}</span><span class="hex-ascii">${asc}</span></div>`;
    }
    box.innerHTML = html;

    // подсветка пары hex/ascii при наведении
    box.addEventListener('pointerover', e => {
        const i = e.target.dataset?.i;
        $$('.hot', box).forEach(x => x.classList.remove('hot'));
        if (i != null) $$(`[data-i="${i}"]`, box).forEach(x => x.classList.add('hot'));
    });
    box.addEventListener('pointerleave', () => $$('.hot', box).forEach(x => x.classList.remove('hot')));

    // один проход «сканера», когда блок попадает в экран
    if (reduced) return;
    new IntersectionObserver(([en], obs) => {
        if (!en.isIntersecting) return;
        obs.disconnect();
        let i = 0;
        const step = () => {
            $$('.hot', box).forEach(x => x.classList.remove('hot'));
            if (i >= 32) return;
            $$(`[data-i="${i}"]`, box).forEach(x => x.classList.add('hot'));
            $('[data-hex-addr]').textContent = (i * 0x6a3 + 0xd4c00).toString(16).padStart(8, '0');
            i++;
            setTimeout(step, 45);
        };
        step();
    }, {threshold: .6}).observe(box);
})();

// ===== местное время и «спит / не спит» =====
(() => {
    const clock = $('[data-clock]');
    const sleep = $('[data-sleep]');
    const label = $('[data-sleep-label]');
    const off = CONFIG.utcOffset;
    $('[data-tz-label]').textContent = `UTC${off >= 0 ? '+' : ''}${off}`;
    const tick = () => {
        const t = new Date(Date.now() + off * 3600e3);
        const h = t.getUTCHours(), m = t.getUTCMinutes();
        clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const {sleepFrom: a, sleepTo: b} = CONFIG;
        const asleep = a < b ? h >= a && h < b : h >= a || h < b;
        sleep.dataset.state = asleep ? 'asleep' : 'awake';
        label.textContent = asleep ? 'скорее всего спит' : 'не спит';
    };
    tick();
    setInterval(tick, 10000);
})();
