(async function() {
    let storageData = {
        filterData: {},
        options: {}
    }

    const filterNames = ['videoTitle', 'channelName', 'channelId'];
    const channelLinks = ['viewChannelOnYoutube', 'switchInvidiousInstance', 'shorts', 'community', 'livestreams', 'playlists', 'releases'];

    const filterEditors = getElementsFromIds(filterNames);
    const channelLinkCheckboxes = getElementsFromIds(channelLinks);

    await loadData();
    populateOptions();

    let filterOptions = document.querySelector('#filterOptions');
    showFilterEditor(filterOptions.value);

    filterOptions.addEventListener('change', () => {
        showFilterEditor(filterOptions.value);
    });

    document.querySelectorAll('textarea').forEach((elem) => {
        elem.addEventListener('keyup', activateSaveButton)
    });

    document.querySelectorAll('input[type=checkbox]').forEach((elem) => {
        elem.addEventListener('change', activateSaveButton)
    });

    document.getElementById('save').addEventListener('click', (evt) => {
        if (evt.target.classList.contains('disabled')) return;
        saveOptions();
    });

    document.getElementById('export').addEventListener('click', () => {
        saveFile(storageData, 'df_invidious_options.json');
    });

    document.getElementById('import').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    
    document.getElementById('importFile').addEventListener('change', importOptions);

    function getElementsFromIds(ids) {
        elems = {};
        ids.forEach((id) => {
            elems[id] = document.getElementById(id);
        });
        return elems
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

    function multilineToArray(text) {
        return text.replace(/\r\n/g, '\n').split('\n').map((x) => x.trim());
    }

    async function saveOptions() {
        document.getElementById('save').classList.add('disabled');

        filterNames.forEach((filterName) => {
            storageData.filterData[filterName] = multilineToArray(filterEditors[filterName].value);
        });

        storageData.options.blockedChannelLinks = Array.from(document.getElementById('blockedChannelLinks').querySelectorAll('input[type=checkbox]:checked')).map(e => e.value);
        storageData.options.hideLoginButton = document.getElementById('hideLoginButton').checked;
        storageData.options.hideSearchFilters = document.getElementById('hideSearchFilters').checked;

        await saveData();
    }

    function importOptions(evt) {
        const files = evt.target.files;
        const f = files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            let json;
            try {
                json = JSON.parse(e.target.result);
                if (json.filterData && json.options) {
                    populateOptions(json);
                    saveOptions();
                }
            } catch (ex) {
                alert('Invalid options');
            }
        };
        reader.readAsText(f);
    }

    function populateOptions(obj = undefined) {
        filterNames.forEach((filterName) => {
            const content = get(`filterData.${filterName}`, [], obj);
            filterEditors[filterName].value = content.join('\n');
        });

        blockedChannelLinks = get('options.blockedChannelLinks', [], obj);

        Object.values(channelLinkCheckboxes).forEach((elem) => {
            elem.checked = blockedChannelLinks.includes(elem.value);
        });

        document.getElementById('hideLoginButton').checked = get('options.hideLoginButton', false, obj);
        document.getElementById('hideSearchFilters').checked = get('options.hideSearchFilters', false, obj);
    }

    function showFilterEditor(filterName) {
        Object.values(filterEditors).forEach((filterEditor) => {
            filterEditor.style.display = 'none';
        });
        document.getElementById(filterName).style.display = 'inline-block';
    }

    function saveFile(data, fileName) {
        const a = document.createElement('a');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'octet/stream' });
        const url = URL.createObjectURL(blob);
        setTimeout(() => {
            a.href = url;
            a.download = fileName;
            const event = new MouseEvent('click');
            a.dispatchEvent(event);
        }, 0);
    }

    function activateSaveButton() {
        document.getElementById('save').classList.remove('disabled');
    }
})();