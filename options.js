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
        form.addEventListener('keyup', () => saveForm(form.id));
        restoreForm(form);
    });

    setStorage(res);

    let filterOptions = document.querySelector('#filterOptions');
    showForm(filterOptions.value);

    filterOptions.addEventListener('change', () => {
        showForm(filterOptions.value);
    })
}

function getStorage() {
    return browser.storage.local.get();
}

function setStorage(data) {
    browser.storage.local.set(data);
}

async function setFilter(filterName, filters) {
    let res = await getStorage();
    res.filters[filterName] = filters;
    setStorage(res);
}

async function saveForm(filterName) {
    let filters = document.getElementById(filterName).value.replace(/^\s*[\r\n]/gm, '').split('\n');
    setFilter(filterName, filters);
};

async function restoreForm(filterForm) {
    let res = await getStorage();
    filterForm.value = res.filters[filterForm.id] ? res.filters[filterForm.id].join('\n') : '';
};

function showForm(filter) {
    document.querySelectorAll('textarea').forEach(form => {
        form.style.display = 'none';
    });
    document.getElementById(filter).style.display = 'block';
}