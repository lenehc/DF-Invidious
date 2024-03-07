(async function() {
    let storageData = {
        filterData: {},
        options: {}
    }

    let pathRegExpToFunc = {
        '': [processNavbar],
        '^search': [processSearchPage],
        '^channel': [processChannelPage],
        '^watch': [processVideoPage],
        '^playlist': [processPlaylistPage]
    }

    let pathToLinkName = {
        'shorts': 'Shorts',
        'community': 'Community',
        'streams': 'Livestreams',
        'playlists': 'Playlists',
        'releases': 'Releases'
    }

    document.body.setAttribute('class', 'light-theme');

    await loadData();
    addCss('df_invidious.css');

    let pagePathStr = window.location.pathname.replace(/^\//, '');
    let pagePathItems = pagePathStr.split('/');

    for (const [pathRegExp, funcs] of Object.entries(pathRegExpToFunc)) {
        if (new RegExp(pathRegExp).test(pagePathStr)) {
            funcs.forEach((func) => func());
        }
    }

    async function loadData() {
        let data = await browser.storage.local.get();
        if (Object.keys(data).length > 0) {
            storageData = data;
        }
    }

    function saveData() {
        return browser.storage.local.set(storageData);
    }

    function get(path, def = undefined, obj = undefined) {
        const paths = (path instanceof Array) ? path : path.split('.');
        let nextObj = obj || storageData;

        const exist = paths.every((v) => {
            if (!nextObj || !nextObj.hasOwnProperty(v)) return false;
            nextObj = nextObj[v];
            return true;
        });

        return exist ? nextObj : def;
    }

    function addCss(file) {
        if (!document.querySelector(`link[href="${chrome.extension.getURL(file)}"]`)) {
            link = document.createElement('link');
		    link.rel = 'stylesheet';
            link.type = 'text/css'
            link.media = 'screen,print';
		    link.href = chrome.extension.getURL('css/' + file);
		    document.head.appendChild(link);
        }
    }

    function formatCount(count) {
        let numericValue = parseFloat(count.replace(/,/g, ''));
        let suffixes = ["", "K", "M", "B"];
        let suffixIndex = Math.floor(Math.log10(Math.abs(numericValue)) / 3);
        let formattedValue = (numericValue / Math.pow(10, suffixIndex * 3)).toFixed(1);
    
        return formattedValue.replace(/\.0$/, '') + suffixes[suffixIndex];
    }

    function shorten(text, size) {
        return text.length > size ? text.slice(0, size).trim() + '…' : text;
    }

    function hide(selector, parent = undefined) {
        elem = parent ? parent.querySelector(selector) : document.querySelector(selector);
        if (elem) {
            elem.style.display = 'none';
        }
    }

    function hidePageContents() {
        Array.from(document.getElementById('contents').children).forEach((elem) => {
            if (!elem.classList.contains('navbar')) {
                elem.style.display = 'none';
            }
        });
    }

    function showMessage(message) {
        hidePageContents();
        let elem = document.getElementById('page-message');
        elem = elem ? elem : document.createElement('span');
        elem.setAttribute('id', 'page-message');
        elem.style.display = 'block';
        elem.textContent = message;
        document.getElementById('contents').appendChild(elem);
    }

    function validateFilters(text, filterName) {
        filters = get(['filterData', filterName], []);
        for (const f of filters) {
            try {
                if (f && new RegExp(f).test(text)) {
                    return true;
                }
            } catch {
            }
        }
        return false;
    }

    function isBlockedChannel(channelName, channelId) {
        return validateFilters(channelName, 'channelName') || validateFilters(channelId, 'channelId');
    }

    function isBlockedVideo(videoTitle) {
        return validateFilters(videoTitle, 'videoTitle');
    }

    function pageIsBlocked(name) {
        showMessage(`"${shorten(name, 50)}" is blocked`);
    }

    function createBlockButton(elem, channelName) {
        let blockButton = document.createElement('button');
        blockButton.setAttribute('class', 'block-channel-button');
        blockButton.textContent = '[x]';
        blockButton.style.display = 'none';
        blockButton.title = 'Block channel';
        blockButton.addEventListener('click', async () => {
            await loadData();
            storageData.filterData.channelName.push(channelName);
            await saveData();
            if (pagePathItems[0] === 'watch') {
                processVideoPage();
                return
            }
            else if (pagePathItems[0] === 'channel') {
                processChannelPage();
                return
            }
            filterCards(extractCards());
        })

        elem.appendChild(blockButton);
        elem.addEventListener('mouseover', () => {
            blockButton.style.display = 'inline-block';
        });
        elem.addEventListener('mouseout', () => {
            blockButton.style.display = 'none';
        });
    }

    function extractCards() {
        cards = document.querySelectorAll('.pure-u-1.pure-u-md-1-4');
        cardObjs = [];
        cards.forEach((card) => {
            if (card.querySelector('.thumbnail')) {
                let title = card.querySelector('.video-card-row').textContent.trim();
                let {channelName, channelId} = extractChannelInfo(card);

                cardObjs.push({
                    type: 'video',
                    title: title,
                    channelName: channelName,
                    channelId: channelId,
                    cardElem: card
                });
            }
            else {
                let {channelName, channelId} = extractChannelInfo(card);

                cardObjs.push({
                    type: 'channel',
                    channelName: channelName,
                    channelId: channelId,
                    cardElem: card
                });
            }
        });
        return cardObjs;
    }

    function extractChannelInfo(card) {
        let channelName = card.querySelector('a .channel-name')
        let channelId = card.querySelector('a[href^="/channel/"]');

        channelName = channelName ? channelName.textContent.trim() : '';
        channelId = channelId ? channelId.href.split('/channel/')[1] : '';

        return {channelName, channelId};
    }

    function filterCards(cardObjs) {
        filteredItemsCount = 0;
        cardObjs.forEach((cardObj) => {
            if (isBlockedChannel(cardObj.channelName, cardObj.channelId) || (cardObj.type === 'video' && isBlockedVideo(cardObj.title))) {
                cardObj.cardElem.style.display = 'none';
                filteredItemsCount++;
            }
        });
        return filteredItemsCount;
    }

    function processCards(isChannelPage = false) {
        cardObjs = extractCards();

        if (cardObjs.length == 0) return;

        filteredItemsCount = filterCards(cardObjs);

        if (filteredItemsCount === cards.length) {
            showMessage('No results');
            return
        }

        cardObjs.forEach((cardObj) => {
            if (cardObj.type === 'video') {
                processVideoCard(cardObj.cardElem, isChannelPage);
            }
            else if (cardObj.type === 'channel') {
                processChannelCard(cardObj.cardElem);
            }
        });
    }

    function processChannelCard(card) {
        hide('h5', card);

        let hBox = card.querySelector('.h-box');
        let [_, channel, username, subscribers] = hBox.children;
        let [subCount, subString] = subscribers.innerHTML.split(' ');

        let {channelName} = extractChannelInfo(card);

        let channelNameElem = channel.querySelector('.flex-left');
        channelNameElem.classList.add('channel-card-name');

        createBlockButton(channelNameElem, channelName);

        if (subCount.includes(',')) {
            subscribers.innerHTML = formatCount(subCount) + ' ' + subString;
        };

        username.classList.add('channel-handle');
        subscribers.classList.add('channel-subscribers');
        return true;
    }

    function processVideoCard(card, isChannelPage = false) {
        let [title, channel] = card.querySelectorAll('.video-card-row');
        let published = card.querySelector('.video-data');
        let length = card.querySelector('.length');

        let {channelName, _} = extractChannelInfo(card);

        createBlockButton(channel.querySelector('.flex-left'), channelName);

        title.classList.add('video-title');
        channel.classList.add('video-channel');

        if (published && published.textContent.split(' ').length !== 3) published.textContent = published.textContent.replace(/^\w+\s+/, '');
        if (length) length.textContent = length.textContent.trim();
        if (isChannelPage) channel.style.display = 'none';
    }

    function processComments() {
        // TODO
    }

    function processNavbar() {
        let toggleTheme = document.getElementById('toggle_theme');
        let loginButton = document.querySelector('.navbar .user-field .pure-menu-heading:not(#toggle_theme):not([title=Preferences])');

        toggleTheme.parentElement.style.display = 'none';
        loginButton.style.textTransform = 'none';

        if (get('options.hideLoginButton', false)) {
            loginButton.parentElement.style.display = 'none';
        };
    }

    function processPageNav() {
        hide('.page-nav-container');

        document.querySelectorAll('.page-nav-container').forEach((pageNav) => {
            pageNav.querySelectorAll('.pure-button.pure-button-secondary').forEach((button) => {
                button.textContent = button.textContent.trim();
            });
        });
    }

    function processSubButton(button) {
        if (button.querySelector('b')) {
            let subCount = button.querySelector('b').textContent.split(' | ')[1];
            let subStrPlur = subCount === '1' ? '' : 's';
            button.innerHTML = `${subCount} subscriber${subStrPlur}`;
        }
    }

    function processSearchPage() {
        processPageNav();
        processCards();
        if (get('options.hideSearchFilters', false)) hide('#filters');
    }

    function processPlaylistPage() {
        hide('.title .button-container');
        processPageNav();
        processCards();

        let title = document.querySelector('.title');
        let playlistInfo = title.nextElementSibling;

        title.classList.add('playlist-title');

        if (playlistInfo) {
            let playlistTitle = title.querySelector('h3');
            let channelLink = playlistInfo.querySelector('a');
            let rawInfo = playlistInfo.querySelector('b').textContent;

            let [_, videoCount, updated] = rawInfo.split('|').map((e) => e.trim());

            channelLink.textContent = channelLink.textContent.replace(/^by\s+/, '');
            playlistTitle.innerHTML = `"${playlistTitle.textContent}" by `;

            let sep = document.createElement('span');
            sep.classList.add('sep');

            playlistTitle.append(
                channelLink,
                sep,
                document.createTextNode(videoCount),
                sep.cloneNode(),
                document.createTextNode(updated),
            )
            playlistInfo.remove();
        }
    }

    function processChannelPage() {
        let currentPage = pagePathItems.length >= 3 ? pagePathItems[2] : '';
        let hiddenLinks = get('options.blockedChannelLinks', []);
        let linkName = pathToLinkName[currentPage];

        if (hiddenLinks.includes(linkName)) {
            pageIsBlocked(linkName);
            return
        }

        let channelName = document.querySelector('.channel-profile span').textContent;
        let channelId = pagePathItems[1];

        if (isBlockedChannel(channelName, channelId)) {
            pageIsBlocked(channelName);
            return 
        } 

        processPageNav();
        processCards(true);
        createBlockButton(document.querySelector('.channel-profile'), channelName);

        let banner = document.querySelector('.h-box > img');
        banner = banner ? banner.parentElement : banner;
        let title = document.querySelector('.title');
        let bio = document.getElementById('descriptionWrapper').parentElement;
        let links = bio.nextElementSibling;


        if (banner) banner.classList.add('channel-banner');
        title.classList.add('channel-title');
        bio.classList.add('channel-bio');
        links.classList.add('channel-links');

        let [subscribe, rss] = title.querySelectorAll('.pure-u');

        rss.style.display = 'none';

        processSubButton(subscribe);

        Array.from(links.firstElementChild.children).forEach((link) => {
            if (hiddenLinks.includes(link.firstElementChild.textContent)) {
                link.style.display = 'none';
            }
        })
    }

    function processVideoPage() {
        if (Array.from(document.querySelectorAll('.h-box:not(.navbar)')).length == 1) {
            showMessage('Video unavailable');
            return
        }

        let title = document.querySelector('.h-box > h1').parentElement;
        let channelTitle = document.querySelector('.title');

        let videoTitle = title.querySelector('h1').textContent.trim();
        let channelNameElem = channelTitle.querySelector('#channel-name')
        let channelName = channelNameElem.textContent.trim();
        let channelId = channelTitle.querySelector('.flex-left').querySelector('a').href.split('/channel/')[1];

        if (isBlockedVideo(videoTitle) || isBlockedChannel(channelName, channelId)) {
            pageIsBlocked(videoTitle);
            return 
        } 

        hide('.pure-u-lg-1-5');
        processSubButton(channelTitle.querySelector('.pure-u'));
        processComments();
        createBlockButton(channelNameElem, channelName);
        
        title.classList.add('player-title');
        channelTitle.classList.add('channel-title');
        title.nextElementSibling.style.justifyContent = 'space-between';
        
        let viewCount = document.querySelector('#views').childNodes[1].nodeValue;
        let viewStrPlur = viewCount === '1' ? '' : 's';
        let pubDate = document.querySelector('#published-date').querySelector('b').textContent.replace(/^\w+\s+/, '');

        if (!document.querySelector('.video-info')) {
            let info = document.createElement('div');
            info.classList.add('video-info');

            let views = document.createElement('span');
            let published = document.createElement('span');

            views.classList.add('video-views');
            published.classList.add('video-published');

            [views, published].forEach((x) => info.appendChild(x));

            views.textContent = `${viewCount} view${viewStrPlur}`;
            published.textContent = pubDate;

            let meta = document.querySelector('.pure-u-md-4-5');
            meta = meta ? meta : document.querySelector('.pure-u-lg-3-5');
        
            let infoBox = meta.children[1];

            infoBox.insertBefore(info, infoBox.firstChild);
        }

    }
})();