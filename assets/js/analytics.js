/* assets/js/analytics.js */

const Analytics = (() => {
    const gecko = {
        markets: (vs) => `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs}&order=market_cap_desc&per_page=200&page=1&sparkline=false&price_change_percentage=1h,24h,7d,30d`,
        global: `https://api.coingecko.com/api/v3/global`,
        trending: `https://api.coingecko.com/api/v3/search/trending`,
    };

    const els = {};
    const state = { vs: 'usd', markets: [], global: null, trending: [], filtered: [], binanceTradable: null };
    const fmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
    const pct = (v) => (v === null || v === undefined) ? '—' : `${v.toFixed(2)}%`;
    const cur = (code) => new Intl.NumberFormat(undefined, { style: 'currency', currency: code.toUpperCase(), maximumFractionDigits: 2 });

    const init = () => {
        // Cache DOM elements
        els.fiat = document.getElementById('fiat');
        els.search = document.getElementById('search');
        els.refresh = document.getElementById('refresh');
        els.snapshot = document.getElementById('snapshot');
        els.movers = document.getElementById('movers');
        els.moversNote = document.getElementById('moversNote');
        els.trending = document.getElementById('trending');
        els.trendingNote = document.getElementById('trendingNote');
        els.news = document.getElementById('news');
        els.ideas = document.getElementById('ideas');
        els.favoritesSection = document.getElementById('favoritesSection');
        els.favorites = document.getElementById('favorites');

        // Bind Events
        els.fiat?.addEventListener('change', async (e) => {
            state.vs = e.target.value;
            try { await loadAll(); } catch (err) { alert('Failed to reload: ' + err.message); }
            renderFavorites();
        });

        els.search?.addEventListener('input', (e) => {
            const q = e.target.value.trim().toLowerCase();
            state.filtered = q ? state.markets.filter(x => x.id.includes(q) || x.symbol.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)) : state.markets;
            renderMovers(); renderIdeas(); renderFavorites();
        });

        els.refresh?.addEventListener('click', async () => {
            const btn = els.refresh;
            btn.disabled = true;
            const spinner = btn.querySelector('.animate-spin'); // Assuming Tailwind spinner class
            if (spinner) spinner.classList.remove('hidden');

            try {
                await loadAll();
                renderFavorites();
            } catch (err) {
                console.error(err);
            } finally {
                if (spinner) spinner.classList.add('hidden');
                btn.disabled = false;
            }
        });

        // Initial Load
        initLoad();
    };

    const initLoad = async () => {
        const overlay = document.getElementById('loadingOverlay');
        try {
            await loadAll();
        } catch (err) {
            console.error('Initial load failed', err);
        } finally {
            if (overlay) {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 500);
            }
        }
    };

    const fetchJSON = async (url) => {
        const r = await fetch(url, { headers: { 'accept': 'application/json' } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
    };

    const getBinanceSymbols = async () => {
        if (state.binanceTradable) return state.binanceTradable;
        try {
            const res = await fetch('https://api.binance.com/api/v3/exchangeInfo');
            const data = await res.json();
            state.binanceTradable = new Set(data.symbols.map(s => s.baseAsset.toLowerCase()));
        } catch (e) { state.binanceTradable = new Set(); }
        return state.binanceTradable;
    };

    const loadAll = async () => {
        const vs = state.vs;

        // Skeletons could differ, keeping simple innerHTML clear for now or implementation of specific skeleton UI
        els.movers.innerHTML = '<div class="text-slate-400 text-sm p-4 text-center">Loading movers...</div>';

        const [global, markets, trending] = await Promise.all([
            fetchJSON(gecko.global),
            fetchJSON(gecko.markets(vs)),
            fetchJSON(gecko.trending),
        ]);

        state.global = global.data;
        state.markets = markets;
        state.filtered = markets;
        state.trending = trending.coins?.map(c => c.item) || [];
        await getBinanceSymbols();

        renderSnapshot();
        renderMovers();
        renderTrending();
        renderIdeas();
        renderFavorites();

        if (!els.news.dataset.loaded) { loadNews(); }
    };

    // --- Renderers ---

    const renderSnapshot = () => {
        const g = state.global;
        if (!g) return;
        const c = cur(state.vs);
        const mcap = g.total_market_cap[state.vs] ?? 0;
        const vol = g.total_volume[state.vs] ?? 0;
        const btcDom = g.market_cap_percentage?.btc ?? null;
        const act = g.active_cryptocurrencies;

        const items = [
            { title: 'Total Market Cap', value: c.format(mcap) },
            { title: '24h Volume', value: c.format(vol) },
            { title: 'BTC Dominance', value: btcDom === null ? '—' : `${btcDom.toFixed(1)}%` },
            { title: 'Active Cryptos', value: fmt.format(act) }
        ];

        els.snapshot.innerHTML = items.map(x => `
            <div class="glass-card p-3 sm:p-4 rounded-xl border border-slate-700/50 overflow-hidden">
              <div class="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider font-semibold truncate">${x.title}</div>
              <div class="text-base sm:text-2xl font-bold mt-1 text-white truncate" title="${x.value}">${x.value}</div>
            </div>
        `).join('');

        // Show the snapshot section once data is loaded
        els.snapshot.classList.remove('hidden');
    };

    const renderMovers = () => {
        const c = cur(state.vs);
        const topUp = [...state.filtered].sort((a, b) => (b.price_change_percentage_24h || -1) - (a.price_change_percentage_24h || -1)).slice(0, 5);
        const topDown = [...state.filtered].sort((a, b) => (a.price_change_percentage_24h || 1) - (b.price_change_percentage_24h || 1)).slice(0, 5);

        els.moversNote.textContent = `Top ±24h | ${state.filtered.length} assets`;

        const row = (x) => `
            <div class="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800/50 transition-colors border-b border-dashed border-slate-800 last:border-0">
              <div class="flex items-center gap-3">
                ${favStar(x.id)}
                <img src="${x.image}" alt="" class="w-8 h-8 rounded-full" />
                <div>
                  <div class="font-bold text-sm text-white">${x.name} <span class="text-slate-500 font-normal">(${x.symbol.toUpperCase()})</span></div>
                  <div class="text-xs text-slate-400">Rank #${x.market_cap_rank}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="font-mono font-semibold text-white text-sm">${c.format(x.current_price)}</div>
                <div>${badge(x.price_change_percentage_24h)}</div>
              </div>
            </div>`;

        els.movers.innerHTML = `
            <div class="mb-4">
                <h4 class="text-xs font-semibold text-emerald-400 uppercase mb-2">Gainers</h4>
                ${topUp.map(row).join('')}
            </div>
            <div>
                <h4 class="text-xs font-semibold text-rose-400 uppercase mb-2">Losers</h4>
                ${topDown.map(row).join('')}
            </div>
        `;

        bindFavClicks(els.movers);
    };

    const renderTrending = () => {
        els.trendingNote.textContent = `${state.trending.length} coins`;
        els.trending.innerHTML = state.trending.map((it, idx) => `
            <div class="relative group">
                <div class="absolute top-3 right-3 z-10">${favStar(it.id)}</div>
                <a target="_blank" href="https://www.coingecko.com/en/coins/${it.id}" class="block glass-card p-4 rounded-xl hover:bg-slate-800 transition border border-slate-700/50 hover:border-indigo-500/50">
                    <div class="flex items-center gap-3 mb-3">
                        <img src="${it.small}" alt="" class="w-10 h-10 rounded-full shadow-lg" />
                        <div>
                            <div class="font-bold text-white">${it.name}</div>
                            <div class="text-xs text-slate-400">${it.symbol.toUpperCase()}</div>
                        </div>
                    </div>
                    <div class="flex justify-between items-center text-xs">
                         <span class="bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded">Rank #${it.market_cap_rank ?? '?'}</span>
                         <span class="text-slate-500">Trending #${idx + 1}</span>
                    </div>
                </a>
            </div>`).join('');

        bindFavClicks(els.trending);
    };

    const renderIdeas = () => {
        const m = state.filtered;
        const binanceSet = state.binanceTradable || new Set();
        const onBinance = x => binanceSet.has((x.symbol || '').toLowerCase());
        const pos = v => v !== null && v !== undefined && v > 0;
        const neg = v => v !== null && v !== undefined && v < 0;

        const momentum = m.filter(x => onBinance(x) && pos(x.price_change_percentage_1h_in_currency) && (x.price_change_percentage_24h ?? 0) >= 5 && (x.price_change_percentage_7d_in_currency ?? x.price_change_percentage_7d ?? 0) >= 10).slice(0, 8);
        const dip = m.filter(x => onBinance(x) && (x.price_change_percentage_24h ?? 0) <= -7 && (x.price_change_percentage_7d_in_currency ?? x.price_change_percentage_7d ?? 0) < 0).slice(0, 8);
        const reversal = m.filter(x => onBinance(x) && neg(x.price_change_percentage_24h) && (x.price_change_percentage_1h_in_currency ?? 0) >= 1 && (x.price_change_percentage_7d_in_currency ?? x.price_change_percentage_7d ?? 0) > -3).slice(0, 8);

        els.ideas.innerHTML = `
            ${ideaCard('Momentum Longs', momentum, 'bg-emerald-500/10 border-emerald-500/20', 'text-emerald-400', 'Long')}
            ${ideaCard('Dip Shorts', dip, 'bg-rose-500/10 border-rose-500/20', 'text-rose-400', 'Short')}
            ${ideaCard('Reversal Watch', reversal, 'bg-indigo-500/10 border-indigo-500/20', 'text-indigo-400', 'Wait')}
        `;
    };

    // --- Helpers ---

    const badge = (val) => {
        const good = val >= 0;
        const cls = good ? 'text-emerald-400' : 'text-rose-400';
        return `<span class="font-bold text-sm ${cls}">${pct(val)}</span>`;
    };

    const ideaCard = (title, coins, cardClass, textClass, actionType) => {
        if (coins.length === 0) {
            return `
                <div class="glass-card p-6 rounded-xl flex flex-col items-center justify-center text-center opacity-70">
                    <div class="text-lg font-bold text-white mb-2">${title}</div>
                    <div class="text-sm text-slate-500">No signals found matching criteria.</div>
                </div>
             `;
        }

        return `
            <div class="glass-card p-5 rounded-xl ${cardClass}">
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full ${textClass.replace('text-', 'bg-')}"></span>
                    ${title}
                </h3>
                <div class="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    ${coins.map(x => generateSignalRow(x, actionType)).join('')}
                </div>
            </div>
        `;
    };

    const generateSignalRow = (x, action) => {
        const c = cur(state.vs);
        const change1h = x.price_change_percentage_1h_in_currency ?? 0;
        const change24h = x.price_change_percentage_24h ?? 0;

        let takeProfit, stopLoss, rrRatio;
        if (action === "Short") {
            takeProfit = x.current_price * 0.90; stopLoss = x.current_price * 1.05;
            rrRatio = ((x.current_price - takeProfit) / (stopLoss - x.current_price)).toFixed(2);
        } else if (action === "Long") {
            takeProfit = x.current_price * 1.10; stopLoss = x.current_price * 0.95;
            rrRatio = ((takeProfit - x.current_price) / (x.current_price - stopLoss)).toFixed(2);
        } else {
            takeProfit = stopLoss = 0; rrRatio = '—';
        }

        return `
            <div class="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <img src="${x.image}" class="w-5 h-5 rounded-full">
                        <span class="font-bold text-sm text-white">${x.symbol.toUpperCase()}</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div class="text-slate-400">Px: <span class="text-slate-200">${c.format(x.current_price)}</span></div>
                    <div class="text-slate-400">R/R: <span class="text-indigo-300 font-bold">${rrRatio}</span></div>
                    <div class="text-slate-400">TP: <span class="text-emerald-400">${action !== 'Wait' ? c.format(takeProfit) : '—'}</span></div>
                    <div class="text-slate-400">SL: <span class="text-rose-400">${action !== 'Wait' ? c.format(stopLoss) : '—'}</span></div>
                </div>
                <div class="flex gap-2 text-[10px] text-slate-500 border-t border-slate-800 pt-2 mt-1">
                   <span>1h: ${change1h.toFixed(1)}%</span>
                   <span>24h: ${change24h.toFixed(1)}%</span>
                </div>
            </div>
        `;
    };

    // --- Favorites Logic ---
    const getFavorites = () => { try { return JSON.parse(localStorage.getItem('fx_favorites') || '[]') } catch { return [] } };
    const setFavorites = (arr) => localStorage.setItem('fx_favorites', JSON.stringify(arr));
    const isFavorite = (id) => getFavorites().includes(id);
    const toggleFavorite = (id) => {
        let favs = getFavorites();
        favs = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
        setFavorites(favs);
        renderFavorites();
        renderMovers(); // Re-render to update stars
        renderTrending(); // Re-render to update stars
    };

    const renderFavorites = () => {
        const favs = getFavorites();
        const favCoins = state.markets.filter(x => favs.includes(x.id));

        if (!favCoins.length) {
            els.favoritesSection.style.display = 'none';
            return;
        }

        els.favoritesSection.style.display = 'block';
        els.favorites.innerHTML = favCoins.map(x => `
            <div class="glass-card p-3 rounded-lg flex items-center justify-between group">
                 <div class="flex items-center gap-3">
                     <img src="${x.image}" class="w-8 h-8 rounded-full">
                     <div class="text-sm font-bold text-white">${x.symbol.toUpperCase()}</div>
                 </div>
                 <button class="fav-star text-yellow-400 hover:text-yellow-300" data-id="${x.id}">
                    ★
                 </button>
            </div>
        `).join('');

        bindFavClicks(els.favorites);
    };

    const favStar = (id) => `<button class="fav-star transition-colors ${isFavorite(id) ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}" data-id="${id}" title="Toggle Favorite">★</button>`;

    const bindFavClicks = (container) => {
        container.querySelectorAll('.fav-star').forEach(el => {
            el.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent card click
                toggleFavorite(el.dataset.id);
            };
        });
    };

    // --- News ---
    const loadNews = async () => {
        els.news.dataset.loaded = '1';
        els.news.innerHTML = '<div class="text-center p-4 text-xs text-slate-500">Loading headlines...</div>';

        const urls = [
            'https://rss2json.com/api.json?rss_url=https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml',
            'https://rss2json.com/api.json?rss_url=https://cointelegraph.com/rss'
        ];

        let items = [];
        for (const u of urls) {
            try {
                const j = await fetchJSON(u);
                const arr = j.items || j;
                items.push(...arr.map(it => ({
                    title: it.title,
                    link: it.link || it.guid,
                    pubDate: new Date(it.pubDate || it.published || it.date),
                    source: it.author || j.feed?.title || 'News'
                })));
            } catch (_) { }
        }

        // Dedup and sort
        const seen = new Set();
        items = items.filter(i => !seen.has(i.title) && seen.add(i.title)).sort((a, b) => b.pubDate - a.pubDate);

        els.news.innerHTML = items.slice(0, 10).map(n => `
            <a href="${n.link}" target="_blank" class="block group relative pl-4 border-l-2 border-slate-800 hover:border-indigo-500 transition-colors py-1">
                <div class="text-sm text-slate-300 group-hover:text-white transition-colors line-clamp-2">${n.title}</div>
                <div class="text-[10px] text-slate-500 mt-1 flex justify-between">
                    <span>${n.source}</span>
                    <span>${n.pubDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </a>
        `).join('') || '<div class="text-xs text-slate-500">No news available.</div>';
    };

    return { init };
})();

document.addEventListener('DOMContentLoaded', Analytics.init);
