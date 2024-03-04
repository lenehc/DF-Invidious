init();

async function init() {
    let res = await getStorage();

    if (!res.filters) {
        res.filters = {}
    }

    document.querySelectorAll('textarea').forEach(form => {
        if (!res.filters[form.id]) {
            res.filters[form.id] = [];
        }
        restoreForm(form);
    });

    setStorage(res);

    let filterOptions = document.querySelector('#filterOptions');
    showForm(filterOptions.value);

    filterOptions.addEventListener('change', () => {
        showForm(filterOptions.value);
    });

    document.getElementById('save').addEventListener('click', () => {
        document.querySelectorAll('textarea').forEach(async (form) => {
            await saveForm(form.id);
            restoreForm(form);
        });
    })

    //browser.storage.local.onChanged.addListener(() => {
    //    document.querySelectorAll('textarea').forEach(form => {
    //        restoreForm(form);
    //    });
    //});
}

function getStorage() {
    return browser.storage.local.get();
}

function setStorage(data) {
    return browser.storage.local.set(data);
}

async function setFilter(filterName, filters) {
    let res = await getStorage();
    res.filters[filterName] = filters.filter(x => x !== '');
    await setStorage(res);
}

async function saveForm(filterName) {
    savedFilters = await getStorage().filters[filterName]
    let filters = document.getElementById(filterName).value.replace(/^\s*[\r\n]/gm, '').split('\n');
    await setFilter(filterName, [...savedFilters, ...filters]);
};

async function restoreForm(filterForm) {
    let res = await getStorage();
    filterForm.value = res.filters[filterForm.id] ? res.filters[filterForm.id].join('\n') : '';
};

function showForm(filter) {
    document.querySelectorAll('textarea').forEach(form => {
        form.style.display = 'none';
    });
    form = document.getElementById(filter);
    restoreForm(form);
    form.style.display = 'block';
}