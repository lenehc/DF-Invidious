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

    function processSearchPage() {
        processPageNav();
        processItemCards();
    }

    function processChannelPage() {
        let [nav, banner, _, title, bio, links] = document.querySelector('#contents').children;
        let hiddenLinks = ['Switch Invidious Instance', 'View channel on YouTube', 'Shorts', 'Community']

        processPageNav();
        processItemCards(true);

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

    function processItemCards(isChannelPage) {
        document.querySelectorAll('.pure-u-1.pure-u-md-1-4').forEach(card => {
            if (card.querySelector('.thumbnail')) {
                processVideoCard(card, isChannelPage);
            }
            else {
                processChannelCard(card);
            }
        })
    }

    function processChannelCard(card) {
        hide('h5', card);

        let hBox = card.querySelector('.h-box');
        let [_, channel, username, subscribers] = hBox.children;
        let [subCount, subString] = subscribers.innerHTML.split(' ');

        let channelName = card.querySelector('.channel-name').innerHTML;
        let channelId = channel.querySelector('div > a').href.split('/channel/')[1];

        if (isBlockedChannel(channelName, channelId)) {
            card.style.display = 'none';
        }

        subscribers.innerHTML = formatCount(subCount) + ' ' + subString;

        channel.querySelector('.flex-left').classList.add('channel-card-name');
        username.classList.add('channel-handle');
        subscribers.classList.add('channel-subscribers');
    }

    function processVideoCard(card, isChannelPage) {
        let [title, channel] = card.querySelectorAll('.video-card-row');
        let [published] = card.querySelectorAll('.video-data');

        let channelName = card.querySelector('.channel-name').innerHTML;
        let channelId = channel.querySelector('div > a').href.split('/channel/')[1];
        let videoTitle = title.querySelector('p');

        if (isBlockedChannel(channelName, channelId) || isBlockedVideo(videoTitle)) {
            card.style.display = 'none';
        }

        title.classList.add('video-title');
        channel.classList.add('video-channel');
        published.textContent = published.textContent.replace('Shared ', '');

        if (isChannelPage) {
            channel.style.display = 'none';
        }
    }

    function isBlockedChannel(channelName, channelId) {
        if (storage.filters) {
            return testFilters(channelName, storage.filters.channelName) || testFilters(channelId, storage.filters.channelId)
        }
        return false
    }

    function isBlockedVideo(videoName) {
        if (storage.filters) {
            return testFilters(videoName, storage.filters.videoName)
        }
        return false
    }

    function testFilters(text, filters) {
        for (const f of filters) {
            try {
                let reg = new RegExp(f);
                return reg.test(text);
            } catch {
                return false;
            }
        }
    }
}

dfInvidious()