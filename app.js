const fs = require('fs')
const axios = require('axios').default
const express = require('express')
const crypto = require('crypto')
const moment = require('moment')
const app = express()

global.config = readConfig()
app.listen(global.config.port || 80, () => console.log(`Server Is Running On Port: ${global.config.port}`))
app.use(express.urlencoded({extended: false}));
app.use(express.static('views'))
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
    let data = {config: readConfig(), result: null, code: 0, history: history()}
    if (req.query.status) {
        if (req.query.status === 'ok') {
            data.purchaseStatus = true
            data.code = 2
        } else if (req.query.status === 'fail') {
            data.purchaseStatus = false
            data.code = 2
        }
    }
    res.render('main', data)
})

app.post('/pickup', async (req, res) => {
    const {minPrice, maxPrice} = req.body
    const {result, code} = (await request(minPrice, maxPrice))
    history({
        date: moment().format("MMM Do YYYY, h:mm:ss a"),
        req: {minPrice, maxPrice},
        res: JSON.stringify(JSON.parse(JSON.stringify(result)), null, 2)
    })
    let data = {config: readConfig(), result, code, history: history()}
    res.render('main', data)
})

app.post('/config', (req, res) => {
    writeConfig(req.body)
    res.redirect('/')
})

app.get('/clear-history', async (req, res) => {
    history(0)
    res.redirect('/')
})

app.post('/action', async (req, res) => {
    console.log(req.body)
    if (req.body.action === 'bought' || req.body.action === 'cancel') {
        const result = await request2(req.body.action, req.body.transactionID)
        if (result) {
            if (result.code === 200) {
                res.redirect('/?status=ok')
            } else {
                res.redirect('/?status=fail')
            }
        } else {
            res.redirect('/')
        }
    }

})

async function request(minPrice, maxPrice) {
    try {
        writeConfig({minPrice, maxPrice})
        const {apiUsername, secret, platform} = readConfig()
        const timestamp = moment().format('X')

        /*
        md5 (platform + user + timestamp + secret_key)
        */
        const hash = crypto.createHash('md5').update(`${platform}${apiUsername}${timestamp}${secret}`).digest("hex")
        console.log(apiUsername, secret, platform, timestamp, hash, minPrice, maxPrice)
        let result
        result = await axios({
            method: 'get',
            url: 'https://api.mydgn.com/transfers',
            data: {
                user: apiUsername,
                platform,
                timestamp,
                hash,
                maximumBuyOutPrice: parseInt(maxPrice),
                minimumBuyOutPrice: parseInt(minPrice),
                botapp: 'fifa-node-js-bot-api-345'
            }
        })
        console.log('result API1:', JSON.stringify(result.data))
        return {result: result.data, code: 200}
    } catch (e) {
        if (e.response.status === 404) {
            return {result: '404', code: 404}
        } else {
            console.log('=======Error API1=======>', e.response.data)
            return {result: e.response.data, code: 500}
        }
    }
}

async function request2(action, transactionID) {
    try {
        const {apiUsername, secret, platform, email} = readConfig()
        const timestamp = moment().format('X')

        /*
        md5 (platform + user + timestamp + secret_key)
        */
        const hash = crypto.createHash('md5').update(`${platform}${apiUsername}${timestamp}${secret}`).digest("hex")
        const emailHash = crypto.createHash('md5').update(`${email}`).digest("hex")
        console.log('2', apiUsername, secret, platform, timestamp, hash, transactionID, action)
        let result
        result = await axios({
            method: 'post',
            url: 'https://api.mydgn.com/status',
            data: {
                user: apiUsername,
                platform,
                timestamp,
                hash,
                transactionID: parseInt(transactionID),
                status: action,
                emailHash,
                // code:200
            }
        })
        console.log('API 2 result:', (result.data))
        return {result: result.data, code: 200}
    } catch (e) {
        if (e.response.status === 404) {
            return {result: '404', code: 404}
        } else {
            console.log('=======Error API2=======>', e.response.data)
            return {result: e.response.data, code: 500}
        }
    }
}

function readConfig() {
    history()
    return JSON.parse(fs.readFileSync('conf.json'))
}

function writeConfig(updates) {
    const currentData = readConfig()
    // console.log('Config updated: ',{...currentData, ...updates})
    fs.writeFileSync('conf.json', JSON.stringify({...currentData, ...updates}))
}

function history(history) {
    if (history) {
        const histories = JSON.parse(fs.readFileSync('history.json'))
        histories.push(history)
        fs.writeFileSync('history.json', JSON.stringify(JSON.parse(JSON.stringify(histories)), null, 2))
    } else if (history === 0) {
        fs.writeFileSync('history.json', JSON.stringify([]))
    } else {
        return JSON.parse(fs.readFileSync('history.json')).reverse()
    }
}

