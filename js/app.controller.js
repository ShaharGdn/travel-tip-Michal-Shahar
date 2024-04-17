import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'
import { storageService } from './services/async-storage.service.js'

window.onload = onInit

var gUserPos = null
var gUserAns = {}

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    handleModal,
    onCloseModal,
    onSubmitAddEdit,
    onChooseTheme
}

function onInit() {
    storageService.query('colorDB').then(console.log()).then(color=> changeBgColor(color))

    loadAndRenderLocs()

    mapService.initMap()
        .then(() => {
            mapService.addClickListener((geo) => handleModal('new', geo, null))
            // mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()
    var strHTML = locs.map(loc => {
        const distanceSpan = getDistanceSpan(loc)
        const className = (loc.id === selectedLocId) ? 'active' : ''
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                ${distanceSpan}
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.handleModal('edit', null, '${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
               </div>     
               </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    const isConfirmed = confirm('Are you sure?')
    if (!isConfirmed) return

    locService.remove(locId)
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo, locName, rate) {
    const loc = {
        name: locName || 'Just a place',
        rate,
        geo
    }
    locService.save(loc)
        .then((savedLoc) => {
            flashMsg(`Added Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            gUserPos = latLng
            console.log('gUserPos:', gUserPos)
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId, rate) {
    locService.getById(locId)
        .then(loc => {
            if (rate !== loc.rate) {
                loc.rate = rate
                locService.save(loc)
                    .then(savedLoc => {
                        flashMsg(`Rate was set to: ${savedLoc.rate}`)
                        loadAndRenderLocs()
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot update location')
                    })

            }
        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    const distanceSpan = getDistanceSpan(loc)

    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-distance').innerHTML = distanceSpan
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })
    locService.getLocCountByUpdatesMap().then(stats => {
        handleStats(stats, 'loc-stats-updates')
    })
}

function handleStats(stats, selector) {
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function getDistanceSpan(loc) {
    if (gUserPos) {
        const latLng1 = { lat: loc.geo.lat, lng: loc.geo.lng }
        var distance = utilService.getDistance(latLng1, gUserPos, 'K');
        var distanceSpan = `<span>Distance: ${distance} KM</span>`
    } else {
        return distanceSpan = ''
    }

    return distanceSpan
}

function handleModal(type, geo = null, id = null) {
    const elModal = document.querySelector('.add-edit-modal')
    const elNameInput = elModal.querySelector('.name-input')
    const elRateInput = elModal.querySelector('.rate-input')
    const elNameSpan = elModal.querySelector('.name')
    const elRateSpan = elModal.querySelector('.rate')


    if (geo) {
        elModal.dataset.loc = JSON.stringify(geo)
    } else if (id) {
        elModal.dataset.locId = id
    }

    switch (type) {
        case 'new':
            elNameSpan.innerText = 'Location name'
            elRateSpan.innerText = 'Rate?'
            elNameInput.value = geo.address
            elNameSpan.classList.remove('hidden')
            elNameInput.classList.remove('hidden')
            break;
        case 'edit':
            console.log('edit:')
            elRateSpan.innerText = 'New rate?'
            locService.getById(id)
                .then(loc => { elRateInput.value = loc.rate })
            elNameInput.classList.add('hidden')
            elNameSpan.classList.add('hidden')
            break;
    }

    elModal.showModal()
}

function onSubmitAddEdit() {
    const elModal = document.querySelector('.add-edit-modal')
    const locName = elModal.querySelector('.name-input').value
    const rate = elModal.querySelector('.rate-input').value

    if ((elModal.dataset.loc)) {
        const geo = JSON.parse(elModal.dataset.loc)
        onAddLoc(geo, locName, rate)
        return
    } else if ((elModal.dataset.locId)) {
        const id = elModal.dataset.locId
        onUpdateLoc(id, rate)
        return
    }
}

function onCloseModal() {
    document.querySelector('.add-edit-modal').close()
}

async function onChooseTheme() {
    const inputOptions = new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                'Pink': "Pink",
                'Green': "Green",
                'Blue': "Blue"
            })
        }, 1000)
    })

    const { value: color } = await Swal.fire({
        title: "Select color",
        input: "radio",
        inputOptions,
        inputValidator: (value) => {
            if (!value) {
                return "You need to choose something!"
            }
        }
    });

    if (color) {
        changeBgColor(color)
        Swal.fire({
            icon: "success",
            html: `You successfully changed to: ${color}`
        })
        storageService.postColor('colorDB', color)
    }
}

function changeBgColor(color) {
    const root = document.documentElement
    switch (color) {
        case 'Pink':
            root.style.setProperty('--bg1', '#fb6f92')
            root.style.setProperty('--bg2', '#ffb3c6')
            root.style.setProperty('--bg3', '#ff8fab')
            break;
        case 'Green':
            root.style.setProperty('--bg1', '#416f5d')
            root.style.setProperty('--bg2', '#9cbb89')
            root.style.setProperty('--bg3', '#638262')
            break;
        case 'Blue':
            root.style.setProperty('--bg1', '#476f95')
            root.style.setProperty('--bg2', '#a3b7ca')
            root.style.setProperty('--bg3', '#7593af')
            break;
    }
}

