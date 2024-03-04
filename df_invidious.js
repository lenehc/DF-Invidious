async function dfInvidious() {
    let storage = await browser.storage.local.get();

    let pathRegExpToFuncs = {
        'search': [processSearchPage],
        'channel': [processChannelPage],
        'watch': [processVideoPage]
    }

    document.body.setAttribute('class', 'light-theme');

    addCss('df_invidious.css');

    for (const [pathRegExp, funcs] of Object.entries(pathRegExpToFuncs)) {
        if (new RegExp(pathRegExp).test(window.location.pathname)) {
            funcs.forEach(func => func());
        }
    }

    function addCss(file) {
        if (!document.querySelector(`link[href="${chrome.extension.getURL(file)}"]`)) {
            link = document.createElement('link');
		    link.rel = 'stylesheet';
            link.type = 'text/css'
            link.media = 'screen,print';
		    link.href = chrome.extension.getURL(file);
		    document.head.appendChild(link);
        }
    }

    function formatCount(count) {
        let numericValue = parseFloat(count.replace(/,/g, ''));
        let suffixes = ["", "K", "M", "B"];
        let suffixIndex = Math.floor(Math.log10(Math.abs(numericValue)) / 3);
        let formattedValue = (numericValue / Math.pow(10, suffixIndex * 3)).toFixed(1);
    
        return formattedValue.replace(/\.0$/, '') + suffixes[suffixIndex]
    }

    function hide(selector, parent) {
        elem = parent ? parent.querySelector(selector) : document.querySelector(selector);
        if (elem) {
            elem.style.display = 'none';
        }
    }

    function processPageNav() {
        hide('.page-nav-container');

        document.querySelectorAll('.page-nav-container').forEach(pageNav => {
            pageNav.querySelectorAll('.pure-button.pure-button-secondary').forEach(button => {
                button.textContent = button.textContent.trim()
            })
        })
    }

    function processSubButton(button) {
        if (button.querySelector('b')) {
            let subCount = button.querySelector('b').textContent.split(' | ')[1];
            let subStrPlur = subCount === '1' ? '' : 's';
            button.innerHTML = `${subCount} subscriber${subStrPlur}`;
        }
    }

    function deletePageContents() {
        Array.from(document.getElementById('contents').children).forEach(elem => {
            if (!elem.classList.contains('navbar')) {
                elem.remove()
            }
        });
    }

    function shorten(text, size) {
        return text.length > size ? text.slice(0, size).trim() + '…' : text;
    }

    function showMessage(message) {
        deletePageContents();
        let elem = document.getElementById('page-message');
        elem = elem ? elem : document.createElement('span');
        elem.setAttribute('id', 'page-message');
        elem.textContent = message;
        document.getElementById('contents').appendChild(elem);
    }

    function pageIsBlocked(name) {
        showMessage(`"${shorten(name, 50)}" is blocked`);
    }

    async function addFilter(filterName, filter) {
        let res = await browser.storage.local.get();
        if (!res.filters[filterName].includes(filter)) {
            res.filters[filterName].push(filter);
        }
        browser.storage.local.set(res);
    }

    function createBlockButton(elem, card, channelName) {
        let blockButton = document.createElement('button');
        blockButton.setAttribute('class', 'block-channel-button');
        blockButton.textContent = '[x]';
        blockButton.style.display = 'none';
        blockButton.title = 'Block channel';
        blockButton.addEventListener('click', async () => {
            await addFilter('channelName', channelName);
            filterCards(extractCards());

            const filterAddeddEvent = new CustomEvent('dfInvidiousFilterAdded');
            document.dispatchEvent(filterAddeddEvent);
        })

        elem.appendChild(blockButton);
        elem.addEventListener('mouseover', () => {
            blockButton.style.display = 'block';
        });
        elem.addEventListener('mouseout', () => {
            blockButton.style.display = 'none';
        });
    }

    function processSearchPage() {
        processPageNav();
        processCards();
    }

    function processChannelPage() {
        let channelName = document.querySelector('.channel-profile span').textContent;
        let channelId = window.location.pathname.split('/channel/')[1];

        if (isBlockedChannel(channelName, channelId)) {
            pageIsBlocked(channelName);
            return 
        } 

        let [nav, banner, _, title, bio, links] = document.querySelector('#contents').children;
        let hiddenLinks = ['Switch Invidious Instance', 'View channel on YouTube', 'Shorts', 'Community']

        processPageNav();
        processCards(true);

        banner.classList.add('channel-banner');
        title.classList.add('channel-title');
        bio.classList.add('channel-bio');
        links.classList.add('channel-links');

        let [subscribe, rss] = title.querySelectorAll('.pure-u');

        rss.style.display = 'none';

        processSubButton(subscribe);

        Array.from(links.firstElementChild.children).forEach(link => {
            if (hiddenLinks.includes(link.firstElementChild.textContent)) {
                link.style.display = 'none';
            }
        })
    }

    function processVideoPage() {
        let [navbar, _, player, title] = document.querySelector('#contents').children;
        let channelTitle = document.querySelector('.title');

        let videoTitle = title.querySelector('h1').textContent.trim();
        let channelName = channelTitle.querySelector('#channel-name').textContent.trim();
        let channelId = channelTitle.querySelector('.flex-left').querySelector('a').href.split('/channel/')[1];

        if (isBlockedVideo(videoTitle) || isBlockedChannel(channelName, channelId)) {
            pageIsBlocked(videoTitle);
            return 
        } 

        title.classList.add('player-title');
        channelTitle.classList.add('channel-title');

        processSubButton(channelTitle.querySelector('.pure-u'));
        
        let viewCount = document.querySelector('#views').childNodes[1].nodeValue;
        let viewStrPlur = viewCount === '1' ? '' : 's';
        let pubDate = document.querySelector('#published-date').querySelector('b').textContent.replace('Shared ', '');

        if (!document.querySelector('.video-info')) {
            let info = document.createElement('div');
            info.classList.add('video-info');

            let views = document.createElement('span');
            let published = document.createElement('span');

            views.classList.add('video-views');
            published.classList.add('video-published');

            [views, published].forEach(x => info.appendChild(x))

            views.textContent = `${viewCount} view${viewStrPlur}`;
            published.textContent = pubDate;

            let meta = document.querySelector('.pure-u-md-4-5');
            meta = meta ? meta : document.querySelector('.pure-u-lg-3-5');
        
            let infoBox = meta.children[1];

            infoBox.insertBefore(info, infoBox.firstChild);
        }

    }

    function extractChannelInfo(card) {
        let channelName = card.querySelector('a .channel-name').textContent.trim();
        let channelId = card.querySelector('a[href^="/channel/"]').href.split('/channel/')[1];

        return {channelName: channelName, channelId: channelId}
    }

    function extractCards() {
        cards = document.querySelectorAll('.pure-u-1.pure-u-md-1-4');
        cardObjs = []
        cards.forEach(card => {
            if (card.querySelector('.thumbnail')) {
                let title = card.querySelector('.video-card-row').textContent.trim()
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

        })
        return cardObjs
    }

    async function getFilters() {
        let res = await browser.storage.local.get()
        return res.filters
    }

    async function filterCards(cardObjs) {
        let filters = await getFilters()
        filteredItemsCount = 0;
        cardObjs.forEach(cardObj => {
            if (isBlockedChannel(filters, cardObj.channelName, cardObj.channelId) || (cardObj.type === 'video' && isBlockedVideo(filters,cardObj.title))) {
                cardObj.cardElem.style.display = 'none';
                filteredItemsCount++
            }
        })
        return filteredItemsCount
    }

    function processCards(isChannelPage) {
        cardObjs = extractCards();
        filteredItemsCount = filterCards(cardObjs);

        if (filteredItemsCount === cards.length) {
            showMessage('No results');
        }

        cardObjs.forEach(cardObj => {
            if (cardObj.type === 'video') {
                processVideoCard(cardObj.cardElem, isChannelPage)
            }
            else if (cardObj.type === 'channel') {
                processChannelCard(cardObj.cardElem)
            }
        })
    }

    function processChannelCard(card) {
        hide('h5', card);

        let hBox = card.querySelector('.h-box');
        let [_, channel, username, subscribers] = hBox.children;
        let [subCount, subString] = subscribers.innerHTML.split(' ');

        let {channelName, channelId} = extractChannelInfo(card);

        let channelNameElem = channel.querySelector('.flex-left')
        channelNameElem.classList.add('channel-card-name');

        createBlockButton(channelNameElem, card, channelName);

        if (subCount.includes(',')) {
            subscribers.innerHTML = formatCount(subCount) + ' ' + subString;
        };

        username.classList.add('channel-handle');
        subscribers.classList.add('channel-subscribers');
        return true
    }

    function processVideoCard(card, isChannelPage) {
        let [title, channel] = card.querySelectorAll('.video-card-row');
        let [published] = card.querySelectorAll('.video-data');

        let {channelName, _} = extractChannelInfo(card);

        createBlockButton(channel.querySelector('.flex-left'), card, channelName);

        title.classList.add('video-title');
        channel.classList.add('video-channel');
        published.textContent = published.textContent.replace('Shared ', '');

        if (isChannelPage) {
            channel.style.display = 'none';
        }
    }

    function isBlockedChannel(filters, channelName, channelId) {
        if (filters) {
            return testFilters(channelName, filters.channelName) || testFilters(channelId, filters.channelId)
        }
        return false
    }

    function isBlockedVideo(filters, videoTitle) {
        if (filters) {
            return testFilters(videoTitle, filters.videoTitle)
        }
        return false
    }

    function testFilters(text, filters) {
        for (const f of filters) {
            try {
                if (new RegExp(f).test(text)) {
                    return true
                }
            } catch {
            }
        }
        return false;
    }
}

dfInvidious()